---
title: "MySQL（03）：聚合、分组、排序与分页"
date: 2026-10-17 00:00:00
slug: mysql-heima-03
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

查询员工明细时，一行对应一个员工；问“北京有多少员工”时，需要把多行合成一个统计结果。聚合函数完成计算，`GROUP BY` 决定哪些行一起计算。

示例沿用 [基础数据](/posts/mysql-heima#初始化脚本) 的 8 名员工。下列数值均是这套数据的预期结果。

## COUNT、SUM 和 AVG 计算的对象不同

```sql
SELECT COUNT(*) AS total,
       COUNT(id_card) AS with_card,
       MIN(age) AS youngest,
       MAX(age) AS oldest,
       SUM(age) AS total_age,
       AVG(age) AS average_age
FROM emp;
```

预期得到 `8, 7, 18, 88, 337, 42.125`。

`COUNT(*)` 统计行数，即使某一列为 NULL，这一行仍存在。`COUNT(id_card)` 只统计该列不是 NULL 的行，因此少了周芷若。`SUM(age)` 把年龄相加，`AVG(age)` 用非 NULL 年龄的总和除以非 NULL 年龄的个数，`MAX`、`MIN` 分别取最大值和最小值。

对于这里的常见聚合函数，NULL 不参加列值计算。假如只知道两个人的工资分别是 6000 和 NULL，`AVG(salary)` 是 6000，不是 3000。把未知工资当成零是另一种业务定义，必须显式表达。

聚合前同样可以筛选：

```sql
SELECT SUM(age) AS total_age
FROM emp
WHERE work_address = '西安';
```

先选出灭绝的 65 岁和胡青牛的 70 岁，再相加，结果为 135。若没有任何符合条件的行，`COUNT(*)` 为 0，而 `SUM`、`AVG`、`MIN`、`MAX` 通常为 NULL。需要展示 0 时可以用后面会讲的 `COALESCE(SUM(age), 0)`。

## 分组后，每组产生一个统计结果

```sql
SELECT gender, COUNT(*) AS people, AVG(age) AS average_age
FROM emp
GROUP BY gender;
```

先按照性别把行分成两组，再在每组内计算。女性年龄为 20、18、65、20，人数 4，平均 30.75；男性年龄为 18、88、70、38，人数 4，平均 53.5。

`GROUP BY` 不代表查询结果已经排序；需要固定顺序还应写 `ORDER BY`。

一个常见错误是：

```sql
-- 反例：每组有多个 name，无法知道应该返回谁
SELECT gender, name, COUNT(*) FROM emp GROUP BY gender;
```

性别只能决定组，不能唯一决定姓名。默认启用 `ONLY_FULL_GROUP_BY` 的 MySQL 8.0 会拒绝这类查询；关闭该模式后得到的姓名也没有确定业务意义。不要用它查“每组第一人”。分组字段能唯一决定其他字段等情况另当别论，例如按主键分组。详见 [MySQL 对 GROUP BY 的处理](https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html)。

## WHERE 过滤行，HAVING 过滤组

需求：只考虑年龄小于 45 岁的员工，找出符合条件人数至少 3 人的工作地址。

```sql
SELECT work_address, COUNT(*) AS people
FROM emp
WHERE age < 45
GROUP BY work_address
HAVING COUNT(*) >= 3;
```

推导过程不能跳过：

1. `WHERE` 排除张三丰、灭绝、胡青牛，剩下 id 1、2、3、7、8。
2. 按地址分组：北京 3 人、上海 1 人、天津 1 人。
3. `HAVING` 保留人数至少 3 的组，最终只有 `北京, 3`。

不能把最后一个条件写成 `WHERE COUNT(*) >= 3`，因为这个查询层的行过滤发生时，分组计数还没形成。反过来把年龄条件随意移到 HAVING，也会改变语义或触发分组错误。

MySQL 允许 `HAVING people >= 3` 使用聚合列的别名。这是 MySQL 支持的名称解析规则，不能把下面的逻辑顺序机械当成所有别名规则的证明。

还可以把上面这条查询的中间状态写出来。过滤后的数据并没有马上变成一个计数，它仍然是一组员工：

| 员工 | 地址 | 年龄 |
| --- | --- | --- |
| 柳岩 | 北京 | 20 |
| 张无忌 | 北京 | 18 |
| 周芷若 | 上海 | 18 |
| 赵敏 | 北京 | 20 |
| 韦一笑 | 天津 | 38 |

GROUP BY 在逻辑上把前三个北京员工装进同一组，把上海、天津分别装进自己的组。COUNT(*) 对每组计算后，结果的粒度已经改变：现在一行代表一个地址，不再代表一个员工。HAVING 检查的是这张“地址与人数”的结果，所以人数不足 3 的上海和天津会被排除。

这个粒度变化也解释了为什么分组后不能随便展示姓名。北京组里同时有柳岩、张无忌、赵敏，单个 name 列究竟放谁，没有规则就无法确定。把姓名加入 GROUP BY 虽然可能消除语法错误，却会把“按地址统计”改成“按地址与姓名统计”，北京的三人又被拆开了，业务问题也随之改变。

多字段分组确实有用，只是需要由需求决定。例如统计每个地址的男女员工人数：

```sql
SELECT work_address,gender,COUNT(*) AS people
FROM emp
GROUP BY work_address,gender
ORDER BY work_address,gender;
```

此时一组由两个值共同标识。北京女性是柳岩、赵敏，共 2 人；北京男性是张无忌、张三丰，共 2 人。西安也分为一名女性和一名男性。是否把同地址的人再拆开，是查询主动要求的结果，不能把它与单地址分组混为一谈。

## 编写顺序与逻辑处理顺序

SQL 通常按下面的顺序书写：

```sql
SELECT 字段或表达式
FROM 表
WHERE 行条件
GROUP BY 分组字段
HAVING 组条件
ORDER BY 排序字段
LIMIT 偏移量, 数量;
```

理解结果时，可以按 `FROM → WHERE → GROUP BY/聚合 → HAVING → SELECT → ORDER BY → LIMIT` 推导。它是逻辑解释顺序；实际执行时，优化器可能调整访问和过滤方式，不会真的为每一步都生成一张中间表。

例如：

```sql
SELECT e.name, e.age AS employee_age
FROM emp AS e
WHERE e.age > 15
ORDER BY employee_age, e.id;
```

`e` 是表别名，能在 WHERE 中使用。`employee_age` 是结果列别名，能在 ORDER BY 中使用，却不能把 WHERE 改成 `WHERE employee_age > 15`。在那里应使用原字段或原表达式。

这套顺序还可以用来解释一个常见错误：“先取前五个员工，再按工资排序”和“先按工资排序，再取前五个”得到的并不是同一批人。前者只在已经选中的五人中排序，后者才是从全部候选里取工资最高的五人。普通 SELECT 中 ORDER BY 与 LIMIT 的逻辑关系对应后者；如果确实要前者，就需要显式增加查询层次，不能只调整 SQL 文本中关键字的先后。

## 多个排序字段逐级打破并列

```sql
SELECT id, name, age, entry_date
FROM emp
ORDER BY age ASC, entry_date DESC, id ASC;
```

先比较年龄，年龄相同才比较入职日期，两者都相同再比较 id。`ASC` 为升序且是默认值，`DESC` 为降序。每一个字段都独立指定方向，并不是最后一个 DESC 控制全部字段。

前四名应为周芷若、张无忌、赵敏、柳岩：先是两个 18 岁，再是两个 20 岁；每个年龄组里较晚入职者排前面。加唯一 id 是为了最终顺序稳定，尤其方便分页。

## LIMIT 的第一个参数是跳过多少行

每页 3 人，页码从 1 开始，则偏移量为 `(页码 - 1) × 3`：

```sql
SELECT id, name FROM emp ORDER BY id LIMIT 0, 3;
SELECT id, name FROM emp ORDER BY id LIMIT 3, 3;
SELECT id, name FROM emp ORDER BY id LIMIT 6, 3;
```

三页分别得到 id `[1,2,3]`、`[4,5,6]`、`[7,8]`。最后一页不足 3 行很正常。`LIMIT 3` 是 `LIMIT 0,3` 的简写；第二页不是 `LIMIT 2,3`。

没有 `ORDER BY` 就没有稳定分页的保证。即使按年龄排序，同龄人的先后仍可能变化，应补充唯一字段。翻到很后的页时，大偏移量还可能带来性能开销，索引优化部分会继续解释。

偏移量从 0 开始，可以直接对应到排好序的位置。`LIMIT 3,3` 先丢弃位置 0、1、2 的三行，再取位置 3、4、5；它不是从“编号 3”开始，因为 LIMIT 根本不理解 id 的业务含义。即使 id 为 10、20、100，偏移量依然只是结果中的位置。

第一页也不能省略稳定排序后就默认“从最早插入的记录开始”。数据库选择不同索引时，返回顺序可能变化；即使本次恰好按主键排列，也不构成 SQL 的顺序保证。把唯一 id 放在最后作为并列时的判断依据，才让同一组数据的分页边界明确。

## 把多个查询要求合成一条 SQL

需求：查询年龄在 20～40 岁的男性，按年龄升序、入职日期升序，取前 5 人：

```sql
SELECT id, name, age, entry_date
FROM emp
WHERE gender = '男' AND age BETWEEN 20 AND 40
ORDER BY age ASC, entry_date ASC, id ASC
LIMIT 5;
```

初始数据中只有韦一笑符合，最终返回一行。`LIMIT 5` 是最多取 5 行，不会补足缺少的记录。

再看“60 岁以下男女各有多少人”：

```sql
SELECT gender, COUNT(*) AS people
FROM emp
WHERE age < 60
GROUP BY gender;
```

女性 3 人，男性 2 人。这里先排除年龄不符的明细，再统计各组；不要先统计全部员工后才试图从计数结果中减掉某几个姓名。

继续阅读：[账户与权限](/posts/mysql-heima-04)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-02) · [下一篇](/posts/mysql-heima-04)
