---
title: "标准 SQL 精要：模式定义、复杂查询、三值空值逻辑与视图"
slug: sql-standard-ddl-dml-and-views
date: 2026-03-16
categories:
  - "数据库"
tags:
  - "SQL"
  - "DDL"
  - "子查询"
  - "空值逻辑"
  - "视图"
---

SQL（Structured Query Language）把数据定义、查询、操纵和权限控制统一在一套声明式语法里。使用过程式语言时，开发者必须手写循环和查找步骤；写 SQL 时，开发者只需声明“想要什么结果”，具体选择索引、连接顺序还是扫描路径，全部交给 DBMS 查询优化器决定。理解标准 SQL 的关键，在于把握模式定义约束、查询子句的逻辑执行顺序、空值的三值逻辑陷阱，以及视图更新的边界。

## 用 DDL 定义模式、基本表与索引

### 1. 模式（Schema）的创建与删除

模式相当于数据库内的一层命名空间，用来把相关的表、视图和索引组织在一起：

```sql
-- 创建模式并指定所有者（省略模式名时默认与用户名相同）
CREATE SCHEMA AUTHORIZATION Wang;
CREATE SCHEMA Hello AUTHORIZATION Ye;

-- 删除模式
DROP SCHEMA Hello CASCADE;   -- 级联删除模式下所有表、视图和索引
DROP SCHEMA Wang RESTRICT;   -- 仅当模式下没有任何对象时才允许删除
```

执行 `DROP SCHEMA` 前务必区分 `CASCADE` 与 `RESTRICT` 的破坏范围，生产环境应默认先以 `RESTRICT` 核查依赖。

### 2. 基本表定义、约束级别与修改

`CREATE TABLE` 同时定义列的存储类型和完整性约束。涉及单个列的约束（`NOT NULL`、`UNIQUE`、`PRIMARY KEY`、`CHECK`）可以写在列级，涉及多列组合的约束（如复合主键）必须写在表级：

```sql
CREATE TABLE Student (
    SNO CHAR(9) PRIMARY KEY,      -- 单属性主键，列级约束
    SNAME VARCHAR(40) UNIQUE,     -- 唯一约束
    SSEX CHAR(2),
    SBIRTHDAY DATE,
    SDEPT VARCHAR(40)
);

CREATE TABLE SC (
    SNO CHAR(9),
    CNO CHAR(6),
    GRADE INT,
    PRIMARY KEY (SNO, CNO),       -- 复合主键必须定义在表级
    FOREIGN KEY (SNO) REFERENCES Student(SNO),
    FOREIGN KEY (CNO) REFERENCES Course(CNO)
);
```

常见基础数据类型与约束语义对照如下：

| 类别 | 常用语法 | 核心约束语义 |
| :--- | :--- | :--- |
| 字符串 | `CHAR(n)` / `VARCHAR(n)` | 定长字符与变长字符（最大长度 `n`） |
| 数值 | `SMALLINT` / `INT` / `BIGINT` / `FLOAT` / `DOUBLE` | 不同精度的整型与浮点型 |
| 日期 | `DATE` | 标准日期格式 `YYYY-MM-DD` |
| 主键与唯一 | `PRIMARY KEY` / `UNIQUE` / `NOT NULL` | 主键隐含 `NOT NULL + UNIQUE`；`UNIQUE` 禁止列值重复 |
| 参照与检查 | `FOREIGN KEY` / `CHECK(...)` | 外键绑定被参照表主键；`CHECK` 限定用户自定义条件 |

表结构上线后可通过 `ALTER TABLE` 增量调整，但修改列类型或新增约束前必须核对存量数据是否兼容，避免截断或校验失败：

```sql
-- 添加新列
ALTER TABLE Student ADD SMAIL VARCHAR(45);

-- 修改列数据类型（例如从 DATE 扩为长度足够的字符列）
ALTER TABLE Student ALTER COLUMN SBIRTHDAY VARCHAR(20);

-- 添加表级检查约束
ALTER TABLE Course ADD CONSTRAINT CNAME_NOTNULL CHECK (CNAME IS NOT NULL);

-- 重命名列与删表
ALTER TABLE Student RENAME COLUMN SDEPT TO SMAJOR;
DROP TABLE Student RESTRICT;
```

