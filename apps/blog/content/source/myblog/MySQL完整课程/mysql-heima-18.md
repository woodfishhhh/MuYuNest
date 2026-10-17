---
title: "MySQL（18）：存储过程、变量与参数"
date: 2026-10-17 00:00:00
slug: mysql-heima-18
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

应用反复执行同一组数据库操作时，可以把逻辑保存成存储过程，用 CALL 调用。这样能集中复用逻辑、减少部分网络交互，但逻辑仍在数据库执行，并不会自动获得正确的事务边界或更低的总成本。

## 定义和调用是两步

下面在 mysql 命令行中创建过程，统计已有 student 表的记录数：

```sql
DELIMITER $$
CREATE PROCEDURE count_students()
BEGIN
  SELECT COUNT(*) AS people FROM student;
END$$
DELIMITER ;

CALL count_students();
SHOW CREATE PROCEDURE count_students;
```

CREATE 保存定义，CALL 才执行其中的查询。过程里的 BEGIN/END 是复合语句块，不等于 START TRANSACTION；如果要让多次写入作为一个事务，必须另外设计提交与回滚逻辑。

DELIMITER 是 mysql 客户端的分隔符指令。创建过程时内部有多个分号，若客户端一遇分号就把半截定义发给服务器，会报语法错误。暂时改成 `$$` 后，客户端等待 END 后的 `$$` 再发送完整定义，随后恢复分号。通过驱动 API 提交完整 CREATE 字符串时，通常不要把 DELIMITER 作为 SQL 发给服务器；图形工具也有自己的脚本解析方式。

查看当前库的过程、函数，可以查询：

```sql
SELECT ROUTINE_NAME,ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA=DATABASE();
```

删除定义使用 `DROP PROCEDURE IF EXISTS count_students`。它删除数据库对象，不是取消某一次已执行的业务操作。

## 变量的名字同时体现作用范围

| 形式 | 来源和范围 |
| --- | --- |
| `@@session.autocommit` | MySQL 提供的当前会话系统变量 |
| `@@global.autocommit` | 全局默认配置，具体生效方式取决于变量 |
| `@result` | 当前连接的用户变量，不需要提前 DECLARE |
| `v_count` | BEGIN/END 内 DECLARE 的局部变量 |

```sql
SELECT @@session.autocommit,@@global.autocommit;
SET @my_name='itcast', @my_age=10;
SELECT COUNT(*) INTO @student_count FROM student;
SELECT @my_name,@my_age,@student_count;
```

未赋值的用户变量通常得到 NULL，不会自动获得某个类型的零值。另一个连接也不会共享这个变量。连接池复用连接时，用户变量可能残留，所以过程内部中间结果优先用局部变量。

SET 中可用 `=` 或 `:=` 赋值；不应依赖一条复杂 SELECT 里用户变量的赋值求值顺序构造业务逻辑。修改系统变量还要区分动态设置、重启后的配置与需要的权限，不能为了演示变量去修改整个共享实例的提交方式。

局部变量需要在语句块开头声明：

```sql
DELIMITER $$
CREATE PROCEDURE count_students_local()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  SELECT COUNT(*) INTO v_count FROM student;
  SELECT v_count AS people;
END$$
DELIMITER ;
CALL count_students_local();
```

DECLARE 给出类型和可选默认值，SELECT INTO 把查询结果写入变量。一个标量变量只能接收相应的单值，不能把多行多列结果直接塞进一个 INT。读取多行结果需要集合操作或后面讲的游标。

变量赋值与 SELECT 返回结果不是一回事。`SELECT COUNT(*) FROM student` 把一行结果返回给客户端；`SELECT COUNT(*) INTO v_count FROM student` 把结果留在过程的局部变量中，供后续语句使用。后者要给调用者看，还需要另一个 SELECT 或输出参数。

DECLARE 的位置也服务于程序结构：先把本语句块会使用的局部状态说明白，再执行实际语句。v_count 只在声明它的块内有效，过程调用结束后不会成为某个可以随时查询的全局变量。相反，`@student_count` 属于连接，后续 SQL 仍可查询它，但另一个连接有自己的一份。

