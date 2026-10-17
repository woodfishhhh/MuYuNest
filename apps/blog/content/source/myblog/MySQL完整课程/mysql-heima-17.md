---
title: "MySQL（17）：视图与检查选项"
date: 2026-10-17 00:00:00
slug: mysql-heima-17
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

查询学生选课需要连接学生、选课关系、课程三张表。如果多处业务都要同一种结果，可以把查询保存成视图，再像查表一样使用它。MySQL 普通视图保存查询定义，查询时从基表得到结果，并不保存一份独立的业务数据副本。

## 用视图封装已确认的查询

下面使用多表查询篇已经建立的三张表：

```sql
CREATE VIEW student_course_view AS
SELECT s.name AS student_name,
       s.student_no,
       c.name AS course_name
FROM student AS s
JOIN student_course AS sc ON sc.student_id=s.id
JOIN course AS c ON c.id=sc.course_id;

SELECT * FROM student_course_view;
SHOW CREATE VIEW student_course_view;
```

学生和课程都有 name，所以给输出列不同别名。视图列名必须能区分，不能把两个 name 原样放进去。

修改定义可使用 `CREATE OR REPLACE VIEW` 或 `ALTER VIEW ... AS SELECT ...`。删除定义使用 `DROP VIEW 视图名`，不会因此删除基表中的记录。基表字段变化后，需要检查依赖视图；视图不是任意结构变更的自动兼容层。

隐藏敏感列时，可以只选择允许展示的字段，例如：

```sql
CREATE VIEW index_user_public AS
SELECT id,name,profession,age,status FROM index_user;
```

但只有当使用者获得视图权限、没有同时获得基表敏感列权限时，这种隔离才有效。MySQL 本身也支持部分列级授权，不能说权限控制只能到表。视图还涉及 SQL SECURITY、DEFINER 等执行权限上下文，应在实际授权时一起核对。

## 为什么通过视图插入后，自己却查不到

用一张独立实验表重现课程中的 id 范围例子：

```sql
CREATE TABLE view_student (id INT PRIMARY KEY,name VARCHAR(20));
CREATE VIEW v_student AS
SELECT id,name FROM view_student WHERE id<=20;

INSERT INTO v_student VALUES (6,'Tom');
INSERT INTO v_student VALUES (30,'Tom');
SELECT * FROM view_student ORDER BY id;
SELECT * FROM v_student ORDER BY id;
```

基表有 6 和 30，视图只显示 6。INSERT 实际写入基表，而 WHERE 是视图读取时的过滤条件；没有额外检查时，能经视图写进去的记录不一定能再经视图读出来。

加上检查选项后，再尝试插入超出范围的记录：

```sql
ALTER VIEW v_student AS
SELECT id,name FROM view_student WHERE id<=20
WITH CHECK OPTION;
INSERT INTO v_student VALUES (31,'Tom'); -- 预期检查失败
```

CHECK OPTION 用于限制经可更新视图执行 INSERT、UPDATE 后的数据必须满足相应条件。它不会清理之前已经写入的 id 30，也不能一概描述成检查所有 DELETE 行为。

视图可以理解为一扇带筛选条件的查询窗口。通过它查询，看到的是满足条件的基表行；通过可更新视图写入，最终受修改的仍是基表。没有 CHECK OPTION 时，这两条路径之间没有“写进去后必须还能从窗口看见”的额外要求，所以 id=30 可以写入但被窗口遮住。

加检查选项后，服务器在经视图 INSERT、UPDATE 时，检查写入后的行是否符合相关条件。已有的 6 若被更新成 25，也会越过 `id<=20`，因而应被拒绝。直接操作基表时并不等于通过此视图写入，不能指望一个视图定义约束所有入口；需要所有入口都遵守的规则，应放在相应的表约束和权限边界中。

## CASCADED 与 LOCAL 差在检查向下传播的范围

视图还可以建立在另一个视图之上。先建立没有检查选项的底层视图，再建立有级联检查的上层视图：

