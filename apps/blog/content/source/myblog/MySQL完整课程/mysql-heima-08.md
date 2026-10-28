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

查“工资比灭绝高的人”，得先知道灭绝的工资，再拿它当筛选条件。把第一个 SELECT 写进第二个 SELECT 里，里面那个就是子查询。先看它返回几行几列，再决定用等号、IN、ANY 还是 ALL，能少犯很多语法和逻辑错误。

## 单值结果用标量子查询

```sql
SELECT id,name,salary
FROM emp
WHERE salary > (SELECT salary FROM emp WHERE id=5);
```

id 5 是灭绝，子查询返回一行一列的 15000，外层只返回工资 20000 的张三丰。用唯一的 id 是为了保证子查询最多一行。按姓名查的话，表里有同名员工时子查询会返回多行，直接报错；别随手加 LIMIT 1 把“到底是哪个人”这个问题盖过去。

标量子查询没返回行时，当值用就是 NULL；普通大小比较碰到 NULL 结果是未知，WHERE 不保留这一行。

再比如查比柳岩晚入职的人：

```sql
SELECT id,name,entry_date FROM emp
WHERE entry_date > (SELECT entry_date FROM emp WHERE id=1)
ORDER BY id;
```

比较基准是 2020-01-01，返回张无忌、周芷若、赵敏。

“标量”说的是结果的形状：一行一列，能当成一个值放在比较符号右边，跟子查询写了几行代码无关。`SELECT AVG(salary) FROM emp` 没有 GROUP BY，一般只产生一个聚合结果，读了再多员工也是标量；`SELECT salary FROM emp` 可能返回八行，不能直接接在要求单值的等号右边。

外层和内层的列各有各的用处。在“工资高于灭绝”的查询里，内层 salary 只用来求比较基准 15000，外层 salary 是每个候选员工自己的工资。分清这两个角色，就明白为什么最后只剩张三丰，灭绝那一行也不会被拼进输出。

## 一列多行用 IN，不能强塞进等号

```sql
SELECT id,name FROM emp
WHERE dept_id IN (
  SELECT id FROM dept WHERE name IN ('研发部','人事部')
)
ORDER BY id;
```

子查询给出部门集合 `{1,2}`，外层返回 id 1、2、3、4、5、7。IN 问的是“在不在集合里”，等号问的是“等不等于一个单值”。

`NOT IN` 碰到 NULL，结果容易反直觉。比如 `3 NOT IN (1,NULL)` 不能确定为真，因为没法判断 3 等不等于那个未知值。子查询可能有 NULL 时，要么把 NULL 过滤掉，要么改用表达“不存在匹配行”的 NOT EXISTS：

```sql
SELECT d.id,d.name
FROM dept AS d
WHERE NOT EXISTS (
  SELECT 1 FROM emp AS e WHERE e.dept_id=d.id
);
```

返回市场部。EXISTS 只关心有没有行，不关心 SELECT 出来的具体值，写 1 就是表示内容无所谓。内层用到了外层的 d.id，所以这是相关子查询。

把 NOT IN 的 NULL 问题展开：`3 NOT IN (1,NULL)` 相当于“3 不等于 1，并且 3 不等于 NULL”。前半句为真，后半句未知，整体没法确定为真，WHERE 就不保留它。直觉上“3 明明不在列表里”，但列表里有个未知值，这个判断就没有依据了。

NOT EXISTS 问的是另一件事：能不能找到一个部门编号等于当前部门 ID 的员工。市场部 id=4，逐个检查员工，没有一行满足 e.dept_id=4，子查询没有行，NOT EXISTS 就为真。韦一笑的 NULL 匹配不上，但也不会让“有没有匹配行”整体变成未知。

## ANY 是至少一个，ALL 是全部

```sql
SELECT name,salary FROM emp
WHERE salary > ANY (SELECT salary FROM emp WHERE dept_id=1);

SELECT name,salary FROM emp
WHERE salary > ALL (SELECT salary FROM emp WHERE dept_id=2);
```

研发部工资是 8000、6000、20000、9000。大于 ANY 只要大于其中至少一个，所以工资大于 6000 的 7 人都符合，张无忌不符合。SOME 和 ANY 同义，注意别跟聚合函数 SUM 搞混。

人事部工资是 7000、15000。大于 ALL 要同时大于这两个数，所以只有张三丰符合。

