---
title: "SQL 基础：从定义结构到组织查询"
date: 2026-03-14 15:45:49
tags:
  - "SQL"
  - "DDL"
  - "CREATE TABLE"
  - "完整性约束"
  - "模式"
categories:
  - "数据库"
  - "SQL"
---


本章解决两类问题：怎样用 DDL 建立模式、表和索引，以及怎样用 `SELECT` 逐步构造单表、连接、嵌套和集合查询。先理解 SQL 的声明式特点，再看每个子句在查询中的职责，语法就不会变成彼此孤立的模板。

## 一、SQL 为什么是声明式语言

SQL 集数据定义、查询、操纵和控制于一体。它的主要特点有：

1. 综合统一：集数据定义、查询、操纵、控制于一体
2. 高度非过程化：只需说明“查什么”，无需指定“怎么查”，由DBMS完成执行路径
3. 面向集合的操作方式：操作对象/结果均为集合（表、视图等）
4. 语法简单且组合多样：基础语法简洁，可灵活组合实现复杂需求
5. 简洁易学：关键字少，语法贴近自然语言

其中“高度非过程化”解释了 SQL 与普通过程式代码的差别：使用者描述目标结果，DBMS 负责选择访问路径和执行计划。

## 二、用 DDL 定义模式、表和索引

### 2.1 定义和删除模式

#### （1）定义模式

模式用于组织一组相关的数据库对象。创建模式时要指定所有者。
```sql
CREATE SCHEMA <模式名> AUTHORIZATION <用户名>;
```

如果省略模式名，数据库会把用户名作为隐含模式名。

- 若**省略模式名**，模式名**隐含为用户名**；
- 示例：`CREATE SCHEMA AUTHORIZATION Wang;`（为用户Wang定义模式Wang）；
- 示例2：`CREATE SCHEMA Hello AUTHORIZATION Ye;`（为用户Ye定义模式Hello）。

#### （2）删除模式

删除模式时必须说明怎样处理模式中的对象。
```sql
DROP SCHEMA <模式名> <CASCADE | RESTRICT>;
```

`CASCADE` 会连同依赖对象一起删除，`RESTRICT` 则要求模式为空。两种策略的风险不同，执行前要先确认模式内容。

- `CASCADE`：**级联删除**，删除模式的同时，删除模式下所有表、视图、索引；
- `RESTRICT`：**限制删除**，若模式下有表/视图/索引，拒绝执行删除操作（模式为空时才可删除）。

### 2.2 定义、修改和删除基本表
#### （1）定义基本表

`CREATE TABLE` 同时声明列、数据类型以及列级或表级完整性约束。
```sql
CREATE TABLE <表名>(
    <列名1> <数据类型> [列级完整性约束],
    <列名2> <数据类型> [列级完整性约束],
    ...
    [表级完整性约束]
);
```

列定义决定可以写入什么数据，约束决定哪些数据即使类型正确也不能写入。

##### 常用数据类型
| 类型       | 说明                     |
|------------|--------------------------|
| `CHAR(n)`  | 定长字符串，长度为n      |
| `VARCHAR(n)`| 变长字符串，最大长度n    |
| `INT`/`SMALLINT`/`BIGINT` | 整型（不同精度） |
| `FLOAT`/`DOUBLE` | 浮点型/双精度浮点型 |
| `DATE`     | 日期型，格式`YYYY-MM-DD` |

##### 完整性约束
| 约束         | 说明                     | 适用级别       |
|--------------|--------------------------|----------------|
| `NOT NULL`   | 非空，列值不能为NULL     | 列级           |
| `UNIQUE`     | 唯一，列值不能重复       | 列级/表级      |
| `PRIMARY KEY`| 主键，隐含`NOT NULL+UNIQUE` | 列级（单属性）/表级（多属性） |
| `FOREIGN KEY`| 外键，参照其他表的主键   | 列级/表级      |
| `CHECK`      | 自定义条件约束（本课程暂不考） | 列级/表级 |
- **列级vs表级**：仅涉及**单个属性**的约束，可定义在列级/表级；涉及**多个属性**的约束（如复合主键），**必须定义在表级**。

