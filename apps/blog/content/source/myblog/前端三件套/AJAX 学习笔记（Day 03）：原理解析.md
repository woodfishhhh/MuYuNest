---
title: "AJAX 原理：请求、响应、异步与封装"
date: 2025-10-19 02:29:38
tags:
  - "AJAX"
  - "原理"
  - "前后端交互"
categories:
  - "前端开发"
  - "AJAX"
---


AJAX 的关键不在某个库叫什么，而在浏览器怎么发 HTTP 请求、怎么收响应，以及异步结果回来以后 JavaScript 怎么接着执行。axios 把这些步骤包成了更好用的接口；把 XHR 和 Promise 弄懂了，请求出错时也更容易定位。

## 一、请求过程

先看一个常见的 axios GET 请求。它接收 URL，返回 Promise，把响应数据放在 `res.data` 里。

```javascript
// 小张的日常：开车很熟练，但不懂发动机原理
axios.get('/api/data').then(res => {
    console.log('到站了！', res.data);
});
```

这段调用省掉了创建请求、监听事件和解析响应这些步骤。后面会用 `XMLHttpRequest` 把它们一步步拆开，再一点点封装回类似的调用方式。

### 响应状态预览

HTTP 状态码先告诉我们请求在协议层面的结果。下面是几个常见的状态码。

```js
// 你知道这些状态码的含义吗？
const statusCodes = {
  200: '_____',  // 成功
  404: '_____',  // 未找到
  500: '_____',  // 服务器错误
  403: '_____',  // 禁止访问
  301: '_____'   // 永久重定向
};
```

对应的含义：

```js
const statusCodes = {
  200: '请求成功',      // ✅ 成功
  404: '资源未找到',    // ❌ 未找到
  500: '服务器内部错误', // 🔥 服务器错误
  403: '禁止访问',      // 🔒 禁止访问
  301: '永久重定向'     // ↗️ 永久重定向
};
```

`2xx` 一般表示请求成功，`4xx` 多跟请求、资源或权限有关，`5xx` 表示服务器处理失败了。业务接口还可能在响应体里返回自己的错误码，不能只看 HTTP 状态。

### 异步执行预览

网络请求不会卡住后面的 JavaScript。先用同步代码、Promise 和定时器看看事件循环里的基本顺序。

```js
// 你能预测这些代码的执行顺序吗？
console.log('🥇 第一名：同步代码');

setTimeout(() => {
  console.log('🥉 第三名：定时器（0秒）');
}, 0);

Promise.resolve().then(() => {
  console.log('🥈 第二名：Promise');
});

console.log('🥇 第一名：另一个同步代码');
// 输出顺序是：？？？
```

输出是：

```
输出顺序：
1. 🥇 第一名：同步代码
2. 🥇 第一名：另一个同步代码  
3. 🥈 第二名：Promise
4. 🥉 第三名：定时器（0秒）

💡 原理：同步 → Promise微任务 → 定时器宏任务
```

当前调用栈里的同步代码先执行，Promise 的回调进微任务队列，`setTimeout` 的回调进后面的任务。就算没有额外的延迟，定时器也要等当前代码和微任务都处理完。

### 错误对象怎么读

请求失败时，先把错误消息、响应状态、响应数据和请求配置打出来。

```js
// 请求失败了，你如何排查？
axios.get('/api/books')
  .then(res => console.log('成功', res))
  .catch(err => {
    // 🚨 请求失败，你如何诊断问题？
    console.log('错误信息：', err.message);
    console.log('状态码：', err.response?.status);
    console.log('错误数据：', err.response?.data);
    console.log('请求配置：', err.config);
  });
```

axios 的错误对象可以按三种情况分开处理。

```js
// 企业级错误诊断流程
axios.get('/api/books')
  .then(res => console.log('成功', res))
  .catch(err => {
    // 🔍 第一步：看错误类型
    if (err.response) {
      // ✅ 服务器响应了（有状态码）
      console.log(`服务器返回错误：${err.response.status}`);
      console.log(`错误消息：${err.response.data.message}`);
    } else if (err.request) {
      // ❌ 请求发了但没响应（网络问题）
      console.log('网络连接失败，请检查：');
      console.log('- 网络连接是否正常');
      console.log('- API地址是否正确');
      console.log('- 服务器是否运行');
    } else {
      // 💥 其他错误（配置问题）
      console.log('请求配置错误：', err.message);
    }
  });
```

有 `err.response`，说明服务器返回了响应；只有 `err.request` 的话，查网络、URL、跨域和服务状态；两个都没有，再看请求配置和调用代码。

### 调试工具

浏览器调试主要用 Network 和 Console。Network 用来核对 URL、方法、请求头、请求体、状态码和响应体；Console 用来看异常、断点和异步回调。

```bash
# Chrome DevTools - 工程师级配置
✅ Network面板：监控所有HTTP请求
  - 查看请求头、响应头
  - 分析状态码和响应时间
  - 模拟慢网络和离线状态

✅ Console面板：JavaScript调试
  - 断点调试异步代码
  - 监控Promise状态
  - 性能分析和内存检测

✅ Application面板：数据存储查看
  - LocalStorage状态监控
  - SessionStorage数据查看
  - Cookie和缓存管理
```

Application 面板适合核对 Cookie、LocalStorage、SessionStorage 和缓存。排查请求时，先看 Network 里是不是真的出现了这条请求，再决定是查前端调用还是查服务器响应。

