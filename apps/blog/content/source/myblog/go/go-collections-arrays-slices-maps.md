---
title: "Go 复合数据结构：数组、切片扩容陷阱与 Map"
slug: go-collections-arrays-slices-maps
date: "2026-10-13"
categories: ["编程语言"]
tags: ["Go", "数组", "切片", "Map", "数据结构"]
---

Go 的数组、切片和 `map` 表面上都能用下标或键值访问，底层内存布局和传递语义却完全不同。把数组当切片传会悄悄产生整段内存拷贝，往没初始化的 `map` 里写键值会直接 `panic`，理解它们的运行时结构才能把常见坑一次堵住。

## 数组是固定长度的值类型

Go 数组在声明时就锁死了长度，且**长度是数组类型的一部分**。`[3]int` 和 `[4]int` 在编译器眼里属于两种互不兼容的类型，既不能直接赋值，也不能传给同一个接收 `[3]int` 参数的函数。

```go
package main

import "fmt"

func overwriteFirst(arr [3]int) {
	arr[0] = 999 // 修改的是函数栈上的副本
}

func main() {
	a := [3]int{1, 2, 3}
	b := [...]int{1, 2, 3} // 编译器自动数出长度为 3，类型仍是 [3]int

	overwriteFirst(a)
	fmt.Println("a:", a, "equal b:", a == b) // a: [1 2 3] equal b: true
}
```

**数组赋值和传参都会完整拷贝全部元素，容量很大时开销显著，业务代码里通常只在尺寸固定（如 SHA-256 的 `[32]byte` 摘要）时直接使用数组。**

Go 也不支持 Python 那种 `arr[-1]` 负向索引，访问最后一个元素必须老实写 `arr[len(arr)-1]`。

## 切片底层结构与 nil / 空切片区别

日常列表数据几乎全用切片（`[]T`）。切片本身是一个只有三个机器字长的描述符（在 64 位平台上固定占 24 字节），并不直接持有元素内存：

```text
Slice Header (24 bytes on 64-bit)
┌──────────────┬──────────┬──────────┐
│ Data (*T)    │ Len (int)│ Cap (int)│
└──────┬───────┴──────────┴──────────┘
       │
       ▼
┌───┬───┬───┬───┬───┐
│ a │ b │ c │   │   │   底层连续数组
└───┴───┴───┴───┴───┘
  0   1   2   3   4
```

- `Data`：指向底层数组起始位置的指针。
- `Len`：当前可读写的有效元素个数，`len(s)` 读取它。
- `Cap`：从 `Data` 指针算起到底层数组末尾的总槽位数，`cap(s)` 读取它。

创建切片最容易混淆的是 `nil` 切片与空切片：

```go
package main

import (
	"encoding/json"
	"fmt"
)

func main() {
	var nilSlice []string          // Data == nil, len == 0, cap == 0
	emptySlice := []string{}       // Data != nil（指向 zerobase），len == 0, cap == 0
	prealloc := make([]int, 0, 16) // 预分配 16 个槽位，len == 0, cap == 16

	// nil 切片也能直接 append，无需先 make
	nilSlice = append(nilSlice, "go")

	b1, _ := json.Marshal([]string(nil))
	b2, _ := json.Marshal(emptySlice)
	fmt.Println(string(b1), string(b2), len(prealloc), cap(prealloc))
	// 输出: null [] 0 16
}
```

**日常判断切片是否为空应统一用 `len(s) == 0` 而不是 `s == nil`；但构建 JSON 接口响应体时，未初始化的 `nil` 切片会序列化成 `null`，需要返回 `[]` 给前端时要显式初始化为空切片。**

## 共享底层数组与 append 扩容陷阱

对数组或已有切片做切片截取 `s[low:high]` 时，Go 不会分配新内存，新切片的 `Data` 指针直接指向同一块底层数组。这带来了极高的零拷贝效率，也埋下了两个高频陷阱。

第一个陷阱是**子切片 `append` 互相覆盖**。只要新切片的 `len` 还没涨到 `cap`，`append` 就会直接往原底层数组后面的空位里写数据，把原切片后续元素悄悄改掉：

