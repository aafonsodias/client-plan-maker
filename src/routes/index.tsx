import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Users, Zap, ArrowRight, ClipboardCheck, ShieldCheck, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <Logo className="h-8 w-8" />
            <span className="text-lg">FORGE</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Start free</Link>
            </Button>
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> AI-assisted workout drafting
            </div>
            <h1 className="text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">
              Stop writing plans
              <span className="block text-accent">at midnight.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light text-muted-foreground">
              Run a structured intake, let AI draft a personalized program in 90 seconds, and export a
              branded PDF your clients will actually open.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start building plans <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <HeroPlanMockup />
            <p className="mt-4 hidden text-center text-xs uppercase tracking-[0.25em] text-muted-foreground md:block">
              Periodized · Personalized · Ready in seconds
            </p>
          </div>
        </div>
      </section>

      {/* How it works — animated mock */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mt-2 text-4xl font-light tracking-tight">From intake to PDF in four moves.</h2>
        </div>
        <HowItWorksAnimation />
      </section>

      {/* Credibility — built on the science */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-light tracking-tight">Built on the science you already trust.</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">
            Forge isn't just AI on top of a chat box. The intake follows the protocols you learned in
            your certification — so the output is defensible, not generic.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: ClipboardCheck, title: "PAR-Q+ screening", desc: "Pre-participation health screen with cardiovascular, metabolic, and renal risk flags built in." },
            { icon: ShieldCheck, title: "ACSM risk stratification", desc: "Low / moderate / high categorization to guide intensity prescription safely from session one." },
            { icon: RefreshCw, title: "Prochaska stages of change", desc: "Behaviour-change readiness mapped to coaching tone and progression speed for each client." },
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
          <h2 className="text-4xl font-light tracking-tight">The plan doesn't end at the PDF.</h2>
          <p className="mt-4 text-base font-light text-muted-foreground">
            Log every set, track every session. Forge keeps the history so you and the client see the
            work pile up.
          </p>
        </div>
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="space-y-8 text-lg font-light">
            <p>Per-set logging — weight, reps, RPE</p>
            <p>Full session history per client</p>
            <p>Progression visible at a glance</p>
          </div>
          <SetLogMockup />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-12 max-w-2xl text-4xl font-light tracking-tight">
          Built for trainers who'd rather coach than copy-paste spreadsheets.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: "Structured intake", desc: "Capture goals, equipment, injuries, and schedule in a single guided form." },
            { icon: Zap, title: "AI-drafted programs", desc: "Get a periodized weekly plan tailored to the assessment in seconds." },
            { icon: FileText, title: "Branded PDF export", desc: "Add your logo and business name. Send a polished plan instantly." },
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

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center text-foreground sm:px-16">
          <div
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--gradient-accent)" }}
          />
          <h2 className="relative mx-auto max-w-2xl text-4xl font-light tracking-tight">
            Your next client plan, before your next coffee.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl font-light text-muted-foreground">
            Join trainers building better programs in less time.
          </p>
          <Button asChild size="lg" className="relative mt-8">
            <Link to="/auth">Create your account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Forge
      </footer>
    </div>
  );
}

function HowItWorksAnimation() {
  const steps = [
    { label: "Add client", desc: "Capture demographics in seconds." },
    { label: "Run assessment", desc: "PAR-Q+, risk, mobility, goals." },
    { label: "Generate plan", desc: "AI drafts a periodized program." },
    { label: "Export PDF", desc: "Branded, sent in one click." },
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
    { badge: "WARM-UP", tone: "warmup", name: "Goblet Squat (light)", sets: "2 × 8" },
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
        <span>Maria S. · Block 2 · Strength</span>
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
              {r.note && <span className="hidden text-[11px] text-muted-foreground/80 lg:inline">{r.note}</span>}
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
    "Set 1 — 80kg × 6 ✓",
    "Set 2 — 82.5kg × 6 ✓",
    "Set 3 — 85kg × 5 ✓",
  ];
  return (
    <FloatCard>
      <div
        className="absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <p className="text-xs uppercase tracking-widest text-accent">Back Squat · Set log</p>
      <div className="mt-5 space-y-3 font-mono text-sm text-foreground/90">
        {sets.map((s) => (
          <div key={s} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
            {s}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
          Save session
        </button>
      </div>
    </FloatCard>
  );
}
