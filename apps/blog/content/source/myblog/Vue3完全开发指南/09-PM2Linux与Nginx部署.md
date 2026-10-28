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

一套常见的 Vue + Node 单机部署拓扑：

```text
Internet
   ↓ 80/443
Nginx
   ├─ /assets/*、/index.html → Vue dist 静态文件
   └─ /api/*               → 127.0.0.1:3000
                                  ↓
                              PM2 管理 Node 进程
```

几条关键边界：

- Nginx 是公网入口，负责 TLS、静态文件、反向代理、访问日志和基础限流。
- Node 服务只监听回环地址，3000、9000 这些应用端口不暴露到公网。
- PM2 管 Node 进程，不负责托管 Vue 构建出来的静态文件。
- 云防火墙和主机防火墙一般只开 SSH、HTTP、HTTPS。

## 1. PM2 解决什么问题

直接跑好几个 `node app.js`，会有好几个终端，每个的生命周期都各管各的。PM2 统一提供启动、停止、重启、日志、监控、集群和开机恢复。

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

按 ID 操作适合临时排错；自动化脚本要按稳定的应用名操作。`pm2 monit` 能看进程、CPU、内存和日志。

### 1.1 生产配置文件

把启动参数写进有版本管理的 Ecosystem 文件，免得每次手敲的命令都不一样：

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

- `watch` 适合开发，不适合生产的发布目录；文件一变就可能引发重启风暴。
- `instances: "max"` 会按可用的 CPU 起好几个实例，但内存小的服务器别机械地占满。
- Cluster 模式要求进程尽量无状态。Session、任务锁和限流状态不能只存在某一个进程的内存里。
- WebSocket、定时任务和队列消费者，还要另外评估粘性连接和"只执行一次"的约束。

### 1.2 Reload 与 Restart

`pm2 restart` 是先停再启。Cluster 模式下 `pm2 reload` 会一个个替换 Worker，能缩短停机时间：

```bash
pm2 reload api
```

"零停机"不是无条件保证的。新进程得能正常启动，旧进程要处理终止信号、停止接新请求，数据库迁移也必须向后兼容。

### 1.3 开机恢复

```bash
pm2 startup
```

这条命令会输出一条要用管理员权限执行的系统服务安装命令。照着执行完，再保存当前的进程清单：

```bash
pm2 save
systemctl status "pm2-$(id -un)"
```

PM2 的运行用户必须和部署用户一致。别一会儿用 root、一会儿用普通用户，不然会出现两套 `PM2_HOME`，还有两份互相看不见的进程列表。

## 2. 云服务器与 SSH

### 2.1 公网、私网、DNS 与端口

- 公网 IP：给互联网访问用，一般绑在 Nginx 上。
- 私网 IP：同一个 VPC 里的服务器之间通信，数据库优先走私网。
- DNS：把域名解析到公网 IP；改完要等缓存过期。
- 22：SSH；80：HTTP；443：HTTPS。

云厂商的 DDoS 基础防护不代表应用已经安全了。端口还是要最少开放，限流、监控、备份和应急方案也都要有。

### 2.2 不用 root 直接部署

第一次初始化可能要用管理员账号，之后要建一个专用的用户，用密钥登录：

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo install -m 600 -o deploy -g deploy ./authorized_keys /home/deploy/.ssh/authorized_keys
```

确认新用户能通过 SSH 登录以后，再按组织的规范关掉 root 的密码登录。改 SSH 配置之前一定要留着一个验证过的会话，免得把自己锁在服务器外面。

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

改完先检查配置，再重载：

```bash
sudo sshd -t
sudo systemctl reload sshd
```

不同发行版的服务名可能是 `ssh`，也可能是 `sshd`。

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

`chmod 750 file` 表示 Owner 是 `rwx`、Group 是 `r-x`、Others 没有权限。三个数字依次对应 Owner、Group、Others。

别用 `chmod -R 777` 来解决部署报错。先从正在加载的配置里确认 Nginx Worker 是哪个用户，再只给它读前端产物需要的权限：

```bash
nginx_user="$(sudo nginx -T 2>&1 | awk '$1 == "user" { gsub(";", "", $2); print $2; exit }')"
test -n "$nginx_user"
nginx_group="$(id -gn "$nginx_user")"

