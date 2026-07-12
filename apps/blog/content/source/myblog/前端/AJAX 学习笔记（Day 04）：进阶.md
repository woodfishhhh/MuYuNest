---
title: "AJAX 进阶：组合异步请求、并发与错误处理"
date: 2025-10-19 02:42:51
tags:
  - "AJAX"
  - "进阶"
  - "前后端交互"
categories:
  - "前端开发"
  - "AJAX"
---


单个请求不难，难的是把多个异步步骤组织清楚。后一个请求可能依赖前一个结果，几个互不依赖的请求又应该并发执行；任意一步失败时，页面还要能停止后续处理并给出反馈。

下面从 Promise 链和 async/await 开始，再看事件循环、并发请求以及页面中的完整组合方式。

## 一、把依赖请求串起来

### 1. Promise 链如何传递结果

then 会返回一个新的 Promise。回调返回普通值时，该值会成为下一个 Promise 的结果；返回另一个 Promise 时，后续 then 会等待它完成。这个特性可以把嵌套回调改成线性流程。

   ![image-20230222173851738](images/image-20230222173851738.png)

下面用两个定时任务模拟依赖请求：

   ```js
   /**
    * 目标：掌握Promise的链式调用
    * 需求：把省市的嵌套结构，改成链式调用的线性结构
   */
   // 1. 创建Promise对象-模拟请求省份名字
   const p = new Promise((resolve, reject) => {
     setTimeout(() => {
       resolve('北京市')
     }, 2000)
   })
   
   // 2. 获取省份名字
   const p2 = p.then(result => {
     console.log(result)
     // 3. 创建Promise对象-模拟请求城市名字
     // return Promise对象最终状态和结果，影响到新的Promise对象
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         resolve(result + '--- 北京')
       }, 2000)
     })
   })
   
   // 4. 获取城市名字
   p2.then(result => {
     console.log(result)
   })
   
   // then()原地的结果是一个新的Promise对象
   console.log(p2 === p)
   ```

p2 与 p 不是同一个对象。第二个定时任务返回的 Promise 决定了 p2 的状态和结果，所以最后一个 then 能拿到完整的省市字符串。

### 2. 省、市、区依次请求

省、市、区接口有明确的前后依赖：先取得省份，再用省份查询城市，最后用省份和城市查询地区。每个 then 都要返回下一次 axios 请求，否则后面的 then 不会等待该请求。

   ![image-20230222174946534](images/image-20230222174946534.png)

   ```js
   /**
    * 目标：把回调函数嵌套代码，改成Promise链式调用结构
    * 需求：获取默认第一个省，第一个市，第一个地区并展示在下拉菜单中
   */
   let pname = ''
   // 1. 得到-获取省份Promise对象
   axios({url: 'http://hmajax.itheima.net/api/province'}).then(result => {
     pname = result.data.list[0]
     document.querySelector('.province').innerHTML = pname
     // 2. 得到-获取城市Promise对象
     return axios({url: 'http://hmajax.itheima.net/api/city', params: { pname }})
   }).then(result => {
     const cname = result.data.list[0]
     document.querySelector('.city').innerHTML = cname
     // 3. 得到-获取地区Promise对象
     return axios({url: 'http://hmajax.itheima.net/api/area', params: { pname, cname }})
   }).then(result => {
     console.log(result)
     const areaName = result.data.list[0]
     document.querySelector('.area').innerHTML = areaName
   })
   ```

这段代码仍然按顺序发送三次请求，但嵌套层级已经消失。pname 放在外层，是因为第三次请求仍要使用它。

## 二、用 async/await 写顺序请求

async/await 表达的是同一组依赖关系。await 只暂停当前 async 函数后续语句，等 Promise 成功后取出结果；它不会让整个页面停止响应。

   ```js
   /**
    * 目标：掌握async和await语法，解决回调函数地狱
    * 概念：在async函数内，使用await关键字，获取Promise对象"成功状态"结果值
    * 注意：await必须用在async修饰的函数内（await会阻止"异步函数内"代码继续执行，原地等待结果）
   */
   // 1. 定义async修饰函数
   async function getData() {
     // 2. await等待Promise对象成功的结果
     const pObj = await axios({url: 'http://hmajax.itheima.net/api/province'})
     const pname = pObj.data.list[0]
     const cObj = await axios({url: 'http://hmajax.itheima.net/api/city', params: { pname }})
     const cname = cObj.data.list[0]
     const aObj = await axios({url: 'http://hmajax.itheima.net/api/area', params: { pname, cname }})
     const areaName = aObj.data.list[0]
   
   
     document.querySelector('.province').innerHTML = pname
     document.querySelector('.city').innerHTML = cname
     document.querySelector('.area').innerHTML = areaName
   }
   
   getData()
   ```

