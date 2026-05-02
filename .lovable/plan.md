# Phase B — #3 + #24: Inteligência de volume (MEV/MAV/MRV) + spider charts

## Contexto

Hoje cada exercício já tem `primary_muscles[]` e `secondary_muscles[]` (vindos do Stage 4 / schema). O que falta é **transformar isso em sets-por-grupo-muscular semanais** e mostrar ao trainer (e ao cliente) se está abaixo do MEV (volume mínimo eficaz), no MAV (sweet spot), ou a aproximar-se do MRV (recoverable max). Hoje voa-se às cegas — adicionar 4 séries de Bench pode acidentalmente partir o MRV de "chest".

Sem mexer no pipeline de IA. Tudo derivado do plano que já existe no DB. Determinístico, instantâneo.

## Escopo deste turno

1. Tabela canónica de landmarks por grupo muscular (Helms/Israetel range médio).
2. Função `computeWeeklyVolume(plan)` — derivada client-side do `plan_data`/`workout_plan_days`.
3. `MuscleVolumeRadar` — spider chart com 8-10 eixos (chest, back, quads, hams, glutes, shoulders, arms, core, calves), com 3 anéis de referência (MEV/MAV/MRV) e o polígono "esta semana".
4. `VolumeStatusTable` — companion table que para cada grupo mostra: sets actuais, status (under/optimal/over), sugestão curta.
5. Integrar na rota `/plans/$planId` numa nova secção "Volume semanal", com selector de semana (W1/W2/.../Wn).
6. Reuso no logbook (futuro — fora deste turno): mostrar volume executado vs prescrito.

Fora deste turno (#24 tail): write-in zone no PDF + OCR de fotos. Próximo turno.

## Decisões honestas

- **Counting policy**: cada série conta 1.0 para `primary_muscles` e 0.5 para `secondary_muscles`. Standard Renaissance Periodization. Trainer pode discordar — documentamos no tooltip.
- **Reps range**: ignoramos AMRAPs / drop sets / rest-pause (somar séries planeadas, parsing simples de "3" / "3-4" → média).
- **Landmarks são padrão**, não personalizados ao cliente. v1 usa tabela única para "intermediate". Personalização por experience_level fica para mais tarde — caso contrário o radar vira ciência ficção.
- **NÃO** vamos sugerir alterações automáticas ao plano. Só diagnosticar. Lovable não toma decisões de carga sem o trainer.

## Arquitectura técnica

### 1. Landmarks — `src/lib/volume-landmarks.ts` (novo)

```ts
// Sets/week per muscle group (intermediate trainee, Helms/Israetel consensus)
export const VOLUME_LANDMARKS = {
  chest:     { mev: 8,  mav: 14, mrv: 22 },
  back:      { mev: 10, mav: 16, mrv: 25 },
  quads:     { mev: 8,  mav: 14, mrv: 20 },
  hamstrings:{ mev: 6,  mav: 12, mrv: 18 },
  glutes:    { mev: 6,  mav: 12, mrv: 18 },
  shoulders: { mev: 8,  mav: 16, mrv: 26 },
  biceps:    { mev: 6,  mav: 12, mrv: 20 },
  triceps:   { mev: 6,  mav: 12, mrv: 20 },
  calves:    { mev: 6,  mav: 12, mrv: 18 },
  core:      { mev: 0,  mav: 8,  mrv: 16 },
} as const;

// Synonym table — IA escreve "pectorals" / "peitorais" / "chest" → normalizar
export const MUSCLE_ALIASES: Record<string, MuscleGroup> = {
  chest: "chest", pectorals: "chest", peitoral: "chest", peitorais: "chest", pecs: "chest",
  back: "back", lats: "back", "latissimus": "back", "rhomboids": "back", traps: "back", dorsal: "back", costas: "back",
  // ... etc
};
```

### 2. Compute helper — `src/lib/volume-compute.ts` (novo)

```ts
export function computeWeeklyVolume(days: WorkoutPlanDayRow[]): {
  byWeek: Map<number, Record<MuscleGroup, number>>;
} {
  // For each day: parse sets ("3" / "3-4" → mean), add 1.0 to each primary
  // muscle (normalized via MUSCLE_ALIASES) and 0.5 to each secondary.
  // Returns { 1: { chest: 12, back: 14, ... }, 2: {...} }
}

export function statusFor(sets: number, lm: VolumeLandmark): "under"|"optimal"|"over"|"danger" {
  if (sets < lm.mev) return "under";
  if (sets <= lm.mav) return "optimal";
  if (sets <= lm.mrv) return "over";   // above MAV but recoverable
  return "danger";                     // exceeds MRV
}
```

### 3. Componentes — `src/components/volume/`

- **`MuscleVolumeRadar.tsx`** — recharts `RadarChart` com:
  - eixo angular = grupos musculares (filtra os com landmark > 0).
  - 3 polígonos de referência (MEV ténue cinza, MAV verde-translúcido, MRV âmbar tracejado).
  - polígono "actual" desta semana (azul preenchido).
  - axis ticks = sets/sem.
- **`VolumeStatusTable.tsx`** — para cada grupo: chip de status (toneChip do `status-tone.ts`), sets actuais / MAV alvo, mensagem PT curta:
  - under: "Abaixo do MEV — adiciona ~{n} séries para começar a estimular".
  - optimal: "Dentro do MAV — sweet spot."
  - over: "Acima do MAV — atenção a recuperação."
  - danger: "Acima do MRV — risco de overreaching."
- **`VolumeWeekTabs.tsx`** — Tabs com W1/W2/.../Wn (`duration_weeks`), default = última semana com dados.

### 4. Integração — `src/routes/plans.$planId.tsx`

Nova secção "Volume semanal" entre o "Mesociclo" e o "Logbook" (ou onde fizer sentido visualmente). Header com `BrandMark` discreto + título + tooltip a explicar landmarks. Collapsible (default expandido).

Sem novas server functions: o cálculo é trivial e roda no cliente sobre os dados já carregados em `plan.days`.

### 5. Sem mudanças de DB

Toda a lógica é derivada. `primary_muscles` e `secondary_muscles` já existem em `workout_plan_days.content.exercises[]`.

## Critério de aceitação

- Abrir um plano com 4 semanas → vejo radar para W1, posso clicar W2/W3/W4.
- Cada grupo muscular mostra status correcto vs landmark.
- Se um exercício não tiver `primary_muscles` preenchido (planos antigos), o grupo aparece a 0 sem rebentar.
- Tooltip explica o que é MEV/MAV/MRV em PT (linguagem de coach, não académica).
- Funciona em dark + light, mobile responsivo (radar empilha em cima da tabela < md).

## Ficheiros

Novos:
- `src/lib/volume-landmarks.ts`
- `src/lib/volume-compute.ts`
- `src/components/volume/MuscleVolumeRadar.tsx`
- `src/components/volume/VolumeStatusTable.tsx`
- `src/components/volume/VolumeWeekTabs.tsx`
- `src/components/volume/VolumeSection.tsx` (wrapper que junta tudo)

Editados:
- `src/routes/plans.$planId.tsx` — montar `<VolumeSection days={plan.days} weeks={plan.duration_weeks} />`
- `mem/tasks/backlog.md` — marcar #3 como done (parcial: sem personalização por experience_level), deixar #24 tail aberto.

## Fora deste turno

- Personalização de landmarks por experience_level / sex / age.
- Volume executado (do logbook) sobreposto ao prescrito.
- Sugestões automáticas de ajuste (não fazemos — princípio honesto).
- PDF write-in zone + OCR (#24 tail).

Responde **"continua"** que avanço.
