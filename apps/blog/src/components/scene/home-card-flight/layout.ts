import type { DockRect } from "../blog-dock";
import { layoutFor } from "./motion";

export { layoutFor };

export function getHomeGeometryAnchor(viewport: DockRect): DockRect {
  const layout = layoutFor(viewport.width, viewport.height);
  const size = viewport.width > 767 ? 144 : 112;
  return {
    left: viewport.left + layout.smileX - size / 2,
    top: viewport.top + layout.smileY - size / 2,
    width: size,
    height: size,
  };
}

export function blendDockAnchors(home: DockRect, blog: DockRect, homeProgress: number, blogProgress: number): DockRect {
  const weight = blogProgress / Math.max(homeProgress + blogProgress, 0.001);
  return {
    left: home.left + (blog.left - home.left) * weight,
    top: home.top + (blog.top - home.top) * weight,
    width: home.width + (blog.width - home.width) * weight,
    height: home.height + (blog.height - home.height) * weight,
  };
}
