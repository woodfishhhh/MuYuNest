import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { hashToken } from "../src/auth";
import { createDatabaseContext } from "../src/db";
import type { AppEnv } from "../src/env";

let originalCwd = process.cwd();
const apiRoot = path.resolve(process.cwd());

beforeAll(() => {
  originalCwd = process.cwd();
  process.chdir(apiRoot);
});

afterAll(() => {
  process.chdir(originalCwd);
});

interface Fixture {
  cleanup: () => Promise<void>;
  db: Awaited<ReturnType<typeof createDatabaseContext>>["db"];
  env: AppEnv;
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

async function createFixture(
  options: {
    maxUploadMb?: number;
    rateLimitRegisterMax?: number;
    rateLimitUploadMax?: number;
  } = {},
): Promise<Fixture> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "muyu-api-"));
  const maxUploadMb = options.maxUploadMb ?? 5;
  const env: AppEnv = {
    imageRoot: path.join(tempRoot, "images"),
    maxUploadBytes: Math.floor(maxUploadMb * 1024 * 1024),
    nodeEnv: "test",
    port: 3900,
    rateLimitRegisterMax: options.rateLimitRegisterMax ?? 60,
    rateLimitUploadMax: options.rateLimitUploadMax ?? 120,
    rateLimitWindowMs: 60_000,
    publicBaseUrl: "https://img.woodfish.site",
    sharpConcurrency: 2,
    sqlitePath: path.join(tempRoot, "muyu.sqlite"),
    tokenSecret: "very-long-test-token-secret-value",
    webpQuality: 80,
  };
  const dbContext = await createDatabaseContext(env);
  const app = createApp({
    db: dbContext.db,
    env,
  });

  return {
    cleanup: async () => {
      dbContext.close();
      await rm(tempRoot, { force: true, recursive: true });
    },
    db: dbContext.db,
    env,
    request: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
  };
}

