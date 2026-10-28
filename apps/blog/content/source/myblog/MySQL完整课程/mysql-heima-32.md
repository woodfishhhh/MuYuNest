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

范围和取模适合能转成数值的键。状态值、带编码的字符串、UUID 这些，要选别的算法。光记算法名没用，要能从一个键一步步算出节点下标，还要知道加节点后哪些数据得搬。

下面的配置都是 `rule.xml` 里的 function 片段。使用时要配套 tableRule：`columns` 指向真实表字段，`algorithm` 指向 function 的 name，再由 `schema.xml` 里的表引用 tableRule。完整的连接方式见 [Mycat 配置与范围分片](/posts/mysql-heima-30)。每个实验用独立的名字，免得改共享规则影响别的表。

## 枚举分片把业务值映射到节点

课程按 `status` 分片，1、2、3 分别进下标 0、1、2。映射资源 `status-map.txt` 写成：

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

`type=0` 把键解析成整数，字符串枚举要用字符串类型配置（比如 `type=1`）。`defaultNode=2` 表示没收录的合法键交给第三个节点，不是第二个节点，也不是所有解析错误都会自动兜底：整数模式下传非数字，照样转换失败。

没有默认节点的话，状态 4 没有映射就得不到有效路由。这有时候比悄悄写进某一片更容易发现漏配。加兜底之前，先确认新状态的数据真的都能归到同一片。

把函数接到能操作的表上，还要补上字段和表规则。在 rule.xml 里放 tableRule，在 schema.xml 的逻辑库里放 table：

```xml
<tableRule name="status-map-rule">
  <rule><columns>status</columns><algorithm>status-map-fn</algorithm></rule>
</tableRule>
```

```xml
<table name="tb_status_part" dataNode="dn1,dn2,dn3" rule="status-map-rule" />
```

配置生效后，通过 DB01 逻辑库建测试表：

```sql
CREATE TABLE tb_status_part(id BIGINT PRIMARY KEY,status INT NOT NULL) ENGINE=InnoDB;
INSERT INTO tb_status_part VALUES(1,1);
INSERT INTO tb_status_part VALUES(2,2);
INSERT INTO tb_status_part VALUES(3,3);
INSERT INTO tb_status_part VALUES(4,4);
```

前三条按映射分别进下标 0、1、2；第四条的状态 4 不在映射文件里，按 defaultNode=2 进第三片。判断依据是 status，不是 id，所以别拿 id%3 去核对这张表的位置。

按状态拆分还有个业务问题：状态一变，记录可能要换分片。别以为一条普通 UPDATE 就完成了跨片搬迁。代理允不允许改分片键、怎么移动，要按版本能力去设计和验证。经常变的字段做分片键，维护会更麻烦。

## 子串分片要求编码本身包含节点号

直接子串算法从指定位置截出数字，直接当节点下标：

```xml
<function name="id-prefix-fn" class="io.mycat.route.function.PartitionDirectBySubString">
  <property name="startIndex">0</property>
  <property name="size">2</property>
  <property name="partitionCount">3</property>
  <property name="defaultPartition">0</property>
</function>
```

`startIndex=0` 从第一个字符开始，`size=2` 取两个字符。`000001` 去节点 0，`010001` 去节点 1，`020001` 去节点 2。`040001` 得到 4，超出三个节点的下标范围，按配置回到默认节点 0。

注意这里下标从 0 开始，和 MySQL `SUBSTRING` 常用的从 1 开始不一样。字符串太短会在截取时报错，前两位不是数字会在转换时报错；`defaultPartition` 只处理这个实现规定的节点越界，不是万能兜底。

这种规则把物理布局写进了编码约定。已有的编号不能因为加节点就随便改前缀，生成编号的应用也得遵守同一套规则。

这个算法要保留编号里的前导零，所以列得是字符串：

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

把 id 定义成数值的话，`'000001'` 存成 1 就丢了编码位置，再按前两位解释就没意义了。类型、编号生成规则、分片函数要表达同一份约定。

## 固定槽位哈希先算槽，再找节点

`PartitionByLong` 用 1024 个槽，数值和 `1023` 按位与后落到某个槽，再由配置把槽区间分给节点。

```xml
<function name="long-hash-fn" class="io.mycat.route.function.PartitionByLong">
  <property name="partitionCount">2,1</property>
  <property name="partitionLength">256,512</property>
</function>
```

两组参数按位置配对：先排两个各 256 槽的分区，再排一个 512 槽的分区，总数要满足 `2×256 + 1×512 = 1024`。结果是节点 0 管槽 0–255，节点 1 管 256–511，节点 2 管 512–1023。

