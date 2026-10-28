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

索引有没有用，看查询能不能在索引顺序里划出一个较小的范围。联合索引 `(profession,age,status)` 先按专业排，同一专业再按年龄排，同一年龄再按状态排。最左前缀说的就是这个顺序，跟 SQL 里条件写的先后无关。

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

这是演示机制用的。表很小，优化器可能直接全扫，EXPLAIN 不一定每次都出现固定的 key。“能不能划出范围”和“实际选了什么”要分开看。

## 最左前缀是索引中的列前缀

```sql
EXPLAIN SELECT id FROM index_user
WHERE profession='软件工程' AND age=31 AND status='0';
```

可以依次限定专业、年龄和状态，目标是 id 2。WHERE 改写成 `status='0' AND age=31 AND profession='软件工程'`，效果一样。

| 条件 | 对上述索引的通常理解 |
| --- | --- |
| profession 等值 | 可定位到该专业范围 |
| profession、age 等值 | 可进一步定位到该专业的指定年龄 |
| profession、age、status 等值 | 可进一步限定状态 |
| profession、status 等值，跳过 age | 能按专业定位；状态一般作为后续过滤，不能假装年龄不存在 |
| 只有 age 或 status | 缺少连续的最左定位条件，普通前缀查找受限 |

“受限”不是索引文件失效了。覆盖扫描、索引条件下推，以及特定条件下的 skip scan 等策略，还是可能用到这棵索引。看 EXPLAIN 时要问“拿它做了什么”，别只问“用没用”。

把示例里“软件工程”这段索引记录按联合键写出来，就能看到顺序是怎么形成的：

```text
(软件工程, 30, 0, 主键1)
(软件工程, 31, 0, 主键2)
(软件工程, 31, 1, 主键3)
```

先固定 profession，进入这段连续的范围；再固定 age=31，排除前面 30 岁的记录；再固定 status=0，只剩主键 2。每多一个连续的等值条件，就沿着原有排序把范围再缩小一步。

只给 `age=31` 的话，不同专业下都可能有 31 岁的人。索引先按专业组织，全部 31 岁的记录并不在一个连续的位置。没有 profession 的值，常规的前缀定位就不知道从哪个专业范围开始；就算优化器用了别的策略，代价也和三列连续定位不是一回事。

跳过中间列也是同样的原因。`profession='软件工程' AND status='0'` 里，30 岁的状态 0 和 31 岁的状态 0 分属不同的年龄段，中间可能夹着其他状态的记录。数据库能先用专业缩小范围，再筛状态，但不能把索引当成直接按“专业、状态”排列的。

## 范围条件之后的列为何难以继续缩小范围

```sql
EXPLAIN SELECT id FROM index_user
WHERE profession='软件工程' AND age>30 AND status='0';
```

age>30 包含很多个年龄，每个年龄内部有自己的状态顺序，所以 status=0 的记录可能分散在好几个位置，不能简单当成一个更短的连续区间。后面的 status 仍可能用来过滤或覆盖，只是不能照搬前面全等值查询的推导。

