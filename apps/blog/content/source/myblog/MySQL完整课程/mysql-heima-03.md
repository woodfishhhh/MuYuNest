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

查员工明细时一行是一个员工；问“北京有多少员工”时，要把多行合成一个统计结果。聚合函数负责计算，`GROUP BY` 决定哪些行放在一起算。

示例沿用 [基础数据](/posts/mysql-heima#初始化脚本) 的 8 名员工，下面的数值都是这套数据的预期结果。

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

- `COUNT(*)` 统计行数，某一列是 NULL，这一行照样算
- `COUNT(id_card)` 只统计这一列不是 NULL 的行，所以少了周芷若
- `SUM(age)` 把年龄相加
- `AVG(age)` 是非 NULL 年龄的总和除以非 NULL 年龄的个数
- `MAX`、`MIN` 分别取最大值和最小值

这几个常见聚合函数都不让 NULL 参与计算。两个人的工资分别是 6000 和 NULL，`AVG(salary)` 是 6000，不是 3000。要把未知工资当成 0，那是另一种业务定义，得显式写出来。

聚合前也可以先筛选：

```sql
SELECT SUM(age) AS total_age
FROM emp
WHERE work_address = '西安';
```

先选出灭绝的 65 岁和胡青牛的 70 岁，相加得 135。没有任何符合条件的行时，`COUNT(*)` 是 0，`SUM`、`AVG`、`MIN`、`MAX` 一般是 NULL。要显示 0 可以用后面会讲的 `COALESCE(SUM(age), 0)`。

## 分组后，每组产生一个统计结果

```sql
SELECT gender, COUNT(*) AS people, AVG(age) AS average_age
FROM emp
GROUP BY gender;
```

先按性别把行分成两组，再在组内计算：

- 女性：年龄 20、18、65、20，4 人，平均 30.75
- 男性：年龄 18、88、70、38，4 人，平均 53.5

`GROUP BY` 不保证结果已经排好序，要固定顺序还得写 `ORDER BY`。

常见错误：

```sql
-- 反例：每组有多个 name，无法知道应该返回谁
SELECT gender, name, COUNT(*) FROM emp GROUP BY gender;
```

性别只能决定分组，决定不了姓名。MySQL 8.0 默认开启 `ONLY_FULL_GROUP_BY`，会直接拒绝这种查询；关掉这个模式，查出来的姓名也没有确定的业务意义，别拿它查“每组第一人”。分组字段能唯一决定其他字段的情况另说，比如按主键分组。详见 [MySQL 对 GROUP BY 的处理](https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html)。

## WHERE 过滤行，HAVING 过滤组

需求：只看年龄小于 45 岁的员工，找出符合条件的人数至少 3 人的工作地址。

```sql
SELECT work_address, COUNT(*) AS people
FROM emp
WHERE age < 45
GROUP BY work_address
HAVING COUNT(*) >= 3;
```

一步步推：

1. `WHERE` 排除张三丰、灭绝、胡青牛，剩下 id 1、2、3、7、8。
2. 按地址分组：北京 3 人、上海 1 人、天津 1 人。
3. `HAVING` 保留人数至少 3 的组，最终只有 `北京, 3`。

最后一个条件不能写成 `WHERE COUNT(*) >= 3`：这一层做行过滤的时候，分组计数还没算出来。反过来，把年龄条件随手挪进 HAVING，要么意思变了，要么报分组错误。

MySQL 允许 `HAVING people >= 3` 这样用聚合列的别名。这是 MySQL 支持的名称解析规则，别拿下面讲的逻辑顺序去硬推所有别名规则。

把这条查询的中间状态写出来看看。过滤完还是一批员工，没有马上变成一个计数：

| 员工 | 地址 | 年龄 |
| --- | --- | --- |
| 柳岩 | 北京 | 20 |
| 张无忌 | 北京 | 18 |
| 周芷若 | 上海 | 18 |
| 赵敏 | 北京 | 20 |
| 韦一笑 | 天津 | 38 |

GROUP BY 把三个北京员工放进同一组，上海、天津各自一组。COUNT(*) 对每组算完后，一行代表的就是一个地址，不再是一个员工了。HAVING 检查的是这张“地址和人数”的结果，所以人数不到 3 的上海、天津被排除。

这也是分组后不能随便显示姓名的原因。北京组里同时有柳岩、张无忌、赵敏，一个 name 列该放谁，没有规则就定不下来。把姓名加进 GROUP BY 也许能消掉语法错误，但“按地址统计”就变成了“按地址和姓名统计”，北京的三个人又被拆开，问的已经是另一个问题了。

多字段分组有用，但要看需求。比如统计每个地址的男女员工人数：

```sql
SELECT work_address,gender,COUNT(*) AS people
FROM emp
GROUP BY work_address,gender
ORDER BY work_address,gender;
```

这时一组由两个值一起确定：北京女性是柳岩、赵敏，2 人；北京男性是张无忌、张三丰，2 人；西安也拆成一名女性和一名男性。同一地址的人要不要再拆开，是查询自己要求的，别跟只按地址分组搞混。

## 编写顺序与逻辑处理顺序

SQL 一般按这个顺序写：

```sql
SELECT 字段或表达式
FROM 表
WHERE 行条件
GROUP BY 分组字段
HAVING 组条件
ORDER BY 排序字段
LIMIT 偏移量, 数量;
```

推导结果时按 `FROM → WHERE → GROUP BY/聚合 → HAVING → SELECT → ORDER BY → LIMIT` 来想。这是逻辑顺序；实际执行时优化器可能调整访问和过滤方式，不会真的每一步都生成一张中间表。

例如：

```sql
SELECT e.name, e.age AS employee_age
FROM emp AS e
WHERE e.age > 15
ORDER BY employee_age, e.id;
```

`e` 是表别名，WHERE 里能用。`employee_age` 是结果列别名，ORDER BY 里能用，但不能写成 `WHERE employee_age > 15`，WHERE 里要用原字段或原表达式。

这个顺序还能解释一个常见错误：“先取前五个员工，再按工资排序”和“先按工资排序，再取前五个”，拿到的不是同一批人。前者只在已经选中的五个人里排序，后者才是从全部候选里取工资最高的五个。普通 SELECT 里 ORDER BY 和 LIMIT 的逻辑关系是后者；真要前者，得显式多加一层查询，光调换关键字在 SQL 里的先后没用。

## 多个排序字段逐级打破并列

```sql
SELECT id, name, age, entry_date
FROM emp
ORDER BY age ASC, entry_date DESC, id ASC;
```

先比年龄，年龄相同再比入职日期，两者都相同再比 id。`ASC` 是升序，也是默认值；`DESC` 是降序。每个字段单独指定方向，最后一个 DESC 管不到前面的字段。

前四名是周芷若、张无忌、赵敏、柳岩：先是两个 18 岁，再是两个 20 岁，同龄的里面入职晚的排前面。最后加上唯一的 id，是为了让最终顺序稳定，分页时尤其有用。

## LIMIT 的第一个参数是跳过多少行

每页 3 人，页码从 1 开始，偏移量就是 `(页码 - 1) × 3`：

```sql
SELECT id, name FROM emp ORDER BY id LIMIT 0, 3;
SELECT id, name FROM emp ORDER BY id LIMIT 3, 3;
SELECT id, name FROM emp ORDER BY id LIMIT 6, 3;
```

三页分别是 id `[1,2,3]`、`[4,5,6]`、`[7,8]`，最后一页不满 3 行很正常。`LIMIT 3` 是 `LIMIT 0,3` 的简写；第二页不是 `LIMIT 2,3`。

没有 `ORDER BY`，分页就没有稳定的保证。就算按年龄排了，同龄人的先后还是可能变，要再补一个唯一字段。翻到很靠后的页时，大偏移量还可能有性能开销，索引优化那部分再讲。

偏移量从 0 开始，对应的是排好序之后的位置。`LIMIT 3,3` 先跳过位置 0、1、2 的三行，再取位置 3、4、5，跟“编号 3”没关系，LIMIT 根本不懂 id 的业务含义。就算 id 是 10、20、100，偏移量也只是结果里的位置。

第一页也一样：不写稳定排序，就别默认它“从最早插入的记录开始”。数据库选的索引不同，返回顺序就可能变；这次碰巧按主键排了，也不是 SQL 保证的顺序。把唯一 id 放在排序最后，用来打破并列，同一批数据的分页边界才是确定的。

## 把多个查询要求合成一条 SQL

需求：查询年龄在 20～40 岁的男性，按年龄升序、入职日期升序，取前 5 人：

```sql
SELECT id, name, age, entry_date
FROM emp
WHERE gender = '男' AND age BETWEEN 20 AND 40
ORDER BY age ASC, entry_date ASC, id ASC
LIMIT 5;
```

初始数据里只有韦一笑符合，最终只返回一行。`LIMIT 5` 是最多取 5 行，不够不会补。

再看“60 岁以下男女各有多少人”：

```sql
SELECT gender, COUNT(*) AS people
FROM emp
WHERE age < 60
GROUP BY gender;
```

女性 3 人，男性 2 人。先排除年龄不符的明细，再分组统计；别先统计全部员工，再想办法从计数里减掉某几个人。

继续阅读：[账户与权限](/posts/mysql-heima-04)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-02) · [下一篇](/posts/mysql-heima-04)
