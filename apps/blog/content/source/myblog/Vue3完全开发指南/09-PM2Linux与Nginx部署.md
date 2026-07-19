---
title: PM2、Linux 与 Nginx 部署
date: 2026-07-13
updated: 2026-07-13
tags:
  - PM2
  - Linux
  - Nginx
  - Vue 3
  - Node.js
  - 生产部署
source:
  - https://www.bilibili.com/video/BV1dS4y1y7vd/
bvid: BV1dS4y1y7vd
pages: P93-P107
draft: false
---

# PM2、Linux 与 Nginx 部署

一套常见的 Vue + Node 单机部署拓扑如下：

```text
Internet
   ↓ 80/443
Nginx
   ├─ /assets/*、/index.html → Vue dist 静态文件
   └─ /api/*               → 127.0.0.1:3000
                                  ↓
                              PM2 管理 Node 进程
```

关键边界：

- Nginx 是公网入口，负责 TLS、静态文件、反向代理、访问日志和基础限流。
- Node 服务只监听回环地址，不把 3000、9000 等应用端口暴露到公网。
- PM2 管理 Node 进程，不负责托管 Vue 构建后的静态文件。
- 云防火墙和主机防火墙通常只开放 SSH、HTTP、HTTPS。

## 1. PM2 解决什么问题

直接运行多个 `node app.js` 会产生多个终端和独立生命周期。PM2 提供统一的启动、停止、重启、日志、监控、集群和开机恢复。

```bash
npm install --global pm2
pm2 --version

pm2 start dist/server.js --name api
pm2 list
pm2 logs api
pm2 restart api
pm2 stop api
pm2 delete api
```

按 ID 操作适合临时排错；自动化脚本应按稳定的应用名称操作。`pm2 monit` 可看进程、CPU、内存和日志。

### 1.1 生产配置文件

把启动参数写进版本化的 Ecosystem 文件，避免每次手敲不同命令：

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
};
```

```bash
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

- `watch` 适合开发，不适合生产发布目录；文件变化可能引发重启风暴。
- `instances: "max"` 会按可用 CPU 启动多个实例，但不要机械占满低内存服务器。
- Cluster 模式要求进程尽量无状态。Session、任务锁和限流状态不能只存在某个进程内存中。
- WebSocket、定时任务和队列消费者需要额外评估粘性连接和“只执行一次”的约束。

### 1.2 Reload 与 Restart

`pm2 restart` 会停止后再启动。Cluster 模式下 `pm2 reload` 会逐个替换 Worker，可减少停机窗口：

```bash
pm2 reload api
```

“零停机”不是无条件保证。新进程必须能正常启动，旧进程要处理终止信号并停止接收新请求，数据库迁移也必须向后兼容。

### 1.3 开机恢复

```bash
pm2 startup
```

该命令会输出一条需要以管理员权限执行的系统服务安装命令。按输出执行后再保存当前进程清单：

```bash
pm2 save
systemctl status "pm2-$(id -un)"
```

PM2 的运行用户必须和部署用户一致。不要一会儿用 root、一会儿用普通用户，否则会出现两套 `PM2_HOME` 和两份互相看不见的进程列表。

## 2. 云服务器与 SSH

### 2.1 公网、私网、DNS 与端口

- 公网 IP：供互联网访问，通常绑定 Nginx。
- 私网 IP：同一 VPC 内服务器通信，数据库优先走私网。
- DNS：把域名解析到公网 IP；修改后需要等待缓存过期。
- 22：SSH；80：HTTP；443：HTTPS。

云厂商的 DDoS 基础防护不等于应用已经安全。仍需最小开放端口、限流、监控、备份和应急方案。

### 2.2 不用 root 直接部署

