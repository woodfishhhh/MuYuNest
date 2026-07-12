---
title: "C++ STL 到 JavaScript：常用数据结构映射速查"
date: 2025-12-24 15:58:56
tags:
  - "C++ STL"
  - "JavaScript"
  - "Array"
  - "Map"
  - "数据结构"
categories:
  - "编程语言"
  - "JavaScript"
---


## C++ STL 与 JavaScript 的对应关系学习笔记

```js
// /**
//  * C++ STL 与 JavaScript 的对应关系学习笔记
//  * ==========================================
//  */
// 1. std::vector (动态数组)
// C++: std::vector<int> v; v.push_back(1);
// JS: Array
// JS 的 Array 是动态的，可以存储不同类型，但在算法题中通常存同类型。
const vector = [];
vector.push(1); // push_back
vector.push(2);
vector.pop(); // pop_back
console.log("Vector (Array):", vector);

// 2. std::stack (栈)
// C++: std::stack<int> s; s.push(1); s.pop();
// JS: Array (使用 push 和 pop)
const stack = [];
stack.push(1);
stack.push(2);
const top = stack.pop(); // 返回并删除栈顶元素
console.log("Stack top:", top);

// 3. std::queue (队列)
// C++: std::queue<int> q; q.push(1); q.pop();
// JS: Array (使用 push 和 shift)
// 注意: shift() 是 O(n) 操作，因为需要移动数组元素。
// 对于大数据量，建议使用链表或双栈实现队列。
const queue = [];
queue.push(1);
queue.push(2);
const front = queue.shift(); // pop front
console.log("Queue front:", front);

// 4. std::deque (双端队列)
// C++: std::deque<int> d;
// JS: Array (push/pop 处理尾部, unshift/shift 处理头部)
const deque = [];
deque.unshift(0); // push_front
deque.push(1); // push_back
deque.shift(); // pop_front
deque.pop(); // pop_back

// 5. std::map (有序映射) / std::unordered_map (哈希表)
// C++: std::map<string, int> m; m["key"] = 1;
// JS: Map (ES6)
// Map 保持插入顺序 (类似 LinkedHashMap)，查找/插入/删除平均 O(1)。
// Object 也可以作为哈希表，但 Key 只能是 String 或 Symbol。
const map = new Map();
map.set("key", 1);
map.set("key2", 2);
console.log("Map has 'key':", map.has("key"));
console.log("Map get 'key':", map.get("key"));
// 遍历
for (const [k, v] of map) {
  console.log(`Map Item: ${k} -> ${v}`);
}

// 6. std::set (有序集合) / std::unordered_set (哈希集合)
// C++: std::set<int> s; s.insert(1);
// JS: Set (ES6)
// Set 保持插入顺序，查找/插入/删除平均 O(1)。
const set = new Set();
set.add(1);
set.add(2);
set.add(1); // 重复元素被忽略
console.log("Set has 1:", set.has(1));

// 7. std::pair / std::tuple
// C++: std::pair<int, string> p = {1, "a"};
// JS: Array (解构赋值) 或 Object
const pair = [1, "a"];
const [first, second] = pair;

// 8. Algorithms (常用算法)

const arr = [3, 1, 4, 1, 5, 9];

// std::sort
// JS: Array.prototype.sort (原地排序)
// 注意: 默认是按字符串 Unicode 码点排序，数字排序必须提供比较函数！
// C++: std::sort(v.begin(), v.end());
arr.sort((a, b) => a - b); // 升序
console.log("Sorted:", arr);

// std::find
// JS: Array.prototype.find (返回元素) / findIndex (返回索引)
// C++: std::find(v.begin(), v.end(), 3);
const found = arr.find((x) => x > 3);
console.log("Find > 3:", found);

// std::transform
// JS: Array.prototype.map (返回新数组)
// C++: std::transform(...)
const doubled = arr.map((x) => x * 2);
console.log("Transform (map):", doubled);

// std::for_each
// JS: Array.prototype.forEach
// C++: std::for_each(...)
arr.forEach((x) => {});

// std::accumulate
// JS: Array.prototype.reduce
// C++: std::accumulate(v.begin(), v.end(), 0);
const sum = arr.reduce((acc, cur) => acc + cur, 0);
console.log("Accumulate (reduce):", sum);

// std::priority_queue (优先队列)
// JS: 无内置，需要手写堆 (Heap) 或使用第三方库
// 这是一个简单的最小堆实现示例：
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(val) {
    this.heap.push(val);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  peek() {
    return this.heap[0];
  }
  size() {
    return this.heap.length;
  }

  bubbleUp(index) {
    while (index > 0) {
      let parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex] <= this.heap[index]) break;
      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIndex],
      ];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    while (true) {
      let leftChild = 2 * index + 1;
      let rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild] < this.heap[smallest]
      ) {
        smallest = leftChild;
      }
      if (
        rightChild < this.heap.length &&
        this.heap[rightChild] < this.heap[smallest]
      ) {
        smallest = rightChild;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[index],
      ];
      index = smallest;
    }
  }
}

const pq = new MinHeap();
pq.push(10);
pq.push(5);
pq.push(20);
console.log("Priority Queue Pop:", pq.pop()); // 5
```

## 函数

```js
// 1) 函数声明 (Function Declaration)
//    特点: 会发生提升(hoisting), 可以在定义前调用; 拥有自己的 this/arguments。
function calAge1(year) {
  return Number(year) - 2006; // 返回传入年份与 2006 的差值
}

// 2) 函数表达式 (Function Expression)
//    特点: 赋值给变量, 只有执行到这一行后才可调用; 也有独立的 this/arguments。
const calAge2 = function (year) {
  return Number(year) - 2006; // 与 calAge1 逻辑一致
};

// 3) 箭头函数 (Arrow Function)
//    特点: 语法更简洁; 不绑定自己的 this/arguments/prototype, this 为外层词法作用域; 不能用 new。
const calAge3 = (year) => Number(year) - 2006; // 单表达式可省略 return 与花括号

// 三者返回结果一致, 选择依据: 是否需要 hoisting / 是否需要自己的 this / 代码简洁需求。
```

