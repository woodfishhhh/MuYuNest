import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import FriendLinkCard from "@/components/home/friend/FriendLinkCard.vue";

describe("friend avatar recovery", () => {
  it("shows identifiable initials after an image failure and retries a changed URL", async () => {
    const link = { name: "maskviva", link: "https://example.com", avatar: "https://example.com/broken.png" };
    const wrapper = mount(FriendLinkCard, { props: { link } });
    expect(wrapper.get("img").attributes("referrerpolicy")).toBe("no-referrer");
    await wrapper.get("img").trigger("error");
    expect(wrapper.get('[data-testid="friend-avatar-fallback"]').text()).toBe("MA");
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe("maskviva的默认头像");
    await wrapper.setProps({ link: { ...link, avatar: "https://example.com/repaired.png" } });
    expect(wrapper.get("img").attributes("src")).toContain("repaired.png");
  });
  it("uses Chinese initials when an avatar is missing", () => {
    const wrapper = mount(FriendLinkCard, { props: { link: { name: "计算机协会", link: "https://example.com" } } });
    expect(wrapper.get('[data-testid="friend-avatar-fallback"]').text()).toBe("计算");
  });
});
