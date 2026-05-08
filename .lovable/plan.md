## Objetivo

O assessment tem 14 secções e mistura linguagem clínica (DCV, IMC, MVPA, FMS, RHR) com inputs vagos (números 1-10 sem âncoras, campos livres). Quero que qualquer pessoa (leigo ou cliente) consiga responder rápido e bem, **sem o PT perder rigor científico**. A regra é: pergunta simples no ecrã, instrumento validado por baixo.

## Princípios (aplicados a todas as secções)

1. **Cada input usa um de 3 padrões** — escolhido pela natureza da pergunta:
   - **Chips** (2-5 opções, linguagem do dia-a-dia) → para classificações categóricas (frequência, intensidade qualitativa, hábitos).
   - **Slider 1-10 com label dinâmica** → para escalas onde a precisão importa. Por baixo do slider mostra: `7/10 · "Acordo cansado quase todos os dias"`. As âncoras são copy editorial, não números nus.
   - **Campo numérico só com unidades + auto-derivação** → para medições objectivas (altura, peso, FC). Sempre com placeholder de exemplo.
2. **Ajuda em popover, não em tooltip** — substitui o `(?)` Tooltip atual por um botão "Como medir?" / "Porque pergunto isto?" que abre um popover com texto + imagem (quando aplicável). O popover fecha sozinho ao começar a preencher.
3. **Linguagem na 3ª pessoa neutra (PT-PT, "você"-friendly)** — nada de "DCV", "MVPA", "RHR" no label visível. Esses termos vão para o popover de ajuda + tooltip de provenance que o PT vê depois.
4. **Auto-deriva o que conseguires** — se a resposta a uma pergunta leiga já chega para preencher um campo técnico, preenche-o e mostra o resultado como chip ("Classificado como sedentário · ACSM <150 min/sem"). Igual ao padrão IMC actual.
5. **Zero dados perdidos** — mantemos as colunas em `assessment` exactamente como estão. Só muda a camada de input + um eventual campo `extended` para guardar o input bruto leigo (ex: "Pouco" em vez de só `mvpa_min_per_week=60`) para auditoria.

## Componentes partilhados a criar

- `<HelpPopover title icon imageSrc>` — substitui `LabelWithHelp`. Trigger discreto ao lado do label. Conteúdo em markdown leve + slot opcional para imagem.
- `<AnchoredSlider min max value anchors[] onChange>` — slider com 2-4 âncoras editoriais. A label dinâmica por baixo é a âncora interpolada do valor actual. Substitui todos os `Field type="number"` que pedem 1-10.
- `<ChipGroup options[] value onChange>` — substitui as várias implementações inline de botões selecionáveis (MVPA, prontidão, postura).
- `<MeasureField label value unit imageSrc helpBody>` — input numérico + popover "Como medir?" com imagem. Para cintura, anca, altura, peso, %MG.
- `<YesNoCard question rationale value onChange>` — alarga o YesNo do PARQ para todas as secções com sim/não, com slot inline para o rationale.

Tudo em `src/components/assessment/`. O ficheiro `clients_.$clientId.tsx` passa a importar e ficar legível.

## Imagens (anthro)

Geradas com `imagegen--generate_image` em estilo line-art monocromático (consistente com a marca, sem fotos):
- `assets/measure-waist.png` — silhueta com fita métrica no ponto mais estreito acima da anca.
- `assets/measure-hip.png` — fita na maior circunferência das nádegas.
- `assets/measure-height.png` — postura para medir altura (sem sapatos, calcanhares juntos).
- `assets/measure-bf-calipers.png` — pontos de skinfold para o método caliper.

Carregadas via `<img loading="lazy">` dentro do `<HelpPopover>`. Só carregam quando o utilizador clica.

## Instrumentos validados (camada invisível)

Cada secção usa um questionário standard por baixo do interface leigo:

| Secção | Instrumento | Como aparece ao utilizador |
|---|---|---|
| PARQ | PAR-Q+ 2024 (já cá) | 7 sim/não, sem mudanças estruturais — só copy mais directa |
| Risco | ACSM 2022 + IPAQ-SF (atividade) + AUDIT-C (álcool) | Mantém auto-classificação já feita |
| Antropometria | OMS perímetros + Durnin/Womersley para %MG | Inputs com imagens "como medir" |
| Estilo de vida | PSS-4 (stress) + PSQI-1 (sono) | Slider 1-10 com âncoras editoriais |
| Nutrição | Mediterranean Diet Score simplificado + AUDIT-C | Chips de frequência semanal |
| Prontidão | Stages of Change (Prochaska) | Já tem chips, só refinar copy |
| Treino | NSCA experience tiers | Já está, melhorar âncoras do slider "capacidade vs PB" |
| Mobilidade | FMS-lite scoring 1-5 | Substitui número nu por chips com critério ("dor", "compensa", "limpo") |
| Postura/Screen | FMS qualitative | Mantém MovementPatternCard, só refinar copy dos critérios |
| Performance | Cooper/Rockport (já cá) + RHR | Adiciona popover "como medir RHR" |

Nada disto exige nova tabela. Tudo flui para os campos existentes via funções de derivação.

## Plano por secções (ordem proposta)

Faço em **3 rondas**, cada uma com mobile smoke 375px e revisão de copy PT antes de fechar:

**Ronda 1 — Foundations + secções "sempre abertas"**
1. Criar componentes partilhados acima.
2. Gerar imagens das perimetrias.
3. Reescrever **PARQ** (copy mais leiga nas 7 perguntas + popover "porque pergunto"), **Risco** (copy + chips de tabaco/álcool), **Objetivo** (placeholders mais concretos), **Treino** (slider capacidade com âncoras editoriais).

**Ronda 2 — Saúde física**
4. **Antropometria** (MeasureField com imagens em todos os perímetros, auto-cálculo WHR já existe).
5. **Meds** (chips de categorias comuns + texto livre para o resto).
6. **Estilo de vida** (sleep/stress → AnchoredSlider; horas sentado/passos → MeasureField).
7. **Nutrição** (refeições/álcool/processados → chips de frequência semanal; legacy hidden por baixo de "avançado").

**Ronda 3 — Avaliação técnica**
8. **Prontidão** (refinar copy dos 5 estágios).
9. **Mobilidade/Postura** (substituir scores numéricos nus por chips com critério qualitativo).
10. **Screen** (rever copy dos critérios FMS dentro do MovementPatternCard).
11. **Histórico/Performance** (popover "como medir RHR ao acordar", placeholders concretos para max lifts).

## Detalhes técnicos

- Todas as keys i18n vão para `src/i18n/locales/pt/assessment.json` e `en/assessment.json`. Nunca strings hard-coded.
- A camada de derivação (ACSM risk, IMC, WHR, sedentary flag, etc.) **não muda**. Continuamos a popular os mesmos campos da tabela `assessment`.
- `isSectionComplete()` mantém-se — se mudar a forma de capturar mas o campo final continuar igual, a barra de progresso não regride.
- Provenance (`assessment.provenance.*`) continua a marcar quem editou pela última vez (PT vs cliente).
- Sem migrações de schema. Se precisar de guardar a "resposta leiga" para auditoria, vai para o JSON `extended` que já existe.

## Fora de âmbito (desta plano)

- Versão para o cliente preencher (auto-onboarding) — fica para depois, mas estes componentes ficam reutilizáveis.
- Mudar o fluxo de geração do plano com base nas respostas — só estamos a melhorar a captura.
- Refactor do ficheiro `clients_.$clientId.tsx` em rotas separadas — mantemos monolítico por agora; só extraímos componentes.

## Definição de "feito"

- 14 secções respondíveis por alguém sem formação clínica em ≤10 min.
- Zero termos técnicos (DCV, IMC, MVPA, FMS, RHR, etc.) em labels visíveis sem o respectivo popover de tradução.
- Toda a copy revista em PT-PT formal ("você"), passada por mobile 375px.
- Auto-derivações antigas continuam a funcionar (ACSM, WHR, IMC, sedentary, completion).
