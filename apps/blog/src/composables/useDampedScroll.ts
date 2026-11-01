import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";

// Wheel input moves a target; the page eases toward it each frame, which gives
// the scroll its weight. Touch, keyboard and the scrollbar stay native.
const DAMPING = 9;
const LINE_HEIGHT = 16;
const SETTLE_DISTANCE = 0.5;

export interface DampedScroll {
  scrollTo: (top: number) => void;
}

interface DampedScrollOptions {
  enabled: Readonly<Ref<boolean>>;
  /** Return true to leave a wheel event to whoever else wants it. */
  shouldIgnore?: (event: WheelEvent) => boolean;
}

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function useDampedScroll({ enabled, shouldIgnore }: DampedScrollOptions): DampedScroll {
  let target = 0;
  let current = 0;
  let frameId: number | null = null;
  let lastTime = 0;
  let listening = false;

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function step(time: number) {
    const delta = Math.min(0.05, lastTime ? (time - lastTime) / 1000 : 1 / 60);
    lastTime = time;
    current += (target - current) * (1 - Math.exp(-delta * DAMPING));
    if (Math.abs(target - current) < SETTLE_DISTANCE) current = target;
    window.scrollTo(0, current);
    frameId = current === target ? null : requestAnimationFrame(step);
  }

  function start() {
    if (frameId !== null) return;
    lastTime = 0;
    frameId = requestAnimationFrame(step);
  }

  function scrollTo(top: number) {
    if (!enabled.value) {
      window.scrollTo({ top, behavior: "smooth" });
      return;
    }
    if (frameId === null) current = window.scrollY;
    target = Math.min(maxScroll(), Math.max(0, top));
    start();
  }

  function handleWheel(event: WheelEvent) {
    if (event.defaultPrevented || event.ctrlKey || shouldIgnore?.(event)) return;
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_HEIGHT
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    event.preventDefault();
    if (frameId === null) current = window.scrollY;
    target = Math.min(maxScroll(), Math.max(0, target + event.deltaY * unit));
    start();
  }

  // Anything else that scrolls the page (keys, scrollbar, touch) becomes the new resting point.
  function handleScroll() {
    if (frameId === null) target = current = window.scrollY;
  }

  function setListening(next: boolean) {
    if (next === listening) return;
    listening = next;
    if (next) {
      target = current = window.scrollY;
      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      stop();
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
    }
  }

  onMounted(() => setListening(enabled.value));
  watch(enabled, (next) => setListening(next));
  onBeforeUnmount(() => setListening(false));

  return { scrollTo };
}
