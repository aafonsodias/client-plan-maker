import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ClientAvatar } from "@/components/ClientAvatar";
import { Trophy, Flame, Activity, ArrowRight, Bot } from "lucide-react";

export const Route = createFileRoute("/forge")({
  component: () => (
    <AppShell back={{ to: "/dashboard" }}>
      <Forge />
    </AppShell>
  ),
});

type Row = {
  clientId: string;
  name: string;
  photoUrl: string | null;
  isDemo: boolean;
  sessions: number;
  totalVolumeProxy: number; // count of (entries) flattened — proxy without parsing weight
  consistency: number; // sessions / weeks-since-plan
  lastSessionAt: string | null;
};

function Forge() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    // Pull every client + their newest plan + their session counts.
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, photo_url, created_at")
      .order("created_at", { ascending: false });
    if (!clients) return setRows([]);

    const ids = clients.map((c) => c.id);
    if (ids.length === 0) return setRows([]);

    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, client_id, created_at, status")
      .in("client_id", ids)
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    const planByClient = new Map<string, any>();
    for (const p of plans ?? []) if (!planByClient.has(p.client_id)) planByClient.set(p.client_id, p);

    const planIds = Array.from(planByClient.values()).map((p) => p.id);
    const sessionsByPlan = new Map<string, { count: number; entries: number; last: string | null }>();
    if (planIds.length > 0) {
      const { data: sess } = await supabase
        .from("workout_sessions")
        .select("plan_id, entries, session_date")
        .in("plan_id", planIds);
      for (const s of sess ?? []) {
        const cur = sessionsByPlan.get(s.plan_id) ?? { count: 0, entries: 0, last: null };
        cur.count += 1;
        const e = Array.isArray(s.entries) ? s.entries.length : 0;
        cur.entries += e;
        if (!cur.last || (s.session_date ?? "") > cur.last) cur.last = s.session_date ?? cur.last;
        sessionsByPlan.set(s.plan_id, cur);
      }
    }

    const out: Row[] = clients.map((c) => {
      const plan = planByClient.get(c.id);
      const stats = plan ? sessionsByPlan.get(plan.id) : undefined;
      const weeksSince = plan
        ? Math.max(1, Math.ceil((Date.now() - new Date(plan.created_at).getTime()) / (7 * 86400_000)))
        : 1;
      return {
        clientId: c.id,
        name: c.full_name,
        photoUrl: c.photo_url ?? null,
        isDemo: c.full_name?.endsWith("(demo)") ?? false,
        sessions: stats?.count ?? 0,
        totalVolumeProxy: stats?.entries ?? 0,
        consistency: stats?.count ? Math.min(100, Math.round((stats.count / weeksSince) * 33.3)) : 0, // 3/week target = 100%
        lastSessionAt: stats?.last ?? null,
      };
    });

    out.sort((a, b) => b.sessions - a.sessions || b.totalVolumeProxy - a.totalVolumeProxy);
    setRows(out);
  };

  if (rows === null) return <p className="text-muted-foreground">A carregar…</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Forge</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Compara clientes lado-a-lado. Bots e clientes reais juntos para preencher o cenário.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Ainda sem clientes. Adiciona um cliente demo a partir da página Clientes.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-secondary/40 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Cliente</div>
            <div className="col-span-2 text-right">Sessões</div>
            <div className="col-span-2 text-right">Volume (sets)</div>
            <div className="col-span-2 text-right">Consistência</div>
            <div className="col-span-1 text-right" />
          </div>
          {rows.map((r, idx) => (
            <Link
              key={r.clientId}
              to="/clients/$clientId"
              params={{ clientId: r.clientId }}
              search={{ demo: undefined as never }}
              className="grid grid-cols-12 items-center gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-secondary/40"
            >
              <div className="col-span-1 flex items-center gap-1 text-sm font-mono">
                {idx === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                <span>{idx + 1}</span>
              </div>
              <div className="col-span-4 flex items-center gap-3">
                <ClientAvatar name={r.name} photoUrl={r.photoUrl} size={32} />
                <div>
                  <p className="font-medium">{r.name.replace(" (demo)", "")}</p>
                  {r.isDemo && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Bot className="h-3 w-3" /> bot
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2 text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3 w-3 text-amber-500/70" />
                  {r.sessions}
                </span>
              </div>
              <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                {r.totalVolumeProxy}
              </div>
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center gap-1 text-sm">
                  <Activity className="h-3 w-3 text-emerald-500/70" />
                  {r.consistency}%
                </span>
              </div>
              <div className="col-span-1 text-right">
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}