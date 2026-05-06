# R72.2 — Motor multi-modalidade (gym + running + climbing + skill + mobility)

Vou implementar o motor multi-modalidade que estava previsto no plano R72. O R72.1 (i18n sweep) já fechou; agora ataco o coração: o pipeline phased só sabe gerar treino de ginásio. Este round abre-o para corrida, escalada, calistenia, skill e mobilidade — e adiciona o gate "Aprovar microciclo" antes das progressões.

---

## 1. Schema (`src/server/phased/schemas.ts`)

Adicionar ao `BriefSchema`:

```ts
training_modalities: z.array(z.enum([
  "gym","running","climbing","calisthenics","mobility","sport_skill"
])).default(["gym"]),
modality_targets: z.object({
  running: z.object({ distance_km: z.number().optional(), target_time_min: z.number().optional() }).optional(),
  climbing: z.object({ grade: z.string().optional(), style: z.enum(["boulder","sport","trad"]).optional() }).optional(),
  sport_skill: z.object({ sport: z.string().optional() }).optional(),
}).partial().optional(),
```

Compat retroactivo: brief sem `training_modalities` → `["gym"]`.

Adicionar a `SectionItemZ` campos opcionais:
- `intervals?: { distance?: string; pace?: string; duration?: string; rest?: string }[]` — para corrida.
- `climb_blocks?: { grade: string; attempts: number; rest_min?: number }[]` — para escalada.
- `prep_inhibition?: boolean` — flag para SMR/rolo na fase de inibição.

## 2. Pre-Stage 0 (`src/server/phased/pre-stage.functions.ts`)

Antes do LLM, regex/heurística no `client_overview.goal_text`:
- /5 ?k|10 ?k|maratona|corrida|trail|run/i → adiciona `running`
- /boulder|via|escalad|climb|6[abc]|7[abc]/i → adiciona `climbing`
- /handstand|calisten|street workout|barra/i → adiciona `calisthenics`
- /mobilidade|flexib|yoga/i → adiciona `mobility`
- /futebol|ténis|surf|handball|basquete/i → adiciona `sport_skill`

Sempre mantém `gym` se já lá estava ou se nada bater (default seguro). LLM depois confirma/expande no Stage 1.

## 3. Training zones lib (NOVO `src/lib/training-zones.ts`, ~120 LOC)

```ts
export function runZones(restingHR: number, maxHR: number, vdot?: number): Zone[]
export function strengthRanges(): { strength, hypertrophy, endurance, power }
export function vdotPaces(fiveKtimeMin: number): { easy, marathon, threshold, interval, repetition }
```

Constantes ACSM 12e Tbl 5.7 + Jack Daniels VDOT (paráfrase). Sem cópia verbatim.

## 4. Stage 2 blueprint (`src/server/phased/stage2-blueprint.functions.ts`)

Adicionar arquetípos por modalidade ao prompt + ao schema de saída:
- `aerobic_base` (Z2 long run)
- `interval_session` (VO₂max ou threshold)
- `tempo_run`
- `climb_project` (limit boulders/routes)
- `climb_endurance` (4×4, ARC)
- `skill_practice` (genérico, ex.: handstand drills)
- `mobility_flow`

`week_to_session_map` passa a aceitar mistura. Ex.: cliente "5K + boulder" com 5 sess/sem → `[strength_focus, interval_session, climb_project, aerobic_base, mixed_session]`.

## 5. Stage 3 microcycle (`src/server/phased/stage3-microcycle.functions.ts`)

Expandir o prompt com secção condicional por modalidade:

> For `running` sessions: emit items in `cardio[]` with `intervals[]` for interval/tempo, or `duration` for Z2 base. Use VDOT paces if `modality_targets.running.target_time_min` is set; else use HR zones (Karvonen).
>
> For `climbing` sessions: emit `climb_blocks[]` with grade ladder (warmup V0-V2 → project at limit → endurance circuits). Honor `modality_targets.climbing.grade`.
>
> For `sport_skill` and `calisthenics`: emit `resistance_main[]` + `accessories[]` with skill drills (e.g., handstand against wall 5×30s).
>
> All resistance work continues to honor strengthRanges() per programming tier.

