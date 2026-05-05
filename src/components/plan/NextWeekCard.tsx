import { useState } from "react";
import { Loader2, CalendarPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { programNextWeek } from "@/server/phased/program-next-week.functions";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * R66 — Surface the deterministic "program next week" path on the plan page.
 * Shows when the plan has at least one prescribed week. Adherence-gated
 * server-side; we render the friendly error inline.
 */
export function NextWeekCard({
  planId,
  onCreated,
}: {
  planId: string;
  onCreated?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("common");
  const fn = useServerFn(programNextWeek);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setWarn(null);
    try {
      const r: any = await fn({ data: { planId } });
      if (r?.ok) {
        toast.success(
          t("plan.next_week.created", {
            week: r.nextWeek,
            flagged: r.flaggedCount ?? 0,
          }),
        );
        await onCreated?.();
      } else if (r?.error === "low_adherence") {
        const pct = Math.round((r.adherence ?? 0) * 100);
        setWarn(
          t("plan.next_week.low_adherence", {
            pct,
            logged: r.sessionsLogged,
            expected: r.sessionsExpected,
          }),
        );
      } else {
        toast.error(r?.error ?? t("plan.next_week.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-3 text-xs">
      <div className="flex-1 min-w-[220px]">
        <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5 text-accent" />
          {t("plan.next_week.title")}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {t("plan.next_week.subtitle")}
        </p>
        {warn && (
          <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{warn}</span>
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={run}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
        {t("plan.next_week.cta")}
      </Button>
    </div>
  );
}

export default NextWeekCard;