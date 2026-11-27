---
title: "MySQL 事务隔离级别、Undo 版本链与 MVCC ReadView"
slug: mysql-transactions-and-mvcc
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "事务"
  - "隔离级别"
  - "MVCC"
  - "ReadView"
---

在同一张账户表上并发读写时，最容易碰到两个困惑：为什么开启 `REPEATABLE READ` 事务后，别的连接已经改了姓名并提交，当前连接普通 `SELECT` 还是看到旧值；而紧接着同一事务里去插入一条刚才明明“查不到”的主键，却直接报主键冲突。搞懂事务边界、快照读与当前读的切换条件，以及 InnoDB 如何用 Undo 版本链和 ReadView 计算可见性，这些问题就能一次性说透。

## 事务边界、自动提交与并发更新陷阱

MySQL 默认开启 `autocommit = 1`，每条独立的 DML 语句都会自动包装成一个事务并立即提交。在做账户转账这类多步原子操作时，必须使用同一个数据库连接显式开启事务：

```sql
CREATE TABLE account (
  id INT PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  balance DECIMAL(12,2) NOT NULL,
  CHECK (balance >= 0)
) ENGINE=InnoDB;
INSERT INTO account VALUES (1, '张三', 2000), (2, '李四', 2000);

START TRANSACTION;
SELECT id, balance FROM account WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
UPDATE account SET balance = balance - 1000 WHERE id = 1 AND balance >= 1000;
-- 应用层必须检查 ROW_COUNT() = 1，若为 0 说明余额不足，直接 ROLLBACK
UPDATE account SET balance = balance + 1000 WHERE id = 2;
COMMIT;
```

**数据库只保证 SQL 执行层面的原子性，不会自动把 `ROW_COUNT() = 0` 当成业务失败——应用层必须逐条校验影响行数再决定提交或回滚。**

并发扣款时还要坚决避免“应用层读出余额算好再 `SET balance = 1900`”的反模式，否则两个并发请求都会基于 2000 计算并互相覆盖，造成更新丢失；改用原子表达式 `SET balance = balance - 100` 让 InnoDB 借助行锁基于最新值扣减，再由外层事务包住扣款与入账。此外注意事务状态绑定在单条 TCP 会话上，切忌在连接池中跨连接执行同一业务事务，也不要把会触发隐式提交的 DDL（如 `TRUNCATE`、`DROP`）塞进业务事务中。

| ACID 特性 | 在账户转账中的落地点 |
| :--- | :--- |
| 原子性（Atomicity） | 扣款与入账作为一个整体，全部提交或一起撤销 |
| 一致性（Consistency） | 总额守恒并满足 `balance >= 0` 等约束（需业务逻辑配合） |
| 隔离性（Isolation） | 并发事务的中间状态受隔离级别与锁规则约束 |
| 持久性（Durability） | 提交后由 Redo 等日志机制保障结果在崩溃恢复后不丢失 |

关于数据库恢复与并发调度的通用理论推导，可参阅[数据库事务、故障恢复与并发控制](/posts/database-transactions-recovery-and-concurrency)。

## 四种隔离级别与并发读异常

SQL 标准定义了四个隔离级别，可以通过 `SET SESSION TRANSACTION ISOLATION LEVEL ...` 切换当前会话后续事务的隔离行为：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | InnoDB 一致性读策略 |
| :--- | :--- | :--- | :--- | :--- |
| `READ UNCOMMITTED` | 可能发生 | 可能发生 | 可能发生 | 直接读取最新修改（含未提交） |
| `READ COMMITTED`（RC） | 不会 | 可能发生 | 可能发生 | **每次**普通 `SELECT` 生成新 ReadView |
| `REPEATABLE READ`（RR，默认） | 不会 | 不会 | 快照读不会 / 当前读需靠临键锁 | **首次**普通 `SELECT` 生成并复用同一 ReadView |
| `SERIALIZABLE` | 不会 | 不会 | 不会 | 普通读隐式升级为共享锁定读 |

开两个独立的客户端连接 A 和 B，可以直观复现 RC 与 RR 的行为差异（初始 `id=1` 余额为 2000）：

| 时序步骤 | 连接 A（`RC` vs `RR`） | 连接 B |
| :--- | :--- | :--- |
| 1 | `START TRANSACTION;` | `START TRANSACTION;` |
| 2 | `SELECT balance FROM account WHERE id = 1;` → `2000` | — |
| 3 | — | `UPDATE account SET balance = 1500 WHERE id = 1;`（未提交） |
| 4 | 再次 `SELECT` → `2000`（无脏读） | — |
| 5 | — | `COMMIT;` |
| 6 | 再次 `SELECT` → **RC 看到 `1500`，RR 仍看到 `2000`** | — |

不可重复读与幻读的区别在于观察对象不同：同一行记录两次读出字段值不同属于不可重复读；同一条件前后两次查询返回的结果集行数增减（例如别的事务新插入了满足条件的行）则属于幻读。

## 快照读 vs 当前读：为什么“查不到却插不进”

InnoDB 中普通 `SELECT` 在 RC/RR 级别下属于**快照读（一致性非锁定读）**，不加行锁，依据 ReadView 读取历史版本；而 `SELECT ... FOR SHARE`、`SELECT ... FOR UPDATE`、`INSERT`、`UPDATE`、`DELETE` 属于**当前读（锁定读）**，读取最新已提交版本并加锁。

**快照读看到的是历史切面，唯一索引冲突检查看的是当前最新状态，这两套机制并不读取同一份时点数据。**

