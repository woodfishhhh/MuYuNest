import { rm } from "node:fs/promises";
import path from "node:path";

import type Database from "better-sqlite3";
import {
  type ApiErrorCode,
  type ApiErrorResponse,
  type AuditLogRecord,
  type CreateInviteRequest,
  type CreateInviteResponse,
  type CreateTokenRequest,
  type CreateTokenResponse,
  type ImageRecord,
  type ImageSource,
  type ImageVariant,
  type InviteRecord,
  type ListImagesResponse,
  type ListInvitesResponse,
  type ListAuditLogsResponse,
  type ListTokensResponse,
  type ListUsersResponse,
  type MeResponse,
  type RegisterRequest,
  type RegisterResponse,
  type TokenRecord,
  type TokenScope,
  type UploadImageResponse,
  type UserRecord,
} from "@woodfish-nest/shared";
import { type Context, Hono } from "hono";
import { nanoid } from "nanoid";
import pino from "pino";

import { ensureScope, hashInviteCode, hashToken, parseScopes, resolveAuthContext, type AuthContext } from "./auth.js";
import type { AppEnv } from "./env.js";
import { InMemoryRateLimiter } from "./rate-limit.js";
import { storeUploadedFile } from "./storage.js";

type Bindings = {
  Variables: {
    auth: AuthContext | null;
    db: Database.Database;
    env: AppEnv;
    logger: pino.Logger;
    requestId: string;
  };
};

export interface CreateAppOptions {
  db: Database.Database;
  env: AppEnv;
  logger?: pino.Logger;
}

const TOKEN_SCOPE_VALUES: TokenScope[] = [
  "upload",
  "images:read",
  "images:delete",
  "tokens:manage",
  "invites:manage",
  "admin",
];

const PRIVILEGED_SCOPES = new Set<TokenScope>(["tokens:manage", "invites:manage", "admin"]);

