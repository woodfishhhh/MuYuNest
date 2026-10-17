---
title: "MySQL（13）：定位慢 SQL 与执行计划"
date: 2026-10-17 00:00:00
slug: mysql-heima-13
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

一次查询慢，可能是扫描记录太多，也可能在等锁、做排序、发送大量结果。优化前先找到具体语句和成本来源，再改变索引或 SQL。只看客户端显示的 0.00 秒，不能证明两条查询性能相同。

## 执行次数告诉你负载形状

```sql
SHOW GLOBAL STATUS WHERE Variable_name IN
  ('Com_select','Com_insert','Com_update','Com_delete');
```

GLOBAL 观察整个实例，SESSION 观察当前连接。计数是累计值，应比较一段时间内的增量；重启、重置和其他会话都会影响解释。查询次数多不等于查询一定占最多时间，一条巨大的 UPDATE 或少数锁等待也可能拖慢业务。

先确定目标，例如“某个列表请求的 P95 延迟高”，再对应到 SQL、调用频次、返回行数和并发场景。不要为了优化而把所有表都加一遍索引。

## 慢查询日志记录超过阈值的语句

```sql
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'slow_query_log_file';
SHOW VARIABLES LIKE 'log_output';
```

在自己管理的实验实例中，可以临时开启并记住原值以便恢复：

```sql
SET GLOBAL slow_query_log=ON;
SET SESSION long_query_time=2;
```

若要作为默认阈值影响后续连接，需要设置 GLOBAL 或写入服务器实际读取的配置文件。持久配置的常见形状是：

```ini
[mysqld]
slow_query_log=ON
long_query_time=2
```

配置文件位置、日志输出目标和文件名取决于安装方式，不能固定假设总是 `/var/lib/mysql/localhost-slow.log`。先查询实际变量，再读取该路径。日志中的 Query_time 是耗时，Lock_time 是相应的锁时间字段，Rows_sent 是返回行数，Rows_examined 是检查行数；不要把 Lock_time 读成“锁了多少行”。

例如返回 10 行却检查数百万行，值得检查筛选、排序和分页路径。日志没有某条语句，可能只是它未达到记录条件，不代表该语句已经足够快。

## SHOW PROFILE 是旧环境的观察手段

课程环境可以用下列方式查看当前会话的近期语句耗时：

```sql
SET profiling=1;
SELECT COUNT(*) FROM emp;
SHOW PROFILES;
-- 将 1 替换为 SHOW PROFILES 返回的真实 Query_ID
SHOW PROFILE FOR QUERY 1;
SHOW PROFILE CPU FOR QUERY 1;
SET profiling=0;
```

SHOW PROFILE/PROFILES 已弃用，维护工具应考虑 Performance Schema 等受支持的观测接口。即使能显示分阶段耗时，也要分清服务器执行时间与客户端网络、渲染时间。更低的慢日志阈值也可以观察较快语句，并非低于两秒就只能用 profiling。

## 先看 EXPLAIN 的访问路径

```sql
EXPLAIN SELECT id,name FROM emp WHERE id=1;
EXPLAIN SELECT id,name FROM emp WHERE name='柳岩';
EXPLAIN FORMAT=TREE
SELECT e.name,d.name FROM emp AS e JOIN dept AS d ON d.id=e.dept_id;
```

传统 EXPLAIN 的主要列可以这样读：

| 列 | 问的问题 |
| --- | --- |
| table | 当前访问哪个表或派生结果？ |
| type | 是唯一定位、普通索引定位、范围扫描，还是全扫描？ |
| possible_keys / key | 有哪些候选索引，最终选择哪个？ |
| key_len | 计划使用的索引键长度上界，有助于判断用了哪些键部分 |
| ref | 索引查找拿什么常量或外层列作比较？ |
| rows | 估计要检查多少行？ |
| filtered | 估计经过剩余表条件后有多少比例留下？ |
| Extra | 额外排序、临时表、覆盖索引、索引条件下推等信息 |

