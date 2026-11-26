---
title: NestJS 与 TypeORM：实体建模、序列化 DTO、关联查询与事务
slug: nestjs-typeorm-and-transactions
date: 2026-07-13
categories:
  - 后端开发
tags:
  - NestJS
  - TypeORM
  - MySQL
  - 事务
  - DTO
---

TypeORM 接入 NestJS 后，最容易引发线上数据事故的隐患集中在四个地方：生产环境误开 `synchronize: true` 导致改实体时直接删表删列；把带有密码哈希的数据库实体原样返回给控制器；在事务回调里误用了外部注入的全局 Repository 导致局部写操作脱离事务；以及混用 `save()` 与 `update()` 却不清楚各自的数据库往返次数和实体钩子触发差异。

## 根模块异步连接与实体注册

在 `AppModule` 通过 `TypeOrmModule.forRootAsync()` 注入 `ConfigService` 建立连接，业务模块再通过 `TypeOrmModule.forFeature([User, Tag])` 注册各自管理的实体：

```ts
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class AppModule {}
```

**生产环境必须永久关闭 `synchronize: true`，表结构变更全部走经人工审查的 Migration；一次误删实体属性加上 `synchronize: true`，TypeORM 会直接在启动时 `DROP COLUMN` 毁掉线上数据。**

在 Service 构造函数中注入仓储时，由于 TypeScript 泛型 `Repository<User>` 在编译后会被擦除，必须显式加上 `@InjectRepository(User)` 为 NestJS DI 容器提供运行时 Token；若报错 `No metadata for User was found`，优先核对实体是否加了 `@Entity()`、业务模块是否调用了 `forFeature([User])` 以及根连接是否打开 `autoLoadEntities: true`。

## Entity 映射与关联关系建模

Entity 类精确映射数据库表的列类型、约束与关联关系：

```ts
// users/entities/user.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tag } from './tag.entity';

export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => Tag, (tag) => tag.user)
  tags!: Tag[];
}
```

一对多关系中，外键永远落在“多”的那一侧（`Tag`），显式额外声明一列 `userId` 可以在不联表加载整条 `User` 记录的情况下直接读出归属 ID；使用箭头函数 `() => User` 延迟实体求值则能规避双向引用引发的循环导入问题：

```ts
// users/entities/tag.entity.ts
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 32 })
  name!: string;

  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.tags, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user!: User;
}
```

需要注意 `simple-array`（逗号拼接）和 `simple-json`（序列化文本）虽写起来省事，但元素不能安全包含逗号，也无法借助数据库原生索引高效检索内部字段；有检索和约束需求的集合应当拆成独立关联表或使用数据库原生 JSON 列。多对多关系则使用 `@ManyToMany()` 配合 `@JoinTable()`（只声明在主控一侧）维护中间映射表。

关联数据默认不会自动加载；列表接口切忌盲目给所有查询加上 `relations: { tags: true }`，应当仅在详情接口按需加载，或通过 `QueryBuilder` 的 `leftJoinAndSelect` 配合字段筛选控制传输体积。

## `save` / `remove` 与 `update` / `delete` 差异

在 TypeORM 0.3 中，单条按条件查询统一使用 `findOneBy({ id })` 或 `findOne({ where: { id } })`（旧版 `findOne(id)` 已废弃）。写操作则要分清实体方法与直接 SQL 方法的代价边界：

| 操作方式 | 是否先取 Entity | 数据库往返次数 | 实体 Hook / Listener |
| --- | --- | --- | --- |
| `create()` | 纯内存构建实例 | 0 次（不执行 SQL） | 不触发 |
| `save(entity)` / `preload()` | 更新前通常需加载实体 | 更新通常 2 次 | 触发 `@BeforeUpdate` 等实体生命周期 |
| `update(criteria, patch)` | 直接发 `UPDATE` SQL | 1 次 | 不触发实体 Hook |
| `remove(entity)` | 需先查出实体实例 | 通常 2 次 | 触发 `@BeforeRemove` / `@AfterRemove` |
| `delete(criteria)` | 直接发 `DELETE` SQL | 1 次 | 不触发实体 Hook |

