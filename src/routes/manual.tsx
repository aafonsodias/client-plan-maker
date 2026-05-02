import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { BookOpen, ChevronRight, Sparkles, ClipboardList, Dumbbell, LineChart, Wallet, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manual")({
  component: ManualPage,
  head: () => ({
    meta: [
      { title: "Manual · Forge" },
      { name: "description", content: "Step-by-step manual: from sign up to interpreting training feedback." },
      { property: "og:title", content: "Manual · Forge" },
      { property: "og:description", content: "Step-by-step manual: from sign up to interpreting training feedback." },
    ],
  }),
});

type SectionKey = "start" | "intake" | "plan" | "logs" | "feedback" | "billing";

const SECTION_META: Record<SectionKey, { icon: typeof Rocket }> = {
  start: { icon: Rocket },
  intake: { icon: ClipboardList },
  plan: { icon: Dumbbell },
  logs: { icon: Sparkles },
  feedback: { icon: LineChart },
  billing: { icon: Wallet },
};

const SECTION_ORDER: SectionKey[] = ["start", "intake", "plan", "logs", "feedback", "billing"];

type Step = { h: string; p: string };

function ManualPage() {
  const { t } = useTranslation("manual");
  const [active, setActive] = useState<SectionKey>("start");

  const sections = useMemo(
    () =>
      SECTION_ORDER.map((key) => ({
        key,
        title: t(`sections.${key}.title`),
        intro: t(`sections.${key}.intro`),
        steps: (t(`sections.${key}.steps`, { returnObjects: true }) as Step[]) ?? [],
        Icon: SECTION_META[key].icon,
      })),
    [t],
  );

  const activeSection = sections.find((s) => s.key === active)!;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            {t("title")}
          </div>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Section nav */}
          <nav
            aria-label={t("tab_aria")}
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {sections.map((s) => {
              const Icon = s.Icon;
              const isActive = s.key === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(s.key)}
                  className={cn(
                    "group inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all lg:w-full",
                    isActive
                      ? "border-amber-400/50 bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-foreground shadow-[0_0_20px_-8px_oklch(0.78_0.14_75/0.6)]"
                      : "border-border bg-card/40 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-400" : "text-muted-foreground")} />
                  <span className="truncate font-medium">{s.title}</span>
                  <ChevronRight
                    className={cn(
                      "ml-auto hidden h-3.5 w-3.5 transition-transform lg:block",
                      isActive ? "translate-x-0 text-amber-400" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                    )}
                  />
                </button>
              );
            })}
          </nav>

          {/* Active section content */}
          <article className="min-w-0 rounded-xl border border-border bg-card/40 p-5 sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10">
                <activeSection.Icon className="h-4 w-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-foreground">{activeSection.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeSection.intro}</p>
              </div>
            </div>

            <ol className="space-y-4">
              {activeSection.steps.map((step, i) => (
                <li
                  key={`${active}-${i}`}
                  className="relative flex gap-4 rounded-lg border border-border/60 bg-background/40 p-4"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300 ring-1 ring-amber-400/40">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{step.h}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>

        <footer className="mt-10 rounded-lg border border-border bg-card/30 p-4 text-center text-xs text-muted-foreground">
          {t("footer_help")}
        </footer>

        <div className="mt-6 text-center">
          <Link
            to="/dashboard"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← {t("back_to_app")}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
