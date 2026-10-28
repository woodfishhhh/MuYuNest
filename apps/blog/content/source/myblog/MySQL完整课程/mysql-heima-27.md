---
title: "MySQL（27）：错误日志、binlog 与查询日志"
date: 2026-10-17 00:00:00
slug: mysql-heima-27
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

服务器起不来，先看错误日志；要追踪数据变化，看 binlog；要找慢语句，看慢查询日志。在某个日志里找到一条 SQL，不代表它提交成功了，更不代表能拿它恢复全部数据。

## 错误日志用来定位服务器异常

```sql
SHOW VARIABLES LIKE 'log_error';
```

先查出日志的实际位置，再用操作系统工具去看。Linux 上可能写到文件，也可能写进服务日志，别默认所有机器都在 `/var/log/mysqld.log`。

课程故意改坏 server_uuid 演示启动失败，错误日志里会指出 auto.cnf 中的 UUID 无效。要学的是：从报错时间、错误级别和具体对象去定位配置。不用在自己的库上真去改坏 auto.cnf。碰到同类故障，先把原配置和日志留好，再按实际报错修。

## binlog 记录可用于复制和恢复的数据变化事件

```sql
SHOW VARIABLES LIKE 'log_bin%';
SHOW VARIABLES LIKE 'binlog_format';
SHOW BINARY LOGS;
SHOW MASTER STATUS; -- 课程 MySQL 8.0.26 的命令
```

binlog 属于服务器层，记录结构和数据的变化事件，普通只读 SELECT 不会记进去。它和 InnoDB 的 redo 不是一回事：redo 主要给存储引擎做崩溃恢复，binlog 用来做复制和基于日志的数据恢复。

| 格式 | 记录方式 |
| --- | --- |
| STATEMENT | 记录相应 SQL 语句，需要在目标端重新求值执行 |
| ROW | 记录受影响行的变化事件，具体行镜像由配置决定 |
| MIXED | 根据语句特性在相应方式之间选择 |

一条 UPDATE 改三行，STATEMENT 格式下可能就是一条语句，ROW 格式下是行事件。但 ROW 格式下也不是所有事件都是行记录，DDL 还是语句事件；也不是任何配置都会保存每行的全部前后字段。

拿 `UPDATE account SET balance=balance-100 WHERE id=1` 来说：语句格式记的是"做了这个操作"，接收方要在自己的环境里重新执行一遍；行格式记的是受影响记录实际的变化。所以涉及非确定性表达式或环境差异的语句，要特别考虑用哪种复制格式。

恢复一般是先还原一致的基线，再回放基线之后的完整日志链。只有最近一个 binlog 文件，不一定能恢复出原来的数据。复制也一样，得知道从哪个事务或哪个文件位置开始。

binlog 拷到另一个实例，不等于完成了 InnoDB 崩溃恢复；反过来，本机能靠 redo 恢复，也不代表留够了 binlog，可以建新从库或者恢复到任意历史时间点。

## 日志清理必须保留恢复和复制需要的链

binlog 编号一直往上涨，过期策略看 `binlog_expire_logs_seconds` 等实际配置。课程用 30 天的默认值演示，实际保留多久要按当前实例的查询结果和恢复需求来定。

MySQL 8.0 可以用 `PURGE BINARY LOGS TO '文件名'` 清理指定文件之前的日志，也可以按 BEFORE 时间清理。执行前要确认备份基线、还在追赶的从库、需要的恢复窗口；这些信息不清楚，光看文件新旧判断不了能不能删。

`RESET MASTER` 是课程旧版里的重置操作，会破坏已有的日志链，还牵涉 GTID 状态，不是日常清理命令，新版本语法也变了。别直接在文件系统里删 binlog 或者改索引清单来代替受控清理。

按"全量备份 + 之后的日志"恢复时，时间轴分三段：

1. 备份已经覆盖的历史状态
2. 备份起点到目标时间之间的变化
3. 目标时间之后不想恢复的变化

先恢复基线，再按顺序应用第 2 段的完整日志链。中间缺了任何一段，后面的事件就算还在，也可能没法在正确的前提上继续应用。

比如误删发生在一个已提交的事务里，目标是回到误删之前，那回放边界就要放在那个事务之前，并且保证之前的事务完整。别在文本里搜出一条 DELETE、删掉几行看着相关的内容，就当剩下的事件还是有效的恢复流。事务边界和事件编码要交给合适的工具处理。

## general log 记录接收到的操作

```sql
SHOW VARIABLES LIKE 'general_log%';
SHOW VARIABLES LIKE 'log_output';
```

general log 可以记录连接和收到的查询，适合短时间排查"客户端到底发了什么"。它一般默认关闭，因为日志量和写入开销都可能很大，SQL 里也可能带着业务数据。

日志里出现了某条语句，只说明它走到了记录流程，不代表执行成功或事务提交了。排查完把配置改回去，日志文件按权限管理好。

三种日志各管各的：

- general log：服务器收到了哪些请求
- 慢日志：哪些执行满足特定的诊断条件
- binlog：数据变化的传播和恢复

客户端发来的语句执行失败了，general log 里照样可能有；成功的快速 SELECT 不会写进 binlog；一个事务后来回滚了，光凭看到过 UPDATE 请求，不能认定它改了最终的业务状态。

日志选错，排查一开始就问错了问题。怀疑程序没发 SQL，先看请求和执行入口；怀疑慢在扫描、排序，结合慢日志和执行计划；要恢复数据，先查备份和可回放的日志链。几种日志互相补充，谁也替代不了谁。

## 慢日志的阈值不只是一条时间线

```sql
SHOW VARIABLES WHERE Variable_name IN
  ('slow_query_log','long_query_time','min_examined_row_limit',
   'log_queries_not_using_indexes','log_slow_admin_statements');
```

long_query_time 是耗时阈值，可以写小数，不是最小只能 1 秒。min_examined_row_limit 是检查行数的最低门槛，不是"少于这个值才记录"。所以一条语句为什么没进日志，要同时看时间、检查行数和相关的记录选项。

`log_queries_not_using_indexes` 可以额外记录符合条件的未使用索引查询，不要求它们超过 long_query_time。反过来，没开这个选项，也不代表没走索引的慢查询都不会记，正常的慢查询条件照样能抓到它们。

慢日志里的耗时、返回行数、检查行数是用来找候选问题的，还要结合 EXPLAIN、锁等待和业务延迟一起分析，不是光看日志行数就能下优化结论的评分表。

记录条件可以对照 [MySQL 慢查询日志说明](https://dev.mysql.com/doc/refman/8.0/en/slow-query-log.html)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-26) · [下一篇](/posts/mysql-heima-28)