**`repo.create()` 只在内存里构造类实例而不会发任何 SQL，真正落库必须调用 `repo.save()`；且 `save()` 收到带有已存在主键的对象时会执行更新，绝对不能把未过滤主键的 `req.body` 直接传给 `save()`。**

如果业务依赖 `@AfterInsert`、`@BeforeUpdate` 或实体订阅器（Subscriber），必须先查（或 `preload()`）再 `save()` / `remove()`；批量更新固定字段且不依赖实体钩子时，直接用 `update()` / `delete()` 减少往返次数。

编写分页列表接口时，务必搭配稳定排序（如 `order: { id: 'DESC' }`）与上限保护（`@Max(100)`），并使用 `findAndCount()` 复用同一套 `where` 条件避免列表与总数不一致；数据量大时，`Like('%keyword%')` 这类前导通配符无法命中普通 B-Tree 索引，需及时换用前缀匹配、全文索引或独立搜索引擎。

## 输入约束与输出 DTO 脱敏序列化

输入校验 DTO 必须定义独立类（更新 DTO 用 `PartialType(CreateUserDto)` 继承，避免直接写 `Partial<CreateUserDto>` 丢失运行时装饰器元数据），Service 层的补丁类型也应用 `Pick` 收窄可改字段（防止 `id` 被意外覆盖）。

**给列加上 `select: false` 只能拦住常规 `find` 查询，执行 `save()` 后返回的新建实体依然带着敏感属性——响应层必须使用输出 DTO 白名单拦截字段泄漏。**

```ts
// users/dto/user-response.dto.ts
import { Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id!: number;

  @Expose()
  name!: string;

  @Expose()
  email!: string;
}
```

配合自定义 `SerializeInterceptor`（基于 `plainToInstance` 并强制开启 `excludeExtraneousValues: true`），只把显式标有 `@Expose()` 的白名单字段序列化给客户端：

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

同样也可以配合 NestJS 内置的 `ClassSerializerInterceptor` 与实体上的 `@Exclude()` 使用，但白名单模式（`excludeExtraneousValues: true` + 独立输出 DTO）比黑名单模式更安全：日后给 Entity 新增内部字段时，不会因为忘了加 `@Exclude()` 而意外暴露到接口中。绝不要在控制器里手写 `delete user.passwordHash`，这种补丁极易污染原对象并在数组、嵌套关联中漏网。

## 事务控制与并发悲观锁

跨多步写入或转账扣款必须放进同一个数据库事务。TypeORM 提供注入 `DataSource` 调用 `dataSource.transaction(async (manager) => ...)`（以及手动控制 `QueryRunner` 的 `startTransaction` / `commitTransaction` / `rollbackTransaction` / `release`）两种方式，日常业务优先选用自动提交回滚的 `dataSource.transaction()`。

**事务回调内部的所有数据库读写必须统一通过回调参数 `manager.getRepository(...)` 发起，绝不能在事务块里调用外部注入的 `this.accountsRepo`——那会让语句脱离事务连接单独提交。**

```ts
// accounts/accounts.service.ts
@Injectable()
export class AccountsService {
  constructor(private readonly dataSource: DataSource) {}

  transfer(fromId: number, toId: number, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('转账金额必须是正整数分');
    }
    if (fromId === toId) {
      throw new BadRequestException('付款人与收款人不能相同');
    }

    return this.dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository(Account);
      // 按主键升序加锁，消除双方互转引起的死锁环
      const ids = [fromId, toId].sort((a, b) => a - b);
      const locked = new Map<number, Account>();

      for (const id of ids) {
        const account = await accounts.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (account) locked.set(id, account);
      }

      const from = locked.get(fromId);
      const to = locked.get(toId);
      if (!from || !to) throw new BadRequestException('账户不存在');
      if (from.balance < amount) throw new BadRequestException('余额不足');

      from.balance -= amount;
      to.balance += amount;
      await accounts.save([from, to]);
      return { success: true };
    });
  }
}
```

并发环境下切忌捕获异常后返回 `{ success: false }`——回调正常返回会让 TypeORM 认为事务成功并提交前面已经执行的修改；失败时必须直接向外抛出异常触发自动回滚。此外，开发测试若使用 SQLite（类型与外键约束较宽松），上线迁移至 MySQL 或 PostgreSQL 前必须在目标数据库上重跑并发与事务集成测试验证锁行为。
