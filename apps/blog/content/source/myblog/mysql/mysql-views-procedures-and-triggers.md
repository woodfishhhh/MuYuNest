---
title: "MySQL 数据库编程对象：视图检查选项、存储过程、游标与触发器"
slug: mysql-views-procedures-and-triggers
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "视图"
  - "存储过程"
  - "游标"
  - "触发器"
---

MySQL 除了用表存数据，还支持视图、存储过程、存储函数、游标和触发器这几类数据库端编程对象。在在线业务开发里，它们远不如基础 SQL 高频，但涉及遗留系统维护、视图权限隔离、多级 `CHECK OPTION` 校验或轻量数据审计时，弄清每类对象的执行时机、权限上下文与副作用边界至关重要。

## 视图与 `WITH CHECK OPTION` 传播规则

MySQL 的普通视图只保存一条查询定义，不额外存储数据。通过视图查询时，服务端会按视图的 `WHERE` 过滤底层基表；若视图仅映射单张基表且保留主码，还支持直接执行 `INSERT`、`UPDATE`、`DELETE`。

这里隐藏着一个常见反直觉现象：如果创建视图 `CREATE VIEW v_student AS SELECT id, name FROM view_student WHERE id <= 20;` 而不加任何检查选项，执行 `INSERT INTO v_student VALUES (30, 'Tom')` 会直接写入基表成功，但紧接着查询 `v_student` 却看不到 `id = 30` 的记录。要拦截这种“写得进去却看不见”的写入，必须声明 `WITH CHECK OPTION`。

当视图存在多层嵌套时，`CASCADED` 与 `LOCAL` 决定了检查范围向下穿透多深（未显式指定时默认按 `CASCADED` 处理）：

```sql
CREATE TABLE view_student (id INT PRIMARY KEY, name VARCHAR(20));

-- 场景 1：v_cascade 声明 CASCADED，会强制检查自身及所有下层视图条件
CREATE VIEW v_base AS SELECT id, name FROM view_student WHERE id <= 20;
CREATE VIEW v_cascade AS SELECT id, name FROM v_base WHERE id >= 10 WITH CASCADED CHECK OPTION;

-- 场景 2：v_local 声明 LOCAL，只检查自身条件；未声明检查的下层 v_local_base 不强制校验
CREATE VIEW v_local_base AS SELECT id, name FROM view_student WHERE id <= 15;
CREATE VIEW v_local AS SELECT id, name FROM v_local_base WHERE id >= 10 WITH LOCAL CHECK OPTION;
```

| 写入入口 | 当前层条件与模式 | 下层条件（无 CHECK OPTION） | 插入 `id = 18` | 插入 `id = 26` |
| :--- | :--- | :--- | :--- | :--- |
| `v_cascade` | `>= 10` (`CASCADED`) | `<= 20` | 两层均满足，写入成功 | 违反下层 `<= 20`，**拒绝** |
| `v_local` | `>= 10` (`LOCAL`) | `<= 15` | 满足本层 `>= 10`，**可写入但读不可见** | 满足本层 `>= 10`，**可写入但读不可见** |

`LOCAL` 并不会取消下层视图的 `WHERE` 过滤，因此 `id = 18` 写入基表后，从 `v_local` 依然查不到它；而如果下层视图自身也声明了 `CHECK OPTION`，`LOCAL` 同样不会跳过下层已有的校验。另外需注意，包含 `GROUP BY`、聚合函数、`DISTINCT` 或 `UNION` 的视图均不可更新；通过视图做列级敏感字段隔离时，必须同步收回调用方对基表的直接访问权限。

## 存储过程、变量作用域与存储函数边界

在命令行客户端创建包含多条分号语句的存储程序时，需先用 `DELIMITER $$` 临时切换语句结束符，避免客户端提前把半截定义发往服务端（驱动 API 提交完整字符串时无需发送 `DELIMITER`）。

### 1. 四类变量的作用域隔离

