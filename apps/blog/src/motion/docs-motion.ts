import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(Flip, CustomEase);
CustomEase.create("docsReveal", "0.16, 1, 0.3, 1");

export const docsArrival = { fromPath: "" };
export const isDocsPath = (path: string) => /^\/(blog(?:\/|$)|posts\/)/.test(path);
export const reducedDocsMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function visibleDocsItems(root: HTMLElement) {
  const viewport = root.querySelector(".docs-main")?.getBoundingClientRect() ?? root.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>("[data-docs-item]")).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom;
  });
}

export function enterDocs(root: HTMLElement, brief: boolean) {
  root.classList.remove("docs-motion-pending");
  root.dataset.docsEntry = brief ? "brief" : "full";
  if (reducedDocsMotion()) {
    root.dataset.docsMotion = "idle";
    return () => {};
  }
  root.dataset.docsMotion = "entering";
  const q = gsap.utils.selector(root);
  const context = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { ease: "docsReveal" },
      onComplete: () => {
        root.dataset.docsMotion = "idle";
        context.revert();
        root.dispatchEvent(new Event("docs-motion-settled"));
      },
    });
    if (!brief) {
      tl.fromTo(
        q(".docs-sidebar"),
        { xPercent: -105, rotationY: -7, transformPerspective: 900, transformOrigin: "left center" },
        { xPercent: 0, rotationY: 0, duration: 0.64, ease: "back.out(0.45)" },
        0,
      );
      tl.fromTo(
        q(".docs-sidebar .docs-library-search, .docs-sidebar .docs-tree__home, .docs-sidebar .docs-tree__topic"),
        { x: -22, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: { each: 0.035, amount: 0.24 } },
        0.15,
      );
      tl.fromTo(
        q(".docs-entry-light"),
        { scaleY: 0.1, opacity: 0 },
        { scaleY: 1, opacity: 0.7, duration: 0.35 },
        0.1,
      ).to(q(".docs-entry-light"), { opacity: 0, duration: 0.35 }, 0.48);
      tl.fromTo(q(".docs-main"), { opacity: 0 }, { opacity: 1, duration: 0.32 }, 0.12);
      tl.fromTo(q(".docs-mobile-bar"), { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.08);
    }
    const start = brief ? 0 : 0.21;
    const duration = brief ? 0.32 : 0.55;
    tl.fromTo(
      q(".docs-intro, .article-hero"),
      { y: 26, clipPath: "inset(0 0 100% 0)" },
      { y: 0, clipPath: "inset(0 0 0% 0)", duration },
      start,
    );
    tl.fromTo(
      q(".docs-breadcrumb, .docs-search-panel, .article-view__content, .docs-status"),
      { opacity: 0 },
      { opacity: 1, duration },
      start,
    );
    const items = visibleDocsItems(root);
    if (items.length)
      tl.fromTo(
        items,
        { y: 26, opacity: 0, rotationX: -3, transformPerspective: 900 },
        { y: 0, opacity: 1, rotationX: 0, duration, stagger: { amount: brief ? 0.08 : 0.18 } },
        start + 0.07,
      );
    tl.fromTo(
      q(".docs-index-toc, .article-shell__rail"),
      { x: 18, opacity: 0, clipPath: "inset(0 0 100% 0)" },
      { x: 0, opacity: 1, clipPath: "inset(0 0 0% 0)", duration: brief ? 0.28 : 0.5 },
      brief ? 0.08 : 0.36,
    );
  }, root);
  return () => {
    context.revert();
    root.dataset.docsMotion = "idle";
  };
}

export function captureDocsLayout(root: HTMLElement) {
  return Flip.getState(visibleDocsItems(root));
}

export function rearrangeDocs(root: HTMLElement, state: ReturnType<typeof Flip.getState>, structural: boolean) {
  if (reducedDocsMotion()) return () => {};
  root.dataset.docsMotion = "switching";
  const items = visibleDocsItems(root);
  const context = gsap.context(() => {
    if (structural) {
      gsap.fromTo(
        root.querySelectorAll(".docs-intro, .docs-section-heading"),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, clearProps: "opacity,transform" },
      );
    }
    Flip.from(state, {
      targets: items,
      duration: 0.38,
      ease: "power3.out",
      stagger: 0.018,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.025, clearProps: "opacity,transform" },
        ),
      onComplete: () => {
        root.dataset.docsMotion = "idle";
      },
    });
  }, root);
  return () => {
    context.revert();
    root.dataset.docsMotion = "idle";
  };
}
