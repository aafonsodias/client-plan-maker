import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startDemoClientFull, getDemoRun, cancelDemoRun } from "@/server/demo-oneshot.functions";
import { useAuth } from "@/hooks/use-auth";

/**
 * Global background runner for Demo Lab generations. Mounted once at the
 * root so a run survives navigation between routes. Persists active run
 * ids to localStorage so a hard refresh resumes polling.
 *
 * This replaces the panel-local setInterval polling that died as soon as
 * the trainer left /dashboard.
 */

export type DemoRunStage = "client" | "prestage" | "plan" | "logbook" | "done";
export type DemoRunStatus = "running" | "done" | "failed";

export type ActiveDemoRun = {
  runId: string;
  durationWeeks: number;
  /** UI label/kind for the indicator. Defaults to demo_lab. */
  kind?: "demo_lab" | "demo_seed";
  title?: string;
  startedAt: number;
  stage: DemoRunStage | string;
  status: DemoRunStatus | string;
  planId: string | null;
  cancelled: boolean;
  error: string | null;
};

type Ctx = {
  runs: ActiveDemoRun[];
  startRun: (opts: { durationWeeks: number }) => Promise<string | null>;
  registerRun: (run: { runId: string; kind: "demo_lab" | "demo_seed"; title?: string; durationWeeks?: number }) => void;
  cancelRun: (runId: string) => Promise<void>;
  getRun: (runId: string) => ActiveDemoRun | undefined;
  /** Pause/resume the auto-cleanup of terminal runs (popover open). */
  holdRuns: (hold: boolean) => void;
};

const DemoRunsCtx = createContext<Ctx>({
  runs: [],
  startRun: async () => null,
  registerRun: () => {},
  cancelRun: async () => {},
  getRun: () => undefined,
  holdRuns: () => {},
});

const STORAGE_PREFIX = "forge.demoRuns.";

function loadFromStorage(userId: string): ActiveDemoRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(userId: string, runs: ActiveDemoRun[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(runs));
  } catch {
    /* quota or unavailable — best effort */
  }
}

