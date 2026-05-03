import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ClipboardList, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  clientId: string | null | undefined;
  triggerVariant?: "ghost" | "outline";
};

/**
 * PlanAssessmentSheet — slide-in drawer that summarises the latest assessment
 * for the plan's client without leaving the plan page. Read-only by design;
 * trainers click "Open full assessment" to edit.
 */
export function PlanAssessmentSheet({ clientId, triggerVariant = "outline" }: Props) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [a, setA] = useState<any>(null);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("assessments")
        .select("*")
        .eq("client_id", clientId)
        .order("performed_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      setA(data);
      setLoading(false);
    })();
  }, [open, clientId]);

  if (!clientId) return null;

  const archetype = a?.extended?.demo_meta?.archetype as string | undefined;
  const expectedFlags = (a?.extended?.demo_meta?.expected_red_flags as string[] | undefined) ?? [];
  const equipment = (a?.available_equipment as string[] | undefined) ?? [];
  const medFlags = (a?.med_flags as string[] | undefined) ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={triggerVariant} size="sm" className="h-8" title={t("assessment_sheet.trigger_title")}>
          <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> {t("assessment_sheet.trigger")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t("assessment_sheet.title")}
            {archetype && (
              <span className="rounded-full bg-accent/10 border border-accent/30 text-accent px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
                {archetype}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("assessment_sheet.loading")}
          </div>
        ) : !a ? (
          <p className="text-sm text-muted-foreground py-6">{t("assessment_sheet.none")}</p>
        ) : (
          <div className="space-y-4 py-4 text-sm">
            <Row label={t("assessment_sheet.performed_on")} value={a.performed_on ?? "—"} />
            <Row label={t("assessment_sheet.primary_goal")} value={a.primary_goal ?? "—"} />
            <Row label={t("assessment_sheet.experience")} value={a.experience_level ?? "—"} />
            <Row label={t("assessment_sheet.frequency")} value={a.training_days_per_week ? t("assessment_sheet.freq_value", { n: a.training_days_per_week }) : "—"} />
            <Row label={t("assessment_sheet.duration")} value={a.session_duration_minutes ? t("assessment_sheet.duration_value", { n: a.session_duration_minutes }) : "—"} />
            <Row label={t("assessment_sheet.acsm")} value={a.acsm_risk_category ?? "—"} tone={a.acsm_risk_category === "high" ? "warn" : "neutral"} />
            <Row label={t("assessment_sheet.parq")} value={a.parq_passed === false ? t("assessment_sheet.parq_failed") : a.parq_passed === true ? t("assessment_sheet.parq_passed") : "—"} tone={a.parq_passed === false ? "warn" : "neutral"} />
            {(a.systolic_bp_mmhg || a.diastolic_bp_mmhg) && (
              <Row label={t("assessment_sheet.bp")} value={`${a.systolic_bp_mmhg ?? "?"}/${a.diastolic_bp_mmhg ?? "?"} mmHg`} />
            )}

            {equipment.length > 0 && (
              <Block label={t("assessment_sheet.equipment")}>
                <div className="flex flex-wrap gap-1.5">
                  {equipment.map((e) => (
                    <span key={e} className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[11px]">{e}</span>
                  ))}
                </div>
              </Block>
            )}

            {medFlags.length > 0 && (
              <Block label={t("assessment_sheet.med_flags")}>
                <div className="flex flex-wrap gap-1.5">
                  {medFlags.map((f) => (
                    <span key={f} className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 text-[11px] font-mono">{f}</span>
                  ))}
                </div>
              </Block>
            )}

            {expectedFlags.length > 0 && (
              <Block label={t("assessment_sheet.expected_red_flags")}>
                <div className="flex flex-wrap gap-1.5">
                  {expectedFlags.map((f) => (
                    <span key={f} className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 text-[11px] font-mono">{f}</span>
                  ))}
                </div>
              </Block>
            )}

            {a.injuries && <Block label={t("assessment_sheet.injuries")}><p className="whitespace-pre-wrap text-foreground/90">{a.injuries}</p></Block>}
            {a.medical_conditions && <Block label={t("assessment_sheet.conditions")}><p className="whitespace-pre-wrap text-foreground/90">{a.medical_conditions}</p></Block>}
            {a.medications && <Block label={t("assessment_sheet.medications")}><p className="whitespace-pre-wrap text-foreground/90">{a.medications}</p></Block>}

            {(a.smart_specific || a.smart_measurable || a.smart_deadline) && (
              <Block label={t("assessment_sheet.smart_goal")}>
                {a.smart_specific && <p className="text-foreground/90">{a.smart_specific}</p>}
                {a.smart_measurable && <p className="text-muted-foreground text-xs mt-1">{t("assessment_sheet.metric")}: {a.smart_measurable}</p>}
                {a.smart_deadline && <p className="text-muted-foreground text-xs mt-1">{t("assessment_sheet.deadline")}: {a.smart_deadline}</p>}
              </Block>
            )}

            {(a.injuries || medFlags.length > 0 || a.parq_passed === false) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-700 dark:text-amber-300">
                  {t("assessment_sheet.warning")}
                </p>
              </div>
            )}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/clients/$clientId" params={{ clientId }}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> {t("assessment_sheet.open_full")}
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={tone === "warn" ? "text-amber-600 dark:text-amber-300 font-medium" : "text-foreground"}>{value}</span>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}