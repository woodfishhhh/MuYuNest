---
title: "MySQL 数据读写、分组聚合、排序分页与常用函数"
slug: mysql-dml-dql-and-aggregation
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "DML"
  - "DQL"
  - "聚合分组"
  - "SQL函数"
---

写业务查询时经常会碰到几类典型误区：往 `INSERT` 里少传一列结果值全写串、把聚合条件塞进 `WHERE` 直接报错、忘记 `NULL` 参与比较会让 `!=` 条件漏掉整行，或者分页翻到第二页直接写 `LIMIT 2, 10` 漏掉了数据。把 DML 写入约束、DQL 的逻辑执行顺序以及常用函数的边界理清楚，写出来的查询才稳得住。

## DML 数据写入、更新与删除

对表记录做增删改时，使用副表练习最安全（`CREATE TABLE employee_edit LIKE emp;` 只复制表结构，不复制数据）。

```sql
-- 显式列出写入列名，避免表结构变更引发位置错位
INSERT INTO employee_edit (id, work_no, name, gender, age, entry_date)
VALUES
  (101, '00101', '小昭', '女', 18, '2024-01-01'),
  (102, '00102', '杨逍', '男', 40, '2020-05-01');

UPDATE employee_edit
SET name = '小昭同学', age = 19
WHERE id = 101;

DELETE FROM employee_edit WHERE id = 102;
```

写入与变更时必须盯紧三点：

1. **原子失败与默认值**：多行 `INSERT` 属于单条 SQL 语句，在 InnoDB 中任意一行触发主键冲突、非空缺失或无符号越界（如给 `UNSIGNED` 年龄写 `-1`），整条 `INSERT` 都会回滚失败。未写出的列取默认值或 `NULL`；`NULL` 关键词不加引号，`'NULL'` 是长度为 4 的普通字符串。
2. **字段置空与删行的区别**：清空某个单元格的值用 `UPDATE ... SET salary = NULL`；`DELETE` 的操作粒度是整行，无法用 `DELETE` 只删掉一列的值。
3. **变更前先用 `SELECT` 核对条件**：执行 `UPDATE` 或 `DELETE` 前省略 `WHERE` 会直接波及全表。先用相同的 `WHERE` 条件跑一遍 `SELECT` 确认命中行，比盲目执行安全得多。

## SELECT 编写顺序与逻辑执行顺序

日常编写 `SELECT` 查询时，子句从上到下的书写顺序是固定的：

```sql
SELECT [DISTINCT] 字段或表达式
FROM 表
WHERE 行过滤条件
GROUP BY 分组字段
HAVING 组过滤条件
ORDER BY 排序字段 [ASC | DESC]
LIMIT 偏移量, 数量;
```

**MySQL 逻辑上按 `FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY -> LIMIT` 的顺序推进，理解这条链路就能一眼判断列别名和聚合函数该写在哪。**

- **`WHERE` 阶段尚未生成 `SELECT` 别名**：因此不能写 `WHERE employee_age > 15`，必须写原始列名或原表达式；而 `ORDER BY` 在 `SELECT` 之后执行，可以直接引用 `SELECT` 里定义的别名。
- **`DISTINCT` 作用于整组投影列**：`SELECT DISTINCT work_address, gender` 去除的是“地址+性别”组合完全相同的行，而非仅对第一个字段去重。
- **`ORDER BY` 与 `LIMIT` 的先后**：单层查询永远是先按 `ORDER BY` 排好全量候选行，再按 `LIMIT` 截取目标页；若需求是“先取前 5 条再排序”，必须套一层派生表子查询。

## 条件过滤与 NULL 比较陷阱

`emp` 表中 `WHERE` 筛选支持等值、不等（`<>` 或 `!=`）、闭区间 `BETWEEN a AND b`（要求 `a <= b`）、集合 `IN (...)` 以及模糊匹配 `LIKE`（`_` 匹配单个字符，`%` 匹配零到多个字符）。`AND` 的优先级高于 `OR`，混用时务必加括号显式分组：

```sql
SELECT name FROM emp
WHERE gender = '女' AND (age = 18 OR age = 20);
```

涉及缺失值时，必须严格遵守 SQL 三值逻辑（`TRUE`、`FALSE`、`UNKNOWN`）：

```sql
-- 正确：筛选缺失证件号或年龄不为 88（含未填写）的员工
SELECT name FROM emp WHERE id_card IS NULL;
SELECT name FROM emp WHERE age <> 88 OR age IS NULL;
```

**任何值与 `NULL` 用 `=`、`<>`、`>` 比较都会得到 `UNKNOWN`，而 `WHERE` 只放行结果为 `TRUE` 的行——因此 `id_card = NULL` 永远查不到任何记录。**

如果业务上确实需要把“两个字段同为 `NULL`”视为相等，可以使用 MySQL 专有的 NULL 安全等号 `<=>`（`NULL <=> NULL` 返回 `1`，`1 <=> NULL` 返回 `0`），但不要拿它替换日常的普通等号。

## 分组聚合与稳定分页

### 1. 聚合函数对 NULL 的处理与 `ONLY_FULL_GROUP_BY`

常用聚合函数统计 `emp` 全表：

```sql
SELECT COUNT(*) AS total,
       COUNT(id_card) AS with_card,
       MIN(age) AS youngest,
       MAX(age) AS oldest,
       SUM(age) AS total_age,
       AVG(age) AS average_age
FROM emp;
```

`COUNT(*)` 统计总行数（8 人），而 `COUNT(id_card)`、`SUM`、`AVG`、`MIN`、`MAX` 均**直接跳过 `NULL` 值**（`COUNT(id_card)` 得到 7 人）。当过滤后没有任何匹配行时，`COUNT(*)` 返回 `0`，其余聚合函数返回 `NULL`（需展示 `0` 时用 `COALESCE(SUM(age), 0)` 兜底）。

