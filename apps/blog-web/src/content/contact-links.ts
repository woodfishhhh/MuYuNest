import type { AuthorProfileData } from "@/types/content";

export interface ContactLink {
  id: string;
  label: string;
  /** Iconify icon path, e.g. "mdi/github". */
  icon: string;
  href: string;
  /** Shown instead of a page for contacts that are just an id. */
  value?: string;
}

const EMAIL = "woodfishhhh@163.com";
const QQ = "3053932588";
const WECHAT = "woodfishhhh";
const NETEASE_MUSIC = "http://music.163.com/artist?id=36291742&userid=1502464532";
const INSTAGRAM = "https://www.instagram.com/p/DMADLYigio8ICcPrSM_oQlppDOpOBPm-qxmUFE0/?igsh=MXdicXptaWV4MWNlcQ==";

export function getContactLinks(contacts: AuthorProfileData["contacts"]): ContactLink[] {
  return [
    { id: "github", label: "GitHub", icon: "mdi/github", href: contacts.github },
    { id: "bilibili", label: "Bilibili", icon: "ri/bilibili-fill", href: contacts.bilibili },
    { id: "douyin", label: "抖音", icon: "ri/tiktok-fill", href: contacts.douyin },
    { id: "netease", label: "网易云音乐", icon: "simple-icons/neteasecloudmusic", href: NETEASE_MUSIC },
    { id: "instagram", label: "Instagram", icon: "ri/instagram-fill", href: INSTAGRAM },
    { id: "email", label: "Email", icon: "mdi/email", href: `mailto:${EMAIL}`, value: EMAIL },
    { id: "qq", label: "QQ", icon: "fa-brands/qq", href: contacts.qq, value: QQ },
    { id: "wechat", label: "微信", icon: "fa-brands/weixin", href: contacts.wechat, value: WECHAT },
  ];
}

export const NETEASE_MUSIC_URL = NETEASE_MUSIC;