首次初始化可能需要管理员账号，随后应创建专用用户并使用密钥登录：

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo install -m 600 -o deploy -g deploy ./authorized_keys /home/deploy/.ssh/authorized_keys
```

确认新用户能通过 SSH 登录后，再按组织规范关闭 root 密码登录。修改 SSH 配置前必须保留一个已验证的会话，避免把自己锁在服务器外。

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

修改后先检查配置，再重载：

```bash
sudo sshd -t
sudo systemctl reload sshd
```

不同发行版的服务名可能是 `ssh` 或 `sshd`。

## 3. Linux 文件与权限

`ls -l` 的一行可以拆成：

```text
-rw-r----- 1 deploy www-data 1842 Jul 13 12:00 app.conf
│└┬┘└┬┘└┬┘   │      │
│ │  │  │    owner  group
│ │  │  └─ others: ---
│ │  └──── group: r--
│ └─────── owner: rw-
└───────── file type: - 普通文件，d 目录，l 符号链接
```

权限位：

| 权限 | 数值 | 对普通文件 | 对目录 |
| --- | ---: | --- | --- |
| `r` | 4 | 读取内容 | 列出名称 |
| `w` | 2 | 修改内容 | 创建、删除、重命名目录项 |
| `x` | 1 | 执行文件 | 进入并访问目录内对象 |

`chmod 750 file` 表示 Owner 为 `rwx`、Group 为 `r-x`、Others 无权限。三个数字分别对应 Owner、Group、Others。

不要用 `chmod -R 777` 解决部署报错。先从正在加载的配置中确认 Nginx Worker 用户，再只授予它读取前端产物所需的权限：

```bash
nginx_user="$(sudo nginx -T 2>&1 | awk '$1 == "user" { gsub(";", "", $2); print $2; exit }')"
test -n "$nginx_user"
nginx_group="$(id -gn "$nginx_user")"

sudo chown -R deploy:"$nginx_group" /srv/myapp/current/web/dist
sudo find /srv/myapp/current/web/dist -type d -exec chmod 750 {} \;
sudo find /srv/myapp/current/web/dist -type f -exec chmod 640 {} \;
namei -l /srv/myapp/current/web/dist/index.html
```

不要把上述 `640` 递归套到整个项目：部署脚本、原生模块和 `node_modules/.bin` 需要保留执行位。Nginx 读取静态文件时，每一级父目录也必须允许对应用户或组进入，`namei -l` 可以逐级检查。

### 3.1 常用排错命令

```bash
pwd
ls -lah
id
stat /srv/myapp/current
ps -ef | grep '[n]ginx'
ss -lntp
df -h
free -h
```

`grep '[n]ginx'` 可以避免把 grep 自己匹配出来。查看监听端口时优先使用 `ss`，而不是只靠浏览器猜测。

## 4. 安装 Node.js

手动下载二进制包并修改 `/etc/profile` 能帮助理解 `PATH`；生产机器更适合由包管理器或组织镜像安装并锁定版本：

```bash
node --version
npm --version
command -v node
```

原则：

1. 使用仍在维护的 Node LTS。
2. 记录版本并在 CI、测试、生产保持一致。
3. 不用不可信镜像替换全局 Registry。
4. 不把应用依赖全局安装；应用使用锁文件与 `npm ci`。
5. 服务启动前校验环境变量，密钥由部署系统注入。

如果使用手动二进制包，`PATH` 各条目以冒号分隔：

```bash
export PATH="/opt/node/bin:$PATH"
```

系统服务不会必然读取交互式 Shell 的 Profile，因此最终仍应在 systemd/PM2 环境中显式确认 `node` 路径。

## 5. 部署 Node 接口

推荐目录：

```text
/srv/myapp/
├─ releases/
│  ├─ 20260713-120000/
│  └─ 20260713-133000/
├─ current -> releases/20260713-133000/
└─ shared/
   └─ logs/
```

构建和启动：

```bash
cd /srv/myapp/current/server
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs --env production
curl --fail --silent http://127.0.0.1:3000/health
```

Node 与 Nginx 同机部署时，Node 应只绑定 `127.0.0.1`。容器或独立反向代理场景需要按实际网络命名空间选择监听地址，并由安全组、防火墙或容器网络限制来源。健康接口至少证明进程能响应；若发布依赖数据库，还应设计单独的 Readiness 检查，但不要在公网泄漏版本、环境变量或内部拓扑。

防火墙只开放真正需要的入口。以 firewalld 为例：

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

不要为了测试把 Node 的 3000/9999 端口永久开放到公网。通过本机 `curl` 测 Node，通过 Nginx 的域名测完整链路。

## 6. Nginx 的角色

### 6.1 正向代理与反向代理

- 正向代理代表客户端访问外部服务，目标服务看到的是代理。
- 反向代理代表服务端集群接收客户端请求，客户端不需要知道后端实例。

本项目用的是反向代理：浏览器只访问同源的 `https://example.com/api/*`，Nginx 再转发到 Node。

