---
title: "NestJS 完全开发指南（3）：TypeORM 与用户 CRUD"
date: 2026-07-12
updated: 2026-07-12
slug: nestjs-typeorm-user-crud
type: Notes
tags:
  - NestJS
  - TypeORM
  - DTO
  - Interceptor
source:
  - https://www.bilibili.com/video/BV1D9MezXExs/
bvid: BV1D9MezXExs
pages: P39-P65
categories:
  - 后端开发
  - NestJS
draft: false
---

# NestJS 完全开发指南（3）：TypeORM 与用户 CRUD

这一段课程把用户模块从“能接收请求”推进到“能把数据可靠地写进数据库，并且只返回该返回的字段”。真正需要理顺的不是某个装饰器，而是这条调用链：

```text
HTTP 请求 -> Controller -> Service -> Repository -> Database
HTTP 响应 <- 序列化 Interceptor <- Service 返回的 Entity
```

Controller 负责路由和取参数，Service 放业务规则，Repository 负责数据库操作。Entity 描述数据库中的数据形状，DTO 则描述接口的输入或输出。几个名字很像，但职责不能混在一起。

拿“创建用户”这条请求顺一遍会更清楚。客户端把邮箱和密码发到 `POST /users`，ValidationPipe 先按 `CreateUserDto` 校验；Controller 拿到已经校验过的数据，只负责调用 `usersService.create`；Service 决定如何创建用户，必要时还会检查邮箱、处理密码；Repository 把 Entity 写进数据库；返回途中，序列化 Interceptor 再把 Entity 转成 `UserDto`，去掉密码字段。每一层只知道紧邻自己的那一层，改数据库实现时不需要动 Controller，改接口输出时也不必碰表结构。

这种分层并不是为了多建几个文件。它真正解决的是变化方向不同的问题：数据库字段会因为存储需求变化，接口字段会因为产品需求变化，业务规则又可能被 HTTP、定时任务和消息消费共同调用。把三类变化塞进同一个类，代码短期看着省事，后面每次修改都会牵一串回归。

> 来源覆盖：`BV1D9MezXExs` P39-P57（TypeORM、用户 CRUD、异常处理）和 P58-P65（DTO、序列化、Interceptor）。素材来自 Bilibili 自动翻译中文字幕，下面的代码经过整理，并非视频代码的逐字复现。

## 一、Entity 和 Repository 是什么关系

Entity 是 TypeORM 对一张表的映射。下面的 `User` 类会对应 `user` 表，类的实例对应表中的一行记录。

```ts
// user.entity.ts
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;
}
```

Entity 写好后还要接进 Nest 的模块系统。根模块建立数据库连接，功能模块通过 `forFeature` 注册自己要用的 Entity。

```ts
// app.module.ts
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: 'db.sqlite',
  entities: [User],
  synchronize: true,
});

// users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

`forFeature([User])` 会为当前模块准备 `Repository<User>`。Service 不需要手写仓库类，只要通过依赖注入拿到它：

```ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}
}
```

这里的 `@InjectRepository(User)` 不能省。`Repository<User>` 中的泛型只存在于 TypeScript 编译阶段，Nest 在运行时看不到泛型参数，需要装饰器明确告诉 DI 容器：“我要的是 User 的仓库。”

Entity 和 DTO 经常长得相似，却不是同一种东西。Entity 面向数据库，要保留主键、密码哈希、内部状态等持久化字段；创建 DTO 面向请求，只允许客户端提交可写字段；输出 DTO 面向响应，只公开当前接口承诺的字段。以后用户表加了 `isAdmin`，如果接口直接返回 Entity，新字段可能在没人留意时暴露出去；使用输出 DTO 白名单，新增数据库列不会自动改变公开 API。

## 二、`create` 和 `save` 为什么要分两步

这两个方法最容易混：

- `repo.create(data)` 只在内存里创建 Entity 实例，不会执行 SQL。
- `repo.save(entity)` 才会插入或更新数据库，并返回保存后的实体。

```ts
async create(email: string, password: string) {
  const user = this.usersRepo.create({ email, password });
  return this.usersRepo.save(user);
}
```

从结果看，直接 `save({ email, password })` 也可能成功，但先 `create` 再 `save` 有一个实际好处：后续如果 Entity 上有 listener、subscriber 或实例方法，代码始终在操作真正的 Entity 实例，不会一会儿传普通对象，一会儿传实体，最后留下很难追的行为差异。

同一条原则也能解释两组相似 API：

| 操作方式 | 是否先取 Entity | 数据库往返 | Entity listener |
| --- | --- | --- | --- |
| `save(entity)` | 通常需要 | 更新时通常两次 | 会按实体流程执行 |
| `update(criteria, patch)` | 不需要 | 一次 | 不走实体实例流程 |
| `remove(entity)` | 需要 | 通常两次 | 会按实体流程执行 |
| `delete(criteria)` | 不需要 | 一次 | 不走实体实例流程 |

这不是说 `update`、`delete` 不能用。批量更新、批量删除或对性能敏感时，它们更合适。先确认项目是否依赖实体钩子，再选 API，不要凭名字猜。

还要注意，`save` 不是“只做插入”的别名。传入带主键、且数据库中已有对应记录的实体时，它会执行更新。这个便利也可能掩盖意外写入：如果客户端能控制主键，或者 patch 对象没有收紧字段，原本的创建流程可能变成更新流程。主键应由路由或服务端决定，不要直接把未经筛选的请求体交给 `save`。

## 三、把 CRUD 放进 Service

下面使用 TypeORM 0.3 的查询写法。旧版课程代码里常见 `findOne(id)`，新项目应写成 `findOneBy({ id })` 或 `findOne({ where: { id } })`。

```ts
type UserPatch = Partial<Pick<User, 'email' | 'password'>>;

