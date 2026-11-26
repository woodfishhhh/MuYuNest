---
title: "MySQL 约束外键、多表连接与子查询实战"
slug: mysql-constraints-joins-and-subqueries
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "外键约束"
  - "多表连接"
  - "子查询"
  - "表设计"
---

单靠应用代码做数据校验，只要同时存在后台脚本、多个微服务或人工订正 SQL，脏数据早晚会绕过检查写进库里。把约束建在表结构里守住底线，再搞清楚一对多、多对多关联如何落地成表，以及 `LEFT JOIN` 中 `ON` 与 `WHERE` 的过滤边界和子查询的 `NULL` 陷阱，复杂的多表业务查询才能既不漏行也不翻倍。

## 字段级约束与外键的工程取舍

建表时可以把常见完整性规则直接声明在列或表级：

```sql
CREATE TABLE member (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(20) NOT NULL UNIQUE,
  age INT NOT NULL,
  status CHAR(1) NOT NULL DEFAULT '1',
  gender CHAR(1),
  CONSTRAINT ck_member_age CHECK (age > 0 AND age <= 120)
) ENGINE=InnoDB;
```

- `PRIMARY KEY` 强制唯一且非空，`AUTO_INCREMENT` 负责自动发号。事务回滚或插入失败都会消耗已分配的自增值，因此自增主键出现编号空洞属于正常行为，严禁用 `MAX(id)` 统计总行数或当连续业务单号使用。
- `UNIQUE` 允许多个 `NULL` 并存（仅限制非 `NULL` 值不重复）；`DEFAULT` 只在 `INSERT` 省略该列或显式传 `DEFAULT` 时生效，显式传入 `NULL` 仍会触发 `NOT NULL` 报错。
- `CHECK` 约束从 MySQL 8.0.16 起才真正强制生效，且条件求值为 `UNKNOWN`（如列值为 `NULL`）时不算违反，因此需配合 `NOT NULL`。

### 外键约束与级联动作

建立部门表 `dept` 并在 `emp.dept_id` 上添加外键引用：

```sql
CREATE TABLE dept (
  id INT PRIMARY KEY,
  name VARCHAR(30) NOT NULL
) ENGINE=InnoDB;
INSERT INTO dept VALUES (1, '研发部'), (2, '人事部'), (3, '财务部'), (4, '市场部');

-- 加外键前先核查是否存在孤立子记录（应返回 0 行）
SELECT e.id, e.dept_id
FROM emp AS e LEFT JOIN dept AS d ON d.id = e.dept_id
WHERE e.dept_id IS NOT NULL AND d.id IS NULL;

ALTER TABLE emp
ADD CONSTRAINT fk_emp_dept
FOREIGN KEY (dept_id) REFERENCES dept(id)
ON UPDATE RESTRICT ON DELETE RESTRICT;
```

| 动作策略 | 父表被引用键更新或删除时的行为 |
| :--- | :--- |
| `RESTRICT` / `NO ACTION` | InnoDB 立即拒绝会破坏引用关系的父表更新或删除 |
| `CASCADE` | 父键更新时同步修改子表外键；父行删除时**直接删除关联子行** |
| `SET NULL` | 将子表对应的外键列置为 `NULL`（要求子表外键列允许为空） |

**高并发线上系统往往不建物理外键，但这绝不意味着放弃参照完整性；不建外键是为了避免主从写入锁竞争和 DDL 阻塞，必须通过应用层事务与定期巡检补齐一致性。**

如果在内部管理系统或强一致中小库中使用物理外键，默认策略应当选用 `RESTRICT` 而非 `CASCADE`——随意配置 `ON DELETE CASCADE` 会让一次误删部门操作静默连带抹掉大量历史员工记录。移除物理外键使用 `ALTER TABLE emp DROP FOREIGN KEY fk_emp_dept;`，该操作只删约束规则，不删字段和数据。

## 三种表关系与连接查询机制

表关系按基数落地成物理表结构（原理推导见[E-R 模型与表结构映射](/posts/er-modeling-and-schema-design)）：一对多把父表主键放入“多”的一侧（`emp.dept_id`）；一对一可将拆出的大字段独立成扩展表，并以主键兼外键指向主表；多对多必须建立中间表，以两侧外键构成联合主键阻止重复关联：

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
INSERT INTO student VALUES (1, '黛绮丝', 'S001'), (2, '谢逊', 'S002'), (3, '殷天正', 'S003');
INSERT INTO course VALUES (1, 'Java'), (2, 'MySQL'), (3, 'Hadoop');
INSERT INTO student_course VALUES (1, 1), (1, 2), (2, 2), (3, 3);
```

### 1. 内连接与外连接的核心差异

无连接条件的 `CROSS JOIN` 会产生笛卡尔积（8 名员工 × 4 个部门 = 32 行）。`INNER JOIN` 仅保留两侧满足 `ON` 条件的组合（未分配部门的韦一笑被过滤，返回 7 行）；`LEFT JOIN` 会完整保留左表所有行，右表找不到匹配时补 `NULL`：

```sql
-- 保留全部 4 个部门，统计各部门员工数（注意 COUNT(e.id) 避免把空部门算成 1 人）
SELECT d.id, d.name, COUNT(e.id) AS people
FROM dept AS d
LEFT JOIN emp AS e ON e.dept_id = d.id
GROUP BY d.id, d.name
ORDER BY d.id;
```

### 2. `LEFT JOIN` 中 `ON` 与 `WHERE` 放错位置的经典坑

**在外连接里，写在 `ON` 中的右表过滤条件只决定右表能否匹配成功，不影响左表保留；写在 `WHERE` 中的右表条件则会直接把未匹配补 `NULL` 的左行整行删掉。**

对照下面两条查询对 8 名员工的影响：

```sql
-- 写法 A：返回全部 8 名员工，仅研发部员工显示部门名，其余人部门列为 NULL
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id = d.id AND d.name = '研发部';