三个 await 的顺序就是三个请求的依赖顺序。这里不适合改成并发，因为城市请求需要 pname，地区请求又需要 pname 和 cname。

### 捕获失败请求

await 遇到拒绝状态时会抛出错误。try/catch 先划定错误边界：try 中任意一步失败，剩余语句不再执行，控制权直接进入 catch。

   ```js
   try {
     // 要执行的代码
   } catch (error) {
     // error 接收的是，错误消息
     // try 里代码，如果有错误，直接进入这里执行
   }
   ```

把完整请求放进 try 后，可以在一个位置处理三次请求的失败：

   ```js
   /**
    * 目标：async和await_错误捕获
   */
   async function getData() {
     // 1. try包裹可能产生错误的代码
     try {
       const pObj = await axios({ url: 'http://hmajax.itheima.net/api/province' })
       const pname = pObj.data.list[0]
       const cObj = await axios({ url: 'http://hmajax.itheima.net/api/city', params: { pname } })
       const cname = cObj.data.list[0]
       const aObj = await axios({ url: 'http://hmajax.itheima.net/api/area', params: { pname, cname } })
       const areaName = aObj.data.list[0]
   
       document.querySelector('.province').innerHTML = pname
       document.querySelector('.city').innerHTML = cname
       document.querySelector('.area').innerHTML = areaName
     } catch (error) {
       // 2. 接着调用catch块，接收错误信息
       // 如果try里某行代码报错后，try中剩余的代码不会执行了
       console.dir(error)
     }
   }
   
   getData()
   ```

调试时先确认是哪一次请求失败，再检查 URL、查询参数、状态码和响应体。不要在 catch 中只显示“请求失败”，否则接口返回的具体信息会丢失。

## 三、事件循环决定回调何时执行

JavaScript 先执行调用栈中的同步代码。定时器、网络请求和事件监听由宿主环境处理，回调准备好后进入相应队列，等调用栈空闲再执行。

先看只有一个定时器的情况：

   ```js
   console.log(1)
   setTimeout(() => {
     console.log(2)
   }, 2000)
   ```

即使延迟改成 0，回调也不会插到当前同步代码中间：

   ```js
   console.log(1)
   setTimeout(() => {
     console.log(2)
   }, 0)
   console.log(3)
   ```

下面的例子混合了同步输出和两个定时器。先执行 1、3、5，再按定时器进入队列的时机执行 2 和 4。

   ```js
   /**
    * 目标：阅读并回答执行的顺序结果
   */
   console.log(1)
   setTimeout(() => {
     console.log(2)
   }, 0)
   console.log(3)
   setTimeout(() => {
     console.log(4)
   }, 2000)
   console.log(5)
   ```

   ![image-20230222182338992](images/image-20230222182338992.png)

### 1. 定时器、XHR 和事件监听放在一起

这个练习同时创建定时器、XHR 请求和点击监听。同步部分先输出 1、5、3；定时器和请求回调随后执行，点击回调只在用户触发事件时运行。

   ```js
   /**
    * 目标：阅读并回答执行的顺序结果
   */
   console.log(1)
   setTimeout(() => {
     console.log(2)
   }, 0)
   function myFn() {
     console.log(3)
   }
   function ajaxFn() {
     const xhr = new XMLHttpRequest()
     xhr.open('GET', 'http://hmajax.itheima.net/api/province')
     xhr.addEventListener('loadend', () => {
       console.log(4)
     })
     xhr.send()
   }
   for (let i = 0; i < 1; i++) {
     console.log(5)
   }
   ajaxFn()
   document.addEventListener('click', () => {
     console.log(6)
   })
   myFn()
   ```

   ![image-20230222183656761](images/image-20230222183656761.png)

网络响应耗时不固定，因此 2 和 4 的先后要看运行时机，不能只根据代码位置判断。每点击一次 document，监听器会再输出一次 6。

### 2. 宏任务与微任务

定时器、事件和请求回调属于宏任务；Promise.then 回调属于微任务。一次宏任务中的同步代码执行完后，运行时会先清空当前微任务队列，再取下一个宏任务。

   ![image-20230222184920343](images/image-20230222184920343.png)

下面的 Promise 在创建时同步执行 resolve，then 回调进入微任务队列，因此输出顺序是 1、4、3、2。

   ```js
   /**
    * 目标：阅读并回答打印的执行顺序
   */
   console.log(1)
   setTimeout(() => {
     console.log(2)
   }, 0)
   const p = new Promise((resolve, reject) => {
     resolve(3)
   })
   p.then(res => {
     console.log(res)
   })
   console.log(4)
   ```

   ![image-20230222184949605](images/image-20230222184949605.png)

   ![image-20230222185205193](images/image-20230222185205193.png)

