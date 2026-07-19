---
title: "AJAX 综合案例：图书管理、图片上传与个人信息设置"
date: 2025-10-19 02:11:07
tags:
  - "AJAX"
  - "综合案例"
  - "前后端交互"
categories:
  - "前端开发"
  - "AJAX"
---

这篇笔记围绕四组实际操作展开：图书增删改查、图片上传、背景图持久化和个人信息设置。每一组都从页面事件开始，经过请求和数据处理，最后把结果同步回界面。

## 案例前准备

图书案例会用到 Bootstrap 弹框、事件委托和列表渲染；上传案例会用到 FormData。先看四个最小片段，后面遇到时直接组合。

### Bootstrap 弹框结构
```html
<!-- 你能看懂这些Bootstrap类名吗？ -->
<div class="modal fade">        <!-- 模态框 -->
  <div class="modal-dialog">    <!-- 对话框 -->
    <div class="modal-content"> <!-- 内容区 -->
      <div class="modal-header"><!-- 头部 -->
        <h5 class="modal-title">标题</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">   <!-- 身体 -->
        <p>内容在这里</p>
      </div>
      <div class="modal-footer"> <!-- 底部 -->
        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        <button class="btn btn-primary">保存</button>
      </div>
    </div>
  </div>
</div>
```

### 用事件委托处理动态按钮
```js
// 你会用事件委托处理动态生成的按钮吗？
document.querySelector('.list').addEventListener('click', function(e) {
  // 判断点击的是否是删除按钮
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;  // 获取自定义属性
    console.log('要删除的ID：', id);
  }
  
  // 判断点击的是否是编辑按钮  
  if (e.target.classList.contains('edit-btn')) {
    const id = e.target.dataset.id;
    console.log('要编辑的ID：', id);
  }
});
```

### 把数组渲染成表格行
```js
// 你会把数组数据渲染成HTML吗？
const books = [
  { id: 1, name: 'JavaScript高级程序设计', author: 'Nicholas' },
  { id: 2, name: 'Vue.js实战', author: '梁灏' }
];

// 方法1：forEach
let html = '';
books.forEach(book => {
  html += `<tr>
    <td>${book.id}</td>
    <td>${book.name}</td>
    <td>${book.author}</td>
    <td>
      <button class="edit-btn" data-id="${book.id}">编辑</button>
      <button class="delete-btn" data-id="${book.id}">删除</button>
    </td>
  </tr>`;
});

// 方法2：map + join（更简洁）
const html2 = books.map(book => `
  <tr>
    <td>${book.id}</td>
    <td>${book.name}</td>
    <td>${book.author}</td>
    <td>
      <button class="edit-btn" data-id="${book.id}">编辑</button>
      <button class="delete-btn" data-id="${book.id}">删除</button>
    </td>
  </tr>
`).join('');

document.querySelector('.list').innerHTML = html2;
```

### 用 FormData 组织文件和普通字段
```js
// 你会用FormData上传文件吗？
const fileInput = document.querySelector('#avatar');
const file = fileInput.files[0];  // 获取选中的文件

const fd = new FormData();
fd.append('avatar', file);        // 添加文件
fd.append('username', '张三');    // 添加其他字段

// 发送文件上传请求
axios({
  url: '/api/upload',
  method: 'POST',
  data: fd
}).then(result => {
  console.log('上传成功：', result.data.url);
});
```

### 两个准备检查

第一段代码的问题在于，它没有按 Bootstrap 的方式初始化和关闭弹框。

```html
<!-- 以下代码有什么问题？-->
<button onclick="$('#myModal').show()">显示弹框</button>

<div class="modal my-modal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5>添加图书</h5>
        <button class="btn-close"></button>
      </div>
      <div class="modal-body">
        <input type="text" placeholder="图书名称">
      </div>
      <div class="modal-footer">
        <button onclick="$('#myModal').hide()">取消</button>
        <button>保存</button>
      </div>
    </div>
  </div>
</div>
```

<details>
<summary>查看问题</summary>

**问题**：
1. 没有引入Bootstrap JS文件
2. 关闭按钮没有`data-bs-dismiss="modal"`
3. 更好的做法是用`data-bs-toggle="modal"`控制显示

对应的控制属性如下：
```html
<button data-bs-toggle="modal" data-bs-target=".my-modal">显示弹框</button>
<button data-bs-dismiss="modal">取消</button>
```
</details>

第二段补全列表渲染：
```js
const books = [
  {id: 1, name: 'JS高级', author: 'Nicholas'},
  {id: 2, name: 'Vue实战', author: '梁灏'}
];

// 你的代码：渲染成表格行
const html = __________________________;
document.querySelector('tbody').innerHTML = html;
```

<details>
<summary>查看实现</summary>

```js
const html = books.map(book => `
  <tr>
    <td>${book.id}</td>
    <td>${book.name}</td>
    <td>${book.author}</td>
    <td>
      <button class="btn btn-sm btn-primary edit-btn" data-id="${book.id}">编辑</button>
      <button class="btn btn-sm btn-danger delete-btn" data-id="${book.id}">删除</button>
    </td>
  </tr>
`).join('');
```
</details>

### 运行环境

#### 项目资源准备
- [ ] **Bootstrap 5** - 引入CSS和JS文件
- [ ] **axios库** - 用于AJAX请求
- [ ] **form-serialize插件** - 用于表单数据收集
- [ ] **图片资源** - 准备一些测试图片

#### 开发环境检查
- [ ] **代码编辑器** - VS Code推荐
- [ ] **浏览器** - Chrome（开发者工具）
- [ ] **网络连接** - 能访问API接口
- [ ] **本地服务器** - 可选，解决跨域问题

Bootstrap 的 CSS 和 JS 版本要对应：
```html
<!-- Bootstrap CSS -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.min.js"></script>
```

### JavaScript 基础回顾

下面这些小题来自原始课堂练习。已经熟悉对象展开、事件委托、dataset、localStorage 和短路表达式时，可以直接跳到案例部分。