`>` 改成 `>=` 有时会影响边界的构造和 key_len，但两者意思不同；别为了“多用一个索引列”就擅自改查询含义，而且也不能保证 >= 后面的所有列都完整参与定位。准确分析要结合实际边界、执行计划和索引条件。[多列范围优化](https://dev.mysql.com/doc/refman/8.0/en/range-optimization.html)。

## 对列做变换，可能失去原索引顺序

```sql
EXPLAIN SELECT id FROM index_user WHERE phone='17799990001';
EXPLAIN SELECT id FROM index_user WHERE SUBSTRING(phone,10,2)='01';
```

手机号索引按完整字符串排序，不按末两位排序。对每行先截取再比较，一般没法直接用原索引缩小后缀范围。这要是高频需求，可以另外设计生成列或函数索引等方案，但业务和维护成本要单独评估。

字符串列要用类型匹配的参数：`phone='17799990001'`。写成数字 `phone=17799990001` 可能触发列值的数值转换，既可能改变索引访问，也可能把不同的字符串当成同一个数字。应用里的参数类型也要和字段类型一致。

`LIKE '软件%'` 给了确定的开头，适合尝试前缀范围；`LIKE '%工程'` 没有确定的开头，一般没法用完整字符串的 B+ 树做同样的范围定位。但它仍可能选择扫描覆盖索引，别把所有 `%开头` 的情况都说成物理上绝对不用索引。

类型转换不光影响访问方式，还可能改变比较结果。手机号要按字符标识比较，按数值比较的话，前导零这类字符串差异就没意义了。数据库列定义成 VARCHAR，应用却绑定成数字参数，“同一个号码字符串”的问题就变成了“转换后是同一个数值”。先保证结果对，再讨论走不走索引。

LIKE 的前缀规则也来自排序。知道 `'软件%'`，就可以从以“软件”开头的那段键开始，一直扫到不再匹配这个前缀；只知道后缀 `'%工程'` 时，软件工程、通信工程可能散在不同开头的区间，没有这么直接的起点。所以通配符的位置影响的是能不能形成有效边界，不是 LIKE 这个关键字天生用不了索引。

## OR、NULL 与数据分布

```sql
EXPLAIN SELECT * FROM index_user WHERE id=1 OR age=31;
```

就算 id 有索引，age 那个分支还是可能要检查大量记录，优化器可能选择全扫。给 age 建了索引也只是多一条可选路径：MySQL 有时用 Index Merge 合并多棵索引，有时还是全扫，不是“OR 两边都有索引就一定快”。

`IS NULL`、`IS NOT NULL` 也不是固定的索引开关。只有极少数行是空的，找空值可能很适合走索引；几乎整张表都是空的，扫索引再回表可能更贵。同样的 SQL，数据分布变了，计划也可以变。

所以性别、状态这类低基数字段，也不是永远不能建索引。某个稀有状态、高频的组合条件、ORDER BY LIMIT，都可能让它有用。设计索引要从实际查询出发，别等表达到某个固定的百万行门槛才考虑。

## 覆盖索引与索引条件下推

```sql
EXPLAIN SELECT id,profession,age,status FROM index_user
WHERE profession='软件工程' AND age>=31;
```

需要的列都在联合索引和它携带的主键里，有机会直接返回。再加一个 name，就可能要回表。

Extra 里：

- `Using index`：通常表示覆盖访问
- `Using index condition`：索引条件下推（ICP），先在索引记录上检查能判断的条件，符合了才读完整行，减少不必要的回表

ICP 本身就是一种优化，别把它当成“性能差”的同义词。Extra 为空，也不能单独证明有没有回表、性能好不好。[ICP 机制](https://dev.mysql.com/doc/refman/8.0/en/index-condition-pushdown-optimization.html)。

覆盖和 ICP 作用在不同阶段，拿一次要查 name 的查询对照一下。联合索引里有 profession、age、status，没有 name。数据库先用可用的边界进入候选段，接着如果能在索引记录里判断 status，就先把状态不符的候选过滤掉，只拿剩下的主键回表取 name。ICP 省回表就省在这里。

如果查询本来只要 id、profession、age、status，整个输出从索引里就能拿到，那是覆盖访问，别和“先筛选再回表”混成一个术语。两者都可能减少读取，但省的是不同的步骤。

## 前缀索引节省空间，但要验证完整值

```sql
SELECT COUNT(DISTINCT email)/COUNT(*) AS full_selectivity,
       COUNT(DISTINCT LEFT(email,5))/COUNT(*) AS prefix_selectivity
FROM index_user;
CREATE INDEX idx_email_prefix ON index_user(email(5));
SHOW INDEX FROM index_user;
```

这个比值是用来比较完整值和前缀的区分度的，不是耗时预测。索引只存前五个字符，碰到前缀相同的候选还得检查完整的 email。前缀索引靠前五个字符覆盖不了“返回完整 email”的需求，也解决不了任意位置的正文关键词搜索；全文搜索要考虑专门的索引和检索方式。

前缀取多长，要结合实际的碰撞情况判断。两条 email 前五个字符相同，前缀索引只能把它们一起列为候选，光凭前缀不知道哪一条完整地址等于目标值。前缀越短，单个索引项通常越小，但同前缀的候选可能越多；前缀越长，区分度可能越高，空间上的收益又会减少。

算完整值和前缀的 distinct 比例，只是在比较区分度。现在这四行数据里五字符前缀全都不同，也不能保证真实的百万行数据一样没有碰撞。最后要在有代表性的地址分布上看候选数量和回表成本，别凭极小的样本定一个“最佳长度”。

## 提示和联合索引也有成本

```sql
EXPLAIN SELECT id FROM index_user USE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
EXPLAIN SELECT id FROM index_user IGNORE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
EXPLAIN SELECT id FROM index_user FORCE INDEX(idx_pro_age_status)
WHERE profession='软件工程';
```

- USE：限定考虑哪些索引，仍然允许全扫
- IGNORE：排除指定的索引
- FORCE：大幅抬高全扫的成本，但不能让一个不适用的索引凭空满足任何查询

提示要在有代表性的数据上和计划、耗时一起验证，数据变了之后反而可能有害。

联合索引能服务一组常见查询，还有机会覆盖返回列，但别把所有字段都塞进同一棵树。长列会增加空间和写入维护的成本；按唯一手机号本来就只查一行，为了省一次回表再加姓名甚至密码字段，不一定值得。索引约束要符合真实的唯一性，别因为当前样例没有重复就建一个错误的 UNIQUE。


---

[课程目录](/posts/mysql-heima) · [上一篇](/posts/mysql-heima-13) · [下一篇](/posts/mysql-heima-15)
