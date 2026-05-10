## Reading of your feedback

Tudo o que descreveste já está mapeado em `.lovable/vision/assessment-organism.md` (rounds D-I). O que falta é executar — vou propor uma sequência de 5 rounds que fecham todas as queixas, do crítico ao polish, sem inflar uma única round.

A tese (PDF) fica como referência interna; nada vai ser citado/copiado no produto.

---

## Round E — Coerência nervosa (agora, esta sessão)

Fechar regressões visíveis. Sem migrations, sem novos sliders, sem desenhos. Só "todas as páginas do assessment respeitam o mesmo padrão e não bloqueiam".

1. **`Concluir` desbloqueado sempre.** Mesmo com 14/14 incompleto — guarda parcial, navega para a síntese, regista `completion_pct < 100` no log. O aviso atual ("avaliação parcial · X%") já existe; só precisa de não desactivar o botão.
2. **Fundir "Análise" + "Implicações" em todas as 14 secções.** Nome único: **"Implicações para a prescrição"**. Colapsado por default em todas (não só nas que já o fazem). Hoje §3, §6, §7, §9, §10, §11, §12, §13, §14 ainda mostram blocos antigos paralelos — apaga-os, passa o conteúdo para o `RxImplications` que já existe.
3. **Live refresh da síntese local.** §13 diz "nenhum padrão avaliado" mesmo com dados — bug. Passa a ler o estado actual em vez do snapshot inicial.
4. **Remover "Onde está face ao melhor que já conseguiu?"** (viés subjectivo) de §4.
5. **Renomear §14 "Performance" → "Saúde cardiorrespiratória"**, esconde dinamómetro/Jamar atrás de "Mostrar campos avançados (PT)".
6. **Aestética sweep das páginas mais broken.** §5 (SMART) e §13 (movement screen): aplicar `t-1`/`t-2`/`t-3`, eyebrow nos rótulos, separação tonal em vez de borders, hierarquia clara entre "objectivo seleccionado" vs "catálogo de opções". Sem novos componentes.

Deliverable: assessment completável e visualmente coerente. Sem desenhos novos, sem nova arquitectura.

---

## Round F — Diferenciação sensorial (slider-por-tópico + desenhos)

Cada tópico que pediste como slider próprio passa a sê-lo. Aqui entram os desenhos line-art (`currentColor`, sem características sexuais, sem cintos) gerados in-repo conforme `assessment-organism.md §8.D3`.

| Slider novo / repensado | O que muda | Desenhos |
|---|---|---|
| **Lesões** (mapa do corpo) | corpo neutro rotável, toque numa zona → sugestões de lesões comuns + nota livre + upload opcional de doc médico. Apaga/refaz. | corpo frente/costas/lateral |
| **Limitações de mobilidade** | reaproveita o mapa, foco em ROM | partes individuais |
| **Equipamento** | catálogo visual, multi-selecção rápida | item por item |
| **Preferências de treino** | circuitos / superséries / single / dupla / desafios de reps/tempo | bonecos de cada formato |
| **Hidratação** | separa de nutrição. Cor da urina (subjectivo) + meta calculada (peso/género/actividade) renderizada como N×1.5L garrafas, última parcial | escala de urina + garrafas |
| **Nutrição** | guia de mãos (polegar=gordura / punho=legume / cupped hand=carb / palm=proteína) + alergias com chips de comuns | desenhos de mãos |
| **Postura estática** | passo-a-passo por região (cabeça → tornozelo) + Adam's test com toque no desenho | silhueta lateral + frontal |
| **Movement screen** | um padrão por slide (squat, hinge, push, pull, carry, lunge), desenhos do critério, alternativas para populações especiais (escoliose → variante sem KB swing) | um por padrão |
| **Sono** | horas dormidas em slider 15-min (em vez de 1-10 subjectivo). Educa em 2 linhas. | — |
| **FCR + PA** | wizard de 5 min calmo, palpação radial/carotídea, mostra como pôr a manga | desenhos de palpação + manga |
| **Rockport** | wizard step-by-step (peso, idade, tempo, FC chegada → calcula VO₂max) | — |

Botão **"Saltar com aviso"** universal (ainda não bloqueia — só comunica perda de qualidade).

Tudo o que é slider novo herda o padrão da Round E (1 título único, implicações colapsadas, micro-educação inline).

---

## Round G — Mapa Sinal → Decisão (auto com override)

