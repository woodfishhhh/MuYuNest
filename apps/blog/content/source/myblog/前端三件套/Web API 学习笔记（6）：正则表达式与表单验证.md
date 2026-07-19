---
title: "Web API 学习笔记（6）：正则表达式与表单验证"
date: 2025-09-26 00:32:03
tags:
  - "前端开发"
  - "正则表达式"
  - "表单验证"
  - "Web API"
  - "vw 适配"
categories:
  - "前端开发"
  - "Web API"
---


## 一、正则表达式

**正则表达式**（Regular Expression）是一种字符串匹配的模式（规则）。

### （一）使用场景

1. 验证表单：如手机号表单要求用户只能输入 11 位数字（匹配）。
2. 过滤页面内容中的敏感词（替换），或从字符串中获取特定部分（提取）等。

### （二）正则基本使用

1. **定义规则**：

```javascript
const reg =  /表达式/
```

- `/ /` 是正则表达式字面量。
- 正则表达式也是 `对象`。

1. **使用正则**：

- `test()` 方法用来查看正则表达式与指定的字符串是否匹配。
- 如果正则表达式与指定的字符串匹配，返回 `true`，否则返回 `false`。

```html
<body>
  <script>
    // 正则表达式的基本使用
    const str = 'web前端开发'
    // 1. 定义规则
    const reg = /web/

    // 2. 使用正则  test()
    console.log(reg.test(str))  // true  如果符合规则匹配上则返回true
    console.log(reg.test('java开发'))  // false  如果不符合规则匹配上则返回 false
  </script>
</body>
```

### （三）元字符

1. **普通字符**：

- 大多数字符仅描述自身，称作普通字符，如所有字母和数字。
- 普通字符只能匹配字符串中与它们相同的字符。例如，规定用户只能输入英文 26 个英文字母，普通字符写法：`/[abcdefghijklmnopqrstuvwxyz]/`。