-- 写法 B：等价于内连接，只剩研发部 4 人（WHERE 筛掉了 d.name IS NULL 的行）
SELECT e.name, d.name AS department_name
FROM emp AS e
LEFT JOIN dept AS d ON e.dept_id = d.id
WHERE d.name = '研发部';
```

利用外连接右表未匹配补 `NULL` 的特性，还可以精确反查“没有任何员工的空部门”（判断右表非空主键 `e.id IS NULL`，避免被普通可空字段干扰）：

```sql
SELECT d.id, d.name
FROM dept AS d
LEFT JOIN emp AS e ON e.dept_id = d.id
WHERE e.id IS NULL;
```

### 3. 自连接与结果集纵向合并

同一张表通过不同别名参与连接即为自连接，适合树形上下级关联（如员工与直属主管）：

```sql
SELECT e.name AS employee_name, m.name AS manager_name
FROM emp AS e
LEFT JOIN emp AS m ON e.manager_id = m.id
ORDER BY e.id;
```

若要纵向拼接两个列数和类型一致的查询结果，使用 `UNION`（整行去重）或 `UNION ALL`（保留全部行且免去重排序开销，性能更好）。

## 子查询类型与 `NOT IN` 陷阱

按内层查询返回的结果形状，子查询分为标量（单行单列）、列（单列多行）、行（单行多列）与派生表（多行多列）；按是否引用外层表字段，分为独立子查询与相关子查询。

```sql
-- 1. 标量子查询：查询工资高于灭绝（id=5）的员工
SELECT id, name, salary FROM emp
WHERE salary > (SELECT salary FROM emp WHERE id = 5);

-- 2. 行子查询：工资和主管同时与柳岩相同的员工
SELECT id, name FROM emp
WHERE (salary, manager_id) = (SELECT salary, manager_id FROM emp WHERE id = 1);

-- 3. 量词比较：工资大于人事部所有员工（非空无 NULL 时等价于大于最大值）
SELECT name, salary FROM emp
WHERE salary > ALL (SELECT salary FROM emp WHERE dept_id = 2);
```

使用标量子查询时，过滤条件务必能确保最多返回一行（例如按主键查询），否则运行期遇到多行结果会直接报错。`> ANY` 表示大于结果集中至少一个值，`> ALL` 表示大于所有值，但面对空集时 `> ALL(空集)` 为真、`> ANY(空集)` 为假，这与聚合函数 `MAX`/`MIN` 返回 `NULL` 的语义不同。

**当子查询返回列可能包含 `NULL` 时，禁止使用 `NOT IN`，改用 `NOT EXISTS` 或先显式过滤 `IS NOT NULL`。**

因为 `3 NOT IN (1, NULL)` 等价于 `3 <> 1 AND 3 <> NULL`，后者求值为 `UNKNOWN`，导致整条表达式恒不为 `TRUE` 而返回空集。用相关子查询 `NOT EXISTS` 检查是否存在匹配行则完全不受 `NULL` 污染：

```sql
SELECT d.id, d.name
FROM dept AS d
WHERE NOT EXISTS (
  SELECT 1 FROM emp AS e WHERE e.dept_id = d.id
);
```

当内层需要依赖外层当前行动态计算基准值（如“找出工资低于本部门平均工资的员工”）时，必须使用相关子查询（或改写为 `FROM` 派生表聚合后关联）：

```sql
SELECT e.id, e.name, e.salary,
       (SELECT AVG(e2.salary) FROM emp AS e2 WHERE e2.dept_id = e.dept_id) AS dept_avg
FROM emp AS e
WHERE e.salary < (
  SELECT AVG(e2.salary) FROM emp AS e2 WHERE e2.dept_id = e.dept_id
)
ORDER BY e.id;
```

## 综合多表查询实战：先定结果粒度再写 JOIN

写复杂多表 SQL 前，第一件事是明确“输出结果的每一行代表哪个业务对象”，再决定驱动表、连接类型（内连接还是左连接）以及非等值或中间表关联条件。

例如结合薪资等级表 `salary_grade`（区间采用左闭右开 `[low_salary, high_salary)` 设计，避免 `8000` 这类边界值命中两级或漏掉小数位）：

```sql
CREATE TABLE salary_grade (
  grade INT PRIMARY KEY,
  low_salary DECIMAL(10,2),
  high_salary DECIMAL(10,2)
);
INSERT INTO salary_grade VALUES
  (1, 0, 5000), (2, 5000, 8000), (3, 8000, 12000), (4, 12000, 30000);

-- 查询研发部员工姓名、工资及对应薪资等级（每行代表一名研发部员工）
SELECT e.name, e.salary, g.grade
FROM emp AS e
JOIN dept AS d ON d.id = e.dept_id
JOIN salary_grade AS g ON e.salary >= g.low_salary AND e.salary < g.high_salary
WHERE d.name = '研发部'
ORDER BY e.id;
```

再例如经由多对多中间表查询选修了 `MySQL`（主键 `id = 2`）的学生信息：

```sql
SELECT s.student_no, s.name
FROM student AS s
JOIN student_course AS sc ON sc.student_id = s.id
JOIN course AS c ON c.id = sc.course_id
WHERE c.id = 2
ORDER BY s.id;
```

这里先确定结果每行代表一名学生，优先按主键 `c.id = 2` 而非可能重名的 `c.name` 定位课程；如果需求改为“统计所有学生的选课列表且包含未选课学生”，则两条连接都必须改为 `LEFT JOIN`，避免第二次内连接把尚未选课的学生行过滤掉。
