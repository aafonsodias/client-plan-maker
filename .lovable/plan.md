
# Plano de ataque

Cinco frentes, ordenadas por impacto. Faço tudo num turno.

---

## 1. Crítico: "Adicionar cliente" passa a ser **só convite**

Hoje o dialog em `src/routes/clients.tsx` ainda pede nome+email obrigatório antes de gerar link. Tu queres o oposto: **nome opcional, link primeiro, cliente preenche o resto na intake**.

Mudanças:

- **Novo modo "convite directo"** no dialog `Plus → Adicionar cliente`:
  - Cria-se um `client` placeholder (`full_name = "Convite pendente"`, sem email) e gera-se logo o intake token.
  - Ecrã único com o link grande + botões `Copiar / WhatsApp / Email`. Sem step 2.
  - Se o PT *quiser* pré-preencher nome (porque já sabe), há um campo opcional colapsado "Já sabes o nome dele? (opcional)".
- **Intake (`src/routes/intake.$token.tsx`)** ganha campos no topo:
  - Nome completo (obrigatório — substitui o placeholder)
  - Email (obrigatório — fica como contacto principal)
  - Telemóvel (opcional)
  - Data de nascimento (opcional, já existe)
- Server fn `submitIntake` actualiza `clients.full_name / email / phone / date_of_birth` quando o cliente os submete (hoje só actualiza dados de avaliação).
- Lista de clientes (`/clients`) mostra estes "Convite pendente" com chip cinzento e ordena-os no topo até serem reclamados.
- Migration leve: tornar `clients.full_name` aceitar string vazia/placeholder (já é `text`, sem CHECK — ok). Garantir que `email` continua opcional na BD.

Resultado: criar cliente = 2 cliques + partilhar link. Tudo o resto vem do próprio cliente.

---

## 2. PDF do plano — bugs visíveis + redesign

Bugs vistos nas screenshots que mandaste:

- **Cover (pág 1)**: o sumário em itálico corre para fora da margem direita ("…Onda de intensidade R"). Causa: `splitTextToSize(..., W-M*2).slice(0,2)` corta a 2 linhas e cospe o resto sem reticências, e nalguns casos a primeira "linha" devolvida ainda excede largura por palavras compridas. Fix: aumentar para até 4 linhas, adicionar "…" se truncado, e baixar fontSize de 9.5→9.
- **Header da pág 2**: o running-header sobrepõe-se ("HORIZONTAL AND VERTICAL PULLING WITH ECCENTRIC EMPHASIS, SCAPULAR RETRACTION…") e na pág 3/4 chega a invadir o título. Já há `.slice(0,80)` mas não é wrap; passar a *splitTextToSize* com **1 linha máx** + `fitText` honesto (corta a meio da palavra com "…").
- **Coluna CUE**: textos longos cortados por `fitText` ("10 p…", "30–4…", "Cont…"). Aumentar `colCueW` retirando espaço a slots S1..S4 (de 64→58pt liberta 24pt extra).
- **Slot headers "S1 — peso × reps @RPE"**: às vezes cortam ("S2 — peso × …"). Reduzir para "S1  kg×reps@RPE".
- **REGISTO MANUAL** está sempre em PT mesmo no plano EN. i18nizar todos os labels do PDF (`PLAN AT A GLANCE`, `PREP`, `COOL`, `REGISTO MANUAL`, `OBSERVAÇÕES`, `DATA / INÍCIO / FIM / PESO / SONO / RPE ACORDAR`, headers `#`, `EXERCISE`, `CUE`, `SETS`, `REPS`, `REST`, `RPE`, `TEMPO`) — passar `t` para `renderPlanPdf` e adicionar bloco `pdf.*` em `plan.json` PT/EN.

Redesign / mais utilidade:

- **Página de "Resumo & Volume" nova (entre cover e archetypes)**:
  - **Spider chart** de volume semanal por padrão de movimento (push/pull/squat/hinge/carry/core/cardio) — usa o que já existe em `src/components/volume/MuscleVolumeRadar.tsx` mas renderiza em SVG-to-canvas para o PDF (jsPDF aceita imagens; geramos um canvas off-screen).
  - **Barras** de sets por grupo muscular (primary + 0.5×secondary), com landmarks MEV/MAV em linha tracejada — fonte: `src/lib/volume-compute.ts` + `volume-landmarks.ts`.
  - **Distribuição de RPE** (mini-histograma) e **% sets ≥ RPE 8** como métrica única.
  - **Equipamento usado** como chips, alimentado por `equipment_catalog` agregando `exercises[].equipment`.
