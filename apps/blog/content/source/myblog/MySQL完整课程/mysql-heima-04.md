---
title: "MySQL（04）：账户与权限"
date: 2026-10-17 00:00:00
slug: mysql-heima-04
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

连接数据库成功，只证明身份认证通过。一个账户可以登录 MySQL，却没有读取员工表的权限；账户管理和权限管理因此是两件事。

## 账户由用户名和来源主机共同确定

MySQL 中的 `'reader'@'localhost'` 与 `'reader'@'10.0.0.20'` 是不同账户。`@` 后面的主机是客户端来源，不能误写成“我想访问的数据库服务器地址”。

管理员可以查看账户身份：

```sql
SELECT User, Host FROM mysql.user;
SELECT USER(), CURRENT_USER();
```

`USER()` 展示客户端登录信息，`CURRENT_USER()` 显示服务器实际用于权限检查的账户。遇到“明明授权了却没有权限”，要先确认是否命中了预期账户，不要只比对用户名。

`mysql.user` 位于系统库，学习时可以查询，但创建和修改账户应使用账户管理语句，不直接改系统表。

假设 DataGrip 在 Windows 电脑，MySQL 在 Linux 服务器。连接框里的 Host 填 Linux 的地址，这是连接的目的地；`CREATE USER 'reader'@'客户端地址'` 中的 Host 却描述请求从哪里来。两处都出现“主机”，但方向相反。把服务器自己的地址填到账户来源里，远程客户端就可能找不到适用的账户。

同一个用户名也可能在不同来源上拥有不同权限。查看 `CURRENT_USER()`，就是确认服务器最终采用了哪一条账户身份。继续核对它的 SHOW GRANTS，才能把“我给谁授权了”和“当前实际上是谁”对在一起。

## 创建和修改用户

下面由有账户管理权限的管理员执行。密码字符串是占位符，执行前替换为自己的实验密码：

```sql
CREATE USER 'notes_reader'@'localhost'
IDENTIFIED BY 'REPLACE_WITH_YOUR_PASSWORD';

ALTER USER 'notes_reader'@'localhost'
IDENTIFIED BY 'REPLACE_WITH_YOUR_NEW_PASSWORD';
```

在新终端测试登录：

```powershell
mysql -u notes_reader -p
```

新账户通常还不能读取 `mysql_notes.emp`。这个失败不代表密码错误：认证已完成，失败发生在对象访问阶段。

旧教程可能通过 `IDENTIFIED WITH mysql_native_password` 指定认证插件。它在 MySQL 8.0.34 起被弃用，8.4 默认关闭，9.0 移除，不能作为所有版本的通用修复命令。先检查服务器版本与客户端支持，再处理插件兼容问题。[官方认证插件说明](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html)。

课程也使用 `'user'@'%'` 演示任意来源匹配。它只影响账户主机匹配，不会自动开放防火墙、改变监听地址或赋予表权限。远程实验应明确实际客户端来源，不能把 `%` 当作连接失败的万能补丁。

## 授权指定操作和对象

```sql
SHOW GRANTS FOR 'notes_reader'@'localhost';

GRANT SELECT ON mysql_notes.emp
TO 'notes_reader'@'localhost';
```

在 reader 的新连接中执行：

```sql
SELECT COUNT(*) FROM mysql_notes.emp;
UPDATE mysql_notes.emp SET salary = salary + 100 WHERE id = 1;
```

预期查询返回 8，更新被拒绝。账户具备 SELECT 权限，不具备 UPDATE 权限。不要为了让测试通过而把它直接改成管理员。

授权格式为 `GRANT 权限列表 ON 库.对象 TO 账户`。多个权限用逗号分隔：

```sql
-- 语法示例：允许读写整个练习库的表
GRANT SELECT, INSERT, UPDATE, DELETE ON mysql_notes.*
TO 'notes_reader'@'localhost';
```

`mysql_notes.*` 表示该库中的对象范围，`*.*` 范围扩大到所有数据库。`ALL PRIVILEGES` 的具体含义与授权层级有关，不应把任何层级的 ALL 都理解成无条件拥有全部管理能力。`CREATE`、`ALTER`、`DROP` 控制结构操作，和数据增删改权限也不同。

权限测试最好使用两个明确分工的连接。管理员连接创建用户和授权，reader 连接实际查询。否则一直拿 root 查询，即使 reader 没有任何权限，查询也会成功，整个验证就失去了意义。

以单表 SELECT 为例，完整过程应是：reader 登录成功，但读 emp 被拒绝；管理员授予 `mysql_notes.emp` 上的 SELECT；reader 使用新连接后可以数到 8 行；reader 尝试 UPDATE 仍被拒绝。最后一步证明授予的是读取能力，而不是把账户变成了任意写入账户。

授权范围还可以看成逐层扩大的集合：`mysql_notes.emp` 指向单表，`mysql_notes.*` 包括库里的表，`*.*` 扩展到全实例相应对象。较小层级的撤销不是“拒绝规则”，不会覆盖较大层级已经赋予的同一种能力。这也是下面撤销实验需要核对全部授权的原因。

## 撤销权限与删除账户

```sql
REVOKE SELECT ON mysql_notes.emp
FROM 'notes_reader'@'localhost';

SHOW GRANTS FOR 'notes_reader'@'localhost';
```

这句对应前面的单表 SELECT 授权。如果还执行过库级授权，单独撤销表级权限不会抵消更大范围上已有的权限；应按 `SHOW GRANTS` 显示的授权层级分别撤销，再用新连接验证。

```sql
-- 仅在做完账户实验、确认不再使用这个实验账户时执行
DROP USER 'notes_reader'@'localhost';
```

`REVOKE` 移除访问能力但保留账户，`DROP USER` 删除账户本身。使用标准账户语句修改权限后，不需要习惯性再执行 `FLUSH PRIVILEGES`；它主要与直接修改授权表等其他管理场景有关。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-03) · [下一篇](/posts/mysql-heima-05)