```go
package main

import "fmt"

func main() {
	base := []int{1, 2, 3, 4}
	sub := base[0:2] // len=2, cap=4，与 base 共用底层数组

	sub = append(sub, 99) // 未超过 cap=4，直接覆写 base[2]
	fmt.Println("base:", base) // [1 2 99 4]
	fmt.Println("sub :", sub)  // [1 2 99]
}
```

第二个陷阱是**扩容分离与内存滞留**。当 `append` 触发元素数量超出 `cap` 时，runtime 会分配一块更大的新数组、把旧元素拷过去再返回新切片头；此后新旧切片彻底分家，互不影响。反过来，如果你从一个 10MB 的大切片里只切出 `huge[0:10]` 长期持有，整个 10MB 底层数组都无法被 GC 回收。

避免这两个问题的工程手段有两个：

1. 使用三下标全切片表达式 `base[low:high:max]` 限制容量，例如 `base[0:2:2]` 把 `cap` 锁死为 `2`，后续对子切片 `append` 会强制触发新内存分配，绝不污染原切片。
2. 需要独立副本或只保留大切片的一小段时，显式使用 `copy` 或 `slices.Clone`：

```go
package main

import (
	"fmt"
	"slices"
)

func main() {
	src := []int{4, 1, 3, 2}
	// 用三下标限制容量，append 立即分配新底层数组
	isolated := src[0:2:2]
	isolated = append(isolated, 88)

	// 独立拷贝并排序（Go 1.21+ 推荐使用 slices 标准库）
	cloned := slices.Clone(src)
	slices.Sort(cloned)

	fmt.Println("src:", src)
	fmt.Println("isolated:", isolated)
	fmt.Println("sorted clone:", cloned)
}
```

**凡是在函数里对传入的切片执行 `append`，调用方必须接住函数返回的新切片，因为一旦触发扩容，原切片头里的指针和长度都不会同步更新。**

## Map 初始化、遍历随机性与并发禁忌

`map[K]V` 是 Go 内置的哈希表，键类型 `K` 必须是可比较类型（如整数、字符串、指针、仅含可比较字段的结构体；切片、函数和 map 本身不能作为 key）。

`map` 的零值也是 `nil`，但它和 `nil` 切片的行为截然不同：

| 操作 | `var m map[string]int`（`nil` map） | `m := make(map[string]int)`（已初始化） |
| --- | --- | --- |
| 读取 `v := m["k"]` | 安全，返回零值 `0` | 安全，存在返回值，不存在返回零值 |
| 存在性检查 `v, ok := m["k"]` | 安全，`ok` 为 `false` | 安全，精确区分键是否存在 |
| 删除 `delete(m, "k")` | 安全，无操作 | 安全，键不存在时无操作 |
| 写入 `m["k"] = 1` | **直接 panic：`assignment to entry in nil map`** | 安全，插入或更新键值对 |

**`nil` map 可以安全读取和删除，但只要执行写入操作就会立刻触发 `panic`，所有会写入的 map 必须通过 `make` 或字面量完成初始化。**

利用 comma-ok 语法可以清晰区分“键不存在”和“键存在但值恰好为零值”：

```go
package main

import (
	"fmt"
	"maps"
	"slices"
)

func main() {
	// 已知大致容量时传给 make，能减少运行期哈希桶扩容搬迁
	scores := make(map[string]int, 4)
	scores["alice"] = 0
	scores["bob"] = 95

	if v, ok := scores["alice"]; ok {
		fmt.Println("alice exists, score:", v)
	}
	if _, ok := scores["charlie"]; !ok {
		fmt.Println("charlie missing")
	}

	// map 遍历顺序在每次运行时故意随机化；需要稳定输出时先对 key 排序
	keys := slices.Sorted(maps.Keys(scores))
	for _, k := range keys {
		fmt.Printf("%s => %d\n", k, scores[k])
	}
}
```

Go 运行时在遍历 `map` 时会故意从随机桶和随机偏移开始，防止业务代码意外依赖哈希表内部顺序。更严格的一条红线在并发场景：**原生 `map` 并发读写会触发不可 `recover` 的 `fatal error: concurrent map read and map write`，直接导致整个进程崩溃**。跨 goroutine 共享映射时，必须配合 `sync.RWMutex` 加锁或改用 `sync.Map`，具体并发模型和锁用法见 [Go 并发入门：Goroutine、Channel、Select 与数据竞态](/posts/go-concurrency-and-safety)。
