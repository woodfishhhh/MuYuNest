---
title: "MySQL（06）：约束与外键"
date: 2026-10-17 00:00:00
slug: mysql-heima-06
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

应用可以检查“年龄不能为负”“用户名不能重复”，但数据库可能被多个程序写入。约束把规则放到表结构中，让不合规则的数据在写入时被拒绝。

## 把每种要求对应到具体约束

```sql
USE mysql_notes;
CREATE TABLE member (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(20) NOT NULL UNIQUE,
  age INT NOT NULL,
  status CHAR(1) NOT NULL DEFAULT '1',
  gender CHAR(1),
  CONSTRAINT ck_member_age CHECK (age > 0 AND age <= 120)
) ENGINE=InnoDB;
```

主键 PRIMARY KEY 唯一标识一行，必须唯一且非空。AUTO_INCREMENT 让服务器分配编号，它和主键约束并不是同一个功能。NOT NULL 禁止 NULL；UNIQUE 禁止重复的非 NULL 键值；DEFAULT 在省略字段或显式使用 DEFAULT 时提供默认值；CHECK 验证表达式。

一个字段可以同时有多种规则。name 的 NOT NULL 和 UNIQUE 共同要求“必须填写且不重复”，单独 UNIQUE 的可空列在 MySQL 中可以出现多个 NULL。非空也不等于非空字符串，`''` 仍然是一个值；需要禁止空姓名时应增加相应的业务检查。

CHECK 从 MySQL 8.0.16 起才真正执行约束检查，早期版本不能因建表语句被接受就认为规则生效。CHECK 的结果为未知时并不等同于失败，因此 age 同时加了 NOT NULL，明确禁止缺失年龄。

## 用成功和失败输入理解约束

```sql
INSERT INTO member (name,age,gender) VALUES ('Tom',19,'男');
INSERT INTO member (name,age,status,gender) VALUES ('Rose',25,'0','女');
SELECT id,name,age,status FROM member ORDER BY id;
```

新建空表中预期得到 Tom 的默认状态 1、Rose 显式指定的状态 0。两行都没有提供 id，由服务器分配。

下面每句单独执行，分别检查错误原因，不要把它们作为一个必须全部成功的脚本：

```sql
INSERT INTO member(name,age) VALUES (NULL,19); -- 非空约束
INSERT INTO member(name,age) VALUES ('Tom',20); -- 唯一约束
INSERT INTO member(name,age) VALUES ('BadAge',121); -- 检查约束
INSERT INTO member(name,age,status) VALUES ('BadStatus',20,NULL); -- 非空约束
```

显式插入 NULL 不等于省略字段，不会因为 status 有 DEFAULT 就自动变成 1。插入失败或事务回滚也可能已经消耗自增编号，因此后续编号出现空洞正常。不能用最大 id 当作总行数，更不能把自增编号当作连续业务票号。

默认值和非空约束回答不同问题，可以对照 status 的四种写法：

| 输入方式 | 数据库怎样理解 | 本例结果 |
| --- | --- | --- |
| INSERT 列表中省略 status | 没有主动提供该列，采用默认值 | `'1'` |
| 显式写 `status=DEFAULT` | 主动要求采用默认值 | `'1'` |
| 显式提供 `'0'` | 已经提供一个普通值 | `'0'` |
| 显式提供 NULL | 主动提供缺失值，再检查约束 | 被 NOT NULL 拒绝 |

不能把“我没有传”和“我传了 NULL”一概视为同一种输入。也不能把 NOT NULL 理解成“内容一定有业务意义”：空字符串并不是 NULL，状态值 `'9'` 也不一定违反当前表结构。数据库只能执行已经声明的规则，没有声明的枚举范围不会自动出现。

主键与唯一约束也要从目的区分。主键用于稳定识别某行，一个表只能有一套主键定义，但可以由多列组成；UNIQUE 用于其他同样不能重复的候选标识，可以有多套。把姓名设为 UNIQUE 只是本例的练习约定，真实员工存在同名时就不能照用；不能因为 SQL 支持唯一约束，就把原本允许重复的业务属性强行改成唯一。

## 字段名称相同不代表已经建立外键

员工表的 dept_id 逻辑上引用部门表 id。如果仅保存数字、不设置外键，删除部门后员工可能仍保留一个不存在的部门编号。数据库不会因为字段叫 dept_id 就自动维护这个关系。

