---
title: "NestJS 完全开发指南（3）：TypeORM 与用户 CRUD"
date: 2026-07-12
updated: 2026-07-12
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
draft: false
---

# NestJS 完全开发指南（3）：TypeORM 与用户 CRUD

```text
HTTP 请求 -> Controller -> Service -> Repository -> Database
HTTP 响应 <- 序列化 Interceptor <- Service 返回的 Entity
```

- Controller：读请求，调 Service。
- Service：处理业务规则。
- Repository：执行数据库操作。
- Entity：描述持久化结构。
- DTO：限制接口的输入和输出。

## Entity 与 Repository

Entity 映射数据库表，一个实例对应一行记录。

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

根模块建数据库连接，功能模块用 `forFeature` 注册 Entity。

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

`forFeature([User])` 会在当前模块注册 `Repository<User>`：

```ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}
}
```

泛型编译后就没了，`@InjectRepository(User)` 给 DI 提供运行时的 token。

- Entity 里有主键、密码哈希、内部状态这些持久化字段。
- 输入 DTO 只声明客户端能写的字段。
- 输出 DTO 只声明接口公开的字段，免得新加的数据库列被意外暴露。

## `create`、`save`、`update` 与 `remove`

- `repo.create(data)` 只在内存里建 Entity 实例，不执行 SQL。
- `repo.save(entity)` 才会插入或更新数据库，返回保存后的实体。

```ts
async create(email: string, password: string) {
  const user = this.usersRepo.create({ email, password });
  return this.usersRepo.save(user);
}
```

Entity 上有 listener、subscriber 或实例方法时，先 `create` 再 `save`，保证操作的是实体实例。

| 操作方式 | 是否先取 Entity | 数据库往返 | Entity listener |
| --- | --- | --- | --- |
| `save(entity)` | 通常需要 | 更新时通常两次 | 会按实体流程执行 |
| `update(criteria, patch)` | 不需要 | 一次 | 不走实体实例流程 |
| `remove(entity)` | 需要 | 通常两次 | 会按实体流程执行 |
| `delete(criteria)` | 不需要 | 一次 | 不走实体实例流程 |

- 依赖实体钩子：用 `save` / `remove`。
- 批量操作或想少几次数据库往返：用 `update` / `delete`。
- `save` 收到数据库里已有的主键时会执行更新。主键要由路由或服务端决定，不能把请求体直接传给 `save`。

## CRUD Service

TypeORM 0.3 用 `findOneBy({ id })` 或 `findOne({ where: { id } })`，旧版的 `findOne(id)` 已经不用了。

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

- patch 类型用 `Pick` 限定能改的字段，避免 `Partial<User>` 把 `id` 也放开。
- 需要实体钩子或修改前校验时，先查、再改、再 `save`；按固定值批量更新可以直接 `update`。
- 跨表写入用 transaction，保证一起提交或一起回滚。

### 查询返回值

- `findOneBy` 没查到返回 `null`，详情接口一般转成 404。
- `find` 没查到返回 `[]`。
- 查询参数必填的话由 DTO 或 Pipe 拒绝空值；可选的话，明确决定要不要加 `where` 条件。

```ts
async find(email?: string) {
  return this.usersRepo.find({
    where: email ? { email } : {},
    order: { id: 'DESC' },
    take: 50,
  });
}
```

- 列表接口一定要设排序和分页上限，常用的过滤字段要建索引。
- 删除没命中可以返回 404，也可以算幂等成功；同一个接口里保持一致就行。
- Service 要被 WebSocket、gRPC 或任务队列复用的话，抛领域错误，由入口层映射成各自协议的错误。

## 输入 DTO

创建和更新的校验规则不一样。创建用户时邮箱、密码都必填；更新时两个都可以不传，但只要传了就得合法。

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

Controller 读参数、触发校验、调 Service。

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

URL 参数默认是字符串。`ParseIntPipe` 负责转数字，失败时返回 400；全局 `ValidationPipe` 至少要开 `whitelist: true`。

## 输出 DTO 与序列化

输入 DTO 和输出 DTO 不复用。密码哈希也不能出现在接口响应里。

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

优先用输出 DTO 做白名单；同一个 Entity 可以映射成公开资料、管理员视图等不同的响应。

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

- `excludeExtraneousValues: true` 只保留 `@Expose()` 的字段。
- `plainToInstance` 支持对象和数组，旧版叫 `plainToClass`。
- 别 `delete user.password`：这会改掉实体对象本身，而且碰到数组、分页和嵌套关系很容易漏字段。
- 排错顺序：Service 的返回值 -> Interceptor 拿到的原始 `data` -> DTO 的 `@Expose()`。

## 排错

### 1. `No metadata for User was found`

先查 `User` 有没有进根连接的 `entities`，或者有没有开 `autoLoadEntities`；再查功能模块有没有 `TypeOrmModule.forFeature([User])`。

### 2. Nest 无法解析 `Repository<User>`

一般是漏了 `@InjectRepository(User)`，或者 Service 所在的模块没导入 `TypeOrmModule.forFeature([User])`。光看 TypeScript 类型解决不了运行时 DI。

### 3. 调了 `create`，数据库却没有数据

`create` 不写库。打开 TypeORM 的 query 日志，确认后面是不是真的执行了 `save`，异步调用有没有 `await`。

### 4. 更新或删除后 listener 没运行

看是不是直接用了 `update` / `delete`。业务依赖实体 listener 的话，先查出实体再 `save` / `remove`；不依赖的话，就别为了走形式多跑一次查询。

### 5. 密码仍然出现在响应里

确认 Interceptor 的作用范围、DTO 字段上有没有 `@Expose()`、有没有开 `excludeExtraneousValues`。别只在某一个 Controller 方法里手动 `delete user.password`，这种补丁很容易漏掉别的路由。

### 6. 重复邮箱偶尔还是写进去了

Service 里"先查再建"只能让提示友好点，挡不住并发请求。数据库列还是要加唯一约束，并把唯一键冲突转成合适的接口错误。

### 7. `synchronize: true` 用到了生产环境

生产环境关掉 `synchronize`，用 migration 管表结构。

### 8. SQLite 能跑，换 PostgreSQL 后出错

SQLite 的类型和约束更宽松。迁到 PostgreSQL 之前，查一遍列类型、大小写比较、唯一约束、日期时区和事务行为，并在目标数据库上跑集成测试。

### 9. Controller 越写越厚

查库、业务判断、对象合并、多步写入放进 Service；`@Param`、`@Body` 和 HTTP 状态码留在 Controller。
