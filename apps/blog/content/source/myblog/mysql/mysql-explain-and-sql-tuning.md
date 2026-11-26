---
title: "MySQL 慢 SQL 诊断、EXPLAIN 执行计划与索引调优实战"
slug: mysql-explain-and-sql-tuning
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "EXPLAIN"
  - "慢查询"
  - "联合索引"
  - "SQL调优"
---

慢 SQL 优化的第一步永远不是盲目给字段加索引。同样是一条耗时两秒的请求，根因可能是全表扫描、深分页丢弃前百万行、内存排序溢出，也可能是根本没走索引而在等行锁。先把负载定位到具体语句、用 `EXPLAIN` 看穿执行路径，再针对最左前缀、排序分组、深分页和批量写入对症下药。

## 定位慢 SQL：慢查询日志与性能观测

通过全局状态计数器 `SHOW GLOBAL STATUS WHERE Variable_name IN ('Com_select', 'Com_insert', 'Com_update', 'Com_delete');` 可以先摸清实例读写比例，但真正定位单条慢 SQL 必须开启慢查询日志：

```sql
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'slow_query_log_file';

-- 临时开启捕获超过 2 秒的查询（持久生效需写入 my.cnf [mysqld]）
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 2;
```

读慢查询日志重点对照四个指标：`Query_time`（总耗时）、`Lock_time`（等锁耗时）、`Rows_sent`（返回行数）与 `Rows_examined`（扫描行数）。如果一条接口只返回 10 行数据却检查了几百万行，瓶颈通常就在索引或分页方式上；如果扫描行数很小但 `Lock_time` 极长，加索引解决不了锁冲突，必须去查事务并发。需要分析阶段耗时细节时，在 MySQL 8.0 应使用 Performance Schema，旧版的 `SHOW PROFILE` 已被官方标记弃用。

## 读懂 EXPLAIN 与 EXPLAIN ANALYZE

在待查 SQL 前加上 `EXPLAIN` 可以看到优化器选定的逻辑计划；MySQL 8.0.18+ 还提供 `EXPLAIN ANALYZE`，它会**实际执行**语句并输出真实耗时、实际行数与循环次数（测试写操作前切忌盲目执行）。

| 核心列 | 关注要点 |
| :--- | :--- |
| `type` | 访问方式从优到劣大致为：`system` > `const` > `eq_ref` > `ref` > `range` > `index` > `ALL` |
| `possible_keys` / `key` | 候选索引与最终选中的索引；`key` 为 `NULL` 表示未走索引 |
| `key_len` | 实际用到的索引前缀最大字节数，用于反推联合索引命中了几列（受列类型、空值标记与字符集影响） |
| `rows` / `filtered` | 优化器估算扫描行数，以及经过剩余表条件过滤后的留存比例 |
| `Extra` | `Using index`（覆盖索引）、`Using index condition`（ICP 索引条件下推）、`Using filesort`（额外排序）、`Using temporary`（临时表） |

阅读多表连接计划时，结合 `EXPLAIN FORMAT=TREE` 能更清晰地看清驱动顺序与嵌套循环放大倍数。同时注意：**`type` 并不是绝对速度榜**——对于几十行的小表，优化器直接选 `ALL` 全表扫描通常比走索引回表更快，统计信息失真时可用 `ANALYZE TABLE` 刷新采样。

## 联合索引最左前缀与常见失效场景

建立联合索引 `KEY idx_pro_age_status (profession, age, status)` 后，索引条目在 B+ 树叶子中严格按“先 `profession`、同专业下按 `age`、同年龄下按 `status`”排序，与 SQL `WHERE` 子句里条件的书写顺序无关。

```text
(软件工程, 30, 0, PK=1)
(软件工程, 31, 0, PK=2)
(软件工程, 31, 1, PK=3)
```

| 查询条件 | 索引使用效果与原因 |
| :--- | :--- |
| `profession = '软件工程' AND age = 31 AND status = '0'` | 三列全部走索引定位，最窄范围精确命中 |
| `profession = '软件工程' AND status = '0'` | 仅 `profession` 用于范围定位，跳过 `age` 导致 `status` 无法直接参与连续前缀定位 |
| `age = 31 AND status = '0'` | 缺失最左列 `profession`，31 岁分散在不同专业段中，无法使用常规前缀查找 |
| `profession = '软件工程' AND age > 30 AND status = '0'` | `age > 30` 跨多个年龄值，导致后续 `status` 整体不再有序，**范围查询右侧列无法继续缩小范围** |

**凡是对索引列做函数运算、触发隐式类型转换或使用前置通配符模糊匹配，都会直接破坏 B+ 树的有序性，导致无法走范围定位。**

1. **列上套函数或运算**：`WHERE SUBSTRING(phone, 10, 2) = '01'` 无法利用 `phone` 原有顺序；高频后缀需求需改用生成列索引或反转存储。
2. **隐式类型转换**：字符串列 `phone` 写成数字条件 `WHERE phone = 17799990001`，MySQL 会把整列的字符串值隐式转成浮点数再比对，既会让索引失效，还可能引发前导零或大数精度丢失错误。
3. **模糊匹配通配符位置**：`LIKE '软件%'` 有明确前缀边界可走 `range` 扫描；`LIKE '%工程'` 失去排序起点，至多退化为覆盖索引全扫描（`index`）。
4. **`OR` 与数据分布选择**：`WHERE id = 1 OR age = 31` 若 `age` 无索引必然退化为全表扫描；即便是 `IS NULL` 或性别等低基数列，当查询命中极少数稀疏值时照样适合走索引，一旦命中超过全表 20%~30%，优化器就会主动放弃回表改走全扫。

