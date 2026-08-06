import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";

describe("AuthorCapsuleScreen", () => {
  it("renders the fixed '这是什么?' target capsule without an icon", async () => {
    vi.resetModules();
    vi.doMock("@/composables/useMatterCapsules", () => ({
      useMatterCapsules: () => ({
        activateSkill: () => {},
      }),
    }));

    const AuthorCapsuleScreen = (await import("@/components/home/author/AuthorCapsuleScreen.vue"))
      .default;
    const wrapper = mount(AuthorCapsuleScreen, {
      props: {
        active: true,
        skills: [
          {
            title: "Vue",
            color: "#42b883",
            img: "/vue.png",
            officialUrl: "https://vuejs.org/",
          },
        ],
      },
    });

    const dropzone = wrapper.find("[data-author-dropzone]");
    expect(dropzone.exists()).toBe(true);
    expect(dropzone.text()).toContain("这是什么?");
    expect(dropzone.find("img").exists()).toBe(false);
  });

  it("keeps the target capsule compact, initially hidden, and behind normal capsules", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/home/author/AuthorCapsuleScreen.vue"),
      "utf8",
    );
    const dropzoneRule = source.match(/\.author-capsule--dropzone\s*{[^}]+}/s)?.[0] ?? "";

    expect(dropzoneRule).toMatch(/min-width:\s*0;/);
    expect(dropzoneRule).toMatch(/width:\s*fit-content;/);
    expect(dropzoneRule).toMatch(/opacity:\s*0;/);
    expect(dropzoneRule).toMatch(/visibility:\s*hidden;/);
    expect(dropzoneRule).toMatch(/z-index:\s*0;/);
    expect(source).toMatch(/\.author-capsule--dropzone\.is-dropzone-visible\s*{[^}]+opacity:\s*1;/s);
  });

  it("marks dark monochrome logos for night-theme inversion", async () => {
    vi.resetModules();
    vi.doMock("@/composables/useMatterCapsules", () => ({
      useMatterCapsules: () => ({
        activateSkill: () => {},
      }),
    }));

    const AuthorCapsuleScreen = (await import("@/components/home/author/AuthorCapsuleScreen.vue"))
      .default;
    const skills = [
      "Express",
      "Matter.js",
      "GitHub Actions",
      "Next.js",
      "Three.js",
      "shadcn/ui",
      "Vue",
    ].map(
      (title) => ({
        title,
        color: "#000000",
        img: `/${title}.svg`,
        officialUrl: "https://example.com/",
      }),
    );
    const wrapper = mount(AuthorCapsuleScreen, {
      props: { active: true, skills },
    });

    expect(wrapper.findAll(".author-capsule__icon--night-invert")).toHaveLength(6);
    expect(wrapper.find('img[alt="Vue"]')?.classes()).not.toContain(
      "author-capsule__icon--night-invert",
    );

    const source = readFileSync(
      resolve(process.cwd(), "src/components/home/author/AuthorCapsuleScreen.vue"),
      "utf8",
    );
    expect(source).toContain(
      ':root[data-theme="night"] .author-capsule__icon--night-invert',
    );
  });
});
