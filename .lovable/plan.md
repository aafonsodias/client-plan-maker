# Fix dos 3 mockups do hero rotator

## Bug

`HeroVisualRotator` (src/routes/index.tsx:883–904) tem altura fixa `h-[680px] lg:h-[780px]` e cada slide é `absolute inset-0`. Como os 3 cards têm alturas naturais diferentes:

- CoachWorkbench (variant 0, "Para PTs") — ~520px → grande gap entre última cliente e rodapé `PROTOCOL`
- HeroPlanMockup (variant 1, "História do criador") — ~760px → quase ok mas pode ficar clipado em ecrãs intermédios
- SoloTrainer (variant 2, "Para quem treina sozinho") — ~640px → gap visível abaixo do "Próximo bloco"

→ O anel âmbar fica sempre do mesmo tamanho mas o card lá dentro flutua com vazio em volta. Visual quebrado e inconsistente.

## Fix (1 ficheiro)

`src/routes/index.tsx`, função `HeroVisualRotator`:

1. Remover altura fixa do container.
2. Posicionar o slide **ativo** em fluxo normal (`relative`) — ele dita a altura.
3. Os 2 inativos ficam `absolute inset-0 opacity-0 pointer-events-none` (pré-renderizados para crossfade suave).
4. O wrapper externo passa a `transition-[height] duration-500` para suavizar a mudança quando se rota entre variantes de alturas diferentes (anel âmbar acompanha).

```text
[Container relative]
 ├─ slide[idx]   → relative, opacity-100  (drives height)
 └─ slide[!idx]  → absolute inset-0, opacity-0
```

Sem alterações ao conteúdo dos 3 mocks, à i18n, ou ao anel/glow. Risco mínimo.

## QA

- 1407px (viewport atual): rodar pelos 3 dots, confirmar zero gap em qualquer variante.
- 375px (mobile Safari smoke obrigatório por non-negotiables).
- Confirmar que o crossfade continua suave (700ms) e que o anel âmbar não "salta" feio (a transição de altura suaviza).
