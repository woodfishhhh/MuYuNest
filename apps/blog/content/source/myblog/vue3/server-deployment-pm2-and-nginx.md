---
title: Web 服务上线指南：SSH、Linux 权限、PM2 与 Nginx 反向代理
slug: server-deployment-pm2-and-nginx
date: 2026-07-13
categories:
  - 工程实践
tags:
  - Nginx
  - PM2
  - Linux
  - SSH
  - 生产部署
---

一个标准的单机 Web 应用上线架构，本质上是把公网入口、静态资源分发和后端应用进程分层隔离：

```text
Internet
   ↓ 80 / 443
Nginx（公网入口：TLS、静态资源缓存、反向代理、访问日志）
   ├─ /assets/*、/index.html → 前端 SPA 构建产物 dist/
   └─ /api/*                 → 127.0.0.1:3000
                                    ↓
                                PM2 守护 Node 进程
```

**生产部署的四条硬边界：Nginx 统一接管公网流量并卸载 TLS；Node 业务进程只绑定回环地址 `127.0.0.1`、绝不把 3000 这类应用端口裸露到公网；PM2 只管后端进程不托管静态资源；主机与云防火墙仅放行 SSH、HTTP、HTTPS。**

## SSH 加固与独立部署账号

拿到新服务器后，第一件事是建一个专用的非 root 部署账号并配置公钥登录，切忌长期拿 root 密码直接操作业务目录：

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo install -m 600 -o deploy -g deploy ./authorized_keys /home/deploy/.ssh/authorized_keys
```

**修改 `/etc/ssh/sshd_config` 禁用密码与 root 登录前，务必保留一个已经用密钥验证成功登录的终端会话，改完后先跑 `sudo sshd -t` 校验语法再执行 `sudo systemctl reload sshd`，防止把自己锁在服务器外面。**

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

同时配置系统防火墙只放行必要服务（以 `firewalld` 为例，注意云厂商安全组需同步收紧）：

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

## Linux 文件权限与目录布局

线上遇到 Nginx 报 403 Forbidden 时，很多人习惯顺手敲一条 `chmod -R 777`，这会让系统里任意本地账号都能篡改静态产物或执行脚本。

读懂 `ls -l` 的权限位就能精准授权：

```text
-rw-r----- 1 deploy www-data 1842 Jul 13 12:00 app.conf
│└┬┘└┬┘└┬┘   │      │
│ │  │  │    owner  group
│ │  │  └─ others: ---
│ │  └──── group: r--
│ └─────── owner: rw-
└───────── file type: - 普通文件，d 目录，l 符号链接
```

对文件而言，`r(4)`、`w(2)`、`x(1)` 对应读、写、执行；对目录而言，`r` 允许列出文件名，`w` 允许增删改目录项，**`x` 允许进入并访问目录内文件**。

**Nginx 读取前端 `dist/` 时，不仅产物文件本身需要归属于 Nginx Worker 所在用户组并赋予 `640/750` 权限，从 `/` 到 `dist/` 路径上的每一级父目录也必须对 Nginx 用户开放执行位 `x`。** 可以直接用 `nginx -T` 提取实际运行的 Worker 账号并用 `namei -l` 逐级排查：

```bash
nginx_user="$(sudo nginx -T 2>&1 | awk '$1 == "user" { gsub(";", "", $2); print $2; exit }')"
test -n "$nginx_user"
nginx_group="$(id -gn "$nginx_user")"

sudo chown -R deploy:"$nginx_group" /srv/myapp/current/web/dist
sudo find /srv/myapp/current/web/dist -type d -exec chmod 750 {} \;
sudo find /srv/myapp/current/web/dist -type f -exec chmod 640 {} \;
namei -l /srv/myapp/current/web/dist/index.html
```

切勿把 `640` 递归套用到服务端 `node_modules/.bin` 或启动脚本上，否则会剥夺可执行权限。日常排查常用命令包括 `ss -lntp`（核对端口真实监听进程）、`ps -ef | grep '[n]ginx'`、`df -h` 与 `free -h`。

推荐的上线目录采用 `releases` + `current` 软链接结构，方便秒级原子切换与回滚：

```text
/srv/myapp/
├─ releases/
│  ├─ 20260713-120000/
│  └─ 20260713-133000/
├─ current -> releases/20260713-133000/
└─ shared/
   └─ logs/
