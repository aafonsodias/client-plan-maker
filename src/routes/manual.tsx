import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import {
  BookOpen,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Dumbbell,
  LineChart,
  Wallet,
  Rocket,
  HelpCircle,
  Mail,
  Plus,
  Minus,
  Send,
  Copy,
  Check as CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/manual")({
  component: ManualPage,
  head: () => ({
    meta: [
      { title: "Ajuda · Protocol" },
      { name: "description", content: "Manual passo-a-passo, perguntas frequentes e contacto directo com o fundador." },
      { property: "og:title", content: "Ajuda · Protocol" },
      { property: "og:description", content: "Manual passo-a-passo, perguntas frequentes e contacto directo com o fundador." },
    ],
  }),
});

type SectionKey = "start" | "intake" | "plan" | "logs" | "feedback" | "billing";
type Mode = "manual" | "faq" | "contact";

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
type FaqItem = { q: string; a: string };

function ManualPage() {
  const { t } = useTranslation("manual");
  const [mode, setMode] = useState<Mode>("manual");
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

  const modeTabs: { key: Mode; label: string; Icon: typeof BookOpen }[] = [
    { key: "manual", label: t("modes.manual"), Icon: BookOpen },
    { key: "faq", label: t("modes.faq"), Icon: HelpCircle },
    { key: "contact", label: t("modes.contact"), Icon: Mail },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              {t("title")}
            </div>
          </div>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
          {/* Mode switcher */}
          <div
            role="tablist"
            aria-label="Help mode"
            className="mt-5 inline-flex items-center gap-1 rounded-lg border border-border bg-card/40 p-1"
          >
            {modeTabs.map(({ key, label, Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setMode(key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-[0_0_0_1px_oklch(0.78_0.14_75/0.4)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {mode === "manual" && (
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
        )}

        {mode === "faq" && <FaqPanel />}
        {mode === "contact" && <ContactPanel />}

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

function FaqPanel() {
  const { t } = useTranslation("manual");
  const items = (t("faq.items", { returnObjects: true }) as FaqItem[]) ?? [];
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const toggle = (i: number) => {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  return (
    <section className="rounded-xl border border-border bg-card/40 p-5 sm:p-7">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10">
          <HelpCircle className="h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{t("faq.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("faq.subtitle")}</p>
        </div>
      </header>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/40">
        {items.map((item, i) => {
          const isOpen = open.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/30"
              >
                <span className="min-w-0 flex-1">{item.q}</span>
                {isOpen ? (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ContactPanel() {
  const { t } = useTranslation("manual");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const email = t("contact.email_value");

  const send = () => {
    const url = `mailto:${email}?subject=${encodeURIComponent(subject || "Protocol")}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success("Email copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não consegui copiar");
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5 sm:p-7">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10">
          <Mail className="h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{t("contact.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("contact.subtitle")}</p>
        </div>
      </header>

      {/* Direct email card */}
      <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("contact.email_label")}
          </p>
          <a
            href={`mailto:${email}`}
            className="block truncate text-sm font-medium text-foreground hover:text-amber-500"
          >
            {email}
          </a>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("contact.email_hint")}</p>
        </div>
        <button
          type="button"
          onClick={copyEmail}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </>
          )}
        </button>
      </div>

      {/* Form (mailto) */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("contact.form_subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("contact.form_subject_placeholder")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("contact.form_body")}
          </label>
          <AutoTextarea
            minRows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("contact.form_body_placeholder")}
            className="mt-1 text-sm"
          />
        </div>
        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">{t("contact.form_hint")}</p>
          <button
            type="button"
            onClick={send}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow-[0_0_20px_-8px_oklch(0.78_0.14_75/0.6)] hover:opacity-95"
          >
            <Send className="h-4 w-4" />
            {t("contact.form_send")}
          </button>
        </div>
      </div>
    </section>
  );
}
