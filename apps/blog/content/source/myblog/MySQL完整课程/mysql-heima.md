---
title: "MySQL 完整课程：从查询到分片与复制"
date: 2026-10-17 00:00:00
slug: mysql-heima
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

这套笔记按理解顺序整理黑马 MySQL 课程的 195 集。前半部分从一张员工表开始，讲怎么写查询、约束和事务；后半部分顺着查询执行、页面与日志、复制和分片往下讲。每个主题都有前提、机制、示例和结果解释，不用先看视频也能读。

讲机制的地方会把中间过程走完：分组前后记录怎么变，B 树怎么因为连续插入一级级分裂，游标怎么在最后一次 FETCH 退出，ReadView 怎么一个个接受或排除版本。涉及多台机器时，会写清楚命令在哪个节点执行、数据经过哪些环节、怎么核对结果到了没有。

## 开始前先确定环境与数据

基础 SQL 以课程的 MySQL 8.0.26 为准，用 InnoDB。新版本在认证、管理命令和文件布局上有差异，直接影响操作的地方正文里有说明。Mycat 部分讲的是课程的 1.x 架构，别和 Mycat 2 的配置混用。

先读第 1 篇连上数据库，再按第 2 篇执行一次 [员工表初始化脚本](/posts/mysql-heima#初始化脚本)。用独立的 `mysql_notes` 实验库。脚本没有清库或覆盖旧表的步骤，碰到同名对象先看看里面有什么，别反复整段执行。

员工表的八人数据是照着课程任务重建的统一教学数据，不是视频里原表的逐行复制，各篇的数字都以这份脚本为准。其他前置：部门表在第 6 篇建，学生和选课表在第 7 篇建，索引实验的 index_user 在第 14 篇建。跳着读的话先把这些建好；反例和故意报错的语句要单独执行。

标成 SQL 的代码块在数据库客户端里跑，PowerShell、Bash 命令在系统终端里跑。DELIMITER 是客户端脚本指令；XML 片段要合并进对应发行包的配置结构。所有 `REPLACE_...`、主机名占位符和明确说明的日志位置都要换成自己的。

示例的输出都是推导出来的预期，没在 MySQL/Mycat 上实际执行过。字幕全文读过，正文做过技术复核，示例数值单独核算过，文档结构也检查过，但这些都代替不了在数据库上跑一遍。具体材料和检查结果见 [来源与验证说明](/posts/mysql-heima-sources)。

## 按问题阅读

### 查询、约束与事务

- [01 · 数据库连接与表结构](/posts/mysql-heima-01)
- [02 · 写入数据与条件查询](/posts/mysql-heima-02)
- [03 · 聚合、分组、排序与分页](/posts/mysql-heima-03)
- [04 · 账户与权限](/posts/mysql-heima-04)
- [05 · 函数与条件表达式](/posts/mysql-heima-05)
- [06 · 约束与外键](/posts/mysql-heima-06)
- [07 · 多表关系与连接查询](/posts/mysql-heima-07)
- [08 · 子查询与相关查询](/posts/mysql-heima-08)
- [09 · 多表查询综合案例](/posts/mysql-heima-09)
- [10 · 事务与隔离级别](/posts/mysql-heima-10)

### 存储结构与 SQL 优化

- [11 · 存储引擎与服务器结构](/posts/mysql-heima-11)
- [12 · B+ 树、聚簇索引与回表](/posts/mysql-heima-12)
- [13 · 定位慢 SQL 与执行计划](/posts/mysql-heima-13)
- [14 · 联合索引与查询条件](/posts/mysql-heima-14)
- [15 · 排序、分组、分页与计数优化](/posts/mysql-heima-15)
- [16 · 批量写入、主键设计与更新范围](/posts/mysql-heima-16)

### 视图与存储程序

- [17 · 视图与检查选项](/posts/mysql-heima-17)
- [18 · 存储过程、变量与参数](/posts/mysql-heima-18)
- [19 · 循环与存储函数](/posts/mysql-heima-19)
- [20 · 游标与条件处理](/posts/mysql-heima-20)
- [21 · 触发器与变更日志](/posts/mysql-heima-21)

### 锁、日志与多版本读取

- [22 · 全局锁、表锁与元数据锁](/posts/mysql-heima-22)
- [23 · 记录锁、间隙锁与临键锁](/posts/mysql-heima-23)
- [24 · InnoDB 的内存、磁盘与日志](/posts/mysql-heima-24)
- [25 · MVCC 与 ReadView](/posts/mysql-heima-25)

### 管理、备份与复制

- [26 · 管理工具与备份恢复](/posts/mysql-heima-26)
- [27 · 错误日志、binlog 与查询日志](/posts/mysql-heima-27)
- [28 · 主从复制与一致性起点](/posts/mysql-heima-28)

### 分片、监控与读写分离

- [29 · 分库分表的设计取舍](/posts/mysql-heima-29)
- [30 · Mycat 配置与范围分片](/posts/mysql-heima-30)
- [31 · 垂直拆分、全局表与取模](/posts/mysql-heima-31)
- [32 · 枚举、子串与哈希分片](/posts/mysql-heima-32)
- [33 · 按天与按月分片](/posts/mysql-heima-33)
- [34 · Mycat 路由与监控](/posts/mysql-heima-34)
- [35 · 读写分离与一致性](/posts/mysql-heima-35)
- [36 · 双主双从与故障切换](/posts/mysql-heima-36)

## 初始化脚本

把下面的内容存成 UTF-8 的 `01-schema-data.sql`，按第 2 篇的说明在独立的练习库里执行一次。它不会先清空已有对象。

```sql
-- MySQL 8.0.26+，仅用于独立的 mysql_notes 实验库。
-- 第一次执行创建对象；不自动删除已有表或覆盖已有数据。
CREATE DATABASE IF NOT EXISTS mysql_notes DEFAULT CHARACTER SET utf8mb4;
USE mysql_notes;

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

-- 身份证号为教学用虚构字符串，不对应真实身份。
INSERT INTO emp
  (id,work_no,name,gender,age,id_card,work_address,entry_date,salary,dept_id,manager_id)
VALUES
  (1,'00001','柳岩','女',20,'TEST00000000000001','北京','2020-01-01',8000,1,4),
  (2,'00002','张无忌','男',18,'TEST00000000000002','北京','2021-06-01',6000,1,4),
  (3,'00003','周芷若','女',18,NULL,'上海','2022-03-01',7000,2,5),
  (4,'00004','张三丰','男',88,'TEST00000000000004','北京','2000-01-01',20000,1,NULL),
  (5,'00005','灭绝','女',65,'TEST00000000000005','西安','2005-01-01',15000,2,NULL),
  (6,'00006','胡青牛','男',70,'TEST0000000000000X','西安','2006-01-01',12000,3,4),
  (7,'00007','赵敏','女',20,'TEST00000000000007','北京','2023-01-01',9000,1,4),
  (8,'00008','韦一笑','男',38,'TEST00000000000008','天津','2015-01-01',10000,NULL,4);

SELECT COUNT(*) AS employees FROM emp;
```