export function DemoRunsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [runs, setRuns] = useState<ActiveDemoRun[]>([]);
  const startFn = useServerFn(startDemoClientFull);
  const pollFn = useServerFn(getDemoRun);
  const cancelFn = useServerFn(cancelDemoRun);
  const pollTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const holdRef = useRef(false);
  // Pending terminal-run ids waiting to be cleaned up after their flash.
  const pendingCleanupRef = useRef<Set<string>>(new Set());

  const holdRuns = useCallback((hold: boolean) => {
    holdRef.current = hold;
    if (!hold && pendingCleanupRef.current.size > 0) {
      const ids = Array.from(pendingCleanupRef.current);
      pendingCleanupRef.current.clear();
      setRuns((cur) => cur.filter((x) => !ids.includes(x.runId)));
    }
  }, []);

  // Hydrate from storage on user change
  useEffect(() => {
    if (!user) {
      setRuns([]);
      userIdRef.current = null;
      return;
    }
    userIdRef.current = user.id;
    setRuns(loadFromStorage(user.id));
  }, [user]);

  // Persist on change
  useEffect(() => {
    if (!userIdRef.current) return;
    saveToStorage(userIdRef.current, runs);
  }, [runs]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // Polling loop — runs whenever there are active (non-terminal) runs
  useEffect(() => {
    const active = runs.filter((r) => r.status !== "done" && r.status !== "failed" && !r.cancelled);
    if (active.length === 0) {
      stopPolling();
      return;
    }
    if (pollTimerRef.current) return; // already polling
    pollTimerRef.current = window.setInterval(async () => {
      // snapshot current ids to poll
      const ids = runs
        .filter((r) => r.status !== "done" && r.status !== "failed" && !r.cancelled)
        .map((r) => r.runId);
      if (ids.length === 0) {
        stopPolling();
        return;
      }
      for (const id of ids) {
        try {
          const row: any = await pollFn({ data: { runId: id } });
          if (!row) continue;
          setRuns((prev) => {
            const idx = prev.findIndex((r) => r.runId === id);
            if (idx === -1) return prev;
            const wasTerminal = prev[idx].status === "done" || prev[idx].status === "failed" || prev[idx].cancelled;
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              stage: row.stage ?? next[idx].stage,
              status: row.status ?? next[idx].status,
              planId: row.plan_id ?? next[idx].planId,
              cancelled: !!row.cancelled,
              error: row.error ?? null,
            };
            const nowTerminal =
              (row.stage === "done" && row.status === "done") ||
              row.status === "failed" ||
              row.cancelled;
            if (nowTerminal && !wasTerminal) {
              const r = next[idx];
              if (r.cancelled) {
                toast.info("Simulação cancelada.");
              } else if (r.status === "failed") {
                toast.error(`Simulação falhou${r.error ? `: ${r.error}` : "."}`);
              } else {
                toast.success("Simulação pronta.", {
                  action: r.planId
                    ? {
                        label: "Abrir plano",
                        onClick: () => void navigate({ to: "/plans/$planId", params: { planId: r.planId! } }),
                      }
                    : undefined,
                });
              }
              // remove terminal runs after a beat so the indicator can flash done.
              // Skip removal while the popover is open so users can read it.
              window.setTimeout(() => {
                if (holdRef.current) {
                  pendingCleanupRef.current.add(id);
                  return;
                }
                setRuns((cur) => cur.filter((x) => x.runId !== id));
              }, 4000);
            }
            return next;
          });
        } catch {
          /* swallow — best effort */
        }
      }
    }, 1500);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.length]);

  useEffect(() => () => stopPolling(), []);

  const startRun = useCallback<Ctx["startRun"]>(
    async ({ durationWeeks }) => {
      try {
        const res: any = await startFn({ data: { durationWeeks, locale: i18n.language } });
        if (!res?.ok || !res?.runId) {
          toast.error(res?.error ?? "Falhou a iniciar a simulação.");
          return null;
        }
        const run: ActiveDemoRun = {
          runId: res.runId,
          durationWeeks,
          kind: "demo_lab",
          startedAt: Date.now(),
          stage: "client",
          status: "running",
          planId: null,
          cancelled: false,
          error: null,
        };
        setRuns((prev) => [...prev, run]);
        toast.info("Simulação a correr em segundo plano. Podes navegar livremente.");
        return res.runId as string;
      } catch (e: any) {
        toast.error(e?.message ?? "Erro inesperado a iniciar.");
        return null;
      }
    },
    [startFn],
  );

  const registerRun = useCallback<Ctx["registerRun"]>(({ runId, kind, title, durationWeeks }) => {
    setRuns((prev) => {
      if (prev.some((r) => r.runId === runId)) return prev;
      return [
        ...prev,
        {
          runId,
          kind,
          title,
          durationWeeks: durationWeeks ?? 0,
          startedAt: Date.now(),
          stage: "client",
          status: "running",
          planId: null,
          cancelled: false,
          error: null,
        },
      ];
    });
  }, []);

  const cancelRun = useCallback<Ctx["cancelRun"]>(
    async (runId) => {
      try {
        await cancelFn({ data: { runId } });
        // Optimistically flag the run as cancelled so the indicator flips
        // immediately; the next poll will reconcile with the server.
        setRuns((prev) => prev.map((r) => (r.runId === runId ? { ...r, cancelled: true, status: "failed" } : r)));
        toast.info("A pedir para parar… (a stage atual termina antes de sair).");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha a cancelar.");
      }
    },
    [cancelFn],
  );

  const getRun = useCallback((runId: string) => runs.find((r) => r.runId === runId), [runs]);

  return (
    <DemoRunsCtx.Provider value={{ runs, startRun, registerRun, cancelRun, getRun, holdRuns }}>
      {children}
    </DemoRunsCtx.Provider>
  );
}

export const useDemoRuns = () => useContext(DemoRunsCtx);

export const DEMO_RUN_STAGES: { key: string; label: string }[] = [
  { key: "client", label: "Cliente + avaliação" },
  { key: "prestage", label: "Análise por secção" },
  { key: "plan", label: "Plano (brief → progressões)" },
  { key: "logbook", label: "Logbook" },
  { key: "done", label: "Pronto" },
];