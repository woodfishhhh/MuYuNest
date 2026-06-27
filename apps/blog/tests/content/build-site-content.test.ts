import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { buildSiteContent } from "../../../../packages/content-tools/src/content/build-site-content.js";

describe("build-site-content", () => {
  it("builds post index, article payloads, author data, and friend links from the legacy source project", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-build-"));
    const sourceRoot = path.join(tempRoot, "3Dblog");
    const myblogDir = path.join(sourceRoot, "content", "source", "myblog", "前端");
    const notesDir = path.join(sourceRoot, "content", "source", "myblog", "笔记");
    const legacyPostDir = path.join(sourceRoot, "content", "posts", "ajax-basics-intro");
    const aboutPath = path.join(
      sourceRoot,
      "content",
      "source",
      "blog",
      "source",
      "_data",
      "about.yml",
    );
    const linkPath = path.join(
      sourceRoot,
      "content",
      "source",
      "blog",
      "source",
      "_data",
      "link.yml",
    );
    const configPath = path.join(sourceRoot, "content", "source", "blog", "_config.yml");
    const publicDir = path.join(sourceRoot, "public", "asset");

    await mkdir(myblogDir, { recursive: true });
    await mkdir(notesDir, { recursive: true });
    await mkdir(legacyPostDir, { recursive: true });
    await mkdir(path.dirname(aboutPath), { recursive: true });
    await mkdir(path.dirname(linkPath), { recursive: true });
    await mkdir(path.dirname(configPath), { recursive: true });
    await mkdir(publicDir, { recursive: true });

    const remoteAvatarBytes = Buffer.from("friend-avatar-binary");
    const avatarServer = createServer((req, res) => {
      if (req.url?.startsWith("/friend-avatar.png")) {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(remoteAvatarBytes);
        return;
      }

      res.writeHead(404);
      res.end("not-found");
    });

    await new Promise<void>((resolve) => {
      avatarServer.listen(0, "127.0.0.1", () => resolve());
    });

    const serverAddress = avatarServer.address();
    const avatarPort = typeof serverAddress === "object" && serverAddress ? serverAddress.port : 0;
    const remoteAvatarUrl = `http://127.0.0.1:${avatarPort}/friend-avatar.png`;

    const rawMarkdown = [
      "---",
      'title: "AJAX 基础入门教程"',
      "date: 2025-12-20 12:00:04",
      'type: "Tutorial"',
      "tags:",
      '  - "AJAX基础"',
      '  - "axios"',
      "categories:",
      '  - "前端开发"',
      "---",
      "",
      "# AJAX 基础入门教程",
      "",
      "[TOC]",
      "",
      "---",
      "",
      "| 字段 | 说明 |",
      "| --- | --- |",
      "| title | AJAX |",
      "",
      "这是文章摘要第一段。",
      "",
      "这里补充一段更完整的正文内容，用来验证阅读时长会被正确估算，而不是遗漏掉文章正文元信息。",
      "",
      "## 核心概念",
      "",
      "AJAX 让浏览器可以在不刷新整个页面的情况下与服务端交换数据，因此前端体验会更流畅。",
      "",
      "理解请求生命周期、响应处理以及错误兜底，是写好异步界面的基础能力。",
      "",
      "![Local](/asset/image.png)",
      "",
      "```js",
      "console.log('demo')",
      "```",
    ].join("\n");

    const notesMarkdown = [
      "---",
      'title: "Node 观测性随记"',
      "date: 2025-12-18 08:30:00",
      "tags:",
      '  - "Node.js"',
      '  - "日志"',
      "categories:",
      '  - "工程化"',
      "---",
      "",
      "# Node 观测性随记",
      "",
      "记录日志、指标、追踪三件套，是排查线上问题时最先要补齐的观测性地基。",
      "",
      "## 为什么要有观测性",
      "",
      "如果没有统一的日志和追踪链路，定位生产问题时就只能靠猜。",
    ].join("\n");

    await writeFile(path.join(myblogDir, "AJAX 基础入门教程.md"), rawMarkdown);
    await writeFile(path.join(notesDir, "Node 观测性随记.md"), notesMarkdown);
    await writeFile(path.join(legacyPostDir, "index.md"), rawMarkdown);
    await writeFile(path.join(publicDir, "image.png"), "asset-image");
    await writeFile(
      aboutPath,
      [
        "contentinfo:",
        "  name: 木鱼",
        "  title: 学生 / 创作者",
        "hero:",
        "  image: /asset/image.png",
        "poem:",
        "  title: 卜算子·勤",
        "  author: 木鱼",
        "  lines:",
        "    - 志坚勤为本，莫凭苦中鸣。",
        "    - 夜以继日工作辛，汗水洒衣襟。",
        "skills:",
        "  tags:",
        "    - title: Vue",
        "      color: '#42b883'",
        "      img: /asset/image.png",
        "      officialUrl: https://vuejs.org/",
        "contacts:",
        "  github: https://github.com/woodfishhhh",
        "oneself:",
        "  location: 中国，南昌市",
        "  birthDate: 2006.6.2",
        "  university: 江西财经大学",
        "  major: 计算机科学与技术",
        "tenyear:",
        "  tips: 进度",
        "  title: 大学阶段进度条",
        "  text: 保持热爱，慢慢变强。",
        "  start: '2024-09-01'",
        "  end: '2028-06-30'",
      ].join("\n"),
    );
    try {
      await writeFile(
        linkPath,
        [
          "links:",
          "  - class_name: 友情链接",
          "    link_list:",
          "      - name: Fomalhaut",
          "        link: https://fomal.cc/",
          `        avatar: ${remoteAvatarUrl}`,
          "        descr: 我的博客从这里学的",
        ].join("\n"),
      );
      await writeFile(configPath, "author: woodfish\nsubtitle: HOLA,this is woodfish!\n");

      const targetPublicDir = path.join(tempRoot, "generated-public");
      const result = await buildSiteContent({
        sourceProjectRoot: sourceRoot,
        targetPublicDir,
        siteBasePath: "/newBlog/",
      });

      const ajaxEntry = result.postIndex.find((entry) => entry.title === "AJAX 基础入门教程");
      const notesEntry = result.postIndex.find((entry) => entry.title === "Node 观测性随记");

      expect(result.postIndex).toHaveLength(2);
      expect(ajaxEntry?.canonicalSlug).toBe("ajax-basics-intro");
      expect(ajaxEntry?.aliases).toContain("AJAX 基础入门教程");
      expect(ajaxEntry?.readingMinutes).toBeGreaterThan(0);
      expect(ajaxEntry?.type).toBe("Tutorial");
      expect(ajaxEntry?.excerpt).toBe("这是文章摘要第一段。");
      expect(ajaxEntry?.searchText).toContain("AJAX");
      expect(ajaxEntry?.searchText).toContain("请求生命周期");
      expect(notesEntry?.type).toBe("Notes");
      expect(notesEntry?.searchText).toContain("观测性");
      expect(result.postsBySlug["ajax-basics-intro"]?.html).toContain('id="核心概念"');
      expect(result.postsBySlug["ajax-basics-intro"]?.coverImage).toBeNull();
      expect(result.postsBySlug["ajax-basics-intro"]?.toc).toEqual([
        {
          id: "核心概念",
          level: 2,
          text: "核心概念",
        },
      ]);
      expect(result.author.name).toBe("木鱼");
      expect(result.author.postsCount).toBe(2);
      expect(result.author.heroImage).toBe("/newBlog/asset/image.png");
      expect(result.author.skills[0]).toMatchObject({
        title: "Vue",
        officialUrl: "https://vuejs.org/",
      });
      expect(result.author.poem.title).toBe("卜算子·勤");
      expect(result.author.poem.lines).toHaveLength(2);
      expect(result.author.contacts.github).toBe("https://github.com/woodfishhhh");
      expect(result.author.oneself.birthDate).toBe("2006.6.2");
      expect(result.author.tenyear.title).toBe("大学阶段进度条");
      expect(result.author.tenyear.end).toBe("2028-06-30");
      expect("avatar" in result.author).toBe(false);
      expect(result.friendLinks[0]?.name).toBe("Fomalhaut");
      expect(result.friendLinks[0]?.avatar).toMatch(
        /^\/newBlog\/remote-assets\/[a-f0-9]{40}\.[a-z0-9]+$/,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        avatarServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("uses the rendered heading tokens for toc ids and text", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-build-heading-"));
    const sourceRoot = path.join(tempRoot, "3Dblog");
    const myblogDir = path.join(sourceRoot, "content", "source", "myblog", "前端");
    const markdownPath = path.join(myblogDir, "Heading Token Test.md");

    await mkdir(myblogDir, { recursive: true });
    await writeFile(
      markdownPath,
      [
        "---",
        'title: "Heading Token Test"',
        "date: 2026-05-13 12:00:00",
        "---",
        "",
        "## <span>Promise.all</span> & [Vue](https://vuejs.org/) **渲染**",
        "",
        "正文。",
      ].join("\n"),
    );

    const result = await buildSiteContent({
      sourceProjectRoot: sourceRoot,
      targetPublicDir: path.join(tempRoot, "generated-public"),
    });
    const article = Object.values(result.postsBySlug)[0];
    const renderedHeadingId = article?.html.match(/<h2 id="([^"]+)">/)?.[1];

    expect(article?.toc).toEqual([
      {
        id: renderedHeadingId,
        level: 2,
        text: "Promise.all & Vue 渲染",
      },
    ]);
    expect(renderedHeadingId).toBeTruthy();
    expect(article?.html).toContain(`<h2 id="${renderedHeadingId}">`);
  });

  it("keeps building when generated article images need placeholders", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-build-missing-image-"));
    const sourceRoot = path.join(tempRoot, "3Dblog");
    const myblogDir = path.join(sourceRoot, "content", "source", "myblog", "前端");
    const targetPublicDir = path.join(tempRoot, "generated-public");

    await mkdir(myblogDir, { recursive: true });
    await writeFile(
      path.join(myblogDir, "Broken Image.md"),
      [
        "---",
        'title: "Broken Image"',
        "date: 2026-05-13 12:00:00",
        "---",
        "",
        "![missing](./assets/missing.png)",
      ].join("\n"),
    );

    const result = await buildSiteContent({
      sourceProjectRoot: sourceRoot,
      targetPublicDir,
    });
    const article = Object.values(result.postsBySlug)[0];
    const match = article?.html.match(/src="\/imported-assets\/([a-f0-9]{40}\.svg)"/);

    expect(match).not.toBeNull();
    expect(
      await readFile(path.join(targetPublicDir, "imported-assets", match![1]), "utf8"),
    ).toContain("Image unavailable");
  });

  it("localizes root-relative content image references", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-build-content-image-"));
    const sourceRoot = path.join(tempRoot, "3Dblog");
    const myblogDir = path.join(sourceRoot, "content", "source", "myblog", "前端");
    const assetDir = path.join(sourceRoot, "content", "source", "myblog", "assets");
    const targetPublicDir = path.join(tempRoot, "generated-public");

    await mkdir(myblogDir, { recursive: true });
    await mkdir(assetDir, { recursive: true });
    await writeFile(path.join(assetDir, "diagram.png"), "diagram-bytes");
    await writeFile(
      path.join(myblogDir, "Content Image.md"),
      [
        "---",
        'title: "Content Image"',
        "date: 2026-05-13 12:00:00",
        "---",
        "",
        "![diagram](/content/source/myblog/assets/diagram.png)",
      ].join("\n"),
    );

    const result = await buildSiteContent({
      sourceProjectRoot: sourceRoot,
      targetPublicDir,
      siteBasePath: "/newBlog/",
    });
    const article = Object.values(result.postsBySlug)[0];

    expect(article?.html).toMatch(
      /src="\/newBlog\/content-assets\/content-image-[a-f0-9]{8}\/content\/source\/myblog\/assets\/diagram\.png"/,
    );
    expect(
      await readFile(
        path.join(
          targetPublicDir,
          "content-assets",
          article!.canonicalSlug,
          "content",
          "source",
          "myblog",
          "assets",
          "diagram.png",
        ),
        "utf8",
      ),
    ).toBe("diagram-bytes");
  });
});
