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

员工姓名、入职日期、部门这类数据要长期保存，还要能被多个程序查询和修改，这些交给 MySQL 管。应用程序和 DataGrip 都是客户端：连上 MySQL 服务器，发 SQL，收结果。

## 数据库、表和 SQL 各负责什么

- 数据库（database）：组织数据的容器
- 数据库管理系统（DBMS）：管理数据库的软件
- 一个 MySQL 服务可以管多个数据库，一个数据库里有多张表
- 表：列规定数据的含义和类型，一行是一条记录。比如 `emp` 每行是一个员工，`name` 列存姓名

关系型数据库把数据存成表，表之间靠字段关联。员工表存 `dept_id=1`，部门表存 `id=1, name='研发部'`，两张表合起来才知道员工属于哪个部门。关联靠的是字段值，跟表在界面里怎么摆没关系。

SQL 是操作关系型数据库的语言，常见语句分四类：

| 分类 | 操作对象 | 例子 |
| --- | --- | --- |
| DDL，数据定义 | 库、表、列、索引的结构 | `CREATE`、`ALTER`、`DROP` |
| DML，数据操作 | 表里的记录 | `INSERT`、`UPDATE`、`DELETE` |
| DQL，数据查询 | 查询结果 | `SELECT` |
| DCL，数据控制 | 用户和权限 | `GRANT`、`REVOKE` |

各数据库的 SQL 基础是通用的，但分页、函数、类型、管理命令都有方言。学会 MySQL 能迁移到别的数据库，但别指望每条语句都能原样跑。

保存员工数据要走完四步，每一步都是一个单独的状态：

1. 安装 MySQL：机器上有了管理数据库的软件
2. 创建 `mysql_notes`：有了这次练习用的库
3. 创建 `emp`：定好员工记录由哪些列组成
4. 插入姓名、年龄等值：这时才真正有了业务记录

刚开始的报错，很多是跳过了其中一步。

表上还带着规则：年龄声明成整数，就按整数规则保存和比较；id 声明成主键，重复编号会被拒绝。这些结构和规则存在服务器上，换客户端、关掉界面都还在。

## 先连接服务，再执行 SQL

课程用的是 MySQL Community Server 8.0.26。服务器、命令行客户端 `mysql`、图形客户端 DataGrip 是三个不同的软件：装了 DataGrip，MySQL 服务不一定装好了。

Windows 上用安装器装：选 MySQL Server，设置端口、管理员密码和 Windows 服务名。课程里服务名是 `MySQL80`，端口是 `3306`，自己装的可能不一样。已经装过数据库的不用为了跟课先卸载，先确认版本和数据位置。

在 PowerShell 里查看服务，启停服务一般要管理员权限：

```powershell
Get-Service -Name '*mysql*'
Start-Service -Name MySQL80
# 仅在确实需要停止自己的实验服务时使用
Stop-Service -Name MySQL80
```

服务跑起来后用下面的命令连接。注意大小写：`-P` 是端口，`-p` 是交互输入密码：

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p
```

看到 `mysql>` 才算进了 SQL 环境：

```sql
SELECT VERSION(), DATABASE();
```

第一列是服务器版本；刚登录还没选库，第二列可能是 `NULL`。`mysql --version` 只显示客户端版本，查服务器版本还得靠上面这条。

常见报错：

- 终端找不到 `mysql`：看 Server 的 `bin` 目录有没有加进 `PATH`，或者直接用 `mysql.exe` 的完整路径
- 连接被拒绝：先查服务、地址和端口
- `Access denied`：查用户名、密码，以及账户允许的来源主机

后两种错误出在不同阶段。

DataGrip 里新建 MySQL 数据源，填同一组主机、端口、用户和密码，下载驱动后测试连接。连上后还要选好可见的 schema，再打开对应库的查询控制台。MySQL 的 `CREATE SCHEMA` 和 `CREATE DATABASE` 是同义写法。图形界面生成的 SQL 一样由服务器执行，执行前看一眼选中的库和语句。

连不上时，按这个顺序看卡在哪一步：

```text
终端能找到 mysql.exe
  → mysql 客户端向指定主机的指定端口连接
  → MySQL 服务检查用户名、来源和认证信息
  → 当前连接选择数据库
  → 服务器检查 SQL 和对象访问权限
  → 执行并返回结果
```

- `mysql` 不是内部或外部命令：终端没找到客户端程序，请求根本没发到服务器，改数据库密码没用
- `Can't connect`：客户端跑起来了，但连接没建立，先核对服务和端口
- `Access denied`：已经走到身份认证或访问检查这一步，要看完整报错，分清是登录失败还是对象操作被拒
- `No database selected`：一般说明已经连上了，只是这条 SQL 没确定操作哪个库

安装器里的几项配置各管各的，不能互相替代：

- 安装路径：程序文件放哪
- 数据目录：服务器把数据库文件放哪
- 端口：客户端靠它找到服务
- Windows 服务名：系统启停用
- root 密码：管理员认证用

PATH 里放的是包含 `mysql.exe` 的目录，别把服务名 `MySQL80` 当成可执行文件路径。

