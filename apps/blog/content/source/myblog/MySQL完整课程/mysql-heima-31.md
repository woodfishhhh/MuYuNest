---
title: "MySQL（31）：垂直拆分、全局表与取模"
date: 2026-10-17 00:00:00
slug: mysql-heima-31
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

配置文件决定表和节点的关系，不同的关系目的不同：

- 业务表各放一处：垂直拆分
- 同一张表的记录分散到多处：水平分片
- 一份小表完整复制到多处：全局表

先分清这三种分布，才能判断一个查询有没有条件在同一个后端上做完。

## 让业务表各自归属一个节点

课程把商品表放一个节点、订单表放另一个节点，用户和省市区字典放第三个节点。逻辑库还是把这些表统一展示出来，但每张表的物理位置不同。

复用已经定义好的 dhost1、dhost2、dhost3 三组物理主机连接，但为垂直拆分新建独立的物理库 shopping_lab。先在三个后端分别建好这个库、给后端账户授好实验权限，再加 vdn1、vdn2、vdn3，免得和前面的范围订单表混用：

```xml
<schema name="SHOPPING" checkSQLschema="true" sqlMaxLimit="100">
  <table name="tb_goods" dataNode="vdn1" />
  <table name="tb_order" dataNode="vdn2" />
  <table name="tb_user" dataNode="vdn3" />
</schema>
<dataNode name="vdn1" dataHost="dhost1" database="shopping_lab" />
<dataNode name="vdn2" dataHost="dhost2" database="shopping_lab" />
<dataNode name="vdn3" dataHost="dhost3" database="shopping_lab" />
```

单个 dataNode 已经定死了位置，不用再走分片算法。客户端用户的 `schemas` 里也要加上 `SHOPPING`，配置里有这个逻辑库，不代表这个用户就能访问。

这里的 `tb_order` 和范围示例同名，但在另一组物理库里，演示的是另一种放法。别在已有分片数据上直接把三节点改成单节点，那样只改了路由，另外两个节点的数据不会搬过来。

完整的电商业务结构不在现有字幕材料里，下面只建一个够检验位置和关联的最小教学结构。通过 Mycat 进入 SHOPPING 后执行：

```sql
USE SHOPPING;
CREATE TABLE tb_goods(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
CREATE TABLE tb_order(id BIGINT PRIMARY KEY,province_id INT) ENGINE=InnoDB;
CREATE TABLE tb_user(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
INSERT INTO tb_goods VALUES(1,'GoodsRouteTest');
INSERT INTO tb_order VALUES(1,1);
INSERT INTO tb_user VALUES(1,'UserRouteTest');
```

分别直连后端核对：第一台的 shopping_lab 有商品表和记录，第二台有订单，第三台有用户。代理里一次 SHOW TABLES 能列出三张表，不代表每个后端都存了这三张表，逻辑库只是把不同位置组合成了一个访问视图。

## 小字典为什么适合做全局表

订单在 vdn2，地区字典如果只放在 vdn3，查"订单和它的省份名称"就要跨节点关联。可以在新实验里把小型地区字典配置成全局表，让每个相关节点都有一份完整字典：

```xml
<table name="tb_provinces" type="global" dataNode="vdn1,vdn2,vdn3" />
```

这样 vdn2 上的订单就能和同节点的省份字典关联，不用跨节点取字典。适合这样做的是数据少、变化少、各节点都要用的公共表。

把这个 table 标签放进 SHOPPING 的 schema，按版本要求让配置生效，再经代理建一个之前不存在的实验字典：

```sql
CREATE TABLE tb_provinces(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
INSERT INTO tb_provinces VALUES(1,'北京');
SELECT o.id,p.name AS province_name
FROM tb_order AS o JOIN tb_provinces AS p ON p.id=o.province_id;
```

预期订单 1 对应北京。先直连三个后端确认字典表和 id=1 都在，再核对订单所在的节点能完成关联。逻辑表定义成 global，不会把改配置前只存在某一片里的历史字典自动迁移到其他片；已有数据改造成全局表，要另外建立一致的基线。

通过 Mycat 写全局表时，写操作会传播到配置的各个节点。但多处都有一份，就意味着多份内容要保持一致，广播不等于节点之间已经有可靠的原子提交。直连某个后端改字典，也可能绕过广播。验证时要比较各节点的主键和关键字段，不能只比行数。

大订单表不能因为关联麻烦就改成全局表。每个节点都存全部订单，等于把拆分想分散的容量和写入压力又全加回来了。

## 取模让一张表的记录分散到多处

日志表演示取模分片。下面回到范围示例的 DB01 和 dn1、dn2、dn3，表名用还没建的 `tb_log`；在 DB01 的逻辑库里加：

```xml
<table name="tb_log" dataNode="dn1,dn2,dn3" rule="log-mod" />
```

在 `rule.xml` 里定义：

```xml
<tableRule name="log-mod">
  <rule>
    <columns>id</columns>
    <algorithm>log-mod-fn</algorithm>
  </rule>
</tableRule>
<function name="log-mod-fn" class="io.mycat.route.function.PartitionByMod">
  <property name="count">3</property>
</function>
```

通过 Mycat 在新表里测试：

```sql
USE DB01;
CREATE TABLE tb_log (
  id BIGINT NOT NULL PRIMARY KEY,
  content VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
INSERT INTO tb_log VALUES (1,'route-test-1');
INSERT INTO tb_log VALUES (2,'route-test-2');
INSERT INTO tb_log VALUES (3,'route-test-3');
INSERT INTO tb_log VALUES (4,'route-test-4');
INSERT INTO tb_log VALUES (5,'route-test-5');
INSERT INTO tb_log VALUES (6,'route-test-6');
```

正整数 ID 除以 3 的余数就是节点下标：dn1 存 3、6，dn2 存 1、4，dn3 存 2、5。查 `WHERE id=4` 能算出目标节点；查 `WHERE content='route-test-4'` 没带分片字段，一般要访问多个分片再合并。

这个结果只说明连续 ID 在这批小样本里分布均匀，不说明访问压力也均匀。大部分请求都访问 ID 4 的话，dn2 照样很忙。数据条数均匀和热点分散是两个目标。

原课：[P171–175](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=171)。下一篇比较其余的数值和字符串规则。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-30) · [下一篇](/posts/mysql-heima-32)
