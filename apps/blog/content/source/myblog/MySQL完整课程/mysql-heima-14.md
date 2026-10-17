---
title: "MySQL（14）：联合索引与查询条件"
date: 2026-10-17 00:00:00
slug: mysql-heima-14
type: article
categories:
  - 数据库
  - MySQL完整课程
tags:
  - MySQL
  - SQL
  - 课程笔记
---

索引是否有用，取决于查询能否在索引顺序中划出较小的范围。联合索引 `(profession,age,status)` 先按专业排序，同一专业再按年龄，同一年龄再按状态。最左前缀来自这个顺序，而不是 SQL 文本里条件的排列位置。

## 准备专门的索引实验表

```sql
CREATE TABLE index_user (
  id INT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  profession VARCHAR(30),
  age INT,
  status CHAR(1),
  UNIQUE KEY uk_index_phone(phone),
  KEY idx_pro_age_status(profession,age,status)
) ENGINE=InnoDB;
INSERT INTO index_user VALUES
  (1,'白起','17799990001','baiqi@example.test','软件工程',30,'0'),
  (2,'韩信','17799990002','hanxin@example.test','软件工程',31,'0'),
  (3,'大乔','17799990003','daqiao@example.test','软件工程',31,'1'),
  (4,'曹操','17799990004','caocao@example.test','通信工程',31,'0');
```

这是机制示例，小表优化器可能选择全扫，不要求每条 EXPLAIN 都出现固定的 key。判断范围能力与观察实际选择要分开。

## 最左前缀是索引中的列前缀

```sql
EXPLAIN SELECT id FROM index_user
WHERE profession='软件工程' AND age=31 AND status='0';
```

可以依次限定专业、年龄和状态，目标为 id 2。把 WHERE 改写为 `status='0' AND age=31 AND profession='软件工程'` 不改变这种能力。

| 条件 | 对上述索引的通常理解 |
| --- | --- |
| profession 等值 | 可定位到该专业范围 |
| profession、age 等值 | 可进一步定位到该专业的指定年龄 |
| profession、age、status 等值 | 可进一步限定状态 |
| profession、status 等值，跳过 age | 能按专业定位；状态一般作为后续过滤，不能假装年龄不存在 |
| 只有 age 或 status | 缺少连续的最左定位条件，普通前缀查找受限 |

“受限”不等于索引文件失效。覆盖扫描、索引条件下推以及特定条件下的 skip scan 等策略，仍可能使用这棵索引。看 EXPLAIN 时要问“用了它做什么”，而非只问“有没有用”。

把示例中“软件工程”这一段索引记录按联合键写出来，就能看到顺序如何形成：

```text
(软件工程, 30, 0, 主键1)
(软件工程, 31, 0, 主键2)
(软件工程, 31, 1, 主键3)
```

先固定 profession，能进入这段连续范围；再固定 age=31，把前面的 30 岁记录排除；再固定 status=0，只保留主键 2。每增加一个连续的等值条件，都沿原有排序进一步缩小范围。

如果只给 `age=31`，不同专业下都可能有 31 岁的人。索引首先按专业组织，它并没有把全体 31 岁记录统一放在一个连续位置。缺少 profession 的值，常规前缀定位就不知道从哪个专业范围开始；即使优化器采用其他策略，代价与三列连续定位也不是一回事。

跳过中间列时也是同一个原因。`profession='软件工程' AND status='0'` 中，30 岁的状态 0 和 31 岁的状态 0 分属不同年龄段；中间可能夹着其他状态的记录。数据库可以利用专业先缩小范围，再筛状态，但不能当作索引直接按“专业、状态”排列。

## 范围条件之后的列为何难以继续缩小范围

```sql
EXPLAIN SELECT id FROM index_user
WHERE profession='软件工程' AND age>30 AND status='0';
```

age>30 包含许多年龄。每个年龄内部都有自己的状态顺序，因此 status=0 的记录可能分布在多个位置，不能简单当成一个更短的连续区间。后续状态仍可能用于过滤或覆盖，只是不能沿用前面全等值查询的推导。

