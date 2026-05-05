import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, ChevronDown } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { ClientPhase } from "@/lib/client-phase";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toneDot } from "@/lib/status-tone";
import {
  CardPlan, CardLog, planFocus, currentWeek, daysSinceLog, formatRelativeDays,
} from "@/lib/client-card-data";
import { ClientCockpit } from "@/components/ClientCockpit";

type Props = {
  client: { id: string; full_name: string; email: string | null; photo_url: string | null };
  phase: ClientPhase | undefined;
  plan: CardPlan | null;
  logs: CardLog[];
  onDelete: () => void;
};

export function ClientPlayerCard({ client, phase, plan, logs, onDelete }: Props) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language === "pt" ? "pt" : "en";
  const [open, setOpen] = useState(false);

  const focus = planFocus(plan);
  const week = currentWeek(plan, logs);
  const block = plan?.block_number ?? null;
  const lastLog = logs.length > 0 ? logs[0] : null;
  const days = daysSinceLog(lastLog);

  // Status line (line 3): chooses one of a few honest states.
  let statusText: string | null = null;
  let statusTone: "success" | "neutral" | "warn" = "neutral";

  if (phase?.kind === "ended") {
    statusText = t("clients.card.block_ended");
    statusTone = "warn";
  } else if (phase?.kind === "idle") {
    statusText = t("clients.card.idle_days", { n: phase.daysSince });
    statusTone = "warn";
  } else if (plan && !lastLog) {
    statusText = t("clients.card.plan_ready");
    statusTone = "success";
  } else if (plan && lastLog) {
    statusText = t("clients.card.last_log", { when: formatRelativeDays(days, lang) });
    statusTone = days <= 7 ? "success" : days <= 14 ? "neutral" : "warn";
  } else if (!plan) {
    statusText = phase?.kind === "ready"
      ? t("clients.card.ready_to_build")
      : t("clients.card.intake_pending");
    statusTone = phase?.kind === "ready" ? "success" : "neutral";
  }

  // Line 2: block · week · focus (only when there's a plan)
  let blockLine: string | null = null;
  if (plan && block !== null && week !== null) {
    const parts: string[] = [
      t("clients.card.block_n", { n: block }),
      t("clients.card.week_n", { n: week }),
    ];
    if (focus) parts.push(focus);
    blockLine = parts.join(" · ");
  }

  return (
    <div className="group relative border-b border-border last:border-b-0">
      <div className="flex items-stretch hover:bg-secondary/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex flex-1 items-center gap-4 px-4 py-4 text-left sm:px-5"
      >
        <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={44} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="break-words text-sm font-semibold sm:text-base">{client.full_name}</p>
            {phase && (
              <span className="inline-flex">
                <ClientPhasePill phase={phase} />
              </span>
            )}
          </div>
          {blockLine && (
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{blockLine}</p>
          )}
          {statusText && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot(statusTone)}`} />
              {statusText}
            </p>
          )}
          {!blockLine && !statusText && (
            <p className="truncate text-xs text-muted-foreground">{client.email ?? t("clients.no_email")}</p>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="mr-3 self-center rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
            aria-label={t("clients.delete_aria")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clients.delete_title", { name: client.full_name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("clients.delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("clients.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("clients.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      {open && <ClientCockpit clientId={client.id} plan={plan} logs={logs} />}
    </div>
  );
}