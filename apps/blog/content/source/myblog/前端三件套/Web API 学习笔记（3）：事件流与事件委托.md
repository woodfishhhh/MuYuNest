---
title: "Web API 学习笔记（3）：事件流与事件委托"
date: 2025-09-22 00:49:51
tags:
  - "前端开发"
  - "事件流"
  - "事件委托"
  - "Web API"
  - "List"
categories:
  - "前端开发"
  - "Web API"
---


![](https://www.woodfishhhh.xyz/images/event.png?_t=1753287581197)

## 一、事件流

### 1. 事件流的两个阶段

 - **捕获阶段**：事件从最顶层的父元素（如 `html`）向目标元素（触发事件的元素）逐层传递，`addEventListener` 第三个参数为 `true` 时在此阶段触发。
 - **冒泡阶段**：事件从目标元素向最顶层的父元素逐层回溯，`addEventListener` 第三个参数为 `false`（默认）时在此阶段触发。

 **示例：事件流执行顺序**

```html
 <div class="outer" 
   <div class="inner" 
     <div class="child" </div>
   </div>
 </div>
 
 <script>
   const outer = document.querySelector('.outer');
   const inner = document.querySelector('.inner');
   const child = document.querySelector('.child');
 
   // 捕获阶段触发（true）
   outer.addEventListener('click', () => console.log('outer 捕获'), true);
   inner.addEventListener('click', () => console.log('inner 捕获'), true);
   child.addEventListener('click', () => console.log('child 捕获'), true);
 
   // 冒泡阶段触发（false，默认）
   outer.addEventListener('click', () => console.log('outer 冒泡'));
   inner.addEventListener('click', () => console.log('inner 冒泡'));
   child.addEventListener('click', () => console.log('child 冒泡'));
 </script>
```

 **点击 `child` 元素的输出顺序**：
 `outer 捕获` → `inner 捕获` → `child 捕获` → `child 冒泡` → `inner 冒泡` → `outer 冒泡`

 ### 2. 阻止事件冒泡

 默认情况下，事件会沿冒泡阶段向上传播，可能触发父元素的相同事件。可通过事件对象的`stopPropagation()` 方法阻止冒泡。

 ```javascript
 child.addEventListener('click', (e) => {
   console.log('child 被点击');
   e.stopPropagation(); // 阻止冒泡，父元素的事件不再触发
 });
 ```

 **注意**：

 - `mouseover`/`mouseout` 会触发冒泡，`mouseenter`/`mouseleave` 不会，后者更适合处理鼠标进出效果。


### 3. 解绑事件

- **绑定 / 解绑方式**：使用 `addEventListener` 绑定事件后，需通过 `removeEventListener(事件类型, 事件处理函数, [捕获/冒泡阶段])` 解绑。
- **示例代码**：

```js
function fn() {
    alert('点击了')
}
// 绑定事件
btn.addEventListener('click', fn) 
// 解绑事件
btn.removeEventListener('click', fn) 
```


- **关键注意**：匿名函数无法被解绑，需用具名函数（如示例中 `fn` ）才能正常绑定和解绑 。

 ## 二、事件委托

 事件委托利用事件冒泡的特性，将子元素的事件监听委托给父元素，从而减少事件绑定次数，提升性能（尤其适合动态生成的元素）。


 ### 1. 原理

 - 父元素监听事件，通过事件对象的 **`target`** 属性判断触发事件的具体子元素。

 - 无需为每个子元素单独绑定事件，新增子元素也能自动响应事件。

   > 关键字：.target  .tagName

 **示例：为多个按钮绑定点击事件**

 ```html
 <ul class="list" 
   <li><button>按钮1</button></li>
   <li><button>按钮2</button></li>
   <li><button>按钮3</button></li>
 </ul>
 
 <script>
   const list = document.querySelector('.list');
   list.addEventListener('click', (e) => {
     // 只处理按钮的点击事件
     if (e.target.tagName === 'BUTTON') {
       console.log('按钮被点击：', e.target.textContent);
     }
   });
 </script>
 ```

 ### 2. 优势

 - **减少事件绑定**：无需为大量子元素绑定事件，降低内存消耗。
 - **动态适配**：新增子元素无需重新绑定事件，自动继承事件处理逻辑。

 ## 三、其他常用事件

### 1. 页面加载事件（`load`）

**一句话总结**：等页面里所有东西（图、样式、脚本）都加载完了才会触发。
**用在哪儿**：比如要获取图片的实际大小，或者初始化一个必须等页面加载好才能用的插件，就适合用它。
**代码例子**：

```javascript
window.addEventListener('load', () => {
  console.log('页面资源加载完毕');
});
```

### 2. 滚动事件（`scroll`）

**一句话总结**：只要滚动条一动（不管是页面还是某个元素的），它就会一直触发。
**用在哪儿**：常见的有 —— 滚动到一定位置，导航栏就固定在顶部；往下滚的时候，自动加载更多内容；还有显示 “回到顶部” 按钮，都靠它。
**小技巧**：想知道滚了多远？用`window.pageYOffset`或者**`document.documentElement.scrollTop`**就能拿到距离顶部的距离。
**代码例子**：

```javascript
window.addEventListener('scroll', () => {
  // 获取滚动距离（距离顶部）
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  console.log('滚动距离：', scrollTop);
});
```

1. **被卷去头部 / 左侧的属性及操作权限**
   - 对应属性：`scrollTop`（头部被卷去距离 ）、`scrollLeft`（左侧被卷去距离 ）
   - 特性：既可以**读取**当前被卷去数值，也能 **修改（赋值）** 来设置滚动位置
2. **检测页面滚动头部距离（被卷去头部）的属性**
   - 适用属性：`document.documentElement.scrollTop` ，用于获取页面整体滚动后，顶部被卷去的垂直距离 ，常用来做滚动监听、吸顶效果等交互逻辑 。

### 3. 窗口尺寸事件（`resize`）

**一句话总结**：窗口大小变了（比如拉大、缩小、最大化），它就会触发。
**用在哪儿**：做响应式页面特别有用，比如窗口变窄了，就让内容从一排变成两排；或者调整图表的大小，让它一直合适。
**小技巧**：想知道窗口现在多大？`window.innerWidth`是宽度，`window.innerHeight`是高度。
**代码例子**：

```javascript
window.addEventListener('resize', () => {
  console.log('窗口宽度：', window.innerWidth);
  console.log('窗口高度：', window.innerHeight);
});
```

### 小贴士

- 像`scroll`和`resize`这两个事件，可能会触发得特别频繁（比如快速滚动的时候），如果处理函数里代码太多，可能会让页面卡。这时候可以用 “节流” 或者 “防抖” 的小技巧，让它们触发得不那么勤
- 这些事件不只能绑在整个窗口（`window`）上，比如`scroll`事件，也能绑在带滚动条的`div`上，专门监听那个`div`的滚动

  ## 四、元素尺寸与位置

  ### 1. 元素宽高（`offsetWidth`/`offsetHeight`）

  - 返回元素的可视宽高（包含内容、padding、border，不包含 margin 和滚动条）。
  - 结果为数值类型，可直接用于计算。
  - offsetWidth 和 offsetHeight：获取元素宽高，计算方式为 “内容 + padding + border”
- offsetTop 和 offsetLeft：定位基准，有带有定位的父级时，以该父级为准；若没有，以文档左上角为准

  ```javascript
  const box = document.querySelector('.box');
  console.log('宽度：', box.offsetWidth); // 数值，如 200
  console.log('高度：', box.offsetHeight); // 数值，如 150
  ```

  **注意**：如果元素隐藏（`display: none`），返回值为 0。


  ## 五、总结

  - 事件流分为捕获和冒泡阶段，默认在冒泡阶段触发事件，可通过 `stopPropagation()` 阻止冒泡。
  - 事件委托利用冒泡特性，将子元素事件委托给父元素，提升性能并适配动态元素。
  - 滚动、加载、尺寸改变等事件是实现交互效果的重要工具，结合元素尺寸属性可实现复杂交互（如滚动动画、响应式布局）。


## 复习：自定义属性

### 1. 定义自定义属性

可以直接在 HTML 标签中定义自定义属性，通常建议以 `data-` 为前缀（这是 HTML5 规范推荐的方式，便于识别）：

```html
<div id="user" data-id="123" data-name="张三" data-age="25"></div>
```

这里的 `data-id`、`data-name`、`data-age` 都是自定义属性。

### 2. 访问自定义属性

#### 方式一：使用 `getAttribute()` 方法

```javascript
const userDiv = document.getElementById('user');
const userId = userDiv.getAttribute('data-id'); // "123"
const userName = userDiv.getAttribute('data-name'); // "张三"
```

#### 方式二：使用 `dataset` 属性（推荐）

HTML5 提供了 `dataset` 属性，专门用于访问以 `data-` 为前缀的自定义属性，使用时需要去掉 `data-` 前缀，并将连字符命名（如 `data-user-name`）转换为驼峰命名（`userName`）：

```javascript
const userDiv = document.getElementById('user');
const userId = userDiv.dataset.id; // "123"
const userName = userDiv.dataset.name; // "张三"
const userAge = userDiv.dataset.age; // "25"
```

### 3. 修改自定义属性

同样可以通过两种方式修改自定义属性：

#### 方式一：使用 `setAttribute()` 方法

```javascript
const userDiv = document.getElementById('user');
userDiv.setAttribute('data-age', '26'); // 修改 data-age 属性
userDiv.setAttribute('data-gender', '男'); // 添加新的自定义属性
```

#### 方式二：使用 `dataset` 属性

```javascript
const userDiv = document.getElementById('user');
userDiv.dataset.age = '26'; // 修改 data-age 属性
userDiv.dataset.gender = '男'; // 添加新的自定义属性
```

### 4. 删除自定义属性

```javascript
const userDiv = document.getElementById('user');
// 方式一：removeAttribute()
userDiv.removeAttribute('data-age');

// 方式二：设置为 null
userDiv.dataset.age = null;
```

### 5. 自定义属性的应用场景

- 存储元素相关的额外数据（如 ID、状态等），避免频繁查询服务器或 DOM
- 在事件处理中传递数据，例如点击列表项时获取对应的数据 ID
- 用于 CSS 选择器，通过 `[data-*]` 选择特定元素

```css
/* CSS 中使用自定义属性选择器 */
div[data-gender="男"] {
  background-color: #e6f7ff;
}
```

### 注意事项

- 自定义属性的值始终是字符串类型，使用时可能需要进行类型转换（如转换为数字）
- 虽然可以使用不带 `data-` 前缀的自定义属性，但建议遵循规范，避免与未来的 HTML 标准属性冲突
- `dataset` 只能访问以 `data-` 为前缀的属性，对于其他自定义属性需要使用 `getAttribute()`
