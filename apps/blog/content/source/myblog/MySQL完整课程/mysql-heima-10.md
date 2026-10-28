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

张三转给李四 1000，扣款和入账要一起成功。扣款已经提交了、入账却因为出错没执行，总额就少了 1000。事务把一组操作放在一起提交：做完 COMMIT，失败 ROLLBACK。

## 自动提交为什么不能保护多条业务操作

准备两个实验账户：

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

一般返回 1。没有显式事务时，每条成功的 DML 各自提交。所以先扣款、再入账，是两次独立的提交，第二条失败撤销不了第一条。

显式事务的基本结构，示例固定用这两个已知账户：

```sql
START TRANSACTION;
SELECT id,balance FROM account WHERE id IN (1,2) ORDER BY id FOR UPDATE;
UPDATE account SET balance=balance-1000 WHERE id=1 AND balance>=1000;
SELECT ROW_COUNT() AS debit_rows;
UPDATE account SET balance=balance+1000 WHERE id=2;
SELECT ROW_COUNT() AS credit_rows;
COMMIT;
```

`FOR UPDATE` 在事务里读取并锁住要修改的记录，锁的细节放到进阶部分。两个 UPDATE 都应该影响 1 行，结果张三 1000、李四 3000，总额还是 4000。`balance=balance-1000` 让数据库基于当前值计算，避免把应用之前读到的旧余额直接写回去。

上面的演示已知余额够、两个账户都在。应用里要检查查询结果和影响行数：账户不存在、扣款影响 0 行、任何一条语句失败，都要走 ROLLBACK，不能接着入账再提交。在 SQL 编辑器里把整段选中运行，不会替你做这些业务判断。

事务能把两笔修改一起撤销，但它不知道“扣款影响 0 行就是转账失败”。比如余额只有 500，扣款语句里的 `balance>=1000` 为假，UPDATE 正常执行、报告影响 0 行；程序要是只看“有没有 SQL 异常”，接着给李四加 1000，一笔错误的业务就被成功提交了。

所以真实的调用流程要同时检查数据库错误和业务条件，逻辑写出来是这样：

```text
使用同一个连接开始事务
  → 锁定并确认两个账户都存在
  → 执行带余额条件的扣款
  → 检查影响行数，必须为 1；否则回滚并结束
  → 执行入账，检查影响行数也为 1
  → 提交
任意阶段发生异常：回滚；不要接着执行后续入账
```

“同一个连接”这一点也不能少。事务状态属于会话：在连接 A 上 START TRANSACTION，第二条 UPDATE 却交给连接 B 的自动提交会话，它们就没法一起回滚。连接池可以提供连接，但一个事务进行期间不能随便换连接。

## 回滚撤销的是尚未提交的修改

正常转账后，单独执行这组操作：

```sql
START TRANSACTION;
UPDATE account SET balance=balance-500 WHERE id=1;
SELECT balance FROM account WHERE id=1; -- 当前连接能看到临时余额 500
ROLLBACK;
SELECT balance FROM account WHERE id=1; -- 回到 1000
```

未提交时数据库内部其实已经有变化：当前事务已经做了修改，只是还没成功提交，其他连接能看到什么由隔离规则决定。回滚靠数据库维护的信息把这些修改撤销。

语句出错也不一定自动回滚整个事务：

- 重复键这类错误，一般只回滚当前语句
- 死锁可能回滚整个事务
- 锁等待超时的默认处理又不一样

