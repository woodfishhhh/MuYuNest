---
title: "InnoDB 锁机制详解：MDL、意向锁、记录锁、间隙锁与临键锁"
slug: mysql-innodb-locks
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "InnoDB"
  - "元数据锁"
  - "间隙锁"
  - "临键锁"
---

排查线上阻塞时，如果把所有报错和超时都笼统归结为“表被锁死了”，往往会找错方向。备库导出卡住可能是在等全局读锁，一条 `ALTER TABLE` 死活过不去可能是前面有个挂着未提交 `SELECT` 的事务攥着元数据锁，而并发 `INSERT` 超时则是被 `REPEATABLE READ` 下的间隙锁或临键锁拦在了索引区间外。按锁保护的对象和粒度逐层拆解，才能精准看懂 `data_locks` 与 `metadata_locks` 里的等待链路。

## 全局锁、显式表锁与元数据锁（MDL）

### 1. 全局读锁与一致性备份

多表关联导出时（例如先导出未扣减的库存，期间订单提交后再导出新订单），单表各自导出成功也会拼出一份逻辑不一致的备份。全局读锁 `FLUSH TABLES WITH READ LOCK;`（FTWRL）会阻塞实例上的数据写入与结构变更，为拷贝提供一致性窗口，结束后用 `UNLOCK TABLES;` 释放。

对于 InnoDB 表，更常用的替代方案是开启一致性事务快照导出，避免在导出全程挂起全局写入：

```powershell
mysqldump -h 127.0.0.1 -u root -p --single-transaction --routines --triggers --events --databases mysql_notes --result-file=D:/mysql-lab/mysql_notes.sql
```

需注意 `--single-transaction` 对非 InnoDB 表无效，且导出期间遇到并发 DDL 同样会破坏一致性或引发阻塞。

### 2. 显式表锁与元数据锁（MDL）

`LOCK TABLES t READ` 允许自身和其他会话读但阻塞写；`LOCK TABLES t WRITE` 会阻塞其他所有会话对表的读写。在 InnoDB 业务事务中极少手动加显式表锁，真正高频引发生产事故的是自动生效的**元数据锁（MDL，Metadata Lock）**。

**哪怕一个事务只执行了一条普通 `SELECT`，只要该事务没有提交或回滚，它持有的 MDL 读锁就不会释放，足以直接卡死后续的 `ALTER TABLE` 并连带堵死整张表的新请求。**

因为查询必须防止执行期间表结构突然增删列，所以只要开启事务并读过表，连接 A 就会持有 MDL 共享锁直到事务结束；此时连接 B 发起 `ALTER TABLE` 申请 MDL 排他锁被迫等待，而 B 后面新来的普通 `SELECT` 也会在等待队列里排到 B 后面，最终演变成业务全线超时。排查此类阻塞时，直接查元数据锁视图即可定位源头会话：

```sql
SELECT OBJECT_SCHEMA, OBJECT_NAME, LOCK_TYPE, LOCK_DURATION, LOCK_STATUS, OWNER_THREAD_ID
FROM performance_schema.metadata_locks
WHERE OBJECT_SCHEMA = 'mysql_notes';
```

### 3. 意向锁（IS / IX）的协调作用

当事务要给某几行加共享锁或排他锁时，InnoDB 会先在整张表上自动加上对应的意向共享锁（IS）或意向排他锁（IX）。意向锁的存在意义只有一个：**让后续申请整表 S/X 锁的请求在表级 O(1) 判断是否冲突，无需逐行扫描全表记录锁状态。**

| 已有锁 \ 请求锁 | `IS` | `IX` | 表级 `S` | 表级 `X` |
| :--- | :--- | :--- | :--- | :--- |
| **`IS`** | 兼容 | 兼容 | 兼容 | 冲突 |
| **`IX`** | 兼容 | 兼容 | 冲突 | 冲突 |

注意 **`IS` 与 `IX` 之间彼此兼容**：事务 A 和事务 B 可以同时持有同一张表的 `IX` 锁并各自修改不同的行，真正决定两行操作是否互斥的是下层的行级记录锁。

## InnoDB 行级锁的三种形态与加锁规则

在 InnoDB 默认隔离级别 `REPEATABLE READ` 下，行级锁均加在**索引项**上（并非加在抽象的数据行本身），分为三类基本锁：

- **记录锁（Record Lock，`REC_NOT_GAP`）**：锁定单个已存在的索引记录，阻止其他事务对该记录做冲突读写。
- **间隙锁（Gap Lock，`GAP`）**：锁定两条相邻索引记录之间的开区间（不含记录本身），专门用来阻止其他事务往区间里插入新记录，防止幻读。注意多个事务可以在同一个间隙上同时持有间隙锁（间隙锁彼此兼容，只拦插入不拦其他间隙锁）。
- **临键锁（Next-Key Lock）**：记录锁 + 该记录前面的间隙锁，构成左开右闭区间如 `(19, 25]`，是 InnoDB 在 RR 下的默认加锁单位。

