import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Sparkles, Trash2, BookOpen, Cake, Inbox, Clock, Copy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { usePlanBlockEvolution } from "@/hooks/use-clients-block-evolution";
import { EvolutionSparkline } from "@/components/EvolutionSparkline";
import { DropoffAlerts } from "@/components/DropoffAlerts";
import { DashboardHint } from "@/components/DashboardHint";
import { DemoClientBanner } from "@/components/DemoClientBanner";
import { useClientPhases } from "@/hooks/use-client-phases";
import { useMemo } from "react";
import { planStatusInfo } from "@/lib/plan-status";
import { toast } from "sonner";
import { daysUntilBirthday, turningAge } from "@/lib/birthdays";
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
  const [clientRows, setClientRows] = useState<Array<{ id: string; full_name: string; date_of_birth: string | null; intake_status: string; intake_token: string | null; intake_submitted_at: string | null; created_at: string }>>([]);
  const [recent, setRecent] = useState<Array<{ id: string; title: string; status: string; updated_at: string; client: { full_name: string } | null }>>([]);
  const [statusCounts, setStatusCounts] = useState<{ draft: number; ready: number; finalized: number }>({ draft: 0, ready: 0, finalized: 0 });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: cRows }, { count: p }, { data: r }, { data: allPlans }] = await Promise.all([
        supabase.from("clients").select("id, full_name, date_of_birth, intake_status, intake_token, intake_submitted_at, created_at"),
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
      const rows = (cRows as any[]) ?? [];
      setClientRows(rows);
      const ids = rows.map((c: any) => c.id);
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
    // Find the deleted plan so we can also update the status bar optimistically.
    const removed = recent.find((p) => p.id === id);
    setRecent((r) => r.filter((p) => p.id !== id));
    setPlans((n) => Math.max(0, n - 1));
    if (removed) {
      const k = planStatusInfo(removed as any).key;
      setStatusCounts((c) => ({
        ...c,
        [k]: Math.max(0, (c as any)[k] - 1),
      }));
    }
    toast.success(t("dashboard.plan_deleted"));
  };

  const recentPlanIds = useMemo(() => recent.map((p) => p.id), [recent]);
  const evolutionByPlan = usePlanBlockEvolution(recentPlanIds);

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

  // Build the "Attention" feed — actionable items ordered by urgency.
  const attention = useMemo(() => {
    const items: Array<{ kind: string; key: string; title: string; href?: string; clientId?: string; sub?: string; urgent?: boolean }> = [];
    for (const c of clientRows) {
      // Submitted, not yet reviewed
      if (c.intake_status === "submitted") {
        items.push({
          kind: "submitted", key: `sub-${c.id}`,
          title: t("dashboard.sub_submitted", { name: c.full_name }),
          sub: t("dashboard.sub_ready_for_review"),
          clientId: c.id, urgent: true,
        });
      }
      // Birthday in next 14 days
      const d = daysUntilBirthday(c.date_of_birth);
      if (d !== null && d <= 14) {
        const age = turningAge(c.date_of_birth);
        const bdayKey = d === 0 ? "dashboard.sub_birthday_today" : d === 1 ? "dashboard.sub_birthday_tomorrow" : "dashboard.sub_birthday_in";
        items.push({
          kind: "birthday", key: `bd-${c.id}`,
          title: t(bdayKey, { name: c.full_name, age: age ?? "", n: d }),
          sub: t("dashboard.sub_birthday_hint"),
          clientId: c.id,
        });
      }
      // Sent >7d ago, never opened/submitted
      if (c.intake_status === "sent" && c.intake_token) {
        const ageDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
        if (ageDays >= 7) {
          items.push({
            kind: "stale", key: `stale-${c.id}`,
            title: t("dashboard.sub_stale", { name: c.full_name }),
            sub: t("dashboard.sub_stale_hint", { n: ageDays }),
            clientId: c.id,
          });
        }
      }
    }
    // submitted first, then birthdays, then stale
    return items.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent)).slice(0, 6);
  }, [clientRows, t]);

  // Quick action: copy intake link of the most recent client without submission
  const quickIntakeClient = useMemo(() => {
    return clientRows.find((c) => c.intake_token && c.intake_status !== "submitted" && c.intake_status !== "reviewed");
  }, [clientRows]);
  const copyQuickIntake = async () => {
    if (!quickIntakeClient?.intake_token) return;
    const url = `${window.location.origin}/intake/${quickIntakeClient.intake_token}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("dashboard.intake_link_copied", { name: quickIntakeClient.full_name.split(" ")[0] }));
  };

  const isEmpty = clients === 0;
  const noPlansYet = clients > 0 && plans === 0;

  return (
    <div className="space-y-10">
      <OnboardingChecklist />
      {((user?.email ?? "").toLowerCase() === "aafonsodias@gmail.com") && <DemoClientBanner />}
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

      {/* Empty state — onboarding hero */}
      {/* Always-available, dismissable how-it-works guide (replaces the old
          empty-state-only hero — no redundancy). */}
      <DashboardHint />

      {/* Quick actions strip — visible once there's at least one client */}
      {!isEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          {quickIntakeClient && (
            <Button size="sm" variant="outline" onClick={copyQuickIntake}>
              <Copy className="mr-1.5 h-4 w-4" /> {t("dashboard.copy_intake", { name: quickIntakeClient.full_name.split(" ")[0] })}
            </Button>
          )}
          <Button asChild size="sm" variant="outline"><Link to="/plans" search={{}}><FileText className="mr-1.5 h-4 w-4" /> {t("dashboard.view_plans")}</Link></Button>
          <Button asChild size="sm" variant="ghost" className="ml-auto"><Link to="/manual"><BookOpen className="mr-1.5 h-4 w-4" /> {t("dashboard.manual")}</Link></Button>
        </div>
      )}

      {/* Attention panel — surfaces submitted intakes, birthdays, stale invites */}
      {attention.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{t("dashboard.attention")}</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {attention.map((it) => {
              const Icon = it.kind === "submitted" ? Inbox : it.kind === "birthday" ? Cake : Clock;
              return (
                <Link
                  key={it.key}
                  to="/clients/$clientId"
                  params={{ clientId: it.clientId! }}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-secondary/50"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${it.urgent ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    {it.sub && <p className="truncate text-xs text-muted-foreground">{it.sub}</p>}
                  </div>
                  {it.urgent && <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">{t("dashboard.review")}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {noPlansYet && attention.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-medium">{t("dashboard.next_step_title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.next_step_hint")}</p>
          <Button asChild className="mt-4" variant="outline"><Link to="/clients" search={{ filter: "all" }}>{t("dashboard.view_clients")}</Link></Button>
        </div>
      )}

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
            {isEmpty ? (
              <Button asChild className="mt-4">
                <Link to="/clients" search={{ filter: "all" }}>{t("dashboard.add_a_client")}</Link>
              </Button>
            ) : (
              <Button asChild className="mt-4" variant="outline">
                <Link to="/clients" search={{ filter: "all" }}>{t("dashboard.view_clients")}</Link>
              </Button>
            )}
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
                  <div className="flex shrink-0 items-center gap-2">
                    <EvolutionChip evo={evolutionByPlan[p.id]} />
                    {evolutionByPlan[p.id]?.series?.length ? (
                      <EvolutionSparkline
                        values={evolutionByPlan[p.id].series}
                        verdict={evolutionByPlan[p.id].verdict}
                      />
                    ) : null}
                    {(() => {
                      const s = planStatusInfo(p as any, t as any);
                      return (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${s.className}`}
                        >
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      aria-label={t("dashboard.delete_plan_aria")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("dashboard.delete_plan_title", { title: p.title })}</AlertDialogTitle>
                      <AlertDialogDescription>{t("dashboard.delete_plan_desc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("dashboard.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void removePlan(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {t("dashboard.delete")}
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
  const { t } = useTranslation("common");
  const total = counts.draft + counts.ready + counts.finalized;
  if (total === 0) return null;
  const segs = [
    { key: "finalized", label: t("dashboard.plan_status_finalized"), n: counts.finalized, cls: "bg-emerald-500" },
    { key: "ready", label: t("dashboard.plan_status_ready"), n: counts.ready, cls: "bg-emerald-400/60" },
    { key: "draft", label: t("dashboard.plan_status_draft"), n: counts.draft, cls: "bg-muted-foreground/40" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{t("dashboard.plans_by_status")}</span>
        <span>{t("dashboard.plans_total", { n: total })}</span>
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

function EvolutionChip({ evo }: { evo?: { hasPrior: boolean; deltaPct: number | null; verdict: "gain" | "flat" | "regression" | "unknown" } }) {
  const { t } = useTranslation("common");
  if (!evo || !evo.hasPrior) return null;
  const v = evo.verdict;
  const Icon = v === "gain" ? TrendingUp : v === "regression" ? TrendingDown : Minus;
  const cls = v === "gain"
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : v === "regression"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : v === "flat"
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-muted/30 text-muted-foreground border-border";
  const label = evo.deltaPct == null ? "—" : `${evo.deltaPct > 0 ? "+" : ""}${evo.deltaPct}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}
      title={t("dashboard.evo_title", { label })}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}