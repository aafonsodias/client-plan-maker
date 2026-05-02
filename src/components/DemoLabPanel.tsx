import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Beaker, Zap, Activity, Loader2, Trophy, Check, X, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoClientFull } from "@/server/demo-oneshot.functions";
import { advanceSimulation } from "@/server/demo-sessions.functions";
import { useAuth } from "@/hooks/use-auth";

type GateState = "idle" | "running" | "done" | "failed";
const GATE_LABELS = [
  { key: "client", label: "Cliente + avaliação" },
  { key: "brief", label: "Brief" },
  { key: "blueprint", label: "Blueprint" },
  { key: "microcycle", label: "Semana 1 (microciclo)" },
  { key: "progressions", label: "Progressões" },
  { key: "finalize", label: "Finalizar plano" },
  { key: "logbook", label: "Logbook (2 semanas)" },
] as const;

/**
 * Dev-only Demo Lab panel.
 *
 * Three actions:
 *  - Instant: one-shot AI client + plan + 2 weeks of logs (no theatrics).
 *  - Theatrical: existing scroll-driven flow (kept for showcase use).
 *  - Advance simulation: tick every demo client one session forward.
 *
 * Gated to the founder email (aafonsodias@gmail.com) so it never leaks to
 * regular trainers' UI. Same gate already used by the founder badge.
 */
export function DemoLabPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const oneShotFn = useServerFn(createDemoClientFull);
  const tickFn = useServerFn(advanceSimulation);
  const [busy, setBusy] = useState<"instant" | "tick" | null>(null);
  const [gates, setGates] = useState<Record<string, GateState>>({});
  const cancelledRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);

  if (!user || user.email !== "aafonsodias@gmail.com") return null;

  const setGate = (key: string, state: GateState) =>
    setGates((g) => ({ ...g, [key]: state }));

  const resetGates = () => {
    setGates(Object.fromEntries(GATE_LABELS.map((g) => [g.key, "idle"])));
  };

  // Drive a sequential "running" animation while the one-shot server call
  // executes. Real per-stage events would require streaming; this gives the
  // founder the cancellable visual feedback that was missing.
  const startGateAnimation = () => {
    cancelledRef.current = false;
    resetGates();
    let i = 0;
    setGate(GATE_LABELS[0].key, "running");
    if (advanceTimerRef.current) window.clearInterval(advanceTimerRef.current);
    advanceTimerRef.current = window.setInterval(() => {
      if (cancelledRef.current) return;
      if (i >= GATE_LABELS.length - 1) return;
      setGates((g) => ({
        ...g,
        [GATE_LABELS[i].key]: "done",
        [GATE_LABELS[i + 1].key]: "running",
      }));
      i += 1;
    }, 4000);
  };

  const stopGateAnimation = () => {
    if (advanceTimerRef.current) window.clearInterval(advanceTimerRef.current);
    advanceTimerRef.current = null;
  };

  useEffect(() => () => stopGateAnimation(), []);

  const runInstant = async () => {
    if (busy) return;
    setBusy("instant");
    startGateAnimation();
    try {
      const res: any = await oneShotFn({ data: {} });
      stopGateAnimation();
      if (cancelledRef.current) {
        toast.info("Geração cancelada.");
        return;
      }
      if (!res?.ok) {
        // Mark the failed stage based on res.stage
        const failedKey =
          res?.stage?.includes("brief") ? "brief"
          : res?.stage?.includes("blueprint") ? "blueprint"
          : res?.stage?.includes("microcycle") ? "microcycle"
          : res?.stage?.includes("progression") ? "progressions"
          : res?.stage === "finalize" ? "finalize"
          : res?.stage === "create_client" ? "client"
          : "logbook";
        setGates((g) => {
          const next = { ...g };
          // Mark previous as done, failed one as failed
          let seenFailed = false;
          for (const gl of GATE_LABELS) {
            if (gl.key === failedKey) { next[gl.key] = "failed"; seenFailed = true; }
            else if (!seenFailed) next[gl.key] = "done";
            else next[gl.key] = "idle";
          }
          return next;
        });
        toast.error(`Falhou em ${res?.stage ?? "?"}: ${res?.error ?? "erro desconhecido"}`);
        return;
      }
      setGates(Object.fromEntries(GATE_LABELS.map((g) => [g.key, "done"])));
      toast.success(`Cliente demo + plano + ${res.sessions} sessões prontos.`);
      void navigate({
        to: "/plans/$planId",
        params: { planId: res.planId },
      });
    } catch (e: any) {
      stopGateAnimation();
      toast.error(e?.message ?? "Erro inesperado.");
    } finally {
      setBusy(null);
      stopGateAnimation();
    }
  };

  const cancelInstant = () => {
    cancelledRef.current = true;
    stopGateAnimation();
    toast.info("A pedir para parar… (a chamada em curso ainda termina no servidor)");
  };

  const runTick = async () => {
    if (busy) return;
    setBusy("tick");
    try {
      const res: any = await tickFn();
      if (res?.ticked > 0) toast.success(`${res.ticked} sessões adicionadas.`);
      else toast.info(res?.message ?? "Nada para avançar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Beaker className="h-4 w-4 text-amber-500" />
        <p className="text-xs uppercase tracking-widest text-amber-500/90">Demo Lab · Founder only</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runInstant()}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          {busy === "instant" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Instant: cliente + plano + 2 semanas
        </Button>
        {busy === "instant" && (
          <Button size="sm" variant="ghost" onClick={cancelInstant} className="text-amber-400 hover:text-amber-300">
            <Square className="mr-2 h-4 w-4" /> Parar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runTick()}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          {busy === "tick" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Avançar simulação (+1 sessão / cliente demo)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigate({ to: "/forge" })}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          <Trophy className="mr-2 h-4 w-4" />
          Forge (leaderboard)
        </Button>
      </div>
      {busy === "instant" || Object.values(gates).some((v) => v === "failed") ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-background/40 p-3">
          <ol className="space-y-1.5 text-[11px]">
            {GATE_LABELS.map((g) => {
              const s = gates[g.key] ?? "idle";
              const Icon =
                s === "done" ? Check
                : s === "failed" ? X
                : s === "running" ? Loader2
                : null;
              const tone =
                s === "done" ? "text-emerald-400"
                : s === "failed" ? "text-red-400"
                : s === "running" ? "text-amber-300"
                : "text-muted-foreground/60";
              return (
                <li key={g.key} className={`flex items-center gap-2 ${tone}`}>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/40">
                    {Icon ? <Icon className={`h-3 w-3 ${s === "running" ? "animate-spin" : ""}`} /> : null}
                  </span>
                  <span>{g.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Instant cria um cliente fictício e gera o plano completo + 2 semanas de logs sem teatro.
        Avançar simulação adiciona uma sessão a cada cliente demo com plano pronto.
      </p>
    </div>
  );
}