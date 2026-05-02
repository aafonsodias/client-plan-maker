
# Próximo lote — Forge

Cinco frentes, todas pequenas e honestas. Sem reinventar o que já existe (o tier system, o BrandMark, o demo lab, o block lineage estão feitos).

---

## 1. Caminho manual para tudo o que a IA faz

A IA é só atalho. O caminho manual tem de existir e ser visível. O que falta hoje:

- **Concluir bloco e iniciar Bloco N+1 (manual).** Hoje só existe `archivePlanAndStartNextBlock` (IA). Adicionar `archivePlanAndStartManualNextBlock` que:
  - calcula o mesmo `block_transition_summary` (adesão + RPE drift) — reaproveita a lógica;
  - arquiva o plano anterior;
  - cria um `workout_plans` em branco com `block_number+1`, `prior_plan_id`, `generation_status='manual'`;
  - redireciona para `/plans/$id/blueprint` em modo edição manual.
- **Botão no header do plano** já tem "Concluir e iniciar Bloco N+1 (IA)". Passa a ser dropdown com duas opções: *com IA (rápido)* | *manualmente (tens controlo total)*. A opção manual está sempre visível, a IA só em demo plans.
- **Resumo de transição editável.** O `block_transition_summary` (gerado pela IA ou pelas métricas) abre num textarea antes de criar o próximo bloco — o treinador edita, valida, confirma. Princípio: a IA propõe, o humano assina.
- **Manual.json (pt-PT)** ganha uma secção nova "Evolução entre blocos" a explicar o caminho manual passo-a-passo.

## 2. Bancada — o sítio divertido + útil

Uma página `/bancada` (em inglês `/workshop`), dentro da app, acessível pelo AppShell. Dois painéis lado a lado:

```text
┌──────────────────────────┬──────────────────────────┐
│   Pesa-papéis            │   Quadro de estudos      │
│   (calculadora rápida)   │   (PubMed + news feed)   │
│                          │                          │
│ 1RM Epley/Brzycki/Lombardi│ Top 10 estudos recentes  │
│ Carga × reps → estimativa │ em força/hipertrofia     │
│ Plate math (barra + anilhas)│ + posts de news (RSS)  │
│ Tempo de descanso ↔ %1RM   │ Filtros: força, hipert.,│
│ Conversor lb↔kg            │ recuperação, lesão       │
└──────────────────────────┴──────────────────────────┘
```

- **Pesa-papéis (fun):** componente client-only, zero backend. Inputs: peso e reps → estimativa de 1RM por três fórmulas com a média destacada. Slider de % do 1RM → carga + plate math (mostra que anilhas pôr de cada lado de uma barra de 20 kg). Tudo em SI, com toggle lb/kg local. Visual: amber under-glow nos resultados, tipografia mono nas cargas.
- **Quadro de estudos (útil):** server function `getStudiesFeed` que chama [PubMed E-utilities](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/) (sem chave, gratuito) com queries pré-definidas (`"resistance training"[MeSH] AND "2025"[dp]`, idem para "hypertrophy", "rehabilitation"). Cache em memória 6 h. Mostra título, autores, journal, link DOI. Filtros locais por tag. Sem login externo.
- **Princípio:** a página carrega instantaneamente mesmo sem feed (o pesa-papéis é client). O feed faz fetch progressivo.
- **Localização:** "Bancada" no AppShell com ícone Hammer, entre Dashboard e Manual.

Esta é a "place that is both fun and serious and useful" — o pesa-papéis é viciante (mexer no slider e ver as anilhas a aparecerem) e o quadro é honesto (literatura real, não conteúdo gerado).

## 3. pt-PT: tu → você (varrer i18n)

O `intake.json`, `review.json`, `common.json`, `manual.json` usam "tu/teu/tua" — formal pt-PT prefere "você/seu/sua" ou impessoal. Sweep:

- "o teu treinador" → "o seu treinador"
- "cria a tua conta" → "crie a sua conta" (imperativo formal)
- "podes" → "pode"
- "guardamos o teu progresso" → "guardamos o seu progresso"

Critério: **toda a comunicação dirigida ao utilizador final (cliente do PT) e ao PT** passa a "você"/imperativo formal. Tooltips internos e debug podem ficar informais. Adicionar à memory como regra (`mem://design/voice-pt`).

