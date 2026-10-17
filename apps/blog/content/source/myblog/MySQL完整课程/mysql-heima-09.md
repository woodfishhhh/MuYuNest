---
title: "MySQL（09）：多表查询综合案例"
date: 2026-10-17 00:00:00
slug: mysql-heima-09
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

复杂查询先确定“最后一行代表谁”，再确定所需表、关联条件和过滤条件。员工列表、部门统计、选课记录的结果粒度不同，不能用同一套 JOIN 后直接加 COUNT。

本篇使用基础 emp、约束篇 dept、连接篇的 student/course/student_course。新增薪资等级表：

```sql
CREATE TABLE salary_grade (
  grade INT PRIMARY KEY,
  low_salary DECIMAL(10,2),
  high_salary DECIMAL(10,2)
);
INSERT INTO salary_grade VALUES
  (1,0,5000),(2,5000,8000),(3,8000,12000),(4,12000,30000);
```

这里把区间定义为“左闭右开”，例如 8000 属于第 3 级，而 12000 属于第 4 级。金额有小数，不能用“0～5000、5001～8000”这种整数区间漏掉 5000.50；也不能让两个闭区间共享边界，使一个员工匹配两级。

## 先确定哪些员工应保留

查询员工姓名、年龄、工资和部门，用显式内连接：

```sql
SELECT e.name,e.age,e.salary,d.name AS department_name
FROM emp AS e JOIN dept AS d ON d.id=e.dept_id
ORDER BY e.id;
```

结果 7 行，不含未分配部门的韦一笑。隐式内连接是 `FROM emp e,dept d WHERE d.id=e.dept_id`，得到相同匹配结果。

若只要 30 岁以下员工，在 ORDER BY 之前加 `WHERE e.age<30`，结果为柳岩、张无忌、周芷若、赵敏，共 4 人。

若需求改为“35 岁以上员工，即使未分配部门也要展示”，则应改用 LEFT JOIN：

```sql
SELECT e.name,e.age,d.name AS department_name
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.age>35 ORDER BY e.id;
```

返回张三丰、灭绝、胡青牛、韦一笑，最后一人的部门为 NULL。年龄过滤针对员工，不会把无部门员工误删。

## 拥有员工的部门只应出现一次

```sql
SELECT DISTINCT d.id,d.name
FROM dept AS d JOIN emp AS e ON e.dept_id=d.id
ORDER BY d.id;
```

得到研发部、人事部、财务部。内连接先产生每名员工对应的一行，DISTINCT 再对部门编号和名称去重。也可以使用 EXISTS 表达“有匹配员工”，它天然不把同一个部门展开多次。

## 连接条件不一定是等号

```sql
SELECT e.name,e.salary,g.grade,g.low_salary,g.high_salary
FROM emp AS e
JOIN salary_grade AS g
  ON e.salary>=g.low_salary AND e.salary<g.high_salary
ORDER BY e.id;
```

员工工资落在某个区间时，就与该等级匹配，不需要外键。按初始员工顺序，等级应是 `3,2,2,4,4,4,3,3`。若等级表有重叠区间，会重复匹配；若区间有缺口，内连接会丢行。这是数据设计问题，不是 JOIN 的语法问题。

再限定研发部，需要连接第三张表：

```sql
SELECT e.name,e.salary,g.grade
FROM emp AS e
JOIN dept AS d ON d.id=e.dept_id
JOIN salary_grade AS g
  ON e.salary>=g.low_salary AND e.salary<g.high_salary
WHERE d.name='研发部'
ORDER BY e.id;
```

结果为柳岩 8000/3、张无忌 6000/2、张三丰 20000/4、赵敏 9000/3。这里两组关联条件分别回答“属于哪个部门”和“落在哪个区间”，WHERE 才限定要哪个部门。

可以用柳岩的 8000 把这个三表查询走完。先从 emp 取出 dept_id=1，再在 dept 中找到研发部，满足最终 WHERE。接着检查工资区间：第 2 级上界为 8000，但它要求工资小于上界，所以不匹配；第 3 级要求 `8000>=8000 AND 8000<12000`，两项都成立，于是得到等级 3。

这次查询的一行仍代表一个员工，要求每个员工至多命中一个部门和一个等级。部门 id 是主键，已经保证至多一个部门匹配；工资区间之间是否重叠则由数据设计保证。若有人把第 2 级改成“工资小于等于 8000”，柳岩就可能同时匹配两个等级，结果变成两行。此时 DISTINCT 不一定能去重，因为两个等级本来就不同，应该修正区间，而不是隐藏结果。

## 统计前先固定需要统计的集合

研发部平均工资：

```sql
SELECT AVG(e.salary) AS average_salary
FROM emp AS e JOIN dept AS d ON d.id=e.dept_id
WHERE d.name='研发部';
```

预期为 10750。这个统计不能先连一张会把员工展开多次的业务表，否则某些工资可能被重复计入。

高于灭绝工资的员工：

```sql
SELECT name,salary FROM emp
WHERE salary>(SELECT salary FROM emp WHERE id=5);
```

预期只有张三丰。高于全公司平均工资则使用聚合子查询：

```sql
SELECT name,salary FROM emp
WHERE salary>(SELECT AVG(salary) FROM emp)
ORDER BY id;
```

工资总和为 87000，平均 10875，结果是张三丰、灭绝、胡青牛。至于“低于本部门平均”，必须关联当前员工部门，完整推导见 [相关查询](/posts/mysql-heima-08)。该例结果为柳岩、张无忌、周芷若、赵敏。

统计所有部门人数也见同篇，结果依次 4、2、1、0；重点是保留市场部，并数员工主键而不是外连接结果行数。

## 经过中间表查询选课

```sql
SELECT s.name,s.student_no,c.name AS course_name
FROM student AS s
JOIN student_course AS sc ON sc.student_id=s.id
JOIN course AS c ON c.id=sc.course_id
ORDER BY s.id,c.id;
```

结果有 4 行：黛绮丝/Java、黛绮丝/MySQL、谢逊/MySQL、殷天正/Hadoop。此时一行代表一次选课，所以同一学生出现多次正确。如果要包括没有选课的学生，两次 JOIN 都应审视是否需要 LEFT JOIN，不能在第二次内连接中又把无课程的行过滤掉。

检查复杂 SQL 时，可以逐步展示关联字段、区间上下界和聚合基准。先确认每一行为何出现，再收窄最终返回列，比看到“查询成功”就结束更可靠。

若需求变成“选修 MySQL 的学生学号与姓名”，先决定每行代表一名学生，课程名称仅用于筛选。沿已有关系可以写成：

```sql
SELECT s.student_no,s.name
FROM student AS s
JOIN student_course AS sc ON sc.student_id=s.id
JOIN course AS c ON c.id=sc.course_id
WHERE c.id=2
ORDER BY s.id;
```

先用课程主键 2 确定 MySQL，再从关系表找到 `(1,2)` 与 `(2,2)`，最后回到学生表取得 S001/黛绮丝和 S002/谢逊。学生表里没有直接存课程名，所以不能跳过 student_course；关系表也不负责保存学生姓名，所以仍要连回 student。

按名称 `c.name='MySQL'` 筛选在当前数据中得到相同结果，但课程名称不一定天然唯一。使用主键表达“这门确定的课程”，能避免以后出现同名课程时悄悄扩大查询范围。查询条件是否唯一识别业务对象，需要在写 SQL 前确认。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-08) · [下一篇](/posts/mysql-heima-10)
