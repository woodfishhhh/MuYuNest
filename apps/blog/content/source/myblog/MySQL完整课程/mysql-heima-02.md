---
title: "MySQL（02）：写入数据与条件查询"
date: 2026-10-17 00:00:00
slug: mysql-heima-02
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

建表只定了每一列能存什么，`INSERT` 才把记录放进去。查询、分组和连接都要有确定的数据，所以后面的基础示例统一用 `mysql_notes.emp`。这八个人是为了连贯练习重建的教学数据，沿用了部分课程角色，字段值和人数跟视频里的表不一定一致。

## 准备一套能核对结果的数据

在 MySQL 客户端执行 [初始化脚本](/posts/mysql-heima#初始化脚本)。用命令行的话，在 `mysql>` 下输入下面的命令；脚本存到示例位置，或者把路径改成自己的保存位置：

```sql
SOURCE D:/mysql-lab/01-schema-data.sql;
```

也可以用 DataGrip 打开这个文件，确认连接后执行。脚本不会先删表；重复执行报“表已存在”，就接着用已有的练习数据，别随手清库。查询会用到的主要字段：

| id | 姓名 | 性别 | 年龄 | 工作地址 | 入职日期 | 工资 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 柳岩 | 女 | 20 | 北京 | 2020-01-01 | 8000 |
| 2 | 张无忌 | 男 | 18 | 北京 | 2021-06-01 | 6000 |
| 3 | 周芷若 | 女 | 18 | 上海 | 2022-03-01 | 7000 |
| 4 | 张三丰 | 男 | 88 | 北京 | 2000-01-01 | 20000 |
| 5 | 灭绝 | 女 | 65 | 西安 | 2005-01-01 | 15000 |
| 6 | 胡青牛 | 男 | 70 | 西安 | 2006-01-01 | 12000 |
| 7 | 赵敏 | 女 | 20 | 北京 | 2023-01-01 | 9000 |
| 8 | 韦一笑 | 男 | 38 | 天津 | 2015-01-01 | 10000 |

另外还有：

- `work_no` 工号
- `id_card` 虚构证件串：周芷若的是 `NULL`，胡青牛的以 X 结尾
- `dept_id` 部门编号、`manager_id` 主管编号：这两个关联字段先留着，多表查询时用

`PRIMARY KEY` 让 id 唯一且不能为空，`NOT NULL` 要求对应字段必须有值，约束那部分再细讲。

## 插入值必须与列对应

增删改练习用一张副表，不动上面的数据：

```sql
USE mysql_notes;
CREATE TABLE employee_edit LIKE emp;
INSERT INTO employee_edit (id, work_no, name, gender, age, entry_date)
VALUES
  (101, '00101', '小昭', '女', 18, '2024-01-01'),
  (102, '00102', '杨逍', '男', 40, '2020-05-01');
SELECT id, work_no, name, age FROM employee_edit ORDER BY id;
```

- `CREATE TABLE ... LIKE` 只复制表结构，不复制表里的数据
- `INSERT` 后面的列名决定值对应哪一列：101 对应 id，`'00101'` 对应 work_no
- 每组括号是一行，两组之间用逗号隔开
- 字符串和日期加引号，`NULL` 不加；`'NULL'` 是四个字母组成的字符串

省略列名的 `INSERT INTO employee_edit VALUES (...)` 要按表结构的顺序给出所有值。表结构一改，旧语句就可能出错，所以一般显式写出要写入的列。

没列出来的可空字段取默认值，这里 `salary` 等列默认是 `NULL`。漏了没有默认值的非空字段，严格模式下会报错。给无符号年龄写 -1、写过长的字符串、主键重复，也都会失败。别靠关严格模式来掩盖数据错误。

把 INSERT 的列和值竖着对齐，检查有没有写对：

| 列名 | 第一行输入 | 写入后的含义 |
| --- | --- | --- |
| id | 101 | 这条记录的编号 |
| work_no | `'00101'` | 保留五位格式的工号 |
| name | `'小昭'` | 员工姓名 |
| gender | `'女'` | 本例的性别值 |
| age | 18 | 数值年龄 |
| entry_date | `'2024-01-01'` | 按 DATE 类型解析的日期 |

姓名和年龄的值写反了、列名顺序没改，服务器不会因为“这看起来像姓名”就帮你纠正。它还是按位置把值交给列，再检查能不能转换、符不符合约束。所以插入出错，先查列数、对应顺序和类型，再查重复键和非空要求。

多行 INSERT 还是一条 SQL。本例是 InnoDB 表，普通 INSERT 里有一行出现重复主键之类的错误，通常整条语句都会失败，前面几组值格式正确也不代表已经存进去了。执行完用主键查一下实际结果，比看编辑器里选中了哪些行靠谱。

## 更新修改字段，删除移除整行

```sql
UPDATE employee_edit
SET name = '小昭同学', age = 19
WHERE id = 101;

DELETE FROM employee_edit WHERE id = 102;

SELECT id, name, age FROM employee_edit ORDER BY id;
```

结果只剩 `101, 小昭同学, 19`。`SET` 决定改哪些列，`WHERE` 决定改哪些行，多个赋值用逗号隔开。没写 `WHERE` 就会更新或删除整张表的数据。

只想清空某列，用 `UPDATE ... SET salary = NULL`，前提是这列允许为空。`DELETE` 的单位是行，没有“用 DELETE 删掉一行里某个字段值”的写法。删除列是 DDL 的 `ALTER TABLE ... DROP COLUMN`，完全是另一回事。

改之前可以先用同样的条件 `SELECT` 一下，核对目标行。客户端显示的“影响行数”跟连接选项和实际有没有修改有关，不一定等于匹配行数。

## SELECT 决定返回什么，WHERE 决定保留谁

```sql
SELECT name, work_no, age FROM emp;
SELECT work_address AS 工作地址 FROM emp;
SELECT DISTINCT work_address FROM emp;
```

- 第一句只返回三列
- 第二句给结果列起别名，表里的字段名不变
- 第三句去掉结果里重复的地址，得到北京、上海、西安、天津四种值；没排序就不保证出现顺序

`DISTINCT` 作用于整个选择列表。`SELECT DISTINCT work_address, gender` 去重的是“地址和性别”的组合，不是只对地址去重。`SELECT *` 临时看看可以，业务查询要写明字段，免得取回用不上的大列，也免得受表结构变化影响。

条件查询的基本写法：

```sql
SELECT id, name, age
FROM emp
WHERE age BETWEEN 18 AND 20
ORDER BY id;
```

结果是 id 1、2、3、7。`BETWEEN 18 AND 20` 包含两端，相当于 `age >= 18 AND age <= 20`。写反成 `BETWEEN 20 AND 18` 不会自动交换上下限。

| 需求 | 条件 | 在初始数据中的结果 |
| --- | --- | --- |
| 年龄等于 88 | `age = 88` | 张三丰 |
| 年龄不等于 88 | `age <> 88` 或 `age != 88` | 其余 7 人 |
| 年龄在给定列表中 | `age IN (18,20,40)` | 柳岩、张无忌、周芷若、赵敏 |
| 女性且小于 25 岁 | `gender='女' AND age<25` | 柳岩、周芷若、赵敏 |
| 姓名恰好两个字符 | `name LIKE '__'` | 柳岩、灭绝、赵敏 |
| 证件串以 X 结尾 | `id_card LIKE '%X'` | 胡青牛 |

`LIKE` 里 `_` 匹配一个字符，`%` 匹配零个或多个字符。`'%张%'` 是包含张，`'张%'` 是以张开头，两者不一样。英文分不分大小写，还要看字符串的排序规则。

`AND`、`OR` 混用时，用括号把意思写清楚：

```sql
SELECT name FROM emp
WHERE gender = '女' AND (age = 18 OR age = 20);
```

意思是：女性，且年龄是 18 或 20。不加括号的话 `AND` 比 `OR` 优先，20 岁的男性也可能被选中。

WHERE 可以理解成逐行判断。拿 `gender='女' AND (age=18 OR age=20)` 来说：

- 柳岩：女性，年龄 20，保留
- 张无忌：年龄 18，但不是女性，排除
- 灭绝：女性，但年龄既不是 18 也不是 20，排除

括号里先选出年龄，AND 再把它和性别条件合起来。

查询可以从中文需求一步步写出来。比如“找北京、20 岁以下的员工，只显示姓名和入职日期”：先确定数据来自 emp，再用 AND 连接两个条件，最后决定显示哪些列：

```sql
SELECT name,entry_date
FROM emp
WHERE work_address='北京' AND age<20
ORDER BY id;
```

初始数据里只有张无忌符合。柳岩和赵敏正好 20 岁，被 `<20` 排除了；需求要是“20 岁及以下”，就改成 `<=20`，这时有三个人。差一个等号，筛选范围就变了，别当成无所谓的语法细节。

## NULL 表示缺少值，不是零或空字符串

```sql
SELECT name FROM emp WHERE id_card IS NULL;
SELECT name FROM emp WHERE id_card IS NOT NULL;
```

第一句返回周芷若，第二句返回其余 7 人。写成 `id_card = NULL` 查不出同样的结果：普通比较碰到 NULL 得到“未知”，而 `WHERE` 只保留条件为真的行。`NULL <> 88` 也不会变成真；年龄可能为空时，查“不是 88 或没填”要写 `age <> 88 OR age IS NULL`。

这条规则也影响后面的聚合函数：统计员工总数和统计填了证件的人数，是两个问题。

三个表达式对比一下：`0=0` 为真，`''=''` 为真，`NULL=NULL` 结果还是 NULL，表示未知。NULL 就是没有确定值（不是某种“特殊文字”）。两边都没有确定值，自然没法断定它们相等。

复合条件里，未知会继续参与判断：

- `FALSE AND NULL`：左边不成立，已经能确定为假
- `TRUE OR NULL`：至少一个成立，已经能确定为真
- `TRUE AND NULL`：还是没法确定为真

WHERE 只保留真，所以筛缺失值要用 `IS NULL`，别用普通等号。

真要“两边都缺失也算相等”，MySQL 有 NULL 安全等号 `<=>`：`NULL <=> NULL` 返回 1，`1 <=> NULL` 返回 0。只在确实需要这种比较时用，别拿它替换所有普通等号。

继续阅读：[聚合、分组、排序与分页](/posts/mysql-heima-03)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-01) · [下一篇](/posts/mysql-heima-03)
