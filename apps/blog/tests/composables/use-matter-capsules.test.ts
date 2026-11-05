import { mount } from "@vue/test-utils";
import {
  defineComponent,
  nextTick,
  shallowRef,
  useTemplateRef,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const matterState: {
  bodies: Array<Record<string, any>>;
  mouse: Record<string, any> | null;
  mouseConstraint: Record<string, any> | null;
} = {
  bodies: [],
  mouse: null,
  mouseConstraint: null,
};

const setPositionSpy = vi.fn(
  (body: Record<string, any>, position: { x: number; y: number }) => {
    body.position = { ...position };
  },
);

const setAngleSpy = vi.fn((body: Record<string, any>, angle: number) => {
  body.angle = angle;
});

function ensureEventStore(target: Record<string, any>) {
  target.__events ??= {};
  return target.__events as Record<string, Array<(event: unknown) => void>>;
}

function emitMatterEvent(target: Record<string, any> | null, eventName: string, event: unknown) {
  if (!target) {
    return;
  }

  const handlers = ensureEventStore(target)[eventName] ?? [];
  for (const handler of handlers) {
    handler(event);
  }
}

describe("useMatterCapsules", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  let rectSpy: ReturnType<typeof vi.spyOn>;
  let Harness: ReturnType<typeof defineComponent>;
  let frameCallback: FrameRequestCallback | null = null;

  beforeEach(async () => {
    matterState.bodies = [];
    matterState.mouse = null;
    matterState.mouseConstraint = null;
    openSpy.mockClear();
    setPositionSpy.mockClear();
    setAngleSpy.mockClear();
    frameCallback = null;
    vi.resetModules();
    vi.useFakeTimers();

    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;

    rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function mockRect(this: HTMLElement) {
        const x = Number(this.dataset.x ?? 0);
        const y = Number(this.dataset.y ?? 0);
        const width = Number(this.dataset.w ?? 160);
        const height = Number(this.dataset.h ?? 52);
        return {
          bottom: y + height,
          height,
          left: x,
          right: x + width,
          top: y,
          width,
          x,
          y,
          toJSON: () => ({}),
        } as DOMRect;
      });

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return Number((this as HTMLElement).dataset.w ?? 160);
      },
    });

    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return Number((this as HTMLElement).dataset.h ?? 52);
      },
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });

    vi.doMock("matter-js", () => {
      const Matter = {
        Engine: {
          create: (options: Record<string, unknown>) => ({
            options,
            world: { __events: {} },
            __events: {},
          }),
          clear: () => {},
          update: () => {},
        },
        Mouse: {
          create: (element: HTMLElement) => {
            const mouse = {
              element,
              mousedown: vi.fn(),
              mousemove: vi.fn(),
              mouseup: vi.fn(),
              mousewheel: vi.fn(),
              pixelRatio: 1,
            };

            element.addEventListener("mousemove", mouse.mousemove, { passive: true });
            element.addEventListener("mousedown", mouse.mousedown, { passive: true });
            element.addEventListener("mouseup", mouse.mouseup, { passive: true });
            element.addEventListener("wheel", mouse.mousewheel, { passive: false });
            element.addEventListener("touchmove", mouse.mousemove, { passive: false });
            element.addEventListener("touchstart", mouse.mousedown, { passive: false });
            element.addEventListener("touchend", mouse.mouseup, { passive: false });

            matterState.mouse = mouse;
            return mouse;
          },
          clearSourceEvents: () => {},
          setOffset: () => {},
        },
        MouseConstraint: {
          create: (_engine: unknown, options: Record<string, unknown>) => {
            matterState.mouseConstraint = {
              ...options,
              __events: {},
            };
            return matterState.mouseConstraint;
          },
        },
        Bodies: {
          rectangle: (
            x: number,
            y: number,
            width: number,
            height: number,
            options: Record<string, any> = {},
          ) => {
            const body = {
              position: { x, y },
              angle: 0,
              velocity: { x: 0, y: 0 },
              angularVelocity: 0,
              isStatic: Boolean(options.isStatic),
              __width: width,
              __height: height,
              __events: {},
              ...options,
            };
            matterState.bodies.push(body);
            return body;
          },
        },
        Body: {
          applyForce: () => {},
          setAngle: setAngleSpy,
          setAngularVelocity: (body: Record<string, any>, angularVelocity: number) => {
            body.angularVelocity = angularVelocity;
          },
          setPosition: setPositionSpy,
          setStatic: (body: Record<string, any>, isStatic: boolean) => {
            body.isStatic = isStatic;
          },
          setVelocity: (body: Record<string, any>, velocity: { x: number; y: number }) => {
            body.velocity = { ...velocity };
          },
        },
        Composite: {
          add: () => {},
          clear: () => {},
        },
        Events: {
          on: (
            target: Record<string, any>,
            eventName: string,
            handler: (event: unknown) => void,
          ) => {
            const store = ensureEventStore(target);
            store[eventName] ??= [];
            store[eventName].push(handler);
          },
          off: (target: Record<string, any>, eventName: string) => {
            const store = ensureEventStore(target);
            if (!eventName) {
              Object.keys(store).forEach((key) => delete store[key]);
              return;
            }
            delete store[eventName];
          },
        },
      };

      return {
        default: Matter,
      };
    });

    const { useMatterCapsules } = await import("@/composables/useMatterCapsules");
    Harness = defineComponent({
      setup() {
        const sceneRef = useTemplateRef<HTMLElement>("scene");
        const active = shallowRef(true);
        const skills = shallowRef([
          {
            title: "Vue",
            color: "#42b883",
            img: "/vue.png",
            officialUrl: "https://vuejs.org/",
          },
        ] as any);

        useMatterCapsules({
          active,
          sceneRef,
          skills,
        });

        return {
          skills,
        };
      },
      template: `
        <div
          ref="scene"
          data-scene
          data-w="800"
          data-h="600"
          style="position: relative; width: 800px; height: 600px;"
        >
          <button
            data-author-dropzone
            class="author-capsule"
            data-x="520"
            data-y="80"
            data-w="180"
            data-h="52"
            type="button"
          >
            <span class="author-capsule__label">这是什么?</span>
          </button>
          <button
            v-for="skill in skills"
            :key="skill.title"
            data-author-capsule
            class="author-capsule"
            data-w="160"
            data-h="52"
            type="button"
          >
            <span class="author-capsule__label">{{ skill.title }}</span>
          </button>
        </div>
      `,
    });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("opens the dragged capsule official url after it is released inside the snap target", async () => {
    mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    expect(capsuleBody).toBeTruthy();

    capsuleBody.position = {
      x: 610,
      y: 106,
    };

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    emitMatterEvent(matterState.mouseConstraint, "enddrag", { body: capsuleBody });
    await vi.advanceTimersByTimeAsync(200);

    expect(setPositionSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("https://vuejs.org/", "_blank", "noopener,noreferrer");
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("does not activate or launch when the capsule is near the target but not overlapping it", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    const dropzone = wrapper.get<HTMLElement>("[data-author-dropzone]").element;
    expect(capsuleBody).toBeTruthy();
    dropzone.dataset.w = "96";

    capsuleBody.position = {
      x: 439,
      y: 106,
    };

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    frameCallback?.(16);

    expect(dropzone.classList.contains("is-dropzone-visible")).toBe(true);
    expect(dropzone.classList.contains("is-snap-active")).toBe(false);

    emitMatterEvent(matterState.mouseConstraint, "enddrag", { body: capsuleBody });
    await vi.advanceTimersByTimeAsync(200);

    expect(setPositionSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("keeps snap preview visual-only while the mouse constraint is dragging", async () => {
    mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    expect(capsuleBody).toBeTruthy();

    capsuleBody.position = {
      x: 610,
      y: 106,
    };
    setPositionSpy.mockClear();

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    frameCallback?.(16);

    expect(setPositionSpy).not.toHaveBeenCalled();
  });

  it("keeps the dragged capsule under the pointer while the target handles the magnetic response", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    const capsuleElement = wrapper.get<HTMLElement>("[data-author-capsule]").element;
    const dropzoneElement = wrapper.get<HTMLElement>("[data-author-dropzone]").element;
    expect(capsuleBody).toBeTruthy();

    capsuleBody.position = {
      x: 540,
      y: 106,
    };

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    frameCallback?.(16);

    const translateX = Number(
      capsuleElement.style.transform.match(/translate\(([-\d.]+)px,/)?.[1],
    );
    const originalLeft = capsuleBody.position.x - 80;

    expect(translateX).toBeCloseTo(originalLeft, 1);
    expect(dropzoneElement.style.getPropertyValue("--dropzone-magnet-x")).not.toBe("");
  });

  it("straightens a grabbed capsule while it is being dragged", async () => {
    mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    expect(capsuleBody).toBeTruthy();
    capsuleBody.angle = 0.7;
    setAngleSpy.mockClear();

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    frameCallback?.(16);

    expect(setAngleSpy).toHaveBeenCalled();
    expect(Math.abs(capsuleBody.angle)).toBeLessThan(0.7);
  });

  it("keeps the dragged capsule visually level while it is inside the snap field", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const capsuleBody = matterState.bodies[4];
    const capsuleElement = wrapper.get<HTMLElement>("[data-author-capsule]").element;
    expect(capsuleBody).toBeTruthy();
    capsuleBody.position = {
      x: 610,
      y: 106,
    };
    capsuleBody.angle = 0.7;

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    frameCallback?.(16);

    expect(capsuleElement.style.transform).toContain("rotate(0rad)");
  });

  it("shows the target only while a capsule is being dragged and hides it when released outside the target", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const dropzone = wrapper.get<HTMLElement>("[data-author-dropzone]");
    const capsuleBody = matterState.bodies[4];
    expect(dropzone.element.classList.contains("is-dropzone-visible")).toBe(false);

    capsuleBody.position = {
      x: 120,
      y: 120,
    };

    emitMatterEvent(matterState.mouseConstraint, "startdrag", { body: capsuleBody });
    expect(dropzone.element.classList.contains("is-dropzone-visible")).toBe(true);

    emitMatterEvent(matterState.mouseConstraint, "enddrag", { body: capsuleBody });
    await vi.advanceTimersByTimeAsync(140);

    expect(dropzone.element.classList.contains("is-dropzone-visible")).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("detaches the previous Matter mouse listeners before rebuilding after resize", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const firstMouse = matterState.mouse;
    expect(firstMouse).toBeTruthy();

    window.dispatchEvent(new Event("resize"));
    await vi.advanceTimersByTimeAsync(200);
    await nextTick();

    const currentMouse = matterState.mouse;
    expect(currentMouse).not.toBe(firstMouse);
    firstMouse?.mousemove.mockClear();
    firstMouse?.mousedown.mockClear();
    firstMouse?.mouseup.mockClear();
    firstMouse?.mousewheel.mockClear();

    const scene = wrapper.get<HTMLElement>("[data-scene]").element;
    scene.dispatchEvent(new Event("mousemove"));
    scene.dispatchEvent(new Event("mousedown"));
    scene.dispatchEvent(new Event("mouseup"));
    scene.dispatchEvent(new Event("wheel", { cancelable: true }));
    scene.dispatchEvent(new Event("touchmove", { cancelable: true }));
    scene.dispatchEvent(new Event("touchstart", { cancelable: true }));
    scene.dispatchEvent(new Event("touchend", { cancelable: true }));

    expect(firstMouse?.mousemove).not.toHaveBeenCalled();
    expect(firstMouse?.mousedown).not.toHaveBeenCalled();
    expect(firstMouse?.mouseup).not.toHaveBeenCalled();
    expect(firstMouse?.mousewheel).not.toHaveBeenCalled();
  });

  it("leaves wheel scrolling to the page because capsule dragging does not use it", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const scene = wrapper.get<HTMLElement>("[data-scene]").element;
    const currentMouse = matterState.mouse;
    expect(currentMouse).toBeTruthy();
    currentMouse?.mousewheel.mockClear();

    const wheelEvent = new Event("wheel", { cancelable: true });
    scene.dispatchEvent(wheelEvent);

    expect(currentMouse?.mousewheel).not.toHaveBeenCalled();
    expect(wheelEvent.defaultPrevented).toBe(false);
  });

  it("detaches the current Matter mouse listeners when the composable unmounts", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const scene = wrapper.get<HTMLElement>("[data-scene]").element;
    const currentMouse = matterState.mouse;
    expect(currentMouse).toBeTruthy();
    currentMouse?.mousemove.mockClear();
    currentMouse?.mousedown.mockClear();
    currentMouse?.mouseup.mockClear();
    currentMouse?.mousewheel.mockClear();

    wrapper.unmount();

    scene.dispatchEvent(new Event("mousemove"));
    scene.dispatchEvent(new Event("mousedown"));
    scene.dispatchEvent(new Event("mouseup"));
    scene.dispatchEvent(new Event("wheel", { cancelable: true }));
    scene.dispatchEvent(new Event("touchmove", { cancelable: true }));
    scene.dispatchEvent(new Event("touchstart", { cancelable: true }));
    scene.dispatchEvent(new Event("touchend", { cancelable: true }));

    expect(currentMouse?.mousemove).not.toHaveBeenCalled();
    expect(currentMouse?.mousedown).not.toHaveBeenCalled();
    expect(currentMouse?.mouseup).not.toHaveBeenCalled();
    expect(currentMouse?.mousewheel).not.toHaveBeenCalled();
  });
});
