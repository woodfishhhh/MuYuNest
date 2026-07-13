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

```text
HTTP 请求 -> Controller -> Service -> Repository -> Database
HTTP 响应 <- 序列化 Interceptor <- Service 返回的 Entity
```

- Controller：读取请求并调用 Service。
- Service：处理业务规则。
- Repository：执行数据库操作。
- Entity：描述持久化结构。
- DTO：限制接口输入和输出。

## Entity 与 Repository

Entity 映射数据库表，实例对应一行记录。

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

根模块建立数据库连接，功能模块用 `forFeature` 注册 Entity。

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

泛型在编译后会消失，`@InjectRepository(User)` 为 DI 提供运行时 token。

- Entity 包含主键、密码哈希和内部状态等持久化字段。
- 输入 DTO 只声明客户端可写字段。
- 输出 DTO 只声明接口公开字段，防止新增数据库列意外暴露。

## `create`、`save`、`update` 与 `remove`

- `repo.create(data)` 只在内存里创建 Entity 实例，不会执行 SQL。
- `repo.save(entity)` 才会插入或更新数据库，并返回保存后的实体。

```ts
async create(email: string, password: string) {
  const user = this.usersRepo.create({ email, password });
  return this.usersRepo.save(user);
}
```

Entity 存在 listener、subscriber 或实例方法时，先 `create` 再 `save`，确保操作的是实体实例。

| 操作方式 | 是否先取 Entity | 数据库往返 | Entity listener |
| --- | --- | --- | --- |
| `save(entity)` | 通常需要 | 更新时通常两次 | 会按实体流程执行 |
| `update(criteria, patch)` | 不需要 | 一次 | 不走实体实例流程 |
| `remove(entity)` | 需要 | 通常两次 | 会按实体流程执行 |
| `delete(criteria)` | 不需要 | 一次 | 不走实体实例流程 |

- 依赖实体钩子：使用 `save` / `remove`。
- 批量操作或减少数据库往返：使用 `update` / `delete`。
- `save` 收到数据库中已有的主键时会执行更新。主键必须由路由或服务端决定，请求体不能直接传给 `save`。

## CRUD Service

TypeORM 0.3 使用 `findOneBy({ id })` 或 `findOne({ where: { id } })`，不再使用旧版的 `findOne(id)`。

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

- patch 类型用 `Pick` 限制可修改字段，避免 `Partial<User>` 放开 `id`。
- 需要实体钩子或修改前校验时，先查再改再 `save`；固定值批量更新可直接 `update`。
- 跨表写入使用 transaction，保证一起提交或回滚。

### 查询返回值

- `findOneBy` 未命中返回 `null`，详情接口通常转换为 404。
- `find` 未命中返回 `[]`。
- 查询参数必填时由 DTO 或 Pipe 拒绝空值；可选时显式决定是否添加 `where` 条件。

```ts
async find(email?: string) {
  return this.usersRepo.find({
    where: email ? { email } : {},
    order: { id: 'DESC' },
    take: 50,
  });
}
```

- 列表接口必须设置排序和分页上限，常用过滤字段建立索引。
- 删除未命中可返回 404，也可定义为幂等成功；接口内保持一致。
- Service 需要被 WebSocket、gRPC 或任务队列复用时，抛领域错误，由入口层映射协议错误。

## 输入 DTO

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

Controller 读取参数、触发校验并调用 Service。

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

URL 参数默认是字符串。`ParseIntPipe` 负责数字转换并在失败时返回 400；全局 `ValidationPipe` 至少开启 `whitelist: true`。

## 输出 DTO 与序列化

输入 DTO 和输出 DTO 不复用。密码哈希也不能出现在接口响应中。

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

优先使用输出 DTO 白名单；同一个 Entity 可以映射为公开资料、管理员视图等不同响应。

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

- `excludeExtraneousValues: true` 只保留 `@Expose()` 字段。
- `plainToInstance` 支持对象和数组；旧版名称是 `plainToClass`。
- 不要 `delete user.password`：这会修改实体对象，而且数组、分页和嵌套关系容易漏字段。
- 排错顺序：Service 返回值 -> Interceptor 原始 `data` -> DTO 的 `@Expose()`。

## 排错

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

生产环境关闭 `synchronize`，使用 migration 管理表结构。

### 8. SQLite 能跑，换 PostgreSQL 后出错

SQLite 的类型和约束更宽松。迁移到 PostgreSQL 前检查列类型、大小写比较、唯一约束、日期时区和事务行为，并在目标数据库运行集成测试。

### 9. Controller 越写越厚

查库、业务判断、对象合并和多步写入放在 Service；`@Param`、`@Body` 和 HTTP 状态码留在 Controller。