按字段分组时，MySQL 8.0 默认开启 `ONLY_FULL_GROUP_BY` 模式，严禁在 `SELECT` 中出现既不在 `GROUP BY` 里、又不被聚合函数包裹且不函数依赖于分组键的列（例如 `SELECT gender, name, COUNT(*) FROM emp GROUP BY gender` 会直接报错）。分组统计需要细分维度时，必须在 `GROUP BY` 中同时列出多个分组列：

```sql
-- 统计年龄小于 45 岁且符合人数不少于 3 人的工作城市
SELECT work_address, COUNT(*) AS people
FROM emp
WHERE age < 45
GROUP BY work_address
HAVING COUNT(*) >= 3;
```

`WHERE` 在分组前过滤掉明细行，`HAVING` 在分组聚合后过滤统计组，两者的过滤时机截然不同，切忌混放。

### 2. 多字段排序与分页偏移量

多列排序按从左到右的优先级逐级打破并列，每一列必须单独声明 `ASC` 或 `DESC`。

**不带唯一列打破并列的 `ORDER BY` 加上 `LIMIT` 分页是不稳定的，同值记录在翻页时可能重复出现或漏行。**

```sql
-- 按年龄升序、入职日期降序，最后用主键 id 保证分页顺序唯一确定
SELECT id, name, age, entry_date
FROM emp
ORDER BY age ASC, entry_date DESC, id ASC
LIMIT 3, 3;
```

`LIMIT offset, size` 中首个参数是跳过的行数（从 `0` 开始），第 `page` 页（每页 `size` 条）的偏移量公式为 `(page - 1) * size`。当偏移量达到十万级以上时，深分页扫描丢弃大量前序行会拖慢查询，优化手段见 [MySQL 慢 SQL 诊断与调优](/posts/mysql-explain-and-sql-tuning)。

## 字符串、数值、日期与条件函数实战

MySQL 内置函数既可用于 `SELECT` 格式化展示，也可放进 `UPDATE` 批量清洗数据（注意在 `WHERE` 索引列上套用函数会导致索引失效）。

### 1. 字符串函数

| 函数 | 行为与关键边界 | 示例 |
| :--- | :--- | :--- |
| `CONCAT(s1, s2, ...)` | 拼接字符串；**任意参数为 `NULL` 则整串返回 `NULL`** | `CONCAT(name, '：', IFNULL(id_card, '未填写'))` |
| `LOWER(s)` / `UPPER(s)` | 英文大小写转换 | `LOWER('MySQL')` → `'mysql'` |
| `TRIM(s)` | 仅去除首尾空格，保留字符串内部空格 | `TRIM('  hi sql  ')` → `'hi sql'` |
| `LPAD(s, len, pad)` / `RPAD` | 按目标长度 `len` 左/右填充；**原串超长会被截短** | `LPAD('12', 5, '0')` → `'00012'` |
| `SUBSTRING(s, pos, len)` | 位置 `pos` **从 1 开始**，第 3 个参数是截取长度 | `SUBSTRING('Hello MySQL', 7, 5)` → `'MySQL'` |

给工号补齐五位前导零时，务必加上长度保护避免截断已有六位工号：

```sql
UPDATE employee_edit
SET work_no = LPAD(work_no, 5, '0')
WHERE CHAR_LENGTH(work_no) < 5;
```

### 2. 数值与日期函数

- **取整与舍入**：`CEIL(x)` 与 `FLOOR(x)` 沿着数轴向上/向下取整，因此 `FLOOR(-1.1)` 结果为 `-2` 而非 `-1`；`MOD(7, 4)` 取余数为 `3`；`ROUND(2.345, 2)` 保留两位小数得 `2.35`。用 `LPAD(FLOOR(RAND() * 1000000), 6, '0')` 可生成演示用六位数字串（不可用 `ROUND` 替代 `FLOOR`，否则接近上界时会进位成 7 位被截断；生产验证码必须使用应用层密码学安全随机数）。
- **日期计算**：`CURDATE()`、`CURTIME()`、`NOW()` 分别返回当前日期、时间和完整时间戳；`DATE_ADD('2024-01-01', INTERVAL 70 DAY)` 按日历规则推进；`DATEDIFF(a, b)` 计算 `a - b` 的天数差并忽略时分秒，参数顺序颠倒结果变号。

```sql
-- 计算截至指定基准日的在职天数
SELECT name, DATEDIFF('2024-01-01', entry_date) AS days_employed
FROM emp
ORDER BY days_employed DESC, id;
```

### 3. 空值兜底与 `CASE` 分支

- `IF(cond, t, f)`：条件成立返回 `t`，否则返回 `f`。
- `IFNULL(v, default)`：仅当 `v` 为 `NULL` 时替换，`''` 和 `0` 会原样保留。
- `COALESCE(v1, v2, ...)`：按顺序返回第一个非 `NULL` 参数，适合多级备选兜底。
- `CASE` 表达式：等值匹配用简单形式（`CASE col WHEN ...`），区间或空值判断用搜索形式（`CASE WHEN ...`）。

**写范围型 `CASE WHEN` 必须把 `IS NULL` 放在最前面，并按从严到宽排列区间，否则 `NULL` 会直接掉进 `ELSE` 分支。**

```sql
SELECT name,
  CASE
    WHEN math IS NULL THEN '未录入'
    WHEN math >= 85 THEN '优秀'
    WHEN math >= 60 THEN '及格'
    ELSE '不及格'
  END AS math_level
FROM score;
```

只要先判断 `IS NULL`，再把 `>= 85` 写在 `>= 60` 之前，每个分支的命中区间就清晰且互不重叠。
