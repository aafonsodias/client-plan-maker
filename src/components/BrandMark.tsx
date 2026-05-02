import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

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
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", s.wrap, className)}
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