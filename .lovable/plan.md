## Round 64 — Dois temas

### A) PDF: nomes das sessões deixam de ser "Day 1 / Day 2"

**Problema**: `src/lib/pdf.ts:392-394` força `Day {i+1} — <focus>` ou `Day {i+1}` quando o label vem vazio/junk. Em PT lê-se "Day", os números colidem se houver dias de descanso entre sessões, e o cabeçalho fica atrofiado quando o foco é longo.

**Mudanças em `src/lib/pdf.ts`:**

1. **Locale-aware**: usar `Sessão N` (PT) / `Session N` (EN) consoante `meta.locale` (já passado ao PDF).
2. **N = ordem de sessão de treino**, não índice de archetype. Já é o que `archetypes.forEach((arc, i))` faz, mas o label deve refletir ordem semanal real, não posição no array.
3. **Label final = `Sessão N · <Focus humano>`** (separador `·`, não `—`, mais leve). Truncar focus a ~38 chars com ellipsis para não atrofiar o header.
4. **Focus humano**: se vier "Week X" junk OU vazio OU "Sessão de treino", inferir do `movement_pattern` dominante dos exercícios principais — mapa PT/EN: `push→Empurrar/Push`, `pull→Puxar/Pull`, `squat→Agachamento/Squat`, `hinge→Dobradiça/Hinge`, `full_body→Corpo inteiro/Full body`. Helper: `inferFocusFromExercises(day, locale)`.
5. **Cabeçalho da página**: garantir 2 linhas se necessário (label em cima, focus em baixo) quando focus > 28 chars, em vez de truncar.

Total: ~40 linhas tocadas em `pdf.ts`, 1 helper novo. Sem migração.

---

### B) Intensity Cockpit — o "volante" de modulação de intensidade

Hoje o coach tem 1 botão (`brief.intensity_appetite: conservador|padrao|agressivo`) e o resto é caixa preta. Queremos um **dashboard tipo carro**: mostrar todos os indicadores, dar volante fino, e ainda assim ter modos pré-configurados para quem não quer mexer.

**Modelo**: 5 "instrumentos" — todos opcionais, todos com defaults inteligentes.

| Instrumento | Tipo | Default | O que controla |
|---|---|---|---|
| **Wave model** (volante) | radio: linear · undulating · block · conjugate | undulating | shape semanal de carga em `buildWavePlan()` |
| **RPE ceiling** (limitador) | slider 7.0–10.0 step 0.5 | derivado de age+red_flags | tecto de RPE em todas as semanas (`programming-defaults.ts:18`) |
| **Volume/Intensity tradeoff** (caixa de velocidades) | radio: high_vol_low_int · moderate · low_vol_high_int | moderate | Δ% volume vs Δ load nas semanas +volume/+intensity |
| **Deload frequency** (suspensão) | every 3 / 4 / 5 / 6 weeks | 4 | quando o wave injecta semana deload |
| **Autoregulation strictness** (ABS) | strict · suggested · off | suggested | quão duro `programNextWeek` cortar load se RPE realizado > prescrito |

**Onde vive (UI):**

- Novo painel `<IntensityCockpit/>` em `src/components/plan/IntensityCockpit.tsx`.
- Layout: card grande no `BriefStage` (antes de gerar Stage 3) **e** secção dedicada no `/plans/$id` modo edit (sticky no topo do Stage 4 panel).
- Visual: 5 mostradores arrumados como dashboard de carro — wave em cima ao centro (volante), RPE ceiling à esquerda (taquímetro 7→10), tradeoff à direita (caixa), deload e autoreg como toggles inferiores. Cada um com 1 linha de copy "o que isto faz" e link para tooltip com a citação Bompa/NSCA.
- **Modos pré-configurados** (chips no topo do cockpit): `Hipertrofia clássica` · `Força base` · `Recomp moderado` · `Volume alto` · `Conservador` · `Custom`. Ao clicar, set os 5 controlos e marca `cockpit_preset` em `brief`.

**Onde vive (dados):**

