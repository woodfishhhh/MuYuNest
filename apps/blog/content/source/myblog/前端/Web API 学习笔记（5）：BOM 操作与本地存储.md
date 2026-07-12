---
title: "Web API 学习笔记（5）：BOM 操作与本地存储"
date: 2025-11-21 12:41:04
tags:
  - "前端开发"
  - "BOM 操作"
  - "本地存储"
  - "JavaScript"
  - "Web API"
categories:
  - "前端开发"
  - "Web API"
---


## window 对象

### （一）概念

BOM（Browser Object Model）即浏览器对象模型，`window`对象是 BOM 的顶级对象，也是 JavaScript 中的全局对象。

### （二）用法

1. `document`、`alert()`、`console.log()`等都是`window`的属性，基本 BOM 的属性和方法大多是`window`的，调用时可省略`window`。
2. 所有通过`var`定义在全局作用域中的变量、函数都会变成`window`对象的属性和方法。

### （三）案例

略（笔记中相关属性和方法调用示例较多）

### （四）拓展

`window`对象还有一些其他属性和方法，如`window.innerWidth`获取窗口内部宽度，`window.open()`打开新窗口等，在网页布局和交互中有广泛应用。

## 定时器 - 延迟函数

### （一）概念

`setTimeout`是 JavaScript 内置的用于延迟执行代码的函数，只执行一次；`setInterval`为间歇函数，每隔一段时间执行一次。

### （二）用法

**`setTimeout`语法**：`setTimeout(回调函数, 延迟时间)`，延迟时间单位为毫秒。

```javascript
let timerId = setTimeout(function () {
    console.log('我只执行一次');
}, 3000);
```

**`setInterval`语法**：`setInterval(回调函数, 间隔时间)`

```javascript
let intervalId = setInterval(function () {
    console.log('每隔一段时间执行一次');
}, 2000);
```

**清除延时函数**：`clearTimeout(timerId)`用于清除`setTimeout`设置的定时器，`clearInterval(intervalId)`用于清除`setInterval`设置的定时器。

### （三）案例

```html
<body>
    <script>
        // 定时器之延迟函数
        // 1. 开启延迟函数
        let timerId = setTimeout(function () {
            console.log('我只执行一次');
        }, 3000);
        // 1.1 延迟函数返回的还是一个正整数数字，表示延迟函数的编号
        console.log(timerId);
        // 1.2 延迟函数需要等待时间，所以下面的代码优先执行
        // 2. 关闭延迟函数
        clearTimeout(timerId);
    </script>
</body>
```

### （四）拓展

定时器在动画效果、轮播图等网页交互效果实现中经常用到，合理设置定时器的时间间隔和逻辑，能提升用户体验。

## location 对象

### （一）概念

`location`对象拆分并保存了 URL 地址的各个组成部分，用于操作和获取当前页面的地址信息。

### （二）用法

| 属性 / 方法 | 说明                                                 |
| ----------- | ---------------------------------------------------- |
| `href`      | 属性，获取完整的 URL 地址，赋值时用于地址的跳转      |
| `search`    | 属性，获取地址中携带的参数，即符号`?`后面部分        |
| `hash`      | 属性，获取地址中的哈希值，即符号`#`后面部分          |
| `reload()`  | 方法，用来刷新当前页面，传入参数`true`时表示强制刷新 |

```html
<body>
    <form>
        <input type="text" name="search"><button>搜索</button>
    </form>
    <a href="#/music">音乐</a>
    <a href="#/download">下载</a>
    <button class="reload">刷新页面</button>
    <script>
        // location 对象  
        // 1. href属性 （重点） 得到完整地址，赋值则是跳转到新地址
        console.log(location.href);
        // location.href = 'http://www.itcast.cn';
        // 2. search属性  得到?后面的地址 
        console.log(location.search);  //?search=笔记本
        // 3. hash属性  得到#后面的地址
        console.log(location.hash);
        // 4. reload 方法  刷新页面
        const btn = document.querySelector('.reload');
        btn.addEventListener('click', function () {
            // location.reload() // 页面刷新
            location.reload(true); // 强制页面刷新 ctrl+f5
        });
    </script>
</body>
```

### （三）案例

上述代码即为案例，展示了`location`对象各属性和方法的使用。

### （四）拓展

在前端路由中，`location`对象的`hash`属性常被用于实现单页面应用（SPA）的路由功能，通过监听`hash`的变化来切换页面内容。

## navigator 对象

### （一）概念

`navigator`对象记录了浏览器自身的相关信息，可用于检测浏览器版本及平台等。

### （二）用法

通过`userAgent`属性检测浏览器的版本及平台。

```javascript
// 检测 userAgent（浏览器信息）
(function () {
    const userAgent = navigator.userAgent;
    // 验证是否为Android或iPhone
    const android = userAgent.match(/(Android);?[\s\/]+([\d.]+)?/);
    const iphone = userAgent.match(/(iPhone\sOS)\s([\d_]+)/);
    // 如果是Android或iPhone，则跳转至移动站点
    if (android || iphone) {
        location.href = 'http://m.itcast.cn';
    }
})();
```

### （三）案例

上述代码展示了通过`navigator.userAgent`检测设备类型并进行页面跳转的案例。

### （四）拓展

