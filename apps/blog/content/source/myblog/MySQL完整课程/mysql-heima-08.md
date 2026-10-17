---
title: "MySQL（08）：子查询与相关查询"
date: 2026-10-17 00:00:00
slug: mysql-heima-08
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

“工资高于灭绝的人”需要先知道灭绝的工资，再拿它作筛选条件。把第一个 SELECT 写进第二个 SELECT，内部查询就是子查询。先判断它返回几行几列，再选择等号、IN、ANY 或 ALL，能避免很多语法和语义错误。

## 单值结果用标量子查询

```sql
SELECT id,name,salary
FROM emp
WHERE salary > (SELECT salary FROM emp WHERE id=5);
```

id 5 是灭绝，子查询返回一行一列的 15000；外层只返回工资 20000 的张三丰。使用唯一 id 是为了保证子查询最多一行。如果按姓名查询，而表里有同名员工，子查询返回多行时会报错，不能随便加 LIMIT 1 掩盖身份不明确的问题。

标量子查询没有返回行时，作为值使用得到 NULL；普通大小比较遇到 NULL 为未知，WHERE 不会保留该行。

另一个例子是查询比柳岩晚入职的人：

```sql
SELECT id,name,entry_date FROM emp
WHERE entry_date > (SELECT entry_date FROM emp WHERE id=1)
ORDER BY id;
```

比较基准为 2020-01-01，返回张无忌、周芷若、赵敏。

“标量”描述的是结果形状：一行一列，能当作一个值放在比较符号右边。不要按子查询写了几行代码来判断。`SELECT AVG(salary) FROM emp` 没有 GROUP BY，通常产生一个聚合结果，即使它读取了很多员工，也仍是标量；`SELECT salary FROM emp` 则可能返回八行，不能直接接在一个要求单值的等号右侧。

外层和内层的列也有各自作用。在“工资高于灭绝”的查询里，内层 salary 只负责求比较基准 15000，外层 salary 是每名候选员工自己的工资。将这两个角色分清，才能解释为什么最终只留下张三丰，而不是把灭绝那一行也一起拼到输出中。

## 一列多行用 IN，不能强塞进等号

```sql
SELECT id,name FROM emp
WHERE dept_id IN (
  SELECT id FROM dept WHERE name IN ('研发部','人事部')
)
ORDER BY id;
```

子查询给出部门集合 `{1,2}`，外层返回 id 1、2、3、4、5、7。IN 的问题是“在不在集合中”，不是“是否等于一个单值”。

`NOT IN` 遇到 NULL 容易违背直觉。例如 `3 NOT IN (1,NULL)` 不能确定为真，因为无法判断 3 是否等于那个未知值。若子查询可能有 NULL，可以过滤它，或者改用表达“不存在匹配行”的 NOT EXISTS：

```sql
SELECT d.id,d.name
FROM dept AS d
WHERE NOT EXISTS (
  SELECT 1 FROM emp AS e WHERE e.dept_id=d.id
);
```

返回市场部。EXISTS 只关心有没有行，不关心 SELECT 列的具体数值；写 1 是说明其内容无关。这里内层用到了外层 d.id，因此是相关子查询。

NOT IN 的 NULL 问题可以直接展开：`3 NOT IN (1,NULL)` 相当于要求“3 不等于 1，并且 3 不等于 NULL”。第一部分为真，第二部分未知，整体无法确定为真，所以 WHERE 不保留它。即使直觉上觉得“3 明明不在列表里”，列表中的未知值也使这个判断缺少依据。

NOT EXISTS 问的是另一件事：能不能找到一行部门编号等于当前部门 ID 的员工。对于市场部 id=4，逐个检查员工时没有一行满足 e.dept_id=4，子查询没有行，NOT EXISTS 就为真。韦一笑的 NULL 不会生成匹配，却也不会把“是否存在匹配行”整体变成未知。

## ANY 是至少一个，ALL 是全部

```sql
SELECT name,salary FROM emp
WHERE salary > ANY (SELECT salary FROM emp WHERE dept_id=1);

SELECT name,salary FROM emp
WHERE salary > ALL (SELECT salary FROM emp WHERE dept_id=2);
```

研发部工资为 8000、6000、20000、9000。大于 ANY 只需大于其中至少一个，所以工资大于 6000 的 7 人都符合，张无忌不符合。SOME 与 ANY 同义，注意不是聚合函数 SUM。

人事部工资为 7000、15000。大于 ALL 要同时大于这两个数，因此只有张三丰符合。

当子查询非空且不含 NULL 时，`> ANY` 可以按“大于最小值”理解，`> ALL` 可以按“大于最大值”理解。遇到空集或 NULL 时不能无条件改写：`> ALL(空集)` 为真，`> ANY(空集)` 为假，而 MAX/MIN 对空集返回 NULL。这是集合判断和单值比较的区别。

