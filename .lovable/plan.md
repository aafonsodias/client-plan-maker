# Step 2 — Apply assessment simplifications

Audit já aprovado em `.lovable/audits/assessment-ux-2026.md`. Este plano executa a ordem definida pelo utilizador (7 lotes) com salvaguardas que evitam regressão no Stage 1 Brief e no `/intake/$token` (que fica fora de scope mas lê das mesmas colunas).

---

## Princípios de execução

1. **Tudo no `src/routes/clients_.$clientId.tsx`** — não criar componentes novos a não ser que ≥ 2 secções partilhem código (chip-group já existe via `<ChipGroup/>`).
2. **DB intocada nesta ronda.** Renomear colunas para `_deprecated_*` quebra Stage 1, `section-map.ts`, intake público e `assessments` schema. Em vez disso: esconder no UI atrás do feature flag `VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS` (default `false`), e marcar com `// @deprecated R-X` no TS. A migração SQL fica para uma ronda posterior, depois de confirmar que ninguém lê.
3. **Cada lote = 1 commit lógico.** Se algo falha o smoke 375px, paramos no lote.
4. **i18n incremental** dentro de cada lote (as 4 locales: en, pt-PT, es, hi). `verify-capacity-i18n.ts` corre só no lote 7.

---

## Lote 1 — Consolidar Altura/Peso

**Problema**: Risco renderiza inputs inline H/W quando `bmiAuto.value === null`. Antropometria tem o mesmo par em "Dados base". Trainer pode preencher num lado e parecer vazio noutro.

**Mudança**:
- Remover o fallback inline de H/W na secção Risco (linhas ~1996–2046).
- Quando H ou W estão por preencher, a card de BMI mostra um CTA discreto: *"Preenche altura e peso em Antropometria → "* com âncora `#anthro` que faz `scrollIntoView` + flash amber suave nos 4 inputs base.
- Se H+W presentes, BMI calculado igual a hoje.
- "Dados base" em Antropometria ganha um eyebrow `label-caps`: **Dados base · usados em IMC, BMR e %GC**.

**Risco**: nenhum. Antropometria já é canonical no DB (`clients.height_cm/weight_kg`).

---

## Lote 2 — Chip groups (Pattern A)

Substituir 6 selects/free-text por `<ChipGroup>`:

| Secção | Campo | Opções |
|---|---|---|
| Risco | `smoking` | nunca · ex-fumador · atual |
| Antropometria (avançado) | `body_fat_method` | calipers · BIA · DEXA · BodPod · visual |
| Treino | `experience_level` | iniciado · intermédio · avançado |
| Treino | `training_location` (hoje texto livre) | casa · ginásio · ar livre · híbrido |
| Lifestyle | `ext_job_type` (hoje texto livre) | sentado · em pé · fisicamente exigente · misto |
| Performance | `ext_cardio_test` | não testado · Cooper · Rockport · outro |

**Conversão de texto livre → enum**:
- `training_location` e `ext_job_type` hoje aceitam string arbitrária. Plano: novo valor escrito como token canónico (`home`, `gym`, etc.). Valores antigos não-canónicos são preservados na DB e mostrados como chip "outro · {valor}" (não-clicável, com botão pequeno X para limpar). Zero perda de dados.

**i18n**: novas chaves `chip.{section}.{value}` em todas as locales.

---

## Lote 3 — Auto-derivados (Pattern F)

Já temos BMI e WHR. Adicionar:

- **FFMI** (Fat-Free Mass Index) = `(weight_kg × (1 - body_fat_pct/100)) / (height_m²)` + ajuste FFMI normalizado. Mostra como muted badge no advanced de Antropometria, ao lado de %GC. Só quando os 3 inputs existem.
- **Idade** já calculada de `date_of_birth` em vários sítios — extrair para chip muted ao lado da DOB.

Nenhum novo input. Zero risco de DB.

---

## Lote 4 — Avançado colapsável (Pattern E)

Mover para `<details>` collapsed-por-defeito:
- **Mobilidade**: wrist + knee → bloco "Avançado · articulações secundárias" (shoulder/hip/ankle/thoracic ficam visíveis).
- **Antropometria**: já está (BF% + método). Confirmar que o flash amber do Lote 1 não rompe se aberto.
- **Performance**: legacy `cardio_capacity` já está atrás de toggle — converter o toggle num `<details>` consistente com o resto.

Cada `<details>` tem chip "opcional" no summary com hint do conteúdo.

---

## Lote 5 — Remover/deprecar campos mortos

**Esconder do UI** (atrás de `import.meta.env.VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS === "true"`):

| Campo | Onde estava | Motivo |
|---|---|---|
| `primary_goal` (textarea "contexto") | SMART goal | duplica `smart_specific` |
| `medical_conditions` | Treino | duplica Medications |
| `energy_levels` | Lifestyle | duplica sleep/stress sliders |
| `recovery_capacity` | Lifestyle | idem |
| `hydration_glasses_per_day` | Nutrition (legacy) | substituído por `ext_water_l_per_day` |
| `cardio_capacity` | Performance (legacy) | substituído por `ext_cardio_test`/`value` |

**Salvaguardas** antes de esconder:
- Verificar `src/server/phased/stage1-brief.functions.ts:197` — `primary_goal` está listado nos campos extraídos. Plano: garantir fallback em `section-map.ts` que copia `smart_specific` para `primary_goal` quando vazio (1 linha de defensive code, não muda prompt).
- `medical_conditions` no `section-map.ts` lê `a.medical_conditions`. Hoje preenchido apenas pela secção Treino. Após esconder o input, manter leitura — só não escreve mais. Valores existentes preservados.
- Não tocar nas colunas DB. Migração SQL fica para ronda futura, depois de confirmar 1 mês sem regressões.

