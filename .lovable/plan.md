
# Como vou operar daqui em diante

## Contrato (o que muda no meu lado)

1. **Backlog é sagrado.** Cada conversa nossa termina com `.lovable/backlog.md` actualizado: o que fechou, o que abriu, o que ficou parqueado e porquê. Hoje há rounds (R72) que fechei e nem todos os items aparecem; outros (R70 quick-plan) entram em conflito directo com decisões posteriores. Isso pára.

2. **Confronto com a visão antes de implementar.** Sempre que uma ideia tua bate em algo gravado em `mem/` ou em `.lovable/`, paro e digo-te onde bate, em vez de implementar e deixar o conflito vivo no código. Tu decides se a visão evoluiu ou se a ideia é incompatível.

3. **Sou o admin, não o estagiário.** Se algo me parece errado (vai contra o que decidiste antes, ou enfraquece a tese), aviso antes de mexer. Se algo me parece bom mas tu não pediste, sugiro como nota separada — nunca implemento à boleia. Se duvido, pergunto com 2-4 opções concretas em vez de "o que achas?".

4. **Ideias soltas têm de aterrar.** Toda ideia tua que não vire código nesta sessão entra em `.lovable/backlog.md` com prioridade (P0/P1/P2/P3), área, e — crucial — o que falta decidir antes de poder ir para código. Sem isso, ficam a flutuar como aconteceu até agora (vê o "Open thread — Assessment as bite-sized slider" sem dono e sem fim).

5. **Cada round fecha 1 P0 ou avança 1 P1.** Nunca dois P0 ao mesmo tempo. Princípio antigo, vou voltar a respeitá-lo.

## Estado actual — o que está solto agora

Triagem rápida do backlog + memória, items que estão a sangrar:

### Conflitos por resolver (decisão tua)

- **`/plans/quick` ainda existe.** Ontem decidiste "não fazemos planos rápidos" e gravámos `mem://principles/no-quick-plans.md`. Mas a rota `src/routes/plans.quick.tsx`, os servers `src/server/quick-plan.functions.ts` + `quick-plan.server.ts`, e a chave i18n "Plano rápido" continuam no código. Round 70 (de 5 Mai) criou-os. Há duas saídas: (a) apagar tudo e gravar a morte no backlog; (b) renomear para `/plans/baseline` e mudar copy para "Avaliação baseline ACSM (sem equipamento)" — o caminho continua útil, é o framing que estava errado. **Prefiro (b) — mata o conceito mau, salva a velocidade boa.**

- **"Quick plan" CTA na landing.** Round 70.1 adicionou "Experimente em 5 cliques" no hero da landing para signed-in. Mesma lógica acima — temos de tirar ou refazer o copy.

### Ideias soltas sem dono

- **"Assessment as bite-sized slider"** (proposto 9 Mai, está em `.lovable/backlog.md` linha 461). Tem 6 decisões em aberto antes de poder começar. Vou fechar essas decisões contigo numa sessão dedicada — separada desta — antes de qualquer código.

- **R7x aesthetic touches** (linha 434). Lista de 5 polimentos visuais para 5 surfaces diferentes. Round 72 fechou 4 deles, mas ninguém atualizou o R7x para confirmar que está done. Vou consolidar e fechar a entrada.

- **Round 62 #3/#4/#5** (linha 399): storyboards de vídeos, analytics de funil, revisão nativa ES/HI. Os três estão parqueados sem critério de "quando voltar". Vou re-priorizar com chip de gatilho ("quando tivermos N signups", etc.).

### Próximos P0 candidatos (preciso da tua escolha)

1. Resolver `/plans/quick` (ver acima) — 1 round pequeno.
2. Round B/C do redesign aesthetic — começou em `/clients/$id`, falta replicar nas outras surfaces canónicas (`/dashboard`, `/plans/$id`, `/me`).
3. Slider de assessment — fecha decisões primeiro, depois 2-3 rounds de implementação.

## Decisões que preciso de ti agora

Vou fazer-te perguntas concretas (com `ask_questions`) num próximo turno em vez de aqui — para a resposta ser estruturada e ficar registada. As três que estão à frente:

1. `/plans/quick`: apagar, renomear para "baseline ACSM", ou manter para Demo Lab interno?
2. Próximo round (B/C aesthetic vs slider de assessment vs limpar quick-plan)?
3. Quem é o critério de "done" do round? (Eu? Tu confirmas em preview? Smoke test em mobile 375px primeiro?)

## O que **não** vou fazer

- Implementar features que não passam por `looks → function → ease`.
- Aceitar "faz isto" sem perguntar se bate com a visão quando há suspeita.
- Deixar items abertos em `.lovable/backlog.md` sem dono ou sem critério de fecho.
- Reintroduzir conceitos que matámos (quick-plan, Crown badge, etc.).

## Próximo passo

Aprova este contrato e respondo com 3 perguntas concretas (`ask_questions`) para fechar as decisões pendentes. Depois entramos no primeiro round real sob esta nova mecânica.
