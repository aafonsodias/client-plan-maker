import { useState, type ReactNode } from "react";
import { FileText, Loader2, ArrowRight, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MacroIndexStrip } from "@/components/MacroIndexStrip";
import { weekTagFor } from "@/lib/macro-index";
import { downloadPlanById } from "@/lib/download-plan";
import { toast } from "sonner";

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
  secondaryAction,
  assessmentPdf,
  bare = false,
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
  /** Optional secondary action shown next to the primary (ghost style). */
  secondaryAction?: HeroPrimaryAction;
  /** Optional sibling chip to download the client's assessment PDF. */
  assessmentPdf?: { onDownload: () => void | Promise<void> };
  /** When true, omit the outer card chrome (used when embedded in the Protocolo card). */
  bare?: boolean;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAssessment, setDownloadingAssessment] = useState(false);

  if (zeroState || !plan) {
    if (bare) {
      return (
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Próximo passo</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PrimaryCta action={primaryAction} />
            {secondaryAction && <PrimaryCta action={secondaryAction} variant="ghost" />}
          </div>
        </div>
      );
    }
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
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryCta action={primaryAction} large />
            {secondaryAction && <PrimaryCta action={secondaryAction} large variant="ghost" />}
          </div>
        </div>
      </section>
    );
  }

  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const blockN = plan.block_number ?? 1;
  const tag = weekTagFor(selectedWeek, totalWeeks);

  // If the primary CTA is just "open this plan", it's redundant with the
  // clickable plan title — collapse to the download-only affordance.
  const ctaIsOpenPlan = !!primaryAction.href && primaryAction.href === `/plans/${plan.id}`;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    const tId = toast.loading(`A preparar PDF da Semana ${selectedWeek}…`);
    try {
      await downloadPlanById(plan.id, selectedWeek);
      toast.success("PDF descarregado.", { id: tId });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
    } finally {
      setDownloading(false);
    }
  };

  const Wrapper: any = bare ? "div" : "section";
  const wrapperCls = bare
    ? "relative"
    : "relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-card to-card p-5 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.22)]";
  return (
    <Wrapper aria-label={bare ? undefined : "Esta semana"} className={wrapperCls}>
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            {!bare && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
                Protocolo · esta semana
              </p>
            )}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                to="/plans/$planId"
                params={{ planId: plan.id }}
                className="group inline-flex items-baseline gap-2 truncate text-[15px] font-semibold tracking-tight text-foreground hover:text-amber-400"
                title="Abrir plano"
              >
                <FileText className="h-3.5 w-3.5 self-center text-muted-foreground/70 group-hover:text-amber-400" />
                <span className="truncate underline-offset-4 group-hover:underline">{plan.title}</span>
              </Link>
              <p className="text-[11px] text-muted-foreground">
                Bloco {blockN} · Sem. {selectedWeek}/{totalWeeks} · <span className="uppercase tracking-wider text-foreground/70">{tag}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {totalWeeks > 1 && (
              <MacroIndexStrip
                totalWeeks={totalWeeks}
                selectedWeek={selectedWeek}
                onSelect={setSelectedWeek}
                compact
              />
            )}
            {assessmentPdf && (
              <button
                type="button"
                onClick={async () => {
                  if (downloadingAssessment) return;
                  setDownloadingAssessment(true);
                  const tId = toast.loading("A preparar PDF da avaliação…");
                  try {
                    await assessmentPdf.onDownload();
                    toast.success("PDF descarregado.", { id: tId });
                  } catch (err: any) {
                    toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
                  } finally {
                    setDownloadingAssessment(false);
                  }
                }}
                disabled={downloadingAssessment}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/[0.07] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300/90 hover:bg-sky-500/15 disabled:opacity-60"
                title="Descarregar PDF da avaliação"
              >
                {downloadingAssessment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Avaliação · PDF
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90 hover:bg-emerald-500/15 disabled:opacity-60"
              title={`Descarregar PDF da Semana ${selectedWeek}`}
            >
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              PDF · Sem. {selectedWeek}
            </button>
            {!ctaIsOpenPlan && <PrimaryCta action={primaryAction} />}
            {secondaryAction && <PrimaryCta action={secondaryAction} variant="ghost" />}
          </div>
        </div>

      </div>
    </Wrapper>
  );
}

function PrimaryCta({ action, large = false, variant = "default" }: { action: HeroPrimaryAction; large?: boolean; variant?: "default" | "ghost" }) {
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
      <Button asChild variant={variant === "ghost" ? "outline" : "default"} className={sizeCls} disabled={action.busy}>
        {/* href is an internal path; cast to satisfy typed router */}
        <Link to={action.href as any}>{inner}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant === "ghost" ? "outline" : "default"} className={sizeCls} disabled={action.busy} onClick={() => void action.onClick?.()}>
      {inner}
    </Button>
  );
}