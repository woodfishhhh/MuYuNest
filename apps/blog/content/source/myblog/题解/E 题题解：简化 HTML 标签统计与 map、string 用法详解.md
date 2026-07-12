---
title: "E 题题解：简化 HTML 标签统计与 map、string 用法详解"
date: 2025-12-20 12:00:03
tags:
  - "题解"
  - "HTML标签统计"
  - "std::map"
  - "string"
  - "C++ STL"
categories:
  - "算法题解"
  - "竞赛训练"
---


by woodfish

> 孩子们，需要承认这题有点小难，难度可能在信息差上，因为可能你们没学到对应知识点，出题人谢罪了orz

给定一段“简化 HTML”字符串，保证：

- 标签名仅含小写字母、数字；
- 只有成对出现的普通标签，无自闭合标签；
- 标签嵌套完全合法，不会出现闭合顺序错误。

要求统计**每种标签名**的出现次数。
注意：

- 一次“出现”指一对开始标签 `<tag>` 和结束标签 `</tag>` 合起来算一次；
- 结果按标签名字典序（ASCII 序）输出，格式为 `标签名=次数`。

本题主要考察`map`和`string`

接下来一步一步来，把这道题涉及的知识点拆成三块讲清楚

### `map` 的键值对特性 & 自动字典序

`std::map<Key, T>` 是 C++ STL 里的**有序关联容器**，底层是一颗**红黑树**。

- 每个节点存 `std::pair<const Key, T>`，也就是常说的“键值对”。
- **键唯一**：同一个 `Key` 只能出现一次，重复插入等价于更新。
- **自动排序**：所有键按 `<` 定义的严格弱序排列。
  对 `字符串string` 来说，`<` 就是**字典序（ASCII 序）**，与题目要求完全一致。

因此只要把“标签名”丢进去当 `Key`，出现次数当 `Value`，遍历 `map` 时就已经天然有序，无需再手写排序。

示例：

```cpp
map<string,int> mp;
mp["banana"] = 3;
mp["apple"]  = 5;
mp["cat"]    = 1;
for (auto &[k,v] : mp)
    cout << k << "=" << v << "\n";
```

输出：

```
apple=5
banana=3
cat=1
```

map是C++的一个容器之一，学习下来可以做非常多的题，记得搜索相关视频去掌握

### 提取标签名字的思路

题目保证：

- 只有成对标签，无自闭合；
- 嵌套合法，不会错位。

于是我们可以**只认开始标签** `<tag>`，忽略结束标签 `</tag>`。
算法流程：

1. 从左到右扫字符串，遇到 `'<'` 就进入“标签模式”。
2. 继续往后读，直到遇见 `'>'`，中间那段字符就是标签名。
3. 如果标签名第一个字符不是 `'/'`，说明是开始标签，计数器加一。

```cpp
for (int i = 0; i < s.size(); ++i) {
    if (s[i] == '<') {          // 1. 发现标签开头
        string tag;
        ++i;                    // 跳过 '<'
        while (s[i] != '>') {   // 2. 收集标签名
            tag += s[i++];
        }
        if (tag[0] != '/') {    // 3. 只统计开始标签
            mp[tag]++;          // map 自动完成“插入或递增”
        }
    }
}
```

- 时间 $O(|S|)$，每个字符最多访问两次。
- 空间 $O(K)$，$K$ 为不同标签种数。

### 用“类 lambda”语法输出 map

C++11 起提供了**范围 for 循环** + **结构化绑定**（C++17）的写法，看起来很像 lambda 的简洁风格

Python选手应该对这个很熟悉

```cpp
for (auto [name, cnt] : mp)          // 结构化绑定，name 是键，cnt 是值
    cout << name << "=" << cnt << "\n";
```

等价于：

```cpp
for (map<string,int>::iterator it = mp.begin(); it != mp.end(); ++it)
    cout << it->first << "=" << it->second << "\n";
```

但前者更短、更易读，也符合“现代 C++”的审美

综上，可以给出AC代码：

```cpp
// 万能头，竞赛常用，一把梭包含几乎所有 STL
#include <bits/stdc++.h>

// 开 O2/O3 优化，提交时让代码跑得更快
#pragma GCC optimize(2)
#pragma GCC optimize(3)

// 把 int 直接 define 成 long long，防止忘写 long long 被卡范围,但是这是坏习惯，不要学
#define int long long

using namespace std;   // 使用标准命名空间

void solve()
{
    string s;
    cin >> s;               // 1. 读入整行 HTML 字符串

    map<string, int> mp;    // 2. 用 map 存“标签名 -> 出现次数”，自动字典序

    // 3. 从头到尾扫一遍字符串
    for (int i = 0; i < (int)s.size(); ++i) {
        if (s[i] == '<') {  // 3.1 遇到标签开头
            string ta = ""; // 准备收集标签名
            ++i;            // 跳过 '<'

            // 3.2 一直读到 '>' 为止，中间就是标签名
            while (s[i] != '>') {
                ta += s[i++];
            }

            // 3.3 如果第一个字符不是 '/'，说明是开始标签 <tag>
            if (ta[0] != '/') {
                mp[ta]++;   // 出现次数 +1（map 会自动初始化 0 再自增）
            }
            // 否则是结束标签 </tag>，直接忽略（题目保证成对合法）
        }
    }

    // 4. map 已经按标签名字典序排好，直接输出
    for (auto v : mp) {    // v 就是 pair<const string, int>
        cout << v.first << "=" << v.second << '\n';
    }
}

signed main()   // 用 signed 是为了兼容 #define int long long
{
    // 关闭同步，解除 tie，让 cin/cout 提速，竞赛常用
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    cout.tie(nullptr);

    solve();    // 跑核心逻辑
    return 0;   // 好习惯
}
```
