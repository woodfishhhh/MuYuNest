---
title: "MySQL（20）：游标与条件处理"
date: 2026-10-17 00:00:00
slug: mysql-heima-20
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

SELECT INTO 只能把一行结果赋给变量，普通 INT 变量接不住多行。要逐行处理查询结果，就声明游标，再一行行 FETCH。游标只是按顺序读结果集的方式，不是一个能随便跳转、修改的内存数组。

课程的例子：按年龄筛选用户，把姓名和专业写进另一张表。下面沿用 index_user，条件写成 `age<=p_age`。只是复制数据的话，其实用 `INSERT ... SELECT` 更合适，这里先把游标的流程走一遍。

## 先准备目标表，再创建过程

目标表在过程外面建好，免得每次调用都 DROP/CREATE，也避开 DDL 带来的隐式提交：

```sql
CREATE TABLE user_profession (
  source_id INT PRIMARY KEY,
  name VARCHAR(30),
  profession VARCHAR(30)
) ENGINE=InnoDB;

DELIMITER $$
CREATE PROCEDURE copy_profession(IN p_age INT)
BEGIN
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_id INT;
  DECLARE v_name VARCHAR(30);
  DECLARE v_profession VARCHAR(30);
  DECLARE user_cursor CURSOR FOR
    SELECT id,name,profession FROM index_user
    WHERE age<=p_age ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;

  OPEN user_cursor;
  read_loop: LOOP
    FETCH user_cursor INTO v_id,v_name,v_profession;
    IF v_done THEN LEAVE read_loop; END IF;
    INSERT INTO user_profession(source_id,name,profession)
    VALUES(v_id,v_name,v_profession);
  END LOOP read_loop;
  CLOSE user_cursor;
END$$
DELIMITER ;
```

声明顺序是固定的：普通变量和条件 → 游标 → handler，然后才是 OPEN 等语句。FETCH 的变量个数和顺序要和 SELECT 的列一一对应。

OPEN 之后，每 FETCH 一次取下一行。读到末尾触发 NOT FOUND，handler 把 v_done 设为 TRUE，回到 FETCH 后面，再由 LEAVE 退出。所以要先判断 v_done 再插入，否则没取到新行时会把上一轮的旧值再写一遍。

```sql
START TRANSACTION;
CALL copy_profession(30);
SELECT * FROM user_profession ORDER BY source_id;
ROLLBACK;
```

按初始 index_user 数据，只有白起年龄是 30，预期得到一行；回滚后目标表还是空的。事务放在调用方，由调用方决定这次复制提不提交。提交后再复制同一个 source_id 会主键冲突，正好暴露重复调用；要忽略、覆盖还是拒绝，看业务需要。

再看 p_age=31 时完整的读取过程。index_user 里四个人都符合，游标查询按 id 排序。OPEN 只是准备好结果，不会自动把第一行放进 v_id 这些变量，第一次 FETCH 才拿到白起。

| FETCH 次数 | 本次结果 | v_done | 接下来执行什么 |
| --- | --- | --- | --- |
| 1 | 白起，id=1 | FALSE | 插入第一行 |
| 2 | 韩信，id=2 | FALSE | 插入第二行 |
| 3 | 大乔，id=3 | FALSE | 插入第三行 |
| 4 | 曹操，id=4 | FALSE | 插入第四行 |
| 5 | 没有下一行 | handler 改为 TRUE | LEAVE，随后 CLOSE |

第五次 FETCH 不会把变量清空。因为先判断 done 再决定用不用变量，所以不会把上一轮的曹操再写一次。要是把 INSERT 放到 done 判断前面，就会出这个问题。

空结果也走同一套流程。比如 p_age=10，第一次 FETCH 就没数据，handler 把 done 改成 TRUE，循环直接退出，目标表还是空的。不用额外写"查询数量等于零"的判断，游标结束条件已经覆盖了。

目标表为空时，可以用 `START TRANSACTION; CALL copy_profession(31); SELECT * FROM user_profession ORDER BY source_id; ROLLBACK;` 核对四行的顺序和回滚。别在已经提交过同一批 ID 之后再直接调用，那时的重复键报错来自目标表约束，不是游标读错了位置。

## handler 决定异常后的控制流

`DECLARE CONTINUE HANDLER FOR ...`：处理完继续执行触发条件那条语句之后的逻辑。`EXIT HANDLER`：处理完退出声明它的 BEGIN/END 块，不只是跳出当前循环。

常见条件类型：

- NOT FOUND：没有更多数据等 02 类状态
- SQLWARNING：01 类警告
- SQLEXCEPTION：其他异常

也可以指定具体的 SQLSTATE 或错误码。

课程里另一种写法是用 EXIT HANDLER 捕获游标结束并关闭游标。简单流程能用，但如果循环后面还有正常逻辑要跑，用 done 标记更直观。

注意 handler 的作用范围。同一个块里如果还有别的 SELECT INTO 可能查不到结果，通用的 NOT FOUND handler 也会被它触发。复杂一点的程序可以用嵌套块，把捕获范围限制在真正需要的操作上。

## 只有复制需求时，优先用集合操作

同样的任务可以直接写成：

```sql
INSERT INTO user_profession(source_id,name,profession)
SELECT id,name,profession FROM index_user WHERE age<=30;
```

数据库能整体处理结果，不用在存储过程里逐行 FETCH。游标只适合确实需要逐行维护状态、逐行控制的任务，别因为会写循环，就把一条 SQL 能做完的事都改成循环。

检查游标程序时，重点看：空结果、最后一行、重复调用、中途写入失败。正常跑完不报错只说明控制流走完了，还要查目标表确认没有漏行、没有重复，以及事务有没有按预期提交。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-19) · [下一篇](/posts/mysql-heima-21)