## Array

```js
// ===== Array 基本使用（行间注释示例） =====
let alphas = ["a", "b", "c"]; // 字面量创建数组
const nums = new Array(1, 2, 3); // 构造函数创建数组（不常用）
const holes = new Array(3); // 仅指定长度，产生空槽数组 [empty × 3]

// 读取与修改
console.log(alphas[0]); // 通过索引读取："a"
alphas[1] = "B"; // 修改索引 1 处的值 => ["a", "B", "c"]
alphas.push("d"); // 尾部追加元素，返回新长度 => ["a","B","c","d"]
const last = alphas.pop(); // 移除尾部元素，返回被移除的值 => last === "d"

// 头部操作（注意：unshift/shift 会移动大量元素，频繁使用成本较高）
alphas.unshift("z"); // 头部插入 => ["z","a","B","c"]
const removedFirst = alphas.shift(); // 头部移除，返回被移除的值 => removedFirst === "z"

// 查找与包含
console.log(alphas.includes("a")); // 是否包含某元素（严格相等）
console.log(alphas.indexOf("c")); // 返回索引，未找到为 -1
console.log(alphas.find((x) => x === "B")); // 返回第一个匹配的元素或 undefined
console.log(alphas.findIndex((x) => x === "B")); // 返回匹配元素索引或 -1
console.log(alphas.at(-1)); // 取倒数第一个元素（等价于 alphas[alphas.length - 1]）

// 截取、修改与合并/拷贝
const part = alphas.slice(1, 3); // 非破坏性截取，半开区间 [start, end)
const removed = alphas.splice(1, 1, "X"); // 原地修改：从索引1删除1个，并插入"X"
const more = ["f", "g"];
const merged1 = alphas.concat(more); // 合并，新数组，不修改原数组
const merged2 = [...alphas, ...more]; // 展开语法合并/浅拷贝
const copy = [...alphas]; // 浅拷贝（仅第一层）

// 遍历
for (let i = 0; i < alphas.length; i++) {
  // 经典 for，需用索引访问
}
for (const ch of alphas) {
  // for...of，按值遍历，可配合 break/continue
}
alphas.forEach((ch, i) => {
  // forEach 回调遍历，无法中途 break/continue
});

// 常见数组方法（返回新数组/值，不修改原数组，除特殊说明）
const upper = alphas.map((ch) => ch.toUpperCase()); // 映射 => 新数组
const filtered = alphas.filter((ch) => ch !== "X"); // 过滤 => 新数组
const joined = alphas.reduce((acc, ch) => acc + ch, ""); // 归约 => 单个值

// 注意：数组是引用类型，赋值会共享引用；需要拷贝请使用 slice()/concat()/展开语法等。
```

## **事件监听与类操作**

```js
// ===== 事件与类操作 =====
// 一、多事件监听器共享函数：避免重复写匿名函数
// 将处理逻辑抽成命名函数，然后在多个事件上复用。
function hideBody() {
  document.body.classList.add("hidden"); // 统一的处理逻辑
}
function showBody() {
  document.body.classList.remove("hidden");
}

// 绑定多个事件到同一个处理器（共享函数）
document.addEventListener("visibilitychange", () => {
  // 当页面不可见时隐藏（例子）
  if (document.hidden) hideBody();
  else showBody();
});
document.querySelector("#btn-hide")?.addEventListener("click", hideBody);
document.querySelector("#btn-show")?.addEventListener("click", showBody);

// 二、实践中常用的类添加/删除/切换：类可聚合多个 CSS 属性
// - add: 添加类，使元素呈现该类定义的一组样式
// - remove: 移除类，撤销该类样式
// - toggle: 切换类（如果有则去掉，没有则加上）
const panel = document.querySelector(".panel");
panel?.classList.add("active"); // 激活样式（例如高亮、显示）
panel?.classList.remove("hidden"); // 确保显示
panel?.classList.toggle("collapsed"); // 展开/折叠切换

// 三、检查元素是否包含某类：classList.contains
if (panel?.classList.contains("active")) {
  // 根据当前状态决定下一步逻辑
  // 例如：如果已经 active，就标记为可交互
}

// 四、按键事件处理：键盘交互常见模式
// 在 document 或具体可聚焦元素上监听 keydown/keyup
document.addEventListener("keydown", (e) => {
  // e.key 是语义化的按键值，例如 "Enter"、"Escape"、"ArrowLeft" 等
  if (e.key === "Enter") {
    // 回车触发提交/确认
    showBody();
  } else if (e.key === "Escape") {
    // ESC 触发关闭/隐藏
    hideBody();
  }
  // 方向键示例
  if (e.key === "ArrowLeft") {
    panel?.classList.add("move-left");
  }
});

// 小结：
// - 用“命名函数”让多个事件共享同一段逻辑，便于复用与移除监听。
// - 优先用 class 切换元素外观，而非直接操作 style，因为类能聚合多条 CSS，并保持结构清晰。
// - 用 classList.contains 判断当前状态，再决定 add/remove/toggle。
// - 键盘事件结合 e.key 做语义判断，常见 Enter/Escape/Arrow*。
```

![image-20251126164610060](C:\Users\woodfish\Desktop\MyBlog\new JS.assets\image-20251126164610060.png)