| 变量写法 | 作用域与生命周期 | 注意事项 |
| :--- | :--- | :--- |
| `@@global.var` | 全局实例配置 | 调整前需确认是否支持动态修改及权限要求 |
| `@@session.var` | 当前数据库连接会话 | 仅影响当前会话，连接断开即失效 |
| `@user_var` | 当前连接用户变量，无需 `DECLARE` | **连接池复用时可能残留上次值**，未赋值默认为 `NULL` |
| `v_local` | `BEGIN ... END` 语句块局部变量 | 必须在块开头 `DECLARE`，过程内部中间状态优先用它 |

### 2. 存储过程 vs 存储函数

存储过程通过 `CALL` 调用，支持 `IN`（入参）、`OUT`（出参，回写至用户变量）和 `INOUT`（双向传参）三种模式，并可通过 `SELECT` 返回多个结果集；存储函数则用于嵌入 `SELECT` 或 `WHERE` 表达式中，只能接收输入参数并由 `RETURN` 返回单个标量值。

```sql
DELIMITER $$
CREATE PROCEDURE grade_score(IN p_score INT, OUT p_result VARCHAR(20))
BEGIN
  IF p_score IS NULL OR p_score < 0 OR p_score > 100 THEN
    SET p_result = '非法分数';
  ELSEIF p_score >= 85 THEN
    SET p_result = '优秀';
  ELSEIF p_score >= 60 THEN
    SET p_result = '及格';
  ELSE
    SET p_result = '不及格';
  END IF;
END$$

CREATE FUNCTION sum_to_n(p_n INT)
RETURNS BIGINT
DETERMINISTIC
CONTAINS SQL
BEGIN
  DECLARE v_i BIGINT DEFAULT 1;
  DECLARE v_total BIGINT DEFAULT 0;
  IF p_n IS NULL OR p_n < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'n must be nonnegative';
  END IF;
  WHILE v_i <= p_n DO
    SET v_total = v_total + v_i;
    SET v_i = v_i + 1;
  END WHILE;
  RETURN v_total;
END$$
DELIMITER ;
```

**存储过程里的 `BEGIN ... END` 只是复合语句块，绝对不等同于事务边界——多条 DML 要保证原子回滚，仍需显式控制 `START TRANSACTION`、`COMMIT` 与 `ROLLBACK`。**

创建存储函数时，若实例开启了二进制日志（binlog），必须如实声明函数特性：`DETERMINISTIC`（相同输入必得相同输出）、`NO SQL`（无 SQL）、`CONTAINS SQL`（含非读写表语句）或 `READS SQL DATA`（只读表数据），严禁为了绕过安全校验而虚报特性。

在控制流语法上，除条件分支 `IF ... ELSEIF ... END IF` 与 `CASE ... WHEN ... END CASE` 外，MySQL 支持三种循环：`WHILE` 先判条件再执行；`REPEAT ... UNTIL cond END REPEAT` 先执行一轮再按退出条件终止；`LOOP` 需显式配合带标签的 `LEAVE label`（跳出循环）和 `ITERATE label`（进入下一轮）避免死循环。若需主动中止并抛出自定义异常，使用 `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...'`。

## 游标逐行读取与集合操作的工程取舍

`SELECT ... INTO var` 只能接收单行标量结果。需要在存储过程中逐行消费多行查询结果集时，必须声明游标（Cursor）并搭配 `CONTINUE HANDLER FOR NOT FOUND` 捕获末尾状态。

声明顺序在语句块内严格锁定为：**局部变量 → 游标 → 条件处理器（Handler）**。

```sql
DELIMITER $$
CREATE PROCEDURE copy_profession(IN p_age INT)
BEGIN
  DECLARE v_done BOOLEAN DEFAULT FALSE;
  DECLARE v_id INT;
  DECLARE v_name VARCHAR(30);
  DECLARE v_profession VARCHAR(30);
  DECLARE user_cursor CURSOR FOR
    SELECT id, name, profession FROM index_user
    WHERE age <= p_age ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  OPEN user_cursor;
  read_loop: LOOP
    FETCH user_cursor INTO v_id, v_name, v_profession;
    IF v_done THEN LEAVE read_loop; END IF;
    INSERT INTO user_profession(source_id, name, profession)
    VALUES (v_id, v_name, v_profession);
  END LOOP read_loop;
  CLOSE user_cursor;
END$$
DELIMITER ;
```