原文列的编辑器工具保留在下面。它们不是 AJAX 跑起来的前提，按项目现有的配置选就行。

```javascript
// VS Code插件推荐（企业级开发）
必装插件：
✅ ESLint - 代码规范检查（企业代码标准）
✅ Prettier - 代码格式化（团队协作）
✅ Live Server - 本地服务器（模拟真实环境）
✅ REST Client - API测试（接口调试）
```

### 请求监控示例

下面的示例试着重写 XHR 的 `open` 和 `send`，记录请求耗时、状态码和响应大小。

```javascript
// 企业级：AJAX性能监控器
class EnterpriseAjaxMonitor {
  constructor() {
    this.requests = [];
    this.init();
  }
  
  init() {
    // 监听所有AJAX请求
    this.originalOpen = XMLHttpRequest.prototype.open;
    this.originalSend = XMLHttpRequest.prototype.send;
    
    // 重写方法以收集数据
    XMLHttpRequest.prototype.open = function(method, url) {
      this._method = method;
      this._url = url;
      this._startTime = Date.now();
      return this.originalOpen.apply(this, arguments);
    };
    
    // 监控请求完成
    XMLHttpRequest.prototype.send = function() {
      this.addEventListener('loadend', () => {
        this._endTime = Date.now();
        this._duration = this._endTime - this._startTime;
        
        console.log(`🚀 请求完成：${this._method} ${this._url}`);
        console.log(`⏱️ 响应时间：${this._duration}ms`);
        console.log(`📊 状态码：${this.status}`);
        console.log(`💾 数据大小：${this.responseText.length}字符`);
      });
      
      return this.originalSend.apply(this, arguments);
    };
  }
}

// 使用：自动监控所有AJAX请求
new EnterpriseAjaxMonitor();
```

这段代码表达的是统一拦截请求的思路，但方法被替换以后，函数里的 `this` 指向的是 XHR 实例。直接拿来用之前，要先改对原方法引用的保存位置。后面完整的监控示例会把这一点处理得更清楚。
### XHR 请求生命周期

原生 XHR 把请求过程直接摆在面前：创建实例、配置请求、监听响应、发送数据。axios 在调用层做了封装，但排查浏览器端的请求时，这几个动作还是判断问题出在哪的基础。

下面先创建 XHR，监听开始、进度、完成、网络错误和超时这几个事件。
```javascript
// 🏭 企业级：创建XMLHttpRequest实例
class EnterpriseXMLHttpRequest {
  constructor() {
    this.xhr = new XMLHttpRequest();
    this.config = {
      timeout: 30000,        // 30秒超时（企业标准）
      withCredentials: false, // 跨域凭证配置
      responseType: 'json'    // 响应类型预设
    };
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // 🎯 企业级：完整事件监听
    this.xhr.addEventListener('loadstart', () => {
      console.log(`🚀 请求开始: ${this.config.method} ${this.config.url}`);
    });
    
    this.xhr.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        console.log(`📊 上传进度: ${percentComplete.toFixed(1)}%`);
      }
    });
    
    this.xhr.addEventListener('load', () => {
      console.log(`✅ 请求完成: ${this.xhr.status} ${this.xhr.statusText}`);
    });
    
    this.xhr.addEventListener('error', () => {
      console.error(`❌ 请求错误: 网络连接失败`);
    });
    
    this.xhr.addEventListener('timeout', () => {
      console.warn(`⏰ 请求超时: 超过${this.config.timeout}ms`);
    });
  }
}
```

事件只负责通知状态变了。请求方法、URL、超时和响应类型还要单独配置。

下面的配置类统一处理方法、URL、请求头和默认值。
```javascript
// 🏭 企业级：请求配置标准化
class EnterpriseRequestConfig {
  static create(method, url, options = {}) {
    // 🎯 企业级：URL验证和规范化
    if (!this.isValidUrl(url)) {
      throw new Error(`❌ 无效URL: ${url}`);
    }
    
    // 🔧 企业级：参数默认值和验证
    return {
      method: method.toUpperCase(),
      url: this.normalizeUrl(url),
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers
      },
      withCredentials: options.withCredentials || false,
      responseType: options.responseType || 'json'
    };
  }
  
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  static normalizeUrl(url) {
    // 🔧 企业级：URL规范化处理
    const urlObj = new URL(url);
    return urlObj.toString();
  }
}
```

配置里的 `method` 会转成大写，URL 用 `new URL` 校验。这种写法更适合绝对 URL；用相对地址的话要提供一个基准地址。

