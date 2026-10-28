---
title: "SQL 进阶：数据更新、空值处理与视图"
date: 2026-03-16 17:37:26
slug: sql-advanced-updates-views
tags:
  - "SQL"
  - "INSERT"
  - "UPDATE"
  - "DELETE"
  - "视图"
categories:
  - "数据库"
  - "SQL"
---


这一章讲三件事：怎么安全地插入、修改和删除表里的数据，SQL 怎么表示和判断空值，怎么用视图封装查询的边界。三部分都建立在完整性约束上，语句能不能执行，除了看语法，还要看数据满不满足表和视图的规则。

## 一、数据更新

数据更新分插入、修改、删除三类。三类操作都会改动持久化的数据，所以先确定影响范围，再核对数据类型和完整性约束。

### 1. 插入数据（INSERT）

`INSERT` 既能插入一组明确的值，也能把查询结果写进目标表。
```sql
INSERT INTO <表名> (列1,列2,...,列n)
VALUES (值1,值2,...,值n);
-- 插入子查询结果
INSERT INTO <表名> (列1,列2,...,列n)
<子查询>;
```
`VALUES` 子句里值的个数和数据类型，必须和 `INTO` 后面的列名一一对上。省掉列名的话，数据库会按表里所有列的定义顺序插入，表结构一变就容易出错，所以显式写上列名一般更稳。

下面往 student 表里插入一名 2025 级的新生：
```sql
INSERT INTO student (SNO, Sname, Sbirthday, Smajor)
VALUES ('20250001', '二五新生', '2007-09-01', 'CS');
```

列名和值按位置对应。日期和专业代码也要符合目标列的数据类型和约束。

数据来自查询的话，可以先建一张接收结果的表，再把查询结果直接插进去。下面按专业算年龄，写进 S_major_age：
```sql
-- 第一步：新建表
CREATE TABLE S_major_age (
    Smajor CHAR(20),
    avg_age INT
);
-- 第二步：插入子查询结果
INSERT INTO S_major_age (Smajor, avg_age)
SELECT Smajor, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM Sbirthday)
FROM student
GROUP BY Smajor;
```

`SELECT` 返回的列数和类型必须和 S_major_age 的目标列兼容。这里按 `Smajor` 分组，每个专业一行结果。

### 2. 修改数据（UPDATE）
`UPDATE` 用 `SET` 指定新值，用 `WHERE` 限定要改的行。
```sql
UPDATE <表名>
SET 列1=表达式1, 列2=表达式2,..., 列n=表达式n
[WHERE <条件>];
```
执行前检查这几条：
- `WHERE`子句限定修改范围，省略则修改表中所有元组；
- 支持带子查询的条件，表达式可直接使用列名做运算（如`XF=XF-5`）；
- 执行时会检查实体完整性、用户定义完整性（如成绩范围0~100，超出则报错）。

下面只改学号 20250001 的学生：
```sql
UPDATE student
SET Sbirthday = '2007-05-02'
WHERE SNO = '20250001';
```

`WHERE` 命中一行时，只更新这一行的 Sbirthday。

表达式可以引用原来的列值。下面把 202502 学期、课程号 10086 的学分减 5：
```sql
UPDATE course
SET XF = XF - 5
WHERE semester = '202502' AND CNO = '10086';
```

这条语句会更新所有同时满足两个条件的行。执行前先确认命中的范围，再检查结果是不是还满足学分的约束。

修改的条件也可以来自子查询。下面先找出计算机专业的学生，再把对应的成绩置 0：
```sql
UPDATE course
SET grade = 0
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'CS');
```

子查询返回学生学号的集合，外层 `UPDATE` 只更新集合里的记录。

### 3. 删除数据（DELETE）
`DELETE` 删的是满足条件的行，表结构本身不会被删掉。
```sql
DELETE FROM <表名>
[WHERE <条件>];
```
删除时特别确认两点：
- `WHERE`子句限定删除范围，省略则删除表中所有元组（表定义保留，仅清空数据）；
- 支持带子查询的条件，删除后数据不可恢复，需谨慎操作。

下面删除学号 20250001 的学生记录：
```sql
DELETE FROM student
WHERE SNO = '20250001';
```

这个学生要是还被别的表通过外键引用着，数据库可能会因为参照完整性约束拒绝删除。

省掉 `WHERE` 会删掉表里的所有元组。下面清空 SC 表：
```sql
DELETE FROM SC;
```

SC 的表定义还在，只是数据清空了。

下面通过子查询删除智科专业学生的选课记录：
```sql
DELETE FROM SC
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'IS');
```

子查询确定学生的范围，外层语句只删这些学生在 SC 里的记录。

## 二、空值处理
### 1. 空值的定义
空值（`NULL`）表示未知、不存在或没有意义，不是 0，也不是空字符串。比如还没考试的课程成绩可以是 `NULL`，因为这时候还没有能填的数。

### 2. 空值的判断
SQL 用 `IS NULL` 判断为空，用 `IS NOT NULL` 判断非空，不能用 `=` 或 `!=` 判断空值。下面查姓名或性别漏填了的学生：
```sql
-- 查找student表中姓名或性别漏填的学生
SELECT * FROM student
WHERE Sname IS NULL OR Ssex IS NULL;
```

两个条件用 `OR` 连起来，任何一列为空都会返回这一行。主键（比如 SNO）隐含了 `NOT NULL` 约束，不可能为空，不用另外判断。