应用要根据异常结束事务，按业务重试完整的操作，别忽略异常继续 COMMIT。[InnoDB 错误处理](https://dev.mysql.com/doc/refman/8.0/en/innodb-error-handling.html)。

另一种方式是 `SET autocommit=0`，之后每个事务都用 COMMIT/ROLLBACK 结束。连接池要是没恢复会话状态，后面的请求可能继承这个设置；学习阶段显式写 START TRANSACTION，事务从哪开始到哪结束看得更清楚。DDL 经常隐式提交，别把 DROP、TRUNCATE 混进转账事务还指望整体回滚。

还要分清“读出值在应用里算”和“让数据库基于当前值算”。两个请求都先读到余额 2000，各自算出扣 100 后是 1900，再先后执行 `SET balance=1900`，最后只少了 100。第二次写入覆盖了第一次之后的状态，这是丢失更新的一种典型表现。

`SET balance=balance-100` 把读、改、写交给数据库的更新操作处理，有行锁协调，第二次会基于第一次更新后的值继续扣款。但它管不了“另一个账户有没有入账成功”，所以原子更新表达式和包住两边操作的事务要一起用。

## ACID 要对应到具体保证

| 特性 | 在转账中的含义 |
| --- | --- |
| 原子性 Atomicity | 扣款和入账作为一个整体提交或撤销 |
| 一致性 Consistency | 正确事务使数据满足约束与业务规则，例如总额不凭空变化 |
| 隔离性 Isolation | 并发事务的可见性和冲突受隔离规则约束 |
| 持久性 Durability | 成功提交后，按存储与日志保证保留结果，崩溃恢复不能随意丢失已确认提交 |

一致性不靠数据库自动帮你证明业务正确：给两边都加钱也能写成合法的事务，但违反了转账规则。持久性也不是说每次 COMMIT 都已经把所有改过的数据页立刻刷盘；InnoDB 靠 redo 等机制，具体实现和配置的适用范围后面再讲。

## 四种隔离级别改变读到什么

```sql
SELECT @@session.transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

在开启新的实验事务之前设置隔离级别。SESSION 影响当前会话之后的事务；GLOBAL 改的是新会话的默认值，不会让所有现有连接立刻切换。

| 隔离级别 | 普通查询的主要特征 |
| --- | --- |
| READ UNCOMMITTED | 可能读到其他事务未提交的修改，出现脏读 |
| READ COMMITTED | 每次一致性读取得新的已提交快照，同一事务两次查询可能不同 |
| REPEATABLE READ | InnoDB 默认；同一事务通常复用首次一致性读建立的快照 |
| SERIALIZABLE | 对读取增加更强约束，冲突操作可能等待，以保证可串行化语义 |

- 脏读：读到了未提交的数据
- 不可重复读：同一事务再读同一条记录，看到了别的事务已提交的变化
- 幻读：同一条件匹配到的行集合变了

这些跟密码、权限那种“安全等级”无关。性能受冲突、访问模式和实现影响，别把四个级别机械地排成一个任何场景都成立的速度榜。

## 用两个独立连接演示 RC 与 RR

开两个 mysql 客户端 A、B，都执行 `USE mysql_notes`。先确认上一轮事务已经结束，再用其中一个连接重置实验数据：

```sql
UPDATE account SET balance=2000 WHERE id IN (1,2);
```

按表格顺序执行，每一步只在指定的连接里操作：

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

步骤 5 说明 RC 没有脏读，步骤 7 说明 RC 允许不可重复读。重置余额，把 A 的隔离级别改成 REPEATABLE READ 再来一遍：A 在步骤 7 还是看到 2000，A 提交后再查才看到 1500。改成 READ UNCOMMITTED 的话，B 还没提交 A 就可能看到 1500，这就是脏读。

注意两个窗口得真的是两个连接。两个编辑器标签可能共用一个连接，不能光看窗口数就认为并发实验成立。

不可重复读和幻读的区别，看“重新读的是什么”：

- 第一次按 id=1 读到余额 2000，第二次同一个 id 变成 1500：看的是同一条记录的内容
- 第一次查余额至少 1800 的账户有两人，别的事务插入了符合条件的新账户，第二次条件查询多出一行：看的是集合成员

READ UNCOMMITTED 的问题出现得更早：B 把余额临时改成 1500，还没提交 A 就读到了，之后 B 回滚到 2000，A 之前读到的 1500 从来没有成为提交成功的业务状态。这种中间值不能拿来做转账、库存或统计的依据。

隔离级别定的是读写并发的规则，业务需要什么保证还得自己选。能显示稍旧统计的页面，和必须先判断剩余余额再扣款的操作，要求不一样。要判断当前状态再写入的流程，得结合锁定、原子条件和约束来设计，别以为普通快照 SELECT 就把这份数据预订了。

## 为什么快照查不到，插入却说主键重复

干净的实验表里还没有 id 3：

1. A 用 RR 开始事务，执行 `SELECT * FROM account WHERE id=3`，结果为空
2. B 插入 `(3,'王五',2000)` 并提交
3. A 再用同样的普通 SELECT，仍可能看不到 id 3，因为复用的是旧快照
4. 但 A 这时插入 id 3，会违反当前的唯一键约束

快照能看到什么，和写入时的约束检查是两回事。但也不能就此认为“InnoDB RR 的所有查询都会发生幻读”：RR 的一致性读有快照保护，锁定范围读则可能用间隙锁或临键锁阻止范围内的插入。快照读和当前读混着用时，要分别弄清它们看到的数据。[一致性读](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html)、[隔离级别实现](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)。

业务要求“查过不存在之后，事务结束前不许别人插入”，就要设计合适的锁定读、索引和事务流程，或者靠唯一约束处理竞争，光靠先 SELECT 再 INSERT 不行。SERIALIZABLE 能让冲突的插入等待，但整个数据库并不是一次只能跑一个事务，互不冲突的操作照样可能并发。

实验完用 COMMIT 或 ROLLBACK 结束事务，再恢复会话的隔离级别：

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-09) · [下一篇](/posts/mysql-heima-11)
