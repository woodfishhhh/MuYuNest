---
title: "MySQL（01）：数据库连接与表结构"
date: 2026-10-17 00:00:00
slug: mysql-heima-01
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

员工姓名、入职日期、部门等信息需要长期保存，并且允许多个程序查询和修改。MySQL 负责管理这些数据；应用程序和 DataGrip 都是客户端，通过连接向 MySQL 服务器发送 SQL，再接收结果。

## 数据库、表和 SQL 各负责什么

数据库（database）是组织数据的容器，数据库管理系统（DBMS）是管理它的软件。一个 MySQL 服务可以管理多个数据库，一个数据库包含多张表。表用列规定数据的含义和类型，用行表示一条记录。例如，`emp` 的每一行代表一个员工，`name` 列保存姓名。

关系型数据库把数据组织成表，并通过字段建立关联。员工表保存 `dept_id=1`，部门表保存 `id=1, name='研发部'`，两者合起来才能回答员工属于哪个部门。这种关联不是依赖表在界面中的摆放位置，而是依赖字段值。

SQL 是操作关系型数据库的语言。常见语句分工如下：

| 分类 | 操作对象 | 例子 |
| --- | --- | --- |
| DDL，数据定义 | 库、表、列、索引的结构 | `CREATE`、`ALTER`、`DROP` |
| DML，数据操作 | 表里的记录 | `INSERT`、`UPDATE`、`DELETE` |
| DQL，数据查询 | 查询结果 | `SELECT` |
| DCL，数据控制 | 用户和权限 | `GRANT`、`REVOKE` |

SQL 有共同的基础，但分页、函数、类型和管理命令存在数据库方言。掌握 MySQL 后可以迁移知识，不能假设所有语句在其他数据库中原样运行。

可以先把保存员工的过程完整想一遍。安装 MySQL，让机器具备管理数据库的软件；创建 `mysql_notes`，得到本次练习的容器；创建 `emp`，规定员工记录由哪些列组成；插入姓名、年龄等值，才真正增加业务记录。因此“软件装好了”“库建好了”“表建好了”“数据写进去了”是四种不同状态。刚开始遇到的报错，常常是跳过了其中一步。

表也不只是一个用来显示文字的网格。声明年龄为整数后，数据库要按照整数规则保存和比较它；声明 id 为主键后，数据库要拒绝重复编号。客户端可以换，界面可以关闭，这些结构和规则仍由服务器保存。

## 先连接服务，再执行 SQL

课程使用 MySQL Community Server 8.0.26。服务器、命令行客户端 `mysql`、图形客户端 DataGrip 是不同的软件：装了 DataGrip，不代表已经装好 MySQL 服务。

Windows 使用安装器时，选择安装 MySQL Server，设置端口、管理员密码和 Windows 服务名。课程的服务名为 `MySQL80`，端口为 `3306`；自己的安装可能不同。已有数据库不必为了跟课先卸载，先确认版本和数据位置。

在 PowerShell 中查看服务；启动和停止服务通常需要管理员权限：

```powershell
Get-Service -Name '*mysql*'
Start-Service -Name MySQL80
# 仅在确实需要停止自己的实验服务时使用
Stop-Service -Name MySQL80
```

服务运行后，用下列命令连接。`-P` 是端口，`-p` 表示交互输入密码，两者大小写不同：

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p
```

终端出现 `mysql>` 后才进入 SQL 环境：

```sql
SELECT VERSION(), DATABASE();
```

预期第一列返回服务器版本；刚登录还没选数据库时，第二列可能是 `NULL`。`mysql --version` 只显示客户端版本，不能替代服务器版本检查。

若终端找不到 `mysql`，检查 Server 的 `bin` 目录是否加入 `PATH`，或使用 `mysql.exe` 的完整路径。连接被拒绝通常先检查服务、地址和端口；`Access denied` 则检查用户名、密码以及账户允许的来源主机。两类错误处在不同阶段。

DataGrip 中创建 MySQL 数据源，填写同一组主机、端口、用户和密码，下载驱动后测试连接。连接成功后还要选择可见的 schema，打开对应数据库的查询控制台。MySQL 的 `CREATE SCHEMA` 与 `CREATE DATABASE` 是同义写法。图形界面生成的 SQL 仍由服务器执行，执行前应检查选中的数据库和语句。

连接时可以沿下面的顺序判断自己停在哪一步：

```text
终端能找到 mysql.exe
  → mysql 客户端向指定主机的指定端口连接
  → MySQL 服务检查用户名、来源和认证信息
  → 当前连接选择数据库
  → 服务器检查 SQL 和对象访问权限
  → 执行并返回结果
