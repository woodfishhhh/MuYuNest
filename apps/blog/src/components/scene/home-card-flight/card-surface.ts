import type { ContentCard, ImageCard, TextCard } from "./card-config";
import { formatCardHeading } from "./card-config";

export type CardTheme = "day" | "night";
export interface CardSurface {
  card: ContentCard;
  width: number;
  height: number;
  render: (theme?: CardTheme) => HTMLCanvasElement;
  page: number;
  pageCount: number;
}

const WIDTH = 500;
const HEIGHT = 650;
const MARGIN = 52;
const BODY_SIZE = 24;
const LINE_HEIGHT = 43;
export const TEXT_LINES_PER_CARD = 10;
const SERIF = '"Songti SC", "SimSun", "Noto Serif CJK SC", serif';

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * 2);
  canvas.height = Math.round(height * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  return { canvas, ctx };
}

// Preserve every character and explicit line break. Wrapping never rewrites the poem.
export function wrapCardText(text: string, measure: (text: string) => number, maxWidth: number) {
  const lines: string[] = [];
  for (const sourceLine of text.split(/\r?\n/)) {
    if (!sourceLine) { lines.push(""); continue; }
    let line = "";
    for (const char of Array.from(sourceLine)) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = char; }
      else line += char;
    }
    lines.push(line);
  }
  return lines;
}

export function paginateLines(lines: string[], count = TEXT_LINES_PER_CARD) {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += count) pages.push(lines.slice(i, i + count));
  return pages.length ? pages : [[]];
}

export function renderTextCard(card: TextCard): CardSurface[] {
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${BODY_SIZE}px ${SERIF}`;
  const pages = paginateLines(wrapCardText(card.text, text => measure.measureText(text).width, WIDTH - MARGIN * 2));
  return pages.map((lines, page) => ({
    card, page, pageCount: pages.length, width: WIDTH, height: HEIGHT,
    render: (theme = "day") => {
      const { canvas, ctx } = surface(WIDTH, HEIGHT);
      const dark = theme === "night" || card.paper === "dark";
      ctx.fillStyle = dark ? "#1b1e24" : { warm: "#eeeae2", white: "#f0f0ec", dark: "#1b1e24" }[card.paper];
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = dark ? "#323740" : "#ded8cd";
      ctx.lineWidth = 0.6; ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24);
      ctx.fillStyle = dark ? "#b7bbc2" : "#35322e";
      ctx.textAlign = "center";
      ctx.font = `18px ${SERIF}`;
      const heading = formatCardHeading(card);
      let headingSize = 18;
      while (ctx.measureText(heading).width > WIDTH - MARGIN * 2 && headingSize > 12) {
        headingSize--; ctx.font = `${headingSize}px ${SERIF}`;
      }
      ctx.fillText(heading, WIDTH / 2, 82, WIDTH - MARGIN * 2);
      ctx.strokeStyle = dark ? "#555c66" : "#c5bcae";
      ctx.beginPath(); ctx.moveTo(WIDTH / 2 - 12, 108); ctx.lineTo(WIDTH / 2 + 12, 108); ctx.stroke();
      ctx.font = `${BODY_SIZE}px ${SERIF}`;
      ctx.textAlign = card.align;
      const bodyHeight = (lines.length - 1) * LINE_HEIGHT;
      const top = 156 + Math.max(0, (386 - bodyHeight) / 2);
      lines.forEach((line, index) => ctx.fillText(line, card.align === "left" ? MARGIN : WIDTH / 2, top + index * LINE_HEIGHT));
      if (pages.length > 1) {
        ctx.textAlign = "center"; ctx.font = "11px sans-serif";
        ctx.globalAlpha = 0.5; ctx.fillText(`${page + 1} / ${pages.length}`, WIDTH / 2, HEIGHT - 34); ctx.globalAlpha = 1;
      }
      return canvas;
    },
  }));
}

export function imageFitRect(sourceWidth: number, sourceHeight: number, width: number, height: number, fit: ImageCard["fit"]) {
  const scale = fit === "cover" ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  return { x: (width - sourceWidth * scale) / 2, y: (height - sourceHeight * scale) / 2,
    width: sourceWidth * scale, height: sourceHeight * scale };
}

export function renderImageCard(card: ImageCard, image: HTMLImageElement): CardSurface[] {
  const ratio = card.aspectRatio ?? Math.max(0.4, Math.min(2.5, image.naturalWidth / image.naturalHeight));
  const inset = 38;
  const imageWidth = WIDTH - inset * 2;
  const imageHeight = imageWidth / ratio;
  const description = card.description ?? card.caption;
  const captionHeight = description ? 42 : 0;
  const height = imageHeight + inset * 2 + captionHeight;
  return [{ card, page: 0, pageCount: 1, width: WIDTH, height, render: (theme = "day") => {
    const { canvas, ctx } = surface(WIDTH, height);
    const night = theme === "night";
    const dark = night || card.frame === "black";
    const edge = night ? "#303640" : { white: "#dedbd4", black: "#222326", wood: "#8c6646" }[card.frame];
    ctx.fillStyle = edge; ctx.fillRect(0, 0, WIDTH, height);
    ctx.fillStyle = night ? "#1b1e24" : dark ? "#353638" : "#f1eee7";
    ctx.fillRect(9, 9, WIDTH - 18, height - 18);
    const fitted = imageFitRect(image.naturalWidth, image.naturalHeight, imageWidth, imageHeight, card.fit);
    ctx.save(); ctx.beginPath(); ctx.rect(inset, inset, imageWidth, imageHeight); ctx.clip();
    ctx.drawImage(image, inset + fitted.x, inset + fitted.y, fitted.width, fitted.height);
    if (night) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(inset + fitted.x, inset + fitted.y, fitted.width, fitted.height);
    }
    ctx.restore();
    if (description) {
      ctx.fillStyle = dark ? "#a8afb9" : "#5b554e";
      ctx.textAlign = "center"; ctx.font = `14px ${SERIF}`;
      ctx.fillText(description, WIDTH / 2, height - 28, WIDTH - inset * 2);
    }
    return canvas;
  } }];
}

export function renderCardReverse(theme: CardTheme = "day") {
  const { canvas, ctx } = surface(WIDTH, HEIGHT);
  ctx.fillStyle = theme === "night" ? "#181b20" : "#e6e1d7"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = theme === "night" ? "#737c8a" : "#a69d8e"; ctx.textAlign = "center"; ctx.font = `18px ${SERIF}`;
  ctx.fillText("拾 光", WIDTH / 2, HEIGHT / 2);
  return canvas;
}

export function loadCardImage(src: string, timeoutMs = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timeout = setTimeout(() => { image.src = ""; reject(new Error("图片加载超时")); }, timeoutMs);
    image.src = src;
    image.decode().then(() => { clearTimeout(timeout); resolve(image); }, error => { clearTimeout(timeout); reject(error); });
  });
}
