
## Objetivo

A página `/clients/:id` atual empilha 8 blocos verticais (header → assessment strip → "Esta semana" → "Around the workout" → Plano → Compliance → Sessões/sem → Top exercícios). Tudo grita ao mesmo tempo, nada conduz a olhar. Vamos reorganizá-la em **3 zonas calmas** mantendo todos os componentes existentes — só mudamos a hierarquia, densidade e visibilidade por defeito. Zero mudanças no schema. Zero refactor de lógica. Estimativa: **~12 créditos**.

## Princípios

- **Looks → função → ease.** Mantém os tokens do design system (sem cores hard-coded).
- Não inventa botões nem features. Só rearruma e colapsa.
- Mobile e desktop partilham a mesma estrutura — desktop ganha um split 2-col só na zona Acervo.
- "Não perder valor" = todos os componentes continuam acessíveis em ≤1 clique.

## A nova anatomia

```text
┌────────────────────────────────────────────────────────────┐
│ 1. HERO (sticky, ~120px)                                   │
│    Avatar · Nome · Active/Block · 3 KPIs (Adesão · Sessões │
│    · Carga 30d) · [Mais ações ▾] [Abrir plano →]           │
├────────────────────────────────────────────────────────────┤
│ 2. FOCO (o que fazer agora) — 1 card grande                │
│    Stage chip · "Esta semana" plano + grande CTA único     │
│    "Around the workout" recolhido em <details>             │
├────────────────────────────────────────────────────────────┤
│ 3. ACERVO (2 col em ≥lg, stack em mobile)                  │
│    ├─ Esquerda: Plano list + Protocolo stepper compacto    │
│    └─ Direita: Compliance compacto (toggle 30/90/all)      │
│       + sparkline única "Sessões/sem"                      │
│       + "Ver mais stats →" abre drawer com Top exercícios  │
└────────────────────────────────────────────────────────────┘
```

### O que muda em concreto

**Hero (substitui o atual header + assessment strip):**
- Linha 1: avatar 48px, nome, badge "Active · Block N", chip "Stage 5 — pronto" ou "Stage 2 — Brief 60%".
- Linha 2: 3 KPI inline (texto, sem cards) — `100% adesão · 1 sessão · 5043kg/30d`.
- Botões: `[Mais ações ▾]` (agrupa Agendar, Reanchor, Docs, Reassess) + `[Abrir plano]` primary.
- O barómetro "Stage 1 — Assessment 88% completo" passa para 1 chip clicável que faz scroll até à AssessmentSection (sem mudar o componente).

**Foco:**
- Mantém `ThisWeekHero` mas **remove** a faixa "BIG MAIN" gigante a meio (atualmente vazia) — fica embebida no card.
- "Around the workout" passa para `<details>` colapsado por defeito (90% das vezes ninguém abre).

**Acervo:**
- "Plano" e "Protocolo" (5-stage stepper) ficam lado a lado em desktop, num único bloco com tabs `[Planos · Protocolo]`. Em mobile, stack normal.
- Compliance: as 4 stat-cards atuais (`Adesão / Sessões / Séries / Carga`) viram **1 strip horizontal compacta** (texto+número, sem ícones gigantes). O toggle 30/90/all mantém-se.
- "Sessões/semana" mantém o sparkline mas **sem card**, encostado por baixo da strip.
- "Top exercícios" sai da página principal → botão "Ver top exercícios →" abre `<Sheet>` com o componente atual intacto. Liberta ~250px de scroll.

### O que NÃO muda

- Componentes: `AssessmentSection`, `ComplianceDashboard`, `ThisWeekHero`, `NextMealCue`, lista de planos, stepper de stages — todos reusados tal como estão.
- Lógica de save/draft/protocolo: zero mexidas.
- PDF, geração, demo — intactos.

## Trabalho técnico

Tudo concentrado em `src/routes/clients_.$clientId.tsx` dentro de `ClientDetail()`:

1. **Extrair `<ClientHero/>`** local (no mesmo ficheiro, ~80 linhas) que recebe `client`, `assessment`, `compliance30` e renderiza a barra sticky. Usa `bg-card/80 backdrop-blur border-b border-border` e fica `sticky top-0 z-20`.
2. **Agrupar "Mais ações"** num `<DropdownMenu>` (já importado) com os items que hoje são botões soltos.
3. **Mover "Around the workout"** para dentro de um `<details>` nativo estilizado (já há padrão no projeto).
4. **Tabs Planos/Protocolo**: usar `<Tabs>` de `@/components/ui/tabs` (já no design system). Conteúdo é exatamente o que existe hoje, só envolvido.
5. **Compliance compacto**: substituir o grid de 4 cards por uma `<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">` com `<dl>` inline. Componente novo `<ComplianceStrip/>` (~30 linhas) que reusa os mesmos campos calculados que `ComplianceDashboard` já expõe — se não expor, lemos os mesmos contadores aqui (já estão no escopo do componente pai).
6. **Top Exercícios em Sheet**: envolver `<TopExercises/>` (componente que já vive no Compliance) num `<Sheet>` aberto pelo botão "Ver top exercícios". Se está acoplado dentro de `ComplianceDashboard`, passamos uma prop `variant="sheet"` simples.
7. **i18n**: novas strings (`hero.kpi.adherence`, `actions.more`, `acervo.tabs.plans`, etc.) em `pt` e `en` no ficheiro `common.json` da rota. Nada de strings hard-coded.

## Verificação

- Smoke 375px Mobile Safari: hero não tapa o conteúdo (sticky), tabs fazem scroll horizontal se preciso, sheet do Top abre cheio.
- Smoke 1280px desktop: split 2-col na zona Acervo, hero alinha 3 KPIs sem wrap.
- Tour `data-tour="client-overview"` continua a apontar para o hero (atributo migra do header antigo).

## Não faço neste turno

- Redesign do `AssessmentSection` (é outra besta — backlog).
- Mexer no `ThisWeekHero` interno (só removo a faixa vazia).
- Refactor do `ComplianceDashboard` (apenas extraio a strip; o dashboard continua a viver dentro do Sheet "Ver mais stats" se o utilizador o quiser ver na sua forma completa).
