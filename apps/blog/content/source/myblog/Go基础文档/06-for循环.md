---
title: "Go 基础（06）：for循环"
slug: go-basics-06-loops
date: "2026-10-13"
updated: "2026-10-13"
categories: ["Go"]
tags: ["Go", "Golang", "基础教程"]
course_order: 6
draft: false
---

# Go 基础（06）：for循环

[返回课程目录](https://blog.woodfish.site/posts/go-basics)

任何编程语言，都会有for循环，它的一般写法是

```Go
for 初始化;条件;操作{
}

```



例如求1+2+...+100的和

```Go
package main

import "fmt"

func main() {

  var sum = 0
  for i := 0; i <= 100; i++ {
    sum += i
  }
  fmt.Println(sum)
}

```



## for循环的五种变体



### 传统for循环

如上



### 死循环

每隔1秒打印当前的时间

```Go
package main

import (
  "fmt"
  "time"
)

func main() {

  for {
    time.Sleep(1 * time.Second)
    fmt.Println(time.Now().Format("2006-01-02 15:04:05")) // 年月日时分秒的固定格式
  }
}

```

### while模式

由于golang没有while循环，如果需要，则是由for循环稍微变化得来

```Go
package main

import "fmt"

func main() {

  i := 0
  sum := 0
  for i <= 100 {
    sum += i
    i++
  }
  fmt.Println(sum)
}

```

### do-while模式

do-while模式就是先执行一次循环体，再判断

```Go
package main

import "fmt"

func main() {

  i := 0
  sum := 0
  for {
    sum += i
    i++
    if i == 101 {
      break
    }
  }
  fmt.Println(sum)
}

```



### 遍历切片，map

遍历切片

第一个参数是索引，第二个参数是值

```Go
package main

import "fmt"

func main() {

  s := []string{"小明", "知道"}
  for index, s2 := range s {
    fmt.Println(index, s2)
  }
}

```

遍历map

第一个参数就是key，第二个就是value

```Go
package main

import "fmt"

func main() {

  s := map[string]int{
    "age":   24,
    "price": 1000,
  }
  for key, val := range s {
    fmt.Println(key, val)
  }
}

```





## break，continue

break用于跳出当前循环

continue用于跳过本轮循环

例如打印九九乘法表

```Go
package main

import "fmt"

func main() {

  for i := 1; i <= 9; i++ {
    for j := 1; j <= i; j++ {
      fmt.Printf("%d * %d = %d\t", i, j, i*j)
    }
    fmt.Println()
  }
}

```

除了这样写，还能这样写

```Go
package main

import "fmt"

func main() {

  for i := 1; i <= 9; i++ {
    for j := 1; j <= 9; j++ {
      if j > i {
        // 去掉 列比行大的数据
        continue
      }
      fmt.Printf("%d * %d = %d\t", i, j, i*j)
    }
    fmt.Println()
  }
}

```

---

[← 上一节：判断语句](https://blog.woodfish.site/posts/go-basics-05-conditionals) · [课程目录](https://blog.woodfish.site/posts/go-basics) · [下一节：函数 →](https://blog.woodfish.site/posts/go-basics-07-functions)
