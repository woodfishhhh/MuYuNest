<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from "vue";
import gsap from "gsap";

import { useTheme } from "@/composables/useTheme";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  contacts: AuthorProfileData["contacts"];
}>();

const { theme } = useTheme();

type ContactLink = {
  id: string;
  href?: string;
  /** 暗色主题用的 iconify 图标路径（含 collection/name，不含 ?color） */
  icon: string;
  /** 暗色下颜色（hex，不含 #） */
  colorDark: string;
  /** 亮色下颜色（hex，不含 #）；缺省则与暗色相同 */
  colorLight?: string;
  label: string;
  info?: string;
};

/** 根据当前主题生成带色参数的 iconify CDN URL */
function iconUrl(icon: string, colorDark: string, colorLight?: string): string {
  const hex = theme.value === "day" && colorLight ? colorLight : colorDark;
  return `https://api.iconify.design/${icon}.svg?color=%23${hex}`;
}

const rawLinks = computed<ContactLink[]>(() => [
  {
    id: "qq",
    label: "QQ",
    info: "3053932588",
    icon: "fa-brands/qq",
    colorDark: "12B7F5",
    colorLight: "0D99D1", // 稍深，亮色下更清晰
  },
  {
    id: "wechat",
    label: "WeChat",
    info: "woodfishhhh",
    icon: "fa-brands/weixin",
    colorDark: "07C160",
    colorLight: "05A050",
  },
  {
    id: "email",
    label: "Email",
    info: "woodfishhhh@163.com",
    icon: "mdi/email",
    colorDark: "EA4335",
    colorLight: "C5271C",
  },
  {
    id: "github",
    label: "GitHub",
    href: props.contacts.github,
    icon: "mdi/github",
    colorDark: "ffffff",
    colorLight: "181717", // 亮色主题换成近黑
  },
  {
    id: "bilibili",
    label: "Bilibili",
    href: props.contacts.bilibili,
    icon: "ri/bilibili-fill",
    colorDark: "00A1D6",
    colorLight: "0080AA",
  },
  {
    id: "douyin",
    label: "Douyin",
    href: props.contacts.douyin,
    icon: "ri/tiktok-fill",
    colorDark: "ffffff",
    colorLight: "111111", // 亮色主题换成深色
  },
  {
    id: "neteasemusic",
    label: "网易云音乐",
    href: "http://music.163.com/artist?id=36291742&userid=1502464532",
    icon: "simple-icons/neteasecloudmusic",
    colorDark: "C20C0C",
    colorLight: "C20C0C",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/p/DMADLYigio8ICcPrSM_oQlppDOpOBPm-qxmUFE0/?igsh=MXdicXptaWV4MWNlcQ==",
    icon: "ri/instagram-fill",
    colorDark: "E4405F",
    colorLight: "C13353",
  },
]);

const contactLinks = computed(() =>
  rawLinks.value.map((l) => ({
    ...l,
    iconSrc: iconUrl(l.icon, l.colorDark, l.colorLight),
  })),
);

const activePopup = ref<string | null>(null);
const copyFeedback = ref<{ id: string; status: "success" | "error" } | null>(null);
const iconRefs = useTemplateRef<HTMLImageElement[]>("icons");
const popupRefs = useTemplateRef<HTMLElement[]>("popups");
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

function animateIcon(index: number, direction: "in" | "out") {
  const icon = iconRefs.value?.[index];
  if (!icon) {
    return;
  }

  gsap.killTweensOf(icon);
  gsap.to(icon, {
    rotate: direction === "in" ? 360 : -24,
    duration: direction === "in" ? 0.55 : 0.28,
    ease: direction === "in" ? "power2.out" : "power2.inOut",
    transformOrigin: "50% 50%",
  });
}

function showPopup(id: string, index: number) {
  popupRefs.value?.forEach((el) => {
    gsap.killTweensOf(el);
    el.style.display = "none";
    el.style.opacity = "0";
  });

  activePopup.value = id;
  const el = popupRefs.value?.[index];
  if (el) {
    el.style.display = "block";
    gsap.fromTo(
      el,
      { opacity: 0, y: 10, scale: 0.9 },
      { opacity: 1, y: -10, scale: 1, duration: 0.3, ease: "back.out(1.7)" },
    );
  }
}

