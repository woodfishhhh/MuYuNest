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

筛选条件只决定哪些行符合要求，ORDER BY、GROUP BY、LIMIT、COUNT 还决定结果怎么组织。索引有序能省掉一部分工作，但每种操作需要的顺序不一样。

## 索引顺序是否满足排序

沿用 emp，建一个年龄加入职日期的索引：

```sql
CREATE INDEX idx_emp_age_entry ON emp(age,entry_date);
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age,entry_date;
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age DESC,entry_date DESC;
```

正向读索引符合第一句，反向扫描有机会符合第二句。排序改成 `ORDER BY entry_date,age`，就跟索引里的排列对不上了。

混合方向要有方向匹配的索引，比如 MySQL 8.0 支持：

```sql
CREATE INDEX idx_emp_age_entry_mixed ON emp(age ASC,entry_date DESC);
EXPLAIN SELECT id,age,entry_date FROM emp ORDER BY age ASC,entry_date DESC;
```

Extra 里的 Using filesort 表示需要额外排序，不一定用了磁盘文件，排序可能全在内存里完成。Using index 表示覆盖读取，跟“不用排序”是两回事：同一个计划可以同时显示 Using index 和 Using filesort。

覆盖访问一般能降低按索引读取的成本，但利用索引排序并不要求一定不回表。选不选索引，还要看返回行数、LIMIT、回表成本和数据分布。[排序优化说明](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html)。

额外排序真成了瓶颈，先减少输入行数和不需要的宽列，再考虑 sort_buffer_size 等参数。排序缓冲可能每个连接各用一份，别因为某次排序慢就全局大幅调高。

为什么同向降序能反向扫描，混合方向就得另外处理？假设索引先按年龄升序，同龄的再按入职日期升序。整段反过来读，年龄变成降序，同龄组里的日期也同时变成降序。没法只把外层的年龄反过来、组内日期还自动保持升序。混合方向要么有匹配的索引定义，要么加一次排序。

filesort 也不只是“把整行都搬到磁盘上排序”。取数据有两种思路：

- 排序项里只放排序键和行定位信息，排好后再去取需要的行：后面可能多出取行操作
- 把要返回的其他字段也放进排序项，排完就能直接输出：排序项更宽

实际用哪种方式、写不写临时文件，要看版本、行宽、参数和计划，不能只看名字里有个 file。

所以 `SELECT *` 对排序的影响是具体的，不只是“写法不好”：返回用不上的大字段，可能让排序项或后面的取行更贵；只选页面实际需要的列，才有机会少搬数据。有没有改善，要在结果需求相同的前提下验证，别偷偷少返回业务必需的字段来做出更快的数字。

## 分组也能利用相邻键

```sql
CREATE INDEX idx_emp_dept_age ON emp(dept_id,age);
EXPLAIN SELECT dept_id,COUNT(*) FROM emp GROUP BY dept_id;
EXPLAIN SELECT age,COUNT(*) FROM emp WHERE dept_id=1 GROUP BY age;
```

同部门的记录在索引里是挨着的。第二句先固定 dept_id=1，这个范围里再按 age 排列，所以有机会帮上按年龄分组。只按 age 分组、不限定部门的话，年龄会分散在不同的部门段里，不能沿用这个结论。

用什么聚合算法由实际查询决定，有索引也不是所有 GROUP BY 都不需要临时结构。Extra 出现 Using temporary 时，要结合数据规模和执行时间判断，别一律当成错误。GROUP BY 也不保证输出有序，展示时还是要显式写 ORDER BY。

## 大偏移分页为什么慢

```sql
SELECT id,name,entry_date FROM emp
ORDER BY entry_date,id LIMIT 1000000,10;
```

意思是跳过前一百万条，取后面十条。就算有顺序合适的索引，也常常要走过前面那些条目；没有合适的顺序，还可能要额外排序。慢的原因不能一律说成“必须把前一百万行排序”。本地只有 8 行，自然返回空，做性能实验要另外准备有代表性的大表。

行比较宽时，可以先用较窄的覆盖索引定位目标主键，再读少量完整记录：

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

子查询按日期顺序跳过 id 4、5、6，选出 id 8、1、2，外层再取对应的信息。外层还要写 ORDER BY，因为 JOIN 不保证保留派生表的展示顺序。这样能减少提前读宽行的成本，但大 offset 本身的扫描成本还在。

产品如果只需要连续翻页，可以用上一页最后一条的排序键当游标：

```sql
SELECT id,name,entry_date FROM emp
WHERE entry_date>'2006-01-01'
   OR (entry_date='2006-01-01' AND id>6)
ORDER BY entry_date,id LIMIT 3;
```

返回 id 8、1、2。日期和 id 一起保证边界明确。游标分页不适合直接跳到任意第几页；有并发插入、删除时，还要明确列表的一致性要求。

把延迟取行的例子拆成两段看：内层只访问够按日期排序的索引信息，跳过前三个位置，选出 id 8、1、2；外层拿这三个 id 回到 emp，补齐 name 等信息。没进这一页的其他员工，就不用为这次结果提前读完整的展示字段。

它还是要找到第几页的位置，所以 offset 很大时成本不会突然变成常量。游标分页换了定位方法：已知上一页最后一条是 `2006-01-01,id=6`，下一页只找排序键大于这个边界的记录。两个方案省的成本不一样：一个减少宽行读取，一个换了翻页起点的表示方式。

游标不能只存日期，看日期相同的情况就知道：上一页最后一条和下一页第一条是同一天时，只写 `entry_date>'该日期'` 会把后面同一天的记录一起跳过；只写 `>=` 又可能把上一页的记录重新带回来。加上 id，写成“日期更晚，或日期相同但 id 更大”，才能明确表示排在上一条之后。

## COUNT 先保证统计含义

- `COUNT(*)`：数行
- `COUNT(1)`：同样每行都数，因为常量 1 永远不是 NULL
- `COUNT(id)`：主键非空，也是数行
- `COUNT(id_card)`：只数填写了这个字段的行

别为了性能把含义不同的统计互相替换。

MyISAM 在特定的无条件全表计数里能用它维护的行数；InnoDB 要按当前事务的可见性统计，没法只返回一个对所有事务都通用的准确总数。引擎可能选一个较小的二级索引来扫，不一定要把所有列都读出来。

要准确总数，就优先写含义清楚的 COUNT(*)，再看计划和耗时。别把 COUNT 字段、主键、1、* 排成一个适用所有环境的固定速度榜。

大列表可以考虑不显示精确的总页数，或者异步生成允许延迟的统计结果。另外维护计数表或缓存的话，要处理事务回滚、重复事件和补偿，“插入就加一、删除就减一”本身保证不了一致性。估算的行数也要标明是估算，别冒充准确的 COUNT。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-14) · [下一篇](/posts/mysql-heima-16)
