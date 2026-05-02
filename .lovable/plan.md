
## Reescrita da landing — clareza primeiro, profundidade depois

Mantém-se toda a estrutura técnica e os mockups que já funcionam. O que muda é **o que aparece nos primeiros 5 segundos** e a **ordem da narrativa**. Sem mexer em rotas, auth, pricing real ou backend.

### 1. Hero (primeira dobra) — benefício em vez de manifesto

Substituir headline e subheadline atuais por linguagem direta, focada no PT:

- **H1**: "Cria planos de treino prontos a enviar em minutos."
- **Sub**: "Baseados na avaliação real do teu cliente. Ajustam-se semana a semana com o que ele faz no ginásio."
- **CTA primário**: "Gerar primeiro plano grátis" (em vez de "Draft your first plan").
- **CTA secundário**: "Ver como funciona" (âncora para a secção `journey`).
- **Micro-prova abaixo do CTA** (já existe, mantém): *"Conta grátis · 1 cliente · 1 plano completo · sem cartão."*
- **Remover da primeira dobra**: a linha "credibility_caption" com "PAR-Q+, ACSM, Prochaska / Helms, Israetel, Schoenfeld". Move para a secção `credibility` mais abaixo, onde já é o sítio certo.

### 2. Tira jargão de cima — "três benefícios" antes da ciência

Inserir, **logo a seguir ao hero e antes dos mockups**, uma faixa nova com 3 cartões curtos (uma frase cada):

- "Menos tempo a programar" — *"Da avaliação ao PDF em minutos, não em horas."*
- "Planos consistentes entre clientes" — *"A mesma lógica aplicada a cada cliente, ajustada ao caso dele."*
- "Mais confiança no que envias" — *"Vês sempre porque é que cada exercício está ali."*

(Substitui efetivamente a tagline "sem caixa preta" por "percebes sempre porque é que o plano foi criado", como pedido.)

### 3. Reordenar a página

Ordem nova, do mais concreto ao mais técnico:

1. Hero (acima)
2. **3 benefícios** (novo)
3. **Mockups** (já existe — mostrar produto cedo é prova visual)
4. **Como funciona / journey** (5 fases — manter, mas com intro reescrita em PT-claro)
5. **Logbook preview** (manter)
6. **Credibilidade científica** (PAR-Q+, ACSM, Prochaska — agora aqui, não no hero)
7. **Founder** (manter — a história do André é prova humana)
8. **Pricing** (simplificado, ver §5)
9. **FAQ** (manter)
10. **Closing CTA** + footer

### 4. Linguagem orientada a PTs

Auditoria curta dos copy-blocks já existentes para alinhar tom:

- "mesocycle" / "microcycle" → manter só a partir da secção `journey` (público técnico já está engajado nesse ponto).
- Hero, 3-benefícios e mockup captions usam apenas: *plano*, *avaliação*, *cliente*, *semana*, *sessão*, *PDF*.
- Substituir "Clinical assessment, defensible mesocycle" da subheadline atual pela versão simples acima.

### 5. Pricing simplificado e honesto

A secção atual já tem 2 colunas (Beta grátis + Pro €19). Ajustes:

- **Renomear** "Try it — no card" → "Grátis para começar".
- **Linhas claras** no card grátis: *"1 cliente · 1 plano completo · PDF com a tua marca · sem cartão."*
- **Pro** mantém-se como "Em breve · €19/mês (indicativo)" — não inventar features que não existem.
- Remover a linha "Subscribe to Pro to be in the first wave" do roadmap (duplica o pricing).

### 6. Prova concreta

Adicionar duas peças honestas, sem inventar testemunhos:

- **Exemplo real**: já existem dois PDFs no repositório (`André_Periquito…_1_Week_Plan.pdf`, `Test_User_Test_Plan.pdf`). Adicionar na secção logbook/mockups um link discreto **"Ver exemplo de plano (PDF)"** que abre um deles num separador novo. Prova tangível > screenshots.
- **Linha de honestidade beta** já existe na secção `credibility` ("There are bugs. Things still missing…") — manter. Não fabricar testemunhos.

### 7. i18n

Todo o copy novo entra em `src/i18n/locales/{en,pt}/plan.json` sob:

- `landing.hero.*` (override das chaves existentes)
- `landing.benefits.{time,consistency,confidence}.{title,desc}` (novo)
- `landing.credibility.intro` (mover a antiga credibility_caption para aqui)
- `landing.pricing.beta_*` (refraseado)

PT é a referência de tom (mem `voice-pt`); EN segue o mesmo registo direto.

### Ficheiros tocados

- `src/routes/index.tsx` — reordenar secções, novo bloco `Benefits`, link para PDF de exemplo, hero novo.
- `src/i18n/locales/pt/plan.json` e `src/i18n/locales/en/plan.json` — chaves novas + reescritas.
- (Opcional) `public/example-plan.pdf` — copiar um dos PDFs existentes da raiz para `public/` para servir como link.

### Fora de scope

- Sem mexer em auth, pricing real (Stripe), Guide/dock, ou no funil de criação de plano.
- Sem testemunhos fabricados.
- Sem alterar o esquema de cores ou o `BrandMark`.
