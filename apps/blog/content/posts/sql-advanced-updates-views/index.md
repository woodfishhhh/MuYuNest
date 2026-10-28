---
title: "SQL 进阶：数据更新、空值处理与视图"
date: 2026-03-16 17:37:26
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

# SQL 进阶：数据更新、空值处理与视图

## 一、数据更新

SQL对表数据的三类基础操作：插入、修改、删除。数据类型要严格匹配，还要遵守完整性约束。

### 1. 插入数据（INSERT）

语法：

```sql
INSERT INTO <表名> (列1,列2,...,列n)
VALUES (值1,值2,...,值n);
-- 插入子查询结果
INSERT INTO <表名> (列1,列2,...,列n)
<子查询>;
```

规则：`VALUES`子句里值的个数、数据类型要和`INTO`后的列名一一对应；省略列名时，按表定义的顺序对所有列插入。

例题1-单元组插入：向student表插入2025级新生数据

```sql
INSERT INTO student (SNO, Sname, Sbirthday, Smajor)
VALUES ('20250001', '二五新生', '2007-09-01', 'CS');
```

例题2-子查询结果插入：求各专业学生平均年龄并存入新建表S_major_age

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

### 2. 修改数据（UPDATE）
语法：

```sql
UPDATE <表名>
SET 列1=表达式1, 列2=表达式2,..., 列n=表达式n
[WHERE <条件>];
```

规则：
- `WHERE`子句限定修改范围，**省略就会修改表中所有元组**
- 条件里可以带子查询，表达式可以直接用列名运算（如`XF=XF-5`）
- 执行时会检查实体完整性、用户定义完整性（如成绩范围0~100，超出就报错）

例题1-修改单个元组：将学号20250001的学生出生日期改为2007-05-02

```sql
UPDATE student
SET Sbirthday = '2007-05-02'
WHERE SNO = '20250001';
```

例题2-修改多个元组：将202502学期课程号10086的学分数减5

```sql
UPDATE course
SET XF = XF - 5
WHERE semester = '202502' AND CNO = '10086';
```

例题3-带子查询的修改：将计算机专业（CS）学生的成绩置0

```sql
UPDATE course
SET grade = 0
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'CS');
```

### 3. 删除数据（DELETE）
语法：

```sql
DELETE FROM <表名>
[WHERE <条件>];
```

规则：
- `WHERE`子句限定删除范围，**省略就删除表中所有元组**（表定义保留，只清空数据）
- 条件里可以带子查询。删了就恢复不了，操作要小心。

例题1-删除单个元组：删除学号20250001的学生记录

```sql
DELETE FROM student
WHERE SNO = '20250001';
```

例题2-删除所有元组：删除所有学生的选课记录（清空SC表）

```sql
DELETE FROM SC;
```

例题3-带子查询的删除：删除智科专业（IS）学生的选课记录

```sql
DELETE FROM SC
WHERE SNO IN (SELECT SNO FROM student WHERE Smajor = 'IS');
```

## 二、空值处理
### 1. 空值的定义
空值（`NULL`）表示未知、不存在或无意义，不是0也不是空字符串。比如没考试的课程成绩、没填写的个人信息。

### 2. 空值的判断
只能用`IS NULL`（为空）或`IS NOT NULL`（非空）判断，**不能用`=`或`!=`判断空值**。

```sql
-- 查找student表中姓名或性别漏填的学生
SELECT * FROM student
WHERE Sname IS NULL OR Ssex IS NULL;
```

注意：主键（如SNO）隐含`NOT NULL`约束，不可能为空，不用判断。

### 3. 空值的约束规则
1. 定义基本表时用`NOT NULL`指定的属性，不能取空值
2. 主键属性强制非空，同时还隐含`UNIQUE`（唯一）约束
3. 没有`NOT NULL`约束的属性，默认可以取空值

## 三、视图（View）
### 1. 视图的基本概念
视图是从基本表/其他视图导出的虚表，只存视图的定义（查询语句），不存实际数据。基本表数据变了，视图的查询结果会实时同步。

