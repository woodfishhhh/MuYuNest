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

让 Mycat 接收 SQL，要解决三个问题：客户端能访问哪个逻辑库、一条记录按什么规则选节点、这个节点实际连哪台 MySQL。分别对应 `server.xml`、`rule.xml`、`schema.xml`，三者之间靠名字精确关联。

本篇用课程的三节点订单表做例子。配置是按字幕重建的教学片段，不是课程原附件。只在隔离的实验环境里合并到所用发行包的配置文件中；保留发行包的 XML 根元素、DTD 和必要的系统设置，别直接用片段覆盖整个文件。

## 先看懂配置中的几层名称

| 名称 | 示例 | 实际含义 |
| --- | --- | --- |
| schema | `DB01` | 客户端看到的逻辑库 |
| table | `tb_order` | 客户端操作的逻辑表 |
| tableRule | `order-range` | 指定分片字段和算法的规则 |
| dataNode | `dn1` | 一个数据库位置：主机组加物理库名 |
| dataHost | `dhost1` | 后端连接池及读写节点配置 |
| writeHost | `mysql1` | 一台可承担写入的实际 MySQL |

`dn1,dn2,dn3` 的顺序很重要：算法返回 0 选 dn1，返回 1 选 dn2，返回 2 选 dn3。返回值是列表下标，不是名字里的数字。

## 把逻辑表指向三个物理位置

课程的三个 MySQL 地址是 `192.168.200.210`、`.213`、`.214`，每台都有物理库 `db01`。下面的 `MYSQL_1_HOST` 等要替换掉，账户密码也要换成自己的实验账户。

在 `schema.xml` 的根元素里配置：

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

这里用 JDBC，和课程连 MySQL 8 的方式一样。Mycat 发行包、Java、Connector/J 和后端认证方式要匹配；课程演示的是 Java 8、MySQL 8.0.26、Connector/J 8.0.22。别为了复现旧例子去删现有驱动，或者改真实服务器的认证策略。

JDBC URL 带多个参数时，XML 里的 `&` 要写成 `&amp;`。原生驱动 `dbDriver="native"` 的 URL 写法不一样，不能只改驱动名却留着 JDBC URL。

- `checkSQLschema`：处理 SQL 里的逻辑库名前缀。
- `sqlMaxLimit="100"`：符合条件又没写 LIMIT 的查询会被默认限制，所以查出 100 行不代表表里只有 100 行。
- `primaryKey="id"`：Mycat 的元数据配置，真实表还是要自己声明 `PRIMARY KEY`。

顺着一条订单记录检查引用关系：

1. 客户端往 `DB01.tb_order` 写 id=5000001
2. table 的 rule 指向 `order-range`
3. 这个规则读取 id，调用 `order-range-fn`
4. 函数查映射文件，得到下标 1
5. 下标 1 对应 table 的第二个 dataNode，也就是 dn2
6. dn2 把 dhost2 和物理库 db01 组合起来
7. 用 dhost2 的 writeHost 连接实际的 MySQL

链上每个名字都要能找到定义。table 写了 dn2，下面却只声明了 dn1，是节点引用缺失；rule 名字对、function 名字对不上，是算法引用缺失；逻辑引用都对、实际的 db01 却没建，就会在访问后端时失败。按这条链逐段查，比在三份 XML 里乱改名字有效。

连接池参数也属于物理访问层。minCon 是连接池准备的最小连接数，maxCon 是最大连接数，它们不是整个应用请求数的全局上限。多个 dataHost 都会建连接池，后端承受的连接总数要合起来算。光调大 maxCon，也不会让一个慢查询变快。

## 定义范围规则

在 `rule.xml` 的根元素里加这两段，先放 tableRule，再按发行包的结构放 function：

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

再在配置资源目录里建 `order-range.txt`：

```text
0-5000000=0
5000001-10000000=1
10000001-15000000=2
```

课程原配置用 `M` 缩写范围；Mycat 这个实现里的 M 表示万，容易和别的系统里的百万搞混，这里直接写整数。范围两端都包含在内。没配默认节点的话，15000001 找不到分片，会报路由错误，不会自动给你建第四个节点。