async function copyContact(link: ContactLink, index: number) {
  if (!link.info) {
    return;
  }

  showPopup(link.id, index);

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(link.info);
    copyFeedback.value = { id: link.id, status: "success" };
  } catch {
    copyFeedback.value = { id: link.id, status: "error" };
  }

  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }
  feedbackTimer = setTimeout(() => {
    copyFeedback.value = null;
  }, 2200);
}

onBeforeUnmount(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }
});
</script>

<template>
  <div class="author-contact-links">
    <div v-for="(link, index) in contactLinks" :key="link.id" class="author-contact-links__wrapper">
      <component
        :is="link.href ? 'a' : 'button'"
        :aria-label="link.href ? link.label : `复制 ${link.label}`"
        :data-contact-id="link.id"
        :data-copy-state="copyFeedback?.id === link.id ? copyFeedback.status : undefined"
        :href="link.href"
        class="author-contact-links__item"
        :rel="link.href ? 'noopener noreferrer' : undefined"
        :target="link.href ? '_blank' : undefined"
        :title="link.href ? link.label : `复制 ${link.label}`"
        @mouseenter="animateIcon(index, 'in')"
        @mouseleave="animateIcon(index, 'out')"
        @click="!link.href ? copyContact(link, index) : undefined"
      >
        <img ref="icons" :src="link.iconSrc" :alt="link.label" class="author-contact-links__icon" />
      </component>

      <span
        v-if="copyFeedback?.id === link.id && copyFeedback.status === 'success'"
        aria-hidden="true"
        class="author-contact-links__copied-mark"
      >
        ✓
      </span>

      <div
        v-if="!link.href"
        ref="popups"
        aria-live="polite"
        class="author-contact-links__popup"
        role="status"
        style="display: none; opacity: 0"
      >
        <template v-if="copyFeedback?.id === link.id">
          {{ copyFeedback.status === "success" ? "已复制" : "复制失败，请手动复制" }}
          {{ link.label }}：{{ link.info }}
        </template>
        <template v-else>{{ link.label }}：{{ link.info }}</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.author-contact-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.author-contact-links__wrapper {
  position: relative;
}

.author-contact-links__item {
  display: inline-flex;
  height: 2.8rem;
  width: 2.8rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--author-contact-bg);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
  perspective: 1000px;
}

.author-contact-links__icon {
  width: 1.4rem;
  height: 1.4rem;
  will-change: transform;
}

.author-contact-links__item:hover {
  border-color: var(--border-strong);
  background: var(--author-contact-hover-bg);
  transform: translateY(-2px);
}

.author-contact-links__item[data-copy-state="success"] {
  border-color: color-mix(in srgb, #22c55e 72%, var(--border-strong));
  background: color-mix(in srgb, #22c55e 14%, var(--author-contact-bg));
}

.author-contact-links__copied-mark {
  position: absolute;
  top: -0.2rem;
  right: -0.15rem;
  display: grid;
  width: 1rem;
  height: 1rem;
  place-items: center;
  border: 2px solid var(--stage-bg);
  border-radius: 999px;
  background: #22c55e;
  color: #07130b;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
}

.author-contact-links__popup {
  position: absolute;
  bottom: calc(100% + 0.8rem);
  left: 50%;
  transform: translateX(-50%);
  min-width: 12rem;
  padding: 0.7rem 0.9rem;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.85rem;
  background:
    linear-gradient(180deg, rgba(15, 20, 34, 0.98), rgba(10, 14, 26, 0.98)), var(--background);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #f8fbff;
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.34),
    0 2px 0 rgba(255, 255, 255, 0.08) inset;
  backdrop-filter: none;
  z-index: 10;
  pointer-events: none;
}

.author-contact-links__popup::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0.9rem;
  height: 0.9rem;
  transform: translate(-50%, -52%) rotate(45deg);
  border-right: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 16, 28, 0.98);
}

:root[data-theme="day"] .author-contact-links__popup {
  border-color: rgba(25, 33, 52, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 252, 0.98)), var(--background);
  color: #141b29;
  box-shadow:
    0 18px 42px rgba(18, 28, 46, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

:root[data-theme="day"] .author-contact-links__popup::after {
  border-right-color: rgba(25, 33, 52, 0.14);
  border-bottom-color: rgba(25, 33, 52, 0.14);
  background: rgba(246, 248, 252, 0.98);
}

@media (max-width: 767px) {
  .author-contact-links {
    gap: 0.65rem;
  }

  .author-contact-links__item {
    height: 2.55rem;
    width: 2.55rem;
  }
}
</style>
