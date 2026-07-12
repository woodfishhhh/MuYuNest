---
title: "Java 期末复习重点与易错点"
date: 2025-09-02 23:27:32
tags:
  - "Java"
  - "期末复习"
  - "易错点"
  - "面向对象"
categories:
  - "编程语言"
  - "Java"
---

**方法重载满足：**

1.方法名**必须相同**

2.参数列表**不同**（参数的**个数**不同、参数的**类型**不同、**类型的次序**不同）

3.与返回值类型是否相同**无关**（即返回值不作为判断重载的条件）

**有抽象方法，就一定是抽象类**

**抽象类中可以包含非抽象方法（普通方法）**

---

分析下面代码, 当调用nPrint('a', 4)方法时会出现什么结果？。

```java
static void nPrint(String message, int n) {
	while (n > 0) {
		System.out.print(message);
		n--;
	}
}
```

A) aaaaa			B)  aaaa

C) aaa		    	D) 非法调用

~~选D，因为传入'a'的类型为char，而函数参数是String~~

---

Math.random

其取值范围是大于等于 0.0 且小于 1.0，也就是区间 `[0.0, 1.0)`

e.g.

(char)('a' + Math.random * ('z' - 'a' + 1)) 返回下面哪个区间的随机字符？

A) between 'a' and 'z'			B) between 'a' and 'y'

C) between 'b' and 'z'			D) between 'b' and 'y'

~~选A~~

---

**抽象类和接口**


| **对比维度**   | **抽象类(is what)**                                     | **接口(can do)**                                                                                       |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **定义方式**   | **借助 abstract class 来定义**                          | **通过 interface 进行定义**                                                                            |
| **实现手段**   | **利用 extends 关键字实现继承**                         | **使用 implements 关键字实现接口**                                                                     |
| **成员变量**   | **可以包含普通变量和常量**                              | **只能是 public static final 类型的常量**                                                              |
| **方法类型**   | **能够有抽象方法，也能有具体实现的方法**                | **所有方法默认是 public abstract 的（Java 8 及之后版本允许有默认方法和静态方法），而且不能有方法体{}** |
| **多继承支持** | **仅支持单继承（一个类只能继承一个抽象类）**            | **支持多实现（一个类可实现多个接口）**                                                                 |
| **设计侧重点** | **强调 “是什么”，用于对一组相关类的共同特征进行抽象** | **着重 “能做什么”，定义了一种行为规范或契约**                                                        |

## 相同点:

**1、多是抽象形式,都可以有抽象方法,都不能创建对象。** **2、都是派生子类形式:抽象类是被子类继承使用,接口是被实现类实现。** **3、若未全部重写抽象方法，该类需被定义为抽象类，否则编译报错****4、都能支持的多态,都能够实现解耦合。**

## 不同点:

**1、抽象类中可以定义类的全部普通成员,接口只能定义常量,抽象方法(JDK8新增的三种方式)** **2、抽象类只能被类单继承,接口可以被类多实现。** **3、一个类继承抽象类就不能再继承其他类,一个类实现了接口(还可以继承其他类或者实现其他接口)。** **4、抽象类体现模板思想:更利于做父类,实现代码的复用性。** **5、接口更适合做功能的解耦合:解耦合性更强更灵活。**

---

**请简述Java中this和super关键字的含义和作用**

* `this`主要用于引用当前对象，可解决变量名冲突问题，还能调用本类的构造函数。
* `super`主要用于引用父类的成员，可调用父类的构造函数以及访问父类的方法和字段。

```plaintext
this 关键字
this关键字代表的是当前对象的引用，其主要作用如下：
区分同名变量：当成员变量和局部变量（像参数）重名时，可借助this来明确引用成员变量。
调用本类的构造函数：在一个构造函数里，能够使用this()的形式调用本类的其他构造函数。
返回当前对象：在方法中，可以使用return this让方法返回当前对象的引用。
传递当前对象：把当前对象当作参数传递给其他方法或者构造函数。

```

```plaintext
super 关键字
super关键字用于引用父类的成员，其作用主要有：
调用父类的构造函数：在子类的构造函数中，可使用super()来调用父类的构造函数，而且这一调用必须放在第一行。
访问父类的成员：当子类重写了父类的方法或者隐藏了父类的字段时，可通过super.方法名()或者super.字段名来引用父类的版本。
调用父类的被重写方法：在子类中，能够利用super.方法名()调用父类中被重写的方法。
```

---

开头

```java
import java.until,scanner;
public class text{
    public static void main(String[] arg){
    }
}
```

---

## 权限修饰符

**就是用来限制类中的成员 (成员变量、成员方法、构造器) 能够被访问的范围。**


| **本类**      | **修饰符** | **同一个包中的类** | **子孙类** | **任意类** |
| ------------- | ---------- | ------------------ | ---------- | ---------- |
| **private**   | **√**     |                    |            |            |
| **默认**      | **√**     | **√**             |            |            |
| **protected** | **√**     | **√**             | **√**     |            |
| **public**    | **√**     | **√**             | **√**     | **√**     |

#### private < 默认 < protected< public

---

## 包装类的valueOf和parseInt简略介绍

## valueOf

**平时应该多用用静态的valueOf方法创建实例，通过valueOf创造的实例可以被共享，这没有问题，因为包装对象是不可变的。**

```java
Integer x1 = new Interger("32");
Integer x2 = new Interger("32");
Integer x3 = Interger.valueOf("32");//注意这里是静态方法
Integer x4 = Interger.valueOf("32");
Integer x5 = 32;

sout(x1==x2)//false, 因为两者地址不同
sout(x1==x3)//false, 地址不同
sout(x3==x4)//true, 如果值在缓存范围内,多次调用valueOf会返回同一缓存对象,因此x3和x4指向同一缓存对象
sout(x3==x5)//true, Java自动将基本类型int装箱为Integer时,底层调用的是Integer.valueOf(),同上
```

**课本原题**

**以下哪个语句可以编译成功**

```java
a. Integer i = new Integer("23");//字符串形构造
b. Integer i = new Integer(23);//int构造
c. Integer i = Integer.valueOf("23");//静态方法构造
d. Integer i = Integer.parseInt("23", 8);//将23按照8进制解读
e. Double d = new Double();//Double没有空参构造方法(jdk8以后)
f. Double d = Double.valueOf("23.45");//静态方法构造
g. int i = (Integer.valueOf("23")).intValue();//先得到Interger对象,再拆箱为int
h. double d = (Double.valueOf("23.4")).doubleValue();//类上
i. int i = (Double.valueOf("23.4")).intValue();//强制转换,截断小数
j. String s = (Double.valueOf("23.4")).toString();//得到一个Double对象,然后toString
```

***答案***

`a、b、c、d、f、g、h、i、j`

## parseInt

基本用法

```java
int num = Integer.parseInt("123");  // 返回 123
int negative = Integer.parseInt("-456");  // 返回 -456
```

指定进制转换

```java
int binary = Integer.parseInt("101", 2);  // 二进制转十进制，返回 5
```

字符串必须是 **纯数字**（允许以 `+` 或 `-` 开头）

类似的,还有parseLong,parseDouble,parseByte等,不考不赘述

---

.length返回数组的长度

.length返回字符串的长度

.charAt(index)返回字符串中指定位置的字符

---

Final，static，继承，多态，去我的别的博客看
