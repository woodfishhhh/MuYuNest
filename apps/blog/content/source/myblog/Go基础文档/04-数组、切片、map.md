---
title: "Go 基础（04）：数组、切片、map"
slug: go-basics-04-arrays-slices-maps
date: "2026-10-13"
updated: "2026-10-13"
categories: ["Go"]
tags: ["Go", "Golang", "基础教程"]
course_order: 4
draft: false
---

# Go 基础（04）：数组、切片、map

[返回课程目录](https://blog.woodfish.site/posts/go-basics)

## 数组

数组（Array）是一种非常常见的数据类型，几乎所有的计算机编程语言中都会用到它

1. 数组里的元素必须全部为同一类型，要嘛全部是字符串，要嘛全部是整数
2. 声明数组时，必须指定其长度或者大小

```Go
package main

import "fmt"

func main() {
  var array [3]int = [3]int{1, 2, 3}
  fmt.Println(array)
  var array1 = [3]int{1, 2, 3}
  fmt.Println(array1)
  var array2 = [...]int{1, 2, 3}
  fmt.Println(array2)
}

```

如果要修改某个值，只能根据索引去找然后替换

```Go
var array1 = [3]int{1, 2, 3}
array1[0] = 10 // 根据索引找到对应的元素位置，然后替换
fmt.Println(array1)
```



### 索引

索引这个知识点，如果刚学编程，那么就得仔细听了，这个知识点到后面我就默认你已经会了

```Go
package main

import "fmt"

func main() {
  // 以定义一个字符串数组 a b c d 为例
  var sList = []string{"a", "b", "c", "d"}
  // 正向索引就从0开始，从左往右
  /*
    a     b     c     d
    0     1     2     3
  */
  // 取值就通过索引去取
  fmt.Println(sList[0]) // 拿到a这个元素
  // 当然，有的语言支持负向索引，go不支持
  /*
      a      b     c     d
      -4    -3    -2    -1
  */
  // 如果在go语言里面，我想拿到倒数第二个元素，怎么办？
  fmt.Println(sList[len(sList)-2]) // 拿到a这个元素
}

```



## 切片

很明显啊，go里面的数组，长度被限制死了，所以不经常用

所以go出了一个数组plus，叫做slice（切片）

切片（Slice）相较于数组更灵活，因为在声明切片后其长度是可变的



```Go
package main

import "fmt"

func main() {
  // 定义一个字符串切片
  var list []string

  list = append(list, "小明")
  list = append(list, "知道")
  fmt.Println(list)
  fmt.Println(len(list)) // 切片长度
  // 修改第二个元素
  list[1] = "不知道"
  fmt.Println(list)
}

```





### make函数

除了基本数据类型，其他数据类型如果只定义不赋值，那么实际的值就是nil

```Go
// 定义一个字符串切片
var list []string
fmt.Println(list == nil) // true
```



那么我们可以通过make函数创建指定长度、指定容量的切片了

```Go
make([]type, length, capacity)
```



```Go
package main

import "fmt"

func main() {
  // 定义一个字符串切片
  var list = make([]string, 0)
  fmt.Println(list, len(list), cap(list))
  fmt.Println(list == nil) // false

  list1 := make([]int, 2, 2)
  fmt.Println(list1, len(list1), cap(list1))
}

```



### 为什么叫切片

因为切片是数组切出来的

```Go
package main

import "fmt"

func main() {
  var list = [...]string{"a", "b", "c"}
  slices := list[:] // 左一刀，右一刀  变成了切片
  fmt.Println(slices)
  fmt.Println(list[1:2]) // b
}

```



### 切片排序

```Go
var list = []int{4, 5, 3, 2, 7}
fmt.Println("排序前:", list)
sort.Ints(list)
fmt.Println("升序:", list)
sort.Sort(sort.Reverse(sort.IntSlice(list)))
fmt.Println("降序:", list)
```



## map

Go语言中的map(映射、字典)是一种内置的数据结构，它是一个`无序`的key-value对的集合

map的key必须是基本数据类型，value可以是任意类型

> 注意，map使用之前一定要初始化

```Go
package main

import "fmt"

func main() {
  // 声明
  var m1 map[string]string
  // 初始化1
  m1 = make(map[string]string)
  // 初始化2
  m1 = map[string]string{}
  // 设置值
  m1["name"] = "小明"
  fmt.Println(m1)
  // 取值
  fmt.Println(m1["name"])
  // 删除值
  delete(m1, "name")
  fmt.Println(m1)
}

```



也可以声明并赋值

```Go
// 声明并赋值
var m1 = map[string]string{}
var m2 = make(map[string]string)
```



### map取值

如果只有一个参数接，那这个参数就是值，如果没有，这个值就是类型的零值

如果两个参数接，那第二个参数就是布尔值，表示是否有这个元素

```Go
package main

import "fmt"

func main() {
  // 声明并赋值
  var m1 = map[string]int{
    "age": 21,
  }
  age1 := m1["age1"] // 取一个不存在的
  fmt.Println(age1)
  age2, ok := m1["age1"]
  fmt.Println(age2, ok)
}

```





## 参考文档

1. 数组与切片 [https://zhuanlan.zhihu.com/p/456844080](https://zhuanlan.zhihu.com/p/456844080)
2. map [https://blog.csdn.net/qq_39312146/article/details/127914811](https://blog.csdn.net/qq_39312146/article/details/127914811)
3.

---

[← 上一节：基本数据类型](https://blog.woodfish.site/posts/go-basics-03-data-types) · [课程目录](https://blog.woodfish.site/posts/go-basics) · [下一节：判断语句 →](https://blog.woodfish.site/posts/go-basics-05-conditionals)