##### 学生表与选课表

下面用 Student 和 SC 演示单属性主键、复合主键和外键。
```sql
-- 学生表Student（单属性主键，列级约束）
CREATE TABLE Student(
    SNO CHAR(9) PRIMARY KEY,  -- 学号，主键（列级）
    SNAME VARCHAR(40) UNIQUE, -- 姓名，唯一
    SSEX CHAR(2),             -- 性别
    SBIRTHDAY DATE,           -- 出生日期
    SDEPT VARCHAR(40)         -- 专业
);

-- 选课表SC（复合主键，表级约束；外键参照）
CREATE TABLE SC(
    SNO CHAR(9),
    CNO CHAR(6),
    GRADE INT,
    PRIMARY KEY(SNO,CNO),     -- 复合主键（表级）
    FOREIGN KEY(SNO) REFERENCES Student(SNO), -- 外键参照学生表
    FOREIGN KEY(CNO) REFERENCES Course(CNO)   -- 外键参照课程表
);
```

Student 的主键可以写在列级；SC 的主键由 SNO、CNO 两列组成，必须写成表级约束。两条外键保证选课记录引用的学生和课程已经存在。

#### （2）修改基本表

表已经存在时，用 `ALTER TABLE` 添加列、调整类型、增删约束或重命名列。
```sql
ALTER TABLE <表名>
[ADD <新列名> <数据类型> [完整性约束]]  -- 添加新列
[ALTER COLUMN <列名> <新数据类型>]      -- 修改列的数据类型
[ADD <表级完整性约束>]                  -- 添加表级约束
[DROP <完整性约束名>]                   -- 删除约束
[RENAME COLUMN <旧列名> TO <新列名>];   -- 列重命名
```

每次修改只选择需要的分支。转换已有列的数据类型前，还要确认原数据能够转换且新类型不会截断内容。

- 为Student表添加邮件列`SMAIL`（变长字符串45）
  ```sql
  ALTER TABLE Student ADD SMAIL VARCHAR(45);
  ```
  新列会加入现有表，能否为空取决于是否同时添加约束。

- 将Student表的`SBIRTHDAY`由`DATE`改为`VARCHAR(20)`（DATE占19字节，新类型长度≥19）
  ```sql
  ALTER TABLE Student ALTER COLUMN SBIRTHDAY VARCHAR(20);
  ```
  这里把日期改成字符类型；实际迁移前应检查依赖该列的查询和索引。

- 为Course表添加“课程名非空”约束
  ```sql
  ALTER TABLE Course ADD CONSTRAINT CNAME_NOTNULL CHECK(CNAME IS NOT NULL);
  ```
  约束添加后，后续写入的课程名必须非空，已有数据也需要满足条件。

#### （3）删除基本表

删除表同样要选择级联或限制策略。
```sql
DROP TABLE <表名> <CASCADE | RESTRICT>;
```

`CASCADE`级联删除依赖对象，`RESTRICT`在存在依赖时拒绝执行。表中的数据会随表定义一起删除，这与只清空数据的 `DELETE` 不同。

### 2.3 建立、修改和删除索引
#### （1）建立索引

索引为查询提供额外访问路径。创建时可以指定唯一性、聚集方式和多列排序方向。
```sql
CREATE [UNIQUE] [CLUSTER] INDEX <索引名>
ON <表名>(<列名1> [ASC|DESC], <列名2> [ASC|DESC], ...);
```

索引可能加快读取，但会占用空间，并增加插入、更新和删除时的维护成本。
- `UNIQUE`：**唯一索引**，索引值与表中记录一一对应，无重复；
- `CLUSTER`：**聚集索引**，表中数据按索引列物理排序；
- `ASC`/`DESC`：升序/降序，**默认升序（ASC）**；
- 可基于**单列/多列**建立索引，多列用逗号分隔。

