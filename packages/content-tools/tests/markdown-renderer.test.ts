import { describe, expect, it } from "vitest";
import { renderArticleMarkdown } from "../src/content/markdown-renderer.js";
import {
  sanitizeArticleHtml,
  sanitizeRenderedFragment,
} from "../src/content/render-sanitizer.js";

describe("article Markdown renderer", () => {
  it("renders the reported sentence with inline math inside Chinese emphasis", async () => {
    const result = await renderArticleMarkdown(
      String.raw`$\theta$为**等号$=$**的连接，即筛选$A=B$的元组，**保留重复属性列**。`,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.html.match(/<mjx-container/g)).toHaveLength(3);
    expect(result.html).toContain("<strong>等号<span");
    expect(result.html).toContain("<strong>保留重复属性列</strong>");
    expect(result.html).toContain("<mi>θ</mi>");
    expect(result.html).toContain("<path");
    expect(result.html).not.toContain("**");
    expect(result.html).not.toContain("\\theta");
    expect(result.html).not.toContain("render-000");
  });

  it("supports display math, fractions, matrices, relational algebra and Chinese subscripts", async () => {
    const source = [
      String.raw`$$\frac{a_1+b^2}{\sqrt{x}}$$`,
      String.raw`$$\begin{pmatrix}1&2\\3&4\end{pmatrix}$$`,
      String.raw`$R \bowtie_{左} S$`,
    ].join("\n\n");
    const result = await renderArticleMarkdown(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.html.match(/render-math--block/g)).toHaveLength(2);
    expect(result.html).toContain("<mfrac>");
    expect(result.html).toContain("左");
    expect(result.html).toContain("vertical-align:");
  });

  it("preserves legacy heading anchors while providing rendered formula labels", async () => {
    const result = await renderArticleMarkdown(
      "## 普通标题\n\n## 连接：$R \\bowtie S$\n\n## 普通标题",
    );
    expect(result.toc[0]).toEqual({
      id: "普通标题",
      level: 2,
      text: "普通标题",
    });
    expect(result.toc[2].id).toBe("普通标题-1");
    expect(result.toc[1].text).toBe("连接：$R \\bowtie S$");
    expect(result.toc[1].html).toContain("<svg");
    expect(result.html).toContain(`id="${result.toc[1].id}"`);
  });

  it.each([
    ["vue", "<template>{{ value }}</template>"],
    ["js", "const value = 1;"],
    ["ts", "const value: number = 1;"],
    ["Go", "package main"],
    ["sql", "SELECT * FROM users;"],
    ["not-a-language", "plain <text> $x$"],
  ])(
    "highlights %s without altering code text or parsing its dollars",
    async (language, code) => {
      const result = await renderArticleMarkdown(
        `\`\`\`${language}\n${code}\n\`\`\``,
      );
      expect(result.html).toContain('class="shiki');
      expect(result.html).toContain(`data-language="${language}"`);
      expect(result.html).toContain("--shiki-light:");
      expect(result.html).toContain("--shiki-dark:");
      expect(result.html).not.toContain("<mjx-container");
      if (language === "not-a-language")
        expect(result.html).toContain("plain &lt;text&gt; $x$");
    },
  );

  it("keeps escaped dollars, prices and inline code literal", async () => {
    const result = await renderArticleMarkdown(
      "价格 $20,000 和 $30,000。\n\n转义 \\$x\\$。\n\n代码 `$x$`。",
    );
    expect(result.html).not.toContain("<mjx-container");
    expect(result.html).toContain("$20,000");
    expect(result.html).toContain("<code>$x$</code>");
  });

  it("reports invalid formulas with source locations and keeps readable originals", async () => {
    const result = await renderArticleMarkdown(
      "正常\n\n$\\unknownCommand{a}$\n\n$\\frac{a}{$",
      { sourceFile: "sample.md", slug: "sample", lineOffset: 5 },
    );
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].message).toContain(
      "Undefined control sequence",
    );
    expect(result.diagnostics[0]).toMatchObject({
      sourceFile: "sample.md",
      slug: "sample",
      line: 8,
    });
    expect(result.html).toContain("\\unknownCommand{a}");
    expect(result.html).toContain("render-math-error");
  });

  it("does not grant authored HTML the renderer's SVG or style privileges", async () => {
    const result = await renderArticleMarkdown(
      '<script>alert(1)</script><svg onload="alert(1)"><path d="M0 0" /></svg><span style="position:fixed" onclick="alert(1)">safe</span>\n\n$x$',
    );
    expect(result.html).not.toMatch(/<script|onload|onclick|position:fixed/);
    expect(result.html.match(/<svg/g)).toHaveLength(1);
    expect(sanitizeArticleHtml("<svg><path /></svg>")).not.toContain("<svg");
    const hostileFragment = sanitizeRenderedFragment(
      '<svg><foreignObject><script>alert(1)</script></foreignObject><image href="https://bad.test/a"/><path fill="url(https://bad.test/x)" onclick="alert(1)"/></svg><span style="--shiki-dark:url(https://bad.test/x);position:fixed;color:#fff">x</span>',
    );
    expect(hostileFragment).not.toMatch(
      /bad\.test|foreignObject|<script|onclick|position:fixed|<image/,
    );
    expect(hostileFragment).toContain("color:#fff");
  });
});
