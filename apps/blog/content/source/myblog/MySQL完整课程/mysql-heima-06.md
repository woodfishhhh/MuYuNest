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

“年龄不能为负”“用户名不能重复”应用里也能检查，但数据库可能有多个程序在写。约束把规则放进表结构，不合规则的数据在写入时就被拒绝。

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

- PRIMARY KEY：主键，唯一标识一行，必须唯一且非空
- AUTO_INCREMENT：让服务器分配编号，跟主键约束是两个功能
- NOT NULL：禁止 NULL
- UNIQUE：禁止重复的非 NULL 键值
- DEFAULT：省略字段或显式写 DEFAULT 时提供默认值
- CHECK：验证表达式

一个字段可以叠加多种规则。name 的 NOT NULL 加 UNIQUE，就是“必须填写且不重复”；只加 UNIQUE 的可空列，在 MySQL 里可以出现多个 NULL。非空也不是非空字符串，`''` 也是一个值，要禁止空姓名得另加业务检查。

CHECK 从 MySQL 8.0.16 起才真正执行检查，更早的版本接受了建表语句，规则也不一定生效。CHECK 结果是未知时不算失败，所以 age 还加了 NOT NULL，明确禁止年龄缺失。

## 用成功和失败输入理解约束

```sql
INSERT INTO member (name,age,gender) VALUES ('Tom',19,'男');
INSERT INTO member (name,age,status,gender) VALUES ('Rose',25,'0','女');
SELECT id,name,age,status FROM member ORDER BY id;
```

新建的空表里，Tom 是默认状态 1，Rose 是显式指定的状态 0。两行都没给 id，由服务器分配。

下面每句单独执行，分别看报错原因，它们本来就不是一个要全部成功的脚本：

```sql
INSERT INTO member(name,age) VALUES (NULL,19); -- 非空约束
INSERT INTO member(name,age) VALUES ('Tom',20); -- 唯一约束
INSERT INTO member(name,age) VALUES ('BadAge',121); -- 检查约束
INSERT INTO member(name,age,status) VALUES ('BadStatus',20,NULL); -- 非空约束
```

显式插入 NULL 跟省略字段不一样，status 有 DEFAULT 也不会自动变成 1。插入失败、事务回滚都可能已经用掉了自增编号，后面编号出现空洞是正常的。别用最大 id 当总行数，更别把自增编号当成连续的业务票号。

默认值和非空约束管的是不同的事，对照 status 的四种写法：

| 输入方式 | 数据库怎样理解 | 本例结果 |
| --- | --- | --- |
| INSERT 列表中省略 status | 没有主动提供该列，采用默认值 | `'1'` |
| 显式写 `status=DEFAULT` | 主动要求采用默认值 | `'1'` |
| 显式提供 `'0'` | 已经提供一个普通值 | `'0'` |
| 显式提供 NULL | 主动提供缺失值，再检查约束 | 被 NOT NULL 拒绝 |

“没传”和“传了 NULL”是两种输入。NOT NULL 也不保证内容有业务意义：空字符串不是 NULL，状态值 `'9'` 也不一定违反当前表结构。数据库只执行已经声明的规则，没声明的枚举范围不会自己冒出来。

主键和唯一约束按用途区分：

- 主键：稳定地识别一行。一个表只能有一套主键定义，但可以由多列组成
- UNIQUE：其他同样不能重复的候选标识，可以有多套

把姓名设成 UNIQUE 只是这里的练习约定，真实员工有同名的就不能照搬。本来允许重复的业务属性，别因为 SQL 支持唯一约束就硬改成唯一。

## 字段名称相同不代表已经建立外键

员工表的 dept_id 逻辑上引用部门表的 id。只存数字、不设外键的话，部门删了，员工身上可能还留着一个不存在的部门编号。字段叫 dept_id，数据库也不会因此自动维护这层关系。

先给 [基础员工表](/posts/mysql-heima#初始化脚本) 建好对应的部门数据：

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

`emp` 持有外键，是子表；`dept` 被引用，是父表。这里引用的是主键，两边字段类型都是 INT。加外键前，已有的非 NULL dept_id 都得能找到部门，不然会加失败。先把孤立数据查出来修掉，别关掉约束绕过去：

```sql
SELECT e.id, e.dept_id
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.dept_id IS NOT NULL AND d.id IS NULL;
```

初始数据下应该返回零行。LEFT JOIN 的完整机制见多表查询，这里只要知道：保留所有员工，找不到部门时右侧字段为 NULL。

加完外键后：

- `DELETE FROM dept WHERE id=1` 会失败，研发部还有员工
- `UPDATE emp SET dept_id=99 WHERE id=1` 也会失败，99 号部门不存在
- 韦一笑的 dept_id 是 NULL，允许存在，因为这一列没要求非空

写入时按检查顺序理解：给柳岩写 `dept_id=2`，数据库先确认父表有 id=2 的部门，有就允许关联；写成 99，父表没有这个键，就拒绝。允许为 NULL 时，NULL 表示暂时没有引用，不需要父表里有一条“编号为 NULL”的部门。

删除父行是反方向检查。删 id=1 的部门时，数据库发现还有员工引用这个编号，RESTRICT 要求现有引用保持有效，所以拒绝删除。它不会猜这些员工该调到人事部，也不会按部门名称找一个替代对象。这种业务决定要调用方自己明确去做。

几个名字各有用途：

- 外键名称 `fk_emp_dept`：以后定位、删除这条规则用
- 子列 `dept_id`：保存引用
- 父列 `dept.id`：提供被引用的稳定键

名字起得相似只是方便人看，真正建立关系的是 FOREIGN KEY 和 REFERENCES 的定义。

## 删除父记录时，子记录怎么办

| 行为 | 父表被引用记录变化时的处理 |
| --- | --- |
| RESTRICT / NO ACTION | InnoDB 中立即拒绝会破坏引用的更新或删除 |
| CASCADE | 更新引用键时同步子表外键；删除父行时删除关联子行 |
| SET NULL | 把子表外键设为 NULL，要求该列允许为空 |

`ON UPDATE` 指的是父表被引用的键变了，不是父表任意字段变了。比如部门名称从“研发部”改成“技术部”，部门编号没变，员工的 dept_id 不用级联修改。

CASCADE 删除会删掉整条子记录，不只是清空外键。部门注销时要不要删掉全部员工是业务决策，别为了让 DELETE 不报错就配级联。InnoDB 不支持把 SET DEFAULT 当外键动作用。

下面另建一组小表演示 SET NULL，不影响 emp 的数据：

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

第一次把父键 1 改成 2，子表的 parent_id 跟着变成 2；第二次删除父行，子表的关联字段被设为空。更新和删除可以用不同的规则。

真要移除约束，语法是：

```sql
ALTER TABLE fk_child DROP FOREIGN KEY fk_child_parent;
```

删的是名为 fk_child_parent 的规则，parent_id 列和数据都还在。外键只管引用完整性，不会自动把两张表的列显示到同一行，关联查询还是要用 JOIN。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-05) · [下一篇](/posts/mysql-heima-07)
