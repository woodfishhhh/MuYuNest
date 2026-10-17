---
title: "MySQL（32）：枚举、子串与哈希分片"
date: 2026-10-17 00:00:00
slug: mysql-heima-32
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

范围和取模适合能转换成数值的键。面对状态值、带编码的字符串或 UUID，还需要选择不同算法。不要只记算法名称；要能从输入键一步步算出节点下标，并知道新增节点后哪些数据需要搬迁。

以下配置都是 `rule.xml` 中的 function 片段。使用时需要配套 tableRule：`columns` 指向真实表字段，`algorithm` 指向 function 的 name，再由 `schema.xml` 的表引用 tableRule。完整连接方式见 [Mycat 配置与范围分片](/posts/mysql-heima-30)。每个实验使用独立名称，避免修改共享规则影响其他表。

## 枚举分片把业务值映射到节点

课程按 `status` 分片，1、2、3 分别进入下标 0、1、2。映射资源 `status-map.txt` 写成：

```text
1=0
2=1
3=2
```

对应函数：

```xml
<function name="status-map-fn" class="io.mycat.route.function.PartitionByFileMap">
  <property name="mapFile">status-map.txt</property>
  <property name="type">0</property>
  <property name="defaultNode">2</property>
</function>
```

`type=0` 将键解析为整数，使用字符串枚举时应采用字符串类型配置（例如 `type=1`）。`defaultNode=2` 表示未收录的合法键交给第三个节点；它不表示第二个节点，也不代表所有解析错误都会自动兜底。整数模式传入非数字，仍会转换失败。

没有默认节点时，状态 4 没有映射就无法得到有效路由。这有时比静默写入某一片更容易发现漏配。选择兜底之前，应明确新状态数据是否确实可以全部归到同一片。

要把函数接到可操作的表上，还需要补上字段和表规则。下面在 rule.xml 中放 tableRule，并在 schema.xml 的逻辑库内放 table：

```xml
<tableRule name="status-map-rule">
  <rule><columns>status</columns><algorithm>status-map-fn</algorithm></rule>
</tableRule>
```

```xml
<table name="tb_status_part" dataNode="dn1,dn2,dn3" rule="status-map-rule" />
```

使配置生效后，通过对应的 DB01 逻辑库建立测试表：

```sql
CREATE TABLE tb_status_part(id BIGINT PRIMARY KEY,status INT NOT NULL) ENGINE=InnoDB;
INSERT INTO tb_status_part VALUES(1,1);
INSERT INTO tb_status_part VALUES(2,2);
INSERT INTO tb_status_part VALUES(3,3);
INSERT INTO tb_status_part VALUES(4,4);
```

前三条按映射分别进入下标 0、1、2；第四条的状态 4 不在映射文件中，按 defaultNode=2 进入第三片。判断依据是 status，不是 id，所以不能拿 id%3 来核对这张表的位置。

按状态拆分还隐含一个业务问题：状态改变时，记录可能需要改变归属。不能默认一次普通 UPDATE 就完成了历史数据跨片搬迁。实际代理是否允许修改分片键、怎样完成移动，需要按版本能力设计和验证；频繁变化的字段因此往往会增加分片维护难度。

## 子串分片要求编码本身包含节点号

直接子串算法从指定位置截出数字，把数字作为节点下标：

```xml
<function name="id-prefix-fn" class="io.mycat.route.function.PartitionDirectBySubString">
  <property name="startIndex">0</property>
  <property name="size">2</property>
  <property name="partitionCount">3</property>
  <property name="defaultPartition">0</property>
</function>
```

`startIndex=0` 从第一个字符开始，`size=2` 取两个字符。`000001` 去节点 0，`010001` 去节点 1，`020001` 去节点 2。`040001` 得到 4，超出三个节点的下标范围，按配置回到默认节点 0。

这里的下标从 0 开始，与 MySQL `SUBSTRING` 常用的从 1 开始的字符位置不同。字符串太短会在截取时出错，前两位不是数字会在转换时出错；`defaultPartition` 只处理该实现规定的节点越界，不能作为所有错误的兜底。

这种规则把物理布局写入了编码约定。已有编号不能因增加节点随意改前缀，生成编号的应用也必须遵守同一规则。

这个算法需要保留编号中的前导零，所以列应是字符串：

```xml
<tableRule name="id-prefix-rule">
  <rule><columns>id</columns><algorithm>id-prefix-fn</algorithm></rule>
</tableRule>
```

```xml
<table name="tb_prefix_part" dataNode="dn1,dn2,dn3" rule="id-prefix-rule" />
```

```sql
CREATE TABLE tb_prefix_part(id VARCHAR(20) PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO tb_prefix_part VALUES('000001');
INSERT INTO tb_prefix_part VALUES('010001');
INSERT INTO tb_prefix_part VALUES('020001');
```

若把 id 定义成数值，`'000001'` 保存成 1 后就丢了编码位置，后续再按前两位解释也失去原意。类型、编号生成规则和分片函数必须表达同一份约定。

## 固定槽位哈希先算槽，再找节点

`PartitionByLong` 使用 1024 个槽，数值经过与 `1023` 按位与后落到其中一个槽，再由配置把槽区间分配给节点。

```xml
<function name="long-hash-fn" class="io.mycat.route.function.PartitionByLong">
  <property name="partitionCount">2,1</property>
  <property name="partitionLength">256,512</property>
</function>
```

两组参数按位置配对：先安排两个各 256 槽的分区，再安排一个 512 槽的分区。总量必须满足 `2×256 + 1×512 = 1024`。结果是节点 0 接收槽 0–255，节点 1 接收 256–511，节点 2 接收 512–1023。

