# Próximo passo: tornar a app mostrável

A mensagem que partilhaste tem razão num ponto operacional concreto: o que falta agora **não é mais lógica interna**, é reduzir o atrito entre "eu" e "outra pessoa a usar isto no telemóvel dela". Três blocos pequenos, todos orientados a exposição.

## Bloco A — PWA básica (instalável no telemóvel)

Para alguém poder testar a app como se fosse uma app nativa, sem fricção de "abre o browser e cola este link".

- `public/manifest.webmanifest` com nome, ícones (192/512), `display: standalone`, `theme_color` alinhado ao token `--background`, `start_url: /dashboard`.
- Ícones gerados a partir do `BrandMark` existente (PNG 192 + 512 + maskable 512).
- Service worker mínimo (`public/sw.js`) — apenas cache do shell + offline fallback. **Sem** cache agressivo de dados (RLS-sensitive).
- Registo do SW em `src/routes/__root.tsx` só em produção (`import.meta.env.PROD`).
- Meta tags no `<head>` do root: `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`.
- Componente `<InstallPrompt/>` discreto no `AppShell` (rodapé mobile) que aparece quando `beforeinstallprompt` dispara — dispensável depois.

## Bloco B — Share rápido para mostrar a alguém

Para reduzir a fricção do "manda-me lá isso para eu ver".

- Botão "Partilhar app" no `AppShell` (header, ao lado do BrandMark) que usa `navigator.share` (Web Share API) com fallback para copiar link da landing.
- A landing page (`/`) precisa de um CTA explícito acima da fold: **"Experimenta com 1 cliente — grátis"** que leve ao signup. Já existe a quota de 1 plano gratuito; é só amarrar a copy a essa promessa concreta.
- Adicionar `og:image` decente nas rotas públicas (`/`, `/manual`, `/privacy`, `/terms`) usando uma imagem do brand já existente — para o link parecer sério quando colado no WhatsApp.

## Bloco C — Primeiro contacto não embaraçoso

O que uma pessoa nova vê nos primeiros 30 segundos.

- Auditoria rápida do dashboard vazio: se não há clientes, mostrar um card "Começa por adicionar o teu primeiro cliente" com CTA único, em vez do estado vazio atual.
- Garantir que o link do Demo Lab (founder-only) não aparece para outras contas — confirmar gate.
- Verificar que a página `/templates` (acabada de criar) tem estado vazio decente — já tem, mas confirmar copy.
- Verificar no preview que o flow `signup → adicionar cliente → enviar intake → criar plano` funciona ponta-a-ponta sem dead-ends.

## Detalhes técnicos

- PWA: gerar ícones via script Node (sharp não disponível no Worker, mas o build corre em Node — usar `sharp` em `scripts/gen-icons.mjs` chamado manualmente, output commitado em `public/`).
- SW: estratégia `network-first` para HTML, `cache-first` para assets com hash. Offline page = `/offline.html` estática.
- Web Share API: detectar `navigator.share` em runtime, fallback para `navigator.clipboard.writeText` + toast.
- Não tocar em `routeTree.gen.ts`, `client.ts`, `types.ts`, `.env`.

## O que **não** faço neste sprint

- Vídeos de exercício (Sprint 5 original) — adia, é otimização interna.
- Mais tabelas, mais server functions, mais AI.
- Refactors de design.

## Critério de "feito"

No final consigo:
1. Abrir a app no telemóvel, "Adicionar ao ecrã principal", e ela abre standalone.
2. Carregar um botão "Partilhar" e mandar o link a alguém via WhatsApp com preview decente.
3. Essa pessoa cria conta, adiciona um cliente, e gera 1 plano sem eu intervir.

Depois disto, o passo seguinte é o teu — não o meu. É mostrar a alguém.