先为 [基础员工表](/posts/mysql-heima#初始化脚本) 建立对应的部门数据：

```sql
CREATE TABLE dept (
  id INT PRIMARY KEY,
  name VARCHAR(30) NOT NULL
) ENGINE=InnoDB;
INSERT INTO dept VALUES
  (1,'研发部'),(2,'人事部'),(3,'财务部'),(4,'市场部');

ALTER TABLE emp
ADD CONSTRAINT fk_emp_dept
FOREIGN KEY (dept_id) REFERENCES dept(id)
ON UPDATE RESTRICT ON DELETE RESTRICT;
```

`emp` 持有外键，是子表；`dept` 被引用，是父表。这里引用主键，两边字段类型都是 INT。添加外键前，已有的非 NULL dept_id 必须都能找到部门，否则添加会失败。应先查出并修复孤立数据，而不是关闭约束绕过去：

```sql
SELECT e.id, e.dept_id
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.dept_id IS NOT NULL AND d.id IS NULL;
```

初始数据下应返回零行。LEFT JOIN 的完整机制见多表查询：保留所有员工，找不到部门时右侧字段为 NULL。

添加后，`DELETE FROM dept WHERE id=1` 会失败，因为研发部还有员工。`UPDATE emp SET dept_id=99 WHERE id=1` 同样会失败，因为 99 号部门不存在。韦一笑的 dept_id 为 NULL 则允许存在，因为这里没有要求该列非空。

建立外键后的写入可以按检查顺序理解。给柳岩写 `dept_id=2`，数据库会确认父表有 id=2 的部门，存在则允许关联；写成 99，父表没有这个键，便拒绝。允许为 NULL 时，NULL 表示目前没有建立引用，不要求父表出现一条“编号为 NULL”的部门。

删除父行则从另一方向检查。删除 id=1 的部门时，数据库先发现员工仍引用这个编号；RESTRICT 要求保持现有引用有效，所以删除被拒绝。它不会猜测这些员工应该调到人事部，也不会按部门名称寻找一个替代对象。这类业务决定必须由调用方明确执行。

因此，外键名称 `fk_emp_dept`、子列 `dept_id`、父列 `dept.id` 各有用途：约束名称方便以后定位和删除规则，子列保存引用，父列提供被引用的稳定键。名字相似只方便人理解，真正建立关系的是 FOREIGN KEY 和 REFERENCES 的定义。

## 删除父记录时，子记录怎么办

| 行为 | 父表被引用记录变化时的处理 |
| --- | --- |
| RESTRICT / NO ACTION | InnoDB 中立即拒绝会破坏引用的更新或删除 |
| CASCADE | 更新引用键时同步子表外键；删除父行时删除关联子行 |
| SET NULL | 把子表外键设为 NULL，要求该列允许为空 |

`ON UPDATE` 指父表被引用键发生变化，不是父表任意字段变化。比如把部门名称由“研发部”改为“技术部”，不需要级联改员工的 dept_id，因为部门编号没变。

CASCADE 删除会删除整条子记录，并非只清空外键。因此部门注销时是否应删除全部员工，是业务决策，不能只为了让 DELETE 不报错就配置级联。InnoDB 不支持把 SET DEFAULT 当成可用外键动作。

下面用另一组小表演示 SET NULL，不影响 emp 数据：

```sql
CREATE TABLE fk_parent (id INT PRIMARY KEY) ENGINE=InnoDB;
CREATE TABLE fk_child (
  id INT PRIMARY KEY,
  parent_id INT NULL,
  CONSTRAINT fk_child_parent FOREIGN KEY (parent_id)
    REFERENCES fk_parent(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
INSERT INTO fk_parent VALUES (1);
INSERT INTO fk_child VALUES (10,1);
UPDATE fk_parent SET id=2 WHERE id=1;
SELECT * FROM fk_child; -- 10,2
DELETE FROM fk_parent WHERE id=2;
SELECT * FROM fk_child; -- 10,NULL，子行仍存在
```

第一次变更把父键 1 改为 2，子表的 parent_id 同步为 2；第二次删除父行，把子表关联字段设为空。更新与删除可以采用不同规则。

若确实要移除约束，语法是：

```sql
ALTER TABLE fk_child DROP FOREIGN KEY fk_child_parent;
```

它删除的是名为 fk_child_parent 的规则，不删除 parent_id 列，也不删除数据。外键负责引用完整性，不负责自动把两张表的列展示到同一行；查询关联仍需 JOIN。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-05) · [下一篇](/posts/mysql-heima-07)