`const` 常见于常量等值唯一定位；`eq_ref` 常见于连接时按唯一键至多找到一行；`ref` 用非唯一键或键前缀匹配；`range` 访问范围；`index` 可能扫描整棵索引；`ALL` 扫描整表。`system` 表示只有一行等特殊情形，不是简单“访问系统数据库”。

这些类别不是可脱离数据量的速度排行榜。8 行表全扫很便宜，大量随机回表反而可能更贵。key 不为空只说明选择了索引，不能单凭它判断查询已经优化成功。

rows 和 filtered 是估计，`rows × filtered/100` 大致解释向后续步骤传递的数量。filtered=100 不是自动满分：扫描一千万行并全部返回时同样可能为 100。id、select_type 用来识别查询块；存在子查询改写、物化、相关执行和不同连接算法时，不能一律按“id 越大越先执行”还原全过程，应结合 TREE 结构判断。[EXPLAIN 输出说明](https://dev.mysql.com/doc/refman/8.0/en/explain-output.html)。

阅读多表 EXPLAIN 时，不要先找最显眼的单个单词，先确认每一行在整个查询里负责什么。以员工连部门为例：

```sql
EXPLAIN
SELECT e.name,d.name AS department_name
FROM emp AS e
JOIN dept AS d ON d.id=e.dept_id
WHERE e.age<30;
```

如果某个计划先取得满足年龄条件的员工，再按每名员工的 dept_id 查部门，dept.id 是主键，每次部门定位最多对应一行，这才是 `eq_ref` 类访问值得关注的原因。它描述的是“对前面的每组记录，怎样访问当前表”，不是说整条查询只执行一次。

假设一个计划中某步估计扫描 10000 行，filtered 为 10%，可以把它理解为估计留下约 1000 行交给后续处理。这只是为了读懂字段而设的计算例子，不是当前八行表的实测输出。如果后一步还为每行做一次查询，前面留下的数量就会放大后一步的工作量。只看后一步能走索引，可能忽略前一步已产生了很多次调用。

key_len 则要结合索引定义解释。索引列类型、是否允许 NULL、字符集和变长编码都会影响长度。它不是查询实际返回了多少字节，也不是索引文件大小。观察 key_len 的变化可以帮助判断使用了哪些键部分，但必须和 key、ref、条件及 Extra 一起看，不能单凭一个数字把所有联合索引情况判定完。

## 估计计划与实际执行要区分

```sql
EXPLAIN ANALYZE
SELECT e.name,d.name FROM emp AS e JOIN dept AS d ON d.id=e.dept_id;
```

MySQL 8.0.18 起可使用 EXPLAIN ANALYZE；它会实际执行受支持的语句，并显示实际耗时、行数和循环次数。普通 EXPLAIN 主要给出计划估计。测试时使用自己的可控查询，不能把 ANALYZE 当作完全不执行 SQL 的查看命令。

若估计行数与实际差很多，要检查数据倾斜、统计信息与条件关联。`ANALYZE TABLE emp` 可更新相关统计，但也应理解其运行成本。若大量行被过滤，要检查索引列顺序和可定位条件；若循环次数极大，要看连接放大；若大量时间在等待锁，单纯增加查询索引未必解决事务持锁太久。

对比优化前后时，保持参数、结果语义、数据量和环境一致，并记录返回结果是否相同。课程中千万行样例的秒数不是本地基准，小表结果只能验证机制和语法。

一次有意义的优化记录至少要连起因果。比如“查询返回少量员工，却检查了大量候选；条件是等值工号，但当前没有适合的索引；增加符合业务唯一性的索引后，计划从大量扫描变为定位少量候选；结果字段和行集合保持一致”。这样才能说明改动针对了哪一段成本。

如果实际耗时仍没有改善，就继续检查假设：是否测试数据太小，是否先后两次缓存状态不同，是否时间主要花在锁等待，是否客户端取回了过多无用列。这里不是要求每次都测所有指标，而是让测试回答最初提出的问题。原先是等待锁，最后只证明建立了索引，就还没有完成解释。

SHOW PROFILE 的弃用状态可核对 [官方语句说明](https://dev.mysql.com/doc/refman/8.0/en/show-profiles.html)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-12) · [下一篇](/posts/mysql-heima-14)