## 客户端账户与后端账户是两回事

在 `server.xml` 里声明客户端用户：

```xml
<user name="notes_app">
  <property name="password">REPLACE_CLIENT_PASSWORD</property>
  <property name="schemas">DB01</property>
</user>
```

客户端用 `notes_app` 登录 Mycat；Mycat 再用前面的 `mycat_backend` 连 MySQL。两组账户各管一段连接，客户端能登录，不代表后端账户也能用。

用户的 `readOnly=true` 可以限制成只读。课程还演示了 schema/table 级的 `privileges`，四位 `dml` 按 INSERT、UPDATE、SELECT、DELETE 排列，比如 `0110` 允许更新和查询，`1110` 允许插入、更新和查询。配了 Mycat 权限，后端 MySQL 的权限还是要单独管。

MySQL 后端账户在各个后端上建，Mycat 客户端用户写在 server.xml 里。以第一台已经建好 db01 的独立实验后端为例，由管理员执行：

```sql
CREATE USER 'mycat_backend'@'MYCAT_CLIENT_IP'
IDENTIFIED BY 'REPLACE_BACKEND_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,DROP
ON db01.* TO 'mycat_backend'@'MYCAT_CLIENT_IP';
```

`MYCAT_CLIENT_IP` 换成这台 MySQL 实际看到的 Mycat 连接来源；密码要和对应 writeHost 一致。这里给了结构权限，是为了在实验里经代理建表，业务运行账户要不要留这些权限另外决定。另外两台后端也要有对应的库和能用的账户，别只给第一台授权就以为整条路由链都能写。

## 分层验证配置与数据

先在三台独立后端上分别建好 `db01`，验证后端账户能从 Mycat 所在的机器连上。然后检查配置名称对不对得上、启动日志有没有报错，再用客户端连 Mycat 默认的数据端口：

```bash
mysql -h MYCAT_HOST -P 8066 -u notes_app -p
```

进入逻辑库，建这个最小测试表。它只用来检验课程的范围规则，不代表课程完整的订单模型：

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

按本例的分片表配置，建表语句会在对应后端建出表结构。然后分别直连三个后端，执行 `SELECT id FROM db01.tb_order ORDER BY id`：dn1 应该有 1、5000000；dn2 有 5000001、10000000；dn3 有 10000001、15000000。通过代理应该能读到全部六条。这里的"应该"是按规则推出来的预期，本笔记没有真的启动 Mycat 集群。

这样验证能区分三种情况：逻辑表名出现了，但后端还没建表；表建好了，但后端权限挡住了写入；写入成功了，但规则或节点顺序和预期不符。光看 `SHOW TABLES` 或者一条启动成功的日志，排除不了这些问题。

如果拿到了和实验对应的 Mycat 1.x Linux 发行包，启动顺序也可以单独核对：在解压后的 Mycat 根目录，先 `java -version` 确认运行环境，再确认 conf 里的 schema、rule、server 和映射文件都保存好了、lib 里的 JDBC 驱动和当前后端兼容，然后用发行包的 `bin/mycat start`。`bin/mycat status` 和 logs 里的 `wrapper.log`、`mycat.log` 用来查进程和具体的启动错误，日志位置以实际目录为准。

- 进程没起来：先看 Java、启动包装器或 XML 解析错误。
- 进程起来了但 8066 登录失败：先看端口和客户端用户。
- 登录成功但读写失败：再看逻辑库授权、节点映射和后端连接。

别什么都归结成"密码不对"。

测边界时可以单独执行一条 id=15000001 的 INSERT，预期范围映射找不到节点。这个失败发生在路由阶段，不代表要去三个后端都建这个 id。要是意外写成功了，就检查是不是开了 defaultNode、是不是实际加载了另一份映射，或者 table 引用了别的规则。

原课：[P167–170](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=167)，范围规则回顾见 P174。参数核对依据见 [来源与验证说明](/posts/mysql-heima-sources)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-29) · [下一篇](/posts/mysql-heima-31)
