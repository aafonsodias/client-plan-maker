
# Round 54 — Plan-view feedback do user (4 P1 + 1 P2)

Continuação direta do Round 53 (que ainda tem P0-RPE/PROTOCOL/PDF por fechar). Aqui foco-me só no que o user reportou agora — **plan view chrome, PR celebration, log overlay**. Adiciono ao backlog e implemento no mesmo turno.

---

## 1. PR confetti dispara em cada refresh (P0 — bug, 5 cr)

**Causa:** em `src/components/plan/LogbookTimeline.tsx:97-114`, `seenRef` é um `useRef(new Set())` em memória. Refresh → set vazio → re-dispara confetti+toast para todas as sessões com PR. E só "alguns" exercícios celebraram porque a deteção de PR (`isPR` em `ExerciseSetsCard.tsx:150`) compara `currentTop > historicalBest` — primeiro treino tem historicalBest=0 então qualquer set conta, mas a agregação por sessão em `LogbookTimeline` filtra por nome de exercício que aparece em `prs[]` calculado pelo hook upstream — vou verificar `usePlanPRs` ou similar para perceber se o filtro está a perder exercícios sem `e1RM` calculável (bodyweight sem carga, hold-time, etc.).

**Correção:**
- **Persistir "celebrado" por sessão**: nova coluna `workout_sessions.pr_celebrated_at timestamptz` (migration). Quando o burst dispara, marca via server function `markPRCelebrated(sessionId)`. Ao carregar, filtra sessões já celebradas → nada de confetti em refresh.
- **Fallback localStorage** por `planId:sessionId` para o caso de a server-fn falhar (rede caída) — UX nunca quebra mas a fonte da verdade é a DB.
- Investigar por que apenas "alguns" exercícios marcaram PR no primeiro treino (suspeita: bodyweight sem carga não gera e1RM → ficam de fora da `prs[]`). Se confirmado, alargar deteção para "primeira execução registada de exercício novo" no Block 1 → marca como PR baseline.

## 2. Prescrição + Log lado-a-lado no MesocycleTableView (P1 — 20 cr, redux do Round 53)

Já estava no Round 53 mas reformulo segundo o feedback: **debaixo de cada célula de prescrição, uma linha azul com o que foi efetivamente feito**.

```
4×12-15  RPE 8  180-240 sec        ← prescrição (muted)
4×12 @ 60kg  RPE 8.5  ~200 sec     ← realizado (azul oklch(0.68 0.16 240))
```

- Se a sessão dessa célula (week+day+exercise) ainda não foi logada → mostra apenas a prescrição.
- Se foi parcial → cor mantém-se mas ícone `⚠` antes do texto.
- Click na linha azul → popover com sets individuais (já existe a data, só costurar).
- Implementação: novo helper `useSessionActuals(planId)` que devolve `Map<weekDay+exerciseName, ActualRow>` — alimenta `MesocycleTableView` sem mudar a shape do plano.

## 3. Header do plano colapsado (P1 — 12 cr)

**Hoje** (vide screenshot): All-plans link → nome → status chip → 8 botões → Summary card → Suggestion card → Bloco card → Banner amarelo de validação → modes → Table/Cards → TSV/MD/Detailed → finalmente o plano. **400+ px vertical antes do plano.**

**Proposta:**
- **Linha 1 (sticky)**: ← All plans · **Nome do cliente truncado mas sempre visível** · Block N chip · Ready chip · `⋯` overflow menu (Share, Assessment, Template, Re-ancorar, Delete, Branding, Import log).
- **Linha 2 (sticky)**: PDF (primário, âmbar) · Regenerate with feedback · Modes (View/Edit/Log/Resultados/Progresso).
- **Summary + Suggestion + Bloco + Banner** → todos colapsam num `<details>` único chamado **"Resumo do bloco"** (fechado por defeito, aberto se há `Iniciar Bloco N+1` pendente).
- Banner "Validação automática indisponível" → só visível dentro do `<details>` (não polui).
- Remover o toggle Table/Cards quando só há 1 vista útil para o utilizador atual; manter TSV/MD/Detailed dentro de um `Export ▾`.

**Resultado: ~120 px antes do plano em vez de 400 px.**

## 4. Nome do cliente nunca colapsa (P1 — 3 cr, dentro do #3)

No screenshot 184C1082 vê-se "André Periquito Af…" truncado com avatar; nos outros mostra só "An…" ou "And". Causa: o nome está num `flex` que cede espaço aos 8 botões. Com a re-arrumação do #3 (botões em overflow menu), o nome ganha `flex-1 min-w-0` e o truncate faz-se só a partir do meio (`text-overflow: ellipsis` com largura mínima de 16ch).

## 5. White-theme: chip "Ready" e "P" do BrandMark com contraste OK (P1 — 5 cr)

- O chip verde "Ready" no light mode usa `--success` muito claro sobre fundo branco. Forçar `bg-emerald-50 text-emerald-700 border-emerald-200` no light, mantendo `oklch` atual no dark via `dark:` prefix.
- O "P" do BrandMark (logo) na barra inferior do screenshot tem o under-glow âmbar mas o glyph quase não se vê em fundo claro — adicionar `text-foreground` explícito + aumentar peso do glyph no light.

---

## Backlog — adicionar entradas

```
| 60 | P0 | Plan page | PR confetti idempotente: workout_sessions.pr_celebrated_at + fallback localStorage | R54 |
| 61 | P1 | Plan page | Mesocycle table: linha azul "realizado" debaixo de cada prescrição | R54 |
| 62 | P1 | Plan page | Header colapsado: 2 linhas sticky + Resumo do bloco em <details> | R54 |
| 63 | P1 | Plan page | Nome do cliente sempre visível (flex-1 min-w-0 + overflow menu p/ botões) | R54 |
| 64 | P1 | Theme  | Light-mode contraste: chip Ready + glyph BrandMark | R54 |
| 65 | P2 | Plan page | Avaliar deteção de PR para bodyweight/hold (sem e1RM) — baseline no Block 1 | R54+ |
```

---

## Ficheiros tocados (estimativa)

- `supabase/migrations/<ts>_pr_celebrated_at.sql` — nova coluna + index
- `src/server/sessions.functions.ts` — `markPRCelebrated`
- `src/components/plan/LogbookTimeline.tsx` — usar `pr_celebrated_at` como fonte
- `src/components/plan/MesocycleTableView.tsx` — overlay de actuals
- `src/hooks/useSessionActuals.ts` — novo
- `src/routes/plans.$planId.tsx` — header refactor (2-line sticky + details)
- `src/components/BrandMark.tsx` + `src/lib/status-tone.ts` — light-theme tokens
- `.lovable/backlog.md` — entradas 60-65

## Custo estimado: ~45 cr

(separado dos ~125 cr ainda pendentes do Round 53 para PROTOCOL+PDF+RPE periodization)

## O que NÃO está incluído

- Round 53 P0 RPE periodization, FORGE→PROTOCOL rename, PDF repaint — esses ficam para o turno seguinte (já aprovados, só falta executar).
- AI-coach, longitudinal, cliente page rewrite — Round 55+.
- Reescrita de CUEs.

Aprovas para executar agora? Posso encadear isto **antes** ou **depois** dos P0 do Round 53 — recomendo **depois** porque o RPE periodization muda a shape das células do MesocycleTableView e quero fazer o overlay azul (#2) sobre a versão final.
