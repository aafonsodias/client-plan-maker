import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Beaker, Zap, Activity, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoClientFull } from "@/server/demo-oneshot.functions";
import { advanceSimulation } from "@/server/demo-sessions.functions";
import { useAuth } from "@/hooks/use-auth";

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

  if (!user || user.email !== "aafonsodias@gmail.com") return null;

  const runInstant = async () => {
    if (busy) return;
    setBusy("instant");
    try {
      const res: any = await oneShotFn({ data: {} });
      if (!res?.ok) {
        toast.error(`Falhou em ${res?.stage ?? "?"}: ${res?.error ?? "erro desconhecido"}`);
        return;
      }
      toast.success(`Cliente demo + plano + ${res.sessions} sessões prontos.`);
      void navigate({
        to: "/clients/$clientId",
        params: { clientId: res.clientId },
        search: { demo: "play" },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado.");
    } finally {
      setBusy(null);
    }
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
      <p className="mt-3 text-[11px] text-muted-foreground">
        Instant cria um cliente fictício e gera o plano completo + 2 semanas de logs sem teatro.
        Avançar simulação adiciona uma sessão a cada cliente demo com plano pronto.
      </p>
    </div>
  );
}