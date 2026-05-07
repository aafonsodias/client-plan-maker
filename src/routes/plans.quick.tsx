import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startQuickPlan } from "@/server/quick-plan.functions";
import { useDemoRuns } from "@/contexts/DemoRunsContext";
import { PaywallDialog } from "@/components/PaywallDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Sparkles,
  Check,
  Info,
  Dumbbell,
  Weight,
  Scale,
  HeartPulse,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

/**
 * R70 — Onboarding rápido. 5 grupos → plano completo em ~60–90s.
 * Reusa o pipeline phased; progresso vive no DemoRunsIndicator global.
 */
export const Route = createFileRoute("/plans/quick")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <QuickPlanPage />
    </AppShell>
  ),
});

const EQUIPMENT_OPTIONS: { id: string; label: string }[] = [
  { id: "barbell", label: "Barra + anilhas" },
  { id: "dumbbells", label: "Halteres" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "machines", label: "Máquinas" },
  { id: "bands", label: "Elásticos" },
  { id: "bodyweight", label: "Peso do corpo" },
];

const GOAL_OPTIONS = [
  { id: "hypertrophy", label: "Hipertrofia", icon: Dumbbell },
  { id: "strength", label: "Força", icon: Weight },
  { id: "recomp", label: "Recomposição", icon: Scale },
  { id: "general_health", label: "Saúde geral", icon: HeartPulse },
  { id: "performance", label: "Performance", icon: Trophy },
] as const;

const RPE_CAP_BY_EXP = {
  beginner: 7.5,
  intermediate: 8.5,
  advanced: 9,
} as const;

function QuickPlanPage() {
  const navigate = useNavigate();
  const startFn = useServerFn(startQuickPlan);
  const { registerRun } = useDemoRuns();

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [goal, setGoal] = useState<typeof GOAL_OPTIONS[number]["id"]>("hypertrophy");
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [days, setDays] = useState<2 | 3 | 4 | 5>(3);
  const [equipment, setEquipment] = useState<string[]>(["barbell", "dumbbells"]);
  const [busy, setBusy] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const toggleEquip = (id: string) =>
    setEquipment((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const ageNum = Number(age);
  const ageOk = Number.isFinite(ageNum) && ageNum >= 14 && ageNum <= 90;
  const nameOk = fullName.trim().length > 0;
  const equipOk = equipment.length > 0;

  const dirty = nameOk || age !== "" || equipment.length !== 2;
  const rpeCap = RPE_CAP_BY_EXP[experience];

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!nameOk) m.push("nome");
    if (!ageOk) m.push("idade");
    if (!equipOk) m.push("equipamento");
    return m;
  }, [nameOk, ageOk, equipOk]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (missing.length > 0) {
      toast.error(`Falta: ${missing.join(", ")}.`);
      return;
    }
    setBusy(true);
    try {
      const res: any = await startFn({
        data: {
          fullName: fullName.trim(),
          age: ageNum,
          sex,
          primaryGoal: goal,
          experience,
          daysPerWeek: days,
          equipment,
        },
      });
      if (!res?.ok) {
        if (res?.error === "quota_exceeded") {
          setPaywallOpen(true);
        } else {
          toast.error(res?.error ?? "Falhou iniciar plano rápido.");
        }
        setBusy(false);
        return;
      }
      registerRun({
        runId: res.runId,
        kind: "demo_lab",
        title: `${fullName.trim()} — plano rápido`,
        durationWeeks: 4,
      });
      toast.success("Plano a gerar — vais ver o progresso na pílula no topo.", {
        description: "Podes navegar livremente. Avisamos quando estiver pronto.",
      });
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado.");
      setBusy(false);
    }
  }

  function handleCancel() {
    if (dirty) setConfirmCancel(true);
    else navigate({ to: "/dashboard" });
  }

  // Tailwind utility classes for the unified select state
  const selBtn = (active: boolean) =>
    `rounded-md border px-2 py-1.5 text-xs font-medium transition ${
      active
        ? "border-amber-500/70 bg-amber-500/20 text-foreground shadow-sm"
        : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" /> Plano rápido
        </p>
        <h1 className="mt-2 text-2xl font-light tracking-tight">5 campos → plano em 60–90s</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para experimentar o motor sem fazer o intake completo. Cliente fica criado e pode
          completar a avaliação clínica depois para o próximo bloco.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-5">
        {/* 1. Cliente (nome · idade · sexo) */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Cliente</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_140px]">
            <div className="space-y-1">
              <Label htmlFor="qp-name" className="text-[11px] text-muted-foreground">Nome</Label>
              <Input
                id="qp-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Maria Silva"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qp-age" className="text-[11px] text-muted-foreground">Idade</Label>
              <Input
                id="qp-age"
                type="number"
                min={14}
                max={90}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="35"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                Sexo biológico
                <span
                  className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full text-muted-foreground/60"
                  title="Usado para calibrar cargas e zonas (ACSM). Editável depois."
                >
                  <Info className="h-3 w-3" />
                </span>
              </Label>
              <div className="flex gap-1.5">
                {(["male", "female"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`flex-1 ${selBtn(sex === s)}`}
                  >
                    {s === "male" ? "M" : "F"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Objectivo — cards com ícones (mais peso visual) */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Objectivo principal</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {GOAL_OPTIONS.map(({ id, label, icon: Icon }) => {
              const active = goal === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGoal(id)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition ${
                    active
                      ? "border-amber-500/70 bg-amber-500/20 text-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-amber-600 dark:text-amber-400" : ""}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Experiência + chip de RPE cap */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Experiência de treino</Label>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Tecto de esforço: RPE {rpeCap}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["beginner", "Iniciante", "<1 ano"],
                ["intermediate", "Intermédio", "1–3 anos"],
                ["advanced", "Avançado", "3+ anos"],
              ] as const
            ).map(([id, label, sub]) => {
              const active = experience === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setExperience(id)}
                  className={`flex flex-col gap-1 rounded-md border px-2 py-2 text-xs font-medium transition ${
                    active
                      ? "border-amber-500/70 bg-amber-500/20 text-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] ${active ? "text-foreground/70" : "text-muted-foreground/80"}`}>{sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Frequência */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Dias por semana</Label>
          <div className="flex gap-1.5">
            {([2, 3, 4, 5] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold transition ${
                  days === d
                    ? "border-amber-500/70 bg-amber-500/20 text-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}×
              </button>
            ))}
          </div>
        </div>

        {/* 5. Equipamento (multi) */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Equipamento disponível</Label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((opt) => {
              const active = equipment.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleEquip(opt.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-amber-500/70 bg-amber-500/20 text-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && <Check className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
          {equipment.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Escolha pelo menos uma opção.</p>
          )}
        </div>

        <div className="flex flex-col-reverse items-stretch gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {missing.length === 0
              ? "5 de 5 grupos preenchidos"
              : `Falta: ${missing.join(", ")}`}
          </span>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar em 60s
            </Button>
          </div>
        </div>

        <p className="rounded-md border border-border/60 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Plano Rápido = motor com defaults conservadores. <span className="font-medium text-foreground">Não substitui intake clínico.</span>{" "}
          Para usar com cliente real, complete o PAR-Q antes de prescrever —{" "}
          <Link to="/dashboard" className="text-amber-600 underline-offset-2 hover:underline dark:text-amber-400">
            abrir intake completo →
          </Link>
        </p>
      </form>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason="quota" />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este plano rápido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem campos preenchidos. Sair agora descarta o que escreveu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar a editar</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/dashboard" })}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
