---
title: "AJAX 入门：从异步请求到登录示例"
date: 2025-11-17 08:39:07
tags:
  - "AJAX"
  - "入门"
  - "前后端交互"
categories:
  - "前端开发"
  - "AJAX"
---


表单提交、列表查询这类操作，通常只需要更新页面的一部分。AJAX 让 JavaScript 在不重新加载整页的情况下发送请求，等服务器返回数据后，再更新对应的界面。

## 一、AJAX 解决什么问题

先对比整页提交和异步请求。传统表单提交会重新加载页面：
```
用户填写表单 → 点击提交 → 浏览器刷新整个页面 → 显示结果
         ↑                                    ↓
    页面白屏等待                    整个页面重新加载
```

页面重新加载时，滚动位置和临时界面状态都可能随之改变，也会重复获取整页资源。AJAX 把这个过程改成后台请求：
```
用户填写表单 → 点击提交 → JavaScript在后台发送请求 → 局部更新页面
         ↑                                      ↓
    页面保持不变                    只更新需要改变的部分
```

请求只交换当前操作需要的数据，页面其他部分保持不变。提交表单、搜索建议、购物车更新都可以用这套方式完成。

### AJAX 的含义

**AJAX** = **A**synchronous **J**avaScript **A**nd **X**ML

| 组成部分 | 作用 | 现代替代 |
|----------|------|----------|
| **Asynchronous** 异步 | 请求等待期间不阻塞页面其他操作 | 仍然使用 |
| **JavaScript** | 发起请求并处理结果 | 仍然使用 |
| **XML** 数据格式 | 早期数据传输格式 | 现在常见的是 **JSON** |

一次 AJAX 请求会经过用户操作、发送请求、接收数据、处理响应和更新页面：
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   用户操作   │ → │ JavaScript  │ → │  发送请求    │
│  (点击按钮)  │    │   代码执行   │    │  (不刷新)   │
└─────────────┘    └─────────────┘    └─────────────┘
       ↑                    ↓                    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  更新页面    │ ← │  处理响应    │ ← │  接收数据    │
│  (局部更新)  │    │   JSON解析   │    │  (异步返回)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 常见请求 API

```js
// 早期：XMLHttpRequest（原生）
const xhr = new XMLHttpRequest()

// 现在：axios（封装库）- 推荐！
axios({ url: '/api/data' })

// 新兴：fetch（原生Promise）
fetch('/api/data')
```

管理系统的增删改查、社交平台的动态加载、电商购物车和在线答题，都会用到类似的请求与局部更新流程。

### 读懂后续示例需要的 JavaScript 操作

后面的代码会直接使用对象、数组方法、DOM 查询和事件监听。下面几段用于快速确认这些语法的位置，不承担 AJAX 逻辑。

#### 对象与数组方法
```js
// 你能看懂这些代码吗？
let name = "张三";
let age = 18;
let user = { name, age };  // ES6对象简写
let users = [{ name: "张三" }, { name: "李四" }];

// 数组方法
let names = users.map(user => user.name);  // ["张三", "李四"]
let nameStr = names.join(", ");  // "张三, 李四"
```

#### DOM 操作
```js
// 你能完成这些DOM操作吗？
document.querySelector("#app");                    // 获取元素
document.querySelector("#app").innerHTML = "内容";  // 设置内容
document.querySelector("#app").classList.add("active"); // 添加类名
```

#### 事件处理
```js
// 你能给按钮添加点击事件吗？
document.querySelector("button").addEventListener("click", function() {
  alert("按钮被点击了！");
});
```

#### 从输入框读取值

先补全取值语句，再对照下一段代码：
```html
<input type="text" id="username" value="张三">
<script>
  // 你的代码：获取input的值
  let value = __________________________;
  console.log(value); // 应该输出"张三"
</script>
```

```js
let value = document.querySelector("#username").value;
```

#### 把数组转成 HTML 列表

这里需要组合 map 和 join：
```js
let fruits = ["苹果", "香蕉", "橙子"];
// 你的代码：生成<li>苹果</li><li>香蕉</li><li>橙子</li>
let html = __________________________;
console.log(html);
```

```js
let html = fruits.map(fruit => `<li>${fruit}</li>`).join("");
```

