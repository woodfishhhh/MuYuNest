import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useVisitorCount } from "@/composables/useVisitorCount";

describe("useVisitorCount", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    window.localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts a first visit, stores the marker, and exposes the returned total", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ total: 12, counted: true }),
    });

    const visitorCount = useVisitorCount();

    await visitorCount.hydrate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const id = window.localStorage.getItem("vuecubeblog:visitor-id:v1");
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(fetchMock).toHaveBeenCalledWith("/api/visitor-count/visit", {
      method: "POST", headers: { "X-Visitor-ID": id, "X-Visitor-Counted": "0" },
    });
    expect(window.localStorage.getItem("vuecubeblog:visitor-registered:v2")).toBe(id);
    expect(window.localStorage.getItem("vuecubeblog:visitor-counted:v1")).toBe("1");
    expect(visitorCount.total.value).toBe(12);
    expect(visitorCount.hasError.value).toBe(false);
    expect(visitorCount.isLoading.value).toBe(false);
  });

  it("reads the current total without posting when the browser is already counted", async () => {
    window.localStorage.setItem("vuecubeblog:visitor-id:v1", "a".repeat(32));
    window.localStorage.setItem("vuecubeblog:visitor-registered:v2", "a".repeat(32));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ total: 44 }),
    });

    const visitorCount = useVisitorCount();

    await visitorCount.hydrate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/visitor-count", undefined);
    expect(visitorCount.total.value).toBe(44);
    expect(visitorCount.hasError.value).toBe(false);
  });

  it("falls back to read-only mode when storage access throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked get");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked set");
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ total: 6 }),
    });

    const visitorCount = useVisitorCount();

    await expect(visitorCount.hydrate()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/visitor-count", undefined);
    expect(setSpy).not.toHaveBeenCalled();
    expect(visitorCount.total.value).toBe(6);
    expect(visitorCount.hasError.value).toBe(false);
  });

  it("registers the old counted marker without counting it again", async () => {
    window.localStorage.setItem("vuecubeblog:visitor-counted:v1", "1");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ total: 44, counted: false }) });
    await useVisitorCount().hydrate();
    expect(fetchMock).toHaveBeenCalledWith("/api/visitor-count/visit", {
      method: "POST", headers: { "X-Visitor-ID": expect.any(String), "X-Visitor-Counted": "1" },
    });
  });

  it("shares an in-flight request and reuses its ID when retrying a failed response", async () => {
    let reject!: (error: Error) => void;
    fetchMock.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const first = useVisitorCount().hydrate();
    const second = useVisitorCount().hydrate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const id = window.localStorage.getItem("vuecubeblog:visitor-id:v1");
    reject(new Error("response lost after server committed"));
    await Promise.all([first, second]);
    expect(window.localStorage.getItem("vuecubeblog:visitor-registered:v2")).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ total: 12, counted: false }) });
    await useVisitorCount().hydrate();
    expect(fetchMock.mock.calls[1][1].headers["X-Visitor-ID"]).toBe(id);
    expect(window.localStorage.getItem("vuecubeblog:visitor-registered:v2")).toBe(id);
  });

  it("re-reads shared storage after obtaining the cross-tab lock", async () => {
    const id = "b".repeat(32);
    const request = vi.fn(async (_name: string, work: () => Promise<void>) => {
      window.localStorage.setItem("vuecubeblog:visitor-id:v1", id);
      window.localStorage.setItem("vuecubeblog:visitor-registered:v2", id);
      return work();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ total: 12 }) });
    try {
      await useVisitorCount().hydrate();
      expect(request).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith("/api/visitor-count", undefined);
    } finally { vi.unstubAllGlobals(); }
  });

  it("marks an error state when the api request fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ total: 0 }),
    });

    const visitorCount = useVisitorCount();

    await expect(visitorCount.hydrate()).resolves.toBeUndefined();

    expect(visitorCount.total.value).toBe(null);
    expect(visitorCount.hasError.value).toBe(true);
    expect(visitorCount.isLoading.value).toBe(false);
  });
});
