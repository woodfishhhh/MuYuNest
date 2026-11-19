export type DropKind = "text" | "image" | "star";

// Stars occupy a normal scene slot; they do not advance text/photo alternation.
export function createDropSchedule(random: () => number = Math.random) {
  let nextCard: "text" | "image" = "text";
  let cardsSinceStar = 0;
  const interval = () => 3 + Math.min(3, Math.floor(random() * 4));
  let starAfter = interval();
  return {
    next(hasText: boolean, hasImage: boolean): DropKind | undefined {
      if (!hasText && !hasImage) return undefined;
      if (cardsSinceStar >= starAfter) return "star";
      if (nextCard === "text") return hasText ? "text" : "image";
      return hasImage ? "image" : "text";
    },
    record(kind: DropKind) {
      if (kind === "star") { cardsSinceStar = 0; starAfter = interval(); }
      else { cardsSinceStar++; nextCard = kind === "text" ? "image" : "text"; }
    },
  };
}

export function interleaveCards<T extends { type: "text" | "image" }>(cards: T[]): T[] {
  const text = cards.filter(card => card.type === "text");
  const images = cards.filter(card => card.type === "image");
  const ordered: T[] = [];
  for (let i = 0; i < Math.max(text.length, images.length); i++) {
    if (text[i]) ordered.push(text[i]);
    if (images[i]) ordered.push(images[i]);
  }
  return ordered;
}
