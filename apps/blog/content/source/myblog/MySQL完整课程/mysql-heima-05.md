---
title: "MySQL（05）：函数与条件表达式"
date: 2026-10-17 00:00:00
slug: mysql-heima-05
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

表里存的是原始值，页面要的可能是“入职多少天”“成绩是否优秀”“补齐到五位的工号”。函数接收输入、返回结果，可以放进 SELECT 生成结果列，也可以放进 UPDATE 算出新值。

## 字符串处理不能混淆字符与位置

下面这些不依赖表，可以直接在 SQL 控制台执行：

```sql
SELECT CONCAT('Hello', ' ', 'MySQL'); -- Hello MySQL
SELECT LOWER('Hello'), UPPER('Hello'); -- hello、HELLO
SELECT LPAD('12', 5, '0'), RPAD('12', 5, '0'); -- 00012、12000
SELECT TRIM('  hello  mysql  '); -- hello 与 mysql 中间的两个空格仍在
SELECT SUBSTRING('Hello MySQL', 1, 5); -- Hello
```

- `CONCAT` 拼接参数，不会自动加空格；普通 CONCAT 只要有一个参数是 NULL，结果就是 NULL
- `LOWER`、`UPPER` 转换字母大小写
- `TRIM` 默认去掉两端空格，中间的空格不管，也不负责规范化所有空白字符

`SUBSTRING` 的位置从 1 开始，第三个参数是长度。别照搬 JavaScript 从 0 开始的索引，也别把它当成结束位置。`SUBSTRING('Hello MySQL',7,5)` 才能取到 MySQL。

工号补零，先查询预览，再更新：

```sql
SELECT work_no, LPAD(work_no, 5, '0') AS new_work_no
FROM employee_edit;

UPDATE employee_edit
SET work_no = LPAD(work_no, 5, '0')
WHERE CHAR_LENGTH(work_no) < 5;
```

这里的 `employee_edit` 来自 [增删改练习](/posts/mysql-heima-02)，已经是五位的工号不会变。额外限制长度，是因为 `LPAD` 的目标长度比原字符串短时会把原值截短，六位工号会无意间丢掉末位。补零后还是要用字符串类型，换成数值类型前导零又会丢掉。

组合函数时，从最里面的输入往外看。比如要显示“姓名（工号）”：

```sql
SELECT id,CONCAT(name,'（',work_no,'）') AS employee_label
FROM emp ORDER BY id;
```

柳岩这一行依次取姓名“柳岩”、左括号、工号“00001”、右括号，拼成 `柳岩（00001）`。原表里姓名和工号没有合并，还是两列，变的只是查询结果。以后按工号筛选还是用 work_no，不用把这段展示文字拆回来。

拼接证件串时，周芷若的 NULL 会让 `CONCAT(name,'：',id_card)` 整个变成 NULL，连姓名都不显示。要先定好缺失值怎么显示，再把它变成字符串：

```sql
SELECT name,CONCAT(name,'：',IFNULL(id_card,'未填写')) AS card_label
FROM emp ORDER BY id;
```

IFNULL 先执行，周芷若的证件部分变成“未填写”，外层 CONCAT 才拼出完整标签。看函数嵌套就顺着值的变化走：内层的返回值，要符合外层下一步的需要。

## 取整、余数和随机数

```sql
SELECT CEIL(1.1), FLOOR(1.9), MOD(7,4); -- 2、1、3
SELECT CEIL(-1.1), FLOOR(-1.1); -- -1、-2
SELECT ROUND(2.345, 2); -- 精确小数字面量得到 2.35
SELECT RAND(); -- 大于等于 0、小于 1
```

- 向上、向下取整是沿数轴的方向，不是“去掉小数”，所以 `FLOOR(-1.1)` 是 -2
- `MOD(7,4)` 是 7 除以 4 的余数
- `ROUND(x,2)` 保留两位小数；近似浮点数在边界上的舍入还受表示方式影响，金额要用 DECIMAL 这类精确类型

组合函数生成六位数字字符串：

```sql
SELECT LPAD(FLOOR(RAND() * 1000000), 6, '0') AS sample_code;
```

推导：

1. RAND 在 `[0,1)`
2. 乘以一百万得到 `[0,1000000)`
3. FLOOR 得到 0～999999 的整数
4. LPAD 把不足六位的补齐，比如整数 19255 变成字符串 `019255`

这里不能用 `ROUND(...,0)` 代替 FLOOR：接近上界的数可能被四舍五入成 1000000，再被 LPAD 截短，原来的映射就乱了。这条 SQL 只是演示函数组合；真实的登录验证码要由应用用密码学安全的随机源生成，还要管有效期、重试次数和使用状态，不能只靠 RAND。

## 日期差先明确方向和单位

