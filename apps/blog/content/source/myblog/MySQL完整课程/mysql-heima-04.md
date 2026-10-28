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

能连上数据库，只说明身份认证通过了。一个账户能登录 MySQL，也可能读不了员工表，所以账户管理和权限管理是两件事。

## 账户由用户名和来源主机共同确定

MySQL 里 `'reader'@'localhost'` 和 `'reader'@'10.0.0.20'` 是两个账户。`@` 后面的主机是客户端从哪来，别写成“我要访问的数据库服务器地址”。

管理员查看账户身份：

```sql
SELECT User, Host FROM mysql.user;
SELECT USER(), CURRENT_USER();
```

`USER()` 是客户端的登录信息，`CURRENT_USER()` 是服务器实际拿来做权限检查的账户。碰到“明明授权了却没权限”，先确认命中的是不是预期的账户，别只对用户名。

`mysql.user` 在系统库里，学习时可以查，但创建和修改账户要用账户管理语句，别直接改系统表。

比如 DataGrip 在 Windows 电脑上，MySQL 在 Linux 服务器上：

- 连接框里的 Host 填 Linux 的地址，是连接的目的地
- `CREATE USER 'reader'@'客户端地址'` 里的 Host 是请求从哪来

两处都叫“主机”，方向正好相反。把服务器自己的地址填进账户来源，远程客户端就可能匹配不到适用的账户。

同一个用户名，从不同来源登录可能权限不同。查 `CURRENT_USER()` 就是确认服务器最后用的是哪个账户身份；再核对它的 SHOW GRANTS，才能把“我给谁授了权”和“当前实际是谁”对上。

## 创建和修改用户

下面由有账户管理权限的管理员执行。密码是占位符，执行前换成自己的实验密码：

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

新账户一般还读不了 `mysql_notes.emp`。这不是密码错了：认证已经完成，失败出在对象访问这一步。

旧教程可能用 `IDENTIFIED WITH mysql_native_password` 指定认证插件。它从 MySQL 8.0.34 起被弃用，8.4 默认关闭，9.0 移除，不是所有版本都能用的通用修复命令。先查服务器版本和客户端支持，再处理插件兼容问题。[官方认证插件说明](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html)。

课程里也用 `'user'@'%'` 演示匹配任意来源。它只影响账户的主机匹配，不会自动开放防火墙、改监听地址，也不会给表权限。远程实验要搞清楚实际的客户端来源，别把 `%` 当成连接失败的万能补丁。

## 授权指定操作和对象

```sql
SHOW GRANTS FOR 'notes_reader'@'localhost';

GRANT SELECT ON mysql_notes.emp
TO 'notes_reader'@'localhost';
```

在 reader 的新连接里执行：

```sql
SELECT COUNT(*) FROM mysql_notes.emp;
UPDATE mysql_notes.emp SET salary = salary + 100 WHERE id = 1;
```

查询返回 8，更新被拒绝：账户有 SELECT 权限，没有 UPDATE 权限。别为了让测试通过就直接把它改成管理员。

授权格式是 `GRANT 权限列表 ON 库.对象 TO 账户`，多个权限用逗号隔开：

```sql
-- 语法示例：允许读写整个练习库的表
GRANT SELECT, INSERT, UPDATE, DELETE ON mysql_notes.*
TO 'notes_reader'@'localhost';
```

- `mysql_notes.*`：这个库里的对象
- `*.*`：范围扩大到所有数据库
- `ALL PRIVILEGES` 具体包括什么跟授权层级有关，别以为哪一层的 ALL 都等于无条件拿到全部管理权限
- `CREATE`、`ALTER`、`DROP` 管结构操作，跟数据增删改是不同的权限

测权限最好开两个分工明确的连接：管理员连接负责建用户和授权，reader 连接负责实际查询。一直拿 root 查的话，reader 没有任何权限查询也会成功，验证就白做了。

以单表 SELECT 为例，完整流程：

1. reader 登录成功，但读 emp 被拒绝
2. 管理员授予 `mysql_notes.emp` 上的 SELECT
3. reader 用新连接能数到 8 行
4. reader 试 UPDATE，仍然被拒绝

最后一步证明给的只是读取权限，账户没有变成能随便写入的账户。

授权范围是一层层扩大的：`mysql_notes.emp` 是单表，`mysql_notes.*` 是库里的表，`*.*` 是整个实例的相应对象。在小层级上撤销不是“拒绝规则”，盖不过大层级已经给的同一种权限。所以下面的撤销实验要核对全部授权。

## 撤销权限与删除账户

```sql
REVOKE SELECT ON mysql_notes.emp
FROM 'notes_reader'@'localhost';

SHOW GRANTS FOR 'notes_reader'@'localhost';
```

这句对应前面的单表 SELECT 授权。如果还做过库级授权，只撤销表级权限抵消不了更大范围上已有的权限，要按 `SHOW GRANTS` 显示的授权层级分别撤销，再用新连接验证。

```sql
-- 仅在做完账户实验、确认不再使用这个实验账户时执行
DROP USER 'notes_reader'@'localhost';
```

`REVOKE` 收回权限，账户还在；`DROP USER` 把账户本身删掉。用标准账户语句改完权限，不用习惯性再执行 `FLUSH PRIVILEGES`，它主要用在直接修改授权表这类管理场景。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-03) · [下一篇](/posts/mysql-heima-05)
