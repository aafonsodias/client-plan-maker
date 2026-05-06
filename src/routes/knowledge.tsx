import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { BookOpen, Loader2, Save, Pencil } from "lucide-react";
import {
  getActiveKnowledgeProfile,
  updateKnowledgeRules,
} from "@/server/knowledge/profiles.functions";
import {
  KnowledgeRulesV1,
  SYSTEM_DEFAULT_RULES,
  type KnowledgeRules,
} from "@/server/knowledge/schema";
import {
  MUSCLE_GROUP_ORDER,
  MUSCLE_GROUP_LABELS_PT,
  VOLUME_LANDMARKS,
  type MuscleGroup,
} from "@/lib/volume-landmarks";

export const Route = createFileRoute("/knowledge")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: KnowledgePage,
});

function KnowledgePage() {
  const fetchActive = useServerFn(getActiveKnowledgeProfile);
  const saveRules = useServerFn(updateKnowledgeRules);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [rules, setRules] = useState<KnowledgeRules>(SYSTEM_DEFAULT_RULES);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchActive();
      if (cancelled) return;
      if ((res as any).ok) {
        const p = (res as any).profile;
        setProfileId(p.id);
        setVersion(p.version);
        const parsed = KnowledgeRulesV1.safeParse(p.rules);
        setRules(parsed.success ? parsed.data : SYSTEM_DEFAULT_RULES);
      } else {
        toast.error("Não foi possível carregar o perfil de conhecimento.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchActive]);

  async function handleSave() {
    if (!profileId) return;
    const parsed = KnowledgeRulesV1.safeParse(rules);
    if (!parsed.success) {
      toast.error("Regras inválidas — verifique os intervalos.");
      return;
    }
    setSaving(true);
    const res = await saveRules({ data: { id: profileId, rules: parsed.data } });
    setSaving(false);
    if ((res as any).ok) {
      setVersion((res as any).profile.version);
      toast.success(`Guardado · versão ${(res as any).profile.version}`);
    } else {
      toast.error((res as any).error ?? "Falhou a gravação.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar conhecimento…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell back={{ to: "/dashboard", label: "Dashboard" }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            Conhecimento
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Defina como o motor de geração de planos toma decisões. Tudo que aqui altera
            é versionado — cada plano gerado guarda a versão exacta usada, para
            reprodutibilidade total.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Versão {version}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RuleSummary
          title="Volume — séries por semana"
          summary={summarizeVolume(rules)}
          editor={<VolumeCard rules={rules} setRules={setRules} />}
        />
        <RuleSummary
          title="Intensidade"
          summary={summarizeIntensity(rules)}
          editor={<IntensityCard rules={rules} setRules={setRules} />}
        />
        <RuleSummary
          title="Recuperação · Deload"
          summary={summarizeRecovery(rules)}
          editor={<RecoveryCard rules={rules} setRules={setRules} />}
        />
        <RuleSummary
          title="Progressão"
          summary={summarizeProgression(rules)}
          editor={<ProgressionCard rules={rules} setRules={setRules} />}
        />
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar alterações
        </Button>
      </div>
    </AppShell>
  );
}

type CardProps = {
  rules: KnowledgeRules;
  setRules: (r: KnowledgeRules) => void;
};

function RuleSummary({
  title,
  summary,
  editor,
}: {
  title: string;
  summary: string;
  editor: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-sm text-foreground">{summary}</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                Versionado. Cada plano gerado guarda a versão usada.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">{editor}</div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}

const TRADEOFF_PT: Record<string, string> = {
  high_int_low_vol: "intensidade alta",
  moderate_moderate: "equilibrado",
  moderate_int_high_vol: "volume alto",
  low_int_very_high_vol: "volume muito alto",
};
const DELOAD_FREQ_PT: Record<string, string> = {
  every_3_weeks: "a cada 3 semanas",
  every_4_weeks: "a cada 4 semanas",
  every_5_weeks: "a cada 5 semanas",
  every_6_weeks: "a cada 6 semanas",
  no_deload: "sem deload",
};
const DELOAD_STYLE_PT: Record<string, string> = {
  volume_reduction: "redução de volume",
  intensity_reduction: "redução de intensidade",
  full_rest_week: "descanso total",
  mixed: "misto",
};
const WAVE_PT: Record<string, string> = {
  linear: "linear",
  undulating: "ondulatório",
  block: "em blocos",
  conjugate: "conjugado",
};
const AUTOREG_PT: Record<string, string> = {
  strict: "restrita",
  suggested: "sugerida",
  off: "desligada",
};

function summarizeVolume(r: KnowledgeRules): string {
  const overrides = Object.keys(r.volume.landmarks ?? {}).length;
  if (!overrides) return "Landmarks balanceados (defaults do sistema)";
  return `${overrides} grupo(s) com landmarks personalizados`;
}
function summarizeIntensity(r: KnowledgeRules): string {
  const adv = r.intensity.rpe_ceiling_by_tier.advanced.toFixed(1);
  const tradeoff = TRADEOFF_PT[r.intensity.intensity_volume_tradeoff_default] ?? "—";
  return `Teto RPE avançado ${adv} · ${tradeoff}`;
}
function summarizeRecovery(r: KnowledgeRules): string {
  const f = DELOAD_FREQ_PT[r.recovery.deload_frequency] ?? r.recovery.deload_frequency;
  const s = DELOAD_STYLE_PT[r.recovery.deload_style] ?? r.recovery.deload_style;
  return r.recovery.deload_frequency === "no_deload"
    ? "Sem deload programado"
    : `Deload ${f} · ${s}`;
}
function summarizeProgression(r: KnowledgeRules): string {
  const w = WAVE_PT[r.progression.wave_model_default] ?? r.progression.wave_model_default;
  const a = AUTOREG_PT[r.progression.autoreg_strictness_default] ?? r.progression.autoreg_strictness_default;
  return `Onda ${w} · auto-regulação ${a}`;
}

function VolumeCard({ rules, setRules }: CardProps) {
  function update(m: MuscleGroup, key: "mev" | "mav" | "mrv", value: number) {
    const cur = rules.volume.landmarks[m] ?? VOLUME_LANDMARKS[m];
    setRules({
      ...rules,
      volume: {
        landmarks: {
          ...rules.volume.landmarks,
          [m]: { ...cur, [key]: value },
        },
      },
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volume — séries por semana</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          MEV (mínimo eficaz) ≤ MAV (zona ótima) ≤ MRV (máximo recuperável). Valores
          em séries semanais.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_repeat(3,4rem)] gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span />
            <span className="text-center">MEV</span>
            <span className="text-center">MAV</span>
            <span className="text-center">MRV</span>
          </div>
          {MUSCLE_GROUP_ORDER.map((m) => {
            const v = rules.volume.landmarks[m] ?? VOLUME_LANDMARKS[m];
            return (
              <div key={m} className="grid grid-cols-[1fr_repeat(3,4rem)] items-center gap-2">
                <Label className="text-sm">{MUSCLE_GROUP_LABELS_PT[m]}</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={v.mev}
                  onChange={(e) => update(m, "mev", Number(e.target.value))}
                  className="h-8 text-center"
                />
                <Input
                  type="number"
                  min={0}
                  max={40}
                  value={v.mav}
                  onChange={(e) => update(m, "mav", Number(e.target.value))}
                  className="h-8 text-center"
                />
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={v.mrv}
                  onChange={(e) => update(m, "mrv", Number(e.target.value))}
                  className="h-8 text-center"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function IntensityCard({ rules, setRules }: CardProps) {
  const i = rules.intensity;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Intensidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(["advanced", "conservative", "remedial"] as const).map((tier) => {
          const min = tier === "remedial" ? 6 : 7;
          const max = tier === "remedial" ? 9 : 10;
          const labels: Record<typeof tier, string> = {
            advanced: "🟢 Avançado · teto RPE",
            conservative: "🟡 Conservador · teto RPE",
            remedial: "🔵 Remedial · teto RPE",
          } as any;
          return (
            <div key={tier}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <Label>{labels[tier]}</Label>
                <span className="text-xs text-muted-foreground">
                  {i.rpe_ceiling_by_tier[tier].toFixed(1)}
                </span>
              </div>
              <Slider
                min={min}
                max={max}
                step={0.5}
                value={[i.rpe_ceiling_by_tier[tier]]}
                onValueChange={(v) =>
                  setRules({
                    ...rules,
                    intensity: {
                      ...i,
                      rpe_ceiling_by_tier: {
                        ...i.rpe_ceiling_by_tier,
                        [tier]: v[0],
                      },
                    },
                  })
                }
              />
            </div>
          );
        })}
        <div>
          <Label className="mb-2 block text-sm">Compromisso intensidade × volume</Label>
          <Select
            value={i.intensity_volume_tradeoff_default}
            onValueChange={(v: any) =>
              setRules({
                ...rules,
                intensity: { ...i, intensity_volume_tradeoff_default: v },
              })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high_int_low_vol">Alta intensidade · baixo volume</SelectItem>
              <SelectItem value="moderate_moderate">Equilibrado</SelectItem>
              <SelectItem value="moderate_int_high_vol">Volume alto</SelectItem>
              <SelectItem value="low_int_very_high_vol">Volume muito alto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function RecoveryCard({ rules, setRules }: CardProps) {
  const r = rules.recovery;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recuperação · Deload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block text-sm">Frequência de deload</Label>
          <Select
            value={r.deload_frequency}
            onValueChange={(v: any) =>
              setRules({ ...rules, recovery: { ...r, deload_frequency: v } })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="every_3_weeks">A cada 3 semanas</SelectItem>
              <SelectItem value="every_4_weeks">A cada 4 semanas</SelectItem>
              <SelectItem value="every_5_weeks">A cada 5 semanas</SelectItem>
              <SelectItem value="every_6_weeks">A cada 6 semanas</SelectItem>
              <SelectItem value="no_deload">Sem deload</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block text-sm">Estilo de deload</Label>
          <Select
            value={r.deload_style}
            onValueChange={(v: any) =>
              setRules({ ...rules, recovery: { ...r, deload_style: v } })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="volume_reduction">Reduzir volume</SelectItem>
              <SelectItem value="intensity_reduction">Reduzir intensidade</SelectItem>
              <SelectItem value="full_rest_week">Semana de descanso total</SelectItem>
              <SelectItem value="mixed">Misto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressionCard({ rules, setRules }: CardProps) {
  const p = rules.progression;
  const inc = p.increments_kg_by_category;
  function setInc(k: keyof typeof inc, v: number) {
    setRules({
      ...rules,
      progression: { ...p, increments_kg_by_category: { ...inc, [k]: v } },
    });
  }
  const incLabels: Record<keyof typeof inc, string> = {
    lower_compound: "Compostos inferiores (kg)",
    upper_compound: "Compostos superiores (kg)",
    lower_isolation: "Isolados inferiores (kg)",
    upper_isolation: "Isolados superiores (kg)",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progressão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(inc) as Array<keyof typeof inc>).map((k) => (
            <div key={k}>
              <Label className="mb-1 block text-xs">{incLabels[k]}</Label>
              <Input
                type="number"
                min={0.25}
                max={10}
                step={0.25}
                value={inc[k]}
                onChange={(e) => setInc(k, Number(e.target.value))}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <div>
          <Label className="mb-2 block text-sm">Modelo de onda (default)</Label>
          <Select
            value={p.wave_model_default}
            onValueChange={(v: any) =>
              setRules({ ...rules, progression: { ...p, wave_model_default: v } })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="undulating">Ondulatório</SelectItem>
              <SelectItem value="block">Em blocos</SelectItem>
              <SelectItem value="conjugate">Conjugado (em breve)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block text-sm">Auto-regulação (default)</Label>
          <Select
            value={p.autoreg_strictness_default}
            onValueChange={(v: any) =>
              setRules({ ...rules, progression: { ...p, autoreg_strictness_default: v } })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Restrita — corta carga em RPE drift</SelectItem>
              <SelectItem value="suggested">Sugerida — sinaliza, não corta</SelectItem>
              <SelectItem value="off">Desligada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}