export function createApp(options: CreateAppOptions) {
  const app = new Hono<Bindings>();
  const logger =
    options.logger ??
    pino({
      name: "muyu-image-bed-api",
      level: options.env.nodeEnv === "production" ? "info" : "debug",
    });
  const rateLimiter = new InMemoryRateLimiter();

  app.use("*", async (c, next) => {
    c.set("db", options.db);
    c.set("env", options.env);
    c.set("logger", logger);
    c.set("requestId", `req_${nanoid(12)}`);
    await next();
  });

  app.use("/api/upload", async (c, next) => {
    const contentLength = Number(c.req.header("content-length") ?? "0");
    const env = c.get("env");
    if (Number.isFinite(contentLength) && contentLength > env.maxUploadBytes) {
      return jsonError(c, 413, "UPLOAD_TOO_LARGE", "File exceeds upload limit.");
    }

    const limited = checkRateLimit(c, rateLimiter, "upload", env.rateLimitUploadMax);
    if (limited) {
      return limited;
    }

    await next();
  });

  app.use("/api/register", async (c, next) => {
    const limited = checkRateLimit(c, rateLimiter, "register", c.get("env").rateLimitRegisterMax);
    if (limited) {
      return limited;
    }

    await next();
  });

  app.use("*", async (c, next) => {
    const startedAt = Date.now();
    await next();
    const elapsed = Date.now() - startedAt;
    c.get("logger").info(
      {
        elapsedMs: elapsed,
        method: c.req.method,
        path: c.req.path,
        requestId: c.get("requestId"),
        status: c.res.status,
      },
      "request",
    );
  });

  app.onError((error, c) => {
    c.get("logger").error({ error, requestId: c.get("requestId") }, "unhandled error");
    return jsonError(c, 500, "INTERNAL_ERROR", "Internal server error.");
  });

  app.get("/api/health", (c) => {
    const db = c.get("db");
    const healthy = Boolean(db.prepare("SELECT 1").pluck().get());
    return c.json({
      db: healthy ? "ok" : "down",
      requestId: c.get("requestId"),
      revision: process.env.MUYU_RELEASE_SHA ?? null,
      service: "ok",
    });
  });

  app.get("/api/me", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }

    const row = c
      .get("db")
      .prepare(
        `
          SELECT id, email, display_name, role, created_at, disabled_at
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(auth.context.user.id) as
      | {
          id: string;
          email: string | null;
          display_name: string;
          role: "admin" | "member";
          created_at: string;
          disabled_at: string | null;
        }
      | undefined;
    if (!row) {
      return jsonError(c, 401, "AUTH_INVALID_TOKEN", "Missing or invalid bearer token.");
    }

    const payload: MeResponse = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      createdAt: row.created_at,
      disabledAt: row.disabled_at,
    };
    return c.json(payload);
  });

  app.post("/api/register", async (c) => {
    const body = (await readJson(c)) as Partial<RegisterRequest> | null;
    if (!body) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Invalid JSON body.");
    }

    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const email = typeof body.email === "string" && body.email.trim().length > 0 ? body.email.trim() : null;

    if (inviteCode.length < 12) {
      return jsonError(c, 400, "INVITE_INVALID", "Invite code is invalid.");
    }
    if (displayName.length < 2 || displayName.length > 80) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Display name must be 2-80 characters.");
    }

    const db = c.get("db");
    const env = c.get("env");
    const inviteHash = hashInviteCode(inviteCode, env.tokenSecret);
    try {
      const result = db.transaction(() => {
        const invite = db
          .prepare(
            `
              SELECT id, max_uses, used_count, expires_at, disabled_at
              FROM invites
              WHERE code_hash = ?
              LIMIT 1
            `,
          )
          .get(inviteHash) as
          | {
              id: string;
              max_uses: number;
              used_count: number;
              expires_at: string | null;
              disabled_at: string | null;
            }
          | undefined;

        if (!invite) {
          throw new KnownApiError(400, "INVITE_INVALID", "Invite code is invalid.");
        }
        if (invite.disabled_at) {
          throw new KnownApiError(400, "INVITE_DISABLED", "Invite is disabled.");
        }
        if (invite.expires_at && Date.parse(invite.expires_at) <= Date.now()) {
          throw new KnownApiError(400, "INVITE_EXPIRED", "Invite has expired.");
        }
        if (invite.used_count >= invite.max_uses) {
          throw new KnownApiError(400, "INVITE_EXHAUSTED", "Invite has no remaining uses.");
        }

        const userId = `user_${nanoid(10)}`;
        const now = new Date().toISOString();
        db.prepare(
          `
            INSERT INTO users (id, email, display_name, role, created_at, disabled_at, last_login_at)
            VALUES (?, ?, ?, 'member', ?, NULL, NULL)
          `,
        ).run(userId, email, displayName, now);

        db.prepare("UPDATE invites SET used_count = used_count + 1 WHERE id = ?").run(invite.id);

        const tokenId = `tok_${nanoid(10)}`;
        const rawToken = `muyu_${nanoid(24)}`;
        const tokenHashValue = hashToken(rawToken, env.tokenSecret);
        const tokenScopes: TokenScope[] = ["upload", "images:read", "images:delete"];

        db.prepare(
          `
            INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at, last_used_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
          `,
        ).run(tokenId, userId, "member-default", tokenHashValue, JSON.stringify(tokenScopes), now);

        writeAuditLog(db, {
          action: "auth.register",
          actorUserId: userId,
          ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
          metadata: {
            inviteId: invite.id,
          },
          targetId: userId,
          targetType: "user",
          tokenId,
          userAgent: c.req.header("user-agent") ?? null,
        });

        const userPayload: MeResponse = {
          id: userId,
          email,
          displayName,
          role: "member",
          createdAt: now,
          disabledAt: null,
        };

        return { token: rawToken, tokenId, user: userPayload };
      })();

      const payload: RegisterResponse = {
        token: result.token,
        tokenId: result.tokenId,
        user: result.user,
      };
      return c.json(payload, 201);
    } catch (error) {
      if (error instanceof KnownApiError) {
        return jsonError(c, error.status, error.code, error.message);
      }
      c.get("logger").error({ error, requestId: c.get("requestId") }, "register failed");
      return jsonError(c, 500, "INTERNAL_ERROR", "Failed to register user.");
    }
  });

  app.get("/api/tokens", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "tokens:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow token management.");
    }

    const db = c.get("db");
    const rows = db
      .prepare(
        `
          SELECT id, user_id, name, scopes, created_at, last_used_at, expires_at, revoked_at
          FROM tokens
          WHERE user_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(auth.context.user.id) as Array<{
      id: string;
      user_id: string;
      name: string;
      scopes: string;
      created_at: string;
      last_used_at: string | null;
      expires_at: string | null;
      revoked_at: string | null;
    }>;

    const items: TokenRecord[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      scopes: parseScopes(row.scopes).filter(isTokenScope),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    }));

    const payload: ListTokensResponse = { items };
    return c.json(payload);
  });

  app.post("/api/tokens", async (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "tokens:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow token management.");
    }

    const body = (await readJson(c)) as Partial<CreateTokenRequest> | null;
    if (!body) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Invalid JSON body.");
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Token name must be 2-80 characters.");
    }

    const scopes = normalizeScopes(body.scopes);
    if (!scopes || scopes.length === 0) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Token scopes are invalid.");
    }

    if (auth.context.user.role !== "admin" && scopes.some((scope) => PRIVILEGED_SCOPES.has(scope))) {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Non-admin token cannot include privileged scopes.");
    }

    const expiresAt = parseOptionalIsoDate(body.expiresAt);
    if (body.expiresAt !== undefined && body.expiresAt !== null && !expiresAt) {
      return jsonError(c, 400, "VALIDATION_FAILED", "expiresAt must be an ISO datetime string.");
    }

    const tokenId = `tok_${nanoid(10)}`;
    const rawToken = `muyu_${nanoid(24)}`;
    const createdAt = new Date().toISOString();

    c.get("db")
      .prepare(
        `
          INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at, last_used_at, expires_at, revoked_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL)
        `,
      )
      .run(
        tokenId,
        auth.context.user.id,
        name,
        hashToken(rawToken, c.get("env").tokenSecret),
        JSON.stringify(scopes),
        createdAt,
        expiresAt,
      );

    writeAuditLog(c.get("db"), {
      action: "token.create",
      actorUserId: auth.context.user.id,
      ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
      metadata: {
        name,
        scopes,
      },
      targetId: tokenId,
      targetType: "token",
      tokenId: auth.context.tokenId,
      userAgent: c.req.header("user-agent") ?? null,
    });

    const payload: CreateTokenResponse = {
      token: rawToken,
      record: {
        id: tokenId,
        userId: auth.context.user.id,
        name,
        scopes,
        createdAt,
        lastUsedAt: null,
        expiresAt,
        revokedAt: null,
      },
    };
    return c.json(payload, 201);
  });

  app.post("/api/tokens/:id/revoke", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "tokens:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow token management.");
    }

    const db = c.get("db");
    const tokenId = c.req.param("id");
    const row = db
      .prepare("SELECT id, user_id, revoked_at FROM tokens WHERE id = ? LIMIT 1")
      .get(tokenId) as { id: string; user_id: string; revoked_at: string | null } | undefined;
    if (!row) {
      return jsonError(c, 404, "TOKEN_NOT_FOUND", "Token not found.");
    }
    if (auth.context.user.role !== "admin" && row.user_id !== auth.context.user.id) {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Forbidden.");
    }

    const revokedAt = row.revoked_at ?? new Date().toISOString();
    if (!row.revoked_at) {
      db.prepare("UPDATE tokens SET revoked_at = ? WHERE id = ?").run(revokedAt, tokenId);
      writeAuditLog(db, {
        action: "token.revoke",
        actorUserId: auth.context.user.id,
        ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
        metadata: null,
        targetId: tokenId,
        targetType: "token",
        tokenId: auth.context.tokenId,
        userAgent: c.req.header("user-agent") ?? null,
      });
    }

    return c.json({ id: tokenId, revokedAt, ok: true });
  });

  app.get("/api/invites", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "invites:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow invite management.");
    }

    const rows = c
      .get("db")
      .prepare(
        `
          SELECT id, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at
          FROM invites
          ORDER BY created_at DESC
        `,
      )
      .all() as Array<{
      id: string;
      created_by_user_id: string;
      max_uses: number;
      used_count: number;
      expires_at: string | null;
      disabled_at: string | null;
      created_at: string;
    }>;

    const items: InviteRecord[] = rows.map((row) => ({
      id: row.id,
      createdByUserId: row.created_by_user_id,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      expiresAt: row.expires_at,
      disabledAt: row.disabled_at,
      createdAt: row.created_at,
    }));
    const payload: ListInvitesResponse = { items };
    return c.json(payload);
  });

  app.post("/api/invites", async (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "invites:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow invite management.");
    }

    const body = (await readJson(c)) as Partial<CreateInviteRequest> | null;
    if (!body) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Invalid JSON body.");
    }

    const maxUses = Number(body.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) {
      return jsonError(c, 400, "VALIDATION_FAILED", "maxUses must be an integer in range 1..10000.");
    }

    const expiresAt = parseOptionalIsoDate(body.expiresAt);
    if (body.expiresAt !== undefined && body.expiresAt !== null && !expiresAt) {
      return jsonError(c, 400, "VALIDATION_FAILED", "expiresAt must be an ISO datetime string.");
    }

    const inviteCode = `muyi_${nanoid(20)}`;
    const inviteId = `inv_${nanoid(10)}`;
    const createdAt = new Date().toISOString();

    c.get("db")
      .prepare(
        `
          INSERT INTO invites (id, code_hash, created_by_user_id, max_uses, used_count, expires_at, disabled_at, created_at)
          VALUES (?, ?, ?, ?, 0, ?, NULL, ?)
        `,
      )
      .run(
        inviteId,
        hashInviteCode(inviteCode, c.get("env").tokenSecret),
        auth.context.user.id,
        maxUses,
        expiresAt,
        createdAt,
      );

    writeAuditLog(c.get("db"), {
      action: "invite.create",
      actorUserId: auth.context.user.id,
      ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
      metadata: {
        maxUses,
        expiresAt,
      },
      targetId: inviteId,
      targetType: "invite",
      tokenId: auth.context.tokenId,
      userAgent: c.req.header("user-agent") ?? null,
    });

    const payload: CreateInviteResponse = {
      inviteCode,
      record: {
        id: inviteId,
        createdByUserId: auth.context.user.id,
        maxUses,
        usedCount: 0,
        expiresAt,
        disabledAt: null,
        createdAt,
      },
    };
    return c.json(payload, 201);
  });

  app.post("/api/invites/:id/disable", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "invites:manage")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow invite management.");
    }

    const inviteId = c.req.param("id");
    const db = c.get("db");
    const row = db
      .prepare("SELECT id, disabled_at FROM invites WHERE id = ? LIMIT 1")
      .get(inviteId) as { id: string; disabled_at: string | null } | undefined;
    if (!row) {
      return jsonError(c, 404, "INVITE_INVALID", "Invite not found.");
    }

    const disabledAt = row.disabled_at ?? new Date().toISOString();
    if (!row.disabled_at) {
      db.prepare("UPDATE invites SET disabled_at = ? WHERE id = ?").run(disabledAt, inviteId);
      writeAuditLog(db, {
        action: "invite.disable",
        actorUserId: auth.context.user.id,
        ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
        metadata: null,
        targetId: inviteId,
        targetType: "invite",
        tokenId: auth.context.tokenId,
        userAgent: c.req.header("user-agent") ?? null,
      });
    }

    return c.json({ id: inviteId, disabledAt, ok: true });
  });

  app.get("/api/users", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (auth.context.user.role !== "admin") {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Forbidden.");
    }

    const rows = c
      .get("db")
      .prepare(
        `
          SELECT
            u.id,
            u.email,
            u.display_name,
            u.role,
            u.created_at,
            u.disabled_at,
            (SELECT COUNT(*) FROM tokens t WHERE t.user_id = u.id) AS token_count,
            (SELECT COUNT(*) FROM images i WHERE i.owner_user_id = u.id AND i.deleted_at IS NULL) AS image_count
          FROM users u
          ORDER BY u.created_at DESC
        `,
      )
      .all() as Array<{
      id: string;
      email: string | null;
      display_name: string;
      role: "admin" | "member";
      created_at: string;
      disabled_at: string | null;
      token_count: number;
      image_count: number;
    }>;

    const items: UserRecord[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      createdAt: row.created_at,
      disabledAt: row.disabled_at,
      tokenCount: row.token_count,
      imageCount: row.image_count,
    }));
    const payload: ListUsersResponse = { items };
    return c.json(payload);
  });

  app.post("/api/users/:id/disable", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (auth.context.user.role !== "admin") {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Forbidden.");
    }

    const userId = c.req.param("id");
    const db = c.get("db");
    const row = db
      .prepare("SELECT id, disabled_at FROM users WHERE id = ? LIMIT 1")
      .get(userId) as { id: string; disabled_at: string | null } | undefined;
    if (!row) {
      return jsonError(c, 404, "USER_NOT_FOUND", "User not found.");
    }

    const disabledAt = row.disabled_at ?? new Date().toISOString();
    if (!row.disabled_at) {
      db.transaction(() => {
        db.prepare("UPDATE users SET disabled_at = ? WHERE id = ?").run(disabledAt, userId);
        db.prepare("UPDATE tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(disabledAt, userId);
      })();

      writeAuditLog(db, {
        action: "user.disable",
        actorUserId: auth.context.user.id,
        ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
        metadata: null,
        targetId: userId,
        targetType: "user",
        tokenId: auth.context.tokenId,
        userAgent: c.req.header("user-agent") ?? null,
      });
    }

    return c.json({ id: userId, disabledAt, ok: true });
  });

  app.get("/api/audit-logs", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (auth.context.user.role !== "admin") {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Forbidden.");
    }

    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "100"), 1), 500);
    const cursor = c.req.query("cursor");
    const params: Array<string | number> = [];
    const where: string[] = [];
    if (cursor) {
      where.push("created_at < ?");
      params.push(cursor);
    }

    params.push(limit + 1);
    const rows = c
      .get("db")
      .prepare(
        `
          SELECT
            id,
            actor_user_id,
            token_id,
            action,
            target_type,
            target_id,
            ip,
            user_agent,
            metadata_json,
            created_at
          FROM audit_logs
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY created_at DESC
          LIMIT ?
        `,
      )
      .all(...params) as Array<{
      id: string;
      actor_user_id: string | null;
      token_id: string | null;
      action: string;
      target_type: string;
      target_id: string;
      ip: string | null;
      user_agent: string | null;
      metadata_json: string | null;
      created_at: string;
    }>;

    const trimmed = rows.slice(0, limit);
    const items: AuditLogRecord[] = trimmed.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      tokenId: row.token_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      ip: row.ip,
      userAgent: row.user_agent,
      metadataJson: row.metadata_json,
      createdAt: row.created_at,
    }));

    const payload: ListAuditLogsResponse = {
      items,
      nextCursor: rows.length > limit ? rows[limit - 1]?.created_at ?? null : null,
    };
    return c.json(payload);
  });

  app.post("/api/upload", async (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "upload")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow upload.");
    }

    const formData = await c.req.formData();
    const files = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) {
      return jsonError(c, 400, "VALIDATION_FAILED", "No file uploaded.");
    }
    if (files.length > 1) {
      return jsonError(c, 400, "VALIDATION_FAILED", "Only one file is supported in MVP.");
    }

    const file = files[0];
    if (file.size > c.get("env").maxUploadBytes) {
      return jsonError(c, 413, "UPLOAD_TOO_LARGE", "File exceeds upload limit.");
    }

    const rawSource = formData.get("source");
    const source = normalizeImageSource(rawSource) ?? "api";

    let stored;
    try {
      stored = await storeUploadedFile(c.get("env"), { file });
    } catch (error) {
      if (error instanceof Error && error.message === "UPLOAD_UNSUPPORTED_TYPE") {
        return jsonError(c, 415, "UPLOAD_UNSUPPORTED_TYPE", "Unsupported image MIME.");
      }
      c.get("logger").error({ error, requestId: c.get("requestId") }, "image processing failed");
      return jsonError(c, 500, "UPLOAD_PROCESSING_FAILED", "Failed to process image.");
    }

    const db = c.get("db");
    try {
      const tx = db.transaction(() => {
        db.prepare(
          `
            INSERT INTO images (
              id, owner_user_id, display_name, alt_text, source, hash,
              original_mime, original_ext, width, height, size_bytes, default_variant, created_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `,
        ).run(
          stored.id,
          auth.context.user.id,
          stored.displayName,
          null,
          source,
          stored.hash,
          stored.mime,
          stored.originalExt,
          stored.width,
          stored.height,
          stored.sizeBytes,
          stored.defaultVariant,
          stored.createdAt,
        );

        const insertVariant = db.prepare(
          `
            INSERT INTO image_variants (
              id, image_id, kind, mime, relative_path, public_url, width, height, size_bytes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        );

        for (const variant of stored.variants) {
          insertVariant.run(
            `${stored.id}_${variant.kind}`,
            stored.id,
            variant.kind,
            variant.mime,
            variant.relativePath,
            variant.publicUrl,
            variant.width,
            variant.height,
            variant.sizeBytes,
            stored.createdAt,
          );
        }

        writeAuditLog(db, {
          action: "image.upload",
          actorUserId: auth.context.user.id,
          ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
          metadata: {
            mime: stored.mime,
            sizeBytes: stored.sizeBytes,
          },
          targetId: stored.id,
          targetType: "image",
          tokenId: auth.context.tokenId,
          userAgent: c.req.header("user-agent") ?? null,
        });
      });
      tx();
    } catch (error) {
      await cleanupStoredFiles(c.get("env"), stored.variants.map((variant) => variant.relativePath));
      c.get("logger").error({ error, requestId: c.get("requestId") }, "db write failed");
      return jsonError(c, 500, "INTERNAL_ERROR", "Failed to save image metadata.");
    }

    const payload: UploadImageResponse = {
      createdAt: stored.createdAt,
      defaultVariant: stored.defaultVariant,
      displayName: stored.displayName,
      hash: stored.hash,
      height: stored.height,
      id: stored.id,
      markdown: stored.markdown,
      mime: stored.mime,
      originalUrl: stored.originalUrl,
      sizeBytes: stored.sizeBytes,
      thumbnailUrl: stored.thumbnailUrl,
      url: stored.url,
      width: stored.width,
    };
    return c.json(payload, 201);
  });

  app.get("/api/images", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "images:read")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow image read.");
    }

    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "20"), 1), 100);
    const cursor = c.req.query("cursor");
    const db = c.get("db");

    const params: Array<string | number> = [];
    const whereParts = ["i.deleted_at IS NULL"];
    if (auth.context.user.role !== "admin") {
      whereParts.push("i.owner_user_id = ?");
      params.push(auth.context.user.id);
    }
    if (cursor) {
      whereParts.push("i.created_at < ?");
      params.push(cursor);
    }

    params.push(limit + 1);
    const rows = db
      .prepare(
        `
          SELECT
            i.id,
            i.owner_user_id,
            i.display_name,
            i.alt_text,
            i.source,
            i.hash,
            i.original_mime,
            i.original_ext,
            i.width,
            i.height,
            i.size_bytes,
            i.default_variant,
            i.created_at,
            i.deleted_at
          FROM images i
          WHERE ${whereParts.join(" AND ")}
          ORDER BY i.created_at DESC
          LIMIT ?
        `,
      )
      .all(...params) as Array<Record<string, unknown>>;

    const trimmed = rows.slice(0, limit);
    const items = trimmed.map((row) => mapImageRow(row));
    const loadVariants = db.prepare(
      `
        SELECT kind, mime, relative_path, public_url, width, height, size_bytes
        FROM image_variants
        WHERE image_id = ?
        ORDER BY created_at ASC
      `,
    );
    for (const item of items) {
      const variants = loadVariants.all(item.id) as Array<{
        kind: ImageVariant["kind"];
        mime: string;
        relative_path: string;
        public_url: string;
        width: number | null;
        height: number | null;
        size_bytes: number;
      }>;
      item.variants = variants.map((variant) => ({
        kind: variant.kind,
        mime: variant.mime,
        publicUrl: variant.public_url,
        relativePath: variant.relative_path,
        sizeBytes: variant.size_bytes,
        width: variant.width,
        height: variant.height,
      }));
    }
    const nextCursor = rows.length > limit ? String(trimmed[trimmed.length - 1]?.createdAt ?? "") : null;
    const payload: ListImagesResponse = {
      items,
      nextCursor: nextCursor && nextCursor.length > 0 ? nextCursor : null,
    };
    return c.json(payload);
  });

  app.get("/api/images/:id", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "images:read")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow image read.");
    }

    const id = c.req.param("id");
    const db = c.get("db");
    const row = db
      .prepare(
        `
          SELECT * FROM images
          WHERE id = ? AND deleted_at IS NULL
          LIMIT 1
        `,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return jsonError(c, 404, "IMAGE_NOT_FOUND", "Image not found.");
    }
    if (auth.context.user.role !== "admin" && row.owner_user_id !== auth.context.user.id) {
      return jsonError(c, 403, "AUTH_FORBIDDEN", "Forbidden.");
    }

    const image = mapImageRow(row);
    const variants = db
      .prepare(
        `
          SELECT kind, mime, relative_path, public_url, width, height, size_bytes
          FROM image_variants
          WHERE image_id = ?
          ORDER BY created_at ASC
        `,
      )
      .all(id) as Array<{
      kind: ImageVariant["kind"];
      mime: string;
      relative_path: string;
      public_url: string;
      width: number | null;
      height: number | null;
      size_bytes: number;
    }>;
    image.variants = variants.map((variant) => ({
      kind: variant.kind,
      mime: variant.mime,
      publicUrl: variant.public_url,
      relativePath: variant.relative_path,
      sizeBytes: variant.size_bytes,
      width: variant.width,
      height: variant.height,
    }));
    return c.json(image);
  });

  app.delete("/api/images/:id", (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) {
      return auth.response;
    }
    if (!ensureScope(auth.context, "images:delete")) {
      return jsonError(c, 403, "TOKEN_SCOPE_DENIED", "Token scope does not allow delete.");
    }

    const id = c.req.param("id");
    const db = c.get("db");
    const row = db.prepare("SELECT owner_user_id FROM images WHERE id = ? AND deleted_at IS NULL").get(id) as
      | { owner_user_id: string }
      | undefined;
    if (!row) {
      return jsonError(c, 404, "IMAGE_NOT_FOUND", "Image not found.");
    }
    if (auth.context.user.role !== "admin" && row.owner_user_id !== auth.context.user.id) {
      return jsonError(c, 403, "IMAGE_DELETE_FORBIDDEN", "Forbidden.");
    }

    const deletedAt = new Date().toISOString();
    db.prepare("UPDATE images SET deleted_at = ? WHERE id = ?").run(deletedAt, id);
    writeAuditLog(db, {
      action: "image.delete",
      actorUserId: auth.context.user.id,
      ip: readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")),
      metadata: null,
      targetId: id,
      targetType: "image",
      tokenId: auth.context.tokenId,
      userAgent: c.req.header("user-agent") ?? null,
    });

    return c.json({ deletedAt, id, ok: true });
  });

  return app;
}

type AppContext = Context<Bindings>;

class KnownApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 413 | 415 | 429 | 500,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function normalizeImageSource(input: FormDataEntryValue | null): ImageSource | null {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = input.trim();
  if (normalized === "web" || normalized === "typora" || normalized === "cli" || normalized === "api" || normalized === "migration") {
    return normalized;
  }
  return null;
}

function mapImageRow(row: Record<string, unknown>): ImageRecord {
  return {
    altText: row.alt_text as string | null,
    createdAt: row.created_at as string,
    defaultVariant: row.default_variant as ImageRecord["defaultVariant"],
    deletedAt: row.deleted_at as string | null,
    displayName: row.display_name as string,
    hash: row.hash as string,
    height: row.height as number,
    id: row.id as string,
    originalExt: row.original_ext as string,
    originalMime: row.original_mime as string,
    ownerUserId: row.owner_user_id as string,
    sizeBytes: row.size_bytes as number,
    source: row.source as ImageSource,
    variants: [],
    width: row.width as number,
  };
}

function requireAuth(c: AppContext) {
  const db = c.get("db");
  const env = c.get("env");
  const auth = resolveAuthContext(db, env.tokenSecret, c.req.header("authorization"));
  c.set("auth", auth);
  if (!auth) {
    return {
      ok: false as const,
      response: jsonError(c, 401, "AUTH_INVALID_TOKEN", "Missing or invalid bearer token."),
    };
  }
  return { ok: true as const, context: auth };
}

function jsonError(
  c: AppContext,
  status: 400 | 401 | 403 | 404 | 413 | 415 | 429 | 500,
  code: ApiErrorCode,
  message: string,
) {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
  return c.json(body, status);
}

function writeAuditLog(
  db: Database.Database,
  input: {
    action: string;
    actorUserId: string | null;
    ip: string | null;
    metadata: Record<string, unknown> | null;
    targetId: string;
    targetType: string;
    tokenId: string | null;
    userAgent: string | null;
  },
) {
  db.prepare(
    `
      INSERT INTO audit_logs (
        id, actor_user_id, token_id, action, target_type, target_id, ip, user_agent, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    `audit_${nanoid(12)}`,
    input.actorUserId,
    input.tokenId,
    input.action,
    input.targetType,
    input.targetId,
    input.ip,
    input.userAgent,
    input.metadata ? JSON.stringify(input.metadata) : null,
    new Date().toISOString(),
  );
}

function readClientIp(forwardedFor: string | undefined, realIp: string | undefined) {
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return realIp ?? null;
}

function checkRateLimit(c: AppContext, limiter: InMemoryRateLimiter, bucket: string, max: number) {
  const ip = readClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")) ?? "unknown";
  const windowMs = c.get("env").rateLimitWindowMs;
  const result = limiter.check(`${bucket}:${ip}`, { max, windowMs });
  c.header("x-ratelimit-limit", String(max));
  c.header("x-ratelimit-remaining", String(result.remaining));
  c.header("x-ratelimit-reset", String(result.resetAt));

  if (!result.allowed) {
    const retryAfterSec = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
    c.header("retry-after", String(retryAfterSec));
    return jsonError(c, 429, "RATE_LIMITED", "Too many requests. Please retry later.");
  }

  return null;
}

function isTokenScope(scope: string): scope is TokenScope {
  return TOKEN_SCOPE_VALUES.includes(scope as TokenScope);
}

function normalizeScopes(raw: unknown): TokenScope[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const scopes = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item): item is TokenScope => isTokenScope(item));

  return [...new Set(scopes)];
}

function parseOptionalIsoDate(input: unknown) {
  if (input === undefined || input === null || input === "") {
    return null;
  }
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) {
    return null;
  }
  return new Date(ts).toISOString();
}

async function readJson(c: AppContext): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

async function cleanupStoredFiles(env: AppEnv, relativePaths: string[]) {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      const fullPath = path.resolve(env.imageRoot, relativePath);
      if (!fullPath.startsWith(path.resolve(env.imageRoot))) {
        return;
      }
      await rm(fullPath, { force: true });
    }),
  );
}
