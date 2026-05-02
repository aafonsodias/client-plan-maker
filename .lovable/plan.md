## Objectivo

Fechar os dois últimos itens da Phase A do backlog, sem inventar arquitectura nova:

1. **#23** — Diferenciação visual subtil por dia em `SessionDayView` (cada dia ganha um tom de acento próprio, suave).
2. **#20** — Picker de "adicionar exercício" no `MesocycleTableView` (fecha o último gap de edição do mesociclo).

Pequeno, satisfatório, sem mexer em pipeline de IA. Bom para um turno de baixa energia.

---

## 1. Tom por dia no SessionDayView

Hoje todos os cartões de dia partilham a mesma paleta neutra. A ideia é dar a cada dia índice (0..6) um **acento muito subtil** — só o suficiente para o olho separar Day 1 de Day 2 numa página com vários dias (microcycle review, /sessions, PDF preview).

### Onde

`src/components/SessionDayView.tsx` — o componente já recebe `index: number`.

### Como

- Adicionar uma palette pequena de 5 hues (HSL com `--foreground` luminance, opacidade ~0.10):

  ```ts
  const DAY_ACCENTS = [
    "oklch(0.72 0.10 85)",   // amber soft (Day 1)
    "oklch(0.70 0.10 200)",  // teal       (Day 2)
    "oklch(0.72 0.10 320)",  // mauve      (Day 3)
    "oklch(0.72 0.10 145)",  // sage       (Day 4)
    "oklch(0.72 0.10 30)",   // terracotta (Day 5)
  ];
  const dayAccent = DAY_ACCENTS[index % DAY_ACCENTS.length];
  ```

- Aplicar em **três sítios discretos**:
  1. O número-fantasma `{dayNumber}` recebe `color: ${dayAccent}` com a opacidade já existente (`/[0.06]` ou `/[0.10]`).
  2. A `divider` (`<div className="mt-3 h-px w-full bg-border" />`) passa a ter um gradient: `linear-gradient(to right, ${dayAccent}/40, transparent)`.
  3. O ícone do `day_label` (se existir um marker pequeno) ou um chip mínimo `Day N` à esquerda do título com `background: ${dayAccent}/15` e `color: ${dayAccent}`.

- **Não tocar** em fundos de cartão, nem cores de RPE/superset (já têm semântica). Só decoração leve.

### Critério de aceitação

Numa página com 4 dias renderizados, percebe-se de relance que são dias diferentes sem ler. Em dark + light. Sem prejudicar contraste do superset_id (já usa cores próprias).

---

## 2. Add-exercise picker no MesocycleTableView

Hoje o `MesocycleTableView` deixa eliminar exercícios em todas as semanas (`deleteExerciseAcrossWeeks`) mas não permite adicionar. Falta para fechar o ciclo de edição manual.

### Server fn nova

`src/server/phased/microcycle-edit.functions.ts` — adicionar `addExerciseAcrossWeeks`:

```ts
export const addExerciseAcrossWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    planId: z.string().uuid(),
    dayLabel: z.string(),
    exercise: z.object({
      name: z.string().min(1),
      sets: z.string().default("3"),
      reps: z.string().default("10"),
      rpe: z.string().default("7"),
      rest: z.string().default("90s"),
      notes: z.string().optional(),
      insertAfterIndex: z.number().int().min(-1).default(-1), // -1 = append
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Fetch all rows for plan+dayLabel, verify trainer_id, insert at insertAfterIndex+1
    // (or append) into content.exercises across every week. Return touched count.
  });
```

A inserção é determinística (mesmo objecto em todas as semanas) — sem chamar IA. A `intensity_rpe` da onda fica para o trainer ajustar manualmente ou re-correr Stage 4 se quiser.

### UI no MesocycleTableView

- Botão `+ Adicionar exercício` no fim de cada bloco de dia (já há rows agrupadas por dia).
- Click abre um `Dialog` simples com:
  - Input `name` (autocomplete com fetch de exercícios já usados no plano — opcional, primeiro v1 só campo livre).
  - Inputs `sets`, `reps`, `rpe`, `rest` com defaults sensatos (3 / 10 / 7 / 90s).
  - Selector `Inserir depois de…` com lista dos exercícios actuais do dia (default: "no fim").
- Submit chama `addExerciseAcrossWeeks`, faz `router.invalidate()` ou refetch local.

### Critério de aceitação

Posso adicionar "Face pull" depois de "Bench press" no Day "Push" e ele aparece em W1, W2, W3, W4 com os mesmos sets/reps/rpe. Refresh confirma persistência. Eliminar com o ✕ existente continua a funcionar e remove de todas as semanas.

---

## Ficheiros tocados

- `src/components/SessionDayView.tsx` — palette + 3 aplicações subtis.
- `src/server/phased/microcycle-edit.functions.ts` — `addExerciseAcrossWeeks`.
- `src/components/MesocycleTableView.tsx` — botão + dialog de adicionar.
- `mem/tasks/backlog.md` — marcar #20 e #23 como done.

## Fora deste turno

- Autocomplete inteligente de nomes (ML / lista canónica). Fica num backlog item próprio se quiseres.
- Coluna RPE mostrar "RPE 6 – 8 (med 7)" — já está implementada do turno anterior.
- Tudo o que está em Phase B/C/D.

Responde **"continua"** que avanço com isto.