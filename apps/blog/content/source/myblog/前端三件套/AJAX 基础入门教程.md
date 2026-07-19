---
title: "AJAX 基础：用 axios 发请求并处理响应"
date: 2025-12-20 12:00:04
slug: ajax-basics-intro
tags:
  - "AJAX基础"
  - "axios"
  - "HTTP请求"
  - "前后端通信"
categories:
  - "前端开发"
  - "AJAX"
---


网页经常只需要更新一小块内容，例如提交表单、加载列表或根据输入查询数据。AJAX 让 JavaScript 在不重新加载整页的情况下与服务器交换数据，再把响应结果更新到页面上。

## 一、异步请求解决什么问题

AJAX(Asynchronous JavaScript And XML)描述的是一套异步通信方式。页面发出请求后仍可继续响应其他操作，等服务器返回数据，再由 JavaScript 处理结果。

一次请求通常按下面的顺序进行：

```
用户操作 → JavaScript发起请求 → 服务器处理 → 返回数据 → JavaScript更新页面
```

这套流程有三个直接结果：只请求当前需要的数据、保留页面已有状态、按响应结果局部更新内容。

## 二、用 axios 发起最小请求

axios 封装了请求配置、响应处理和错误处理。先看 GET 与 POST 的基本写法：

### 1. 请求结构

```javascript
// GET请求 - 获取数据
axios({
  url: "http://example.com/api/data",
  method: "GET",
})
  .then(function (response) {
    console.log("成功获取数据:", response.data);
  })
  .catch(function (error) {
    console.log("出错了:", error);
  });

// POST请求 - 提交数据
axios({
  url: "http://example.com/api/save",
  method: "POST",
  data: {
    name: "张三",
    age: 18,
  },
}).then(function (response) {
  console.log("提交成功:", response.data);
});
```

### 2. 常用配置项

| 参数名 | 作用               | 示例                                    |
| ------ | ------------------ | --------------------------------------- |
| url    | 请求地址           | 'http://api.example.com/users'          |
| method | 请求方法           | 'GET'、'POST'、'PUT'、'DELETE'          |
| params | 查询参数（GET）    | {id: 1, name: '张三'}                   |
| data   | 请求体数据（POST） | {username: 'admin', password: '123456'} |

### 3. URL 与查询参数

请求最终会发往一个 URL：

```
http://hmajax.itheima.net/api/province?pname=河北省
```

- **协议**（http://）：规定通信方式
- **域名**（hmajax.itheima.net）：定位服务器
- **路径**（/api/province）：定位服务器上的资源
- **参数**（?pname=河北省）：向接口补充查询条件

GET 查询通常把条件放进 params，POST 提交通常把数据放进 data。具体采用哪种请求方法、参数名和数据格式，要以接口文档为准。

## 三、先看响应，再排查错误

axios 在请求成功时进入 then，响应数据通常从 response.data 读取；请求失败时进入 catch。调试时不要只盯着页面提示，Network 和 Console 能更快说明问题出在哪一层。

### 1. 常用 HTTP 请求方法

| 方法   | 作用     |
| ------ | -------- |
| GET    | 获取数据 |
| POST   | 提交数据 |
| PUT    | 更新数据 |
| DELETE | 删除数据 |
| PATCH  | 部分更新 |

### 2. 常见响应状态码

| 状态码 | 含义       |
| ------ | ---------- |
| 200    | 请求成功   |
| 404    | 资源未找到 |
| 500    | 服务器错误 |
| 403    | 禁止访问   |

### 3. 浏览器里怎么查

1. 按 F12 打开开发者工具，在 Network 中查看请求 URL、方法、参数、状态码和响应体。
2. 在 Console 中查看代码输出和运行错误。
3. 如果请求失败，依次确认 URL、网络连接、请求参数格式和服务器返回的信息。

## 四、把请求接进页面

### 1. 获取省份列表

这个例子发送 GET 请求，读取返回的省份数组，再生成 HTML 放进页面。加载失败时，catch 会把界面切换到错误状态。

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>获取省份列表</title>
  </head>
  <body>
    <h2>中国省份列表</h2>
    <div id="provinceList">加载中...</div>

    <!-- 引入axios库 -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script>
      // 使用axios获取省份数据
      axios({
        url: "http://hmajax.itheima.net/api/province",
      })
        .then(function (result) {
          // 成功获取数据
          console.log("获取到的数据:", result);

          // 提取省份列表
          const provinces = result.data.list;

          // 将数组转换为HTML字符串
          const htmlStr = provinces
            .map(function (province) {
              return "<p>🏞️ " + province + "</p>";
            })
            .join("");

          // 显示到页面上
          document.getElementById("provinceList").innerHTML = htmlStr;
        })
        .catch(function (error) {
          // 处理错误
          console.log("获取数据失败:", error);
          document.getElementById("provinceList").innerHTML = "❌ 数据加载失败";
        });
    </script>
  </body>