运行示例需要一个代码编辑器、现代浏览器和可访问在线 API 的网络环境。HTML 结构、基础 CSS、变量、函数、数组和对象会直接出现在后面的完整页面里。

### 原笔记的练习顺序

下面这段是原始课程的练习安排。正文不按计时推进，而是按请求所需的信息顺序展开。

```
🚀 第1步：概念理解（15分钟）
    ↓
⚡ 第2步：工具准备（10分钟）  
    ↓
🎯 第3步：第一个请求（30分钟）
    ↓
🔧 第4步：数据处理（25分钟）
    ↓
💪 第5步：实战项目（40分钟）
    ↓
🏆 第6步：总结提升（10分钟）
```

## 二、发送第一个 axios 请求

### 1. 引入 axios

浏览器页面可以直接用 CDN：
```html
<!DOCTYPE html>
<html>
<head>
    <title>AJAX学习</title>
</head>
<body>
    <!-- 你的HTML内容 -->
    
    <!-- ✅ 步骤1：引入axios -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    
    <!-- ✅ 步骤2：写你的代码 -->
    <script>
        // 这里可以开始使用axios了！
        console.log('axios加载成功！', typeof axios);
    </script>
</body>
</html>
```

打开控制台，看到"axios加载成功！object"，说明脚本已经加载。

也可以引用本地文件：
```html
<!-- 1. 先下载axios文件到本地 -->
<!-- 2. 然后这样引入： -->
<script src="./js/axios.min.js"></script>
```

项目使用 npm 时，安装后直接导入：
```bash
# 在项目目录下运行
npm install axios

# 然后在代码中引入
import axios from 'axios';
```

### 2. 完整页面中的第一个请求

