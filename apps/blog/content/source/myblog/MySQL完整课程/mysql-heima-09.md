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

写复杂查询，先定“结果里一行代表谁”，再定要哪些表、关联条件和过滤条件。员工列表、部门统计、选课记录，一行代表的东西都不一样，不能套同一组 JOIN 再直接加 COUNT。

用到基础的 emp、约束篇的 dept、连接篇的 student/course/student_course，再新建一张薪资等级表：

```sql
CREATE TABLE salary_grade (
  grade INT PRIMARY KEY,
  low_salary DECIMAL(10,2),
  high_salary DECIMAL(10,2)
);
INSERT INTO salary_grade VALUES
  (1,0,5000),(2,5000,8000),(3,8000,12000),(4,12000,30000);
```

区间定成“左闭右开”：8000 属于第 3 级，12000 属于第 4 级。金额有小数，用“0～5000、5001～8000”这种整数区间会漏掉 5000.50；两个闭区间也不能共用边界，否则一个员工会匹配到两级。

## 先确定哪些员工应保留

查员工姓名、年龄、工资和部门，用显式内连接：

```sql
SELECT e.name,e.age,e.salary,d.name AS department_name
FROM emp AS e JOIN dept AS d ON d.id=e.dept_id
ORDER BY e.id;
```

结果 7 行，没有未分配部门的韦一笑。隐式内连接写成 `FROM emp e,dept d WHERE d.id=e.dept_id`，匹配结果一样。

只要 30 岁以下的员工，就在 ORDER BY 前面加 `WHERE e.age<30`，结果是柳岩、张无忌、周芷若、赵敏，共 4 人。

需求改成“35 岁以上员工，没分配部门也要显示”，就改用 LEFT JOIN：

```sql
SELECT e.name,e.age,d.name AS department_name
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.age>35 ORDER BY e.id;
```

返回张三丰、灭绝、胡青牛、韦一笑，最后一人的部门是 NULL。年龄过滤针对的是员工，不会误删没有部门的员工。

## 拥有员工的部门只应出现一次

```sql
SELECT DISTINCT d.id,d.name
FROM dept AS d JOIN emp AS e ON e.dept_id=d.id
ORDER BY d.id;
```

得到研发部、人事部、财务部。内连接先给每名员工出一行，DISTINCT 再对部门编号和名称去重。也可以用 EXISTS 表达“有匹配员工”，它本来就不会把同一个部门展开多次。

## 连接条件不一定是等号

```sql
SELECT e.name,e.salary,g.grade,g.low_salary,g.high_salary
FROM emp AS e
JOIN salary_grade AS g
  ON e.salary>=g.low_salary AND e.salary<g.high_salary
ORDER BY e.id;
```

工资落在哪个区间，就和哪个等级匹配，不需要外键。按初始员工顺序，等级是 `3,2,2,4,4,4,3,3`。等级表区间有重叠会重复匹配，有缺口内连接会丢行。这是数据设计的问题，跟 JOIN 语法无关。

再限定研发部，就要连第三张表：

```sql
SELECT e.name,e.salary,g.grade
FROM emp AS e
JOIN dept AS d ON d.id=e.dept_id
JOIN salary_grade AS g
  ON e.salary>=g.low_salary AND e.salary<g.high_salary
WHERE d.name='研发部'
ORDER BY e.id;
```

结果是柳岩 8000/3、张无忌 6000/2、张三丰 20000/4、赵敏 9000/3。两组关联条件分别回答“属于哪个部门”和“落在哪个区间”，要哪个部门由 WHERE 来限定。

拿柳岩的 8000 把这个三表查询走一遍：

1. 从 emp 取出 dept_id=1
2. 在 dept 里找到研发部，满足最后的 WHERE
3. 检查工资区间：第 2 级上界是 8000，但要求工资小于上界，不匹配；第 3 级要求 `8000>=8000 AND 8000<12000`，两项都成立，得到等级 3

这条查询一行还是代表一个员工，所以每个员工最多只能命中一个部门、一个等级。部门 id 是主键，保证了最多匹配一个部门；工资区间重不重叠，要靠数据设计来保证。要是有人把第 2 级改成“工资小于等于 8000”，柳岩就可能同时匹配两个等级，变成两行。这时 DISTINCT 不一定去得掉，因为两个等级本来就不同。该做的是修正区间，别把结果藏起来。

## 统计前先固定需要统计的集合

研发部平均工资：

```sql
SELECT AVG(e.salary) AS average_salary
FROM emp AS e JOIN dept AS d ON d.id=e.dept_id
WHERE d.name='研发部';
```

预期是 10750。统计前别先连一张会把员工展开多次的业务表，不然有些工资会被重复算进去。

高于灭绝工资的员工：

```sql
SELECT name,salary FROM emp
WHERE salary>(SELECT salary FROM emp WHERE id=5);
```

预期只有张三丰。高于全公司平均工资的，用聚合子查询：

```sql
SELECT name,salary FROM emp
WHERE salary>(SELECT AVG(salary) FROM emp)
ORDER BY id;
```

工资总和 87000，平均 10875，结果是张三丰、灭绝、胡青牛。“低于本部门平均”要关联当前员工的部门，完整推导见 [相关查询](/posts/mysql-heima-08)，这个例子的结果是柳岩、张无忌、周芷若、赵敏。

统计所有部门人数也在那篇，结果依次是 4、2、1、0；要点是保留市场部，数员工主键，别数外连接的结果行数。

## 经过中间表查询选课

```sql
SELECT s.name,s.student_no,c.name AS course_name
FROM student AS s
JOIN student_course AS sc ON sc.student_id=s.id
JOIN course AS c ON c.id=sc.course_id
ORDER BY s.id,c.id;
```

结果 4 行：黛绮丝/Java、黛绮丝/MySQL、谢逊/MySQL、殷天正/Hadoop。这里一行代表一次选课，同一个学生出现多次是对的。要包括没选课的学生，两次 JOIN 都要看看是不是该用 LEFT JOIN，别在第二次内连接里又把没课程的行过滤掉。

检查复杂 SQL 时，可以把关联字段、区间上下界、聚合基准一步步显示出来。先确认每一行为什么会出现，再收窄最后返回的列，比看到“查询成功”就收工靠谱。

需求换成“选修 MySQL 的学生学号和姓名”，先定好每行代表一名学生，课程名称只用来筛选。顺着已有的关系写：

```sql
SELECT s.student_no,s.name
FROM student AS s
JOIN student_course AS sc ON sc.student_id=s.id
JOIN course AS c ON c.id=sc.course_id
WHERE c.id=2
ORDER BY s.id;
```

先用课程主键 2 确定 MySQL，再从关系表找到 `(1,2)` 和 `(2,2)`，最后回学生表取到 S001/黛绮丝和 S002/谢逊。学生表里没有直接存课程名，所以跳不过 student_course；关系表也不存学生姓名，所以还得连回 student。

按名称 `c.name='MySQL'` 筛选，在当前数据里结果一样，但课程名称不一定唯一。用主键表示“就是这门课”，以后出现同名课程时查询范围不会悄悄变大。查询条件能不能唯一确定业务对象，写 SQL 之前就要确认。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-08) · [下一篇](/posts/mysql-heima-10)