接下来按 `readyState` 读响应进度，完成后检查 HTTP 状态码。
```javascript
// 🏭 企业级：响应事件标准化处理
class EnterpriseResponseHandler {
  constructor(xhr) {
    this.xhr = xhr;
    this.setupResponseListeners();
  }
  
  setupResponseListeners() {
    // 🎯 企业级：完整响应生命周期监听
    this.xhr.addEventListener('readystatechange', () => {
      switch (this.xhr.readyState) {
        case 1: // OPENED
          console.log('📤 请求已打开');
          break;
        case 2: // HEADERS_RECEIVED
          console.log('📨 响应头已接收');
          this.logResponseHeaders();
          break;
        case 3: // LOADING
          console.log('📥 响应体加载中...');
          break;
        case 4: // DONE
          console.log('✅ 响应完成');
          this.handleResponseComplete();
          break;
      }
    });
  }
  
  logResponseHeaders() {
    // 📊 企业级：响应头分析
    const headers = this.xhr.getAllResponseHeaders();
    console.log('📋 响应头信息:');
    console.log('- 内容类型:', this.xhr.getResponseHeader('Content-Type'));
    console.log('- 内容长度:', this.xhr.getResponseHeader('Content-Length'));
    console.log('- 服务器:', this.xhr.getResponseHeader('Server'));
    console.log('- 时间戳:', this.xhr.getResponseHeader('Date'));
  }
  
  handleResponseComplete() {
    // 🎯 企业级：响应完成处理
    const status = this.xhr.status;
    const statusText = this.xhr.statusText;
    
    if (status >= 200 && status < 300) {
      // ✅ 成功响应
      console.log(`🎉 请求成功: ${status} ${statusText}`);
      this.processSuccessResponse();
    } else if (status >= 400 && status < 500) {
      // ❌ 客户端错误
      console.error(`😞 客户端错误: ${status} ${statusText}`);
      this.processClientError();
    } else if (status >= 500) {
      // 🔥 服务器错误
      console.error(`🔥 服务器错误: ${status} ${statusText}`);
      this.processServerError();
    } else {
      // ❓ 其他状态
      console.warn(`❓ 其他状态: ${status} ${statusText}`);
    }
  }
  
  processSuccessResponse() {
    try {
      const responseData = JSON.parse(this.xhr.responseText);
      console.log('📦 响应数据:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ JSON解析失败:', error);
      return this.xhr.responseText;
    }
  }
  
  processClientError() {
    const errorMessages = {
      400: '请求参数错误',
      401: '未授权访问',
      403: '权限不足',
      404: '资源未找到',
      422: '数据验证失败'
    };
    
    console.error(`💡 建议: ${errorMessages[this.xhr.status] || '检查请求参数'}`);
  }
  
  processServerError() {
    console.error('📞 建议: 联系后端开发团队检查服务器状态');
  }
}
```

`readyState === 4` 只表示请求结束了。示例接着用 `status` 区分 `2xx`、`4xx` 和 `5xx`，在成功的分支里解析 JSON。

最后把请求头、超时和跨域凭证写进 XHR，再调 `send`。
```javascript
// 🏭 企业级：请求发送和监控
class EnterpriseRequestSender {
  constructor(xhr, config) {
    this.xhr = xhr;
    this.config = config;
    this.sendRequest();
  }
  
  sendRequest() {
    // 🎯 企业级：请求发送前准备
    console.log(`🚀 准备发送请求: ${this.config.method} ${this.config.url}`);
    
    // 🔧 企业级：设置请求头
    Object.entries(this.config.headers).forEach(([key, value]) => {
      this.xhr.setRequestHeader(key, value);
    });
    
    // ⏱️ 企业级：设置超时
    this.xhr.timeout = this.config.timeout;
    
    // 🔐 企业级：跨域凭证配置
    this.xhr.withCredentials = this.config.withCredentials;
    
    // 📤 企业级：发送请求
    try {
      this.xhr.send(this.config.data || null);
      console.log('✅ 请求发送成功');
    } catch (error) {
      console.error('❌ 请求发送失败:', error);
      throw error;
    }
  }
}
```

`send` 的参数是请求体；没有请求体就传 `null`。同步抛出的异常会进 `catch`，网络错误和超时还是由事件来处理。

### 记录请求指标

