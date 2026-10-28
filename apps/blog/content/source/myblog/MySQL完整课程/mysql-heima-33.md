---
title: "MySQL（33）：按天与按月分片"
date: 2026-10-17 00:00:00
slug: mysql-heima-33
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

日志和订单经常按时间查。把相邻时间的数据放在相邻的分片，查询时可以先按时间范围缩小目标节点。课程讲了按固定天数、按自然月两种规则；设了结束日期，它们还能循环使用已有的分片。

"循环"只改变新记录的路由，不会删旧记录。1 月和 4 月进同一个节点，意思是两个月的数据共存，不是 4 月覆盖 1 月。

## 每十天一个分片

在一个已经有三个 dataNode 的逻辑库里，加一张独立的测试表：

```xml
<table name="tb_date_part" dataNode="dn1,dn2,dn3" rule="date-ten-days" />
```

在 `rule.xml` 里加：

```xml
<tableRule name="date-ten-days">
  <rule>
    <columns>create_time</columns>
    <algorithm>date-ten-days-fn</algorithm>
  </rule>
</tableRule>
<function name="date-ten-days-fn" class="io.mycat.route.function.PartitionByDate">
  <property name="dateFormat">yyyy-MM-dd</property>
  <property name="sBeginDate">2022-01-01</property>
  <property name="sEndDate">2022-01-30</property>
  <property name="sPartionDay">10</property>
</function>
```

`sPartionDay` 这个拼写就是这个实现的属性名，别自作主张改成更像英语的 `sPartitionDay`。从 1 月 1 日开始，每十天加一个分片下标，1 月 30 日算在最后一段里，所以一共要三片。

| 日期范围 | 计算出来的节点下标 |
| --- | --- |
| 1 月 1 日至 1 月 10 日 | 0 |
| 1 月 11 日至 1 月 20 日 | 1 |
| 1 月 21 日至 1 月 30 日 | 2 |
| 1 月 31 日至 2 月 9 日 | 重新回到 0 |

通过 Mycat 建测试表，插入边界值：

```sql
CREATE TABLE tb_date_part (
  id BIGINT NOT NULL PRIMARY KEY,
  create_time DATE NOT NULL
) ENGINE=InnoDB;
INSERT INTO tb_date_part VALUES (1,'2022-01-01');
INSERT INTO tb_date_part VALUES (2,'2022-01-10');
INSERT INTO tb_date_part VALUES (3,'2022-01-11');
INSERT INTO tb_date_part VALUES (4,'2022-01-20');
INSERT INTO tb_date_part VALUES (5,'2022-01-21');
INSERT INTO tb_date_part VALUES (6,'2022-01-30');
INSERT INTO tb_date_part VALUES (7,'2022-01-31');
```

预期 dn1 有 ID 1、2、7，dn2 有 3、4，dn3 有 5、6。要逐个直连后端去查，才能验证循环和端点对不对。通过代理统一查只能证明读得到，证明不了记录放对了节点。

这个例子只覆盖不早于开始日期的 `DATE` 值。这个旧实现是拿毫秒时间差除以一天的固定长度，日期解析用的是 Java 的日期处理；带时区、夏令时或者格式不统一的输入要单独验证，别把本例直接推广到任意时间戳分片。

1 月 31 日为什么回到第一片？分两步算：离 1 月 1 日差 30 天，每 10 天一片，循环前的下标是 `30/10=3`；一共只有 3 片，循环后 `3%3=0`。1 月 30 日差 29 天，整数分段得 2，还在第三片。

关键是离开始日期差了多少天，不是日期最后两位除以 10。到了 2 月，"几号"会从 1 重新算，但从起点累计的天数不会重置，所以不能用 DAY(create_time) 代替这套跨月的周期规则。

## 每个自然月一个分片

按月不等于每 30 天。2 月不到 31 天，但也算一个完整的月。函数按年月差计算分片：

```xml
<tableRule name="date-month">
  <rule>
    <columns>create_time</columns>
    <algorithm>date-month-fn</algorithm>
  </rule>
</tableRule>
<function name="date-month-fn" class="io.mycat.route.function.PartitionByMonth">
  <property name="dateFormat">yyyy-MM-dd</property>
  <property name="sBeginDate">2022-01-01</property>
  <property name="sEndDate">2022-03-31</property>
</function>
```

在逻辑库里加 `tb_month_part`，指定 `dataNode="dn1,dn2,dn3"`、`rule="date-month"`；表结构和上面一样两列，换个独立的表名。插入 1 月 10 日、2 月 20 日、3 月 31 日、4 月 1 日、6 月 1 日，预期依次进下标 0、1、2、0、2。

配置里的 1 月到 3 月决定了三个分片。把结束日期改成 12 月 31 日，就意味着要十二个月对应的分片；还是只给三个节点的话，就不是正常的三节点循环配置了。课程实际演示了这种不匹配会导致启动失败。

两种规则都要让算法算出来的分片数和表的节点列表对上。别为了消掉启动错误就随便加重复的节点名，那只是掩盖了时间范围和物理布局之间的矛盾。

按月的完整测试，接在对应逻辑表配置生效之后：

```xml
<table name="tb_month_part" dataNode="dn1,dn2,dn3" rule="date-month" />
```

```sql
CREATE TABLE tb_month_part(id BIGINT PRIMARY KEY,create_time DATE NOT NULL) ENGINE=InnoDB;
INSERT INTO tb_month_part VALUES(1,'2022-01-10');
INSERT INTO tb_month_part VALUES(2,'2022-02-20');
INSERT INTO tb_month_part VALUES(3,'2022-03-31');
INSERT INTO tb_month_part VALUES(4,'2022-04-01');
INSERT INTO tb_month_part VALUES(5,'2022-06-01');
```

1 月到 6 月的月份偏移量从 0 往上加，按三片循环，所以这五条预期在 dn1、dn2、dn3、dn1、dn3。注意 3 月 31 日和 4 月 1 日：只差一天，却跨过了自然月边界，后者进入下一轮；按十天分片用的是另一套边界，两种算法回答的是不同的存放规则。

别把 sEndDate 当成数据有效期的限制。设成 3 月 31 日，在这个循环配置里表示一轮有几个月，不会因为 4 月 1 日超过了它就拒绝写入。业务上不允许未来日期，要用单独的数据校验来做，不是去误用分片终点。

## 查询命中时间范围，不代表没有其他成本

按月分片能让"查某个月的订单"少访问几个节点，但最新的月份可能扛下全部写入，跨全年的查询也可能扫遍所有节点。按时间分片值不值，看查询和数据生命周期是不是匹配，不是说日期字段天生比 ID 更适合分片。

原课：[P181–182](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=181)。实现核对见固定版本的 [PartitionByDate](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function/PartitionByDate.java) 与 [PartitionByMonth](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function/PartitionByMonth.java)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-32) · [下一篇](/posts/mysql-heima-34)
