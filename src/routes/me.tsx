import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { loadMe } from "@/server/me.functions";
import { ClientAvatar } from "@/components/ClientAvatar";
import { BrandMark } from "@/components/BrandMark";
import { Eye, Loader2, CheckCircle2, Circle, ArrowRight, Calendar as CalendarIcon } from "lucide-react";

/**
 * R69 — Trainee cockpit at /me.
 * Voice: PT "você" (formal/neutral); EN neutral.
 * Surfaces: hero (plano + bloco), semana actual (dias prescritos vs feitos),
 * sessões recentes. Read-only — log/edits vivem no link partilhado.
 */
export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MePage,
});

function MePage() {
  const search = Route.useSearch();
  const load = useServerFn(loadMe);
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    void (async () => setState(await load({ data: { as: search.as ?? null } })))();
  }, [load, search.as]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.linked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <BrandMark size="md" />
          <h1 className="mt-4 text-2xl font-light">A sua conta ainda não está ligada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça ao seu treinador um novo link de questionário e termine o processo nesse separador para ligar a conta.
          </p>
          <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const { client, plan, trainer, currentWeek, weekDays, recentSessions } = state;
  const previewing = !!state.previewing;

  // Map "done" status per day_label by checking recentSessions in current week.
  const doneLabels = new Set<string>(
    (recentSessions ?? [])
      .filter((s: any) => s.week_number === currentWeek)
      .map((s: any) => String(s.day_label || "").toLowerCase()),
  );
  const doneCount = (weekDays ?? []).filter((d: any) =>
    doneLabels.has(String(d.day_label || "").toLowerCase()),
  ).length;
  const totalDays = (weekDays ?? []).length;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {previewing && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" /> Pré-visualização como cliente · {client.full_name}
            </span>
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest hover:bg-amber-500/30"
            >
              Voltar à ficha
            </Link>
          </div>
        )}

        <header className="flex items-center gap-4">
          <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={56} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Olá</p>
            <h1 className="text-2xl font-light tracking-tight truncate">{client.full_name}</h1>
            {trainer ? (
              <p className="text-xs text-muted-foreground truncate">com {trainer.business_name || trainer.full_name}</p>
            ) : null}
          </div>
        </header>

        {plan ? (
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Plano actual</p>
                <h2 className="mt-1 text-lg font-medium truncate">{plan.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bloco {plan.block_number} · Semana {currentWeek} de {plan.duration_weeks}
                </p>
              </div>
              {totalDays > 0 && (
                <div className="shrink-0 rounded-full border border-border bg-background/60 px-3 py-1 text-xs tabular-nums">
                  {doneCount}/{totalDays} feitos
                </div>
              )}
            </div>
            {plan.summary ? (
              <p className="mt-3 text-sm text-muted-foreground">{plan.summary}</p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Plano actual</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sem plano activo. O seu treinador vai preparar o primeiro bloco em breve.
            </p>
          </section>
        )}

        {totalDays > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Esta semana</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Semana {currentWeek}</p>
            </div>
            <ul className="space-y-2">
              {weekDays.map((d: any) => {
                const done = doneLabels.has(String(d.day_label || "").toLowerCase());
                return (
                  <li
                    key={`${d.week_number}-${d.day_number}`}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Sessão {d.day_number}
                        {d.focus ? <span className="text-muted-foreground"> · {d.focus}</span> : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.exercise_count} exercício{d.exercise_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {recentSessions && recentSessions.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Sessões recentes</p>
            <ul className="space-y-2">
              {recentSessions.map((s: any) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      Semana {s.week_number} · {s.day_label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.session_date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })} ·{" "}
                      {s.exercise_count} exercício{s.exercise_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Mais funções em breve — mensagens, registo directo, progresso visual.
        </p>
      </div>
    </div>
  );
}
