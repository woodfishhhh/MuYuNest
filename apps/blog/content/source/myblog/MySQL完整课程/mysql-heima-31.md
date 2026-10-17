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

配置文件决定表与节点的关系，但不同关系承担不同目的。业务表各放一处，是垂直拆分；同一张表的记录分散到多处，是水平分片；一份小表完整复制到多处，是全局表。先分清这三种数据分布，才能判断查询是否有条件在同一个后端完成。

## 让业务表各自归属一个节点

课程把商品表放在一个节点、订单表放在另一个节点，用户和省市区字典放在第三个节点。逻辑库仍然统一呈现这些表，但每张表的物理位置不同。

复用已定义的 dhost1、dhost2、dhost3 三组物理主机连接，但为垂直拆分新建独立物理库 shopping_lab。先在三个后端分别建好这个库，授予后端账户相应实验权限，再增加 vdn1、vdn2、vdn3，避免与前面的范围订单表混用：

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

单个 dataNode 已经确定了位置，不需要再用分片算法选择。客户端用户的 `schemas` 也要加入 `SHOPPING`，否则配置里存在逻辑库，并不代表这个用户能访问它。

这里的 `tb_order` 与范围示例同名，但处在另一组物理库中，演示另一种放置方案。不能在已有分片数据上直接把三节点改成单节点。后者只改变路由，不会把另外两个节点的数据搬过来。

完整电商业务结构并未包含在现有字幕材料中，下面仅建立足以检验位置和关联的最小教学结构。通过 Mycat 进入 SHOPPING 后执行：

```sql
USE SHOPPING;
CREATE TABLE tb_goods(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
CREATE TABLE tb_order(id BIGINT PRIMARY KEY,province_id INT) ENGINE=InnoDB;
CREATE TABLE tb_user(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
INSERT INTO tb_goods VALUES(1,'GoodsRouteTest');
INSERT INTO tb_order VALUES(1,1);
INSERT INTO tb_user VALUES(1,'UserRouteTest');
```

分别直连后端核对：第一台 shopping_lab 应有商品表和记录，第二台有订单，第三台有用户。不要因为代理里一次 SHOW TABLES 能列出三张表，就误以为每个后端也都保存了这三张表。逻辑库把不同位置组合成了一个访问视图。

## 小字典为什么适合做全局表

订单在 vdn2，若地区字典只放在 vdn3，查询“订单及其省份名称”时就需要跨节点关联。可以在新实验中把小型地区字典配置为全局表，使每个相关节点都有完整字典：

```xml
<table name="tb_provinces" type="global" dataNode="vdn1,vdn2,vdn3" />
```

这样 vdn2 上的订单可以与同节点的省份字典关联，省去了这一步跨节点取字典的需要。适合这种处理的是数据较少、变化较少、各节点都需要使用的公共表。

把这个 table 标签放进 SHOPPING 的 schema 后，按版本要求使配置生效，再经代理创建此前不存在的实验字典：

```sql
CREATE TABLE tb_provinces(id INT PRIMARY KEY,name VARCHAR(30)) ENGINE=InnoDB;
INSERT INTO tb_provinces VALUES(1,'北京');
SELECT o.id,p.name AS province_name
FROM tb_order AS o JOIN tb_provinces AS p ON p.id=o.province_id;
```

预期订单 1 对应北京。先直连三个后端确认字典表和 id=1 均存在，再核对订单所在节点能完成关联。逻辑表定义为 global，不会自动把改配置前已经只存在于某一片的历史字典完整迁移到其他片；已有数据改造成全局表时，需要另行建立一致基线。

全局表通过 Mycat 写入时会向配置的节点传播写操作。但“多处都有一份”还意味着多份内容要保持一致，不能把广播等同于所有节点之间已经有可靠的原子提交。直连某一个后端修改字典，也可能绕开广播。验证时要比较各节点的主键和关键字段，不只比较行数。

大订单表不适合因为关联困难就改成全局表。每个节点都保留全部订单，会抵消原本希望通过拆分分散容量和写入压力的目的。

## 取模让一张表的记录分散到多处

日志表演示取模分片。下面回到范围示例的 DB01 及 dn1、dn2、dn3，表名使用尚未创建的 `tb_log`；在 DB01 的逻辑库中加入：

```xml
<table name="tb_log" dataNode="dn1,dn2,dn3" rule="log-mod" />
```

在 `rule.xml` 中定义：

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

通过 Mycat 在新表中测试：

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

正整数 ID 除以 3 的余数就是节点下标。dn1 保存 3、6，dn2 保存 1、4，dn3 保存 2、5。查询 `WHERE id=4` 能计算出目标节点；查询 `WHERE content='route-test-4'` 没有提供分片字段，一般需要访问多个分片再合并。

这个结果说明连续 ID 在本次小样本中分布均匀，不说明访问压力一定均匀。如果大多数请求都访问 ID 4，dn2 仍然会很忙。数据条数均匀与热点分散是两个不同目标。

原课：[P171–175](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=171)。下一篇比较其余数值和字符串规则。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-30) · [下一篇](/posts/mysql-heima-32)
