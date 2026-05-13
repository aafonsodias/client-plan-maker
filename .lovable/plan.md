## Diagnóstico

A landing actual está bonita mas fala em princípios ("Triagem clínica. Protocolo defensável. Adaptação semanal.") sem dizer **o que é** o Protocol nem **o que cada lado recebe**. Falta:

- Uma frase que defina o produto numa linha (PT lê e sabe se serve).
- O que o **PT** ganha em termos concretos (avaliação guiada, plano gerado em ~90s, PDF com a marca dele, portal do cliente, adaptação automática semana a semana).
- O que o **cliente** ganha (página própria com próxima sessão, plano em PDF, histórico, sem app a instalar).

Mantemos o tom editorial-clínico, sem comparações com terceiros (memória `non-adversarial`), sem "vs", sem matriz competitiva.

## Mudança proposta

Manter o design e a estrutura de secções a ecrã cheio. Reescrever copy + **inserir uma secção nova "O que recebe"** entre Princípios e o Ciclo. Total passa de 5 para 6 secções — actualizar numeração `01/06 … 06/06`.

### Secção 1 — Hero (reescrita)

- **eyebrow**: "Para personal trainers" → manter.
- **line1 / line2 / line3** (display, com line3 em âmbar):
  - "Avaliação estruturada."
  - "Plano em 90 segundos."
  - "Adaptação semana a semana."
- **subhead** (frase-definição, nova): "Protocol é o sistema que liga avaliação, plano e execução num só fluxo — para o treinador trabalhar com método, e o cliente saber sempre o próximo passo."
- **body**: "Você conduz a avaliação. O Protocol monta o programa em fases editáveis, gera o PDF com a sua marca e entrega ao cliente uma página própria. Cada série registada informa a semana seguinte."
- **CTA**: "Pedir acesso" → manter.

### Secção 2 — NOVA: "O que recebe"

Layout: duas colunas no desktop (`md:grid-cols-12`, col 2-6 / col 7-11), uma coluna no mobile. Mesma tipografia das outras secções (eyebrow + sub-display + lista de 3-4 bullets compactos `editorial-body`).

- **eyebrow**: "O que recebe"
- **Coluna esquerda — "O treinador"**
  - Avaliação guiada: PAR-Q+, ACSM, antropometria, mapa de 11 capacidades.
  - Plano em fases editáveis: Brief, Blueprint, Microciclo, Progressões — aprova cada uma.
  - PDF com a sua marca, logo e cor — pronto a enviar.
  - Painel de clientes, sessões e blocos sem dispersão entre ferramentas.
- **Coluna direita — "O cliente"**
  - Página própria com a próxima sessão e o plano da semana.
  - Histórico de sessões, sensações e progresso visíveis.
  - Plano em PDF, sempre actualizado, sem app a instalar.
  - Continuidade entre blocos: cada novo programa nasce do anterior.

Indicador inferior: `02 / 06`.

### Secção 3 — Princípios (era 02)

Manter cards 01/02/03 mas afinar copy para descrever **prática**, não slogan:

- 01 "Triagem antes de prescrição." → manter; body: "PAR-Q+ e estratificação ACSM antes de gerar qualquer plano. Vermelhas, amarelas e verdes ficam visíveis no plano."
- 02 "Fases editáveis, não caixa-preta." → body: "Brief, Blueprint, Microciclo, Progressões e Bulkfill. Vê, ajusta e aprova cada fase antes de a próxima começar."
- 03 "Adaptação por regras, não por palpite." → body: "Onda de Bompa, incrementos NSCA por categoria e leitura do logbook real. A IA não decide cargas sozinha."

Indicador: `03 / 06`.

### Secção 4 — Ciclo (era 03)

Manter figura. Headline: "Cada semana é informada pela anterior." → manter. Quote: trocar por algo mais concreto: "Adesão, RPE e carga real do logbook entram como input duro na semana seguinte." Indicador: `04 / 06`.

### Secção 5 — Capacity Map (era 04)

Manter visual. Sub-copy mais direta no `body`:
"O Capacity Map situa o cliente em 11 domínios com normas etárias e de género. Cada avaliação preenche mais do mapa, e o plano segue o que está medido — não o que se assume." Indicador: `05 / 06`.

### Secção 6 — Fecho (era 05)

- Headline: "Um sistema, do primeiro contacto à semana 12."
- Subhead: "Beta privada por convite. Vagas limitadas esta semana."
- CTA: "Pedir acesso".
- Indicador: `06 / 06`.

## Detalhes técnicos

- Ficheiros tocados:
  - `src/i18n/locales/pt/plan.json` → bloco `landing_v2` reescrito + nova chave `value` (PT/cliente).
  - `src/i18n/locales/en/plan.json` → espelho EN (PT-PT é fonte para landing, mas EN tem de bater certo).
  - `src/i18n/locales/es/plan.json` e `hi/plan.json` → traduzir as novas chaves para não cair em fallback EN no meio da página.
  - `src/routes/index.tsx` → adicionar nova `<section>` "O que recebe" depois dos Princípios; renumerar todos os indicadores `0X / 06`.
- Sem tokens novos, sem componentes novos, sem mudanças de design system — só copy + 1 secção a usar grelha já existente.
- Memórias respeitadas: non-adversarial (zero menção a Excel/ChatGPT/apps), one-loud-moment (continua um único acento âmbar por secção), landing PT-only headline mas i18n completa para as outras locales.
- Não toca em qualquer lógica de servidor, auth, ou plano.

## Fora do âmbito

- Não adiciono testimonials, logos ou números (memória: sem fake social proof).
- Não mexo em fontes, paleta, animações ou na figura do loop / radar.
- Não toco no header/footer além do que já existe.
