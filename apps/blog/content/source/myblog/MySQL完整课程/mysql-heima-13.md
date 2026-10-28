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

查询慢，可能是扫描的记录太多，也可能是在等锁、在排序、在发送大量结果。先找到具体是哪条语句、成本花在哪，再改索引或 SQL。客户端显示的 0.00 秒，证明不了两条查询性能相同。

## 执行次数告诉你负载形状

```sql
SHOW GLOBAL STATUS WHERE Variable_name IN
  ('Com_select','Com_insert','Com_update','Com_delete');
```

GLOBAL 看整个实例，SESSION 看当前连接。计数是累计值，要比较一段时间内的增量；重启、重置、其他会话都会影响解读。查询次数多，不代表查询占的时间一定最多，一条巨大的 UPDATE 或少数几次锁等待也可能拖慢业务。

先定目标，比如“某个列表请求的 P95 延迟高”，再对应到 SQL、调用频次、返回行数和并发场景。别为了优化就把所有表都加一遍索引。

## 慢查询日志记录超过阈值的语句

```sql
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'slow_query_log_file';
SHOW VARIABLES LIKE 'log_output';
```

在自己管理的实验实例上，可以临时开启，记下原值方便恢复：

```sql
SET GLOBAL slow_query_log=ON;
SET SESSION long_query_time=2;
```

要让阈值作为默认值影响后续连接，就设置 GLOBAL，或者写进服务器实际读取的配置文件。持久配置一般长这样：

```ini
[mysqld]
slow_query_log=ON
long_query_time=2
```

配置文件位置、日志输出目标和文件名取决于安装方式，别默认它总是 `/var/lib/mysql/localhost-slow.log`。先查实际的变量，再去读那个路径。日志里的字段：

- Query_time：耗时
- Lock_time：对应的锁时间字段，不是“锁了多少行”
- Rows_sent：返回行数
- Rows_examined：检查行数

比如返回 10 行却检查了几百万行，就该检查筛选、排序和分页的路径。日志里没有某条语句，可能只是它没达到记录条件，不代表它已经够快了。

## SHOW PROFILE 是旧环境的观察手段

课程环境里可以这样看当前会话最近语句的耗时：

```sql
SET profiling=1;
SELECT COUNT(*) FROM emp;
SHOW PROFILES;
-- 将 1 替换为 SHOW PROFILES 返回的真实 Query_ID
SHOW PROFILE FOR QUERY 1;
SHOW PROFILE CPU FOR QUERY 1;
SET profiling=0;
```

SHOW PROFILE/PROFILES 已经弃用，做维护工具要考虑 Performance Schema 等受支持的观测接口。就算能显示分阶段耗时，也要分清服务器执行时间和客户端的网络、渲染时间。把慢日志阈值调低也能观察较快的语句，不是低于两秒就只能用 profiling。

## 先看 EXPLAIN 的访问路径

```sql
EXPLAIN SELECT id,name FROM emp WHERE id=1;
EXPLAIN SELECT id,name FROM emp WHERE name='柳岩';
EXPLAIN FORMAT=TREE
SELECT e.name,d.name FROM emp AS e JOIN dept AS d ON d.id=e.dept_id;
```

传统 EXPLAIN 的主要列这样读：

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

type 常见的值：

- `const`：常见于常量等值的唯一定位
- `eq_ref`：常见于连接时按唯一键最多找到一行
- `ref`：用非唯一键或键前缀匹配
- `range`：访问一个范围
- `index`：可能扫描整棵索引
- `ALL`：扫描整表
- `system`：只有一行之类的特殊情形，不是简单的“访问系统数据库”

这些类别不能脱离数据量排成速度榜。8 行的表全扫很便宜，大量随机回表反而可能更贵。key 不为空只说明选了索引，不能单凭它判断查询已经优化好了。

rows 和 filtered 都是估计值，`rows × filtered/100` 大致是传给后续步骤的行数。filtered=100 不是自动满分：扫一千万行再全部返回，也可能是 100。id、select_type 用来识别查询块；有子查询改写、物化、相关执行和不同连接算法时，不能一律按“id 越大越先执行”还原全过程，要结合 TREE 结构判断。[EXPLAIN 输出说明](https://dev.mysql.com/doc/refman/8.0/en/explain-output.html)。

读多表 EXPLAIN，别先盯着最显眼的某个词，先确认每一行在整个查询里负责什么。以员工连部门为例：

```sql
EXPLAIN
SELECT e.name,d.name AS department_name
FROM emp AS e
JOIN dept AS d ON d.id=e.dept_id
WHERE e.age<30;
```

假如某个计划先取出满足年龄条件的员工，再按每名员工的 dept_id 查部门。dept.id 是主键，每次定位部门最多对应一行，`eq_ref` 类访问要关注的就是这一点。它描述的是“对前面的每组记录，怎么访问当前表”，不是说整条查询只执行一次。

假设某一步估计扫描 10000 行，filtered 是 10%，可以理解为估计留下约 1000 行交给后面处理。这只是帮助读懂字段的计算例子，不是当前八行表的实测输出。如果后一步还要为每行做一次查询，前面留下的行数就会放大后一步的工作量。只看到后一步能走索引，可能会忽略前一步已经带来了很多次调用。

key_len 要结合索引定义来解释。索引列类型、是否允许 NULL、字符集、变长编码都会影响长度。它不是查询实际返回的字节数，也不是索引文件大小。看 key_len 的变化能帮忙判断用了哪些键部分，但要和 key、ref、条件、Extra 一起看，光凭一个数字判断不完所有联合索引的情况。

## 估计计划与实际执行要区分

```sql
EXPLAIN ANALYZE
SELECT e.name,d.name FROM emp AS e JOIN dept AS d ON d.id=e.dept_id;
```

MySQL 8.0.18 起可以用 EXPLAIN ANALYZE，它会实际执行受支持的语句，显示实际耗时、行数和循环次数；普通 EXPLAIN 主要给出计划估计。测试时用自己能控制的查询，别把 ANALYZE 当成完全不执行 SQL 的查看命令。

实际执行和估计对不上时：

- 估计行数和实际差很多：查数据倾斜、统计信息、条件之间的关联。`ANALYZE TABLE emp` 能更新相关统计，但也要清楚它的运行成本
- 大量行被过滤掉：查索引列顺序和能用来定位的条件
- 循环次数特别大：看连接放大
- 大量时间在等锁：光给查询加索引，未必能解决事务持锁太久

对比优化前后，参数、结果含义、数据量和环境都要保持一致，还要记下返回结果是否相同。课程里千万行样例的秒数不是本地基准，小表的结果只能验证机制和语法。

有用的优化记录至少要把因果连起来。比如：“查询只返回少量员工，却检查了大量候选；条件是等值工号，但当前没有合适的索引；加了符合业务唯一性的索引后，计划从大量扫描变成定位少量候选；结果字段和行集合保持一致。”这样才说得清改动针对的是哪一段成本。

实际耗时还是没改善，就继续检查假设：测试数据是不是太小，前后两次缓存状态是不是不同，时间是不是主要花在等锁，客户端是不是取回了太多没用的列。不用每次都把所有指标测一遍，但测试要能回答最开始提出的问题。原先的问题是等锁，最后只证明了建好了索引，那就还没解释完。

SHOW PROFILE 的弃用状态见 [官方语句说明](https://dev.mysql.com/doc/refman/8.0/en/show-profiles.html)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-12) · [下一篇](/posts/mysql-heima-14)
