import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, loadHistory } from "@/server/me.functions";
import { MeShell } from "@/components/me/MeShell";
import { Loader2, ChevronDown, ChevronUp, Calendar } from "lucide-react";

export const Route = createFileRoute("/me/historico")({
  validateSearch: (s: Record<string, unknown>): { as?: string } => ({
    as: typeof s.as === "string" ? s.as : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: MeHistoricoPage,
});

type Session = {
  id: string;
  session_date: string;
  day_label: string;
  week_number: number;
  block_number: number;
  plan_title: string;
  exercise_count: number;
  avg_rpe: number | null;
  notes: string | null;
  entries: Array<{
    name: string;
    sets: Array<{ load: number | null; reps: number | null; rpe: number | null }>;
    prescribed: any;
  }>;
};

function MeHistoricoPage() {
  const search = Route.useSearch();
  const loadShell = useServerFn(loadMe);
  const loadList = useServerFn(loadHistory);
  const { t } = useTranslation("me");
  const [shell, setShell] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, h] = await Promise.all([
        loadShell({ data: { as: search.as ?? null } }),
        loadList({ data: { as: search.as ?? null } }),
      ]);
      if (cancelled) return;
      setShell(s);
      setSessions(((h as any).sessions ?? []) as Session[]);
      setCursor((h as any).nextCursor ?? null);
      setHasMore(!!(h as any).nextCursor);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadShell, loadList, search.as]);

  const onLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const h = await loadList({ data: { as: search.as ?? null, cursor } });
      setSessions((prev) => [...prev, ...((h as any).sessions ?? [])]);
      setCursor((h as any).nextCursor ?? null);
      setHasMore(!!(h as any).nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!shell || !shell.linked) {
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
        <h1 className="text-2xl font-light tracking-tight">{t("history.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? "sessão" : "sessões"}
        </p>
      </header>

      {sessions.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">Sem sessões registadas ainda.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </ul>
      )}

      {hasMore && sessions.length > 0 && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mx-auto flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Carregar mais
        </button>
      )}
    </MeShell>
  );
}

function SessionRow({ s }: { s: Session }) {
  const [open, setOpen] = useState(false);
  const dateLabel = new Date(s.session_date).toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {s.day_label}
            <span className="ml-1.5 text-muted-foreground">
              · Bloco {s.block_number} · Sem {s.week_number}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
          <span>{s.exercise_count} ex</span>
          {s.avg_rpe != null ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              RPE {s.avg_rpe}
            </span>
          ) : null}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/60 bg-background/40 px-4 py-3">
          {s.entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem detalhes.</p>
          ) : (
            <ul className="space-y-2">
              {s.entries.map((e, i) => (
                <li key={i}>
                  <p className="text-[12px] font-medium">{e.name}</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {e.sets.map((set, j) => (
                      <li
                        key={j}
                        className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                      >
                        {set.load ?? "—"}kg × {set.reps ?? "—"}
                        {set.rpe ? ` @${set.rpe}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {s.notes ? <p className="mt-3 text-[11px] italic text-muted-foreground">"{s.notes}"</p> : null}
        </div>
      )}
    </li>
  );
}