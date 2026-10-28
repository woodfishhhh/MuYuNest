---
title: "JavaScript 学习笔记（9）：深浅拷贝、异常处理、this 指向与防抖节流"
date: 2025-11-03 12:39:11
tags:
  - "前端开发"
  - "深浅拷贝"
  - "异常处理"
  - "this 指向"
  - "防抖节流"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、深浅拷贝

深浅拷贝只针对引用类型。

### （一）浅拷贝

- 概念：浅拷贝拷的是对象的地址。
- 用法
  - 对象：用 `Object.assign()` 或者展开运算符 `{...obj}`。
  - 数组：用 `Array.prototype.concat()` 或者展开运算符 `[...arr]`。
- 案例：对象只有一层时，浅拷贝一般够用。多层嵌套的对象就不行了，因为里面拷的只是地址，改新对象可能会影响到原对象。比如：

```javascript
// 单层对象浅拷贝示例
let obj1 = { a: 1 };
let obj2 = {...obj1 };
obj2.a = 2;
console.log(obj1); // { a: 1 }
console.log(obj2); // { a: 2 }

// 多层对象浅拷贝示例
let nestedObj1 = { b: { c: 3 } };
let nestedObj2 = {...nestedObj1 };
nestedObj2.b.c = 4;
console.log(nestedObj1); // { b: { c: 4 } }
console.log(nestedObj2); // { b: { c: 4 } }
```


- 补充：对数据独立性要求不高、又想保持对象引用关系的地方，浅拷贝有用，比如有些性能优化场景里能省内存。但大多数要完全独立副本的场景，浅拷贝不够。

### （二）深拷贝

- 概念：深拷贝是新建一个对象，把所有层级的数据都拷过去，不只是拷地址。
- 用法
  - 递归：用函数递归遍历对象的每一层，每一层都新建对象或数组。
  - lodash：用 `lodash/cloneDeep`，它里面已经实现了深拷贝。
  - JSON 序列化：先用 `JSON.stringify()` 把对象转成字符串，再用 `JSON.parse()` 转回对象。
- 案例
  - 递归实现深拷贝：

```html
<body>
  <script>
    const obj = {
      uname: 'pink',
      age: 18,
      hobby: ['乒乓球', '足球'],
      family: {
        baby: '小pink'
      }
    };
    const o = {};
    function deepCopy(newObj, oldObj) {
      for (let k in oldObj) {
        if (oldObj[k] instanceof Array) {
          newObj[k] = [];
          deepCopy(newObj[k], oldObj[k]);
        } else if (oldObj[k] instanceof Object) {
          newObj[k] = {};
          deepCopy(newObj[k], oldObj[k]);
        } else {
          newObj[k] = oldObj[k];
        }
      }
    }
    deepCopy(o, obj);
    console.log(o);
    o.age = 20;
    o.hobby[0] = '篮球';
    o.family.baby = '老pink';
    console.log(obj);
    console.log([1, 23] instanceof Object);
  </script>
</body>
```


- lodash 实现深拷贝：

```html
<body>
  <script src="./lodash.min.js"></script>
  <script>
    const obj = {
      uname: 'pink',
      age: 18,
      hobby: ['乒乓球', '足球'],
      family: {
        baby: '小pink'
      }
    };
    const o = _.cloneDeep(obj);
    console.log(o);
    o.family.baby = '老pink';
    console.log(obj);
  </script>
</body>
```


- JSON 序列化实现深拷贝：

```html
<body>
  <script>
    const obj = {
      uname: 'pink',
      age: 18,
      hobby: ['乒乓球', '足球'],
      family: {
        baby: '小pink'
      }
    };
    const o = JSON.parse(JSON.stringify(obj));
    console.log(o);
    o.family.baby = '123';
    console.log(obj);
  </script>
</body>
```


- 三种方式对比：
  - 递归：能自定义处理逻辑，能处理更复杂的数据结构，但写起来麻烦、容易出错。
  - `lodash/cloneDeep`：成熟可靠，但项目多了一个依赖。
  - JSON 序列化：简单直接，但处理不了函数、正则这些特殊类型。

## 二、异常处理

异常处理就是提前估计代码执行时可能出的错，免得程序因为出错直接崩掉。

### （一）throw

- 概念：`throw` 抛出异常信息，一抛出，后面的代码就不执行了。
- 用法：`throw` 后面跟错误提示，也常配合 `Error` 对象用，错误信息更详细。
- 案例：

```html
<script>
  function counter(x, y) {
    if (!x ||!y) {
      throw new Error('参数不能为空!');
    }
    return x + y;
  }
  counter();
</script>
```


