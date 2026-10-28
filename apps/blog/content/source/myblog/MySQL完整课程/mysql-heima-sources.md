---
title: "MySQL 课程：来源与验证说明"
date: 2026-10-17 00:00:00
slug: mysql-heima-sources
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

## 使用了什么材料

主来源是 [黑马程序员 MySQL 课程 BV1Kr4y1i7ru](https://www.bilibili.com/video/BV1Kr4y1i7ru)，共 195 集。目录、标题和时长取自缓存的 Bilibili 元数据；正文依据逐集缓存的 ai-zh 字幕，195 集都全文读过，再按知识的先后关系合成 36 篇。广告和招生内容没收进正文。

字幕候选的时间覆盖指标是 0.947–1.000，只反映时间跨度，说明不了每个词都准、画面信息都覆盖到了。这次没有逐帧看视频，也没拿到原课配套的 SQL、安装包和讲义。字幕里识别错的专业词，按上下文和能核对的资料改正；还原不出来的屏幕代码，没有拿来冒充原稿。

基础表数据、能执行的 SQL 和 Mycat 配置片段都是教学重建。统一的八人数据是为了让各篇的计算对得上；触发器改用 JSON、循环补输入边界、复制补一致性起点这些，是为独立学习补的解释，不是原视频的逐字代码，也不是真实业务。

Mycat 的核对固定在 `Mycat-server-1.6.7.4-release` 的提交 `f929f96a16852869bc9dc63f4c0f192ee02818e0`。课程用的是 1.6.7.3，也提到了 1.6.7.4；这里核对的是相邻版本的实现，不保证两个版本行为完全一样。缓存里只有需要的源码和资源文件，保留了上游 LICENSE，实现可以在[固定版本源码](https://github.com/MyCATApache/Mycat-Server/tree/f929f96a16852869bc9dc63f4c0f192ee02818e0)核对。

## 技术复核改变了什么

正文保留了课程的主要任务和推导，但不把经验说法当成无条件规则：

- GROUP BY 按函数依赖和 ONLY_FULL_GROUP_BY 解释
- 索引部分区分定位、过滤、覆盖和排序
- 锁部分不把大范围记录锁叫成锁升级
- MVCC 用能执行的事务先后顺序解释版本可见性

Mycat 部分核对了字符串截取的右端点、balance 和 writeType 的分工、一致性哈希扩容照样要迁移这些细节。主从复制分开讲基线、日志坐标、线程状态和业务数据验证；故障切换没写成保证零丢失的生产高可用方案。

## 官方资料与补充范围

| 核对事项 | 资料 |
| --- | --- |
| 分组、函数依赖 | [GROUP BY](https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html) |
| 认证插件版本变化 | [mysql_native_password](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html) |
| 执行计划、范围与排序 | [EXPLAIN](https://dev.mysql.com/doc/refman/8.0/en/explain-output.html)、[范围访问](https://dev.mysql.com/doc/refman/8.0/en/range-optimization.html)、[排序](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html) |
| 索引条件下推 | [ICP](https://dev.mysql.com/doc/refman/8.0/en/index-condition-pushdown-optimization.html) |
| 一致性读、事务与加锁 | [一致性读](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html)、[隔离级别](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)、[锁](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)、[语句加锁](https://dev.mysql.com/doc/refman/8.0/en/innodb-locks-set.html)、[错误处理](https://dev.mysql.com/doc/refman/8.0/en/innodb-error-handling.html) |
| redo 与持久性配置 | [redo](https://dev.mysql.com/doc/refman/8.0/en/innodb-redo-log.html)、[参数](https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html) |
| 备份、日志及复制 | [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)、[慢日志](https://dev.mysql.com/doc/refman/8.0/en/slow-query-log.html)、[复制来源配置](https://dev.mysql.com/doc/refman/8.0/en/change-replication-source-to.html)、[binlog 参数](https://dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html) |
| 视图检查与旧观测命令 | [CHECK OPTION](https://dev.mysql.com/doc/refman/8.4/en/view-check-option.html)、[SHOW PROFILES](https://dev.mysql.com/doc/refman/8.0/en/show-profiles.html) |
| 分片与读写选择实现 | [固定版本 Mycat 源码](https://github.com/MyCATApache/Mycat-Server/tree/f929f96a16852869bc9dc63f4c0f192ee02818e0) |

链接分别标了 8.0、8.4 手册版本。补充资料用来核对具体机制和版本差异，整套课程并没有因此变成适配所有新版本的安装指南。

## 验证范围

结构检查包括：章节在不在、195 集是不是都有映射、Markdown 本地链接和代码围栏完不完整、XML 片段能不能按 XML 语法解析，以及源码缓存的哈希。数值核算从实际的初始化脚本读数据，检查筛选、分组、平均值、等级、分页和分片边界的预期；另外还核算了 B 树每次根分裂和最终的叶子顺序、跨片聚合各片的总和与人数。

正文逐篇复核过名词前提、因果链、示例输入和结果说明。

本机没有能直接用的 MySQL 客户端，检查时 Docker 引擎也没开；没装数据库，也没启动复制、Mycat、ZooKeeper 和监控服务。SQL 没在 MySQL 上实际跑过，锁等待、执行计划、复制延迟、切换和界面都没实测。XML 静态解析通过，也不代表 Mycat 版本配置验证过。外链按来源资料引用，没逐个检查能不能打开。

## 逐集来源映射

每集只列一个主要对应的章节，主题回顾可能也被别的章节吸收了。原课 P174 的范围分片在第 30 篇完整讲，P175 取模在第 31 篇展开。课程小结不另写重复的笔记。

| 分集 | 原标题 | 主要笔记 |
| --- | --- | --- |
| [P001](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=1) | 01.MySQL课程介绍 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P002](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=2) | 02. 基础-课程内容-数据库相关概念 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P003](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=3) | 03. 基础-概述-MySQL安装及启动 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P004](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=4) | 04. 基础-概述-数据模型 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P005](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=5) | 05. 基础-SQL-通用语法及分类 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P006](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=6) | 06. 基础-SQL-DDL-数据库操作 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P007](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=7) | 07. 基础-SQL-DDL-表操作-创建&查询 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P008](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=8) | 08. 基础-SQL-DDL-数据类型及案例 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P009](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=9) | 09. 基础-SQL-DDL-表操作-修改&删除 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P010](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=10) | 10. 基础-SQL-DDL小结 | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P011](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=11) | 11. 基础-SQL-图形化界面工具DataGrip | [01-数据库连接与表结构](/posts/mysql-heima-01) |
| [P012](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=12) | 12. 基础-SQL-DML-插入 | [02-写入数据与条件查询](/posts/mysql-heima-02) |
| [P013](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=13) | 13. 基础-SQL-DML-更新和删除 | [02-写入数据与条件查询](/posts/mysql-heima-02) |
| [P014](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=14) | 14. 基础-SQL-DML小结 | [02-写入数据与条件查询](/posts/mysql-heima-02) |
| [P015](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=15) | 15. 基础-SQL-DQL-基础查询 | [02-写入数据与条件查询](/posts/mysql-heima-02) |
| [P016](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=16) | 16. 基础-SQL-DQL-条件查询 | [02-写入数据与条件查询](/posts/mysql-heima-02) |
| [P017](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=17) | 17. 基础-SQL-DQL-聚合函数 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P018](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=18) | 18. 基础-SQL-DQL-分组查询 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P019](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=19) | 19. 基础-SQL-DQL-排序查询 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P020](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=20) | 20. 基础-SQL-DQL-分页查询 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P021](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=21) | 21. 基础-SQL-DQL-案例练习 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P022](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=22) | 22. 基础-SQL-DQL-执行顺序 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P023](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=23) | 23. 基础-SQL-DQL小结 | [03-聚合分组排序与分页](/posts/mysql-heima-03) |
| [P024](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=24) | 24. 基础-SQL-DCL-用户管理- | [04-账户与权限](/posts/mysql-heima-04) |
| [P025](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=25) | 25. 基础-SQL-DCL-权限控制- | [04-账户与权限](/posts/mysql-heima-04) |
| [P026](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=26) | 26. 基础-SQL-DCL小结 | [04-账户与权限](/posts/mysql-heima-04) |
| [P027](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=27) | 27. 基础-函数-字符串函数 | [05-函数与条件表达式](/posts/mysql-heima-05) |
| [P028](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=28) | 28. 基础-函数-数值函数 | [05-函数与条件表达式](/posts/mysql-heima-05) |
| [P029](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=29) | 29. 基础-函数-日期函数 | [05-函数与条件表达式](/posts/mysql-heima-05) |
| [P030](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=30) | 30. 基础-函数-流程函数 | [05-函数与条件表达式](/posts/mysql-heima-05) |
| [P031](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=31) | 31. 基础-函数-小结 | [05-函数与条件表达式](/posts/mysql-heima-05) |
| [P032](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=32) | 32. 基础-约束-概述 | [06-约束与外键](/posts/mysql-heima-06) |
| [P033](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=33) | 33. 基础-约束-演示 | [06-约束与外键](/posts/mysql-heima-06) |
| [P034](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=34) | 34. 基础-约束-外键约束 | [06-约束与外键](/posts/mysql-heima-06) |
| [P035](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=35) | 35. 基础-约束-外键删除更新行为 | [06-约束与外键](/posts/mysql-heima-06) |
| [P036](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=36) | 36. 基础-约束-小结 | [06-约束与外键](/posts/mysql-heima-06) |
| [P037](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=37) | 37. 基础-多表查询-多表关系介绍 | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P038](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=38) | 38. 基础-多表查询-概述 | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P039](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=39) | 39. 基础-多表查询-内连接 | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P040](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=40) | 40. 基础-多表查询-外连接 | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P041](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=41) | 41. 基础-多表查询-自连接 | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P042](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=42) | 42. 基础-多表查询-联合查询union | [07-多表关系与连接查询](/posts/mysql-heima-07) |
| [P043](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=43) | 43. 基础-多表查询-子查询介绍 | [08-子查询与相关查询](/posts/mysql-heima-08) |
| [P044](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=44) | 44. 基础-多表查询-标量子查询 | [08-子查询与相关查询](/posts/mysql-heima-08) |
| [P045](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=45) | 45. 基础-多表查询-列子查询 | [08-子查询与相关查询](/posts/mysql-heima-08) |
| [P046](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=46) | 46. 基础-多表查询-行子查询 | [08-子查询与相关查询](/posts/mysql-heima-08) |
| [P047](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=47) | 47. 基础-多表查询-表子查询 | [08-子查询与相关查询](/posts/mysql-heima-08) |
| [P048](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=48) | 48. 基础-多表查询-练习1 | [09-多表查询综合案例](/posts/mysql-heima-09) |
| [P049](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=49) | 49. 基础-多表查询-练习2 | [09-多表查询综合案例](/posts/mysql-heima-09) |
| [P050](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=50) | 50. 基础-多表查询-小结 | [09-多表查询综合案例](/posts/mysql-heima-09) |
| [P051](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=51) | 51. 基础-事务-简介 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P052](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=52) | 52. 基础-事务-操作演示 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P053](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=53) | 53. 基础-事务-四大特性ACID | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P054](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=54) | 54. 基础-事务-并发事务问题 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P055](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=55) | 55. 基础-事务-并发事务演示及隔离级别 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P056](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=56) | 56. 基础-事务-小结 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P057](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=57) | 57. 基础篇总结 | [10-事务与隔离级别](/posts/mysql-heima-10) |
| [P058](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=58) | 01. 进阶-课程介绍 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P059](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=59) | 02. 进阶-存储引擎-MySQL体系结构 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P060](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=60) | 03. 进阶-存储引擎-简介 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P061](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=61) | 04. 进阶-存储引擎-InnoDB介绍 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P062](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=62) | 05. 进阶-存储引擎-MyISAM和Memory | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P063](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=63) | 06. 进阶-存储引擎-选择 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P064](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=64) | 07. 进阶-存储引擎-小结 | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P065](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=65) | 08. 进阶-MySQL安装(linux版本) | [11-存储引擎与服务器结构](/posts/mysql-heima-11) |
| [P066](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=66) | 09. 进阶-索引-概述 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P067](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=67) | 10. 进阶-索引-结构-介绍 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P068](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=68) | 11. 进阶-索引-结构-Btree | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P069](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=69) | 12. 进阶-索引-结构-B+tree | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P070](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=70) | 13. 进阶-索引-结构-hash | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P071](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=71) | 14. 进阶-索引-结构-思考题 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P072](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=72) | 15. 进阶-索引-分类 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P073](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=73) | 16. 进阶-索引-思考题 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P074](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=74) | 17. 进阶-索引-语法 | [12-B加树与聚簇索引](/posts/mysql-heima-12) |
| [P075](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=75) | 18. 进阶-索引-性能分析-查看执行频次 | [13-定位慢SQL与执行计划](/posts/mysql-heima-13) |
| [P076](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=76) | 19. 进阶-索引-性能分析-慢查询日志 | [13-定位慢SQL与执行计划](/posts/mysql-heima-13) |
| [P077](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=77) | 20. 进阶-索引-性能分析-show profiles | [13-定位慢SQL与执行计划](/posts/mysql-heima-13) |
| [P078](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=78) | 21. 进阶-索引-性能分析-explain | [13-定位慢SQL与执行计划](/posts/mysql-heima-13) |
| [P079](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=79) | 22. 进阶-索引-使用规则-验证索引效率 | [13-定位慢SQL与执行计划](/posts/mysql-heima-13) |
| [P080](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=80) | 23. 进阶-索引-使用规则-最左前缀法则 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P081](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=81) | 24. 进阶-索引-使用规则-索引失效情况一 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P082](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=82) | 25. 进阶-索引-使用规则-索引失效情况二 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P083](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=83) | 26. 进阶-索引-使用规则-SQL提示 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P084](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=84) | 27. 进阶-索引-使用规则-覆盖索引&回表查询 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P085](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=85) | 28. 进阶-索引-使用规则-前缀索引 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P086](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=86) | 29. 进阶-索引-使用规则-单列&联合索引 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P087](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=87) | 30. 进阶-索引-设计原则 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P088](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=88) | 31. 进阶-索引-小结 | [14-联合索引与查询条件](/posts/mysql-heima-14) |
| [P089](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=89) | 32. 进阶-SQL优化-插入数据 | [16-批量写入与主键设计](/posts/mysql-heima-16) |
| [P090](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=90) | 33. 进阶-SQL优化-主键优化 | [16-批量写入与主键设计](/posts/mysql-heima-16) |
| [P091](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=91) | 34. 进阶-SQL优化-order by优化 | [15-排序分组分页与计数优化](/posts/mysql-heima-15) |
| [P092](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=92) | 35. 进阶-SQL优化-group by优化 | [15-排序分组分页与计数优化](/posts/mysql-heima-15) |
| [P093](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=93) | 36. 进阶-SQL优化-limit优化 | [15-排序分组分页与计数优化](/posts/mysql-heima-15) |
| [P094](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=94) | 37. 进阶-SQL优化-count优化 | [15-排序分组分页与计数优化](/posts/mysql-heima-15) |
| [P095](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=95) | 38. 进阶-SQL优化-update优化(避免行锁升级为表锁) | [16-批量写入与主键设计](/posts/mysql-heima-16) |
| [P096](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=96) | 39. 进阶-SQL优化-小结 | [16-批量写入与主键设计](/posts/mysql-heima-16) |
| [P097](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=97) | 40. 进阶-视图-介绍及基本语法 | [17-视图与检查选项](/posts/mysql-heima-17) |
| [P098](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=98) | 41. 进阶-视图-检查选项(cascaded) | [17-视图与检查选项](/posts/mysql-heima-17) |
| [P099](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=99) | 42. 进阶-视图-检查选项(local) | [17-视图与检查选项](/posts/mysql-heima-17) |
| [P100](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=100) | 43. 进阶-视图-更新及作用 | [17-视图与检查选项](/posts/mysql-heima-17) |
| [P101](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=101) | 44. 进阶-视图-案例 | [17-视图与检查选项](/posts/mysql-heima-17) |
| [P102](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=102) | 45. 进阶-存储过程-介绍 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P103](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=103) | 46. 进阶-存储过程-基本语法 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P104](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=104) | 47. 进阶-存储过程-变量-系统变量 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P105](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=105) | 48. 进阶-存储过程-变量-用户定义变量 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P106](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=106) | 49. 进阶-存储过程-变量-局部变量 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P107](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=107) | 50. 进阶-存储过程-if判断 | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P108](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=108) | 51. 进阶-存储过程-参数(IN,OUT,INOUT) | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P109](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=109) | 52. 进阶-存储过程-case | [18-存储过程变量与参数](/posts/mysql-heima-18) |
| [P110](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=110) | 53. 进阶-存储过程-循环-while | [19-循环与存储函数](/posts/mysql-heima-19) |
| [P111](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=111) | 54. 进阶-存储过程-循环-repeat | [19-循环与存储函数](/posts/mysql-heima-19) |
| [P112](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=112) | 55. 进阶-存储过程-循环-loop | [19-循环与存储函数](/posts/mysql-heima-19) |
| [P113](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=113) | 56. 进阶-存储过程-游标-cursor | [20-游标与条件处理](/posts/mysql-heima-20) |
| [P114](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=114) | 57. 进阶-存储过程-条件处理程序-handler | [20-游标与条件处理](/posts/mysql-heima-20) |
| [P115](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=115) | 58. 进阶-存储函数 | [19-循环与存储函数](/posts/mysql-heima-19) |
| [P116](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=116) | 59. 进阶-触发器-介绍 | [21-触发器与变更日志](/posts/mysql-heima-21) |
| [P117](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=117) | 60. 进阶-触发器-案例1(insert类型) | [21-触发器与变更日志](/posts/mysql-heima-21) |
| [P118](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=118) | 61. 进阶-触发器-案例2(update类型) | [21-触发器与变更日志](/posts/mysql-heima-21) |
| [P119](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=119) | 62. 进阶-触发器-案例3(delete类型) | [21-触发器与变更日志](/posts/mysql-heima-21) |
| [P120](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=120) | 63. 进阶-视图&存储过程&触发器-小结 | [21-触发器与变更日志](/posts/mysql-heima-21) |
| [P121](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=121) | 64. 进阶-锁-介绍 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P122](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=122) | 65. 进阶-锁-全局锁-介绍 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P123](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=123) | 66. 进阶-锁-全局锁-一致性数据备份 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P124](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=124) | 67. 进阶-锁-表级锁-表锁 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P125](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=125) | 68. 进阶-锁-表级锁-元数据锁 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P126](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=126) | 69. 进阶-锁-表级锁-意向锁 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P127](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=127) | 70. 进阶-锁-表级锁-意向锁-测试 | [22-全局锁表锁与元数据锁](/posts/mysql-heima-22) |
| [P128](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=128) | 71. 进阶-锁-行级锁-介绍 | [23-记录锁间隙锁与临键锁](/posts/mysql-heima-23) |
| [P129](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=129) | 72. 进阶-锁-行级锁-行锁 | [23-记录锁间隙锁与临键锁](/posts/mysql-heima-23) |
| [P130](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=130) | 73. 进阶-锁-行级锁-间隙锁&临键锁1 | [23-记录锁间隙锁与临键锁](/posts/mysql-heima-23) |
| [P131](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=131) | 74. 进阶-锁-行级锁-间隙锁&临键锁2 | [23-记录锁间隙锁与临键锁](/posts/mysql-heima-23) |
| [P132](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=132) | 75. 进阶-锁-小结 | [23-记录锁间隙锁与临键锁](/posts/mysql-heima-23) |
| [P133](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=133) | 76. 进阶-InnoDB引擎-逻辑存储结构 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P134](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=134) | 77. 进阶-InnoDB引擎-架构-内存结构1 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P135](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=135) | 78. 进阶-InnoDB引擎-架构-内存结构2 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P136](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=136) | 79. 进阶-InnoDB引擎-架构-磁盘结构 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P137](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=137) | 80. 进阶-InnoDB引擎-架构-后台线程 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P138](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=138) | 81. 进阶-InnoDB引擎-事务原理-概述 | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P139](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=139) | 82. 进阶-InnoDB引擎-事务原理-redolog | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P140](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=140) | 83. 进阶-InnoDB引擎-事务原理-undolog | [24-InnoDB内存磁盘与日志](/posts/mysql-heima-24) |
| [P141](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=141) | 84. 进阶-InnoDB引擎-MVCC-基本概念 | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P142](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=142) | 85. 进阶-InnoDB引擎-MVCC-隐藏字段 | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P143](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=143) | 86. 进阶-InnoDB引擎-MVCC-undolog版本链 | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P144](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=144) | 87. 进阶-InnoDB引擎-MVCC-readview介绍 | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P145](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=145) | 88. 进阶-InnoDB引擎-MVCC-原理分析(RC级别) | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P146](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=146) | 89. 进阶-InnoDB引擎-MVCC-原理分析(RR级别) | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P147](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=147) | 90. 进阶-InnoDB引擎-小结 | [25-MVCC与ReadView](/posts/mysql-heima-25) |
| [P148](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=148) | 91. 进阶-MySQL管理-系统数据库介绍 | [26-管理工具与备份恢复](/posts/mysql-heima-26) |
| [P149](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=149) | 92. 进阶-MySQL管理-常用工具1 | [26-管理工具与备份恢复](/posts/mysql-heima-26) |
| [P150](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=150) | 93. 进阶-MySQL管理-常用工具2 | [26-管理工具与备份恢复](/posts/mysql-heima-26) |
| [P151](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=151) | 94. 进阶-MySQL管理-小结 | [26-管理工具与备份恢复](/posts/mysql-heima-26) |
| [P152](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=152) | 95. 进阶篇总结 | [26-管理工具与备份恢复](/posts/mysql-heima-26) |
| [P153](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=153) | 01. 运维-课程介绍 | [27-错误日志binlog与查询日志](/posts/mysql-heima-27) |
| [P154](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=154) | 02. 运维-日志-错误日志 | [27-错误日志binlog与查询日志](/posts/mysql-heima-27) |
| [P155](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=155) | 03. 运维-日志-二进制日志 | [27-错误日志binlog与查询日志](/posts/mysql-heima-27) |
| [P156](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=156) | 04. 运维-日志-查询日志 | [27-错误日志binlog与查询日志](/posts/mysql-heima-27) |
| [P157](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=157) | 05. 运维-日志-慢查询日志 | [27-错误日志binlog与查询日志](/posts/mysql-heima-27) |
| [P158](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=158) | 06. 运维-主从复制-概述 | [28-主从复制与一致性起点](/posts/mysql-heima-28) |
| [P159](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=159) | 07. 运维-主从复制-原理 | [28-主从复制与一致性起点](/posts/mysql-heima-28) |
| [P160](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=160) | 08. 运维-主从复制-主库配置 | [28-主从复制与一致性起点](/posts/mysql-heima-28) |
| [P161](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=161) | 09. 运维-主从复制-从库配置 | [28-主从复制与一致性起点](/posts/mysql-heima-28) |
| [P162](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=162) | 10. 运维-主从复制-测试 | [28-主从复制与一致性起点](/posts/mysql-heima-28) |
| [P163](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=163) | 11. 运维-分库分表-介绍 | [29-分库分表的设计取舍](/posts/mysql-heima-29) |
| [P164](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=164) | 12. 运维-分库分表-介绍-拆分方式 | [29-分库分表的设计取舍](/posts/mysql-heima-29) |
| [P165](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=165) | 13. 运维-分库分表-MyCat概述-安装 | [29-分库分表的设计取舍](/posts/mysql-heima-29) |
| [P166](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=166) | 14. 运维-分库分表-MyCat概述-核心概念 | [29-分库分表的设计取舍](/posts/mysql-heima-29) |
| [P167](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=167) | 15. 运维-分库分表-MyCat入门 | [30-Mycat配置与范围分片](/posts/mysql-heima-30) |
| [P168](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=168) | 16. 运维-分库分表-MyCat入门-测试 | [30-Mycat配置与范围分片](/posts/mysql-heima-30) |
| [P169](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=169) | 17. 运维-分库分表-MyCat配置1 | [30-Mycat配置与范围分片](/posts/mysql-heima-30) |
| [P170](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=170) | 18. 运维-分库分表-MyCat配置2 | [30-Mycat配置与范围分片](/posts/mysql-heima-30) |
| [P171](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=171) | 19. 运维-分库分表-Mycat分片-垂直分库 | [31-垂直拆分全局表与取模](/posts/mysql-heima-31) |
| [P172](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=172) | 20. 运维-分库分表-Mycat分片-垂直分库-测试 | [31-垂直拆分全局表与取模](/posts/mysql-heima-31) |
| [P173](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=173) | 21. 运维-分库分表-Mycat分片-水平分表 | [31-垂直拆分全局表与取模](/posts/mysql-heima-31) |
| [P174](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=174) | 22. 运维-分库分表-分片规则-范围分片 | [31-垂直拆分全局表与取模](/posts/mysql-heima-31) |
| [P175](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=175) | 23. 运维-分库分表-分片规则-取模分片 | [31-垂直拆分全局表与取模](/posts/mysql-heima-31) |
| [P176](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=176) | 24. 运维-分库分表-分片规则-一致性hash算法 | [32-枚举子串与哈希分片](/posts/mysql-heima-32) |
| [P177](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=177) | 25. 运维-分库分表-分片规则-枚举分片 | [32-枚举子串与哈希分片](/posts/mysql-heima-32) |
| [P178](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=178) | 26. 运维-分库分表-分片规则-应用指定算法 | [32-枚举子串与哈希分片](/posts/mysql-heima-32) |
| [P179](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=179) | 27. 运维-分库分表-分片规则-固定hash算法 | [32-枚举子串与哈希分片](/posts/mysql-heima-32) |
| [P180](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=180) | 28. 运维-分库分表-分片规则-字符串hash解析 | [32-枚举子串与哈希分片](/posts/mysql-heima-32) |
| [P181](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=181) | 29. 运维-分库分表-分片规则-按天分片 | [33-按天与按月分片](/posts/mysql-heima-33) |
| [P182](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=182) | 30. 运维-分库分表-分片规则-按自然月分片 | [33-按天与按月分片](/posts/mysql-heima-33) |
| [P183](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=183) | 31. 运维-分库分表-Mycat管理与监控-原理 | [34-Mycat路由与监控](/posts/mysql-heima-34) |
| [P184](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=184) | 32. 运维-分库分表-Mycat管理工具 | [34-Mycat路由与监控](/posts/mysql-heima-34) |
| [P185](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=185) | 33. 运维-分库分表-MyCat监控1 | [34-Mycat路由与监控](/posts/mysql-heima-34) |
| [P186](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=186) | 34. 运维-分库分表-MyCat监控2 | [34-Mycat路由与监控](/posts/mysql-heima-34) |
| [P187](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=187) | 35. 运维-分库分表-总结 | [34-Mycat路由与监控](/posts/mysql-heima-34) |
| [P188](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=188) | 36. 运维-读写分离-介绍 | [35-读写分离与一致性](/posts/mysql-heima-35) |
| [P189](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=189) | 37. 运维-读写分离-一主一从准备 | [35-读写分离与一致性](/posts/mysql-heima-35) |
| [P190](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=190) | 38. 运维-读写分离-一主一从读写分离 | [35-读写分离与一致性](/posts/mysql-heima-35) |
| [P191](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=191) | 39. 运维-读写分离-双主双从介绍 | [36-双主双从与故障切换](/posts/mysql-heima-36) |
| [P192](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=192) | 40. 运维-读写分离-双主双从搭建 | [36-双主双从与故障切换](/posts/mysql-heima-36) |
| [P193](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=193) | 41. 运维-读写分离-双主双从读写分离 | [36-双主双从与故障切换](/posts/mysql-heima-36) |
| [P194](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=194) | 42. 运维-读写分离-总结 | [36-双主双从与故障切换](/posts/mysql-heima-36) |
| [P195](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=195) | 43. 运维篇总结 | [36-双主双从与故障切换](/posts/mysql-heima-36) |