要统一观察页面里的 XHR 的话，可以留着原来的构造函数，再包装每个实例的 `open` 和 `send`。下面记录请求方法、URL、状态码、耗时和响应大小。
```javascript
// 🏭 企业级：XHR监控系统（完整实现）
class EnterpriseXHRMonitor {
  constructor(config = {}) {
    this.config = {
      enableLogging: config.enableLogging !== false,
      enableMetrics: config.enableMetrics !== false,
      enableErrorTracking: config.enableErrorTracking !== false,
      maxRequests: config.maxRequests || 1000,
      ...config
    };
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requests: []
    };
    
    this.init();
  }
  
  init() {
    this.overrideXMLHttpRequest();
    console.log('🎯 XHR监控系统已启动');
  }
  
  overrideXMLHttpRequest() {
    const OriginalXMLHttpRequest = window.XMLHttpRequest;
    const self = this;
    
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXMLHttpRequest();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      let requestInfo = {
        id: Date.now() + Math.random(),
        startTime: Date.now(),
        method: '',
        url: '',
        status: 0,
        statusText: '',
        responseTime: 0,
        responseSize: 0,
        error: null
      };
      
      // 重写open方法
      xhr.open = function(method, url, async, user, password) {
        requestInfo.method = method;
        requestInfo.url = url;
        originalOpen.apply(xhr, arguments);
      };
      
      // 重写send方法
      xhr.send = function(data) {
        requestInfo.startTime = Date.now();
        
        // 监听各种事件
        xhr.addEventListener('loadstart', () => {
          if (self.config.enableLogging) {
            console.log(`🚀 请求开始: ${requestInfo.method} ${requestInfo.url}`);
          }
        });
        
        xhr.addEventListener('loadend', () => {
          requestInfo.status = xhr.status;
          requestInfo.statusText = xhr.statusText;
          requestInfo.responseTime = Date.now() - requestInfo.startTime;
          requestInfo.responseSize = xhr.responseText ? xhr.responseText.length : 0;
          
          // 分析请求结果
          self.analyzeRequest(requestInfo);
        });
        
        xhr.addEventListener('error', () => {
          requestInfo.error = 'Network Error';
        });
        
        xhr.addEventListener('timeout', () => {
          requestInfo.error = 'Timeout Error';
        });
        
        originalSend.apply(xhr, arguments);
      };
      
      return xhr;
    };
  }
  
  analyzeRequest(requestInfo) {
    // 更新统计指标
    this.metrics.totalRequests++;
    
    if (requestInfo.status >= 200 && requestInfo.status < 300) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // 计算平均响应时间
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (totalTime + requestInfo.responseTime) / this.metrics.totalRequests;
    
    // 保存请求记录
    this.metrics.requests.push(requestInfo);
    
    // 限制记录数量
    if (this.metrics.requests.length > this.config.maxRequests) {
      this.metrics.requests.shift();
    }
    
    // 输出分析结果
    if (this.config.enableLogging) {
      this.logRequestAnalysis(requestInfo);
    }
    
    // 触发分析事件
    this.triggerAnalysisEvent(requestInfo);
  }
  
  logRequestAnalysis(requestInfo) {
    const statusEmoji = requestInfo.status >= 200 && requestInfo.status < 300 ? '✅' : '❌';
    console.log(`${statusEmoji} 请求完成: ${requestInfo.method} ${requestInfo.url}`);
    console.log(`⏱️ 响应时间: ${requestInfo.responseTime}ms`);
    console.log(`📊 状态码: ${requestInfo.status} ${requestInfo.statusText}`);
    console.log(`💾 数据大小: ${requestInfo.responseSize}字符`);
    
    if (requestInfo.error) {
      console.error(`💥 错误类型: ${requestInfo.error}`);
    }
  }
  
  triggerAnalysisEvent(requestInfo) {
    // 触发自定义事件，供外部监听
    const event = new CustomEvent('xhrAnalysisComplete', {
      detail: {
        request: requestInfo,
        metrics: this.getMetrics()
      }
    });
    
    window.dispatchEvent(event);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2)
        : 0,
      requests: [...this.metrics.requests] // 返回副本
    };
  }
  
  getReport() {
    const metrics = this.getMetrics();
    
    return {
      summary: {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        successRate: metrics.successRate + '%',
        averageResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms'
      },
      recentRequests: metrics.requests.slice(-10), // 最近10个请求
      slowestRequests: [...metrics.requests]
        .sort((a, b) => b.responseTime - a.responseTime)
        .slice(0, 5), // 最慢的5个请求
      failedRequests: metrics.requests.filter(req => req.status >= 400)
    };
  }
}

// 🎯 使用示例：企业级XHR监控系统
const xhrMonitor = new EnterpriseXHRMonitor({
  enableLogging: true,
  enableMetrics: true,
  maxRequests: 500
});

// 监听分析结果
window.addEventListener('xhrAnalysisComplete', (event) => {
  console.log('📊 XHR分析完成:', event.detail);
});
```