建立包含主键 `id` 与非唯一普通索引 `age` 的实验表 `lock_demo`（数据主键值依次为 `1, 3, 8, 11, 19, 25`），并用 `performance_schema` 观察实际锁模式：

```sql
CREATE TABLE lock_demo (
  id INT PRIMARY KEY,
  name VARCHAR(20),
  age INT,
  KEY idx_lock_age(age)
) ENGINE=InnoDB;
INSERT INTO lock_demo VALUES
  (1,'1',1),(3,'3',3),(8,'8',8),(11,'11',11),(19,'19',19),(25,'25',25);

-- 在第三个观察会话中查看实时加锁状态与等待链
SELECT ENGINE_TRANSACTION_ID, OBJECT_NAME, INDEX_NAME,
       LOCK_TYPE, LOCK_MODE, LOCK_STATUS, LOCK_DATA
FROM performance_schema.data_locks
WHERE OBJECT_SCHEMA = 'mysql_notes' AND OBJECT_NAME = 'lock_demo';
SELECT * FROM performance_schema.data_lock_waits;
```

```text
索引键:   1       3       8       11       19       25
记录点:   ●       ●       ●        ●        ●        ●
间隙区:     (1,3)   (3,8)   (8,11)  (11,19)  (19,25)  (25, +∞)
```

**InnoDB 在 `REPEATABLE READ` 下的核心加锁原则是：按需加临键锁，仅在唯一索引等值命中或边界退化时才缩减为记录锁或间隙锁。**

| 查询条件示例（RR 级别） | 索引类型与命中情况 | 实际加锁范围与退化规则 |
| :--- | :--- | :--- |
| `WHERE id = 3 FOR SHARE` | 唯一索引等值**命中** | 临键锁退化为**记录锁**（`S,REC_NOT_GAP`），仅锁 `id=3`，不锁间隙；不阻塞 `id=8` 的更新 |
| `WHERE id = 5 FOR UPDATE` | 唯一索引等值**未命中** | 退化为**间隙锁**，锁住 `5` 所在的区间 `(3, 8)`；其他事务插入 `id=7` 会被阻塞，但修改 `id=3` 或 `id=8` 本身不受影响 |
| `WHERE age = 3 FOR UPDATE` | **非唯一**索引等值查询 | 除对命中的 `(age=3, id=3)` 加临键锁 `(1, 3]` 外，还会向后扫描至首个不满足条件的值 `8` 并对 `(3, 8)` 加间隙锁（阻止后续再插入 `age=3` 的新记录），同时给主键 `id=3` 加记录锁 |
| `WHERE id >= 19 FOR SHARE` | 唯一索引**范围查询** | 命中 `19` 退化为记录锁（部分版本保留临键锁边界），继续向后锁住 `25` 的临键锁 `(19, 25]` 以及最大记录之后的 `supremum pseudo-record` 临键锁 `(25, +∞)` |

如果把事务隔离级别调为 `READ COMMITTED`，InnoDB 在普通检索阶段通常**不会**加间隙锁（仅在外键检查和唯一键重复冲突校验时临时使用），而是直接锁住命中的记录并提前释放不匹配行的锁，并发插入冲突更少，但也允许幻读发生。

## 无索引全表锁假象与死锁排查

当执行一条 `UPDATE` 或 `DELETE` 时，如果 `WHERE` 条件列没有可用索引（或者因为隐式类型转换导致索引失效），InnoDB 只能走聚簇索引全表扫描，并顺路把扫描到的每一条记录和间隙全部加上临键锁。**这种现象和“行锁自动升级成表锁”完全无关，实质是全扫描路径下的行锁与间隙锁覆盖了整张表的所有区间**，效果上等同于把全表写入堵死（优化方式见[MySQL 慢 SQL 诊断与调优](/posts/mysql-explain-and-sql-tuning)）。

当两个事务以相反顺序申请互斥锁（例如事务 A 锁住 `id=1` 等 `id=3`，事务 B 锁住 `id=3` 等 `id=1`），或者并发在同一个间隙持有间隙锁后又同时尝试往该间隙插入新记录（插入意向锁被彼此的间隙锁卡住）时，就会触发死锁。InnoDB 默认开启死锁检测（等待图法），发现环路后会立即回滚代价较小的事务并释放锁，也可通过 `SHOW ENGINE INNODB STATUS` 的 `LATEST DETECTED DEADLOCK` 段落还原最近一次死锁的 SQL 与锁持有人。

线上减少锁冲突与死锁的四条直接措施：
1. **所有更新和删除语句走精确索引**，避免全扫描扩大临键锁覆盖面。
2. **保持事务短小精悍**，严禁在事务内夹带远程 HTTP 调用、文件读写或人工交互等待。
3. **批量加锁按固定顺序排序**（如多账户转账统一按 `ORDER BY id` 从小到大锁定），直接破坏死锁循环等待条件。
4. **允许时权衡使用 RC 隔离级别**，消除高频并发插入场景下的间隙锁争用（需搭配业务幂等与唯一索引保证一致性）。