sudo chown -R deploy:"$nginx_group" /srv/myapp/current/web/dist
sudo find /srv/myapp/current/web/dist -type d -exec chmod 750 {} \;
sudo find /srv/myapp/current/web/dist -type f -exec chmod 640 {} \;
namei -l /srv/myapp/current/web/dist/index.html
```

别把上面的 `640` 递归套到整个项目上：部署脚本、原生模块和 `node_modules/.bin` 都要保留执行位。Nginx 读静态文件时，每一级父目录也都得允许对应的用户或组进入，可以用 `namei -l` 一级级检查。

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

`grep '[n]ginx'` 能避免把 grep 自己也匹配出来。看监听端口优先用 `ss`，别只靠浏览器去猜。

## 4. 安装 Node.js

手动下二进制包、改 `/etc/profile`，能帮助理解 `PATH`；生产机器更适合用包管理器或组织内部的镜像安装，并锁定版本：

```bash
node --version
npm --version
command -v node
```

原则：

1. 用还在维护的 Node LTS。
2. 记下版本，CI、测试、生产都保持一致。
3. 别用不可信的镜像替换全局的 Registry。
4. 应用依赖别全局安装；应用用锁文件加 `npm ci`。
5. 服务启动前校验环境变量，密钥由部署系统注入。

用手动二进制包的话，`PATH` 的各个条目用冒号隔开：

```bash
export PATH="/opt/node/bin:$PATH"
```

系统服务不一定会读交互式 Shell 的 Profile，所以最后还是要在 systemd/PM2 的环境里显式确认 `node` 的路径。

## 5. 部署 Node 接口

推荐的目录：

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

Node 和 Nginx 在同一台机器上时，Node 只绑 `127.0.0.1`。容器或独立反向代理的场景，要按实际的网络命名空间选监听地址，再由安全组、防火墙或容器网络限制来源。健康接口至少要证明进程能响应；发布依赖数据库的话，还要单独设计 Readiness 检查，但别在公网上泄漏版本、环境变量或内部拓扑。

防火墙只开真正需要的入口。以 firewalld 为例：

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

别为了测试把 Node 的 3000/9999 端口永久开到公网上。在本机用 `curl` 测 Node，用 Nginx 的域名测完整链路。

## 6. Nginx 的角色

### 6.1 正向代理与反向代理

- 正向代理替客户端访问外部服务，目标服务看到的是代理。
- 反向代理替服务端集群接收客户端的请求，客户端不用知道后端有哪些实例。

这个项目用的是反向代理：浏览器只访问同源的 `https://example.com/api/*`，Nginx 再转发给 Node。

### 6.2 静态与动态分离

Vue 的 HTML、JS、CSS 和图片由 Nginx 直接读；`/api` 请求交给 Node。这样 Node 少了静态文件的开销，缓存和压缩策略也集中在入口这一层。

### 6.3 Worker 与连接数

`worker_processes auto` 一般会按 CPU 自动选 Worker 的数量。单个 Worker 的 `worker_connections` 是最大连接数的上限之一，理论总量大概是：

```text
worker_processes × worker_connections
```

真实的上限还受文件描述符、反向代理一进一出两条连接、内存、内核参数和上游容量的限制，不能光把数字调大。

## 7. 安装与管理 Nginx

优先用发行版的包或官方可信的仓库，能拿到 systemd、升级和安全补丁的集成：

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install nginx

