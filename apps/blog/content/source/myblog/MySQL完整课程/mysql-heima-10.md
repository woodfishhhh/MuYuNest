---
title: "MySQL（10）：事务与隔离级别"
date: 2026-10-17 00:00:00
slug: mysql-heima-10
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

张三转给李四 1000，需要扣款和入账一起成功。如果扣款已经提交，入账却因错误没有执行，总额就少了 1000。事务把一组操作放在同一个提交边界内：完成后 COMMIT，失败时 ROLLBACK。

## 自动提交为什么不能保护多条业务操作

准备两条独立的实验账户数据：

```sql
USE mysql_notes;
CREATE TABLE account (
  id INT PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  balance DECIMAL(12,2) NOT NULL,
  CHECK (balance>=0)
) ENGINE=InnoDB;
INSERT INTO account VALUES (1,'张三',2000),(2,'李四',2000);
SELECT @@autocommit;
```

通常返回 1。没有显式事务时，每条成功的 DML 独立提交。因此先执行一条扣款，再执行一条入账，是两个独立提交的操作；第二条失败不能自动撤销第一条。

显式事务的基本结构如下，示例固定在这两个已知账户上：

```sql
START TRANSACTION;
SELECT id,balance FROM account WHERE id IN (1,2) ORDER BY id FOR UPDATE;
UPDATE account SET balance=balance-1000 WHERE id=1 AND balance>=1000;
SELECT ROW_COUNT() AS debit_rows;
UPDATE account SET balance=balance+1000 WHERE id=2;
SELECT ROW_COUNT() AS credit_rows;
COMMIT;
```

`FOR UPDATE` 在事务内读取并锁定需要修改的记录，锁的细节在进阶部分解释。两个 UPDATE 都应影响 1 行，结果为张三 1000、李四 3000，总额仍是 4000。`balance=balance-1000` 让数据库基于当前值做运算，避免把应用事先读到的旧余额直接写回。

上面的固定演示已知余额足够、两个账户存在。应用实现必须检查查询结果和影响行数：账户不存在、扣款影响 0 行、任意语句失败，都应进入 ROLLBACK 分支，不能继续入账后提交。SQL 编辑器中把一整段选中运行，不会自动替你完成这些业务判断。

事务保证可以把两笔修改一起撤销，但它不会自动理解“扣款零行代表转账失败”。例如余额只有 500 时，扣款语句里的 `balance>=1000` 为假，UPDATE 可以正常执行并报告影响 0 行；如果程序只检查“有没有 SQL 异常”，随后仍给李四加 1000，就会把一笔错误业务成功提交。

因此真实调用流程需要同时检查数据库错误和业务条件，逻辑可以明确写成：

```text
使用同一个连接开始事务
  → 锁定并确认两个账户都存在
  → 执行带余额条件的扣款
  → 检查影响行数，必须为 1；否则回滚并结束
  → 执行入账，检查影响行数也为 1
  → 提交
任意阶段发生异常：回滚；不要接着执行后续入账
```

“同一个连接”也不能省略。事务状态属于会话，在连接 A 上 START TRANSACTION，却把第二条 UPDATE 交给连接 B 的自动提交会话，并不能让它们共同回滚。连接池可以提供连接，但本次事务使用期间不能任意换连接。

## 回滚撤销的是尚未提交的修改

正常转账后，单独执行这组操作：

```sql
START TRANSACTION;
UPDATE account SET balance=balance-500 WHERE id=1;
SELECT balance FROM account WHERE id=1; -- 当前连接能看到临时余额 500
ROLLBACK;
SELECT balance FROM account WHERE id=1; -- 回到 1000
```

未提交不等于“数据库内部完全没有变化”。当前事务已经产生了自己的修改，只是还没有成功提交，其他连接能看到什么由隔离规则决定。回滚通过数据库维护的信息撤销这些修改。

