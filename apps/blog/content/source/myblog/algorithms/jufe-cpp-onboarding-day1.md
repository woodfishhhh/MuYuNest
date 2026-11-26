---
title: "JUFE 新生编程语法培训 Day1：环境配置与第一个 C++ 程序"
slug: "jufe-cpp-onboarding-day1"
date: 2025-12-20 12:00:03
categories:
  - "算法竞赛"
tags:
  - "C++入门"
  - "CodeBlocks"
  - "VSCode配置"
  - "新生培训"
  - "开发环境"
---

by woodfish

## 一、课前准备

1. **软件准备**：
   - 下载带 MinGW 编译器的 Code::Blocks 安装包（带 `mingw-setup` 字样）；
   - **一定要学会用 Code::Blocks**，因为蓝桥杯机房环境里大概率用的就是它。

## 二、安装与配置开发环境

### 安装开发工具：Code::Blocks

#### 1. 什么是 IDE？

- **IDE（Integrated Development Environment）**：集成开发环境，集代码编辑、编译、运行、调试于一体。
- 类比一下：就像“Word”之于写作，“Photoshop”之于修图。
- 另外提一嘴，VS Code 更像编辑器，本身不自带 C++ 编译器；而集成好的 IDE 自带编译器，装好就能直接写代码并编译运行。

#### 2. 安装步骤

1. 打开安装包 → 下一步 → 接受协议。
2. **关键点**：组件选择务必勾选 **Full installation**（包含 MinGW 编译器）。
3. 安装路径避免中文或空格（如 `D:\codeblocks`）。
4. 安装完成后启动，首次打开会自动检测编译器（GNU GCC / MinGW）。

#### 3. 常见问题处理

- 如果启动后提示 `Can't find compiler executable` / `no compiler found`：
  - 优先检查是否误装了不带 MinGW 的精简包，重装 **mingw-setup** 版本即可；
  - 或者手动配置路径：`Settings → Compiler → Toolchain executables`，将 Compiler's installation directory 指到 MinGW 安装目录（如 `D:\codeblocks\MinGW`），并在终端验证编译器是否可用：

```bash
g++ --version
```

### 配置 VS Code（可选）

如果习惯用 VS Code 写题，同样需要先把 MinGW（如 Code::Blocks 自带的 `MinGW\bin`）加到系统环境变量 `PATH` 中，再参考基础配置教程完成编译运行任务配置：

- [VS Code 基础安装与 C++ 配置教程（Bilibili）](https://www.bilibili.com/video/BV15kavzWExk/)

### 下载 Dev-C++（可选）

如果电脑配置较低或习惯更轻量的传统工具，也可以备用 Dev-C++：

- [Dev-C++ 下载安装与中文设置教程（Bilibili）](https://www.bilibili.com/video/BV1kC411G7CS/)

## 三、编写第一个程序："Hello, World!"

### 1. 创建新项目

- 在 Code::Blocks 中选择 `File → New → Project → Console Application → Go`。
- 语言选择 **C++**。
- 项目名称填写 `HelloWorld`，存放路径不要包含中文或空格。
- 编译器保持默认的 `GNU GCC Compiler`。

### 2. 认识代码结构

```cpp
#include <iostream>      // ← 包含输入输出库
using namespace std;     // ← 使用标准命名空间（简化写法）

int main()               // ← 主函数，程序从这里开始执行
{
    cout << "Hello, World!" << endl;  // ← 输出语句
    return 0;            // ← 返回 0，表示程序正常结束
}
```

如果不用 IDE 工程，也可以在终端里用命令行手动编译运行：

```bash
g++ -std=c++17 main.cpp -o main
./main
```

### 3. 逐行讲解核心概念

- `#include <iostream>`：**预处理指令**，告诉编译器“我要用标准输入输出流”，就像借书卡一样把标准库功能引入当前文件。
- `main()`：**主函数**，每个 C/C++ 程序必须有且仅有一个，是程序运行的入口。
- `cout << ...`：输出语句，把右侧内容打印到终端屏幕。
- `//` 和 `/* ... */`：**注释**，写给人看的说明，编译器在编译时会直接忽略。写注释是很好的工程与做题习惯。

### 4. 上手练习

1. 把输出字符串改成 `"Hello, [你的名字]!"`。
2. 在 `main()` 里添加一行单行注释：`// 我的第一个程序`。
3. 点击 Build and Run（快捷键 `F9`）完成编译并查看输出。

## 四、VS Code 必备插件推荐

用 VS Code 写 C++ 算法题，可以在左侧扩展商店（`Ctrl + Shift + X`）按插件名搜索安装下面几类工具：

1. **C/C++（Microsoft 官方插件，`ms-vscode.cpptools`）**：提供语法高亮、代码补全与断点调试基础能力，写 C++ 必装。
2. **CodeSnap（`adpyke.codesnap`）**：框选代码后右键即可生成高清代码块截图，向学长学姐或队友提问修 Bug 时比手机拍屏幕清楚得多。
3. **Competitive Programming Helper (`cph`, `DivyanshuAgrawal.competitive-programming-helper`)**：算法竞赛训练必备，可以直接抓取题目样例一键对拍运行，不用每次手动复制粘贴测试数据。
4. **AI 编程辅助插件（如 GitHub Copilot / 通义灵码等）**：平时做语法练习遇到环境配置报错、低级语法错误时可以让它帮着排查。**但是！！！千万不要滥用，更绝对不能在正式比赛或考试中使用，那属于作弊行为。**
5. **主题与图标美化插件（如 One Dark Pro、Material Icon Theme）**：纯属个人喜好，看着顺眼写代码心情也好一点，按需选用。

## 五、常用刷题网站

建议新生先注册下面三个主力 OJ：

1. **洛谷（Luogu）**：[luogu.com.cn](https://www.luogu.com.cn/)（中文题库与题单最友好，适合入门）
2. **Codeforces**：[codeforces.com](https://codeforces.com/)（全球最活跃的算法竞赛周赛平台）
3. **牛客竞赛**：[ac.nowcoder.com/acm/contest/vip-index](https://ac.nowcoder.com/acm/contest/vip-index)（国内校赛、多校训练常用）

以下平台可按需选刷：

- AcWing：[acwing.com](https://www.acwing.com/)
- AtCoder：[atcoder.jp](https://atcoder.jp/)
- StarryCoding：[starrycoding.com](https://www.starrycoding.com/)

## 六、网课学习建议

C 语言零基础可以先看浙大翁恺老师的课程（节奏紧凑，把核心语法过一遍就够了）：

- [浙江大学翁恺教你 C 语言程序设计（Bilibili）](https://www.bilibili.com/video/BV1dr4y1n7vA/)

学完 C 语言基础语法后，再快速过渡到 C++ 常用语法与 STL：

- [C 语言转 C++ 简单教程（Bilibili）](https://www.bilibili.com/video/BV1UE411j7Ti/)