##### 为学生、课程和选课表建立索引

下面分别建立单列和多列索引。
```sql
-- Student表按姓名升序建唯一索引
CREATE UNIQUE INDEX IDX_SNAME ON Student(SNAME ASC);
-- Course表按课程名升序建唯一索引（默认ASC，可省略）
CREATE UNIQUE INDEX IDX_CNAME ON Course(CNAME);
-- SC表按学号升序、课程号降序建唯一索引
CREATE UNIQUE INDEX IDX_SC ON SC(SNO ASC, CNO DESC);
```

IDX_SC 先按学号升序组织，同一学号下再按课程号降序组织。`UNIQUE` 还要求组合值不能重复。

#### （2）修改索引名

这里的修改只重命名索引，不改变索引列或排序方式。
```sql
ALTER INDEX <旧索引名> RENAME TO <新索引名>;
```

- 将`IDX_SNAME`改为`ST_NAME`
  ```sql
  ALTER INDEX IDX_SNAME RENAME TO ST_NAME;
  ```
  重命名后，依赖旧索引名的维护脚本也要同步调整。

#### （3）删除索引

不再需要某条访问路径时，可以删除索引。
```sql
DROP INDEX <索引名>;
```

删除索引不会删除表数据，但相关查询可能失去原来的执行路径。

### 2.4 把基本表放入模式
1. 建表时**显式指定模式**：`CREATE TABLE <模式名>.<表名>(...);`
2. 建模式时**同时建表**：`CREATE SCHEMA <模式名> AUTHORIZATION <用户名> CREATE TABLE <表名>(...);`
3. **设置搜索路径**：`SET SEARCH_PATH TO <模式名1>,<模式名2>;`（默认路径含`public`）；
   - 查看搜索路径：`SHOW SEARCH_PATH;`。

## 三、用 SELECT 组织查询
### 3.1 一条查询由哪些子句组成

下面的通用形式覆盖目标列、数据来源、行筛选、分组和排序。
```sql
SELECT [ALL | DISTINCT] <目标列表达式1>,<目标列表达式2>,...
FROM <表名/视图名> [,<表名/视图名>...]
[WHERE <条件表达式>]
[GROUP BY <列名1> [HAVING <条件表达式>]]
[ORDER BY <列名2> [ASC|DESC]];
```

书写顺序与逻辑执行顺序不同。理解执行顺序，有助于判断某个别名或聚集结果在哪一步可用。

- 子句执行顺序：`FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY`；
- 后续所有查询均基于此格式扩展，分**单表/连接/嵌套/集合/派生表查询**五类。

#### 3.2 单表查询（仅涉及一张表）
##### （1）选择需要的列
- 指定列：`SELECT SNO, SNAME FROM Student;`
- 全部列：用`*`简化，`SELECT * FROM Student;`
- 计算列：基于原有列做运算，可通过`AS`起别名（`AS`可省略）

  下面根据出生日期计算年龄，并把结果列命名为“年龄”。

  ```sql
  -- 查询学生姓名+年龄，年龄=当前年份-出生年份（Kingbase语法）
  SELECT SNAME, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM SBIRTHDAY) AS 年龄
  FROM Student;
  ```

  `AS` 只改变查询结果中的列名，不会修改 Student 的表结构。

##### （2）去除重复行：`DISTINCT`
- 作用：删除查询结果中的重复记录，**默认保留重复（ALL）**；
- 查询选修了课程的学生学号时，同一学生可能有多条选课记录，用 `DISTINCT` 去重：
  ```sql
  SELECT DISTINCT SNO FROM SC;
  ```

  去重作用于整个目标列组合，不只是单个字段。

