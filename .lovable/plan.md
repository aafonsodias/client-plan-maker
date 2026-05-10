
## Objetivo

Transformar o assessment de "14 secções a preencher" para uma visão articulada: **o assessment é o sistema nervoso sensorial do organismo**. Captura sinais → alimenta o pré-stage → decide tudo o que é técnico → entrega um cockpit ao PT. Fechar 3 decisões de princípio que estão a bloquear rounds futuros.

Zero código. Apenas dois ficheiros tocados.

---

## Ficheiros

1. **`.lovable/vision/assessment-organism.md`** — novo. Documento dedicado, ~400-500 linhas. Vive ao lado de `protocol-organism.md` como "zoom-in" da camada sensorial.
2. **`.lovable/vision/protocol-organism.md`** — append na secção "Decisions closed" das 3 decisões fechadas + ponteiro para o novo doc.

---

## Estrutura de `assessment-organism.md`

### 1. Metáfora — o assessment como sistema sensorial
- Cada secção = um órgão sensorial (PARQ = nocicepção; antropometria = propriocepção; mobilidade = goniómetro interno; etc.)
- Output não é "formulário preenchido". Output é **um vetor de sinais clínicos** que alimenta decisões técnicas.
- Inversão: o cliente não decide variáveis de programação. Os sinais decidem. O cliente fornece **contexto e preferências pessoais** apenas.

### 2. Princípios fundadores (10)
Codificados, com rationale curto e exemplo:
1. **Page-per-topic** — uma preocupação por slide. Cognitive load baixo, conclusão alta.
2. **Decisões clínicas auto, decisões pessoais manuais** (Princípio 12 já existente, expandido com mapa).
3. **Implicações per-section, colapsadas, vivas** — sinal local → análise local → consequência local.
4. **Skip-with-warning, never block** — completude é gradiente, não binário.
5. **Educar antes de pedir** — cada input não-óbvio precede-se de bite-sized education.
6. **Drawings > words quando possível** — instrução visual, especialmente em mobilidade/postura/screen.
7. **Submax + regression > 1RM** — nunca pedir o que o cliente provavelmente não sabe.
8. **Equipment-agnostic naming** — "dinamómetro" não "Jamar".
9. **Profile-aware defaults** — cada campo pré-preenchido com a melhor inferência possível, override loga.
10. **PDF de síntese para o cliente** — "livro de bons costumes" personalizado é o presente final do assessment.

### 3. Arquitectura alvo (3 camadas)
```text
┌─────────────────────────────────────────┐
│  CAMADA 1 — Captura (sliders, mobile)   │
│  N páginas pequenas, swipe-friendly     │
│  Cada página: 1 conceito + drawing      │
│  Save parcial em cada blur/change       │
└──────────────────┬──────────────────────┘
                   │ debounced upsert
┌──────────────────▼──────────────────────┐
│  CAMADA 2 — Análise per-section         │
│  Ao terminar uma página: micro-prestage │
│  Escreve em assessment_implications     │
│  Exibe colapsado no fim da página       │
└──────────────────┬──────────────────────┘
                   │ aggregate
┌──────────────────▼──────────────────────┐
│  CAMADA 3 — Síntese + cockpit          │
│  PDF para o cliente (livro)             │
│  Cockpit desktop para o PT              │
│  Plano gerado já com defaults técnicos  │
└─────────────────────────────────────────┘
```
Contraste explícito com a arquitectura actual (pré-stage no fim, pesado, lento, cego ao input parcial).

### 4. Mapa Sinal → Decisão técnica (tabela)
A peça mais valiosa do doc. Para cada sinal capturado, qual variável técnica decide automaticamente:

| Sinal | Origem (secção) | Decisão técnica |
|---|---|---|
| `years_training` (faixa) + recent pattern | §3 Training setup | `experience_level`, `volume_tolerance` |
| `days_per_week` × `session_duration` | §3 | `weekly_volume_budget`, `split_archetype` |
| `injuries[]` + `mobility_limitations[]` | §3, §11 | `exercise_blacklist`, `regression_required` |
| `equipment[]` | §3 | `exercise_pool` |
| `goal_category` | §5 | `wave_model`, `intensity_volume_tradeoff` (Cockpit preset) |
| `target_window_weeks` | §5 | `mesocycle_count`, `deload_frequency` |
| `red_flags[]` (PARQ + risk + meds) | §1, §2, §6 | `intensity_ceiling`, `medical_clearance_required` |
| `WHR + composition` | §7 | `goal_recomp_priority` |
| `prochaska_stage` | §8 | `coaching_tone`, `adherence_safety_buffer` |
| `sleep_hours + stress` | §9 | `autoreg_strictness`, `recovery_buffer` |
| `hydration_target` | §10 | educational PDF + reminder cadence |
| `mobility_ratings[]` | §11 | warm-up block selection |
| `posture_findings[]` | §12 | corrective block, single-side bias |
| `movement_screen[]` | §13 | regression/progression per pattern |
| `RHR + VO2max + BP` | §14 | cardio prescription FITT, intensity ceiling |

