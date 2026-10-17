---
title: "MySQL（30）：Mycat 配置与范围分片"
date: 2026-10-17 00:00:00
slug: mysql-heima-30
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

让 Mycat 接收 SQL，需要解决三个问题：客户端可以访问哪个逻辑库，一条记录按照什么规则选择节点，以及这个节点实际连接哪台 MySQL。三个问题分别落在 `server.xml`、`rule.xml` 和 `schema.xml`，但它们必须通过名称准确关联。

本篇以课程的三节点订单表为例。配置是依据字幕重建的教学片段，并非原课程附件。只在隔离实验环境中合并到所用发行包的配置文件；保留发行包的 XML 根元素、DTD 与必要系统设置，不直接用片段覆盖整个文件。

## 先看懂配置中的几层名称

| 名称 | 示例 | 实际含义 |
| --- | --- | --- |
| schema | `DB01` | 客户端看到的逻辑库 |
| table | `tb_order` | 客户端操作的逻辑表 |
| tableRule | `order-range` | 指定分片字段和算法的规则 |
| dataNode | `dn1` | 一个数据库位置：主机组加物理库名 |
| dataHost | `dhost1` | 后端连接池及读写节点配置 |
| writeHost | `mysql1` | 一台可承担写入的实际 MySQL |

`dn1,dn2,dn3` 的顺序很重要。算法返回 0 就选 dn1，返回 1 就选 dn2，返回 2 就选 dn3。返回值是列表下标，不是名字中的数字。

## 把逻辑表指向三个物理位置

课程的三个 MySQL 地址为 `192.168.200.210`、`.213`、`.214`，每台都有物理库 `db01`。下列 `MYSQL_1_HOST` 等内容需要替换；账户密码也必须填写为自己的实验账户。

在 `schema.xml` 的根元素内配置：

```xml
<schema name="DB01" checkSQLschema="true" sqlMaxLimit="100">
  <table name="tb_order" primaryKey="id"
         dataNode="dn1,dn2,dn3" rule="order-range" />
</schema>
<dataNode name="dn1" dataHost="dhost1" database="db01" />
<dataNode name="dn2" dataHost="dhost2" database="db01" />
<dataNode name="dn3" dataHost="dhost3" database="db01" />

<dataHost name="dhost1" maxCon="100" minCon="1" balance="0"
          writeType="0" dbType="mysql" dbDriver="jdbc" switchType="-1">
  <heartbeat>SELECT 1</heartbeat>
  <writeHost host="mysql1" url="jdbc:mysql://MYSQL_1_HOST:3306/db01"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
</dataHost>
<dataHost name="dhost2" maxCon="100" minCon="1" balance="0"
          writeType="0" dbType="mysql" dbDriver="jdbc" switchType="-1">
  <heartbeat>SELECT 1</heartbeat>
  <writeHost host="mysql2" url="jdbc:mysql://MYSQL_2_HOST:3306/db01"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
</dataHost>
<dataHost name="dhost3" maxCon="100" minCon="1" balance="0"
          writeType="0" dbType="mysql" dbDriver="jdbc" switchType="-1">
  <heartbeat>SELECT 1</heartbeat>
  <writeHost host="mysql3" url="jdbc:mysql://MYSQL_3_HOST:3306/db01"
             user="mycat_backend" password="REPLACE_BACKEND_PASSWORD" />
</dataHost>
```

这里用 JDBC，与课程连接 MySQL 8 的方式一致。Mycat 发行包、Java、Connector/J 和后端认证方式需要匹配；课程演示的是 Java 8、MySQL 8.0.26 与 Connector/J 8.0.22。不要为了复现旧例子而删除现有驱动或修改真实服务器的认证策略。

若 JDBC URL 添加多个参数，XML 中的 `&` 必须写成 `&amp;`。原生驱动 `dbDriver="native"` 使用另一种 URL 形式，不能只改驱动名却保留 JDBC URL。

`checkSQLschema` 用于处理 SQL 中的逻辑库名前缀。`sqlMaxLimit="100"` 会对符合条件、未显式限制条数的查询施加默认限制，所以查询返回 100 行不能证明表里只有 100 行。`primaryKey="id"` 是 Mycat 的元数据配置，真实表仍需声明自己的 `PRIMARY KEY`。

沿一条订单记录检查引用关系：客户端向 `DB01.tb_order` 写入 id=5000001；table 的 rule 指向 `order-range`；这个规则指定读取 id，并调用 `order-range-fn`；函数用映射文件得到下标 1；下标 1 对应 table 的第二个 dataNode，即 dn2；dn2 再把 dhost2 与物理库 db01 组合起来；最后使用 dhost2 的 writeHost 连接实际 MySQL。

这条链上每个名字都要能找到定义。table 写了 dn2，但下方只声明 dn1，属于节点引用缺失；rule 名字正确但 function 名字对不上，属于算法引用缺失；逻辑引用都正确、实际数据库 db01 却未创建，则会在后端访问时失败。按链逐段检查，比在三份 XML 里随机改名字有效。

连接池参数也属于物理访问层。minCon 决定相应连接池准备的最小连接规模，maxCon 限制其最大规模；它们不是整套应用请求数量的全局上限。多个 dataHost 都创建连接池时，后端承受的连接总量需要合起来考虑。单纯调大 maxCon 不会让一个慢查询的计算自动变快。

## 定义范围规则

在 `rule.xml` 的根元素内加入这两段，先放 tableRule，再按发行包结构放 function：

