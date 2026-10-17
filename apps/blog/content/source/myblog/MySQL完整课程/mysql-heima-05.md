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

表里保存的是原始值，页面需要的却可能是“入职多少天”“成绩是否优秀”“补齐到五位的工号”。函数接收输入并返回结果，可以放进 SELECT 形成结果列，也可以放进 UPDATE 生成新值。

## 字符串处理不能混淆字符与位置

下面的表达式不依赖表，可以直接在 SQL 控制台执行：

```sql
SELECT CONCAT('Hello', ' ', 'MySQL'); -- Hello MySQL
SELECT LOWER('Hello'), UPPER('Hello'); -- hello、HELLO
SELECT LPAD('12', 5, '0'), RPAD('12', 5, '0'); -- 00012、12000
SELECT TRIM('  hello  mysql  '); -- hello 与 mysql 中间的两个空格仍在
SELECT SUBSTRING('Hello MySQL', 1, 5); -- Hello
```

`CONCAT` 拼接参数，不会自动插入空格；普通 CONCAT 的任一参数为 NULL 时，结果也为 NULL。`LOWER`、`UPPER` 转换字母大小写。`TRIM` 默认移除两端空格，并不负责删除中间空格或规范化所有空白字符。

`SUBSTRING` 的位置从 1 开始，第三个参数是长度，不能照搬 JavaScript 从 0 开始的索引或把它当作结束位置。`SUBSTRING('Hello MySQL',7,5)` 才会取得 MySQL。

工号补零可以先查询预览，再更新：

```sql
SELECT work_no, LPAD(work_no, 5, '0') AS new_work_no
FROM employee_edit;

UPDATE employee_edit
SET work_no = LPAD(work_no, 5, '0')
WHERE CHAR_LENGTH(work_no) < 5;
```

这里的 `employee_edit` 来自 [增删改练习](/posts/mysql-heima-02)，已有五位工号时无需变化。额外限制长度，是因为 `LPAD` 的目标长度小于原字符串时会截短原值；不能让一个六位工号无意间丢掉末位。补零后仍应使用字符串类型，否则数值类型会再次丢掉前导零。

组合函数时，先看最里面的输入，再往外展开。例如需要显示“姓名（工号）”：

```sql
SELECT id,CONCAT(name,'（',work_no,'）') AS employee_label
FROM emp ORDER BY id;
```

柳岩这一行依次取得姓名“柳岩”、左括号、工号“00001”和右括号，拼成 `柳岩（00001）`。原表中的姓名和工号没有合并，它们仍是两列；变化发生在查询结果中。以后要按工号筛选，仍然使用 work_no，而不是先把整段展示文字拆回来。

如果拼接证件串，周芷若的 NULL 会带来另一种结果：`CONCAT(name,'：',id_card)` 整体为 NULL，连姓名也不显示。应该先确定缺失值的展示规则，再把它变成字符串：

```sql
SELECT name,CONCAT(name,'：',IFNULL(id_card,'未填写')) AS card_label
FROM emp ORDER BY id;
```

这里 IFNULL 先执行，周芷若的证件部分变成“未填写”，外层 CONCAT 才得到完整标签。函数嵌套需要这样沿值的变化理解：内层的返回值，要符合外层下一步需要的含义。

## 取整、余数和随机数

```sql
SELECT CEIL(1.1), FLOOR(1.9), MOD(7,4); -- 2、1、3
SELECT CEIL(-1.1), FLOOR(-1.1); -- -1、-2
SELECT ROUND(2.345, 2); -- 精确小数字面量得到 2.35
SELECT RAND(); -- 大于等于 0、小于 1
```

向上、向下是沿数轴方向，不是“去掉小数”。因此负数的 `FLOOR(-1.1)` 是 -2。`MOD(7,4)` 是 7 除以 4 的余数。`ROUND(x,2)` 保留两位小数，近似浮点输入的边界舍入还会受到表示方式影响，金额应使用 DECIMAL 等精确类型。

要生成六位数字字符串，可以组合函数：

```sql
SELECT LPAD(FLOOR(RAND() * 1000000), 6, '0') AS sample_code;
```

推导过程是：RAND 在 `[0,1)`；乘以一百万得到 `[0,1000000)`；FLOOR 得到 0～999999 的整数；LPAD 把不足六位的结果补齐。例如整数 19255 变为字符串 `019255`。

