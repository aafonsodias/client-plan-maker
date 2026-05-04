/**
 * BrandMark — internal app chrome (AppShell header, route headers under auth).
 * The Protocol P mark uses currentColor and inherits text-foreground, so it's
 * legible across all 3 themes (Dark / Slate / Cream). Amber under-glow ring
 * is the signature treatment. NEVER use in PDFs/print or on /auth bespoke plate.
 */
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { wrap: string; logo: string }> = {
  sm: { wrap: "h-10 w-10", logo: "h-9 w-9" },
  md: { wrap: "h-14 w-14", logo: "h-12 w-12" },
  lg: { wrap: "h-24 w-24", logo: "h-20 w-20" },
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
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center text-foreground",
        s.wrap,
        className,
      )}
      style={
        showGlow
          ? {
              filter:
                "drop-shadow(0 0 14px rgba(232,165,71,0.35)) drop-shadow(0 4px 10px rgba(232,165,71,0.25))",
            }
          : undefined
      }
    >
      <Logo className={s.logo} />
    </span>
  );
}
