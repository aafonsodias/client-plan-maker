import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dumbbell, FileText, Sparkles, Users, Zap, ArrowRight } from "lucide-react";

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
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="text-lg">FORGEPLAN</span>
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
        <div className="mx-auto max-w-6xl px-6 py-24 text-foreground sm:py-32">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> AI-assisted workout drafting
            </div>
            <h1 className="text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">
              Build client workout plans
              <span className="block text-accent">in 90 seconds.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light text-muted-foreground">
              Run a structured intake, let AI draft a personalized program, edit it your way, and export
              a branded PDF your clients will actually open.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start building plans <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See how it works</a>
              </Button>
            </div>
          </div>
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
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-foreground sm:px-16">
          <div
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--gradient-accent)" }}
          />
          <h2 className="relative max-w-2xl text-4xl font-light tracking-tight">
            Stop writing plans at midnight.
          </h2>
          <p className="relative mt-4 max-w-xl font-light text-muted-foreground">
            Join trainers building better programs in less time.
          </p>
          <Button asChild size="lg" className="relative mt-8">
            <Link to="/auth">Create your account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ForgePlan
      </footer>
    </div>
  );
}
