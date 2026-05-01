import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateBlueprint,
  approveBlueprint,
} from "@/server/phased/stage2-blueprint.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, RefreshCw, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BriefSheetButton } from "@/components/BriefSheetButton";
import { BlueprintArchetypesList } from "@/components/BlueprintArchetypesList";
import { BlueprintAiChat } from "@/components/BlueprintAiChat";
import { WeekMatrixGrid } from "@/components/WeekMatrixGrid";
import { ProgressionModelPicker } from "@/components/ProgressionModelPicker";

export const Route = createFileRoute("/plans/$planId/blueprint")({
  component: BlueprintRoute,
});

function BlueprintRoute() {
  const { planId } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="xl:flex xl:gap-6">
          <main className="min-w-0 flex-1">
            <BlueprintReview />
          </main>
          <aside className="hidden xl:block w-80 2xl:w-96 flex-shrink-0">
            <div className="sticky top-20 pb-6">
              <BriefContextRail planId={planId} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function BlueprintReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateBlueprint);
  const approveFn = useServerFn(approveBlueprint);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [briefApproved, setBriefApproved] = useState(false);

  async function load() {
    setLoading(true);
    setLastError(null);
    const { data } = await supabase
      .from("workout_plans")
      .select("title, blueprint, generation_state, client_id")
      .eq("id", planId)
      .maybeSingle();
    if (!data) {
      toast.error("Plan not found");
      setLastError("Plano não encontrado.");
      setLoading(false);
      return;
    }
    setPlanTitle((data as any).title ?? "");
    setClientId((data as any).client_id ?? null);
    const gen = (data as any).generation_state ?? {};
    const approvedStages: string[] = Array.isArray(gen?.approved_stages) ? gen.approved_stages : [];
    const hasBrief = approvedStages.includes("brief");
    setBriefApproved(hasBrief);
    const parsed = BlueprintSchema.safeParse((data as any).blueprint);
    setBlueprint(parsed.success ? parsed.data : null);
    setLoading(false);
    // Only auto-generate if brief is approved. Otherwise show actionable error.
    if (!parsed.success) {
      if (!hasBrief) {
        setLastError("Brief não aprovado para este plano. Aprova o Brief primeiro.");
        return;
      }
      regenerate();
    }
  }

  async function regenerate() {
    setBusy(true);
    setLastError(null);
    const res = await generateFn({ data: { planId } });
    setBusy(false);
    if (!res.ok) {
      const msg = res.error || "Blueprint failed";
      console.error("[Blueprint] regenerate failed", { planId, error: msg });
      setLastError(msg);
      toast.error(`Blueprint: ${msg}`);
      return;
    }
    setBlueprint(res.blueprint as Blueprint);
  }

  async function approve() {
    if (!blueprint) return;
    const parsed = BlueprintSchema.safeParse(blueprint);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid blueprint");
      return;
    }
    setBusy(true);
    const res = await approveFn({ data: { planId, blueprint: parsed.data } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Approve failed");
      return;
    }
    toast.success("Blueprint approved — generating Day 1");
    navigate({ to: "/plans/$planId/microcycle", params: { planId } });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading blueprint…
      </div>
    );
  }

  if (!blueprint) {
    if (lastError) {
      return (
        <div className="mx-auto max-w-2xl p-8">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-destructive">
                  Não foi possível gerar a Blueprint
                </h2>
                <p className="mt-1 text-sm text-foreground/80">{lastError}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {briefApproved && (
                    <button
                      onClick={regenerate}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Tentar de novo
                    </button>
                  )}
                  {clientId ? (
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      <ArrowLeft className="h-3 w-3" /> Voltar ao cliente
                    </Link>
                  ) : (
                    <Link
                      to="/plans"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      <ArrowLeft className="h-3 w-3" /> Voltar a Planos
                    </Link>
                  )}
                  {!briefApproved && clientId && (
                    <Link
                      to="/plans/$planId/brief"
                      params={{ planId }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Abrir Brief
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        <p className="mt-2 text-sm text-muted-foreground">A gerar Blueprint…</p>
      </div>
    );
  }

  const weekKeys = Object.keys(blueprint.week_to_session_map).sort(
    (a, b) => Number(a) - Number(b)
  );

  const archetypeIds = new Set(blueprint.session_archetypes.map((a) => a.id));
  const missingRefs = Array.from(
    new Set(
      weekKeys.flatMap((wk) =>
        (blueprint.week_to_session_map[wk] ?? []).filter((id) => !archetypeIds.has(id)),
      ),
    ),
  );
  const hasIntegrityError = missingRefs.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
          <Link
            to="/plans/$planId/brief"
            params={{ planId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Brief
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="text-xs text-muted-foreground">Stage 2 — Mesocycle blueprint</p>
          </div>
          <button
            onClick={approve}
            disabled={busy || hasIntegrityError}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            title={hasIntegrityError ? "Resolve as referências em falta antes de aprovar" : undefined}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Approve → Day 1
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <BriefSheetButton planId={planId} />
          <BlueprintAiChat
            planId={planId}
            blueprint={blueprint}
            onApplyPatch={(patch) => {
              setBlueprint({
                ...blueprint,
                ...(patch.session_archetypes ? { session_archetypes: patch.session_archetypes } : {}),
                ...(patch.week_to_session_map ? { week_to_session_map: patch.week_to_session_map } : {}),
                ...(patch.progression_model_proposal
                  ? { progression_model_proposal: patch.progression_model_proposal }
                  : {}),
              });
            }}
          />
          <button
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
        </div>
      </div>

      {hasIntegrityError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <strong>Atenção:</strong> a matriz Week × Day refere ids que já não existem em Session Archetypes:{" "}
          <span className="font-mono">{missingRefs.join(", ")}</span>. Corrige antes de aprovar.
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Session archetypes
        </h2>
        <BlueprintArchetypesList
          archetypes={blueprint.session_archetypes}
          onChange={(next) => setBlueprint({ ...blueprint, session_archetypes: next })}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Week × Day matrix
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-medium text-muted-foreground">Week</th>
                {Array.from({ length: blueprint.sessions_per_week }, (_, i) => (
                  <th key={i} className="p-2 text-left text-xs font-medium text-muted-foreground">
                    Day {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekKeys.map((wk) => (
                <tr key={wk} className="border-t border-border">
                  <td className="p-2 text-xs font-medium">W{wk}</td>
                  {(blueprint.week_to_session_map[wk] ?? []).map((id, di) => (
                    <td key={di} className="p-2">
                      <select
                        value={id}
                        onChange={(e) => {
                          const map = { ...blueprint.week_to_session_map };
                          const arr = [...(map[wk] ?? [])];
                          arr[di] = e.target.value;
                          map[wk] = arr;
                          setBlueprint({ ...blueprint, week_to_session_map: map });
                        }}
                        className={`rounded border bg-background px-2 py-1 text-xs ${
                          archetypeIds.has(id) ? "border-border" : "border-destructive text-destructive"
                        }`}
                      >
                        {!archetypeIds.has(id) && (
                          <option value={id}>{id} (em falta)</option>
                        )}
                        {blueprint.session_archetypes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.focus} · {a.id}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Progression model
        </h2>
        <select
          value={blueprint.progression_model_proposal.model}
          onChange={(e) =>
            setBlueprint({
              ...blueprint,
              progression_model_proposal: {
                ...blueprint.progression_model_proposal,
                model: e.target.value as Blueprint["progression_model_proposal"]["model"],
              },
            })
          }
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="linear">Linear</option>
          <option value="undulating">Undulating</option>
          <option value="block">Block</option>
        </select>
        <p className="mt-2 text-xs text-muted-foreground">
          {blueprint.progression_model_proposal.rationale}
        </p>
      </section>
    </div>
  );
}