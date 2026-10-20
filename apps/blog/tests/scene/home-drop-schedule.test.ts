import { describe, expect, it } from "vitest";
import { createDropSchedule, interleaveCards } from "@/components/scene/home-card-flight/drop-schedule";
import { parseCardConfig } from "@/components/scene/home-card-flight/card-config";

describe("Home card ordering", () => {
  it.each([[0, 3], [0.26, 4], [0.51, 5], [0.99, 6]])("drops a star after %s random selects %s content drops", (random, interval) => {
    const schedule = createDropSchedule(() => random);
    const content: string[] = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let i = 0; i < interval; i++) {
        const kind = schedule.next(true, true)!;
        expect(kind).not.toBe("star"); content.push(kind); schedule.record(kind);
      }
      expect(schedule.next(true, true)).toBe("star"); schedule.record("star");
    }
    content.forEach((kind, i) => expect(kind).toBe(i % 2 ? "image" : "text"));
  });

  it("keeps playing when one category is absent and stops for an empty catalog", () => {
    const schedule = createDropSchedule(() => 0);
    expect(schedule.next(false, false)).toBeUndefined();
    expect(schedule.next(true, false)).toBe("text"); schedule.record("text");
    expect(schedule.next(true, false)).toBe("text");
    expect(schedule.next(false, true)).toBe("image");
  });

  it("interleaves the finite gallery without losing an extra photo", () => {
    const cards = [{ type: "text", id: "t1" }, { type: "text", id: "t2" }, { type: "image", id: "p1" }, { type: "image", id: "p2" }, { type: "image", id: "p3" }] as const;
    expect(interleaveCards([...cards]).map(card => card.id)).toEqual(["t1", "p1", "t2", "p2", "p3"]);
  });

  it("supports description while retaining old caption configurations", () => {
    const { cards, issues } = parseCardConfig({ version: 1, cards: [
      { id: "new", type: "image", src: "local:love-cs.webp", description: "love CS", caption: "legacy" },
      { id: "old", type: "image", src: "local:photo-01.webp", caption: "我的镜头下1" },
    ] });
    expect(issues).toEqual([]);
    expect(cards[0]).toMatchObject({ description: "love CS" });
    expect(cards[1]).toMatchObject({ description: "我的镜头下1" });
  });
});