Decisões **pessoais manuais** isoladas: nome do objetivo, preferências de estilo (circuitos/pares/etc.), apelidos, foto, nota livre. Tudo o resto = auto, com override visível.

### 5. Modelo de dados — direcção (não migration)
Esboço do que **vai** ser preciso (não criar agora):
- `assessment_section_state` (client_id, section_key, status, last_saved_at, completion_pct)
- `assessment_implications` (client_id, section_key, body jsonb, generated_at) — substitui o monólito atual
- `assessment_signals` (client_id, key, value jsonb, confidence) — vetor canónico que alimenta pré-stage
- `client_belt` enum (white/blue/purple/coral/red) — derivado de `years_training`, sem referência a jiu-jitsu
- `client_education_artifacts` (PDF livro)

### 6. Roadmap revisto — 5 rounds
Re-articula os Rounds E–I do walkthrough com o vocabulário do organismo. Não muda o conteúdo, dá contexto narrativo. Cada round = um sistema do organismo a amadurecer.

### 7. Anti-padrões (o que **nunca** fazer)
- Pré-stage só no fim → mata responsividade
- "Análise" duplicada → escolher 1 nome (Implicações)
- AI a escolher objetivo principal sem rationale visível → quebra confiança
- Pedir 1RM directo → ruído > sinal
- Drawings com features sexuadas / infantis
- Faixas com referência explícita a jiu-jitsu em qualquer string ou commit
- Bloquear "Concluir" → assessment é gradiente

### 8. Decisões fechadas neste round (3)

**D1 — AI no goal selector**: relaxar o veto. AI **sugere** com rationale visível e fonte de dados; o cliente/PT confirma ou escolhe outro. AI nunca seleciona em silêncio. Implementação aceita em Round G, não antes. Resolve §5.7 vs Round C.

**D2 — Scope de "decisões clínicas auto"**: reduzido para MVP. Auto = `experience_level`, `weekly_volume_budget`, `split_archetype`, `wave_model preset`, `deload_frequency`, `intensity_ceiling`, `exercise_blacklist`, `regression_required`. Tudo o resto fica manual com sugestão. Permite Round G entregar valor sem reescrever metade do código.

**D3 — Drawings (CC3/CC6)**: SVG inline mantidos no repo, gerados por LLM com prompts canónicos guardados em `.lovable/vision/drawing-prompts.md` (a criar em Round F). Sem comissionar artista até validação com 10 PTs reais. Estética: line art, `currentColor`, sem features sexuadas, sem cor primária, theme-adaptive.

---

## Edits a `protocol-organism.md`

Apenas 2 inserts pequenos:
1. Em **AI boundaries** — adicionar 1 bullet: "AI no goal selector = sugestão com rationale visível, nunca selecção silenciosa (D1, ver assessment-organism)."
2. Nova subsecção curta no fim de §4: **"Assessment-organism (zoom-in)"** com 3 linhas de pitch + link para o novo doc.

Sem mexer em mais nada.

---

## Critérios de pronto

1. `assessment-organism.md` criado com as 8 secções acima
2. Tabela Sinal→Decisão preenchida (≥15 linhas)
3. 3 decisões fechadas com rationale ≥3 linhas cada
4. Anti-padrões listados (≥6)
5. `protocol-organism.md` recebe os 2 inserts e nada mais
6. Zero código, zero migration, zero i18n

## Out of scope

- Implementar qualquer um dos rounds E-I
- Escrever os prompts dos drawings (Round F)
- Migrations para `assessment_signals`/`assessment_section_state`
- Mexer em qualquer ficheiro fora `.lovable/vision/`

Estimativa: ~3-5 créditos.
