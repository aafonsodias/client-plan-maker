import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileText, Users, Zap, ArrowRight, ClipboardCheck, ShieldCheck, RefreshCw, ArrowUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import andreFounder from "@/assets/andre-founder.png";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  const { t } = useTranslation(["plan", "common"]);
  const signedIn = !!user;
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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <Logo className="h-8 w-8" />
            <span className="text-lg">{t("common:brand.name")}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher className="mr-1" />
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
          <div>
            <h1 className="text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">
              {t("plan:landing.hero.title_line1")}
              <span className="block text-accent">{t("plan:landing.hero.title_line2")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light text-muted-foreground">
              {t("plan:landing.hero.subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={primaryCtaTo}>
                  {primaryCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">{t("plan:landing.hero.cta_secondary")}</a>
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="origin-top scale-[0.95] opacity-[0.92]">
              <HeroPlanMockup />
            </div>
            <p className="mt-4 hidden max-w-md text-center text-[11px] font-light italic text-muted-foreground/70 md:block">
              {t("plan:landing.hero.credibility_caption")}
            </p>
          </div>
        </div>
      </section>

      {/* How it works — animated mock */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">{t("plan:landing.how_it_works.eyebrow")}</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">{t("plan:landing.how_it_works.title")}</h2>
        </div>
        <HowItWorksAnimation />
      </section>

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

      {/* Logging / history — beyond the PDF */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-light tracking-tight">{t("plan:landing.logging.title")}</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">{t("plan:landing.logging.subtitle")}</p>
        </div>
        <div className="grid items-center gap-12 md:grid-cols-2">
          <ProgressionMockup />
          <SetLogMockup />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
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

      {/* Founder note */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-start gap-10 md:grid-cols-[30%_1fr]">
          <div className="flex justify-center md:justify-start">
            <img
              src={andreFounder}
              alt={t("plan:landing.founder.img_alt")}
              className="h-[120px] w-[120px] rounded-full border border-muted-foreground/30 object-cover object-[center_top] md:h-[160px] md:w-[160px]"
              style={{ boxShadow: "0 0 24px rgba(212, 175, 89, 0.08)" }}
            />
          </div>
          <div>
            <h2 className="text-[32px] font-light leading-tight tracking-tight">{t("plan:landing.founder.title")}</h2>
            <div className="mt-6 space-y-5 text-[17px] leading-[1.7] text-foreground/85">
              <p>{t("plan:landing.founder.p1")}</p>
              <p>{t("plan:landing.founder.p2")}</p>
              <p>{t("plan:landing.founder.p3")}</p>
              <ul className="space-y-3 pl-0">
                <li>
                  <span className="font-medium text-foreground">{t("plan:landing.founder.bullet_logic_title")}</span>{" "}
                  {t("plan:landing.founder.bullet_logic_body")}
                </li>
                <li>
                  <span className="font-medium text-foreground">{t("plan:landing.founder.bullet_pro_title")}</span>{" "}
                  {t("plan:landing.founder.bullet_pro_body")}
                </li>
                <li>
                  <span className="font-medium text-foreground">{t("plan:landing.founder.bullet_filter_title")}</span>{" "}
                  {t("plan:landing.founder.bullet_filter_body")}
                </li>
              </ul>
              <p>{t("plan:landing.founder.p4")}</p>
            </div>
            <p className="mt-6 text-sm italic text-muted-foreground/70">{t("plan:landing.founder.signature")}</p>
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
            { q: t("plan:landing.faq.q3_q"), a: t("plan:landing.faq.q3_a") },
            { q: t("plan:landing.faq.q4_q"), a: t("plan:landing.faq.q4_a") },
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

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {t("plan:landing.footer_copy", { year: new Date().getFullYear() })}
      </footer>
      <ScrollToTopButton />
    </div>
  );
}

function HowItWorksAnimation() {
  const { t } = useTranslation("plan");
  const steps = [
    { label: t("landing.how_it_works.steps.add_client.label"), desc: t("landing.how_it_works.steps.add_client.desc") },
    { label: t("landing.how_it_works.steps.assessment.label"), desc: t("landing.how_it_works.steps.assessment.desc") },
    { label: t("landing.how_it_works.steps.generate.label"), desc: t("landing.how_it_works.steps.generate.desc") },
    { label: t("landing.how_it_works.steps.export.label"), desc: t("landing.how_it_works.steps.export.desc") },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
      <div
        className="absolute -right-32 top-0 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="relative grid gap-4 sm:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className="group relative rounded-2xl border border-border bg-background/40 p-5 transition hover:border-accent/40"
            style={{ animation: `fade-in 0.6s ease-out ${i * 150}ms both` }}
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
              {i + 1}
            </div>
            <p className="font-medium">{s.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-1/2 hidden h-px w-6 translate-x-full bg-gradient-to-r from-accent/60 to-transparent sm:block" />
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-8 h-2 overflow-hidden rounded-full bg-secondary/60">
        <div
          className="h-full w-1/3 rounded-full bg-accent"
          style={{ animation: "slide-progress 4s ease-in-out infinite" }}
        />
      </div>
      <style>{`
        @keyframes slide-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

function FloatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative hidden overflow-hidden rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-elegant)] md:block ${className}`}
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
  type Row = { badge: string; tone: "warmup" | "main" | "accessory" | "finisher"; name: string; sets: string; note?: string; sub?: string };
  const rows: Row[] = [
    { badge: "WARM-UP", tone: "warmup", name: "Goblet Squat", sets: "2 × 8", note: "@ light" },
    { badge: "MAIN", tone: "main", name: "Back Squat", sets: "4 × 6", note: "@ RPE 7", sub: "Rest 2:30 · tempo 3-1-X" },
    { badge: "MAIN", tone: "main", name: "Romanian Deadlift", sets: "3 × 8", note: "@ RPE 7", sub: "Rest 2:00 · controlled eccentric" },
    { badge: "ACCESSORY", tone: "accessory", name: "Step-Up", sets: "3 × 10/leg" },
    { badge: "ACCESSORY", tone: "accessory", name: "Leg Curl", sets: "3 × 12", note: "@ RPE 7" },
    { badge: "FINISHER", tone: "finisher", name: "KB Swing", sets: "3 × 15" },
  ];
  const badgeClass = (t: Row["tone"]) => {
    switch (t) {
      case "main": return "bg-accent/15 text-accent border border-accent/30";
      case "finisher": return "border border-accent/40 text-accent/80";
      case "warmup": return "bg-secondary/60 text-muted-foreground border border-border";
      default: return "bg-secondary/40 text-muted-foreground border border-border";
    }
  };
  return (
    <FloatCard>
      <div
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      {/* Client header */}
      <div className="flex items-center gap-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-[11px] font-medium text-accent">
          M
        </span>
        <span>Maria S. · Week 5 · Strength Phase</span>
      </div>
      {/* Session title */}
      <div className="mt-3">
        <p className="text-base font-medium text-foreground">Monday — Lower Body Strength</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Est. 55 min · 6 exercises</p>
      </div>
      <div className="my-4 h-px bg-border" />
      {/* Exercise list */}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-background/40">
              <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${badgeClass(r.tone)}`}>
                {r.badge}
              </span>
              <span className="flex-1 truncate text-sm font-medium text-foreground">{r.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.sets}</span>
              {r.note && <span className="font-mono text-[11px] text-muted-foreground/80">{r.note}</span>}
            </div>
            {r.sub && (
              <p className="ml-[4.25rem] mt-0.5 text-[11px] italic text-muted-foreground/70">{r.sub}</p>
            )}
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="mt-4 h-px bg-border" />
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
        <span>FORGE</span>
        <span className="normal-case tracking-normal">Personalized for Maria</span>
      </div>
    </FloatCard>
  );
}

function SetLogMockup() {
  const sets = [
    { label: "Set 1", detail: "80kg × 6" },
    { label: "Set 2", detail: "82.5kg × 6" },
    { label: "Set 3", detail: "85kg × 5" },
  ];
  return (
    <FloatCard>
      <div
        className="absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-accent">Back Squat · Set log</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Today · Week 6</p>
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
        <span>Last week — top set 80kg × 6</span>
        <span className="inline-flex items-center gap-1 text-accent">
          <ArrowUp className="h-3 w-3" /> +5kg
        </span>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
          Save session
        </button>
      </div>
    </FloatCard>
  );
}

function ProgressionMockup() {
  const weights = [70, 72.5, 75, 77.5, 80, 82.5];
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
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Back Squat — 6 weeks of work</p>
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
        <p>Top set today: <span className="text-foreground/90">85kg × 5</span></p>
        <p>PR vs week 1: <span className="text-accent">+15kg</span></p>
        <p>Sessions logged: <span className="text-foreground/90">18</span></p>
      </div>
    </div>
  );
}
