import { describe, expect, it } from "vitest";
import config from "@/content/home-cards.json";
import { parseCardConfig, formatCardHeading, isImageSource } from "@/components/scene/home-card-flight/card-config";
import { wrapCardText, paginateLines, imageFitRect } from "@/components/scene/home-card-flight/card-surface";

describe("editable Home cards", () => {
  it("loads the editable catalog and preserves every enabled poem exactly", () => {
    const { cards, issues } = parseCardConfig(config);
    expect(issues).toEqual([]);
    expect(cards).toHaveLength(config.cards.filter(card => card.enabled !== false).length);
    expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
    for (const card of cards) {
      const source = config.cards.find(value => value.id === card.id)!;
      if (card.type === "text") expect(card.text).toBe(Array.isArray(source.text) ? source.text.join("\n") : source.text);
    }
    expect(formatCardHeading({ id: "test", title: "无题", date: "2024-07-17" })).toBe("无题 - 2024.07.17");
  });

  it("keeps valid entries when another entry is invalid, and permits an empty collection", () => {
    const valid = { id: "a", type: "text", text: ["  诗句", "", "下一行。"] };
    const result = parseCardConfig({ version: 1, cards: [valid, valid,
      { ...valid, id: "bad-date", date: "2024-02-30" },
      { id: "disabled", enabled: false, type: "image", src: "local:missing.jpg" },
      { ...valid, id: "bad-paper", paper: "invalid" }] });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ title: "无题", text: "  诗句\n\n下一行。" });
    expect(result.issues).toHaveLength(3);
    expect(parseCardConfig({ version: 1, cards: [] })).toEqual({ cards: [], issues: [] });
  });

  it("wraps and paginates without dropping spaces, characters, or blank lines", () => {
    const original = "月下  望远方，\n\n还有下一行。";
    const lines = wrapCardText(original, text => Array.from(text).length, 4);
    expect(lines).toContain("");
    expect(paginateLines(lines, 2).flat().join("")).toBe(original.replaceAll("\n", ""));
    const poem = Array.from({ length: 20 }, (_, index) => `第 ${index + 1} 行，用于验证长诗的分页。`).join("\n");
    const pages = paginateLines(wrapCardText(poem, text => text.length * 24, 396));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().join("")).toBe(poem.replaceAll("\n", ""));
  });

  it("accepts local and uploaded photos with predictable contain/cover framing", () => {
    for (const source of ["local:14.jpg", "local:散步/月亮.webp", "/asset/photo.webp", "https://img.example.com/a.jpg"]) expect(isImageSource(source)).toBe(true);
    for (const source of ["javascript:alert(1)", "local:../secret.jpg", "//example.com/a.jpg"]) expect(isImageSource(source)).toBe(false);
    expect(imageFitRect(200, 100, 100, 100, "contain")).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(imageFitRect(200, 100, 100, 100, "cover")).toEqual({ x: -50, y: 0, width: 200, height: 100 });
    expect(parseCardConfig({ version: 1, cards: [{ id: "photo", type: "image", src: "local:14.jpg" }] }).cards[0])
      .toMatchObject({ type: "image", frame: "white", fit: "contain", caption: "" });
  });
});