### 3. 索引与搜索路径

索引为查询提供额外访问路径，能够显著加快检索，但会占用额外存储空间并增加写入时的维护开销：

```sql
-- 唯一索引与多列组合排序索引
CREATE UNIQUE INDEX IDX_SNAME ON Student(SNAME ASC);
CREATE UNIQUE INDEX IDX_SC ON SC(SNO ASC, CNO DESC);

-- 重命名与删除索引（删除索引不影响表内数据）
ALTER INDEX IDX_SNAME RENAME TO ST_NAME;
DROP INDEX ST_NAME;
```

其中 `CLUSTER` 可声明聚簇索引，使表中记录按索引列物理顺序组织。在支持模式路径的标准 SQL 实现（如 PostgreSQL/Kingbase）中，可用 `CREATE TABLE <模式名>.<表名>` 显式归属模式，或用 `SET SEARCH_PATH TO <模式1>, <模式2>;` 与 `SHOW SEARCH_PATH;` 控制默认查找路径。

## SELECT 查询与子句逻辑执行顺序

标准 `SELECT` 语句包含投影列、数据源、行过滤、分组和排序五个主要部分：

```sql
SELECT [ALL | DISTINCT] <目标列表达式>, ...
FROM <表名或视图名>, ...
[WHERE <行过滤条件>]
[GROUP BY <分组列> [HAVING <组过滤条件>]]
[ORDER BY <排序列> [ASC | DESC]];
```

**SQL 必须先看懂逻辑执行顺序，才能判断列别名和聚集函数在哪个子句里合法：**

```text
FROM  -->  WHERE  -->  GROUP BY  -->  HAVING  -->  SELECT  -->  ORDER BY
```

正因为 `WHERE` 在 `GROUP BY` 之前执行，所以 `WHERE` 只能筛选原始行，绝不能调用 `AVG()`、`COUNT()` 这类聚集函数；`HAVING` 在分组完成后执行，专门用来筛选分组；`SELECT` 中定义的列别名在 `WHERE` 和 `GROUP BY` 阶段尚未生成，通常只能在 `ORDER BY` 中直接引用。

### 1. 单表筛选、去重与分组统计

- **计算列与去重**：`SELECT SNAME, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM SBIRTHDAY) AS 年龄 FROM Student;`；对选课学生学号去重用 `SELECT DISTINCT SNO FROM SC;`，`DISTINCT` 作用于整个目标列组合。
- **模糊匹配转义**：`LIKE` 中 `%` 匹配任意长度字符，`_` 匹配单个字符；若待查字符本身包含通配符，须用 `ESCAPE` 声明转义符，例如 `WHERE CNAME LIKE 'java\_L%' ESCAPE '\'`。
- **空值与范围谓词**：支持 `BETWEEN ... AND ...`、`IN`、`IS NULL`、`IS NOT NULL`。
- **聚集函数与分组**：`COUNT(*)` 统计总行数（含空值），`COUNT([DISTINCT] col)`、`SUM`、`AVG`、`MAX`、`MIN` 均自动忽略 `NULL`。统计每门课选课人数与筛选平均分不低于 90 的学生：

```sql
SELECT CNO, COUNT(DISTINCT SNO) AS 选课人数
FROM SC
GROUP BY CNO;

-- 正确写法：聚集条件放在 HAVING，不能写在 WHERE
SELECT SNO, AVG(GRADE) AS 平均成绩
FROM SC
GROUP BY SNO
HAVING AVG(GRADE) >= 90;
```

### 2. 多表连接、自连接与派生表

多表关联时，连接条件缺失会退化为全量笛卡尔积；表自身关联时必须通过不同别名区分角色：

