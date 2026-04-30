import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, History } from "lucide-react";

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

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: list }] = await Promise.all([
        supabase.from("workout_plans").select("id,title").eq("id", planId).single(),
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

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8 bg-background p-4 sm:p-6 lg:p-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/plans/$planId" params={{ planId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to plan
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <History className="h-5 w-5 text-accent" /> Session history
          </h1>
          <p className="text-sm text-muted-foreground">{plan?.title ?? ""}</p>
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
                    <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-accent-foreground">
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