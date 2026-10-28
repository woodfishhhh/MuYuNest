---
title: NestJS TypeORM 实体、CRUD 与事务
date: 2026-07-13
updated: 2026-07-13
tags:
  - NestJS
  - TypeORM
  - MySQL
  - CRUD
  - Transaction
source:
  - https://www.bilibili.com/video/BV1NG41187Bs/
bvid: BV1NG41187Bs
pages: P24-P29
categories:
  - 后端开发
draft: false
---

# NestJS TypeORM 实体、CRUD 与事务

NestJS 连 MySQL 的最小闭环：根模块建连接，业务模块注册实体，Service 注入 `Repository`，所有数据库操作都从 Repository 发起。

```bash
npm i @nestjs/typeorm typeorm mysql2
```

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow('DB_USER'),
        password: config.getOrThrow('DB_PASSWORD'),
        database: config.getOrThrow('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class AppModule {}
```

`autoLoadEntities` 会收集业务模块通过 `forFeature` 注册的实体。`synchronize` 会直接按实体改表结构，只适合本地开发；生产环境要关掉，用 migration 管结构变更。数据库密码也别写死在源码里。

## 实体怎么映射表

实体就是表结构在 TypeScript 里的映射。下面的字段覆盖了常见的主键、唯一约束、时间列、默认值和查询时隐藏的字段：

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

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash!: string | null;

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

- `@PrimaryGeneratedColumn()` 建自增主键，传 `'uuid'` 就改用 UUID。
- `@CreateDateColumn()` 和 `@UpdateDateColumn()` 由 TypeORM 在写入时维护。
- `select: false` 让普通查询默认不返回敏感列，但代替不了输出 DTO。示例允许没有本地密码的账号存 `NULL`；纯密码登录的系统要改成非空，并在创建用户前做好哈希。
- `nullable: true` 表示数据库允许 `NULL`，TypeScript 类型里也要带上 `null`。

TypeORM 还有 `simple-array` 和 `simple-json`：

```ts
@Column('simple-array')
aliases!: string[];

@Column('simple-json')
profile!: { city: string; age: number };
```

`simple-array` 用逗号拼接，元素本身不能安全地包含逗号；`simple-json` 只是把 JSON 序列化存进去，数据库没法像原生 JSON 列那样高效查里面的字段。要检索、加约束或做关联，就拆表或者用数据库原生的 JSON 类型。

## Repository 放在哪

实体要先进当前业务模块的 `TypeOrmModule.forFeature`，Repository 才能注入：

```ts
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Tag])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

```ts
constructor(
  @InjectRepository(User)
  private readonly users: Repository<User>,
) {}
```

光写 `Repository<User>` 不够：泛型在运行时被擦掉了，要靠 `@InjectRepository(User)` 给 Nest 提供正确的注入 token。

## CRUD 接口

CRUD 就是 Create、Read、Update、Delete。Controller 只处理 HTTP 参数，查询和写库的逻辑放进 Service。

```ts
// users/dto/create-user.dto.ts
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(2, 64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
```

更新接口要用真实的 DTO 类，不能只写 `Partial<CreateUserDto>`：TypeScript 类型运行时不存在，`ValidationPipe` 没法据此校验。

```ts
// users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

```ts
// users/dto/list-users.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  keyword = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
```

```ts
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  create(dto: CreateUserDto) {
    const user = this.users.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.users.save(user);
  }

  async findAll(query: ListUsersDto) {
    const where = query.keyword
      ? { name: Like(`%${query.keyword}%`) }
      : {};

    const [items, total] = await this.users.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async update(id: number, patch: Partial<CreateUserDto>) {
    const user = await this.users.preload({ id, ...patch });
    if (!user) throw new NotFoundException('用户不存在');
    return this.users.save(user);
  }

  async remove(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('用户不存在');
    await this.users.remove(user);
  }
}
```

`create()` 只创建实体对象，不执行 `INSERT`，真正写库的是 `save()`。`preload()` 按主键读出实体、合并补丁，找不到时返回 `undefined`，适合需要实体校验或 listener 的更新。

直接调 `update(id, patch)` 和 `delete(id)` 只执行 SQL，不会先加载实体。往返次数少，但不走那些依赖实体实例的流程。选哪种看业务约束，不看哪种代码短。

```ts
// users/users.controller.ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

