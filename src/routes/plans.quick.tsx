import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startQuickPlan } from "@/server/quick-plan.functions";
import { useDemoRuns } from "@/contexts/DemoRunsContext";
import { PaywallDialog } from "@/components/PaywallDialog";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * R70 — Onboarding rápido. 5 campos → plano completo em ~60–90s.
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
  { id: "barbell", label: "Barra + halteres (ginásio)" },
  { id: "dumbbells", label: "Halteres em casa" },
  { id: "machines", label: "Máquinas" },
  { id: "bodyweight", label: "Peso do corpo" },
  { id: "bands", label: "Elásticos" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "home", label: "Treino em casa" },
];

function QuickPlanPage() {
  const navigate = useNavigate();
  const startFn = useServerFn(startQuickPlan);
  const { registerRun } = useDemoRuns();

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [goal, setGoal] = useState<"hypertrophy" | "strength" | "recomp" | "general_health" | "performance">(
    "hypertrophy",
  );
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [days, setDays] = useState<2 | 3 | 4 | 5>(3);
  const [equipment, setEquipment] = useState<string[]>(["barbell", "dumbbells"]);
  const [busy, setBusy] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const toggleEquip = (id: string) =>
    setEquipment((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const ageNum = Number(age);
  const valid =
    fullName.trim().length > 0 &&
    Number.isFinite(ageNum) &&
    ageNum >= 14 &&
    ageNum <= 90 &&
    equipment.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const missing: string[] = [];
    if (!fullName.trim()) missing.push("nome");
    if (!Number.isFinite(ageNum) || ageNum < 14 || ageNum > 90) missing.push("idade (14–90)");
    if (equipment.length === 0) missing.push("equipamento");
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.join(", ")}.`);
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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" /> Plano rápido
        </p>
        <h1 className="mt-2 text-2xl font-light tracking-tight">5 campos → plano em 60–90s</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para experimentar o motor sem fazer o intake completo. Cliente fica criado e podes
          completar a avaliação clínica depois para o próximo bloco.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-5">
        {/* 1. Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="qp-name">Nome do cliente</Label>
          <Input
            id="qp-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Maria Silva"
            maxLength={80}
            required
          />
        </div>

        {/* 2. Idade + sexo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qp-age">Idade</Label>
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
          <div className="space-y-1.5">
            <Label>Sexo biológico</Label>
            <div className="flex gap-1.5">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                    sex === s
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "male" ? "M" : "F"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Objetivo */}
        <div className="space-y-1.5">
          <Label>Objetivo principal</Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(
              [
                ["hypertrophy", "Hipertrofia"],
                ["strength", "Força"],
                ["recomp", "Recomposição"],
                ["general_health", "Saúde geral"],
                ["performance", "Performance"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGoal(id)}
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                  goal === id
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Experiência */}
        <div className="space-y-1.5">
          <Label>Experiência de treino</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["beginner", "Iniciante", "<1 ano"],
                ["intermediate", "Intermédio", "1–3 anos"],
                ["advanced", "Avançado", "3+ anos"],
              ] as const
            ).map(([id, label, sub]) => (
              <button
                key={id}
                type="button"
                onClick={() => setExperience(id)}
                className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                  experience === id
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <div>{label}</div>
                <div className="text-[10px] text-muted-foreground">{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Dias + equipamento */}
        <div className="space-y-1.5">
          <Label>Dias por semana</Label>
          <div className="flex gap-1.5">
            {([2, 3, 4, 5] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold transition ${
                  days === d
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}×
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Equipamento disponível</Label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((opt) => {
              const active = equipment.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleEquip(opt.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {equipment.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Escolhe pelo menos uma opção.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button asChild type="button" variant="ghost" size="sm">
            <Link to="/dashboard">Cancelar</Link>
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar plano agora
          </Button>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Honestidade: este plano usa defaults razoáveis para o que não perguntámos (peso/altura
          médios, sem lesões, RPE máx 8.5). Para o bloco 2, completa a avaliação completa do
          cliente — o motor adapta-se a partir daí.
        </p>
      </form>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason="quota" />
    </div>
  );
}