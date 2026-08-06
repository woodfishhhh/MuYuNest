<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue";

import { buildFriendLinkIssueUrl, validateFriendLinkInput } from "@/utils/friend-link-issue";

interface FriendLinkApplicationDraft {
  siteName: string;
  siteUrl: string;
  friendPageUrl: string;
  avatarUrl: string;
  description: string;
  contact: string;
  reciprocalLinkConfirmed: boolean;
}

const draft = reactive<FriendLinkApplicationDraft>({
  siteName: "",
  siteUrl: "",
  friendPageUrl: "",
  avatarUrl: "",
  description: "",
  contact: "",
  reciprocalLinkConfirmed: false,
});

const showReminder = shallowRef(false);

const hasDraftStarted = computed(() =>
  Object.values(draft).some((value) =>
    typeof value === "string" ? value.trim().length > 0 : value,
  ),
);

const validationMessage = computed(() => {
  const result = validateFriendLinkInput(draft);

  if (!draft.siteName.trim()) {
    return "请先填写站点名称。";
  }

  if (!draft.siteUrl.trim()) {
    return "请先填写站点链接。";
  }

  if (!result.invalidFields.includes("siteUrl")) {
    // URL 格式合法，但额外检查安全性（防 SSRF / 恶意协议）
    try {
      const parsed = new URL(draft.siteUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "站点链接必须是 http:// 或 https:// 开头的合法地址。";
      }
      if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(parsed.hostname)) {
        return "站点链接不能使用本地地址。";
      }
    } catch {
      return "站点链接格式不正确。";
    }
  }

  if (!draft.friendPageUrl.trim()) {
    return "请先填写友链页链接。";
  }

  if (result.invalidFields.includes("friendPageUrl")) {
    return "友链页链接必须是可公开访问的 http:// 或 https:// 地址。";
  }

  if (draft.avatarUrl.trim() && !result.invalidFields.includes("avatarUrl")) {
    try {
      const parsed = new URL(draft.avatarUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "头像链接必须是 http:// 或 https:// 开头的合法地址。";
      }
    } catch {
      return "头像链接格式不正确。";
    }
  }

  if (!draft.description.trim()) {
    return "请先填写简短介绍。";
  }

  if (!draft.contact.trim()) {
    return "请先填写称呼或联系方式。";
  }

  if (!draft.reciprocalLinkConfirmed) {
    return "请先在你的博客友链页加入 woodfish，再勾选确认。";
  }

  return "";
});

const issueUrl = computed(() =>
  buildFriendLinkIssueUrl({
    siteName: draft.siteName,
    siteUrl: draft.siteUrl,
    friendPageUrl: draft.friendPageUrl,
    avatarUrl: draft.avatarUrl,
    description: draft.description,
    contact: draft.contact,
    reciprocalLinkConfirmed: draft.reciprocalLinkConfirmed,
  }),
);

function handleSubmit() {
  if (validationMessage.value) {
    return;
  }

  showReminder.value = true;
}

function closeReminder() {
  showReminder.value = false;
}

function confirmIssueRedirect() {
  window.open(issueUrl.value, "_blank", "noopener,noreferrer");
  showReminder.value = false;
}
</script>

