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

日志和订单常按时间查询。把相邻时间的数据放在相邻分片，查询可以先根据时间范围缩小目标节点。课程介绍了按固定天数、按自然月两种规则；设置结束日期后，它们还可以循环使用已有分片。

“循环”只改变新记录的路由，不会删除旧记录。1 月和 4 月进入同一节点，意味着两个月的数据共存，而非 4 月自动覆盖 1 月。

## 每十天一个分片

在一个已经有三个 dataNode 的逻辑库里，添加独立测试表：

```xml
<table name="tb_date_part" dataNode="dn1,dn2,dn3" rule="date-ten-days" />
```

在 `rule.xml` 中加入：

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

`sPartionDay` 的拼写就是这个实现的属性名，不要自行改为英语更自然的 `sPartitionDay`。从 1 月 1 日开始，每十天增加一个分片下标，1 月 30 日包含在最后一段中，因此一共需要三片。

| 日期范围 | 计算出来的节点下标 |
| --- | --- |
| 1 月 1 日至 1 月 10 日 | 0 |
| 1 月 11 日至 1 月 20 日 | 1 |
| 1 月 21 日至 1 月 30 日 | 2 |
| 1 月 31 日至 2 月 9 日 | 重新回到 0 |

通过 Mycat 建测试表并插入边界值：

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

预期 dn1 有 ID 1、2、7，dn2 有 3、4，dn3 有 5、6。逐个直连后端查询，才能验证循环和端点是否符合预期。通过代理统一查询只证明能读到结果，不能证明记录放对了节点。

此例只覆盖不早于开始日期的 `DATE` 值。该旧实现按毫秒时间差除以固定一天的长度，日期解析还使用 Java 的日期处理方式；带时区、夏令时或格式不一致的输入，需要单独验证，不能把本例直接推广为任意时间戳分片规则。

1 月 31 日为什么回到第一片，可以把计算写成两步。从 1 月 1 日起相差 30 天，每 10 天一片，得到未经循环处理的下标 `30/10=3`；一共只有 3 片，循环后 `3%3=0`。1 月 30 日相差 29 天，整数分段得到 2，仍在第三片。

关键在于开始日期相差多少天，而不是日期字符串最后两位除以 10。到了 2 月，日期里的“几号”会重置为 1，但从起点累计的天数不会重置。直接用 DAY(create_time) 不能替代这套跨月份周期规则。

## 每个自然月一个分片

按月不等于每 30 天。2 月天数少于 31 天，但仍然占一个完整月份。函数通过年月差计算分片：

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

在逻辑库中添加 `tb_month_part`，指定 `dataNode="dn1,dn2,dn3"`、`rule="date-month"`；使用与上面相同的两列结构，换成独立表名。插入 1 月 10 日、2 月 20 日、3 月 31 日、4 月 1 日、6 月 1 日，预期依次进入下标 0、1、2、0、2。

配置中的 1 月至 3 月决定三个分片。把结束日期改为 12 月 31 日，就意味着需要十二个月对应的分片；仍然只提供三个节点时，不能把它当作正常的三节点循环配置。课程实际演示了这种不匹配导致启动失败。

这两种规则都应把算法计算的分片数量与表的节点列表对齐。不要为消除启动错误而随意增加重复节点名：那只是掩盖了时间范围与物理布局之间的矛盾。

按月的完整测试可以接在对应逻辑表配置生效之后：

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

1 月到 6 月的月份偏移量依次从 0 增加，循环分三片，所以这五条记录预期在 dn1、dn2、dn3、dn1、dn3。特别比较 3 月 31 日与 4 月 1 日：虽然只差一天，却跨过自然月边界，后者进入下一轮；按十天分片则采用另一套边界，两种算法回答不同的存放规则。

不能把 sEndDate 当成数据有效期限制。设置到 3 月 31 日，在这个循环配置里表示定义一轮的月份数量，并不会因为 4 月 1 日超过它就拒绝记录。若业务不允许未来日期，需要用独立的数据校验表达，而不是误用分片终点。

## 查询命中时间范围，不代表没有其他成本

按月分片可以让“查询某月订单”少访问一些节点，但最新月份仍可能集中承受全部写入。跨全年查询也可能覆盖全部节点。按时间分片的价值来自查询和数据生命周期是否匹配，而不是日期字段天然比 ID 更适合分片。

原课：[P181–182](https://www.bilibili.com/video/BV1Kr4y1i7ru?p=181)。实现核对见固定版本的 [PartitionByDate](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function/PartitionByDate.java) 与 [PartitionByMonth](https://github.com/MyCATApache/Mycat-Server/blob/f929f96a16852869bc9dc63f4c0f192ee02818e0/src/main/java/io/mycat/route/function/PartitionByMonth.java)。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-32) · [下一篇](/posts/mysql-heima-34)
