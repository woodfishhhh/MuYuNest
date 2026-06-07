import { isSafeUrl } from "@/utils/input-validator";

export interface FriendLinkIssueInput {
  siteName: string;
  siteUrl: string;
  friendPageUrl: string;
  avatarUrl: string;
  description: string;
  contact: string;
}

export interface FriendLinkValidationResult {
  isValid: boolean;
  invalidFields: (keyof FriendLinkIssueInput)[];
}

export function validateFriendLinkInput(input: FriendLinkIssueInput): FriendLinkValidationResult {
  const invalidFields: (keyof FriendLinkIssueInput)[] = [];

  if (!input.siteName.trim()) {
    invalidFields.push("siteName");
  }

  if (!isSafeUrl(input.siteUrl)) {
    invalidFields.push("siteUrl");
  }

  if (!isSafeUrl(input.friendPageUrl)) {
    invalidFields.push("friendPageUrl");
  }

  if (input.avatarUrl && !isSafeUrl(input.avatarUrl)) {
    invalidFields.push("avatarUrl");
  }

  if (!input.description.trim()) {
    invalidFields.push("description");
  }

  if (!input.contact.trim()) {
    invalidFields.push("contact");
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields,
  };
}

const FRIEND_LINK_ISSUE_BASE_URL = "https://github.com/woodfishhhh/MuYuNest/issues/new";

export function buildFriendLinkIssueUrl(input: FriendLinkIssueInput) {
  const normalizedInput = normalizeInput(input);
  const params = new URLSearchParams({
    title: `[Friend Link] ${normalizedInput.siteName}`,
    body: buildFriendLinkIssueBody(normalizedInput),
  });

  return `${FRIEND_LINK_ISSUE_BASE_URL}?${params.toString()}`;
}

function buildFriendLinkIssueBody(input: FriendLinkIssueInput) {
  return [
    "## Friend Link Application",
    "",
    `- Site Name: ${input.siteName}`,
    `- Site URL: ${input.siteUrl}`,
    `- Friend Page URL: ${input.friendPageUrl}`,
    `- Avatar URL: ${input.avatarUrl}`,
    `- Short Description: ${input.description}`,
    `- Your Name / Contact: ${input.contact}`,
  ].join("\n");
}

function normalizeInput(input: FriendLinkIssueInput): FriendLinkIssueInput {
  return {
    siteName: input.siteName.trim(),
    siteUrl: input.siteUrl.trim(),
    friendPageUrl: input.friendPageUrl.trim(),
    avatarUrl: input.avatarUrl.trim(),
    description: input.description.trim(),
    contact: input.contact.trim(),
  };
}
