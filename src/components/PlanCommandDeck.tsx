import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText, Loader2, Download, MoreHorizontal, Eye, Pencil, NotebookPen,
  BarChart3, TrendingUp, Sparkles, Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { downloadPlanById } from "@/lib/download-plan";
import { weekTagFor } from "@/lib/macro-index";
import { toast } from "sonner";

const TAG_LABELS: Record<string, string> = {
  base: "BASE",
  "+load": "+LOAD",
  "+reps": "+REPS",
  deload: "DELOAD",
};

export type DeckMode = "view" | "edit" | "log" | "results" | "progress";

export type DeckMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void | Promise<void>;
  destructive?: boolean;
};

/**
 * Compact "Plan Command Deck" — replaces the tall stack of buttons that
 * lived above the mesocycle table on the client view. Mobile-first.
 *
 * Owns no business logic. The parent passes selectedWeek + mode and the
 * deck only renders the controls + dispatches callbacks.
 */
export function PlanCommandDeck({
  plan,
  selectedWeek,
  onSelectWeek,
  currentWeek,
  mode,
  onModeChange,
  registerLabel,
  onRegister,
  registerBusy,
  onAssessmentPdf,
  menuItems,
}: {
  plan: {
    id: string;
    title: string;
    duration_weeks?: number | null;
    block_number?: number | null;
  };
  /** null = "All weeks" */
  selectedWeek: number | null;
  onSelectWeek: (w: number | null) => void;
  /** highlight the current week with a subtle dot */
  currentWeek?: number | null;
  mode: DeckMode;
  onModeChange: (m: DeckMode) => void;
  registerLabel: string;
  onRegister?: () => void | Promise<void>;
  registerBusy?: boolean;
  onAssessmentPdf?: () => void | Promise<void>;
  /** Extra items injected in the identity ⋯ menu (Share, Save Template…) */
  menuItems?: DeckMenuItem[];
}) {
  const totalWeeks = Math.max(1, plan.duration_weeks ?? 1);
  const blockN = plan.block_number ?? 1;
  const displayedWeek = selectedWeek ?? currentWeek ?? 1;
  const tag = weekTagFor(displayedWeek, totalWeeks);

  const [downloading, setDownloading] = useState(false);
  const [downloadingAssessment, setDownloadingAssessment] = useState(false);

  const handleWeeklyPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    const wn = selectedWeek ?? currentWeek ?? 1;
    const tId = toast.loading(`A preparar PDF da Semana ${wn}…`);
    try {
      await downloadPlanById(plan.id, wn);
      toast.success("PDF descarregado.", { id: tId });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
    } finally {
      setDownloading(false);
    }
  };

  const handleAssessmentPdf = async () => {
    if (!onAssessmentPdf || downloadingAssessment) return;
    setDownloadingAssessment(true);
    const tId = toast.loading("A preparar PDF da avaliação…");
    try {
      await onAssessmentPdf();
      toast.success("PDF descarregado.", { id: tId });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha a gerar PDF.", { id: tId });
    } finally {
      setDownloadingAssessment(false);
    }
  };

  const weekChips: Array<{ value: number | null; label: string }> = [
    ...Array.from({ length: totalWeeks }, (_, i) => ({
      value: i + 1,
      label: `W${i + 1}`,
    })),
    { value: null, label: "Todas" },
  ];

  const modes: Array<{ key: DeckMode; label: string; Icon: typeof Eye }> = [
    { key: "view", label: "View", Icon: Eye },
    { key: "edit", label: "Edit", Icon: Pencil },
    { key: "log", label: "Log", Icon: NotebookPen },
    { key: "results", label: "Resultados", Icon: BarChart3 },
  ];

  const contextLabel = selectedWeek == null
    ? "Todas as semanas"
    : `Sem. ${selectedWeek} · ${TAG_LABELS[tag] ?? String(tag).toUpperCase()}`;

  return (
    <section
      aria-label="Comandos do plano"
      className="bg-card/60 p-2.5 sm:p-3"
    >
      {/* Row 1 — identity */}
      <div className="flex items-start gap-2">
        <Link
          to="/plans/$planId"
          params={{ planId: plan.id }}
          className="group flex min-w-0 flex-1 items-center gap-2 text-foreground hover:text-amber-400"
          title="Abrir editor do plano"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground/70 group-hover:text-amber-400" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight underline-offset-4 group-hover:underline">
              {plan.title}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Bloco {blockN} · Sem. {displayedWeek}/{totalWeeks} ·{" "}
              <span className="uppercase tracking-wider text-foreground/70">
                {tag}
              </span>
            </p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              aria-label="Mais acções"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onAssessmentPdf && (
              <DropdownMenuItem onSelect={() => void handleAssessmentPdf()}>
                {downloadingAssessment
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Download className="mr-2 h-4 w-4" />}
                Avaliação · PDF
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onModeChange("progress")}>
              <TrendingUp className="mr-2 h-4 w-4" /> Progresso
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                window.dispatchEvent(new CustomEvent("plan:open-management"));
              }}
            >
              <SettingsIcon className="mr-2 h-4 w-4" /> Gestão do Plano
            </DropdownMenuItem>
            {menuItems && menuItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {menuItems.map((m) => (
                  <DropdownMenuItem
                    key={m.key}
                    onSelect={() => void m.onClick?.()}
                    className={m.destructive ? "text-destructive focus:text-destructive" : undefined}
                  >
                    {m.icon && <span className="mr-2 inline-flex">{m.icon}</span>}
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2 — week selector (drives table + weekly PDF) */}
      {/* Row 2 — week selector (left) + weekly PDF (right, same row) */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-full border border-border/60 bg-muted/30 p-0.5">
          {weekChips.map((c) => {
            const active = selectedWeek === c.value;
            const isCurrent = c.value !== null && c.value === currentWeek;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onSelectWeek(c.value)}
                className={`relative flex-1 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  active
                    ? "bg-amber-500/15 text-amber-200"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {c.label}
                {isCurrent && !active && (
                  <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-amber-400" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleWeeklyPdf}
          disabled={downloading}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80 hover:bg-secondary disabled:opacity-60"
          title={selectedWeek == null
            ? "Descarregar PDF do mesociclo"
            : `Descarregar PDF da Semana ${selectedWeek}`}
          aria-label={selectedWeek == null ? "PDF do mesociclo" : `PDF da Semana ${selectedWeek}`}
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          <span>{selectedWeek == null ? "PDF Plano" : `PDF S${selectedWeek}`}</span>
        </button>
      </div>

      {/* Row 3 — primary action */}
      {onRegister && (
        <div className="mt-2">
          <Button
            onClick={() => void onRegister()}
            disabled={registerBusy}
            className="h-9 w-full text-sm font-semibold"
          >
            {registerBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <NotebookPen className="mr-2 h-4 w-4" />
            )}
            {registerLabel}
          </Button>
        </div>
      )}

      {/* Row 4 — mode segmented */}
      <div
        role="tablist"
        className="mt-1.5 grid grid-cols-4 gap-1 rounded-full border border-border/60 bg-muted/30 p-0.5 text-[11px] font-semibold uppercase tracking-wider"
      >
        {modes.map(({ key, label, Icon }) => {
          const active = mode === key;
          const shortLabel = key === "results" ? "Res." : label;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              aria-label={label}
              title={label}
              onClick={() => onModeChange(key)}
              className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-1 transition ${
                active
                  ? "bg-amber-500/15 text-amber-200"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate sm:hidden">{shortLabel}</span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Row 5 — table toolbar context label (sits right above the table) */}
      <div className="-mb-1 mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="truncate text-foreground/80">{contextLabel}</span>
      </div>
    </section>
  );
}