```xml
<tableRule name="order-range">
  <rule>
    <columns>id</columns>
    <algorithm>order-range-fn</algorithm>
  </rule>
</tableRule>
<function name="order-range-fn" class="io.mycat.route.function.AutoPartitionByLong">
  <property name="mapFile">order-range.txt</property>
</function>
```

再在配置资源目录创建 `order-range.txt`：

```text
0-5000000=0
5000001-10000000=1
10000001-15000000=2
```

课程原配置用 `M` 缩写范围；Mycat 这一实现中的 M 表示万，容易与其他系统的百万混淆，这里直接写整数。范围端点都包含在内。没有配置默认节点时，15000001 找不到对应分片，应报路由错误，不会自动帮你创建第四个节点。

## 客户端账户与后端账户是两回事

在 `server.xml` 中声明客户端用户：

```xml
<user name="notes_app">
  <property name="password">REPLACE_CLIENT_PASSWORD</property>
  <property name="schemas">DB01</property>
</user>
```

客户端使用 `notes_app` 登录 Mycat；Mycat 再使用前面的 `mycat_backend` 连接 MySQL。两组账户各自负责一段连接，不能因为客户端能登录，就认定后端账户也可用。

用户的 `readOnly=true` 可以限制为只读。课程还演示了 schema/table 级 `privileges`，四位 `dml` 按 INSERT、UPDATE、SELECT、DELETE 排列，例如 `0110` 允许更新和查询，`1110` 允许插入、更新和查询。配置 Mycat 权限时，后端 MySQL 权限仍需要单独管理。

MySQL 后端账户应在各自后端创建，客户端 Mycat 用户则写在 server.xml。以第一台已创建 db01 的独立实验后端为例，由管理员执行：

```sql
CREATE USER 'mycat_backend'@'MYCAT_CLIENT_IP'
IDENTIFIED BY 'REPLACE_BACKEND_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP
ON db01.* TO 'mycat_backend'@'MYCAT_CLIENT_IP';
```

`MYCAT_CLIENT_IP` 要替换成这台 MySQL 实际看到的 Mycat 连接来源；密码必须与对应 writeHost 一致。这里授予结构权限是为了独立实验经代理建表，业务运行账户是否保留它们应另行决定。其余两台后端也要具备对应数据库和可用账户，不能只给第一台授权后就认为整个路由链可写。

## 分层验证配置与数据

先在三台独立后端上分别建立 `db01`，并验证后端账户可从 Mycat 所在机器连接。随后检查配置名称是否对应、启动日志是否报错，再用客户端连接 Mycat 默认数据端口：

```bash
mysql -h MYCAT_HOST -P 8066 -u notes_app -p
```

进入逻辑库，创建这个最小测试表。它只用于检验课程的范围规则，不代表原课的完整订单模型：

```sql
USE DB01;
CREATE TABLE tb_order (
  id BIGINT NOT NULL PRIMARY KEY,
  note VARCHAR(40) NOT NULL
) ENGINE=InnoDB;

INSERT INTO tb_order (id,note) VALUES (1,'range-0');
INSERT INTO tb_order (id,note) VALUES (5000000,'range-0-end');
INSERT INTO tb_order (id,note) VALUES (5000001,'range-1-start');
INSERT INTO tb_order (id,note) VALUES (10000000,'range-1-end');
INSERT INTO tb_order (id,note) VALUES (10000001,'range-2-start');
INSERT INTO tb_order (id,note) VALUES (15000000,'range-2-end');
SELECT id,note FROM tb_order ORDER BY id;
```

在本例的分片表配置下，建表语句应在对应后端建出结构。接着分别直连三个后端，执行 `SELECT id FROM db01.tb_order ORDER BY id`：dn1 应有 1、5000000；dn2 应有 5000001、10000000；dn3 应有 10000001、15000000。通过代理应读到全部六条。这里的“应”是按规则推导的预期，本笔记没有实际启动 Mycat 集群。

这样验证可以区分三种情况：逻辑表名已经出现，但后端尚未建表；表已建好，但后端权限阻止写入；写入成功，但规则或节点顺序与预期不符。仅看 `SHOW TABLES` 或一条启动成功日志，无法排除这些问题。

如果已取得与实验对应的 Mycat 1.x Linux 发行包，启动顺序也应能独立核对。在解压后的 Mycat 根目录，先用 `java -version` 确认运行环境，再确认 conf 中 schema、rule、server 与映射文件都已保存，lib 中 JDBC 驱动与当前后端兼容，然后使用发行包的 `bin/mycat start`。`bin/mycat status` 和 logs 中的 `wrapper.log`、`mycat.log` 用于检查进程与具体启动错误；不同包的日志位置以实际目录为准。

若进程没起来，先看 Java、启动包装器或 XML 解析错误；进程起来但 8066 登录失败，先看端口和客户端用户；登录成功但读写失败，再看逻辑库授权、节点映射及后端连接。不要把所有阶段都归结为“密码不对”。

测试边界时可以另外单独执行 id=15000001 的 INSERT，预期范围映射无法找到节点。这个失败应发生在路由阶段，并不代表需要在三个后端都去创建该 id。若意外写入成功，应检查是否启用了 defaultNode、是否实际加载了另一份映射，或 table 引用了不同规则。

原课：[P167–170](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=167)，范围规则回顾见 P174。参数核对依据见 [来源与验证说明](/posts/mysql-heima-sources)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-29) · [下一篇](/posts/mysql-heima-31)
