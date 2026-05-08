import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Home, TrendingUp, History } from "lucide-react";

/**
 * Sticky bottom nav for the trainee cockpit. Mobile-first; on ≥sm it stays
 * but is centered + narrower to feel like a tab bar.
 * Preserves the `?as=` query when previewing so the trainer can navigate
 * across sub-routes without losing the preview context.
 */
export function MeBottomNav({ unreadCount: _unreadCount }: { unreadCount: number }) {
  const { t } = useTranslation("me");
  const location = useLocation();
  const search = location.searchStr ? `?${location.searchStr.replace(/^\?/, "")}` : "";

  const items = [
    { to: "/me", icon: Home, label: t("nav.today"), match: (p: string) => p === "/me" },
    {
      to: "/me/progresso",
      icon: TrendingUp,
      label: t("nav.progress"),
      match: (p: string) => p.startsWith("/me/progresso"),
    },
    {
      to: "/me/historico",
      icon: History,
      label: t("nav.history"),
      match: (p: string) => p.startsWith("/me/historico"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(location.pathname);
          return (
            <li key={item.to}>
              <a
                href={`${item.to}${search}`}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-[10px] font-medium uppercase tracking-widest transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5",
                    active ? "text-amber-600 dark:text-amber-400" : "",
                  ].join(" ")}
                />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}