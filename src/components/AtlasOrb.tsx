/**
 * AtlasOrb — the living trigger for the Atlas copilot. Renders a small
 * conic-gradient orb that breathes (scale + brightness) and emits two
 * staggered aura pulses, so the copilot feels awake instead of like a
 * dead button. Mounts inline in the AppShell header next to ThemeToggle.
 * All animation is CSS-driven and respects prefers-reduced-motion.
 */
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  active?: boolean;
  className?: string;
  label?: string;
};

export function AtlasOrb({ onClick, active, className, label = "Atlas" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={`${label} — copiloto do Protocol`}
      className={cn(
        "group relative inline-flex h-9 w-9 items-center justify-center rounded-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* aura rings */}
      <span
        aria-hidden
        className="atlas-orb-aura pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent) 0%, transparent 70%)",
        }}
      />
      <span
        aria-hidden
        className="atlas-orb-aura2 pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--accent) 40%, transparent) 0%, transparent 70%)",
        }}
      />
      {/* outer ring */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full border transition",
          active ? "border-accent" : "border-accent/40 group-hover:border-accent/70",
        )}
      />
      {/* breathing core */}
      <span
        aria-hidden
        className="atlas-orb-core relative h-5 w-5 rounded-full shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_55%,transparent)]"
      >
        {/* highlight dot */}
        <span
          className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-white/70 blur-[0.5px]"
          aria-hidden
        />
      </span>
    </button>
  );
}