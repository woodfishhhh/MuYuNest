---
title: "MySQL（21）：触发器与变更日志"
date: 2026-10-17 00:00:00
slug: mysql-heima-21
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

触发器绑定在表的 INSERT、UPDATE、DELETE 事件上，执行这些操作时数据库自动运行它。课程用它记用户变更日志：调用方写用户数据时，不用再手动调"记日志"的过程。

代价是额外的写入和失败路径也被塞进了原操作里。所以先想清楚要记哪些字段，再选触发时机，别把整行敏感数据一股脑拼进日志。

## OLD 与 NEW 分别对应哪一版记录

| 事件 | 可用的行引用 |
| --- | --- |
| INSERT | NEW，待插入或已插入的记录 |
| UPDATE | OLD 是更新前，NEW 是更新后 |
| DELETE | OLD，待删除或已删除的记录 |

BEFORE 在行操作之前触发，AFTER 在行操作之后触发。AFTER 不是"事务提交之后"：整个事务后面回滚的话，InnoDB 日志表里触发器写的数据也一起回滚。

这里用的是行级触发器，`FOR EACH ROW` 表示每一行都触发一次。一条 UPDATE 改了多行，就会触发多次，不是一条 SQL 只记一条日志。

## 完整记录插入、更新和删除

下面绑定已有的 index_user 表，只记录姓名和专业。课程里用字符串拼接，这里改用 JSON 存新旧值，避免字段为 NULL 时 CONCAT 让整段日志变成 NULL。这是补充的写法，不是课程原代码。

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
CREATE TRIGGER index_user_after_insert
AFTER INSERT ON index_user FOR EACH ROW
BEGIN
  INSERT INTO user_change_log(operation,operated_at,source_id,before_data,after_data)
  VALUES('INSERT',NOW(6),NEW.id,NULL,
    JSON_OBJECT('name',NEW.name,'profession',NEW.profession));
END$$

CREATE TRIGGER index_user_after_update
AFTER UPDATE ON index_user FOR EACH ROW
BEGIN
  INSERT INTO user_change_log(operation,operated_at,source_id,before_data,after_data)
  VALUES('UPDATE',NOW(6),NEW.id,
    JSON_OBJECT('name',OLD.name,'profession',OLD.profession),
    JSON_OBJECT('name',NEW.name,'profession',NEW.profession));
END$$

CREATE TRIGGER index_user_after_delete
AFTER DELETE ON index_user FOR EACH ROW
BEGIN
  INSERT INTO user_change_log(operation,operated_at,source_id,before_data,after_data)
  VALUES('DELETE',NOW(6),OLD.id,
    JSON_OBJECT('name',OLD.name,'profession',OLD.profession),NULL);
END$$
DELIMITER ;

SHOW TRIGGERS FROM mysql_notes;
```

JSON_OBJECT 的键是日志里的字段名，值来自这次事件对应的 OLD/NEW 行。UPDATE 同时记前后状态；DELETE 之后没有 NEW，所以要用 OLD.id。

查看定义用 `SHOW CREATE TRIGGER index_user_after_update`；不要了就 `DROP TRIGGER index_user_after_update`。

举个例子：把韩信的专业从"软件工程"改成"会计"。UPDATE 先定位 id=2 的记录，准备新值并完成行操作；AFTER UPDATE 触发器拿到 OLD 和 NEW 两个版本，往日志表插一条记录：source_id 还是 2，before_data 是软件工程，after_data 是会计。

调用方不用在 UPDATE 后面再手写 `CALL 某个记日志过程`，触发器已经绑定了事件。但这也意味着写日志是业务 SQL 执行的一部分：日志表约束或者触发器语句出错，原来的业务语句也可能跟着失败。它不是"失败了也不影响业务"的异步旁路。

行级触发也意味着批量更新要按行看。`UPDATE index_user SET profession='会计' WHERE id IN (2,3)` 涉及两个人，就会分别记 id 2 和 id 3 的前后值。如果需求只是记"执行过一条批量 SQL"，那这套逐行日志的粒度就不对。

## 用回滚实验核对触发行为

先记下日志表现有的数量，然后在一个事务里操作已有的韩信数据：

```sql
SELECT COUNT(*) AS before_count FROM user_change_log;
START TRANSACTION;
UPDATE index_user SET profession='会计' WHERE id=2;
DELETE FROM index_user WHERE id=2;
SELECT operation,source_id,before_data,after_data
FROM user_change_log ORDER BY id;
ROLLBACK;
SELECT COUNT(*) AS after_rollback_count FROM user_change_log;
SELECT id,name,profession FROM index_user WHERE id=2;
```

事务里应该新增一条 UPDATE 日志和一条 DELETE 日志：更新前专业是软件工程，更新后是会计；删除日志记的是删除时的会计。回滚后日志数量回到实验前，韩信的原始记录也恢复了。这样同时验证了两件事：触发器确实触发了，日志跟着业务事务一起回滚，而不只是确认触发器建成功了。

插入触发器可以在另一个事务里测：用没被占用的实验 id 和唯一手机号插入，查日志，再回滚。插入的数据照样要满足 index_user 原有的约束，触发器不会让唯一约束失效。

比如确认 id=29 和下面的手机号都没被占用后，可以完整看一遍 INSERT 分支：

```sql
START TRANSACTION;
INSERT INTO index_user(id,name,phone,email,profession,age,status)
VALUES(29,'TriggerTest','17799990029',NULL,'软件工程',20,'0');
SELECT operation,source_id,before_data,after_data
FROM user_change_log WHERE source_id=29 ORDER BY id;
ROLLBACK;
SELECT * FROM index_user WHERE id=29;
```

事务里应该看到一条 INSERT 日志，before_data 为 NULL（插入没有旧行），after_data 是新的姓名和专业。回滚后用户记录不存在，对应的 InnoDB 日志记录也不会保留。之后日志的自增编号可能出现空洞，这不代表回滚失败，编号分配和记录保不保留是两回事。

如果只改了 age，而日志只记 name、profession，日志能看出发生过 UPDATE，却说不清年龄怎么变的。日志字段要和审计目的对得上。另外别把触发器日志当成不可篡改的外部审计：它还在同一个数据库的权限范围里，回滚也和事务一致。

TRUNCATE 不会像逐行 DELETE 那样触发删除触发器，外键级联也有单独的触发规则。要覆盖这些操作得单独查清楚，建了三个触发器不等于覆盖了所有数据变化。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-20) · [下一篇](/posts/mysql-heima-22)