除了检测设备类型，`navigator`对象还可用于检测浏览器支持的功能，如`navigator.geolocation`用于获取用户地理位置信息（需用户授权）。

## history 对象

### （一）概念

`history`对象主要管理历史记录，与浏览器地址栏的前进、后退等操作相对应。

### （二）用法

常见方法：

| 方法        | 说明                                                    |
| ----------- | ------------------------------------------------------- |
| `forward()` | 前进到下一个历史记录，等同于`history.go(1)`             |
| `back()`    | 后退到上一个历史记录，等同于`history.go(-1)`            |
| `go(num)`   | 跳转到指定的历史记录，`num`为正数表示前进，负数表示后退 |

```html
<body>
    <button class="back">←后退</button>
    <button class="forward">前进→</button>
    <script>
        // histroy对象
        // 1.前进
        const forward = document.querySelector('.forward');
        forward.addEventListener('click', function () {
            // history.forward() 
            history.go(1);
        });
        // 2.后退
        const back = document.querySelector('.back');
        back.addEventListener('click', function () {
            // history.back()
            history.go(-1);
        });
    </script>
</body>
```

### （三）案例

上述代码展示了`history`对象前进和后退方法的使用案例。

### （四）拓展

在单页面应用中，`history`对象可与前端路由结合，通过`history.pushState()`和`history.replaceState()`方法实现无刷新页面跳转，同时更新浏览器历史记录。

## 本地存储（今日重点）

### （一）概念

本地存储用于将数据存储在本地浏览器中，实现数据持久化，即使页面刷新或关闭，数据也可保留。

### （二）用法

1. `localStorage`

   - **作用**：数据长期保留在本地浏览器，刷新和关闭页面数据不丢失。
   - **特性**：以键值对形式存储，且存储的是字符串，可省略`window`。
   - 操作方法
     - **存储**：`localStorage.setItem('key', 'value')`
     - **获取**：`localStorage.getItem('key')`
     - **删除**：`localStorage.removeItem('key')`

2. `sessionStorage`

   - **特性**：用法与`localStorage`基本相同，但当页面浏览器关闭时，存储的数据会被清除。

   - 操作方法

     - **存储**：`sessionStorage.setItem('key', 'value')`
     - **获取**：`sessionStorage.getItem('key')`
     - **删除**：`sessionStorage.removeItem('key')`

3. `localStorage`存储复杂数据类型

   - **问题**：本地只能存储字符串，无法直接存储复杂数据类型。
   - **解决**：使用`JSON.stringify(复杂数据类型)`将复杂数据类型转换为 JSON 字符串后存储，使用时通过`JSON.parse(JSON字符串)`将取出的字符串转换为对象。

### （三）案例

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>本地存储-localstorage</title>
</head>

<body>
    <script>
        // 本地存储 - localstorage 存储的是字符串 
        // 1. 存储
        localStorage.setItem('age', 18);
        // 2. 获取
        console.log(typeof localStorage.getItem('age'));
        // 3. 删除
        localStorage.removeItem('age');
    </script>
</body>

</html>
```

```html
<body>
    <script>
        // 本地存储复杂数据类型
        const goods = {
            name: '小米',
            price: 1999
        };
        // localStorage.setItem('goods', goods);
        // console.log(localStorage.getItem('goods'));
        // 1. 把对象转换为JSON字符串  JSON.stringify
        localStorage.setItem('goods', JSON.stringify(goods));
        // console.log(typeof localStorage.getItem('goods'));
        // 2. 把JSON字符串转换为对象  JSON.parse
        console.log(JSON.parse(localStorage.getItem('goods')));
    </script>
</body>
```

### （四）拓展

本地存储在实现网页离线功能、记住用户设置等场景中有广泛应用。但需注意，由于数据存储在本地，要注意数据的安全性，避免存储敏感信息。

## 八、综合案例相关数组方法

### （一）数组`map`方法

1. **概念**：用于遍历数组处理数据，并返回一个新数组。
2. **用法**：`数组.map(function (ele, index) { /* 处理逻辑 */ return 处理后的值; })`，`ele`为数组元素，`index`为索引。

```javascript
const arr = ['red', 'blue', 'pink'];
const newArr = arr.map(function (ele, index) {
    return ele + '颜色';
});
console.log(newArr);
```


1. **案例**：上述代码展示了`map`方法遍历数组并添加固定字符串的案例。
2. **拓展**：`map`方法常与其他数组方法如`filter`、`reduce`等结合使用，实现复杂的数据处理逻辑。

### （二）数组`join`方法

1. **概念**：将数组中的所有元素转换为一个字符串。
2. **用法**：`数组.join(分隔符)`，分隔符为空时默认用逗号分隔，为空字符串时元素之间无分隔符。

```html
<body>
    <script>
        const arr = ['red', 'blue', 'pink'];
        const newArr = arr.map(function (ele, index) {
            return ele + '颜色';
        });
        console.log(newArr.join());  // red颜色,blue颜色,pink颜色
        console.log(newArr.join(''));  //red颜色blue颜色pink颜色
        console.log(newArr.join('|'));  //red颜色|blue颜色|pink颜色
    </script>
</body>
```


1. **案例**：上述代码展示了`join`方法将数组转换为不同分隔符字符串的案例。
2. **拓展**：在将数组数据展示为特定格式的文本时，`join`方法非常有用，如将数组转换为 CSV 格式字符串。