再看一段混合多个 Promise 和定时器的代码。分析时按“同步代码、当前微任务、下一个宏任务”分轮记录，比只凭直觉猜输出顺序可靠。

   ```js
   // 目标：回答代码执行顺序
   console.log(1)
   setTimeout(() => {
     console.log(2)
     const p = new Promise(resolve => resolve(3))
     p.then(result => console.log(result))
   }, 0)
   const p = new Promise(resolve => {
     setTimeout(() => {
       console.log(4)
     }, 0)
     resolve(5)
   })
   p.then(result => console.log(result))
   const p2 = new Promise(resolve => resolve(6))
   p2.then(result => console.log(result))
   console.log(7)
   ```

   ![image-20230222185939276](images/image-20230222185939276.png)

## 四、并发请求与失败边界

互不依赖的请求不必逐个 await。Promise.all 接收多个 Promise，并在全部成功后返回结果数组；其中任意一个失败，合并后的 Promise 会进入 catch。

   ![image-20230222190117045](images/image-20230222190117045.png)

   ```js
   const p = Promise.all([Promise对象, Promise对象, ...])
   p.then(result => {
     // result 结果: [Promise对象成功结果, Promise对象成功结果, ...]
   }).catch(error => {
     // 第一个失败的 Promise 对象，抛出的异常对象
   })
   ```

下面同时请求四个城市的天气。结果数组顺序与传入 Promise.all 的顺序一致，不取决于各请求实际返回的先后。

   ![image-20230222190230351](images/image-20230222190230351.png)

   ```html
   <!DOCTYPE html>
   <html lang="en">
   
   <head>
     <meta charset="UTF-8">
     <meta http-equiv="X-UA-Compatible" content="IE=edge">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>Promise的all方法</title>
   </head>
   
   <body>
     <ul class="my-ul"></ul>
     <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
     <script>
       /**
        * 目标：掌握Promise的all方法作用，和使用场景
        * 业务：当我需要同一时间显示多个请求的结果时，就要把多请求合并
        * 例如：默认显示"北京", "上海", "广州", "深圳"的天气在首页查看
        * code：
        * 北京-110100
        * 上海-310100
        * 广州-440100
        * 深圳-440300
       */
       // 1. 请求城市天气，得到Promise对象
       const bjPromise = axios({ url: 'http://hmajax.itheima.net/api/weather', params: { city: '110100' } })
       const shPromise = axios({ url: 'http://hmajax.itheima.net/api/weather', params: { city: '310100' } })
       const gzPromise = axios({ url: 'http://hmajax.itheima.net/api/weather', params: { city: '440100' } })
       const szPromise = axios({ url: 'http://hmajax.itheima.net/api/weather', params: { city: '440300' } })
   
       // 2. 使用Promise.all，合并多个Promise对象
       const p = Promise.all([bjPromise, shPromise, gzPromise, szPromise])
       p.then(result => {
         // 注意：结果数组顺序和合并时顺序是一致
         console.log(result)
         const htmlStr = result.map(item => {
           return `<li>${item.data.data.area} --- ${item.data.data.weather}</li>`
         }).join('')
         document.querySelector('.my-ul').innerHTML = htmlStr
       }).catch(error => {
         console.dir(error)
       })
     </script>
   </body>
   
   </html>
   ```

Promise 本身不会终止已经发出的网络请求。需要取消时，应使用请求库提供的取消机制，并在错误处理里区分主动取消与真正失败；本篇现有示例只演示失败捕获，没有加入取消代码。

## 五、把请求组合进页面流程

### 1. 一级分类完成后，并发请求二级分类

商品分类先请求一级分类，再根据每个 id 创建二级分类请求。第一步有依赖，第二步可以并发，这类流程适合在 Promise 链中嵌套一次 Promise.all。

   ![image-20230222191151264](images/image-20230222191151264.png)

   ```js
   /**
    * 目标：把所有商品分类“同时”渲染到页面上
    *  1. 获取所有一级分类数据
    *  2. 遍历id，创建获取二级分类请求
    *  3. 合并所有二级分类Promise对象
    *  4. 等待同时成功后，渲染页面
   */
   // 1. 获取所有一级分类数据
   axios({
     url: 'http://hmajax.itheima.net/api/category/top'
   }).then(result => {
     console.log(result)
     // 2. 遍历id，创建获取二级分类请求
     const secPromiseList = result.data.data.map(item => {
       return axios({
         url: 'http://hmajax.itheima.net/api/category/sub',
         params: {
           id: item.id // 一级分类id
         }
       })
     })
     console.log(secPromiseList) // [二级分类请求Promise对象，二级分类请求Promise对象，...]
     // 3. 合并所有二级分类Promise对象
     const p = Promise.all(secPromiseList)
     p.then(result => {
       console.log(result)
       // 4. 等待同时成功后，渲染页面
       const htmlStr = result.map(item => {
         const dataObj = item.data.data // 取出关键数据对象
         return `<div class="item">
       <h3>${dataObj.name}</h3>
       <ul>
         ${dataObj.children.map(item => {
           return `<li>
           <a href="javascript:;">
             <img src="${item.picture}">
             <p>${item.name}</p>
           </a>
         </li>`
         }).join('')}
       </ul>
     </div>`
       }).join('')
       console.log(htmlStr)
       document.querySelector('.sub-list').innerHTML = htmlStr
     })
   })
   ```