```

例如，`mysql` 不是内部或外部命令，说明客户端程序尚未被终端找到，此时根本没有向服务器发请求，修改数据库密码不会解决问题。`Can't connect` 说明已经运行客户端，却没有建立所需连接；应先核对服务和端口。`Access denied` 说明连接走到了身份认证或访问检查阶段，需要看完整错误对应的是登录还是对象操作。`No database selected` 则通常意味着连接已经成功，只是当前 SQL 没有确定操作哪个库。

安装器中的配置也可以按这条链理解。安装路径决定程序文件放在哪里；数据目录决定服务器把数据库文件放在哪里；端口让客户端找到服务；Windows 服务名用于系统启停；root 密码用于管理员认证。它们并不互相替代。PATH 中放的是包含 `mysql.exe` 的目录，不能把服务名 `MySQL80` 当作可执行文件路径。

输入 SQL 后若提示符从 `mysql>` 变成 `->`，往往是客户端还在等待语句结束。例如输入 `SELECT VERSION()` 却没有分号，再补一个 `;` 即可。若误开了引号，应先检查引号是否配对；也可用客户端的 `\c` 放弃当前未发送的输入。不要把等待补全语句误认为服务器卡死。

## 创建一个独立练习库

以下代码在 `mysql>` 或 DataGrip SQL 控制台执行，不在 PowerShell 中直接执行：

```sql
SHOW DATABASES;
CREATE DATABASE IF NOT EXISTS mysql_notes
  DEFAULT CHARACTER SET utf8mb4;
USE mysql_notes;
SELECT DATABASE();
SHOW TABLES;
```

`IF NOT EXISTS` 使“库已经存在”不再成为创建错误，并不会清空或重新配置已有数据库。`USE` 只改变当前连接的默认数据库；换一个连接，需要重新选择。

`utf8mb4` 支持四字节 UTF-8 字符。MySQL 8.0 中的 `utf8` 名称通常指三字节的 `utf8mb3`，不要把它当作完整的 Unicode 字符支持。字符集决定字符如何编码，排序规则决定字符串如何比较，例如大小写是否视为相同。

SQL 语句可以跨行，通常以分号结束。关键字不区分大小写，但表名的大小写行为与系统及配置有关，统一使用小写表名更容易跨环境。字符串用单引号；标识符需要引用时用反引号。`-- ` 后有空格才是 MySQL 的这类行注释，另外还支持 `#` 和 `/* ... */`。

## 数据类型由数据的含义决定

工号看起来是数字，却可能包含前导零；身份证号还可能以 X 结尾。这两种数据都不用于算术，应按字符串保存。

| 类型 | 用途和边界 |
| --- | --- |
| `TINYINT` | 1 字节整数，有符号为 -128～127；`UNSIGNED` 为 0～255 |
| `SMALLINT` / `MEDIUMINT` / `INT` / `BIGINT` | 分别为 2、3、4、8 字节整数，按取值范围选择 |
| `DECIMAL(M,D)` | 精确小数，M 是总位数，D 是小数位数；`DECIMAL(10,2)` 有 8 位整数和 2 位小数 |
| `FLOAT` / `DOUBLE` | 近似浮点数，不适合要求精确相等的金额计算 |
| `CHAR(n)` | 定长字符类型，适合固定格式编码；n 表示字符数 |
| `VARCHAR(n)` | 变长字符类型，适合长度变化的姓名、地址；还需要长度信息等存储开销 |
| `TEXT` / `BLOB` | 较长文本 / 二进制内容；还有 TINY、MEDIUM、LONG 系列 |
| `DATE` / `TIME` / `YEAR` | 日期 / 时间或时长 / 年份 |
| `DATETIME` / `TIMESTAMP` | 日期和时间；TIMESTAMP 会参与会话时区转换，范围也不同 |