用工资 9000 分别比较 `{7000,15000}`，可以更直接看出两种量词的区别。`9000>7000` 为真，`9000>15000` 为假；ANY 只需要一个真，因此通过；ALL 需要两次都为真，因此不通过。对于工资 20000，两次都为真，所以二者都通过。判断顺序不改变这个定义。

当比较改成 `< ALL` 时，需要比集合中的每个值都小，非空无 NULL 的情况下等同于“小于最小值”。`< ANY` 只需小于其中某一个，才对应“小于最大值”。记住“至少一个”和“每一个”，比硬背一张大于小于转换表更容易在新条件中判断。

## 多列结果必须作为一个组合比较

查询与柳岩工资和主管相同的人：

```sql
SELECT id,name FROM emp
WHERE (salary,manager_id) = (
  SELECT salary,manager_id FROM emp WHERE id=1
);
```

子查询返回 `(8000,4)`。外层需要两个字段同时匹配，所以当前只返回柳岩自己。若需求是“其他同事”，再加 `AND id<>1`，结果为空。

若比较对象是多个人，可用元组 IN：

```sql
SELECT id,name FROM emp
WHERE (salary,manager_id) IN (
  SELECT salary,manager_id FROM emp WHERE id IN (1,2)
);
```

接受 `(8000,4)` 或 `(6000,4)` 两个完整组合，返回柳岩和张无忌。不能拆成两个互不相关的 IN，否则可能接受原集合中根本不存在的组合。普通元组比较仍遵守 NULL 规则，比较含空值的主管字段时要明确缺失值的业务含义。

## FROM 中的子查询形成派生表

```sql
SELECT recent.id,recent.name,d.name AS department_name
FROM (
  SELECT id,name,dept_id
  FROM emp WHERE entry_date > '2020-01-01'
) AS recent
LEFT JOIN dept AS d ON d.id=recent.dept_id
ORDER BY recent.id;
```

内层先描述符合日期条件的员工集合，给它起名 recent，外层把它和部门表连接。结果是张无忌、周芷若、赵敏及其部门。这个写法把逻辑拆成两层，便于理解；优化器不一定真的物化出一张临时表，也不意味着一定比直接 JOIN 加 WHERE 更快。

## 每个人都与本部门平均值比较

全公司平均工资只有一个数，本部门平均工资却因员工而异。相关子查询通过外层的 dept_id 把当前部门传给内层：

```sql
SELECT e.id,e.name,e.salary,
       (SELECT AVG(e2.salary)
        FROM emp AS e2 WHERE e2.dept_id=e.dept_id) AS dept_average
FROM emp AS e
WHERE e.salary < (
  SELECT AVG(e2.salary)
  FROM emp AS e2 WHERE e2.dept_id=e.dept_id
)
ORDER BY e.id;
```

研发部平均工资 `(8000+6000+20000+9000)/4=10750`，柳岩、张无忌、赵敏低于平均；人事部平均 11000，周芷若低于平均；财务部只有胡青牛，等于平均而非低于平均。因此结果是 id 1、2、3、7。

韦一笑没有部门，`e2.dept_id = NULL` 不会匹配行，平均值为 NULL，比较不能成立。他不会自动与“所有无部门员工”组成一组，这是当前 SQL 明确采用的语义。

相关是表达式依赖关系，不能直接断言数据库一定对每一外层行完整执行一次子查询。性能要看实际执行计划和优化能力。

相关子查询也可以按外层员工逐个代入来验证。先处理柳岩，外层 dept_id=1，内层只收集部门 1 的工资，得到 10750，判断 8000<10750 为真。处理张三丰时，还是同一部门平均值，但 20000<10750 为假。处理周芷若时，外层部门变成 2，内层重新对应到 7000 与 15000，平均 11000，因此 7000<11000 为真。

如果漏写内层的 `WHERE e2.dept_id=e.dept_id`，平均值会变成全公司统一的 10875，查询仍然能运行，却已经回答了另一个问题。外层别名 e 和内层别名 e2 的关联条件，正是“本部门”三个字在 SQL 中的落点。

## 把子查询放在 SELECT 中

```sql
SELECT d.id,d.name,
       (SELECT COUNT(*) FROM emp AS e WHERE e.dept_id=d.id) AS people
FROM dept AS d ORDER BY d.id;
```

每个部门产生一行，人数为 4、2、1、0。这里 COUNT 在没有匹配员工时返回 0，恰好能展示空部门。

等价的连接聚合写法是：

```sql
SELECT d.id,d.name,COUNT(e.id) AS people
FROM dept AS d LEFT JOIN emp AS e ON e.dept_id=d.id
GROUP BY d.id,d.name
ORDER BY d.id;
```

必须数 `e.id`，不能随手改成 COUNT(*)。市场部虽没有员工，LEFT JOIN 仍保留一行右侧为 NULL 的结果，COUNT(*) 会把这一行误算为一个员工；COUNT(e.id) 不计 NULL，才得到 0。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-07) · [下一篇](/posts/mysql-heima-09)
