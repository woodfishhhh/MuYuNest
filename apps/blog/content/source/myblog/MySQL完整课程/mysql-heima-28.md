---
title: "MySQL（28）：主从复制与一致性起点"
date: 2026-10-17 00:00:00
slug: mysql-heima-28
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

主从复制让一台 MySQL 接收另一台的变化事件，并在本地重放。主库负责主要写入，从库可以承担部分查询或备份。普通异步复制存在延迟，所以“已经建立复制”不等于任意时刻两端完全相同，更不等于已经完成自动故障切换。

## 日志怎样从主库到从库

![主从复制的数据传播](assets/replication-flow.svg)

接收线程把主库事件写入中继日志，应用线程再把事件应用到数据。两个阶段可以独立落后：事件尚未收到，或已经收到但还没应用。监控时必须分别检查。

旧资料使用 master/slave，新语法使用 source/replica。下面以课程的 MySQL 8.0.26 语法为基线。示例地址沿用课程：主库 `192.168.200.200`、从库 `192.168.200.201`，端口 3306；执行时替换为自己的独立实验实例。

把一次写入拆成接力过程，就能看见延迟从哪里来。主库提交一笔变化后，相应事件进入 binlog；从库的接收线程通过复制连接读取事件，落到本地 relay log；应用线程再读取 relay log，执行对应变化。这几个动作不是主库 COMMIT 返回时就已经在所有机器同时完成。

如果主库到从库的网络暂时中断，从库可能继续应用已经收到的中继日志，但收不到后续事件；如果网络正常、应用线程却因重复键报错，事件可以继续被接收到本地，业务数据仍停在出错处。两种情况都表现为“从库数据旧”，但需要检查的环节不同。

中继日志的作用，是把“从网络收到什么”和“在本地应用到哪里”分开。没有这个分层，就很难独立描述接收进度和执行进度。复制状态中出现多个文件、位置字段，正是因为这不是一个只有单一进度值的操作。

## 先保证服务器身份与初始数据正确

两台实例应有不同的 server_id，克隆实例还应检查 server_uuid 是否独立。不要因为两台虚拟机的 IP 不同，就假设数据库身份也一定不同。

```ini
# 主库的 mysqld 配置片段
[mysqld]
server_id=1
log_bin=binlog
binlog_format=ROW
read_only=OFF
```

```ini
# 从库的 mysqld 配置片段
[mysqld]
server_id=2
relay_log=relay-bin
read_only=ON
super_read_only=ON
```

配置写入各自实例真正使用的配置文件，重启后用变量查询确认生效。read_only 不是绝对禁止管理员写入；super_read_only 进一步约束客户端写入，但复制应用线程仍需要更新数据。防火墙只允许必要的来源与端口，无需为复制关闭整台机器的防火墙。

复制从一个位置开始，不会自动补齐此前已经存在的所有数据。课程从空业务库建立复制，再新建库表；已有数据的环境必须先取得一致性备份及与之对应的日志坐标，把备份还原到从库，再从该坐标续传。

先导出、隔很久再随手执行 SHOW MASTER STATUS，会在两者之间漏掉变化。快照和坐标必须配套取得；也可以采用经过设计的 GTID 基线流程。这里不把任意一个日志位置写死为可复用值。

对于课程版本的 InnoDB 实验库，配套导出可在 PowerShell 中这样执行，先确认输出目录存在。这里假设专用实验来源只复制 mysql_notes，其他库的初始数据不在本例覆盖范围内：

```powershell
mysqldump -h SOURCE_HOST -u BACKUP_USER -p --single-transaction --source-data=2 --set-gtid-purged=OFF --routines --events --triggers --databases mysql_notes --result-file=D:/mysql-lab/replication-baseline.sql
Select-String -LiteralPath D:/mysql-lab/replication-baseline.sql -Pattern 'CHANGE (MASTER|REPLICATION SOURCE) TO'
```

`--source-data=2` 将配套的日志坐标写成注释；这是 MySQL 8.0.26 起的参数名，旧名称为 `--master-data=2`。配合 single-transaction，工具在建立一致性起点时短暂协调全局读锁，而不是事后另外猜一个坐标。备份账户需要对应的导出与日志状态权限，导出期间不执行影响目标表的 DDL。[mysqldump 参数说明](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)

这里选择文件与位置复制，所以不向目标设置 GTID_PURGED。不要把它混用成已经验证的 GTID 自动定位方案。将备份传到独立从库的管理机器，检查脚本目标后恢复，再使用脚本注释中的坐标配置复制。

