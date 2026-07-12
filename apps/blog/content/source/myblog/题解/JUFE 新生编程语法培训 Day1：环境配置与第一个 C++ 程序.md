---
title: "JUFE 新生编程语法培训 Day1：环境配置与第一个 C++ 程序"
date: 2025-12-20 12:00:03
tags:
  - "C++入门"
  - "CodeBlocks"
  - "VSCode配置"
  - "新生培训"
  - "开发环境"
categories:
  - "培训讲义"
  - "编程入门"
---


by woodfish

## 一、课前准备

1. **软件准备**：
   - 下载 Code::Blocks 安装包（带 MinGW 的版本）：
   - 安装包在群文件
   - **要学会使用CB，因为蓝桥杯机房里大概率得用Code::Blocks**

---

## 二、教学流程

### 安装开发工具：Code::Blocks

#### 1. 什么是 IDE？

- **IDE（Integrated Development Environment）**：集成开发环境，集代码编辑、编译、运行、调试于一体。
- 类比：像“Word”之于写作，“Photoshop”之于修图。
- 另外提一嘴，Vscode更像是编辑器，类似记事本，可以写代码但是不能编译运行，但是集成好的IDE编译器就可以写代码+运行

#### 2. 安装步骤演示：

1. 打开安装包 → 下一步 → 接受协议
2. **关键点**：务必选择 **“Full installation”**（包含 MinGW 编译器）
3. 安装路径避免中文或空格（如 `D:\codeblocks`）
4. 安装完成后启动，首次启动会自动检测编译器（MinGW）

#### 3. 常见问题处理：

- 问题：安装后提示“no compiler found”
  - 解决：重新安装 **带 MinGW 的版本**；或手动配置：`Settings → Compiler → Toolchain executables`，设置 MinGW 路径

## 配置Vscode

【VScode使用教程——更加全面，每个人都能看懂的VScode基础配置！安装、设置、运行代码以及各种问题的解决——大一新生必看！】 https://www.bilibili.com/video/BV15kavzWExk/?share_source=copy_web&vd_source=f638a2484aa791b6d82543efa5511557

## 下载Dev c++（可选）

【Dev C++下载安装和使用dev c++ dev C++ 教程DevC++ 安装使用教程怎么改成中文windows11怎么下载安C语言软件装和使用devc++】 https://www.bilibili.com/video/BV1kC411G7CS/?share_source=copy_web&vd_source=f638a2484aa791b6d82543efa5511557

## （三）编写第一个程序：“Hello, World!”

#### 1. 创建新项目

- `File → New → Project → Console Application → Go`
- 语言选择 **C++**
- 项目名称：`HelloWorld`，路径不含中文
- 编译器：GNU GCC Compiler（默认）

#### 2. 认识代码结构

```cpp
#include <iostream>      // ← 包含输入输出库
using namespace std;    // ← 使用标准命名空间（简化写法）

int main()              // ← 主函数，程序从这里开始执行
{
    cout << "Hello, World!" << endl;  // ← 输出语句
    return 0;           // ← 返回0，表示程序正常结束
}
```

#### 3. 逐行讲解概念：

- `#include <iostream>`：**预处理指令**，告诉编译器“我要用输入输出功能”，类似“借书卡”，把标准库“借”进来。
- `main()`：**主函数**，每个C/C++程序必须有且仅有一个，是程序的入口。
- `cout << ...`：输出语句，把内容打印到屏幕。
- `//` 和 `/* ... */`：**注释**，给人看的说明，编译器会忽略。强调：写注释是好习惯！

#### 4. 学生动手：

- 修改字符串为 `"Hello, [你的名字]!"`
- 添加一行注释：`// 我的第一个程序`
- 点击编译并运行

## Vscode必备插件

c++需要用的

![image-20251001185240998](C:\Users\woodfish\AppData\Roaming\Typora\typora-user-images\image-20251001185240998.png)

codesnap，可以用来截图代码，当你需要问别人怎么修代码的时候，用这个比较清楚

![image-20251001185252724](C:\Users\woodfish\AppData\Roaming\Typora\typora-user-images\image-20251001185252724.png)

cph，竞赛训练必备，可以快速实现题目样例输入

![image-20251001185302372](C:\Users\woodfish\AppData\Roaming\Typora\typora-user-images\image-20251001185302372.png)

ai工具，最开始有什么基本错误，ai基本能搞定（比方说配置问题，代码问题）。但是！！！！！！！！！不可以滥用，不可以在考试用，这是作弊。

![image-20251001185420801](C:\Users\woodfish\AppData\Roaming\Typora\typora-user-images\image-20251001185420801.png)

主题美化类插件可有可无，这里打个广告）））
![image-20251001190741313](C:\Users\woodfish\AppData\Roaming\Typora\typora-user-images\image-20251001190741313.png)

## 基本的刷题网站注册

1. **洛谷luogu** [luogu.com.cn](https://www.luogu.com.cn/)
2. codeforces [请稍候…](https://codeforces.com/)
3. **牛客竞赛** [牛客竞赛OJ*ACM/NOI/CSP/CCPC/ICPC*信息学编程算法训练平台](https://ac.nowcoder.com/acm/contest/vip-index)

以下可选：

acwing https://www.acwing.com/

atcoder https://atcoder.jp/

starrycode https://www.starrycoding.com/

## 网课问题

这里有些网课资源

c语言：

【浙江大学翁恺教你C语言程序设计！C语言基础入门！】 https://www.bilibili.com/video/BV1dr4y1n7vA/?share_source=copy_web&vd_source=f638a2484aa791b6d82543efa5511557

看这个就行，有的同学看的比特鹏哥c语言，我之前看的也是鹏哥，但是他讲的太慢太细，所以不太推荐

学完c后，看下面这个

【C语言 转 C++ 简单教程】 https://www.bilibili.com/video/BV1UE411j7Ti/?share_source=copy_web&vd_source=f638a2484aa791b6d82543efa5511557

快速学习一些c++常用stl
