---
title: "Go Channel 实现原理：从环形缓冲区到协程唤醒"
slug: golang-channel-internals
date: "2026-10-13"
updated: "2026-10-13"
categories:
  - Go语言
tags:
  - Go
  - Channel
  - 并发
  - Runtime
source:
  - https://github.com/golang/go/blob/go1.26.4/src/runtime/chan.go
  - https://github.com/golang/go/blob/go1.26.4/src/runtime/runtime2.go
  - https://github.com/golang/go/blob/go1.26.4/src/runtime/select.go
  - https://github.com/golang/go/blob/go1.26.4/src/cmd/compile/internal/walk/select.go
draft: false
---

# Go Channel 实现原理：从环形缓冲区到协程唤醒

`ch <- value` 的数据不一定先进缓冲区：已经有接收者在等，runtime 会把值直接交给它；没有接收者、缓冲区又放不下，发送者才进等待队列。

看 channel 抓住三块就行：

- 保存值的环形缓冲区
- 记录等待者的队列
- 把 goroutine 挂起、唤醒的调度流程

`close` 和 `select` 是在这套机制上加了状态变化和多路选择。

源码基线是 **Go 1.26.4** 的普通 `make(chan T, n)`。结构体只列相关字段，流程图和伪代码省略了 race 检测、性能采样、定时器和 `synctest` 分支。这些内部布局不是稳定 API，语言层面的行为以 [Go 规范](https://go.dev/ref/spec#Channel_types)为准。

## 1. 先区分 nil、无缓冲、有缓冲和已关闭

```go
var nilCh chan int          // nil：还没有关联到 channel 对象
unbuffered := make(chan int) // 已创建，容量为 0
buffered := make(chan int, 3) // 已创建，容量为 3
signal := make(chan struct{}, 3) // 元素大小为 0，但逻辑容量仍为 3
```

`nilCh` 和 `unbuffered` 都是 `len == 0`、`cap == 0`，行为却不一样：无缓冲 channel 能让发送者和接收者配对，nil channel 永远完成不了收发。

| channel 状态 | 发送 `ch <- v` | 接收 `v, ok := <-ch` | `close(ch)` |
| --- | --- | --- | --- |
| nil | 永久阻塞当前 goroutine | 永久阻塞当前 goroutine | panic |
| 已创建、未关闭、无缓冲 | 等待接收者配对 | 等待发送者配对 | 关闭，并解除等待 |
| 未关闭、有缓冲 | 有等待接收者则直接交付；否则有空位就入队，满了就等待 | 有数据就取队头；没有数据就等待 | 关闭，已入队数据保留 |
| 已关闭、缓冲区还有值 | panic | 继续读出原有值，`ok == true` | panic |
| 已关闭、缓冲区已空 | panic | 立即得到元素类型零值，`ok == false` | panic |

这里的“阻塞”是指当前 goroutine 暂停执行。整个程序都没法继续推进时，runtime 才可能报死锁。一个 goroutine 等在 nil channel 上，不代表其他 goroutine 都不能运行。

`len(ch)` 是当时缓冲区里还没取走的元素数，不算等待发送者手里的值。别用它判断下一次发送会不会阻塞：刚查完，其他 goroutine 就可能改了 channel 状态。

## 2. hchan、waitq 和 sudog 分别管理什么

普通 channel 的运行时状态都在 `hchan` 里。把 channel 赋给另一个变量，两个变量指向的还是同一个 channel 对象，不会复制出一份独立队列。

![hchan 管理缓冲区、发送等待队列和接收等待队列；sudog 关联 goroutine 与待传输数据](assets/go-channel/01-structure.svg)

### 2.1 hchan：缓冲区与通信状态

和收发相关的字段摘录（省略了 Go 1.26.4 里的 `timer`、`bubble` 等字段）：

```go
type hchan struct {
    qcount   uint           // 缓冲区中已有的元素数
    dataqsiz uint           // 缓冲区容量
    buf      unsafe.Pointer // 环形缓冲区的起始地址
    elemsize uint16         // 一个元素占用的字节数
    closed   uint32         // 是否已关闭
    elemtype *_type         // 元素的运行时类型信息

    sendx uint  // 下一次入队使用的下标
    recvx uint  // 下一次出队使用的下标
    recvq waitq // 等待接收的节点队列
    sendq waitq // 等待发送的节点队列

    lock mutex  // 保护 channel 状态及相关等待节点
}
```

| 字段 | 作用 | 容易混淆的地方 |
| --- | --- | --- |
| `qcount` | 记录缓冲区内的元素数 | 不是 goroutine 数，也不是累计发送次数 |
| `dataqsiz` | 记录创建时的容量 | 源码字段名没有结尾的 `e` |
| `buf` | 定位元素存储区域 | 无缓冲 channel 不靠它保存待发送值 |
| `sendx` / `recvx` | 标记入队与出队位置 | 二者相等时可能为空，也可能为满，要结合 `qcount` 判断 |
| `sendq` / `recvq` | 记录尚未完成的通信 | 排队的是等待节点，而不是直接把整个 goroutine 塞进链表 |
| `lock` | 串行保护状态变更 | 非阻塞失败判断存在无锁快速路径，不能说所有路径都先加锁 |

### 2.2 waitq：用双向链表管理等待节点

```go
type waitq struct {
    first *sudog
    last  *sudog
}
```

发送者没法立即交付数据就进 `sendq`；接收者拿不到数据就进 `recvq`。入队、出队要和缓冲区状态在同一把 channel 锁下配合，不然会出现“刚检查完不能通信，对端却已经来了”的竞态。

### 2.3 sudog：一次等待关系的记录

`sudog` 可以理解成一条“某个 goroutine 正在某个同步操作上等待”的记录。它不是 goroutine 本身，一个 goroutine 也不是只对应一个 sudog。

| 相关字段 | 含义 |
| --- | --- |
| `g` | 正在等待的 goroutine |
| `next`、`prev` | 当前等待队列中的前后节点 |
| `elem` | 发送时指向待发送的值；接收时指向接收结果的存放位置 |
| `c` | 这次等待关联的 channel |
| `isSelect` | 是否属于 `select` 的候选通信 |
| `success` | 是否因为成功通信而恢复；因关闭解除等待时为 false |

Go 1.26.4 里 `elem` 和 `c` 用的是内部指针包装类型，源码通过 `.get()`、`.set()` 访问。旧文章直接写 `unsafe.Pointer` 或 `*hchan`，拿来理解关系可以，但不是当前版本的完整声明。

`select` 可能让一个 goroutine 同时等多个 case，这时就对应多个 `sudog`；某个 case 胜出后，其余等待关系要撤销。节点还会复用，`acquireSudog` / `releaseSudog` 不是每次都向系统申请、释放内存。

### 2.4 两条能解释收发分支的不变量

普通有缓冲 channel，runtime 维护：

- `qcount > 0` 时，`recvq` 为空：缓冲区里已经有值，接收者就不该再排队等。
- `qcount < dataqsiz` 时，`sendq` 为空：缓冲区还有空位，发送者就不该再排队等。

所以，**有缓冲 channel 有等待的发送者时，缓冲区一定是满的；有等待的接收者时，缓冲区一定是空的。**

普通配对场景下，`sendq` 和 `recvq` 不会同时非空。源码特意留了个例外：一个 goroutine 在无缓冲 channel 的同一条 `select` 里同时注册发送和接收 case。所以等待节点不能简单等同于不同的 goroutine。

## 3. makechan 怎样分配内存

`make(chan T, n)` 时，runtime 先算缓冲区的字节数：

```text
mem = 元素大小 × 容量
```

然后检查容量为负、乘法溢出、申请大小超限这些情况，再初始化元素类型、容量和锁。常量负容量在编译期就报错；运行时算出来的非法容量在执行时失败。

源码里的三个内存分配分支：

| 条件 | 分配方式 | 例子 |
| --- | --- | --- |
| `mem == 0` | 只需要 channel 头部，不需要实际的数据存储字节 | 无缓冲 channel；`chan struct{}` 即使有容量也属于此类 |
| `mem > 0`，元素不含 GC 需要追踪的指针 | 将头部与缓冲区放在同一次分配中 | `chan int`、`chan [8]byte`、`chan struct{ N int }` |
| `mem > 0`，元素含有指针 | 分别分配头部与按元素类型描述的缓冲区 | `chan *User`、`chan string`、`chan []byte`、`chan struct{ P *int }` |

分类看的是元素含不含指针，不是“struct 型”和“pointer 型”。结构体也可能含指针，字符串和切片的值内部也有指向底层数据的指针。

`mem == 0` 也不代表无缓冲，比如：

```go
ch := make(chan struct{}, 3)
ch <- struct{}{}
ch <- struct{}{}
ch <- struct{}{}
// 此时 len(ch) == 3。没有接收者时，第四次发送仍然会阻塞。
```

元素本身不占存储字节，但 channel 照样记录数量、容量和等待关系，通信行为不会消失。

channel 头部大小由 `unsafe.Sizeof(hchan{})` 结合对齐算出来，跟 Go 版本和平台有关，旧文章里“固定 96 字节”的说法不通用。[源码位置：`makechan`](https://github.com/golang/go/blob/go1.26.4/src/runtime/chan.go)。

## 4. 环形缓冲区怎样保持 FIFO

缓冲区底层是一段按元素大小划分的连续存储，第 `i` 个槽位的地址可以这样理解：

```text
槽位地址 = buf + i × elemsize
```

普通入队：先把值复制到 `sendx` 对应的位置，再推进下标、增加 `qcount`：

```text
buf[sendx] = 待发送值
sendx = (sendx + 1) % dataqsiz
qcount++
```

普通出队：从 `recvx` 取出值，清理原槽位，再推进下标、减少 `qcount`：

```text
接收结果 = buf[recvx]
清零 buf[recvx]
recvx = (recvx + 1) % dataqsiz
qcount--
```

这些是逻辑等价的伪代码。真实实现用“递增，到容量后归零”来绕回；无缓冲 channel 不会走到这里做除零取模。清零槽位也是为了 GC：元素含指针时，已经取走的值别再被缓冲区无意中保活。

用容量为 3 的 channel 走一遍：

| 操作后 | 物理槽位 `[0, 1, 2]` | `recvx` | `sendx` | `qcount` | 接下来应读出的顺序 |
| --- | --- | --- | --- | --- | --- |
| 刚创建 | `[空, 空, 空]` | 0 | 0 | 0 | 无 |
| 发送 A、B | `[A, B, 空]` | 0 | 2 | 2 | A、B |
| 接收一次 | `[空, B, 空]` | 1 | 2 | 1 | B |
| 发送 C | `[空, B, C]` | 1 | 0 | 2 | B、C |
| 发送 D | `[D, B, C]` | 1 | 1 | 3 | B、C、D |

下标会绕回，逻辑上的 FIFO 顺序不变。注意最后一行 `sendx == recvx`，缓冲区却是满的，要结合 `qcount` 判断。

这里的 FIFO 只是值的入队、出队顺序。它不保证多个并发发送者按 goroutine 创建顺序执行，也不保证被唤醒的 goroutine 马上拿到 CPU。

## 5. 发送流程：先找接收者，再看缓冲区

普通发送语句的调用链：

```text
ch <- value
  → runtime.chansend1
    → runtime.chansend(..., block=true, ...)
```

`ep` 是待发送值的地址，`block` 表示不能立即完成时能不能挂起当前 goroutine。

![发送流程：nil 处理、关闭检查、直接交付、写入缓冲区以及进入 sendq 等待](assets/go-channel/03-send.svg)

### 5.1 nil 与已关闭 channel

nil channel 没有可配对的通信对象。普通发送会永久挂起当前 goroutine；非阻塞尝试返回未完成。

非 nil channel 加锁后先检查关闭状态。已关闭就解锁并触发 `send on closed channel`，缓冲区有空位也不让继续发。

源码在一定条件下还会走无锁快速路径，提前判断非阻塞操作成功不了，省掉不必要的加锁。图里只保留了主干逻辑，不是逐条指令展开。

### 5.2 已有接收者等待：直接交付

`recvq.dequeue()` 找到接收者时，`chansend` 调用 `send`，大致做这几步：

1. 把当前发送值复制到接收者 `sudog.elem` 指向的结果位置；接收者丢弃结果的话，可以跳过这次复制。
2. 解除相关等待节点对数据的引用，释放 channel 锁。
3. 标记本次通信成功，用 `goready` 让接收者重新变成可运行。

缓冲区为空、已有接收者在等的有缓冲 channel 也走这条路径，直接绕过缓冲区，不用“先入队、再出队”。

直接交付也不是零拷贝。`sendDirect` 最后还是有值复制，跨 goroutine 写栈时还要处理写屏障和栈移动的问题。元素是指针或切片的话，复制的是指针值或切片描述符，不会自动深拷贝底层对象。

### 5.3 没有等待接收者，缓冲区还有空位

`qcount < dataqsiz` 时，把值复制到 `sendx` 槽位，推进 `sendx`、增加 `qcount`，然后解锁返回。

发送返回只说明值已经交付或入队。对有缓冲 channel，它**不保证接收者已经取走，更不保证接收者已经处理完**。要确认业务处理完成，得另外设计响应或完成信号。

### 5.4 既不能交付，也不能入队

非阻塞尝试到这里就解锁返回 false。普通阻塞发送要做的是：

```text
取得当前 goroutine
  → 取得一个 sudog，关联待发送值、goroutine 和 channel
  → 在持锁状态下把 sudog 放入 sendq
  → gopark，通过 chanparkcommit 释放锁并完成挂起协议
  → 等待接收操作或 close 解除等待
  → 恢复后读取 success，清理并归还 sudog
```

恢复后有两种结果：

- 接收者完成了交接：`success == true`，发送正常返回。缓冲区满的情况下，值也可能只是被接收者补进了缓冲区，并没有直接交给这个接收者。
- channel 被关闭：`success == false`，发送恢复后 panic。

所以“被唤醒就说明发送值一定已经被读走”是不对的。[源码位置：`chansend` 与 `send`](https://github.com/golang/go/blob/go1.26.4/src/runtime/chan.go)。

## 6. 接收流程：等待发送者与缓冲区怎样配合

普通接收有两种入口：

```text
value := <-ch      → chanrecv1 → chanrecv(..., block=true)
value, ok := <-ch  → chanrecv2 → chanrecv(..., block=true)
```

`chanrecv` 内部返回两个布尔值：

- `selected`：这次接收是否已经完成（区别于“尝试后发现暂时收不了”）。
- `received`：是否拿到了发送过来的有效元素，对应 Go 语法里的 `ok`。

| 情况 | `selected` | `received` / `ok` |
| --- | --- | --- |
| 非阻塞接收暂时拿不到数据 | false | false |
| 成功接收到一个发送值 | true | true |
| channel 已关闭且缓冲区已空 | true | false |

![接收流程：关闭后先区分有无剩余值，未关闭时处理等待发送者、缓冲区或 recvq 等待](assets/go-channel/04-receive.svg)

### 6.1 已关闭：先判断缓冲区是否已经读空

已关闭且 `qcount == 0` 时，runtime 把接收结果置为元素类型的零值，返回 `true, false`。

已关闭但缓冲区还有值，就继续从缓冲区读，返回 `true, true`。所以 `ok == true` 不能说明 channel 还没关闭；`ok == false` 才表示 channel 已关闭，并且没有剩余值可读。

### 6.2 未关闭，sendq 里已有发送者

这时调用 `recv`，要分容量是不是 0。

**无缓冲 channel：** 把等待发送者的值直接复制到当前接收位置，再释放锁、标记成功、唤醒发送者。没有“先把值放进容量为 0 的缓冲区”这一步。

**有缓冲 channel：** 按前面的不变量，这时缓冲区一定是满的。当前接收者要先拿最早入队的值，不能越过它直接拿等待发送者的新值。

![满缓冲区接收时先取 A，再把等待发送者的 D 放到同一个物理槽位，逻辑顺序变为 B、C、D](assets/go-channel/02-buffer-handoff.svg)

假设容量为 3，缓冲区是 `[A, B, C]`，D 的发送者已经排队：

1. 把 `recvx` 对应的 A 复制给当前接收者。
2. 把等待发送者的 D 复制到 A 刚腾出的那个物理槽位。
3. 推进 `recvx`，并让 `sendx` 指向同一个新位置。
4. 释放锁，标记发送成功，再唤醒 D 的发送者。

结束后物理槽位是 `[D, B, C]`，逻辑队列是 `B → C → D`。取走一个、补进一个，`qcount` 不变，缓冲区还是满的。

### 6.3 没有等待发送者，但缓冲区有值

直接从 `recvx` 取值，清零旧槽位，推进 `recvx` 并执行 `qcount--`，解锁返回。

和上一个分支不同，这里没有等待发送者补位，所以缓冲区的元素数确实少了。

### 6.4 没有发送者，也没有缓冲值

非阻塞接收解锁并返回 `false, false`。阻塞接收把接收位置记到 `sudog.elem`，进入 `recvq`，再用 `gopark` 挂起。

恢复后同样要检查结果：通信成功返回 `ok == true`；因为关闭而解除等待，得到零值和 `ok == false`。接收者被唤醒，不一定收到了业务值。[源码位置：`chanrecv` 与 `recv`](https://github.com/golang/go/blob/go1.26.4/src/runtime/chan.go)。

## 7. 为什么不能简单写成“解锁，然后睡眠”

阻塞流程最关键的，是入队、释放锁、进入等待状态这几步之间怎么协调。

如果先释放锁、再随便执行一个睡眠动作：对端可能正好在这两步中间找到等待节点、完成通信并尝试唤醒，本方之后才真正睡下，这次唤醒就可能丢了。

Go 用 `gopark` 和 `chanparkcommit` 协调这个过程：等待节点先在持锁状态下登记，调度器在提交挂起时调用回调，设置相关的栈状态标记，再释放 channel 锁。对端拿到锁以后，才能安全地完成交接或关闭处理。

同样，`send`、`recv`、`closechan` 都是释放 channel 锁之后才把对端 goroutine 设为可运行。持有 channel 锁时去改另一个 goroutine 的状态，会和栈收缩等机制产生锁依赖问题。

区分这三个动作：

| 动作 | 发生了什么 |
| --- | --- |
| `gopark` | 当前 goroutine 进入等待，承载它的线程可以执行其他工作 |
| `goready` | 等待者恢复为可运行状态，等待调度 |
| 真正继续执行 | 调度器安排该 goroutine 获得执行机会 |

所以源码分析里说的“唤醒”一般不是立即执行，也不能写成“睡眠期间一直持锁，醒来后才解锁”。一直持锁的话，对端就进不了 channel 完成交接。

## 8. close 做了什么，为什么不会清空缓冲区

`close(ch)` 的入口是 `closechan`。它的意思是“以后不再发送”，不会销毁 channel，也不会立即释放缓冲区内存。

![close 先标记关闭，再处理两类等待者，解锁后统一唤醒；缓冲区中的已发送数据保留](assets/go-channel/05-close.svg)

主干流程：

1. nil channel 直接 panic。
2. 获取 channel 锁，发现已经关闭就解锁并 panic。
3. 把 `closed` 标记设为 1。
4. 取出接收等待节点，接收位置置零，设置 `success = false`，对应 goroutine 暂存到唤醒列表。
5. 取出发送等待节点，设置 `success = false`，同样放进唤醒列表；这些发送者恢复后会 panic。
6. 释放 channel 锁，再逐个 `goready`。

普通有缓冲 channel 如果有阻塞的接收者，缓冲区本来就是空的。所以“解除等待的接收者拿到零值”和“缓冲区原有数据还能继续读”不冲突。

完整例子：保存为 `close_buffer.go`，运行 `go run close_buffer.go`。

```go
package main

import "fmt"

func main() {
    ch := make(chan int, 2)
    ch <- 10
    ch <- 20
    close(ch)

    for i := 0; i < 4; i++ {
        value, ok := <-ch
        fmt.Println(value, ok)
    }
}
```

输出固定为：

```text
10 true
20 true
0 false
0 false
```

关闭后的 channel 不是“读一次就失效”：读空之后，每次接收都立即返回零值和 false。`for value := range ch` 会一直读出剩余的值，channel 关闭且读空才退出；只是暂时为空，`range` 不会结束。

一般由负责结束发送的一方关闭 channel。多个发送者一起写的话，先等所有发送完成，再由协调者统一关闭。`sync.Once` 只能防止重复关闭，“并发发送与关闭”不会因此变安全。也别用 `len(ch)` 或一次试探接收来判断能不能安全发送。

## 9. select 不等于“把所有收发都改成非阻塞”

普通 `ch <- value` 和 `<-ch` 不能立即完成就会阻塞。`select` 等不等，要看有没有 `default`、有没有可执行的 case，以及编译器走哪条路径。

| 写法 | 没有 case 能立即完成时 | Go 1.26.4 中的主要实现路径 |
| --- | --- | --- |
| 只有一个通信 case，没有 default | 阻塞 | 可简化为一次普通收发 |
| 一个通信 case 加 default | 执行 default | `selectnbsend` 或 `selectnbrecv` |
| 多个通信 case，有 default | 执行 default | 通常进入 `selectgo`，不挂起等待 |
| 多个通信 case，没有 default | 等到某个 case 可以执行 | 通常进入 `selectgo`，必要时登记多个等待节点并挂起 |
| `select {}` | 永久阻塞当前 goroutine | 永久等待路径 |

“单个通信 case + default”确实会复用 `chansend(..., block=false)` 或 `chanrecv(..., block=false)`。但一般的多 case `select` 有自己的锁定、候选选择、入队和清理逻辑，不是挨个调用这两个非阻塞包装函数。[编译器分支](https://github.com/golang/go/blob/go1.26.4/src/cmd/compile/internal/walk/select.go)、[runtime 选择流程](https://github.com/golang/go/blob/go1.26.4/src/runtime/select.go)。

### 9.1 default 只负责“暂时没有可执行通信”

保存为 `select_states.go`，运行 `go run select_states.go`：

```go
package main

import "fmt"

func main() {
    var nilCh chan int
    select {
    case <-nilCh:
        fmt.Println("不会执行")
    default:
        fmt.Println("nil: default")
    }

    ch := make(chan int)
    select {
    case ch <- 1:
        fmt.Println("不会执行：此时没有接收者")
    default:
        fmt.Println("open: default")
    }

    close(ch)
    select {
    case value, ok := <-ch:
        fmt.Println("closed:", value, ok)
    default:
        fmt.Println("不会执行：关闭且读空的 channel 可立即接收")
    }
}
```

输出：

```text
nil: default
open: default
closed: 0 false
```

向已关闭的 channel 发送照样 panic，下面就算有 default，也不能“安全跳过”：

```go
ch := make(chan int)
close(ch)
select {
case ch <- 1: // 这个发送操作会 panic
default:
}
```

一般 `select` 同时有多个可执行 case 时，规范规定在它们之间均匀伪随机选择，写在前面不代表优先。发送到已关闭 channel 的 case 被选中，就会 panic。[Go 规范：Select statements](https://go.dev/ref/spec#Select_statements)。

### 9.2 nil channel 可以用来停用某个 case

关闭且读空的 channel 一直可以接收。循环 `select` 里如果只打印 `ok == false`，不退出也不停用这个 case，就可能一直空转。

```go
for left != nil || right != nil {
    select {
    case value, ok := <-left:
        if !ok {
            left = nil // 后续 select 不再选择这一支
            continue
        }
        consume(value)
    case value, ok := <-right:
        if !ok {
            right = nil
            continue
        }
        consume(value)
    }
}
```

这是个局部用法片段：`left`、`right` 是元素类型相同的 channel，`consume` 是业务处理函数。循环条件保证两个都变成 nil 后，不会再进入一个永远等不到结果的 `select`。把变量设成 nil，也不会改变其他变量引用的原 channel 对象。

## 10. Channel 还建立了哪些内存顺序

Channel 除了搬运值，还提供 goroutine 之间的同步关系。语言用 *synchronized before* 描述这些跨 goroutine 的先后约束，再和程序内的执行顺序一起建立 *happens before*。

和 channel 直接相关的三条规则：

1. 一次发送同步先于对应接收操作的完成。所以发送前已完成的写入，可以通过对应的接收建立可见性。
2. 关闭 channel 同步先于某个因关闭而返回零值的接收操作。
3. 容量为 C 的 channel，第 k 次接收同步先于第 k+C 次发送的完成。C 为 0 时，就是无缓冲 channel 里接收与对应发送完成之间的同步关系。

规则出自 [Go 内存模型的 Channel communication](https://go.dev/ref/mem#chan)。这不代表任意共享变量都自动安全了：接收完成以后，双方要是继续并发修改同一份数据，还是得自己做同步。

保存为 `publish_result.go`，运行 `go run publish_result.go`：

```go
package main

import "fmt"

func main() {
    done := make(chan struct{})
    var result string

    go func() {
        result = "ready"
        close(done)
    }()

    <-done
    fmt.Println(result)
}
```

输出 `ready`。写入 `result` 在 `close(done)` 之前，`<-done` 因关闭而完成，所以主 goroutine 在接收之后读取结果，有明确的同步关系。这里 `close` 用来发布完成状态，不用往 channel 里塞一个实际的数据元素。

反过来，一次有缓冲发送返回了，不能推断接收者已经完成后续写入：缓冲区有空位时，发送方可能在接收方运行之前就继续往下执行了。

## 11. 用一个完整程序观察缓冲区的顺序

保存为 `buffer_fifo.go`，运行 `go run buffer_fifo.go`：

```go
package main

import "fmt"

func main() {
    ch := make(chan string, 3)
    ch <- "A"
    ch <- "B"
    ch <- "C"

    entered := make(chan struct{})
    sent := make(chan struct{})
    go func() {
        close(entered)
        ch <- "D"
        close(sent)
    }()

    <-entered
    select {
    case <-sent:
        panic("尚未接收，满缓冲区中的 D 不可能发送完成")
    default:
        fmt.Println("D 尚未完成发送")
    }

    fmt.Println("第一次接收:", <-ch)
    <-sent // 等 D 完成交付，才关闭 channel
    close(ch)

    for value := range ch {
        fmt.Println("后续接收:", value)
    }
}
```

输出固定为：

```text
D 尚未完成发送
第一次接收: A
后续接收: B
后续接收: C
后续接收: D
```

这个程序验证的是公开行为：

- 缓冲区满了，新的发送完成不了
- 旧值先被接收
- 关闭后还能读完已发送的值

它没用 `time.Sleep` 去猜调度时机。

注意 `entered` 只说明发送 goroutine 已经跑到发送之前，不保证它已经进了 `sendq`。所以光看输出，证明不了某次执行一定走了“从等待发送者补位”这条内部路径。那条路径靠 `recv` 的源码解释，要验证还得用运行时跟踪或专门的调度控制。

## 12. 阅读源码时要避开的几个结论

| 常见说法 | 准确边界 |
| --- | --- |
| nil channel 收发一定导致程序死锁 | 它永久阻塞当前 goroutine；是否全局死锁取决于程序其余部分 |
| `mem == 0` 一定是无缓冲 channel | 零大小元素也会使 `mem == 0`，容量和阻塞规则仍保留 |
| Channel 分成 struct 型和 pointer 型分配 | 分配依据是元素是否含 GC 需要追踪的指针 |
| channel 头部固定 96 字节 | 大小与 Go 版本、架构和对齐有关 |
| 直接交付就是零拷贝 | 绕过缓冲区仍可能复制值；引用类元素也不会自动深拷贝 |
| goroutine 被唤醒就说明收发成功 | 关闭也会解除等待；要看通信结果 |
| 阻塞期间一直持锁，醒来后解锁 | 释放锁是挂起提交协议的一部分，对端必须能取得锁 |
| `ok` 就是 channel 还开着 | 关闭后残留值仍返回 true；关闭且读空才返回 false |
| select 内的通信全部非阻塞 | 没有 default 时可能挂起，多 case 还有专门实现 |
| close 会清空缓冲区、释放 channel | 缓冲值仍可接收，对象生命周期最终由引用和 GC 决定 |

## 参考资料

这篇根据《Golang Channel 实现原理》的粘贴材料整理。原材料没有保留作者、原文链接和图片文件；文中示意图是重新画的，并对照下面的官方资料修订了版本差异和行为细节。

- [Go 1.26.4：runtime/chan.go](https://github.com/golang/go/blob/go1.26.4/src/runtime/chan.go)：`hchan`、`makechan`、收发、关闭、等待队列。
- [Go 1.26.4：runtime/runtime2.go](https://github.com/golang/go/blob/go1.26.4/src/runtime/runtime2.go)：`sudog` 与 goroutine 相关结构。
- [Go 1.26.4：runtime/select.go](https://github.com/golang/go/blob/go1.26.4/src/runtime/select.go)：一般 `select` 的候选、锁定、等待与清理。
- [Go 1.26.4：编译器 walk/select.go](https://github.com/golang/go/blob/go1.26.4/src/cmd/compile/internal/walk/select.go)：不同 `select` 写法的编译处理。
- [Go 语言规范](https://go.dev/ref/spec)：Channel types、Send statements、Receive operator、Close、Select statements。
- [Go 内存模型](https://go.dev/ref/mem#chan)：channel 通信的同步关系。

文中四个完整程序在 Go 1.26.4 / Windows amd64 下跑过验证；流程片段和结构体摘录只用来读源码，不是能独立编译的 runtime 替代实现。
