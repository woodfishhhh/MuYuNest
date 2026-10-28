---
title: "MySQL（19）：循环与存储函数"
date: 2026-10-17 00:00:00
slug: mysql-heima-19
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

从 1 累加到 n，循环的三个要素看得很清楚：现在加到哪了、累计值是多少、什么时候停。下面用课程里的求和任务对比 WHILE、REPEAT 和 LOOP。真要算等差数列总和直接用公式就行，这里的循环是为了理解存储程序的控制流。

所有示例都只接收非负整数，NULL 或负数会报错。累计变量用 BIGINT，免得结果稍大就超出 INT；但循环次数还是由 n 决定，别拿特别大的输入做性能测试。

## WHILE 先判断，再执行

```sql
DELIMITER $$
CREATE PROCEDURE sum_while(IN p_n INT,OUT p_total BIGINT)
BEGIN
  DECLARE v_i BIGINT DEFAULT 1;
  IF p_n IS NULL OR p_n<0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='n must be nonnegative';
  END IF;
  SET p_total=0;
  WHILE v_i<=p_n DO
    SET p_total=p_total+v_i;
    SET v_i=v_i+1;
  END WHILE;
END$$
DELIMITER ;
CALL sum_while(10,@total);
SELECT @total; -- 55
```

v_i 从 1 开始，每轮先加进累计值，再前进到下一个整数。n=3 时累计值依次是 1、3、6，v_i 变成 4 后条件不成立。n=0 时第一次判断就失败，循环一次都不执行，返回 0。

SIGNAL 用来主动抛出错误，SQLSTATE '45000' 常用于自定义异常。这样无效输入和正常得到零就区分开了。

以 n=3 为例，循环状态这样变化：

| 进入判断时 v_i | `v_i<=3` | 本轮累加后的 total | 递增后的 v_i |
| --- | --- | --- | --- |
| 1 | 真 | 1 | 2 |
| 2 | 真 | 3 | 3 |
| 3 | 真 | 6 | 4 |
| 4 | 假 | 不再执行，仍为 6 | 仍为 4 |

这张表能看出两个常见的边界错误：

- 条件写成 `<p_n`：等于 n 的最后一项不会被累加
- 忘了递增 v_i：条件一直拿同一个值判断，循环没法自然结束

计数变量用 BIGINT，还能避免 p_n 接近 INT 上界时，最后一次递增先溢出、走不到退出判断。

## REPEAT 先执行一次，再判断退出

```sql
DELIMITER $$
CREATE PROCEDURE sum_repeat(IN p_n INT,OUT p_total BIGINT)
BEGIN
  DECLARE v_i BIGINT DEFAULT 1;
  IF p_n IS NULL OR p_n<0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='n must be nonnegative';
  END IF;
  SET p_total=0;
  IF p_n>0 THEN
    REPEAT
      SET p_total=p_total+v_i;
      SET v_i=v_i+1;
    UNTIL v_i>p_n END REPEAT;
  END IF;
END$$
DELIMITER ;
CALL sum_repeat(100,@total);
SELECT @total; -- 5050
```

UNTIL 后面写“什么时候结束”，跟 WHILE 写“什么时候继续”正好相反。外层 IF 处理 n=0；去掉它的话，REPEAT 至少执行一次，会错误地把 1 加进结果。

## LOOP 用 LEAVE 退出，用 ITERATE 跳过本轮

下面算 1～n 的偶数和，还是课程里的任务：

```sql
DELIMITER $$
CREATE PROCEDURE sum_even(IN p_n INT,OUT p_total BIGINT)
BEGIN
  DECLARE v_i BIGINT DEFAULT 0;
  IF p_n IS NULL OR p_n<0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='n must be nonnegative';
  END IF;
  SET p_total=0;
  sum_loop: LOOP
    IF v_i>=p_n THEN LEAVE sum_loop; END IF;
    SET v_i=v_i+1;
    IF MOD(v_i,2)=1 THEN ITERATE sum_loop; END IF;
    SET p_total=p_total+v_i;
  END LOOP sum_loop;
END$$
DELIMITER ;
CALL sum_even(10,@total);
SELECT @total; -- 2+4+6+8+10=30
CALL sum_even(100,@total);
SELECT @total; -- 2550
```

LOOP 本身没有条件，所以一定要有能走到的退出路径。sum_loop 是循环标签，LEAVE 指明退出哪个块，ITERATE 指明跳到哪个循环的下一轮。

这里先递增 v_i 再判断奇偶，所以碰到奇数跳过剩下的语句后，下一轮还会继续往前走。要是把唯一的递增放到 ITERATE 后面，奇数分支永远执行不到递增，循环就卡住了。

同样的思路也能算全部整数之和：去掉 MOD/ITERATE 那个分支，每轮都累加。循环写法可以换，但输入范围、状态推进和退出条件必须对得上。

LEAVE 和 ITERATE 的区别，跟着 v_i=3、4 走一遍就清楚：

- 处理到 3：MOD 得到 1，ITERATE 让控制流直接回到循环开头，这一轮不把 3 加进总和
- 下一轮：先检查退出条件，再递增到 4；4 是偶数，不触发 ITERATE，继续累加
- 直到 v_i 已经达到 n，顶部的 LEAVE 才退出整个循环

标签用来确定跳转目标。以后有嵌套循环时，“跳过内层这一轮”和“结束外层整个任务”是两个不同的动作；LEAVE 和 ITERATE 后面的标签必须指向你想控制的那个块或循环，不能靠“离代码最近”去猜。

## 存储函数把单个结果放回表达式

存储过程用 CALL 调用；存储函数可以像普通函数一样放进 SELECT，用 RETURN 返回一个值。函数参数都按输入用，不用过程那种 OUT、INOUT 形式。

```sql
DELIMITER $$
CREATE FUNCTION sum_to_n(p_n INT)
RETURNS BIGINT
DETERMINISTIC
CONTAINS SQL
BEGIN
  DECLARE v_i BIGINT DEFAULT 1;
  DECLARE v_total BIGINT DEFAULT 0;
  IF p_n IS NULL OR p_n<0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='n must be nonnegative';
  END IF;
  WHILE v_i<=p_n DO
    SET v_total=v_total+v_i;
    SET v_i=v_i+1;
  END WHILE;
  RETURN v_total;
END$$
DELIMITER ;

SELECT sum_to_n(100); -- 5050
SELECT sum_to_n(50); -- 1275
SHOW CREATE FUNCTION sum_to_n;
```

- RETURNS 声明返回类型，RETURN 返回实际结果
- DETERMINISTIC：相同输入产生相同输出
- CONTAINS SQL：包含语句，但不读写数据表，跟这里的变量赋值和计算相符
- NO SQL：声明不含 SQL 语句，不能只因为没查表就直接这么标

函数会读表的话，要按实际行为声明 READS SQL DATA 等特征，别为了通过创建检查就随便承诺“确定性”。[存储程序特征说明](https://dev.mysql.com/doc/mysql/8.0/en/create-procedure.html)

开了二进制日志时，创建函数可能受权限和安全声明的限制，按报错去核对配置，别上来就放宽全局限制。过程和函数在事务控制、结果集等方面还有区别，不能因为过程也能输出参数，就认为所有函数的使用场景都能原样改成 CALL。

验证这组例子，至少核对 n=0、n=1、n=10，以及负数和 NULL 的报错路径：前三个验证循环入口和边界，后两个验证输入约束。这里给的是预期结果，实际运行范围见来源附录。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-18) · [下一篇](/posts/mysql-heima-20)