字符数不是字节数。一个汉字和一个英文字母都算一个字符，UTF-8 编码所占字节却可能不同。也不要仅凭“定长”就断言 `CHAR` 一定比 `VARCHAR` 快，实际还取决于行格式、数据和访问方式。

成绩若要准确保留一位小数，可用 `DECIMAL(4,1)`，但它本身仍允许 999.9；“成绩最多 100”需要另外的约束。类型负责表示范围，业务规则还要单独表达。

类型选择可以顺着员工表再做一次推导。工号 `'00001'` 中的前导零属于标识格式，转成整数 1 就丢了信息，所以使用 VARCHAR。工资需要准确保留分币，`DECIMAL(10,2)` 表达的上限由总位数决定：10 位中有 2 位给小数，整数部分剩 8 位。姓名长度不固定，用 VARCHAR；性别示例只存一个汉字，用 CHAR(1)，但数据库类型并不会限制它只能是“男”或“女”，这仍需业务规则。

日期类型也要区分含义。`DATE` 只保存年月日，适合本例的入职日期；若要记录某次修改发生在几点几分，应选择含时间的类型。`TIME` 还可以表示一定范围内的时长，不能只把它理解成一天内的钟点。`TIMESTAMP` 在写入和读取时涉及会话时区转换，`DATETIME` 更接近保存给定的日期时间字段；不同时间语义不能仅凭存储字节大小决定。

修改类型前应先看已有值。例如工号列从 VARCHAR(10) 改成 VARCHAR(4)，五位工号已经无法完整容纳；把年龄从有符号改成无符号，已有负数也需要先处理。数据库在严格模式下拒绝这些变更，实际上是在提醒“现有数据与新规则不兼容”，不能把关闭检查当作完成了类型设计。

## 建表、检查和修改

在练习库中创建一张专门演示结构变化的表：

```sql
CREATE TABLE ddl_employee (
  id INT COMMENT '编号',
  work_no VARCHAR(10) COMMENT '工号',
  name VARCHAR(20) COMMENT '姓名',
  gender CHAR(1) COMMENT '性别',
  age TINYINT UNSIGNED COMMENT '年龄',
  id_card CHAR(18) COMMENT '身份证号',
  entry_date DATE COMMENT '入职日期'
) ENGINE=InnoDB COMMENT='表结构练习';

DESC ddl_employee;
SHOW CREATE TABLE ddl_employee;
```

每个字段定义用逗号分隔，最后一个字段后面没有逗号。`DESC` 便于查看列和类型；`SHOW CREATE TABLE` 可以看到完整建表语句，包括引擎、字符集等默认设置。这里的 InnoDB 是负责存储、索引、事务和锁的存储引擎，后面再展开。

```sql
ALTER TABLE ddl_employee ADD nickname VARCHAR(20) COMMENT '昵称';
ALTER TABLE ddl_employee MODIFY nickname VARCHAR(30) COMMENT '昵称';
ALTER TABLE ddl_employee CHANGE nickname username VARCHAR(30) COMMENT '用户名';
ALTER TABLE ddl_employee DROP COLUMN username;
ALTER TABLE ddl_employee RENAME TO ddl_staff;
```

`MODIFY` 改列定义，`CHANGE` 同时指定旧列名、新列名和新定义。修改列时应重新写出需要保留的类型、默认值和约束；缩短长度或缩小数值范围前，要确认已有数据能否容纳。

执行后 `SHOW TABLES` 应出现 `ddl_staff`，`DESC ddl_staff` 不再包含 `username`。若仍查 `ddl_employee`，会因旧表名不存在而报错。

删除操作需要分清对象：

```sql
-- 只对上面的实验表执行
TRUNCATE TABLE ddl_staff;
DROP TABLE ddl_staff;
```

`TRUNCATE` 清空记录，保留可继续使用的表结构，并重置自增计数；`DROP TABLE` 连表本身一起删除。MySQL 中这两类 DDL 不能当作普通 DML 用 `ROLLBACK` 撤销。`DROP DATABASE` 则删除整个库及其对象，后面的练习无需执行它。

继续阅读：[写入数据与条件查询](/posts/mysql-heima-02)。


---

[课程目录](/posts/mysql-heima) · [下一篇](/posts/mysql-heima-02)
