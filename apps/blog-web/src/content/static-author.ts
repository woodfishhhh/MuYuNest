import type { AuthorProfileData } from "@/types/content";
import { normalizeContentPayload } from "./content-url-normalizer";

let authorProfilePromise: Promise<AuthorProfileData> | null = null;

export async function loadAuthorProfile() {
  if (!authorProfilePromise) {
    authorProfilePromise = import("../../../blog/src/generated/author.json").then((module) =>
      normalizeContentPayload(module.default as AuthorProfileData),
    );
  }

  return authorProfilePromise;
}