### 6.2 静态与动态分离

Vue 的 HTML、JS、CSS 和图片由 Nginx 直接读取；`/api` 请求交给 Node。这样既减少 Node 的静态文件开销，也让缓存和压缩策略集中在入口层。

### 6.3 Worker 与连接数

`worker_processes auto` 通常按 CPU 自动选择 Worker。单 Worker 的 `worker_connections` 是最大连接数上限之一，理论总量近似：

```text
worker_processes × worker_connections
```

真实上限还受文件描述符、反向代理一进一出连接、内存、内核参数和上游容量约束，不能只把数字调大。

## 7. 安装与管理 Nginx

优先使用发行版包或官方受信仓库，它能提供 systemd、升级和安全补丁集成：

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install nginx

# RHEL 系
sudo dnf install nginx
```

`configure → make → make install` 适合确实需要自定义模块或编译选项的场景，但需要额外维护校验和、编译参数、安全补丁和升级流程。

常用命令：

```bash
nginx -v
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl status nginx
sudo systemctl reload nginx
sudo systemctl stop nginx
```

每次重载前先执行 `nginx -t`。`reload` 会让新 Worker 读取新配置，并让旧 Worker 尽量处理完现有连接；语法正确不代表上游地址和文件权限一定正确，重载后还要做请求验证。

直接使用 Nginx 二进制时：

```bash
sudo nginx -s reload
sudo nginx -s quit
```

`quit` 是优雅退出，`stop` 是快速停止。由 systemd 安装的服务优先使用 `systemctl`，不要混用多套进程管理方式。

## 8. 配置文件层级

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name example.com;

        location / {
            # 当前虚拟主机的路由规则
        }
    }
}
```

`user` 指令位于 Main 上下文，但不要从别的发行版照抄固定账号：Debian/Ubuntu 的包通常使用 `www-data`，RHEL 系常见 `nginx`。以当前机器实际加载的包配置和 `ps` 输出为准。

- Main：运行用户、Worker 数量、错误日志、PID。
- `events`：连接处理参数。
- `http`：MIME、日志、压缩、上游和通用 HTTP 设置。
- `server`：一个域名/端口的虚拟主机。
- `location`：按 URI 匹配处理方式。

`sendfile on` 允许内核更高效地发送静态文件。`keepalive_timeout` 控制空闲 Keep-Alive 连接等待时间。Gzip/Brotli 是否开启取决于明确配置和编译模块，不能假定默认已经压缩。

## 9. Vue 静态站点与 API 代理

### 9.1 构建

```bash
cd /srv/myapp/current/web
npm ci
npm run build
test -f dist/index.html
```

`dist` 是构建产物，不运行 Vite 开发服务器。下面是一份可用的 HTTP 配置骨架：

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

`proxy_pass http://node_backend;` 没有附加 URI，因此 `/api/users` 会原样传给上游。若写成带路径或尾斜杠的形式，URI 替换规则会改变，配置后必须用真实请求验证。

Nginx 转发让浏览器看到的是同源 `/api`，从而不需要在生产环境放开宽泛 CORS。它不会替代服务端认证和 CSRF 防护。

### 9.2 History 模式 404

访问根页面成功，但刷新 `/about` 返回 404，原因是：

1. 客户端导航时，Vue Router 接管 `/about`。
2. 刷新时，浏览器直接向 Nginx 请求 `/about`。
3. 磁盘上没有这个文件。

```nginx
try_files $uri $uri/ /index.html;
```

这条规则先尝试真实静态文件，再把未知前端路由交回 SPA。`/api` 必须有更具体的 Location，不能也回退到 `index.html`，否则接口错误会伪装成 200 HTML。

### 9.3 HTTPS

生产站点应使用可信证书和自动续期。证书可以由云负载均衡、托管平台或 ACME 客户端管理。TLS 生效后再配置：

- 80 跳转到 443。
- `Secure`、`HttpOnly`、`SameSite` Cookie。
- HSTS 只在确认所有子域都能长期使用 HTTPS 后逐步开启。
- 转发正确的 `X-Forwarded-Proto`，并让 Node 只信任受控代理。

