---
title: "Go 并发入门：Goroutine、Channel、Select 与数据竞态"
slug: go-concurrency-and-safety
date: "2026-10-13"
categories: ["编程语言"]
tags: ["Go", "Goroutine", "Channel", "Select", "并发安全"]
---

在函数调用前加一个 `go` 关键字就能并发启动一条轻量级协程，但协程之间的生命周期同步、数据交接和共享内存保护一旦没配好，程序要么提前退出漏掉结果，要么在高并发下出现难以复现的竞态崩溃。

## Goroutine 启动与 WaitGroup 生命周期同步

Goroutine 由 Go 运行时自主调度到操作系统线程上，初始栈空间仅几 KB，创建成千上万个协程开销极小。但要注意一条核心规则：**`main` 函数返回意味着整个进程立即退出，运行时不会等待任何还在跑的后台 goroutine。**

用 `time.Sleep` 硬等后台任务既慢又不可靠，标准做法是使用 `sync.WaitGroup` 做精确计数同步：

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func worker(id int, wg *sync.WaitGroup) {
	defer wg.Done() // 放在函数开头用 defer 确保异常退出也能扣减计数
	time.Sleep(50 * time.Millisecond)
	fmt.Printf("worker %d done\n", id)
}

func main() {
	var wg sync.WaitGroup
	for i := 1; i <= 3; i++ {
		wg.Add(1) // 必须在 go 语句之前调用 Add，避免 Wait 抢跑
		go worker(i, &wg)
	}
	wg.Wait()
	fmt.Println("all workers finished")
}
```

**传给 goroutine 的 `*sync.WaitGroup` 必须是指针且 `wg.Add(1)` 要写在 `go` 语句之前；按值传递 `WaitGroup` 会复制出独立的计数器，导致主协程永久阻塞死锁。**

## Channel 通信、缓冲与关闭规则

Channel 是 goroutine 之间类型安全的通信管道，默认遵循“用通信共享内存”的设计理念。创建时分无缓冲和有缓冲两种形态：

- **无缓冲 channel（`make(chan T)`）**：发送和接收必须同步配对，先到达的一方会挂起等待另一方就绪，天然带有强同步语义。
- **有缓冲 channel（`make(chan T, n)`）**：缓冲区未满时发送直接入队返回，未空时接收直接出队返回；满了或空了才挂起等待。

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	ch := make(chan int, 2)
	var wg sync.WaitGroup

	for i := 1; i <= 3; i++ {
		wg.Add(1)
		go func(val int) {
			defer wg.Done()
			ch <- val * 10
		}(i)
	}

	// 由独立协调协程在所有发送者完成后统一关闭 channel
	go func() {
		wg.Wait()
		close(ch)
	}()

	// range 会持续读取直到 channel 被关闭且缓冲区读空
	for v := range ch {
		fmt.Println("received:", v)
	}
}
```

使用 `close(ch)` 时有两条铁律：

1. **只由发送方（或等所有发送方退出后的协调者）关闭 channel，接收方绝不能随手 `close`，因为往已关闭的 channel 发送数据或重复关闭都会直接 `panic`。**
2. 接收方可以通过 `v, ok := <-ch` 判断状态：`ok == false` 代表 channel 已关闭且残留缓冲数据全部读完，此时 `v` 为零值。

## Select 多路复用与超时控制

当一个协程需要同时监听多个 channel（例如业务结果通道 + 退出信号通道）时，单靠顺序读取会卡死在第一个没有数据的 channel 上。`select` 会同时监控所有分支，谁先就绪就执行谁；若多个分支同时就绪，运行时会均匀随机挑一个执行。

```go
package main

import (
	"fmt"
	"time"
)

func slowRPC(res chan<- string) {
	time.Sleep(200 * time.Millisecond)
	res <- "ok"
}

func main() {
	res := make(chan string, 1) // 缓冲为 1，防止超时后后台协程写通道永久泄漏
	go slowRPC(res)

	timer := time.NewTimer(80 * time.Millisecond)
	defer timer.Stop()

	select {
	case data := <-res:
		fmt.Println("response:", data)
	case <-timer.C:
		fmt.Println("request timeout")
	}
}
```

**超时后不再接收结果时，建议给结果 channel 留 1 个容量缓冲，否则后台任务执行完往无缓冲 channel 写入时会永远阻塞泄漏；在 `for-select` 循环里也应复用 `time.NewTimer` 并及时 `Stop`，避免每轮创建 `time.After` 堆积定时器对象。**

如果 `select` 带了 `default` 分支，当所有通信分支都未就绪时就会立刻走 `default`，变成非阻塞探测；在循环里滥用 `default` 会导致 CPU 满载空转。

## 数据竞态、互斥锁与并发安全 Map

多个 goroutine 同时读写同一块共享变量，只要其中至少有一个是写操作且没有同步保护，就会产生数据竞态（Data Race）。下面这段计数代码看似加减抵消，实际每次运行结果都可能是随机值：

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var (
		count int
		mu    sync.Mutex
		wg    sync.WaitGroup
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		for range 100000 {
			mu.Lock()
			count++
			mu.Unlock()
		}
	}()
	go func() {
		defer wg.Done()
		for range 100000 {
			mu.Lock()
			count--
			mu.Unlock()
		}
	}()

	wg.Wait()
	fmt.Println("final count:", count) // 0
}
```

除了普通互斥锁 `sync.Mutex`，读多写少场景可用读写锁 `sync.RWMutex`（允许多个读协程并发 `RLock`，写锁 `Lock` 互斥），简单整数计数还可以直接用 `sync/atomic`（如 `atomic.Int64`）做无锁原子增减。

**标准库 `map` 在并发读写时会直接触发 `fatal error: concurrent map read and map write` 并强制杀掉进程，这不是普通 `recover` 能兜住的异常。**

保护并发访问映射表有两种常见方式：

| 方案 | 适用场景 | 写法要点 |
| --- | --- | --- |
| `sync.RWMutex` + 普通 `map` | 读写均衡、频繁增删改、需要复合事务操作 | 读加 `RLock`/`RUnlock`，写加 `Lock`/`Unlock`，保持类型安全 |
| `sync.Map` | 读远多于写（如配置缓存），或各协程读写互不重叠的 key | 提供 `Load`/`Store`/`LoadOrStore`/`Delete`，键值类型为 `any` |

**开发和测试阶段务必常开竞态检测器跑一遍 `go test -race ./...`，它能在运行期精准抓出未受保护的并发读写并定位到具体代码行。**

理解了基本的协程调度与同步工具后，可以继续深入运行时源码层面的实现细节：[Go Channel 实现原理：从环形缓冲区到协程唤醒](/posts/golang-channel-internals) 与 [Go Context 实现原理：取消传播、超时控制与 Value 链](/posts/golang-context-internals)。
