import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type Ref,
  type ShallowRef,
} from "vue";
import gsap from "gsap";

interface UseAuthorSliderOptions {
  active?: Readonly<Ref<boolean>>;
  viewportRef: Readonly<ShallowRef<HTMLElement | null>>;
  trackRef: Readonly<ShallowRef<HTMLElement | null>>;
}

const WHEEL_THRESHOLD = 42;
const TOUCH_THRESHOLD = 56;
const SLIDE_DURATION = 0.92;
const SCROLL_EDGE_EPSILON = 1;

interface ScrollableAncestorState {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

function getTargetElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  return target instanceof Node ? target.parentElement : null;
}

function getScrollableAncestorStates(
  target: EventTarget | null,
  boundary: HTMLElement | null,
): ScrollableAncestorState[] {
  let element = getTargetElement(target);
  if (!element || (boundary && !boundary.contains(element))) {
    return [];
  }

  const states: ScrollableAncestorState[] = [];
  while (element) {
    const style = window.getComputedStyle(element);
    const isScrollable = /^(auto|scroll|overlay)$/.test(style.overflowY);

    if (isScrollable && element.scrollHeight > element.clientHeight + SCROLL_EDGE_EPSILON) {
      states.push({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      });
    }

    if (element === boundary) {
      break;
    }
    element = element.parentElement;
  }

  return states;
}

function canScrollableStateConsumeGesture(state: ScrollableAncestorState, deltaY: number) {
  if (deltaY > 0) {
    const maxScrollTop = state.scrollHeight - state.clientHeight;
    return state.scrollTop < maxScrollTop - SCROLL_EDGE_EPSILON;
  }

  return deltaY < 0 && state.scrollTop > SCROLL_EDGE_EPSILON;
}

function canScrollableStatesConsumeGesture(states: ScrollableAncestorState[], deltaY: number) {
  return states.some((state) => canScrollableStateConsumeGesture(state, deltaY));
}

export function stepAuthorSlideIndex(currentIndex: number, direction: -1 | 1, totalSlides: number) {
  return Math.max(0, Math.min(totalSlides - 1, currentIndex + direction));
}

export function useAuthorSlider({ active, viewportRef, trackRef }: UseAuthorSliderOptions) {
  const activeIndex = shallowRef(0);

  let transitionTween: gsap.core.Tween | null = null;
  let gestureLocked = false;
  let touchStartY = 0;
  let touchStartTarget: EventTarget | null = null;
  let touchStartScrollableStates: ScrollableAncestorState[] = [];
  let unlockTimer: number | null = null;

  function isInteractionActive() {
    return active?.value ?? true;
  }

  function getSlides() {
    if (!trackRef.value) {
      return [] as HTMLElement[];
    }

    return Array.from(trackRef.value.querySelectorAll<HTMLElement>("[data-author-screen]"));
  }

  function animateReveal(index: number) {
    const slide = getSlides()[index];
    if (!slide) {
      return;
    }

    const targets = Array.from(slide.querySelectorAll<HTMLElement>("[data-author-reveal]"));
    if (targets.length === 0) {
      return;
    }

    gsap.killTweensOf(targets);
    gsap.fromTo(
      targets,
      {
        opacity: 0,
        y: 30,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: "power2.out",
        overwrite: "auto",
      },
    );
  }

  function syncPosition(index: number, immediate = false) {
    if (!trackRef.value) {
      return;
    }

    transitionTween?.kill();
    gestureLocked = true;
    activeIndex.value = index;
    if (unlockTimer !== null) {
      window.clearTimeout(unlockTimer);
      unlockTimer = null;
    }

    transitionTween = gsap.to(trackRef.value, {
      yPercent: -100 * index,
      duration: immediate ? 0 : SLIDE_DURATION,
      ease: immediate ? "none" : "power3.inOut",
      overwrite: true,
      onStart() {
        animateReveal(index);
      },
      onComplete() {
        transitionTween = null;
      },
    });

    unlockTimer = window.setTimeout(
      () => {
        gestureLocked = false;
        unlockTimer = null;
      },
      immediate ? 0 : Math.round(SLIDE_DURATION * 1000) + 60,
    );
  }

  function goToSlide(index: number) {
    const slides = getSlides();
    if (slides.length === 0) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(slides.length - 1, index));
    if (clampedIndex === activeIndex.value || gestureLocked) {
      return;
    }

    syncPosition(clampedIndex);
  }

  function step(direction: -1 | 1) {
    const slides = getSlides();
    if (slides.length === 0 || gestureLocked) {
      return;
    }

    const nextIndex = stepAuthorSlideIndex(activeIndex.value, direction, slides.length);

    if (nextIndex === activeIndex.value) {
      return;
    }

    syncPosition(nextIndex);
  }

  function handleWheel(event: WheelEvent) {
    if (!isInteractionActive()) {
      return;
    }

    if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) {
      return;
    }

    const scrollableStates = getScrollableAncestorStates(event.target, viewportRef.value);
    if (canScrollableStatesConsumeGesture(scrollableStates, event.deltaY)) {
      return;
    }

    event.preventDefault();
    step(event.deltaY > 0 ? 1 : -1);
  }

  function handleTouchStart(event: TouchEvent) {
    if (!isInteractionActive()) {
      touchStartTarget = null;
      touchStartScrollableStates = [];
      return;
    }

    touchStartY = event.touches[0]?.clientY ?? 0;
    touchStartTarget = event.target;
    touchStartScrollableStates = getScrollableAncestorStates(event.target, viewportRef.value);
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!isInteractionActive()) {
      touchStartTarget = null;
      touchStartScrollableStates = [];
      return;
    }

    const target = touchStartTarget;
    const scrollableStates = touchStartScrollableStates;
    touchStartTarget = null;
    touchStartScrollableStates = [];

    // If the touch started on a physics capsule, the user was dragging it — suppress page navigation.
    if (target instanceof Element && target.closest("[data-author-capsule]")) {
      return;
    }

    const touchEndY = event.changedTouches[0]?.clientY ?? touchStartY;
    const deltaY = touchStartY - touchEndY;
    if (Math.abs(deltaY) < TOUCH_THRESHOLD) {
      return;
    }

    if (canScrollableStatesConsumeGesture(scrollableStates, deltaY)) {
      return;
    }

    step(deltaY > 0 ? 1 : -1);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isInteractionActive()) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      step(1);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      step(-1);
    }
  }

  function cleanup() {
    transitionTween?.kill();
    transitionTween = null;
    gestureLocked = false;
    touchStartTarget = null;
    touchStartScrollableStates = [];
    if (unlockTimer !== null) {
      window.clearTimeout(unlockTimer);
      unlockTimer = null;
    }

    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("keydown", handleKeydown);
  }

  async function setup() {
    await nextTick();

    const viewport = viewportRef.value;
    const track = trackRef.value;
    if (!viewport || !track) {
      return;
    }

    cleanup();
    activeIndex.value = 0;
    gsap.set(track, { yPercent: 0 });
    animateReveal(0);

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKeydown);
  }

  onMounted(() => {
    void setup();
  });

  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    activeIndex,
    goToSlide,
  };
}
