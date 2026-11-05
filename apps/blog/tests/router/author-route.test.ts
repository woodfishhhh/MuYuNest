import { describe, expect, it } from "vite-plus/test";

import {
  AUTHOR_SCREEN_COUNT,
  getAuthorRoutePath,
  isAuthorRoutePath,
  isValidAuthorPageParam,
  resolveAuthorPage,
} from "@/utils/author-route";

describe("author page routing", () => {
  it("accepts every author screen as a valid page parameter", () => {
    expect(AUTHOR_SCREEN_COUNT).toBe(4);
    expect(isValidAuthorPageParam("1")).toBe(true);
    expect(isValidAuthorPageParam("4")).toBe(true);
    expect(isValidAuthorPageParam("0")).toBe(false);
    expect(isValidAuthorPageParam("5")).toBe(false);
    expect(isValidAuthorPageParam("two")).toBe(false);
  });

  it("normalizes missing or invalid values to the first screen", () => {
    expect(resolveAuthorPage(undefined)).toBe(1);
    expect(resolveAuthorPage("2")).toBe(2);
    expect(resolveAuthorPage(["3"])).toBe(3);
    expect(resolveAuthorPage("9")).toBe(1);
  });

  it("supports canonical and short author URLs while preserving the URL family", () => {
    expect(isAuthorRoutePath("/author")).toBe(true);
    expect(isAuthorRoutePath("/author/2")).toBe(true);
    expect(isAuthorRoutePath("/2")).toBe(true);
    expect(isAuthorRoutePath("/author/9")).toBe(false);
    expect(getAuthorRoutePath(2)).toBe("/author/2");
    expect(getAuthorRoutePath(3, "/author/1")).toBe("/author/3");
    expect(getAuthorRoutePath(4, "/2")).toBe("/4");
  });
});
