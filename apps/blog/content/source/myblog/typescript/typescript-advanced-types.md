---
title: TypeScript 高级类型实践：泛型约束、类型收窄与工具类型
slug: typescript-advanced-types
date: 2025-12-31
categories:
  - 编程语言
tags:
  - TypeScript
  - 高级类型
  - 泛型
  - 类型收窄
  - 工具类型
---

掌握基础类型注解只能保证变量不写错名，真正决定大型项目可维护性的，是如何用类型系统准确表达状态流转、安全接住外部未知数据、消除重复的字段定义并让编译器在重构时自动报错。这依赖于交叉与可辨识联合、类型收窄、泛型约束、索引与映射类型，以及内置工具类型的组合运用。

## 交叉类型（`&`）与合并冲突

交叉类型使用 `&` 将多个类型特征合并为一个新类型，目标值必须同时满足所有源类型的成员要求，常用于给基础模型叠加权限或审计字段：

```ts
type UserBase = {
  id: number;
  name: string;
};

type UserPermission = {
  role: 'admin' | 'user' | 'guest';
  hasEdit: boolean;
};

type User = UserBase & UserPermission;

const admin: User = {
  id: 1,
  name: 'Zhang San',
  role: 'admin',
  hasEdit: true,
};
```

当多个源类型存在同名属性时，编译器会继续对属性类型求交叉：类型兼容时正常合并，**一旦同名属性出现互斥的基本类型（如 `number & string`），该属性会被自动折叠成无任何合法值的 `never`**，在赋值阶段直接暴露冲突。

## 类型守卫与控制流收窄

类型收窄（Type Narrowing）依靠运行时的分支判断，让编译器在特定作用域内自动把宽松的联合类型或 `unknown` 缩小为更精确的子类型：

| 收窄手段 | 适用对象 | 典型写法 |
| --- | --- | --- |
| `typeof` | 原始类型 | `typeof value === 'string'`（注意 `typeof null === 'object'`） |
| `instanceof` | 类与内置引用对象 | `value instanceof Date`、`Array.isArray(value)` |
| `in` 操作符 | 区分带不同属性的对象 | `'radius' in shape` |
| 自定义类型谓词 | 复杂结构校验封装 | `function isCircle(x: Shape): x is Circle` |

```ts
function handleValue(value: Date | string[] | string) {
  if (value instanceof Date) {
    return `Date: ${value.toISOString()}`;
  }
  if (Array.isArray(value)) {
    return `Array: [${value.join(', ')}]`;
  }
  return `String: ${value.toUpperCase()}`;
}
```

对于跨文件复用的复杂对象判断，可以编写返回类型谓词 `parameter is Type` 的守卫函数：

```ts
type Circle = { type: 'circle'; radius: number };
type Rectangle = { type: 'rectangle'; width: number; height: number };
type Shape = Circle | Rectangle;

function isCircle(shape: Shape): shape is Circle {
  return shape.type === 'circle';
}
```

**优先使用运行时类型守卫替代 `as` 强制断言——守卫会在运行期真实检查数据结构，而 `as` 只在编译期闭眼放行，一旦实际值不匹配就会在运行时崩溃。**

## 可辨识联合与 `never` 穷尽检查

可辨识联合（Discriminated Unions）是 TypeScript 建模状态机、支付渠道和异步请求状态的核心模式。所有联合成员共享一个同名但取值互不相同的字面量标签字段（如 `type` 或 `status`），配合 `switch` 即可自动完成分支收窄：

```ts
type PaymentMethod =
  | { type: 'cash'; amount: number }
  | { type: 'card'; cardNumber: string; expiryDate: string }
  | { type: 'wechat'; openId: string; amount: number };

function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

function processPayment(method: PaymentMethod): string {
  switch (method.type) {
    case 'cash':
      return `Cash: ${method.amount.toFixed(2)}`;
    case 'card':
      return `Card: ****${method.cardNumber.slice(-4)} (${method.expiryDate})`;
    case 'wechat':
      return `WeChat: ${method.openId.slice(0, 8)}..., ${method.amount.toFixed(2)}`;
    default:
      return assertNever(method);
  }
}
```

**在 `switch` 的 `default` 分支调用 `assertNever(method)` 能够强制触发穷尽检查：日后只要给 `PaymentMethod` 新增一种渠道却漏改处理函数，编译器会立刻报出类型不匹配错误。**

## 类型断言、索引签名与函数重载

当操作 DOM 或接入缺乏精确类型返回的接口时，统一使用兼容 JSX 的 `as` 语法做类型断言（放弃老式尖括号 `<Type>value`），并且断言前先排除 `null` / `undefined`：

```ts
const usernameInput = document.getElementById(
  'username-input',
) as HTMLInputElement | null;

if (usernameInput) {
  console.log(usernameInput.value);
}
```

需要描述属性名动态生成、但值类型统一的对象字典时，可以使用索引签名（或更简洁的内置 `Record<K, V>`）：

```ts
type UserConfig = {
  readonly [key: string]: string | number | boolean;
  theme?: string; // 显式声明的属性类型必须兼容索引签名值类型
};
```

