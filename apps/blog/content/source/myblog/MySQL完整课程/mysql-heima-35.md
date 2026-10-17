---
title: "MySQL（35）：读写分离与一致性"
date: 2026-10-17 00:00:00
slug: mysql-heima-35
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

读写分离把一部分查询交给从库，让主库保留更多资源处理写入。前提是主从复制已经建立，但复制和路由是两件事：MySQL 负责把数据变化复制过去，Mycat 决定每次请求送到哪里。

异步复制需要时间。写请求刚成功，下一次查询就去从库，可能暂时读不到刚写入的数据。因此读写分离还必须回答哪些查询允许旧数据，哪些查询必须看见刚提交的修改。

## 先验收复制，再配置路由

课程使用主库 `192.168.200.211`、从库 `.212`，物理库为 `itcast`。复制的基线、日志坐标和账户配置见 [主从复制与一致性起点](/posts/mysql-heima-28)。

不能只看接收与应用线程都是 Yes。还应确认没有复制错误，并在主库写入一条独立测试记录后，在从库观察到这条记录。只有复制链已能工作，后续的查询差异才有意义。

Mycat 的一主一从配置可以把整个逻辑库指向一个 dataNode；此时无需逐个枚举所有表，物理库已有的表可以通过该映射访问。下列片段合并进实验配置：

```xml
<schema name="ITCAST_RW" checkSQLschema="true" sqlMaxLimit="100" dataNode="dn_rw" />
<dataNode name="dn_rw" dataHost="host_rw" database="itcast" />
<dataHost name="host_rw" maxCon="100" minCon="1" balance="3"
          writeType="0" dbType="mysql" dbDriver="jdbc" switchType="-1">
  <heartbeat>SELECT 1</heartbeat>
  <writeHost host="master1" url="jdbc:mysql://MASTER_HOST:3306/itcast"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD">
    <readHost host="replica1" url="jdbc:mysql://REPLICA_HOST:3306/itcast"
              user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
  </writeHost>
</dataHost>
```

`writeHost` 是写节点，`readHost` 嵌在它下面，表示对应的读节点。还要把 `ITCAST_RW` 加进客户端用户的 `schemas`。后端账户需要在两台 MySQL 上可用，并拥有所需的库权限。

## balance 控制读候选，不决定所有写请求

对可以采用读负载均衡的查询，课程涉及的值如下。事务、锁定读、路由提示和故障状态还可能改变具体路径，不能把表格理解为所有 SELECT 的无条件承诺。

| balance | 正常情况下的读候选 |
| --- | --- |
| 0 | 当前写节点 |
| 1 | 可用 readHost，加上备用 writeHost |
| 2 | 可用写节点与读节点 |
| 3 | 可用 readHost，不让 writeHost 常规参与读均衡 |

只有一主一从且两者健康时，1 与 3 的常规查询表现相近。双主双从时，1 会把备用主库也纳入读候选。

字幕把 `balance=2` 多次说成“所有读写随机分发”，需要改正。固定版本源码在读连接选择函数中处理 balance，写连接另由 writeType 和当前活动写节点决定；不能据此认为 INSERT 会随机发往 readHost。[源码中的读写选择](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/backend/datasource/PhysicalDBPool.java)

源码还存在无可用读候选时回退到写源的分支。因此，“配置为 3”也不能单独证明每一次读都没有经过主库。验证必须观察真实请求。

先把“允许参与”与“本次被选中”区分开。balance 给出符合条件的读候选，实际请求还要受候选健康、会话和事务路由等规则影响。连续两次查询可能命中同一从库，也可能分配到不同候选，不能因为两次没有轮流出现，就认定负载均衡失败。

写入路径则按 writeType 与活动写源选择。正常一主一从配置中，INSERT 到达 Mycat 后写入主库；复制线程随后把变化带到从库。第二步由 MySQL 复制完成，Mycat 并不是收到一条 INSERT 后同时替应用向主从各插一遍。把这两条链混淆，会导致排查时找错位置。

