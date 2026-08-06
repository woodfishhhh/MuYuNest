import { getBaseUrl } from "@/utils/base-url";

const ANALYTICS_HOSTNAME = "blog.woodfish.site";
const SESSION_STORAGE_KEY = "woodfish:analytics-session:v1";
const COLLECT_PATH = "api/analytics/collect";

type AnalyticsData = Record<string, boolean | number | string>;

interface AnalyticsPayload {
  data?: AnalyticsData;
  language?: string;
  name?: string;
  path: string;
  referrer?: string;
  sessionId: string;
  timezone?: string;
  title?: string;
  type: "event" | "pageview" | "performance";
}

function createSessionId() {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return stored;

    const next = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function sendPayload(payload: AnalyticsPayload) {
  const body = JSON.stringify({
    ...payload,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const url = `${getBaseUrl()}${COLLECT_PATH}`;

  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

function readDeclarativeEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>("[data-analytics-event]");
  if (!element?.dataset.analyticsEvent) return null;

  const data: AnalyticsData = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (!key.startsWith("analyticsEvent") || key === "analyticsEvent" || value === undefined) {
      continue;
    }
    const field = key.slice("analyticsEvent".length);
    if (!field) continue;
    data[`${field[0]?.toLowerCase()}${field.slice(1)}`] = value;
  }

  return { data, name: element.dataset.analyticsEvent };
}

interface WebMetric {
  name: "CLS" | "FCP" | "LCP" | "TTFB";
  rating: "good" | "needs-improvement" | "poor";
  value: number;
}

function metricRating(name: WebMetric["name"], value: number): WebMetric["rating"] {
  const thresholds = {
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    LCP: [2500, 4000],
    TTFB: [800, 1800],
  }[name];
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}

function metricData(metric: WebMetric): AnalyticsData {
  return {
    metric: metric.name,
    rating: metric.rating,
    value: Number(metric.value.toFixed(metric.name === "CLS" ? 4 : 1)),
  };
}

function observeWebMetrics(report: (metric: WebMetric) => void) {
  const reportValue = (name: WebMetric["name"], value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    report({ name, rating: metricRating(name, value), value });
  };

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation) reportValue("TTFB", navigation.responseStart);

  const firstContentfulPaint = performance.getEntriesByName("first-contentful-paint")[0];
  if (firstContentfulPaint) reportValue("FCP", firstContentfulPaint.startTime);

  let cls = 0;
  let lcp = 0;
  let flushed = false;
  const observers: PerformanceObserver[] = [];

  if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) cls += shift.value ?? 0;
      }
    });
    observer.observe({ buffered: true, type: "layout-shift" });
    observers.push(observer);
  }

  if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const entry = entries[entries.length - 1];
      if (entry) lcp = entry.startTime;
    });
    observer.observe({ buffered: true, type: "largest-contentful-paint" });
    observers.push(observer);
  }

  const flush = () => {
    if (flushed) return;
    flushed = true;
    observers.forEach((observer) => observer.disconnect());
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      reportValue("CLS", cls);
    }
    if (lcp > 0) reportValue("LCP", lcp);
  };
  window.addEventListener("pagehide", flush, { once: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") flush();
    },
    { once: true },
  );
}

export default defineNuxtPlugin((nuxtApp) => {
  if (
    window.location.hostname !== ANALYTICS_HOSTNAME ||
    navigator.doNotTrack === "1" ||
    navigator.doNotTrack === "yes"
  ) {
    return;
  }

  const router = useRouter();
  const sessionId = createSessionId();
  let lastTrackedPath = "";

  function currentPath() {
    return window.location.pathname;
  }

  function trackEvent(name: string, data?: AnalyticsData) {
    sendPayload({ data, name, path: currentPath(), sessionId, type: "event" });
  }

  function trackPageView() {
    const path = currentPath();
    if (path === lastTrackedPath) return;
    const isInitialPageView = lastTrackedPath === "";
    lastTrackedPath = path;
    sendPayload({
      path,
      referrer: isInitialPageView ? document.referrer : undefined,
      sessionId,
      title: document.title,
      type: "pageview",
    });
  }

  window.woodfishAnalytics = { track: trackEvent };

  const handleDeclarativeClick = (event: MouseEvent) => {
    const analyticsEvent = readDeclarativeEvent(event.target);
    if (analyticsEvent) trackEvent(analyticsEvent.name, analyticsEvent.data);
  };
  document.addEventListener("click", handleDeclarativeClick, true);

  nuxtApp.hook("app:mounted", () => {
    trackPageView();
    observeWebMetrics((metric) => {
      sendPayload({
        data: metricData(metric),
        name: "web-vital",
        path: currentPath(),
        sessionId,
        type: "performance",
      });
    });
  });

  router.afterEach(() => {
    queueMicrotask(trackPageView);
  });

});