```

## PM2 进程守护、Cluster 与开机自启

手工开终端跑 `node dist/server.js` 一旦断连或崩溃就会停服。PM2 把启动参数、日志聚合、内存重启和开机恢复统一收拢进可版本控制的 `ecosystem.config.cjs`：

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'api',
      script: './dist/server.js',
      cwd: '/srv/myapp/current/server',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 10_000,
      listen_timeout: 10_000,
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
      },
    },
  ],
}
```

使用 PM2 有四条核心纪律：

1. **生产配置严禁开启 `watch: true`**，文件变动引发的反复重启会直接打挂服务；使用 `cluster` 模式时，后端进程必须保持无状态（Session、限流计数、任务锁放进 Redis 或数据库，不能留在单进程内存里）。
2. **用 `pm2 reload` 代替 `pm2 restart`**：`reload` 会在 Cluster 模式下逐个替换 Worker 进程以缩短中断窗口，前提是应用正确处理 `SIGINT/SIGTERM` 优雅退出且数据库变更向后兼容（平滑切换依赖这些前置条件，不能空口假设绝对零停机）。
3. **固定同一个部署用户执行 `pm2 startup` 与 `pm2 save`**：切换 root 和普通用户会生成两套互相隔离的 `PM2_HOME`，导致机器重启后进程列表丢失。
4. **Node 运行时保持 LTS 且与 CI 一致**：若用手动二进制安装 Node，除了写进 `/etc/profile`，还需在 systemd/PM2 环境中显式核对可执行文件路径，因为非交互式服务进程往往不读取交互 Shell Profile。

```bash
pm2 startOrReload ecosystem.config.cjs --env production
pm2 startup
pm2 save
systemctl status "pm2-$(id -un)"
```

## Nginx 反向代理、SPA 回退与 HTTPS

优先通过系统包管理器安装 Nginx（`apt install nginx` 或 `dnf install nginx`），能直接拿到 systemd 服务管理与安全补丁更新。每次修改配置后必须按顺序执行：先 `sudo nginx -t` 校验语法，再 `sudo systemctl reload nginx`，最后用 `curl` 实测接口与静态资源响应头。

一份兼顾 SPA History 路由回退、后端 API 反向代理、长连接复用与静态资源强缓存的配置骨架如下：

```nginx
upstream node_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name example.com;

    root /srv/myapp/current/web/dist;
    index index.html;
    server_tokens off;

    access_log /var/log/nginx/myapp.access.log;
    error_log  /var/log/nginx/myapp.error.log warn;

    location /api/ {
        proxy_pass http://node_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 3s;
        proxy_read_timeout 30s;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

配置中有三个高频陷阱需要盯紧：

1. **`proxy_pass` 末尾斜杠决定路径重写行为**：上面写成 `http://node_backend;`（末尾无 URI），`/api/users` 会原样透传给上游；如果多写了一个末尾斜杠 `http://node_backend/;`，Nginx 会把 `/api/` 截掉再转发。
2. **SPA 刷新 404 与接口假 200**：`location /` 里的 `try_files $uri $uri/ /index.html;` 负责把找不到物理文件的前端路由交回给 SPA 路由器，而 `/assets/` 必须显式写 `=404`、`/api/` 必须独立成更具体的 `location`，避免缺失资源或报错接口被回退成 HTML。
3. **生产域名开启 HTTPS 后的链路联动**：部署好证书并做 80 -> 443 跳转后，开启 `X-Forwarded-Proto` 转发并让后端仅信任本机代理，Cookie 补齐 `Secure`、`HttpOnly` 与合适的 `SameSite`，确认全站子域长期支持 HTTPS 后再逐步启用 HSTS。

