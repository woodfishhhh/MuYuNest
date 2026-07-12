---
title: "Java的内部类"
date: 2025-08-29 13:49:41
tags:
  - "Java"
  - "Java的内部类"
  - "内部类"
  - "面向对象"
categories:
  - "编程语言"
  - "Java"
---


### 成员内部类

成员内部类直接定义在外部类里，与外部类的属性和方法处于同一层级。它能够访问外部类的所有成员，包括私有成员。

```java
public class OuterClass {
    private int outerField = 10;

    public class InnerClass {
        public void display() {
            System.out.println("外部类的字段: " + outerField);
        }
    }

    public void createInner() {
        InnerClass inner = new InnerClass();
        inner.display();
    }

    public static void main(String[] args) {
        OuterClass outer = new OuterClass();
        outer.createInner(); // 输出: 外部类的字段: 10

        // 也可以这样创建内部类实例
        OuterClass.InnerClass inner = outer.new InnerClass();
        inner.display(); // 输出: 外部类的字段: 10
    }
}
```

### 静态内部类

静态内部类用 `static` 关键字修饰，它不能直接访问外部类的非静态成员。

```java
public class OuterClass {
    private static int staticField = 20;
    private int instanceField = 30;

    public static class StaticInnerClass {
        public void display() {
            System.out.println("静态字段: " + staticField);
            // 下面这行代码会报错，因为静态内部类不能直接访问外部类的非静态成员
            // System.out.println("实例字段: " + instanceField); 
        }
    }

    public static void main(String[] args) {
        OuterClass.StaticInnerClass inner = new OuterClass.StaticInnerClass();
        inner.display(); // 输出: 静态        inner.display(); // 输出: 静态字段: 20
    }
}
```

### 局部内部类

局部内部类定义在方法或者代码块内部，其作用域仅限于该方法或代码块。

```java
public class OuterClass {
    private int outerField = 40;

    public void methodWithLocalInner() {
        final int localVariable = 50; // 在 Java 8 及以后版本中，局部变量可以不显式声明为 final

        class LocalInnerClass {
            public void display() {
                System.out.println("外部类字段: " + outerField);
                System.out.println("局部变量: " + localVariable);
            }
        }

        LocalInnerClass inner = new LocalInnerClass();
        inner.display();
    }

    public static void main(String[] args) {
        OuterClass outer = new OuterClass();
        outer.methodWithLocalInner(); 
        // 输出:
        // 外部类字段: 40
        // 局部变量: 50
    }
}
```

### 匿名内部类

匿名内部类没有具体的类名，通常用于创建接口或者抽象类的实例。

```java
public class OuterClass {
    public void createAnonymous() {
        // 创建一个实现了 Runnable 接口的匿名内部类
        Runnable runner = new Runnable() {
            @Override
            public void run() {
                System.out.println("匿名内部类正在运行");
            }
        };

        new Thread(runner).start(); // 输出: 匿名内部类正在运行

        // 也可以直接这样使用
        new Thread(new Runnable() {
            @Override
            public void run() {
                System.out.println("另一个匿名内部类");
            }
        }).start(); // 输出: 另一个匿名内部类
    }

    public static void main(String[] args) {
        OuterClass outer = new OuterClass();
        outer.createAnonymous();
    }
}
```

### Lambda 表达式（Java 8+）

Lambda 表达式是匿名内部类的一种简化形式，专门用于函数式接口（即只包含一个抽象方法的接口）。

```java
public class LambdaExample {
    public static void main(String[] args) {
        // 使用 Lambda 表达式实现 Runnable 接口
        Runnable runner = () -> System.out.println("Lambda 表达式正在运行");
        new Thread(runner).start(); // 输出: Lambda 表达式正在运行

        // 更简洁的写法
        new Thread(() -> System.out.println("更简洁的 Lambda")).start(); 
        // 输出: 更简洁的 Lambda
    }
}
```