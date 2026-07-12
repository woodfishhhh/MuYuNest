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


本章解决三个问题：怎样安全地插入、修改和删除表中数据，SQL 如何表示和判断空值，以及怎样用视图封装查询边界。三部分都建立在完整性约束之上，语句能否执行不仅取决于语法，还取决于数据是否满足表和视图的规则。

## 一、数据更新

数据更新分为**插入、修改、删除**。三类操作都会改变持久化数据，因此要先确定影响范围，再核对数据类型和完整性约束。

### 1. 插入数据（INSERT）

`INSERT` 既可以插入一组明确的值，也可以把查询结果写入目标表。
```sql
INSERT INTO <表名> (列1,列2,...,列n)
VALUES (值1,值2,...,值n);
-- 插入子查询结果
INSERT INTO <表名> (列1,列2,...,列n)
<子查询>;
```
`VALUES` 子句的**值的个数、数据类型**必须与 `INTO` 后的列名一一匹配。若省略列名，数据库会按表中所有列的定义顺序插入，表结构变化时更容易出错，因此显式写列名通常更稳妥。

下面向 student 表插入一名 2025 级新生。
```sql
INSERT INTO student (SNO, Sname, Sbirthday, Smajor)
VALUES ('20250001', '二五新生', '2007-09-01', 'CS');
```

列名与值按位置对应。日期和专业代码也要符合目标列的数据类型与约束。

如果数据来自查询，可以先创建接收结果的表，再把查询结果直接插入。下面按专业计算年龄并写入 S_major_age。
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

`SELECT` 返回的列数和类型必须与 S_major_age 的目标列兼容。这里按 `Smajor` 分组，每个专业生成一行结果。

### 2. 修改数据（UPDATE）
`UPDATE` 用 `SET` 指定新值，用 `WHERE` 限定需要修改的行。
```sql
UPDATE <表名>
SET 列1=表达式1, 列2=表达式2,..., 列n=表达式n
[WHERE <条件>];
```
执行前要检查以下规则：
- `WHERE`子句限定修改范围，**省略则修改表中所有元组**；
- 支持带子查询的条件，表达式可直接使用列名做运算（如`XF=XF-5`）；
- 执行时会检查**实体完整性、用户定义完整性**（如成绩范围0~100，超出则报错）。

下面只修改学号 20250001 的学生。
```sql
UPDATE student
SET Sbirthday = '2007-05-02'
WHERE SNO = '20250001';
```

`WHERE` 命中一行时，只更新该行的 Sbirthday。

表达式可以引用原列值。下面把 202502 学期、课程号 10086 的学分减 5。
```sql
UPDATE course
SET XF = XF - 5
WHERE semester = '202502' AND CNO = '10086';
```

这条语句会更新所有同时满足两个条件的行。执行前应先确认命中范围，并检查结果是否仍满足学分约束。

修改条件也可以来自子查询。下面先找出计算机专业学生，再把对应成绩置 0。
```sql
UPDATE course
SET grade = 0
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'CS');
```

子查询返回学生学号集合，外层 `UPDATE` 只更新集合中的记录。

### 3. 删除数据（DELETE）
`DELETE` 删除满足条件的行，表结构本身不会被删除。
```sql
DELETE FROM <表名>
[WHERE <条件>];
```
删除时要特别确认以下两点：
- `WHERE`子句限定删除范围，**省略则删除表中所有元组（表定义保留，仅清空数据）**；
- 支持带子查询的条件，删除后数据不可恢复，需谨慎操作。

下面删除学号 20250001 的学生记录。
```sql
DELETE FROM student
WHERE SNO = '20250001';
```

如果该学生仍被其他表通过外键引用，数据库可能因参照完整性约束拒绝删除。

省略 `WHERE` 会删除表中所有元组。下面清空 SC 表。
```sql
DELETE FROM SC;
```

SC 的表定义仍然保留，只是数据被清空。

下面通过子查询删除智科专业学生的选课记录。
```sql
DELETE FROM SC
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'IS');
```

子查询确定学生范围，外层语句只删除这些学生在 SC 中的记录。

## 二、空值处理
### 1. 空值的定义
空值（`NULL`）表示**未知、不存在或无意义**，并非 0 或空字符串。例如，尚未考试的课程成绩可以是 `NULL`，因为此时没有可填写的数值。

### 2. 空值的判断
SQL 使用 `IS NULL` 判断为空，使用 `IS NOT NULL` 判断非空，**不可用 `=` 或 `!=` 判断空值**。下面查找姓名或性别漏填的学生。
```sql
-- 查找student表中姓名或性别漏填的学生
SELECT * FROM student
WHERE Sname IS NULL OR Ssex IS NULL;
```

两个条件通过 `OR` 连接，任一列为空都会返回该行。主键（如 SNO）隐含 `NOT NULL` 约束，不可能为空，无需额外判断。

### 3. 空值的约束规则
1. 定义基本表时，用`NOT NULL`指定的属性**不可取空值**；
2. **主键属性强制非空**，且主键同时隐含`UNIQUE`（唯一）约束；
3. 无`NOT NULL`约束的属性，默认可取空值。