### 3. 空值的约束规则
1. 定义基本表时，用`NOT NULL`指定的属性不可取空值；
2. 主键属性强制非空，且主键同时隐含`UNIQUE`（唯一）约束；
3. 无`NOT NULL`约束的属性，默认可取空值。

## 三、视图（View）
### 1. 视图的基本概念
视图是从基本表或者别的视图导出来的虚表。数据库存的是视图的定义，也就是查询语句，不是一份独立的数据副本。基本表变了以后，再查视图，得到的是按当前数据算出来的结果。

### 2. 视图的创建（CREATE VIEW）
创建视图时，用一个子查询定义它包含哪些行和列。
```sql
CREATE VIEW <视图名> (列1,列2,...,列n)
AS <子查询>
[WITH CHECK OPTION];
```
创建时注意这几条：
- 若子查询的列是表达式/聚合函数，需为其指定别名；
- `WITH CHECK OPTION`：对视图执行增/删/改时，强制保证操作结果符合子查询的条件，否则拒绝执行；
- 视图可基于单个基本表、多个基本表、已有视图创建。

#### 常见创建方式
##### （1）基于单个基本表的视图（行列子集视图）
下面建一个软件工程专业（SE）的学生视图，并要求通过视图更新以后还满足 SE 专业的条件：
```sql
CREATE VIEW View_SE
AS SELECT * FROM student
WHERE Smajor = 'SE'
WITH CHECK OPTION;
```

`WITH CHECK OPTION` 会检查通过视图执行的更新，新数据不再满足 `Smajor = 'SE'` 的话，操作会被拒绝。只去掉了基本表的部分行或列、并保留了主键的视图，叫行列子集视图。

##### （2）基于多个基本表的视图
视图也能封装多表连接。下面组合 student 和 SC，返回软件工程专业学生选修 999 号课程的学号、姓名和成绩：
```sql
CREATE VIEW View_SE_999 (SNO, Sname, grade)
AS SELECT s.SNO, s.Sname, sc.grade
FROM student s, SC sc
WHERE s.Smajor = 'SE' AND s.SNO = sc.SNO AND sc.CNO = '999';
```

连接条件 `s.SNO = sc.SNO` 把学生和选课记录对应起来，另外两个条件筛选专业和课程。

##### （3）基于已有视图的视图
视图可以接着当查询的来源。下面在 View_SE_999 上筛出成绩不低于 90 的学生：
```sql
CREATE VIEW View_SE_999_90
AS SELECT * FROM View_SE_999
WHERE grade >= 90;
```

新视图依赖 View_SE_999；删上游视图时要考虑这层依赖。

##### （4）含表达式的视图
视图的列也可以来自表达式。下面通过出生日期算年龄：
```sql
CREATE VIEW View_Stu_Age (SNO, Sname, Sdept, Sage)
AS SELECT SNO, Sname, Sdept, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM Sbirthday)
FROM student;
```

表达式的结果通过视图列名 Sage 暴露出来。不同数据库对日期函数的支持可能不一样，实际用的时候按自己的数据库调整。

### 3. 视图的删除（DROP VIEW）
删除视图用 `DROP VIEW`，要连依赖它的视图一起删的话加上 `CASCADE`。
```sql
DROP VIEW <视图名> [CASCADE];
```
删除规则：
- `CASCADE`：级联删除，若该视图上导出了其他视图，会同时删除所有衍生视图；
- 省略`CASCADE`时，若视图有衍生视图，执行删除会报错；
- 删除视图仅删除视图定义，不影响原基本表数据。

下面级联删除 View_SE 和它的衍生视图：
```sql
DROP VIEW View_SE CASCADE;
```

这条语句只删视图的定义和依赖它的视图，不会删原来基本表里的数据。

### 4. 视图的查询（SELECT）
视图的查询语法和基本表一样。数据库通过视图消解，把查询转成对基本表的等价操作。下面查 View_SE 里的所有女生：
```sql
-- 查询View_SE视图中所有女生信息
SELECT * FROM View_SE
WHERE Ssex = '女';
```

调用方按普通表的方式写 `SELECT`，原来的筛选和连接逻辑由视图定义补上。

### 5. 视图的更新（增/删/改）
视图的更新语法和基本表一样，最后会转成对原基本表的更新，但有限制：
1. 带`WITH CHECK OPTION`的视图，更新结果必须符合视图定义条件；
2. 含聚合函数、分组、表达式、DISTINCT的视图，不可更新；
3. 多表联合创建的视图，更新通常仅能影响一个基本表。

下面通过 View_IS 修改学号 2018005 的学生姓名：
```sql
UPDATE View_IS
SET Sname = '刘星奇'
WHERE SNO = '2018005';
```

数据库最后更新的是对应的基本表。能不能执行，还要看视图可不可更新，以及结果满不满足视图的条件和基本表的约束。

### 6. 为什么使用视图
1. 简化用户操作：将复杂的多表连接/嵌套查询封装为视图，用户直接查询视图即可，无需重复编写复杂语句；
2. 多角度看待数据：同一基本表可创建不同视图，满足不同用户（学生、老师、管理员）的数据分析需求；
3. 提供逻辑独立性：若基本表的结构发生修改，只需调整视图定义，无需修改用户的查询语句，降低耦合；
4. 数据安全保护：仅将用户需要的列/行封装为视图，隐藏基本表中的机密数据（如学生的身份证号、手机号）；
5. 清晰表达查询需求：视图可将临时的查询结果固化为逻辑表，便于后续反复查询和二次分析。
