---
title: "Linux 目录结构、权限与高频命令速查"
slug: "linux-cli-and-filesystem"
date: 2025-10-06 12:05:09
categories:
  - "工程实践"
tags:
  - "Linux"
  - "Shell命令"
  - "文件系统"
  - "权限管理"
  - "运维"
---

Linux 没有 Windows 那样的盘符概念，整套系统从唯一的根目录 `/` 向下展开，绝大多数管理任务都能通过高频命令组合管道与重定向完成。这份速查把日常使用最频繁的目录路径、文件操作、文本检索、网络与系统监控、压缩归档以及用户权限命令集中整理，方便随时检索核对。

## 目录结构与路径规则

**Linux 只有唯一的顶级目录 `/`，路径层级全部用 `/` 分隔；以 `/` 开头的是绝对路径，其余都是以当前工作目录为起点的相对路径。**

![Linux 根目录与常见系统子目录树结构](https://image-set.oss-cn-zhangjiakou.aliyuncs.com/img-out/2022/10/27/20221027214128.png)

例如 `/home/app/a.txt` 表示根目录 `/` 下 `home` 目录中的 `app/a.txt`。每个登录用户都有专属的 `HOME` 目录：

- 普通用户默认位于 `/home/用户名`；
- `root` 管理员默认位于 `/root`。

特殊路径符号与相对/绝对路径速查：

| 写法 | 含义 | 示例 |
| --- | --- | --- |
| `/` 开头 | 绝对路径，从根目录起算 | `/etc/profile` |
| 非 `/` 开头 | 相对路径，从当前目录起算 | `test/a.txt` |
| `.` | 当前目录 | `./run.sh` |
| `..` | 上级目录 | `../..` 表示上两级 |
| `~` | 当前用户的 `HOME` 目录 | `cd ~` 切回主目录 |

## 目录浏览、文件增删与内容查看

**在 Linux 中以 `.` 开头的文件或目录默认隐藏，必须配合 `ls -a` 才能看到；`rm -rf` 尤其是切到 `root` 后执行不会弹窗确认，下手前务必核对路径。**

```bash
# 查看目录与路径
ls -lah [目标目录]       # -l 列表、-a 含隐藏文件、-h 人类可读大小
pwd                      # 打印当前工作目录绝对路径
cd [目标目录]            # 不带参数时默认切回当前用户 HOME 目录

# 创建目录与空文件
mkdir -p a/b/c           # -p 自动创建不存在的父级目录
touch app.log            # 创建空文件或更新时间戳

# 复制、移动/重命名与删除
cp -r src_dir dst_dir    # -r 递归复制目录
mv old.txt new.txt       # 目标不存在时相当于重命名
rm -rf target            # -r 递归删目录，-f 强制不提示（慎用）

# 查看文件与命令位置
cat app.conf             # 一次性输出全文
more app.log             # 分页查看：空格翻页，q 退出
head -n 20 app.log       # 查看前 20 行
tail -f -n 50 app.log    # -n 指定行数，-f 持续跟踪追加日志
which python3            # 查询命令可执行文件的绝对路径
```

需要查清命令的全部参数时，直接看内建帮助或系统手册比记零散选项更可靠：

```bash
ls --help    # 查看简要参数说明
man ls       # 打开完整联机手册（按 q 退出）
```

## 检索、统计、管道与重定向

**管道符 `|` 把左侧命令的标准输出接给右侧命令的标准输入，而 `>`（覆盖）和 `>>`（追加）把标准输出写入文件；反引号 `` `cmd` `` 或 `$(cmd)` 会先执行内部命令并把输出替换到当前命令行。**

```bash
# 按文件名搜索
find /var/log -name "*.log"

# 过滤匹配关键字并显示行号（含空格的关键字用双引号包裹）
grep -n "ERROR" /var/log/app.log

# 统计字节数、字符数、行数、单词数
wc -l -w -c -m app.log

# 管道嵌套组合
cat access.log | grep "502" | grep "/api" | wc -l

# 输出文本、命令替换与重定向
echo "current dir: $(pwd)" > status.txt   # 覆盖写入
echo "appended at $(date)" >> status.txt  # 追加写入
```

## vi / vim 编辑器高频快捷键

**`vi` 的核心是分清命令模式、输入模式与底线命令模式：在任何输入状态下按 `Esc` 退回命令模式，再决定移动、删改还是 `:wq` 保存退出。**

命令模式进入输入模式：

| 按键 | 效果 |
| --- | --- |
| `i` / `a` | 在当前光标前 / 后进入输入模式 |
| `I` / `A` | 跳到当前行首 / 行尾进入输入模式 |
| `o` / `O` | 在当前行下方 / 上方新开一行进入输入模式 |
| `Esc` | 退出输入模式回到命令模式 |

命令模式光标移动、搜索与编辑：

| 按键 | 效果 |
| --- | --- |
| `h` / `j` / `k` / `l` | 左 / 下 / 上 / 右移动光标（等价方向键） |
| `0` / `$` | 跳到当前行首 / 行尾 |
| `gg` / `G` | 跳到文件首行 / 末行 |
| `/关键字` | 向下搜索，`n` 下一个匹配、`N` 上一个匹配 |
| `dd` / `ndd` | 删除当前行 / 向下 `n` 行 |
| `dG` / `dgg` / `d$` / `d0` | 删到文件尾 / 文件头 / 行尾 / 行首 |
| `yy` / `nyy` / `p` | 复制当前行 / `n` 行，并粘贴到光标下方 |
| `u` / `Ctrl + r` | 撤销 / 反向撤销（重做） |

底线命令模式（命令模式下按 `:` 输入）：

| 命令 | 效果 |
| --- | --- |
| `:w` / `:q` / `:wq` | 仅保存 / 仅退出 / 保存并退出 |
| `:q!` | 不保存强制退出 |
| `:set nu` / `:set paste` | 显示行号 / 开启粘贴模式（防自动缩进错乱） |

## 软件安装、服务、软链接与时间同步

**包管理器 `yum`（CentOS/RHEL）与 `apt`（Ubuntu/Debian）及 `systemctl` 均涉及系统级变更，通常需要 `root` 或 `sudo` 权限；系统服务与软链接路径建议始终写绝对路径，避免工作目录切换后失效。**

```bash
# CentOS / Ubuntu 软件包管理
yum install -y nginx && yum remove -y nginx && yum search nginx
apt update && apt install -y nginx && apt remove -y nginx

# systemd 服务控制
systemctl start|stop|restart|status|enable|disable nginx

# 创建软链接（快捷方式）
ln -s /usr/local/app/bin/app /usr/bin/app

# 日期格式化与时间偏移计算（支持 year/month/day/hour/minute/second）
date "+%Y-%m-%d %H:%M:%S"
date -d "+1 day" "+%Y-%m-%d"
date -d "-2 hour" "+%Y-%m-%d %H:%M:%S"

# 修改系统时区为上海并同步时间
rm -f /etc/localtime
sudo ln -s /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
yum install -y ntp && systemctl enable --now ntpd
ntpdate -u ntp.aliyun.com
```

`date` 常用格式符：`%Y` 四位年份、`%y` 两位年份、`%m` 月（`01..12`）、`%d` 日（`01..31`）、`%H` 时（`00..23`）、`%M` 分（`00..59`）、`%S` 秒（`00..60`）、`%s` Unix 秒级时间戳。

## 网络排查、进程管理与系统监控

**排查服务连不通或机器卡顿时，通常按“主机名与 IP → 端口占用（`netstat` / `nmap`）→ 进程（`ps` / `top`）→ 磁盘与网络 I/O（`df` / `iostat` / `sar`）”顺序逐层缩窄范围。**

### IP、主机名与静态网卡配置

`127.0.0.1` 指代本机回环地址；`0.0.0.0` 在路由表里常代表任意地址，在服务监听配置中表示绑定本机全部网卡地址。

```bash
ifconfig                          # 查看网卡与 IP 地址
hostname                          # 查看当前主机名
hostnamectl set-hostname web-01   # 设置主机名
```

CentOS 7 静态 IP 网卡配置示例（`/etc/sysconfig/network-scripts/ifcfg-ens33`）：

```ini
TYPE="Ethernet"
PROXY_METHOD="none"
BROWSER_ONLY="no"
BOOTPROTO="static"
DEFROUTE="yes"
IPV4_FAILURE_FATAL="no"
IPV6INIT="yes"
IPV6_AUTOCONF="yes"
IPV6_DEFROUTE="yes"
IPV6_FAILURE_FATAL="no"
IPV6_ADDR_GEN_MODE="stable-privacy"
NAME="ens33"
UUID="1b0011cb-0d2e-4eaa-8a11-af7d50ebc876"
DEVICE="ens33"
ONBOOT="yes"
IPADDR="192.168.88.131"
NETMASK="255.255.255.0"
GATEWAY="192.168.88.2"
DNS1="192.168.88.2"
```

### 连通性测试、端口与文件下载

```bash
# 连通性测试（不加 -c 会持续发送 ICMP 请求）
ping -c 3 baidu.com

# 扫描端口占用与查看本机监听端口
nmap 127.0.0.1
netstat -anp | grep 8080

# 非交互式下载与 HTTP 请求
wget -b https://example.com/archive.tar.gz   # -b 后台下载，日志写入 wget-log
tail -f wget-log                             # 监控后台下载进度
curl cip.cc                                  # 查询出口公网 IP
curl -O https://example.com/archive.tar.gz   # -O 按原文件名保存
```

注意：`wget` 无论最终是否下载成功都会在当前目录创建目标文件，中断后记得手动清理残缺文件。

### 进程与资源监控（`ps` / `kill` / `top` / `df` / `iostat` / `sar`）

```bash
ps -ef | grep tail       # 查看匹配进程与 PID
kill 46712               # 发送终止信号请求进程退出
kill -9 2339             # -9 强制杀死无响应进程

df -h                    # 查看各挂载点磁盘空间占用
iostat -x 2 5            # 每 2 秒刷新一次扩展磁盘 I/O 指标，共 5 次
sar -n DEV 3 2           # 每 3 秒统计一次网卡收发包与吞吐，共 2 次
```

`iostat -x` 与 `sar -n DEV` 核心指标速查：

- `iostat -x`：`tps` 每秒 I/O 请求数、`rKB/s` 与 `wKB/s` 读写吞吐、`await` 单次 I/O 平均等待时间（ms）、`%util` 磁盘繁忙度。
- `sar -n DEV`：`rxpck/s` / `txpck/s` 每秒收发包数、`rxKB/s` / `txKB/s` 每秒收发 KB 数、`rxmcst/s` 每秒多播包数。

`top` 命令常用参数与交互快捷键：

| 命令行选项 | 说明 | 交互按键 | 说明 |
| --- | --- | --- | --- |
| `-p PID` | 只监控指定进程 | `h` | 显示帮助界面 |
| `-d 秒` | 设置刷新间隔（默认 5s） | `P` / `M` / `T` | 按 CPU / 常驻内存 RES / 累计时间排序 |
| `-c` | 显示完整启动命令 | `c` / `i` | 切换完整命令显示 / 隐藏空闲与僵尸进程 |
| `-n 次数` | 刷新指定次数后退出 | `t` / `m` / `l` | 切换 CPU / 内存 / 负载摘要显示 |
| `-b` | 批处理模式，配合 `-n` 重定向输出 | `E` / `e` | 切换顶部摘要与进程列表的内存单位 |
| `-u 用户` | 只显示特定用户进程 | `f` | 自定义展示字段列 |

## 环境变量与压缩归档

**`PATH` 决定了 Shell 去哪些目录找可执行命令；`export` 只在当前会话生效，永久配置必须写入用户 `~/.bashrc` 或全局 `/etc/profile`。**

```bash
# 环境变量读取与拼接（变量名相邻字符时用 ${} 隔离边界）
env
echo "$PATH"
echo "${PATH}:/opt/bin"
export APP_ENV=production

# tar.gz 打包与解压
tar -zcvf backup.tar.gz app.conf logs/
tar -zxvf backup.tar.gz -C /opt/restore

# zip 打包（含目录必须加 -r）与解压
zip -r bundle.zip dir1 dir2 app.conf
unzip bundle.zip -d /home/app
```

## 用户、用户组与文件权限

**文件权限由属主（u）、属组（g）和其他用户（o）三组 `rwx` 位构成，八进制数字是 `r=4`、`w=2`、`x=1` 的按位相加；普通用户临时提权优先配置 `visudo` 走 `sudo`，不要直接长期挂 `root` 操作。**

![Linux 文件权限数字与 rwx 位对应关系](https://image-set.oss-cn-zhangjiakou.aliyuncs.com/img-out/2022/10/27/20221027222157.png)

```bash
# 切换用户（带 - 会重新加载目标用户的环境变量）与 sudo 提权
su - root
sudo systemctl restart nginx
```

通过 `visudo` 为指定用户授权免密 `sudo`：

```text
app ALL=(ALL) NOPASSWD: ALL
```

权限、属主修改与用户/组管理命令：

```bash
# 修改权限与属主/属组（-R 递归应用到目录下全部内容）
chmod -R 755 /opt/app
chown root hello.txt              # 仅改属主
chown :appgroup hello.txt         # 仅改属组
chown -R app:appgroup /opt/app    # 同时修改属主和属组

# 用户组与用户管理（需 root 权限）
groupadd dev
groupdel dev
useradd -g dev -d /home/alice alice   # 不加 -g 会新建同名组
userdel -r alice                      # -r 连同 HOME 目录一并删除
id alice                              # 查看用户 UID 与所属组
usermod -aG docker alice              # 将用户追加到附加组

# 查询系统全部用户组与用户清单
getent group
getent passwd
```
