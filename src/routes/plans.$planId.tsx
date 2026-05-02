import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import {
  Download, Plus, Save, Trash2, CheckCircle2,
  Settings as SettingsIcon, Lock, LockOpen, NotebookPen, Pencil,
  Share2, Copy, RefreshCw, History, Eye, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, Heart, Check, MinusCircle, XCircle, MessageCircle, PlayCircle, BarChart3, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { generatePlanPdf, generateLogsheetPdf, isLegacyPlan, type PlanData, type Week, type Day, type Exercise, type SectionItem } from "@/lib/pdf";
import { planStatusInfo } from "@/lib/plan-status";
import { useTranslation } from "react-i18next";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanDraft } from "@/server/plan.functions";
import { ensureShareToken, revokeShareToken } from "@/server/sessions.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { SessionDayView } from "@/components/SessionDayView";
import { MesocycleTableView } from "@/components/MesocycleTableView";
import { ValidationReport } from "@/components/ValidationReport";
import { PlanAssessmentSheet } from "@/components/PlanAssessmentSheet";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ClientAvatar } from "@/components/ClientAvatar";
import { BlockTransitionDialog } from "@/components/BlockTransitionDialog";
import { markPlanFinished } from "@/server/blocks-manual.functions";
// Trainer-side ops use the browser supabase client directly (RLS-protected).
// Share-token mutations go through server fns so token + expiry stay in sync.

export const Route = createFileRoute("/plans/$planId")({
  component: PlanRoute,
});

function PlanRoute() {
  const { planId } = Route.useParams();
  const location = useLocation();
  const isBasePlanRoute = location.pathname === `/plans/${planId}`;

  if (!isBasePlanRoute) return <Outlet />;

  return (
    <AppShell back={{ to: "/plans", label: "All plans" }}>
      <PlanEditor />
    </AppShell>
  );
}

type Mode = "view" | "edit" | "log" | "results";
type SessionRow = {
  id: string; week_number: number; day_label: string; session_date: string;
  logged_by: string; entries: any[]; session_notes: string | null;
  status?: "done" | "partial" | "missed" | null;
};

