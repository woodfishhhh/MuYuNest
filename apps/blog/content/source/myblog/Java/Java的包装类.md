---
title: "Java的包装类"
date: 2025-09-02 22:52:12
tags:
  - "Java"
  - "Java的包装类"
  - "包装类"
  - "对象"
categories:
  - "编程语言"
  - "Java"
---


## 为什么要有包装类，包装类有哪些？

- 为了万物皆对象，并且泛型和集合都不支持基本类型，支持包装类
- 8 种，int -> Integer，char -> Character，其他的都是首字母大写

## 包装类提供了哪些常用的功能？

- 可以把基本类型的数据转换成字符串类型。
  - public static String toString(double d)
  - public String toString
- 可以把字符串类型的数值转换成真实的数据类型。
  - public static int parseInt(String s)
  - public static Integer valueOf(String s)

## 装箱与拆箱

装箱：将一个基本数据类型变为包装类称为装箱操作

拆箱：将一个包装类变回基本数据类型，称为拆箱操作，转换的方法由Number类提供

下面看具体操作，这里以整形为例：

```java
public class WrapperDemo{
	public static void main(String[] args){
		int x1 = 1;	//基本数据类型
		Integer temp = new Integer(x);	//装箱操作
		int x2 = temp.intValue();	//拆箱操作
	}
}
```

JDK1.5之后，增加了自动装箱和拆箱的操作

```java
public class WrapperDemo{
	public static void main(String[] args){
		Integer temp = 1;	//自动装箱
		System.out.println(temp*temp);	//先自动拆箱，之后计算再装箱；
		int x = temp;		//自动拆箱
	}
}
```

------

## 包装类的valueOf和parseInt简略介绍

### valueOf

平时应该多用用静态的valueOf方法创建实例，通过valueOf创造的实例可以被共享，这没有问题，因为包装对象是不可变的。

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

课本原题

以下哪个语句可以编译成功

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

答案 `a、b、c、d、f、g、h、i、j`
