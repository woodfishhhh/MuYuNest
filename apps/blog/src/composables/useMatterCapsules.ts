import { nextTick, onBeforeUnmount, onMounted, watch, type ShallowRef } from "vue";
import Matter from "matter-js";

import { supportsContentLayout } from "@/utils/responsive";

type CapsuleSkill = {
  title: string;
  color: string;
  officialUrl: string;
};

interface UseMatterCapsulesOptions {
  active: Readonly<ShallowRef<boolean>>;
  sceneRef: Readonly<ShallowRef<HTMLElement | null>>;
  skills: Readonly<ShallowRef<CapsuleSkill[]>>;
}

interface CapsuleBody {
  body: Matter.Body;
  element: HTMLElement;
  initiallyStatic: boolean;
  released: boolean;
  width: number;
  height: number;
  skill: CapsuleSkill;
}

interface SnapPreview {
  locked: boolean;
  proximity: number;
  shouldSnap: boolean;
  strength: number;
  targetX: number;
  targetY: number;
}

type MatterMouseWithHandlers = Matter.Mouse & {
  mousedown: EventListener;
  mousemove: EventListener;
  mouseup: EventListener;
  mousewheel: EventListener;
};

const WALL_THICKNESS = 96;
const STEP_MS = 1000 / 60;
const SNAP_OPEN_DELAY_MS = 90;
const SNAP_VISUAL_MIN_STRENGTH = 0.08;
const SNAP_VISUAL_MAX_STRENGTH = 0.42;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDropzoneMetrics(container: HTMLElement, dropzone: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const dropzoneRect = dropzone.getBoundingClientRect();
  const localLeft = dropzoneRect.left - containerRect.left;
  const localTop = dropzoneRect.top - containerRect.top;

  return {
    centerX: localLeft + dropzoneRect.width / 2,
    centerY: localTop + dropzoneRect.height / 2,
    height: dropzoneRect.height,
    localLeft,
    localTop,
    width: dropzoneRect.width,
  };
}