1. 以下代码运行结果是什么？（考察扩展运算符的使用）

   ```js
   const result = {
     name: '老李',
     age: 18
   }
   const obj = {
     ...result
   }
   console.log(obj.age)
   ```

   A：报错

   B：18

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


2. 什么是事件委托？

   A：只能把单击事件委托给父元素绑定

   B：可以把能冒泡的事件，委托给已存在的向上的任意标签元素绑定

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


3. 事件对象e.target作用是什么?

   A：获取到这次触发事件相关的信息

   B：获取到这次触发事件目标标签元素

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


4. 如果获取绑定在标签上自定义属性的值10？

   ```html
   <div data-code="10">西游记</div>
   ```

   A：div标签对象.innerHTML

   B：div标签对象.dataset.code

   C：div标签对象.code

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


5. 哪个方法可以判断目标标签是否包含指定的类名?

   ```html
   <div class="my-div title info"></div>
   ```

   A: div标签对象.className === 'title'

   B: div标签对象.classList.contains('title')

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


6. 伪数组取值哪种方式是正确的?

   ```js
   let obj = { 0: '老李', 1: '老刘' }
   ```

   A: obj.0

   B: obj[0]

   <details>
   <summary>答案</summary>
   <ul>
   <li>B正确</li>
   </ul>
   </details>


7. 以下哪个选项可以，往本地存储键为‘bgImg’，值为图片url网址的代码

   A：localStorage.setItem('bgImg')

   B：localStorage.getItem('bgImg')

   C：localStorage.setItem('bgImg', '图片url网址')

   D：localStorage.getItem('bgImg', '图片url网址')

   <details>
   <summary>答案</summary>
   <ul>
   <li>C正确</li>
   </ul>
   </details>


8. 以下代码运行结果是？

   ```js
   const obj = {
     username: '老李',
     age: 18,
     sex: '男'
   }
   Object.keys(obj)
   ```

   A：代码报错

   B：[username, age, sex]

   C：["username", "age", "sex"]

   D：["老李", 18, "男"]

   <details>
   <summary>答案</summary>
   <ul>
   <li>C正确</li>
   </ul>
   </details>


9. 下面哪个选项可以把数字字符串转成数字类型？

   A：+’10‘

   B：’10‘ + 0

   <details>
   <summary>答案</summary>
   <ul>
   <li>A正确</li>
   </ul>
   </details>


10. 以下代码运行后的结果是什么？（考察逻辑与的短路特性）

    ```js
    const age = 18
    const result1 = (age || '有年龄')
    
    const sex = ''
    const result2 = sex || '没有性别'
    ```

    A：报错，报错

    B：18，没有性别

    C：有年龄，没有性别

    D：18，’‘

    <details>
    <summary>答案</summary>
    <ul>
    <li>B正确</li>
    </ul>
    </details>


## 补充实现片段

下面几段是原始笔记里的扩展示例。它们比后面的案例代码更完整，但也更重，适合按需取用，不必作为开始案例的前置条件。

### 带校验状态的 Bootstrap 弹框
```html
<!-- 企业级Bootstrap使用规范 -->
<!-- 要求：语义化、可访问性、响应式、企业级UI -->
<div class="modal fade" id="enterpriseModal" data-bs-backdrop="static">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg">
      <!-- 企业级头部：品牌色+图标+标题 -->
      <div class="modal-header bg-gradient-primary text-white">
        <h5 class="modal-title">
          <i class="fas fa-book me-2"></i>图书管理系统
        </h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="关闭"></button>
      </div>
      
      <!-- 企业级身体：表单验证+无障碍 -->
      <div class="modal-body p-4">
        <form class="needs-validation" novalidate>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">书名 <span class="text-danger">*</span></label>
              <input type="text" class="form-control" required aria-describedby="bookNameHelp">
              <div class="invalid-feedback">请输入书名</div>
            </div>
          </div>
        </form>
      </div>
      
      <!-- 企业级底部：主操作+次要操作 -->
      <div class="modal-footer border-0 bg-light">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
          <i class="fas fa-times me-1"></i>取消
        </button>
        <button type="button" class="btn btn-primary">
          <i class="fas fa-save me-1"></i>保存更改
        </button>
      </div>
    </div>
  </div>
</div>
```

### 封装事件委托
```js
// ❌ 初级写法（性能差，不适合大量元素）
// document.querySelectorAll('.delete-btn').forEach(btn => {
//   btn.addEventListener('click', handleDelete);
// });

// ✅ 企业级写法（事件委托+委托验证）
class EnterpriseEventManager {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this.init();
  }
  
  init() {
    this.container.addEventListener('click', this.handleClick.bind(this));
  }
  
  handleClick(e) {
    // 企业级：多层委托验证
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    
    // 企业级：防抖处理
    this.debounce(() => {
      switch(action) {
        case 'edit':
          this.handlers.onEdit(id, actionBtn);
          break;
        case 'delete':
          this.handlers.onDelete(id, actionBtn);
          break;
        case 'view':
          this.handlers.onView(id, actionBtn);
          break;
      }
    }, 300)();
  }
  
  // 企业级工具方法
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// 使用示例
const eventManager = new EnterpriseEventManager(
  document.querySelector('.book-table'),
  {
    onEdit: (id, btn) => {
      console.log(`📝 编辑图书 ID: ${id}`);
      // 打开编辑弹框
    },
    onDelete: (id, btn) => {
      console.log(`🗑️ 删除图书 ID: ${id}`);
      // 显示删除确认
    },
    onView: (id, btn) => {
      console.log(`👁️ 查看详情 ID: ${id}`);
      // 跳转到详情页
    }
  }
);
```

