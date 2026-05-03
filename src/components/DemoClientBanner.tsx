import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, Loader2, Trash2, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureDemoClient, wipeDemoContent } from "@/server/demo-seed.functions";
import { getDemoRun } from "@/server/demo-oneshot.functions";
import { rotateDemoYear } from "@/server/demo-year.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * DemoClientBanner — auto-creates one demo client + plan + 4-week logbook on
 * the trainer's first dashboard visit so they can poke around without filling
 * an intake first. Idempotent (server-gated by profiles.demo_seeded_at).
 * Shows a "Remove demo" action while at least one demo client exists, so
 * coaches can wipe it the moment it stops being useful.
 */
export function DemoClientBanner() {
  const { user } = useAuth();
  const seed = useServerFn(ensureDemoClient);
  const wipe = useServerFn(wipeDemoContent);
  const poll = useServerFn(getDemoRun);
  const rotate = useServerFn(rotateDemoYear);
  const [runId, setRunId] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("client");
  const [done, setDone] = useState(false);
  const [demoClient, setDemoClient] = useState<{ id: string; name: string; planId: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  // Look up any existing demo client so we can render the "open" / "remove" actions.
  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, workout_plans(id)")
      .eq("trainer_id", user.id)
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as any)?.[0];
    if (row) {
      setDemoClient({
        id: row.id,
        name: row.full_name,
        planId: row.workout_plans?.[0]?.id ?? null,
      });
    } else {
      setDemoClient(null);
    }
  };

  // First effect: kick the seed once per mount, then load existing demo client.
  useEffect(() => {
    if (!user || fired.current) return;
    fired.current = true;
    void (async () => {
      try {
        const res: any = await seed();
        if (res?.runId) setRunId(res.runId);
        if (res?.alreadySeeded) setDone(true);
      } catch (e) {
        console.error("[DemoClientBanner] seed", e);
      }
      void refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Poll while a run is active.
  useEffect(() => {
    if (!runId || done) return;
    const id = window.setInterval(async () => {
      try {
        const row: any = await poll({ data: { runId } });
        if (!row) return;
        setStage(row.stage);
        if ((row.stage === "done" && row.status === "done") || row.status === "failed" || row.cancelled) {
          window.clearInterval(id);
          setDone(true);
          void refresh();
        }
      } catch {
        /* noop */
      }
    }, 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, done]);

  const removeDemo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await wipe();
      toast.success("Conteúdo demo removido.");
      setDemoClient(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou a remover.");
    } finally {
      setBusy(false);
    }
  };

  // Show nothing if seed completed and there's no demo (user wiped it).
  if (done && !demoClient && !runId) return null;

  const stageLabel: Record<string, string> = {
    client: "A criar cliente fictício…",
    prestage: "A analisar avaliação…",
    plan: "A montar o plano…",
    logbook: "A semear 1 ano de mesociclos (13 blocos)…",
    done: "Pronto!",
  };

  const inProgress = !!runId && !done;

  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          {inProgress ? (
            <>
              <p className="text-sm font-medium">A preparar a tua conta demo</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stageLabel[stage] ?? "A trabalhar…"} (não conta para a tua quota)
              </p>
            </>
          ) : demoClient ? (
            <>
              <p className="text-sm font-medium">
                Cliente demo pronto: <span className="text-accent">{demoClient.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Explora a app com dados reais e remove quando quiseres.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium">A preparar a tua conta demo…</p>
          )}
        </div>
        {demoClient && !inProgress && (
          <div className="flex items-center gap-2">
            {demoClient.planId && (
              <Button asChild size="sm" variant="outline" className="border-accent/40">
                <Link to="/plans/$planId" params={{ planId: demoClient.planId }}>
                  Abrir plano demo <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className="text-muted-foreground"
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  const r: any = await rotate();
                  toast.success(`Histórico avançado +1 ano (${r?.rotated ?? 0} sessões).`);
                } catch (e: any) {
                  toast.error(e?.message ?? "Falhou rodar o ano.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Rodar +1 ano
            </Button>
            <Button size="sm" variant="ghost" onClick={removeDemo} disabled={busy} className="text-muted-foreground">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover demo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}