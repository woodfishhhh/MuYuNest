---
title: "Java的多态"
date: 2025-08-29 13:49:40
tags:
  - "Java"
  - "Java的多态"
  - "继承"
  - "多态"
  - "对象"
categories:
  - "编程语言"
  - "Java"
---


多态是在继承 / 实现情况下的一种现象，表现为：对象多态、行为多态。
多态的具体代码体现

```java
People p1 = new Student ()
p1.run (); 

People p2 = new Teacher ()
p2.run ();
```

### 多态的前提

- 有继承 / 实现关系；存在父类引用子类对象；存在方法重写。

### 多态的一个注意事项

- 多态是对象、行为的多态，Java 中的属性 (成员变量) 不谈多态。

### 使用多态有什么好处？存在什么问题？

- 解耦合；使用父类类型的变量作为方法的形参时，可以接收一切子类对象。
- 多态下不能直接调用子类的独有方法。


## 多态下的类型转换问题

**自动类型转换**：父类 变量名 = new 子类 ; 例如：

```java
People = new Teacher ();
```

**强制类型转换**：子类变量名 =(子类) 父类变量 例如

```
Teacher t = (Teacher) p;
```

### 强制类型转换的一个注意事项

- 存在继承 / 实现关系就可以在编译阶段进行强制类型转换，编译降阶段不会报错。
- 运行时，如果发现对象的真实类型与强转后的类型不同，就会报类型转换异常 (ClassCastException) 的错误出来。

```java
People p = new Teacher ();
Student s = (Student) p; //java.Lang.CLassCastEception
```

**强转前，Java 建议:**
使用 instanceof 关键字，判断当前对象的真实类型，再进行强转。

```java
p instanceof Student
```