子查询非空且不含 NULL 时，`> ANY` 可以理解成“大于最小值”，`> ALL` 理解成“大于最大值”。碰到空集或 NULL 就不能无条件这么换：`> ALL(空集)` 为真，`> ANY(空集)` 为假，而 MAX/MIN 对空集返回 NULL。这就是集合判断和单值比较的区别。

拿工资 9000 去比 `{7000,15000}`，两种量词的区别更直观：`9000>7000` 为真，`9000>15000` 为假；ANY 只要一个真，通过；ALL 要两次都为真，不通过。工资 20000 两次都为真，两个都通过。比较的先后顺序不影响这个定义。

换成 `< ALL`，就要比集合里每个值都小，非空无 NULL 时等同于“小于最小值”。`< ANY` 只要小于其中某一个，对应“小于最大值”。记住“至少一个”和“每一个”就行，碰到新条件比硬背一张大于小于转换表好判断。

## 多列结果必须作为一个组合比较

查工资和主管都跟柳岩相同的人：

```sql
SELECT id,name FROM emp
WHERE (salary,manager_id) = (
  SELECT salary,manager_id FROM emp WHERE id=1
);
```

子查询返回 `(8000,4)`。外层要两个字段同时匹配，所以现在只返回柳岩自己。要查“其他同事”就再加 `AND id<>1`，结果为空。

要和多个人比较，用元组 IN：

```sql
SELECT id,name FROM emp
WHERE (salary,manager_id) IN (
  SELECT salary,manager_id FROM emp WHERE id IN (1,2)
);
```

接受 `(8000,4)` 或 `(6000,4)` 这两个完整组合，返回柳岩和张无忌。别拆成两个互不相关的 IN，那样可能放过原集合里根本不存在的组合。普通元组比较一样遵守 NULL 规则，比较含空值的主管字段时，要先明确缺失值在业务上是什么意思。

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

内层先选出符合日期条件的员工，起名 recent，外层再把它和部门表连接。结果是张无忌、周芷若、赵敏和各自的部门。这样写把逻辑拆成两层，好理解；但优化器不一定真的物化出一张临时表，也不一定比直接 JOIN 加 WHERE 快。

## 每个人都与本部门平均值比较

全公司平均工资只有一个数，本部门平均工资却因人而异。相关子查询通过外层的 dept_id 把当前部门传给内层：

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

- 研发部平均工资 `(8000+6000+20000+9000)/4=10750`，柳岩、张无忌、赵敏低于平均
- 人事部平均 11000，周芷若低于平均
- 财务部只有胡青牛，等于平均，不算低于

所以结果是 id 1、2、3、7。

韦一笑没有部门，`e2.dept_id = NULL` 匹配不到行，平均值是 NULL，比较不成立。他不会自动跟“所有没部门的员工”算成一组，这是这条 SQL 明确采用的规则。

“相关”说的是表达式之间的依赖，不代表数据库一定会对外层每一行都完整执行一遍子查询。性能要看实际执行计划和优化器怎么处理。

也可以把外层员工逐个代进去验证：

- 柳岩：外层 dept_id=1，内层只收集部门 1 的工资，得到 10750，8000<10750 为真
- 张三丰：还是同一部门的平均值，20000<10750 为假
- 周芷若：外层部门变成 2，内层换成 7000 和 15000，平均 11000，7000<11000 为真

漏写内层的 `WHERE e2.dept_id=e.dept_id`，平均值就成了全公司统一的 10875，查询照样能跑，但回答的已经是另一个问题。外层别名 e 和内层别名 e2 之间的这个关联条件，就是“本部门”三个字在 SQL 里的落点。

## 把子查询放在 SELECT 中

```sql
SELECT d.id,d.name,
       (SELECT COUNT(*) FROM emp AS e WHERE e.dept_id=d.id) AS people
FROM dept AS d ORDER BY d.id;
```

每个部门出一行，人数是 4、2、1、0。没有匹配员工时 COUNT 返回 0，正好能把空部门显示出来。

等价的连接加聚合写法：

```sql
SELECT d.id,d.name,COUNT(e.id) AS people
FROM dept AS d LEFT JOIN emp AS e ON e.dept_id=d.id
GROUP BY d.id,d.name
ORDER BY d.id;
```

这里要数 `e.id`，别顺手改成 COUNT(*)。市场部没有员工，但 LEFT JOIN 还是会保留一行右侧为 NULL 的结果，COUNT(*) 会把这一行误算成一个员工；COUNT(e.id) 不计 NULL，才得到 0。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-07) · [下一篇](/posts/mysql-heima-09)