```sql
SELECT CURDATE(), CURTIME(), NOW();
SELECT YEAR('2024-03-15'), MONTH('2024-03-15'), DAY('2024-03-15');
SELECT DATE_ADD('2024-01-01', INTERVAL 70 DAY); -- 2024-03-11
SELECT DATEDIFF('2024-03-01', '2024-02-28'); -- 2，2024 是闰年
```

CURDATE 返回当前日期，CURTIME 返回当前时间，NOW 返回日期和时间。结果随执行时刻和会话时区变化，别拿视频里的固定日期当自己的预期输出。

`DATE_ADD` 的 INTERVAL 后面依次是数量和单位，单位可以用 DAY、MONTH、YEAR。一个月不是固定 30 天，涉及月底时按日历规则理解。

`DATEDIFF(a,b)` 是 a 的日期减 b 的日期，忽略时分秒，参数调换结果就变号。统计入职天数时，把每个员工的入职日期放在第二个参数：

```sql
SELECT name,
       DATEDIFF('2024-01-01', entry_date) AS days_employed
FROM emp
ORDER BY days_employed DESC, id;
```

示例把统计日期固定成 2024-01-01，方便核对：赵敏 365 天，柳岩 1461 天（中间有闰年 2020）。真要统计“截至今天”，把常量换成 CURDATE。业务上如果入职当天算第 1 天，要在定义里写清楚加不加 1，日期差不能直接套用到所有考勤规则上。

正负可以用时间线看：入职日 2023-01-01，统计日 2024-01-01，从前者走到后者经过 365 天，所以 `DATEDIFF(统计日,入职日)` 为正。参数交换后方向反过来，得到 -365。SQL 不会报错，两种方向都合法，只是后一种回答的不是“已入职多久”。

入职日还没到的人，DATEDIFF 会得到负数。允不允许未来入职的记录，页面显示“还有几天入职”还是直接排除，是业务规则。函数只算差值，不会替你把不合预期的数据改成零。

## IFNULL 只判断 NULL

```sql
SELECT IF(80 >= 60, '及格', '不及格'); -- 及格
SELECT IFNULL(NULL, '未填写'); -- 未填写
SELECT IFNULL('', '未填写'); -- 仍是空字符串
SELECT COALESCE(NULL, NULL, '待定'); -- 待定
```

- IF：第一个参数是条件，后两个分别是真、假时的结果
- IFNULL：只检查 NULL，空字符串、数字 0 不会被当成缺失
- COALESCE：从左往右返回第一个非 NULL 参数，适合有多个备选值的情况

```sql
SELECT name, IFNULL(id_card, '未填写') AS card_display
FROM emp ORDER BY id;
```

这里只改了查询显示，原表里周芷若的证件字段还是 NULL；SELECT 不会把显示用的文字写回表。

## CASE 按第一个命中的分支返回

等值映射用简单 CASE：

```sql
SELECT name,
       CASE work_address
         WHEN '北京' THEN '京沪'
         WHEN '上海' THEN '京沪'
         ELSE '其他地区'
       END AS area_group
FROM emp;
```

CASE 后面写要比较的值，每个 WHEN 写候选值。这是人为定的业务分组，不是对城市等级的客观判定。

成绩判断要比较范围，用搜索 CASE。先准备完整数据：

```sql
CREATE TABLE score (
  id INT PRIMARY KEY,
  name VARCHAR(20),
  math DECIMAL(4,1),
  english DECIMAL(4,1),
  chinese DECIMAL(4,1)
);
INSERT INTO score VALUES
  (1,'Tom',98,75,59),
  (2,'Rose',85,60,90),
  (3,'Jack',59,NULL,80);

SELECT name,
  CASE
    WHEN math IS NULL THEN '未录入'
    WHEN math >= 85 THEN '优秀'
    WHEN math >= 60 THEN '及格'
    ELSE '不及格'
  END AS math_level,
  CASE
    WHEN english IS NULL THEN '未录入'
    WHEN english >= 85 THEN '优秀'
    WHEN english >= 60 THEN '及格'
    ELSE '不及格'
  END AS english_level,
  CASE
    WHEN chinese IS NULL THEN '未录入'
    WHEN chinese >= 85 THEN '优秀'
    WHEN chinese >= 60 THEN '及格'
    ELSE '不及格'
  END AS chinese_level
FROM score ORDER BY id;
```

结果：

- Tom：优秀、及格、不及格
- Rose：优秀、及格、优秀
- Jack：不及格、未录入、及格

85 先命中优秀，60 命中及格。分支顺序要注意：

- 把 `>=60` 放到 `>=85` 前面，高分也会先被归成及格
- 不单独处理 NULL，未录入的成绩会落进 ELSE，被误判成不及格

这些表达式适合用来生成展示结果。把函数用在筛选列上会不会影响索引，要看具体函数和索引设计，代码短了不代表查询就快了。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-04) · [下一篇](/posts/mysql-heima-06)