Onde a app deixa de pedir decisões técnicas ao cliente. Implementa o §4 da vision com o cut MVP do D2:

- **Anos a treinar → faixa** (branca/azul/roxa/coral/vermelha — só cor, ponto pequeno no client card; nunca a palavra "jiu-jitsu" em código, copy, commits ou tradução).
- **Faixa + dados anteriores → dias/semana recomendados** (1-7 chip line). Pré-selecciona Semana 1 baixo, sobe nos micros seguintes; explicação "porquê este número" inline.
- **Duração da sessão → 5 chips** (30/45/60/75/custom).
- **Duração do plano → cartões gamificados** com explicação por horizonte (4/8/12/16/6m/1a). Pré-seleccionado pela AI com rationale; alterável.
- **SMART goal: AI sugere com rationale**, cliente escolhe explicitamente (nunca silencioso). Suporta 2-3 objectivos activos + backlog (tabela `client_goal_backlog`). Cada objectivo editável via chips de variável + manual. Data-alvo recomendada com rationale baseado em literatura.
- **Máximos → submáximos com regressão Epley/Brzycki**. 1RM directo só atrás de toggle "atleta avançado".
- **Estilo de programa anterior → bonecos de splits comuns** (full-body / upper-lower / PPL / bro-split / GVT).

Cada decisão escreve em `assessment_signals` + log de override em `generation_log` (já existe).

---

## Round H — Síntese educacional (PDF "livro de bons costumes")

PDF entregue ao cliente no fim do assessment, gerado server-side, design partilhado com FORGE.

Capítulos profile-aware:
- Síntese clínica (red flags, faixa, objectivo, target).
- Hidratação personalizada (litros/dia, ritmo, hábitos).
- Sono e stress.
- Prato ideal + porções pela mão.
- Postura: 3 awareness cues do que foi observado.
- Mobilidade: 2-3 drills para limitações encontradas.
- Treino: porquê este volume/intensidade nesta fase.
- Disclaimer (não substitui médico).

Server fn `generateClientBook(clientId)` → PDF em `client-documents`. Link do PDF aparece no `/me` e na síntese pós-assessment.

---

## Round I — Cockpit handoff (PT desktop)

Substitui a navegação actual "ir para o cockpit → microcycle". Surface:

- **Centro:** tabela do microciclo (semana 1) e mesociclo (semanas 2-N) lado a lado. Edição in-cell.
- **Cima:** controlos globais — wave model, RPE ceiling, deload, autoreg.
- **Direita:** controlos por sessão e por exercício — sets, reps, RPE, tempo, variant.
- **Baixo:** **paint-bucket** (apanha definições de um exercício, cola noutros), reorder, agrupar em série/superset/circuito.
- **Live recompute** dos números à medida que mexes.
- **Save / Lock & Print** → PDF como commit do bloco; logbook abre com gráficos.
- **Mobile:** cockpit colapsado em accordions verticais — mesmas acções, ergonomia diferente.

Cliente nunca vê esta vista; vai sempre para `/me`.

---

## Out of scope (parqueado, com home explícito)

- App de comida integrada (sugeriste tu próprio que não vale o credit) → P3.
- Cockpit logbook live (gráficos a actualizar em sessão) → Round J.
- Foto de postura (cliente tira, app analisa) → Round F.5 quando houver vision API barata.
- Reassessment cadence (o que expira quando) → Round H.5.
- Lista de "exercícios autorizados" sem mesociclo → fora; mesociclo continua a ser a unidade.
- Fonte de dados externa para doses de medicação → Round G.5 (precisa fonte clínica licenciada).

---

## Sequência prática

Esta é a próxima round (E). Depois pergunto-te se queres F, G, H ou I a seguir — não vou fazer tudo numa sessão. Cada round respeita o non-negotiable: 1 concern, backup antes de SQL, smoke 375px, i18n, generation_log.

## Files prováveis na Round E

- `src/routes/clients_.$clientId.tsx` (concluir desbloqueado, fundir blocos antigos das 9 secções, live refresh §13, remover capacity-vs-pb, rename §14)
- `src/components/assessment/RxImplications.tsx` (já preparado para `summary` + `insight`; só precisa que todas as secções o usem)
- `src/i18n/locales/{pt,en,es,hi}/assessment.json` (rename §14, "Ir para o cockpit", remover string "vs melhor")
- `.lovable/backlog.md` (rounds F-I parqueadas com este detalhe)
- Sem migration nesta round.