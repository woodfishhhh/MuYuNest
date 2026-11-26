---
title: "Java 包装类拆装箱与 Collection/List 集合体系"
slug: java-wrappers-and-collections
date: "2025-09-02"
categories: ["编程语言"]
tags: ["Java", "包装类", "集合框架", "List", "迭代器"]
---

Java 的泛型和集合框架只能存放对象引用，不能直接装基本数据类型，因此为 8 种基本类型配套了包装类。理解自动拆装箱背后的缓存机制、防空指针拆箱陷阱，以及 `Collection` 体系在遍历删除和底层实现上的差异，能避开线上大半高频集合 Bug。

## 包装类、自动拆装箱与 Integer 缓存

8 种基本类型中，除了 `int -> Integer`、`char -> Character` 命名特殊外，其余 6 种均为首字母大写（`Byte`、`Short`、`Long`、`Float`、`Double`、`Boolean`）。

从 JDK 5 开始，编译器会自动完成基本类型与包装类之间的转换：

```java
Integer boxed = 100;       // 自动装箱，编译为 Integer.valueOf(100)
int unboxed = boxed;       // 自动拆箱，编译为 boxed.intValue()
```

**自动拆箱在包装对象为 `null` 时会直接抛出 `NullPointerException`；数据库可空字段映射到实体类包装类型时，参与算术或条件判断前必须先判空。**

生产代码应统一用静态工厂 `Integer.valueOf(...)` 或自动装箱创建实例，避免使用已被 JDK 9 废弃的 `new Integer(...)` 构造方法，因为 `valueOf` 会复用内置缓存：

```java
Integer x1 = Integer.valueOf(127);
Integer x2 = Integer.valueOf(127);
Integer y1 = Integer.valueOf(200);
Integer y2 = Integer.valueOf(200);

System.out.println(x1 == x2);      // true：[-128, 127] 命中缓存同一对象
System.out.println(y1 == y2);      // false：超出缓存区间，各自新建对象
System.out.println(y1.equals(y2)); // true：比较数值必须用 equals
```

**`Integer` 默认只缓存 `[-128, 127]` 范围内的对象，包装类之间比较数值是否相等一律使用 `.equals()`，绝不能依赖 `==` 比较引用地址。**

字符串与数值互转常用两个静态方法：

- `Integer.parseInt("123")` / `Integer.parseInt("23", 8)`：直接返回基本类型 `int`（第二个参数可指定进制），避免多余装箱开销。
- `Integer.valueOf("123")`：返回 `Integer` 包装对象；`Double.valueOf("23.4")` 同理。

## Collection 单列集合体系与三种遍历

单列集合顶层接口 `Collection<E>` 下分两大主流体系：

- **`List` 系列**：元素有序（按插入顺序维护）、允许重复、支持按索引下标访问。
- **`Set` 系列**：元素不可重复、没有索引下标（`HashSet` 无序、`LinkedHashSet` 维护插入顺序、`TreeSet` 按比较器排序）。

遍历 `Collection` 有三种常用写法：

```java
List<String> names = new ArrayList<>(List.of("张无忌", "赵敏", "周芷若"));

// 1. Iterator 迭代器：唯一支持在增强遍历期间安全删除当前元素的标准方式
Iterator<String> it = names.iterator();
while (it.hasNext()) {
    String name = it.next(); // 未先判断 hasNext() 越界调用 next() 会抛 NoSuchElementException
    if ("赵敏".equals(name)) {
        it.remove(); // 安全删除，不会触发并发修改异常
    }
}

// 2. 增强 for 循环（for-each，底层编译为 Iterator）
for (String name : names) {
    System.out.println(name);
}

// 3. Iterable.forEach + Lambda / 方法引用
names.forEach(System.out::println);
```

**增强 `for` 循环与 `forEach` Lambda 内部隐藏了迭代器状态，遍历过程中直接调用集合自身的 `add` 或 `remove` 会立即触发 `ConcurrentModificationException`；需要在遍历中删除元素时，必须用 `Iterator.remove()`、JDK 8 的 `removeIf(...)`，或者使用带下标的普通 `for` 循环配合 `i--` / 倒序遍历。**

## List 常用索引 API 与实现选型

`List<E>` 在 `Collection` 基础上增加了基于整数下标的随机读写接口：

| 方法 | 作用 | 注意点 |
| --- | --- | --- |
| `void add(int index, E element)` | 在指定位置插入元素 | 后续元素整体后移 |
| `E get(int index)` | 按索引读取元素 | 下标越界抛 `IndexOutOfBoundsException` |
| `E set(int index, E element)` | 替换指定索引元素并返回旧值 | — |
| `E remove(int index)` | 按索引删除元素并返回被删元素 | 对 `List<Integer>` 传 `1` 会按索引删，删数值 `1` 需写 `Integer.valueOf(1)` |

在具体实现选型上，最常见的是 `ArrayList` 和 `LinkedList`：

- **`ArrayList`**：底层是连续动态数组，按索引随机访问时间复杂度为 `O(1)`，CPU 缓存局部性极好，尾插均摊 `O(1)`，只在数组中间插删时需搬移元素（`O(n)`）。
- **`LinkedList`**：底层是双向链表，头尾插删为 `O(1)`，但按索引 `get(index)` 需要从头或尾遍历（`O(n)`），且每个节点都要额外分配前后指针内存。

**绝大多数业务场景优先选用 `ArrayList`（或结合 `ArrayDeque` 做双端队列），只有在频繁从中间或两端切分且几乎不做随机下标读取时才考虑 `LinkedList`。**
