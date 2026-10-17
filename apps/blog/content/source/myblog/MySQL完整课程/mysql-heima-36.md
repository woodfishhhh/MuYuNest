---
title: "MySQL（36）：双主双从与故障切换"
date: 2026-10-17 00:00:00
slug: mysql-heima-36
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

课程用两个可写主节点、每个主节点各带一个从节点，演示主库不可用后的写入接替。日常仍让一个主节点承担写入，另一个保持备用；两个主库互相复制，不代表应该同时接受互相冲突的业务写入。

这套结构可以演示自动改选写节点，但异步复制与一次心跳切换不等于零数据丢失，也不能单独解决网络分区造成的双写问题。

## 四个节点的关系

| 节点 | 课程地址 | server_id | 复制来源 |
| --- | --- | --- | --- |
| M1 | 192.168.200.211 | 1 | M2 |
| S1 | 192.168.200.212 | 2 | M1 |
| M2 | 192.168.200.213 | 3 | M1 |
| S2 | 192.168.200.214 | 4 | M2 |

![双主双从的复制关系](assets/dual-primary-replication.svg)

M1 的业务变更要经过 M2 才能到达 S2，因此 M2 需要把自己应用的复制事件继续写入 binlog。旧参数名为 `log_slave_updates`，MySQL 8.0.26 对应名称为 `log_replica_updates`。两个主节点都应启用转发所需的二进制日志记录，且所有实例身份必须独立。

```ini
# M1 的实验配置片段；M2 使用不同的 server_id
[mysqld]
server_id=1
log_bin=binlog
binlog_format=ROW
log_replica_updates=ON
```

课程还配置了数据库过滤。过滤会改变哪些事件进入复制链，尤其需要区分语句格式、行格式与跨库操作。初次搭建这个实验可以先不加过滤，让复制关系更容易验证；若加入过滤，必须单独测量过滤范围，不能只因某个 CREATE DATABASE 成功就认为所有相关写入都会同步。

## 从一致的数据起点建立四条复制关系

先准备四个隔离实例，确认数据基线一致，记录与该基线对应的来源日志位置。已存在业务数据时，不能拿当前日志位置连接一台空从库；那只会复制后续事件，历史数据并不会凭空补齐。基线与坐标的取得方法见第 28 篇。

然后按上表逐条配置，每次都确认“当前在哪台执行、它要从谁接收”。下面以 S1 从 M1 接收为例，其他三条替换为各自的来源和对应坐标：

```sql
-- 在 S1 执行。以下字符串和数字全部需要换成实际来源凭据与一致性起点。
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='M1_HOST',
  SOURCE_USER='repl',
  SOURCE_PASSWORD='REPLACE_REPLICATION_PASSWORD',
  SOURCE_LOG_FILE='REPLACE_WITH_M1_BINLOG_FILE',
  SOURCE_LOG_POS=123;
START REPLICA;
SHOW REPLICA STATUS\G
```

123 只是语法占位，不能照抄。复制账户必须预先在对应来源建立并授予复制权限；认证的安全连接或公钥要求沿用第 28 篇的说明。不要假设两个来源恰好有相同的文件名和位置，就可以共用坐标。

完成 S1←M1、S2←M2、M2←M1、M1←M2 后，分别检查接收线程、应用线程与错误信息。循环复制依靠事件来源身份等机制避免正常事件无限绕圈，但它不提供跨主库并发冲突解决能力。两个节点同时插入相同主键，仍可能造成复制错误。

在隔离实验中依次从 M1、M2 写入不同主键的测试记录，等待其余节点出现对应记录，验证两个方向。正常业务恢复后，应重新收敛到一个活动写入口。

四条关系可以按“在哪执行命令”重新列一次，避免只记住图中箭头却在错误机器操作：

| 执行 CHANGE REPLICATION SOURCE 的节点 | SOURCE_HOST 指向 | 应使用谁的基线坐标 |
| --- | --- | --- |
| S1 | M1 | M1 对应基线 |
| S2 | M2 | M2 对应基线 |
| M2 | M1 | M1 对应基线 |
| M1 | M2 | M2 对应基线 |

每个接收方都要有自己的唯一身份。server_id 用来区别复制参与者，克隆出来的 server_uuid 也要独立；IP 不同不能替代这一检查。两个来源上的复制账户允许哪些接收方连接，也应按上表分别创建，不是一个账户的 `%` 就完成了所有环境准备。

若从空的专用业务库开始实验，可以在配置关系期间停止额外写入，分别记录两个来源当前坐标，再逐条建立接收关系。已有数据时，则需要先使各节点业务基线一致，并取得与各来源相匹配的续传位置；两个原本各有不同业务数据的主库，不能通过互相 CHANGE SOURCE 自动“合并成同一份”。

M1 写入一条记录后，S1 直接从 M1 收到；M2 也从 M1 收到，并把需要继续传播的复制事件写入自己的 binlog；S2 再从 M2 收到。若 M2 没有保留这类复制更新的日志，M2 自己可能已经出现记录，S2 却得不到同样的变化。这就是 log_replica_updates 在链式传播中的具体作用。

