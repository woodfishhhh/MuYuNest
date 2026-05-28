// 16 visual variants for the falling-cards scene.
// Each variant fully describes palette, camera and background style so the user
// can pick the one that best matches their taste.

export type BgPattern =
  | "minimal-horizon" // 一条地平线 + 极少装饰
  | "soft-grid" // 远端均匀网格 (天花板+地板)
  | "floor-only" // 仅地板网格
  | "dot-field" // 点阵
  | "vertical-stripes" // 远端纵向细线
  | "concentric" // 同心圆地板
  | "void" // 纯色 + 雾
  | "subtle-frame"; // 极淡画框

export type CameraPreset =
  | "eye-level" // 完全水平, 消失点正中
  | "slight-low" // 微低视角 (相机略低于中心)
  | "slight-high" // 微俯视
  | "isometric"; // 30° 等距俯瞰

export interface Palette {
  bg: string; // scene background
  fog: string; // fog colour (usually same as bg)
  fogNear: number;
  fogFar: number;
  line: number; // line colour (hex)
  lineOpacity: number;
  cardBgHueShift: number; // delta hue applied to card base
  cardSat: number; // 0-100
  cardLight: number; // 0-100 (front face base)
  cardTextDark: string; // primary text
  cardTextSoft: string; // secondary text
  cardBorder: string; // border stroke
}

export interface VariantConfig {
  id: string;
  name: string;
  desc: string;
  palette: Palette;
  camera: CameraPreset;
  bg: BgPattern;
}

// ─── Palettes ──────────────────────────────────────────────────────────────

const PAL_PAPER: Palette = {
  bg: "#f4f2ea",
  fog: "#f4f2ea",
  fogNear: 12,
  fogFar: 34,
  line: 0xc4c0b6,
  lineOpacity: 0.32,
  cardBgHueShift: 0,
  cardSat: 20,
  cardLight: 94,
  cardTextDark: "#1c1410",
  cardTextSoft: "rgba(70, 52, 34, 0.56)",
  cardBorder: "rgba(70, 50, 30, 0.16)",
};

const PAL_LINEN: Palette = {
  bg: "#ece4d6",
  fog: "#ece4d6",
  fogNear: 12,
  fogFar: 34,
  line: 0xb8ad99,
  lineOpacity: 0.35,
  cardBgHueShift: 30,
  cardSat: 16,
  cardLight: 92,
  cardTextDark: "#221a10",
  cardTextSoft: "rgba(70, 52, 34, 0.6)",
  cardBorder: "rgba(70, 50, 30, 0.18)",
};

const PAL_MIST: Palette = {
  bg: "#eef0f1",
  fog: "#eef0f1",
  fogNear: 12,
  fogFar: 34,
  line: 0xb8bcc0,
  lineOpacity: 0.32,
  cardBgHueShift: 200,
  cardSat: 10,
  cardLight: 96,
  cardTextDark: "#15202a",
  cardTextSoft: "rgba(50, 70, 90, 0.6)",
  cardBorder: "rgba(40, 60, 80, 0.16)",
};

const PAL_FROST: Palette = {
  bg: "#e6ebee",
  fog: "#e6ebee",
  fogNear: 12,
  fogFar: 34,
  line: 0xa9b3ba,
  lineOpacity: 0.35,
  cardBgHueShift: 210,
  cardSat: 8,
  cardLight: 95,
  cardTextDark: "#0e1a25",
  cardTextSoft: "rgba(40, 60, 80, 0.62)",
  cardBorder: "rgba(40, 60, 80, 0.2)",
};

const PAL_SAND: Palette = {
  bg: "#f1ecdf",
  fog: "#f1ecdf",
  fogNear: 12,
  fogFar: 34,
  line: 0xc7b893,
  lineOpacity: 0.32,
  cardBgHueShift: 38,
  cardSat: 22,
  cardLight: 93,
  cardTextDark: "#23170a",
  cardTextSoft: "rgba(90, 70, 36, 0.58)",
  cardBorder: "rgba(90, 70, 36, 0.2)",
};

const PAL_SAGE: Palette = {
  bg: "#e9ece4",
  fog: "#e9ece4",
  fogNear: 12,
  fogFar: 34,
  line: 0xb1b8a8,
  lineOpacity: 0.34,
  cardBgHueShift: 120,
  cardSat: 12,
  cardLight: 94,
  cardTextDark: "#11201a",
  cardTextSoft: "rgba(40, 70, 50, 0.6)",
  cardBorder: "rgba(40, 70, 50, 0.18)",
};

