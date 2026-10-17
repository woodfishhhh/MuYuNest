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

触发器绑定在表的 INSERT、UPDATE、DELETE 事件上，数据库执行相应操作时自动运行。课程用它记录用户变更日志：写入用户数据的调用方不必再手动调用“记日志”过程。

触发器也会把额外写入成本和失败路径放进原操作中。因此要先确定需要记录哪些字段，再决定触发时机，而不是把整行敏感数据不加区分地拼进日志。

## OLD 与 NEW 分别对应哪一版记录

| 事件 | 可用的行引用 |
| --- | --- |
| INSERT | NEW，待插入或已插入的记录 |
| UPDATE | OLD 是更新前，NEW 是更新后 |
| DELETE | OLD，待删除或已删除的记录 |

BEFORE 在对应行操作前触发，AFTER 在对应行操作后触发。AFTER 不等于事务提交之后：整个事务后来回滚，InnoDB 日志表里的触发器写入也会一起回滚。

MySQL 的这里使用行级触发器，`FOR EACH ROW` 说明每个受操作的行分别触发。一次 UPDATE 更新多行，就会分别产生多次触发，不是每条 SQL 固定一条日志。

## 完整记录插入、更新和删除

下面绑定已有 index_user 表，仅记录姓名和专业。课程采用字符串拼接，这里用 JSON 表达新旧值，避免字段为 NULL 时 CONCAT 把整段日志变成 NULL；这是实现上的补充，不是原屏幕代码的逐字复原。

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

JSON_OBJECT 的键是日志中的字段名称，值来自本次事件对应的 OLD/NEW 行。UPDATE 同时记录前后状态；DELETE 后没有 NEW，因此必须取 OLD.id。

查看定义还可用 `SHOW CREATE TRIGGER index_user_after_update`；不再需要时可用 `DROP TRIGGER index_user_after_update` 删除该触发器定义。

以把韩信的专业从“软件工程”改成“会计”为例，业务 UPDATE 先确定要修改 id=2 的记录，准备新值并完成对应行操作；AFTER UPDATE 触发器得到 OLD 和 NEW 两个版本，向日志表插入一条记录。这条日志中的 source_id 仍为 2，before_data 保存软件工程，after_data 保存会计。

调用方不需要在 UPDATE 后手写 `CALL 某个记日志过程`，因为触发器已经绑定了事件。但这也意味着日志写入是业务 SQL 的执行组成部分：日志表约束或触发器语句出错，可能让原来的业务语句失败。不能把它理解为失败也完全不影响业务的异步旁路。

行级触发还意味着批量更新要按行观察。`UPDATE index_user SET profession='会计' WHERE id IN (2,3)` 涉及两名用户，就应分别记录 id 2 和 id 3 的前后值。若需求只想记录“执行了一条批量 SQL”，这套逐行日志设计回答的是另一个粒度的问题。

## 用回滚实验核对触发行为

先记录日志表已有数量，然后在一个事务内操作已有的韩信数据：

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

事务内应新增一条 UPDATE 和一条 DELETE 日志：更新前专业为软件工程，更新后为会计；删除日志记录删除时的会计。回滚后，日志数量回到实验前，韩信的原始记录也恢复。这个验证同时检查“触发器被触发”和“日志跟随业务事务”，不只检查是否创建成功。

插入触发器可在另一个事务中，用未占用的实验 id 和唯一手机号插入，再查询日志并回滚。输入仍必须满足 index_user 原有约束；触发器不会取消唯一约束。

例如，确认 id=29 与下面手机号未占用后，可以完整观察 INSERT 分支：

```sql
START TRANSACTION;
INSERT INTO index_user(id,name,phone,email,profession,age,status)
VALUES(29,'TriggerTest','17799990029',NULL,'软件工程',20,'0');
SELECT operation,source_id,before_data,after_data
FROM user_change_log WHERE source_id=29 ORDER BY id;
ROLLBACK;
SELECT * FROM index_user WHERE id=29;
```

事务内应看到一条 INSERT 日志，before_data 为 NULL，因为这次插入没有旧行；after_data 保存新姓名与专业。回滚后用户记录不存在，对应的 InnoDB 日志记录也不应保留。即使日志的自增编号以后出现空洞，也不能据此判断回滚失败，编号分配和记录是否保留是两件事。

如果只更新 age，而日志仅记录 name、profession，日志虽能显示发生过 UPDATE，却无法解释年龄如何变化。日志字段必须与审计目标对应。也不要把触发器日志称为不可篡改的外部审计：它仍位于同一数据库权限边界内，回滚行为也与事务一致。

TRUNCATE 不按逐行 DELETE 的方式触发删除触发器，外键级联动作也有单独的触发规则。需要覆盖这些操作时，应查明相应机制，不能把“建了三个触发器”直接等同于覆盖了全部数据变化。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-20) · [下一篇](/posts/mysql-heima-22)
