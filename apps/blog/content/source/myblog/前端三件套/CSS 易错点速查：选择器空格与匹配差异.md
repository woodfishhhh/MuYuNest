---
title: "CSS 易错点速查：选择器空格与匹配差异"
date: 2025-11-03 13:13:52
tags:
  - "CSS"
  - "易错点"
  - "选择器"
  - "后代选择器"
  - "速查表"
categories:
  - "前端开发"
  - "CSS"
---


| 写法                   | 含义                          | 匹配对象                            | 示例                                                  |
| ---------------------- | ----------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `.recommend a.modify`  | 选中带有`modify`类的`<a>`元素 | `<a class="modify">`                | `<div class="recommend"><a class="modify"></a></div>` |
| `.recommend a .modify` | 选中`<a>`内部的`modify`类元素 | `<a><xxx class="modify"></xxx></a>` |                                                       |