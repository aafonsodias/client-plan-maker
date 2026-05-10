## Objetivo

Tornar a estética e o valor pedagógico das secções "completas" do assessment consistentes com o que já existe na secção Risco:
1. **Strip verde rica** (título em Fraunces + frase explicativa) em todas as secções que façam sentido.
2. **Painel "Implicações para a prescrição"** (deterministic rules, sem AI) nas secções de alto sinal programático.

PT primeiro; EN herda PT como fallback até round seguinte.

## Escopo (decidido por mim)

### Strip rica — onde aplicar
| Secção | Já tem strip? | Acção |
|---|---|---|
| PAR-Q+ | sim (simples) | + descrição |
| Risco | feito | — |
| Setup de treino | sim (simples) | + descrição |
| Objetivo SMART | sim (simples) | + descrição |
| Antropometria | não | + strip rica nova |
| Readiness | não | + strip rica nova |
| Estilo de vida | não | + strip rica nova |
| Nutrição | não | + strip rica nova |
| Screen movimento | não | + strip rica nova |
| Performance | não | + strip rica nova |
| Histórico, Meds, Mobilidade, Postura | não | **deixar como está** — secções descritivas/opcionais; strip seria ruído |

### Implicações para a prescrição — onde aplicar
9 secções (incluindo Risco, já feita):

- **PAR-Q+** — clearance gate, contraindicações específicas por bandeira
- **Setup de treino** — frequência prescrita, dias preferidos, equipamento → restrições de selecção
- **Objetivo SMART** — driver primário (hipertrofia/força/perda gordura/saúde) → preset de programação sugerido
- **Antropometria** — WHR + IMC → carga axial, cardio low-impact, alvos de composição
- **Readiness** — sono, stress, dor → autoreg strictness recomendada, deload frequency
- **Estilo de vida** — álcool, tabaco, sedentarismo ocupacional → recuperação esperada
- **Nutrição** — proteína g/kg, hidratação, refeições/dia → energy availability flag
- **Screen movimento** — padrões com score baixo → exercícios remediais antes de progredir
- **Performance** — capacidade aeróbia/força → tier de programação (advanced/conservative/remedial)

**Saltar**: Histórico (narrativa), Meds (já é flag-driven, RxImplications de Risco já consome), Mobilidade (descritiva), Postura (descritiva).

## Implementação

### 1. Componente único `RxImplications` generalizado
Hoje só faz Risco. Refactor:
```ts
function RxImplications({ sectionId, assessment, riskCategory }: Props)
```
Internamente, switch por `sectionId` para construir as `Item[]` deterministicamente. Mantém o mesmo wrap visual (header eyebrow + grid de cartões tonais) e a mesma palette TONE (danger/warn/info/neutral).

Cada secção tem a sua função pura `buildItems_<section>(assessment) → Item[]`. Isolada, testável, sem AI.

### 2. Strip rica
`CompletionStrip` já aceita `description`. Para as secções novas adiciono o footer no `SectionBlock`. As 6 secções sem strip ganham:
- Antropometria → "IMC X (categoria) · WHR Y" + meaning
- Readiness → "Recuperação: <perfil>" + meaning
- Estilo de vida → "<n> factores de estilo notáveis" + meaning
- Nutrição → "Proteína Xg/kg · <ingestão hídrica>" + meaning
- Screen → "<padrões cleared>/6" + meaning
- Performance → "Tier: <advanced/conservative/remedial>" + meaning

### 3. i18n
Tudo via `t()` em `risk_block.complete_meaning_*`-style keys, dentro do bloco respectivo (`anthro_block.complete`, `anthro_block.complete_meaning`, etc.). PT escrito; EN cai no PT por enquanto (i18next fallback) e marcamos com `// TODO: EN translation` no JSON EN.

### 4. Voz
Toda a copy em "você" formal (memo PT voice), sem exclamações, factual. Tom = manual de instrumento, não marketing.

## Riscos & decisões

- **Ruído visual em secções pouco preenchidas**: cada `buildItems_*` tem fallback "Sem condicionantes adicionais — passar à frente" só quando a secção está completa mas neutra. Não acumula 0-item panels.
- **Volume de texto**: ~50-70 strings PT novas. Aceitável para 1 round, sem dependências externas.
- **Mobile (375px)**: cartões mantêm `grid-cols-1 sm:grid-cols-2` como já é.
- **Refactor risco**: `RxImplications` actual passa de 7 regras hard-coded a switch — mantenho 100% das 7 regras existentes na branch `case "risk"` para zero regressão.

## Entregável

- 1 componente `RxImplications` refactorizado + 8 funções `buildItems_*`
- 6 novos footers `<CompletionStrip text=… description=…>` em SectionBlocks
- 3 descriptions adicionadas a strips existentes (parq, training, goal)
- ~60 chaves PT em `assessment.json`
- EN: chaves vazias com `// TODO` ou simplesmente omitidas (fallback PT)
- Smoke 375px na rota `/clients/$id` percorrendo as 9 secções alvo