`page` 从 1 开始时，偏移量是 `(page - 1) * pageSize`。列表查询一定要有稳定排序，不然翻页时插入新数据，记录会重复或漏掉。`findAndCount` 能复用同一份查询条件，免得列表按名称过滤了、总数却还在统计全表。

模糊查询的 `%keyword%` 在数据量大时一般用不上普通索引。搜索变慢了，按数据库的能力换成前缀索引、全文索引或独立的搜索服务。

## 一对多关系

一个用户有多个标签时，外键放在"多"的那一侧：

```ts
// users/entities/tag.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 32 })
  name!: string;

  @ManyToOne(() => User, (user) => user.tags, {
    onDelete: 'CASCADE',
  })
  user!: User;
}
```

`User.tags` 是一对多的反向属性，`Tag.user` 才是持有外键的一侧。创建标签时显式绑定用户：

```ts
const user = await this.users.findOneByOrFail({ id: userId });
const tags = names.map((name) => this.tags.create({ name, user }));
await this.tags.save(tags);
```

读关系可以用 `relations`：

```ts
return this.users.find({
  relations: { tags: true },
  order: { id: 'DESC' },
});
```

关系默认不加载。列表接口盲目加载所有一对多数据，响应会变大、查询会变慢，一般在详情接口按需加载，或者用 QueryBuilder 只选需要的列。

## 事务必须使用同一个 Manager

转账有"扣款"和"入账"两个写操作，哪一步失败都要整体回滚。TypeORM 这里的关键规则：事务回调里的所有查询都要用回调给的 `EntityManager`，不能混用外面注入的 Repository。

```ts
// accounts/accounts.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';

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
      // 固定锁定顺序，降低两笔反向转账互相等待的概率。
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

      if (!from || !to) {
        throw new BadRequestException('账户不存在');
      }
      if (from.balance < amount) {
        throw new BadRequestException('余额不足');
      }

      from.balance -= amount;
      to.balance += amount;
      await accounts.save([from, to]);

      return { success: true };
    });
  }
}
```

金额用整数"分"存，避开 JavaScript 的浮点误差。事务保证原子性，但并发转账还需要锁或者带条件的原子更新，不然两个请求可能同时读到同一个余额，结果扣超了。锁的行为跟数据库和隔离级别有关，要在实际用的 MySQL 版本上做并发集成测试。

事务失败时直接抛异常就会触发回滚。别捕获异常后只返回 `{ success: false }`，那样事务回调算正常结束，已经执行的写操作会被提交。

## 常见故障

### `No metadata for User was found`

查实体有没有 `@Entity()`，业务模块有没有 `forFeature([User])`，根连接有没有开 `autoLoadEntities` 或者显式配 `entities`。

### Nest 无法解析 `Repository<User>`

查 Service 所在的模块有没有导入 `TypeOrmModule.forFeature([User])`，构造器参数上有没有 `@InjectRepository(User)`。

### `save()` 之后响应泄漏密码

`select: false` 只影响查询。刚创建的实体还是可能带着敏感字段，响应层还是要用输出 DTO 或序列化拦截器做字段白名单。

### 开发环境能建表，生产环境没有变化

关了 `synchronize`，实体变了也不会自动改数据库。要生成并执行 migration，把 migration 放进部署流程。

### 事务写了一半却没有回滚

看是不是在事务回调里调了外部的 Repository，或者吞掉异常后返回了普通结果。事务里统一从回调的 `manager` 拿 Repository，失败了就继续往外抛。
