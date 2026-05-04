import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

/**
 * AtlasGenie — the "how it works" guide as a luminous reveal.
 * Triggered on demand (footer book icon, dashboard pill). Atlas — Protocol's
 * named copilot — emerges from the manual book with an amber glow. No
 * permanent card on the dashboard anymore.
 */
export function AtlasGenie({
  trigger,
}: {
  trigger?: "pill" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");
  const steps = [
    { n: 1, b: t("dashboard.how_it_works.s1_b", { defaultValue: "Adicione um cliente" }), s: t("dashboard.how_it_works.s1_s", { defaultValue: "Só nome e email." }) },
    { n: 2, b: t("dashboard.how_it_works.s2_b", { defaultValue: "Envie o link de avaliação" }), s: t("dashboard.how_it_works.s2_s", { defaultValue: "Ele preenche no telemóvel." }) },
    { n: 3, b: t("dashboard.how_it_works.s3_b", { defaultValue: "Gere o plano" }), s: t("dashboard.how_it_works.s3_s", { defaultValue: "Reveja, ajuste, exporte em PDF." }) },
  ];
  return (
    <>
      {trigger === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          aria-label={t("dashboard.how_it_works.open", { defaultValue: "Como funciona" })}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {t("dashboard.how_it_works.open", { defaultValue: "Como funciona" })}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-accent hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5 text-accent" />
          {t("dashboard.how_it_works.open", { defaultValue: "Como funciona" })}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden border-accent/40 sm:max-w-md">
          {/* Atlas amber under-glow plate, mark grows in like a genie */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,rgba(232,165,71,0.25),transparent_60%)]" />
          <div className="flex flex-col items-center text-center">
            <div
              className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-card atlas-genie-mark"
              style={{ filter: "drop-shadow(0 0 22px rgba(232,165,71,0.45))" }}
            >
              <span className="atlas-genie-halo pointer-events-none absolute inset-0 rounded-full" aria-hidden />
              <Logo className="h-12 w-12" />
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-accent">Atlas</p>
            <DialogTitle className="mt-1 text-xl font-light tracking-tight">
              {t("dashboard.how_it_works.title", { defaultValue: "3 passos para o primeiro plano" })}
            </DialogTitle>
          </div>
          <ol className="mt-5 space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-3 rounded-2xl border border-border bg-background/50 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {s.n}
                </span>
                <span>
                  <b>{s.b}</b>
                  <span className="block text-xs text-muted-foreground">{s.s}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex justify-center">
            <Button asChild size="sm" variant="outline" onClick={() => setOpen(false)}>
              <Link to="/manual">
                <BookOpen className="mr-1.5 h-4 w-4" />
                {t("dashboard.how_it_works.full_manual", { defaultValue: "Manual completo" })}
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