function seedToken(
  fixture: Fixture,
  options: {
    role: "admin" | "member";
    scopes: string[];
    revoked?: boolean;
    userId?: string;
  },
) {
  const userId = options.userId ?? `user_${Math.random().toString(36).slice(2, 10)}`;
  fixture.db
    .prepare(
      `
        INSERT INTO users (id, email, display_name, role, created_at, disabled_at, last_login_at)
        VALUES (?, NULL, ?, ?, ?, NULL, NULL)
      `,
    )
    .run(userId, `user-${userId}`, options.role, new Date().toISOString());

  const raw = `tok_${Math.random().toString(36).slice(2, 18)}`;
  fixture.db
    .prepare(
      `
        INSERT INTO tokens (id, user_id, name, token_hash, scopes, created_at, last_used_at, expires_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)
      `,
    )
    .run(
      `tok_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      "test-token",
      hashToken(raw, fixture.env.tokenSecret),
      JSON.stringify(options.scopes),
      new Date().toISOString(),
      options.revoked ? new Date().toISOString() : null,
    );

  return { raw, userId };
}

async function makeImageBuffer(mime: "png" | "jpeg" | "webp" | "gif") {
  if (mime === "gif") {
    return Buffer.from(
      "R0lGODlhAQABAIABAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICRAEAOw==",
      "base64",
    );
  }

  const base = sharp({
    create: {
      background: "#22aaff",
      channels: 3,
      height: 64,
      width: 96,
    },
  });

  if (mime === "png") {
    return base.png().toBuffer();
  }
  if (mime === "webp") {
    return base.webp().toBuffer();
  }
  return base.jpeg().toBuffer();
}

async function uploadOne(
  fixture: Fixture,
  token: string | null,
  file: { bytes: Buffer; name: string; type: string },
) {
  const formData = new FormData();
  formData.set("file", new File([file.bytes], file.name, { type: file.type }));
  return fixture.request("http://local/api/upload", {
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    method: "POST",
  });
}

describe("image-bed-api", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  });

  it("health route succeeds", async () => {
    const revision = "a".repeat(40);
    vi.stubEnv("MUYU_RELEASE_SHA", revision);
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);

    const response = await fixture.request("http://local/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ service: "ok", db: "ok", revision });
  });

  it("upload requires a valid token and rejects revoked tokens", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const member = seedToken(fixture, { role: "member", scopes: ["upload"] });
    const revoked = seedToken(fixture, { role: "member", scopes: ["upload"], revoked: true });

    const png = await makeImageBuffer("png");

    const noToken = await uploadOne(fixture, null, {
      bytes: png,
      name: "a.png",
      type: "image/png",
    });
    expect(noToken.status).toBe(401);

    const invalid = await uploadOne(fixture, "invalid-token", {
      bytes: png,
      name: "a.png",
      type: "image/png",
    });
    expect(invalid.status).toBe(401);

    const revokedResp = await uploadOne(fixture, revoked.raw, {
      bytes: png,
      name: "a.png",
      type: "image/png",
    });
    expect(revokedResp.status).toBe(401);

    const okResp = await uploadOne(fixture, member.raw, {
      bytes: png,
      name: "a.png",
      type: "image/png",
    });
    expect(okResp.status).toBe(201);
  });

  it("enforces mime and size limits", async () => {
    const fixture = await createFixture({ maxUploadMb: 0.001 });
    cleanups.push(fixture.cleanup);
    const member = seedToken(fixture, { role: "member", scopes: ["upload"] });

    const bad = await uploadOne(fixture, member.raw, {
      bytes: Buffer.from("hello"),
      name: "a.txt",
      type: "text/plain",
    });
    expect(bad.status).toBe(415);

    const big = await uploadOne(fixture, member.raw, {
      bytes: Buffer.alloc(5000, 7),
      name: "big.bin",
      type: "application/octet-stream",
    });
    expect([413, 415]).toContain(big.status);
  });

  it("uploads png/jpg/webp and gif default url remains original", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const member = seedToken(fixture, {
      role: "member",
      scopes: ["upload", "images:read", "images:delete", "tokens:manage"],
    });

    for (const kind of ["png", "jpeg", "webp"] as const) {
      const buffer = await makeImageBuffer(kind);
      const response = await uploadOne(fixture, member.raw, {
        bytes: buffer,
        name: `ok.${kind === "jpeg" ? "jpg" : kind}`,
        type: `image/${kind}`,
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as { url: string; markdown: string; id: string };
      expect(body.url).toContain("/o/webp/");
      expect(body.markdown).toContain(body.url);
      const dbRow = fixture.db.prepare("SELECT id FROM images WHERE id = ?").get(body.id) as { id: string };
      expect(dbRow.id).toBe(body.id);
    }

    const gif = await makeImageBuffer("gif");
    const gifResp = await uploadOne(fixture, member.raw, {
      bytes: gif,
      name: "anim.gif",
      type: "image/gif",
    });
    expect(gifResp.status).toBe(201);
    const gifBody = (await gifResp.json()) as { defaultVariant: string; originalUrl: string; url: string };
    expect(gifBody.defaultVariant).toBe("original");
    expect(gifBody.url).toBe(gifBody.originalUrl);
  });

  it("lists, reads, and soft-deletes images with ownership checks", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const owner = seedToken(fixture, { role: "member", scopes: ["upload", "images:read", "images:delete"] });
    const outsider = seedToken(fixture, { role: "member", scopes: ["images:read"] });

    const png = await makeImageBuffer("png");
    const uploadResp = await uploadOne(fixture, owner.raw, {
      bytes: png,
      name: "owner.png",
      type: "image/png",
    });
    const uploadBody = (await uploadResp.json()) as { id: string };

    const listResp = await fixture.request("http://local/api/images", {
      headers: {
        Authorization: `Bearer ${owner.raw}`,
      },
    });
    expect(listResp.status).toBe(200);
    const listBody = (await listResp.json()) as { items: Array<{ id: string }> };
    expect(listBody.items.some((item) => item.id === uploadBody.id)).toBe(true);

    const forbiddenDetail = await fixture.request(`http://local/api/images/${uploadBody.id}`, {
      headers: {
        Authorization: `Bearer ${outsider.raw}`,
      },
    });
    expect(forbiddenDetail.status).toBe(403);

    const deleteResp = await fixture.request(`http://local/api/images/${uploadBody.id}`, {
      headers: {
        Authorization: `Bearer ${owner.raw}`,
      },
      method: "DELETE",
    });
    expect(deleteResp.status).toBe(200);

    const row = fixture.db
      .prepare("SELECT deleted_at FROM images WHERE id = ?")
      .get(uploadBody.id) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();

    const hiddenList = await fixture.request("http://local/api/images", {
      headers: {
        Authorization: `Bearer ${owner.raw}`,
      },
    });
    const hiddenBody = (await hiddenList.json()) as { items: Array<{ id: string }> };
    expect(hiddenBody.items.some((item) => item.id === uploadBody.id)).toBe(false);
  });

  it("writes files to image root", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const member = seedToken(fixture, { role: "member", scopes: ["upload"] });
    const png = await makeImageBuffer("png");

    const response = await uploadOne(fixture, member.raw, {
      bytes: png,
      name: "proof.png",
      type: "image/png",
    });
    const body = (await response.json()) as { originalUrl: string };
    const relativePath = body.originalUrl.split("/o/")[1];
    const fullPath = path.join(fixture.env.imageRoot, relativePath);
    const fileStat = await stat(fullPath);
    expect(fileStat.isFile()).toBe(true);
  });

  it("supports token lifecycle and me endpoint", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const admin = seedToken(fixture, { role: "admin", scopes: ["admin"] });

    const meResp = await fixture.request("http://local/api/me", {
      headers: {
        Authorization: `Bearer ${admin.raw}`,
      },
    });
    expect(meResp.status).toBe(200);
    const me = (await meResp.json()) as { id: string; role: string; displayName: string };
    expect(me.role).toBe("admin");
    expect(me.id.length).toBeGreaterThan(4);

    const createResp = await fixture.request("http://local/api/tokens", {
      body: JSON.stringify({
        name: "cli-uploader",
        scopes: ["upload", "images:read", "images:delete"],
      }),
      headers: {
        Authorization: `Bearer ${admin.raw}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(createResp.status).toBe(201);
    const created = (await createResp.json()) as { record: { id: string }; token: string };
    expect(created.token.startsWith("muyu_")).toBe(true);

    const listResp = await fixture.request("http://local/api/tokens", {
      headers: {
        Authorization: `Bearer ${admin.raw}`,
      },
    });
    expect(listResp.status).toBe(200);
    const listBody = (await listResp.json()) as { items: Array<{ id: string; revokedAt: string | null }> };
    expect(listBody.items.some((item) => item.id === created.record.id)).toBe(true);

    const revokeResp = await fixture.request(`http://local/api/tokens/${created.record.id}/revoke`, {
      headers: {
        Authorization: `Bearer ${admin.raw}`,
      },
      method: "POST",
    });
    expect(revokeResp.status).toBe(200);
  });

  it("supports invite register and disabled-user token invalidation", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const admin = seedToken(fixture, { role: "admin", scopes: ["admin"] });

    const inviteResp = await fixture.request("http://local/api/invites", {
      body: JSON.stringify({
        maxUses: 1,
      }),
      headers: {
        Authorization: `Bearer ${admin.raw}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(inviteResp.status).toBe(201);
    const inviteBody = (await inviteResp.json()) as { inviteCode: string };

    const registerResp = await fixture.request("http://local/api/register", {
      body: JSON.stringify({
        displayName: "Member One",
        inviteCode: inviteBody.inviteCode,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(registerResp.status).toBe(201);
    const registered = (await registerResp.json()) as { token: string; user: { id: string } };

    const uploadBuf = await makeImageBuffer("png");
    const okUpload = await uploadOne(fixture, registered.token, {
      bytes: uploadBuf,
      name: "from-member.png",
      type: "image/png",
    });
    expect(okUpload.status).toBe(201);

    const disableResp = await fixture.request(`http://local/api/users/${registered.user.id}/disable`, {
      headers: {
        Authorization: `Bearer ${admin.raw}`,
      },
      method: "POST",
    });
    expect(disableResp.status).toBe(200);

    const blockedUpload = await uploadOne(fixture, registered.token, {
      bytes: uploadBuf,
      name: "after-disable.png",
      type: "image/png",
    });
    expect(blockedUpload.status).toBe(401);
  });

  it("enforces upload rate limits", async () => {
    const fixture = await createFixture({ rateLimitUploadMax: 1 });
    cleanups.push(fixture.cleanup);
    const member = seedToken(fixture, { role: "member", scopes: ["upload"] });
    const png = await makeImageBuffer("png");

    const first = await uploadOne(fixture, member.raw, {
      bytes: png,
      name: "first.png",
      type: "image/png",
    });
    expect(first.status).toBe(201);

    const second = await uploadOne(fixture, member.raw, {
      bytes: png,
      name: "second.png",
      type: "image/png",
    });
    expect(second.status).toBe(429);
  });

  it("enforces invite exhaustion and invalid register", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const admin = seedToken(fixture, { role: "admin", scopes: ["admin"] });

    const inviteResp = await fixture.request("http://local/api/invites", {
      body: JSON.stringify({ maxUses: 1 }),
      headers: {
        Authorization: `Bearer ${admin.raw}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    const invite = (await inviteResp.json()) as { inviteCode: string };

    const first = await fixture.request("http://local/api/register", {
      body: JSON.stringify({
        displayName: "member-one",
        inviteCode: invite.inviteCode,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(first.status).toBe(201);

    const second = await fixture.request("http://local/api/register", {
      body: JSON.stringify({
        displayName: "member-two",
        inviteCode: invite.inviteCode,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(second.status).toBe(400);
    const secondBody = (await second.json()) as { error: { code: string } };
    expect(secondBody.error.code).toBe("INVITE_EXHAUSTED");

    const invalid = await fixture.request("http://local/api/register", {
      body: JSON.stringify({
        displayName: "member-three",
        inviteCode: "not-a-real-code",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(invalid.status).toBe(400);
  });

  it("blocks member from invite/user admin APIs and privileged token scopes", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const admin = seedToken(fixture, { role: "admin", scopes: ["admin"] });
    const member = seedToken(fixture, { role: "member", scopes: ["upload", "images:read", "images:delete"] });

    const inviteList = await fixture.request("http://local/api/invites", {
      headers: {
        Authorization: `Bearer ${member.raw}`,
      },
    });
    expect(inviteList.status).toBe(403);

    const usersList = await fixture.request("http://local/api/users", {
      headers: {
        Authorization: `Bearer ${member.raw}`,
      },
    });
    expect(usersList.status).toBe(403);

    const createPrivToken = await fixture.request("http://local/api/tokens", {
      body: JSON.stringify({
        name: "bad-priv",
        scopes: ["upload", "admin"],
      }),
      headers: {
        Authorization: `Bearer ${member.raw}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(createPrivToken.status).toBe(403);

    const inviteResp = await fixture.request("http://local/api/invites", {
      body: JSON.stringify({ maxUses: 1 }),
      headers: {
        Authorization: `Bearer ${admin.raw}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(inviteResp.status).toBe(201);
  });

  it("exports audit logs for admin only", async () => {
    const fixture = await createFixture();
    cleanups.push(fixture.cleanup);
    const admin = seedToken(fixture, { role: "admin", scopes: ["admin"] });
    const member = seedToken(fixture, { role: "member", scopes: ["upload"] });

    const png = await makeImageBuffer("png");
    await uploadOne(fixture, admin.raw, {
      bytes: png,
      name: "admin-proof.png",
      type: "image/png",
    });

    const adminLogs = await fixture.request("http://local/api/audit-logs?limit=10", {
      headers: {
        Authorization: `Bearer ${admin.raw}`,
      },
    });
    expect(adminLogs.status).toBe(200);
    const adminBody = (await adminLogs.json()) as { items: Array<{ action: string }> };
    expect(adminBody.items.some((item) => item.action === "image.upload")).toBe(true);

    const memberLogs = await fixture.request("http://local/api/audit-logs", {
      headers: {
        Authorization: `Bearer ${member.raw}`,
      },
    });
    expect(memberLogs.status).toBe(403);
  });
});
