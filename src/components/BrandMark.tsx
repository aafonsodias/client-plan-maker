import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/forge-logo.png";

/**
 * Unified FORGE brand mark — the logo with the amber under-glow ring.
 * Use this everywhere the logo appears in app chrome (headers).
 * Footer/PDF/print contexts should pass `glow={false}` or use `<Logo />` directly.
 */
type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { wrap: string; logo: string }> = {
  sm: { wrap: "h-7 w-7", logo: "h-5 w-5" },
  md: { wrap: "h-9 w-9", logo: "h-7 w-7" },
  lg: { wrap: "h-12 w-12", logo: "h-9 w-9" },
};

// Cached so we only sample the logo image once per session.
let cachedLogoIsDark: boolean | null = null;

function detectLogoLuminance(): Promise<boolean> {
  if (cachedLogoIsDark !== null) return Promise.resolve(cachedLogoIsDark);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 16;
          c.height = 16;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve((cachedLogoIsDark = false));
          ctx.drawImage(img, 0, 0, 16, 16);
          const { data } = ctx.getImageData(0, 0, 16, 16);
          let lum = 0;
          let alpha = 0;
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] / 255;
            if (a < 0.1) continue;
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
            alpha += a;
          }
          const avg = alpha > 0 ? lum / alpha : 0.5;
          cachedLogoIsDark = avg < 0.45;
          resolve(cachedLogoIsDark);
        } catch {
          resolve((cachedLogoIsDark = false));
        }
      };
      img.onerror = () => resolve((cachedLogoIsDark = false));
      img.src = logoUrl as unknown as string;
    } catch {
      resolve((cachedLogoIsDark = false));
    }
  });
}

export function BrandMark({
  size = "md",
  glow,
  className,
}: {
  size?: Size;
  /** Defaults: md/lg → true, sm → false. */
  glow?: boolean;
  className?: string;
}) {
  const showGlow = glow ?? size !== "sm";
  const s = sizeMap[size];
  // When the logo itself is dark (e.g. user uploaded a black mark), sit it on
  // a warm cream plate in dark mode so it stays legible. Light/colourful logos
  // keep the original transparent treatment with the amber glow.
  const [logoIsDark, setLogoIsDark] = useState<boolean>(cachedLogoIsDark ?? false);
  useEffect(() => {
    if (cachedLogoIsDark === null) {
      void detectLogoLuminance().then(setLogoIsDark);
    }
  }, []);

  const platedBg = logoIsDark
    ? "bg-[oklch(0.94_0.04_85)] dark:bg-[oklch(0.94_0.04_85)]"
    : "";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        s.wrap,
        platedBg,
        className,
      )}
      style={
        showGlow
          ? {
              boxShadow:
                "0 0 0 1px rgba(232,165,71,0.18), 0 6px 22px -6px rgba(232,165,71,0.45)",
            }
          : undefined
      }
    >
      <Logo className={s.logo} />
    </span>
  );
}