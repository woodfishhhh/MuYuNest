---
title: "MySQL 入门实战：连接排错、字符集、数据类型与用户权限"
slug: mysql-setup-ddl-and-types
date: 2026-10-17
categories:
  - "数据库"
tags:
  - "MySQL"
  - "DDL"
  - "字符集"
  - "数据类型"
  - "权限管理"
---

把业务数据交给 MySQL 管理，第一步往往卡在“装了客户端却连不上服务”，或者上线后才发现 `utf8` 存不进 Emoji、工号前导零被整型吞掉、远程账号按服务器 IP 授权结果死活登不上去。打通连接排错链路、定好字符集与数据类型边界，再配上最小权限账号，后续的建表和查询才不会反复返工。

## 服务连接与故障排查链路

MySQL 服务端、命令行客户端 `mysql` 和图形客户端（如 DataGrip）是三个独立组件。本地装好了图形客户端，只说明有发请求的工具，MySQL Server 服务本身可能并未启动甚至尚未安装。

Windows 环境下通过 PowerShell 检查并启停服务（需要管理员权限），然后用命令行连接：

```powershell
Get-Service -Name '*mysql*'
Start-Service -Name MySQL80

# -P（大写）指定端口，-p（小写）触发交互式输入密码
mysql -h 127.0.0.1 -P 3306 -u root -p
```

进入 `mysql>` 提示符后，用服务端函数确认版本与当前默认库（`mysql --version` 只能看到客户端自身版本）：

```sql
SELECT VERSION(), DATABASE();
```

**连不上数据库时，按请求经过的五个阶段逐层定位，能直接避免“网络不通却去改密码”的无效排查：**

```text
终端找到 mysql 客户端
  --> 客户端向目标主机和端口发起 TCP 连接
  --> 服务端校验用户名、来源主机与认证插件
  --> 当前连接选定默认数据库（USE）
  --> 服务端校验 SQL 语法与对象访问权限
```

| 报错特征 | 卡住的阶段 | 直接排查动作 |
| :--- | :--- | :--- |
| `mysql` 不是内部或外部命令 | 客户端未进 `PATH` | 把 MySQL Server 的 `bin` 目录加入系统 `PATH`，或使用绝对路径 |
| `Can't connect to MySQL server` | TCP 连接未建立 | 核对服务是否启动、监听端口与防火墙规则 |
| `Access denied for user ...` | 身份认证或对象授权 | 看清完整报错，区分登录口令/来源主机不匹配，还是缺少库表权限 |
| `No database selected` | 连接已通但未选库 | 先执行 `USE <db>`，或在 SQL 中写全 `db.table` |

在命令行敲完语句如果提示符从 `mysql>` 变成 `->`，说明客户端还在等待分号 `;` 或闭合引号（可用 `\c` 放弃当前未发出的输入），服务端尚未开始执行。

## 字符集、SQL 规范与实验库初始化

MySQL 中 `CREATE SCHEMA` 与 `CREATE DATABASE` 是同义词。创建业务库时，**必须显式指定 `utf8mb4` 字符集**，因为 MySQL 8.0 里历史遗留的 `utf8` 别名指向三字节的 `utf8mb3`，遇到四字节 Unicode 字符（如生僻汉字和 Emoji）会直接写入报错。字符集决定字符如何编码，排序规则（Collation，如 `utf8mb4_0900_ai_ci`）则决定字符串比较时是否区分大小写与重音。

```sql
CREATE DATABASE IF NOT EXISTS mysql_notes
  DEFAULT CHARACTER SET utf8mb4;
USE mysql_notes;
```

书写 SQL 时遵守四条工程习惯能省去很多环境差异坑：语句以 `;` 结尾；表名与列名统一小写（避免 Linux 文件系统大小写敏感导致的跨平台报错）；字符串常量用单引号，保留字标识符用反引号；行注释 `-- ` 后必须紧跟一个空格。

