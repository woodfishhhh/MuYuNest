---
title: "Java Collection：集合体系与遍历方法"
date: 2025-09-02 23:28:49
tags:
  - "Collection"
  - "List"
  - "Set"
  - "Iterator"
  - "Lambda"
categories:
  - "编程语言"
  - "Java"
---


***单列集合***

Collection 集合有哪两大常用的集合体系，各自有啥特点？

- List 系列集合：添加的元素是有序、可重复、有索引。
- Set 系列集合：添加的元素是无序、不重复、无索引。


***Collection遍历方法***

**迭代器**

1、如何获取集合的迭代器？迭代器遍历集合的代码具体怎么写？
● Iterator<E> iterator ：得到迭代器对象，默认指向当前集合的索引 0

2、通过迭代器获取集合的元素，如果取元素越界会出现什么异常？
● 会出现 NoSuchElementException 异常。


**for-each(增强for)**

就for循环就行


**lambda表达式**

类似以下三种lambda表达式

```java
Collection<String> names = new ArrayList<>();
names.add ("张无忌");
names.add ("玄冥二老");
names.add ("宋青书");
names.add ("殷素素");

names.forEach(new Consumer<String>() {
	@Override
	public void accept(String s) {
	System.out.println(s);
	}
});

names.forEach(s -> System.out.println(s));

names.forEach(System.out::println);
}
```

源码模版如下

```java
default void forEach(Consumer<? super T> action) {
	Objects.requireNonNull(action);
	for (T t : this) {
	action.accept(t);
	}
}
```


① 如果集合支持索引，可以使用 for 循环遍历，每删除数据后做 i--；或者可以倒着遍历。
② 可以使用迭代器遍历，并用迭代器提供的删除方法删除数据。


**注意：增强 for 循环 / Lambda 遍历均不能解决并发修改异常问题，因此它们只适合做数据的遍历，不适合同时做增删操作。**


