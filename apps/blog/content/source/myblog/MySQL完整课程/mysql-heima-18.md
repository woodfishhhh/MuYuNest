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

应用反复执行同一组数据库操作时，可以把逻辑存成存储过程，用 CALL 调用。这样逻辑能集中复用，也能少一部分网络交互；但逻辑还是在数据库里执行，不会自动有正确的事务边界，总成本也不一定更低。

## 定义和调用是两步

在 mysql 命令行里创建一个过程，统计已有 student 表的记录数：

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

CREATE 只是保存定义，CALL 才执行里面的查询。过程里的 BEGIN/END 是复合语句块，不是 START TRANSACTION；要让多次写入成为一个事务，得另外设计提交和回滚逻辑。

DELIMITER 是 mysql 客户端的分隔符指令。过程定义里有好几个分号，客户端要是一碰到分号就把半截定义发给服务器，就会报语法错误。临时改成 `$$`，客户端会等到 END 后面的 `$$` 再把完整定义发出去，之后再改回分号。用驱动 API 提交完整的 CREATE 字符串时，一般不要把 DELIMITER 当 SQL 发给服务器；图形工具也有自己的脚本解析方式。

查看当前库的过程、函数：

```sql
SELECT ROUTINE_NAME,ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA=DATABASE();
```

删除定义用 `DROP PROCEDURE IF EXISTS count_students`。它删的是数据库对象，不会撤销某次已经执行过的业务操作。

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

没赋值的用户变量一般是 NULL，不会自动变成某种类型的零值。别的连接也不共享这个变量。连接池复用连接时用户变量可能残留，所以过程内部的中间结果优先用局部变量。

SET 里可以用 `=` 或 `:=` 赋值；别依赖复杂 SELECT 里用户变量赋值的求值顺序来写业务逻辑。改系统变量还要分清动态设置、重启后的配置和需要的权限，别为了演示变量去改整个共享实例的提交方式。

局部变量要在语句块开头声明：

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

DECLARE 给出类型和可选的默认值，SELECT INTO 把查询结果写进变量。一个标量变量只能接收对应的单值，不能把多行多列的结果直接塞进一个 INT。读多行结果要用集合操作，或者后面讲的游标。

给变量赋值和 SELECT 返回结果是两回事：

- `SELECT COUNT(*) FROM student`：把一行结果返回给客户端
- `SELECT COUNT(*) INTO v_count FROM student`：结果留在过程的局部变量里，给后面的语句用

后者要给调用者看，还得再来一个 SELECT，或者用输出参数。

DECLARE 放在开头也是为了程序结构清楚：先说明这个语句块要用哪些局部状态，再执行实际语句。v_count 只在声明它的块里有效，过程调用结束后不会变成随时能查的全局变量。`@student_count` 则属于连接，后面的 SQL 还能查到它，但另一个连接有自己的一份。

系统变量由 MySQL 定义。用户变量可以随便起新名字，但不能自己造一个 `@@global.my_option` 指望服务器支持。改系统变量时还要核对：这个变量能不能动态修改、是 SESSION 还是 GLOBAL、需不需要权限。

## IN 输入，OUT 输出，INOUT 同时承担两种角色

课程里的分数等级判断写成过程是下面这样：85 分起优秀，60 分起及格，其余有效分数不及格；输入范围的检查是为了让调用完整而补上的前置条件。

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

IN 参数把调用方的 68 传给 p_score；OUT 参数把过程给 p_result 赋的值传回 @result。这跟过程里直接 SELECT 一个结果集是两种不同的输出渠道，应用调用时要用驱动支持的对应接收方式。

高分条件要先判断：98 也满足 >=60，先检查及格的话就走不到优秀分支。这个语法里 `ELSEIF` 是连写的，最后用 `END IF` 结束。

200 分制换算成百分制，可以用同一个输入输出参数：

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

调用前 @score 提供输入，调用后保存输出；需要回写的位置不能拿常量代替用户变量。

拿 `CALL grade_score(68,@result)` 把参数传递走一遍：

1. 调用时 68 放进 p_score
2. 检查它在 0～100 之间，不进错误分支
3. 68 不满足 >=85，继续查 >=60，满足，给 p_result 赋“及格”
4. 过程返回后，这个输出值交给调用方的 @result

最后的 SELECT 只是显示已经拿到的结果，不是再评一次分。

INOUT 是双向的。`@score=198` 先作为 p_score 的初值传进去，过程把参数改成 99，退出时再把 99 传回 @score。它既要读调用方的输入，又要有地方存回输出，所以不能把字面量 198 当成可回写的变量位置。

过程里的分支也跟事务分支无关。执行某条 SET、SELECT 或 IF，不会自动开启一组能一起回滚的业务操作。过程里要是有多次 DML，还是要明确谁开始事务、谁检查失败、谁结束事务，别把 BEGIN/END 的语句分组当成事务保证。

## CASE 语句结束于 END CASE

SQL 表达式 `CASE ... END` 返回一个值；存储程序里的 CASE 语句是选择执行哪组语句，结尾是 END CASE。月份判断的完整写法：

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

季度是按月份分组的，不是气候上的季节。ELSE 同时兜住超范围和 NULL 输入，免得一个分支都没命中时留下未定义的结果。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-17) · [下一篇](/posts/mysql-heima-19)
