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

SELECT INTO 可以把一行中的若干列赋给相应变量，但一个普通 INT 变量接不住多行结果。需要逐行处理查询结果时，可以声明游标，再依次 FETCH。游标描述如何访问结果集，并不意味着应用已经拿到一个可以任意跳转修改的内存数组。

课程的任务是按年龄筛选用户，把姓名与专业写入另一张表。下面沿用 index_user，年龄条件明确为 `age<=p_age`。如果只需要复制数据，实际更适合 `INSERT ... SELECT`；这里先把游标的完整过程走通。

## 先准备目标表，再创建过程

目标表在过程外创建，避免每次调用都 DROP/CREATE 表，以及 DDL 带来的提交边界变化：

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

声明顺序有规则：普通变量与条件在前，游标在后，handler 再后面，然后才开始执行 OPEN 等语句。FETCH 的变量数量和顺序要与 SELECT 的列对应。

打开游标后，每次 FETCH 取得下一行。读到末尾时触发 NOT FOUND，handler 把 v_done 置为 TRUE，控制流回到 FETCH 后面，再由 LEAVE 退出。因此必须先检查 v_done，不能直接插入；否则没有取到新行时，旧变量值可能被重复使用。

```sql
START TRANSACTION;
CALL copy_profession(30);
SELECT * FROM user_profession ORDER BY source_id;
ROLLBACK;
```

在初始 index_user 数据下，只有白起的年龄为 30，预期得到一行；回滚后目标表仍为空。把事务放在调用方，可以明确决定本次复制是否提交。若正式提交后再次复制同一 source_id，主键冲突会暴露重复调用；是否忽略、覆盖或拒绝重复，应由业务明确选择。

再看 p_age=31 的完整读取过程。index_user 中四个人都符合条件，游标查询按 id 排好序。OPEN 准备结果访问状态，但不会自动把第一行放进 v_id 等变量；第一次 FETCH 才取得白起。

| FETCH 次数 | 本次结果 | v_done | 接下来执行什么 |
| --- | --- | --- | --- |
| 1 | 白起，id=1 | FALSE | 插入第一行 |
| 2 | 韩信，id=2 | FALSE | 插入第二行 |
| 3 | 大乔，id=3 | FALSE | 插入第三行 |
| 4 | 曹操，id=4 | FALSE | 插入第四行 |
| 5 | 没有下一行 | handler 改为 TRUE | LEAVE，随后 CLOSE |

第五次读取并不会把变量自动清成一组可以安全写入的空值。程序先检查 done，再决定是否使用变量，因此不会把上一轮的曹操又写一次。若把 INSERT 放在 done 判断前面，这个末尾控制就被破坏了。

空结果也沿同一条流程处理。例如 p_age=10 时，第一次 FETCH 就没有行，handler 把 done 改为 TRUE，循环立即退出，目标表仍为空。代码不需要另写“查询数量等于零”的前置判断，因为游标结束条件已经覆盖了这个情况。

在目标表为空时，用 `START TRANSACTION; CALL copy_profession(31); SELECT * FROM user_profession ORDER BY source_id; ROLLBACK;` 可以核对四行顺序及回滚。不要在已经提交了一轮相同 ID 后直接重复调用，否则看到的重复键错误来自目标表约束，而不是游标读错了位置。

## handler 决定异常后的控制流

`DECLARE CONTINUE HANDLER FOR ...` 处理后继续执行引发条件的语句之后的逻辑。`EXIT HANDLER` 处理后退出声明它的 BEGIN/END 块，不能简单理解成只跳出当前循环。

常见条件类型有：NOT FOUND 对应“没有更多数据”等 02 类状态；SQLWARNING 对应 01 类警告；SQLEXCEPTION 处理其他异常类。也可以指定特定 SQLSTATE 或错误码。

课程中的另一种写法是用 EXIT HANDLER 捕获游标结束并关闭游标。它能完成简单流程，但如果过程还需要执行循环之后的正常逻辑，使用 done 标记通常更直观。

handler 的作用范围很重要。若同一块里还有其他 SELECT INTO 也可能没有结果，通用 NOT FOUND handler 也会被它触发。更复杂程序可以用嵌套块把捕获范围限制到实际需要的操作。

## 只有复制需求时，优先用集合操作

同一个任务可直接表达为：

```sql
INSERT INTO user_profession(source_id,name,profession)
SELECT id,name,profession FROM index_user WHERE age<=30;
```

数据库可以整体处理结果，不需要在存储程序中逐行 FETCH。游标适合确有逐行状态和控制要求的任务；不能因为学会循环，就把可以用一条 SQL 完成的操作都改成循环。

检查游标程序时，重点核对空结果、最后一行、重复调用和中途写入失败。正常结束不报错只能说明控制流跑完，还要查询目标表确认没有漏行或重复行，并确认事务是否按预期提交。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-19) · [下一篇](/posts/mysql-heima-21)
