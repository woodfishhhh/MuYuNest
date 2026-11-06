import type { FriendLinkData } from "@/types/content";
import { normalizeContentPayload } from "./content-url-normalizer";

let friendLinksPromise: Promise<FriendLinkData[]> | null = null;

export async function loadFriendLinks() {
  if (!friendLinksPromise) {
    friendLinksPromise = import("../../../blog/src/generated/friends.json").then((module) =>
      normalizeContentPayload(module.default as FriendLinkData[]),
    );
  }

  return friendLinksPromise;
}
