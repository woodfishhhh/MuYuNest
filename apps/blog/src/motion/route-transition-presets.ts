import gsap from "gsap";

export type PresetName = "focusPush" | "panelShift" | "softReturn";

export interface PresetVars {
  duration: number;
  blur: number;
  scaleFrom: number;
  yFrom: number;
  opacityFrom: number;
  ease: string;
}

export function getPresetVars(preset: PresetName, options: { reducedMotion: boolean }): PresetVars {
  if (options.reducedMotion) {
    const isPanelShift = preset === "panelShift";
    return {
      duration: preset === "softReturn" ? 0.22 : isPanelShift ? 0.16 : 0.3,
      blur: 0,
      scaleFrom: 1,
      yFrom: isPanelShift ? 0 : 6,
      opacityFrom: isPanelShift ? 0.65 : 0,
      ease: "power1.out",
    };
  }

  if (preset === "softReturn") {
    return {
      duration: 0.46,
      blur: 4,
      scaleFrom: 0.985,
      yFrom: 14,
      opacityFrom: 0.06,
      ease: "power2.out",
    };
  }

  if (preset === "panelShift") {
    return {
      duration: 0.28,
      blur: 0,
      scaleFrom: 1,
      yFrom: 0,
      opacityFrom: 0.55,
      ease: "power2.out",
    };
  }

  return {
    duration: 0.76,
    blur: 10,
    scaleFrom: 0.96,
    yFrom: 22,
    opacityFrom: 0.08,
    ease: "power3.out",
  };
}

export function playFocusPush(
  element: HTMLElement,
  options: { reducedMotion: boolean; preset?: PresetName },
) {
  const vars = getPresetVars(options.preset ?? "focusPush", {
    reducedMotion: options.reducedMotion,
  });

  gsap.killTweensOf(element);
  const hasTransform = vars.yFrom !== 0 || vars.scaleFrom !== 1;
  const filterFrom = vars.blur > 0 ? { filter: `blur(${vars.blur}px)` } : {};
  const filterTo = vars.blur > 0 ? { filter: "blur(0px)" } : {};
  const transformFrom = hasTransform ? { y: vars.yFrom, scale: vars.scaleFrom } : {};
  const transformTo = hasTransform ? { y: 0, scale: 1 } : {};
  const clearProps = [
    "opacity",
    ...(vars.blur > 0 ? ["filter"] : []),
    ...(hasTransform ? ["transform"] : []),
  ];
  return gsap.fromTo(
    element,
    {
      opacity: vars.opacityFrom,
      ...transformFrom,
      ...filterFrom,
    },
    {
      opacity: 1,
      ...transformTo,
      ...filterTo,
      duration: vars.duration,
      ease: vars.ease,
      clearProps: clearProps.join(","),
    },
  );
}

export function playBladeAccent(
  blade: HTMLElement,
  options: { reducedMotion: boolean; skip: boolean },
) {
  gsap.killTweensOf(blade);
  if (options.reducedMotion || options.skip) {
    gsap.set(blade, { opacity: 0, clearProps: "transform" });
    return null;
  }

  gsap.set(blade, { opacity: 0.78, xPercent: -120, skewX: -12 });
  return gsap.to(blade, {
    xPercent: 120,
    duration: 0.34,
    ease: "power2.inOut",
    onComplete: () => {
      gsap.set(blade, { opacity: 0, clearProps: "transform" });
    },
  });
}

export function playScrim(
  scrim: HTMLElement,
  options: { reducedMotion: boolean; subtle?: boolean },
) {
  const toOpacity = options.reducedMotion ? 0.08 : options.subtle ? 0.14 : 0.22;
  gsap.killTweensOf(scrim);
  gsap.set(scrim, { opacity: 0, pointerEvents: "none" });

  const timeline = gsap.timeline({
    onComplete: () => {
      gsap.set(scrim, { opacity: 0 });
    },
  });

  timeline.to(scrim, { opacity: toOpacity, duration: 0.16, ease: "power1.out" });
  timeline.to(scrim, { opacity: 0, duration: 0.22, ease: "power1.in" });
  return timeline;
}
