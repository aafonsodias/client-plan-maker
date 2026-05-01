import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Floating bottom-right button. Visible only when scrollY > 300.
 * Smooth-scrolls to top on click. No layout shift (fixed positioning).
 */
export function ScrollToTopButton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation("common");

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={t("actions.scroll_to_top", { defaultValue: "Scroll to top" })}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 right-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-all hover:bg-secondary",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
        className,
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}