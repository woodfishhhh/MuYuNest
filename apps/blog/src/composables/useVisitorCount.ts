import { shallowRef } from "vue";
import { getBaseUrl } from "@/utils/base-url";

const COUNTED_KEY = "vuecubeblog:visitor-counted:v1";
const VISITOR_ID_KEY = "vuecubeblog:visitor-id:v1";
const REGISTERED_KEY = "vuecubeblog:visitor-registered:v2";
const API_PATH = "api/visitor-count";
const LOCK_NAME = "vuecubeblog:visitor-count";

const total = shallowRef<number | null>(null);
const isLoading = shallowRef(false);
const hasError = shallowRef(false);
let pending: Promise<void> | undefined;

function readVisitor() {
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id || !/^[a-f0-9]{32}$/.test(id)) {
      id = crypto.randomUUID().replace(/-/g, "");
      // Persist before posting: retries must reuse the same identifier.
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return {
      id,
      registered: window.localStorage.getItem(REGISTERED_KEY) === id,
      counted: window.localStorage.getItem(COUNTED_KEY) === "1",
    };
  } catch {
    // Without persistent storage, read the total without creating repeat visitors.
    return undefined;
  }
}

async function loadCount() {
  const visitor = readVisitor();
  const shouldRegister = visitor && !visitor.registered;
  const response = await fetch(`${getBaseUrl()}${API_PATH}${shouldRegister ? "/visit" : ""}`, shouldRegister ? {
    method: "POST",
    headers: { "X-Visitor-ID": visitor.id, "X-Visitor-Counted": visitor.counted ? "1" : "0" },
  } : undefined);
  if (!response.ok) throw new Error(`Visitor count request failed: ${response.status}`);
  const payload = await response.json() as { total?: number };
  if (typeof payload.total !== "number" || !Number.isFinite(payload.total)) throw new Error("Invalid visitor count");
  total.value = payload.total;
  if (shouldRegister) {
    try {
      window.localStorage.setItem(COUNTED_KEY, "1");
      window.localStorage.setItem(REGISTERED_KEY, visitor.id);
    } catch {
      // The server already registered this ID, so retrying cannot increment again.
    }
  }
}

function hydrate() {
  if (pending) return pending;
  isLoading.value = true;
  hasError.value = false;
  const operation = typeof navigator !== "undefined" && navigator.locks
    // Other tabs re-read the registration marker after acquiring the same lock.
    ? navigator.locks.request(LOCK_NAME, loadCount)
    : loadCount();
  pending = Promise.resolve(operation).catch(() => {
    total.value = null;
    hasError.value = true;
  }).finally(() => {
    isLoading.value = false;
    pending = undefined;
  });
  return pending;
}

export function useVisitorCount() {
  return { total, isLoading, hasError, hydrate };
}
