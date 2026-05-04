import { useState, type ReactNode } from "react";
import { FileText, Loader2, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MacroIndexStrip } from "@/components/MacroIndexStrip";
import { weekTagFor } from "@/lib/macro-index";

/** Single dominant action that changes per client lifecycle state. */
export type HeroPrimaryAction = {
  label: string;
  onClick?: () => void | Promise<void>;
  href?: string; // optional internal link
  busy?: boolean;
  icon?: ReactNode;
  /** Visual hint — kept neutral so the page only has ONE truly loud CTA. */
  intent?: "evaluate" | "brief" | "generate" | "open" | "log";
};

/**
 * Focal-point card for the client page. Replaces the flat "Plano final" row
 * with a single composed surface: macro index strip, week selector, primary
 * download CTA, and a secondary "open plan" link. When the client has no
 * complete plan yet, renders a calm onboarding variant instead.
 */
export function ThisWeekHero({
  plan,
  defaultWeek,
  zeroState,
  primaryAction,
}: {
  plan: {
    id: string;
    title: string;
    duration_weeks?: number | null;
    block_number?: number | null;
    updated_at?: string | null;
  } | null;
  defaultWeek: number;
  zeroState: boolean;
  /** The ONE next thing the trainer should do for this client. */
  primaryAction: HeroPrimaryAction;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);

  if (zeroState || !plan) {
    return (
      <section
        aria-label="Próximo passo"
        className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-6 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.18)]"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
          Próximo passo
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          O que fazer agora
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Cada cliente tem uma única ação prioritária. Quando este passo estiver feito,
          aparece o seguinte aqui — sem ruído de menus.
        </p>
        <div className="mt-4">
          <PrimaryCta action={primaryAction} large />
        </div>
      </section>
    );
  }

  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const blockN = plan.block_number ?? 1;
  const tag = weekTagFor(selectedWeek, totalWeeks);

  return (
    <section
      aria-label="Esta semana"
      className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-card to-card p-5 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.22)]"
    >
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
              Esta semana · o que fazer agora
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{plan.title}</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bloco {blockN} · Semana {selectedWeek} de {totalWeeks} · <span className="uppercase tracking-wider text-foreground/80">{tag}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryCta action={primaryAction} />
            <Button asChild size="sm" variant="ghost" className="h-9 gap-1.5">
              <Link to="/plans/$planId" params={{ planId: plan.id }}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir plano
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <MacroIndexStrip
            totalWeeks={totalWeeks}
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </div>
      </div>
    </section>
  );
}

function PrimaryCta({ action, large = false }: { action: HeroPrimaryAction; large?: boolean }) {
  const sizeCls = large ? "h-11 px-5 text-sm" : "h-9 px-4 text-sm";
  const Icon = action.busy ? Loader2 : null;
  const inner = (
    <span className="inline-flex items-center gap-2 font-semibold">
      {Icon ? <Icon className="h-4 w-4 animate-spin" /> : action.icon}
      <span>{action.label}</span>
      {!action.busy && !action.icon && <ArrowRight className="h-4 w-4" />}
    </span>
  );
  if (action.href) {
    return (
      <Button asChild className={sizeCls} disabled={action.busy}>
        <Link to={action.href}>{inner}</Link>
      </Button>
    );
  }
  return (
    <Button className={sizeCls} disabled={action.busy} onClick={() => void action.onClick?.()}>
      {inner}
    </Button>
  );
}