### 封装列表渲染
```js
// 企业级：数据到HTML的转换（可维护性+性能）
class EnterpriseRenderer {
  constructor(template, container) {
    this.template = template;
    this.container = container;
  }
  
  // 企业级：批量渲染（性能优化）
  renderBatch(items) {
    const html = items.map(item => this.renderItem(item)).join('');
    this.container.innerHTML = html;
  }
  
  // 企业级：单项渲染（可复用）
  renderItem(item) {
    // 企业级：数据验证+默认值
    const safeData = this.validateAndDefault(item);
    
    // 企业级：模板替换（防止XSS）
    return this.template
      .replace(/\{\{id\}\}/g, this.escapeHtml(safeData.id))
      .replace(/\{\{name\}\}/g, this.escapeHtml(safeData.bookname))
      .replace(/\{\{author\}\}/g, this.escapeHtml(safeData.author))
      .replace(/\{\{publisher\}\}/g, this.escapeHtml(safeData.publisher || '未指定'))
      .replace(/\{\{date\}\}/g, this.formatDate(safeData.createTime));
  }
  
  // 企业级：数据验证
  validateAndDefault(data) {
    return {
      id: data.id || '',
      bookname: data.bookname || '未知书名',
      author: data.author || '未知作者',
      publisher: data.publisher || '未指定出版社',
      createTime: data.createTime || new Date().toISOString()
    };
  }
  
  // 企业级：XSS防护
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // 企业级：日期格式化
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN');
  }
}

// 企业级模板（可维护性强）
const bookTemplate = `
  <tr data-id="{{id}}" class="book-row">
    <td>
      <div class="d-flex align-items-center">
        <div class="flex-grow-1">
          <h6 class="mb-1 text-truncate">{{name}}</h6>
          <small class="text-muted">ID: {{id}}</small>
        </div>
      </div>
    </td>
    <td><span class="badge bg-light text-dark">{{author}}</span></td>
    <td><small class="text-muted">{{publisher}}</small></td>
    <td><small class="text-muted">{{date}}</small></td>
    <td>
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-primary" data-action="edit" data-id="{{id}}" title="编辑">
          ✏️ 编辑
        </button>
        <button class="btn btn-outline-danger" data-action="delete" data-id="{{id}}" title="删除">
          🗑️ 删除
        </button>
      </div>
    </td>
  </tr>
`;
```

### 带校验和错误分类的文件上传
```js
// 企业级：文件上传管理器
class EnterpriseFileUploader {
  constructor(options) {
    this.options = {
      maxSize: options.maxSize || 5 * 1024 * 1024, // 5MB
      allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif'],
      onProgress: options.onProgress || function() {},
      onSuccess: options.onSuccess || function() {},
      onError: options.onError || function() {},
      ...options
    };
  }
  
  async upload(file) {
    try {
      // 企业级：文件验证
      this.validateFile(file);
      
      // 企业级：创建FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', Date.now());
      formData.append('type', 'avatar');
      
      // 企业级：上传进度监控
      const response = await axios({
        method: 'POST',
        url: '/api/upload',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          this.options.onProgress(percentCompleted);
        }
      });
      
      this.options.onSuccess(response.data);
      
    } catch (error) {
      this.options.onError(this.parseUploadError(error));
    }
  }
  
  validateFile(file) {
    // 企业级：文件类型验证
    if (!this.options.allowedTypes.includes(file.type)) {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }
    
    // 企业级：文件大小验证
    if (file.size > this.options.maxSize) {
      const maxSizeMB = (this.options.maxSize / (1024 * 1024)).toFixed(1);
      throw new Error(`文件大小超过限制: ${maxSizeMB}MB`);
    }
    
    // 企业级：文件完整性验证
    if (file.size === 0) {
      throw new Error('文件内容为空');
    }
  }
  
  parseUploadError(error) {
    // 企业级：错误分类和处理
    if (error.response) {
      switch(error.response.status) {
        case 413:
          return '文件太大，服务器拒绝接收';
        case 415:
          return '不支持的文件格式';
        case 401:
          return '上传权限不足';
        default:
          return error.response.data.message || '上传失败';
      }
    } else if (error.request) {
      return '网络连接失败，请检查网络设置';
    } else {
      return error.message;
    }
  }
}
```

### 原始需求沟通练习

以下对话是课堂练习素材，不是实际项目记录，其中的工期和能力描述也不能当作事实依据。

**场景1：需求评审**
```
PM："我们需要一个图书管理系统，支持CRUD操作"
你（前端工程师）：
- "我建议使用Bootstrap 5，响应式适配移动端"
- "数据交互用axios，支持错误重试机制"
- "表单验证用HTML5原生验证，用户体验更好"
- "预计开发时间：3个工作日"
```

**场景2：代码 Review**
```js
// 总监会问："为什么用事件委托而不是直接绑定？"
// 你的回答：
"总监，我使用事件委托主要考虑三点：
1. 性能优化：减少事件监听器数量，适合动态列表
2. 内存管理：避免内存泄漏，特别是大数据列表
3. 维护性：新增元素不需要重新绑定事件
4. 符合企业级代码规范，我们团队的技术栈要求"
```

**场景3：功能说明**
```
客户："这个上传功能支持哪些格式？"
你（现场演示）：
"我们的上传系统支持：
- 📷 图片格式：JPG、PNG、GIF（自动压缩）
- 📄 文档格式：PDF、Word、Excel（自动扫描）
- 💾 大小限制：单文件最大5MB（可配置）
- ⚡ 上传进度：实时显示，支持断点续传
- 🔒 安全检查：自动病毒扫描，确保系统安全"
```

### 原始练习题

**任务1：图书表格组件**
```
需求：
- 支持动态数据渲染（10本书）
- 每本书有编辑/删除按钮
- 表格样式符合企业UI规范
- 代码结构清晰，可维护性强

考核标准：
✅ 使用Bootstrap 5企业级样式
✅ 使用事件委托处理按钮点击
✅ 使用模板引擎方式渲染数据
✅ 代码有注释，变量命名规范
```

**任务2：文件上传组件**
```
需求：
- 支持图片文件选择和上传
- 显示上传进度条
- 上传成功显示预览图
- 上传失败显示错误信息

考核标准：
✅ 文件类型和大小验证
✅ 上传进度实时显示
✅ 错误处理完整
✅ 用户体验良好
```

### 开发工具参考

原笔记列出的工具如下。实际项目按仓库配置选择，不必一次装全。