function PlanEditor() {
  const { planId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t: tCommon } = useTranslation("common");
  const [plan, setPlan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [data, setData] = useState<PlanData>({ weeks: [] });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const seedFn = useServerFn(seedDemoSessions);
  const [seeding, setSeeding] = useState(false);
  const markFinishedFn = useServerFn(markPlanFinished);
  // Block transition (manual + IA) is wrapped inside <BlockTransitionDialog />.
  // True when this plan was built by the phased generator and is now complete.
  // In that case `plan_data.weeks` is empty by design — the source of truth is
  // `workout_plan_days`. We synthesize a PlanData for ViewMode + PDF export.
  const [isPhasedComplete, setIsPhasedComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("workout_plans").select("*").eq("id", planId).single();
      setPlan(p);
      // Phased plan routing:
      //   - in-progress stages (brief / blueprint / microcycle / progressions)
      //     → redirect to that stage's editor
      //   - "complete" → stay here and render the finished plan from
      //     workout_plan_days (the new source of truth)
      const gs: any = (p as any)?.generation_state;
      const stage: string | undefined = gs?.stage;
      if (stage && stage !== "complete") {
        const stageRoute: Record<string, "/plans/$planId/brief" | "/plans/$planId/blueprint" | "/plans/$planId/microcycle" | "/plans/$planId/progressions" | "/plans/$planId/sessions"> = {
          brief: "/plans/$planId/brief",
          blueprint: "/plans/$planId/blueprint",
          microcycle: "/plans/$planId/microcycle",
          progressions: "/plans/$planId/progressions",
          done: "/plans/$planId/sessions",
        };
        const to = stageRoute[stage];
        if (to) {
          console.info("[PlanEditor] redirect", { planId, stage, to });
          navigate({ to, params: { planId }, replace: true });
          return;
        }
      }
      const phasedComplete = stage === "complete" || (p as any)?.generation_status === "complete";
      if (phasedComplete) {
        setIsPhasedComplete(true);
        const { data: dayRows } = await supabase
          .from("workout_plan_days")
          .select("week_number, day_number, day_label, focus, rationale, content")
          .eq("plan_id", planId)
          .order("week_number", { ascending: true })
          .order("day_number", { ascending: true });
        const weeksMap = new Map<number, Week>();
        for (const row of (dayRows ?? []) as any[]) {
          const wn = row.week_number as number;
          if (!weeksMap.has(wn)) {
            weeksMap.set(wn, { week_number: wn, focus: "", days: [] } as Week);
          }
          const wk = weeksMap.get(wn)!;
          const content = row.content ?? {};
          const exercises = Array.isArray(content.exercises) ? content.exercises : [];
          wk.days.push({
            day_label: row.day_label ?? `Day ${row.day_number}`,
            focus: row.focus ?? "",
            rationale: row.rationale ?? undefined,
            exercises,
            warmup: Array.isArray(content.warmup) ? content.warmup : undefined,
            activation: Array.isArray(content.activation) ? content.activation : undefined,
            dynamic_stretches: Array.isArray(content.dynamic_stretches) ? content.dynamic_stretches : undefined,
            cooldown: Array.isArray(content.cooldown) ? content.cooldown : undefined,
            finisher: Array.isArray(content.finisher) ? content.finisher : undefined,
            finisher_enabled: typeof content.finisher_enabled === "boolean" ? content.finisher_enabled : undefined,
            cardio: Array.isArray(content.cardio) ? content.cardio : undefined,
          } as Day);
        }
        const weeks = Array.from(weeksMap.values()).sort((a, b) => a.week_number - b.week_number);
        setData({ weeks });
      } else {
        setData((p?.plan_data as unknown as PlanData) ?? { weeks: [] });
      }
      if (p?.client_id) {
        const { data: c } = await supabase.from("clients").select("*").eq("id", p.client_id).single();
        setClient(c);
      }
      const { data: pr } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(pr);
      if (pr?.logo_url) {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(pr.logo_url, 3600);
        setLogoUrl(signed?.signedUrl ?? null);
      }
      try {
        const { data: list } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("plan_id", planId)
          .order("session_date", { ascending: false });
        setSessions((list as unknown as SessionRow[]) ?? []);
      } catch { /* ignore */ }
    })();
  }, [user, planId]);

  const reloadSessions = async () => {
    try {
      const { data: list } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("plan_id", planId)
        .order("session_date", { ascending: false });
      setSessions((list as unknown as SessionRow[]) ?? []);
    } catch { /* ignore */ }
  };

  // Auto-land on Resultados once a plan has enough logged sessions to feel
  // "filled". Per-plan flag in sessionStorage so back-nav still respects user
  // intent if they manually click View/Edit/Log later.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessions.length < 3) return;
    const flag = `planAutoResults:${planId}`;
    if (window.sessionStorage.getItem(flag)) return;
    window.sessionStorage.setItem(flag, "1");
    setMode("results");
  }, [sessions.length, planId]);

  const save = async (extra: Partial<{ status: string }> = {}) => {
    setSaving(true);
    const { error } = await supabase
      .from("workout_plans")
      .update({ title: plan.title, summary: plan.summary, plan_data: data, ...extra })
      .eq("id", planId);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (extra.status) {
      setPlan({ ...plan, ...extra });
      toast.success(extra.status === "finalized" ? "Plan finalized" : "Plan unlocked — back to draft");
    } else {
      toast.success("Plan saved", {
        description: client ? `View ${client.full_name}'s profile` : undefined,
        action: client
          ? { label: "Open client", onClick: () => { window.location.href = `/clients/${client.id}`; } }
          : undefined,
      });
    }
  };

  const addWeek = () => {
    const n = (data.weeks.at(-1)?.week_number ?? 0) + 1;
    setData({ ...data, weeks: [...data.weeks, { week_number: n, focus: "", days: [] }] });
  };
  const updateWeek = (i: number, w: Week) => {
    const copy = [...data.weeks]; copy[i] = w; setData({ ...data, weeks: copy });
  };
  const removeWeek = (i: number) => setData({ ...data, weeks: data.weeks.filter((_, idx) => idx !== i) });

  const exportPdf = async () => {
    if (!client || !plan) return;
    let logoDataUrl: string | null = null;
    if (profile?.logo_url) {
      try {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(profile.logo_url, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          const blob = await res.blob();
          logoDataUrl = await new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        }
      } catch { /* ignore */ }
    }
    await generatePlanPdf(
      { title: plan.title, summary: plan.summary, client_name: client.full_name, duration_weeks: plan.duration_weeks },
      data,
      {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        tagline: profile?.tagline,
        contact_email: profile?.contact_email,
        contact_phone: profile?.contact_phone,
        logo_data_url: logoDataUrl,
      }
    );
    if (user) { void markOnboardingStep(user.id, "export_pdf"); }
  };

  const exportLogsheet = async () => {
    if (!client || !plan) return;
    let logoDataUrl: string | null = null;
    if (profile?.logo_url) {
      try {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(profile.logo_url, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          const blob = await res.blob();
          logoDataUrl = await new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        }
      } catch { /* ignore */ }
    }
    await generateLogsheetPdf(
      { title: plan.title, summary: plan.summary, client_name: client.full_name, duration_weeks: plan.duration_weeks },
      data,
      {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        tagline: profile?.tagline,
        contact_email: profile?.contact_email,
        contact_phone: profile?.contact_phone,
        logo_data_url: logoDataUrl,
      },
      { week: 1 },
    );
  };

  if (!plan) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {client && (
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ClientAvatar
                name={client.full_name}
                photoUrl={client.photo_url ?? null}
                size={28}
              />
              <span>{client.full_name} →</span>
            </Link>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-md border-0 bg-transparent px-0 !text-xl font-bold tracking-tight focus-visible:ring-0"
              value={plan.title}
              onChange={(e) => setPlan({ ...plan, title: e.target.value })}
            />
            {(() => {
              const block = (plan as any).block_number ?? 1;
              if (block <= 1) return null;
              return (
                <span
                  title={(plan as any).block_transition_summary ?? undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-amber-300"
                >
                  Bloco {block} · evoluiu de Bloco {block - 1}
                </span>
              );
            })()}
            {(() => {
              const s = planStatusInfo(plan, tCommon as any);
              if (s.key === "draft") return null;
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${s.className}`}
                >
                  {s.key === "finalized" && <CheckCircle2 className="h-3 w-3" />}
                  {s.label}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareDialog
            planId={planId}
            initialToken={plan.share_token}
            onChange={(t) => setPlan({ ...plan, share_token: t })}
            clientFirstName={(client?.full_name ?? "there").split(" ")[0]}
            clientPhone={client?.phone ?? null}
            planTitle={plan.title}
          />
          {client?.id && <PlanAssessmentSheet clientId={client.id} />}
          <Button
            size="sm"
            onClick={exportPdf}
            className="h-8 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm hover:from-amber-500 hover:to-amber-700 hover:shadow-md transition-all"
            title="Exportar plano em PDF (paisagem, ≤6 páginas)"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportLogsheet}
            className="h-8"
            title="Folha de registo A4 com colunas em branco para o ginásio"
          >
            <NotebookPen className="mr-1.5 h-3.5 w-3.5" /> Folha de registo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm("Delete this plan? This cannot be undone.")) return;
              const { error } = await supabase.from("workout_plans").delete().eq("id", planId);
              if (error) return toast.error(error.message);
              toast.success("Plan deleted");
              navigate({ to: "/plans" });
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
          <Link to="/settings" className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs hover:border-accent">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-background">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <span className="text-muted-foreground group-hover:text-foreground">Branding</span>
          </Link>
        </div>
      </div>

      {/* Summary — collapsible */}
      <div className="rounded-lg border border-border bg-card/50">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Summary {plan.summary?.trim() ? "" : "(empty)"}
          </span>
          {summaryOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        {summaryOpen && (
          <div className="border-t border-border px-3 pb-3 pt-2 animate-fade-in">
            {client && (
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {client.age != null && <span><b className="text-foreground">{client.age}</b> anos</span>}
                {client.sex && <span className="capitalize">{client.sex}</span>}
                {client.height_cm && <span><b className="text-foreground">{client.height_cm}</b> cm</span>}
                {client.weight_kg && <span><b className="text-foreground">{client.weight_kg}</b> kg</span>}
                {plan.brief?.training_age_band && (
                  <span>Experiência: <b className="text-foreground">{plan.brief.training_age_band}</b></span>
                )}
                {plan.brief?.primary_goal && (
                  <span>Objectivo: <b className="text-foreground">{plan.brief.primary_goal}</b></span>
                )}
                {Array.isArray(plan.brief?.red_flags) && plan.brief.red_flags.length > 0 && (
                  <span className="text-amber-300">⚠ {plan.brief.red_flags.slice(0, 3).join(" · ")}</span>
                )}
              </div>
            )}
            {mode === "edit" ? (
              <AutoTextarea
                minRows={2}
                value={plan.summary ?? ""}
                onChange={(e) => setPlan({ ...plan, summary: e.target.value })}
                placeholder="High-level summary of this program…"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {plan.summary?.trim() ? plan.summary : <span className="text-muted-foreground italic">No summary yet.</span>}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Demo recovery: if this is a demo client with a finalized plan and zero
          logged sessions, offer one-click logbook seeding instead of forcing a
          full demo recreation. */}
      {plan?.generation_status === "complete"
        && /\(demo\)$/i.test(client?.full_name ?? "")
        && sessions.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <div className="flex-1">
            <p className="font-semibold text-foreground">Logbook vazio.</p>
            <p className="mt-0.5 text-muted-foreground">
              Este é um cliente demo mas o logbook não foi populado. Carrega para gerar 2 semanas de sessões realistas.
            </p>
          </div>
          <Button
            size="sm"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                const r: any = await seedFn({ data: { planId, weeksToSeed: 2 } });
                if (r?.ok) {
                  toast.success(`${r.inserted ?? 0} sessões adicionadas.`);
                  await reloadSessions();
                  setMode("results");
                } else {
                  toast.error(r?.error ?? "Falhou ao popular logbook.");
                }
              } finally { setSeeding(false); }
            }}
          >
            {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Preencher logbook agora
          </Button>
        </div>
      )}

      {/* Concluir bloco e iniciar o próximo. O caminho manual está sempre
          disponível para qualquer plano finalizado; a opção IA só aparece
          em planos de demonstração (mantém a IA como atalho honesto). */}
      {plan?.generation_status === "complete"
        && plan?.status !== "archived" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Bloco {(plan as any).block_number ?? 1} pronto para fechar.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Arquive este bloco e desenhe o Bloco {((plan as any).block_number ?? 1) + 1}.
              Pré-preenchemos a nota de transição com adesão e variação de RPE — você assina.
            </p>
          </div>
          <BlockTransitionDialog
            priorPlanId={planId}
            currentBlockNumber={(plan as any).block_number ?? 1}
            allowAi={/\(demo\)$/i.test(client?.full_name ?? "") && sessions.length > 0}
            trigger={
              <Button size="sm">
                <PlayCircle className="mr-2 h-4 w-4" />
                Concluir bloco
              </Button>
            }
          />
        </div>
      )}

      {/* AI Validation Report — always visible to the trainer */}
      <ValidationReport generationMeta={plan.generation_meta} />

      {/* Legacy plan: prompt regeneration */}
      {data.weeks.length > 0 && isLegacyPlan(data) && client && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">This plan uses the old Forge structure.</p>
            <p className="mt-0.5 text-muted-foreground">
              Regenerate from {client?.full_name ?? "client"}'s assessment to get the full session arc — warmup, activation,
              dynamic prep, main work, cooldown and an optional finisher — plus muscle tags, RPE and tempo on every exercise.
            </p>
          </div>
          <Link
            to="/clients/$clientId"
            params={{ clientId: client.id }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-500/20"
          >
            <Sparkles className="h-3 w-3" /> Regenerate
          </Link>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
        <button
          onClick={() => setMode("view")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "view" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        <button
          onClick={() => {
            setMode("edit");
          }}
          title={isPhasedComplete ? "Edit values inline — no re-approval needed" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "edit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={() => setMode("log")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "log" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <NotebookPen className="h-3.5 w-3.5" /> Log
        </button>
        <button
          onClick={() => setMode("results")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${mode === "results" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Resultados
          {sessions.length > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-px text-[9px] font-semibold text-emerald-300">
              {sessions.length}
            </span>
          )}
        </button>
        </div>
        {plan?.status !== "finalized" && client && (
          <RegenerateWithFeedbackDialog
            planId={planId}
            clientId={client.id}
            assessmentId={plan.assessment_id}
            durationWeeks={plan.duration_weeks ?? 4}
            previousPlan={{ title: plan.title, summary: plan.summary, weeks: data.weeks }}
            onRegenerated={(newPlan) => {
              setData({ weeks: newPlan.weeks ?? [] });
              setPlan({ ...plan, title: newPlan.title ?? plan.title, summary: newPlan.summary ?? plan.summary });
            }}
          />
        )}
      </div>

      {mode === "view" ? (
        <ViewMode plan={data} planId={planId} sessions={sessions} reload={reloadSessions} />
      ) : mode === "edit" ? (
        isPhasedComplete ? (
          <>
            <MesocycleTableView plan={data} planId={planId} editable={true} onUpdated={reloadSessions} />
            <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[var(--shadow-elegant)] backdrop-blur">
              <Button onClick={exportPdf}>
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </>
        ) : (
        <>
          <div className="space-y-3">
            {data.weeks.map((w, wi) => (
              <WeekBlock key={wi} week={w} onChange={(nw) => updateWeek(wi, nw)} onRemove={() => removeWeek(wi)} />
            ))}
            <Button variant="outline" onClick={addWeek}>
              <Plus className="mr-2 h-4 w-4" /> Add week
            </Button>
          </div>

          <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[var(--shadow-elegant)] backdrop-blur">
            <Button variant="outline" onClick={() => save()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            {plan.status === "finalized" ? (
              <Button variant="outline" onClick={() => save({ status: "draft" })} disabled={saving}>
                <LockOpen className="mr-2 h-4 w-4" /> Un-finalize
              </Button>
            ) : (
              <Button variant="outline" onClick={() => save({ status: "finalized" })} disabled={saving}>
                <Lock className="mr-2 h-4 w-4" /> Finalize
              </Button>
            )}
            <Button onClick={exportPdf}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </>
        )
      ) : mode === "results" ? (
        <ResultsPanel plan={data} sessions={sessions as any} />
      ) : (
        <LogMode plan={data} planId={planId} sessions={sessions} reload={reloadSessions} onExportPdf={exportPdf} />
      )}
    </div>
  );
}

/* ─────────── Edit-mode blocks (layered: week = darkest, day = medium, ex = lightest) ─────────── */

function WeekBlock({ week, onChange, onRemove }: { week: Week; onChange: (w: Week) => void; onRemove: () => void }) {
  const addDay = () => onChange({ ...week, days: [...week.days, { day_label: `Day ${week.days.length + 1}`, focus: "", exercises: [] }] });
  const updateDay = (i: number, d: Day) => { const c = [...week.days]; c[i] = d; onChange({ ...week, days: c }); };
  const removeDay = (i: number) => onChange({ ...week, days: week.days.filter((_, idx) => idx !== i) });

  return (
      <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-widest text-accent">Week {week.week_number}</span>
        <Input value={week.focus} onChange={(e) => onChange({ ...week, focus: e.target.value })} placeholder="Focus (e.g. Hypertrophy block)" className="h-8 flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-3 -mt-1">
        <Input
          value={week.rationale ?? ""}
          onChange={(e) => onChange({ ...week, rationale: e.target.value })}
          placeholder="Why this block now? (e.g. accumulation phase — sleep 8/10, no deload yet)"
          className="h-7 border-dashed bg-transparent text-xs italic text-muted-foreground placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="space-y-3">
        {week.days.map((d, di) => (
          <DayBlock key={di} day={d} onChange={(nd) => updateDay(di, nd)} onRemove={() => removeDay(di)} />
        ))}
        <Button variant="outline" size="sm" onClick={addDay}>
          <Plus className="mr-2 h-3 w-3" /> Add day
        </Button>
      </div>
    </div>
  );
}

/* ─────────── View mode (compact, read-only render) ─────────── */

function ViewMode({
  plan,
  planId,
  sessions,
  reload,
}: {
  plan: PlanData;
  planId: string;
  sessions: SessionRow[];
  reload: () => Promise<void>;
}) {
  const [layout, setLayout] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "table";
    const saved = window.localStorage.getItem("planLayout");
    return saved === "cards" ? "cards" : "table";
  });
  const setLayoutPersisted = (next: "cards" | "table") => {
    setLayout(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("planLayout", next);
    }
  };
  if (!plan.weeks.length) {
    return <p className="text-sm text-muted-foreground">No weeks yet. Switch to Edit to build the plan.</p>;
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
          <button
            onClick={() => setLayoutPersisted("table")}
            className={`rounded-md px-3 py-1 transition ${layout === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Table
          </button>
          <button
            onClick={() => setLayoutPersisted("cards")}
            className={`rounded-md px-3 py-1 transition ${layout === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Cards
          </button>
        </div>
      </div>
      {layout === "table" ? (
        <MesocycleTableView plan={plan} planId={planId} editable={true} onUpdated={() => void reload()} />
      ) : (
        <div className="space-y-12">
      {plan.weeks.map((w, wi) => (
        <div key={wi} className="space-y-10">
          {/* Week marker — minimal, lets the day headers carry the weight */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
              Week {w.week_number}
            </span>
            {w.focus && (
              <>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{w.focus}</span>
              </>
            )}
          </div>
          {w.rationale && (
            <p className="-mt-6 max-w-2xl border-l-2 border-accent/40 pl-3 text-[11px] italic leading-relaxed text-muted-foreground">
              {w.rationale}
            </p>
          )}
          {w.days.map((d, di) => (
            <SessionDayView
              key={di}
              week={w}
              day={d}
              index={di}
              rightSlot={
                <DayQuickMark
                  planId={planId}
                  weekNumber={w.week_number}
                  dayLabel={d.day_label}
                  sessions={sessions}
                  reload={reload}
                />
              }
            />
          ))}
        </div>
      ))}
        </div>
      )}
    </div>
  );
}

/**
 * Quick plan-vs-actual marker for a day. One click writes a workout_sessions
 * row with status=done|partial|missed and empty entries — the trainer can
 * always open Log mode later to add detail. Re-clicking the same status
 * removes the latest mark for that day.
 */
function DayQuickMark({
  planId,
  weekNumber,
  dayLabel,
  sessions,
  reload,
}: {
  planId: string;
  weekNumber: number;
  dayLabel: string;
  sessions: SessionRow[];
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  // Latest session for this exact day cell
  const latest = sessions
    .filter((s) => s.week_number === weekNumber && s.day_label === dayLabel)
    .sort((a, b) => b.session_date.localeCompare(a.session_date))[0];

  const current = (latest?.status ?? null) as "done" | "partial" | "missed" | null;

  const mark = async (status: "done" | "partial" | "missed") => {
    setBusy(true);
    try {
      // Toggle off if clicking the same status that's already set
      if (current === status && latest) {
        const { error } = await supabase.from("workout_sessions").delete().eq("id", latest.id);
        if (error) throw error;
        toast.success("Mark cleared");
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const { data: u } = await supabase.auth.getUser();
        const trainerId = u.user?.id;
        if (!trainerId) throw new Error("Not authenticated");
        const { error } = await supabase.from("workout_sessions").insert({
          plan_id: planId,
          trainer_id: trainerId,
          week_number: weekNumber,
          day_label: dayLabel,
          session_date: today,
          status,
          entries: [],
          logged_by: "trainer",
        });
        if (error) throw error;
        toast.success(
          status === "done" ? "Marked done" : status === "partial" ? "Marked partial" : "Marked missed",
        );
        void markOnboardingStep(trainerId, "log_session");
      }
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to mark");
    } finally {
      setBusy(false);
    }
  };

  const btn = (
    val: "done" | "partial" | "missed",
    Icon: typeof Check,
    label: string,
    activeClass: string,
  ) => {
    const active = current === val;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => mark(val)}
        title={active ? `${label} — click to clear` : label}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
          active
            ? activeClass
            : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-1">
      {btn("done", Check, "Done", "border-emerald-500/40 bg-emerald-500/15 text-emerald-600")}
      {btn("partial", MinusCircle, "Partial", "border-amber-500/40 bg-amber-500/15 text-amber-600")}
      {btn("missed", XCircle, "Missed", "border-rose-500/40 bg-rose-500/15 text-rose-600")}
    </div>
  );
}

function DayBlock({ day, onChange, onRemove }: { day: Day; onChange: (d: Day) => void; onRemove: () => void }) {
  const addEx = () =>
    onChange({
      ...day,
      exercises: [
        ...day.exercises,
        {
          name: "", sets: "3", reps: "10", rest: "60s", notes: "",
          primary_muscles: [], secondary_muscles: [],
          rpe: "", tempo: "", technique_cues: "", equipment: [],
        },
      ],
    });
  const updateEx = (i: number, e: Exercise) => { const c = [...day.exercises]; c[i] = e; onChange({ ...day, exercises: c }); };
  const removeEx = (i: number) => onChange({ ...day, exercises: day.exercises.filter((_, idx) => idx !== i) });

  const setSection = (key: "warmup" | "activation" | "dynamic_stretches" | "cooldown" | "finisher", items: SectionItem[]) =>
    onChange({ ...day, [key]: items });

  const finisherEnabled = day.finisher_enabled !== false;

  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Input className="h-7 w-24 text-sm" value={day.day_label} onChange={(e) => onChange({ ...day, day_label: e.target.value })} />
        <Input value={day.focus} onChange={(e) => onChange({ ...day, focus: e.target.value })} placeholder="Focus (e.g. Push)" className="h-7 flex-1 text-sm" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mb-2">
        <Input
          value={day.rationale ?? ""}
          onChange={(e) => onChange({ ...day, rationale: e.target.value })}
          placeholder="Why this session shape? (e.g. hinge after 48h CNS recovery; hip hinge 3/5 → RDL not deadlift)"
          className="h-6 border-dashed bg-transparent text-[11px] italic text-muted-foreground placeholder:text-muted-foreground/50"
        />
      </div>

      <SectionEditor title="Warmup" items={day.warmup ?? []} onChange={(it) => setSection("warmup", it)} placeholder="e.g. Rower" />
      <SectionEditor title="Activation" items={day.activation ?? []} onChange={(it) => setSection("activation", it)} placeholder="e.g. Glute bridge" />
      <SectionEditor title="Dynamic stretches" items={day.dynamic_stretches ?? []} onChange={(it) => setSection("dynamic_stretches", it)} placeholder="e.g. Leg swings" />

      <div className="mb-1.5 mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Main work</div>
      <div className="space-y-1.5">
        {day.exercises.map((ex, ei) => (
          <ExerciseRow key={ei} ex={ex} onChange={(e) => updateEx(ei, e)} onRemove={() => removeEx(ei)} />
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addEx}>
          <Plus className="mr-1 h-3 w-3" /> Add exercise
        </Button>
      </div>

      <SectionEditor title="Cooldown" items={day.cooldown ?? []} onChange={(it) => setSection("cooldown", it)} placeholder="e.g. Pigeon stretch" />

      <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-accent">Optional finisher</span>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={finisherEnabled}
              onChange={(e) => onChange({ ...day, finisher_enabled: e.target.checked })}
              className="h-3 w-3 accent-accent"
            />
            Show on plan & PDF
          </label>
        </div>
        <SectionEditor title="" items={day.finisher ?? []} onChange={(it) => setSection("finisher", it)} placeholder="e.g. Vibroplate or agility ladder" hideTitle />
      </div>
    </div>
  );
}

function SectionEditor({
  title, items, onChange, placeholder, hideTitle = false,
}: {
  title: string;
  items: SectionItem[];
  onChange: (items: SectionItem[]) => void;
  placeholder?: string;
  hideTitle?: boolean;
}) {
  const update = (i: number, key: keyof SectionItem, v: string) => {
    const c = [...items]; c[i] = { ...c[i], [key]: v }; onChange(c);
  };
  const add = () => onChange([...items, { name: "", duration: "", notes: "" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mt-2">
      {!hideTitle && (
        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      )}
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              className="h-7 flex-1 text-xs"
              placeholder={placeholder || "Movement / drill"}
              value={it.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <Input
              className="h-7 w-20 text-center text-xs"
              placeholder="time / reps"
              value={it.duration ?? ""}
              onChange={(e) => update(i, "duration", e.target.value)}
            />
            <Input
              className="h-7 flex-1 text-xs"
              placeholder="Cue / note"
              value={it.notes ?? ""}
              onChange={(e) => update(i, "notes", e.target.value)}
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={add}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

function ExerciseRow({ ex, onChange, onRemove }: { ex: Exercise; onChange: (e: Exercise) => void; onRemove: () => void }) {
  const csv = (arr?: string[]) => (arr ?? []).join(", ");
  const fromCsv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="rounded-md border border-border/50 bg-background p-2">
      <div className="flex items-end gap-2">
        <FieldStack label="Exercise name" className="flex-1 min-w-0">
          <Input className="h-8 text-sm" placeholder="e.g. Barbell back squat" value={ex.name} onChange={(e) => onChange({ ...ex, name: e.target.value })} />
        </FieldStack>
        <FieldStack label="Sets" className="w-16 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="3" value={ex.sets} onChange={(e) => onChange({ ...ex, sets: e.target.value })} />
        </FieldStack>
        <FieldStack label="Reps" className="w-20 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="8-10" value={ex.reps} onChange={(e) => onChange({ ...ex, reps: e.target.value })} />
        </FieldStack>
        <FieldStack label="Rest" className="w-20 shrink-0">
          <Input className="h-8 text-center text-sm" placeholder="60s" value={ex.rest} onChange={(e) => onChange({ ...ex, rest: e.target.value })} />
        </FieldStack>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FieldStack label="RPE">
          <Input className="h-7 text-sm" placeholder="7-8" value={ex.rpe ?? ""} onChange={(e) => onChange({ ...ex, rpe: e.target.value })} />
        </FieldStack>
        <FieldStack label="Tempo">
          <Input className="h-7 text-sm" placeholder="3-1-1-0" value={ex.tempo ?? ""} onChange={(e) => onChange({ ...ex, tempo: e.target.value })} />
        </FieldStack>
        <FieldStack label="Primary muscles" className="col-span-2">
          <Input className="h-7 text-sm" placeholder="quadriceps, glutes" value={csv(ex.primary_muscles)} onChange={(e) => onChange({ ...ex, primary_muscles: fromCsv(e.target.value) })} />
        </FieldStack>
        <FieldStack label="Secondary muscles" className="col-span-2">
          <Input className="h-7 text-sm" placeholder="hamstrings, core" value={csv(ex.secondary_muscles)} onChange={(e) => onChange({ ...ex, secondary_muscles: fromCsv(e.target.value) })} />
        </FieldStack>
        <FieldStack label="Equipment" className="col-span-2">
          <Input className="h-7 text-sm" placeholder="barbell, rack" value={csv(ex.equipment)} onChange={(e) => onChange({ ...ex, equipment: fromCsv(e.target.value) })} />
        </FieldStack>
      </div>
      <div className="mt-1.5">
        <FieldStack label="Technique cues">
          <Input
            className="h-7 text-sm italic"
            placeholder="Brace and exhale on press; pause 1s at peak stretch"
            value={ex.technique_cues ?? ""}
            onChange={(e) => onChange({ ...ex, technique_cues: e.target.value })}
          />
        </FieldStack>
      </div>
      <div className="mt-1.5">
        <AutoTextarea
          minRows={1}
          className="text-sm py-1.5"
          placeholder="Notes — programming or substitutions"
          value={ex.notes ?? ""}
          onChange={(e) => onChange({ ...ex, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function FieldStack({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/* ─────────── Share dialog ─────────── */

function ShareDialog({
  planId,
  initialToken,
  onChange,
  clientFirstName,
  clientPhone,
  planTitle,
}: {
  planId: string;
  initialToken: string | null;
  onChange: (t: string | null) => void;
  clientFirstName: string;
  clientPhone: string | null;
  planTitle: string;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const ensureFn = useServerFn(ensureShareToken);
  const revokeFn = useServerFn(revokeShareToken);

  const url = token ? `${window.location.origin}/log/${token}` : null;
  const waMsg = url
    ? encodeURIComponent(
        `Hi ${clientFirstName}, here's your training plan "${planTitle}". Tap to log each session: ${url}`
      )
    : "";
  const waPhone = (clientPhone ?? "").replace(/[^\d]/g, "");
  const waUrl = url
    ? waPhone
      ? `https://wa.me/${waPhone}?text=${waMsg}`
      : `https://wa.me/?text=${waMsg}`
    : "#";

  const enable = async (rotate = false) => {
    setBusy(true);
    try {
      const res = await ensureFn({ data: { plan_id: planId, rotate } });
      setToken(res.share_token);
      onChange(res.share_token);
      toast.success(rotate ? "Link rotated" : "Share link ready");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await revokeFn({ data: { plan_id: planId } });
      setToken(null); onChange(null);
      toast.success("Link revoked");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client log link</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Anyone with this link can log their actual sets/reps/weights for this plan. They cannot view or edit the plan itself.
        </p>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button onClick={copy} variant="outline"><Copy className="h-4 w-4" /></Button>
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                {waPhone ? `Send to ${clientFirstName} on WhatsApp` : "Send via WhatsApp"}
              </a>
            </Button>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => enable(true)} disabled={busy}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rotate
              </Button>
              <Button variant="destructive" size="sm" onClick={revoke} disabled={busy}>Revoke link</Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => enable(false)} disabled={busy}>
              <Share2 className="mr-2 h-4 w-4" /> Generate link
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Log mode ─────────── */

type SetLog = { reps: string; weight: string };
type LogEntry = {
  exercise_name: string;
  planned: { sets: string; reps: string; rest: string; notes: string; rpe?: string; tempo?: string; technique_cues?: string };
  sets: SetLog[];
  notes: string;
};

function parsePlannedSets(s: string): number {
  const n = parseInt((s || "").match(/\d+/)?.[0] ?? "", 10);
  if (Number.isFinite(n) && n > 0 && n < 20) return n;
  return 3;
}

function LogMode({ plan, planId, sessions, reload, onExportPdf }: { plan: PlanData; planId: string; sessions: SessionRow[]; reload: () => void; onExportPdf: () => Promise<void> }) {
  const navigate = useNavigate();
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const firstWeek = plan.weeks[0]?.week_number ?? 1;
  const firstDay = plan.weeks[0]?.days[0]?.day_label ?? "Day 1";
  const [weekNum, setWeekNum] = useState<number>(firstWeek);
  const [dayLabel, setDayLabel] = useState<string>(firstDay);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [rewards, setRewards] = useState<Record<string, number>>({});

  const week = plan.weeks.find((w) => w.week_number === weekNum) ?? plan.weeks[0];
  const day = week?.days.find((d) => d.day_label === dayLabel) ?? week?.days[0];

  useEffect(() => {
    if (!day) { setEntries([]); return; }
    setEntries(
      day.exercises.map((e) => {
        const n = parsePlannedSets(e.sets ?? "");
        return {
          exercise_name: e.name,
          planned: {
            sets: e.sets ?? "", reps: e.reps ?? "", rest: e.rest ?? "", notes: e.notes ?? "",
            rpe: e.rpe ?? "", tempo: e.tempo ?? "", technique_cues: e.technique_cues ?? "",
          },
          sets: Array.from({ length: n }, () => ({ reps: "", weight: "" })),
          notes: "",
        };
      }),
    );
    setNotes("");
  }, [weekNum, dayLabel, plan]);

  const updateSet = (i: number, si: number, k: keyof SetLog, v: string) => {
    const copy = [...entries];
    const sets = [...copy[i].sets];
    const prev = sets[si];
    const wasComplete = !!(prev.reps && prev.weight);
    sets[si] = { ...sets[si], [k]: v };
    const nowComplete = !!(sets[si].reps && sets[si].weight);
    copy[i] = { ...copy[i], sets };
    setEntries(copy);
    if (!wasComplete && nowComplete) {
      const key = `${i}-${si}`;
      setRewards((r) => ({ ...r, [key]: Date.now() }));
      setTimeout(() => setRewards((r) => { const { [key]: _, ...rest } = r; return rest; }), 700);
    }
  };
  const addSet = (i: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: [...copy[i].sets, { reps: "", weight: "" }] };
    setEntries(copy);
  };
  const removeSet = (i: number, si: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: copy[i].sets.filter((_, idx) => idx !== si) };
    setEntries(copy);
  };
  const updateExNotes = (i: number, v: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], notes: v };
    setEntries(copy);
  };

  const submit = async () => {
    if (!day) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: inserted, error } = await supabase.from("workout_sessions").insert({
        plan_id: planId,
        trainer_id: user.id,
        week_number: weekNum,
        day_label: dayLabel,
        session_date: date,
        session_notes: notes,
        entries: entries as any,
        logged_by: "trainer",
      }).select("id").single();
      if (error) throw error;
      const newId = inserted?.id;
      void markOnboardingStep(user.id, "log_session");
      toast.success("Session logged · view history", {
        description: "Click to see all sessions for this plan",
        action: {
          label: "Open",
          onClick: () => {
            navigate({
              to: "/plans/$planId/sessions",
              params: { planId },
              search: { highlight: newId ?? undefined },
            });
          },
        },
      });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  if (!plan.weeks.length) {
    return <p className="text-sm text-muted-foreground">Add weeks and exercises in Edit mode first.</p>;
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6 lg:-mb-8 bg-background px-4 sm:px-6 lg:px-8 pt-3 pb-6 text-foreground">
      {/* Compact single-row picker */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs">
        <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">Log</span>
        <select
          value={weekNum}
          onChange={(e) => setWeekNum(Number(e.target.value))}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {plan.weeks.map((w) => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
        </select>
        <select
          value={dayLabel}
          onChange={(e) => setDayLabel(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {(week?.days ?? []).map((d) => <option key={d.day_label} value={d.day_label}>{d.day_label}{d.focus ? ` · ${d.focus}` : ""}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <Link
          to="/plans/$planId/sessions"
          params={{ planId }}
          search={{ highlight: undefined }}
          className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <History className="h-3 w-3" /> History ({safeSessions.length})
        </Link>
      </div>

      {/* Exercise cards */}
      <div className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-foreground0">No exercises in this day.</p>}
        {entries.map((e, i) => (
          <div key={i} className="rounded-md bg-card p-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground inline-flex items-center gap-1.5">
                {e.exercise_name || <span className="text-foreground0">(unnamed)</span>}
                {e.exercise_name && (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.exercise_name + " exercise technique")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Watch demo on YouTube"
                    className="text-muted-foreground hover:text-accent"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                  </a>
                )}
              </h3>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-accent">
                Planned · {e.planned.sets || "—"} × {e.planned.reps || "—"} · {e.planned.rest || "—"}
                {e.planned.rpe ? ` · RPE ${e.planned.rpe}` : ""}
                {e.planned.tempo ? ` · Tempo ${e.planned.tempo}` : ""}
              </span>
            </div>
            {e.planned.technique_cues && (
              <p className="mb-1 text-[11px] italic text-muted-foreground/80">{e.planned.technique_cues}</p>
            )}
            {e.planned.notes && (
              <p className="mb-1.5 text-[11px] italic text-accent/70">{e.planned.notes}</p>
            )}

            {/* Per-set rows */}
            <div className="mb-1 grid grid-cols-[2.25rem_1fr_1fr_1.5rem] gap-1.5 px-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground">
              <span className="text-foreground0">Set</span>
              <span>Reps</span>
              <span>Weight</span>
              <span />
            </div>
            <div className="space-y-1">
              {e.sets.map((st, si) => (
                <div
                  key={si}
                  className={`grid grid-cols-[2.25rem_1fr_1fr_1.5rem] items-center gap-1.5 rounded transition-all ${
                    rewards[`${i}-${si}`] ? "animate-scale-in bg-accent/15 ring-1 ring-accent/40" : ""
                  }`}
                >
                  <span className="text-center text-xs font-bold text-foreground0">
                    {rewards[`${i}-${si}`] ? <Heart className="mx-auto h-3.5 w-3.5 fill-accent text-accent" /> : si + 1}
                  </span>
                  <input
                    inputMode="numeric"
                    value={st.reps}
                    onChange={(ev) => updateSet(i, si, "reps", ev.target.value)}
                    placeholder={e.planned.reps || "—"}
                    className="h-7 w-full rounded bg-secondary px-2 text-center text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    value={st.weight}
                    onChange={(ev) => updateSet(i, si, "weight", ev.target.value)}
                    placeholder="kg"
                    className="h-7 w-full rounded bg-secondary px-2 text-center text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => removeSet(i, si)}
                    className="text-muted-foreground/50 hover:text-zinc-200"
                    aria-label="Remove set"
                    type="button"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => addSet(i)}
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent"
              >
                <Plus className="h-3 w-3" /> Add set
              </button>
              <input
                value={e.notes}
                onChange={(ev) => updateExNotes(i, ev.target.value)}
                placeholder="Notes…"
                className="h-6 flex-1 rounded bg-transparent px-1 text-xs text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:bg-secondary"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Session notes */}
      <div className="mt-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Session notes — how did it feel?"
          className="h-8 w-full rounded bg-card px-2.5 text-xs text-foreground placeholder:text-foreground0 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Action bar */}
      <div className="sticky bottom-2 mt-3 flex items-center justify-end gap-2 rounded-md bg-card/95 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => void onExportPdf()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-foreground transition hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || entries.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regenerate with feedback — closes the loop between trainer judgement and AI.
// ---------------------------------------------------------------------------
function RegenerateWithFeedbackDialog({
  planId,
  clientId,
  assessmentId,
  durationWeeks,
  previousPlan,
  onRegenerated,
}: {
  planId: string;
  clientId: string;
  assessmentId: string | null;
  durationWeeks: number;
  previousPlan: { title: string; summary: string | null; weeks: Week[] };
  onRegenerated: (plan: { title?: string; summary?: string; weeks?: Week[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const generateFn = useServerFn(generatePlanDraft);

  const submit = async () => {
    if (!feedback.trim()) {
      toast.error("Write what you want changed.");
      return;
    }
    setBusy(true);
    try {
      // Pull client + assessment for context
      const { data: client, error: clientErr } = await supabase
        .from("clients").select("*").eq("id", clientId).single();
      if (clientErr || !client) throw new Error(clientErr?.message ?? "Client not found");

      let assessment: any = null;
      if (assessmentId) {
        const { data: a } = await supabase.from("assessments").select("*").eq("id", assessmentId).single();
        assessment = a;
      } else {
        const { data: a } = await supabase
          .from("assessments").select("*").eq("client_id", clientId)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        assessment = a;
      }
      if (!assessment) throw new Error("No assessment found for this client.");

      const skeleton = {
        title: previousPlan.title ?? null,
        summary: previousPlan.summary ?? null,
        weeks: (previousPlan.weeks ?? []).map((w) => ({
          week_number: w.week_number,
          focus: w.focus ?? null,
          rationale: w.rationale ?? null,
          days: (w.days ?? []).map((d) => ({
            day_label: d.day_label,
            focus: d.focus ?? null,
            rationale: d.rationale ?? null,
          })),
        })),
      };

      const result = await generateFn({
        data: {
          client: {
            full_name: client?.full_name ?? "Client",
            age: client.age,
            sex: client.sex,
            height_cm: client.height_cm ? Number(client.height_cm) : null,
            weight_kg: client.weight_kg ? Number(client.weight_kg) : null,
          },
          assessment: { ...assessment, secondary_goals: null },
          duration_weeks: durationWeeks,
          trainer_feedback: feedback.trim(),
          previous_plan: skeleton,
        },
      });
      if (!result.ok) {
        if ((result as any).billingRequired) {
          toast.error(result.error);
          window.location.href = "/billing";
          return;
        }
        throw new Error(result.error);
      }

      // Persist new plan_data + title/summary
      const newWeeks = result.plan.weeks ?? [];
      const { error: upErr } = await supabase
        .from("workout_plans")
        .update({
          title: result.plan.title || previousPlan.title,
          summary: result.plan.summary || previousPlan.summary,
          plan_data: { weeks: newWeeks },
        })
        .eq("id", planId);
      if (upErr) throw upErr;

      onRegenerated({ title: result.plan.title, summary: result.plan.summary, weeks: newWeeks });
      toast.success("Plan regenerated with your feedback");
      setFeedback("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Regeneration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Regenerate with feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate with feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Tell the AI what to change. Be specific — reference week, day, exercise or rationale. The current plan will be overwritten.
          </p>
          <Label htmlFor="regen-fb" className="text-xs uppercase tracking-widest text-muted-foreground">
            Your corrections
          </Label>
          <AutoTextarea
            id="regen-fb"
            minRows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={`E.g. "Week 2 Day 3: drop back squat — client reports knee discomfort. Replace with goblet squat or split squat. Cap RPE at 7 for all squat patterns."`}
          />
          <p className="text-[11px] text-muted-foreground">
            The previous plan structure and rationales are sent as context so the AI keeps what worked.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !feedback.trim()}>
            {busy ? "Regenerating…" : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