**TypeScript**: marcar campos no tipo `Assessment` como `/** @deprecated R-X — hidden behind VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS */`.

**Posture**: merge `standing_posture_notes` + `known_imbalances` num único textarea "Notas posturais" — ambos os valores existentes concatenam-se na primeira leitura (`standing_posture_notes\n---\nknown_imbalances`) e a partir daí escrevem em `standing_posture_notes`. `known_imbalances` entra na lista de deprecated.

---

## Lote 6 — Auto-save + Discard no `•••`

**Estado actual**: `setAssessment` já dispara debounced flush para a DB (`useEffect` em `assessment` muda).

**Mudanças**:
- Adicionar toast subtil top-right `Guardado` com fade-out 1.2s, throttled a cada 4s (não spam quando o trainer escreve depressa). Usar shadcn `useToast` com `duration: 1200` e variant ghost.
- "Descartar rascunho" sai dos botões primários e migra para um `<DropdownMenu>` `•••` no header da secção de avaliação. Confirmação fica igual (AlertDialog).
- Nenhuma alteração ao "unsaved changes" — não há.

**Risco**: nenhum. Comportamento de gravação é o mesmo, só muda a comunicação visual.

---

## Lote 7 — i18n + verify

- Adicionar/atualizar chaves em `src/i18n/locales/{en,pt,es,hi}/assessment.json`:
  - novas chaves dos chip groups
  - "Notas posturais" merged
  - "Guardado" toast
  - "Avançado · articulações secundárias"
- Correr `bun run scripts/verify-capacity-i18n.ts` (ou equivalente) — bloquear se faltar key.
- Hi/Es ficam com fallback EN para chaves que não eram capacity-críticas (memória diz que só plan.json + common.json estão traduzidos LLM nessas locales).

**Required-vs-optional dot**: adicionar à 13 fields listados na auditoria (PARQ × 7, sex, DOB, H, W, smart_specific, smart_deadline, experience_level, training_days_per_week, session_duration_minutes, training_location, available_equipment, current_capacity_vs_pb). Implementação: helper `<RequiredDot/>` que renderiza `<span className="mr-1 inline-block h-1 w-1 rounded-full bg-amber-400/60" />` antes do label. Sem asterisco em nenhum lado.

---

## Pattern coverage check (alvo ≥ 5 dos 8)

| Pattern | Lote |
|---|---|
| A · chips vs free text | 2 ✅ |
| B · sensible defaults | adicionar placeholders RHR=65, dias/sem=3, sessão=60min no lote 2 ✅ |
| C · units inline | já existe (`unit` prop em `MeasureField`) — confirmar que RHR usa "bpm" inline ✅ |
| D · grouping `bg-muted/30` | lote 5 (notas posturais merged) ✅ |
| E · collapsible advanced | 4 ✅ |
| F · auto-derived | 3 ✅ |
| G · keyboard-first numeric | adicionar `inputMode="decimal"` + `tabular-nums` em todos os `MeasureField` no lote 1 ✅ |
| H · remove dead fields | 5 ✅ |

**8 de 8 padrões**, com margem.

---

## Mobile 375px smoke

Após lote 4 e lote 6, abrir preview a 375×812 e percorrer todas as 14 secções:
- sem horizontal scroll
- chip groups quebram em 2 colunas
- `•••` menu acessível
- toast "Guardado" não cobre input em uso

Capturar screenshots de PARQ + Antropometria + Movement screen *antes* (já temos o estado actual) e *depois* — guardar em `.lovable/design/assessment-before-after/`.

---

## Verificações finais

1. ✅ Trainer demo abre `/clients/$demo` e gera Stage 1 Brief sem erros (smoke contra Stage 1 com a shape simplificada).
2. ✅ `/intake/$token` continua a renderizar — a secção pública lê os mesmos campos; lote 5 não esconde nada lá porque o flag controla apenas o trainer view (intake faz o seu render).
3. ✅ Light + dark theme: chip selecionados usam `bg-primary/10 text-foreground` (já é o padrão).
4. ✅ Sem regressão em `verify-capacity-i18n.ts`.
5. ✅ Field-count líquido: -8 visíveis (6 deprecated + 2 demoted) e +0 novos. ✓ critério "nunca aumenta".

---

## Nota sobre rename DB para `_deprecated_*`

A pedido do utilizador, o passo 5 propõe rename. **Aviso**: hoje há 4 leitores server-side dos campos `primary_goal`, `medical_conditions`, `cardio_capacity`, `hydration_glasses_per_day` (Stage 1 prompt + section-map + brief schema). Renomear quebra geração de planos. Proposta deste plano: **não renomear nesta ronda**. Apenas:
- esconder UI (flag),
- marcar `@deprecated` no TS,
- abrir todo p/ ronda futura uma migração SQL única depois de purgar leitores e snapshots.

Se preferires renomear já, sinaliza e adicionamos um lote 5b com a migração + atualizações em `stage1-brief.functions.ts`, `section-map.ts`, `schemas.ts` no mesmo commit. Custo extra: ~5 créditos e risco médio.

---

## Custo estimado

| Lote | Créditos |
|---|---:|
| 1 H/W consolidation | 2 |
| 2 Chip groups | 5 |
| 3 Auto-derived | 2 |
| 4 Collapsible advanced | 2 |
| 5 Hide deprecated + posture merge | 4 |
| 6 Auto-save toast + Discard `•••` | 3 |
| 7 i18n + verify + smoke | 4 |
| **Total** | **22** |

Dentro do alvo 20–25.

---

## Out of scope (confirmado)

- Movement screen (próprio round)
- AI prompts em `stage1-brief.functions.ts` (mantém shape)
- Schema DB (lote 5 é flag + TS only)
- `/intake/$token`
- Outras rotas