```bash
# 代码编辑器（企业推荐）
✅ VS Code + 企业级插件套装
  - ESLint（代码规范检查）
  - Prettier（代码格式化）
  - Live Server（本地服务器）
  - GitLens（版本控制）
  - Bootstrap 5 Snippets（快速编码）

# 浏览器环境（开发专用）
✅ Chrome DevTools配置
  - 移动端调试模式
  - Network面板（API监控）
  - Application面板（存储查看）
  - Console面板（错误调试）

# 辅助工具（效率提升）
✅ Git（版本控制）
✅ Node.js（前端工程化）
✅ Postman（API测试）
```

### 完整页面模板
```html
<!DOCTYPE html>
<html lang="zh-CN" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="企业级图书管理系统 - 专业的图书信息管理平台">
    <meta name="keywords" content="图书管理,企业级应用,AJAX,Bootstrap">
    <title>企业级图书管理系统 v1.0</title>
    
    <!-- 企业级CSS框架 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- 企业级自定义样式 -->
    <style>
        /* CSS变量：企业级主题配置 */
        :root {
            --primary-color: #2563eb;
            --secondary-color: #64748b;
            --success-color: #059669;
            --danger-color: #dc2626;
            --warning-color: #d97706;
            --info-color: #0891b2;
            --border-radius: 8px;
            --box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .enterprise-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .enterprise-card {
            border: 1px solid #e5e7eb;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            transition: all 0.3s ease;
        }
        
        .enterprise-card:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        
        .enterprise-btn {
            border-radius: var(--border-radius);
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .enterprise-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
    </style>
</head>
<body>
    <!-- 企业级应用容器 -->
    <div class="enterprise-container">
        <!-- 项目内容区域 -->
    </div>
    
    <!-- 企业级JavaScript依赖 -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
    
    <!-- 企业级项目代码 -->
    <script src="js/main.js" type="module"></script>
</body>
</html>
```

## 公共依赖和页面结构

### 页面分层

这张图只用来标出案例里各类代码的位置：界面、业务逻辑、数据处理、请求和本地存储。

```
前端应用架构
├── 📱 用户界面层 (Bootstrap + CSS)
├── 🔄 业务逻辑层 (JavaScript + AJAX)  
├── 📦 数据处理层 (JSON + 表单处理)
├── 🌐 网络请求层 (axios + HTTP)
└── 💾 本地存储层 (localStorage + 缓存)
```

### 公共依赖
```html
<!-- 统一的项目模板 -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>企业级AJAX项目</title>
    
    <!-- CSS依赖 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- 项目内容 -->
    
    <!-- JS依赖 -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="lib/form-serialize.js"></script>
    <script src="js/main.js"></script>
</body>
</html>
```

## 案例一：图书管理

这个案例依次完成列表查询、新增、删除和编辑。新增与编辑都需要弹框，因此先把 Bootstrap 的两种控制方式弄清楚。

### 功能关系
```
图书管理系统
├── 📋 图书列表展示（查）
├── ➕ 新增图书功能（增）
├── ✏️ 编辑图书功能（改）
├── 🗑️ 删除图书功能（删）
└── 🪟 Bootstrap弹框（用于新增/编辑）
```

### Bootstrap 弹框：属性控制

只是打开和关闭弹框时，直接使用 Bootstrap 的 data 属性即可。先看结构：

```
┌─────────────────────────────────────┐
│ 弹框标题                    [X]    │ ← 头部
├─────────────────────────────────────┤
│                                     │
│    这里放你的内容                   │ ← 身体
│    比如表单、文字等                 │
│                                     │
├─────────────────────────────────────┤
│  [取消]  [确定]                    │ ← 底部
└─────────────────────────────────────┘
```

先引入对应版本的 CSS 和 JS：

```html
<!-- 引入Bootstrap CSS（让弹框好看） -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- 引入Bootstrap JS（让弹框能动） -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.min.js"></script>
```

再准备触发按钮和弹框结构：

```html
<!-- 触发按钮 -->
<button data-bs-toggle="modal" data-bs-target=".my-box">
  显示弹框
</button>

<!-- 弹框本体（默认是隐藏的） -->
<div class="modal my-box">
  <div class="modal-dialog">
    <div class="modal-content">
      <!-- 头部 -->
      <div class="modal-header">
        <h5>添加新图书</h5>
        <button data-bs-dismiss="modal">×</button>
      </div>
      
      <!-- 身体 -->
      <div class="modal-body">
        <p>这里是表单内容</p>
      </div>
      
      <!-- 底部 -->
      <div class="modal-footer">
        <button data-bs-dismiss="modal">取消</button>
        <button>保存</button>
      </div>
    </div>
  </div>
</div>
```

三个属性分别负责初始化、定位目标和关闭弹框：
| 属性 | 作用 | 放在哪里 |
|------|------|----------|
| `data-bs-toggle="modal"` | 告诉按钮：我要控制弹框 | 触发按钮上 |
| `data-bs-target=".my-box"` | 告诉按钮：我要控制哪个弹框 | 触发按钮上 |
| `data-bs-dismiss="modal"` | 告诉元素：点击我就能关闭弹框 | 关闭按钮上 |

`data-bs-toggle`和`data-bs-target`要配合使用：前者声明组件类型，后者指向目标弹框。


下面是可以独立运行的完整页面：

   ```html
   <!DOCTYPE html>
   <html lang="en">
   
   <head>
     <meta charset="UTF-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>Bootstrap 弹框</title>
     <!-- 引入bootstrap.css -->
     <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
   </head>
   
   <body>
     <!-- 
       目标：使用Bootstrap弹框
       1. 引入bootstrap.css 和 bootstrap.js
       2. 准备弹框标签，确认结构
       3. 通过自定义属性，控制弹框的显示和隐藏
      -->
     <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target=".my-box">
       显示弹框
     </button>
   
     <!-- 
       弹框标签
       bootstrap的modal弹框，添加modal类名（默认隐藏）
      -->
     <div class="modal my-box" tabindex="-1">
       <div class="modal-dialog">
         <!-- 弹框-内容 -->
         <div class="modal-content">
           <!-- 弹框-头部 -->
           <div class="modal-header">
             <h5 class="modal-title">Modal title</h5>
             <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
           </div>
           <!-- 弹框-身体 -->
           <div class="modal-body">
             <p>Modal body text goes here.</p>
           </div>
           <!-- 弹框-底部 -->
           <div class="modal-footer">
             <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
             <button type="button" class="btn btn-primary">Save changes</button>
           </div>
         </div>
       </div>
     </div>
   
     <!-- 引入bootstrap.js -->
     <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.min.js"></script>
   </body>
   
   </html>
   ```