```sql
CREATE VIEW v_base AS
SELECT id,name FROM view_student WHERE id<=20;

CREATE VIEW v_cascade AS
SELECT id,name FROM v_base WHERE id>=10
WITH CASCADED CHECK OPTION;
```

通过 v_cascade 插入时，既检查 id>=10，也检查下层的 id<=20，即使 v_base 自己没声明 CHECK OPTION。于是 id 7 失败，26 失败，15 满足两层条件。省略 CASCADED/LOCAL 时，CHECK OPTION 默认按 CASCADED 处理。

再包一层没有检查选项的视图：

```sql
CREATE VIEW v_top AS
SELECT id,name FROM v_cascade WHERE id<=15;
```

通过 v_top 插入 id 17，不检查本层的 <=15，但仍要履行下层 v_cascade 已有的检查，因此 17 能写入基表，却不出现在 v_top 的查询结果中；id 28 会因下层级联检查不通过而失败。

LOCAL 的区别可以另建一组对象观察：

```sql
CREATE VIEW v_local_base AS
SELECT id,name FROM view_student WHERE id<=15;
CREATE VIEW v_local AS
SELECT id,name FROM v_local_base WHERE id>=10
WITH LOCAL CHECK OPTION;
```

LOCAL 检查本层条件，但不会强行给没声明检查的下层添加检查。因此未占用的 id 18 满足本层 >=10，可以经 v_local 写入基表；下层 <=15 仍决定读取时是否可见。如果 v_local_base 自己声明了 CHECK OPTION，其已有规则依旧有效，LOCAL 不会把它关闭。

验证时每组使用未被前面插入的 id，或者分别建表，避免主键冲突掩盖检查选项错误。应同时查基表与视图：前者证明是否写入，后者证明当前定义下是否可见。

这两种检查的差异可以用一张判断表核对，先忽略主键是否已占用，只看条件：

| 写入入口 | 当前层条件 | 下层条件 | 新 id=18 | 新 id=26 |
| --- | --- | --- | --- | --- |
| v_cascade | `>=10`，CASCADED | `<=20`，无检查选项 | 两层都符合，可写 | 下层不符合，拒绝 |
| v_local | `>=10`，LOCAL | `<=15`，无检查选项 | 仅本层检查，可写但不可见 | 仅本层检查，可写但不可见 |

表里“不可见”来自读取路径仍要穿过下层 WHERE。LOCAL 没有取消下层查询条件，它只是没有替未声明检查的下层强制增加写入检查。把“检查哪些条件”和“读的时候过滤哪些条件”分开，才不会觉得“明明检查成功却查不到”互相矛盾。

要实际观察 v_local，可以在确认 id=18 未占用后执行一个回滚实验：

```sql
START TRANSACTION;
INSERT INTO v_local(id,name) VALUES(18,'LocalTest');
SELECT id,name FROM view_student WHERE id=18;
SELECT id,name FROM v_local WHERE id=18;
ROLLBACK;
```

第一条 SELECT 在基表中应看到 18，第二条视图查询没有行，ROLLBACK 后基表中的实验记录也消失。每一步各验证一个问题：是否写入、是否可见、是否已恢复实验数据。

## 不是所有视图都能更新

```sql
CREATE VIEW v_student_count AS
SELECT COUNT(*) AS people FROM view_student;
```

这一行表示多条基表记录的聚合，无法把“把 people 改成 10”唯一翻译成基表操作，因此不能按普通表更新。GROUP BY、聚合、DISTINCT、UNION 等常见结构也会限制可更新性；复杂连接视图还有更细的规则。

即使一个视图可以 UPDATE，也不代表一定可以 INSERT。例如基表有不可空、无默认值的列，而视图没有提供它，就可能无法插入。需要检查具体语句和基表约束，不能只用“看起来一行对应一行”作充分证明。

级联和本地检查的规则见 [WITH CHECK OPTION](https://dev.mysql.com/doc/refman/8.4/en/view-check-option.html)；该补充链接为 8.4 手册，本文实验语法沿用 8.0。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-16) · [下一篇](/posts/mysql-heima-18)