**循环体内必须先检查 `IF v_done THEN LEAVE ...`，再执行业务写入——因为最后一次 `FETCH` 读空后不会清空变量，把 `INSERT` 放在判断前面会把上一行重复写两遍。**

此外需留意 `NOT FOUND` Handler 的作用域：同一 `BEGIN ... END` 块中若还有其他可能返回空行的 `SELECT INTO`，同样会触发该 Handler 并误改 `v_done`，因此复杂过程应使用嵌套 `BEGIN ... END` 隔离作用范围。

## 触发器 `OLD` / `NEW` 与审计日志坑点

MySQL 仅支持行级触发器（`FOR EACH ROW`），即一条 `UPDATE` 改动 100 行就会触发 100 次。事件触发前可用 `BEFORE`，事件执行后可用 `AFTER`；按事件类型可访问的行快照如下：

| 触发事件 | `OLD` 行引用 | `NEW` 行引用 |
| :--- | :--- | :--- |
| `INSERT` | 不可用 | 待插入/已插入的新行 |
| `UPDATE` | 更新前的旧行 | 更新后的新行 |
| `DELETE` | 待删除/已删除的旧行 | 不可用 |

记录行级变更审计时，建议用 `JSON_OBJECT` 拼装前后快照，避免老式 `CONCAT` 遇到任一字段为 `NULL` 时把整条日志抹成 `NULL`：

```sql
CREATE TABLE user_change_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operation VARCHAR(10) NOT NULL,
  operated_at DATETIME(6) NOT NULL,
  source_id INT NOT NULL,
  before_data JSON,
  after_data JSON
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER index_user_after_update
AFTER UPDATE ON index_user FOR EACH ROW
BEGIN
  INSERT INTO user_change_log(operation, operated_at, source_id, before_data, after_data)
  VALUES (
    'UPDATE', NOW(6), NEW.id,
    JSON_OBJECT('name', OLD.name, 'profession', OLD.profession),
    JSON_OBJECT('name', NEW.name, 'profession', NEW.profession)
  );
END$$
DELIMITER ;
```

使用触发器有两条硬边界必须清醒：
1. **同步阻塞且共命运**：触发器在原业务事务内同步执行。一旦日志表写入报错（如主键或约束冲突），原业务 `INSERT`/`UPDATE` 会连带失败；反过来若业务事务 `ROLLBACK`，InnoDB 日志表的写入也会一起回滚。
2. **并非全覆盖**：`TRUNCATE TABLE` 直接重建表而不逐行扫描，**不会触发 `DELETE` 触发器**；外键级联删除也不会像普通语句那样按预期触发所有行级钩子。

## 工程选型红线：少写数据库端过程代码

**凡是能用一条集合 SQL（如 `INSERT ... SELECT`、`UPDATE ... JOIN`）完成的数据搬运与聚合，严禁拆成游标逐行循环；复杂业务逻辑一律放在应用服务层，而不是塞进存储过程和触发器。**

以游标复制表数据为例，整套 `copy_profession` 完全等价于一句 `INSERT INTO user_profession(source_id, name, profession) SELECT id, name, profession FROM index_user WHERE age <= 30;`——前者逐行往返引擎、持锁时间长且代码臃肿，后者由优化器一次性批量完成。

在线上架构中限制存储过程与触发器的根本原因在于成本与可维护性：数据库是整个系统最难横向扩展的有状态瓶颈，把计算与分支循环压进数据库只会白白消耗珍贵的 DB CPU；同时，数据库端程序极难纳入 Git 版本审计、自动化单元测试和灰度回滚，隐藏在触发器里的隐式级联写入更会在故障排查时制造盲区。除极少数 DBA 维护批处理或严格合规视图隔离外，保持数据库专注于数据存储、索引检索与事务一致性才是更稳妥的工程边界。
