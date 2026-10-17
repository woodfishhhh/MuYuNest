---
title: "MySQL（23）：记录锁、间隙锁与临键锁"
date: 2026-10-17 00:00:00
slug: mysql-heima-23
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

锁住已经存在的 id=3，可以阻止别人改它；若 id=5 目前不存在，却要阻止别人把它插进来，就没有现成记录可锁。InnoDB 因此还需要保护索引记录之间的间隙。

以下实验采用 InnoDB、REPEATABLE READ，并按课程的键值准备独立表。每轮实验必须结束前一轮事务；否则残留锁会让现象混淆。

```sql
CREATE TABLE lock_demo (
  id INT PRIMARY KEY,
  name VARCHAR(20),
  age INT,
  KEY idx_lock_age(age)
) ENGINE=InnoDB;
INSERT INTO lock_demo VALUES
  (1,'1',1),(3,'3',3),(8,'8',8),(11,'11',11),(19,'19',19),(25,'25',25);
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

## 已存在唯一键的等值查找

连接 A 执行：

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE id=3 FOR SHARE;
```

FOR SHARE 取得共享记录锁，旧写法是 LOCK IN SHARE MODE。连接 B 在事务内执行同样的 FOR SHARE 可以兼容；B 执行 `UPDATE lock_demo SET age=30 WHERE id=3` 则需要排他记录锁，会等待 A 结束。若 B 修改 id=8，则不与 A 对 id=3 的这把记录锁冲突。

共享锁 S 与 S 兼容，S 与 X、X 与 X 冲突。FOR UPDATE 请求排他锁。这里按唯一索引的完整键等值查找已存在记录，通常只锁对应记录，不需把它前面的间隙一起锁住。

在两个客户端等待期间，可用第三个连接查看：

```sql
SELECT ENGINE_TRANSACTION_ID,OBJECT_NAME,INDEX_NAME,
       LOCK_TYPE,LOCK_MODE,LOCK_STATUS,LOCK_DATA
FROM performance_schema.data_locks
WHERE OBJECT_SCHEMA='mysql_notes' AND OBJECT_NAME='lock_demo';
SELECT * FROM performance_schema.data_lock_waits;
```

TABLE/IS 是表级意向共享锁；RECORD 和 `S,REC_NOT_GAP` 则说明记录共享锁，不含间隙。实际显示还取决于版本和访问路径，应以自己的输出为准。

锁的对象在索引上，可以画出当前主键顺序：

```text
        1       3          8       11        19        25
记录：  ●       ●          ●        ●         ●         ●
间隙：     (1,3)   (3,8)      (8,11)   (11,19)   (19,25)
```

记录锁保护这些已存在的点。共享锁允许其他共享读取者使用同一个点，但不允许另一个事务同时取得冲突的排他修改权。普通快照 SELECT 则通常从版本可见性出发读取，并不等同于再申请一把 FOR SHARE 记录锁；所以“B 的 UPDATE 被挡住”与“B 的普通 SELECT 还能读”可以同时成立。

观察时按同一个目标区分操作，比只看“读和写”两个字更准确：同一行的 FOR SHARE 与 FOR SHARE、FOR SHARE 与 UPDATE、普通 SELECT 与 UPDATE，使用的机制并不完全相同。

## 不存在的唯一键为什么能锁住一段范围

结束双方事务，恢复初始数据。连接 A 执行：

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE id=5 FOR UPDATE;
```

id 5 不存在，查询返回空；但在 RR 下，为防止其他事务在这一范围插入匹配记录，查找可以锁住相邻现有键 3 与 8 之间的间隙 `(3,8)`。它不只表示整数 5 一个点。

连接 B 尝试：

```sql
START TRANSACTION;
INSERT INTO lock_demo VALUES(7,'7',7);
```

7 也落在 `(3,8)`，因此预期等待。A 执行 ROLLBACK 后，B 才能继续；B 完成观察后也执行 ROLLBACK，保持测试数据不变。

间隙锁的目的主要是抑制插入，本身不包含端点记录。两个事务持有同一间隙上的间隙锁可能兼容，不能直接把记录 S/X 的冲突表原样套给 gap lock。

这个实验的顺序应是：A 开始事务并完成空结果的锁定查找；B 开始事务，发送插入 7；B 等待时，用第三个连接看锁与等待关系；A 回滚释放范围；B 的插入随后继续，最后由 B 回滚。只有让 A 在 B 插入之前取得相应锁，才能观察这次阻止插入的效果。

为什么查 5 会连带挡住 7？索引中目前没有 5，也没有 7，只知道它们都会被插到现有键 3 与 8 之间。间隙锁保护的是这个可插入区间，不是凭空创建一个只属于数值 5 的记录锁。它的保护粒度因此可能比 WHERE 文本里的一个常量更宽。

这个范围不包含两端已有记录，所以不能仅凭间隙锁就推断“修改 id=3 必然被这一把锁阻塞”。是否还有其他记录锁，要看整个语句的访问与加锁结果。这正是观察时需要同时核对 INDEX_NAME、LOCK_MODE 和 LOCK_DATA 的原因。

## 非唯一索引还要防止新的相等值出现

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE age=3 FOR UPDATE;
```

age 索引不是唯一索引。即使当前只有一个 age=3，别的事务仍可能插入另一个 age=3。为了稳定这次锁定查询对应的范围，InnoDB 通常需要保护匹配项及邻近间隙，并在扫描到不匹配的边界时停止或退化相应锁。

分析这里的顺序，必须记住二级索引键还携带主键：同龄记录会按主键继续区分。实际锁的上下界不能只画一条“年龄数轴”就忽略重复值和主键。应先确认 EXPLAIN 选择了 age 索引，再检查 data_locks 中的 INDEX_NAME 和 LOCK_DATA。

临键锁 next-key lock 是记录锁与其前方间隙的组合。对相邻键 19 和 25，锁住 25 对应的临键区间通常可表达为 `(19,25]`，既保护 25，也阻止这个区间中的新记录插入。

假设同一年龄后来出现两条记录，二级索引内部可以按 `(age,id)` 区分，例如 `(3,3)` 与 `(3,30)`。查 age=3 时，两者都满足条件；为了防止第三个 age=3 在事务期间进入结果范围，锁保护还必须考虑这些键之间及相邻边界的插入位置。

唯一键等值查找已存在记录时，可以知道不会再合法插入第二个同样的唯一键；非唯一索引没有这个保证。两种查找在 SQL 文本上都可能写成 `列=3`，但唯一性改变了需要保护的范围，不能只看等号判断是否一定只有记录锁。

## 范围查询需要保护范围内的插入位置

在初始数据上执行：

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE id>=19 FOR SHARE;
```

需要保护已命中的 19、25，以及可能进入结果集的后续插入位置。对于这条查询的典型计划，会看到 19 的记录保护、25 对应的临键范围，以及最大键之后的范围。监控中出现 supremum，是索引页中用于表示上界的伪记录，不是用户插入的一行数据。

不要把这些示例外推成只看 WHERE 文本就能唯一确定所有锁。索引唯一性、查找是否命中、隔离级别、优化器访问路径和版本都会影响结果。READ COMMITTED 通常不对普通搜索范围采用与 RR 相同的间隙锁，但外键检查、重复键检查等仍有例外。

如果查询没有适合的索引，UPDATE 可能扫描并锁定大量记录。此时其他更新被阻塞，要结合扫描路径解释，不能称为自动“行锁升级表锁”。用索引缩小扫描范围，再配合较短事务，才是在这里减少冲突的直接办法。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-22) · [下一篇](/posts/mysql-heima-24)