后续查询与多表实战均基于下面这套 `mysql_notes.emp` 基准表（与 `dept` 等关联表一起构成完整测试数据集）：

```sql
CREATE TABLE emp (
  id INT PRIMARY KEY,
  work_no VARCHAR(10) NOT NULL,
  name VARCHAR(20) NOT NULL,
  gender CHAR(1),
  age TINYINT UNSIGNED,
  id_card CHAR(18),
  work_address VARCHAR(30),
  entry_date DATE,
  salary DECIMAL(10,2),
  dept_id INT,
  manager_id INT
) ENGINE=InnoDB;

INSERT INTO emp
  (id, work_no, name, gender, age, id_card, work_address, entry_date, salary, dept_id, manager_id)
VALUES
  (1, '00001', '柳岩', '女', 20, 'TEST00000000000001', '北京', '2020-01-01', 8000, 1, 4),
  (2, '00002', '张无忌', '男', 18, 'TEST00000000000002', '北京', '2021-06-01', 6000, 1, 4),
  (3, '00003', '周芷若', '女', 18, NULL, '上海', '2022-03-01', 7000, 2, 5),
  (4, '00004', '张三丰', '男', 88, 'TEST00000000000004', '北京', '2000-01-01', 20000, 1, NULL),
  (5, '00005', '灭绝', '女', 65, 'TEST00000000000005', '西安', '2005-01-01', 15000, 2, NULL),
  (6, '00006', '胡青牛', '男', 70, 'TEST0000000000000X', '西安', '2006-01-01', 12000, 3, 4),
  (7, '00007', '赵敏', '女', 20, 'TEST00000000000007', '北京', '2023-01-01', 9000, 1, 4),
  (8, '00008', '韦一笑', '男', 38, 'TEST00000000000008', '天津', '2015-01-01', 10000, NULL, 4);
```

## 数据类型选型边界

设计字段类型的核心原则是按数据的**语义与运算需求**选型，而不是看到数字就用 `INT`。例如工号 `'00001'` 带有前导零且不参与加减，身份证号可能以 `'X'` 结尾，两者都必须存成字符串类型。

| 类型 | 存储与边界特征 | 选型要点 |
| :--- | :--- | :--- |
| `TINYINT` ~ `BIGINT` | 分别占 1、2、3、4、8 字节整数；`UNSIGNED` 去掉负数并翻倍正数上限 | 按业务上限选最小够用整型（如年龄用 `TINYINT UNSIGNED`） |
| `DECIMAL(M, D)` | 精确小数，`M` 为总位数，`D` 为小数位 | 金额、薪资等必须精确计算的场景严禁用 `FLOAT`/`DOUBLE` |
| `CHAR(n)` / `VARCHAR(n)` | 定长与变长字符串；`n` 为**字符数**，非字节数 | `VARCHAR` 需额外 1~2 字节记录长度；固定编码用 `CHAR`，变长文本用 `VARCHAR` |
| `TEXT` / `BLOB` | 大文本与二进制数据（分 TINY/MEDIUM/LONG 级） | 避免与高频列表字段混查，必要时拆表存储 |
| `DATE` / `TIME` / `YEAR` | 纯日期 / 时间或时长 / 年份 | `TIME` 可表示超过 24 小时的时长间隔 |
| `DATETIME` / `TIMESTAMP` | 日期时间；`TIMESTAMP` 受 2038 年范围限制且做时区转换 | 跨时区时间戳选 `TIMESTAMP` 或统一存 UTC `DATETIME` |

**数据类型只限制表示范围，不负责业务校验——例如 `DECIMAL(4,1)` 能存下 `999.9`，要限制成绩上限 100 必须额外加约束。**

修改已有字段类型（例如把 `VARCHAR(10)` 缩窄为 `VARCHAR(4)`，或把有符号整数改为 `UNSIGNED`）前，务必先核对存量数据是否越界。严格模式下（`STRICT_TRANS_TABLES`）MySQL 会直接拒绝截断或超范围写入，切忌为了图省事关闭严格模式掩盖脏数据。