前面的从库配置启用了 super_read_only；初始化恢复需要在隔离窗口由管理员临时关闭 `super_read_only` 和 `read_only`，完成 SOURCE 导入及核对后重新开启。此时禁止应用连接写入，从库也尚未开始接收这段新复制；不能一边导入一边让业务修改目标库。先记录原设置，发生导入错误时停止后续接入，排查并重新建立干净基线。

## 创建复制账户并连接正确起点

在主库由管理员创建仅供该从库连接的账户，密码占位符执行前替换：

```sql
CREATE USER 'repl'@'192.168.200.201'
IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'192.168.200.201';
SHOW MASTER STATUS;
```

File 与 Position 是当前日志坐标；对于已有数据，应使用备份流程记录的配套坐标。在空库实验中，应在记下坐标后停止额外业务写入，先完成从库配置。

在从库配置来源。下面的文件和位置必须换为实际配套值，示例中的占位文字不能直接执行：

```sql
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='192.168.200.200',
  SOURCE_PORT=3306,
  SOURCE_USER='repl',
  SOURCE_PASSWORD='REPLACE_WITH_STRONG_PASSWORD',
  SOURCE_LOG_FILE='REPLACE_WITH_BASELINE_LOG_FILE',
  SOURCE_LOG_POS=123,
  GET_SOURCE_PUBLIC_KEY=1;
```

这里的 123 仅是数字占位，必须替换为基线实际 Position。GET_SOURCE_PUBLIC_KEY 用于相应 caching_sha2_password 非 TLS 认证场景的公钥获取，不提供整个复制通道的身份验证和传输加密。具备证书的部署应配置并验证 TLS，不能把该选项当作 TLS 的等价物。认证方式还须与客户端和服务器版本兼容，不能照抄旧 mysql_native_password 配置到所有新版本。

```sql
START REPLICA;
SHOW REPLICA STATUS\G
```

较早版本使用 CHANGE MASTER TO、START SLAVE、SHOW SLAVE STATUS。课程版本支持新语法，后续版本的状态命令也可能变化，应以实际版本手册为准。

配置 SOURCE_LOG_FILE 与 SOURCE_LOG_POS 时，需要知道它们描述的是来源端日志的位置。文件名只是某个实例生成的文件名；两台独立主库都出现 `binlog.000002`，不表示文件内容相同，更不表示 position=123 指向同一段业务历史。

从库的初始数据必须与这一位置配套。如果基线已经包含某次 INSERT，却从更早的位置重复回放该 INSERT，可能撞上主键；如果基线尚未包含它，却从更晚的位置开始，可能永久漏掉它。重复与遗漏这两种风险，都来自“数据状态与续传坐标不是同一个起点”。

## 两个 Yes 之后仍要验证数据

Replica_IO_Running 与 Replica_SQL_Running 表示接收和应用线程状态。两者为 Yes 是必要的运行信号，但还要检查 Last_IO_Error、Last_SQL_Error、复制过滤、日志位置及延迟。Seconds_Behind_Source 为 0 也不能独立证明任何业务读都已追平。

在主库的独立实验库中创建一张验证表并写入一条有唯一标记的数据，在从库查询同一个主键和字段；继续在主库更新，再到从库核对变化。验证应分别确认结构、插入和更新能传播，且从库普通业务账户不能误写。

如果接收线程失败，先查连接、账户、网络和日志是否仍保留；如果应用线程失败，检查具体事件错误，例如主键冲突或表结构不一致。不能把“跳过出错事件”当作默认修复，那可能让复制表面恢复运行却留下数据分歧。

主库故障后提升从库，需要判断已接收与已执行进度，防止旧主继续写入，并切换客户端连接。普通复制本身不完成这些协调步骤；读写分离和故障切换还需要额外的路由与管理机制。

验证可以使用一张明确隔离的探针表。在主库已经包含在复制范围内的 `mysql_notes` 库执行：

```sql
CREATE TABLE replication_probe (
  id INT PRIMARY KEY,
  marker VARCHAR(40) NOT NULL
) ENGINE=InnoDB;
INSERT INTO replication_probe VALUES(1,'insert-observed');
SELECT id,marker FROM replication_probe WHERE id=1;
```

在从库查询同一张表和主键，预期先观察到 `insert-observed`；随后回到主库执行 `UPDATE replication_probe SET marker='update-observed' WHERE id=1`，再到从库核对更新。复制是异步的，第一次立即查询可能还没到达，应记录从提交到观察到变化的过程，而不是把瞬间未出现直接当成配置失败。

若表结构没出现，检查 DDL 是否进入复制范围和应用错误；有表但没有记录，检查接收与应用进度；插入成功传播而更新不动，查看最近错误及过滤规则。这个按阶段验证的过程，比只看两个 Yes 更能定位故障停在哪里。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-27) · [下一篇](/posts/mysql-heima-29)