### 覆盖索引、ICP 与前缀索引

当联合索引 `(profession, age, status)` 用于 `SELECT id, name FROM index_user WHERE profession = '软件工程' AND age > 30 AND status = '0'` 时，虽然 `status` 无法缩小扫描区间，但存储引擎会在索引内部先利用 **索引条件下推（ICP，`Using index condition`）** 过滤掉 `status != '0'` 的记录，再拿留下的主键回表取 `name`，显著减少无效回表。如果连 `name` 都不查，结果列全在索引里，就直接触发 `Using index` 覆盖索引。

对于长字符串（如 `email`），可以按业务区分度截取前缀建索引：`CREATE INDEX idx_email_prefix ON index_user(email(5));`，通过比较 `COUNT(DISTINCT LEFT(email, 5)) / COUNT(*)` 与完整列区分度的比值权衡索引体积与碰撞率（注意前缀索引无法支持覆盖索引与排序）。遇到优化器偶发选错索引时，可用 `USE INDEX`、`IGNORE INDEX` 或 `FORCE INDEX` 干预，但上线前必须在真实数据量下对比验证。

## 排序、分组、深分页与 COUNT 优化

### 1. 消除 `Using filesort` 与临时表

给 `emp(age, entry_date)` 建联合索引后，`ORDER BY age, entry_date`（同升）或 `ORDER BY age DESC, entry_date DESC`（同降，反向扫描）都能直接利用索引顺序避免额外排序；但一升一降的混合排序必须显式创建方向匹配的降序索引 `CREATE INDEX idx_mixed ON emp(age ASC, entry_date DESC);`（MySQL 8.0+ 支持）。出现 `Using filesort` 表示执行器额外开了排序阶段（可在内存或磁盘临时文件完成），优化手段除了补齐匹配索引，还需避免 `SELECT *` 携带宽列导致排序缓冲区退化为外排。

同理，`GROUP BY` 也能借力索引有序性避免 `Using temporary`——建立 `(dept_id, age)` 后，`WHERE dept_id = 1 GROUP BY age` 就能顺着有序分段直接聚合。

### 2. 深分页改造：延迟关联与游标翻页

`LIMIT 1000000, 10` 慢，是因为引擎必须先扫描并丢弃前一百万条完整记录。优化分两种产品形态：

- **必须支持任意跳页**：用**延迟关联**先在窄覆盖索引里跳过前百万个主键，只回表取目标 10 行：

```sql
SELECT e.id, e.name, e.entry_date
FROM emp AS e
JOIN (
  SELECT id, entry_date FROM emp
  ORDER BY entry_date, id
  LIMIT 1000000, 10
) AS page ON page.id = e.id
ORDER BY page.entry_date, page.id;
```

- **仅需连续上/下一页（如信息流）**：直接改用**游标（Keyset）分页**，记住上一页最后一条的 `(entry_date, id)` 组合边界，把深偏移彻底变成索引范围查找（必须带上唯一主键打破日期并列，否则同一天的记录会漏掉或重复）：

```sql
SELECT id, name, entry_date FROM emp
WHERE entry_date > '2006-01-01'
   OR (entry_date = '2006-01-01' AND id > 6)
ORDER BY entry_date, id
LIMIT 10;
```

### 3. `COUNT` 的语义与引擎表现

`COUNT(*)`、`COUNT(1)` 与 `COUNT(id)`（主键非空）在统计总行数上语义完全等价，InnoDB 均会挑选体积最小的可用二级索引扫描统计，无需人为把 `COUNT(*)` 改成 `COUNT(1)` 追求微弱差异；唯独 `COUNT(col)` 会跳过 `NULL` 值，严禁为性能篡改统计语义。由于 InnoDB 需按事务可见性实时统计行数，千万级大表列表建议取消精确总页数或采用异步估算缓存。

## 批量写入、主键局部性与 UPDATE 锁范围

高吞吐写入优化要管好事务粒度与主键顺序：

1. **批量写入与 `LOAD DATA`**：把多行插入合并为多值 `INSERT INTO t VALUES (...), (...);` 并包裹在显式事务内（每批 500~1000 行作为调优起点），可大幅削减网络往返和 Redo 刷盘提交次数，但批次过大会拉长事务持锁时间与回滚成本。百万级静态文件导入优先用 `LOAD DATA LOCAL INFILE`（注意 `LOCAL` 读取客户端本地文件，无 `LOCAL` 读取数据库服务器文件且受 `secure_file_priv` 约束）。
2. **有序主键降低页分裂**：聚簇索引按键顺序组织数据，单调递增主键几乎总是追加到最右侧叶子页，局部性极佳；随机键落入中间页容易频繁触发页分裂与磁盘碎片。
3. **`UPDATE` 必须命中有效索引**：**`UPDATE` 语句如果条件列没有可用索引，InnoDB 会走全表扫描并在扫描过的每一条索引记录上加锁**——这看似整张表被锁死，实则是海量行锁与临键锁覆盖了全表（详细加锁规则见 [InnoDB 锁机制详解](/posts/mysql-innodb-locks)）。执行更新前务必先用 `EXPLAIN` 确认能精准命中索引。
