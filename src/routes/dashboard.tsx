import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Sparkles, Trash2 } from "lucide-react";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { DropoffAlerts } from "@/components/DropoffAlerts";
import { useClientPhases } from "@/hooks/use-client-phases";
import { useMemo } from "react";
import { planStatusInfo } from "@/lib/plan-status";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const [clients, setClients] = useState<number>(0);
  const [plans, setPlans] = useState<number>(0);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [recent, setRecent] = useState<Array<{ id: string; title: string; status: string; updated_at: string; client: { full_name: string } | null }>>([]);
  const [statusCounts, setStatusCounts] = useState<{ draft: number; ready: number; finalized: number }>({ draft: 0, ready: 0, finalized: 0 });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: clientRows }, { count: p }, { data: r }, { data: allPlans }] = await Promise.all([
        supabase.from("clients").select("id"),
        supabase.from("workout_plans").select("id", { count: "exact", head: true }),
        supabase
          .from("workout_plans")
          .select("id, title, status, updated_at, generation_state, generation_status, client:clients(full_name)")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("workout_plans")
          .select("status, generation_state, generation_status"),
      ]);
      const ids = (clientRows ?? []).map((c: any) => c.id);
      setClientIds(ids);
      setClients(ids.length);
      setPlans(p ?? 0);
      setRecent((r as any) ?? []);
      const counts = { draft: 0, ready: 0, finalized: 0 };
      for (const pl of (allPlans ?? []) as any[]) {
        const k = planStatusInfo(pl).key;
        if (k === "finalized") counts.finalized++;
        else if (k === "ready") counts.ready++;
        else counts.draft++;
      }
      setStatusCounts(counts);
    })();
  }, [user]);

  const removePlan = async (id: string) => {
    const { error } = await supabase.from("workout_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRecent((r) => r.filter((p) => p.id !== id));
    setPlans((n) => Math.max(0, n - 1));
    toast.success("Plan deleted");
  };

  const phases = useClientPhases(useMemo(() => clientIds, [clientIds]));
  const counts = useMemo(() => {
    const c = { active: 0, idle: 0, ready: 0, onboarding: 0 };
    Object.values(phases).forEach((p) => {
      if (p.kind === "active") c.active++;
      else if (p.kind === "idle") c.idle++;
      else if (p.kind === "ready") c.ready++;
      else if (p.kind === "onboarding" || p.kind === "assessment") c.onboarding++;
    });
    return c;
  }, [phases]);

  return (
    <div className="space-y-10">
      <OnboardingChecklist />
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("dashboard.eyebrow")}</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight">{t("dashboard.title")}</h1>
        </div>
        <Button asChild>
          <Link to="/clients" search={{ filter: "all" }}>
            <Plus className="mr-2 h-4 w-4" /> {t("dashboard.new_client")}
          </Link>
        </Button>
      </div>

      {clients > 0 && (
        <div className="flex flex-wrap gap-1 text-[11px] uppercase tracking-widest">
          {[
            { id: "active", label: t("dashboard.seg_active", { count: counts.active }) },
            { id: "ready", label: t("dashboard.seg_ready", { count: counts.ready }) },
            { id: "idle", label: t("dashboard.seg_idle", { count: counts.idle }) },
            { id: "onboarding", label: t("dashboard.seg_onboarding", { count: counts.onboarding }) },
          ].map((seg) => (
            <Link
              key={seg.id}
              to="/clients"
              search={{ filter: seg.id }}
              className="rounded-full bg-secondary px-3 py-1 text-muted-foreground transition hover:text-foreground"
            >
              {seg.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Users} label={t("dashboard.stat_clients")} value={clients} to="/clients" />
        <StatCard icon={FileText} label={t("dashboard.stat_plans")} value={plans} to="/plans" />
      </div>

      {(statusCounts.draft + statusCounts.ready + statusCounts.finalized) > 0 && (
        <PlansStatusBar counts={statusCounts} />
      )}

      <DropoffAlerts />

      <section>
        <h2 className="mb-4 text-lg font-bold">{t("dashboard.recent_plans")}</h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
            <p className="font-medium">{t("dashboard.no_plans")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.no_plans_hint")}</p>
            <Button asChild className="mt-4">
              <Link to="/clients" search={{ filter: "all" }}>{t("dashboard.add_a_client")}</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {recent.map((p) => (
              <div
                key={p.id}
                className="group flex items-center border-b border-border last:border-b-0 hover:bg-secondary/50"
              >
                <Link
                  to="/plans/$planId"
                  params={{ planId: p.id }}
                  className="flex flex-1 items-center justify-between px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.client?.full_name ?? "—"}</p>
                  </div>
                  {(() => {
                    const s = planStatusInfo(p as any, t as any);
                    return (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${s.className}`}
                      >
                        {s.label}
                      </span>
                    );
                  })()}
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      aria-label="Delete plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{p.title}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the plan and all logged sessions. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void removePlan(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlansStatusBar({ counts }: { counts: { draft: number; ready: number; finalized: number } }) {
  const total = counts.draft + counts.ready + counts.finalized;
  if (total === 0) return null;
  const segs = [
    { key: "finalized", label: "Finalised", n: counts.finalized, cls: "bg-emerald-500" },
    { key: "ready", label: "Ready", n: counts.ready, cls: "bg-emerald-400/60" },
    { key: "draft", label: "Draft", n: counts.draft, cls: "bg-muted-foreground/40" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>Plans by status</span>
        <span>{total} total</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
        {segs.map((s) => s.n > 0 && (
          <div key={s.key} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} />
            {s.label} <span className="text-foreground">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; to: "/clients" | "/plans" }) {
  return (
    <Link
      to={to}
      search={to === "/clients" ? { filter: "all" } : undefined as any}
      className="group block rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40 hover:bg-card/80"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground transition group-hover:text-accent" />
      </div>
      <p className="mt-3 text-4xl font-light tracking-tight">{value}</p>
    </Link>
  );
}