import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Sparkles } from "lucide-react";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { DropoffAlerts } from "@/components/DropoffAlerts";
import { useClientPhases } from "@/hooks/use-client-phases";
import { useMemo } from "react";

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

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: clientRows }, { count: p }, { data: r }] = await Promise.all([
        supabase.from("clients").select("id"),
        supabase.from("workout_plans").select("id", { count: "exact", head: true }),
        supabase
          .from("workout_plans")
          .select("id, title, status, updated_at, client:clients(full_name)")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);
      const ids = (clientRows ?? []).map((c: any) => c.id);
      setClientIds(ids);
      setClients(ids.length);
      setPlans(p ?? 0);
      setRecent((r as any) ?? []);
    })();
  }, [user]);

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
              <Link
                key={p.id}
                to="/plans/$planId"
                params={{ planId: p.id }}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/50"
              >
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.client?.full_name ?? "—"}</p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wider text-secondary-foreground">
                  {p.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
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