## DDL 表结构维护与高危删除边界

通过 `CREATE TABLE` 建表后，可用 `DESC` 查看列定义，用 `SHOW CREATE TABLE` 核对完整建表语句（含存储引擎与默认字符集）。结构变更通过 `ALTER TABLE` 完成：

```sql
CREATE TABLE ddl_employee (
  id INT COMMENT '编号',
  work_no VARCHAR(10) COMMENT '工号',
  name VARCHAR(20) COMMENT '姓名',
  age TINYINT UNSIGNED COMMENT '年龄'
) ENGINE=InnoDB COMMENT='表结构练习';

ALTER TABLE ddl_employee ADD nickname VARCHAR(20) COMMENT '昵称';
ALTER TABLE ddl_employee MODIFY nickname VARCHAR(30) COMMENT '昵称';
ALTER TABLE ddl_employee CHANGE nickname username VARCHAR(30) COMMENT '用户名';
ALTER TABLE ddl_employee DROP COLUMN username;
ALTER TABLE ddl_employee RENAME TO ddl_staff;
```

`MODIFY` 用于调整当前列的数据类型与约束，`CHANGE` 用于同时修改列名和完整定义；两者都会用新定义覆盖旧列属性，因此原有的 `NOT NULL`、`DEFAULT` 与 `COMMENT` 必须重新写全。

清理数据时要分清三种删除语句的破坏粒度：`TRUNCATE TABLE` 清空全表记录并重置自增计数器，但保留表结构；`DROP TABLE` 删除表结构与全部数据；`DROP DATABASE` 销毁整个库。**`TRUNCATE` 与 `DROP` 均属于 DDL 操作，在 MySQL 中会触发隐式提交，无法像普通 `DELETE` 那样通过 `ROLLBACK` 撤销。**

## 用户账号定位与权限控制

MySQL 的账户身份由 `'用户名'@'来源主机'` 两部分联合唯一确定。`'reader'@'localhost'` 与 `'reader'@'10.0.0.20'` 是两个完全独立的账户，权限彼此隔离。

**`CREATE USER 'app'@'host'` 里的 `host` 指客户端请求从哪台机器发起，绝不是 MySQL 服务器自身的 IP。**

排查“明明授过权却提示无权限”时，先用下面两条函数对照客户端登录信息与服务端实际命中的授权账户：

```sql
SELECT User, Host FROM mysql.user;
SELECT USER(), CURRENT_USER();
```

`USER()` 返回客户端声明的身份，`CURRENT_USER()` 返回服务端匹配权限表后实际生效的账户。创建、改密、授权与回收权限应当统一使用标准 DCL 语句，不要直接修改 `mysql.user` 系统表：

```sql
-- 创建与修改用户密码
CREATE USER 'notes_reader'@'localhost' IDENTIFIED BY 'StrongPass_123!';
ALTER USER 'notes_reader'@'localhost' IDENTIFIED BY 'NewStrongPass_456!';

-- 仅授予单表查询权限并查看授权结果
GRANT SELECT ON mysql_notes.emp TO 'notes_reader'@'localhost';
SHOW GRANTS FOR 'notes_reader'@'localhost';

-- 回收权限与彻底删除账户
REVOKE SELECT ON mysql_notes.emp FROM 'notes_reader'@'localhost';
DROP USER 'notes_reader'@'localhost';
```

对于认证插件兼容性问题，老教程常见的 `mysql_native_password` 从 MySQL 8.0.34 起已标记弃用、8.4 默认关闭并在 9.0 中移除，新项目应统一采用 `caching_sha2_password` 并升级对应客户端驱动。同时需注意授权范围的层级叠加：`mysql_notes.emp`（表级）、`mysql_notes.*`（库级）、`*.*`（实例级）各自独立记录，在小层级执行 `REVOKE` 无法抵消大层级已经授予的同名权限，收回权限前务必以 `SHOW GRANTS` 的输出为准逐级清理。