##### （3）用 WHERE 筛选行
支持**比较谓词、范围、集合、字符匹配、空值、逻辑运算**，组合使用实现复杂条件。
| 条件类型       | 运算符/关键字               | 示例                          |
|----------------|-----------------------------|-------------------------------|
| 比较运算       | =, >, <, >=, <=, <>/!=      | `GRADE >= 60`（成绩及格）     |
| 范围查询       | `BETWEEN ... AND ...`/`NOT BETWEEN ... AND ...` | `SAGE BETWEEN 18 AND 22`（年龄18-22） |
| 集合查询       | `IN`/`NOT IN`               | `SDEPT IN ('CS','IS')`（专业为计科/智能） |
| 字符匹配       | `LIKE`/`NOT LIKE`（通配符）  | `SNAME LIKE '叶%'`（姓叶）    |
| 空值查询       | `IS NULL`/`IS NOT NULL`     | `GRADE IS NULL`（无成绩）     |
| 逻辑运算       | `AND`（且）,`OR`（或）,`NOT`（非） | `SDEPT='CS' AND SAGE <20`（计科且20岁以下） |

###### `LIKE` 的通配符
- `%`：匹配**任意长度**的字符串（包括0个字符）；
- `_`：匹配**单个**字符；
- 转义字符：若查询内容含`%/_`，用`ESCAPE`指定转义符（如`LIKE 'java\_L%' ESCAPE '\'`，匹配`java_L`开头的字符串）。

##### （4）用 ORDER BY 排序
- 按**单列/多列**排序，`ASC`升序（默认），`DESC`降序；
- 空值的排序次序由DBMS决定；
- 下面先按课程号升序，同一课程内再按成绩降序：
  ```sql
  SELECT * FROM SC ORDER BY CNO ASC, GRADE DESC;
  ```

  多列排序按从左到右的优先级执行，后面的列只在前面列值相同时参与比较。

##### （5）用聚集函数统计

除 `COUNT(*)` 外，下面的聚集函数作用于列值；其中求和和平均等运算要求列类型支持相应计算。
| 函数          | 说明                     | 示例                          |
|---------------|--------------------------|-------------------------------|
| `COUNT(*)`    | 统计表中总元组个数       | `COUNT(*)`（选课总记录数）    |
| `COUNT([DISTINCT] 列名)` | 统计列中非空值个数，DISTINCT去重 | `COUNT(DISTINCT SNO)`（选课学生数） |
| `SUM(列名)`   | 计算列值总和             | `SUM(GRADE)`（成绩总和）      |
| `AVG(列名)`   | 计算列值平均值           | `AVG(GRADE)`（成绩平均值）    |
| `MAX(列名)`   | 求列值最大值             | `MAX(GRADE)`（最高分）        |
| `MIN(列名)`   | 求列值最小值             | `MIN(GRADE)`（最低分）        |

##### （6）用 GROUP BY 分组，用 HAVING 筛选组
- `GROUP BY`：按指定列**分组**，同列值为一组，聚集函数作用于**每组**；
- `HAVING`：筛选**分组后**的结果，**可与聚集函数连用**；
- `WHERE`作用于**基本表/视图**，筛选**元组**，**不能与聚集函数连用**；`HAVING`作用于**分组**，筛选**组**，**可与聚集函数连用**。

###### 统计每门课程的选修人数
```sql
SELECT CNO, COUNT(DISTINCT SNO) AS 选课人数
FROM SC
GROUP BY CNO;
```

分组后每个 CNO 产生一行，`COUNT(DISTINCT SNO)` 统计该组中不同学生的数量。

###### 筛选平均成绩不低于 90 的学生
```sql
-- 错误：WHERE不能连用聚集函数
-- SELECT SNO, AVG(GRADE) FROM SC WHERE AVG(GRADE)>=90 GROUP BY SNO;
-- 正确：GROUP BY后用HAVING
SELECT SNO, AVG(GRADE) AS 平均成绩
FROM SC
GROUP BY SNO
HAVING AVG(GRADE) >= 90;
```