### Bootstrap 弹框：JS 控制

如果打开前要先回显数据，或者关闭前要提交表单，就不能只依赖 data 属性。此时先创建 Modal 实例，再在业务逻辑执行完成后调用 show 或 hide。

例如，点击编辑按钮后先填入默认姓名，保存时读取输入值，再关闭弹框：

     ![image-20230404110038828](images/image-20230404110038828.png)


Modal 实例的基本用法如下：

   ```js
   // 创建弹框对象
   const modalDom = document.querySelector('css选择器')
   const modal = new bootstrap.Modal(modelDom)
   
   // 显示弹框
   modal.show()
   // 隐藏弹框
   modal.hide()
   ```


把回显和保存逻辑接进去：

   ```js
   // 1. 创建弹框对象
   const modalDom = document.querySelector('.name-box')
   const modal = new bootstrap.Modal(modalDom)
   
   // 编辑姓名->点击->赋予默认姓名->弹框显示
   document.querySelector('.edit-btn').addEventListener('click', () => {
     document.querySelector('.username').value = '默认姓名'
   
     // 2. 显示弹框
     modal.show()
   })
   
   // 保存->点击->->获取姓名打印->弹框隐藏
   document.querySelector('.save-btn').addEventListener('click', () => {
     const username = document.querySelector('.username').value
     console.log('模拟把姓名保存到服务器上', username)
   
     // 2. 隐藏弹框
     modal.hide()
   })
   ```


### 查询并渲染图书列表

**需求**：向图书接口请求当前用户的数据，再把结果渲染到表格中。

   ![image-20230404110943200](images/image-20230404110943200.png)

**请求数据**：接口通过 creator 区分数据，所以请求时要带上外号。拿到响应后，从 data 中取出图书数组。

      ![image-20230404110953752](images/image-20230404110953752.png)

      ![image-20230404111014560](images/image-20230404111014560.png)

**渲染**：新增、删除和修改成功后都要刷新列表，因此把“请求 + 渲染”封装成一个函数。后续操作只需再次调用它。

   ```js
   /**
    * 目标1：渲染图书列表
    *  1.1 获取数据
    *  1.2 渲染数据
    */
   const creator = '老张'
   // 封装-获取并渲染图书列表函数
   function getBooksList() {
     // 1.1 获取数据
     axios({
       url: 'http://hmajax.itheima.net/api/books',
       params: {
         // 外号：获取对应数据
         creator
       }
     }).then(result => {
       // console.log(result)
       const bookList = result.data.data
       // console.log(bookList)
       // 1.2 渲染数据
       const htmlStr = bookList.map((item, index) => {
         return `<tr>
         <td>${index + 1}</td>
         <td>${item.bookname}</td>
         <td>${item.author}</td>
         <td>${item.publisher}</td>
         <td data-id=${item.id}>
           <span class="del">删除</span>
           <span class="edit">编辑</span>
         </td>
       </tr>`
       }).join('')
       // console.log(htmlStr)
       document.querySelector('.list').innerHTML = htmlStr
     })
   }
   // 网页加载运行，获取并渲染列表一次
   getBooksList()
   ```


**错误处理**：这段示例只处理成功响应。请求失败时应保留原列表，并显示可重试的错误提示。


### 新增图书

**需求**：打开新增弹框，提交书名、作者和出版社，保存成功后刷新列表。

   ![image-20230404111235862](images/image-20230404111235862.png)

   ![image-20230404111251254](images/image-20230404111251254.png)

**提交数据**：点击保存后，用 serialize 收集表单，再补上 creator，通过 POST 请求提交。

      ![image-20230404111343653](images/image-20230404111343653.png)

**更新界面**：成功后重新请求列表、重置表单并关闭弹框。三个动作都放在成功回调里，避免请求失败时提前清空用户输入。

   ```js
   /**
    * 目标2：新增图书
    *  2.1 新增弹框->显示和隐藏
    *  2.2 收集表单数据，并提交到服务器保存
    *  2.3 刷新图书列表
    */
   // 2.1 创建弹框对象
   const addModalDom = document.querySelector('.add-modal')
   const addModal = new bootstrap.Modal(addModalDom)
   // 保存按钮->点击->隐藏弹框
   document.querySelector('.add-btn').addEventListener('click', () => {
     // 2.2 收集表单数据，并提交到服务器保存
     const addForm = document.querySelector('.add-form')
     const bookObj = serialize(addForm, { hash: true, empty: true })
     // console.log(bookObj)
     // 提交到服务器
     axios({
       url: 'http://hmajax.itheima.net/api/books',
       method: 'POST',
       data: {
         ...bookObj,
         creator
       }
     }).then(result => {
       // console.log(result)
       // 2.3 添加成功后，重新请求并渲染图书列表
       getBooksList()
       // 重置表单
       addForm.reset()
       // 隐藏弹框
       addModal.hide()
     })
   })
   ```


**错误处理**：示例没有写失败分支。请求失败时应保留弹框和表单内容，让用户修改后重试。

### 删除图书

**需求**：点击某一行的删除按钮，只删除这一条数据。

   ![image-20230404111530311](images/image-20230404111530311.png)

   ![image-20230404111546639](images/image-20230404111546639.png)

**请求数据**：列表由接口动态生成，因此把点击事件委托给列表容器。确认目标元素是删除按钮后，从父元素的 dataset 读取图书 id，再拼进 DELETE 请求地址。

      ![image-20230404111612125](images/image-20230404111612125.png)


