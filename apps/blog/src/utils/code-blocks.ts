/** Enhance generated code without changing the Markdown or its text content. */
export function enhanceCodeBlocks(root: HTMLElement) {
  const cleanups: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code || pre.querySelector(".docs-code-toolbar")) return;
    const toolbar = document.createElement("div");
    toolbar.className = "docs-code-toolbar";
    const language = document.createElement("span");
    language.textContent =
      pre.dataset.language || [...code.classList].find((name) => name.startsWith("language-"))?.slice(9) || "text";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "复制代码";
    button.setAttribute("aria-label", `复制 ${language.textContent} 代码`);
    const status = document.createElement("span");
    status.className = "docs-copy-status";
    status.setAttribute("role", "status");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        if (disposed) return;
        button.textContent = "已复制";
        status.textContent = "代码已复制";
      } catch {
        if (disposed) return;
        button.textContent = "复制失败";
        status.textContent = "无法访问剪贴板，请手动选择代码复制";
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = "复制代码";
        status.textContent = "";
      }, 2400);
    };
    button.addEventListener("click", copy);
    toolbar.append(language, status, button);
    pre.prepend(toolbar);
    cleanups.push(() => {
      disposed = true;
      clearTimeout(timer);
      button.removeEventListener("click", copy);
      toolbar.remove();
    });
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