平均成绩是分组后的结果，因此条件必须写在 `HAVING`，不能提前放进 `WHERE`。

#### 3.3 连接查询（涉及两张及以上表）
##### （1）连接条件
- 连接条件/连接谓词：关联多张表的条件，格式`<表名1>.<列名1> <比较符> <表名2>.<列名2>`；
- 连接字段：连接谓词中的列名，通常为**主键-外键**对应关系；
- 等值连接：比较符为`=`的连接；
- 自然连接：**等值连接的特例**，删除目标列中**重复的连接字段**。

##### （2）等值连接与自然连接

下面两条语句使用相同连接条件，区别在于目标列是否保留重复的 SNO。
```sql
-- 等值连接：Student与SC连接，SNO重复出现
SELECT Student.*, SC.* FROM Student, SC WHERE Student.SNO = SC.SNO;
-- 自然连接：删除重复的SNO，只保留一次
SELECT Student.SNO, SNAME, SSEX, CNO, GRADE FROM Student, SC WHERE Student.SNO = SC.SNO;
```

第一条返回两张表的全部列，因此 SNO 出现两次；第二条显式列出目标列，只保留一个 SNO。

##### （3）复合条件连接
连接谓词和选择谓词可以用 `AND` 组合。下面查询选修 CNO='81001' 且成绩≥80的学生姓名和学号。
```sql
SELECT Student.SNO, SNAME FROM Student, SC
WHERE Student.SNO = SC.SNO AND SC.CNO='81001' AND SC.GRADE>=80;
```

第一个条件负责连接 Student 与 SC，后两个条件负责筛选课程和成绩。

##### （4）自身连接
表与自身连接时，需要给同一张表起**不同别名**，并为列名加别名前缀。下面查询课程的**间接先修课**，也就是先修课的先修课。
```sql
SELECT FIRST.CNO, SECOND.CPNO
FROM Course FIRST, Course SECOND
WHERE FIRST.CPNO = SECOND.CNO AND SECOND.CPNO IS NOT NULL;
```

FIRST 表示当前课程记录，SECOND 表示它直接先修的课程记录，两次角色通过别名区分。

##### （5）多表连接
连接 3 张或更多表时，仍然沿主键和外键逐步关联。下面通过 SC 把 Student 与 Course 连接起来，返回学生姓名、课程名和成绩。
```sql
SELECT Student.SNAME, Course.CNAME, SC.GRADE
FROM Student, SC, Course
WHERE Student.SNO = SC.SNO AND SC.CNO = Course.CNO;
```

两个连接条件缺一不可，否则会产生多余的笛卡尔积组合。

#### 3.4 嵌套查询
- 查询块：单个`SELECT-FROM-WHERE`语句；
- 外层查询/父查询：外层的查询块；
- 内层查询/子查询：嵌套在内部的查询块；
- 分类：**不相关子查询**（子查询不依赖父查询）、**相关子查询**（子查询依赖父查询的列值）。

##### （1）用 `IN` 接收集合
子查询返回一个集合，父查询用 `IN` 判断值是否属于该集合。下面先查“哈哈”的专业，再查同专业学生。
```sql
SELECT SNO, SNAME FROM Student
WHERE SDEPT IN (
    SELECT SDEPT FROM Student WHERE SNAME='哈哈'  -- 子查询：查哈哈的专业
);
```

内层查询不引用外层行，因此这是不相关子查询，只需独立求值。

##### （2）带比较运算符的子查询
子查询返回单值时，可以使用`=,>,<,>=,<=`等比较运算符。下面把每条成绩与该学生自己的平均成绩比较。
```sql
SELECT SNO, CNO FROM SC X  -- 父查询表起别名X
WHERE X.GRADE >= (
    SELECT AVG(GRADE) FROM SC Y  -- 子查询表起别名Y
    WHERE Y.SNO = X.SNO  -- 关联父查询，相关子查询
);
```