## 4. Landing — gráfico + funcional

Não recomeçar. Polir três pontos:

- **Hero mockup:** o cartão à direita (ver imagem 2 que mandou) ganha micro-animação amber: a coluna Δ "+4 kg / +5 kg" pulsa subtil 1×/8 s, dando sinal de vida sem distrair.
- **Secção nova "Bancada"** entre features e pricing: card pequeno com screenshot do pesa-papéis + estudos. CTA "Experimenta agora — não precisa de conta" se for para anónimos lerem o pesa-papéis (decisão: sim, é uma porta de entrada honesta).
- **Gráfico evolução (imagem 1 que mandou)** já existe como conceito "EM BREVE". Promovê-lo: quando o treinador tem ≥3 semanas logged num exercício, a chip "EM BREVE" cai e o gráfico fica vivo. Implementar a lógica de hidratação real (já há `workout_sessions.entries`).
- **OG/twitter image** dedicada por rota (já está parcialmente — confirmar e completar).

## 5. Naming — Forge / símbolo

Não vou trocar nada sem o seu sinal verde. Mas registo aqui as opções para discussão (ficam num doc interno `docs/naming.md`, não muda nada no código):

- **Forge** (atual). A favor: bonito, físico, ressoa com "moldar pela repetição". Contra: nome saturado em SaaS.
- **Bigorna / Anvil.** A bigorna é o que recebe — o cliente. O treinador é o ferreiro. Símbolo: silhueta de bigorna estilizada. Mais original.
- **Forja.** Versão pt da mesma metáfora. Mantém o símbolo.
- **Compasso.** Outro registo: rigor + medida em vez de força + repetição. Mais clínico.

Símbolo atual (logo carregada) tem o amber under-glow. Proposta: manter logo, mas **adicionar uma versão monocromática** (silhueta amber sólida) para favicons e PDFs, garantindo legibilidade pequena. Isto é útil independentemente do nome.

---

## Detalhes técnicos

**Ficheiros novos:**
- `src/routes/bancada.tsx` — página com dois painéis.
- `src/components/OneRepMaxCalculator.tsx` — pesa-papéis client-only.
- `src/components/PlateMath.tsx` — visualização das anilhas.
- `src/components/StudiesFeed.tsx` — quadro de estudos (consome server fn).
- `src/server/studies.functions.ts` — `getStudiesFeed({ topic })` via PubMed E-utilities, cache 6 h.
- `src/server/blocks-manual.functions.ts` — `archivePlanAndStartManualNextBlock` (sem IA).
- `src/components/BlockTransitionDialog.tsx` — diálogo com summary editável + dois botões (manual / IA).
- `mem://design/voice-pt.md` — regra do "você".
- `docs/naming.md` — discussão de naming, sem efeito no build.

**Ficheiros editados:**
- `src/routes/plans.$planId.tsx` — substitui o botão único de Bloco N+1 pelo dialog.
- `src/components/AppShell.tsx` — adiciona link "Bancada" no nav.
- `src/i18n/locales/pt/{common,intake,review,manual}.json` — sweep tu→você.
- `src/i18n/locales/pt/manual.json` — secção "Evolução entre blocos".
- `src/routes/index.tsx` — secção Bancada na landing + micro-animação amber + ativar gráfico real.
- `src/server/blocks.functions.ts` — extrair `computeTransitionSummary` (puro) para reaproveitar entre IA e manual.

**Sem migrações de base de dados.** Tudo cabe em colunas existentes (`workout_plans.generation_status` aceita 'manual', `block_transition_summary` é texto livre).

**Acceptance:**
1. Header de qualquer plano com >1 sessão logged mostra "Concluir bloco" → abre dialog → escolha entre manual e IA → cria Bloco N+1 corretamente em ambos os caminhos.
2. `/bancada` carrega em <200 ms (pesa-papéis instantâneo). Estudos hidratam em <3 s, com 5+ entradas reais.
3. `intake` e `auth` já não têm "tu/teu/tua" — só "você/seu/sua" ou impessoal.
4. Landing mostra a secção Bancada e o gráfico de evolução tem dados reais quando há logs.
5. Memory atualizada com a regra de voz pt-PT.

---

Aprovo e começo, ou queres que ajuste alguma frente antes (ex.: trocar PubMed por outra fonte, ou cortar a Bancada para outro turno)?
