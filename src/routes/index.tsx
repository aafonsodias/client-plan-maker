import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileText, Users, Zap, ArrowRight, ClipboardCheck, ShieldCheck, RefreshCw, ArrowUp, Check, Sparkles, ClipboardList, FileSignature, LayoutGrid, CalendarDays, TrendingUp, LineChart, MessageSquare, Brain, MoreVertical, ChevronRight, Mic, Activity, Upload, X, Minus } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { WorkbenchMockup } from "@/components/landing/WorkbenchMockup";
import { LogbookInsightsMockup } from "@/components/landing/LogbookInsightsMockup";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { CurrencyMenu } from "@/components/CurrencyMenu";
import { PriceTag } from "@/components/PriceTag";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES } from "@/lib/currency";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation(["plan", "common"]);
  const { code: currencyCode } = useCurrency();
  const activeSymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? "€";
  const signedIn = !!user;
  // While Supabase rehydrates the persisted session on a hard refresh, the
  // user briefly looks "logged out" and we'd flash the marketing landing
  // before the AppShell guard kicks in. Show a neutral splash until the
  // session resolves so refreshing inside the app stays inside the app.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <BrandMark size="lg" />
      </div>
    );
  }
  const primaryCtaTo = signedIn ? "/dashboard" : "/auth";
  const primaryCtaLabel = signedIn
    ? t("plan:landing.hero.cta_primary_signed_in")
    : t("plan:landing.hero.cta_primary_signed_out");
  const closingCtaLabel = signedIn
    ? t("plan:landing.closing.cta_signed_in")
    : t("plan:landing.closing.cta_signed_out");
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <span className="sm:hidden"><BrandMark size="sm" /></span>
            <span className="hidden sm:inline-flex"><BrandMark size="md" /></span>
            <span className="truncate text-base sm:text-lg">{t("common:brand.name")}</span>
          </Link>
          {/* Desktop nav (≥ sm): full controls inline */}
          <nav className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
            <CurrencyMenu>
              <button
                type="button"
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-base font-medium text-muted-foreground transition hover:text-accent"
                aria-label={t("common:currency.title", "Currency")}
                title={t("common:currency.title", "Currency")}
              >
                <span aria-hidden>{activeSymbol}</span>
              </button>
            </CurrencyMenu>
            <LanguageSwitcher />
            <ThemeToggle />
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/dashboard">{t("common:actions.go_to_dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">{t("common:actions.sign_in")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">{t("common:actions.start_free")}</Link>
                </Button>
              </>
            )}
          </nav>
          {/* Mobile nav (< sm): primary CTA + overflow menu for prefs */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <Button asChild size="sm" className="h-8 px-3 text-xs">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? t("common:actions.go_to_dashboard") : t("common:actions.start_free")}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Preferências"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                {!signedIn && (
                  <Link
                    to="/auth"
                    className="mb-1 block rounded-md px-2 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    {t("common:actions.sign_in")}
                  </Link>
                )}
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-widest">{t("common:currency.title", "Currency")}</span>
                  <CurrencyMenu>
                    <button
                      type="button"
                      className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-border px-2 text-sm font-medium text-foreground hover:border-accent"
                    >
                      <span aria-hidden>{activeSymbol}</span>
                    </button>
                  </CurrencyMenu>
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-widest">{t("common:language.switch_aria")}</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-widest">Tema</span>
                  <ThemeToggle />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div
          className="absolute -right-32 top-20 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-accent)" }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 text-foreground sm:py-32 md:grid-cols-2">
          <div className="min-w-0">
            {/* Bold logo lockup — first element of the hero so the brand
              * mark is the anchor of the page, not a tiny nav glyph. */}
            <div className="mb-6 flex items-center gap-3">
              <BrandMark size="lg" />
              <span className="text-2xl font-light tracking-[0.3em] uppercase">
                {t("common:brand.name")}
              </span>
            </div>
            <h1 className="text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">
              {t("plan:landing.hero.title_line1")}
              <span className="block text-accent">{t("plan:landing.hero.title_line2")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light text-muted-foreground">
              {t("plan:landing.hero.subtitle")}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] uppercase tracking-widest text-accent/90">
              <Sparkles className="h-3 w-3" />
              {t("plan:landing.hero.social_proof")}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={primaryCtaTo}>
                  {primaryCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href="#how-it-works">{t("plan:landing.hero.cta_secondary")}</a>
              </Button>
            </div>
            {!signedIn && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Conta grátis · 1 cliente · 1 plano completo · sem cartão.</span>
                <a
                  href="/example-plan.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <FileText className="h-3 w-3" />
                  {t("plan:landing.benefits.example_link")}
                </a>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col items-center">
            <div className="relative origin-top scale-[0.95]">
              {/* Protocol glow — replaces the dark drop shadow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
                style={{ background: "radial-gradient(closest-side, oklch(0.78 0.14 75 / 0.32), transparent 70%)" }}
              />
              <div className="rounded-2xl ring-1 ring-amber-400/40 shadow-[0_0_40px_-10px_oklch(0.78_0.14_75/0.6)]">
                <HeroPlanMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits — three plain-language outcomes (PT-first) */}
      <section className="mx-auto max-w-6xl px-6 pt-4 pb-16">
        <p className="mb-6 text-xs uppercase tracking-widest text-accent">{t("plan:landing.benefits.eyebrow")}</p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Zap, title: t("plan:landing.benefits.time.title"), desc: t("plan:landing.benefits.time.desc") },
            { icon: LayoutGrid, title: t("plan:landing.benefits.consistency.title"), desc: t("plan:landing.benefits.consistency.desc") },
            { icon: ShieldCheck, title: t("plan:landing.benefits.confidence.title"), desc: t("plan:landing.benefits.confidence.desc") },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card/60 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-medium tracking-tight">{b.title}</h3>
              <p className="text-sm font-light text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <a
            href="/example-plan.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <FileText className="h-4 w-4" />
            {t("plan:landing.benefits.example_link")}
          </a>
        </div>
      </section>

      {/* Anti-ChatGPT — sharp positioning vs the obvious alternative */}
      <AntiChatGPTSection />

      {/* How it works — animated mock */}
      <section id="how-it-works" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.how_it_works.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.how_it_works.title")}</h2>
        </div>
        <HowItWorksAnimation />
      </section>

      {/* Comparison table — Protocol vs Excel vs ChatGPT vs Generic apps */}
      <ComparisonTableSection />

      {/* Programming tier badges — 3-tier methodology shown on landing */}
      <TierBadgesSection />

      {/* The journey — mirrors the 5 stages of the in-app generator */}
      <section id="journey" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.journey.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.journey.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.journey.subtitle")}</p>
        </div>
        <JourneyStrip />
      </section>

      {/* Mid-page repeat CTA — anchors the offer halfway down the page */}
      <MidCtaSection primaryCtaTo={primaryCtaTo} />

      {/* Credibility — built on the science */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-light tracking-tight">{t("plan:landing.credibility.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.credibility.subtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: ClipboardCheck, title: t("plan:landing.credibility.cards.parq_title"), desc: t("plan:landing.credibility.cards.parq_desc") },
            { icon: ShieldCheck, title: t("plan:landing.credibility.cards.acsm_title"), desc: t("plan:landing.credibility.cards.acsm_desc") },
            { icon: RefreshCw, title: t("plan:landing.credibility.cards.prochaska_title"), desc: t("plan:landing.credibility.cards.prochaska_desc") },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40 hover:shadow-[var(--shadow-elegant)]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-medium tracking-tight">{c.title}</h3>
              <p className="text-sm font-light text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Logbook preview — what comes AFTER the PDF (honest preview, "Soon" chip on graph).
        * Pairs the live set-log experience with a multi-week history grid so the two
        * panels feel distinct (no more duplicated mockups). */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.logbook_preview.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.logbook_preview.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.logbook_preview.subtitle")}</p>
        </div>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <div>
            <SetLogMockup />
            <p className="mt-3 text-center text-[11px] italic text-muted-foreground/70">{t("plan:landing.logbook_preview.log_caption")}</p>
          </div>
          <div>
            <div className="relative">
              <div className="absolute right-3 top-3 z-10 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                {t("common:currency.soon")}
              </div>
              <LogbookHistoryMockup />
            </div>
            <p className="mt-3 text-center text-[11px] italic text-muted-foreground/70">{t("plan:landing.logbook_preview.history_caption")}</p>
          </div>
        </div>
        {/* Trend chart: the long-arc story below the side-by-side preview */}
        <div className="mt-10">
          <div className="relative">
            <div className="absolute right-3 top-3 z-10 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
              {t("common:currency.soon")}
            </div>
            <ProgressionMockup />
          </div>
          <p className="mt-3 text-center text-[11px] italic text-muted-foreground/70">{t("plan:landing.logbook_preview.trend_caption")}</p>
        </div>
      </section>

      {/* Workbench — AI coaching assistant with model picker */}
      <section id="workbench" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.workbench.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.workbench.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.workbench.subtitle")}</p>
        </div>
        <WorkbenchMockup />
      </section>

      {/* Logbook intelligently read — AI-derived insights */}
      <section id="logbook-insights" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.logbook_insights.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.logbook_insights.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.logbook_insights.subtitle")}</p>
        </div>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <LogbookInsightsMockup />
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6">
            <p className="text-xs uppercase tracking-widest text-accent">Como funciona</p>
            <ul className="mt-4 space-y-3 text-sm text-foreground/85">
              <li>1. O cliente regista séries no logbook (web ou voz).</li>
              <li>2. A IA cruza volume, RPE e velocidade ao longo do tempo.</li>
              <li>3. Tu vês sinais accionáveis — e decides com contexto.</li>
            </ul>
            <p className="mt-4 text-[11px] italic text-muted-foreground/70">
              Os sinais são sugestões. A decisão é sempre tua.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.pricing.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.pricing.title")}</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Beta card */}
          <div className="relative rounded-2xl border border-accent/40 bg-card p-8 shadow-[var(--shadow-elegant)]">
            <div className="absolute right-6 top-6 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
              {t("plan:landing.pricing.beta_badge")}
            </div>
            <h3 className="text-xl font-medium">{t("plan:landing.pricing.beta_title")}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <PriceTag eur={0} className="text-4xl font-light tracking-tight" />
              <span className="text-sm text-muted-foreground">{t("plan:landing.pricing.beta_period")}</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {(t("plan:landing.pricing.beta_features", { returnObjects: true }) as string[]).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-foreground/85">{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 w-full">
              <Link to={primaryCtaTo}>{t("plan:landing.pricing.beta_cta")}</Link>
            </Button>
          </div>
          {/* Pro card */}
          <div className="relative rounded-2xl border border-border bg-card/60 p-8">
            <div className="absolute right-6 top-6 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("plan:landing.pricing.pro_badge")}
            </div>
            <h3 className="text-xl font-medium text-muted-foreground">{t("plan:landing.pricing.pro_title")}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <PriceTag eur={19} className="text-4xl font-light tracking-tight text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("plan:landing.pricing.pro_period")}</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {(t("plan:landing.pricing.pro_features", { returnObjects: true }) as string[]).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" variant="outline" className="mt-8 w-full">
              <a href="mailto:hello@forge.app?subject=Forge%20Pro%20-%20notify%20me">{t("plan:landing.pricing.pro_cta")}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-12 max-w-2xl text-4xl font-light tracking-tight">{t("plan:landing.features.title")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: t("plan:landing.features.intake_title"), desc: t("plan:landing.features.intake_desc") },
            { icon: Zap, title: t("plan:landing.features.ai_title"), desc: t("plan:landing.features.ai_desc") },
            { icon: FileText, title: t("plan:landing.features.pdf_title"), desc: t("plan:landing.features.pdf_desc") },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40 hover:shadow-[var(--shadow-elegant)]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-medium tracking-tight">{f.title}</h3>
              <p className="text-sm font-light text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap — honest "coming next" cards, no CTAs */}
      <section id="roadmap" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.roadmap.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.roadmap.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.roadmap.subtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: LineChart, title: t("plan:landing.roadmap.items.trends.title"), desc: t("plan:landing.roadmap.items.trends.desc") },
            { icon: MessageSquare, title: t("plan:landing.roadmap.items.prompt.title"), desc: t("plan:landing.roadmap.items.prompt.desc") },
            { icon: Brain, title: t("plan:landing.roadmap.items.advice.title"), desc: t("plan:landing.roadmap.items.advice.desc") },
          ].map((r) => (
            <div key={r.title} className="relative rounded-2xl border border-dashed border-border bg-card/40 p-6">
              <div className="absolute right-4 top-4 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                {t("common:currency.soon")}
              </div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent">
                <r.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-medium tracking-tight">{r.title}</h3>
              <p className="text-sm font-light text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        {t("plan:landing.roadmap.footnote") ? (
          <p className="mt-6 text-center text-xs italic text-muted-foreground/70">{t("plan:landing.roadmap.footnote")}</p>
        ) : null}
      </section>

      {/* Founder note — text-only, short and direct */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="text-[32px] font-light leading-tight tracking-tight">{t("plan:landing.founder.title")}</h2>
        <div className="mt-6 space-y-5 text-[17px] leading-[1.7] text-foreground/85">
          <p>{t("plan:landing.founder.p1")}</p>
          <p>{t("plan:landing.founder.p2")}</p>
          <p>{t("plan:landing.founder.p3")}</p>
        </div>
        <p className="mt-6 text-sm italic text-muted-foreground/70">{t("plan:landing.founder.signature")}</p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-2xl font-light tracking-tight sm:text-3xl">{t("plan:landing.faq.title")}</h2>
        <Accordion type="single" collapsible className="mt-8">
          {[
            { q: t("plan:landing.faq.q1_q"), a: t("plan:landing.faq.q1_a") },
            { q: t("plan:landing.faq.q2_q"), a: t("plan:landing.faq.q2_a") },
            { q: t("plan:landing.faq.q3_q"), a: t("plan:landing.faq.q3_a") },
            { q: t("plan:landing.faq.q4_q"), a: t("plan:landing.faq.q4_a") },
            { q: t("plan:landing.faq.q5_q"), a: t("plan:landing.faq.q5_a") },
            { q: t("plan:landing.faq.q6_q"), a: t("plan:landing.faq.q6_a") },
            { q: t("plan:landing.faq.q7_q"), a: t("plan:landing.faq.q7_a") },
            { q: t("plan:landing.faq.q8_q"), a: t("plan:landing.faq.q8_a") },
            { q: t("plan:landing.faq.q9_q"), a: t("plan:landing.faq.q9_a") },
            { q: t("plan:landing.faq.q10_q"), a: t("plan:landing.faq.q10_a") },
          ].map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-[1.7] text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Mission line */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="text-center text-[15px] leading-[1.7] text-muted-foreground">{t("plan:landing.mission")}</p>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center text-foreground sm:px-16">
          <div
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--gradient-accent)" }}
          />
          <h2 className="relative mx-auto max-w-2xl text-4xl font-light tracking-tight">{t("plan:landing.closing.title")}</h2>
          <p className="relative mx-auto mt-4 max-w-xl font-light text-muted-foreground">{t("plan:landing.closing.subtitle")}</p>
          <div className="relative mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link to={primaryCtaTo}>{closingCtaLabel}</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/30 py-12 text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6 grid gap-8 md:grid-cols-3">
          <div>
            <Link to="/" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-xs text-foreground">
              <BrandMark size="sm" />
              <span>{t("common:brand.name")}</span>
            </Link>
            <p className="mt-3 text-xs">{t("plan:landing.footer.tagline")}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/80">
              {t("plan:landing.footer.product_title")}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li><a href="#features" className="hover:text-foreground">{t("plan:landing.footer.product_features")}</a></li>
              <li><a href="#pricing" className="hover:text-foreground">{t("plan:landing.footer.product_pricing")}</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground">{t("plan:landing.footer.product_how")}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/80">
              {t("plan:landing.footer.legal_title")}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link to="/terms" className="hover:text-foreground">{t("plan:landing.footer.legal_terms")}</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground">{t("plan:landing.footer.legal_privacy")}</Link></li>
              <li><a href="mailto:hello@forge.app" className="hover:text-foreground">{t("plan:landing.footer.legal_contact")}</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl px-6 text-center text-xs text-muted-foreground/70">
          {t("plan:landing.footer_copy", { year: new Date().getFullYear() })}
        </div>
      </footer>
      <ScrollToTopButton />
    </div>
  );
}

