---
title: "Java 面向对象核心：继承、多态、final、抽象类与接口"
slug: java-oop-inheritance-and-polymorphism
date: "2025-08-29"
categories: ["编程语言"]
tags: ["Java", "面向对象", "继承", "多态", "接口"]
---

Java 的面向对象机制围绕权限边界、单继承体系、运行期动态绑定与抽象契约展开。把构造器链、属性与方法的查找差异、`final` 的不可变边界，以及抽象类和接口的设计分工一次理清，写业务建模和排查 `ClassCastException` 时就不再靠猜。

## 权限修饰符与继承体系

访问权限决定了类成员（字段、方法、构造器）对外暴露的最小可见面，权限从严到宽依次为 `private < 缺省(包私有) < protected < public`：

| 修饰符 | 同类 | 同包其他类 | 不同包子类 | 任意类 |
| --- | --- | --- | --- | --- |
| `private` | 可见 | — | — | — |
| 缺省（不写修饰符） | 可见 | 可见 | — | — |
| `protected` | 可见 | 可见 | 可见 | — |
| `public` | 可见 | 可见 | 可见 | 可见 |

Java 的类严格采用**单继承**（一个类只能 `extends` 一个直接父类），但允许多层继承；所有未显式声明父类的类，默认继承 `java.lang.Object`。

子类方法访问成员遵循**就近原则**：先找当前方法局部变量，再找本类成员，最后逐级向上找父类成员。若子父类存在同名成员而必须访问父类版本，使用 `super.成员名` 显式指定。

方法重写（Override）用于子类替换父类实现，必须遵守几条硬规则：

1. 方法名与参数列表必须和父类完全一致，建议统一加上 `@Override` 让编译器校验签名，防止拼写错误悄然变成重载。
2. 子类重写方法的访问权限必须大于或等于父类方法，返回值类型需相同或是父类返回类型的子类型。
3. 父类中的 `private` 方法、`static` 方法和 `final` 方法均不能被重写。

**子类的所有构造器第一行默认隐式调用 `super()` 初始化父类状态；若父类没有无参构造器，子类构造器首行必须显式手写 `super(实参)`，且 `super(...)` 与调用本类兄弟构造器的 `this(...)` 都只能占构造器第一行，二者不能同时出现。**

```java
public class Student {
    private String name;
    private String schoolName;

    public Student(String name) {
        this(name, "woodfish"); // 委托给双参构造器，必须位于首行
    }

    public Student(String name, String schoolName) {
        super(); // 调用 Object 无参构造，写不写都会自动插入
        this.name = name;
        this.schoolName = schoolName;
    }
}
```

## 多态、动态绑定与类型转换边界

多态建立在“继承或接口实现 + 父类/接口引用指向子类对象 + 方法重写”三个条件之上，表现为对象形态与方法行为的动态分派：

```java
People p1 = new Student();
People p2 = new Teacher();
p1.run(); // 运行期动态绑定到 Student.run()
p2.run(); // 运行期动态绑定到 Teacher.run()
```

多态让调用方方法只需声明父类或接口形参即可接收任意子类实例，显著降低模块耦合度。但使用多态有两条必须留意的边界：

- **Java 中只有实例方法存在多态，成员变量（属性）不谈多态**——通过 `p.field` 读取字段时看的是编译期声明的引用类型，取决于左边声明的类型而非右边 `new` 出的实际对象。
- 多态引用在编译期看不到子类独有的方法，需要调用子类特有行为时必须向下转型。

**向上转型（父类引用接子类对象）自动安全，向下强制转型前必须先用 `instanceof` 检查真实类型，否则类型不匹配会在运行期抛出 `ClassCastException`。**

```java
People p = new Teacher();
if (p instanceof Student s) { // Java 16+ 支持 instanceof 模式匹配直接绑定变量
    s.study();
} else if (p instanceof Teacher t) {
    t.teach();
}
```

## final 关键字的三重语义