```sql
-- 多表自然属性投影
SELECT Student.SNAME, Course.CNAME, SC.GRADE
FROM Student, SC, Course
WHERE Student.SNO = SC.SNO AND SC.CNO = Course.CNO;

-- 自连接：查询课程的间接先修课（先修课的先修课）
SELECT FIRST.CNO, SECOND.CPNO
FROM Course FIRST, Course SECOND
WHERE FIRST.CPNO = SECOND.CNO AND SECOND.CPNO IS NOT NULL;
```

### 3. 嵌套查询：相关子查询与量词匹配

子查询按是否依赖外层行分为不相关子查询与相关子查询：

```sql
-- 不相关子查询（IN）：先求同专业，再过滤学生
SELECT SNO, SNAME FROM Student
WHERE SDEPT IN (
    SELECT SDEPT FROM Student WHERE SNAME = '李勇'
);

-- 相关子查询：内层依赖外层当前行 X.SNO，求各生高于本人均分的课程
SELECT SNO, CNO FROM SC X
WHERE X.GRADE >= (
    SELECT AVG(GRADE) FROM SC Y
    WHERE Y.SNO = X.SNO
);
```

同一需求也可以改写成 `FROM` 子句中的派生表，先按学生聚合均分再做连接：

```sql
SELECT SC.SNO, SC.CNO
FROM SC, (
    SELECT SNO, AVG(GRADE) AS AVG_GRADE FROM SC GROUP BY SNO
) AS AVG_SC
WHERE SC.SNO = AVG_SC.SNO AND SC.GRADE >= AVG_SC.AVG_GRADE;
```

处理多值比较与存在性判断时，按语义选用 `ANY`/`ALL` 或 `EXISTS`：

- **`ANY`/`SOME` 与 `ALL`**：`> ANY` 等价于大于子查询最小值，`> ALL` 等价于大于子查询最大值。例如查询非 `IS` 专业中比 `IS` 专业至少一名学生年轻（出生日期更晚）的学生：

```sql
SELECT SNAME, SBIRTHDAY FROM Student
WHERE SBIRTHDAY > ANY (
    SELECT SBIRTHDAY FROM Student WHERE SDEPT = 'IS'
) AND SDEPT != 'IS';
```

- **`EXISTS` 与 `NOT EXISTS`**：只检查子查询结果集是否非空，不关心目标列内容（习惯写 `SELECT *`）。查询选修或未选修 `81001` 号课程的学生：

```sql
SELECT SNAME FROM Student
WHERE NOT EXISTS (
    SELECT * FROM SC
    WHERE SC.SNO = Student.SNO AND SC.CNO = '81001'
);
```

多个结构一致（列数相同、对应列类型兼容）的查询结果还可用 `UNION`（去重并集）、`UNION ALL`（不去重并集）、`INTERSECT`（交集）和 `EXCEPT`（差集）组合。

## 数据更新与 NULL 的三值逻辑陷阱

### 1. INSERT、UPDATE 与 DELETE

数据更新会直接修改持久化数据，操作前必须核对字段类型、完整性约束以及 `WHERE` 影响范围：

```sql
-- 显式指定列名插入，避免表结构增减列导致位置错位
INSERT INTO Student (SNO, SNAME, SBIRTHDAY, SDEPT)
VALUES ('20250001', '陈平', '2007-09-01', 'CS');

-- 批量将聚合结果写入汇总表
INSERT INTO S_major_age (Smajor, avg_age)
SELECT SDEPT, AVG(EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM SBIRTHDAY))
FROM Student
GROUP BY SDEPT;

-- 带子查询的更新与删除（省略 WHERE 将作用于整张表）
UPDATE SC SET GRADE = 0
WHERE SNO IN (SELECT SNO FROM Student WHERE SDEPT = 'CS');

DELETE FROM SC
WHERE SNO IN (SELECT SNO FROM Student WHERE SDEPT = 'IS');
```

删除主表记录时，如果子表存在引用它的外键记录，DBMS 会依据参照完整性拒绝删除或触发级联动作。

### 2. 空值（NULL）与三值逻辑（Three-Valued Logic）

`NULL` 在 SQL 中代表“未知、不存在或无意义”，既不等于 `0`，也不等于空字符串 `''`。任何值（包括另一个 `NULL`）与 `NULL` 做普通比较运算（`=`、`!=`、`<`、`>`），结果都会变成第三种逻辑值 **`UNKNOWN`**，从而脱离简单的布尔真假二分。