## Mycat 中的活动写节点与备用写节点

逻辑库和 dataNode 仍只需要一组；对应 dataHost 中设置两组 writeHost/readHost。下列是 dataHost 内部布局，地址、账户及数据库 URL 按实验环境替换：

```xml
<dataHost name="host_ha" maxCon="100" minCon="1" balance="1"
          writeType="0" dbType="mysql" dbDriver="jdbc" switchType="1">
  <heartbeat>SELECT 1</heartbeat>
  <writeHost host="m1" url="jdbc:mysql://M1_HOST:3306/db01"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD">
    <readHost host="s1" url="jdbc:mysql://S1_HOST:3306/db01"
              user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
  </writeHost>
  <writeHost host="m2" url="jdbc:mysql://M2_HOST:3306/db01"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD">
    <readHost host="s2" url="jdbc:mysql://S2_HOST:3306/db01"
              user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
  </writeHost>
</dataHost>
```

`balance=1` 让可用读节点和备用写节点参与普通读均衡。`writeType=0` 使用当前活动写节点，初始通常是第一项；故障切换后活动项可能改变，不应永远把“第一个 XML 标签”理解为当前写主库。`writeType=1` 会在写节点间选择，不适合本篇要演示的单主写入方式。

字幕解释 writeType 时出现一句“配置为一，让另一台备用”，随后实际配置为 0。这里以实际意图和源码中的活动写源选择为准，使用 0。`switchType=1` 允许按该版本的健康检测机制自动切换，`-1` 禁止自动切换。

`SELECT 1` 只能表明一个实例能够回应查询，不能证明它已经追上所有复制事件。因此允许切换，不等于候选节点的数据已经完整。

逻辑库与 dataNode 也要接到 host_ha，才能形成完整配置链。例如在 schema.xml 根元素内，将下面两项与前面的 dataHost 配合：

```xml
<schema name="ITCAST_RW2" checkSQLschema="true" sqlMaxLimit="100" dataNode="dn_ha" />
<dataNode name="dn_ha" dataHost="host_ha" database="db01" />
```

server.xml 中相应客户端用户的 schemas 必须包含 ITCAST_RW2。客户端连接的是逻辑库名，四个 MySQL 节点保存的是物理库 db01。把逻辑库改名后只改一份文件，会让身份授权与实际定义对不上；把 physical database 写错，则可能登录成功却查不到期望的表。

正常状态下，活动写源 M1 承担写入，balance=1 可让 S1、M2、S2 参与符合条件的读取。发生切换后，M2 不再是“备用读候选”这一角色，而成为新的活动写源；解释请求流向时要按当前角色判断，不能一直沿最初的标签顺序想象。

## 故障实验需要证明哪些事

只在已保存配置、已有恢复办法的隔离实验环境模拟故障。先记录 M1、M2 的复制位置和现有测试数据，确认正常写入经由当前活动主库，再停止这台实验主库。

观察 Mycat 的日志和数据源状态，等待它识别故障；随后用独立测试主键再次写入。记录切换期间是否报错、错误持续到什么时候、成功写入最终落到哪个节点，并检查该节点对应的从库是否收到变化。应用还需要处理切换期间失败或结果不确定的请求，不能无条件重试非幂等写入。

原课停止 M1 后，向 M2 成功写入，证明了那次演示中的写入接替。它没有证明故障前所有已确认的写入都已复制到 M2，也没有验证网络分区、旧主恢复或多个代理同时选择写主库的行为。

恢复旧主时，应先限制它接受业务写入，核对双方数据和复制进度，再决定如何重新加入。若两个主库已经产生冲突数据，单纯重新启动服务不能解决冲突。Mycat 本身的单点、故障隔离以及客户端连接恢复，也需要在生产方案中另外处理。

这个结构还要特别检查旧从库 S1。M1 停止以后，S1 即使仍能响应 SELECT，也可能无法继续取得 M2 上的新写入，因为它的直接复制来源仍是 M1。如果代理继续把它当健康读节点使用，用户就可能读到停留在故障前的数据。TCP 可连接、心跳可回应、复制已经追平，分别是不同条件。

切换时可以把验收记录分为三个时间段：故障前，确认写入确实到达 M1 且已传播到候选；故障中，记录哪些请求失败或结果不确定，以及代理何时改选写源；故障后，确认新写入落到 M2、S2 跟上，并处理不再具备足够新鲜数据的读候选。这样才能知道“写入恢复”之外，读路径是否也符合预期。

旧主回来后也不能立即开放双向业务写入。它可能落后于 M2，甚至含有故障前未传播出去、与新主变化冲突的数据。恢复流程要先核对再重新接入，而不是看见进程启动成功就宣布整个集群已经恢复一致。

原课：[P191–195](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=191)。本篇整理的是课程拓扑、配置含义与验收方法，没有实际进行节点停机或生产切换。

参数命名与转发作用见 [复制与二进制日志参数](https://dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-35)