`>` 改成 `>=` 有时影响边界构造和 key_len，但两者语义不同；不能为了“多用一个索引列”擅自改变查询含义，也不能保证 >= 之后的所有列都完整参与定位。准确分析应结合实际边界、执行计划和索引条件。[多列范围优化](https://dev.mysql.com/doc/refman/8.0/en/range-optimization.html)。

## 对列做变换，可能失去原索引顺序

```sql
EXPLAIN SELECT id FROM index_user WHERE phone='17799990001';
EXPLAIN SELECT id FROM index_user WHERE SUBSTRING(phone,10,2)='01';
```

完整手机号索引按完整字符串排序，不按末两位排序。对每行先截取再比较，通常不能直接利用原索引缩小后缀范围。若这是高频需求，可以另外设计生成列或函数索引等方案，但要单独评估业务和维护成本。

字符串列应使用匹配类型的参数：`phone='17799990001'`。写成数字 `phone=17799990001` 可能触发列值数值转换，既可能改变索引访问，也可能把不同字符串当作同一个数字。应用参数类型与字段类型同样需要一致。

`LIKE '软件%'` 给出已知开头，适合尝试前缀范围；`LIKE '%工程'` 没有确定开头，通常无法利用完整字符串 B+ 树做同样的范围定位。它仍可能选择扫描覆盖索引，不应把所有 `%开头` 情况都描述成物理上绝不使用索引。

类型转换除了影响访问方式，还可能改变比较结果。手机号应按字符标识比较，而数值比较会让前导零等字符串差异失去意义。把数据库列定义为 VARCHAR，应用却绑定成数字参数，就把“同一个号码字符串”变成了“转换后同一个数值”的问题。先让语义正确，再讨论是否走索引。

LIKE 的前缀规则也来自排序。已知 `'软件%'`，可以尝试从以“软件”开头的一段键开始，直到不再匹配这个前缀；只知道后缀 `'%工程'` 时，软件工程、通信工程可能散落在不同开头的区间，没有同样直接的起点。因此“通配符在哪”影响的是能否形成有效边界，不是 LIKE 这个关键字天生禁用索引。

## OR、NULL 与数据分布

```sql
EXPLAIN SELECT * FROM index_user WHERE id=1 OR age=31;
```

即使 id 有索引，age 分支仍可能需要检查大量记录，优化器可能选择全扫。给 age 建索引后，也只是增加可选路径；MySQL 有时使用 Index Merge 合并多棵索引，有时仍选择全扫，并非“OR 两侧有索引就必然快”。

`IS NULL`、`IS NOT NULL` 也不是固定的索引开关。若只有极少数行为空，找空值可能很适合索引；若几乎全表为空，扫描索引再回表可能更贵。查询同样的 SQL，数据分布改变后，计划可以改变。

因此，性别、状态这类低基数字段不一定永远不能索引。某个稀有状态、高频组合条件和 ORDER BY LIMIT 都可能使它有用。索引设计应从实际查询出发，而不是等表达到某个固定百万行门槛。

## 覆盖索引与索引条件下推

```sql
EXPLAIN SELECT id,profession,age,status FROM index_user
WHERE profession='软件工程' AND age>=31;
```

需要的列都在联合索引及其携带的主键中，有机会直接返回。再增加 name，就可能需要回表。

Extra 中 `Using index` 通常表示覆盖访问；`Using index condition` 表示索引条件下推（ICP）：先在索引记录上检查能判断的条件，符合后才读取完整行，从而减少不必要回表。ICP 本身是优化，不能把它当成“性能差”的同义词；Extra 为空也不能单独证明回表或性能优劣。[ICP 机制](https://dev.mysql.com/doc/refman/8.0/en/index-condition-pushdown-optimization.html)。

覆盖与 ICP 处理的阶段不同，可以对照一次需要 name 的查询理解。联合索引中已有 profession、age、status，但没有 name。数据库先利用可用边界进入候选段，随后若能在索引记录中判断 status，就先过滤掉不符合状态的候选，只对剩下的主键回表取 name。这是 ICP 节省回表的地方。

若查询本来只需要 id、profession、age、status，整个输出已经可以从索引得到，那是覆盖访问。它与“先筛选再回表”不应混成同一个术语。二者都可能减少读取，但减少的是不同步骤。

## 前缀索引节省空间，但要验证完整值

```sql
SELECT COUNT(DISTINCT email)/COUNT(*) AS full_selectivity,
       COUNT(DISTINCT LEFT(email,5))/COUNT(*) AS prefix_selectivity
FROM index_user;
CREATE INDEX idx_email_prefix ON index_user(email(5));
SHOW INDEX FROM index_user;
```

这个比值用于比较完整值和前缀的区分能力，不是耗时预测。索引只存前五个字符，遇到同前缀的候选仍需检查完整 email。前缀索引不能靠前五个字符覆盖“返回完整 email”的需求，也不解决任意位置的正文关键词搜索；全文搜索应考虑专门索引与检索语义。

前缀长度应结合实际碰撞情况判断。若两条 email 的前五个字符相同，前缀索引只能把它们一起列为候选，无法只凭前缀知道哪一条完整地址等于目标值。前缀越短，单个索引项通常越小，但同前缀候选可能越多；前缀越长，区分度可能提高，空间收益又会减少。

计算完整值和前缀的 distinct 比例，只是在比较区分能力。当前四行数据中，即使五字符前缀完全不同，也不能保证真实百万行数据同样没有碰撞。最终应在有代表性的地址分布上看候选数量及回表成本，不根据极小样本固定一个“最佳长度”。

## 提示和联合索引也有成本

```sql
EXPLAIN SELECT id FROM index_user USE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
EXPLAIN SELECT id FROM index_user IGNORE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
EXPLAIN SELECT id FROM index_user FORCE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
```

USE 限定考虑的索引集合，仍允许全扫；IGNORE 排除指定索引；FORCE 强烈抬高全扫成本，但无法让一个不适用的索引凭空满足任何查询。提示需要与代表性数据上的计划、耗时一起验证，数据变化后可能反而有害。

联合索引可服务一组常见查询，并有机会覆盖返回列，但不是所有字段都应塞进同一棵树。长列会增加空间和写入维护；按唯一手机号已经只查一行时，为省一次回表再加姓名甚至密码字段，未必值得。索引约束应符合真实唯一性，不要因为当前样例没有重复就创建错误的 UNIQUE。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-13) · [下一篇](/posts/mysql-heima-15)
