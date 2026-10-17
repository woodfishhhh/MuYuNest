---
title: "MySQL（07）：多表关系与连接查询"
date: 2026-10-17 00:00:00
slug: mysql-heima-07
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

员工表保存部门编号，部门表保存部门名称。要展示“柳岩属于研发部”，查询必须把两张表对应起来。连接条件负责对应，连接类型决定没有匹配对象的记录是否保留。

本篇沿用 [员工初始化脚本](/posts/mysql-heima#初始化脚本) 与 [部门表及外键](/posts/mysql-heima-06)：8 名员工、4 个部门；韦一笑未分配部门，市场部没有员工。

## 关系写在哪一张表里

一对多关系把引用字段放在“多”的一侧。一个部门有多个员工，每个员工至多属于一个部门，因此 emp.dept_id 指向 dept.id。若把部门的全部员工编号塞成一个逗号字符串，查询、约束和更新都会变得困难。

多对多需要中间表。例如一个学生选多门课，一门课有多个学生。中间表每行表示一次选课：

```sql
CREATE TABLE student (id INT PRIMARY KEY, name VARCHAR(20), student_no VARCHAR(20));
CREATE TABLE course (id INT PRIMARY KEY, name VARCHAR(30));
CREATE TABLE student_course (
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES student(id),
  FOREIGN KEY (course_id) REFERENCES course(id)
);
INSERT INTO student VALUES (1,'黛绮丝','S001'),(2,'谢逊','S002'),(3,'殷天正','S003');
INSERT INTO course VALUES (1,'Java'),(2,'MySQL'),(3,'Hadoop');
INSERT INTO student_course VALUES (1,1),(1,2),(2,2),(3,3);
```

联合主键 `(student_id,course_id)` 限制同一个学生不能重复选择同一门课。单独限制 student_id 唯一会错误地使每人只能选一门课；单独限制 course_id 唯一则使每门课只能有一名学生。

一对一常用于拆分低频的大字段。比如会员基本信息和教育详情分开保存：

```sql
CREATE TABLE member_detail (
  member_id INT PRIMARY KEY,
  education VARCHAR(30),
  major VARCHAR(50),
  FOREIGN KEY (member_id) REFERENCES member(id)
);
```

member 来自约束篇。这里详情表的主键同时是外键，使一个会员最多对应一条详情；它并不保证每个会员一定已经创建详情。用独立 id 加 `member_id UNIQUE NOT NULL` 也能表达“最多一个”的约束。

## 没有连接条件会得到所有组合

```sql
SELECT e.name, d.name FROM emp AS e CROSS JOIN dept AS d;
```

8 名员工各与 4 个部门组合，得到 32 行，称为笛卡尔积。柳岩会分别与四个部门配对，这不是她真实的归属。需要用 `e.dept_id=d.id` 只保留关联成立的组合。

```sql
-- 隐式内连接
SELECT e.name AS employee_name, d.name AS department_name
FROM emp AS e, dept AS d
WHERE e.dept_id = d.id;

-- 显式内连接，推荐把关联条件写在 ON 中
SELECT e.name AS employee_name, d.name AS department_name
FROM emp AS e
INNER JOIN dept AS d ON e.dept_id = d.id;
```

两者在这里都返回 7 行。韦一笑的 dept_id 为 NULL，找不到匹配部门，因此内连接不返回他。INNER 可以省略为 JOIN；定义表别名后，在当前查询中应使用别名限定列，尤其两张表都含有 id、name 时。

“交集”只是粗略比喻，JOIN 实际按条件组合行。如果连接到的键不唯一，一条左侧记录可以匹配多条右侧记录，使结果增多。看到重复行先查关联关系，不要立即用 DISTINCT 把错误隐藏起来。

把内连接拆成几行候选组合，能看清 ON 实际排除了什么：

| 员工 | e.dept_id | 候选部门 | d.id | 是否满足相等条件 |
| --- | --- | --- | --- | --- |
| 柳岩 | 1 | 研发部 | 1 | 是，保留 |
| 柳岩 | 1 | 人事部 | 2 | 否，排除 |
| 柳岩 | 1 | 财务部 | 3 | 否，排除 |
| 韦一笑 | NULL | 研发部 | 1 | 不是 TRUE，排除 |

其他候选也按同一规则判断。这是理解结果的逻辑模型，并不声称执行器真的先生成完整 32 行再过滤；有索引等访问路径时，数据库可以更直接地找到匹配部门。先按这个模型把结果解释对，再研究实际计划，两个层次才不会混在一起。

## LEFT JOIN 保留没有匹配项的左行

```sql
SELECT e.id, e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id = d.id
ORDER BY e.id;
```

返回全部 8 名员工。韦一笑仍有自己的 id、name，但 department_name 为 NULL。LEFT JOIN 先判断 ON，右侧找不到匹配时补上 NULL。

反过来，要保留没有员工的市场部，就把 dept 放在左侧：

```sql
SELECT d.name AS department_name, e.name AS employee_name
FROM dept AS d
LEFT JOIN emp AS e ON e.dept_id = d.id
ORDER BY d.id, e.id;
```

研发部对应 4 行、人事部 2 行、财务部 1 行、市场部 1 行，其中市场部的 employee_name 为 NULL。LEFT JOIN 不保证“一张左表记录只产生一行”；有多个匹配员工时仍会展开。

`emp RIGHT JOIN dept` 可以表达相同的保留方向，但把需要保留的一方放左侧往往更容易阅读。OUTER 关键字可以省略。

外连接中的 NULL 还要分清来源。韦一笑的右侧 d.id、d.name 都为空，是因为根本没有匹配部门；若部门表有一条记录，只是 name 本身允许为空，显示出来的 name 也可能为 NULL，但关联其实已经成功。因此判断“没有匹配行”时，检查右侧本来不可能为空的主键最稳妥。

以部门为左表的查询为什么有 8 行而不是 4 行？研发部与四名员工分别匹配，产生四行；人事部与两人匹配，产生两行；财务部产生一行；市场部没有匹配，也保留一行。`4+2+1+1=8`。保留左表的含义是每个左侧对象都有机会出现，并不是把一对多关联自动压缩成一行。

## ON 和 WHERE 放错位置会改变外连接

需求是“保留所有员工，但只展示研发部的匹配信息”：

```sql
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id=d.id AND d.name='研发部';
```

结果仍有 8 名员工，非研发部员工的右侧列为 NULL。若改为：

```sql
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id=d.id
WHERE d.name='研发部';
```

只剩研发部 4 人。因为 WHERE 会把非研发部及补 NULL 的行过滤掉。外连接中“保留全部左行”的保证发生在连接阶段，不会越过后续 WHERE 条件。

要找无员工部门，可以检测右侧非空主键是否变成 NULL：

```sql
SELECT d.id,d.name
FROM dept AS d LEFT JOIN emp AS e ON e.dept_id=d.id
WHERE e.id IS NULL;
```

结果是市场部。检测 e.id 比检测某个本来允许 NULL 的员工属性更可靠。

## 自连接让同一张表承担两个角色

主管也是员工，所以 manager_id 指向 emp.id。需要两次使用 emp，并分别起名：

```sql
SELECT e.name AS employee_name, m.name AS manager_name
FROM emp AS e
LEFT JOIN emp AS m ON e.manager_id=m.id
ORDER BY e.id;
```

e 代表当前员工，m 代表其主管。柳岩、张无忌的主管是张三丰，周芷若的主管是灭绝；张三丰与灭绝没有主管，右侧为 NULL。改成 INNER JOIN 会去掉这两人。自连接说明“同一张表用几次”，内外连接说明“没有匹配如何处理”，二者不是互斥分类。

这两个 emp 别名可以看成同一份数据承担了两次角色。处理周芷若时，e.id 为 3，e.manager_id 为 5；用这个 5 查 m.id，找到灭绝，取 m.name。处理灭绝时，e.manager_id 为 NULL，没有主管匹配；LEFT JOIN 保留灭绝，主管姓名为空。

如果把条件误写成 `e.id=m.id`，就变成每个员工和自己连接；误写成 `e.manager_id=m.manager_id`，则是在找共同主管的人。三条条件都可能合法执行，但回答的业务问题不同。自连接最需要解释清楚的是两个角色及指向关系，而不是把同一表名写两遍。

## UNION 是上下合并结果

```sql
SELECT id,name FROM emp WHERE salary < 9000
UNION ALL
SELECT id,name FROM emp WHERE age < 20;
```

第一组有 id 1、2、3，第二组有 id 2、3，UNION ALL 得到 5 行；改成 UNION 后按完整结果行去重，只剩 3 行。JOIN 通常把两方的列横向组合，UNION 把形状一致的结果纵向合并。

两侧列数必须相同，位置上的类型应兼容、含义应一致。MySQL 可以做某些类型转换，但不能因此把“姓名”和“工资”误拼到同一个结果列。UNION 不保证排序，需要时对整个联合结果另写 ORDER BY。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-06) · [下一篇](/posts/mysql-heima-08)
