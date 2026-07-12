---
title: "Java List 集合：特点与常用 API"
date: 2025-08-29 13:49:53
tags:
  - "List"
  - "ArrayList"
  - "LinkedList"
  - "集合API"
categories:
  - "编程语言"
  - "Java"
---


List继承了Collection


1、List 系列集合的特点是什么？

● ArrayList、LinkedList：有序，可重复，有索引。

2、List 提供了哪些独有的方法？

| 方法名称                      | 说明                                   |
| ----------------------------- | :------------------------------------- |
| void add(int index,E element) | 在此集合中的指定位置插入指定的元素     |
| E remove(int index)           | 删除指定索引处的元素，返回被删除的元素 |
| E set(int index,E element)    | 修改指定索引处的元素，返回被修改的元素 |
| E get(int index)              | 返回指定索引处的元素                   |