内层查询引用 `X.SNO`，会随外层当前行变化，因此属于相关子查询。原题描述“张三”，但这段代码实际会对 SC 中每个学生分别计算平均成绩。

##### （3）用 `ANY/SOME/ALL` 比较多值结果
子查询返回多值时，需要与比较运算符连用。`ANY=SOME` 表示任意一个，`ALL` 表示所有。
| 组合          | 说明                     |
|---------------|--------------------------|
| `> ANY`       | 大于子查询结果中的**某个**值 |
| `> ALL`       | 大于子查询结果中的**所有**值 |
| `< ANY`       | 小于子查询结果中的**某个**值 |
| `< ALL`       | 小于子查询结果中的**所有**值 |

下面查询非 IS 专业中，比 IS 专业任意一个学生年龄小的学生姓名。
```sql
SELECT SNAME, SBIRTHDAY FROM Student
WHERE SBIRTHDAY > ANY (
    SELECT SBIRTHDAY FROM Student WHERE SDEPT='IS'
) AND SDEPT != 'IS';
```

出生日期越晚通常年龄越小，因此条件使用 `SBIRTHDAY > ANY (...)`。

##### （4）用 `EXISTS/NOT EXISTS` 判断是否存在
- `EXISTS`：子查询**非空**（有结果），返回`TRUE`；子查询**为空**，返回`FALSE`；
- `NOT EXISTS`：与`EXISTS`相反，子查询**为空**返回`TRUE`，非空返回`FALSE`；
- 子查询的目标列通常用`*`（只需判断是否有结果，无需具体列值）；

下面返回至少存在一条 CNO='81001' 选课记录的学生。
```sql
SELECT SNAME FROM Student
WHERE EXISTS (
    SELECT * FROM SC
    WHERE SC.SNO = Student.SNO AND SC.CNO='81001'
);
```

`EXISTS` 只关心子查询是否返回行，不使用目标列的具体值。

把条件改成 `NOT EXISTS`，就能查询未选修该课程的学生。
```sql
SELECT SNAME FROM Student
WHERE NOT EXISTS (
    SELECT * FROM SC
    WHERE SC.SNO = Student.SNO AND SC.CNO='81001'
);
```

相关子查询通过 `SC.SNO = Student.SNO` 与外层当前学生对应。

#### 3.5 集合查询
集合查询把两个查询结果继续做集合运算。两个结果必须**列数相同**，并且**对应列数据类型一致**。常用运算包括并（UNION）、交（INTERSECT）和差（EXCEPT）。

下面合并 2020 秋学期选修 81001 或 81002 的学生学号。
```sql
SELECT SNO FROM SC WHERE SEMESTER='2020秋' AND CNO='81001'
UNION
SELECT SNO FROM SC WHERE SEMESTER='2020秋' AND CNO='81002';
```

`UNION` 会自动去除重复行；需要保留重复时使用 `UNION ALL`。

#### 3.6 基于派生表的查询
子查询出现在 `FROM` 子句中时，它的结果成为临时派生表，并且需要别名。下面先按学生计算平均成绩，再找出不低于本人平均成绩的课程记录；它与 3.4.2 的相关子查询表达同一类需求。
```sql
SELECT SC.SNO, SC.CNO
FROM SC, (
    SELECT SNO, AVG(GRADE) AS AVG_GRADE FROM SC GROUP BY SNO  -- 派生表：学生学号+平均成绩
) AS AVG_SC  -- 派生表起别名AVG_SC
WHERE SC.SNO = AVG_SC.SNO AND SC.GRADE >= AVG_SC.AVG_GRADE;
```

派生表 AVG_SC 每个学生只有一行平均成绩，外层通过 SNO 连接后再比较单门课程成绩。