- Adicionar a `brief` (já é jsonb): `wave_model`, `rpe_ceiling_override`, `vol_int_tradeoff`, `deload_every_n_weeks`, `autoreg_strictness`, `cockpit_preset`.
- Sem migração — `brief` é jsonb livre.

**Onde vive (motor):**

- `programming-defaults.ts`:
  - `pickRpeCeiling()` passa a aceitar override.
  - `buildWavePlan()` ramifica por `wave_model`:
    - `linear`: W1 base → W2 +load → W3 +load → W4 deload (já existe pattern).
    - `undulating`: alterna +volume/+intensity por semana (atual).
    - `block`: W1-2 acumulação volume, W3-4 intensificação, deload no fim do bloco.
    - `conjugate`: cada microciclo tem dia max-effort + dia dynamic-effort (requer Stage 3 hint, parked se complicado — começamos com 3 modos sólidos e marcamos conjugate como "Soon").
  - `injectDeload(wave, every_n)` puxa o deload para a semana N×every_n.

- `stage4-progressions.functions.ts` (já determinístico):
  - lê `brief.wave_model`, `vol_int_tradeoff` e injecta nos `deltaForExercise()`.
  - tradeoff `high_vol_low_int`: nas semanas `+volume` faz +1set em compounds (em vez de +1rep), e nas `+intensity` segura load (+1 rep em vez de +load).
  - tradeoff `low_vol_high_int`: o oposto — load mais cedo, sets baixos.

- `programNextWeek` (a construir em R64b se já existir esqueleto, senão fica no R65):
  - lê `autoreg_strictness`. Se `strict` e RPE médio realizado > prescrito + 0.7, corta load 5%; se `off`, ignora e segue wave nominal.

**Telemetria:**

- `generation_meta.cockpit` = snapshot dos 5 controlos + preset usado, para auditarmos que combinações o coach escolhe e quais correlacionam com adesão alta.

---

### Ordem de execução

1. **A (PDF day naming)** — mudança contida, fica fechada no mesmo turno.
2. **B1 (cockpit dados + presets + UI)** — painel renderiza, escreve em brief, ainda não muda motor.
3. **B2 (motor lê os 5 controlos)** — `programming-defaults` + `stage4` ramificam.
4. **B3 (cockpit no /plans/$id edit)** — segunda surface, igual à do brief.
5. **Backlog**: `programNextWeek` com `autoreg_strictness`, modo `conjugate`, dashboard analítico de qual preset gera mais adesão (futuros rounds).

### Não-objectivos deste round

- Não tocar em PDF para lá do day naming.
- Não construir `programNextWeek` se ainda não tiver esqueleto.
- Não adicionar mais línguas, não mexer em landing.
- Não inventar autoreg sem dados — `strict` corta com regra fixa, sem ML.

### Ficheiros tocados (estimativa)

- `src/lib/pdf.ts` (helper + label)
- `src/components/plan/IntensityCockpit.tsx` (novo)
- `src/components/plan/CockpitPresets.ts` (novo, mapa preset→5 valores)
- `src/server/phased/programming-defaults.ts` (wave variants + deload injection)
- `src/server/phased/stage4-progressions.functions.ts` (tradeoff handling + meta)
- `src/server/phased/schemas.ts` (estender brief schema com 5 campos opcionais)
- `src/routes/plans.$planId.tsx` (mount cockpit no edit)
- `src/components/wizard/BriefStage.tsx` ou equivalente (mount cockpit no brief)
- `src/i18n/locales/{pt,en}/plan.json` (copy dos 5 controlos + 6 presets + tooltips)
- `mem://index.md` (regra: Intensity Cockpit é a única superfície de modulação; presets + 5 knobs)

### Pergunto-te 1 coisa só

O `conjugate` (Westside) requer marcar dias max-effort/dynamic-effort no Stage 3 prompt — é trabalho não trivial. **Avanço com 3 modos sólidos (linear, undulating, block)** e marco conjugate como "Em breve" no UI? Ou queres que arrisque já o conjugate mesmo que a primeira versão saia tosca?
