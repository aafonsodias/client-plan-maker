## Estado atual

Acabámos de:
- Trocar logo (versão recortada).
- Centrar opticamente o wordmark FORGE no auth (compensação `paddingLeft` para o `tracking`).
- Esconder a scrollbar branca dos rails de Brief em microcycle / progressions / blueprint.
- Polir a página de auth (logo grande + glow + linha accent + language switcher discreto).

Agora atacamos os atritos da landing page **+** dois bugs estruturais que ficaram pendentes.

---

## GOAL
Aumentar conversão e clareza da landing page, e resolver dois bugs reais no fluxo de geração.

## CONTEXT
- Landing: `src/routes/index.tsx`. Hero usa o subtítulo i18n `plan:landing.hero.subtitle` (que **já está bom em PT/EN** — afinal não é tão genérico como pensei; revi-o agora).
- Microcycle: `src/routes/plans.$planId.microcycle.tsx` chama `generateDay` mas o `regenDay` confia 100% no realtime do Supabase para refrescar — em sessões edge isto falha por vezes (= "regenerou mas não vejo nada novo"). Além disso, quando o dia volta, a row tem o **mesmo `id`** mas conteúdo novo → o `useEffect` em `DayCardEditable` que sincroniza com `day` corre, mas o gating `!editing` pode bloquear se o utilizador clicou em qualquer input.
- FAQ + footer não têm links legais (Termos / Privacidade) — bloqueio para B2B sério.

## TASK

### Bloco A — Bugs (alta prioridade)

**A1. Microcycle regen não atualiza UI**
- Em `regenDay()` (e `kickDay1()`), chamar `loadDays()` explicitamente após o `await` resolver, **mesmo com realtime ativo**. Realtime continua a ser fallback.
- Em `DayCardEditable`, mudar a key de identidade: passar `key={`${day.id}-${day.updated_at ?? day.status}`}` no parent, para forçar remount quando o conteúdo muda. Isto evita o problema de o `useEffect` não disparar se `day` reference change for raso.
- Adicionar coluna `updated_at` ao select em `loadDays()` (já existe em `workout_plan_days`).

**A2. "Generate Day N" pode duplicar pedidos se carregado várias vezes**
- Trocar `generatingIdx` por um `Set<number>` para suportar múltiplos paralelos sem perder estado.
- Disable do botão enquanto status === "pending" (não só quando o índice está em geração local).

### Bloco B — Landing page conversão

**B1. Pricing transparente**
- Adicionar uma secção `#pricing` simples entre "Logging / history" e "Features":
  - 1 card "Beta" — Grátis, todas as features, sem cartão.
  - 1 card "Pro (em breve)" — 19€/mês indicativo, lista de features, CTA "Avisar-me".
- Adicionar link "Preço" no nav header.
- i18n keys novas em `plan.json` (PT/EN): `landing.pricing.{eyebrow,title,beta_*,pro_*,cta}`.

**B2. Prova social acima da fold**
- Pequeno badge sob o subtítulo do hero: ícone + "Construído por um PT, para PTs · Beta privado" (i18n).
- Não inventar números. Texto honesto.

**B3. Hierarquia dos CTAs no hero**
- Tornar o secundário ("Como funciona") `variant="ghost"` em vez de `outline`, para o primário ressaltar mais.

**B4. Footer com links legais**
- Adicionar grid de 3 colunas no footer: Brand · Produto (Features, Pricing, How it works) · Legal (Termos, Privacidade, Contacto).
- Criar rotas placeholder `src/routes/terms.tsx` e `src/routes/privacy.tsx` com conteúdo básico (lorem ipsum legal genérico — utilizador depois preenche).
- i18n keys `landing.footer.{links_*,legal_*,product_*}`.

### Bloco C — Polish secundário

**C1. Scroll-anchor offset** — quando se clica "Como funciona", o título fica colado por baixo do header sticky. Adicionar `scroll-mt-20` aos `<section id="...">`.

**C2. Mockup do hero a ocultar em mobile** — o `HeroPlanMockup` usa `FloatCard` que tem `hidden ... md:block`. Fica vazio em mobile. Adicionar versão simplificada visível em mobile (apenas 3 linhas + título), ou colapsar a coluna.

## CONSTRAINTS
- Sem refactors fora dos ficheiros listados.
- Sem alterar lógica do AI (geração de plano).
- Sem novos packages.
- i18n: cada chave nova **tem** de existir em PT e EN.

## ACCEPTANCE
- **A1**: clicar "Regenerate" num dia faz aparecer o conteúdo novo dentro de ≤2s sem refresh manual; reproduzir 3× consecutivas.
- **A2**: clicar 3× rápido em "Generate Day 2" só dispara 1 geração; botão fica disabled durante.
- **B1**: secção "Pricing" visível em scroll, link "Preço" no nav vai lá ter.
- **B2**: badge de prova social visível no hero em PT e EN.
- **B4**: rodapé tem 3 colunas; `/terms` e `/privacy` carregam sem 404.
- **C1**: clicar âncora não esconde título atrás do header.
- **C2**: hero em viewport 375px mostra mockup compacto em vez de coluna vazia.

## ROLLBACK
- A1/A2: reverter `microcycle.tsx` e `DayCardEditable.tsx`.
- B1–B4: remover secção pricing, badge, rotas legais, links do footer.
- C1/C2: remover classes `scroll-mt-*` e o mockup mobile.

---

## Ordem de execução proposta
1. **A1 + A2** primeiro (bug = bloqueador real do utilizador).
2. **B4** (rotas legais) — rápido e desbloqueia confiança.
3. **B1** pricing — maior impacto comercial.
4. **B2 + B3 + C1 + C2** — polish de remate.

Aprovas e avanço, ou queres reorganizar a ordem / cortar algum bloco?