async findOne(id: number) {
  return this.usersRepo.findOneBy({ id });
}

async findOneByEmail(email: string): Promise<User | null> {
  return this.usersRepo.findOneBy({ email });
}

async update(id: number, patch: UserPatch) {
  const user = await this.findOne(id);
  if (!user) {
    throw new NotFoundException('用户不存在');
  }

  Object.assign(user, patch);
  return this.usersRepo.save(user);
}

async remove(id: number) {
  const user = await this.findOne(id);
  if (!user) {
    throw new NotFoundException('用户不存在');
  }

  return this.usersRepo.remove(user);
}
```

更新方法接收一个 patch 对象，比 `update(id, email, password, name, ...)` 更耐用。字段增加后不需要不断拉长参数列表。不过 `Partial<User>` 太宽，会把 `id` 等不该修改的字段也放进类型，所以这里用 `Pick` 收紧了范围。

这里采用“先查再改再保存”，除了让实体流程和 listener 生效，也能在修改前加入业务判断。例如禁止普通用户修改管理员字段，或只有邮箱真正变化时才发送确认邮件。代价是多一次查询。若业务只是把某个状态批量改成固定值，不需要读取旧数据，也不依赖 listener，直接 `update` 会更贴合需求。

多步写操作还要考虑事务。比如创建用户后还要创建默认资料、写审计记录，任何一步失败都不应该留下半套数据。这时不要在 Service 里连续调用几个 Repository 然后祈祷全部成功，应使用 TypeORM transaction，让这些写入一起提交或一起回滚。简单 CRUD 可以先不引入事务，跨表不变量则不能靠调用顺序保证。

### 查询接口要先定返回语义

`findOneBy` 找不到记录时返回 `null`，`find` 找不到时返回空数组。两种结果都很正常，但接口层要保持一致：详情接口通常把 `null` 转成 404；列表接口则返回 `[]`，不应该因为没有匹配项而报错。把这个差别留到 Controller 决定，比让 Repository 随机抛异常更容易理解。

列表查询还要区分“没有过滤条件”和“过滤值为空”。如果 `GET /users` 表示列出用户，Service 可以在没有 email 时调用普通 `find`；如果这个接口只允许按邮箱搜索，就应让 DTO 或 Pipe 拒绝缺失参数。不要把 `undefined` 原样塞进 where 条件后期待 ORM 替你决定语义。

```ts
async find(email?: string) {
  return this.usersRepo.find({
    where: email ? { email } : {},
    order: { id: 'DESC' },
    take: 50,
  });
}
```

课程示例数据很少，直接返回全部记录没有明显问题；真实用户表会不断增长，列表接口应尽早加排序和分页上限。经常按邮箱、状态或创建时间查询的字段还需要数据库索引。ORM 能帮你生成 SQL，却不会自动替业务选出合理索引。

删除也要先定接口语义。请求删除不存在的 ID，是返回 404，还是把“目标已经不存在”视为幂等成功，两种都能成立，关键是团队统一。课程选择抛 `NotFoundException`，这样调用方能发现 ID 写错；如果接口面向重复执行的清理任务，幂等删除可能更省事。Repository 方法本身不会替产品做这个决定。

课程把 `NotFoundException` 放在 Service 中，HTTP 项目这样写很省事；如果同一个 Service 还要给 WebSocket、gRPC 或任务队列复用，可以改抛领域错误，再由不同入口映射成各自的响应。

## 四、输入 DTO：先把脏数据挡在 Controller 外

创建和更新的校验规则不同。创建用户时邮箱、密码都必填；更新时两者都可以不传，但只要传了就必须合法。

```ts
// create-user.dto.ts
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

// update-user.dto.ts
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
```

Controller 只做协议层工作：读参数、触发校验、调用 Service。

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body.email, body.password);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  @Get()
  find(@Query('email') email: string) {
    return this.usersService.findOneByEmail(email);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

URL 参数进来时本来是字符串，`ParseIntPipe` 比在方法里到处写 `parseInt` 更清楚，也能让非法 ID 直接得到 400。全局 `ValidationPipe` 建议至少打开 `whitelist: true`，避免客户端悄悄塞入 DTO 未声明的字段。

## 五、输出 DTO：别让密码跟着 Entity 一起返回

输入 DTO 解决“客户端能传什么”，输出 DTO 解决“服务端能返回什么”。两者不要复用。用户实体里有 `password`，但接口响应不该出现它，即使存的是哈希值也一样。

```ts
// user.dto.ts
import { Expose } from 'class-transformer';