- **Cada página de archetype** ganha mini-strip lateral direita (~80pt) com:
  - 3 chips: padrões dominantes da sessão (ex.: "Hinge · Anti-extensão · Pull")
  - Volume da sessão (sets totais) e tempo estimado (sets × (work+rest))
- **Glossário rodapé** na 1ª página: o que é RPE, tempo (formato 3-1-1-0), supersets (bracket lateral), sinal `@6.5 (+0.5rpe)`. Hoje o cliente recebe e não sabe ler.
- **Legenda**: a barra amarela à esquerda dos exercícios (visível nos screenshots) não está documentada — adicionar nota "barra dourada = exercício prioritário do bloco" ou remover se não tiver semântica.

---

## 3. Outros bugs apanhados

- **404 "Page not found"** (screenshot 1): não há `notFoundComponent` no root. Adicionar em `src/routes/__root.tsx` uma página de 404 com brand (BrandMark + link "Voltar ao dashboard"), em vez do plate cinzento default.
- **"How it works · Ciclo contínuo"** (screenshot 2): o eyebrow do bloco journey/how-it-works está concatenado de forma estranha por causa do separador `·` entre eyebrow e título noutro local. Verificar `src/routes/index.tsx` linhas ~210 — o eyebrow ficou colado ao título do bloco seguinte. Limpar o spacing (gap entre `<section>`s).
- **Bug EN não-identificado**: vou fazer `rg` por strings PT hardcoded em componentes (`Adicionar`, `Cliente`, `Plano`, `Avaliação`) e converter para `t()`. Já vi um suspeito em `clients.tsx` ("Novo cliente", "Envia o link a…") que não usa i18n.
- **Link "See an example plan (PDF)"** (screenshot 3): o ficheiro `public/example-plan.pdf` existe e abre — o utilizador disse "essa imagem aparece" referindo-se aos defeitos visuais do PDF, não a um 404. Resolvido pela frente §2.

---

## 4. Logo prompt — martelo numa bigorna com faíscas

A entregar como texto (para colares no Midjourney/Imagen/etc.):

> *Minimalist vector emblem of a heavy blacksmith hammer striking a polished steel anvil at the moment of impact, three or four sharp golden sparks bursting outward in a clean radial pattern, geometric construction with precise straight lines and subtle bevels, monochrome with a single warm-amber accent (#D4A24C) on the sparks and the lower edge of the anvil, flat design with one-pixel stroke weight, generous negative space, centered composition on a deep charcoal background (#0F0F12), inspired by Bauhaus and modern Apple iconography, no gradients, no text, no realistic shading — just confident geometry, suitable as an app icon and a single-color print mark. Aspect ratio 1:1.*

Variante mono (para favicon/print):

> *Same emblem reduced to a single solid colour (#E8E4D8) on transparent background, simplified to two sparks, optimized for legibility at 32×32 px.*

Guardo num `mem://design/brand-mark-prompt` para futuro.

---

## 5. Ordem de execução

1. Migration mínima (verificar `clients.full_name` aceita placeholder; nada a fazer se já aceita).
2. Refactor `src/routes/clients.tsx` → modo "convite directo".
3. `src/routes/intake.$token.tsx` + `src/server/intake.functions.ts` → campos nome/email/telefone na intake.
4. `src/routes/__root.tsx` → 404 com brand.
5. i18n sweep + arranjar landing spacing.
6. `src/lib/pdf.ts` → bug fixes (cover wrap, header truncate, colunas, i18n) + página nova de Volume/Spider + glossário + chips por sessão.
7. Re-gerar `public/example-plan.pdf` correndo o demo + export, para o link da landing mostrar a versão nova.
8. Guardar prompt do logo em memória.

Tudo isto é um turno. Confirmas e avanço?
