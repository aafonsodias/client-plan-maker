import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Trash2, ArrowRight, RotateCw, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureDemoClient, wipeDemoContent } from "@/server/demo-seed.functions";
import { rotateDemoYear } from "@/server/demo-year.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDemoRuns } from "@/contexts/DemoRunsContext";
import { useTour } from "@/contexts/TourContext";

/**
 * DemoClientBanner — auto-creates one demo client + plan + 4-week logbook on
 * the trainer's first dashboard visit so they can poke around without filling
 * an intake first. Idempotent (server-gated by profiles.demo_seeded_at).
 * Shows a "Remove demo" action while at least one demo client exists, so
 * coaches can wipe it the moment it stops being useful.
 */
export function DemoClientBanner() {
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { registerRun, getRun } = useDemoRuns();
  const tour = useTour();
  const seed = useServerFn(ensureDemoClient);
  const wipe = useServerFn(wipeDemoContent);
  const rotate = useServerFn(rotateDemoYear);
  const [runId, setRunId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [demoClient, setDemoClient] = useState<{ id: string; name: string; planId: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  // Look up any existing demo client so we can render the "open" / "remove" actions.
  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("trainer_id", user.id)
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as any)?.[0];
    if (!row) { setDemoClient(null); return; }
    // Pick the most recent (ready) block to deep-link into.
    const { data: plan } = await supabase
      .from("workout_plans")
      .select("id")
      .eq("client_id", row.id)
      .eq("is_demo", true)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDemoClient({
      id: row.id,
      name: row.full_name,
      planId: (plan as any)?.id ?? null,
    });
  };

  // First effect: kick the seed once per mount, then load existing demo client.
  useEffect(() => {
    if (!user || fired.current) return;
    fired.current = true;
    void (async () => {
      try {
        const res: any = await seed();
        if (res?.runId) {
          setRunId(res.runId);
          registerRun({ runId: res.runId, kind: "demo_seed", title: t("demo.jobs.demo_seed") });
        }
        if (res?.alreadySeeded) setDone(true);
      } catch (e) {
        console.error("[DemoClientBanner] seed", e);
      }
      void refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Watch the global run for completion (the global provider polls).
  useEffect(() => {
    if (!runId || done) return;
    const r = getRun(runId);
    if (!r) return;
    if ((r.stage === "done" && r.status === "done") || r.status === "failed" || r.cancelled) {
      setDone(true);
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, done, getRun]);

  const removeDemo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await wipe();
      toast.success(t("demo.removed_toast"));
      setDemoClient(null);
    } catch (e: any) {
      toast.error(e?.message ?? t("demo.removed_toast"));
    } finally {
      setBusy(false);
    }
  };

  // Show nothing if seed completed and there's no demo (user wiped it).
  if (done && !demoClient && !runId) return null;

  const inProgress = !!runId && !done;
  const openClient = () => {
    if (!demoClient) return;
    void navigate({ to: "/clients/$clientId", params: { clientId: demoClient.id } });
  };
  const startTour = () => {
    if (!demoClient) return;
    tour.start({ clientId: demoClient.id, planId: demoClient.planId });
  };

  return (
    <div data-tour="demo-banner" className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-4 w-4 shrink-0 text-accent" />
        <button
          type="button"
          onClick={openClient}
          disabled={!demoClient}
          className="min-w-0 flex-1 cursor-pointer text-left transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-100"
        >
          {inProgress ? (
            <>
              <p className="text-sm font-medium">{t("demo.preparing_title")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("demo.preparing_desc")}
              </p>
            </>
          ) : demoClient ? (
            <>
              <p className="text-sm font-medium">
                {t("demo.ready_title", { name: "" })}
                <span className="text-accent">{demoClient.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("demo.ready_desc")}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium">{t("demo.preparing_title")}</p>
          )}
        </button>
        {demoClient && !inProgress && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-accent/40" onClick={startTour}>
              <Compass className="mr-1.5 h-3.5 w-3.5" /> {t("demo.take_tour")}
            </Button>
            {demoClient.planId && (
              <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
                <Link to="/plans/$planId" params={{ planId: demoClient.planId }}>
                  {t("demo.open_plan")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
                  toast.success(t("demo.rotate_toast", { count: r?.rotated ?? 0 }));
                } catch (e: any) {
                  toast.error(e?.message ?? t("demo.rotate_failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> {t("demo.rotate_year")}
            </Button>
            <Button size="sm" variant="ghost" onClick={removeDemo} disabled={busy} className="text-muted-foreground">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t("demo.remove")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}