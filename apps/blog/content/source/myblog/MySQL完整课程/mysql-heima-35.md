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

读写分离就是把一部分查询交给从库，让主库腾出资源处理写入。前提是主从复制已经建好，但复制和路由是两回事：MySQL 负责把数据变化复制过去，Mycat 决定每个请求发到哪。

异步复制要时间。写请求刚成功，下一次查询就去从库，可能暂时读不到刚写的数据。所以读写分离还得想清楚：哪些查询能接受旧数据，哪些查询必须看到刚提交的修改。

## 先验收复制，再配置路由

课程用主库 `192.168.200.211`、从库 `.212`，物理库是 `itcast`。复制的基线、日志坐标和账户配置见 [主从复制与一致性起点](/posts/mysql-heima-28)。

不能只看接收线程和应用线程都是 Yes，还要确认没有复制错误，并且在主库写一条独立的测试记录后，在从库能看到它。复制链能用了，后面比较查询差异才有意义。

Mycat 一主一从的配置可以把整个逻辑库指向一个 dataNode，这样不用一个个列出所有表，物理库里已有的表都能通过这个映射访问。下面的片段合并进实验配置：

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

`writeHost` 是写节点，嵌在它下面的 `readHost` 是对应的读节点。还要把 `ITCAST_RW` 加进客户端用户的 `schemas`。后端账户要在两台 MySQL 上都能用，并且有需要的库权限。

## balance 控制读候选，不决定所有写请求

能做读负载均衡的查询，课程讲到的取值如下。事务、锁定读、路由提示和故障状态都可能改变具体路径，别把这张表当成对所有 SELECT 的无条件保证。

| balance | 正常情况下的读候选 |
| --- | --- |
| 0 | 当前写节点 |
| 1 | 可用 readHost，加上备用 writeHost |
| 2 | 可用写节点与读节点 |
| 3 | 可用 readHost，不让 writeHost 常规参与读均衡 |

一主一从且两台都健康时，1 和 3 的常规查询表现差不多。双主双从时，1 会把备用主库也算进读候选。

字幕好几次把 `balance=2` 说成"所有读写随机分发"，这里要纠正。固定版本的源码在选读连接的函数里处理 balance，写连接另外由 writeType 和当前活动的写节点决定，所以 INSERT 不会随机发到 readHost。[源码中的读写选择](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/backend/datasource/PhysicalDBPool.java)

源码里还有没可用读候选时退回写源的分支。所以"配成 3"也证明不了每次读都没经过主库，要观察真实请求。

"允许参与"和"这次被选中"要分开：balance 给出符合条件的读候选，实际请求还受候选健康状况、会话和事务路由规则影响。连续两次查询可能命中同一个从库，也可能分到不同的候选，两次没轮流出现，不代表负载均衡失败。

写入走另一条路，按 writeType 和活动写源选。正常的一主一从配置下，INSERT 到 Mycat 后写到主库，复制线程再把变化带到从库。第二步是 MySQL 复制做的，Mycat 不是收到一条 INSERT 就替应用往主从各插一遍。这两条链搞混了，排查就会找错地方。

## 验证路由时，不要故意改坏复制数据

课程为了分辨节点，把从库里的姓名改成不同的值，再从查询结果看来源。这个实验好懂，但它故意制造了主从数据不一致，不适合当日常验收方式。

更稳妥的做法：先记下管理端 `SHOW @@DATASOURCE` 里各节点的读写计数，再通过 8066 对已有的测试表执行一组能认出来的普通查询和写入，最后比较计数变化，必要时结合后端语句日志核对。测试时别有其他并发业务，否则计数变化没法只归因到自己的操作。

普通读让健康从库的计数增加，写入在主库执行，之后数据出现在从库，这就分别证明了路由和复制两条链。查询返回的数据和主库一样，只能证明内容相同，证明不了访问的是哪台机器。

可以在已经完成复制的 itcast 实验库里用一张独立的探针表。通过 Mycat 的 ITCAST_RW 逻辑库执行：

```sql
USE ITCAST_RW;
CREATE TABLE rw_probe(id INT PRIMARY KEY,marker VARCHAR(40) NOT NULL) ENGINE=InnoDB;
INSERT INTO rw_probe VALUES(1,'write-v1');
SELECT id,marker FROM rw_probe WHERE id=1;
```

执行前记下管理端的节点计数，执行后再比较；直连主库确认插入了记录，直连从库确认复制结果。CREATE TABLE 和 INSERT 走写入路径，普通 SELECT 才是这里观察读路由的对象。复制还没追上的话，紧接着的 SELECT 可能暂时没有数据，表结构还没同步过来时甚至会报错；这和读写配成同一个节点的表现不一样。

然后在隔离实验里把 marker 从 write-v1 改成 write-v2，看哪个节点执行了写入、从库什么时候看到新值、代理读什么时候返回新值。把节点执行证据和数据传播时间对齐，才能分清是路由错了，还是复制正常或异常地落后。

这些观察都不用改坏主从数据。为了辨别来源直接把从库的姓名改成别的值，之后所有同主键的复制和查询都可能受影响，实验里就混进了人为的数据分歧。

## 写后读与事务边界

假设用户提交了一笔修改，主库已经提交，从库还没应用这个事件。这时把确认页面的查询发到从库，用户就可能看到旧值。按业务要求，让必须读到刚写结果的操作留在主库，或者用验证过的复制进度等待方案。

别用"固定睡一秒"当一致性保证。复制延迟随负载和故障变化，一秒可能太长，也可能远远不够。事务里的读写、`SELECT ... FOR UPDATE` 等锁定读，也不能拆到互不协调的节点上；具体代理版本的连接保持和路由行为要实验确认。

写后读按三个时间点理解：t1 主库提交 write-v2，t2 应用收到成功，t3 从库应用这个事件。确认页的查询发生在 t2 和 t3 之间并被发到从库，它看到 write-v1 和"主库已经提交"并不矛盾，两句话说的是不同机器的进度。

要立即确认修改的页面，这次依赖刚写入结果的读取，可以继续访问能保证所需状态的写源；能接受延迟的普通列表，可以用从库的结果。具体怎么在客户端或代理里表达路由，要用这个版本验证过的能力，不能看到 SQL 里有 SELECT 就认定它适合走从库。

事务里还要避免把同一个业务操作拆成两个独立会话。在主库上锁了一行，再去从库读同一个主键，从库的读取不会因此受这把行锁保护。锁协调的是它所在实例和事务的访问，不会通过同名的表跨机器传播。

一主一从还有写节点单点的问题。主库停了，从库可能还能回答旧数据的查询，但它不会因为配了 `readHost` 就自动变成新的写主库。下一篇讲课程的双主双从方案，以及它还是没解决掉的一致性风险。

原课：[P188–190](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=188)，回顾见 P194。本文的配置和预期还没在真实集群上执行过。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-34) · [下一篇](/posts/mysql-heima-36)