| 表达式 | `AND` (`TRUE` / `FALSE` / `UNKNOWN`) | `OR` (`TRUE` / `FALSE` / `UNKNOWN`) | `NOT` |
| :--- | :--- | :--- | :--- |
| `TRUE` | `TRUE` / `FALSE` / `UNKNOWN` | `TRUE` / `TRUE` / `TRUE` | `FALSE` |
| `FALSE` | `FALSE` / `FALSE` / `FALSE` | `TRUE` / `FALSE` / `UNKNOWN` | `TRUE` |
| `UNKNOWN` | `UNKNOWN` / `FALSE` / `UNKNOWN` | `TRUE` / `UNKNOWN` / `UNKNOWN` | `UNKNOWN` |

**`WHERE` 子句只放行判定结果为 `TRUE` 的行，`FALSE` 和 `UNKNOWN` 都会被过滤掉——这是 `NOT IN` 遇上 `NULL` 全表返回空集的根本原因。**

判断列为空必须使用 `IS NULL` 或 `IS NOT NULL`：

```sql
SELECT * FROM Student
WHERE SNAME IS NULL OR SSEX IS NULL;
```

特别警惕 `col NOT IN (subquery)`：如果子查询返回的集合里混入哪怕一个 `NULL`，`col != NULL` 的求值结果就是 `UNKNOWN`，整条 `NOT IN` 表达式（等价于多个 `!=` 用 `AND` 连接）永远无法得到 `TRUE`，最终返回 0 行。写反向过滤时，要么在子查询中显式排除 `IS NOT NULL`，要么改用不受 `NULL` 污染的 `NOT EXISTS`。

## 视图（View）与可更新限制

视图是从基本表或其他视图导出的虚表，数据字典里只保存视图的查询定义，不复制底层数据。基本表更新后，再次查询视图会实时反映最新状态。

### 1. 创建、查询与级联删除

```sql
-- 单表行列子集视图，并开启更新条件检查
CREATE VIEW View_SE AS
SELECT * FROM Student WHERE SDEPT = 'SE'
WITH CHECK OPTION;

-- 多表连接视图与基于视图的派生视图
CREATE VIEW View_SE_999 (SNO, SNAME, GRADE) AS
SELECT s.SNO, s.SNAME, sc.GRADE
FROM Student s, SC sc
WHERE s.SDEPT = 'SE' AND s.SNO = sc.SNO AND sc.CNO = '999';

CREATE VIEW View_SE_999_90 AS
SELECT * FROM View_SE_999 WHERE GRADE >= 90;

-- 删除视图定义（有下游依赖视图时必须加 CASCADE，不删原基本表数据）
DROP VIEW View_SE CASCADE;
```

### 2. 视图的可更新限制

对视图执行 `INSERT`/`UPDATE`/`DELETE` 时，DBMS 会通过视图消解将其翻译为对底层基本表的操作，但这存在严格边界：

1. **行列子集视图可更新**：从单个基本表导出、仅去掉部分行和列但保留了基本表主码的视图，允许直接更新；若定义了 `WITH CHECK OPTION`，更新后的新行必须依然满足视图 `WHERE` 条件，否则拒绝写入。
2. **含聚合、分组、`DISTINCT` 或计算表达式的视图不可更新**：DBMS 无法把汇总值或计算列反向映射回唯一的底层行和列值。
3. **多表连接视图的更新受限**：多数 DBMS 禁止通过连接视图一次修改多张底层基表，通常要求仅映射到单一基表（部分实现甚至直接禁止更新多表视图）。

工程上使用视图的价值集中在三点：封装复杂多表查询以简化调用、基于外模式隔离敏感列（例如隐藏身份证号与手机号）以保障安全，以及在基表结构重构时通过调整视图定义维持上层查询的逻辑独立性（关于 MySQL 中本地与级联检查选项的细节，可参阅 [MySQL 数据库编程对象](/posts/mysql-views-procedures-and-triggers)）。
