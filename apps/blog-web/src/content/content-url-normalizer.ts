import { getBaseUrl } from "@/utils/base-url";

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function isHttpLikeUrl(value: string) {
  return /^(?:[a-z]+:)?\/\//i.test(value);
}

function hasBasePrefix(value: string, normalizedBasePath: string) {
  if (normalizedBasePath === "/") {
    return true;
  }

  return value === normalizedBasePath.slice(0, -1) || value.startsWith(normalizedBasePath);
}

function shouldPrefixRootRelativePath(value: string, normalizedBasePath: string) {
  return (
    value.startsWith("/") && !isHttpLikeUrl(value) && !hasBasePrefix(value, normalizedBasePath)
  );
}

function prefixWithBasePath(value: string, normalizedBasePath: string) {
  if (normalizedBasePath === "/") {
    return value;
  }

  return `${normalizedBasePath.slice(0, -1)}${value}`;
}

function looksLikeHtmlFragment(value: string) {
  return value.includes("<") && value.includes(">");
}

function normalizeStandaloneString(value: string, normalizedBasePath: string) {
  if (!shouldPrefixRootRelativePath(value, normalizedBasePath)) {
    return value;
  }

  return prefixWithBasePath(value, normalizedBasePath);
}

function normalizeHtmlFragment(html: string, normalizedBasePath: string) {
  if (typeof DOMParser === "undefined") {
    return html;
  }

  const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = document.body;

  root.querySelectorAll("[src], [href], [poster]").forEach((element) => {
    for (const attributeName of ["src", "href", "poster"]) {
      const rawValue = element.getAttribute(attributeName);
      if (!rawValue || !shouldPrefixRootRelativePath(rawValue, normalizedBasePath)) {
        continue;
      }

      element.setAttribute(attributeName, prefixWithBasePath(rawValue, normalizedBasePath));
    }
  });

  return root.innerHTML;
}

function normalizeContentValue(value: unknown, normalizedBasePath: string): unknown {
  if (typeof value === "string") {
    if (looksLikeHtmlFragment(value)) {
      return normalizeHtmlFragment(value, normalizedBasePath);
    }

    return normalizeStandaloneString(value, normalizedBasePath);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeContentValue(item, normalizedBasePath));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeContentValue(nestedValue, normalizedBasePath),
      ]),
    );
  }

  return value;
}

export function normalizeContentPayload<T>(value: T, basePath?: string): T {
  const resolvedBasePath = basePath ?? getBaseUrl();
  const normalizedBasePath = normalizeBasePath(resolvedBasePath);
  return normalizeContentValue(value, normalizedBasePath) as T;
}
