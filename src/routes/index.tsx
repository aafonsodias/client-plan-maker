import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { detectRegionFromLocale, generateRoster, initialsFor } from "@/lib/names/regional-names";
import { pickDemoAvatar } from "@/lib/demo-avatars";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, ArrowUp, ClipboardCheck, Check, Sparkles, ClipboardList, FileSignature, LayoutGrid, CalendarDays, TrendingUp, MoreVertical, Mic, AlertTriangle, Activity, ChevronDown, LogOut } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LogbookInsightsMockup } from "@/components/landing/LogbookInsightsMockup";
import { PricingToggle } from "@/components/landing/PricingToggle";
import { PRICING_TIERS, priceFor, monthlyEquivalent, type Billing } from "@/lib/pricing-tiers";
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { t } = useTranslation(["plan", "common"]);
  const { code: currencyCode } = useCurrency();
  const activeSymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? "€";
  const signedIn = !!user;
  // CRITICAL: ALL hooks must run before any early return. Previously
  // `useState(billing)` lived after the `if (authLoading) return ...`
  // branch, so the hook count grew from 15 → 16 the moment Supabase
  // hydrated the session on a hard refresh, throwing
  // "Rendered more hooks than during the previous render."
  const [billing, setBilling] = useState<Billing>("annual");
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
                {signedIn && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={() => { void signOut(); }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("common:actions.sign_out")}
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden flex min-h-[100svh] flex-col justify-center md:block md:min-h-0">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div
          className="absolute -right-32 top-20 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-accent)" }}
        />
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 pt-6 pb-8 text-foreground sm:gap-12 sm:pt-16 sm:pb-32 md:grid-cols-2">
          <div className="min-w-0">
            <HeroHeadlineRotator />
            <p className="mt-6 max-w-xl text-lg font-light text-muted-foreground">
              {t("plan:landing.hero.subtitle")}
            </p>
            {/* PT-only positioning: 3 hard bullets */}
            <ul className="mt-6 space-y-2">
              {((t("plan:landing.hero.bullets", { returnObjects: true }) as string[]) ?? []).map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[11px] uppercase tracking-widest text-accent/90">
              <Sparkles className="h-3 w-3" />
              {t("plan:landing.hero.beta_softcap_chip")}
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
              {signedIn && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/plans/quick">
                    <Sparkles className="mr-2 h-4 w-4 text-accent" />
                    Experimente em 5 cliques
                  </Link>
                </Button>
              )}
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
          <div className="hidden min-w-0 flex-col items-center md:flex md:pt-8">
            <div className="relative w-full max-w-[560px] origin-top scale-[0.95]">
              {/* Protocol glow — replaces the dark drop shadow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
                style={{ background: "radial-gradient(closest-side, oklch(0.78 0.14 75 / 0.32), transparent 70%)" }}
              />
              <div className="w-full rounded-2xl ring-1 ring-amber-400/40 shadow-[0_0_40px_-10px_oklch(0.78_0.14_75/0.6)]">
                <HeroVisualRotator />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The journey — 5 stages of the in-app generator + tier chips inline */}
      <section id="how-it-works" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.journey.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.journey.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.journey.subtitle")}</p>
        </div>
        <JourneyStrip />
        <InlineTierChips />
      </section>

      {/* Workflow connector — what Protocol helps you connect (R70) */}
      <ComparisonTableSection />

      {/* Depois do PDF — fused logbook + AI insights */}
      <section id="logbook" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.logbook_preview.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.logbook_preview.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.logbook_preview.subtitle")}</p>
        </div>
        <div className="mx-auto max-w-md">
          <SetLogMockup />
          <p className="mt-3 text-center text-[11px] italic text-muted-foreground/70">{t("plan:landing.logbook_preview.log_caption")}</p>
        </div>
        <p className="mt-8 text-center text-xs italic text-muted-foreground/70">
          {t("plan:landing.logbook_preview.flow", "1. O cliente regista. 2. A IA cruza volume, RPE e tempo. 3. Você vê sinais e decide com contexto.")}
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.pricing.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.pricing.title")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("plan:landing.pricing.subtitle", "1 cliente = 1 plano completo grátis. Sem cartão.")}
          </p>
        </div>

        {/* Beta strip — full-width, low-noise so paid tiers are the focus */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="font-medium">{t("plan:landing.pricing.beta_strip_title", "Beta privado")}</span>
            <span className="text-muted-foreground">{t("plan:landing.pricing.beta_strip_body", "1 cliente · 1 plano completo grátis · sem cartão.")}</span>
          </div>
          <Button asChild size="sm" variant="default">
            <Link to={primaryCtaTo}>{t("plan:landing.pricing.beta_cta")}</Link>
          </Button>
        </div>

        <div className="mb-8 flex justify-center">
          <PricingToggle billing={billing} onChange={setBilling} />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const annualTotal = priceFor(tier, "annual");
            const monthlyShown = monthlyEquivalent(tier, billing);
            const yearlySavings = tier.monthly * 12 - tier.annual;
            const popular = !!tier.popular;
            const features = (t(`plan:landing.pricing.tiers.${tier.id}.features`, {
              returnObjects: true,
              defaultValue: [],
            }) as string[]) ?? [];
            const ctaLabel = t(`plan:landing.pricing.tiers.${tier.id}.cta`,
              tier.id === "studio" ? "Falar com o autor" : "Começar grátis");
            const isStudio = tier.id === "studio";
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-8 ${
                  popular
                    ? "border-accent/60 shadow-[var(--shadow-elegant)]"
                    : "border-border"
                }`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent/60 bg-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent-foreground">
                    {t("plan:landing.pricing.popular_badge", "Mais popular")}
                  </div>
                )}
                <h3 className="text-xl font-medium">{tier.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`plan:landing.pricing.tiers.${tier.id}.tagline`, "")}
                </p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <PriceTag eur={monthlyShown} className="text-4xl font-light tracking-tight" />
                  <span className="text-sm text-muted-foreground">
                    /{t("plan:landing.pricing.per_month", "mês")}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {billing === "annual"
                    ? t("plan:landing.pricing.billed_annually", "Faturado anualmente · €{{total}}/ano · poupa €{{savings}}", {
                        total: annualTotal,
                        savings: yearlySavings,
                      })
                    : t("plan:landing.pricing.billed_monthly", "Faturado mensalmente")}
                </p>
                <p className="mt-4 text-xs font-medium text-foreground/80">
                  {t("plan:landing.pricing.quota", "{{clients}} clientes · {{plans}} planos/mês", {
                    clients: tier.clients,
                    plans: tier.plansPerMonth,
                  })}
                </p>
                <ul className="mt-5 flex-1 space-y-3 text-sm">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  variant={popular ? "default" : "outline"}
                  className="mt-8 w-full"
                >
                  {isStudio ? (
                    <a href="mailto:hello@protocol.app?subject=Protocol%20Studio">{ctaLabel}</a>
                  ) : (
                    <Link to={primaryCtaTo}>{ctaLabel}</Link>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {t("plan:landing.pricing.trial_note")}
        </p>
      </section>

      {/* Founder note + inline roadmap chips */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="text-[32px] font-light leading-tight tracking-tight">{t("plan:landing.founder.title")}</h2>
        <div className="mt-6 space-y-5 text-[17px] leading-[1.7] text-foreground/85">
          <p>{t("plan:landing.founder.p1")}</p>
          <p>{t("plan:landing.founder.p2")}</p>
          <p>{t("plan:landing.founder.p3")}</p>
        </div>
        <p className="mt-6 text-sm italic text-muted-foreground/70">{t("plan:landing.founder.signature")}</p>
        <div className="mt-10 border-t border-border/60 pt-6">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("plan:landing.roadmap.eyebrow")} — {t("plan:landing.roadmap.subtitle")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {((t("plan:landing.roadmap.inline_chips", { returnObjects: true }) as string[]) ?? []).map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-foreground/85"
              >
                <Sparkles className="h-3 w-3 text-accent" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-2xl font-light tracking-tight sm:text-3xl">{t("plan:landing.faq.title")}</h2>
        <Accordion type="single" collapsible className="mt-8">
          {[
            { q: t("plan:landing.faq.q1_q"), a: t("plan:landing.faq.q1_a") },
            { q: t("plan:landing.faq.q2_q"), a: t("plan:landing.faq.q2_a") },
            { q: t("plan:landing.faq.q9_q"), a: t("plan:landing.faq.q9_a") },
            { q: t("plan:landing.faq.q13_q"), a: t("plan:landing.faq.q13_a") },
            { q: t("plan:landing.faq.q14_q"), a: t("plan:landing.faq.q14_a") },
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
              <li><a href="mailto:hello@protocol.app" className="hover:text-foreground">{t("plan:landing.footer.legal_contact")}</a></li>
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

function FloatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-elegant)] ${className}`}
      style={{ animation: "protocol-float 4s ease-in-out infinite" }}
    >
      {children}
      <style>{`
        @keyframes protocol-float {
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
        <div className="grid grid-cols-[minmax(0,1fr)_64px_60px] items-center gap-1 border-b border-border/60 bg-background/40 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid-cols-[minmax(0,1fr)_72px_72px_64px]">
          <span>{t("landing.mockups.col_exercise")}</span>
          <span className="hidden text-right sm:inline">W1</span>
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
                className="grid grid-cols-[minmax(0,1fr)_64px_60px] items-center gap-1 border-b border-border/30 px-2 py-1.5 last:border-b-0 hover:bg-background/40 sm:grid-cols-[minmax(0,1fr)_72px_72px_64px]"
              >
                <span className="truncate text-[12px] font-medium text-foreground">{r.name}</span>
                <span className="hidden text-right font-mono text-[10px] tabular-nums text-muted-foreground sm:inline">{r.w1}</span>
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
          <span className="block">{t("landing.anti_chatgpt.title_line1")}</span>
          <span className="block text-accent">{t("landing.anti_chatgpt.title_line2")}</span>
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

// ─── For whom — inclusivity + medical responsibility ───────────────────
function ForWhomSection() {
  const { t } = useTranslation("plan");
  const personas = (t("landing.for_whom.personas", { returnObjects: true }) as { title: string; body: string }[]) ?? [];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-accent">
          {t("landing.for_whom.eyebrow")}
        </p>
        <h2 className="mt-2 text-3xl font-light tracking-tight sm:text-4xl">
          {t("landing.for_whom.title")}
        </h2>
        <p className="mt-4 text-base font-light text-muted-foreground">
          {t("landing.for_whom.subtitle")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {personas.map((p, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">{p.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 text-sm leading-relaxed text-foreground/85">
        <p className="font-semibold text-amber-500">{t("landing.for_whom.medical_title")}</p>
        <p className="mt-1.5 text-muted-foreground">{t("landing.for_whom.medical_body")}</p>
      </div>
    </section>
  );
}

// ─── Who + Why — fusão das duas secções acima numa só (R59) ───────────
function WhoAndWhySection() {
  const { t } = useTranslation("plan");
  const personas = (t("landing.for_whom.personas", { returnObjects: true }) as { title: string; body: string }[]) ?? [];
  const items = (t("landing.anti_chatgpt.items", { returnObjects: true }) as string[]) ?? [];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
        {/* Quem */}
        <p className="text-xs uppercase tracking-widest text-accent">{t("landing.for_whom.eyebrow")}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-light tracking-tight sm:text-4xl">
          {t("landing.for_whom.title")}
        </h2>
        <p className="mt-3 max-w-2xl text-base font-light text-muted-foreground">
          {t("landing.for_whom.subtitle")}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {personas.map((p, i) => (
            <div key={i} className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="text-sm font-semibold text-foreground">{p.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm leading-relaxed">
          <p className="font-semibold text-amber-500">{t("landing.for_whom.medical_title")}</p>
          <p className="mt-1 text-muted-foreground">{t("landing.for_whom.medical_body")}</p>
        </div>

        {/* Divisor + Porquê */}
        <div className="mt-10 border-t border-border/60 pt-8">
          <p className="text-xs uppercase tracking-widest text-accent">
            {t("landing.anti_chatgpt.eyebrow")}
          </p>
          <h3 className="mt-2 max-w-3xl text-2xl font-light leading-tight tracking-tight sm:text-3xl">
            <span className="block">{t("landing.anti_chatgpt.title_line1")}</span>
            <span className="block text-accent">{t("landing.anti_chatgpt.title_line2")}</span>
          </h3>
          <p className="mt-3 max-w-2xl text-sm font-light text-muted-foreground">
            {t("landing.anti_chatgpt.body")}
          </p>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
      </div>
    </section>
  );
}

// ─── Workflow connector (R70) — replaces former competitor matrix ──────
function ComparisonTableSection() {
  const { t } = useTranslation("plan");
  const items = (t("landing.comparison.items", { returnObjects: true }) as { title: string; body: string }[]) ?? [];

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-[11px] font-semibold text-accent">
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-foreground">{it.title}</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs italic text-muted-foreground/70">
        {t("landing.comparison.footnote")}
      </p>
    </section>
  );
}

// ─── Inline programming tier chips (under JourneyStrip) ────────────────
function InlineTierChips() {
  const { t } = useTranslation("plan");
  type TierKey = "remedial" | "conservative" | "advanced";
  const tiers: Array<{ key: TierKey; chip: string; dot: string }> = [
    { key: "remedial",     chip: "border-blue-500/40 bg-blue-500/10 text-blue-300",         dot: "bg-blue-400" },
    { key: "conservative", chip: "border-amber-500/40 bg-amber-500/10 text-amber-300",       dot: "bg-amber-400" },
    { key: "advanced",     chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  ];
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-card/40 p-5">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {t("landing.tier_badges.eyebrow")} — {t("landing.tier_badges.subtitle")}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.key} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span
              className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${tier.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
              {t(`landing.tier_badges.items.${tier.key}.name`)}
            </span>
            <span className="leading-snug">{t(`landing.tier_badges.items.${tier.key}.desc`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}




// ─── Hero rotators ────────────────────────────────────────────────────
const HERO_ROTATE_MS = 6000;

function useHeroRotation(count: number) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % count), HERO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count]);
  return [idx, setIdx] as const;
}

function HeroHeadlineRotator() {
  const { t } = useTranslation("plan");
  const variants = (t("landing.hero.variants", { returnObjects: true }) as Array<{ line1: string; line2: string; audience: string }>) ?? [];
  const [idx, setIdx] = useHeroRotation(variants.length || 1);
  const v = variants[idx] ?? { line1: "", line2: "", audience: "" };
  return (
    <div>
      <div className="mb-3 min-h-[24px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80" />
          {v.audience}
        </span>
      </div>
      <div className="min-h-[200px] sm:min-h-[290px]">
        <h1 key={idx} className="animate-fade-in text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">
          {v.line1}
          <span className="block text-accent">{v.line2}</span>
        </h1>
      </div>
      {variants.length > 1 && (
        <div className="mt-4 flex gap-1.5" aria-label="Hero variants">
          {variants.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Variant ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1 rounded-full transition-all ${i === idx ? "w-8 bg-accent" : "w-3 bg-border hover:bg-muted-foreground/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroVisualRotator() {
  // PT-only positioning (R61): single hero visual = the actual plan output.
  // CoachWorkbench/SoloTrainer mockups removed from the rotation; kept in
  // file in case we add a /for-clients page later.
  const slides = [<HeroPlanMockup />];
  const idx = 0;
  return (
    // Active slide drives container height (relative); inactive slides stack
    // absolutely on top for the cross-fade. This eliminates the empty space
    // inside the amber ring when slides have different natural heights.
    <div className="relative w-full">
      {slides.map((slide, i) => (
        <div
          key={i}
          aria-hidden={i !== idx}
          className={`transition-opacity duration-700 ${
            i === idx
              ? "relative opacity-100"
              : "pointer-events-none absolute inset-0 opacity-0"
          }`}
        >
          {slide}
        </div>
      ))}
    </div>
  );
}

// ─── Coach workbench mockup (variant 2: founder/PT origin) ─────────────
type MockClient = {
  name: string;
  initials: string;
  photo: string;
  phase: { label: string; cls: string };
  block?: string;
  cvd?: { label: string; tone: "ok" | "warn" | "bad" };
  recovery?: { pct: number; tone: "ok" | "warn" | "bad" };
  status: { text: string; tone: "ok" | "warn" | "neutral" };
};

function CoachWorkbenchMockup() {
  const { t, i18n } = useTranslation("plan");
  const pr = (k: string, fb: string) => t(`landing.mockups.protocol_rail.${k}`, { defaultValue: fb }) as string;
  // Region-aware roster: pick a probability-weighted name pool for the
  // viewer's locale so a Brazilian/Indian/Nigerian visitor doesn't see five
  // Portuguese strangers. See `src/lib/names/regional-names.ts`.
  const slots = useMemo(() => {
    const region = detectRegionFromLocale(i18n.language);
    const roster = generateRoster({ region, count: 5, seed: `landing::${region}` });
    const cvdLow = t("landing.mockups.protocol_rail.cvd_low", { defaultValue: "Risco CV baixo" }) as string;
    const phases = [
      { phase: { label: t("landing.mockups.protocol_rail.phase.intake", { defaultValue: "Intake enviado — a aguardar cliente" }) as string, cls: "bg-accent/10 text-accent/90 border border-accent/30" }, status: { text: t("landing.mockups.protocol_rail.status.assessment_pending", { defaultValue: "Avaliação por concluir" }) as string, tone: "neutral" as const } },
      { phase: { label: t("landing.mockups.protocol_rail.phase.active_block", { defaultValue: "Ativo · Bloco {{n}}", n: 1 }) as string, cls: "bg-accent/90 text-accent-foreground" }, block: t("landing.mockups.protocol_rail.block_label", { defaultValue: "Bloco {{n}} · Sem {{w}} · {{focus}}", n: 1, w: 1, focus: t("landing.mockups.protocol_rail.focus.calisthenics", { defaultValue: "Calistenia" }) }) as string, cvd: { label: cvdLow, tone: "ok" as const }, recovery: { pct: 63, tone: "warn" as const }, status: { text: t("landing.mockups.protocol_rail.status.last_log_yesterday", { defaultValue: "Último log ontem" }) as string, tone: "ok" as const } },
      { phase: { label: t("landing.mockups.protocol_rail.phase.ready_for_plan", { defaultValue: "Pronto para plano" }) as string, cls: "bg-accent text-accent-foreground" }, cvd: { label: cvdLow, tone: "ok" as const }, recovery: { pct: 81, tone: "ok" as const }, status: { text: t("landing.mockups.protocol_rail.status.plan_ready_to_send", { defaultValue: "Plano pronto a enviar" }) as string, tone: "ok" as const } },
      { phase: { label: t("landing.mockups.protocol_rail.phase.active_block", { defaultValue: "Ativo · Bloco {{n}}", n: 2 }) as string, cls: "bg-accent/90 text-accent-foreground" }, block: t("landing.mockups.protocol_rail.block_label", { defaultValue: "Bloco {{n}} · Sem {{w}} · {{focus}}", n: 2, w: 3, focus: t("landing.mockups.protocol_rail.focus.hypertrophy", { defaultValue: "Hipertrofia" }) }) as string, cvd: { label: cvdLow, tone: "ok" as const }, recovery: { pct: 74, tone: "ok" as const }, status: { text: t("landing.mockups.protocol_rail.status.logs_this_week", { defaultValue: "{{n}} logs esta semana", n: 3 }) as string, tone: "ok" as const } },
      { phase: { label: t("landing.mockups.protocol_rail.phase.reassessment_due", { defaultValue: "Reavaliação devida" }) as string, cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" }, block: t("landing.mockups.protocol_rail.block_label_short", { defaultValue: "Bloco {{n}} · Sem {{w}}", n: 1, w: 6 }) as string, recovery: { pct: 58, tone: "warn" as const }, status: { text: t("landing.mockups.protocol_rail.status.reassessment_overdue", { defaultValue: "Reavaliação em atraso" }) as string, tone: "warn" as const } },
    ];
    return roster.map((n, i) => ({
      name: n.full,
      initials: initialsFor(n),
      photo: pickDemoAvatar({ sex: n.sex === "f" ? "female" : "male", archetype: "landing", fullName: n.full }),
      ...phases[i]!,
    }));
  }, [i18n.language]);
  const clients: MockClient[] = slots;
  const chipCls = (tone: "ok" | "warn" | "bad") =>
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-red-500/40 bg-red-500/10 text-red-400";
  const dotCls = (tone: "ok" | "warn" | "neutral") =>
    tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-muted-foreground/60";
  return (
    <FloatCard>
      <div
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-accent" />
          {t("landing.mockups.workbench_title", { defaultValue: "Os meus clientes" })}
        </span>
        <span className="rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] tracking-widest text-accent">
          {pr("active_count", "12 ativos")}
        </span>
      </div>
      <p className="mt-2 text-[10px] italic text-muted-foreground/70">
        {t("landing.mockups.workbench_subtitle", { defaultValue: "Nomes de exemplo, ajustados à sua região." })}
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-background/40">
        {clients.map((c, i) => (
          <div
            key={c.name}
            className={`flex items-start gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-border/60" : ""}`}
          >
            <img
              src={c.photo}
              alt={c.name}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-accent/30 bg-accent/10"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest max-w-full break-words ${c.phase.cls}`}>
                  {c.phase.label}
                </span>
              </div>
              {c.block && (
                <p className="text-[11px] text-muted-foreground">{c.block}</p>
              )}
              {(c.cvd || c.recovery) && (
                <div className="flex flex-wrap items-center gap-1">
                  {c.cvd && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${chipCls(c.cvd.tone)}`}>
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {c.cvd.label}
                    </span>
                  )}
                  {c.recovery && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${chipCls(c.recovery.tone)}`}>
                      <Activity className="h-2.5 w-2.5" />
                      {pr("recovery_label", "Recuperação")} {c.recovery.pct}%
                    </span>
                  )}
                </div>
              )}
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls(c.status.tone)}`} />
                {c.status.text}
              </p>
            </div>
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{pr("footer_label", "PROTOCOL")}</span>
        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-accent">
          <Sparkles className="h-3 w-3" /> {pr("footer_built_by_coach", "Construído por um coach")}
        </span>
      </div>
    </FloatCard>
  );
}

// ─── Solo trainee mockup (variant 3: AI-guided autonomy) ──────────────
function SoloTrainerMockup() {
  const { t } = useTranslation("plan");
  const s = (k: string, fb: string, opts?: Record<string, unknown>) =>
    t(`landing.mockups.solo.${k}`, { defaultValue: fb, ...(opts || {}) }) as string;
  const exKeys = ["goblet_squat", "db_bench", "sl_rdl", "chinup_assist", "face_pull", "plank"] as const;
  const today = exKeys.map((k) => ({
    name: s(`exercises.${k}.name`, k),
    target: s(`exercises.${k}.target`, ""),
    tip: s(`exercises.${k}.tip`, ""),
  }));
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const dayDone = [true, true, false, false, false, false, false];
  const week = dayKeys.map((dk, i) => ({
    d: s(`days.${dk}`, dk),
    done: dayDone[i] && i !== 2,
    today: i === 2,
  }));
  return (
    <FloatCard>
      <div
        className="absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-accent" />
          {s("header", "Treino de hoje · Sem 2")}
        </span>
        <span className="rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] tracking-widest text-accent">
          {s("copilot_chip", "Copiloto IA · você decide")}
        </span>
      </div>
      {/* Week strip */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {week.map((w) => (
          <div
            key={w.d}
            className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-[9px] uppercase tracking-wider ${
              w.today
                ? "border-accent/50 bg-accent/10 text-accent"
                : w.done
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : "border-border/60 bg-background/40 text-muted-foreground"
            }`}
          >
            <span>{w.d}</span>
            <span className="mt-0.5 text-[10px]">{w.done ? "✓" : w.today ? "•" : "—"}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-base font-medium">{s("session_title", "Inferiores · ~52 min")}</p>
      <ul className="mt-3 space-y-2">
        {today.map((e, i) => (
          <li key={e.name} className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{i + 1}. {e.name}</span>
              <span className="font-mono text-[11px] text-foreground/85">{e.target}</span>
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent">
              <Sparkles className="h-3 w-3" /> {e.tip}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] text-emerald-300">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <TrendingUp className="h-3 w-3" /> {s("next_block_title", "Próximo bloco")}
        </span>
        <p className="mt-1 text-emerald-200/80">{s("next_block_body", "A IA prepara o próximo bloco com base no que regista esta semana.")}</p>
      </div>
    </FloatCard>
  );
}