### 负载均衡策略与日志排查

多个后端实例放进 `upstream` 时，可以根据负载特征选择调度方式：`least_conn` 适合请求耗时差异较大的接口；`weight` 按机器规格分配权重；`ip_hash` 按客户端 IP 固定分发（在反向代理或运营商 NAT 下容易分布失衡）；`backup` 标记热备节点。注意开源版 Nginx 的 `max_fails` 和 `fail_timeout` 属于被动熔断判定，并不等价于完整的主动健康检查。

线上出现故障时，沿着“Nginx Access Log -> Nginx Error Log -> 本机 `curl http://127.0.0.1:3000/health` -> `pm2 logs`”的顺序逐层定位。需要汇总流量和状态码分布时，可用 `goaccess /var/log/nginx/myapp.access.log --log-format=COMBINED` 生成分析报告，但生成后的 HTML 报告本身包含访问明细，必须放在内网或认证网关后面，禁止直接挂在公网上。同时设置合理的日志轮转（logrotate），严禁把 Token 或密码拼进 URL Query 里打入访问日志。

## 一次可自动回滚的原子发布脚本

把校验、构建、权限同步、原子软链接切换和失败回滚串进脚本，哪怕健康检查没过也能自动切回上一版：

```bash
set -Eeuo pipefail

app_root=/srv/myapp
artifact=/tmp/myapp-release.tar.gz
checksum=/tmp/myapp-release.tar.gz.sha256
release="$app_root/releases/$(date +%Y%m%d-%H%M%S)"
old_target="$(readlink -f "$app_root/current" 2>/dev/null || true)"
test -n "$old_target" && test -d "$old_target"
switched=0

rollback() {
  status=$?
  trap - ERR
  if (( switched )); then
    rollback_link="$app_root/.current.rollback.$$"
    ln -s "$old_target" "$rollback_link"
    mv -Tf "$rollback_link" "$app_root/current"
    pm2 startOrReload "$app_root/current/server/ecosystem.config.cjs" --env production || true
    sudo nginx -t && sudo systemctl reload nginx || true
  fi
  exit "$status"
}
trap rollback ERR

sha256sum -c "$checksum"
mkdir -p "$release"
tar -xzf "$artifact" -C "$release"

(cd "$release/web" && npm ci && npm run build && test -f dist/index.html)
(cd "$release/server" && npm ci && npm run build && npm prune --omit=dev)

nginx_user="$(sudo nginx -T 2>&1 | awk '$1 == "user" { gsub(";", "", $2); print $2; exit }')"
test -n "$nginx_user"
nginx_group="$(id -gn "$nginx_user")"
sudo chgrp "$nginx_group" "$app_root" "$app_root/releases" "$release" "$release/web"
sudo chmod 710 "$app_root" "$app_root/releases" "$release" "$release/web"
sudo chgrp -R "$nginx_group" "$release/web/dist"
sudo find "$release/web/dist" -type d -exec chmod 750 {} \;
sudo find "$release/web/dist" -type f -exec chmod 640 {} \;

new_link="$app_root/.current.new.$$"
ln -s "$release" "$new_link"
mv -Tf "$new_link" "$app_root/current"
switched=1

pm2 startOrReload "$app_root/current/server/ecosystem.config.cjs" --env production
sudo nginx -t && sudo systemctl reload nginx

curl --fail https://example.com/
curl --fail https://example.com/api/health
trap - ERR
```

`mv -Tf` 可以原子覆盖 `current` 软链接指向。如果在数据库表结构上也有同步变更，数据库迁移必须先做到向后兼容旧版应用代码，否则回滚脚本切回旧进程后依然会因为字段不匹配报错。