export function useMatterCapsules({ active, sceneRef, skills }: UseMatterCapsulesOptions) {
  let engine: Matter.Engine | null = null;
  let mouseConstraint: Matter.MouseConstraint | null = null;
  let mouse: Matter.Mouse | null = null;
  let windowResizeHandler: (() => void) | null = null;
  let resizeTimer: number | null = null;
  let animationFrameId: number | null = null;
  let capsuleBodies: CapsuleBody[] = [];
  let lastTimestamp = 0;
  let accumulatedTime = 0;
  let suppressNextClick = false;
  let agitationTimer: number | null = null;
  let collisionHandler: ((event: Matter.IEventCollision<Matter.Engine>) => void) | null = null;
  let draggingBody: Matter.Body | null = null;
  let dropzoneElement: HTMLElement | null = null;
  let snapCandidate: CapsuleBody | null = null;
  let snapPreviewState: SnapPreview | null = null;
  let launchTimer: number | null = null;

  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function clearLaunchTimer() {
    if (launchTimer !== null) {
      window.clearTimeout(launchTimer);
      launchTimer = null;
    }
  }

  function clearSnapState() {
    dropzoneElement?.classList.remove("is-snap-active", "is-snap-locked");
    dropzoneElement?.style.removeProperty("--dropzone-magnet-x");
    dropzoneElement?.style.removeProperty("--dropzone-magnet-y");
    dropzoneElement?.style.removeProperty("--dropzone-magnet-scale");
    for (const capsule of capsuleBodies) {
      capsule.element.classList.remove("is-snap-preview", "is-snap-locked");
    }
    snapCandidate = null;
    snapPreviewState = null;
  }

  function detachMouseListeners() {
    if (!mouse) {
      return;
    }

    const matterMouse = mouse as MatterMouseWithHandlers;
    const element = matterMouse.element;
    element.removeEventListener("mousemove", matterMouse.mousemove);
    element.removeEventListener("mousedown", matterMouse.mousedown);
    element.removeEventListener("mouseup", matterMouse.mouseup);
    element.removeEventListener("wheel", matterMouse.mousewheel);
    element.removeEventListener("touchmove", matterMouse.mousemove);
    element.removeEventListener("touchstart", matterMouse.mousedown);
    element.removeEventListener("touchend", matterMouse.mouseup);
    Matter.Mouse.clearSourceEvents(mouse);
  }

  function setDropzoneVisible(visible: boolean) {
    dropzoneElement?.classList.toggle("is-dropzone-visible", visible);
  }

  function setSnapState(candidate: CapsuleBody | null, locked: boolean) {
    snapCandidate = candidate;
    dropzoneElement?.classList.toggle("is-snap-active", Boolean(candidate));
    dropzoneElement?.classList.toggle("is-snap-locked", Boolean(candidate) && locked);

    for (const capsule of capsuleBodies) {
      const isCandidate = capsule === candidate;
      capsule.element.classList.toggle("is-snap-preview", isCandidate);
      capsule.element.classList.toggle("is-snap-locked", isCandidate && locked);
    }
  }

  function setDropzoneMagnet(candidate: CapsuleBody, preview: SnapPreview) {
    if (!dropzoneElement) {
      return;
    }

    const targetPull = preview.strength * 0.12;
    const offsetX = clamp((candidate.body.position.x - preview.targetX) * targetPull, -18, 18);
    const offsetY = clamp((candidate.body.position.y - preview.targetY) * targetPull, -12, 12);

    dropzoneElement.style.setProperty("--dropzone-magnet-x", `${offsetX.toFixed(2)}px`);
    dropzoneElement.style.setProperty("--dropzone-magnet-y", `${offsetY.toFixed(2)}px`);
    dropzoneElement.style.setProperty(
      "--dropzone-magnet-scale",
      (1 + preview.proximity * 0.045).toFixed(3),
    );
  }

  function getCapsuleBody(body: Matter.Body | null) {
    if (!body) {
      return null;
    }

    return capsuleBodies.find((capsule) => capsule.body === body) ?? null;
  }

  function getSnapPreview(candidate: CapsuleBody) {
    const container = sceneRef.value;
    if (!container || !dropzoneElement) {
      return null;
    }

    const dropzone = getDropzoneMetrics(container, dropzoneElement);
    const targetX = dropzone.centerX;
    const targetY = dropzone.centerY;
    const distanceToCenter = Math.hypot(
      candidate.body.position.x - dropzone.centerX,
      candidate.body.position.y - dropzone.centerY,
    );
    const candidateLeft = candidate.body.position.x - candidate.width / 2;
    const candidateRight = candidate.body.position.x + candidate.width / 2;
    const candidateTop = candidate.body.position.y - candidate.height / 2;
    const candidateBottom = candidate.body.position.y + candidate.height / 2;
    const dropzoneRight = dropzone.localLeft + dropzone.width;
    const dropzoneBottom = dropzone.localTop + dropzone.height;
    const overlapX = Math.min(candidateRight, dropzoneRight) - Math.max(candidateLeft, dropzone.localLeft);
    const overlapY = Math.min(candidateBottom, dropzoneBottom) - Math.max(candidateTop, dropzone.localTop);
    const shouldSnap = overlapX > 0 && overlapY > 0;
    const overlapDepth = shouldSnap
      ? Math.min(
          overlapX / Math.min(candidate.width, dropzone.width),
          overlapY / Math.min(candidate.height, dropzone.height),
        )
      : 0;
    const centerFalloff = clamp(
      1 -
        distanceToCenter /
          Math.max(
            Math.hypot(candidate.width, candidate.height),
            Math.hypot(dropzone.width, dropzone.height),
          ),
      0,
      1,
    );
    const proximity = shouldSnap ? clamp(Math.max(overlapDepth, centerFalloff), 0, 1) : 0;
    const easedProximity = proximity * proximity * (3 - 2 * proximity);
    const strength = shouldSnap
      ? SNAP_VISUAL_MIN_STRENGTH +
        easedProximity * (SNAP_VISUAL_MAX_STRENGTH - SNAP_VISUAL_MIN_STRENGTH)
      : 0;

    return {
      locked: proximity > 0.82,
      proximity,
      shouldSnap,
      strength,
      targetX,
      targetY,
    };
  }

  function cleanup() {
    stopAnimation();
    clearLaunchTimer();
    clearSnapState();
    setDropzoneVisible(false);
    if (windowResizeHandler !== null) {
      window.removeEventListener("resize", windowResizeHandler);
      windowResizeHandler = null;
    }
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    if (agitationTimer !== null) {
      window.clearInterval(agitationTimer);
      agitationTimer = null;
    }

    if (mouseConstraint) {
      Matter.Events.off(mouseConstraint, "startdrag");
      Matter.Events.off(mouseConstraint, "enddrag");
      Matter.Events.off(mouseConstraint, "mousedown");
      Matter.Events.off(mouseConstraint, "mouseup");
    }

    detachMouseListeners();

    if (engine) {
      if (collisionHandler) {
        Matter.Events.off(engine, "collisionStart", collisionHandler);
        collisionHandler = null;
      }
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
    }

    mouseConstraint = null;
    mouse = null;
    engine = null;
    capsuleBodies = [];
    lastTimestamp = 0;
    accumulatedTime = 0;
    suppressNextClick = false;
    draggingBody = null;
    dropzoneElement = null;
  }

  function syncBodies() {
    for (const capsule of capsuleBodies) {
      const isDraggedCapsule = capsule.body === draggingBody;
      const snapPreview =
        isDraggedCapsule && capsule === snapCandidate ? snapPreviewState : null;
      const snapProximity = snapPreview?.shouldSnap ? snapPreview.proximity : 0;
      const angle = isDraggedCapsule && snapPreview?.shouldSnap ? 0 : capsule.body.angle;
      const scale = snapProximity > 0 ? ` scale(${1 + snapProximity * 0.012})` : "";

      capsule.element.style.transform = `translate(${capsule.body.position.x - capsule.width / 2}px, ${capsule.body.position.y - capsule.height / 2}px) rotate(${angle}rad)${scale}`;
    }
  }

  function setDraggingState(body: Matter.Body | null, dragging: boolean) {
    for (const capsule of capsuleBodies) {
      const active = capsule.body === body;
      capsule.element.style.zIndex = active && dragging ? "3" : "1";
      capsule.element.style.cursor = dragging ? "grabbing" : "grab";
      capsule.element.style.filter = active && dragging ? "brightness(1.06)" : "none";
    }
  }

  function releaseCapsule(capsule: CapsuleBody, impulse = true) {
    if (capsule.released) {
      return;
    }

    capsule.released = true;
    Matter.Body.setStatic(capsule.body, false);
    capsule.element.removeAttribute("data-author-fixed");
    capsule.element.classList.add("is-released");
    if (!impulse) {
      return;
    }

    Matter.Body.setVelocity(capsule.body, {
      x: (Math.random() - 0.5) * 4,
      y: 1.5 + Math.random() * 2,
    });
    Matter.Body.setAngularVelocity(capsule.body, (Math.random() - 0.5) * 0.16);
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function layoutStatic(container: HTMLElement) {
    const capsuleElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-author-capsule]"),
    );
    const bounds = container.getBoundingClientRect();
    const columns = bounds.width < 520 ? 2 : bounds.width < 900 ? 3 : 5;
    const gutter = 24;
    const colWidth = (bounds.width - gutter * 2) / columns;
    let freeBodyIndex = 0;

    for (const element of capsuleElements) {
      const isTitle = element.hasAttribute("data-author-fixed");
      const isMobile = !supportsContentLayout(bounds.width);
      const width = Math.max(element.offsetWidth, isTitle ? 260 : isMobile ? 60 : 120);
      if (isTitle) {
        const cx = Math.max(gutter, bounds.width * 0.32 - width / 2);
        element.style.transform = `translate(${cx}px, 48px)`;
        continue;
      }

      const row = Math.floor(freeBodyIndex / columns);
      const col = freeBodyIndex % columns;
      const x = Math.min(
        gutter + col * colWidth + (colWidth - width) / 2,
        bounds.width - width - gutter,
      );
      const y = 220 + row * 62;
      element.style.transform = `translate(${Math.max(gutter, x)}px, ${y}px)`;
      freeBodyIndex += 1;
    }
  }

  function tick(timestamp: number) {
    if (!engine) {
      return;
    }

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }

    accumulatedTime += Math.min(48, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    while (accumulatedTime >= STEP_MS) {
      Matter.Engine.update(engine, STEP_MS);
      accumulatedTime -= STEP_MS;
    }

    // Keep the magnetic pull visual-only while Matter's mouse constraint owns the drag.
    if (draggingBody) {
      const draggingCapsule = getCapsuleBody(draggingBody);
      const snapPreview = draggingCapsule ? getSnapPreview(draggingCapsule) : null;
      if (draggingCapsule && snapPreview?.shouldSnap) {
        snapPreviewState = snapPreview;
        setSnapState(draggingCapsule, snapPreview.locked);
        setDropzoneMagnet(draggingCapsule, snapPreview);
      } else {
        clearSnapState();
      }

      const angle = draggingBody.angle;
      const turns = Math.round(angle / (2 * Math.PI));
      const targetAngle = turns * 2 * Math.PI;
      Matter.Body.setAngle(draggingBody, angle + (targetAngle - angle) * 0.14);
      Matter.Body.setAngularVelocity(draggingBody, 0);
    }

    syncBodies();
    animationFrameId = requestAnimationFrame(tick);
  }

  function buildWorld(container: HTMLElement) {
    cleanup();

    if (prefersReducedMotion()) {
      layoutStatic(container);
      return;
    }

    const capsuleElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-author-capsule]"),
    );
    dropzoneElement = container.querySelector<HTMLElement>("[data-author-dropzone]");
    if (capsuleElements.length === 0) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: 0.5,
      },
      positionIterations: 10,
      velocityIterations: 6,
      constraintIterations: 4,
    });

    mouse = Matter.Mouse.create(container);
    // Explicitly correct for non-fullscreen scale and positions (like the 50vw panel layout).
    // This allows mouse clicks to map exactly to the physics bodies correctly within that constrained layout.
    const matterMouse = mouse as MatterMouseWithHandlers;
    // Capsule dragging does not use wheel input, so keep page scrolling available.
    matterMouse.element.removeEventListener("wheel", matterMouse.mousewheel);
    Matter.Mouse.setOffset(mouse, { x: 0, y: 0 }); // reset default offset
    mouse.pixelRatio = 1; // DO NOT set to window.devicePixelRatio for DOM nodes. DOM works in CSS pixels, otherwise click will be divided by DPR!
    mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.22,
        damping: 0.16,
        render: {
          visible: false,
        },
      },
    });

    const walls: Matter.Body[] = [
      Matter.Bodies.rectangle(
        bounds.width / 2,
        bounds.height + WALL_THICKNESS / 2,
        bounds.width + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        { isStatic: true },
      ),
      Matter.Bodies.rectangle(
        bounds.width / 2,
        -WALL_THICKNESS / 2,
        bounds.width + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        { isStatic: true },
      ),
      Matter.Bodies.rectangle(
        -WALL_THICKNESS / 2,
        bounds.height / 2,
        WALL_THICKNESS,
        bounds.height + WALL_THICKNESS * 2,
        { isStatic: true },
      ),
      Matter.Bodies.rectangle(
        bounds.width + WALL_THICKNESS / 2,
        bounds.height / 2,
        WALL_THICKNESS,
        bounds.height + WALL_THICKNESS * 2,
        { isStatic: true },
      ),
    ];

    const gutter = Math.min(40, bounds.width * 0.06);
    const usableWidth = Math.max(1, bounds.width - gutter * 2);
    capsuleBodies = capsuleElements.map((element, index) => {
      const initiallyStatic = element.hasAttribute("data-author-fixed");
      const isMobile = !supportsContentLayout(bounds.width);
      const width = Math.max(element.offsetWidth, initiallyStatic ? 288 : isMobile ? 60 : 120);
      const height = Math.max(element.offsetHeight, initiallyStatic ? 126 : isMobile ? 26 : 52);
      const staticX = Math.min(
        bounds.width - width / 2 - 24,
        Math.max(width / 2 + 28, bounds.width * 0.38),
      );
      const staticY = Math.min(bounds.height * 0.22, height / 2 + 48);

      // Scatter freely across full width with staggered vertical entry inside the viewport
      const x = initiallyStatic
        ? staticX
        : gutter + width / 2 + Math.random() * (usableWidth - width);

      const verticalSpread = bounds.height * 0.4;
      const y = initiallyStatic ? staticY : height / 2 + 10 + Math.random() * verticalSpread;

      const body = Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: initiallyStatic,
        restitution: 0.72,
        friction: 0.014,
        frictionStatic: 0,
        frictionAir: 0.012,
        density: 0.0018,
        slop: 0.05,
        chamfer: {
          radius: height / 2,
        },
      });

      if (!initiallyStatic) {
        Matter.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 1.8,
          y: 0.6 + Math.random() * 2.4,
        });
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06);
      }

      return {
        body,
        element,
        initiallyStatic,
        released: !initiallyStatic,
        width,
        height,
        skill: skills.value[index] ?? {
          title: element.getAttribute("aria-label") ?? "",
          color: "",
          officialUrl: "",
        },
      };
    });

    Matter.Composite.add(engine.world, [
      ...walls,
      ...capsuleBodies.map((capsule) => capsule.body),
      mouseConstraint,
    ]);

    collisionHandler = (event) => {
      for (const pair of event.pairs) {
        const capsuleA = capsuleBodies.find((capsule) => capsule.body === pair.bodyA);
        const capsuleB = capsuleBodies.find((capsule) => capsule.body === pair.bodyB);
        if (!capsuleA || !capsuleB) {
          continue;
        }

        if (capsuleA.initiallyStatic && !capsuleA.released && !capsuleB.initiallyStatic) {
          releaseCapsule(capsuleA);
        }
        if (capsuleB.initiallyStatic && !capsuleB.released && !capsuleA.initiallyStatic) {
          releaseCapsule(capsuleB);
        }
      }
    };
    Matter.Events.on(engine, "collisionStart", collisionHandler);

    agitationTimer = window.setInterval(() => {
      if (!engine || capsuleBodies.length === 0 || !active.value) {
        return;
      }

      const releasedCapsules = capsuleBodies.filter((capsule) => capsule.released);
      for (let index = 0; index < Math.min(2, releasedCapsules.length); index += 1) {
        const capsule = releasedCapsules[Math.floor(Math.random() * releasedCapsules.length)];
        Matter.Body.applyForce(capsule.body, capsule.body.position, {
          x: (Math.random() - 0.5) * 0.006,
          y: -0.002 - Math.random() * 0.003,
        });
      }
    }, 3600);

    Matter.Events.on(mouseConstraint, "startdrag", (event) => {
      const dragEvent = event as typeof event & { body: Matter.Body };
      const draggingCapsule = getCapsuleBody(dragEvent.body);
      clearLaunchTimer();
      clearSnapState();
      suppressNextClick = true;
      draggingBody = dragEvent.body;
      setDropzoneVisible(Boolean(draggingCapsule));
      setDraggingState(dragEvent.body, true);
    });

    Matter.Events.on(mouseConstraint, "enddrag", (event) => {
      const dragEvent = event as typeof event & { body: Matter.Body };
      const draggingCapsule = getCapsuleBody(dragEvent.body);
      const snapPreview = draggingCapsule ? getSnapPreview(draggingCapsule) : null;
      const shouldLaunch = Boolean(draggingCapsule && snapPreview?.shouldSnap);
      draggingBody = null;
      snapPreviewState = null;
      setDraggingState(dragEvent.body, false);

      if (draggingCapsule && snapPreview?.shouldSnap) {
        Matter.Body.setPosition(dragEvent.body, {
          x: snapPreview.targetX,
          y: snapPreview.targetY,
        });
        Matter.Body.setVelocity(dragEvent.body, { x: 0, y: 0 });
        Matter.Body.setAngle(dragEvent.body, 0);
        Matter.Body.setAngularVelocity(dragEvent.body, 0);
        setSnapState(draggingCapsule, true);
        syncBodies();

        if (draggingCapsule.skill.officialUrl) {
          clearLaunchTimer();
          launchTimer = window.setTimeout(() => {
            window.open(draggingCapsule.skill.officialUrl, "_blank", "noopener,noreferrer");
            clearSnapState();
            setDropzoneVisible(false);
            clearLaunchTimer();
          }, SNAP_OPEN_DELAY_MS);
        } else {
          window.setTimeout(() => {
            clearSnapState();
            setDropzoneVisible(false);
          }, SNAP_OPEN_DELAY_MS);
        }
      } else {
        clearSnapState();
        setDropzoneVisible(false);
      }

      window.setTimeout(() => {
        suppressNextClick = false;
        if (shouldLaunch && draggingCapsule && !draggingCapsule.skill.officialUrl) {
          clearSnapState();
          setDropzoneVisible(false);
        }
      }, 120);
    });

    Matter.Events.on(mouseConstraint, "mouseup", () => {
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 120);
    });

    windowResizeHandler = () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (sceneRef.value) {
          buildWorld(sceneRef.value);
        }
      }, 200);
    };
    window.addEventListener("resize", windowResizeHandler);

    syncBodies();
    animationFrameId = requestAnimationFrame(tick);
  }

  function activateSkill(index: number) {
    if (!engine || capsuleBodies.length === 0 || suppressNextClick) {
      return;
    }

    const target = capsuleBodies[index];
    if (!target) {
      return;
    }

    if (target.initiallyStatic && !target.released) {
      releaseCapsule(target);
      return;
    }

    Matter.Body.setVelocity(target.body, {
      x: (Math.random() - 0.5) * 9,
      y: -5.2 - Math.random() * 2.1,
    });
    Matter.Body.setAngularVelocity(target.body, (Math.random() - 0.5) * 0.28);

    for (const capsule of capsuleBodies) {
      if (capsule === target) {
        continue;
      }

      Matter.Body.applyForce(capsule.body, capsule.body.position, {
        x: (Math.random() - 0.5) * 0.018,
        y: -0.004 - Math.random() * 0.008,
      });
    }
  }

  async function setup() {
    await nextTick();
    if (!active.value || !sceneRef.value || skills.value.length === 0) {
      return;
    }

    buildWorld(sceneRef.value);
  }

  onMounted(() => {
    void setup();
  });

  watch(
    () => active.value,
    (nextActive) => {
      if (nextActive) {
        void setup();
        return;
      }

      cleanup();
    },
    { immediate: false },
  );

  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    activateSkill,
  };
}
