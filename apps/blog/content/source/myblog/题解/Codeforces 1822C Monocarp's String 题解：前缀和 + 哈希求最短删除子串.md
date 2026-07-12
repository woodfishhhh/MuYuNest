---
title: "Codeforces 1822C Monocarp's String 题解：前缀和 + 哈希求最短删除子串"
date: 2025-12-20 12:00:03
tags:
  - "Codeforces 1822C"
  - "前缀和"
  - "哈希表"
  - "字符串"
  - "题解"
categories:
  - "算法题解"
  - "Codeforces"
---


给定一个仅由字符 `a` 和 `b` 组成的字符串 `s`，长度为 `n`。可以删除**一段连续的子串**（可以为空），使得剩余字符串中 `a` 的数量等于 `b` 的数量。求**最少需要删除的字符个数**；如果只能把整个字符串全部删掉才能平衡，输出 `-1`。

**前缀+哈希求最短字段**

## 转化问题：权和模型

将字符 `a` 视为 +1，字符 `b` 视为 -1，可以得到这个字符串的权和 $sum$ = $cnta$ - $cntb$

例如`bbbba`就是-1 -1 -1 -1 1 ，得到权和为 -3

题目的题意：$a的数量$ 需要等于 $b的数量$ ，题意也就可以转化为 删除**一段连续的子串后**最终字符串的**权和为 $0$**

我们定义前缀和数组`pre`

```
pre[0] = 0;
for(int i=1;i<n;i++){
	pre[i] = pre[i-1];
	if(s[i] == 'a') pre[i]++;
	else if(s[i] == 'b')pre[i]--;
}
```

删除子串 `s[l…r]` 后，剩余部分的权和为`sum - (pre[r] - pre[l-1])`

我们希望剩余权和为 0，即：

`sum - (pre[r] - pre[l-1]) = 0`

` pre[r] - pre[l-1] = sum`

问题变成：在 `pre[0…n]` 中找下标对 `(i, j)` 满足 `pre[j] - pre[i] = sum`，并使得 `j - i` 最小。

由此，我们 维护哈希表 `mp[v]` 记录前缀和 `v` 出现的位置。

遍历 `j` 从 `1` 到 `n`：

- 计算 `need = pre[j] - sum`
- 若 `need` 在 `mp` 中存在，则更新最短长度 `ans = min(ans, j - mp[need])`
- 维护 `mp` , 将当前的前缀和`pre[j]` 插入`mp` , 即 `mp[pre[j]] = j`

[D - 计数区间 --- D - Count Interval](https://atcoder.jp/contests/abc233/tasks/abc233_d?lang=en)

[Problem - F - Codeforces](https://codeforces.com/contest/2121/problem/F)