<template>
  <section
    data-testid="friend-application-card"
    class="friend-application-card"
    :class="{ 'is-writing': hasDraftStarted, 'is-confirming': showReminder }"
  >
    <div
      data-testid="friend-application-shine"
      class="friend-application-card__shine"
      aria-hidden="true"
    />
    <div
      class="friend-application-card__trail friend-application-card__trail--one"
      data-testid="friend-application-trail"
      aria-hidden="true"
    />
    <div
      class="friend-application-card__trail friend-application-card__trail--two"
      data-testid="friend-application-trail"
      aria-hidden="true"
    />
    <div
      class="friend-application-card__trail friend-application-card__trail--three"
      data-testid="friend-application-trail"
      aria-hidden="true"
    />
    <div class="friend-application-card__pin" aria-hidden="true" />
    <div
      data-testid="friend-application-stamp"
      class="friend-application-card__stamp"
      aria-hidden="true"
    >
      LINK
    </div>
    <div class="friend-application-card__inner">
      <div class="relative max-w-3xl">
        <div class="text-[11px] tracking-[0.18em] text-[var(--stage-hint-strong)]">提交友链</div>
        <h3 class="mt-2 text-2xl font-semibold text-[var(--stage-fg)]">投递你的站点</h3>
        <p class="mt-2 text-sm leading-6 text-[var(--stage-hint)]">
          请先把 woodfish 加入你的友链页，再打开预填好的 GitHub 提交草稿。
        </p>
      </div>

      <form class="relative mt-5 grid gap-3 md:grid-cols-2" @submit.prevent="handleSubmit">
        <div class="friend-application-prerequisite md:col-span-2">
          <div class="text-xs font-semibold text-[var(--stage-fg)]">先添加本站友链</div>
          <dl class="mt-2 grid gap-1.5 text-xs text-[var(--stage-hint)] sm:grid-cols-2">
            <div>
              <dt>名称</dt>
              <dd>woodfish</dd>
            </div>
            <div>
              <dt>链接</dt>
              <dd>https://woodfish.site/newBlog/</dd>
            </div>
            <div>
              <dt>头像</dt>
              <dd>https://pic1.imgdb.cn/item/682f3d1658cb8da5c807b704.jpg</dd>
            </div>
            <div>
              <dt>描述</dt>
              <dd>我喜欢你</dd>
            </div>
          </dl>
        </div>

        <label class="space-y-1.5">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">站点名称</span>
          <input
            v-model="draft.siteName"
            data-testid="friend-application-site-name"
            class="friend-application-input"
            name="siteName"
            type="text"
            placeholder="你的博客名"
          />
        </label>

        <label class="space-y-1.5">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">站点链接</span>
          <input
            v-model="draft.siteUrl"
            data-testid="friend-application-site-url"
            class="friend-application-input"
            name="siteUrl"
            type="url"
            placeholder="https://example.com"
          />
        </label>

        <label class="space-y-1.5">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">友链页链接</span>
          <input
            v-model="draft.friendPageUrl"
            data-testid="friend-application-friend-page-url"
            class="friend-application-input"
            name="friendPageUrl"
            type="url"
            placeholder="https://example.com/friends"
          />
        </label>

        <label class="space-y-1.5">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">头像链接</span>
          <input
            v-model="draft.avatarUrl"
            data-testid="friend-application-avatar-url"
            class="friend-application-input"
            name="avatarUrl"
            type="url"
            placeholder="https://example.com/avatar.png"
          />
        </label>

        <label class="space-y-1.5">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">称呼或联系方式</span>
          <input
            v-model="draft.contact"
            data-testid="friend-application-contact"
            class="friend-application-input"
            name="contact"
            type="text"
            placeholder="@woodfishhhh"
          />
        </label>

        <label class="space-y-1.5 md:col-span-2">
          <span class="text-xs tracking-[0.08em] text-[var(--stage-hint)]">简短介绍</span>
          <textarea
            v-model="draft.description"
            data-testid="friend-application-description"
            class="friend-application-input min-h-24 leading-6"
            name="description"
            placeholder="写一句网站主题或你想说的话。"
          />
        </label>

        <label class="friend-application-confirmation md:col-span-2">
          <input
            v-model="draft.reciprocalLinkConfirmed"
            data-testid="friend-application-reciprocal-confirmed"
            name="reciprocalLinkConfirmed"
            type="checkbox"
          />
          <span>我已经先在自己的博客友链页加入 woodfish，并确认这个友链页可以直接访问。</span>
        </label>

        <div class="md:col-span-2 flex flex-col gap-3">
          <p v-if="validationMessage" class="text-sm text-amber-500">
            {{ validationMessage }}
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <button
              data-testid="friend-application-submit"
              class="friend-application-submit"
              type="button"
              @click="handleSubmit"
            >
              生成提交草稿
            </button>
            <span class="text-xs text-[var(--stage-hint)]">仅前端生成，不需要令牌。</span>
          </div>
        </div>
      </form>

      <div
        v-show="showReminder"
        :aria-hidden="!showReminder"
        data-testid="friend-application-reminder"
        class="friend-application-reminder"
        :inert="!showReminder"
      >
        <div class="text-[11px] tracking-[0.16em] text-[var(--stage-hint-strong)]">确认跳转</div>
        <p class="mt-2 text-sm leading-6 text-[var(--stage-hint)]">
          将打开 GitHub 提交草稿，你可以检查内容后再提交。
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            data-testid="friend-application-confirm"
            class="friend-application-submit"
            type="button"
            @click="confirmIssueRedirect"
          >
            继续前往 GitHub
          </button>
          <button class="friend-application-secondary" type="button" @click="closeReminder">
            再检查一下
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.friend-application-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(76, 61, 43, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 253, 246, 0.82), rgba(250, 245, 232, 0.68)),
    var(--surface-soft);
  box-shadow: 0 24px 52px rgba(37, 28, 16, 0.16);
  transform: translateY(0);
  transition:
    border-color 220ms ease,
    box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  animation: friend-application-arrive 540ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  isolation: isolate;
}