### 2. 视图的创建（CREATE VIEW）
语法：

```sql
CREATE VIEW <视图名> (列1,列2,...,列n)
AS <子查询>
[WITH CHECK OPTION];
```

规则：
- 子查询的列是表达式/聚合函数时，要给它指定别名
- `WITH CHECK OPTION`：对视图增/删/改时，操作结果必须符合子查询的条件，否则拒绝执行
- 视图可以基于单个基本表、多个基本表、已有视图创建

#### 分类&例题
##### （1）基于单个基本表的视图（行列子集视图）
建立软件工程专业（SE）学生视图，增删改时仍要保证是SE专业：

```sql
CREATE VIEW View_SE
AS SELECT * FROM student
WHERE Smajor = 'SE'
WITH CHECK OPTION;
```

行列子集视图：只去掉基本表的部分行/列、保留了主键的视图，是最基础的视图类型。

##### （2）基于多个基本表的视图
建立软件工程专业学生选修999号课程的视图（含学号、姓名、成绩）：

```sql
CREATE VIEW View_SE_999 (SNO, Sname, grade)
AS SELECT s.SNO, s.Sname, sc.grade
FROM student s, SC sc
WHERE s.Smajor = 'SE' AND s.SNO = sc.SNO AND sc.CNO = '999';
```

##### （3）基于已有视图的视图
在View_SE_999基础上，建立成绩≥90分的学生视图：

```sql
CREATE VIEW View_SE_999_90
AS SELECT * FROM View_SE_999
WHERE grade >= 90;
```

##### （4）含表达式的视图
建立学生视图（含学号、姓名、学院、年龄，年龄通过出生日期计算）：

```sql
CREATE VIEW View_Stu_Age (SNO, Sname, Sdept, Sage)
AS SELECT SNO, Sname, Sdept, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM Sbirthday)
FROM student;
```

### 3. 视图的删除（DROP VIEW）
语法：

```sql
DROP VIEW <视图名> [CASCADE];
```

规则：
- `CASCADE`：级联删除，这个视图上导出的其他视图会一起删掉
- 不加`CASCADE`时，如果视图有衍生视图，删除会报错
- 删除视图只删视图定义，不影响原基本表的数据

例题：级联删除视图View_SE（及其衍生视图）

```sql
DROP VIEW View_SE CASCADE;
```

### 4. 视图的查询（SELECT）
查视图和查基本表的语法完全一样。数据库通过视图消解，把对视图的查询转成对基本表的等价查询，用户不用管底层实现。

```sql
-- 查询View_SE视图中所有女生信息
SELECT * FROM View_SE
WHERE Ssex = '女';
```

### 5. 视图的更新（增/删/改）
更新视图的语法也和基本表一样，最终会转成对原基本表的更新。有几条限制：
1. 带`WITH CHECK OPTION`的视图，更新结果必须符合视图定义的条件
2. 含聚合函数、分组、表达式、DISTINCT的视图，**不能更新**
3. 多表联合创建的视图，更新通常只能影响一个基本表

例题：将信息管理专业视图View_IS中学号2018005的学生姓名改为“刘星奇”

```sql
UPDATE View_IS
SET Sname = '刘星奇'
WHERE SNO = '2018005';
```

### 6. 视图的核心作用
1. 简化操作：把复杂的多表连接/嵌套查询封装成视图，直接查视图就行，不用反复写复杂语句
2. 多角度看数据：同一个基本表可以建不同视图，满足不同用户（学生、老师、管理员）的数据分析需求
3. 逻辑独立性：基本表结构改了，只要调整视图定义，用户的查询语句不用改，耦合更低
4. 数据安全：只把用户需要的行/列放进视图，隐藏基本表里的机密数据（如学生的身份证号、手机号）
5. 清晰表达查询需求：把临时的查询结果固化成逻辑表，方便后续反复查询和二次分析
