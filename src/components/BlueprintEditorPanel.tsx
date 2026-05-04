import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateBlueprint,
  approveBlueprint,
  setTierOverride,
} from "@/server/phased/stage2-blueprint.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, RefreshCw, ArrowRight, ArrowLeft, AlertTriangle, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { BriefSheetButton } from "@/components/BriefSheetButton";
import { BlueprintArchetypesList } from "@/components/BlueprintArchetypesList";
import { BlueprintAiChat } from "@/components/BlueprintAiChat";
import { WeekMatrixGrid } from "@/components/WeekMatrixGrid";
import { ProgressionModelPicker } from "@/components/ProgressionModelPicker";
import { TierChip, type TierGuidelinesShape } from "@/components/TierChip";
import { useTranslation } from "react-i18next";
import type { Tier } from "@/server/phased/programming-tier.server";

export function BlueprintEditorPanel({
  planId,
  compact = false,
  onApproved,
  showOpenFullPage = false,
}: {
  planId: string;
  compact?: boolean;
  onApproved?: () => void;
  showOpenFullPage?: boolean;
}) {
  const navigate = useNavigate();
  const generateFn = useServerFn(generateBlueprint);
  const approveFn = useServerFn(approveBlueprint);
  const overrideFn = useServerFn(setTierOverride);
  const { i18n, t } = useTranslation("plan");
  const locale: "en" | "pt" = i18n.language?.startsWith("pt") ? "pt" : "en";
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [briefApproved, setBriefApproved] = useState(false);
  const [tier, setTier] = useState<Tier | null>(null);
  const [tierGuide, setTierGuide] = useState<TierGuidelinesShape | null>(null);
  const [tierOverridden, setTierOverridden] = useState(false);

  async function load() {
    setLoading(true);
    setLastError(null);
    const { data } = await supabase
      .from("workout_plans")
      .select("title, blueprint, generation_state, client_id, generation_meta")
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
    const meta = ((data as any).generation_meta ?? {}) as any;
    if (meta?.tier) {
      setTier(meta.tier);
      setTierGuide(meta.tier_guidelines ?? null);
      setTierOverridden(Boolean(meta.tier_override));
    }
    setLoading(false);
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
    if (onApproved) {
      onApproved();
    } else {
      navigate({ to: "/plans/$planId/microcycle", params: { planId } });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading blueprint…
      </div>
    );
  }

  if (!blueprint) {
    if (lastError) {
      return (
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
                {!compact && clientId && (
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    <ArrowLeft className="h-3 w-3" /> Voltar ao cliente
                  </Link>
                )}
                {!briefApproved && (
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
      );
    }
    return (
      <div className="p-8 text-center">
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

  const containerCls = compact
    ? "space-y-6"
    : "mx-auto max-w-4xl space-y-6 p-4 sm:p-6";

  return (
    <div className={containerCls}>
      {!compact && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              to="/plans/$planId/brief"
              params={{ planId }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> {t("actions.back_brief")}
            </Link>
            <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
            <p className="text-xs text-muted-foreground">Stage 2 — Mesocycle blueprint</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
          {t("actions.regenerate")}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {showOpenFullPage && (
            <Link
              to="/plans/$planId/blueprint"
              params={{ planId }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> {locale === "pt" ? "Página completa" : "Full page"}
            </Link>
          )}
          {!compact && (
            <button
              onClick={approve}
              disabled={busy || hasIntegrityError}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              title={hasIntegrityError ? "Resolve as referências em falta antes de aprovar" : undefined}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {t("actions.approve_blueprint")}
            </button>
          )}
        </div>
      </div>

      {tier && (
        <TierChip
          tier={tier}
          guidelines={tierGuide}
          locale={locale}
          overridden={tierOverridden}
          onOverride={async (next) => {
            const res = await overrideFn({ data: { planId, tier: next } });
            if (!res.ok) {
              toast.error(res.error || "Override failed");
              return;
            }
            toast.success(
              locale === "pt"
                ? `Override aplicado: ${next}. Carrega Regenerate para refazer a Blueprint.`
                : `Override applied: ${next}. Hit Regenerate to rebuild the Blueprint.`,
            );
            await load();
          }}
        />
      )}

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
        <WeekMatrixGrid
          key={blueprint.session_archetypes.map((a) => a.id).join("|")}
          blueprint={blueprint}
          onChange={setBlueprint}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Progression model
        </h2>
        <ProgressionModelPicker
          proposal={blueprint.progression_model_proposal}
          onChange={(next) =>
            setBlueprint({ ...blueprint, progression_model_proposal: next })
          }
        />
      </section>

      {/* Bottom "sign here" CTA — primary place to approve after reading. */}
      <div className="sticky bottom-3 z-10 mt-2 flex flex-col items-stretch gap-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground sm:max-w-md">
          {locale === "pt"
            ? "Quando estiver pronto, aprove a Blueprint para gerar a Semana 1."
            : "When you're happy with it, approve the blueprint to generate Week 1."}
        </div>
        <button
          onClick={approve}
          disabled={busy || hasIntegrityError}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-black shadow-md transition hover:opacity-95 disabled:opacity-50"
          title={hasIntegrityError ? "Resolve as referências em falta antes de aprovar" : undefined}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("actions.approve_blueprint")}
        </button>
      </div>
    </div>
  );
}

export default BlueprintEditorPanel;