- 补充：代码出现不符合预期的情况时，用 `throw` 及时中断并给出明确的错误提示，调试和定位都方便。

### （二）try...catch

- 概念：`try...catch` 用来接住代码执行时抛出的异常，程序不会因为异常整个停掉。
- 用法：可能出错的代码放进 `try` 块，`try` 里抛了异常就跳到 `catch` 块执行，`catch` 的参数能拿到错误信息。`finally` 块不管 `try` 有没有出错都会执行。
- 案例：

```html
<script>
  function foo() {
    try {
      const p = document.querySelector('.p');
      p.style.color ='red';
    } catch (error) {
      console.log(error.message);
      return;
    } finally {
      alert('执行');
    }
    console.log('如果出现错误，我的语句不会执行');
  }
  foo();
</script>
```


- 补充：处理异步操作（比如 `fetch` 请求）时，`try...catch` 也能接住异步操作里抛出的异常，避免出现未处理的 Promise 拒绝。`finally` 常用来释放资源，比如关文件、断开数据库连接。

### （三）debugger

- 概念：`debugger` 相当于一个断点，代码执行到这一句就会暂停，方便检查变量的状态和执行流程。
- 用法：在要调试的地方直接插一句 `debugger`，在支持调试的环境里（浏览器开发者工具、Node.js 调试器）运行，程序就会停在这里。
- 案例：在上面的深拷贝递归函数里加一句 `debugger`，就能在调试工具里看每次递归时变量的变化。

```javascript
function deepCopy(newObj, oldObj) {
  debugger;
  for (let k in oldObj) {
    if (oldObj[k] instanceof Array) {
      newObj[k] = [];
      deepCopy(newObj[k], oldObj[k]);
    } else if (oldObj[k] instanceof Object) {
      newObj[k] = {};
      deepCopy(newObj[k], oldObj[k]);
    } else {
      newObj[k] = oldObj[k];
    }
  }
}
```


- 补充：配合浏览器开发者工具，可以单步调试、看调用栈、监视变量。

## 三、处理 this

`this` 的值在不同场景下不一样，也可以动态指定。

### （一）普通函数

- 概念：普通函数里 `this` 的值由调用方式决定，"谁调用，`this` 就指向谁"。没有明确的调用者时，非严格模式下 `this` 指向 `window`，严格模式下是 `undefined`。
- 用法：用不同的调用方式看 `this` 指向谁。
- 案例：

```html
<script>
  // 普通函数
  function sayHi() {
    console.log(this);
  }
  // 函数表达式
  const sayHello = function () {
    console.log(this);
  }
  sayHi(); // window
  window.sayHi();

  const user = {
    name: '小明',
    walk: function () {
      console.log(this);
    }
  }
  user.sayHi = sayHi;
  user.sayHello = sayHello;
  user.sayHi();
  user.sayHello();
</script>
```


- 补充：写面向对象的代码和事件处理函数时，要留意函数调用的上下文，`this` 才会指向预期的对象。

### （二）箭头函数

- 概念：箭头函数没有自己的 `this`，它访问的 `this` 是所在作用域的 `this`，跟调用方式无关。
- 用法：在不同的代码结构里用箭头函数，看 `this` 指向谁。
- 案例：

```html
<script>
  console.log(this); // 此处为 window
  const sayHi = () => {
    console.log(this);
  }
  const user = {
    name: '小明',
    walk: () => {
      console.log(this);
    },
    sleep: function () {
      let str = 'hello';
      console.log(this);
      let fn = () => {
        console.log(str);
        console.log(this);
      }
      fn();
    }
  }
  user.sayHi = sayHi;
  user.sayHi();
  user.sleep();
  user.walk();
</script>
```


事件回调和基于原型的面向对象里用箭头函数要小心，`this` 可能不是想要的那个。比如 DOM 事件回调里用箭头函数，`this` 指向的是 `window`，不是 DOM 对象：

```html
<script>
  const btn = document.querySelector('.btn');
  btn.addEventListener('click', () => {
    console.log(this);
  });
  btn.addEventListener('click', function () {
    console.log(this);
  });
</script>
```


同样，在原型对象上加箭头函数，`this` 也会指错：

```html
<script>
  function Person() {}
  Person.prototype.walk = () => {
    console.log('人都要走路...');
    console.log(this); // window
  }
  const p1 = new Person();
  p1.walk();
</script>
```


- 补充：要动态绑定 `this` 的地方，用普通函数更合适；回调里不需要 `this`、或者就想用外层作用域的 `this` 时，用箭头函数更合适。

