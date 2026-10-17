import DOMPurify from "isomorphic-dompurify";

const safeColor = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d.,%\s]+\)|[a-z]+)$/i;
const safeDimension = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:ex|em|rem|px|%)?$/;

/** Only renderer-owned fragments may retain SVG/MathML and presentation styles. */
export function sanitizeRenderedFragment(html: string): string {
  const root = DOMPurify.sanitize(html, {
    RETURN_DOM: true,
    ALLOWED_TAGS: [
      "pre",
      "code",
      "span",
      "div",
      "mjx-container",
      "mjx-assistive-mml",
      "svg",
      "g",
      "path",
      "defs",
      "use",
      "rect",
      "line",
      "polygon",
      "polyline",
      "text",
      "tspan",
      "math",
      "mrow",
      "mi",
      "mo",
      "mn",
      "mtext",
      "mfrac",
      "msqrt",
      "mroot",
      "msub",
      "msup",
      "msubsup",
      "munder",
      "mover",
      "munderover",
      "mtable",
      "mtr",
      "mtd",
      "mspace",
      "mpadded",
      "mstyle",
      "menclose",
      "mmultiscripts",
      "mprescripts",
      "none",
      "semantics",
      "annotation",
    ],
    ALLOWED_ATTR: [
      "class",
      "style",
      "data-language",
      "title",
      "role",
      "aria-hidden",
      "aria-label",
      "focusable",
      "xmlns",
      "width",
      "height",
      "viewBox",
      "preserveAspectRatio",
      "x",
      "y",
      "x1",
      "x2",
      "y1",
      "y2",
      "d",
      "points",
      "fill",
      "stroke",
      "stroke-width",
      "transform",
      "font-size",
      "font-family",
      "text-anchor",
      "display",
      "mathvariant",
      "mathsize",
      "stretchy",
      "fence",
      "separator",
      "accent",
      "accentunder",
      "columnalign",
      "rowspacing",
      "columnspacing",
      "rowalign",
      "lspace",
      "rspace",
      "encoding",
    ],
    ALLOW_DATA_ATTR: false,
  }) as HTMLElement;
  for (const node of root.querySelectorAll("*")) {
    if (node.hasAttribute("class")) {
      node.setAttribute(
        "class",
        node
          .getAttribute("class")!
          .split(/\s+/)
          .filter((name) =>
            /^(?:MathJax|shiki|shiki-themes|github-light|github-dark|line|render-math(?:--block|-error)?|language-[\w+#.-]+)$/.test(
              name,
            ),
          )
          .join(" "),
      );
    }
    for (const name of ["fill", "stroke"]) {
      const value = node.getAttribute(name);
      if (value && !safeColor.test(value)) node.removeAttribute(name);
    }
    const style = node.getAttribute("style");
    if (!style) continue;
    const allowed = style.split(";").flatMap((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 0) return [];
      const key = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      if (
        /^(?:color|background-color|fill|stroke|--shiki-(?:light|dark)(?:-bg)?)$/.test(
          key,
        ) &&
        safeColor.test(value)
      )
        return [`${key}:${value}`];
      if (
        /^(?:vertical-align|width|height|min-width|min-height|stroke-width|font-size)$/.test(
          key,
        ) &&
        safeDimension.test(value)
      )
        return [`${key}:${value}`];
      if (
        /^(?:(?:--shiki-(?:light|dark)-)?font-(?:style|weight)|(?:--shiki-(?:light|dark)-)?text-decoration)$/.test(
          key,
        ) &&
        /^(?:normal|italic|bold|none|underline|line-through|[1-9]00)$/.test(
          value,
        )
      )
        return [`${key}:${value}`];
      return [];
    });
    if (allowed.length) node.setAttribute("style", allowed.join(";"));
    else node.removeAttribute("style");
  }
  return root.innerHTML;
}

export function sanitizeArticleHtml(rawHtml: string) {
  // ─────────────────────────────────────────────────────────────────────────────
  // XSS 防护：构建时用 DOMPurify 消毒生成的 HTML
  //
  // DOMPurify 配置说明：
  //   ALLOWED_TAGS:  允许的 HTML 标签黑名单之外的标签会被删除
  //   ALLOWED_ATTR:  允许的 HTML 属性黑名单之外的属性会被移除
  //   ALLOW_DATA_ATTR: 允许 data-* 自定义属性（常用于组件库）
  //
  // 这样即使 Markdown 里有人埋了 <script> 或 <img onerror=...>
  // 也会在构建时被清除，不会进入最终产物的 JSON 文件。
  // ─────────────────────────────────────────────────────────────────────────────
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "strong",
      "em",
      "del",
      "s",
      "mark",
      "sup",
      "sub",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "div",
      "span",
      "details",
      "summary",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "class",
      "id",
      "loading",
      "decoding",
      "target",
      "rel",
      "width",
      "height",
      "colspan",
      "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