function HowItWorksAnimation() {
  // Continuous loop stepper: clinical briefing → evidence-based programming → edit/print → feedback/adjust
  const { t } = useTranslation("plan");
  const StepIcons = [ClipboardList, Brain, FileText, RefreshCw];
  const steps = [
    { label: t("landing.how_it_works.steps.add_client.label"), desc: t("landing.how_it_works.steps.add_client.desc") },
    { label: t("landing.how_it_works.steps.assessment.label"), desc: t("landing.how_it_works.steps.assessment.desc") },
    { label: t("landing.how_it_works.steps.generate.label"), desc: t("landing.how_it_works.steps.generate.desc") },
    { label: t("landing.how_it_works.steps.export.label"), desc: t("landing.how_it_works.steps.export.desc") },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-12">
      <div
        className="absolute -right-32 top-0 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      {/* Connecting line — horizontal on sm+, vertical (dashed) on mobile */}
      <div className="relative">
        <div className="pointer-events-none absolute left-7 top-12 bottom-12 w-px bg-gradient-to-b from-accent/40 via-accent/20 to-accent/40 sm:hidden" />
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden h-px bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 sm:block" />

        <div className="relative grid gap-6 sm:grid-cols-4 sm:gap-4">
          {steps.map((s, i) => {
            const Icon = StepIcons[i] ?? ClipboardList;
            return (
              <div
                key={s.label}
                className="group relative flex gap-4 sm:flex-col sm:gap-3"
                style={{ animation: `fade-in 0.6s ease-out ${i * 120}ms both` }}
              >
                {/* Chevron between steps (sm+ only) */}
                {i > 0 && (
                  <ChevronRight
                    aria-hidden
                    className="pointer-events-none absolute -left-3 top-4 hidden h-4 w-4 text-accent/40 sm:block"
                    strokeWidth={2}
                  />
                )}
                {/* Numbered + iconed circle */}
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-accent shadow-[0_4px_14px_-6px_oklch(0.78_0.12_70/0.5)]">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent/60 bg-background text-[10px] font-bold text-accent">
                    {i + 1}
                  </span>
                </div>

                <div className="relative z-10 min-w-0 flex-1 sm:pt-1">
                  <p className="font-medium leading-tight">{s.label}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loop indicator — emphasises the continuous nature */}
      <div className="relative mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <RefreshCw className="h-3 w-3 text-accent" strokeWidth={1.5} />
        <span>{t("landing.how_it_works.eyebrow")} · ciclo contínuo</span>
      </div>
    </div>
  );
}

function FloatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-elegant)] ${className}`}
      style={{ animation: "forge-float 4s ease-in-out infinite" }}
    >
      {children}
      <style>{`
        @keyframes forge-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

function HeroPlanMockup() {
  const { t } = useTranslation("plan");
  // Two-week microcycle slice: shows W1 baseline → W2 deltas as the trainer
  // would see them in MesocycleTableView. Mixed deltas (load up, reps up,
  // one deload) deliberately avoid the "linear pump" look.
  type DeltaTone = "up" | "down" | "flat";
  type Row = { name: string; w1: string; w2: string; delta?: string; tone: DeltaTone };
  type Day = { label: string; focus: string; rows: Row[] };
  // 6 exercises/day = 4 compound + 2 accessory, agonist/antagonist balanced.
  // Day 1 (Lower + Pull): no axial loading because of the "lombar sensível" constraint.
  // W1 baseline starts at RPE 7 and progresses to RPE 8 in W2 (more honest than RPE 7→7).
  const days: Day[] = [
    {
      label: t("landing.mockups.day1_label"),
      focus: t("landing.mockups.day1_focus"),
      rows: [
        { name: t("landing.mockups.ex_goblet_squat"),   w1: "4×8 @RPE 7",  w2: "4×8 @RPE 8",   delta: "+4kg",   tone: "up" },
        { name: t("landing.mockups.ex_hip_thrust"),     w1: "4×8 @RPE 7",  w2: "4×8 @RPE 8",   delta: "+5kg",   tone: "up" },
        { name: t("landing.mockups.ex_chest_pull"),     w1: "4×8 @RPE 7",  w2: "4×9 @RPE 7.5", delta: "+1 rep", tone: "up" },
        { name: t("landing.mockups.ex_split_squat"),    w1: "3×10 @RPE 7", w2: "3×10 @RPE 8",  delta: "+2kg",   tone: "up" },
        { name: t("landing.mockups.ex_leg_curl"),       w1: "3×12 @RPE 7", w2: "3×12 @RPE 7",  delta: "hold",   tone: "flat" },
        { name: t("landing.mockups.ex_pallof"),         w1: "3×10/lado",   w2: "3×10/lado",    delta: "+pausa", tone: "up" },
      ],
    },
    {
      label: t("landing.mockups.day2_label"),
      focus: t("landing.mockups.day2_focus"),
      rows: [
        { name: t("landing.mockups.ex_db_bench"),       w1: "4×8 @RPE 7",  w2: "4×8 @RPE 8",   delta: "+2kg",   tone: "up" },
        { name: t("landing.mockups.ex_row"),            w1: "4×8 @RPE 7",  w2: "4×9 @RPE 7.5", delta: "+1 rep", tone: "up" },
        { name: t("landing.mockups.ex_overhead_press"), w1: "3×8 @RPE 7",  w2: "3×8 @RPE 8",   delta: "+1.5kg", tone: "up" },
        { name: t("landing.mockups.ex_pullup_assist"),  w1: "3×6 @RPE 8",  w2: "3×7 @RPE 8",   delta: "+1 rep", tone: "up" },
        { name: t("landing.mockups.ex_face_pull"),      w1: "3×12 @RPE 6", w2: "3×12 @RPE 7",  delta: "+1 RPE", tone: "up" },
        { name: t("landing.mockups.ex_farmer_carry"),   w1: "3×30m",       w2: "3×30m",        delta: "+4kg",   tone: "up" },
      ],
    },
  ];
  const toneClass = (tone: DeltaTone) => {
    if (tone === "up") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    if (tone === "down") return "bg-rose-500/10 text-rose-500 border-rose-500/30";
    return "bg-amber-500/10 text-amber-500 border-amber-500/30";
  };
  // Day-stripe accent: alternates the warmup-orange / activation-green palette
  // already used in SessionDayView so the mockup feels alive without going carnival.
  const dayStripe = (di: number) =>
    di === 0
      ? { borderColor: "oklch(0.78 0.12 70 / 0.45)", background: "oklch(0.78 0.12 70 / 0.10)" }
      : { borderColor: "oklch(0.72 0.13 160 / 0.45)", background: "oklch(0.72 0.13 160 / 0.10)" };
  return (
    <FloatCard>
      <div
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      {/* Client header */}
      <div className="flex items-center gap-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-[10px] font-bold text-accent">
          42
        </span>
        <span>{t("landing.mockups.client_header")}</span>
      </div>
      {/* Microcycle title + personalisation hint */}
      <div className="mt-3">
        <p className="text-base font-medium text-foreground">{t("landing.mockups.microcycle_title")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">
            <Sparkles className="h-3 w-3" /> {t("landing.mockups.personalized_hint")}
          </span>
          <span className="inline-flex max-w-full items-center rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-300/80">
            {t("landing.mockups.constraints_chip")}
          </span>
        </div>
      </div>
      <div className="my-4 h-px bg-border" />
      {/* 2-week microcycle slice */}
      <div className="overflow-hidden rounded-lg border border-border/60">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_64px] items-center gap-1 border-b border-border/60 bg-background/40 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>{t("landing.mockups.col_exercise")}</span>
          <span className="text-right">W1</span>
          <span className="text-right">W2</span>
          <span className="text-center">Δ</span>
        </div>
        {days.map((d, di) => (
          <div key={di}>
            <div
              className="flex items-center gap-2 border-b px-2 py-1.5"
              style={{ borderColor: dayStripe(di).borderColor, background: dayStripe(di).background }}
            >
              <span
                className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{
                  borderColor: dayStripe(di).borderColor,
                  background: "var(--card)",
                  color: dayStripe(di).borderColor.replace(" / 0.45", ""),
                }}
              >
                {d.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{d.focus}</span>
            </div>
            {d.rows.map((r, ri) => (
              <div
                key={ri}
                className="grid grid-cols-[minmax(0,1fr)_72px_72px_64px] items-center gap-1 border-b border-border/30 px-2 py-1.5 last:border-b-0 hover:bg-background/40"
              >
                <span className="truncate text-[12px] font-medium text-foreground">{r.name}</span>
                <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">{r.w1}</span>
                <span className="text-right font-mono text-[10px] tabular-nums text-foreground/85">{r.w2}</span>
                <span className="flex justify-center">
                  {r.delta && (
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${toneClass(r.tone)}`}>
                      {r.delta}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="mt-4 h-px bg-border" />
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
        <span>PROTOCOL</span>
        <span className="normal-case tracking-normal">{t("landing.mockups.personalized_for")}</span>
      </div>
    </FloatCard>
  );
}

function SetLogMockup() {
  const { t } = useTranslation("plan");
  const sets = [
    { label: t("landing.mockups.set_label", { n: 1 }), detail: "80kg × 6" },
    { label: t("landing.mockups.set_label", { n: 2 }), detail: "82.5kg × 6" },
    { label: t("landing.mockups.set_label", { n: 3 }), detail: "85kg × 5" },
  ];
  return (
    <FloatCard>
      <div
        className="absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-accent">{t("landing.mockups.back_squat_set_log")}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("landing.mockups.today_week")}</p>
      </div>
      <div className="mt-5 space-y-2 font-mono text-sm text-foreground/90">
        {sets.map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
            <span className="text-muted-foreground">{s.label}</span>
            <span>{s.detail}</span>
            <span className="text-accent">✓</span>
          </div>
        ))}
      </div>
      <div className="my-4 h-px bg-border/60" />
      <div className="flex items-center justify-between font-mono text-[12px] text-muted-foreground">
        <span>{t("landing.mockups.last_week_top")}</span>
        <span className="inline-flex items-center gap-1 text-accent">
          <ArrowUp className="h-3 w-3" /> +5kg
        </span>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
          {t("landing.mockups.save_session")}
        </button>
      </div>
    </FloatCard>
  );
}

function ProgressionMockup() {
  const { t } = useTranslation("plan");
  // Realistic arc: linear climb, deload at W4, push to PR at W6.
  const weights = [70, 72.5, 75, 70, 80, 85];
  const w = 280;
  const h = 90;
  const min = Math.min(...weights) - 2;
  const max = Math.max(...weights) + 2;
  const points = weights.map((v, i) => {
    const x = (i / (weights.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return { x, y, v };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("landing.mockups.back_squat_six_weeks")}</p>
      <div className="mt-5">
        <svg viewBox={`0 0 ${w} ${h + 8}`} className="w-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1.5" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/60">
          {weights.map((v, i) => (
            <span key={i}>W{i + 1}</span>
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-1.5 font-mono text-[12px] text-muted-foreground">
        <p>{t("landing.mockups.top_set_today")} <span className="text-foreground/90">85kg × 5</span></p>
        <p>{t("landing.mockups.pr_vs_week1")} <span className="text-accent">+15kg</span></p>
        <p>{t("landing.mockups.sessions_logged")} <span className="text-foreground/90">18</span></p>
      </div>
    </div>
  );
}

/**
 * LogbookHistoryMockup — multi-week history grid for one exercise's top sets.
 * Visually distinct from <SetLogMockup /> (today's session) and from
 * <ProgressionMockup /> (long-arc trend chart).
 */
function LogbookHistoryMockup() {
  const { t } = useTranslation("plan");
  const rows = [
    { week: "W1", load: "70 kg", reps: "5 / 5 / 5", note: "RPE 6" },
    { week: "W2", load: "72.5 kg", reps: "5 / 5 / 5", note: "RPE 7" },
    { week: "W3", load: "75 kg", reps: "5 / 5 / 4", note: "—" },
    { week: "W4", load: "77.5 kg", reps: "5 / 5 / 5", note: "deload near" },
    { week: "W5", load: "80 kg", reps: "5 / 4 / 4", note: "RPE 8" },
    { week: "W6", load: "82.5 kg", reps: "5 / 5 / 4", note: "PR" },
  ] as const;
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-accent">
          {t("landing.mockups.history_title", "Back squat — 6-week history")}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("landing.mockups.history_subtitle", "Top set per week")}
        </p>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-border/60">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="border-b border-border/60 bg-background/40 text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Wk</th>
              <th className="px-3 py-2 text-left font-medium">Load</th>
              <th className="px-3 py-2 text-left font-medium">Reps</th>
              <th className="px-3 py-2 text-right font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.week}
                className={
                  i === rows.length - 1
                    ? "bg-accent/5 text-foreground"
                    : "text-foreground/85"
                }
              >
                <td className="px-3 py-2 text-muted-foreground">{r.week}</td>
                <td className="px-3 py-2">{r.load}</td>
                <td className="px-3 py-2">{r.reps}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between font-mono text-[12px]">
        <span className="text-muted-foreground">{t("landing.mockups.delta_label", "Δ vs W1")}</span>
        <span className="inline-flex items-center gap-1 text-accent">
          <ArrowUp className="h-3 w-3" /> +12.5 kg
        </span>
      </div>
    </div>
  );
}

function JourneyStrip() {
  const { t } = useTranslation("plan");
  const stages = [
    { key: "intake", icon: ClipboardList },
    { key: "brief", icon: FileSignature },
    { key: "blueprint", icon: LayoutGrid },
    { key: "microcycle", icon: CalendarDays },
    { key: "progressions", icon: TrendingUp },
  ] as const;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
      <div
        className="absolute -left-32 top-0 h-72 w-72 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <ol className="relative grid gap-4 sm:grid-cols-5">
        {stages.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={s.key}
              className="group relative rounded-2xl border border-border bg-background/40 p-4 transition hover:border-accent/40"
              style={{ animation: `fade-in 0.5s ease-out ${i * 100}ms both` }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-[11px] font-semibold text-accent">
                  {i + 1}
                </div>
                <Icon className="h-4 w-4 text-accent/80" />
              </div>
              <p className="text-sm font-medium tracking-tight">
                {t(`landing.journey.stages.${s.key}.label`)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t(`landing.journey.stages.${s.key}.desc`)}
              </p>
              {i < stages.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-4 translate-x-full bg-gradient-to-r from-accent/50 to-transparent sm:block" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Anti-ChatGPT positioning ──────────────────────────────────────────
function AntiChatGPTSection() {
  const { t } = useTranslation("plan");
  const items = (t("landing.anti_chatgpt.items", { returnObjects: true }) as string[]) ?? [];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
        <p className="text-xs uppercase tracking-widest text-accent">
          {t("landing.anti_chatgpt.eyebrow")}
        </p>
        <h2 className="mt-2 max-w-3xl text-3xl font-light leading-tight tracking-tight sm:text-4xl">
          {t("landing.anti_chatgpt.title")}
        </h2>
        <p className="mt-4 max-w-2xl text-base font-light text-muted-foreground">
          {t("landing.anti_chatgpt.body")}
        </p>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("landing.anti_chatgpt.sections_label")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-foreground/85"
            >
              <ClipboardCheck className="h-3 w-3 text-accent" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison table ──────────────────────────────────────────────────
function ComparisonTableSection() {
  const { t } = useTranslation("plan");
  const headers = (t("landing.comparison.headers", { returnObjects: true }) as string[]) ?? [];
  const rows = (t("landing.comparison.rows", { returnObjects: true }) as string[][]) ?? [];

  function renderCell(value: string, colIdx: number) {
    if (colIdx === 0) return <span className="text-foreground/85">{value}</span>;
    if (value === "yes")
      return (
        <span className="inline-flex items-center justify-center text-emerald-400">
          <Check className="h-4 w-4" aria-label="yes" />
        </span>
      );
    if (value === "no")
      return (
        <span className="inline-flex items-center justify-center text-red-400/80">
          <X className="h-4 w-4" aria-label="no" />
        </span>
      );
    if (value === "—")
      return (
        <span className="inline-flex items-center justify-center text-muted-foreground/60">
          <Minus className="h-4 w-4" aria-label="n/a" />
        </span>
      );
    return <span className="text-xs text-muted-foreground">{value}</span>;
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-accent">
          {t("landing.comparison.eyebrow")}
        </p>
        <h2 className="mt-2 text-4xl font-light tracking-tight">
          {t("landing.comparison.title")}
        </h2>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest ${
                    i === 1 ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-border/60 last:border-0 ${
                  ri % 2 === 1 ? "bg-background/40" : ""
                }`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3 ${ci === 1 ? "bg-accent/[0.04]" : ""} ${
                      ci === 0 ? "" : "text-center"
                    }`}
                  >
                    {renderCell(cell, ci)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-xs italic text-muted-foreground/70">
        {t("landing.comparison.footnote")}
      </p>
    </section>
  );
}

// ─── Programming tier badges ───────────────────────────────────────────
function TierBadgesSection() {
  const { t } = useTranslation("plan");
  type TierKey = "remedial" | "conservative" | "advanced";
  const tiers: Array<{ key: TierKey; chip: string; dot: string }> = [
    { key: "remedial",     chip: "border-blue-500/40 bg-blue-500/10 text-blue-300",         dot: "bg-blue-400" },
    { key: "conservative", chip: "border-amber-500/40 bg-amber-500/10 text-amber-300",       dot: "bg-amber-400" },
    { key: "advanced",     chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-accent">
          {t("landing.tier_badges.eyebrow")}
        </p>
        <h2 className="mt-2 text-4xl font-light tracking-tight">
          {t("landing.tier_badges.title")}
        </h2>
        <p className="mt-4 text-base font-light text-muted-foreground">
          {t("landing.tier_badges.subtitle")}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className="rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40"
          >
            <div
              className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${tier.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
              {t(`landing.tier_badges.items.${tier.key}.name`)}
            </div>
            <p className="text-sm font-light text-muted-foreground">
              {t(`landing.tier_badges.items.${tier.key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Mid-page repeat CTA ───────────────────────────────────────────────
function MidCtaSection({ primaryCtaTo }: { primaryCtaTo: string }) {
  const { t } = useTranslation("plan");
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] px-6 py-8 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="text-2xl font-light tracking-tight">
            {t("landing.mid_cta.title")}
          </h3>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            {t("landing.mid_cta.subtitle")}
          </p>
        </div>
        <div className="mt-5 sm:mt-0">
          <Button asChild size="lg">
            <Link to={primaryCtaTo}>
              {t("landing.mid_cta.button")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