### （三）改变 this 指向

JavaScript 提供了三个方法，用来动态指定普通函数里 `this` 的指向。

#### 1. call

- 概念：`call` 调用函数，同时指定函数里 `this` 的值。
- 用法：`function.call(thisArg, arg1, arg2,...)`，`thisArg` 是要指定的 `this`，`arg1, arg2,...` 是函数的参数。
- 案例：

```html
<script>
  function sayHi() {
    console.log(this);
  }
  let user = {
    name: '小明',
    age: 18
  }
  let student = {
    name: '小红',
    age: 16
  }
  sayHi.call(user);
  sayHi.call(student);

  function counter(x, y) {
    return x + y;
  }
  let result = counter.call(null, 5, 10);
  console.log(result);
</script>
```


- 补充：要临时改变函数的执行上下文时很有用，比如继承里调用父类的构造函数，可以用 `call` 把父类构造函数里的 `this` 指向子类的实例。

#### 2. apply

- 概念：`apply` 也是调用函数并指定 `this`，和 `call` 的区别在于传参方式。
- 用法：`function.apply(thisArg, [argsArray])`，`thisArg` 是指定的 `this`，`argsArray` 是装着函数参数的数组。
- 案例：

```html
<script>
  function sayHi() {
    console.log(this);
  }
  let user = {
    name: '小明',
    age: 18
  }
  let student = {
    name: '小红',
    age: 16
  }
  sayHi.apply(user);
  sayHi.apply(student);

  function counter(x, y) {
    return x + y;
  }
  let result = counter.apply(null, [5, 10]);
  console.log(result);
</script>
```


- 补充：要把数组当参数传给函数时很方便，比如 Math.max.apply (null, [1, 2, 3]) 能拿到数组里的最大值。

#### 核心区别总结

| 特点         | `call()`                 | `apply()`                    |
| ------------ | ------------------------ | ---------------------------- |
| 参数传递方式 | 逐个传入参数（参数列表） | 传入数组或类数组（参数集合） |
| 适用场景     | 参数数量固定时           | 参数数量不确定或已存在数组时 |

#### 3. bind

- 概念：`bind` 不会马上调用函数，而是新建一个函数，这个新函数的 `this` 被固定成 `bind` 传进去的参数。
- 用法：`function.bind(thisArg, arg1, arg2,...)`，`thisArg` 是要固定的 `this`，`arg1, arg2,...` 是可选的预设参数。
- 案例：

```html
<script>
  function sayHi() {
    console.log(this);
  }
  let user = {
    name: '小明',
    age: 18
  }
  let sayHello = sayHi.bind(user);
  sayHello();
</script>
```


- 补充：常用在事件绑定里，提前用 `bind` 把回调的 `this` 绑到特定的对象上。

## 四、防抖节流

### （一）防抖（debounce）

- 概念：事件触发后，在指定的 `n` 秒内函数只执行一次。这 `n` 秒内又触发了的话，就重新计时。
- 用法：常用在频繁触发的事件上，比如窗口大小改变、滚动、输入框输入，免得短时间内执行太多次影响性能。
- 案例：比如搜索框输入时，想等用户输完再发搜索请求，而不是每输一个字就发一次：

```javascript
function debounce(func, delay) {
  let timer;
  return function() {
    let context = this;
    let args = arguments;
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

const searchInput = document.getElementById('searchInput');
const debouncedSearch = debounce(() => {
  console.log('执行搜索操作');
}, 500);

searchInput.addEventListener('input', debouncedSearch);
```


- 补充：延迟时间 `delay` 用来平衡体验和性能。太短起不到防抖的效果，太长用户会觉得响应慢。

### （二）节流（throttle）

- 概念：连续触发事件时，`n` 秒内只执行一次函数，保证函数在一段时间间隔内不会被频繁调用。
- 用法：适合要控制频率的场景，比如滚动条滚动、鼠标移动，免得短时间内执行太多次。
- 案例：页面滚动时，每 `200` 毫秒执行一次某个函数：

```javascript
function throttle(func, delay) {
  let lastTime = 0;
  return function() {
    let context = this;
    let args = arguments;
    let now = new Date().getTime();
    if (now - lastTime >= delay) {
      func.apply(context, args);
      lastTime = now;
    }
  };
}

window.addEventListener ('scroll', throttle (() => {
console.log (' 页面滚动中...');
}, 200));
```


- 补充：间隔按场景调。跟动画相关的滚动事件，间隔可能要短一点，动画才流畅；对实时性要求不高的统计类操作，可以设长一点。

