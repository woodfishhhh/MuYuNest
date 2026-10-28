---
title: "MySQL（26）：管理工具与备份恢复"
date: 2026-10-17 00:00:00
slug: mysql-heima-26
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

mysql、mysqldump、mysqlbinlog 都是客户端程序，但处理的东西不一样。先分清手里是 SQL 脚本、分隔文本还是二进制日志，再选工具，免得"导入命令跑完了，数据却没恢复"。

## 系统信息从哪里查

| 数据库 | 主要内容 |
| --- | --- |
| mysql | 账户、权限及服务器运行需要的系统信息 |
| information_schema | 库、表、列、索引、存储对象等元数据视图 |
| performance_schema | 运行时事件、等待、锁等监测信息 |
| sys | 对部分监测信息提供较便于阅读的汇总视图 |

查表结构用 information_schema，查在等什么锁用 performance_schema。账户用 CREATE USER、GRANT 这些标准命令管，别直接手改系统表。

## 一次执行 SQL，与进入交互终端

下面的命令在 PowerShell 或其他系统终端里跑：

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p mysql_notes -e "SELECT COUNT(*) AS people FROM emp;"
mysqladmin -h 127.0.0.1 -u root -p version
mysqlshow -h 127.0.0.1 -u root -p mysql_notes
```

`mysql -e`：连接、认证、执行 SQL 后退出，不进交互提示符，但照样要登录。mysqladmin 做管理操作；mysqlshow 看库、表、列，加 `--count` 还会去计数，大库上有实际开销。

`-P` 是端口，`-p` 是提示输入密码。示例里的用户名、地址、密码不是你的配置。脚本自动化要有正经的凭据管理，别把真实密码写进会被共享的脚本或日志。

这几个工具名字都带 mysql，但吃的东西不一样：

- `mysql`：SQL
- `mysqladmin`：它自己定义的管理子命令
- `mysqldump`：从服务器读对象，生成导出内容
- `mysqlbinlog`：解析二进制日志

把 SQL 文件交给 mysqlimport，它不会因为文件来自 MySQL 就去执行里面的 CREATE TABLE。

`-e` 里的查询也有当前数据库：命令里的 `mysql_notes` 指定了默认库，`FROM emp` 才找得到表；去掉库名的话，就要写 `mysql_notes.emp` 或者先 USE。终端里的引号只是把整条 SQL 当成一个参数传给客户端，不是 SQL 里字符串值的引号。

## mysqldump 的输出内容由参数决定

```powershell
mysqldump -u root -p --single-transaction mysql_notes --result-file=D:/mysql-lab/notes.sql
mysqldump -u root -p --no-data mysql_notes --result-file=D:/mysql-lab/schema.sql
mysqldump -u root -p --no-create-info mysql_notes --result-file=D:/mysql-lab/data.sql
```

第一条导出表结构和数据；`--no-data`（-d）只导结构；`--no-create-info`（-t）不要建表语句。过程、事件等对象要另加参数，"完整数据库"不会自动包含所有对象、账户和服务器配置。

只写库名的导出，恢复时一般要自己先选好目标库；用 `--databases mysql_notes` 会带上选库语句。默认导出可能还带 DROP TABLE，恢复前先看清目标库和脚本内容，别直接在业务库上试。

`--tab=目录`（-T）把表定义和分隔文本数据分开导出，受服务器目录、FILE 权限、文件系统权限和 secure_file_priv 限制。它是服务器端写文件的流程，不是随便填个客户端目录就能用。

逻辑备份的输出是可以直接看的文本：先是会话设置和对象定义，再是 INSERT 等数据语句，可能还有触发器、过程等。它描述的是"怎么重建这些内容"，不是把数据目录逐字节复制一份，所以导出、恢复都要时间，目标版本也得认得输出里的 SQL。

选参数前先想好恢复目标：

- 只想对比表结构：用 no-data
- 表结构已经完全一致、只装数据：才考虑 no-create-info
- 要在空库上重建库和表：确保导出里有对应的定义

只导了数据，拿到一个没有表的实例上执行，失败是因为前提不满足，不是 INSERT 文件没生成。

导出账户没权限读某些对象，或者命令中途失败，文件照样可能生成。所以要看工具的退出状态、错误输出、文件结尾和对象范围，再通过恢复确认能用。

## 恢复时先在隔离实例中验证

SQL 脚本交给 mysql 执行，已经在 mysql> 里的话用 SOURCE：

```sql
-- 在用于恢复验证的独立目标实例中
CREATE DATABASE mysql_notes_restore CHARACTER SET utf8mb4;
USE mysql_notes_restore;
SOURCE D:/mysql-lab/notes.sql;
SHOW TABLES;
```

这个例子要求 notes.sql 里没有强制切回原库的 USE。脚本里带原库名的话，要么在隔离实例里按原库名恢复，要么审查后调整方案，别以为先 USE 一下后面的写入就都落在新库。

mysqlimport 处理分隔文本数据，一般按文件名对应已有的表名，它不解释 SQL 脚本。导出成 `.sql` 的 CREATE/INSERT 交给 mysql/SOURCE；导出成字段分隔文本，才考虑 mysqlimport 或 LOAD DATA。

恢复验证要看对象数量、关键行数和关键业务关系，必要时跑一遍应用查询。表结构恢复成功、数据导入没报错、业务数据一致，是三层不同的验证。备份文件和原库放在同一块磁盘上，这块盘坏了备份也一起没了。

用本套数据可以列出明确的核对项：在独立目标里只恢复 emp 的初始状态时，员工数应该是 8，工资总和 87000；如果备份时已经做完部门篇，dept 应该有 4 行，员工引用的非空部门都要存在。备份是在做完别的已提交实验之后做的，就按那一刻的状态来核对，别死套初始数值。

检查 SQL：

```sql
SELECT COUNT(*) AS people,SUM(salary) AS total_salary FROM emp;
SELECT e.id,e.dept_id
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.dept_id IS NOT NULL AND d.id IS NULL;
SHOW CREATE TABLE emp;
```

第一条核对基本数据，第二条核对引用关系，第三条核对结构和约束有没有保留。行数一样，工资可能不一样；总额一样，也可能分错了人。重要记录要按主键核对具体字段。

恢复完还要跑实际依赖的查询或过程。比如忘了导出存储过程，基础表都能查，一 CALL 就失败。这种缺口只有按应用实际用到的对象去验证才发现得了。

## 二进制日志要用专用工具读取

```powershell
mysqlbinlog --base64-output=DECODE-ROWS -vv D:/mysql-lab/binlog.000001
```

这条命令方便看 ROW 事件对应的行变化，输出里 `###` 开头的伪 SQL 只是解释性注释，别手动复制出来当恢复脚本。真要做日志恢复，得用保留了可回放事件的正确输出，按事务边界、时间点或位置来规划，详见日志与复制部分。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-25) · [下一篇](/posts/mysql-heima-27)
