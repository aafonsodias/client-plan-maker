import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { getClientReassessmentReminders } from "@/server/capacity.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Reminder = {
  domain_slug: string;
  name_key: string;
  tier: string;
  effective_cadence: number;
  never_measured: boolean;
  days_overdue: number | null;
};

/**
 * Compact strip of "to reassess" chips below the Capacity Map.
 * - Hidden entirely when nothing is overdue.
 * - Shows up to 3 most-overdue domains.
 * - Tap → dispatches `open-add-snapshot` event (CapacityMap owns the sheet).
 * - Amber tone only when severely overdue (>2× cadence).
 */
export function ReassessmentReminders({ clientId }: { clientId: string }) {
  const { t } = useTranslation("common");
  const fetchReminders = useServerFn(getClientReassessmentReminders);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchReminders({ data: { clientId } });
      setReminders(res.reminders ?? []);
    } catch {
      setReminders([]);
    } finally {
      setLoaded(true);
    }
  }, [fetchReminders, clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh when snapshots change OR cadence overrides change.
  useEffect(() => {
    const ch = supabase
      .channel(`reassessment-reminders-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_capacity_snapshots", filter: `client_id=eq.${clientId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_measurement_cadence", filter: `client_id=eq.${clientId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [clientId, refresh]);

  if (!loaded || reminders.length === 0) return null;

  const top = reminders.slice(0, 3);

  const open = (slug: string) => {
    window.dispatchEvent(
      new CustomEvent("open-add-snapshot", { detail: { slug } }),
    );
  };

  return (
    <section
      aria-label={t("cockpit.reminders.title")}
      className="mb-3 rounded-2xl bg-muted/30 px-4 py-3 sm:px-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="label-caps text-muted-foreground">
          {t("cockpit.reminders.title")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {top.map((r) => {
          const severe =
            !r.never_measured &&
            r.days_overdue !== null &&
            r.days_overdue > r.effective_cadence; // >2× cadence
          const label = r.never_measured
            ? t("cockpit.reminders.never")
            : t("cockpit.reminders.overdue", { days: r.days_overdue });
          return (
            <button
              key={r.domain_slug}
              type="button"
              onClick={() => open(r.domain_slug)}
              className={cn(
                "group inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition",
                severe
                  ? "bg-[var(--warn-bg)] text-[var(--warn)] hover:bg-[color-mix(in_oklab,var(--warn)_20%,transparent)]"
                  : "bg-background text-foreground hover:bg-muted",
              )}
            >
              <span className="font-medium">
                {t(r.name_key, { defaultValue: r.domain_slug })}
              </span>
              <span className="tabular-nums text-muted-foreground group-hover:text-foreground">
                · {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}