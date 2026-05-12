import { useEffect, useState } from "react";
import { ChevronsDown } from "lucide-react";

/**
 * Mobile-only scroll affordance. Fixed bottom-center, hides after first
 * scroll within the current mount. No persistence — returns on every fresh
 * mount/route change. Respects `prefers-reduced-motion`.
 */
export function ScrollCue({ bottomOffset = 24 }: { bottomOffset?: number }) {
  const [hidden, setHidden] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onMq = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onMq);
    const onScroll = () => {
      if (window.scrollY > 8) setHidden(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  if (hidden) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 md:hidden"
      style={{ bottom: bottomOffset }}
    >
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur",
          reduce ? "" : "animate-bounce",
        ].join(" ")}
      >
        <ChevronsDown className="h-4 w-4" />
      </div>
    </div>
  );
}