Adicionar fase `prep_inhibition` (rolo/SMR 5min) antes do warmup quando `programming_variables.include_smr === true` ou cliente tem red flag músculo-esquelético.

## 6. Stage 3.5 — Aprovar microciclo (gate)

`src/routes/plans.$planId.microcycle.tsx`:
- Adicionar botão "Aprovar microciclo" (PT) / "Approve microcycle" (EN) no header da página.
- Server fn nova `approveMicrocycle({ planId })` em `src/server/phased/microcycle-edit.functions.ts` que:
  - Verifica owner.
  - Faz `update workout_plans set generation_state = jsonb_set(generation_state, '{approved_stages}', generation_state->'approved_stages' || '"microcycle"'::jsonb)`.
  - Devolve novo state.
- Stage 4 (`stage4-progressions.functions.ts`) já lê `generation_state.approved_stages`; adicionar guard: se não inclui `"microcycle"`, throw `MICROCYCLE_NOT_APPROVED`.
- UI Stage 4 em `plans.$planId.progressions.tsx` mostra estado bloqueado + CTA "Aprovar microciclo primeiro" → link para microcycle.

## 7. i18n

Novas chaves em `pt/plan.json` + `en/plan.json`:
- `microcycle.approve_button`, `microcycle.approved_chip`, `microcycle.approve_hint`
- `progressions.locked_title`, `progressions.locked_cta`
- `brief.modalities.{gym,running,climbing,calisthenics,mobility,sport_skill}`

## 8. Backlog + memory

- `.lovable/backlog.md`: marcar R72.2 done; abrir R73 (special-population overlays sobre o motor multi-modalidade).
- `mem://features/multi-modality.md` (NOVO): regra que `training_modalities` é lista, motor respeita por modalidade, Stage 3.5 é gate obrigatório, VDOT/HR zones vivem em `training-zones.ts`.
- Update `mem://index.md`.

---

## Ficheiros tocados

| Ficheiro | Acção |
|---|---|
| `src/server/phased/schemas.ts` | +`training_modalities`, `modality_targets`, intervals, climb_blocks |
| `src/server/phased/pre-stage.functions.ts` | inferir modalidade do goal_text |
| `src/server/phased/stage2-blueprint.functions.ts` | arquetípos por modalidade no prompt |
| `src/server/phased/stage3-microcycle.functions.ts` | prompt expandido + intervals/climbing |
| `src/server/phased/stage4-progressions.functions.ts` | guard `MICROCYCLE_NOT_APPROVED` |
| `src/server/phased/microcycle-edit.functions.ts` | +`approveMicrocycle` server fn |
| `src/lib/training-zones.ts` | NOVO — VDOT, HR zones, strength ranges |
| `src/routes/plans.$planId.microcycle.tsx` | botão "Aprovar microciclo" |
| `src/routes/plans.$planId.progressions.tsx` | estado bloqueado se não aprovado |
| `src/i18n/locales/{pt,en}/plan.json` | novas chaves |
| `.lovable/backlog.md`, `.lovable/plan.md` | atualizar estado |
| `mem://features/multi-modality.md`, `mem://index.md` | regra |

## O que NÃO faço aqui

- UI nova de edição inline para `intervals[]` / `climb_blocks[]` (Stage 3.5 fica com edição existente; render dos novos campos em modo leitura). Edição rica fica para R72.2b se for preciso.
- Conversor V-scale ↔ Fontainebleau (string livre por agora).
- VDOT calibrado por field test (usa só 5K self-report).
- Special-population overlays (R73).
- Render no PDF dos novos campos — fica para R72.2c quando decidirmos layout.

## Risco

Toco em 4 stage files do pipeline crítico. Mitigação: cada stage continua a funcionar com brief legacy (`training_modalities = ["gym"]`); novos arquetípos só aparecem se brief os pedir. Smoke obrigatório com (a) brief gym-only legacy → output igual ao actual; (b) brief gym+running → vê interval session no microcycle.

Procedo?
