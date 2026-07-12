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

深浅拷贝的概念仅适用于引用类型。

### （一）浅拷贝

- **概念**：浅拷贝是指拷贝对象的地址。
- 用法
  - **对象拷贝**：可使用 `Object.assign()` 方法或者展开运算符 `{...obj}` 来实现。
  - **数组拷贝**：通过 `Array.prototype.concat()` 方法或者展开运算符 `[...arr]` 达成。
- **案例**：当拷贝对象为单层结构时，浅拷贝通常能满足需求。但若是多层嵌套的对象，由于只是拷贝地址，可能会在对新对象操作时影响到原对象。例如：

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


- **拓展**：浅拷贝在一些对数据独立性要求不高，且希望保持对象引用关系的场景下很有用，比如在某些性能优化场景中减少内存开销。但在大多数需要完全独立数据副本的场景下，浅拷贝可能无法满足需求。

### （二）深拷贝

- **概念**：深拷贝是指创建一个全新的对象，拷贝对象的所有层级数据，而非仅仅是地址。
- 用法
  - **递归实现**：利用函数递归，遍历对象的所有层级，为每个层级创建新的对象或数组。
  - **使用 lodash 库**：通过 `lodash/cloneDeep` 方法，该方法内部实现了深拷贝的逻辑。
  - **JSON 序列化**：借助 `JSON.stringify()` 将对象转换为字符串，再通过 `JSON.parse()` 将字符串还原为对象。
- 案例
  - **递归实现深拷贝**：

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


- **lodash 实现深拷贝**：

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


- **JSON 序列化实现深拷贝**：

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


- **拓展**：递归实现深拷贝的优点是可以自定义处理逻辑，能处理更复杂的数据结构，但实现相对复杂且容易出错。`lodash/cloneDeep` 是一个成熟的库方法，可靠性高，但增加了项目的依赖。JSON 序列化方式简单直接，但它有局限性，无法处理包含函数、正则表达式等特殊类型的对象。

## 二、异常处理

异常处理旨在预估代码执行过程中可能出现的错误，避免程序因错误而崩溃，提升代码运行的健壮性。

### （一）throw

- **概念**：`throw` 用于抛出异常信息，一旦抛出，程序会终止执行后续代码。
- **用法**：`throw` 关键字后跟随错误提示信息，也常与 `Error` 对象配合使用，以提供更详细的错误信息。
- **案例**：

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


- **拓展**：合理使用 `throw` 可以让开发者在代码出现不符合预期情况时，及时中断程序并给出明确的错误指示，方便调试和定位问题。在大型项目中，有助于团队成员快速理解错误原因。

### （二）try...catch

- **概念**：`try...catch` 结构用于捕获代码执行过程中抛出的异常信息，确保程序不会因异常而完全终止。
- **用法**：将可能出现错误的代码放在 `try` 代码块中，若 `try` 块内代码抛出异常，程序会跳转到 `catch` 代码块执行，`catch` 块中的参数会接收到错误信息。`finally` 块无论 `try` 块是否出错都会执行。
- **案例**：

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


- **拓展**：`try...catch` 结构在处理异步操作（如 `fetch` 请求）时也非常有用，可以捕获异步操作中抛出的异常，避免未处理的 Promise 拒绝导致程序出错。同时，`finally` 块常用于释放资源，如关闭文件、断开数据库连接等操作。

### （三）debugger

- **概念**：`debugger` 相当于断点调试，在代码执行到该语句时，会暂停执行，方便开发者检查变量状态、执行流程等。
- **用法**：直接在需要调试的代码中插入 `debugger` 语句，在支持调试的环境（如浏览器开发者工具、Node.js 调试器）中运行代码时，程序会在 `debugger` 处暂停。
- **案例**：在上述深拷贝递归函数中添加 `debugger` 语句，可以在调试工具中观察每次递归时变量的变化情况。

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


- **拓展**：`debugger` 是开发过程中非常重要的调试工具，结合浏览器开发者工具或其他调试工具，可以进行单步调试、查看调用栈、监视变量等操作，帮助开发者快速定位和解决代码中的问题。

## 三、处理 this

`this` 是 JavaScript 中一个复杂且重要的概念，其值在不同场景下有所不同，同时也可以动态指定。

### （一）普通函数

- **概念**：普通函数中 `this` 的值由调用方式决定，遵循 “谁调用，`this` 就指向谁” 的原则。当没有明确调用者时，在非严格模式下 `this` 指向 `window`，严格模式下指向 `undefined`。
- **用法**：通过不同的调用方式来观察 `this` 的指向。
- **案例**：

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


- **拓展**：理解普通函数中 `this` 的指向对于编写正确的面向对象代码和事件处理函数重要。在实际开发中，需要注意函数调用的上下文，以确保 `this` 指向符合预期。

### （二）箭头函数