注意若同一类型同时声明了字符串索引与数字索引，数字索引的值类型必须是字符串索引值类型的子集（因为 JavaScript 对象键名底层均会转成字符串，如 `obj[0]` 等价于 `obj['0']`）。

当函数需要根据入参类型精确推导出不同的返回类型时，使用**函数重载**（多个重载签名 + 一个兼容全部签名的实现签名）：

```ts
function add(a: number, b: number): number;
function add(a: string, b: string): string;
function add(a: number | string, b: number | string): number | string {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  throw new Error('Both parameters must share the same type');
}
```

**重载签名必须按“从最具体到最宽泛”排列，TypeScript 按从上到下顺序匹配第一条命中的签名；同时注意实现签名本身不对外部调用方直接暴露。**

## 可选链（`?.`）与空值合并（`??`）

面对深层嵌套且可能缺字段的 API 数据，可选链 `?.`（支持属性 `obj?.a?.b`、数组下标 `arr?.[0]` 与方法调用 `fn?.()`）遇到 `null` 或 `undefined` 时直接短路返回 `undefined`，但不要用 `?.` 掩盖本应必填字段的缺失错误。

为缺失值提供兜底默认值的场景，优先使用空值合并运算符 `??` 替代逻辑或 `||`：

| 运算符 | 触发默认值的条件 | 典型陷阱 |
| --- | --- | --- |
| `||` | 左侧为任意假值（`0`、`""`、`false`、`NaN`、`null`、`undefined`） | 会把合法的计数 `0` 或空字符串 `""` 误覆盖成默认值 |
| `??` | 左侧仅为 `null` 或 `undefined` | 与 `&&`、`||` 或算术运算符混用时必须显式加括号 |

```ts
const count = 0;
console.log(count || 10); // 10（误覆盖合法的 0）
console.log(count ?? 10); // 0

const result = (a || b) ?? c; // TypeScript 强制要求混用时用括号标明优先级
```

## 泛型约束、`keyof` 与索引访问类型

泛型让函数、类和接口在不丢失类型关联的前提下复用逻辑。直接对泛型 `<T>` 访问属性会报错，通过 `extends` 加上约束以及 `keyof` 索引查询，就能在编译期锁定合法的属性名并精确推导返回值类型：

```ts
function getProperty<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const profile = { id: 1, name: 'woodfish', active: true };
const name = getProperty(profile, 'name'); // 精确推断为 string
// getProperty(profile, 'missing');        // 编译期直接报错
```

配合索引访问类型 `T[K]`（例如 `type UserRole = User['role']`）与 `T[number]`（提取数组元素类型），可以直接从现有模型或只读常量数组（`as const`）衍生出精确的联合类型，彻底消除手动同步两份枚举列表的隐患：

```ts
const ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = (typeof ROLES)[number]; // 'admin' | 'editor' | 'viewer'
```

## 条件类型、映射类型与内置 Utility Types

当需要根据已有类型批量派生新类型（例如接口更新 DTO、脱敏视图或只读配置）时，TypeScript 提供了**映射类型**（`{ [P in keyof T]: ... }`）与**条件类型**（`T extends U ? X : Y`，支持 `infer` 提取内部类型）。日常开发可以直接复用标准库封装好的内置工具类型：

| 工具类型 | 底层原理与作用 | 常见工程场景 |
| --- | --- | --- |
| `Partial<T>` | 将 `T` 的全部顶层属性变为可选 | 局部更新入参（注意 NestJS 运行时校验需用 `PartialType` 类） |
| `Required<T>` | 移除全部属性的可选修饰符 | 内部补全默认值后的完整配置对象 |
| `Readonly<T>` | 将所有顶层属性设为只读 | 状态快照、Redux/Store 不可变输入 |
| `Pick<T, K>` | 从 `T` 中挑选指定属性子集 `K` | 窄化 Service 依赖契约或公开字段白名单 |
| `Omit<T, K>` | 从 `T` 中剔除指定属性 `K` | 创建用户时剔除服务端生成的 `id` 和 `createdAt` |
| `Record<K, V>` | 构造键为 `K`、值为 `V` 的映射对象类型 | 错误码字典、按枚举键分组的处理器映射表 |
| `Exclude<T, U>` / `Extract<T, U>` | 从联合类型 `T` 中排除或提取可赋值给 `U` 的成员 | 收窄联合状态或过滤特定事件类型 |
| `ReturnType<F>` / `Parameters<F>` | 提取函数 `F` 的返回值类型或参数元组类型 | 复用未显式导出返回接口的第三方/工具函数类型 |

```ts
interface ArticleEntity {
  id: number;
  title: string;
  content: string;
  authorId: number;
  publishedAt: Date;
}

type CreateArticleInput = Omit<ArticleEntity, 'id' | 'publishedAt'>;
type UpdateArticlePatch = Partial<Pick<ArticleEntity, 'title' | 'content'>>;
type ArticleSummary = Pick<ArticleEntity, 'id' | 'title' | 'publishedAt'>;
```

**不要在业务代码里把 `ArticleEntity` 里的每个字段手写复制三遍给创建、更新和摘要接口；用 `Omit`、`Pick` 与 `Partial` 从单一模型派生，修改底层字段时所有关联契约会自动联动校验。**