.friend-application-card:hover,
.friend-application-card:focus-within {
  border-color: var(--border-strong);
  box-shadow: 0 30px 68px rgba(37, 28, 16, 0.22);
  transform: translateY(-5px);
}

.friend-application-card.is-writing {
  box-shadow:
    0 30px 68px rgba(37, 28, 16, 0.2),
    inset 0 0 0 1px rgba(53, 88, 204, 0.12);
}

.friend-application-card__inner {
  position: relative;
  z-index: 3;
  padding: 1.2rem;
}

.friend-application-card__shine {
  position: absolute;
  inset: -45% -80%;
  z-index: 2;
  background: linear-gradient(
    110deg,
    transparent 34%,
    rgba(255, 255, 255, 0.42) 48%,
    transparent 62%
  );
  opacity: 0;
  pointer-events: none;
  transform: translateX(-34%) rotate(12deg);
}

.friend-application-card:hover .friend-application-card__shine,
.friend-application-card:focus-within .friend-application-card__shine {
  animation: friend-application-shine 1100ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-application-card__trail {
  position: absolute;
  z-index: 0;
  height: 1px;
  width: 38%;
  background: linear-gradient(90deg, transparent, rgba(53, 88, 204, 0.28), transparent);
  opacity: 0.32;
  pointer-events: none;
  transform-origin: left center;
}

.friend-application-card__trail--one {
  top: 18%;
  left: -16%;
  transform: rotate(-12deg);
  animation: friend-application-trail 5.6s ease-in-out infinite;
}

.friend-application-card__trail--two {
  top: 46%;
  right: -18%;
  transform: rotate(9deg);
  animation: friend-application-trail 6.4s ease-in-out 700ms infinite reverse;
}

.friend-application-card__trail--three {
  bottom: 16%;
  left: 10%;
  transform: rotate(16deg);
  animation: friend-application-trail 7.2s ease-in-out 1300ms infinite;
}

.friend-application-card__pin {
  position: absolute;
  top: 0.7rem;
  left: 50%;
  z-index: 4;
  height: 0.6rem;
  width: 0.6rem;
  border-radius: 999px;
  background: rgba(155, 101, 24, 0.42);
  box-shadow: 0 2px 8px rgba(37, 28, 16, 0.24);
  transform: translateX(-50%);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-application-card:hover .friend-application-card__pin,
.friend-application-card:focus-within .friend-application-card__pin {
  transform: translateX(-50%) translateY(-1px) scale(1.16);
  animation: friend-application-pin 520ms ease;
}

.friend-application-card__stamp {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 4;
  border: 1px solid rgba(155, 101, 24, 0.34);
  border-radius: 8px;
  padding: 0.22rem 0.42rem;
  color: rgba(155, 101, 24, 0.66);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  opacity: 0.62;
  transform: rotate(8deg) scale(0.94);
  transition:
    color 220ms ease,
    opacity 220ms ease,
    transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-application-card.is-writing .friend-application-card__stamp,
.friend-application-card:hover .friend-application-card__stamp,
.friend-application-card:focus-within .friend-application-card__stamp {
  color: var(--accent);
  opacity: 0.9;
  transform: rotate(-4deg) scale(1);
}

.friend-application-input {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.36);
  padding: 0.55rem 0.7rem;
  color: var(--stage-fg);
  font-size: 0.82rem;
  outline: none;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.friend-application-input:focus {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(53, 88, 204, 0.1);
  transform: translateY(-1px);
}

.friend-application-prerequisite {
  border-left: 3px solid rgba(53, 88, 204, 0.36);
  padding-left: 0.85rem;
}

.friend-application-prerequisite dt {
  color: var(--stage-hint-strong);
  font-weight: 600;
}

.friend-application-prerequisite dd {
  overflow-wrap: anywhere;
}

.friend-application-confirmation {
  display: flex;
  gap: 0.62rem;
  align-items: flex-start;
  color: var(--stage-hint);
  font-size: 0.82rem;
  line-height: 1.65;
}

.friend-application-confirmation input {
  margin-top: 0.22rem;
  height: 1rem;
  width: 1rem;
  flex: 0 0 auto;
  accent-color: var(--accent);
}

.friend-application-submit,
.friend-application-secondary {
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.58rem 0.86rem;
  font-size: 0.82rem;
  transition:
    border-color 180ms ease,
    color 180ms ease,
    background 180ms ease;
}

.friend-application-submit {
  background: rgba(53, 88, 204, 0.12);
  color: var(--stage-fg);
  box-shadow: 0 10px 26px rgba(53, 88, 204, 0.08);
}

.friend-application-secondary {
  color: var(--stage-hint);
}

.friend-application-submit:hover,
.friend-application-secondary:hover {
  border-color: var(--border-strong);
  color: var(--stage-fg);
}

.friend-application-submit:hover {
  animation: friend-application-stamp 340ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-application-reminder {
  position: relative;
  margin-top: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.22);
  padding: 0.95rem;
}

:root[data-theme="night"] .friend-application-card {
  border-color: var(--border-subtle);
  background:
    linear-gradient(135deg, rgba(22, 28, 48, 0.72), rgba(12, 16, 32, 0.58)), var(--surface-soft);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}

:root[data-theme="night"] .friend-application-card:hover,
:root[data-theme="night"] .friend-application-card:focus-within {
  box-shadow: 0 32px 82px rgba(0, 0, 0, 0.36);
}

:root[data-theme="night"] .friend-application-card__pin {
  background: rgba(138, 178, 255, 0.44);
}

:root[data-theme="night"] .friend-application-card__stamp {
  border-color: rgba(138, 178, 255, 0.28);
  color: rgba(138, 178, 255, 0.62);
}

:root[data-theme="night"] .friend-application-input,
:root[data-theme="night"] .friend-application-reminder {
  background: rgba(8, 12, 24, 0.34);
}

@media (min-width: 768px) {
  .friend-application-card__inner {
    padding: 1.35rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .friend-application-card,
  .friend-application-card__pin,
  .friend-application-card__shine,
  .friend-application-card__stamp,
  .friend-application-card__trail,
  .friend-application-submit:hover {
    animation: none;
    transition: none;
  }

  .friend-application-card,
  .friend-application-card:hover,
  .friend-application-card:focus-within {
    transform: none;
  }
}

@keyframes friend-application-arrive {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes friend-application-shine {
  0% {
    opacity: 0;
    transform: translateX(-34%) rotate(12deg);
  }

  32% {
    opacity: 0.64;
  }

  100% {
    opacity: 0;
    transform: translateX(34%) rotate(12deg);
  }
}

@keyframes friend-application-pin {
  0%,
  100% {
    rotate: 0deg;
  }

  38% {
    rotate: -9deg;
  }

  70% {
    rotate: 7deg;
  }
}

@keyframes friend-application-stamp {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  52% {
    transform: translateY(2px) scale(0.96);
  }
}

@keyframes friend-application-trail {
  0%,
  100% {
    opacity: 0.18;
    translate: 0 0;
  }

  50% {
    opacity: 0.44;
    translate: 10px -2px;
  }
}
</style>
