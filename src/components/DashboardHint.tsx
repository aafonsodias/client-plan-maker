import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, X, HelpCircle } from "lucide-react";

const KEY = "forge.hint.dashboard.dismissed";

/**
 * Always-available "how it works" 3-step coach-mark for the dashboard.
 * Trainer can dismiss it; a small "Mostrar guia" button appears in its place
 * so it can always be brought back. Single source of truth — no redundancies
 * with the empty-state hero.
 */
export function DashboardHint() {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  if (!hydrated) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => {
          try { localStorage.removeItem(KEY); } catch { /* ignore */ }
          setDismissed(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" /> Mostrar guia
      </button>
    );
  }

  return (
    <div className="relative rounded-3xl border border-accent/30 bg-card p-6 sm:p-8">
      <button
        type="button"
        aria-label="Esconder guia"
        onClick={() => {
          try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
          setDismissed(true);
        }}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-xs uppercase tracking-widest text-accent">Como funciona</p>
      <h2 className="mt-2 text-xl font-light tracking-tight sm:text-2xl">3 passos para o primeiro plano</h2>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        {[
          { n: 1, b: "Adiciona um cliente", t: "Só nome e email." },
          { n: 2, b: "Envia o link de avaliação", t: "Ele preenche no telemóvel." },
          { n: 3, b: "Geras o plano", t: "Revês, ajustas, exportas em PDF." },
        ].map((s) => (
          <li key={s.n} className="flex gap-3 rounded-2xl border border-border bg-background/40 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{s.n}</span>
            <span><b>{s.b}</b><span className="block text-xs text-muted-foreground">{s.t}</span></span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to="/clients" search={{ filter: "all" }}><Plus className="mr-1.5 h-4 w-4" /> Adicionar cliente</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/manual"><BookOpen className="mr-1.5 h-4 w-4" /> Manual completo</Link></Button>
      </div>
    </div>
  );
}