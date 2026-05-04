## Contexto

O feedback (do "outsider") aponta três problemas reais e bem identificados:
1. **Topo carregado** sem hierarquia clara entre "estado", "ação" e "contexto".
2. **Ações ambíguas** (7 botões competindo, nenhum dominante).
3. **Compliance é telemetria, não diagnóstico** — números sem veredicto, "Adherence —" parece bug, sem variação temporal.

Vou avançar com **MVP enxuto** dentro dos 120 créditos, deixando o ProtocolRail como está (já é honesto) e atacando o que dá retorno máximo: hero focado, ação primária contextual, Compliance com veredicto.

## Decisões (as três que pediste para eu tomar)

### 1) Vocabulário canónico — manter PT, eliminar "Stage N" da UI
- **Mantém:** "Avaliação · Briefing · Plano-mestre · Semana-tipo · Progressão" (ProtocolRail + StageCard).
- **Remove:** prefixos "Stage 2/3/4/5" dos títulos visíveis dos StageCards (o número já está no badge à esquerda, dizer "Stage 3 · Plano-mestre" é redundante).
- **Mantém em contexto técnico:** "Bloco N · W1 base" só no header do plano e PipelineStrip, porque aí o treinador *quer* a granularidade. O cliente nunca vê.
- **Porquê:** o feedback chamou três sistemas sobrepostos. Eliminar o mais redundante ("Stage N") sem perder a numeração que ancora o pipeline. PT vence porque é a língua do produto e da maioria dos copy strings já escritos.

### 2) Ação primária — CTA contextual no Hero + 1 secundária visível, resto colapsa
- O `ThisWeekHero` ganha um **botão dominante único** que muda conforme o estado do cliente:
  - Sem avaliação submetida → **"Pedir avaliação"**
  - Avaliação submetida, sem briefing → **"Rever briefing"**
  - Briefing aprovado, sem plano → **"Gerar plano-mestre"**
  - Plano pronto, sem sessões esta semana → **"Abrir treino de hoje"**
  - Tudo em curso → **"Registar sessão"**
- Ao lado fica **uma** ação secundária visível ("Abrir plano" quando faz sentido).
- O resto (Descarregar PDF, Ver como cliente, Docs, Pedir avaliação quando já existe plano, Novo plano manual) colapsa num menu **`⋯ Mais ações`** no header da página.
- **Porquê:** o feedback foi cirúrgico aqui — "obrigas o utilizador a decidir antes de perceber". Um CTA contextual elimina a fadiga de decisão sem esconder funcionalidade (o menu mantém tudo a 1 clique).

### 3) Compliance — fixes críticos de diagnóstico, não reescrita total
Foco nos 3 problemas mais visíveis (cabe em ~30-40 créditos):

a) **"Adherence — No plan baseline"** desaparece. Quando não há baseline, mostra **"Consistência"** com `X sessões nas últimas 4 semanas · alvo Y/sem`. Quando há baseline, mantém Adherence mas com veredicto inline (`67% · abaixo do alvo`).

b) **Δ vs janela anterior** em cada KPI: `5043 kg · +12% vs 30d anteriores`. Sem variação não há insight (citação direta do feedback). Calculado client-side, não custa BD.

c) **Separar bodyweight de tonnage**: o Top exercises mistura agora reps×kg com sets de bodyweight, o que produz comparações enganadoras. Passa a ter duas colunas: "Carga (kg)" e "Volume (sets)" — bodyweight nunca aparece em kg.

d) **Sparkline com tendência**: a linha de média móvel sobreposta às barras das 8 semanas, em vez de barras soltas. Pequeno SVG, sem libs.

**Adiado para próximo round** (são bons mas precisam de design dedicado): tags "consistência baixa/média/alta", interpretação ligada ao objetivo, agrupamento em blocos semânticos. MVP primeiro.

## O que vai mudar (ficheiros)

**`src/routes/clients_.$clientId.tsx`** (a heavy lift)
- Header limpo: avatar + nome + `ClientPhaseHeaderPill` numa linha. Email mais discreto.
- Toolbar: `AssessmentDatePicker` + **CTA primária contextual** (delegada ao Hero) + `⋯ Mais ações` (dropdown). Move PDF, Ver como cliente, Docs, Pedir avaliação, Novo plano manual para dentro do menu.
- Readiness strip mantém-se (já passa por filtro de "tem dados?", está honesto).
- Remove prefixo "Stage N · " dos títulos dos StageCards (continua nos tooltips para SEO interno).

**`src/components/ThisWeekHero.tsx`**
- Aceita prop `primaryAction: { label, onClick, busy?, intent?: 'evaluate' | 'brief' | 'generate' | 'open' | 'log' }`.
- Renderiza CTA grande (h-11, primary) + secundária discreta. Estado calculado no parent, hero só apresenta.
- Visual: card ganha mais peso (border/shadow), torna-se claramente o foco da página.

**`src/components/ComplianceDashboard.tsx`**
- Reescreve `KpiCard` para aceitar `delta?: { pct: number; tone: 'up'|'down'|'flat' }` e `verdict?: string`.
- Calcula janela anterior (mesmo tamanho, deslocada): `inRange` vs `inPriorRange`.
- Substitui "Adherence — No plan baseline" por "Consistência" quando `planned === 0`.
- Top exercises: divide visualmente em "Por carga" (só weighed) e "Por volume" (todos, em sets).
- Sparkline: adiciona linha SVG da média móvel de 3 semanas por cima das barras.

**i18n**
- Novas chaves em `common.json` PT/EN: `detail.actions.more`, `detail.cta.evaluate|brief|generate|open|log`, `compliance.consistency`, `compliance.delta_vs_prior`, `compliance.by_load`, `compliance.by_volume`.
- Remove uso visual de `plan:stage.label.N` com prefixo "Stage" (mantém a chave, só não a usa no título do card).

## Orçamento estimado

- Reorganização do header + dropdown "Mais ações" + remove "Stage N" — ~25 cr
- Hero com CTA contextual + lógica de estado no parent — ~30 cr
- Compliance fixes (Δ, Consistência, separação bodyweight, sparkline com tendência) — ~40 cr
- i18n + smoke 375px + screenshots — ~10 cr
- **Total: ~105 cr**, deixa folga para imprevistos.

## Validação após implementar

1. Mobile Safari 375px: header não overflow, CTA contextual visível sem scroll.
2. Cliente sem plano → CTA = "Pedir avaliação". Cliente com plano em curso → CTA = "Abrir treino de hoje".
3. Compliance no André Periquito mostra Δ% e "Consistência" em vez de "Adherence —".
4. Nenhum botão "Stage 2", "Stage 3" etc. visível na UI do cliente.
5. Backlog `.lovable/backlog.md` atualizado: fechar P0 acima, abrir P1 "Compliance com tags qualitativas + ligação ao objetivo".

## O que **não** vou tocar neste round

- ProtocolRail visual (já é honesto e legível).
- Agrupamento semântico do Compliance em "Consistência / Carga / Distribuição" (precisa de iteração de design).
- Linguagem de objetivo no Compliance ("adequado para fase base") — exige modelo de objetivos por cliente que ainda não temos.
- Reorganização do histórico de planos na metade inferior da página.