这里不能用 `ROUND(...,0)` 替代 FLOOR。接近上界的数可能被四舍五入成 1000000，再被 LPAD 截短，破坏原本的映射。这个 SQL 适合演示函数组合；真实登录验证码应由应用使用密码学安全随机源生成，并管理有效期、重试次数和使用状态，不能只依赖 RAND。

## 日期差先明确方向和单位

```sql
SELECT CURDATE(), CURTIME(), NOW();
SELECT YEAR('2024-03-15'), MONTH('2024-03-15'), DAY('2024-03-15');
SELECT DATE_ADD('2024-01-01', INTERVAL 70 DAY); -- 2024-03-11
SELECT DATEDIFF('2024-03-01', '2024-02-28'); -- 2，2024 是闰年
```

CURDATE 返回当前日期，CURTIME 返回当前时间，NOW 返回日期和时间。它们会随执行时刻与会话时区变化，不能拿视频中的固定日期当成自己的预期输出。

`DATE_ADD` 的 INTERVAL 后依次是数量和单位，可以使用 DAY、MONTH、YEAR。一个月不等于固定 30 天；涉及月底时应按日历规则理解。

`DATEDIFF(a,b)` 用 a 的日期减去 b 的日期，忽略时分秒。调换参数后结果变号。要统计入职天数，可以把每个员工的入职日期作为第二个参数：

```sql
SELECT name,
       DATEDIFF('2024-01-01', entry_date) AS days_employed
FROM emp
ORDER BY days_employed DESC, id;
```

示例把统计日期固定为 2024-01-01，便于复核：赵敏为 365 天，柳岩为 1461 天，其中包含闰年 2020。真正统计“截至今天”时把常量替换为 CURDATE。若业务把入职当天算第 1 天，应在定义上说明是否加 1，不能把日期差直接当作所有考勤规则。

日期差的正负可以先用时间线解释。入职日为 2023-01-01，统计日为 2024-01-01，从前者走到后者经过 365 天，所以 `DATEDIFF(统计日,入职日)` 为正。若交换两个参数，计算的方向反过来，就得到 -365。SQL 没有报错，因为两种方向都合法，只是后一种没有回答“已入职多久”。

若某人的入职日还没到，DATEDIFF 会产生负数。是否允许未来入职记录，页面显示“还有几天入职”还是排除它，是业务规则。函数只负责计算差值，不会替你把不符合预期的数据改成零。

## IFNULL 只判断 NULL

```sql
SELECT IF(80 >= 60, '及格', '不及格'); -- 及格
SELECT IFNULL(NULL, '未填写'); -- 未填写
SELECT IFNULL('', '未填写'); -- 仍是空字符串
SELECT COALESCE(NULL, NULL, '待定'); -- 待定
```

IF 的第一个参数是条件，后两个分别是真、假时的结果。IFNULL 检查缺失值，不会把空字符串、数字 0 自动当作缺失。COALESCE 返回从左往右第一个非 NULL 参数，适合多个备选值。

```sql
SELECT name, IFNULL(id_card, '未填写') AS card_display
FROM emp ORDER BY id;
```

这里只改变查询显示，周芷若在原表中的证件字段仍是 NULL；SELECT 不会把默认显示文字写回表。

## CASE 按第一个命中的分支返回

等值映射使用简单 CASE：

```sql
SELECT name,
       CASE work_address
         WHEN '北京' THEN '京沪'
         WHEN '上海' THEN '京沪'
         ELSE '其他地区'
       END AS area_group
FROM emp;
```

CASE 后给出待比较的值，每个 WHEN 给出候选值。这是人为定义的业务分组，不是对城市等级的客观判定。

成绩判断需要比较范围，应使用搜索 CASE。先准备完整数据：

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

Tom 得到“优秀、及格、不及格”，Rose 得到“优秀、及格、优秀”，Jack 得到“不及格、未录入、及格”。85 先命中优秀，60 命中及格。若把 `>=60` 放在 `>=85` 前面，高分也会先被归为及格；若不单独处理 NULL，未录入成绩会落入 ELSE 而被误判为不及格。

这些表达式适合形成展示结果。把函数用在筛选列上是否影响索引，需要看具体函数和索引设计，不能从“代码短了”直接推断“查询更快了”。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-04) · [下一篇](/posts/mysql-heima-06)
