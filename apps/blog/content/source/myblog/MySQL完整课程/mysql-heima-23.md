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

锁住已经存在的 id=3，能挡住别人改它；但要是想挡住别人插入一个现在还不存在的 id=5，就没有现成的记录可锁。所以 InnoDB 还要锁索引记录之间的间隙。

下面的实验都是 InnoDB、REPEATABLE READ，按课程的键值单独建一张表。每轮实验前一定要先结束上一轮的事务，不然残留的锁会把现象搅混。

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

FOR SHARE 拿共享记录锁，旧写法是 LOCK IN SHARE MODE。连接 B 在事务里执行同样的 FOR SHARE 不冲突；B 执行 `UPDATE lock_demo SET age=30 WHERE id=3` 要拿排他记录锁，就得等 A 结束。B 改 id=8 的话，和 A 在 id=3 上的锁不冲突。

S 和 S 兼容，S 和 X、X 和 X 冲突。FOR UPDATE 申请的是排他锁。这里是按唯一索引的完整键等值查一条已存在的记录，一般只锁这条记录，不用连它前面的间隙一起锁。

两个客户端在等的时候，可以开第三个连接看：

```sql
SELECT ENGINE_TRANSACTION_ID,OBJECT_NAME,INDEX_NAME,
       LOCK_TYPE,LOCK_MODE,LOCK_STATUS,LOCK_DATA
FROM performance_schema.data_locks
WHERE OBJECT_SCHEMA='mysql_notes' AND OBJECT_NAME='lock_demo';
SELECT * FROM performance_schema.data_lock_waits;
```

TABLE/IS 是表级意向共享锁；RECORD 加 `S,REC_NOT_GAP` 表示记录共享锁，不含间隙。具体显示和版本、访问路径有关，以自己的输出为准。

锁是加在索引上的，可以先画出当前的主键顺序：

```text
        1       3          8       11        19        25
记录：  ●       ●          ●        ●         ●         ●
间隙：     (1,3)   (3,8)      (8,11)   (11,19)   (19,25)
```

记录锁保护的就是这些已存在的点。共享锁允许别的共享读者一起用这个点，但不允许另一个事务同时拿冲突的排他修改权。普通快照 SELECT 一般按版本可见性去读，并不会再申请一把 FOR SHARE 记录锁，所以"B 的 UPDATE 被挡住"和"B 的普通 SELECT 还能读"可以同时成立。

观察时按同一个目标把操作分开看，比只分"读"和"写"准确：同一行的 FOR SHARE 对 FOR SHARE、FOR SHARE 对 UPDATE、普通 SELECT 对 UPDATE，用的机制都不完全一样。

## 不存在的唯一键为什么能锁住一段范围

结束双方事务，恢复初始数据。连接 A 执行：

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE id=5 FOR UPDATE;
```

id 5 不存在，查询返回空；但在 RR 下，为了防止别的事务在这个范围插入匹配的记录，查找会锁住相邻现有键 3 和 8 之间的间隙 `(3,8)`，而不只是整数 5 这一个点。

连接 B 试一下：

```sql
START TRANSACTION;
INSERT INTO lock_demo VALUES(7,'7',7);
```

7 也落在 `(3,8)` 里，所以会等。A 执行 ROLLBACK 后 B 才能继续；B 看完结果也 ROLLBACK，保持测试数据不变。

间隙锁主要是为了挡插入，本身不包括两端的记录。两个事务在同一个间隙上持有间隙锁可能是兼容的，别把记录 S/X 的冲突表原样套到 gap lock 上。

实验顺序：

1. A 开事务，执行返回空结果的锁定查找。
2. B 开事务，插入 7。
3. B 在等的时候，用第三个连接看锁和等待关系。
4. A 回滚，释放范围。
5. B 的插入继续执行，最后 B 回滚。

只有 A 在 B 插入之前拿到锁，才能看到挡住插入的效果。

为什么查 5 会连带挡住 7？索引里现在既没有 5 也没有 7，只知道它们插进来都会落在 3 和 8 之间。间隙锁保护的是这段可插入的区间，不是凭空造一把只属于 5 的记录锁。所以它的范围可能比 WHERE 里那一个常量宽。

这个范围不包括两端已有的记录，所以光凭间隙锁推不出"改 id=3 一定会被这把锁挡住"。有没有别的记录锁，要看整条语句的访问和加锁结果。这也是观察时要同时看 INDEX_NAME、LOCK_MODE、LOCK_DATA 的原因。

## 非唯一索引还要防止新的相等值出现

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE age=3 FOR UPDATE;
```

age 不是唯一索引。就算现在只有一个 age=3，别的事务照样能再插一个 age=3。为了让这次锁定查询对应的范围保持稳定，InnoDB 一般要锁住匹配项和相邻的间隙，扫描到不匹配的边界时停下或者降级相应的锁。

分析顺序时要记住：二级索引的键里还带着主键，同龄的记录会继续按主键区分。实际锁的上下界不能只画一条"年龄数轴"，忽略重复值和主键。先用 EXPLAIN 确认走了 age 索引，再看 data_locks 里的 INDEX_NAME 和 LOCK_DATA。

临键锁 next-key lock = 记录锁 + 它前面的间隙。相邻键 19 和 25，锁住 25 对应的临键区间一般写成 `(19,25]`，既保护 25，也挡住这个区间里的新插入。

假如同一个年龄后来有两条记录，二级索引内部按 `(age,id)` 区分，比如 `(3,3)` 和 `(3,30)`。查 age=3 时两条都满足；为了防止事务期间再进来第三个 age=3，锁还得考虑这些键之间、以及相邻边界上的插入位置。

唯一键等值查一条已存在的记录时，可以确定不会再合法插入第二个相同的键；非唯一索引没有这个保证。两种查询的 SQL 都可能写成 `列=3`，但唯一性决定了要保护多大的范围，不能光看等号就认定只有记录锁。

## 范围查询需要保护范围内的插入位置

在初始数据上执行：

```sql
START TRANSACTION;
SELECT * FROM lock_demo WHERE id>=19 FOR SHARE;
```

要保护已经命中的 19、25，以及之后可能进入结果集的插入位置。这条查询的典型计划下，会看到 19 的记录锁、25 对应的临键范围，以及最大键之后的范围。监控里出现的 supremum 是索引页里表示上界的伪记录，不是用户插入的数据。

别拿这些例子推出"只看 WHERE 就能确定所有锁"。索引是否唯一、查找是否命中、隔离级别、优化器的访问路径、版本都会影响结果。READ COMMITTED 一般不会对普通搜索范围加和 RR 一样的间隙锁，但外键检查、重复键检查这些还是有例外。

查询要是没有合适的索引，UPDATE 可能扫描并锁住大量记录，导致别的更新被挡住。这要从扫描路径去解释，不能叫它自动"行锁升级表锁"。用索引缩小扫描范围，再配合短事务，才是减少冲突的直接办法。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-22) · [下一篇](/posts/mysql-heima-24)