输入 SQL 后提示符从 `mysql>` 变成 `->`，一般是客户端还在等语句结束。比如 `SELECT VERSION()` 忘了分号，补一个 `;` 就行。误开了引号就先检查引号配没配对，也可以用客户端的 `\c` 放弃当前还没发出去的输入。这是在等你把语句写完，不是服务器卡死了。

## 创建一个独立练习库

下面的代码在 `mysql>` 或 DataGrip SQL 控制台里执行，不是直接在 PowerShell 里执行：

```sql
SHOW DATABASES;
CREATE DATABASE IF NOT EXISTS mysql_notes
  DEFAULT CHARACTER SET utf8mb4;
USE mysql_notes;
SELECT DATABASE();
SHOW TABLES;
```

`IF NOT EXISTS`：库已经存在时不报错，也不会清空或重新配置已有的库。`USE` 只改当前连接的默认数据库，换一个连接要重新选。

`utf8mb4` 支持四字节 UTF-8 字符。MySQL 8.0 里的 `utf8` 一般指三字节的 `utf8mb3`，别把它当成完整的 Unicode 支持。字符集管字符怎么编码，排序规则管字符串怎么比较，比如大小写算不算相同。

SQL 书写规则：

- 语句可以跨行，一般以分号结束
- 关键字不分大小写；表名分不分大小写跟系统和配置有关，统一用小写表名，换环境更省事
- 字符串用单引号，标识符需要引用时用反引号
- 注释：`-- ` 后面带空格才是 MySQL 的行注释，另外还支持 `#` 和 `/* ... */`

## 数据类型由数据的含义决定

工号看着像数字，但可能有前导零；身份证号还可能以 X 结尾。两者都不参与算术，按字符串存。

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

字符数不是字节数。一个汉字和一个英文字母都算一个字符，UTF-8 下占的字节却可能不同。也别光凭“定长”就认定 `CHAR` 一定比 `VARCHAR` 快，还要看行格式、数据和访问方式。

成绩要精确保留一位小数，可以用 `DECIMAL(4,1)`，但它照样能存 999.9；“成绩最多 100”要另加约束。类型只管表示范围，业务规则得单独写。

拿员工表把类型再过一遍：

- 工号 `'00001'`：前导零是编号格式的一部分，转成整数 1 就丢了，所以用 VARCHAR
- 工资：要精确到分。`DECIMAL(10,2)` 的上限由总位数决定，10 位里 2 位给小数，整数部分剩 8 位
- 姓名：长度不固定，用 VARCHAR
- 性别：示例只存一个汉字，用 CHAR(1)；但类型不会限制它只能是“男”或“女”，这还得靠业务规则

日期类型也按含义选：

- `DATE` 只存年月日，适合这里的入职日期；要记录某次修改发生在几点几分，就选带时间的类型
- `TIME` 也能表示一定范围内的时长，不只是一天里的钟点
- `TIMESTAMP` 写入和读取时会做会话时区转换，`DATETIME` 更接近原样保存给定的日期时间

时间存什么含义就选什么类型，别只看占几个字节。

改类型前先看已有的值。比如工号列从 VARCHAR(10) 改成 VARCHAR(4)，五位工号就放不下了；年龄从有符号改成无符号，已有的负数要先处理。严格模式下数据库会拒绝这些变更，是在提醒现有数据和新规则冲突。关掉检查不算把类型设计好了。

## 建表、检查和修改

在练习库里建一张专门演示结构变化的表：

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

字段定义之间用逗号隔开，最后一个字段后面没有逗号。`DESC` 看列和类型；`SHOW CREATE TABLE` 看完整建表语句，包括引擎、字符集这些默认设置。InnoDB 是存储引擎，负责存储、索引、事务和锁，后面再展开。

```sql
ALTER TABLE ddl_employee ADD nickname VARCHAR(20) COMMENT '昵称';
ALTER TABLE ddl_employee MODIFY nickname VARCHAR(30) COMMENT '昵称';
ALTER TABLE ddl_employee CHANGE nickname username VARCHAR(30) COMMENT '用户名';
ALTER TABLE ddl_employee DROP COLUMN username;
ALTER TABLE ddl_employee RENAME TO ddl_staff;
```

`MODIFY` 改列定义，`CHANGE` 要同时写旧列名、新列名和新定义。改列时要把想保留的类型、默认值和约束重新写一遍；缩短长度、缩小数值范围前，先确认已有数据放得下。

执行完，`SHOW TABLES` 里能看到 `ddl_staff`，`DESC ddl_staff` 里已经没有 `username`。再查 `ddl_employee` 会报错，因为旧表名已经不存在了。

删除要分清删的是什么：

```sql
-- 只对上面的实验表执行
TRUNCATE TABLE ddl_staff;
DROP TABLE ddl_staff;
```

- `TRUNCATE`：清空记录，表结构留着还能继续用，自增计数会重置
- `DROP TABLE`：连表本身一起删
- `DROP DATABASE`：删掉整个库和里面的对象，后面的练习不用执行它

`TRUNCATE` 和 `DROP TABLE` 都是 DDL，MySQL 里不能像普通 DML 那样用 `ROLLBACK` 撤销。

继续阅读：[写入数据与条件查询](/posts/mysql-heima-02)。


---

[课程目录](/posts/mysql-heima) · [下一篇](/posts/mysql-heima-02)
