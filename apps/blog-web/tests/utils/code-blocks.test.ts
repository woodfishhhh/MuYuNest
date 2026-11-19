import { describe, expect, it, vi, afterEach } from "vitest";
import { enhanceCodeBlocks } from "@/utils/code-blocks";
afterEach(() => vi.restoreAllMocks());
describe("code blocks", () => {
  it("copies the unmodified code, keeps highlighted tokens and does not duplicate toolbars", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const root = document.createElement("div");
    root.innerHTML =
      '<pre><code class="hljs language-js"><span class="hljs-keyword">const</span> n = 1;\n</code></pre>';
    const dispose = enhanceCodeBlocks(root);
    enhanceCodeBlocks(root);
    expect(root.querySelectorAll(".docs-code-toolbar")).toHaveLength(1);
    root.querySelector("button")!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("const n = 1;\n");
    expect(root.querySelector("button")!.textContent).toBe("已复制");
    expect(root.querySelector(".hljs-keyword")!.textContent).toBe("const");
    dispose();
    expect(root.querySelector(".docs-code-toolbar")).toBeNull();
  });
  it("uses text for an unknown language and explains clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const root = document.createElement("div");
    root.innerHTML = "<pre><code>plain</code></pre>";
    const dispose = enhanceCodeBlocks(root);
    expect(root.querySelector(".docs-code-toolbar span")!.textContent).toBe("text");
    root.querySelector("button")!.click();
    await Promise.resolve();
    expect(root.querySelector('[role="status"]')!.textContent).toContain("请手动选择");
    dispose();
  });
});
