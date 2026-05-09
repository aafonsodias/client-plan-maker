## O problema

O header do stepper mobile (`/clients/$id` em modo focado, <1024px) ocupa ~88px em três linhas verticais:

```text
━━━━━━━━━━ (barra 1px)
SECÇÃO 1/14 · 36%        ← eyebrow
PAR-Q+              [☰]  ← título + menu
                Guardado · há 4s   ← rodapé
```

Três linhas para 4 informações redundantes (a barra já mostra a %), e a tipografia é Inter bold genérica — não respeita o sistema (Fraunces para títulos de superfície, amber como pontuação).

## A proposta

Colapsar para **2 linhas**, ~52px, com tratamento editorial:

```text
━━━━━━━━━━━━━━━━ (hairline 2px, amber→primary, glow subtil)
[01/14]  PAR-Q+                Guardado · 4s   [☰]
 amber   Fraunces serif        eyebrow muted   36×36
 mono    text-base truncate    (some quando há)
```

Mudanças concretas (em `src/routes/clients_.$clientId.tsx`, linhas ~4206-4272):

1. **Barra de progresso** — 2px (era 1px), gradiente `from-amber-500/60 via-primary to-primary` para dar peso visual à única coisa que é mesmo percentagem. Remove o `36%` textual — é redundante.
2. **Chip do índice** — pequeno pill mono `01/14` (zero-padded), `bg-amber-500/12 text-amber-700/90 ring-amber-500/20`, tabular-nums. Substitui o eyebrow "SECÇÃO 1/14 · 36%". Esta é uma das 2-3 ocorrências amber permitidas na página.
3. **Título da secção** — passa de `text-sm font-bold` (Inter) para `font-display text-base tracking-tight` (Fraunces serif), truncate. Eleva imediatamente o tom — é o título da superfície.
4. **Saved label** — sai do rodapé próprio, vai inline à direita do título como eyebrow muted (`text-[10px] uppercase tracking-wider text-muted-foreground/70`), oculto em telas <360px se não couber. Remove a 3ª linha.
5. **Botão menu** — mantém 36×36 mas `rounded-full` em vez de `rounded-md` para dialogar com o chip pill, e `border-transparent bg-muted/40` em vez de `border-border bg-card` (separação tonal, não com border — princípio 6 do sistema).
6. **Padding** — `px-3 py-2` único, em vez de `px-3 pt-2` + `px-3 pb-2 pt-0.5`.

## Não muda

- Sheet de "jump to section" (igual)
- Comportamento sticky / blur backdrop
- Conteúdo abaixo do header
- A versão desktop / tabs (já tem o seu próprio tratamento)
- Strings i18n (`progress_short` continua a existir; só não é usado neste header — fica disponível para outras superfícies)

## Risco

Baixo. Mudança puramente de apresentação, num único bloco JSX (~70 linhas). Smoke test em 391×844 (Mobile Safari, conforme non-negotiable) antes de fechar.