- **概念**：箭头函数本身没有自己的 `this`，它所访问的 `this` 是其所在作用域的 `this` 变量，不受调用方式影响。
- **用法**：在不同的代码结构中使用箭头函数，观察 `this` 的指向。
- **案例**：

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


在事件回调函数和基于原型的面向对象编程中使用箭头函数时需谨慎，因为箭头函数的 `this` 指向可能导致不符合预期的结果。例如在 DOM 事件回调中使用箭头函数，`this` 会指向 `window` 而非 DOM 对象：

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


同样，在基于原型的面向对象中，原型对象上添加箭头函数也会导致 `this` 指向错误：

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


- **拓展**：虽然箭头函数在简洁性上有优势，但由于其 `this` 指向的特殊性，在使用时需要特别小心。在一些需要动态绑定 `this` 的场景下，普通函数可能是更好的选择。而在一些回调函数中，如果不需要访问 `this` 或者希望使用外层作用域的 `this`，箭头函数则更为合适。

### （三）改变 this 指向

JavaScript 提供了三个方法来动态指定普通函数中 `this` 的指向。

#### 1. call

- **概念**：`call` 方法用于调用函数，并在调用时指定函数内部 `this` 的值。
- **用法**：`function.call(thisArg, arg1, arg2,...)`，其中 `thisArg` 是要指定的 `this` 值，`arg1, arg2,...` 是函数的参数。
- **案例**：

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


- **拓展**：`call` 方法在需要临时改变函数执行上下文的场景下非常有用，例如在继承中调用父类的构造函数时，可以使用 `call` 方法将父类构造函数中的 `this` 指向子类的实例。

#### 2. apply

- **概念**：`apply` 方法同样用于调用函数并指定 `this` 值，与 `call` 方法的区别在于参数传递方式。
- **用法**：`function.apply(thisArg, [argsArray])`，`thisArg` 是指定的 `this` 值，`argsArray` 是包含函数参数的数组。
- **案例**：

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


- **拓展**：`apply` 方法在处理需要将数组作为参数传递给函数的场景时很方便，比如 Math.max.apply (null, [1, 2, 3]) 可以获取数组中的最大值。

#### 核心区别总结

| 特点         | `call()`                 | `apply()`                    |
| ------------ | ------------------------ | ---------------------------- |
| 参数传递方式 | 逐个传入参数（参数列表） | 传入数组或类数组（参数集合） |
| 适用场景     | 参数数量固定时           | 参数数量不确定或已存在数组时 |

#### 3. bind

- **概念**：`bind` 方法不会立即调用函数，而是创建一个新函数，该新函数的 `this` 值被固定为 `bind` 方法传入的参数。
- **用法**：`function.bind(thisArg, arg1, arg2,...)`，`thisArg` 是要固定的 `this` 值，`arg1, arg2,...` 是可选的预设参数。
- **案例**：

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


- **拓展**：`bind` 方法常用于创建一个函数，该函数的 `this` 指向已经固定，方便在后续的代码中使用。例如在事件绑定中，有时需要确保回调函数的 `this` 指向特定对象，就可以使用 `bind` 方法预先绑定 `this`。

## 四、防抖节流

### （一）防抖（debounce）

- **概念**：触发事件后，在指定的 `n` 秒内函数只能执行一次。若在这 `n` 秒内再次触发事件，则重新计算函数执行时间。
- **用法**：常用于处理一些频繁触发的事件，如窗口大小改变、滚动、输入框输入等，避免短时间内多次执行函数造成性能问题。
- **案例**：例如在搜索框输入时，希望用户输入完成后再触发搜索请求，而不是每次输入一个字符都触发：

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


- **拓展**：防抖函数可以通过调整延迟时间 `delay` 来平衡用户体验和性能。延迟时间过短可能无法达到防抖效果，过长则会让用户感觉响应不及时。

### （二）节流（throttle）

- **概念**：连续触发事件时，在 `n` 秒内只执行一次函数，确保函数在一定时间间隔内不会被频繁调用。
- **用法**：适用于一些需要控制频率的场景，如滚动条滚动、鼠标移动等事件，避免短时间内大量执行函数。
- **案例**：在页面滚动时，每 `200` 毫秒执行一次特定函数：

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


- **拓展**：节流函数通过控制执行频率，能有效降低函数执行次数，从而提升性能。在不同场景下，需要根据实际需求合理调整节流的时间间隔，以达到最佳的用户体验和性能平衡。比如在处理动画相关的滚动事件时，可能需要较短的节流间隔以保证动画的流畅性；而在一些对实时性要求不高的统计类操作中，可以设置较长的节流间隔。

深浅拷贝、异常处理、`this` 指向以及防抖节流都是 JavaScript 中非常重要的知识点。深浅拷贝决定了数据复制的方式和程度，异常处理保障了程序的健壮性，`this` 指向影响函数的执行上下文和行为，防抖节流则优化了事件处理的性能，熟练掌握这些内容对于编写高质量的 JavaScript 代码重要。