语句出错也不总是自动回滚整个事务。重复键等错误通常回滚当前语句，死锁可能回滚整个事务，锁等待超时的默认处理又不同。应用应根据异常结束事务，并按业务重试完整操作，而不是忽略异常后继续 COMMIT。[InnoDB 错误处理](https://dev.mysql.com/doc/refman/8.0/en/innodb-error-handling.html)。

另一种控制方式是 `SET autocommit=0`，以后持续使用 COMMIT/ROLLBACK 结束每个事务。连接池中如果没有恢复会话状态，后续请求可能继承它；学习阶段显式 START TRANSACTION 更容易看清边界。DDL 经常隐式提交，不能把 DROP、TRUNCATE 混进转账事务后期待整体回滚。

还需要区分“读到一个值后在应用里计算”与“让数据库基于当前值计算”。两个请求若都先读到余额 2000，各算出扣 100 后的 1900，再依次执行 `SET balance=1900`，最终只少了 100。第二次写入覆盖了第一次之后的状态，这叫丢失更新的一种典型表现。

`SET balance=balance-100` 把读改写交给数据库的更新操作处理，在相应行锁协调下，第二次可以基于第一次更新后的值继续扣款。但它仍没有解决“另一个账户是否也成功入账”，所以原子更新表达式与包含两边操作的事务要一起使用。

## ACID 要对应到具体保证

| 特性 | 在转账中的含义 |
| --- | --- |
| 原子性 Atomicity | 扣款和入账作为一个整体提交或撤销 |
| 一致性 Consistency | 正确事务使数据满足约束与业务规则，例如总额不凭空变化 |
| 隔离性 Isolation | 并发事务的可见性和冲突受隔离规则约束 |
| 持久性 Durability | 成功提交后，按存储与日志保证保留结果，崩溃恢复不能随意丢失已确认提交 |

一致性不是数据库自动替你证明业务正确。给两边都加钱也能写成合法事务，却违反转账规则。持久性也不等于每次 COMMIT 已把所有修改的数据页立即刷盘；InnoDB 借助 redo 等机制，后面会解释其实现和配置边界。

## 四种隔离级别改变读到什么

```sql
SELECT @@session.transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

在开启新的实验事务前设置隔离级别。SESSION 影响当前会话后续事务；GLOBAL 改的是新会话的默认值，不会把所有现有连接瞬间切换。

| 隔离级别 | 普通查询的主要特征 |
| --- | --- |
| READ UNCOMMITTED | 可能读到其他事务未提交的修改，出现脏读 |
| READ COMMITTED | 每次一致性读取得新的已提交快照，同一事务两次查询可能不同 |
| REPEATABLE READ | InnoDB 默认；同一事务通常复用首次一致性读建立的快照 |
| SERIALIZABLE | 对读取增加更强约束，冲突操作可能等待，以保证可串行化语义 |

脏读是读到了未提交数据；不可重复读是同一事务再次读同一记录，看到别的事务已提交的变化；幻读关注同一条件所匹配的行集合变化。它们不是密码或权限层面的“安全等级”。性能受冲突、访问模式和实现影响，不应把四级机械排列成任何场景都成立的速度榜单。

## 用两个独立连接演示 RC 与 RR

打开两个 mysql 客户端 A、B，都执行 `USE mysql_notes`。先保证上一轮事务已结束，然后由一个连接重置实验数据：

```sql
UPDATE account SET balance=2000 WHERE id IN (1,2);
```

按表格顺序执行，每一行只在指定连接操作：

| 步骤 | 连接 A | 连接 B |
| --- | --- | --- |
| 1 | `SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;` | |
| 2 | `START TRANSACTION;` | `START TRANSACTION;` |
| 3 | `SELECT balance FROM account WHERE id=1;` → 2000 | |
| 4 | | `UPDATE account SET balance=1500 WHERE id=1;` |
| 5 | 同样 SELECT → 2000 | 尚未提交 |
| 6 | | `COMMIT;` |
| 7 | 同样 SELECT → 1500 | |
| 8 | `COMMIT;` | |

步骤 5 说明 RC 不脏读，步骤 7 说明 RC 允许不可重复读。重置余额后，把 A 的隔离级别改成 REPEATABLE READ 并重新开始：A 在步骤 7 仍看到 2000；A 提交后再查才看到 1500。若改成 READ UNCOMMITTED，A 在 B 提交前就可能看到 1500，即脏读。

必须保证两个窗口确实对应两个连接。两个编辑器标签可能共用连接，不能仅凭窗口数判断并发实验是否成立。

不可重复读与幻读的区别，也可以用“重新读取的对象是什么”来判断。第一次按 id=1 读到余额 2000，第二次同一个 id 变成 1500，关注的是同一条记录的内容。第一次查询余额至少 1800 的账户有两人，其他事务插入了符合条件的新账户，第二次条件查询多出一行，关注的则是集合成员。

READ UNCOMMITTED 的问题又更早一步：B 把余额临时改成 1500，尚未提交时 A 就读到了，随后 B 回滚回 2000，A 先前读到的 1500 从未成为成功提交的业务状态。这样的中间值不能用作可靠的转账、库存或统计依据。

隔离级别给出了读写并发的规则，但没有替业务选择需要什么保证。一个允许展示稍旧统计的页面，与必须判断剩余余额再扣款的操作，要求不同。需要判断当前状态并进行写入的流程，应结合锁定、原子条件和约束设计，不能把普通快照 SELECT 当成预订了这份数据。

## 为什么快照查不到，插入却说主键重复

在干净实验表中，id 3 尚不存在。A 使用 RR 开始事务并执行 `SELECT * FROM account WHERE id=3`，结果为空。B 插入 `(3,'王五',2000)` 并提交。A 再用同样普通 SELECT，仍可能看不到 id 3，因为复用旧快照；但 A 再插入 id 3 会违反当前唯一键约束。

这说明快照可见性和写入约束检查不是一回事。不能据此总结“InnoDB RR 的所有查询都会发生幻读”。RR 的一致性读有快照保护，锁定范围读则可能使用间隙锁或临键锁防止范围内插入；混用快照读与当前读，要分别理解它们看到的数据。[一致性读](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html)、[隔离级别实现](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)。

如果业务要求“查过不存在后，在事务结束前不许其他人插入”，需要设计适当的锁定读、索引和事务流程，或依赖唯一约束处理竞争，不能只靠先 SELECT 再 INSERT。SERIALIZABLE 可以使冲突插入等待，但不代表整台数据库一次只能执行一个事务；互不冲突的操作仍可能并发。

实验后执行 COMMIT 或 ROLLBACK 结束事务，再恢复会话级别：

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-09) · [下一篇](/posts/mysql-heima-11)
