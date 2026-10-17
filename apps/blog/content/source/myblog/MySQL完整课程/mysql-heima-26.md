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

mysql、mysqldump、mysqlbinlog 都是客户端程序，但处理的对象不同。先分清输入是 SQL 脚本、结构化文本还是二进制日志，才能选择正确工具，避免“导入命令执行了，数据却没恢复”。

## 系统信息从哪里查

| 数据库 | 主要内容 |
| --- | --- |
| mysql | 账户、权限及服务器运行需要的系统信息 |
| information_schema | 库、表、列、索引、存储对象等元数据视图 |
| performance_schema | 运行时事件、等待、锁等监测信息 |
| sys | 对部分监测信息提供较便于阅读的汇总视图 |

查表结构用 information_schema，查正在等待什么锁用 performance_schema；它们回答的问题不同。系统账户信息应通过 CREATE USER、GRANT 等标准命令管理，不直接手改系统表。

## 一次执行 SQL，与进入交互终端

以下命令在 PowerShell 或其他系统终端运行：

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p mysql_notes -e "SELECT COUNT(*) AS people FROM emp;"
mysqladmin -h 127.0.0.1 -u root -p version
mysqlshow -h 127.0.0.1 -u root -p mysql_notes
```

`mysql -e` 连接、认证、执行 SQL 后退出，不进入持续交互提示符，但仍然要登录认证。mysqladmin 执行管理操作；mysqlshow 便于查看库、表和列，`--count` 还可能执行计数，对大库有实际成本。

`-P` 是端口，`-p` 请求输入密码。不要把示例中的用户名、地址和密码当成自己的配置。脚本自动化应采用明确的凭据管理方式，不把真实密码写入可共享的脚本或日志。

几个工具虽然都带 mysql 字样，入口却不一样。`mysql` 接收 SQL，`mysqladmin` 接收它定义的管理子命令，`mysqldump` 从服务器读取对象并生成导出内容，`mysqlbinlog` 解释二进制日志。把一份 SQL 文件交给 mysqlimport，并不会因为文件来自 MySQL 就自动执行其中的 CREATE TABLE。

`-e` 中的查询也仍然有当前数据库。命令中的 `mysql_notes` 指定默认库，所以 `FROM emp` 能确定对象；如果删掉这个库名，就需要在 SQL 中写 `mysql_notes.emp` 或先执行 USE。终端引号的作用是把整条 SQL 作为同一个参数传给客户端，它不是 SQL 字符串列值的引号。

## mysqldump 的输出内容由参数决定

```powershell
mysqldump -u root -p --single-transaction mysql_notes --result-file=D:/mysql-lab/notes.sql
mysqldump -u root -p --no-data mysql_notes --result-file=D:/mysql-lab/schema.sql
mysqldump -u root -p --no-create-info mysql_notes --result-file=D:/mysql-lab/data.sql
```

第一条导出表结构与数据；`--no-data`（-d）只导出结构；`--no-create-info`（-t）省略建表语句。是否导出过程、事件等对象还需相应参数，不能认为“完整数据库”三个字自动包含所有对象、账户和服务器配置。

只写数据库名的导出通常依赖恢复时选定目标库；使用 `--databases mysql_notes` 会带相应数据库选择语句。默认导出还可能包含 DROP TABLE，恢复前必须检查目标与脚本内容，不能直接在已有业务库里试一遍。

`--tab=目录`（-T）会把表定义和分隔文本数据分别导出，受服务器目录、FILE 权限、文件系统权限及 secure_file_priv 约束。它适合明确的服务器端文件流程，不是把任意客户端目录填进去就能工作。

逻辑备份的输出通常可以作为文本审查：先有会话设置和对象定义，再有 INSERT 等数据语句，还可能包含触发器、过程或其他对象。它描述“怎样重建这些内容”，不是把正在运行的数据目录逐字节复制一份。因此导出和恢复都需要时间，目标版本也必须能理解输出中的 SQL。

选择参数时应先确定恢复目标。只想比较表结构，可导出 no-data；已有完全匹配的表结构、只准备装载记录，才考虑 no-create-info；希望在空目标上重建库和表，则要确保包含对应定义。只导出数据后在一个没有表的实例上执行，失败的原因是前提缺失，不是 INSERT 文件本身没生成。

如果导出账户没有读取某些对象的权限，或命令中途失败，仅看到输出文件存在也不能判定备份完整。应检查工具退出状态、错误输出、文件末尾以及目标对象范围，随后通过恢复确认内容能用。

## 恢复时先在隔离实例中验证

SQL 脚本用 mysql 执行，已经进入 mysql> 时可以用 SOURCE：

```sql
-- 在用于恢复验证的独立目标实例中
CREATE DATABASE mysql_notes_restore CHARACTER SET utf8mb4;
USE mysql_notes_restore;
SOURCE D:/mysql-lab/notes.sql;
SHOW TABLES;
```

这个例子要求 notes.sql 没有强制切回原库的 USE 等语句。若脚本含原库名，应在隔离实例中按原库名恢复，或经过审查后调整恢复方案，不能只执行一次 USE 就假设所有后续写入都留在新库。

mysqlimport 处理分隔文本数据，通常按文件名对应已有表名；它不是 SQL 脚本解释器。导出为 `.sql` 的 CREATE/INSERT 应交给 mysql/SOURCE，导出为字段分隔文本才考虑 mysqlimport 或 LOAD DATA。

恢复验证应检查对象数量、关键行数和关键业务关系，必要时运行应用查询。表结构恢复成功、数据导入无报错、业务数据一致，是不同的验证层次。备份文件放在原数据库同一块故障磁盘上，也不能覆盖磁盘丢失的恢复场景。

可以用本套数据给恢复测试安排明确的核对项。只在独立目标中恢复 emp 的原始初始化状态时，员工数应为 8，工资总和应为 87000；如果备份时已经完成部门篇，dept 应有 4 行，员工引用的非空部门都应存在。若备份发生在做完其他已提交实验之后，预期必须以那一刻的状态为准，不能机械套用初始数值。

检查 SQL 可以是：

```sql
SELECT COUNT(*) AS people,SUM(salary) AS total_salary FROM emp;
SELECT e.id,e.dept_id
FROM emp AS e LEFT JOIN dept AS d ON d.id=e.dept_id
WHERE e.dept_id IS NOT NULL AND d.id IS NULL;
SHOW CREATE TABLE emp;
```

第一条核对基本数据，第二条核对引用关系，第三条核对结构与约束是否保留。它们验证的层次不同：相同行数仍可能有不同工资，金额总和相同也可能分配到了错误员工，所以重要记录还应按主键核对具体字段。

恢复结束后，应继续执行实际依赖的查询或过程。若忘了导出存储过程，基础表都能查询，却在 CALL 时失败；这类缺口只有按应用所需对象验证才会暴露。

## 二进制日志要用专用工具读取

```powershell
mysqlbinlog --base64-output=DECODE-ROWS -vv D:/mysql-lab/binlog.000001
```

该命令便于查看 ROW 事件对应的行变化，输出中 `###` 开头的伪 SQL 是解释性注释，不应手动复制出来当作完整恢复脚本。若要执行日志恢复，应使用保留可回放事件的正确输出，并按事务边界、时间点或位置规划，详见日志与复制部分。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-25) · [下一篇](/posts/mysql-heima-27)
