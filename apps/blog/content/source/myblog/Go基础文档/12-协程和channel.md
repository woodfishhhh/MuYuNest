---
title: "Go 基础（12）：协程和channel"
slug: go-basics-12-goroutines-channels
date: "2026-10-13"
updated: "2026-10-13"
categories: ["Go"]
tags: ["Go", "Golang", "基础教程"]
course_order: 12
draft: false
---

# Go 基础（12）：协程和channel

[返回课程目录](https://blog.woodfish.site/posts/go-basics)

## 协程

Goroutine是Go运行时管理的轻量级线程

在go中，开启一个协程是非常简单的



```Go
package main

import (
  "fmt"
  "time"
)

func sing() {
  fmt.Println("唱歌")
  time.Sleep(1 * time.Second)
  fmt.Println("唱歌结束")
}

func main() {
  go sing()
  go sing()
  go sing()
  go sing()
  time.Sleep(2 * time.Second)
}

```



如果我把这个主线程中的延时去掉之后，你会发现程序没有任何输出就结束了

这是为什么呢

那是因为主线程结束协程自动结束，主线程不会等待协程的结束



### WaitGroup

我们只需要让主线程等待协程就可以了，它的用法是这样的

```Go
package main

import (
  "fmt"
  "sync"
  "time"
)

var (
  wait = sync.WaitGroup{}
)

func sing() {
  fmt.Println("唱歌")
  time.Sleep(1 * time.Second)
  fmt.Println("唱歌结束")
  wait.Done()
}

func main() {
  wait.Add(4)
  go sing()
  go sing()
  go sing()
  go sing()
  wait.Wait()
  fmt.Println("主线程结束")
}

```





## channel

有没有想过一个问题，我在协程里面产生了数据，咋传递给主线程呢？

或者是怎么传递给其他协程函数呢？

这个时候 channel来了



### 基本定义

```Go
package main

import "fmt"

func main() {
  var c chan int // 声明一个传递整形的通道
  // 初始化通道
  c = make(chan int, 1) //  初始化一个 有一个缓冲位的通道
  c <- 1
  //c <- 2 // 会报错 deadlock
  fmt.Println(<-c) // 取值
  //fmt.Println(<-c) // 再取也会报错  deadlock

  c <- 2
  n, ok := <-c
  fmt.Println(n, ok)
  close(c) // 关闭协程
  c <- 3   // 关闭之后就不能再写或读了  send on closed channel
  fmt.Println(c)
}

```



当然，在同步模式下，channel没有任何意义

需要在异步模式下使用channel，在协程函数里面写，在主线程里面接收数据

```Go
package main

import (
  "fmt"
  "sync"
  "time"
)

var moneyChan = make(chan int) // 声明并初始化一个长度为0的信道

func pay(name string, money int, wait *sync.WaitGroup) {
  fmt.Printf("%s 开始购物\n", name)
  time.Sleep(1 * time.Second)
  fmt.Printf("%s 购物结束\n", name)

  moneyChan <- money

  wait.Done()
}

// 协程
func main() {
  var wait sync.WaitGroup
  startTime := time.Now()
  // 现在的模式，就是购物接力
  //shopping("张三")
  //shopping("王五")
  //shopping("李四")
  wait.Add(3)
  // 主线程结束，协程函数跟着结束
  go pay("张三", 2, &wait)
  go pay("王五", 3, &wait)
  go pay("李四", 5, &wait)

  go func() {
    defer close(moneyChan)
    // 在协程函数里面等待上面三个协程函数结束
    wait.Wait()
  }()

  for {
    money, ok := <-moneyChan
    fmt.Println(money, ok)
    if !ok {
      break
    }
  }

  //time.Sleep(2 * time.Second)

  fmt.Println("购买完成", time.Since(startTime))
  fmt.Println("moneyList", moneyList)
}


```



如果这样接收数据不太优雅，那还有更优雅的写法

```Go
  for money := range moneyChan {
    moneyList = append(moneyList, money)
  }

```

如果通道被close，for循环会自己结束，十分优雅



## select

如果一个协程函数，往多个channel里面写东西，在主线程里面怎么拿数据呢？

go为我们提供了select，用于异步的从多个channel里面去取数据

```Go
package main

import (
  "fmt"
  "sync"
  "time"
)

var moneyChan1 = make(chan int)    // 声明并初始化一个长度为0的信道
var nameChan1 = make(chan string)  // 声明并初始化一个长度为0的信道
var doneChan = make(chan struct{}) // 声明一个用于关闭的信道

func send(name string, money int, wait *sync.WaitGroup) {
  fmt.Printf("%s 开始购物\n", name)
  time.Sleep(1 * time.Second)
  fmt.Printf("%s 购物结束\n", name)

  moneyChan1 <- money
  nameChan1 <- name

  wait.Done()
}

// 协程
func main() {
  var wait sync.WaitGroup
  startTime := time.Now()
  // 现在的模式，就是购物接力
  //shopping("张三")
  //shopping("王五")
  //shopping("李四")
  wait.Add(3)
  // 主线程结束，协程函数跟着结束
  go send("张三", 2, &wait)
  go send("王五", 3, &wait)
  go send("李四", 5, &wait)

  go func() {
    defer close(moneyChan1)
    defer close(nameChan1)
    defer close(doneChan)
    wait.Wait()
  }()

  var moneyList []int
  var nameList []string

  var event = func() {
    for {
      select {
      case money := <-moneyChan1:
        moneyList = append(moneyList, money)
      case name := <-nameChan1:
        nameList = append(nameList, name)
      case <-doneChan:
        return
      }
    }
  }
  event()
  fmt.Println("购买完成", time.Since(startTime))
  fmt.Println("moneyList", moneyList)
  fmt.Println("nameList", nameList)

}

```



## 协程超时处理

```Go
package main

import (
  "fmt"
  "time"
)

var done = make(chan struct{})

func event() {
  fmt.Println("event执行开始")
  time.Sleep(2 * time.Second)
  fmt.Println("event执行结束")
  close(done)
}

func main() {
  go event()

  select {
  case <-done:
    fmt.Println("协程执行完毕")
  case <-time.After(1 * time.Second):
    fmt.Println("超时")
    return
  }

}


```



## 参考文档

go channel [https://zhuanlan.zhihu.com/p/643013131](https://zhuanlan.zhihu.com/p/643013131)

go select [https://zhuanlan.zhihu.com/p/617487667](https://zhuanlan.zhihu.com/p/617487667)

---

[← 上一节：接口](https://blog.woodfish.site/posts/go-basics-11-interfaces) · [课程目录](https://blog.woodfish.site/posts/go-basics) · [下一节：线程安全 →](https://blog.woodfish.site/posts/go-basics-13-concurrency-safety)
