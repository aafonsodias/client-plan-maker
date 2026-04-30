import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, History, FileDown } from "lucide-react";
import { generateComplianceReportPdf } from "@/lib/compliance";
import type { PlanData } from "@/lib/pdf";
import { toast } from "sonner";

type SessionRow = {
  id: string; week_number: number; day_label: string; session_date: string;
  logged_by: string; entries: any[]; session_notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/plans/$planId/sessions")({
  validateSearch: (s: Record<string, unknown>) => ({
    highlight: typeof s.highlight === "string" ? s.highlight : undefined,
  }),
  component: () => (
    <AppShell>
      <SessionHistory />
    </AppShell>
  ),
});

function SessionHistory() {
  const { planId } = Route.useParams();
  const { highlight } = useSearch({ from: "/plans/$planId/sessions" });
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Default range: last 30 days
  const today = new Date();
  const thirty = new Date(today.getTime() - 29 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>(iso(thirty));
  const [toDate, setToDate] = useState<string>(iso(today));

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: list }] = await Promise.all([
        supabase.from("workout_plans").select("id,title,plan_data,client_id").eq("id", planId).single(),
        supabase.from("workout_sessions").select("*").eq("plan_id", planId).order("session_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      setPlan(p);
      setSessions((list as unknown as SessionRow[]) ?? []);
      setLoading(false);
    })();
  }, [user, planId]);

  useEffect(() => {
    if (!highlight) return;
    const el = document.getElementById(`session-${highlight}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, sessions.length]);

  async function handleExport() {
    if (!plan || !user) return;
    setExporting(true);
    try {
      const [{ data: client }, { data: profile }] = await Promise.all([
        supabase.from("clients").select("full_name").eq("id", plan.client_id).maybeSingle(),
        supabase
          .from("profiles")
          .select("business_name,full_name,tagline,contact_email,contact_phone,logo_url")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      let logo_data_url: string | null = null;
      if (profile?.logo_url) {
        try {
          const { data: signed } = await supabase.storage
            .from("logos")
            .createSignedUrl(profile.logo_url, 600);
          if (signed?.signedUrl) {
            const res = await fetch(signed.signedUrl);
            const blob = await res.blob();
            logo_data_url = await new Promise<string | null>((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = () => resolve(null);
              r.readAsDataURL(blob);
            });
          }
        } catch {
          /* ignore — logo optional */
        }
      }
      const fmt = (s: string) => {
        const d = new Date(s);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      };
      await generateComplianceReportPdf(
        {
          client_name: client?.full_name ?? "Client",
          plan_title: plan.title ?? "Plan",
          period_label: `${fmt(fromDate)} – ${fmt(toDate)}`,
          from_date: fromDate,
          to_date: toDate,
        },
        sessions as any,
        (plan.plan_data as PlanData) ?? null,
        {
          business_name: profile?.business_name ?? null,
          full_name: profile?.full_name ?? null,
          tagline: profile?.tagline ?? null,
          contact_email: profile?.contact_email ?? null,
          contact_phone: profile?.contact_phone ?? null,
          logo_data_url,
        },
      );
    } catch (err: any) {
      toast.error(err?.message || "Could not generate report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8 bg-background p-4 sm:p-6 lg:p-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/plans/$planId" params={{ planId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to plan
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-light tracking-tight">
            <History className="h-5 w-5 text-accent" /> Session history
          </h1>
          <p className="text-sm text-muted-foreground">{plan?.title ?? ""}</p>
        </div>

        {/* Compliance report export */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-widest text-accent">Compliance report</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Export a branded PDF with adherence, volume and notes for the chosen period.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || !plan}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {exporting ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-foreground0">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-foreground0">No sessions logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const isHighlighted = s.id === highlight;
              return (
                <li
                  key={s.id}
                  id={`session-${s.id}`}
                  className={`rounded-lg border bg-card p-3 transition ${
                    isHighlighted ? "border-accent animate-lime-pulse" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold tracking-tight">{s.session_date}</p>
                      <p className="text-xs text-muted-foreground">
                        Week {s.week_number} · {s.day_label} ·{" "}
                        <span className="uppercase tracking-widest text-[10px]">{s.logged_by}</span>
                      </p>
                    </div>
                    <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
                      {Array.isArray(s.entries) ? s.entries.length : 0} ex
                    </span>
                  </div>
                  {s.session_notes && (
                    <p className="mt-2 text-sm text-foreground/90">{s.session_notes}</p>
                  )}
                  {Array.isArray(s.entries) && s.entries.length > 0 && (
                    <ul className="mt-2 divide-y divide-border text-xs">
                      {s.entries.map((entry: any, idx: number) => (
                        <li key={idx} className="py-1.5">
                          <p className="font-semibold text-foreground">{entry.exercise_name || "(unnamed)"}</p>
                          {Array.isArray(entry.sets) && entry.sets.length > 0 ? (
                            <p className="text-muted-foreground">
                              {entry.sets
                                .map((st: any, i: number) => `Set ${i + 1}: ${st.reps || "—"} × ${st.weight || "—"}`)
                                .join("  ·  ")}
                            </p>
                          ) : entry.actual ? (
                            <p className="text-muted-foreground">
                              {entry.actual.sets || "—"} × {entry.actual.reps || "—"} @ {entry.actual.weight || "—"}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}