以正整数计算：1089 的槽号为 `1089 & 1023 = 65`，进入节点 0；269 进入节点 1；889 进入节点 2。第三个节点拥有一半槽位，前两个各有四分之一，因此这里本来就不是三等分。

槽位比例只决定路由空间的分配。键值集中在某些槽，实际数据仍可能偏斜。重新分配槽位后，也必须搬迁归属改变的记录。

为什么与 1023 按位与能把非负数限制在 1024 个槽？1024 是 2 的 10 次方，1023 的二进制低十位都是 1。按位与只保留键的低十位，得到 0～1023 的值。1089 可以写成 `1024+65`，高出的 1024 被去掉，留下 65；然后才检查 65 位于哪一段槽区间。

partitionCount 中的 `2,1` 不是“节点编号 2 和 1”，partitionLength 中的 `256,512` 也不是“这两个节点分别存多少行”。它们配对描述两种分区长度及其数量，最后展开为三段 `[256,256,512]`。把这一步展开写出来，才能与三项 dataNode 的顺序对应。

## 字符串哈希先截取，再计算哈希

```xml
<function name="name-hash-fn" class="io.mycat.route.function.PartitionByString">
  <property name="partitionCount">2</property>
  <property name="partitionLength">512</property>
  <property name="hashSlice">0:2</property>
</function>
```

它同样使用 1024 槽，这次分为两个各 512 槽的节点。先从字符串取一段，计算哈希，再映射到槽。

`hashSlice=0:2` 的右端点不包含在内，只取下标 0、1 两个字符。字幕把它解释为下标 0、1、2，这一点需要纠正。固定版本中 `PartitionByString.calculate` 把起止位置交给 `StringUtil.hash`，后者循环条件明确为 `i < end`。[实现依据](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/util/StringUtil.java)

例如 `abX` 与 `abY` 在这个配置下参与计算的都是 `ab`，因此一定落到同一槽。算法对字符依次计算 `h = 31*h + 字符值`，`ab` 得到 3105，槽号 `3105 & 1023 = 33`，进入节点 0。这是根据源码计算的示例，没有声称在 Mycat 服务中实测。

如果字符串前缀重复率很高，截取过短会让大量键聚到一起。分片时需要的是有区分度的部分，不是机械地取前两个字符。

这里仅有两个分区，因此逻辑表也应对应两个节点。下面给出与函数一致的连接：

```xml
<tableRule name="name-hash-rule">
  <rule><columns>name</columns><algorithm>name-hash-fn</algorithm></rule>
</tableRule>
```

```xml
<table name="tb_string_part" dataNode="dn1,dn2" rule="name-hash-rule" />
```

```sql
CREATE TABLE tb_string_part(id BIGINT PRIMARY KEY,name VARCHAR(20) NOT NULL) ENGINE=InnoDB;
INSERT INTO tb_string_part VALUES(1,'abX');
INSERT INTO tb_string_part VALUES(2,'abY');
```

两条 name 的前两位都为 ab，预期都进入 dn1。这里先按字符值计算哈希，再按槽表选节点，并不是把前两位直接解析成数字；因此它与前面的应用指定子串算法完全不同。

全局业务 ID 的唯一性还要另行保证。若按 name 分片，两个相同 id 的记录可能落在不同物理表，各自的本地主键约束未必能彼此发现冲突。每片都有 PRIMARY KEY，不自动等于整个逻辑表有了跨片唯一性检查。

## 一致性哈希减少扩容时改变归属的键

课程使用 `PartitionByMurmurHash` 对 UUID 这类字符串分片：

```xml
<function name="uuid-ring-fn" class="io.mycat.route.function.PartitionByMurmurHash">
  <property name="seed">0</property>
  <property name="count">3</property>
  <property name="virtualBucketTimes">160</property>
</function>
```

可以把它理解成一条有顺序的哈希环：物理节点对应多个虚拟位置，键也映射到环上，再按规则选择负责该位置的节点。虚拟位置用于分散节点覆盖的范围。这里明确写出种子、节点数量与虚拟桶参数，避免读者依赖隐藏默认值。

增加节点会让部分区间转交给新节点，所以部分键仍要迁移。一致性哈希的意义是减少重新分配范围，不能写成“扩容后所有旧数据都不需要迁移”。Mycat 改配置也不会自动替应用完成迁移、校验与切换。

用一个只解释原理的环来想：三个节点在环上各有若干位置，一个键沿既定方向找到负责它的节点。加入新节点的位置后，紧邻该位置的一段键可能改由新节点负责，其他很多区间可以保持归属。真实 Mycat 的哈希值、虚拟桶位置和分布由源码与参数决定，不能把这个概念图的位置当成某个 UUID 的实际路由结果。

seed、count、虚拟桶参数和节点顺序共同参与既定映射。已经写入数据后随意改变它们，旧键就可能被算到不同节点。即使采用了一致性哈希，稳定配置、迁移和验证仍是使用前提。

范围、取模、枚举、子串、固定槽哈希、字符串哈希与一致性哈希，最终都需要输出合法节点下标。排查错误时先拿一条具体键走完计算链，再核对节点列表顺序，比只看“哈希分片”四个字有效得多。

原课：[P176–180](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=176)。函数核对使用 [Mycat 1.6.7.4 固定提交](https://github.com/MyCATApache/Mycat-Server/tree/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function)，与课程 1.6.7.3 存在版本差异，不能据此推断全部行为完全相同。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-31) · [下一篇](/posts/mysql-heima-33)