const PAL_INK: Palette = {
  bg: "#1f2126",
  fog: "#1f2126",
  fogNear: 12,
  fogFar: 34,
  line: 0x4a4d52,
  lineOpacity: 0.6,
  cardBgHueShift: 0,
  cardSat: 6,
  cardLight: 90,
  cardTextDark: "#1c1410",
  cardTextSoft: "rgba(70, 52, 34, 0.6)",
  cardBorder: "rgba(70, 50, 30, 0.18)",
};

const PAL_NIGHT: Palette = {
  bg: "#15171c",
  fog: "#15171c",
  fogNear: 10,
  fogFar: 32,
  line: 0x3a3f47,
  lineOpacity: 0.7,
  cardBgHueShift: 220,
  cardSat: 14,
  cardLight: 92,
  cardTextDark: "#101820",
  cardTextSoft: "rgba(30, 50, 70, 0.62)",
  cardBorder: "rgba(30, 50, 70, 0.18)",
};

// ─── Variants ──────────────────────────────────────────────────────────────

export const VARIANTS: VariantConfig[] = [
  {
    id: "v01",
    name: "雾白·水平地平线",
    desc: "极简一条地平线，消失点严格居中。",
    palette: PAL_PAPER,
    camera: "eye-level",
    bg: "minimal-horizon",
  },
  {
    id: "v02",
    name: "雾白·点阵地面",
    desc: "稀疏点阵代替线条，无方向感。",
    palette: PAL_PAPER,
    camera: "eye-level",
    bg: "dot-field",
  },
  {
    id: "v03",
    name: "雾白·画框",
    desc: "顶底两条极淡水平线作画框。",
    palette: PAL_PAPER,
    camera: "eye-level",
    bg: "subtle-frame",
  },
  {
    id: "v04",
    name: "雾白·虚空",
    desc: "无线条，仅靠雾营造空间。",
    palette: PAL_PAPER,
    camera: "eye-level",
    bg: "void",
  },
  {
    id: "v05",
    name: "亚麻·走廊网格",
    desc: "顶底网格 + 微低视角，建筑感。",
    palette: PAL_LINEN,
    camera: "slight-low",
    bg: "soft-grid",
  },
  {
    id: "v06",
    name: "亚麻·地板网格",
    desc: "仅地板网格，参考感更轻。",
    palette: PAL_LINEN,
    camera: "eye-level",
    bg: "floor-only",
  },
  {
    id: "v07",
    name: "亚麻·同心地板",
    desc: "同心圆地板，向心感强。",
    palette: PAL_LINEN,
    camera: "slight-low",
    bg: "concentric",
  },
  {
    id: "v08",
    name: "亚麻·纵向远景",
    desc: "远端少量竖线，舞台感。",
    palette: PAL_LINEN,
    camera: "eye-level",
    bg: "vertical-stripes",
  },
  {
    id: "v09",
    name: "雾灰·地平线",
    desc: "冷调雾灰底，极简地平线。",
    palette: PAL_MIST,
    camera: "eye-level",
    bg: "minimal-horizon",
  },
  {
    id: "v10",
    name: "雾灰·点阵",
    desc: "冷雾灰 + 稀疏点阵。",
    palette: PAL_MIST,
    camera: "eye-level",
    bg: "dot-field",
  },
  {
    id: "v11",
    name: "霜蓝·网格",
    desc: "更冷的霜蓝底，建筑网格。",
    palette: PAL_FROST,
    camera: "slight-low",
    bg: "soft-grid",
  },
  {
    id: "v12",
    name: "霜蓝·虚空",
    desc: "冷蓝渐隐，无任何线条。",
    palette: PAL_FROST,
    camera: "eye-level",
    bg: "void",
  },
  {
    id: "v13",
    name: "沙金·地平线",
    desc: "温暖沙金底，单线地平。",
    palette: PAL_SAND,
    camera: "eye-level",
    bg: "minimal-horizon",
  },
  {
    id: "v14",
    name: "鼠尾草·走廊",
    desc: "灰绿底色，建筑透视。",
    palette: PAL_SAGE,
    camera: "slight-low",
    bg: "soft-grid",
  },
  {
    id: "v15",
    name: "墨·夜景网格",
    desc: "深色底，淡线网格夜色。",
    palette: PAL_INK,
    camera: "slight-low",
    bg: "soft-grid",
  },
  {
    id: "v16",
    name: "夜·点阵星空",
    desc: "深蓝灰底 + 远点阵。",
    palette: PAL_NIGHT,
    camera: "eye-level",
    bg: "dot-field",
  },
];
