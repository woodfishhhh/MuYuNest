---
title: "MySQL（15）：排序、分组、分页与计数优化"
date: 2026-10-17 00:00:00
slug: mysql-heima-15
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

筛选条件只决定哪些行符合要求，ORDER BY、GROUP BY、LIMIT 和 COUNT 还决定结果如何组织。索引的有序性可以省掉部分工作，但每种操作需要的顺序并不相同。

## 索引顺序是否满足排序

沿用 emp，建立年龄与入职日期的索引：

```sql
CREATE INDEX idx_emp_age_entry ON emp(age,entry_date);
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age,entry_date;
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age DESC,entry_date DESC;
```

索引正向顺序符合第一句，反向扫描有机会符合第二句。把排序改成 `ORDER BY entry_date,age`，不再等同于索引中的排列。

混合方向需要匹配的索引方向，例如 MySQL 8.0 支持：

```sql
CREATE INDEX idx_emp_age_entry_mixed ON emp(age ASC,entry_date DESC);
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age ASC,entry_date DESC;
```

Extra 中 Using filesort 表示需要额外排序，不代表一定使用了磁盘文件；排序可能完全在内存完成。Using index 表示覆盖读取，也不是“无需排序”的同义词：同一个计划可以同时显示 Using index 与 Using filesort。

覆盖访问通常降低按索引读取的成本，但不回表不是利用索引排序的必需条件。是否选择索引还取决于返回行数、LIMIT、回表成本和数据分布。[排序优化说明](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html)。

若额外排序确实成为瓶颈，先减少输入行数与不需要的宽列，再评估 sort_buffer_size 等参数。排序缓冲可能由多个连接各自使用，不能仅凭某次排序慢就全局大幅调高。

为什么同向降序可以反向扫描，而混合方向需要额外考虑？假设索引先按年龄升序，同龄人再按入职日期升序。反过来读整段索引时，年龄变成降序，同龄组内部的日期也同时反转成降序。它无法只把外层年龄反转，却自动保持组内日期仍升序。混合方向需要与之匹配的索引定义，或增加排序处理。

filesort 的工作也不只是“把整行都搬到磁盘排序”。可以先理解两种取数据的思路：一种在排序项中保留排序键和行定位信息，排好后再取得所需行；另一种把需要返回的其他字段也放进排序项，排完就能输出更多信息。前者可能增加后续取行，后者的排序项更宽。实际采用哪种方式及是否写临时文件，要看版本、行宽、参数和计划，不能只看名称里的 file。

因此 `SELECT *` 对排序的影响并非抽象的“写法不好”。返回不需要的大字段，可能使排序项或后续取行更昂贵；只选择页面实际需要的列，才有机会减少搬运的数据。是否改善仍需在相同结果需求下验证，不能偷偷少返回业务必需字段来制造更快的数字。

## 分组也能利用相邻键

```sql
CREATE INDEX idx_emp_dept_age ON emp(dept_id,age);
EXPLAIN SELECT dept_id,COUNT(*) FROM emp GROUP BY dept_id;
EXPLAIN SELECT age,COUNT(*) FROM emp WHERE dept_id=1 GROUP BY age;
```

同部门记录在索引中相邻。第二句先固定 dept_id=1，这个范围内部再按 age 排列，因此有机会帮助按年龄分组。只按 age 分组却不限定部门，年龄会分散在不同部门段中，不能沿用相同结论。

聚合算法由实际查询决定，有索引不意味着所有 GROUP BY 都不需要临时结构。Extra 出现 Using temporary 时，要结合数据规模和执行时间判断，而不是把它一律判为错误。GROUP BY 也不保证输出排序，展示时仍需显式 ORDER BY。

## 大偏移分页为什么慢

```sql
SELECT id,name,entry_date FROM emp
ORDER BY entry_date,id LIMIT 1000000,10;
```

语义是跳过前一百万条，取后十条。即使存在合适顺序索引，也常需要走过前面那些条目；若没有合适顺序，还可能需要额外排序。慢的原因不能一律归结为“必须排序前一百万行”。本地只有 8 行时自然返回空，性能实验需要另备有代表性的大表。

对于宽行，可先用较窄的覆盖索引定位目标主键，再读取少量完整记录：

```sql
CREATE INDEX idx_emp_entry ON emp(entry_date);
SELECT e.id,e.name,e.entry_date
FROM emp AS e
JOIN (
  SELECT id,entry_date FROM emp
  ORDER BY entry_date,id LIMIT 3,3
) AS page ON page.id=e.id
ORDER BY page.entry_date,page.id;
```

子查询按日期顺序跳过 id 4、5、6，选择 id 8、1、2，外层再取对应信息。外层仍写 ORDER BY，因为 JOIN 不保证保留派生表的展示顺序。这能减少提前读取宽行的成本，但没有消除大 offset 本身的扫描成本。

若产品只需要连续翻页，可以用上一页最后一条的排序键作为游标：

```sql
SELECT id,name,entry_date FROM emp
WHERE entry_date>'2006-01-01'
   OR (entry_date='2006-01-01' AND id>6)
ORDER BY entry_date,id LIMIT 3;
```

返回 id 8、1、2。这里日期和 id 共同保证边界明确。游标分页不适合直接任意跳到第几页；并发插入删除时也要明确列表一致性要求。

把延迟取行的例子拆成两段看：内层只访问足以按日期排序的索引信息，跳过前三个位置后选出 id 8、1、2；外层拿这三个 id 回到 emp，补齐 name 等信息。没有进入这一页的其他员工，就不需要为了这次结果提前读取完整展示字段。

它仍需找到第几页的位置，所以 offset 很大时不会突然变成常量成本。游标分页进一步改变定位方法：已知上一页最后一条是 `2006-01-01,id=6`，下一页只寻找排序键大于这个边界的记录。两个方案解决的成本不同，一个减少宽行读取，一个改变翻页起点的表示方式。

日期相同的情况说明为什么游标不能只保存日期。若上一页最后一条和下一页第一条同日，仅写 `entry_date>'该日期'` 会把后面的同日记录一起跳过；仅写 `>=` 又可能把上一页记录重新带回来。补充 id 后，“日期更晚，或日期相同但 id 更大”才能明确表示排在上一条之后。

## COUNT 先保证统计含义

`COUNT(*)` 数行，`COUNT(1)` 同样统计每一行，因为常量 1 永不为 NULL；`COUNT(id)` 在非空主键下也数行；`COUNT(id_card)` 只数填写了该字段的行。不要为了性能把不同含义的统计互换。

MyISAM 能在特定无条件全表计数中使用维护的行数；InnoDB 需要按当前事务可见性统计，不能只返回一个对所有事务都通用的准确总数。引擎可能选择较小的二级索引扫描，不是必须把所有列都读出。

需要准确总数时优先写含义清晰的 COUNT(*)，再看计划和耗时，不能把 COUNT 字段、主键、1、* 排成适用所有环境的固定速度榜。

对于大型列表，可以考虑不展示精确总页数，或异步生成允许延迟的统计结果。若另外维护计数表或缓存，必须处理事务回滚、重复事件和补偿；“插入就加一、删除就减一”本身不保证一致性。估算行数也应明确是估算，不能冒充准确 COUNT。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-14) · [下一篇](/posts/mysql-heima-16)
