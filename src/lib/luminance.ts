/**
 * Compute mean perceptual luminance of an image (0=black, 1=white),
 * ignoring near-transparent pixels. Browser-only (uses canvas).
 * Returns null if it cannot be computed.
 */
export async function computeImageLuminance(src: string): Promise<number | null> {
  if (typeof window === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    const max = 64;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 32) continue;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      // Rec. 709 luma
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      count++;
    }
    if (!count) return null;
    return sum / count;
  } catch {
    return null;
  }
}