# RHEL 系
sudo dnf install nginx
```

`configure → make → make install` 适合确实要自定义模块或编译选项的场景，但要额外维护校验和、编译参数、安全补丁和升级流程。

常用命令：

```bash
nginx -v
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl status nginx
sudo systemctl reload nginx
sudo systemctl stop nginx
```

每次重载前先跑 `nginx -t`。`reload` 会让新的 Worker 读新配置，让旧的 Worker 尽量处理完现有的连接；语法对了，不代表上游地址和文件权限也对了，重载后还要发请求验证。

直接用 Nginx 二进制时：

```bash
sudo nginx -s reload
sudo nginx -s quit
```

`quit` 是优雅退出，`stop` 是快速停止。由 systemd 装的服务优先用 `systemctl`，别混着用好几套进程管理方式。

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

`user` 指令在 Main 上下文里，但别从别的发行版照抄一个固定的账号：Debian/Ubuntu 的包一般用 `www-data`，RHEL 系常见的是 `nginx`。以当前机器实际加载的包配置和 `ps` 的输出为准。

- Main：运行用户、Worker 数量、错误日志、PID。
- `events`：连接处理的参数。
- `http`：MIME、日志、压缩、上游和通用的 HTTP 设置。
- `server`：一个域名/端口对应的虚拟主机。
- `location`：按 URI 匹配处理方式。

`sendfile on` 让内核更高效地发送静态文件。`keepalive_timeout` 控制空闲的 Keep-Alive 连接等多久。Gzip/Brotli 开没开，取决于明确的配置和编译进来的模块，不能默认认为已经压缩了。

## 9. Vue 静态站点与 API 代理

### 9.1 构建

```bash
cd /srv/myapp/current/web
npm ci
npm run build
test -f dist/index.html
```

`dist` 是构建产物，不跑 Vite 开发服务器。下面是一份能用的 HTTP 配置骨架：

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

`proxy_pass http://node_backend;` 后面没跟 URI，所以 `/api/users` 会原样传给上游。写成带路径或尾斜杠的形式的话，URI 的替换规则就变了，配完一定要用真实请求验证。

Nginx 转发让浏览器看到的是同源的 `/api`，所以生产环境不用放开宽泛的 CORS。但它代替不了服务端的认证和 CSRF 防护。

### 9.2 History 模式 404

访问根页面没问题，刷新 `/about` 却返回 404，原因是：

1. 客户端导航时，`/about` 由 Vue Router 接管。
2. 刷新时，浏览器直接向 Nginx 请求 `/about`。
3. 磁盘上没有这个文件。

```nginx
try_files $uri $uri/ /index.html;
```

这条规则先试真实的静态文件，再把不认识的前端路由交回给 SPA。`/api` 必须有更具体的 Location，不能也回退到 `index.html`，不然接口出错会伪装成 200 的 HTML。

### 9.3 HTTPS

生产站点要用可信的证书，并自动续期。证书可以交给云负载均衡、托管平台或 ACME 客户端管。TLS 生效以后再配：

- 80 跳转到 443。
- Cookie 带上 `Secure`、`HttpOnly`、`SameSite`。
- HSTS 要在确认所有子域都能长期用 HTTPS 之后再逐步开启。
- 转发正确的 `X-Forwarded-Proto`，并让 Node 只信任受控的代理。

## 10. 反向代理与跨域

开发环境常见两个 Origin：

```text
http://localhost:5173  Vue
http://localhost:3000  Node
```

协议、主机、端口任何一项不同就是不同的 Origin。开发阶段用 Vite proxy；生产阶段用 Nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
}
```

浏览器一直请求当前站点的 `/api/...`。别用代理去转发不受信任的任意目标 URL，不然就成了开放代理，或者有 SSRF 风险。

## 11. 日志与 GoAccess

### 11.1 三层日志

```bash
pm2 logs api --lines 200
sudo journalctl -u nginx --since "30 minutes ago"
sudo tail -f /var/log/nginx/myapp.access.log
sudo tail -f /var/log/nginx/myapp.error.log
```

定位的顺序：

1. Nginx 有没有收到请求。
2. Nginx 返回的状态码和耗时。
3. 上游连没连上。
4. Node 有没有收到请求、有没有正常响应。

访问日志里可能有 IP、路径、Query、User-Agent 和 Referer。别把 Token、密码、身份证号这些放进 URL；日志要限制访问权限，设好轮转和保留期限。

### 11.2 GoAccess

GoAccess 能把 Nginx 的 Access Log 汇总成终端或 HTML 报告：

```bash
sudo goaccess /var/log/nginx/myapp.access.log \
  --log-format=COMBINED