监控器会触发一个 `xhrAnalysisComplete` 自定义事件，外面可以读到单次请求和汇总的指标。下面把这些数据渲染成一个简单的面板。
```javascript
// 企业级：监控数据可视化
class EnterpriseMonitorDashboard {
  constructor(monitor) {
    this.monitor = monitor;
    this.createDashboard();
  }
  
  createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'xhr-monitor-dashboard';
    dashboard.innerHTML = `
      <div class="monitor-container">
        <h3>🎯 XHR性能监控面板</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value" id="total-requests">0</div>
            <div class="metric-label">总请求数</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="success-rate">0%</div>
            <div class="metric-label">成功率</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="avg-response-time">0ms</div>
            <div class="metric-label">平均响应时间</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="failed-requests">0</div>
            <div class="metric-label">失败请求</div>
          </div>
        </div>
        <div class="recent-requests">
          <h4>📋 最近请求记录</h4>
          <table class="requests-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>方法</th>
                <th>URL</th>
                <th>状态码</th>
                <th>响应时间</th>
                <th>数据大小</th>
              </tr>
            </thead>
            <tbody id="requests-tbody">
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(dashboard);
    this.startUpdating();
  }
  
  startUpdating() {
    setInterval(() => {
      this.updateMetrics();
      this.updateRecentRequests();
    }, 1000);
  }
  
  updateMetrics() {
    const metrics = this.monitor.getMetrics();
    
    document.getElementById('total-requests').textContent = metrics.totalRequests;
    document.getElementById('success-rate').textContent = metrics.successRate + '%';
    document.getElementById('avg-response-time').textContent = metrics.averageResponseTime.toFixed(0) + 'ms';
    document.getElementById('failed-requests').textContent = metrics.failedRequests;
  }
  
  updateRecentRequests() {
    const metrics = this.monitor.getMetrics();
    const recentRequests = metrics.requests.slice(-10).reverse();
    
    const tbody = document.getElementById('requests-tbody');
    tbody.innerHTML = recentRequests.map(req => `
      <tr class="${req.status >= 400 ? 'error-row' : 'success-row'}">
        <td>${new Date(req.startTime).toLocaleTimeString()}</td>
        <td><span class="method-badge method-${req.method.toLowerCase()}">${req.method}</span></td>
        <td class="url-cell" title="${req.url}">${this.truncateUrl(req.url)}</td>
        <td><span class="status-badge status-${req.status}">${req.status}</span></td>
        <td>${req.responseTime}ms</td>
        <td>${req.responseSize}B</td>
      </tr>
    `).join('');
  }
  
  truncateUrl(url) {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

// 🎯 启动监控面板
setTimeout(() => {
  new EnterpriseMonitorDashboard(xhrMonitor);
}, 1000);
```

面板每秒刷新一次总请求数、成功率、平均响应时间和失败的请求。真正接进项目时，还要处理定时器的销毁、重复挂载和敏感 URL 的脱敏。

### 最小 XHR 示例

前面的代码把生命周期和监控拆开讲了。下面回到最小的版本，把创建、配置、监听和发送放进一个能运行的 HTML 页面。

   ```html
   <!DOCTYPE html>
   <html lang="en">
   
   <head>
     <meta charset="UTF-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>XMLHttpRequest_基础使用</title>
   </head>
   
   <body>
     <p class="my-p"></p>
     <script>
       /**
        * 目标：使用XMLHttpRequest对象与服务器通信
        *  1. 创建 XMLHttpRequest 对象
        *  2. 配置请求方法和请求 url 地址
        *  3. 监听 loadend 事件，接收响应结果
        *  4. 发起请求
       */
       // 1. 创建 XMLHttpRequest 对象
       const xhr = new XMLHttpRequest()
   
       // 2. 配置请求方法和请求 url 地址
       xhr.open('GET', 'http://hmajax.itheima.net/api/province')
   
       // 3. 监听 loadend 事件，接收响应结果
       xhr.addEventListener('loadend', () => {
         console.log(xhr.response)
         const data = JSON.parse(xhr.response)
         console.log(data.list.join('<br>'))
         document.querySelector('.my-p').innerHTML = data.list.join('<br>')
       })
   
       // 4. 发起请求
       xhr.send()
     </script>
   </body>
   
   </html>
   ```


`XMLHttpRequest` 是浏览器提供的。最小的调用顺序：创建实例，`open` 配置方法和 URL，监听结束事件，`send` 发出请求。

### 查询参数

查询参数放在 URL 的 `?` 后面，多组参数用 `&` 连起来。原生 XHR 不会像 axios 的 `params` 那样自动拼，要自己构造 URL。下面请求辽宁省的城市列表。

   ![image-20230404133429378](images/image-20230404133429378.png)
   ```js
   /**
    * 目标：使用XHR携带查询参数，展示某个省下属的城市列表
   */
   const xhr = new XMLHttpRequest()
   xhr.open('GET', 'http://hmajax.itheima.net/api/city?pname=辽宁省')
   xhr.addEventListener('loadend', () => {
     console.log(xhr.response)
     const data = JSON.parse(xhr.response)
     console.log(data)
     document.querySelector('.city-p').innerHTML = data.list.join('<br>')
   })
   xhr.send()
   ```


参数已经跟着 `open` 里的 URL 发出去了，`send()` 不用再传请求体。响应还是字符串，示例用 `JSON.parse` 转成对象。

### 用 URLSearchParams 处理多组参数

输入省份和城市以后，可以把多组参数交给 `URLSearchParams`，不用手写 `参数名=值&参数名=值`。

   ![image-20230221184135458](images/image-20230221184135458.png)

下面只演示对象怎么转成查询字符串。

   ```js
   // 1. 创建 URLSearchParams 对象
   const paramsObj = new URLSearchParams({
     参数名1: 值1,
     参数名2: 值2
   })
   
   // 2. 生成指定格式查询参数字符串
   const queryString = paramsObj.toString()
   // 结果：参数名1=值1&参数名2=值2
   ```


`toString()` 返回能拼到 URL 上的查询字符串，参数值会按 URL 规则编码。

### 提交 JSON 请求体

POST 注册请求把用户名和密码放在请求体里。前端要声明 `Content-Type: application/json`，用 `JSON.stringify` 把对象转成字符串，再把结果传给 `send`。

   ![image-20230404135245271](images/image-20230404135245271.png)

先看请求体的基本写法。

      ```js
      const xhr = new XMLHttpRequest()
      xhr.open('请求方法', '请求url网址')
      xhr.addEventListener('loadend', () => {
        console.log(xhr.response)
      })
      
      // 1. 告诉服务器，我传递的内容类型，是 JSON 字符串
      xhr.setRequestHeader('Content-Type', 'application/json')
      // 2. 准备数据并转成 JSON 字符串
      const user = { username: 'itheima007', password: '7654321' }
      const userStr = JSON.stringify(user)
      // 3. 发送请求体数据
      xhr.send(userStr)
      ```


`setRequestHeader` 必须在 `open` 之后、`send` 之前调。下面把它放进注册按钮的点击处理函数里。

   ```js
   /**
    * 目标：使用xhr进行数据提交-完成注册功能
   */
   document.querySelector('.reg-btn').addEventListener('click', () => {
     const xhr = new XMLHttpRequest()
     xhr.open('POST', 'http://hmajax.itheima.net/api/register')
     xhr.addEventListener('loadend', () => {
       console.log(xhr.response)
     })
   
     // 设置请求头-告诉服务器内容类型（JSON字符串）
     xhr.setRequestHeader('Content-Type', 'application/json')
     // 准备提交的数据
     const userObj = {
       username: 'itheima007',
       password: '7654321'
     }
     const userStr = JSON.stringify(userObj)
     // 设置请求体，发起请求
     xhr.send(userStr)
   })
   ```


请求体要放在 `send` 里，数据格式还要和请求头、后端接口的约定一致。

## 二、响应与状态

XHR 的 `readyState` 描述请求的进度，HTTP 的 `status` 描述响应的结果。前面的响应处理器已经展示了 `1` 到 `4` 的状态变化；实际判断成功时，还是要检查状态码是不是 `2xx`。网络错误和超时再通过 `error`、`timeout` 事件区分。

## 三、异步执行

### Promise 管理异步结果

Promise 表示一次异步操作最后是成功还是失败。在构造函数里启动任务，成功时调 `resolve`，失败时调 `reject`；调用方用 `then` 和 `catch` 处理结果。

原课程用这张图说明 Promise 和 axios 调用之间的关系。

![image-20230222113651404](images/image-20230222113651404.png)

先看 Promise 的基本结构。

   ```js
   // 1. 创建 Promise 对象
   const p = new Promise((resolve, reject) => {
    // 2. 执行异步任务-并传递结果
    // 成功调用: resolve(值) 触发 then() 执行
    // 失败调用: reject(值) 触发 catch() 执行
   })
   // 3. 接收结果
   p.then(result => {
    // 成功
   }).catch(error => {
    // 失败
   })
   ```

`resolve` 的值会进 `then`，`reject` 的值会进 `catch`。下面用定时器模拟一次失败。

   ```js
   /**
    * 目标：使用Promise管理异步任务
   */
   // 1. 创建Promise对象
   const p = new Promise((resolve, reject) => {
     // 2. 执行异步代码
     setTimeout(() => {
       // resolve('模拟AJAX请求-成功结果')
       reject(new Error('模拟AJAX请求-失败结果'))
     }, 2000)
   })
   
   // 3. 获取结果
   p.then(result => {
     console.log(result)
   }).catch(error => {
     console.log(error)
   })
   ```


两秒后 Promise 变成失败状态，所以执行 `catch`。把示例里的 `reject` 换成 `resolve`，就会进 `then`。

### Promise 的三种状态

每个 Promise 都处在下面某一种状态：

- `pending`：初始状态，还没成功也没失败。
- `fulfilled`：异步操作成功完成了。
- `rejected`：异步操作失败了。

状态一变，就会触发关联的处理函数。

   ![image-20230222120815484](images/image-20230222120815484.png)

Promise 一旦从 `pending` 变成 `fulfilled` 或 `rejected`，状态就不会再变了。

### 用 Promise 包装 XHR

把 XHR 放进 Promise 以后，事件回调负责判断成功还是失败，调用方继续用 `then` 和 `catch`。下面请求省份列表并渲染到页面上。

   ![image-20230404140252181](images/image-20230404140252181.png)

   ```js
   /**
    * 目标：使用Promise管理XHR请求省份列表
    *  1. 创建Promise对象
    *  2. 执行XHR异步代码，获取省份列表
    *  3. 关联成功或失败函数，做后续处理
   */
   // 1. 创建Promise对象
   const p = new Promise((resolve, reject) => {
     // 2. 执行XHR异步代码，获取省份列表
     const xhr = new XMLHttpRequest()
     xhr.open('GET', 'http://hmajax.itheima.net/api/province')
     xhr.addEventListener('loadend', () => {
       // xhr如何判断响应成功还是失败的？
       // 2xx开头的都是成功响应状态码
       if (xhr.status >= 200 && xhr.status < 300) {
         resolve(JSON.parse(xhr.response))
       } else {
         reject(new Error(xhr.response))
       }
     })
     xhr.send()
   })
   
   // 3. 关联成功或失败函数，做后续处理
   p.then(result => {
     console.log(result)
     document.querySelector('.my-p').innerHTML = result.list.join('<br>')
   }).catch(error => {
     // 错误对象要用console.dir详细打印
     console.dir(error)
     // 服务器返回错误提示消息，插入到p标签显示
     document.querySelector('.my-p').innerHTML = error.message
   })
   ```


`loadend` 里用 `xhr.status >= 200 && xhr.status < 300` 判断 HTTP 成功。成功就解析响应、调 `resolve`，其他状态调 `reject`。要覆盖网络错误和超时的话，还得补上对应的事件，免得 Promise 一直停在 `pending`。

## 四、封装与错误排查

### 最小 myAxios

封装函数接收一个配置对象，返回 Promise。里面负责创建 XHR 和区分结果，外面只管配置、成功的数据和错误。

   ![image-20230222130217597](images/image-20230222130217597.png)

先把函数的形状定下来。

   ```js
   function myAxios(config) {
     return new Promise((resolve, reject) => {
       // XHR 请求
       // 调用成功/失败的处理程序
     })
   }
   
   myAxios({
     url: '目标资源地址'
   }).then(result => {
       
   }).catch(error => {
       
   })
   ```


边界定好以后，再实现默认的 GET 请求和状态分流。

   ```js
   /**
    * 目标：封装_简易axios函数_获取省份列表
    *  1. 定义myAxios函数，接收配置对象，返回Promise对象
    *  2. 发起XHR请求，默认请求方法为GET
    *  3. 调用成功/失败的处理程序
    *  4. 使用myAxios函数，获取省份列表展示
   */
   // 1. 定义myAxios函数，接收配置对象，返回Promise对象
   function myAxios(config) {
     return new Promise((resolve, reject) => {
       // 2. 发起XHR请求，默认请求方法为GET
       const xhr = new XMLHttpRequest()
       xhr.open(config.method || 'GET', config.url)
       xhr.addEventListener('loadend', () => {
         // 3. 调用成功/失败的处理程序
         if (xhr.status >= 200 && xhr.status < 300) {
           resolve(JSON.parse(xhr.response))
         } else {
           reject(new Error(xhr.response))
         }
       })
       xhr.send()
     })
   }
   
   // 4. 使用myAxios函数，获取省份列表展示
   myAxios({
     url: 'http://hmajax.itheima.net/api/province'
   }).then(result => {
     console.log(result)
     document.querySelector('.my-p').innerHTML = result.list.join('<br>')
   }).catch(error => {
     console.log(error)
     document.querySelector('.my-p').innerHTML = error.message
   })
   ```


`config.method || 'GET'` 表示没传方法时用 GET。接下来让配置对象支持 `params`。

### 支持查询参数

配置里有 `params` 的话，先用 `URLSearchParams` 转成查询字符串，再拼到请求 URL 上。下面请求辽宁省大连市的地区列表。

   ```js
   function myAxios(config) {
     return new Promise((resolve, reject) => {
       const xhr = new XMLHttpRequest()
       // 1. 判断有params选项，携带查询参数
       if (config.params) {
         // 2. 使用URLSearchParams转换，并携带到url上
         const paramsObj = new URLSearchParams(config.params)
         const queryString = paramsObj.toString()
         // 把查询参数字符串，拼接在url？后面
         config.url += `?${queryString}`
       }
   
       xhr.open(config.method || 'GET', config.url)
       xhr.addEventListener('loadend', () => {
         if (xhr.status >= 200 && xhr.status < 300) {
           resolve(JSON.parse(xhr.response))
         } else {
           reject(new Error(xhr.response))
         }
       })
       xhr.send()
     })
   }
   
   // 3. 使用myAxios函数，获取地区列表
   myAxios({
     url: 'http://hmajax.itheima.net/api/area',
     params: {
       pname: '辽宁省',
       cname: '大连市'
     }
   }).then(result => {
     console.log(result)
     document.querySelector('.my-p').innerHTML = result.list.join('<br>')
   })
   ```


`params` 对象经过 `URLSearchParams` 处理后变成查询字符串。这个实现会改掉原来的 `config.url`，同一个配置对象重复调用时要小心重复拼接。

### 支持 JSON 请求体

再加上 `data` 选项。有请求体时，把对象转成 JSON、设置内容类型再发送；没有 `data` 时还是普通的 `send()`。

   ```js
   function myAxios(config) {
     return new Promise((resolve, reject) => {
       const xhr = new XMLHttpRequest()
   
       if (config.params) {
         const paramsObj = new URLSearchParams(config.params)
         const queryString = paramsObj.toString()
         config.url += `?${queryString}`
       }
       xhr.open(config.method || 'GET', config.url)
   
       xhr.addEventListener('loadend', () => {
         if (xhr.status >= 200 && xhr.status < 300) {
           resolve(JSON.parse(xhr.response))
         } else {
           reject(new Error(xhr.response))
         }
       })
       // 1. 判断有data选项，携带请求体
       if (config.data) {
         // 2. 转换数据类型，在send中发送
         const jsonStr = JSON.stringify(config.data)
         xhr.setRequestHeader('Content-Type', 'application/json')
         xhr.send(jsonStr)
       } else {
         // 如果没有请求体数据，正常的发起请求
         xhr.send()
       }
     })
   }
   
   document.querySelector('.reg-btn').addEventListener('click', () => {
     // 3. 使用myAxios函数，完成注册用户
     myAxios({
       url: 'http://hmajax.itheima.net/api/register',
       method: 'POST',
       data: {
         username: 'itheima999',
         password: '666666'
       }
     }).then(result => {
       console.log(result)
     }).catch(error => {
       console.dir(error)
     })
   })
   ```


这样 `myAxios` 已经覆盖了默认方法、查询参数、JSON 请求体和 Promise 结果分流。下面用天气查询验证这几个能力能不能一起工作。

### 天气查询：默认数据

页面先请求北京市的天气，渲染默认内容。

   ![image-20230222133327806](images/image-20230222133327806.png)

`getWeather` 接收城市编码，请求天气数据后更新日期、当前天气和多日预报。

   ```js
   /**
    * 目标1：默认显示-北京市天气
    *  1.1 获取北京市天气数据
    *  1.2 数据展示到页面
    */
   // 获取并渲染城市天气函数
   function getWeather(cityCode) {
     // 1.1 获取北京市天气数据
     myAxios({
       url: 'http://hmajax.itheima.net/api/weather',
       params: {
         city: cityCode
       }
     }).then(result => {
       console.log(result)
       const wObj = result.data
       // 1.2 数据展示到页面
       // 阳历和农历日期
       const dateStr = `<span class="dateShort">${wObj.date}</span>
       <span class="calendar">农历&nbsp;
         <span class="dateLunar">${wObj.dateLunar}</span>
       </span>`
       document.querySelector('.title').innerHTML = dateStr
       // 城市名字
       document.querySelector('.area').innerHTML = wObj.area
       // 当天气温
       const nowWStr = `<div class="tem-box">
       <span class="temp">
         <span class="temperature">${wObj.temperature}</span>
         <span>°</span>
       </span>
     </div>
     <div class="climate-box">
       <div class="air">
         <span class="psPm25">${wObj.psPm25}</span>
         <span class="psPm25Level">${wObj.psPm25Level}</span>
       </div>
       <ul class="weather-list">
         <li>
           <img src="${wObj.weatherImg}" class="weatherImg" alt="">
           <span class="weather">${wObj.weather}</span>
         </li>
         <li class="windDirection">${wObj.windDirection}</li>
         <li class="windPower">${wObj.windPower}</li>
       </ul>
     </div>`
       document.querySelector('.weather-box').innerHTML = nowWStr
       // 当天天气
       const twObj = wObj.todayWeather
       const todayWStr = `<div class="range-box">
       <span>今天：</span>
       <span class="range">
         <span class="weather">${twObj.weather}</span>
         <span class="temNight">${twObj.temNight}</span>
         <span>-</span>
         <span class="temDay">${twObj.temDay}</span>
         <span>℃</span>
       </span>
     </div>
     <ul class="sun-list">
       <li>
         <span>紫外线</span>
         <span class="ultraviolet">${twObj.ultraviolet}</span>
       </li>
       <li>
         <span>湿度</span>
         <span class="humidity">${twObj.humidity}</span>%
       </li>
       <li>
         <span>日出</span>
         <span class="sunriseTime">${twObj.sunriseTime}</span>
       </li>
       <li>
         <span>日落</span>
         <span class="sunsetTime">${twObj.sunsetTime}</span>
       </li>
     </ul>`
       document.querySelector('.today-weather').innerHTML = todayWStr
   
       // 7日天气预报数据展示
       const dayForecast = wObj.dayForecast
       const dayForecastStr = dayForecast.map(item => {
         return `<li class="item">
         <div class="date-box">
           <span class="dateFormat">${item.dateFormat}</span>
           <span class="date">${item.date}</span>
         </div>
         <img src="${item.weatherImg}" alt="" class="weatherImg">
         <span class="weather">${item.weather}</span>
         <div class="temp">
           <span class="temNight">${item.temNight}</span>-
           <span class="temDay">${item.temDay}</span>
           <span>℃</span>
         </div>
         <div class="wind">
           <span class="windDirection">${item.windDirection}</span>
           <span class="windPower">${item.windPower}</span>
         </div>
       </li>`
       }).join('')
       // console.log(dayForecastStr)
       document.querySelector('.week-wrap').innerHTML = dayForecastStr
     })
   }
   
   // 默认进入网页-就要获取天气数据（北京市城市编码：'110100'）
   getWeather('110100')
   ```


默认调用时传北京市的城市编码。这一步同时验证了 `params`、Promise 成功分支和页面渲染。

### 天气查询：搜索城市

输入框一变，就请求匹配的城市列表。

   ![image-20230222133553010](images/image-20230222133553010.png)

监听 `input` 事件，把当前的输入值当作 `params.city` 传给接口。

   ```js
   /**
    * 目标2：搜索城市列表
    *  2.1 绑定input事件，获取关键字
    *  2.2 获取展示城市列表数据
    */
   // 2.1 绑定input事件，获取关键字
   document.querySelector('.search-city').addEventListener('input', (e) => {
     console.log(e.target.value)
     // 2.2 获取展示城市列表数据
     myAxios({
       url: 'http://hmajax.itheima.net/api/weather/city',
       params: {
         city: e.target.value
       }
     }).then(result => {
       console.log(result)
       const liStr = result.data.map(item => {
         return `<li class="city-item" data-code="${item.code}">${item.name}</li>`
       }).join('')
       console.log(liStr)
       document.querySelector('.search-list').innerHTML = liStr
     })
   })
   ```


接口返回后，城市名写进列表，城市编码存在 `data-code` 里，点击时再读出来。

### 天气查询：切换城市

城市列表是动态生成的，所以在父级列表上用事件委托。点了某个城市后读出编码，再复用 `getWeather`。

   ![image-20230222134653884](images/image-20230222134653884.png)

下面只处理带 `city-item` 类的点击目标。

   ```js
   /**
    * 目标3：切换城市天气
    *  3.1 绑定城市点击事件，获取城市code值
    *  3.2 调用获取并展示天气的函数
    */
   // 3.1 绑定城市点击事件，获取城市code值
   document.querySelector('.search-list').addEventListener('click', e => {
     if (e.target.classList.contains('city-item')) {
       // 只有点击城市li才会走这里
       const cityCode = e.target.dataset.code
       console.log(cityCode)
       // 3.2 调用获取并展示天气的函数
       getWeather(cityCode)
     }
   })
   ```


`dataset.code` 的值由接口返回的数据决定。前端按接口约定传城市名或城市编码，别自己猜字段格式。

## 参考文档

1. [Ajax原生-mdn](https://developer.mozilla.org/zh-CN/docs/Web/Guide/AJAX/Getting_Started)
3. [同步异步-mdn](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/Synchronous_and_Asynchronous_Requests)
4. [回调函数-mdn](https://developer.mozilla.org/zh-CN/docs/Glossary/Callback_function)
5. [Promise-mdn](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise)
