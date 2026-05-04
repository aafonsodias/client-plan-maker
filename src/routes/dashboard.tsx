import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, FileText, Sparkles, Trash2, BookOpen, Cake, Inbox, Clock, Copy,
  TrendingUp, TrendingDown, Minus, ArrowRight, Loader2,
} from "lucide-react";
import { OnboardingChecklist, markOnboardingStep } from "@/components/OnboardingChecklist";
import { usePlanBlockEvolution } from "@/hooks/use-clients-block-evolution";
import { EvolutionSparkline } from "@/components/EvolutionSparkline";
import { DropoffAlerts } from "@/components/DropoffAlerts";
import { AtlasGenie } from "@/components/AtlasGenie";
import { useClientPhases } from "@/hooks/use-client-phases";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientPlayerCard } from "@/components/ClientPlayerCard";
import type { CardPlan, CardLog } from "@/lib/client-card-data";
import { PhaseKind } from "@/lib/client-phase";
import { IntakeLinkPanel } from "@/components/IntakeLinkPanel";
import { useServerFn } from "@tanstack/react-start";
import { createInviteClient, createManualClient } from "@/server/intake.functions";
import { planStatusInfo } from "@/lib/plan-status";
import { toast } from "sonner";
import { daysUntilBirthday, turningAge } from "@/lib/birthdays";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): { filter?: string } => ({
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

type ClientRow = {
  id: string;
  full_name: string;
  email: string | null;
  date_of_birth: string | null;
  photo_url: string | null;
  intake_status: string;
  intake_token: string | null;
  intake_submitted_at: string | null;
  created_at: string;
};

function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const search = Route.useSearch();
  const filter = search.filter ?? "all";
  const navigate = useNavigate();

  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [recent, setRecent] = useState<Array<{ id: string; title: string; status: string; updated_at: string; client: { full_name: string } | null }>>([]);
  const [statusCounts, setStatusCounts] = useState<{ draft: number; ready: number; finalized: number }>({ draft: 0, ready: 0, finalized: 0 });
  const [planByClient, setPlanByClient] = useState<Record<string, CardPlan | null>>({});
  const [logsByClient, setLogsByClient] = useState<Record<string, CardLog[]>>({});

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mode, setMode] = useState<"invite" | "manual">("invite");
  const [optionalName, setOptionalName] = useState("");
  const [showOptionalName, setShowOptionalName] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdClient, setCreatedClient] = useState<{
    id: string; full_name: string; phone: string | null;
    intake_token: string; intake_token_expires_at: string; intake_status: any;
  } | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const createInviteFn = useServerFn(createInviteClient);
  const createManualFn = useServerFn(createManualClient);

  const load = async () => {
    const [{ data: cRows }, { data: r }, { data: allPlans }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, email, date_of_birth, photo_url, intake_status, intake_token, intake_submitted_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("workout_plans")
        .select("id, title, status, updated_at, generation_state, generation_status, client:clients(full_name)")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase.from("workout_plans").select("status, generation_state, generation_status"),
    ]);
    const rows = (cRows as any[]) ?? [];
    setClientRows(rows);
    setRecent((r as any) ?? []);
    const counts = { draft: 0, ready: 0, finalized: 0 };
    for (const pl of (allPlans ?? []) as any[]) {
      const k = planStatusInfo(pl).key;
      if (k === "finalized") counts.finalized++;
      else if (k === "ready") counts.ready++;
      else counts.draft++;
    }
    setStatusCounts(counts);

    // Per-client latest plan + recent logs (for the player card).
    const ids = rows.map((c) => c.id);
    if (ids.length > 0) {
      const [{ data: plans }, { data: sessions }] = await Promise.all([
        supabase
          .from("workout_plans")
          .select("id, client_id, title, status, duration_weeks, block_number, block_transition_summary, generation_status, created_at, updated_at")
          .in("client_id", ids)
          .order("updated_at", { ascending: false }),
        supabase
          .from("workout_sessions")
          .select("plan_id, session_date, week_number")
          .order("session_date", { ascending: false }),
      ]);
      const planMap: Record<string, CardPlan | null> = {};
      const planClient: Record<string, string> = {};
      for (const p of (plans ?? []) as any[]) {
        if (planMap[p.client_id] === undefined) {
          planMap[p.client_id] = p as CardPlan;
          planClient[p.id] = p.client_id;
        }
      }
      const logMap: Record<string, CardLog[]> = {};
      for (const s of (sessions ?? []) as any[]) {
        const cid = planClient[s.plan_id];
        if (!cid) continue;
        if (!logMap[cid]) logMap[cid] = [];
        if (logMap[cid].length < 10) logMap[cid].push({ session_date: s.session_date, week_number: s.week_number });
      }
      setPlanByClient(planMap);
      setLogsByClient(logMap);
    } else {
      setPlanByClient({});
      setLogsByClient({});
    }
  };

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const clientIds = useMemo(() => clientRows.map((c) => c.id), [clientRows]);
  const phases = useClientPhases(clientIds);

  const counts = useMemo(() => {
    const c = { all: clientRows.length, active: 0, idle: 0, ready: 0, onboarding: 0 };
    clientRows.forEach((cl) => {
      const k = phases[cl.id]?.kind;
      if (k === "active") c.active++;
      else if (k === "idle") c.idle++;
      else if (k === "ready") c.ready++;
      else if (k === "onboarding" || k === "assessment") c.onboarding++;
    });
    return c;
  }, [clientRows, phases]);

  const matchesFilter = (kind?: PhaseKind): boolean => {
    if (filter === "all" || !kind) return filter === "all";
    if (filter === "active") return kind === "active";
    if (filter === "idle") return kind === "idle";
    if (filter === "ready") return kind === "ready";
    if (filter === "onboarding") return kind === "onboarding" || kind === "assessment";
    return true;
  };

  const filteredClients = clientRows.filter((c) => filter === "all" || matchesFilter(phases[c.id]?.kind));

  const removePlan = async (id: string) => {
    const { error } = await supabase.from("workout_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    const removed = recent.find((p) => p.id === id);
    setRecent((r) => r.filter((p) => p.id !== id));
    if (removed) {
      const k = planStatusInfo(removed as any).key;
      setStatusCounts((c) => ({ ...c, [k]: Math.max(0, (c as any)[k] - 1) }));
    }
    toast.success(t("dashboard.plan_deleted"));
  };

  const removeClient = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setClientRows((l) => l.filter((c) => c.id !== id));
    toast.success(t("clients.removed_toast"));
  };

  const recentPlanIds = useMemo(() => recent.map((p) => p.id), [recent]);
  const evolutionByPlan = usePlanBlockEvolution(recentPlanIds);

  const attention = useMemo(() => {
    const items: Array<{ kind: string; key: string; title: string; clientId?: string; sub?: string; urgent?: boolean }> = [];
    for (const c of clientRows) {
      if (c.intake_status === "submitted") {
        items.push({
          kind: "submitted", key: `sub-${c.id}`,
          title: t("dashboard.sub_submitted", { name: c.full_name }),
          sub: t("dashboard.sub_ready_for_review"),
          clientId: c.id, urgent: true,
        });
      }
      const d = daysUntilBirthday(c.date_of_birth);
      if (d !== null && d <= 14) {
        const age = turningAge(c.date_of_birth);
        const bdayKey = d === 0 ? "dashboard.sub_birthday_today" : d === 1 ? "dashboard.sub_birthday_tomorrow" : "dashboard.sub_birthday_in";
        items.push({
          kind: "birthday", key: `bd-${c.id}`,
          title: t(bdayKey, { name: c.full_name, age: age ?? "", n: d }),
          sub: t("dashboard.sub_birthday_hint"),
          clientId: c.id,
        });
      }
      if (c.intake_status === "sent" && c.intake_token) {
        const ageDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
        if (ageDays >= 7) {
          items.push({
            kind: "stale", key: `stale-${c.id}`,
            title: t("dashboard.sub_stale", { name: c.full_name }),
            sub: t("dashboard.sub_stale_hint", { n: ageDays }),
            clientId: c.id,
          });
        }
      }
    }
    return items.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent)).slice(0, 6);
  }, [clientRows, t]);

  const isEmpty = clientRows.length === 0;

  const createInvite = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const row: any = await createInviteFn({ data: { fullName: optionalName.trim() || null } });
      if (!row?.id) throw new Error("Resposta inválida");
      toast.success(t("clients.invite_ready_toast", { defaultValue: "Convite pronto. Envia o link." }));
      void markOnboardingStep(user.id, "add_client");
      setCreatedClient({
        id: row.id, full_name: row.full_name, phone: row.phone ?? null,
        intake_token: row.intake_token,
        intake_token_expires_at: row.intake_token_expires_at,
        intake_status: row.intake_status,
      });
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o convite.");
    } finally {
      setCreating(false);
    }
  };

  const closeAndReset = () => {
    setInviteOpen(false);
    setTimeout(() => {
      setOptionalName("");
      setShowOptionalName(false);
      setCreatedClient(null);
      setManualName("");
      setManualEmail("");
      setMode("invite");
    }, 200);
  };

  const createManual = async () => {
    if (!user || creating) return;
    if (!manualName.trim()) return;
    setCreating(true);
    try {
      const row: any = await createManualFn({ data: { fullName: manualName.trim(), email: manualEmail.trim() || null } });
      if (!row?.id) throw new Error("Resposta inválida");
      toast.success(t("dashboard.manual_added_toast", { defaultValue: "Cliente adicionado." }));
      void markOnboardingStep(user.id, "add_client");
      void load();
      closeAndReset();
      navigate({ to: "/clients/$clientId", params: { clientId: row.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o cliente.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-10">
      <OnboardingChecklist />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("dashboard.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">
            <span className="break-words">{t("dashboard.title")}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:flex-row-reverse">
          {/* AtlasGenie pill removed — icon version lives in AppShell header. */}
          <Dialog open={inviteOpen} onOpenChange={(o) => (o ? setInviteOpen(true) : closeAndReset())}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> {t("dashboard.new_client")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            {!createdClient ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t("clients.invite_dialog_title")}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-1 rounded-full border border-border bg-secondary/40 p-1 text-xs">
                  {(["invite", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-full px-3 py-1.5 transition ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {m === "invite" ? t("dashboard.mode_invite", { defaultValue: "Enviar link de avaliação" }) : t("dashboard.mode_manual", { defaultValue: "Adicionar manualmente" })}
                    </button>
                  ))}
                </div>
                {mode === "invite" ? (
                <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("clients.invite_intro")}</p>
                  {!showOptionalName ? (
                    <button
                      type="button"
                      onClick={() => setShowOptionalName(true)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {t("clients.know_name")}
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>{t("clients.optional_name_label")}</Label>
                      <Input value={optionalName} onChange={(e) => setOptionalName(e.target.value)} />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" onClick={() => void createInvite()} disabled={creating}>
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t("clients.generate_invite")}
                    </Button>
                  </DialogFooter>
                </div>
                ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("dashboard.manual_intro", { defaultValue: "Cria a ficha agora; envias o questionário quando quiseres." })}</p>
                  <div className="space-y-1.5">
                    <Label>{t("dashboard.manual_name", { defaultValue: "Nome completo" })}</Label>
                    <Input value={manualName} onChange={(e) => setManualName(e.target.value)} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("dashboard.manual_email", { defaultValue: "Email (opcional)" })}</Label>
                    <Input type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={() => void createManual()} disabled={creating || !manualName.trim()}>
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t("dashboard.manual_create", { defaultValue: "Criar cliente" })}
                    </Button>
                  </DialogFooter>
                </div>
                )}
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{t("clients.send_link_title")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">{t("clients.send_link_intro")}</p>
                <IntakeLinkPanel
                  clientId={createdClient.id}
                  clientFirstName={(createdClient.full_name || "").split(" ")[0] || "olá"}
                  clientPhone={createdClient.phone}
                  intake={{
                    intake_token: createdClient.intake_token,
                    intake_token_expires_at: createdClient.intake_token_expires_at,
                    intake_status: createdClient.intake_status,
                    intake_submitted_at: null,
                  }}
                  onChange={() => {}}
                />
                <DialogFooter className="mt-2">
                  <Button variant="outline" asChild>
                    <Link to="/clients/$clientId" params={{ clientId: createdClient.id }}>{t("clients.open_client")}</Link>
                  </Button>
                  <Button onClick={closeAndReset}>{t("clients.done")}</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Quick "copy last intake link" button removed — it copied a per-client link
          and read as a public join link, which it wasn't. Intake links are
          generated per client from "+ New client" → "Enviar link de avaliação". */}

      {attention.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{t("dashboard.attention")}</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {attention.map((it) => {
              const Icon = it.kind === "submitted" ? Inbox : it.kind === "birthday" ? Cake : Clock;
              return (
                <Link
                  key={it.key}
                  to="/clients/$clientId"
                  params={{ clientId: it.clientId! }}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-secondary/50"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${it.urgent ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    {it.sub && <p className="truncate text-xs text-muted-foreground">{it.sub}</p>}
                  </div>
                  {it.urgent && <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">{t("dashboard.review")}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <DropoffAlerts />

      {/* Clients section — single source of truth */}
      <section>
        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-medium">{t("dashboard.empty_clients_title", { defaultValue: "Adiciona o teu primeiro cliente" })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.empty_clients_hint", { defaultValue: "Envia o link de avaliação. Eles preenchem no telemóvel." })}</p>
            <Button className="mt-4" onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("dashboard.new_client")}
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1 text-[11px] uppercase tracking-widest">
              {[
                { id: "all", label: t("clients.filter_all", { count: counts.all }) },
                { id: "onboarding", label: t("clients.filter_onboarding", { count: counts.onboarding }) },
                { id: "active", label: t("clients.filter_active", { count: counts.active }) },
                { id: "idle", label: t("clients.filter_idle", { count: counts.idle }) },
                { id: "ready", label: t("clients.filter_ready", { count: counts.ready }) },
              ].map((f) => (
                <Link
                  key={f.id}
                  to="/dashboard"
                  search={{ filter: f.id }}
                  className={`rounded-full px-3 py-1 transition ${filter === f.id ? "bg-accent text-accent-foreground shadow-sm" : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                >
                  {f.label}
                </Link>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {filteredClients.map((c) => (
                <div key={c.id} className="group flex items-center border-b border-border last:border-b-0 hover:bg-secondary/50">
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId: c.id }}
                    className="flex flex-1 items-center gap-3 px-4 py-4 sm:justify-between sm:px-5"
                  >
                    <ClientAvatar name={c.full_name} photoUrl={c.photo_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold sm:truncate sm:text-base">{c.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">{c.email ?? t("clients.no_email")}</p>
                      {phases[c.id] && (
                        <span className="mt-1 inline-flex sm:hidden">
                          <ClientPhasePill phase={phases[c.id]} />
                        </span>
                      )}
                    </div>
                    {phases[c.id] && (
                      <span className="hidden shrink-0 sm:inline-flex">
                        <ClientPhasePill phase={phases[c.id]} />
                      </span>
                    )}
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:inline-block" />
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                        aria-label={t("clients.delete_aria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("clients.delete_title", { name: c.full_name })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("clients.delete_desc")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("clients.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeClient(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t("clients.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Plans live inside each client profile — the dashboard stays focused on
          clients, alerts, and onboarding. (R38) */}
    </div>
  );
}

function PlansStatusBar({ counts }: { counts: { draft: number; ready: number; finalized: number } }) {
  const { t } = useTranslation("common");
  const total = counts.draft + counts.ready + counts.finalized;
  if (total === 0) return null;
  const segs = [
    { key: "finalized", label: t("dashboard.plan_status_finalized"), n: counts.finalized, cls: "bg-emerald-500" },
    { key: "ready", label: t("dashboard.plan_status_ready"), n: counts.ready, cls: "bg-emerald-400/60" },
    { key: "draft", label: t("dashboard.plan_status_draft"), n: counts.draft, cls: "bg-muted-foreground/40" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{t("dashboard.plans_by_status")}</span>
        <span>{t("dashboard.plans_total", { n: total })}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
        {segs.map((s) => s.n > 0 && (
          <div key={s.key} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} />
            {s.label} <span className="text-foreground">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EvolutionChip({ evo }: { evo?: { hasPrior: boolean; deltaPct: number | null; verdict: "gain" | "flat" | "regression" | "unknown" } }) {
  const { t } = useTranslation("common");
  if (!evo || !evo.hasPrior) return null;
  const v = evo.verdict;
  const Icon = v === "gain" ? TrendingUp : v === "regression" ? TrendingDown : Minus;
  const cls = v === "gain"
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : v === "regression"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : v === "flat"
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-muted/30 text-muted-foreground border-border";
  const label = evo.deltaPct == null ? "—" : `${evo.deltaPct > 0 ? "+" : ""}${evo.deltaPct}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}
      title={t("dashboard.evo_title", { label })}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
