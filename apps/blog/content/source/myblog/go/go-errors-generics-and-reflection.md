---
title: "Go 错误处理、泛型约束与反射实践"
slug: go-errors-generics-and-reflection
date: "2026-10-13"
categories: ["编程语言"]
tags: ["Go", "错误处理", "泛型", "反射", "ORM"]
---

Go 用显式返回值处理错误、用编译期类型参数解决泛型复用、用运行期反射支撑序列化和 ORM 标签解析。把这三套机制的适用边界划清，业务代码才会既健壮又不至于把反射用得到处都是。

## 错误处理：显式返回、错误链与 panic/recover 边界

Go 没有 `try-catch` 异常捕获语法，可预期的业务或 I/O 失败一律作为最后一个 `error` 返回值向上传递。调完函数立刻检查 `err != nil` 看起来繁琐，却让每条失败路径在控制流里一目了然。

向上层透传错误时，不要直接 `return err` 丢掉上下文，也不要只拼字符串破坏底层错误身份。从 Go 1.13 起应使用 `fmt.Errorf("...: %w", err)` 包装错误，上层再通过 `errors.Is` 和 `errors.As` 穿透整条错误链匹配目标错误或提取具体错误结构体：

```go
package main

import (
	"errors"
	"fmt"
	"os"
)

func loadConfig(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("load config %s: %w", path, err)
	}
	return data, nil
}

func main() {
	_, err := loadConfig("missing.yaml")
	if errors.Is(err, os.ErrNotExist) {
		fmt.Println("配置文件不存在，走默认配置:", err)
	}
}
```

只有真正不可恢复的启动故障（例如必填密钥缺失）或严重程序 bug 才适合触发 `panic`。Web 框架或协程池为了防止单个请求拖垮整个进程，会在最外层中间件里用 `defer` 配合 `recover()` 兜底并记录调用栈：

```go
package main

import (
	"fmt"
	"runtime/debug"
)

func safeCall(fn func()) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("panic recovered: %v\n%s", r, debug.Stack())
		}
	}()
	fn()
}

func main() {
	safeCall(func() {
		s := []int{1, 2}
		fmt.Println(s[5]) // 越界触发 panic
	})
	fmt.Println("进程继续运行")
}
```

**`recover()` 只有在 `defer` 函数体内直接调用才有效；日常业务逻辑绝不能把 `panic/recover` 当成常规 `try-catch` 来代替 `error` 返回。**

## 泛型：类型参数、~T 底层类型约束与容器复用

Go 1.18 引入了泛型，让数据结构和算法在不丢失编译期类型检查的前提下跨类型复用。定义泛型时需要在函数名或类型名后用方括号声明类型参数及约束条件：

```go
package main

import "fmt"

// ~int 表示支持 int 本身以及所有以 int 为底层类型的自定义类型
type Number interface {
	~int | ~int64 | ~float64
}

type UserID int

func Sum[T Number](items []T) T {
	var total T
	for _, v := range items {
		total += v
	}
	return total
}

// 通用 API 响应包装结构体
type Response[T any] struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data T      `json:"data"`
}

// 泛型集合容器，K 必须满足可比较约束 comparable
type SafeDict[K comparable, V any] map[K]V

func main() {
	fmt.Println(Sum([]int{1, 2, 3}))
	fmt.Println(Sum([]UserID{10, 20}))

	resp := Response[SafeDict[string, int]]{
		Code: 0,
		Msg:  "ok",
		Data: SafeDict[string, int]{"count": 2},
	}
	fmt.Printf("%+v\n", resp)
}
```

**写数值或字符串通用约束时优先加上 `~` 前缀（如 `~string`、`~int`），否则基于它们定义的自定义类型无法传入泛型函数；标准库已提供 `cmp.Ordered` 等现成约束可直接复用。**

泛型适合通用容器、工具函数和统一协议包装，能用普通接口或具体类型清晰表达的业务逻辑无需强行泛型化。

## 反射基础：Type/Value 检查、指针改写与方法调用

标准库 `reflect` 允许程序在运行期读取任意变量的动态类型信息、结构体标签并动态修改值。核心入口只有两个：`reflect.TypeOf(v)` 获取静态类型元数据，`reflect.ValueOf(v)` 获取运行期值封装。

```go
package main

import (
	"fmt"
	"reflect"
)

func inspectAndModify(target any) {
	t := reflect.TypeOf(target)
	v := reflect.ValueOf(target)
	fmt.Println("type:", t, "kind:", t.Kind())

	// 只有传入指针并通过 Elem() 解引用后，字段才具备可写性（CanSet）
	if t.Kind() == reflect.Ptr && v.Elem().Kind() == reflect.String {
		if v.Elem().CanSet() {
			v.Elem().SetString("updated-by-reflect")
		}
	}
}

type Greeter struct{}

func (Greeter) Say(name string) {
	fmt.Println("hello,", name)
}

func main() {
	s := "origin"
	inspectAndModify(&s)
	fmt.Println("after:", s)

	g := Greeter{}
	mv := reflect.ValueOf(g).MethodByName("Say")
	if mv.IsValid() {
		mv.Call([]reflect.Value{reflect.ValueOf("muyu")})
	}
}
```

**通过反射修改外部变量或结构体字段时，必须传入指针并调用 `Elem()` 取目标值，同时检查 `CanSet()`；直接对值副本调用 `Set...` 会在运行期直接 `panic`。**

## 结构体标签与极简 ORM 查询生成实战

结构体反射最典型的应用场景是读取 Struct Tag。例如自动把带特定标签的字段转成大写，或者像 ORM 框架那样把结构体字段和条件参数拼装成 SQL 查询：

```go
package main

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
)

type Student struct {
	Name string `orm:"name"`
	Age  int    `orm:"age"`
}

func BuildSelectSQL(model any, query string, args ...any) (string, []any, error) {
	t := reflect.TypeOf(model)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return "", nil, errors.New("model must be a struct or struct pointer")
	}

	var cols []string
	for i := range t.NumField() {
		col := t.Field(i).Tag.Get("orm")
		if col != "" && col != "-" {
			cols = append(cols, col)
		}
	}
	if len(cols) == 0 {
		return "", nil, errors.New("no orm tags found")
	}

	table := strings.ToLower(t.Name()) + "s"
	if query == "" {
		return fmt.Sprintf("SELECT %s FROM %s", strings.Join(cols, ", "), table), nil, nil
	}
	if strings.Count(query, "?") != len(args) {
		return "", nil, errors.New("placeholder count does not match args")
	}
	return fmt.Sprintf("SELECT %s FROM %s WHERE %s", strings.Join(cols, ", "), table, query), args, nil
}

func main() {
	sql, args, err := BuildSelectSQL(Student{}, "name = ? AND age >= ?", "小明", 18)
	fmt.Println(sql, args, err)
	// 输出: SELECT name, age FROM students WHERE name = ? AND age >= ? [小明 18] <nil>
}
```

注意上面刻意保留了 `?` 占位符并把参数切片单独返回给数据库驱动绑定，而没有像玩具代码那样用 `fmt.Sprintf` 把字符串参数直接拼进 SQL 文本——生产环境直接拼接用户输入会直接制造 SQL 注入漏洞。

**反射比普通静态调用慢一到两个数量级，还会把本可在编译期发现的类型错误推迟到运行期暴露；因此反射应收敛在框架底层与编解码库中，常规业务代码优先使用接口和泛型。**