## 三、视图（View）
### 1. 视图的基本概念
视图是**从基本表或其他视图导出的虚表**。数据库保存的是视图定义，也就是查询语句，而不是一份独立数据副本。基本表变化后，再次查询视图会得到基于当前数据计算的结果。

### 2. 视图的创建（CREATE VIEW）
创建视图时，用一个子查询定义它包含哪些行和列。
```sql
CREATE VIEW <视图名> (列1,列2,...,列n)
AS <子查询>
[WITH CHECK OPTION];
```
创建时要注意以下规则：
- 若子查询的列是**表达式/聚合函数**，需为其指定别名；
- `WITH CHECK OPTION`：对视图执行增/删/改时，**强制保证操作结果符合子查询的条件**，否则拒绝执行；
- 视图可基于**单个基本表、多个基本表、已有视图**创建。

#### 常见创建方式
##### （1）基于单个基本表的视图（行列子集视图）
下面建立软件工程专业（SE）学生视图，并要求通过视图更新后仍然满足 SE 专业条件。
```sql
CREATE VIEW View_SE
AS SELECT * FROM student
WHERE Smajor = 'SE'
WITH CHECK OPTION;
```

`WITH CHECK OPTION` 会检查通过视图执行的更新。若新数据不再满足 `Smajor = 'SE'`，操作会被拒绝。仅去掉基本表部分行或列并保留主键的视图称为**行列子集视图**。

##### （2）基于多个基本表的视图
视图也可以封装多表连接。下面组合 student 和 SC，返回软件工程专业学生选修 999 号课程的学号、姓名和成绩。
```sql
CREATE VIEW View_SE_999 (SNO, Sname, grade)
AS SELECT s.SNO, s.Sname, sc.grade
FROM student s, SC sc
WHERE s.Smajor = 'SE' AND s.SNO = sc.SNO AND sc.CNO = '999';
```

连接条件 `s.SNO = sc.SNO` 把学生与选课记录对应起来，另外两个条件负责筛选专业和课程。

##### （3）基于已有视图的视图
视图可以继续作为查询来源。下面在 View_SE_999 上筛选成绩不低于 90 的学生。
```sql
CREATE VIEW View_SE_999_90
AS SELECT * FROM View_SE_999
WHERE grade >= 90;
```

新视图依赖 View_SE_999；删除上游视图时要考虑这层依赖。

##### （4）含表达式的视图
视图列也可以来自表达式。下面通过出生日期计算年龄。
```sql
CREATE VIEW View_Stu_Age (SNO, Sname, Sdept, Sage)
AS SELECT SNO, Sname, Sdept, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM Sbirthday)
FROM student;
```

表达式结果通过视图列名 Sage 对外暴露。不同数据库对日期函数的支持可能不同，实际使用时要按所用数据库调整。

### 3. 视图的删除（DROP VIEW）
删除视图使用 `DROP VIEW`，需要连同依赖视图一起删除时加上 `CASCADE`。
```sql
DROP VIEW <视图名> [CASCADE];
```
删除时遵循以下规则：
- `CASCADE`：**级联删除**，若该视图上导出了其他视图，会同时删除所有衍生视图；
- 省略`CASCADE`时，若视图有衍生视图，执行删除会**报错**；
- 删除视图仅删除视图定义，**不影响原基本表数据**。

下面级联删除 View_SE 及其衍生视图。
```sql
DROP VIEW View_SE CASCADE;
```

这条语句只删除视图定义和依赖它的视图，不会删除原基本表数据。

### 4. 视图的查询（SELECT）
视图的查询语法**与基本表一致**。数据库通过**视图消解**把查询转换为针对基本表的等价操作。下面查询 View_SE 中的所有女生。
```sql
-- 查询View_SE视图中所有女生信息
SELECT * FROM View_SE
WHERE Ssex = '女';
```

调用方按普通表的方式写 `SELECT`，视图定义负责补上原来的筛选和连接逻辑。

### 5. 视图的更新（增/删/改）
视图的更新语法与基本表一致，最终会**转化为对原基本表的更新**，但存在限制：
1. 带`WITH CHECK OPTION`的视图，更新结果必须符合视图定义条件；
2. 含**聚合函数、分组、表达式、DISTINCT**的视图，**不可更新**；
3. 多表联合创建的视图，更新通常仅能影响**一个基本表**。

下面通过 View_IS 修改学号 2018005 的学生姓名。
```sql
UPDATE View_IS
SET Sname = '刘星奇'
WHERE SNO = '2018005';
```

数据库最终更新的是对应基本表。能否执行仍取决于视图是否可更新，以及结果是否满足视图条件和基本表约束。

### 6. 为什么使用视图
1. **简化用户操作**：将复杂的多表连接/嵌套查询封装为视图，用户直接查询视图即可，无需重复编写复杂语句；
2. **多角度看待数据**：同一基本表可创建不同视图，满足不同用户（学生、老师、管理员）的数据分析需求；
3. **提供逻辑独立性**：若基本表的结构发生修改，只需调整视图定义，无需修改用户的查询语句，降低耦合；
4. **数据安全保护**：仅将用户需要的列/行封装为视图，隐藏基本表中的机密数据（如学生的身份证号、手机号）；
5. **清晰表达查询需求**：视图可将临时的查询结果固化为逻辑表，便于后续反复查询和二次分析。
