import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import FriendPanel from "@/components/home/FriendPanel.vue";
import FriendLinkApplicationForm from "@/components/home/friend/FriendLinkApplicationForm.vue";
import FriendLinkCard from "@/components/home/friend/FriendLinkCard.vue";
import { TRAVELLINGS_TITLE, TRAVELLINGS_URL } from "@/utils/travellings";

const links = [
  {
    name: "Fomalhaut",
    link: "https://fomal.cc/",
    avatar: "/newBlog/remote-assets/fomalhaut.png",
    descr: "我的博客从这里学的",
    className: "友情链接",
  },
  {
    name: "Mohao",
    link: "https://blog.mohao.me/",
    avatar: "/newBlog/remote-assets/mohao.jpeg",
    descr: "钟明皓大神",
    className: "友情链接",
  },
];

describe("FriendPanel", () => {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

  afterEach(() => {
    openSpy.mockClear();
  });

  it("renders friend cards and opens a prefilled GitHub issue only after reminder confirmation", async () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });

    expect(wrapper.text()).toContain("友链");
    expect(wrapper.get("[data-testid='friend-panel-root']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-panel-hero']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-panel-grid']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-panel-application']")).toBeTruthy();
    expect(wrapper.findAll("[data-testid='friend-link-card']")).toHaveLength(2);
    expect(wrapper.get("[data-testid='friend-application-site-name']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-site-url']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-friend-page-url']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-avatar-url']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-description']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-contact']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-reciprocal-confirmed']")).toBeTruthy();

    await wrapper.get("[data-testid='friend-application-site-name']").setValue("Orbiting Notes");
    await wrapper
      .get("[data-testid='friend-application-site-url']")
      .setValue("https://orbiting.example");
    await wrapper
      .get("[data-testid='friend-application-friend-page-url']")
      .setValue("https://orbiting.example/friends");
    await wrapper
      .get("[data-testid='friend-application-avatar-url']")
      .setValue("https://orbiting.example/avatar.png");
    await wrapper
      .get("[data-testid='friend-application-description']")
      .setValue("沉浸式前端与工程随记。");
    await wrapper.get("[data-testid='friend-application-contact']").setValue("@orbiting-notes");
    await wrapper.get("[data-testid='friend-application-reciprocal-confirmed']").setValue(true);
    await wrapper.get("[data-testid='friend-application-submit']").trigger("click");

    expect(openSpy).not.toHaveBeenCalled();
    expect(wrapper.get("[data-testid='friend-application-reminder']").text()).toContain(
      "将打开 GitHub 提交草稿",
    );

    await wrapper.get("[data-testid='friend-application-confirm']").trigger("click");

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [issueUrl] = openSpy.mock.calls[0] ?? [];
    const parsedIssueUrl = new URL(String(issueUrl));
    const issueTitle = parsedIssueUrl.searchParams.get("title") ?? "";
    const issueBody = parsedIssueUrl.searchParams.get("body") ?? "";

    expect(issueUrl).toContain("https://github.com/woodfishhhh/MuYuNest/issues/new");
    expect(issueTitle).toContain("Orbiting Notes");
    expect(issueBody).toContain("https://orbiting.example");
    expect(issueBody).toContain("- Friend Page URL: https://orbiting.example/friends");
    expect(issueBody).toContain("@orbiting-notes");
    expect(issueBody).toContain("- Reciprocal Link Added: yes");
  });

  it("requires the reciprocal-link confirmation before generating a GitHub draft", async () => {
    const wrapper = mount(FriendLinkApplicationForm);

    await wrapper.get("[data-testid='friend-application-site-name']").setValue("Orbiting Notes");
    await wrapper
      .get("[data-testid='friend-application-site-url']")
      .setValue("https://orbiting.example");
    await wrapper
      .get("[data-testid='friend-application-friend-page-url']")
      .setValue("https://orbiting.example/friends");
    await wrapper
      .get("[data-testid='friend-application-description']")
      .setValue("沉浸式前端与工程随记。");
    await wrapper.get("[data-testid='friend-application-contact']").setValue("@orbiting-notes");
    await wrapper.get("[data-testid='friend-application-submit']").trigger("click");

    expect(openSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("请先在你的博客友链页加入 woodfish，再勾选确认。");
    expect(wrapper.get("[data-testid='friend-application-reminder']").isVisible()).toBe(false);
  });

  it("shows friend domains instead of legacy class labels", () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });

    expect(wrapper.text()).toContain("fomal.cc");
    expect(wrapper.text()).toContain("blog.mohao.me");
    expect(wrapper.text()).not.toContain("友情链接");
  });

  it("opens a random friend link from the header action", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });

    await wrapper.get("[data-testid='friend-random-visit']").trigger("click");

    expect(openSpy).toHaveBeenCalledWith("https://blog.mohao.me/", "_blank", "noopener,noreferrer");
    randomSpy.mockRestore();
  });

  it("renders a Travellings button beside the random friend action", () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });
    const travellings = wrapper.get("[data-testid='friend-travellings']");

    expect(wrapper.get("[data-testid='friend-random-visit']").text()).toBe("随机前往");
    expect(travellings.text()).toBe("开往");
    expect(travellings.attributes("href")).toBe(TRAVELLINGS_URL);
    expect(travellings.attributes("aria-label")).toBe(TRAVELLINGS_TITLE);
    expect(travellings.attributes("target")).toBe("_blank");
    expect(travellings.attributes("rel")).toContain("noopener");
  });

  it("opens and closes the mobile application drawer", async () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });

    expect(wrapper.get("[data-testid='friend-mobile-drawer']").attributes("style")).toContain(
      "display: none",
    );

    await wrapper.get("[data-testid='friend-mobile-drawer-toggle']").trigger("click");

    expect(
      wrapper.get("[data-testid='friend-mobile-drawer']").attributes("style") ?? "",
    ).not.toContain("display: none");
    expect(
      wrapper
        .get("[data-testid='friend-mobile-drawer']")
        .find("[data-testid='friend-application-site-name']")
        .exists(),
    ).toBe(true);

    await wrapper.get("[data-testid='friend-mobile-drawer-close']").trigger("click");

    expect(wrapper.get("[data-testid='friend-mobile-drawer']").attributes("style")).toContain(
      "display: none",
    );
  });

  it("renders a regular two-column waterfall without repeated loop segments", () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });

    const columns = wrapper.findAll("[data-testid='friend-waterfall-column']");

    expect(columns).toHaveLength(2);
    expect(wrapper.find("[data-testid='friend-loop-segment']").exists()).toBe(false);
    expect(wrapper.get("#friend-links-container")).toBeTruthy();
    expect(wrapper.findAll("[data-testid='friend-link-card']")).toHaveLength(2);

    for (const card of wrapper.findAll("[data-testid='friend-link-card']")) {
      expect(card.attributes("data-glass-preset")).toBeUndefined();
      expect(card.find(".friend-link-card__pin").exists()).toBe(true);
    }

    expect(columns[0]?.findAll("[data-testid='friend-link-card']").length).toBeGreaterThan(0);
    expect(columns[1]?.findAll("[data-testid='friend-link-card']").length).toBeGreaterThan(0);
  });

  it("lets card height grow from the description instead of a fixed minimum", () => {
    const longDescription =
      "这是一段比较长的友链描述，用来确认卡片高度由正文自然撑开，而不是由固定高度变量锁死。";
    const wrapper = mount(FriendLinkCard, {
      props: {
        link: {
          name: "Long Notes",
          link: "https://long.example",
          avatar: "",
          descr: longDescription,
          className: "友情链接",
        },
      },
    });

    expect(wrapper.get("[data-testid='friend-link-card']").attributes("style") ?? "").not.toContain(
      "--card-min-height",
    );
    expect(wrapper.text()).toContain(longDescription);
  });

  it("lets long friend names and domains wrap instead of clipping them", () => {
    const wrapper = mount(FriendLinkCard, {
      props: {
        link: {
          name: "Sigirka-善良耙耙柑",
          link: "https://a-very-long-friend-domain.example.com",
          avatar: "",
          descr: "完整展示友链信息。",
          className: "友情链接",
        },
      },
    });

    expect(wrapper.get("h3").classes()).not.toContain("truncate");
    expect(wrapper.get("h3").text()).toBe("Sigirka-善良耙耙柑");
    expect(wrapper.get("h3 + p").classes()).not.toContain("truncate");
    expect(wrapper.get("h3 + p").text()).toBe("a-very-long-friend-domain.example.com");
  });

  it("maps pointer position into per-card pseudo-3d style variables", async () => {
    const wrapper = mount(FriendLinkCard, {
      props: {
        link: {
          name: "Tilt Notes",
          link: "https://tilt.example",
          avatar: "",
          descr: "有轻微景深的友链卡片。",
          className: "友情链接",
        },
      },
    });
    const card = wrapper.get("[data-testid='friend-link-card']");

    vi.spyOn(card.element, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 200,
      bottom: 100,
      left: 0,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const pointerMove = new MouseEvent("pointermove", {
      clientX: 160,
      clientY: 20,
      bubbles: true,
    });
    Object.defineProperty(pointerMove, "pointerType", { value: "mouse" });

    card.element.dispatchEvent(pointerMove);
    await nextTick();

    const style = card.attributes("style") ?? "";

    expect(style).toContain("--tilt-rotate-x: 3.90deg");
    expect(style).toContain("--tilt-rotate-y: 3.90deg");
    expect(style).toContain("--tilt-glare-x: 80.0%");
    expect(style).toContain("--tilt-glare-y: 20.0%");
    expect(style).toContain("--card-lift: -7px");
  });

  it("restores the original floating mobile submit trigger", () => {
    const wrapper = mount(FriendPanel, {
      props: {
        links,
      },
    });
    const trigger = wrapper.get("[data-testid='friend-mobile-drawer-toggle']");
    const style = trigger.attributes("style") ?? "";

    expect(trigger.attributes("data-glass-preset")).toBeUndefined();
    expect(style).toContain("--friend-trigger-rotate-x: 0deg");
    expect(style).toContain("--friend-trigger-lift: 0px");
  });

  it("renders playful application-card motion layers while filling a draft", async () => {
    const wrapper = mount(FriendLinkApplicationForm);
    const card = wrapper.get("[data-testid='friend-application-card']");

    expect(card.classes()).not.toContain("is-writing");
    expect(wrapper.get("[data-testid='friend-application-shine']")).toBeTruthy();
    expect(wrapper.get("[data-testid='friend-application-stamp']")).toBeTruthy();
    expect(wrapper.findAll("[data-testid='friend-application-trail']")).toHaveLength(3);

    await wrapper.get("[data-testid='friend-application-site-name']").setValue("Orbiting Notes");

    expect(wrapper.get("[data-testid='friend-application-card']").classes()).toContain(
      "is-writing",
    );
  });
});