**更新界面**：删除成功后重新调用列表函数。

   ```js
   /**
    * 目标3：删除图书
    *  3.1 删除元素绑定点击事件->获取图书id
    *  3.2 调用删除接口
    *  3.3 刷新图书列表
    */
   // 3.1 删除元素->点击（事件委托）
   document.querySelector('.list').addEventListener('click', e => {
     // 获取触发事件目标元素
     // console.log(e.target)
     // 判断点击的是删除元素
     if (e.target.classList.contains('del')) {
       // console.log('点击删除元素')
       // 获取图书id（自定义属性id）
       const theId = e.target.parentNode.dataset.id
       // console.log(theId)
       // 3.2 调用删除接口
       axios({
         url: `http://hmajax.itheima.net/api/books/${theId}`,
         method: 'DELETE'
       }).then(() => {
         // 3.3 刷新图书列表
         getBooksList()
       })
     }
   })
   ```

**错误处理**：请求失败时不要先移除 DOM，否则页面状态会和服务器不一致。

### 编辑图书

**需求**：点击编辑后先请求图书详情并回显表单，用户修改后再提交保存。

   ![image-20230404111722254](images/image-20230404111722254.png)

**请求详情**：继续使用事件委托读取图书 id，然后请求详情接口。不要直接把列表行当作完整数据源，详情接口返回的数据才用于回显。

      ![image-20230404111739153](images/image-20230404111739153.png)
**回显与提交**：数据字段和表单类名一致时，可以遍历对象完成赋值。保存时收集表单，通过 PUT 请求提交，再刷新列表并关闭弹框。

      ![image-20230404111756655](images/image-20230404111756655.png)


代码把请求详情和提交更新放在两个事件里：

   ```js
   /**
    * 目标4：编辑图书
    *  4.1 编辑弹框->显示和隐藏
    *  4.2 获取当前编辑图书数据->回显到编辑表单中
    *  4.3 提交保存修改，并刷新列表
    */
   // 4.1 编辑弹框->显示和隐藏
   const editDom = document.querySelector('.edit-modal')
   const editModal = new bootstrap.Modal(editDom)
   // 编辑元素->点击->弹框显示
   document.querySelector('.list').addEventListener('click', e => {
     // 判断点击的是否为编辑元素
     if (e.target.classList.contains('edit')) {
       // 4.2 获取当前编辑图书数据->回显到编辑表单中
       const theId = e.target.parentNode.dataset.id
       axios({
         url: `http://hmajax.itheima.net/api/books/${theId}`
       }).then(result => {
         const bookObj = result.data.data
         // document.querySelector('.edit-form .bookname').value = bookObj.bookname
         // document.querySelector('.edit-form .author').value = bookObj.author
         // 数据对象“属性”和标签“类名”一致
         // 遍历数据对象，使用属性去获取对应的标签，快速赋值
         const keys = Object.keys(bookObj) // ['id', 'bookname', 'author', 'publisher']
         keys.forEach(key => {
           document.querySelector(`.edit-form .${key}`).value = bookObj[key]
         })
       })
       editModal.show()
     }
   })
   // 修改按钮->点击->隐藏弹框
   document.querySelector('.edit-btn').addEventListener('click', () => {
     // 4.3 提交保存修改，并刷新列表
     const editForm = document.querySelector('.edit-form')
     const { id, bookname, author, publisher } = serialize(editForm, { hash: true, empty: true})
     // 保存正在编辑的图书id，隐藏起来：无需让用户修改
     // <input type="hidden" class="id" name="id" value="84783">
     axios({
       url: `http://hmajax.itheima.net/api/books/${id}`,
       method: 'PUT',
       data: {
         bookname,
         author,
         publisher,
         creator
       }
     }).then(() => {
       // 修改成功以后，重新获取并刷新列表
       getBooksList()
   
       // 隐藏弹框
       editModal.hide()
     })
   })
   ```


**错误处理**：详情请求失败时不应打开空表单；更新失败时也不应关闭弹框。原示例只展示成功路径，需要补上这两个失败分支。


### 图书 CRUD 流程复盘

前面的四个操作最终都回到同一条数据流：发请求，等待服务器确认，再同步界面。下面保留原笔记中的缩略代码，方便并排检查调用顺序，不再重复逐行讲解。

操作顺序如下：

   > 1.渲染列表（查）
   >
   > 2.新增图书（增）
   >
   > 3.删除图书（删）
   >
   > 4.编辑图书（改）

   ![image-20230404111941722](images/image-20230404111941722.png)

#### 查询

   > 流程：获取数据 -> 渲染数据

   ```js
   // 1.1 获取数据
   axios({...}).then(result => {
     const bookList = result.data.data
     // 1.2 渲染数据
     const htmlStr = bookList.map((item, index) => {
       return `<tr>
       <td>${index + 1}</td>
       <td>${item.bookname}</td>
       <td>${item.author}</td>
       <td>${item.publisher}</td>
       <td data-id=${item.id}>
         <span class="del">删除</span>
         <span class="edit">编辑</span>
       </td>
     </tr>`
     }).join('')
     document.querySelector('.list').innerHTML = htmlStr
   })
   ```


#### 新增

   > 流程：准备页面标签 -> 收集数据提交（必须） -> 刷新页面列表（可选）

   ```js
   // 2.1 创建弹框对象
   const addModalDom = document.querySelector('.add-modal')
   const addModal = new bootstrap.Modal(addModalDom)
   document.querySelector('.add-btn').addEventListener('click', () => {
     // 2.2 收集表单数据，并提交到服务器保存
     const addForm = document.querySelector('.add-form')
     const bookObj = serialize(addForm, { hash: true, empty: true })
     axios({...}).then(result => {
       // 2.3 添加成功后，重新请求并渲染图书列表
       getBooksList()
       addForm.reset()
       addModal.hide()
     })
   })
   ```


   ![image-20230404112942935](images/image-20230404112942935.png)


#### 删除

   > 流程：绑定点击事件（获取要删除的图书唯一标识） -> 调用删除接口（让服务器删除此数据） -> 成功后重新获取并刷新列表

   ```js
   // 3.1 删除元素->点击（事件委托）
   document.querySelector('.list').addEventListener('click', e => {
     if (e.target.classList.contains('del')) {
       // 获取图书id（自定义属性id）
       const theId = e.target.parentNode.dataset.id
       // 3.2 调用删除接口
       axios({...}).then(() => {
         // 3.3 刷新图书列表
         getBooksList()
       })
     }
   })
   ```

   ![image-20230404113338815](images/image-20230404113338815.png)

#### 编辑

   > 流程：准备编辑图书表单 -> 表单回显正在编辑的数据 -> 点击修改收集数据 -> 提交到服务器保存 -> 重新获取并刷新列表

   ```js
   // 4.1 编辑弹框->显示和隐藏
   const editDom = document.querySelector('.edit-modal')
   const editModal = new bootstrap.Modal(editDom)
   document.querySelector('.list').addEventListener('click', e => {
     if (e.target.classList.contains('edit')) {
       // 4.2 获取当前编辑图书数据->回显到编辑表单中
       const theId = e.target.parentNode.dataset.id
       axios({...}).then(result => {
         const bookObj = result.data.data
         // 遍历数据对象，使用属性去获取对应的标签，快速赋值
         const keys = Object.keys(bookObj) 
         keys.forEach(key => {
           document.querySelector(`.edit-form .${key}`).value = bookObj[key]
         })
       })
       editModal.show()
     }
   })
   
   document.querySelector('.edit-btn').addEventListener('click', () => {
     // 4.3 提交保存修改，并刷新列表
     const editForm = document.querySelector('.edit-form')
     const { id, bookname, author, publisher } = serialize(editForm, { hash: true, empty: true})
     // 保存正在编辑的图书id，隐藏起来：无需让用户修改
     // <input type="hidden" class="id" name="id" value="84783">
     axios({...}).then(() => {
       getBooksList()
       editModal.hide()
     })
   })
   ```


   ![image-20230404113702515](images/image-20230404113702515.png)


## 案例二：图片上传

**需求**：用户选择本地图片后，把文件上传到服务器，再用服务器返回的 URL 更新预览图。

**提交数据**：文件不能按普通 JSON 字段发送。先从文件选择元素取出 File 对象，再放进 FormData：

      ```js
      const fd = new FormData()
      fd.append(参数名, 值)
      ```
**渲染**：完整页面监听 change 事件，上传成功后读取响应中的图片地址：

   ```html
   <!DOCTYPE html>
   <html lang="en">
   
   <head>
     <meta charset="UTF-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>图片上传</title>
   </head>
   
   <body>
     <!-- 文件选择元素 -->
     <input type="file" class="upload">
     <img src="" alt="" class="my-img">
   
     <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
     <script>
       /**
        * 目标：图片上传，显示到网页上
        *  1. 获取图片文件
        *  2. 使用 FormData 携带图片文件
        *  3. 提交到服务器，获取图片url网址使用
       */
       // 文件选择元素->change改变事件
       document.querySelector('.upload').addEventListener('change', e => {
         // 1. 获取图片文件
         console.log(e.target.files[0])
         // 2. 使用 FormData 携带图片文件
         const fd = new FormData()
         fd.append('img', e.target.files[0])
         // 3. 提交到服务器，获取图片url网址使用
         axios({
           url: 'http://hmajax.itheima.net/api/uploadimg',
           method: 'POST',
           data: fd
         }).then(result => {
           console.log(result)
           // 取出图片url网址，用img标签加载显示
           const imgUrl = result.data.data.url
           document.querySelector('.my-img').src = imgUrl
         })
       })
     </script>
   </body>
   
   </html>
   ```


**错误处理**：代码只覆盖成功路径。至少还要处理未选择文件、文件格式或大小不符合要求，以及上传请求失败这几类情况。前面的 FileUploader 片段给出了对应的分类位置。


## 案例三：网站背景图

**需求**：用户选择本地图片后，页面更换背景；刷新网页后仍使用上次的背景图。

![image-20230404122349505](images/image-20230404122349505.png)

**请求数据**：监听文件选择元素的 change 事件，取出用户选中的文件，放入 FormData 后提交到图片上传接口。

**渲染与持久化**：请求成功后，把响应中的图片 URL 设置为 body 背景，同时写入 localStorage。页面初始化时读取这个 URL，有值时再恢复背景。

   ```js
   /**
    * 目标：网站-更换背景
    *  1. 选择图片上传，设置body背景
    *  2. 上传成功时，"保存"图片url网址
    *  3. 网页运行后，"获取"url网址使用
    * */
   document.querySelector('.bg-ipt').addEventListener('change', e => {
     // 1. 选择图片上传，设置body背景
     console.log(e.target.files[0])
     const fd = new FormData()
     fd.append('img', e.target.files[0])
     axios({
       url: 'http://hmajax.itheima.net/api/uploadimg',
       method: 'POST',
       data: fd
     }).then(result => {
       const imgUrl = result.data.data.url
       document.body.style.backgroundImage = `url(${imgUrl})`
   
       // 2. 上传成功时，"保存"图片url网址
       localStorage.setItem('bgImg', imgUrl)
     })
   })
   
   // 3. 网页运行后，"获取"url网址使用
   const bgUrl = localStorage.getItem('bgImg')
   console.log(bgUrl)
   bgUrl && (document.body.style.backgroundImage = `url(${bgUrl})`)
   ```

**错误处理**：没有选择文件或上传失败时，保留当前背景，不要改写 localStorage 中已保存的 URL。

## 案例四：个人信息设置

这个案例分为信息回显、头像修改、表单提交和结果提示。四部分使用同一个外号区分用户。

![image-20230404123206073](images/image-20230404123206073.png)

### 查询并回显个人信息

**需求**：查询外号对应的个人信息，把文本字段、性别和头像回显到表单。

![image-20230404123708765](images/image-20230404123708765.png)

**请求数据**：请求设置接口时带上 creator 参数，服务器据此返回对应用户的数据。

**渲染**：遍历响应对象。avatar 写入图片的 src，gender 用数字下标选中对应的单选框，其他字段按同名类选择表单元素并赋值。

   ```js
   /**
    * 目标1：信息渲染
    *  1.1 获取用户的数据
    *  1.2 回显数据到标签上
    * */
   const creator = '播仔'
   // 1.1 获取用户的数据
   axios({
     url: 'http://hmajax.itheima.net/api/settings',
     params: {
       creator
     }
   }).then(result => {
     const userObj = result.data.data
     // 1.2 回显数据到标签上
     Object.keys(userObj).forEach(key => {
       if (key === 'avatar') {
         // 赋予默认头像
         document.querySelector('.prew').src = userObj[key]
       } else if (key === 'gender') {
         // 赋予默认性别
         // 获取性别单选框：[男radio元素，女radio元素]
         const gRadioList = document.querySelectorAll('.gender')
         // 获取性别数字：0男，1女
         const gNum = userObj[key]
         // 通过性别数字，作为下标，找到对应性别单选框，设置选中状态
         gRadioList[gNum].checked = true
       } else {
         // 赋予默认内容
         document.querySelector(`.${key}`).value = userObj[key]
       }
     })
   })
   ```

**错误处理**：请求失败时不要清空已有表单。还要校验响应中的 gender 值，避免数字超出单选框列表的范围。

### 修改头像

**需求**：用户选择新头像后，上传并立即更新页面中的头像。

![image-20230404124524401](images/image-20230404124524401.png)

**提交数据**：把头像文件和 creator 一起放入 FormData，通过 PUT 请求提交。creator 用来指明这张头像属于哪个用户。

![image-20230404124540629](images/image-20230404124540629.png)

**渲染**：服务器保存成功后，把响应中的头像 URL 写入图片的 src。刷新页面后，前面的信息查询会再次取回这张头像。

   ```js
   /**
    * 目标2：修改头像
    *  2.1 获取头像文件
    *  2.2 提交服务器并更新头像
    * */
   // 文件选择元素->change事件
   document.querySelector('.upload').addEventListener('change', e => {
     // 2.1 获取头像文件
     console.log(e.target.files[0])
     const fd = new FormData()
     fd.append('avatar', e.target.files[0])
     fd.append('creator', creator)
     // 2.2 提交服务器并更新头像
     axios({
       url: 'http://hmajax.itheima.net/api/avatar',
       method: 'PUT',
       data: fd
     }).then(result => {
       const imgUrl = result.data.data.avatar
       // 把新的头像回显到页面上
       document.querySelector('.prew').src = imgUrl
     })
   })
   ```

**错误处理**：未选择文件时不发请求。上传失败时保留原头像，等待用户重新选择或提交。

### 提交个人信息

**需求**：用户修改表单后，点击提交把新数据保存到服务器。

**提交数据**：用 serialize 收集表单，补上 creator，再把 gender 从数字字符串转为数字。设置接口使用 PUT 请求保存整个对象。

![image-20230404125310049](images/image-20230404125310049.png)

**提交后**：表单中已经是用户刚填写的值，请求成功后不必再请求一次详情，只需反馈保存结果。

   ```js
   /**
    * 目标3：提交表单
    *  3.1 收集表单信息
    *  3.2 提交到服务器保存
    */
   // 保存修改->点击
   document.querySelector('.submit').addEventListener('click', () => {
     // 3.1 收集表单信息
     const userForm = document.querySelector('.user-form')
     const userObj = serialize(userForm, { hash: true, empty: true })
     userObj.creator = creator
     // 性别数字字符串，转成数字类型
     userObj.gender = +userObj.gender
     console.log(userObj)
     // 3.2 提交到服务器保存
     axios({
       url: 'http://hmajax.itheima.net/api/settings',
       method: 'PUT',
       data: userObj
     }).then(result => {
     })
   })
   ```

**错误处理**：提交失败时保留表单内容，不要显示成功提示。响应成功后再给出反馈，避免用户把未保存的表单当成已提交。

### 用 Toast 反馈提交结果

**需求**：个人信息保存成功后，用 Bootstrap Toast 显示结果。

![image-20230404125517679](images/image-20230404125517679.png)

**渲染反馈**：页面先准备 Toast 标签，并设置自动消失时间。

      ```html
      <div class="toast" data-bs-delay="1500">
        提示框内容
      </div>
      ```

创建 Toast 对象后，调用 show 显示：

      ```js
      // 创建提示框对象
      const toastDom = document.querySelector('css选择器')
      const toast = new bootstrap.Toast(toastDom)
      
      // 显示提示框
      toast.show()
      ```

完整代码把 Toast 放在请求的成功回调中，确认服务器已保存后再显示：

   ```js
   /**
    * 目标3：提交表单
    *  3.1 收集表单信息
    *  3.2 提交到服务器保存
    */
   /**
    * 目标4：结果提示
    *  4.1 创建toast对象
    *  4.2 调用show方法->显示提示框
    */
   // 保存修改->点击
   document.querySelector('.submit').addEventListener('click', () => {
     // 3.1 收集表单信息
     const userForm = document.querySelector('.user-form')
     const userObj = serialize(userForm, { hash: true, empty: true })
     userObj.creator = creator
     // 性别数字字符串，转成数字类型
     userObj.gender = +userObj.gender
     console.log(userObj)
     // 3.2 提交到服务器保存
     axios({
       url: 'http://hmajax.itheima.net/api/settings',
       method: 'PUT',
       data: userObj
     }).then(result => {
       // 4.1 创建toast对象
       const toastDom = document.querySelector('.my-toast')
       const toast = new bootstrap.Toast(toastDom)
   
       // 4.2 调用show方法->显示提示框
       toast.show()
     })
   })
   ```

**错误处理**：失败分支也可以复用 Toast，但要在显示前替换为失败文案，并保留表单内容供用户重试。

## 参考文献

1. [表单概念->百度百科](https://baike.baidu.com/item/%E8%A1%A8%E5%8D%95)
2. [accept属性->mdn](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Content_negotiation/List_of_default_Accept_values)
3. [accept属性->菜鸟教程](https://www.runoob.com/tags/att-input-accept.html)
4. [FormData->mdn](https://developer.mozilla.org/zh-CN/docs/Web/API/FormData)
5. [BS的Model文档](https://v5.bootcss.com/docs/components/modal/#passing-options)
6. [axios请求方式别名](https://www.axios-http.cn/docs/api_intro)