export class UserDto {
  @Expose()
  id!: number;

  @Expose()
  email!: string;
}
```

课程先介绍了在 Entity 上用 `@Exclude()` 配合 `ClassSerializerInterceptor` 的方案，随后改成输出 DTO 白名单。后者更灵活：同一个 Entity 可以按接口需要映射为公开资料、管理员视图等不同形状。

```ts
type ClassConstructor = new (...args: any[]) => object;

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  constructor(private readonly dto: ClassConstructor) {}

  intercept(_: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) =>
        plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
        }),
      ),
    );
  }
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializeInterceptor(dto));
}
```

```ts
@Serialize(UserDto)
@Controller('users')
export class UsersController {
  // 所有处理器返回的 User 都按 UserDto 输出
}
```

`excludeExtraneousValues: true` 是这里的关键：只有带 `@Expose()` 的字段会留下。`plainToInstance` 也能处理数组，因此查询用户列表时不需要再写一套逻辑。老版本 `class-transformer` 中同一功能名为 `plainToClass`。

序列化应放在响应出口，而不是修改数据库实体本身。若直接 `delete user.password`，当前实体对象就被改了，后续业务再读取密码哈希时会拿不到；TypeORM 通常会忽略值为 `undefined` 的字段，并不会因此自动把该列清空，但这仍不该成为输出过滤方案。Service 返回数组、分页对象或嵌套关系时，手动删除也很容易漏。Interceptor 让规则集中在一个位置，同时保留 Controller 针对不同接口选择不同输出 DTO 的能力。

调试序列化时可以分三步看：先在 Service 返回前确认拿到的是不是预期 Entity；再在 Interceptor 的 `map` 中看原始 `data`；最后检查 DTO 的 `@Expose()`。这样能快速判断问题出在查询、拦截器作用范围，还是 DTO 配置，而不是对着最终 JSON 猜。

## 六、常见坑与调试顺序

### 1. `No metadata for User was found`

先检查 `User` 是否进入根连接的 `entities`，或是否启用了 `autoLoadEntities`；再检查功能模块有没有 `TypeOrmModule.forFeature([User])`。

### 2. Nest 无法解析 `Repository<User>`

通常是漏了 `@InjectRepository(User)`，或者 Service 所在模块没有导入 `TypeOrmModule.forFeature([User])`。只看 TypeScript 类型不会解决运行时 DI。

### 3. 调了 `create`，数据库却没有数据

`create` 不写库。打开 TypeORM query 日志，确认后面是否真的执行了 `save`，以及异步调用是否 `await`。

### 4. 更新或删除后 listener 没运行

检查是不是直接用了 `update` / `delete`。如果业务依赖实体 listener，先查出实体，再 `save` / `remove`；如果不依赖，就别为了形式多跑一次查询。

### 5. 密码仍然出现在响应里

确认 Interceptor 的作用范围，确认 DTO 字段有 `@Expose()`，并检查是否打开 `excludeExtraneousValues`。不要只在某一个 Controller 方法里手动 `delete user.password`，这种修补很容易漏路由。

### 6. 重复邮箱偶尔还是写进去了

Service 中“先查询再创建”只能改善提示，挡不住并发请求。数据库列仍要加唯一约束，并把唯一键冲突转换成合适的接口错误。

### 7. `synchronize: true` 用到了生产环境

它适合课程和本地开发，不适合生产库。真实项目应关闭它，用 migration 管理表结构变化。

### 8. SQLite 能跑，换 PostgreSQL 后出错

SQLite 对类型和约束比较宽松，课程中用它是为了降低启动成本。迁移前要重新检查列类型、大小写比较、唯一约束、日期时区和事务行为，并在目标数据库上跑集成测试。TypeORM 屏蔽了大部分 SQL 写法，没有抹掉数据库之间的差异。

### 9. Controller 越写越厚

当处理器里开始出现查库、重复判断、对象合并和多步写入时，把它们移回 Service。Controller 里保留“从请求取什么、调用哪个用例、返回什么状态”即可。反过来，`@Param`、`@Body`、HTTP 状态码也不要塞进 Service，否则业务层会重新绑死在 HTTP 上。

完成这一层后，用户模块已经有了清晰边界：Entity 管持久化形状，输入 DTO 管请求，输出 DTO 管响应，Service 管业务，Repository 管 SQL。下一步的认证逻辑只需要在这套边界上继续搭，不必再回到 Controller 里堆数据库代码。

实际写完可以做一次很朴素的走查：创建用户后数据库确实多一行；详情和列表都不返回密码；只更新邮箱时密码保持不变；删除不存在的 ID 得到约定好的结果；重复邮箱最终由数据库约束拦住。把这几条跑通，比只看到服务能启动更能说明 CRUD 的边界真的接对了。
