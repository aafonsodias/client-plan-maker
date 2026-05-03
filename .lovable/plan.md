## Triagem honesta do documento

A maior parte do que recomendam **já existe** no FORGE (TierChip 🟢🟡🔴, fonts Inter/Inter Tight/JetBrains Mono, AI sem keys, i18n total, generation_log, "você" voice, brief/blueprint/microcycle/progressions). Outras propostas **conflituam** com decisões deliberadas e vou rejeitar com motivo. O resto ou são **conteúdo de marketing** (escreves tu, eu não invento copy/stats) ou **post-MVP estratégico** que devia esperar utilizadores reais.

Codifico tudo em memórias `mem://` para passar a aplicar-se a todas as rondas futuras.

---

## ✅ Aprovo (R27 — pequenas, seguras)

**A. Memórias de princípios e copy**

- `mem://principles/decision-order` — "looks → function → ease. Ugly-but-fast vs beautiful-but-2-days-more → escolhe beautiful."
- `mem://principles/non-negotiables` — "1 fase por commit. Bug ≠ design ≠ feature. Backup `backup_<table>_<YYYYMMDD>` antes de SQL prod. Smoke Mobile Safari 375px. Toda copy via i18n."
- `mem://positioning/sharp` — pitch B2B2C + matriz vs Trainerize/ChatGPT/RP Strength.
- `mem://design/pdf-spec` — confirmar #FAF8F4/#1A1A1A/#D4A574, Inter/Inter Tight/JetBrains Mono, sem itálico em cues, sem all-caps em nomes de exercícios. **Auditar `src/lib/pdf.ts` contra a spec** e corrigir se divergir (PDFs hoje são gerados em jsPDF; provavelmente já cumprem mas não confirmei cada string).
- `mem://design/red-flag-tiers` — invertendo a convenção do documento (que está errada): no FORGE 🟢=advanced (verde=ok), 🟡=conservative, 🔴=remedial (vermelho=restrição máxima). Já é assim no `TierChip` (`success` para advanced, `warn` para os outros). Não inverto para amarelo/verde como pede o doc — semântica de cor importa.

**B. Landing — adições "zero engenharia"** (1 ronda, R28)

- Secção "Anti-ChatGPT" curta: 1 frase + 14 secções de assessment ilustradas com ícones existentes.
- Tabela comparativa **FORGE vs Excel vs ChatGPT vs Trainerize** (5–6 linhas: periodização, MEV/MAV/MRV, contraindicações, PDF marca, voz tu/você, idioma).
- CTA repetido no fim de cada secção principal já existente.
- Expandir FAQ de 4 → 12 (não 15+; >12 fica spam). Citações Israetel/Helms/ACSM nas relevantes, sem inventar quotes.
- "Como funciona" 3 passos — verifico se já existe (id=`how-it-works` no hero); se sim, polir; se não, adicionar.
- **Badges metodologia 🟢🟡🔴 na landing** — reutilizar `TierChip` em modo display (sem override) numa linha "Cada plano nasce com um destes níveis".

---

## ⚠️ Adapto (não como está escrito)

**C. "Como funciona" mental model**  
Doc propõe `ASSESS → GENERATE → REVIEW → DELIVER`. O FORGE já tem **5 estágios** (Intake → Brief → Blueprint → Microcycle → Progressions), e isto está fixado em memória core e na landing. **Mantenho 5 estágios** — colapsar em 4 partiria a metáfora que estrutura o produto inteiro. No máximo, agrupo visualmente como `AVALIA (Intake) → PROGRAMA (Brief+Blueprint+Microcycle+Progressions) → ENTREGA (PDF)` num resumo de 1 linha acima dos 5 cartões.

**D. Stats de tracção e testemunhos**  
Não invento números. Se me deres **1 stat real verificável** (ex: "104 sessões logged em beta"), adiciono. Se me deres **1 testemunho real com nome+foto+permissão**, adiciono. Caso contrário, fica de fora — fake social proof é exactamente o que o "honest craft tool" rejeita.

**E. Hero copy nova ("90 segundos")**  
Não confirmo se geração média é 90s. Se quiseres, instrumento `generation_log` para mostrar **mediana real** num dashboard founder-only, e só depois prometo número na landing.

---

## ❌ Rejeito (com motivo)

**F. "Auto-detect language pt-PT/en-GB no signup"**  
Já fazes isto via i18next browser detector + manual override no AppShell. Pedido = não-feature.

**G. "Primeiro ecrã pós-login: pergunta dark/light"**  
Atrito desnecessário no onboarding. O sistema respeita `prefers-color-scheme` e há toggle no shell. Adicionar um modal de boas-vindas cortaria conversão sem ganho emocional comprovado.

**H. "Adversarial AI agent que ataca o produto"**  
Fora de âmbito de uma ronda. Isto é trabalho de QA/segurança contínuo — temos `supabase--linter`, RLS auditado, REVOKEs já feitos (R17). Posso correr o linter+scan agora se quiseres, mas "criar um agente adversarial" não é um item de backlog discreto, é um processo.

**I. "AI-simulated users portal-to-portal"**  
Já tens DemoOrchestrator + demo_runs reais. Construir um segundo sistema "AI que simula humanos" duplica esforço e contradiz a regra de memória "código deve estar pronto para humanos reais, não fluxos AI". Risk > reward.

**J. "Physical capacity spectrum graph (peer percentile vs população)"**  
Estrategicamente forte mas **post-MVP** e exige dataset normativo validado (grip dead-hang, VO₂max Rockport). Sem o dataset, é vapourware. Adiciono ao backlog como **#40 (P3, post-launch)**, não implemento agora. (Verifica se não podes criar forma do sistema estudar a aprender com os humanos que o utilizam... e não há estudos corte do acsm e tal, há... )

**K. "Pay-as-you-grow per athlete"**  
Conflito directo com memória core: tiers Starter/Pro/Studio com cap clientes==cap planos. Mudar pricing model é decisão de negócio, não de ronda. (Mas achas que faz sentido e é win?)

**L. "Video testimonial após habit formation"**  
Growth tactic, não engenharia. Quando tiveres um beta user disposto, ligamos um Tally/Loom — não preciso construir nada. (Ok, é preciso ter growth tactics)

---

## Ordem de execução


| Ronda           | Conteúdo                                                                                                                                                                            | Risco                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **R27**         | Memórias (`mem://principles/*`, `mem://positioning/*`, `mem://design/pdf-spec`, `mem://design/red-flag-tiers`) + auditar `src/lib/pdf.ts` contra spec PDF (corrigir só se divergir) | Baixo                            |
| **R28**         | Landing: Anti-ChatGPT, tabela comparativa, FAQ 4→12, CTAs repetidos, "Como funciona" se faltar, badges 🟢🟡🔴 reutilizando TierChip                                                 | Médio (toca a rota mais visível) |
| **Backlog #40** | Physical capacity spectrum — só quando tivermos dataset normativo                                                                                                                   | Adiar                            |


Não publico nada. Cada ronda mantém commit verde antes de abrir a próxima.

## Decisões que preciso de ti

1. Aprovas as **rejeições** F–L? (Se discordas de alguma, identifica qual.) Tudo ok acho eu
2. Confirmas a **inversão da convenção de cor** (🟢=advanced, 🔴=remedial — oposto do documento)? Sim
3. Para R28: tens **stat real** ou **testemunho real** para incluir? Senão, secções ficam fora. Podemos criar a estrutura para os receber e eles aparecerem...
4. Avanço com R27 já? Como achares melhor.