## 10. 反向代理与跨域

开发环境常见两个 Origin：

```text
http://localhost:5173  Vue
http://localhost:3000  Node
```

协议、主机、端口任一不同就是不同 Origin。开发阶段用 Vite proxy；生产阶段用 Nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
}
```

浏览器始终请求当前站点的 `/api/...`。不要用代理转发不受信任的任意目标 URL，否则会形成开放代理或 SSRF 风险。

## 11. 日志与 GoAccess

### 11.1 三层日志

```bash
pm2 logs api --lines 200
sudo journalctl -u nginx --since "30 minutes ago"
sudo tail -f /var/log/nginx/myapp.access.log
sudo tail -f /var/log/nginx/myapp.error.log
```

定位顺序：

1. Nginx 是否收到请求。
2. Nginx 返回状态码和耗时。
3. 上游是否连接成功。
4. Node 是否收到请求并正常响应。

访问日志可能包含 IP、路径、Query、User-Agent 和 Referer。不要把 Token、密码、身份证号等放进 URL；限制日志访问权限，设置轮转和保留期限。

### 11.2 GoAccess

GoAccess 可以把 Nginx Access Log 汇总为终端或 HTML 报告：

```bash
sudo goaccess /var/log/nginx/myapp.access.log \
  --log-format=COMBINED
```

生成实时 HTML 前要确认 WebSocket、报告文件权限和暴露范围。统计面板本身包含访问行为数据，应放在内网、VPN 或认证之后，不能直接公开。

日志分析首先服务于容量、故障和安全审计，不应用来无目的长期追踪个人。

## 12. Nginx 负载均衡

多个 Node 实例可以放进一个 `upstream`：

```nginx
upstream node_backend {
    least_conn;
    server 127.0.0.1:3001 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 backup;
    keepalive 32;
}
```

策略：

| 策略 | 特点 |
| --- | --- |
| 默认轮询 | 请求依次分配，适合容量相近实例 |
| `weight` | 更高权重获得更大请求比例 |
| `least_conn` | 优先给当前活动连接较少的实例 |
| `ip_hash` | 按客户端 IP 粘住实例，代理/NAT 下分布可能失衡 |
| `backup` | 主实例都不可用时才参与 |

`max_fails` 与 `fail_timeout` 是开源 Nginx 的被动失败判定参数，不是完整的主动健康检查。备用节点也不是“某个请求超过 20 秒就立刻接管”的简单逻辑。

如果 PM2 已在同一个端口使用 Cluster 模式，PM2 自己会把连接分给 Worker；也可以让多个独立端口由 Nginx 分流。两层都做负载均衡前，应先明确进程模型、健康检查和日志归属。

压测不能只看“2000 次都成功”。至少记录：

- 并发数与持续时间。
- P50/P95/P99 延迟。
- 错误率和超时率。
- CPU、内存、事件循环延迟、数据库连接数。
- 测试数据、预热、客户端瓶颈和生产容量差异。

## 13. 一次可回滚的发布

```bash
set -Eeuo pipefail

app_root=/srv/myapp
artifact=/tmp/myapp-release.tar.gz
checksum=/tmp/myapp-release.tar.gz.sha256
release="$app_root/releases/$(date +%Y%m%d-%H%M%S)"
old_target="$(readlink -f "$app_root/current" 2>/dev/null || true)"
test -n "$old_target"
test -d "$old_target"
switched=0

rollback() {
  status=$?
  trap - ERR

  if (( switched )); then
    rollback_link="$app_root/.current.rollback.$$"
    ln -s "$old_target" "$rollback_link"
    mv -Tf "$rollback_link" "$app_root/current"
    pm2 startOrReload "$app_root/current/server/ecosystem.config.cjs" \
      --env production || true
    sudo nginx -t && sudo systemctl reload nginx || true
  fi

  exit "$status"
}
trap rollback ERR

sha256sum -c "$checksum"
mkdir -p "$release"
tar -xzf "$artifact" -C "$release"
test -f "$release/web/package-lock.json"
test -f "$release/server/package-lock.json"

(
  cd "$release/web"
  npm ci
  npm run build
  test -f dist/index.html
)