```

生成实时 HTML 之前，要确认 WebSocket、报告文件的权限和暴露范围。统计面板本身就包含访问行为的数据，要放在内网、VPN 或认证后面，不能直接公开。

日志分析首先是为了容量、故障和安全审计，不该拿来没有目的地长期追踪个人。

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

`max_fails` 和 `fail_timeout` 是开源 Nginx 的被动失败判定参数，不是完整的主动健康检查。备用节点也不是"某个请求超过 20 秒就马上接管"这么简单。

PM2 已经在同一个端口上用了 Cluster 模式的话，PM2 自己会把连接分给 Worker；也可以让好几个独立的端口由 Nginx 分流。两层都做负载均衡之前，先把进程模型、健康检查和日志归属想清楚。

压测不能只看"2000 次都成功了"。至少要记下：

- 并发数和持续时间。
- P50/P95/P99 延迟。
- 错误率和超时率。
- CPU、内存、事件循环延迟、数据库连接数。
- 测试数据、预热、客户端瓶颈，以及和生产容量的差异。

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

这里假设压缩包顶层有 `web/` 和 `server/`，校验和文件由可信的 CI 生成，Release 和 `current` 在同一个文件系统上。脚本要求 `current` 已经指向一个能用的旧版本；第一次上线要走单独的 Bootstrap 流程。`mv -T` 原子地替换软链接；切换后 PM2、Nginx 或健康检查只要有一个失败，`ERR` Trap 就会恢复旧链接，重新加载旧版本。

真实的发布还要按项目补上：

1. 数据库备份，以及向后兼容的 Migration。
2. 构建产物的校验和或镜像摘要。
3. 健康检查、关键业务的 Smoke Test 和监控观察窗口。
4. 数据库变更失败时的前向修复或兼容回滚策略。
5. 清理旧的 Release，但保留足够的回滚版本。

## 14. 故障定位

### 公网完全连不上

查 DNS、云安全组、主机防火墙、Nginx 有没有监听 80/443，以及域名是不是解析到了正确的服务器。

### Nginx 返回 502

```bash
curl -v http://127.0.0.1:3000/health
ss -lntp | grep ':3000'
pm2 status
sudo tail -n 100 /var/log/nginx/myapp.error.log
```

本机能访问、Nginx 还是 502 的话，再查代理地址、Unix Socket/端口的权限，以及 SELinux/AppArmor 策略。

### Nginx 配置改了没生效

确认改的是正在用的那份配置：

```bash
sudo nginx -T
sudo nginx -t
sudo systemctl reload nginx
```

### Vue 子路由刷新 404

确认 `location /` 里有 `try_files`，并且 `root` 指向的是真正的 `dist`。

### 静态文件 403

查 Nginx Worker 的用户、文件的 Owner/Group、每一级父目录的执行权限，以及 SELinux 上下文。别直接改成 777。

### PM2 重启后应用消失

确认启动和 `pm2 save` 用的是同一个部署用户，`pm2 startup` 对应的 systemd 服务存在，再看它的日志。

## 15. 上线检查

- [ ] Node、npm、PM2、Nginx 的版本都记下来了，并且都在支持周期内。
- [ ] SSH 用密钥和普通的部署用户，root/密码登录按规范收紧了。
- [ ] 云防火墙和主机防火墙只开了必要的端口。
- [ ] Node 绑定 `127.0.0.1`，应用端口没暴露到公网。
- [ ] Vue 用的是生产构建产物，Nginx 配了静态缓存和 History fallback。
- [ ] `/api` 单独做了反向代理，没被 SPA fallback 吞掉。
- [ ] PM2 用 Ecosystem 文件，环境变量和密钥没写进仓库。
- [ ] `nginx -t`、Node 健康检查和完整的业务请求都通过了。
- [ ] TLS、Cookie、安全头和代理信任设置都按生产域名验证过。
- [ ] 日志不记敏感信息，配好了权限、轮转、保留和告警。
- [ ] 发布有数据库兼容策略、观察窗口和能执行的回滚路径。

把 PM2、Linux 权限、Nginx 代理和 Upstream 连起来以后，部署就不再是"端口能访问就算完事"，而是一条能验证、暴露最少、能重载、能观测、能回滚的交付链。