1. **元字符 (特殊字符）**：

- 具有特殊含义的字符，可极大提高灵活性和强大的匹配功能。例如，规定用户只能输入英文 26 个英文字母，元字符写法：`/[a - z]/`。

#### 1. 边界符

正则表达式中的边界符（位置符）用来提示字符所处的位置，主要有两个字符：

| 边界符 | 含义           |
| ------ | -------------- |
| `^`    | 匹配开头的位置 |
| `$`    | 匹配结束的位置 |

如果 `^` 和 `$` 在一起，表示必须是精确匹配。

```html
<body>
  <script>
    // 元字符之边界符
    // 1. 匹配开头的位置 ^
    const reg = /^web/
    console.log(reg.test('web前端'))  // true
    console.log(reg.test('前端web'))  // false
    console.log(reg.test('前端web学习'))  // false
    console.log(reg.test('we'))  // false

    // 2. 匹配结束的位置 $
    const reg1 = /web$/
    console.log(reg1.test('web前端'))  //  false
    console.log(reg1.test('前端web'))  // true
    console.log(reg1.test('前端web学习'))  // false
    console.log(reg1.test('we'))  // false  

    // 3. 精确匹配 ^ $
    const reg2 = /^web$/
    console.log(reg2.test('web前端'))  //  false
    console.log(reg2.test('前端web'))  // false
    console.log(reg2.test('前端web学习'))  // false
    console.log(reg2.test('we'))  // false 
    console.log(reg2.test('web'))  // true
    console.log(reg2.test('webweb'))  // flase 
  </script>
</body>
```

#### 2. 量词

量词用来设定某个模式重复次数：

| 量词    | 含义                   |      |      |
| ------- | ---------------------- | ---- | ---- |
| `*`     | 重复次数 `>= 0` 次     |      |      |
| `+`     | 重复次数 `>= 1` 次     |      |      |
| `?`     | 重复次数 `0            |      | 1`   |
| `{n}`   | 重复 `n` 次            |      |      |
| `{n,}`  | 重复次数 `>= n`        |      |      |
| `{n,m}` | `n <=` 重复次数 `<= m` |      |      |

**注意**：逗号左右两侧千万不要出现空格。

```html
<body>
  <script>
    // 元字符之量词
    // 1. * 重复次数 >= 0 次
    const reg1 = /^w*$/
    console.log(reg1.test(''))  // true
    console.log(reg1.test('w'))  // true
    console.log(reg1.test('ww'))  // true
    console.log('-----------------------')

    // 2. + 重复次数 >= 1 次
    const reg2 = /^w+$/
    console.log(reg2.test(''))  // false
    console.log(reg2.test('w'))  // true
    console.log(reg2.test('ww'))  // true
    console.log('-----------------------')

    // 3. ? 重复次数  0 || 1 
    const reg3 = /^w?$/
    console.log(reg3.test(''))  // true
    console.log(reg3.test('w'))  // true
    console.log(reg3.test('ww'))  // false
    console.log('-----------------------')


    // 4. {n} 重复 n 次
    const reg4 = /^w{3}$/
    console.log(reg4.test(''))  // false
    console.log(reg4.test('w'))  // flase
    console.log(reg4.test('ww'))  // false
    console.log(reg4.test('www'))  // true
    console.log(reg4.test('wwww'))  // false
    console.log('-----------------------')

    // 5. {n,} 重复次数 >= n 
    const reg5 = /^w{2,}$/
    console.log(reg5.test(''))  // false
    console.log(reg5.test('w'))  // false
    console.log(reg5.test('ww'))  // true
    console.log(reg5.test('www'))  // true
    console.log('-----------------------')

    // 6. {n,m}   n =< 重复次数 <= m
    const reg6 = /^w{2,4}$/
    console.log(reg6.test('w'))  // false
    console.log(reg6.test('ww'))  // true
    console.log(reg6.test('www'))  // true
    console.log(reg6.test('wwww'))  // true
    console.log(reg6.test('wwwww'))  // false

    // 7. 注意事项： 逗号两侧千万不要加空格否则会匹配失败

  </script>
</body>
```

#### 3. 范围

表示字符的范围，定义的规则限定在某个范围，比如只能是英文字母，或者数字等等，用 `[]` 表示范围：

![](https://www.woodfishhhh.xyz/images/1676080296168.png?_t=1753690656270)

| 示例     | 含义                             |
| :------- | :------------------------------- |
| [abc]    | 匹配包含的单个字符，多选 1       |
| [a - z]  | 连字符，匹配单个小写字母范围     |
| [^a - z] | 取反符，匹配不在此范围的单个字符 |

```html
<body>
  <script>
    // 元字符之范围  []  
    // 1. [abc] 匹配包含的单个字符， 多选1
    const reg1 = /^[abc]$/
    console.log(reg1.test('a'))  // true
    console.log(reg1.test('b'))  // true
    console.log(reg1.test('c'))  // true
    console.log(reg1.test('d'))  // false
    console.log(reg1.test('ab'))  // false

    // 2. [a - z] 连字符 单个
    const reg2 = /^[a - z]$/
    console.log(reg2.test('a'))  // true
    console.log(reg2.test('p'))  // true
    console.log(reg2.test('0'))  // false
    console.log(reg2.test('A'))  // false
    // 想要包含小写字母，大写字母 ，数字
    const reg3 = /^[a-zA-Z0-9]$/
    console.log(reg3.test('B'))  // true
    console.log(reg3.test('b'))  // true
    console.log(reg3.test(9))  // true
    console.log(reg3.test(','))  // flase

    // 用户名可以输入英文字母，数字，可以加下划线，要求 6~16 位
    const reg4 = /^[a-zA-Z0-9_]{6,16}$/
    console.log(reg4.test('abcd1'))  // false 
    console.log(reg4.test('abcd12'))  // true
    console.log(reg4.test('ABcd12'))  // true
    console.log(reg4.test('ABcd12_'))  // true

    // 3. [^a - z] 取反符
    const reg5 = /^[^a - z]$/
    console.log(reg5.test('a'))  // false 
    console.log(reg5.test('A'))  // true
    console.log(reg5.test(8))  // true

  </script>
</body>
```

#### 4. 字符类

某些常见模式的简写方式，区分字母和数字：

| 字符类 | 含义                                                         |
| ------ | ------------------------------------------------------------ |
| `\d`   | 匹配一个数字字符，等价于 `[0 - 9]`                           |
| `\D`   | 匹配一个非数字字符，等价于 `[^0 - 9]`                        |
| `\w`   | 匹配字母、数字、下划线，等价于 `[a-zA-Z0-9_]`                |
| `\W`   | 匹配非字母、数字、下划线，等价于 `[^a-zA-Z0-9_]`             |
| `\s`   | 匹配任何空白字符，包括空格、制表符、换页符等，等价于 `[\f\n\r\t\v]` |
| `\S`   | 匹配任何非空白字符，等价于 `[^\f\n\r\t\v]`                   |

## 二、替换和修饰符

### （一）替换

![](https://www.woodfishhhh.xyz/images/1676080437160.png?_t=1753690738882)

`replace` 替换方法，可以完成字符的替换。`replace` 返回值是替换完毕的字符串。

```html
<body>
  <script>
    // 替换和修饰符
    const str = '欢迎大家学习前端，相信大家一定能学好前端，都成为前端大神'
    // 1. 替换  replace  需求：把前端替换为 web
    // 1.1 replace 返回值是替换完毕的字符串
    // const strEnd = str.replace(/前端/, 'web') 只能替换一个
  </script>
</body>
```

### （二）修饰符

修饰符约束正则执行的某些细节行为，如是否区分大小写、是否支持多行匹配等：

- `i` 是单词 `ignore` 的缩写，正则匹配时字母不区分大小写。
- `g` 是单词 `global` 的缩写，匹配所有满足正则表达式的结果。

```html
<body>
  <script>
    // 替换和修饰符
    const str = '欢迎大家学习前端，相信大家一定能学好前端，都成为前端大神'
    // 1. 替换  replace  需求：把前端替换为 web
    // 1.1 replace 返回值是替换完毕的字符串
    // const strEnd = str.replace(/前端/, 'web') 只能替换一个

    // 2. 修饰符 g 全部替换
    const strEnd = str.replace(/前端/g, 'web')
    console.log(strEnd) 
  </script>
</body>
```

## 三、正则插件

![](https://www.woodfishhhh.xyz/images/1676080548639.png?_t=1753690753135)

## 四、change 事件

给 `input` 注册 `change` 事件，值被修改并且失去焦点后触发。

## 五、判断是否有类

使用 `元素.classList.contains()` 方法，可查看元素是否包含某个类，如果有则返回 `true`，没有则返回 `false`。

![](https://www.woodfishhhh.xyz/images/1676080618794.png?_t=1753690815650)