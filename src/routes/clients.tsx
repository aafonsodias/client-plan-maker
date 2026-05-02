import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowRight, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createDemoClient } from "@/server/demo-client.functions";
import { createInviteClient } from "@/server/intake.functions";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { useClientPhases } from "@/hooks/use-client-phases";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PhaseKind } from "@/lib/client-phase";
import { IntakeLinkPanel } from "@/components/IntakeLinkPanel";
const DemoLabPanel = lazy(() =>
  import("@/components/DemoLabPanel").then((m) => ({ default: m.DemoLabPanel }))
);
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/clients")({
  validateSearch: (s: Record<string, unknown>): { filter?: string } => ({
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
  component: () => (
    <AppShell back={{ to: "/dashboard" }}>
      <Clients />
    </AppShell>
  ),
});

type Client = { id: string; full_name: string; email: string | null; age: number | null; created_at: string; photo_url: string | null };

function Clients() {
  const { user } = useAuth();
  const { t } = useTranslation("common");
  const search = Route.useSearch();
  const filter = search.filter ?? "all";
  const [list, setList] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [optionalName, setOptionalName] = useState("");
  const [showOptionalName, setShowOptionalName] = useState(false);
  const [createdClient, setCreatedClient] = useState<{
    id: string; full_name: string; phone: string | null;
    intake_token: string; intake_token_expires_at: string; intake_status: any;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const phases = useClientPhases(useMemo(() => list.map((c) => c.id), [list]));

  const matchesFilter = (kind?: PhaseKind): boolean => {
    if (filter === "all" || !kind) return filter === "all";
    if (filter === "active") return kind === "active";
    if (filter === "idle") return kind === "idle";
    if (filter === "ready") return kind === "ready";
    if (filter === "onboarding") return kind === "onboarding" || kind === "assessment";
    return true;
  };

  const filtered = list.filter((c) => filter === "all" || matchesFilter(phases[c.id]?.kind));

  const counts = useMemo(() => {
    const c = { all: list.length, active: 0, idle: 0, ready: 0, onboarding: 0 };
    list.forEach((cl) => {
      const k = phases[cl.id]?.kind;
      if (k === "active") c.active++;
      else if (k === "idle") c.idle++;
      else if (k === "ready") c.ready++;
      else if (k === "onboarding" || k === "assessment") c.onboarding++;
    });
    return c;
  }, [list, phases]);

  const load = async () => {
    const { data } = await supabase.from("clients").select("id, full_name, email, age, created_at, photo_url").order("created_at", { ascending: false });
    setList((data as Client[]) ?? []);
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const navigate = useNavigate();
  const createDemoFn = useServerFn(createDemoClient);
  const createInviteFn = useServerFn(createInviteClient);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const createDemo = async () => {
    if (!user || creatingDemo) return;
    setCreatingDemo(true);
    try {
      const res: any = await createDemoFn();
      if (!res?.clientId) throw new Error("Resposta inválida do servidor");
      toast.success(t("clients.demo_added_toast", { defaultValue: "Cliente de demonstração criado" }));
      void markOnboardingStep(user.id, "add_client");
      void navigate({ to: "/clients/$clientId", params: { clientId: res.clientId }, search: { demo: "play" } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar o cliente de demo");
    } finally {
      setCreatingDemo(false);
    }
  };

  const createInvite = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const row: any = await createInviteFn({ data: { fullName: optionalName.trim() || null } });
      if (!row?.id) throw new Error("Resposta inválida");
      toast.success(t("clients.invite_ready_toast", { defaultValue: "Convite pronto. Envia o link." }));
      void markOnboardingStep(user.id, "add_client");
      setCreatedClient({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone ?? null,
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
    setOpen(false);
    setTimeout(() => {
      setOptionalName("");
      setShowOptionalName(false);
      setCreatedClient(null);
    }, 200);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((c) => c.id !== id));
    toast.success(t("clients.removed_toast"));
  };

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <DemoLabPanel />
      </Suspense>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("clients.eyebrow")}</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight">{t("clients.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void createDemo()}
            disabled={creatingDemo}
            title="Cria um cliente fictício com avaliação completa para testar o fluxo de planeamento"
          >
            {creatingDemo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("clients.add_demo_client", { defaultValue: "+ Cliente demo" })}
          </Button>
          <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAndReset())}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> {t("clients.invite_client", { defaultValue: "Convidar cliente" })}
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            {!createdClient ? (
              <>
                <DialogHeader>
                  <DialogTitle>Convidar cliente</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Não preciso de nada agora. Geras o link, envias ao cliente, e ele preenche tudo (nome, contactos, objetivos, lesões…) pelo telemóvel. Tu só revês no fim.
                </p>
                <div className="space-y-3">
                  {!showOptionalName ? (
                    <button
                      type="button"
                      onClick={() => setShowOptionalName(true)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Já sabes o nome dele? (opcional)
                    </button>
                  ) : (
                    <Field label="Nome (opcional — só para te ajudar a identificar antes de ele submeter)" value={optionalName} onChange={setOptionalName} />
                  )}
                  <DialogFooter>
                    <Button type="button" onClick={() => void createInvite()} disabled={creating}>
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Gerar link de convite
                    </Button>
                  </DialogFooter>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Envia este link ao cliente</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  No telemóvel o cliente preenche nome, contactos e a avaliação. Quando ele submeter, aparece aqui na lista para tu revisares.
                </p>
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
                    <Link to="/clients/$clientId" params={{ clientId: createdClient.id }}>Abrir cliente</Link>
                  </Button>
                  <Button onClick={closeAndReset}>Concluído</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          {t("clients.no_clients_empty")}
        </div>
      ) : (
        <>
        <div className="flex flex-wrap gap-1 text-[11px] uppercase tracking-widest">
          {[
            { id: "all", label: t("clients.filter_all", { count: counts.all }) },
            { id: "onboarding", label: t("clients.filter_onboarding", { count: counts.onboarding }) },
            { id: "active", label: t("clients.filter_active", { count: counts.active }) },
            { id: "idle", label: t("clients.filter_idle", { count: counts.idle }) },
            { id: "ready", label: t("clients.filter_ready", { count: counts.ready }) },
          ].map((f) => (
            <Link
              key={f.id}
              to="/clients"
              search={{ filter: f.id }}
              className={`rounded-full px-3 py-1 transition ${filter === f.id ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((c) => (
            <div key={c.id} className="group flex items-center border-b border-border last:border-b-0 hover:bg-secondary/50">
              <Link
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex flex-1 items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <ClientAvatar name={c.full_name} photoUrl={c.photo_url} size={36} />
                  <div>
                    <p className="font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted-foreground">{c.email ?? t("clients.no_email")}</p>
                  </div>
                  {phases[c.id] && <ClientPhasePill phase={phases[c.id]} />}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="mr-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label={t("clients.delete_aria")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("clients.delete_title", { name: c.full_name })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("clients.delete_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("clients.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void remove(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required = false,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}