拿正整数算：1089 的槽号是 `1089 & 1023 = 65`，进节点 0；269 进节点 1；889 进节点 2。第三个节点占一半槽位，前两个各占四分之一，本来就不是三等分。

为什么和 1023 按位与能把非负数限制在 1024 个槽里？1024 是 2 的 10 次方，1023 的二进制低十位全是 1，按位与只保留键的低十位，结果在 0～1023。1089 = `1024+65`，高出的 1024 被去掉，剩下 65，再看 65 落在哪段槽区间。

partitionCount 里的 `2,1` 不是"节点编号 2 和 1"，partitionLength 里的 `256,512` 也不是"两个节点各存多少行"。它们是配对描述两种分区长度和各自的数量，展开后是三段 `[256,256,512]`，正好对应三个 dataNode 的顺序。

槽位比例只决定路由空间怎么分。键值集中在某些槽，实际数据照样会偏。重新分配槽位后，归属变了的记录也得搬。

## 字符串哈希先截取，再计算哈希

```xml
<function name="name-hash-fn" class="io.mycat.route.function.PartitionByString">
  <property name="partitionCount">2</property>
  <property name="partitionLength">512</property>
  <property name="hashSlice">0:2</property>
</function>
```

同样是 1024 槽，这次分成两个各 512 槽的节点。先从字符串里截一段，算哈希，再映射到槽。

`hashSlice=0:2` 不包括右端点，只取下标 0、1 两个字符。字幕里说是下标 0、1、2，这里纠正一下。固定版本里 `PartitionByString.calculate` 把起止位置交给 `StringUtil.hash`，后者的循环条件写的是 `i < end`。[实现依据](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/util/StringUtil.java)

比如 `abX` 和 `abY`，参与计算的都是 `ab`，一定落到同一个槽。算法对字符依次算 `h = 31*h + 字符值`，`ab` 得到 3105，槽号 `3105 & 1023 = 33`，进节点 0。这是按源码算出来的，没在 Mycat 服务上实测。

如果字符串前缀重复得厉害，截得太短会让大量键挤在一起。要截的是有区分度的部分，不是机械地取前两个字符。

这里只有两个分区，逻辑表也要对应两个节点。和函数配套的连接：

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

两条 name 前两位都是 ab，预期都进 dn1。这里是先按字符值算哈希、再按槽表选节点，不是把前两位直接解析成数字，和前面的子串算法完全不同。

全局业务 ID 的唯一性要另外保证。按 name 分片的话，两条 id 相同的记录可能落进不同的物理表，各自的本地主键约束发现不了彼此冲突。每片都有 PRIMARY KEY，不等于整个逻辑表有了跨片唯一性检查。

## 一致性哈希减少扩容时改变归属的键

课程用 `PartitionByMurmurHash` 给 UUID 这类字符串分片：

```xml
<function name="uuid-ring-fn" class="io.mycat.route.function.PartitionByMurmurHash">
  <property name="seed">0</property>
  <property name="count">3</property>
  <property name="virtualBucketTimes">160</property>
</function>
```

可以理解成一个有方向的哈希环：每个物理节点对应环上多个虚拟位置，键也映射到环上，再按规则找负责这个位置的节点。虚拟位置用来打散每个节点覆盖的范围。这里把种子、节点数、虚拟桶参数都明确写出来，别依赖隐藏的默认值。

加节点会把一部分区间转给新节点，所以还是有一部分键要迁移。一致性哈希的意义是减少重新分配的范围，不是"扩容后旧数据都不用迁移"。Mycat 改配置也不会替应用完成迁移、校验和切换。

用一个只讲原理的环来想：三个节点在环上各有若干位置，键沿固定方向找到负责它的节点。加入新节点后，紧挨着它的一段键可能改由新节点负责，其他很多区间不变。Mycat 真实的哈希值、虚拟桶位置和分布由源码和参数决定，别把示意图上的位置当成某个 UUID 的实际路由。

seed、count、虚拟桶参数和节点顺序一起决定映射。写入数据后再随便改它们，旧键就可能被算到别的节点。就算用了一致性哈希，稳定的配置、迁移和验证也还是前提。

范围、取模、枚举、子串、固定槽哈希、字符串哈希、一致性哈希，最后都要输出一个合法的节点下标。排查时拿一条具体的键把计算链走一遍，再核对节点列表的顺序，比只看"哈希分片"四个字有用得多。

原课：[P176–180](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=176)。函数核对用的是 [Mycat 1.6.7.4 固定提交](https://github.com/MyCATApache/Mycat-Server/tree/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function)，和课程的 1.6.7.3 有版本差异，不能据此推断全部行为完全一样。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-31) · [下一篇](/posts/mysql-heima-33)