(
  cd "$release/server"
  npm ci
  npm run build
  npm prune --omit=dev
)

nginx_user="$(sudo nginx -T 2>&1 | awk '$1 == "user" { gsub(";", "", $2); print $2; exit }')"
test -n "$nginx_user"
nginx_group="$(id -gn "$nginx_user")"
sudo chgrp "$nginx_group" \
  "$app_root" "$app_root/releases" "$release" "$release/web"
sudo chmod 710 \
  "$app_root" "$app_root/releases" "$release" "$release/web"
sudo chgrp -R "$nginx_group" "$release/web/dist"
sudo find "$release/web/dist" -type d -exec chmod 750 {} \;
sudo find "$release/web/dist" -type f -exec chmod 640 {} \;

new_link="$app_root/.current.new.$$"
ln -s "$release" "$new_link"
mv -Tf "$new_link" "$app_root/current"
switched=1

pm2 startOrReload "$app_root/current/server/ecosystem.config.cjs" \
  --env production

sudo nginx -t
sudo systemctl reload nginx

curl --fail https://example.com/
curl --fail https://example.com/api/health

trap - ERR
```

这里假定压缩包顶层包含 `web/` 和 `server/`，校验和文件由可信 CI 生成，并且 Release 与 `current` 位于同一文件系统。脚本要求 `current` 已指向一个可用旧版本；首次上线应走单独的 Bootstrap 流程。`mv -T` 原子替换软链接；切换后的 PM2、Nginx 或健康检查只要失败，`ERR` Trap 就会恢复旧链接并重新加载旧版本。

真实发布还要根据项目补充：

1. 数据库备份与向后兼容 Migration。
2. 构建产物校验和或镜像摘要。
3. 健康检查、关键业务 Smoke Test 和监控观察窗口。
4. 数据库变更失败时的前向修复或兼容回滚策略。
5. 清理旧 Release，但保留足够的回滚版本。

## 14. 故障定位

### 公网完全连不上

检查 DNS、云安全组、主机防火墙、Nginx 是否监听 80/443，以及域名是否到达正确服务器。

### Nginx 返回 502

```bash
curl -v http://127.0.0.1:3000/health
ss -lntp | grep ':3000'
pm2 status
sudo tail -n 100 /var/log/nginx/myapp.error.log
```

若本机能访问但 Nginx 仍 502，再查代理地址、Unix Socket/端口权限，以及 SELinux/AppArmor 策略。

### Nginx 配置改了没生效

确认编辑的是正在使用的配置：

```bash
sudo nginx -T
sudo nginx -t
sudo systemctl reload nginx
```

### Vue 子路由刷新 404

确认 `location /` 有 `try_files`，而且 `root` 指向真正的 `dist`。

### 静态文件 403

检查 Nginx Worker 用户、文件 Owner/Group、每一级父目录的执行权限和 SELinux 上下文。不要直接改成 777。

### PM2 重启后应用消失

确认启动和 `pm2 save` 使用同一个部署用户，`pm2 startup` 对应的 systemd 服务存在，并检查其日志。

## 15. 上线检查

- [ ] Node、npm、PM2、Nginx 版本已记录并处于支持周期。
- [ ] SSH 使用密钥与普通部署用户，root/密码登录按规范收紧。
- [ ] 云防火墙和主机防火墙只开放必要端口。
- [ ] Node 绑定 `127.0.0.1`，应用端口未暴露公网。
- [ ] Vue 使用生产构建产物，Nginx 配置了静态缓存和 History fallback。
- [ ] `/api` 单独反向代理，没有被 SPA fallback 吞掉。
- [ ] PM2 使用 Ecosystem 文件，环境变量与密钥未写进仓库。
- [ ] `nginx -t`、Node 健康检查和完整业务请求均通过。
- [ ] TLS、Cookie、安全头和代理信任设置已按生产域名验证。
- [ ] 日志不记录敏感信息，已配置权限、轮转、保留和告警。
- [ ] 发布有数据库兼容策略、观察窗口和可执行回滚路径。

把 PM2、Linux 权限、Nginx 代理与 Upstream 连起来后，部署不再是“端口能访问就算完成”，而是一条可验证、最小暴露、可重载、可观测、可回滚的交付链。
