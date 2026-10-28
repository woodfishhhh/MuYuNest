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

查学生选课要连学生、选课关系、课程三张表。好几处业务都要同样的结果，就可以把查询存成视图，再像查表一样用它。MySQL 的普通视图存的是查询定义，查询时从基表拿结果，不另存一份独立的业务数据。

## 用视图封装已确认的查询

用多表查询篇里已经建好的三张表：

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

学生和课程都有 name，所以给输出列起不同的别名。视图的列名必须区分得开，不能原样放两个 name。

改定义用 `CREATE OR REPLACE VIEW` 或 `ALTER VIEW ... AS SELECT ...`。删定义用 `DROP VIEW 视图名`，基表里的记录不会跟着删。基表字段变了，要检查依赖它的视图；视图不会自动兼容任意的结构变更。

要隐藏敏感列，可以只选允许展示的字段，比如：

```sql
CREATE VIEW index_user_public AS
SELECT id,name,profession,age,status FROM index_user;
```

但只有使用者拿到视图权限、同时没拿到基表敏感列的权限时，这种隔离才有效。MySQL 本身也支持部分列级授权，权限控制不是只能到表。视图还涉及 SQL SECURITY、DEFINER 等执行权限上下文，实际授权时要一起核对。

## 为什么通过视图插入后，自己却查不到

用一张单独的实验表重现课程里的 id 范围例子：

```sql
CREATE TABLE view_student (id INT PRIMARY KEY,name VARCHAR(20));
CREATE VIEW v_student AS
SELECT id,name FROM view_student WHERE id<=20;

INSERT INTO v_student VALUES (6,'Tom');
INSERT INTO v_student VALUES (30,'Tom');
SELECT * FROM view_student ORDER BY id;
SELECT * FROM v_student ORDER BY id;
```

基表里有 6 和 30，视图只显示 6。INSERT 实际写的是基表，WHERE 是读视图时的过滤条件；没有额外检查的话，能通过视图写进去的记录，不一定能再通过视图读出来。

加上检查选项，再试着插入超出范围的记录：

```sql
ALTER VIEW v_student AS
SELECT id,name FROM view_student WHERE id<=20
WITH CHECK OPTION;
INSERT INTO v_student VALUES (31,'Tom'); -- 预期检查失败
```

CHECK OPTION 要求通过可更新视图执行 INSERT、UPDATE 后的数据必须满足相应条件。之前已经写进去的 id 30 它不会清理，也不能笼统说成它会检查所有 DELETE 行为。

可以把视图理解成一扇带筛选条件的查询窗口：通过它查，看到的是满足条件的基表行；通过可更新视图写，最后改的还是基表。没有 CHECK OPTION 时，不要求“写进去之后还能从窗口里看见”，所以 id=30 能写进去，只是被窗口挡住了。

加了检查选项，服务器在通过视图 INSERT、UPDATE 时，会检查写入后的行是否符合相关条件。已有的 6 要是被更新成 25，也超出了 `id<=20`，会被拒绝。直接操作基表不算通过这个视图写入，别指望一个视图定义能约束所有入口；所有入口都要遵守的规则，要放到相应的表约束和权限控制里。

## CASCADED 与 LOCAL 差在检查向下传播的范围

视图还可以建在另一个视图上。先建一个没有检查选项的底层视图，再建一个带级联检查的上层视图：

```sql
CREATE VIEW v_base AS
SELECT id,name FROM view_student WHERE id<=20;

CREATE VIEW v_cascade AS
SELECT id,name FROM v_base WHERE id>=10
WITH CASCADED CHECK OPTION;
```

通过 v_cascade 插入时，既检查 id>=10，也检查下层的 id<=20，哪怕 v_base 自己没声明 CHECK OPTION。所以 id 7 失败，26 失败，15 两层条件都满足。不写 CASCADED/LOCAL 时，CHECK OPTION 默认按 CASCADED 处理。

再包一层没有检查选项的视图：

```sql
CREATE VIEW v_top AS
SELECT id,name FROM v_cascade WHERE id<=15;
```

通过 v_top 插入 id 17：本层的 <=15 不检查，但下层 v_cascade 已有的检查还是要过，所以 17 能写进基表，却不会出现在 v_top 的查询结果里；id 28 过不了下层的级联检查，失败。

LOCAL 的区别另建一组对象来看：

```sql
CREATE VIEW v_local_base AS
SELECT id,name FROM view_student WHERE id<=15;
CREATE VIEW v_local AS
SELECT id,name FROM v_local_base WHERE id>=10
WITH LOCAL CHECK OPTION;
```

LOCAL 检查本层条件，但不会替没声明检查的下层强行加检查。所以没被占用的 id 18 满足本层的 >=10，可以通过 v_local 写进基表；读取时看不看得见，还是由下层的 <=15 决定。要是 v_local_base 自己声明了 CHECK OPTION，它已有的规则照样有效，LOCAL 不会把它关掉。

验证时每组用前面没插过的 id，或者分开建表，免得主键冲突把检查选项的错误盖住。基表和视图都要查：查基表看写没写进去，查视图看当前定义下能不能看见。

两种检查的差别可以用一张表核对，先不管主键有没有被占用，只看条件：

| 写入入口 | 当前层条件 | 下层条件 | 新 id=18 | 新 id=26 |
| --- | --- | --- | --- | --- |
| v_cascade | `>=10`，CASCADED | `<=20`，无检查选项 | 两层都符合，可写 | 下层不符合，拒绝 |
| v_local | `>=10`，LOCAL | `<=15`，无检查选项 | 仅本层检查，可写但不可见 | 仅本层检查，可写但不可见 |

表里的“不可见”，是因为读取时还要经过下层的 WHERE。LOCAL 没有取消下层的查询条件，只是没有给未声明检查的下层强加写入检查。把“写入时检查哪些条件”和“读取时过滤哪些条件”分开想，就不会觉得“明明检查通过了却查不到”是矛盾的。

要实际看看 v_local，确认 id=18 没被占用后，做一个回滚实验：

```sql
START TRANSACTION;
INSERT INTO v_local(id,name) VALUES(18,'LocalTest');
SELECT id,name FROM view_student WHERE id=18;
SELECT id,name FROM v_local WHERE id=18;
ROLLBACK;
```

第一条 SELECT 在基表里应该能看到 18，第二条视图查询没有行，ROLLBACK 后基表里的实验记录也没了。每一步验证一件事：写没写进去、看不看得见、实验数据恢复了没有。

## 不是所有视图都能更新

```sql
CREATE VIEW v_student_count AS
SELECT COUNT(*) AS people FROM view_student;
```

这一行是多条基表记录的聚合，“把 people 改成 10”没法唯一地翻译成基表操作，所以不能像普通表那样更新。GROUP BY、聚合、DISTINCT、UNION 这些常见结构也会限制可更新性；复杂的连接视图还有更细的规则。

视图能 UPDATE，也不一定能 INSERT。比如基表有不可空、没有默认值的列，视图里又没提供这一列，就可能插不进去。要检查具体语句和基表约束，光凭“看起来一行对应一行”不够。

级联和本地检查的规则见 [WITH CHECK OPTION](https://dev.mysql.com/doc/refman/8.4/en/view-check-option.html)；这个补充链接是 8.4 手册，本文实验语法沿用 8.0。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-16) · [下一篇](/posts/mysql-heima-18)
