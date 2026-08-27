import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FriendLinkStatusDocument {
  offline: string[];
}

export function getFriendLinkStatusPath(linkPath: string) {
  return path.join(path.dirname(linkPath), "friend-link-status.json");
}

export async function readFriendLinkStatus(statusPath: string) {
  try {
    const raw = await readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<FriendLinkStatusDocument>;
    const offline = Array.isArray(parsed.offline) ? parsed.offline : [];

    return new Set(
      offline
        .filter((value): value is string => typeof value === "string")
        .map(normalizeFriendLinkUrl)
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

export function serializeFriendLinkStatus(offlineLinks: Iterable<string>) {
  const offline = [...new Set([...offlineLinks].map(normalizeFriendLinkUrl).filter(Boolean))].sort();
  return `${JSON.stringify({ offline } satisfies FriendLinkStatusDocument, null, 2)}\n`;
}

export async function writeFriendLinkStatus(statusPath: string, offlineLinks: Iterable<string>) {
  await writeFile(statusPath, serializeFriendLinkStatus(offlineLinks), "utf8");
}

export function normalizeFriendLinkUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}