`final` 可以修饰类、方法和变量，核心语义是“禁止后续变更”：

- 修饰**类**（如 `String`）：最终类，禁止被任何类继承。
- 修饰**方法**：最终方法，子类可以继承调用但禁止重写。
- 修饰**变量**：该变量有且仅有一次赋值机会，赋值后不可再改。

**`final` 修饰基本类型变量时锁定的是数值本身；修饰引用类型变量时锁定的是引用指向的内存地址（不能再 `=` 指向新对象），但对象内部的属性和集合元素依然可以修改。**

```java
final int count = 10;
// count = 20; // 编译报错

final List<String> tags = new ArrayList<>();
tags.add("java"); // 合法：修改的是对象内部状态
// tags = new ArrayList<>(); // 编译报错：不能改变引用地址
```

## 抽象类与接口的工程取舍

抽象类和接口都不能直接 `new` 出实例，也都可以约束子类实现抽象方法并用于多态解耦，但两者的设计定位截然不同：

| 对比维度 | 抽象类（is what） | 接口（can do） |
| --- | --- | --- |
| 声明关键字 | `abstract class` | `interface` |
| 继承/实现方式 | 子类 `extends` 单继承 | 实现类 `implements` 多实现 |
| 成员变量 | 支持普通实例字段与常量 | 字段默认是 `public static final` 常量 |
| 方法形态 | 可包含抽象方法、构造器与完整实例方法 | 抽象方法；Java 8 起支持 `default`/`static` 方法，Java 9 起支持 `private` 方法 |
| 设计侧重点 | 抽取一组相关类的共同属性与复用模板流程 | 定义跨类家族的能力契约 |

子类继承抽象类或实现接口后，必须覆写全部未实现的抽象方法，否则该子类自身也必须声明为 `abstract`。

**一组强关联类型需要共享实例字段、构造逻辑和公共流程骨架时用抽象类；只为约定“能做什么能力”并保留多实现扩展空间时，优先定义接口。**

## 内部类与 Lambda 表达式

根据定义位置和修饰符不同，Java 内部类分为四种写法：

```java
public class OuterClass {
    private static int staticField = 20;
    private int instanceField = 10;

    // 1. 成员内部类：持有外部类实例引用，可直接访问外部私有成员
    public class InnerClass {
        public void display() {
            System.out.println("instanceField: " + instanceField);
        }
    }

    // 2. 静态内部类：不持有外部实例引用，只能直接访问外部静态成员
    public static class StaticInnerClass {
        public void display() {
            System.out.println("staticField: " + staticField);
        }
    }

    public void demoLocalAndAnonymous() {
        int localVar = 50; // 局部变量被内部类或 Lambda 捕获时需为 final 或事实不可变（effectively final）

        // 3. 局部内部类：作用域仅限当前方法内
        class LocalInner {
            void show() {
                System.out.println(instanceField + ", " + localVar);
            }
        }
        new LocalInner().show();

        // 4. 匿名内部类：适合一次性实现接口或抽象类
        Runnable legacyTask = new Runnable() {
            @Override
            public void run() {
                System.out.println("anonymous running");
            }
        };

        // Java 8+ 对函数式接口（仅含单个抽象方法）可直接简化为 Lambda
        Runnable lambdaTask = () -> System.out.println("lambda running");
        new Thread(legacyTask).start();
        new Thread(lambdaTask).start();
    }

    public static void main(String[] args) {
        OuterClass outer = new OuterClass();
        OuterClass.InnerClass inner = outer.new InnerClass();
        inner.display();

        OuterClass.StaticInnerClass staticInner = new OuterClass.StaticInnerClass();
        staticInner.display();
    }
}
```

**普通成员内部类会隐式持有外部类实例的强引用，在长生命周期任务（如后台线程、全局回调注册）里容易导致外部对象无法被 GC 回收；不需要访问外部实例成员时优先加 `static` 写成静态内部类。**
