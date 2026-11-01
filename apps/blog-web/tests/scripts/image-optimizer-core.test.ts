import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vite-plus/test";

import { optimizeImageAsset } from "../../../../packages/content-tools/src/image-optimizer-core.js";

describe("image-optimizer-core", () => {
  it("optimizes large raster assets in place and reports saved bytes", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-image-opt-"));
    const targetDir = path.join(tempRoot, "public", "remote-assets");
    const targetFile = path.join(targetDir, "hero.png");
    const width = 320;
    const height = 320;
    const rawPixels = Buffer.alloc(width * height * 3);

    for (let index = 0; index < rawPixels.length; index += 3) {
      rawPixels[index] = (index / 3) % 255;
      rawPixels[index + 1] = (index / 9) % 255;
      rawPixels[index + 2] = (index / 21) % 255;
    }

    await mkdir(targetDir, { recursive: true });
    await writeFile(
      targetFile,
      await sharp(rawPixels, {
        raw: {
          width,
          height,
          channels: 3,
        },
      })
        .png({ compressionLevel: 0 })
        .toBuffer(),
    );

    const before = await stat(targetFile);
    const result = await optimizeImageAsset(targetFile);
    const after = await stat(targetFile);

    expect(result.status).toBe("optimized");
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(after.size).toBeLessThan(before.size);
    expect((await readFile(targetFile)).byteLength).toBe(after.size);
  });

  it("skips unsupported image formats without changing the source file", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-image-opt-skip-"));
    const targetDir = path.join(tempRoot, "public", "remote-assets");
    const targetFile = path.join(targetDir, "vector.svg");
    const original =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#fff"/></svg>';

    await mkdir(targetDir, { recursive: true });
    await writeFile(targetFile, original, "utf8");

    const result = await optimizeImageAsset(targetFile);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("unsupported-format");
    expect(await readFile(targetFile, "utf8")).toBe(original);
  });
});