</html>
```

### 2. 带参数查询城市

选择省份后，把省份名作为查询参数发送给城市接口。响应为空、请求失败和正常返回分别处理，避免页面一直停在加载状态。

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>城市查询</title>
  </head>
  <body>
    <h2>城市查询系统</h2>
    <select id="provinceSelect">
      <option value="">请选择省份</option>
      <option value="河北省">河北省</option>
      <option value="辽宁省">辽宁省</option>
      <option value="山东省">山东省</option>
    </select>

    <div id="cityResult">请先选择省份</div>

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script>
      // 监听下拉框变化
      document
        .getElementById("provinceSelect")
        .addEventListener("change", function () {
          const selectedProvince = this.value;

          if (selectedProvince === "") {
            document.getElementById("cityResult").innerHTML = "请先选择省份";
            return;
          }

          // 显示加载状态
          document.getElementById("cityResult").innerHTML =
            "🔄 正在查询城市信息...";

          // 使用查询参数获取城市数据
          axios({
            url: "http://hmajax.itheima.net/api/city",
            params: {
              pname: selectedProvince,
            },
          })
            .then(function (result) {
              // 成功获取城市数据
              const cities = result.data.list;

              if (cities.length === 0) {
                document.getElementById("cityResult").innerHTML =
                  "该省份暂无城市数据";
                return;
              }

              // 生成城市列表HTML
              const cityHtml = cities
                .map(function (city) {
                  return (
                    '<span style="margin: 5px; padding: 5px 10px; background: #e3f2fd; border-radius: 5px;">' +
                    city +
                    "</span>"
                  );
                })
                .join("");

              document.getElementById("cityResult").innerHTML =
                "<h3>🏙️ 包含以下城市：</h3>" + cityHtml;
            })
            .catch(function (error) {
              document.getElementById("cityResult").innerHTML =
                "❌ 查询失败，请稍后重试";
              console.log("查询失败:", error);
            });
        });
    </script>
  </body>
</html>
```

### 3. 提交登录表单

登录示例先读取并校验用户名、密码，再通过 POST 提交 data。成功和失败共用 showMessage 更新提示区域。

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>用户登录</title>
    <style>
      .login-container {
        width: 300px;
        margin: 50px auto;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
      }
      input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      button {
        width: 100%;
        padding: 10px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background: #45a049;
      }
      .message {
        margin-top: 15px;
        padding: 10px;
        border-radius: 4px;
        text-align: center;
      }
      .success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      .error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <h2>用户登录</h2>
      <form id="loginForm">
        <div class="form-group">
          <label for="username">用户名：</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="请输入用户名"
            required />
        </div>
        <div class="form-group">
          <label for="password">密码：</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="请输入密码"
            required />
        </div>
        <button type="submit">登录</button>
      </form>
      <div id="message"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script>
      // 处理表单提交
      document
        .getElementById("loginForm")
        .addEventListener("submit", function (e) {
          e.preventDefault(); // 阻止表单默认提交

          // 获取表单数据
          const username = document.getElementById("username").value;
          const password = document.getElementById("password").value;

          // 简单验证
          if (username.length < 3) {
            showMessage("用户名至少需要3个字符", "error");
            return;
          }

          if (password.length < 6) {
            showMessage("密码至少需要6个字符", "error");
            return;
          }

          // 显示加载状态
          showMessage("🔄 正在登录...", "info");

          // 发送登录请求
          axios({
            url: "http://hmajax.itheima.net/api/login",
            method: "POST",
            data: {
              username: username,
              password: password,
            },
          })
            .then(function (result) {
              // 登录成功
              console.log("登录成功:", result);
              showMessage("✅ 登录成功！欢迎回来", "success");

              // 这里可以保存登录状态，跳转到其他页面等
              // localStorage.setItem('token', result.data.token);
            })
            .catch(function (error) {
              // 登录失败
              console.log("登录失败:", error);
              const errorMsg =
                error.response &&
                error.response.data &&
                error.response.data.message
                  ? error.response.data.message
                  : "登录失败，请检查用户名和密码";
              showMessage("❌ " + errorMsg, "error");
            });
        });

      // 显示消息函数
      function showMessage(text, type) {
        const messageDiv = document.getElementById("message");
        messageDiv.className = "message " + type;
        messageDiv.textContent = text;

        // 3秒后清除消息
        setTimeout(function () {
          messageDiv.className = "";
          messageDiv.textContent = "";
        }, 3000);
      }
    </script>
  </body>
</html>
```

## 五、练习

1. 尝试修改省份列表案例，添加加载动画效果
2. 在城市查询案例中添加错误处理提示
3. 为登录功能添加记住用户名选项
