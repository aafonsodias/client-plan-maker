import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, loadProgress } from "@/server/me.functions";
import { MeShell } from "@/components/me/MeShell";
import { Loader2, TrendingUp, Trophy, Camera, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/me/progresso")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MeProgressoPage,
});

function MeProgressoPage() {
  const search = Route.useSearch();
  const loadShell = useServerFn(loadMe);
  const loadProg = useServerFn(loadProgress);
  const { t } = useTranslation("me");
  const [shell, setShell] = useState<any>(null);
  const [prog, setProg] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, p] = await Promise.all([
        loadShell({ data: { as: search.as ?? null } }),
        loadProg({ data: { as: search.as ?? null } }),
      ]);
      if (cancelled) return;
      setShell(s);
      setProg(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadShell, loadProg, search.as]);

  if (!shell || !shell.linked || !prog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MeShell
      client={shell.client}
      trainer={shell.trainer}
      previewing={shell.previewing}
      unreadCount={shell.unreadCount ?? 0}
    >
      <header>
        <h1 className="text-2xl font-light tracking-tight">{t("progress.title")}</h1>
        {prog.blockNumber > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Bloco {prog.blockNumber}</p>
        )}
      </header>

      <StreakStrip strip={prog.strip ?? []} />

      {prog.capacity?.length > 0 && <CapacityCard rows={prog.capacity} />}

      <TopLifts lifts={prog.topLifts ?? []} />

      <WeightChart data={prog.weightSeries ?? []} />

      <PhotoGrid photos={prog.photos ?? []} />
    </MeShell>
  );
}

function StreakStrip({ strip }: { strip: Array<{ date: string; session: boolean; checkin: boolean }> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
        Últimos 14 dias
      </p>
      <div className="grid grid-cols-14 gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {strip.map((d) => {
          const tone = d.session && d.checkin
            ? "bg-emerald-500/80"
            : d.session || d.checkin
              ? "bg-amber-500/60"
              : "bg-muted";
          const day = new Date(d.date).getDate();
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-full rounded-md ${tone}`}
                title={`${d.date} · ${d.session ? "treino" : ""}${d.session && d.checkin ? " + " : ""}${d.checkin ? "check-in" : ""}`}
              />
              <span className="text-[9px] tabular-nums text-muted-foreground/70">{day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/80" /> Treino + check-in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60" /> Um dos dois
        </span>
      </div>
    </section>
  );
}

function CapacityCard({ rows }: { rows: Array<{ name: string; deltaLoadPct: number; deltaE1rmPct: number }> }) {
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          Ganho de capacidade vs bloco anterior
        </p>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                r.deltaE1rmPct >= 0
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-700 dark:text-red-400"
              }`}
            >
              {r.deltaE1rmPct >= 0 ? "+" : ""}
              {r.deltaE1rmPct}% e1RM
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopLifts({ lifts }: { lifts: Array<{ name: string; e1rm: number; load: number; reps: number; date: string }> }) {
  if (lifts.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Top lifts</p>
        </div>
        <p className="text-sm text-muted-foreground">Sem sessões registadas ainda.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Top lifts (e1RM)</p>
      </div>
      <ul className="space-y-2">
        {lifts.map((l, i) => (
          <li key={l.name} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {l.load}kg × {l.reps} · {new Date(l.date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{l.e1rm}kg</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeightChart({ data }: { data: Array<{ date: string; weight_kg: number }> }) {
  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Peso (90 dias)</p>
        </div>
        <p className="text-sm text-muted-foreground">Sem registos de peso ainda.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Peso (90 dias)</p>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
              fontSize={10}
              stroke="var(--muted-foreground)"
            />
            <YAxis fontSize={10} stroke="var(--muted-foreground)" domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--card-foreground)",
              }}
              labelFormatter={(v) => new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}
              formatter={(v: any) => [`${v} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="weight_kg"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PhotoGrid({ photos }: { photos: Array<{ name: string; url: string; created_at: string | null }> }) {
  if (photos.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Fotos de progresso</p>
        </div>
        <p className="text-sm text-muted-foreground">Ainda sem fotos.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Fotos de progresso</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="group relative aspect-square overflow-hidden rounded-lg border border-border/60"
          >
            <img
              src={p.url}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}