这里先由 map 生成 Promise 数组，再统一等待。渲染逻辑只在所有二级分类都返回后执行。

### 2. 省市区联动

联动下拉框由用户事件驱动。省份变化后请求城市并清空旧地区；城市变化后再请求地区，避免界面保留与当前选择不匹配的数据。

   ![image-20230222191239971](images/image-20230222191239971.png)

   ```js
   /**
    * 目标1：完成省市区下拉列表切换
    *  1.1 设置省份下拉菜单数据
    *  1.2 切换省份，设置城市下拉菜单数据，清空地区下拉菜单
    *  1.3 切换城市，设置地区下拉菜单数据
    */
   // 1.1 设置省份下拉菜单数据
   axios({
     url: 'http://hmajax.itheima.net/api/province'
   }).then(result => {
     const optionStr = result.data.list.map(pname => `<option value="${pname}">${pname}</option>`).join('')
     document.querySelector('.province').innerHTML = `<option value="">省份</option>` + optionStr
   })
   
   // 1.2 切换省份，设置城市下拉菜单数据，清空地区下拉菜单
   document.querySelector('.province').addEventListener('change', async e => {
     // 获取用户选择省份名字
     // console.log(e.target.value)
     const result = await axios({ url: 'http://hmajax.itheima.net/api/city', params: { pname: e.target.value } })
     const optionStr = result.data.list.map(cname => `<option value="${cname}">${cname}</option>`).join('')
     // 把默认城市选项+下属城市数据插入select中
     document.querySelector('.city').innerHTML = `<option value="">城市</option>` + optionStr
   
     // 清空地区数据
     document.querySelector('.area').innerHTML = `<option value="">地区</option>`
   })
   
   // 1.3 切换城市，设置地区下拉菜单数据
   document.querySelector('.city').addEventListener('change', async e => {
     console.log(e.target.value)
     const result = await axios({url: 'http://hmajax.itheima.net/api/area', params: {
       pname: document.querySelector('.province').value,
       cname: e.target.value
     }})
     console.log(result)
     const optionStr = result.data.list.map(aname => `<option value="${aname}">${aname}</option>`).join('')
     console.log(optionStr)
     document.querySelector('.area').innerHTML = `<option value="">地区</option>` + optionStr
   })
   ```

如果用户快速连续切换选项，还要考虑旧请求晚于新请求返回的问题。可以在请求层取消旧请求，或在写入页面前核对当前选项是否仍与请求参数一致。

### 3. 收集表单并提交

提交反馈时，表单收集、请求发送、成功提示和失败提示应放在同一条流程里。失败分支从接口响应中读取消息，页面才能说明具体问题。

   ![image-20230222191239971](images/image-20230222191239971.png)

   ```js
   /**
    * 目标2：收集数据提交保存
    *  2.1 监听提交的点击事件
    *  2.2 依靠插件收集表单数据
    *  2.3 基于axios提交保存，显示结果
    */
   // 2.1 监听提交的点击事件
   document.querySelector('.submit').addEventListener('click', async () => {
     // 2.2 依靠插件收集表单数据
     const form = document.querySelector('.info-form')
     const data = serialize(form, { hash: true, empty: true })
     console.log(data)
     // 2.3 基于axios提交保存，显示结果
     try {
       const result = await axios({
         url: 'http://hmajax.itheima.net/api/feedback',
         method: 'POST',
         data
       })
       console.log(result)
       alert(result.data.message)
     } catch (error) {
       console.dir(error)
       alert(error.response.data.message)
     }
   })
   ```

## 六、封装与调试

异步代码的封装边界应跟业务步骤一致：每个函数负责一次请求或一次数据转换，调用方负责组合顺序。不要把请求、DOM 查询、渲染和提示全部塞进一个长函数，否则错误发生时很难判断是哪一层出了问题。

调试组合请求时，先在 Network 中按时间查看每个请求的 URL、参数、状态码和响应体，再看 Console 中的错误对象。依赖请求没有发出，通常要回到上一个 then 的返回值或前一个 await 的结果；并发请求整体失败，则从 Promise.all 的 catch 中定位第一个拒绝项。

## 参考资料

1. [MDN：async function](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/async_function#%E5%B0%9D%E8%AF%95%E4%B8%80%E4%B8%8B)