系统变量则由 MySQL 定义。你可以给自己的用户变量起新名字，却不能任意创造一个 `@@global.my_option` 并希望服务器支持它。修改系统变量时，还要核对该变量是否可动态修改、是 SESSION 还是 GLOBAL，以及是否需要权限。

## IN 输入，OUT 输出，INOUT 同时承担两种角色

课程的分数等级判断可以写成下面的过程。85 分起优秀，60 分起及格，其余有效分数不及格；对输入范围的检查是为完整调用补上的前置条件。

```sql
DELIMITER $$
CREATE PROCEDURE grade_score(IN p_score INT,OUT p_result VARCHAR(20))
BEGIN
  IF p_score IS NULL OR p_score<0 OR p_score>100 THEN
    SET p_result='非法分数';
  ELSEIF p_score>=85 THEN
    SET p_result='优秀';
  ELSEIF p_score>=60 THEN
    SET p_result='及格';
  ELSE
    SET p_result='不及格';
  END IF;
END$$
DELIMITER ;

CALL grade_score(68,@result);
SELECT @result; -- 及格
CALL grade_score(98,@result);
SELECT @result; -- 优秀
CALL grade_score(18,@result);
SELECT @result; -- 不及格
```

IN 参数把调用方的 68 传给 p_score；OUT 参数把过程赋给 p_result 的结果传回 @result。它与过程内部直接 SELECT 一个结果集是不同的输出渠道。应用调用时要选择驱动支持的相应接收方式。

高分条件必须先判断：98 也满足 >=60，若先检查及格，就到不了优秀分支。`ELSEIF` 在此语法中连写，最后使用 `END IF` 结束。

200 分制换算成百分制，可以使用同一个输入输出参数：

```sql
DELIMITER $$
CREATE PROCEDURE halve_score(INOUT p_score DECIMAL(5,2))
BEGIN
  SET p_score=p_score/2;
END$$
DELIMITER ;

SET @score=198;
CALL halve_score(@score);
SELECT @score; -- 99
```

调用前 @score 提供输入，调用后保存输出；不能拿一个常量替代需要回写的用户变量。

用 `CALL grade_score(68,@result)` 把参数传递走一遍：调用时 68 被放进 p_score；过程检查它处于 0～100，所以不进入错误分支；68 不满足 >=85，继续检查 >=60，满足，于是给 p_result 赋“及格”；过程返回后，这个输出值被交给调用方的 @result。最后的 SELECT 只是显示已经得到的结果，并不是再次执行评分。

INOUT 的变化方向不同。`@score=198` 先作为 p_score 的初值传入，过程把局部参数改为 99，退出时再把 99 传回 @score。它既要读取调用方的输入，也要有地方存回输出，所以不能把字面量 198 当成可回写的变量位置。

过程中的分支也不等于事务分支。执行某一条 SET、SELECT 或 IF，不会因此自动开启一组能共同回滚的业务操作。若过程里面增加多次 DML，仍应明确由谁开始事务、谁检查失败和结束事务，避免把 BEGIN/END 的语句分组误认为事务保证。

## CASE 语句结束于 END CASE

SQL 表达式 `CASE ... END` 返回一个值；存储程序中的 CASE 语句选择执行哪组语句，结尾是 END CASE。月份判断的完整写法如下：

```sql
DELIMITER $$
CREATE PROCEDURE month_quarter(IN p_month INT)
BEGIN
  DECLARE v_result VARCHAR(20);
  CASE
    WHEN p_month BETWEEN 1 AND 3 THEN SET v_result='第一季度';
    WHEN p_month BETWEEN 4 AND 6 THEN SET v_result='第二季度';
    WHEN p_month BETWEEN 7 AND 9 THEN SET v_result='第三季度';
    WHEN p_month BETWEEN 10 AND 12 THEN SET v_result='第四季度';
    ELSE SET v_result='非法参数';
  END CASE;
  SELECT p_month AS month_value,v_result AS quarter_name;
END$$
DELIMITER ;
CALL month_quarter(4); -- 第二季度
CALL month_quarter(11); -- 第四季度
CALL month_quarter(16); -- 非法参数
```

季度按月份分组，这里没有把它当作气候季节。ELSE 同时覆盖超范围与 NULL 输入，避免没有任何分支命中时留下未定义的结果。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-17) · [下一篇](/posts/mysql-heima-19)