下面的页面把加载状态、成功响应、失败响应和清空操作放在一起。先看请求从按钮点击到页面更新的完整路径：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的第一个AJAX请求</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .province-item { padding: 8px; margin: 4px 0; background: white; border-radius: 4px; }
        .loading { color: #666; font-style: italic; }
        .error { color: red; background: #ffe6e6; padding: 10px; border-radius: 4px; }
        .success { color: green; background: #e6ffe6; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌍 中国省份查询系统</h1>
        <p>这是你的第一个AJAX应用！</p>
        
        <button id="loadBtn" onclick="loadProvinces()">📥 加载省份数据</button>
        <button id="clearBtn" onclick="clearData()">🗑️ 清空数据</button>
        
        <div id="status"></div>
        <div id="result"></div>
    </div>

    <!-- ✅ 引入axios -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    
    <!-- ✅ 你的代码 -->
    <script>
        // 加载省份数据函数
        function loadProvinces() {
            console.log('🚀 开始加载数据...');
            
            // 显示加载状态
            document.getElementById('status').innerHTML = '<div class="loading">⏳ 正在加载数据，请稍候...</div>';
            
            // ✅ 发送AJAX请求
            axios({
                url: 'http://hmajax.itheima.net/api/province',
                method: 'GET'  // 获取数据用GET
            }).then(response => {
                console.log('✅ 请求成功！', response);
                handleSuccess(response.data);
            }).catch(error => {
                console.log('❌ 请求失败！', error);
                handleError(error);
            });
        }
        
        // 处理成功响应
        function handleSuccess(data) {
            // 清除状态信息
            document.getElementById('status').innerHTML = '<div class="success">✅ 数据加载成功！</div>';
            
            // 提取省份列表
            const provinces = data.list;
            console.log('📊 省份数据：', provinces);
            
            // 生成HTML
            let html = '<h3>📍 中国省份列表（共' + provinces.length + '个）</h3>';
            html += '<div>';
            provinces.forEach((province, index) => {
                html += `<div class="province-item">
                    <strong>${index + 1}.</strong> ${province}
                </div>`;
            });
            html += '</div>';
            
            // 显示结果
            document.getElementById('result').innerHTML = html;
            
            // 3秒后隐藏成功消息
            setTimeout(() => {
                document.getElementById('status').innerHTML = '';
            }, 3000);
        }
        
        // 处理错误响应
        function handleError(error) {
            let errorMsg = '请求失败：';
            
            if (error.response) {
                // 服务器响应了，但状态码不是2xx
                errorMsg += `服务器返回错误 - 状态码：${error.response.status}`;
            } else if (error.request) {
                // 请求发送了，但没有收到响应
                errorMsg += '网络连接失败，请检查网络';
            } else {
                // 其他错误
                errorMsg += error.message;
            }
            
            document.getElementById('status').innerHTML = `<div class="error">❌ ${errorMsg}</div>`;
            document.getElementById('result').innerHTML = '';
        }
        
        // 清空数据
        function clearData() {
            document.getElementById('status').innerHTML = '';
            document.getElementById('result').innerHTML = '';
            console.log('🗑️ 数据已清空');
        }
        
        // 页面加载完成后的提示
        console.log('🎉 页面加载完成！点击"加载省份数据"按钮开始你的第一个AJAX请求！');
    </script>
</body>
</html>
```

### 3. 请求配置与响应对象

最小配置只需要 URL 和请求方法。then 处理成功响应，catch 处理失败：
```js
axios({
    url: 'http://hmajax.itheima.net/api/province',  // 请求地址
    method: 'GET'                                   // 请求方法
}).then(response => {
    // ✅ 成功时的处理
    console.log('服务器返回的数据：', response.data);
}).catch(error => {
    // ❌ 失败时的处理  
    console.log('出错了：', error);
});
```

响应对象里同时包含业务数据和 HTTP 状态信息，页面通常从 data 中继续取值：
```js
// 服务器返回的数据格式
{
    data: {
        list: ["北京市", "天津市", "河北省", ...],
        message: "获取成功"
    },
    status: 200,
    statusText: "OK"
}

// 提取有用数据
const provinces = response.data.list;  // 获取省份数组
```

### 4. 先用开发者工具确认请求

1. 按 F12 打开开发者工具，在 Console 查看输出。
2. 在 Network 面板检查请求 URL、方法、状态码和响应。
3. 页面没有按预期更新时，再到 Elements 面板确认目标元素。

常见问题可以先按下面的方向排查：

| 错误现象 | 可能原因 | 解决方法 |
|----------|----------|----------|
| axios未定义 | 没引入axios库 | 检查`<script>`标签是否正确 |
| 跨域错误 | 浏览器安全限制 | 使用支持的API地址 |
| 404错误 | 地址写错了 | 检查URL是否正确 |
| 网络超时 | 网络连接问题 | 检查网络连接 |

### 5. 精简后的省份列表请求

     ![image-20230403173156484](images/image-20230403173156484.png)

服务器通过接口提供数据。这个例子请求省份列表，再把数组内容写入页面。

> 获取省份列表数据 - 目标资源地址：http://hmajax.itheima.net/api/province

页面效果：

     ![image-20230220113157010](images/image-20230220113157010.png)

先引入 axios.js：

> axios.js文件链接: https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js

请求结构如下：

     ```js
     axios({
       url: '目标资源地址'
     }).then((result) => {
       // 对服务器返回的数据做后续处理
     })
     ```

url 标记目标资源，then 接收成功响应。放进页面后的完整代码如下：

  ```html
  <!DOCTYPE html>
  <html lang="en">

  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AJAX概念和axios使用</title>
  </head>

  <body>
    <!--
      axios库地址：https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
      省份数据地址：http://hmajax.itheima.net/api/province

      目标: 使用axios库, 获取省份列表数据, 展示到页面上
      1. 引入axios库
    -->
    <p class="my-p"></p>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script>
      // 2. 使用axios函数
      axios({
        url: 'http://hmajax.itheima.net/api/province'
      }).then(result => {
        console.log(result)
        // 好习惯：多打印，确认属性名
        console.log(result.data.list)
        console.log(result.data.list.join('<br>'))
        // 把准备好省份列表，插入到页面
        document.querySelector('.my-p').innerHTML = result.data.list.join('<br>')
      })
    </script>
  </body>

  </html>
````

## 三、URL、查询参数与响应

### 1. URL 的组成

URL 用于定位服务器上的资源，常见结构包括协议、域名和资源路径：
```
http://hmajax.itheima.net/api/province
└─┘ └──────────────┘ └────────┘
协议      域名         资源路径
```

| 部分 | 作用 | 例子 |
|------|------|------|
| **协议** | 通信规则 | http:// 或 https:// |
| **域名** | 服务器地址 | hmajax.itheima.net |
| **路径** | 具体资源位置 | /api/province |

### 2. 查询参数

查询参数把筛选条件附在 URL 后面。多个参数用 & 连接：
```
网址?参数名1=值1&参数名2=值2
```

下面两个地址分别携带一个和两个查询参数：
```
# 获取河北省的城市列表
http://hmajax.itheima.net/api/city?pname=河北省

# 获取河北省石家庄市的所有地区
http://hmajax.itheima.net/api/area?pname=河北省&cname=石家庄市
```

### 3. 用 params 查询城市列表

选择省份后，把省份名称放进 params，请求对应的城市列表：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>查询城市列表</title>
</head>
<body>
    <h2>请选择省份查看城市</h2>
    <select id="province">
        <option value="">请选择省份</option>
        <option value="河北省">河北省</option>
        <option value="辽宁省">辽宁省</option>
        <option value="山东省">山东省</option>
    </select>
    
    <div id="city-list"></div>
    
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script>
        // 当选择省份时，查询对应的城市
        document.getElementById('province').addEventListener('change', function() {
            const pname = this.value;
            if (!pname) return;
            
            // 使用查询参数获取城市列表
            axios({
                url: 'http://hmajax.itheima.net/api/city',
                params: {
                    pname: pname  // 这就是查询参数！
                }
            }).then(result => {
                const cities = result.data.list;
                const html = cities.map(city => `<p>🏙️ ${city}</p>`).join('');
                document.getElementById('city-list').innerHTML = html;
            });
        });
    </script>
</body>
</html>
```

### 4. 查文档的位置

- [MDN AJAX教程](https://developer.mozilla.org/zh-CN/docs/Web/Guide/AJAX) - AJAX 与异步请求的基础说明
- [axios官方文档](https://axios-http.com/) - axios 配置和 API
- [菜鸟教程AJAX](https://www.runoob.com/ajax/ajax-tutorial.html) - 中文示例

axios 返回 Promise，请求方法和报文格式由 HTTP 约定。遇到 404 时先核对 URL；遇到跨域错误时，需要确认接口是否允许当前来源访问，或者由项目代理转发。

### 5. 资源路径与新闻请求

一台服务器可以提供多个资源，路径用于标记要访问的具体位置。

     ![image-20230403185428276](images/image-20230403185428276.png)

下面请求新闻列表并打印响应：

    ![image-20230220122455915](images/image-20230220122455915.png)

    > 新闻列表数据 URL 网址：http://hmajax.itheima.net/api/news

    ```js
    axios({
      url: "http://hmajax.itheima.net/api/news",
    }).then((result) => {
      console.log(result);
    });
    ```

这个 URL 使用 http 协议访问黑马服务器的 /api/news 资源。再拆一次地址：

http://hmajax.itheima.net/api/news

结构是协议://域名/资源路径。

### 6. 常用 HTTP 请求方法

1. GET：获取资源
2. POST：创建资源
3. PUT：更新资源
4. DELETE：删除资源
5. PATCH：部分更新

GET 常用于获取资源，POST 用于创建或提交数据，PUT、DELETE、PATCH 对应更新、删除和部分更新。具体接口允许使用哪一种方法，由接口文档决定。

### 7. 登录请求的基本结构

这个片段读取用户名和密码，发送登录请求，并分别处理成功与失败：

1. 用户输入用户名和密码
2. 点击登录按钮发送请求
3. 处理响应结果
4. 登录成功跳转首页

```js
// 1. 获取表单数据
const loginForm = document.querySelector(".login-form");
const formData = new FormData(loginForm);

// 2. 发送登录请求
axios({
  url: "/api/login",
  method: "post",
  data: {
    username: formData.get("username"),
    password: formData.get("password"),
  },
})
  .then((res) => {
    if (res.data.code === 200) {
      // 登录成功
      localStorage.setItem("token", res.data.token);
      window.location.href = "/index.html";
    }
  })
  .catch((err) => {
    console.error("登录失败:", err);
  });
```


### 8. 用 params 组织查询条件

查询参数可以直接拼在 URL 后面：http://xxxx.com/xxx/xxx?参数名1=值1&参数名2=值2。参数名由接口约定，axios 也可以用 params 对象生成查询字符串：

     ```js
     axios({
       url: "目标资源地址",
       params: {
         参数名: 值,
       },
     }).then((result) => {
       // 对服务器返回的数据做后续处理
     });
     ```

     > 查询城市列表的 url 地址：[http://hmajax.itheima.net/api/city](http://hmajax.itheima.net/api/city?pname=河北省)
     >
     > 参数名：pname （值要携带省份名字）

下面的页面请求城市列表并写入段落：

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta http-equiv="X-UA-Compatible" content="IE=edge" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>查询参数</title>
     </head>
     <body>
       <!-- 
       城市列表: http://hmajax.itheima.net/api/city
       参数名: pname
       值: 省份名字
     -->
       <p></p>
       <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
       <script>
         axios({
           url: "http://hmajax.itheima.net/api/city",
           // 查询参数
           params: {
             pname: "辽宁省",
           },
         }).then((result) => {
           console.log(result.data.list);
           document.querySelector("p").innerHTML =
             result.data.list.join("<br>");
         });
       </script>
     </body>
   </html>
   ```

### 9. 同时传递省份和城市

地区接口需要省份和城市两个查询参数。页面先读取两个输入值，再把同名变量放入 params。

完成效果：

     ![image-20230220125428695](images/image-20230220125428695.png)

> 查询地区: http://hmajax.itheima.net/api/area
>
> 参数名：
>
> pname：省份名字
>
> cname：城市名字

对应代码：

   ```js
   /*
         获取地区列表: http://hmajax.itheima.net/api/area
         查询参数:
           pname: 省份或直辖市名字
           cname: 城市名字
       */
   // 目标: 根据省份和城市名字, 查询地区列表
   // 1. 查询按钮-点击事件
   document.querySelector(".sel-btn").addEventListener("click", () => {
     // 2. 获取省份和城市名字
     let pname = document.querySelector(".province").value;
     let cname = document.querySelector(".city").value;
   
     // 3. 基于axios请求地区列表数据
     axios({
       url: "http://hmajax.itheima.net/api/area",
       params: {
         pname,
         cname,
       },
     }).then((result) => {
       // console.log(result)
       // 4. 把数据转li标签插入到页面上
       let list = result.data.list;
       console.log(list);
       let theLi = list
         .map((areaName) => `<li class="list-group-item">${areaName}</li>`)
         .join("");
       console.log(theLi);
       document.querySelector(".list-group").innerHTML = theLi;
     });
   });
   ```

这里使用了 ES6 对象简写：属性名和变量名相同时，可以只写一次名称。

## 四、用 POST 提交数据

请求方法由 HTTP 规定，GET、POST、PUT、DELETE、PATCH 分别对应不同的资源操作。axios 默认使用 GET；提交注册数据时，这个接口要求使用 POST。

     ![image-20230220130833363](images/image-20230220130833363.png)

     ![image-20230404104319428](images/image-20230404104319428.png)

订单、账号等需要由多端访问的数据，要通过接口提交给服务器保存。

     ![image-20230404104328384](images/image-20230404104328384.png)

     ![image-20230404104333584](images/image-20230404104333584.png)

method 指定请求方法，data 保存请求体：

     ```js
     axios({
       url: "目标资源地址",
       method: "请求方法",
       data: {
         参数名: 值,
       },
     }).then((result) => {
       // 对服务器返回的数据做后续处理
     });
     ```

注册接口需要用户名和密码：

   > 注册用户 URL 网址：http://hmajax.itheima.net/api/register
   >
   > 请求方法：POST
   >
   > 参数名：
   >
   > username：用户名（要求中英文和数字组成，最少 8 位）
   >
   > password：密码（最少 6 位）

   ![image-20230404104350387](images/image-20230404104350387.png)

点击按钮后提交固定的测试数据：

   ```js
   /*
     注册用户：http://hmajax.itheima.net/api/register
     请求方法：POST
     参数名：
       username：用户名（中英文和数字组成，最少8位）
       password：密码  （最少6位）
   
     目标：点击按钮，通过axios提交用户和密码，完成注册
   */
   document.querySelector(".btn").addEventListener("click", () => {
     axios({
       url: "http://hmajax.itheima.net/api/register",
       method: "POST",
       data: {
         username: "itheima007",
         password: "7654321",
       },
     });
   });
   ```

这四个配置项要分清：url 是目标资源地址，method 是请求方法，params 是查询参数，data 是请求体。

## 五、调试与错误处理

### 1. 用 catch 接住失败响应

重复注册相同用户名时，接口会返回失败响应：

   ![image-20230220131753051](images/image-20230220131753051.png)

catch 可以取得错误对象。页面不能只把错误留在控制台，还需要读取接口返回的信息并反馈给用户：

   ```js
   axios({
     // ...请求选项
   })
     .then((result) => {
       // 处理成功数据
     })
     .catch((error) => {
       // 处理失败错误
     });
   ```

重复提交后的页面反馈如下：

   ![image-20230404104440224](images/image-20230404104440224.png)

   ![image-20230404104447501](images/image-20230404104447501.png)

对应代码从 error.response.data.message 读取接口消息：

   ```js
   document.querySelector(".btn").addEventListener("click", () => {
     axios({
       url: "http://hmajax.itheima.net/api/register",
       method: "post",
       data: {
         username: "itheima007",
         password: "7654321",
       },
     })
       .then((result) => {
         // 成功
         console.log(result);
       })
       .catch((error) => {
         // 失败
         // 处理错误信息
         console.log(error);
         console.log(error.response.data.message);
         alert(error.response.data.message);
       });
   });
   ```

### 2. 在 Network 中核对请求报文

HTTP 规定了浏览器和服务器交换内容的<span style="color: red;">格式</span>。请求报文是浏览器发给服务器的内容，注册请求可以在 Network 中展开查看：

   ![image-20230404104508764](images/image-20230404104508764.png)

   ![image-20230220132229960](images/image-20230220132229960.png)

请求报文分成四部分：

   - 请求行：请求方法，URL，协议
   - 请求头：以键值对的格式携带的附加信息，比如：Content-Type（指定了本次传递的内容类型）
   - 空行：分割请求头，空行之后的是发送给服务器的资源
   - 请求体：发送的资源

运行上面的注册代码后，在 Chrome 网络面板中选择对应请求即可查看请求体：

   ![image-20230220132617016](images/image-20230220132617016.png)

请求失败时，先在 Network 中核对实际发送的 URL、方法和请求体，再回到代码定位错误。这样可以先判断问题发生在请求配置、页面取值还是服务器响应。

### 3. 响应报文与状态码

响应报文是服务器按 HTTP 格式返回给浏览器的内容：

   ![image-20230404104556531](images/image-20230404104556531.png)

   ![image-20230220133141151](images/image-20230220133141151.png)

它同样分成四部分：

   - 响应行（状态行）：协议，HTTP 响应状态码，状态信息
   - 响应头：以键值对的格式携带的附加信息，比如：Content-Type（告诉浏览器，本次返回的内容类型）
   - 空行：分割响应头，控制之后的是服务器返回的资源
   - 响应体：返回的资源

HTTP 状态码用来说明请求结果。例如 404 表示客户端要找的资源在服务器上不存在：

     ![image-20230220133344116](images/image-20230220133344116.png)

### 4. 按接口文档填写请求

接口文档会给出 URL、请求方法、参数及说明，例如：[AJAX 阶段接口文档](https://apifox.com/apidoc/shared-1b0dd84f-faa8-435d-b355-5a8a329e34a8)。获取城市列表的接口页面如下：

   ![image-20230404104720587](images/image-20230404104720587.png)

根据登录接口填写请求配置：

   ```js
   document.querySelector(".btn").addEventListener("click", () => {
     // 用户登录
     axios({
       url: "http://hmajax.itheima.net/api/login",
       method: "post",
       data: {
         username: "itheima007",
         password: "7654321",
       },
     });
   });
   ```

## 六、完整示例：用户登录与表单

### 1. 读取并校验登录信息

登录请求分成四步：

1. 点击登录按钮，读取用户名和密码。
2. 检查输入长度，不符合要求时停止提交。
3. 按接口文档发送 POST 请求。
4. 根据成功或失败响应给出提示。

      ![image-20230404104851497](images/image-20230404104851497.png)

下面的代码先完成前 3 步，并把响应消息输出到控制台：

   ```js
   // 目标1：点击登录时，用户名和密码长度判断，并提交数据和服务器通信
   
   // 1.1 登录-点击事件
   document.querySelector(".btn-login").addEventListener("click", () => {
     // 1.2 获取用户名和密码
     const username = document.querySelector(".username").value;
     const password = document.querySelector(".password").value;
     // console.log(username, password)
   
     // 1.3 判断长度
     if (username.length < 8) {
       console.log("用户名必须大于等于8位");
       return; // 阻止代码继续执行
     }
     if (password.length < 6) {
       console.log("密码必须大于等于6位");
       return; // 阻止代码继续执行
     }
   
     // 1.4 基于axios提交用户名和密码
     // console.log('提交数据到服务器')
     axios({
       url: "http://hmajax.itheima.net/api/login",
       method: "POST",
       data: {
         username,
         password,
       },
     })
       .then((result) => {
         console.log(result);
         console.log(result.data.message);
       })
       .catch((error) => {
         console.log(error);
         console.log(error.response.data.message);
       });
   });
   ```

请求能否发出由输入校验决定，登录是否成功则以接口响应为准。

### 2. 把登录结果显示到页面

登录请求结束后，页面需要显示成功或失败消息。示例先准备提示标签和对应样式：

   ![image-20230404104955330](images/image-20230404104955330.png)

   ![image-20230404105003019](images/image-20230404105003019.png)

成功、失败和输入校验等分支都会更新同一个提示框，因此把显示、配色和定时隐藏放进一个函数。函数接收消息和结果状态，2 秒后移除显示类名。

对应代码：

   ```js
   /**
    * 2.2 封装提示框函数，重复调用，满足提示需求
    * 功能：
    * 1. 显示提示框
    * 2. 不同提示文字msg，和成功绿色失败红色isSuccess（true成功，false失败）
    * 3. 过2秒后，让提示框自动消失
    */
   function alertFn(msg, isSuccess) {
     // 1> 显示提示框
     myAlert.classList.add("show");
   
     // 2> 实现细节
     myAlert.innerText = msg;
     const bgStyle = isSuccess ? "alert-success" : "alert-danger";
     myAlert.classList.add(bgStyle);
   
     // 3> 过2秒隐藏
     setTimeout(() => {
       myAlert.classList.remove("show");
       // 提示：避免类名冲突，重置背景色
       myAlert.classList.remove(bgStyle);
     }, 2000);
   }
   ```

这里的封装只处理重复的界面逻辑：添加显示类名、设置文字和结果样式，再按时移除类名。各请求分支只负责传入提示消息和成功状态。

## 七、用 form-serialize 收集表单

登录表单只有两个字段时，可以逐个读取输入值；字段较多时，form-serialize 可以一次收集指定表单中的控件值。

### 1. 基本用法

逐个读取和统一收集的差别如下：

   ![image-20230404105134538](images/image-20230404105134538.png)

   ![image-20230404105141226](images/image-20230404105141226.png)

使用 serialize 前，先引入 form-serialize。第一个参数是 form 表单对象，表单控件需要设置 name，该值会作为结果中的属性名；第二个参数是配置对象。

| 配置项 | true | false |
| ------ | ---- | ----- |
| hash | 返回 JS 对象 | 返回查询字符串 |
| empty | 收集空值 | 忽略空值 |

下面的页面收集用户名和密码，并把结果输出到控制台：

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta http-equiv="X-UA-Compatible" content="IE=edge" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>form-serialize插件使用</title>
     </head>
   
     <body>
       <form action="javascript:;" class="example-form">
         <input type="text" name="username" />
         <br />
         <input type="text" name="password" />
         <br />
         <input type="button" class="btn" value="提交" />
       </form>
       <!-- 
       目标：在点击提交时，使用form-serialize插件，快速收集表单元素值
       1. 把插件引入到自己网页中
     -->
       <script src="./lib/form-serialize.js"></script>
       <script>
         document.querySelector(".btn").addEventListener("click", () => {
           /**
            * 2. 使用serialize函数，快速收集表单元素的值
            * 参数1：要获取哪个表单的数据
            *  表单元素设置name属性，值会作为对象的属性名
            *  建议name属性的值，最好和接口文档参数名一致
            * 参数2：配置对象
            *  hash 设置获取数据结构
            *    - true：JS对象（推荐）一般请求体里提交给服务器
            *    - false: 查询字符串
            *  empty 设置是否获取空值
            *    - true: 获取空值（推荐）数据结构和标签结构一致
            *    - false：不获取空值
            */
           const form = document.querySelector(".example-form");
           const data = serialize(form, { hash: true, empty: true });
           // const data = serialize(form, { hash: false, empty: true })
           // const data = serialize(form, { hash: true, empty: false })
           console.log(data);
         });
       </script>
     </body>
   </html>
   ```

示例中的 hash 决定返回 JS 对象还是查询字符串，empty 决定是否保留空值。实际请求应根据接口需要选择结果格式。

### 2. 接入登录示例

原登录页面只需改两处：先引入插件，再用 serialize 收集登录表单。每个控件的 name 应与接口字段名一致。

先引入插件：

      ```html
      <!-- 3.1 引入插件 -->
      <script src="./lib/form-serialize.js"></script>
      ```

再替换原来逐个读取输入值的代码：

      ```js
      // 3.2 使用serialize函数，收集登录表单里用户名和密码
      const form = document.querySelector(".login-form");
      const data = serialize(form, { hash: true, empty: true });
      console.log(data);
      // {username: 'itheima007', password: '7654321'}
      const { username, password } = data;
      ```

data 得到对象后，解构出 username 和 password，后面的校验与请求逻辑不需要改变。接入第三方插件时，每改一处就检查一次表单取值，避免把插件问题和请求问题混在一起。

## 八、请求检查项

写完请求后，可以按下面几项核对配置和响应：

1. axios 的配置项有哪几个，作用分别是什么？
2. 接口文档都包含哪些信息？
3. 在浏览器中如何查看查询参数/请求体，以及响应体数据？
4. 请求报文和响应报文由几个部分组成，每个部分的作用？

## 九、练习

练习要求见作业文件夹中的 Markdown 文档。

## 参考资料

1. [客户端（百度百科）](https://baike.baidu.com/item/%E5%AE%A2%E6%88%B7%E7%AB%AF/101081?fr=aladdin)
2. [浏览器（百度百科）](https://baike.baidu.com/item/%E6%B5%8F%E8%A7%88%E5%99%A8/213911?fr=aladdin)
3. [服务器（百度百科）](https://baike.baidu.com/item/%E6%9C%8D%E5%8A%A1%E5%99%A8/100571?fr=aladdin)
4. [URL（百度百科）](https://baike.baidu.com/item/%E7%BB%9F%E4%B8%80%E8%B5%84%E6%BA%90%E5%AE%9A%E4%BD%8D%E7%B3%BB%E7%BB%9F/5937042?fromtitle=URL&fromid=110640&fr=aladdin)
5. [HTTP 协议（百度百科）](https://baike.baidu.com/item/HTTP?fromtitle=HTTP%E5%8D%8F%E8%AE%AE&fromid=1276942)
6. [主机名（百度百科）](https://baike.baidu.com/item/%E4%B8%BB%E6%9C%BA%E5%90%8D)
7. [端口号（百度百科）](https://baike.baidu.com/item/%E7%AB%AF%E5%8F%A3%E5%8F%B)
8. [AJAX 解释（百度）](https://baike.baidu.com/tashuo/browse/content?id=11fca6ecdc2c066af4c5594f&lemmaId=8425&fromLemmaModule=pcBottom&lemmaTitle=ajax)
9. [MDN：AJAX 入门](https://developer.mozilla.org/zh-CN/docs/Web/Guide/AJAX/Getting_Started)
10. [axios（百度百科）](https://baike.baidu.com/item/axios)
11. [axios GitHub 仓库](https://github.com/axios/axios)
12. [axios 官方文档](https://axios-http.com/)
13. [axios（npm）](https://www.npmjs.com/package/axios)
14. [GET 和 POST（百度百科）](https://baike.baidu.com/item/post/2171305)
15. [报文（百度百科）](https://baike.baidu.com/item/%E6%8A%A5%E6%96%87/3164352)
16. [HTTP 状态码（百度百科）](https://baike.baidu.com/item/HTTP%E7%8A%B6%E6%80%81%E7%A0%81/5053660)
17. [接口（百度百科）](https://baike.baidu.com/item/%E6%8E%A5%E5%8F%A3/2886384)