## 验证路由时，不要故意改坏复制数据

课程为了分辨节点，将从库中的姓名改成不同值，再从查询结果识别来源。这个实验容易看懂，但它主动制造了主从数据不一致，不适合作为日常验收方式。

更稳妥的实验是先记录管理端 `SHOW @@DATASOURCE` 中各节点的读写计数，再通过 8066 对已有测试表执行一组可识别的普通查询与写入，最后比较计数变化，必要时结合后端语句日志核对。测试时避免其他并发业务，否则计数变化不能唯一归因于自己的操作。

普通读在健康的从库上增加计数，写入在主库执行，随后数据在从库出现，分别证明路由和复制两条链。查询返回与主库相同的数据，只证明内容相同，无法证明访问了哪台机器。

可以在已完成复制的 itcast 实验库里使用一张独立探针表。通过 Mycat 的 ITCAST_RW 逻辑库执行：

```sql
USE ITCAST_RW;
CREATE TABLE rw_probe(id INT PRIMARY KEY,marker VARCHAR(40) NOT NULL) ENGINE=InnoDB;
INSERT INTO rw_probe VALUES(1,'write-v1');
SELECT id,marker FROM rw_probe WHERE id=1;
```

执行前记录管理端节点计数，执行后再比较，并直连主库确认插入记录、直连从库确认复制结果。CREATE TABLE 和 INSERT 需要经写入路径处理，普通 SELECT 才是这里观察读路由的对象。若复制尚未追上，紧接着的 SELECT 可能暂时没有行，甚至在表结构尚未到达时发生相应错误；这与把读写配置成同一节点的表现不同。

随后在隔离实验中把 marker 从 write-v1 更新为 write-v2，观察哪个节点执行写入、从库何时看到新值、代理读何时返回新值。只有把节点执行证据与数据传播时间对齐，才能判断是路由错误还是正常/异常的复制落后。

这些观察不需要改坏主从内容。如果为了辨别来源而直接把从库姓名改成另一种值，后续所有相同主键的复制与查询都可能受到影响，实验就混入了人为数据分歧。

## 写后读与事务边界

假设用户提交一笔修改，主库已经提交，而从库还没应用该事件。此时把确认页面的查询送到从库，用户就可能看到旧值。应根据业务要求，让必须读到刚写结果的操作保持在主库，或使用经过验证的复制进度等待方案。

不要用“固定睡一秒”作为一致性保证。复制延迟随负载和故障变化，一秒可能过长，也可能远远不够。事务内的读写、`SELECT ... FOR UPDATE` 等锁定读也不能拆到互不协调的节点；具体代理版本的连接保持与路由行为需要实验确认。

一主一从还有写节点单点问题。主库停止后，从库可能仍能回答旧数据查询，但它不会仅凭 `readHost` 配置自动成为新的写主库。下一篇讨论课程的双主双从方案，以及它仍然没有消除的一致性风险。

写后读可以按三个时点理解：t1 主库提交 write-v2，t2 应用收到成功，t3 从库应用这个事件。如果确认页的查询发生在 t2 与 t3 之间，并被送到从库，它看到 write-v1 并不与“主库已经提交”矛盾；两句话描述的是不同机器的进度。

需要立即确认修改的页面，可以让这次依赖刚写入结果的读取继续访问能保证所需状态的写源；允许延迟的普通列表则可以接受从库结果。具体怎样在客户端或代理中表达路由，需要使用该版本已验证的能力，不能单靠 SQL 里出现 SELECT 就自动断定它适合从库。

事务内还要避免把同一业务操作拆成两个独立会话。主库上锁住了一行，再在从库读同一主键，并不会让从库读取自动受前一个行锁保护。锁协调的是它所在实例及事务的访问，不会通过名字相同的表跨机器传播。

原课：[P188–190](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=188)，回顾见 P194。本文配置与预期尚未在真实集群执行。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-34) · [下一篇](/posts/mysql-heima-36)