因此会出现开头提到的经典现象：事务 A 在 RR 级别下先普通 `SELECT * FROM account WHERE id = 3` 没查到记录并建立快照；此时事务 B 插入 `id = 3` 并提交；A 再次普通 `SELECT` 仍复用旧快照查不到 `id = 3`，但一旦执行 `INSERT INTO account VALUES (3, ...)`，由于写入前必须做当前读校验唯一键，立刻就会报主键重复错误。要从根本上防住“查无此人再插入”的并发竞态，必须使用唯一索引兜底或通过锁定读配合临键锁拦截区间插入（见[InnoDB 锁机制详解](/posts/mysql-innodb-locks)）。

## 行记录隐藏字段、Undo 版本链与 ReadView 算法

InnoDB 聚簇索引每条记录末尾都带着隐藏管理列（普通 `SELECT *` 不可见）：

| 隐藏字段 | 作用说明 |
| :--- | :--- |
| `DB_TRX_ID` | 最近一次插入或修改该记录的事务 ID（6 字节） |
| `DB_ROLL_PTR` | 指向该记录上一历史版本的 Undo Log 回滚指针（7 字节） |
| `DB_ROW_ID` | 表既无主键又无非空唯一索引时自动生成的隐藏行 ID（6 字节） |

每次更新记录，旧值都会被写入 Undo Log，并由新记录的 `DB_ROLL_PTR` 串成一条从新到旧的版本链。例如 `id = 30` 的记录依次经历了事务 1 插入、事务 2 改年龄为 3、事务 3 改姓名为 A3、事务 4 改年龄为 10 后，逻辑版本链如下：

```text
最新行: trx=4, age=10, name=A3
   |  (DB_ROLL_PTR)
   v
旧版本: trx=3, age=3,  name=A3
   |
   v
旧版本: trx=2, age=3,  name=A30
   |
   v
初始版: trx=1, age=30, name=A30
```

ReadView 就是快照读时刻保存的一份轻量级“可见性标尺”，由四个核心字段构成：

- **`creator_trx_id`**：生成当前 ReadView 的事务 ID。
- **`m_ids`**：生成视图瞬间，系统里所有**尚未提交的活跃读写事务 ID 集合**。
- **`min_trx_id`**：`m_ids` 中的最小事务 ID（活跃下界）。
- **`max_trx_id`**：生成视图时系统应该分配给**下一个**新事务的 ID（高水位边界，不是当前活跃最大 ID 加 1）。

顺着版本链从最新节点往回找时，对每个版本的 `trx_id` 严格按以下四步裁决是否可见：

1. `trx_id == creator_trx_id`：当前事务自己改的，**可见**。
2. `trx_id < min_trx_id`：该事务在创建视图前早就提交了，**可见**。
3. `trx_id >= max_trx_id`：该事务在创建视图之后才开启，**不可见**（注意包含等于号）。
4. `min_trx_id <= trx_id < max_trx_id`：检查 `trx_id` 是否在 `m_ids` 中——**在列表里说明当时还未提交，不可见；不在列表里说明创建视图前已提交，可见**。

若当前版本判定不可见，就顺着 `DB_ROLL_PTR` 取出上一条 Undo 版本继续按四步规则判断，直到命中第一个可见版本或追溯到链尾返回空。

## 用同一条版本链对照 RC 与 RR

事务 ID 按启动分配先后顺序递增，但提交顺序可能倒挂（编号小的事务可能晚提交），所以才需要同时记录活跃集合 `m_ids` 而不能只比大小。沿用前面的版本链，假设读者是事务 5（`creator_trx_id = 5`），在第一次读取瞬间：事务 2 已提交，事务 3 已写入但未提交，事务 4 已开启但尚未修改该行（正等待写锁或未执行更新）。此时视图参数为：`m_ids = {3, 4}`、`min_trx_id = 3`、`max_trx_id = 6`。

| 时间点 | 写事务状态与版本链头部 | RC 结果 | RR 结果 |
| :--- | :--- | :--- | :--- |
| 第一次普通 `SELECT` | `3 -> 2 -> 1`（`3` 在 `{3,4}` 中不可见，`2 < 3` 可见） | 返回 `trx=2`（`age=3, name=A30`） | 返回 `trx=2`（`age=3, name=A30`） |
| 两次读取之间 | 事务 3 提交；事务 4 获得行锁改为 `age=10` 但未提交，链变为 `4 -> 3 -> 2 -> 1` | 尚未发起新读 | 复用首次建立的旧视图 |
| 第二次普通 `SELECT` | `4 -> 3 -> 2 -> 1` | **重建新视图** `m_ids={4}, min=4, max=6`：跳过 `4`，`3 < 4` 可见，返回 `trx=3`（`age=3, name=A3`） | **沿用旧视图** `m_ids={3,4}, min=3`：跳过 `4`，`3` 仍在旧 `m_ids` 中继续跳过，最终返回 `trx=2`（`age=3, name=A30`） |

**RR 的可重复读机制是复用首次一致性读创建的 ReadView 边界重新遍历版本链，它从不把第一次查询结果直接缓存在内存里。**

这也直接解释了为什么生产环境严禁挂着长事务不提交：只要一个开启了 RR 一致性读的事务迟迟不结束，它手里攥着的旧 ReadView 就可能随时需要追溯历史版本，后台 Purge 线程便不敢清理比它更早的 Undo Log，最终导致 Undo 表空间持续膨胀、行版本链过长拖垮所有查询。记住在 RR 下 ReadView 创建于事务内的**第一次普通 `SELECT`**（而非 `START TRANSACTION` 瞬间；若需要立即锁定快照，应使用 `START TRANSACTION WITH CONSISTENT SNAPSHOT`），业务查完读完尽早提交或回滚，才能把锁与历史版本释放干净。
