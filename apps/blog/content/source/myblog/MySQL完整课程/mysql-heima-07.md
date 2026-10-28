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

员工表存部门编号，部门表存部门名称。要显示“柳岩属于研发部”，查询就得把两张表对上。连接条件负责对应，连接类型决定没匹配上的记录留不留。

沿用 [员工初始化脚本](/posts/mysql-heima#初始化脚本) 和 [部门表及外键](/posts/mysql-heima-06)：8 名员工、4 个部门；韦一笑没分配部门，市场部没有员工。

## 关系写在哪一张表里

一对多：引用字段放在“多”的一边。一个部门有多个员工，每个员工最多属于一个部门，所以 emp.dept_id 指向 dept.id。要是把部门的全部员工编号塞成一个逗号分隔的字符串，查询、约束、更新都会很麻烦。

多对多：要用中间表。比如一个学生选多门课，一门课有多个学生，中间表每行就是一次选课：

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

联合主键 `(student_id,course_id)` 保证同一个学生不能重复选同一门课。只让 student_id 唯一，每人就只能选一门课；只让 course_id 唯一，每门课就只能有一个学生。

一对一：常用来拆出不常用的大字段。比如会员基本信息和教育详情分开存：

```sql
CREATE TABLE member_detail (
  member_id INT PRIMARY KEY,
  education VARCHAR(30),
  major VARCHAR(50),
  FOREIGN KEY (member_id) REFERENCES member(id)
);
```

member 来自约束篇。详情表的主键同时是外键，所以一个会员最多对应一条详情，但不保证每个会员都已经建了详情。用独立 id 加 `member_id UNIQUE NOT NULL` 也能表达“最多一个”。

## 没有连接条件会得到所有组合

```sql
SELECT e.name, d.name FROM emp AS e CROSS JOIN dept AS d;
```

8 名员工各和 4 个部门组合，得到 32 行，这叫笛卡尔积。柳岩会和四个部门各配一次，这不是她的真实归属。要用 `e.dept_id=d.id` 只留下关联成立的组合。

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

两种写法这里都返回 7 行。韦一笑的 dept_id 是 NULL，找不到匹配的部门，内连接就不返回他。INNER 可以省略，直接写 JOIN；起了表别名后，这条查询里就用别名限定列，两张表都有 id、name 时尤其要这么做。

“交集”只是个粗略的比方，JOIN 实际是按条件组合行。连接的键不唯一时，一条左侧记录能匹配多条右侧记录，结果行就变多了。看到重复行先查关联关系，别马上用 DISTINCT 把错误藏起来。

把内连接拆成几行候选组合，看 ON 到底排除了什么：

| 员工 | e.dept_id | 候选部门 | d.id | 是否满足相等条件 |
| --- | --- | --- | --- | --- |
| 柳岩 | 1 | 研发部 | 1 | 是，保留 |
| 柳岩 | 1 | 人事部 | 2 | 否，排除 |
| 柳岩 | 1 | 财务部 | 3 | 否，排除 |
| 韦一笑 | NULL | 研发部 | 1 | 不是 TRUE，排除 |

其他候选也按同样的规则判断。这只是理解结果用的逻辑模型，执行器不一定真的先生成完整的 32 行再过滤；有索引之类的访问路径时，数据库能更直接地找到匹配的部门。先用这个模型把结果解释对，再去研究实际执行计划，两件事别混在一起。

## LEFT JOIN 保留没有匹配项的左行

```sql
SELECT e.id, e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id = d.id
ORDER BY e.id;
```

返回全部 8 名员工。韦一笑的 id、name 还在，department_name 是 NULL。LEFT JOIN 先判断 ON，右侧找不到匹配就补 NULL。

反过来，要保留没有员工的市场部，就把 dept 放左边：

```sql
SELECT d.name AS department_name, e.name AS employee_name
FROM dept AS d
LEFT JOIN emp AS e ON e.dept_id = d.id
ORDER BY d.id, e.id;
```

研发部 4 行、人事部 2 行、财务部 1 行、市场部 1 行，市场部的 employee_name 是 NULL。LEFT JOIN 不保证一条左表记录只出一行，匹配到多个员工照样展开。

`emp RIGHT JOIN dept` 也能表达同样的保留方向，不过把要保留的一方放左边一般更好读。OUTER 关键字可以省略。

外连接里的 NULL 要分清是哪来的。韦一笑右侧的 d.id、d.name 都是空，因为根本没有匹配的部门；而如果部门表里有这条记录，只是 name 本身允许为空，显示出来的 name 也可能是 NULL，但关联其实已经成功了。所以判断“没匹配上”，最稳的是检查右侧本来不可能为空的主键。

以部门为左表的查询为什么是 8 行而不是 4 行？研发部和四名员工分别匹配，出四行；人事部匹配两人，出两行；财务部出一行；市场部没有匹配，也保留一行。`4+2+1+1=8`。保留左表的意思是每个左侧对象都能出现，一对多关联不会被自动压成一行。

## ON 和 WHERE 放错位置会改变外连接

需求：“保留所有员工，但只显示研发部的匹配信息”：

```sql
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id=d.id AND d.name='研发部';
```

结果还是 8 名员工，非研发部员工的右侧列是 NULL。如果改成：

```sql
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id=d.id
WHERE d.name='研发部';
```

就只剩研发部 4 人：WHERE 把非研发部的行和补了 NULL 的行都过滤掉了。外连接“保留全部左行”只在连接阶段保证，管不到后面的 WHERE。

找没有员工的部门，可以看右侧本应非空的主键是不是变成了 NULL：

```sql
SELECT d.id,d.name
FROM dept AS d LEFT JOIN emp AS e ON e.dept_id=d.id
WHERE e.id IS NULL;
```

结果是市场部。检查 e.id，比检查某个本来就允许 NULL 的员工属性靠谱。

## 自连接让同一张表承担两个角色

主管也是员工，所以 manager_id 指向 emp.id。emp 要用两次，分别起别名：

```sql
SELECT e.name AS employee_name, m.name AS manager_name
FROM emp AS e
LEFT JOIN emp AS m ON e.manager_id=m.id
ORDER BY e.id;
```

e 是当前员工，m 是他的主管。柳岩、张无忌的主管是张三丰，周芷若的主管是灭绝；张三丰和灭绝没有主管，右侧是 NULL，改成 INNER JOIN 就会把这两人去掉。自连接说的是“同一张表用几次”，内外连接说的是“没匹配上怎么处理”，两种分类可以同时成立。

两个 emp 别名就是同一份数据演两个角色。处理周芷若时，e.id 是 3，e.manager_id 是 5；拿 5 去对 m.id，找到灭绝，取 m.name。处理灭绝时，e.manager_id 是 NULL，没有主管能匹配；LEFT JOIN 保留灭绝，主管姓名为空。

条件写错的话：

- 写成 `e.id=m.id`：每个员工和自己连接
- 写成 `e.manager_id=m.manager_id`：找的是主管相同的人

这三种条件都能正常执行，只是回答的业务问题不一样。写自连接要把两个角色和谁指向谁讲清楚，光把同一个表名写两遍没用。

## UNION 是上下合并结果

```sql
SELECT id,name FROM emp WHERE salary < 9000
UNION ALL
SELECT id,name FROM emp WHERE age < 20;
```

第一组是 id 1、2、3，第二组是 id 2、3，UNION ALL 得到 5 行；改成 UNION 会按整行去重，只剩 3 行。JOIN 一般是把两边的列横着拼，UNION 是把形状一样的结果竖着合并。

两边列数必须相同，对应位置的类型要兼容、含义要一致。MySQL 能做一些类型转换，但别因此把“姓名”和“工资”拼进同一个结果列。UNION 不保证顺序，需要的话对整个合并结果另写 ORDER BY。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-06) · [下一篇](/posts/mysql-heima-08)
