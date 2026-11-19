export type AnalyticsEventData = Record<string, boolean | number | string>;

declare global {
  interface Window {
    woodfishAnalytics?: {
      track: (eventName: string, eventData?: AnalyticsEventData) => void;
    };
  }
}

export function trackAnalyticsEvent(eventName: string, eventData?: AnalyticsEventData) {
  if (typeof window === "undefined" || !window.woodfishAnalytics) return false;

  try {
    window.woodfishAnalytics.track(eventName, eventData);
    return true;
  } catch {
    return false;
  }
}
