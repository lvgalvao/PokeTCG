# Research: Decisões técnicas — Abridor de Boosters Pokémon TCG

**Feature**: 001-pokemon-booster-opener
**Phase**: 0 (Outline & Research)
**Date**: 2026-05-01

A Technical Context do plan.md não tem `NEEDS CLARIFICATION` — este documento registra as **decisões** atrás de cada escolha técnica e as **alternativas rejeitadas**, para que reviewers possam questioná-las sem precisar reconstruir o raciocínio.

---

## R1. Stack web: TypeScript vanilla + Vite + Vitest

- **Decisão**: TypeScript ES2020+ sem framework de UI. Build com Vite 5. Testes com Vitest.
- **Rationale**:
  - O escopo é uma página única com duas seções alternáveis (FR-018a). Não há roteamento complexo, não há estado compartilhado entre múltiplas views, não há SSR.
  - Vanilla TS + helpers DOM mínimos (`src/utils/dom.ts`) cabem em <500 LOC para toda a camada de UI e mantêm o bundle final pequeno (alvo: <50 KB gzip), o que ajuda SC-005 (first paint <3s).
  - Vite oferece dev server rápido com HMR, build estático sem custom config, e integração nativa com Vitest para testes de unidade e estatísticos.
  - Princípio I (Front-End Puro): a saída `dist/` é 100% estática, servível em qualquer CDN.
- **Alternativas consideradas**:
  - **React/Vue/Svelte**: descartado. O custo de framework (runtime + ferramentas + curva) não se paga em um app sem listas reativas complexas, formulários ou estado server-driven. O álbum de 207 slots é renderizado uma vez por filtro — virtual DOM não traz vantagem aqui.
  - **Lit / Web Components**: razoável, mas a granularidade de componentes do app é tão baixa (3 vistas: tabs, booster, álbum) que o ganho de encapsulamento não justifica a dependência.
  - **CDN puro sem build (HTML/CSS/JS direto)**: descartado. Perde-se TypeScript (tipos ajudam a manter a invariante "id é a chave de identidade", Q2 da clarificação) e modules ESM nativos têm pegadinhas de cache em produção.

## R2. RNG seedable: Mulberry32

- **Decisão**: implementar `mulberry32(seed: number): () => number` em `src/core/rng.ts`.
- **Rationale**:
  - A constituição (Princípio III) cita Mulberry32 como exemplo. É um PRNG de ~9 linhas, com seed de 32 bits, período 2³² e qualidade estatística suficiente para uniformidade de buckets e amostras de 10⁴ boosters (passa BigCrush parcial; mais que adequado para o domínio).
  - `Math.random()` não é seedable nem reprodutível entre navegadores — incompatível com FR-012 e o gate do Princípio III.
  - API minimalista: a função retorna `() => number` em [0,1), idêntica em forma a `Math.random`, plug-and-play em `generateBooster`.
- **Alternativas consideradas**:
  - **PCG / xoroshiro128**: melhor qualidade, mas exige aritmética de 64 bits (BigInt) em JS, o que custa performance e LOC sem ganho observável neste domínio.
  - **`crypto.getRandomValues`**: não-seedable. Útil para criptografia, irrelevante para reprodutibilidade.
  - **Lib externa (seedrandom, chance)**: dependência runtime adicional para algo que cabe em <15 linhas; descartado por princípio de simplicidade e zero-deps.

## R3. Validação estatística da distribuição

- **Decisão**: para cada slot probabilístico (5 e 6) o teste roda 10.000 boosters com seed fixa e aplica **dois critérios em conjunto**:
  1. **Bound observado**: frequência relativa de cada bucket dentro de ±1 ponto percentual da probabilidade declarada (espelha SC-002).
  2. **Chi-quadrado de aderência** (α = 0,01) usando `chiSquareCriticalValue(df, 0.01)` tabelado, com `df = k - 1` onde `k` é o número de buckets do slot.
- **Rationale**:
  - SC-002 dá um critério intuitivo e fácil de comunicar (±1 p.p.); o chi-quadrado dá um critério estatisticamente sólido que detecta desvios sistemáticos pequenos não cobertos pelo bound (ex.: viés para legendária na contracorrente do bound).
  - Implementar chi-quadrado em ~20 linhas com tabela de valores críticos é trivial e elimina dependência externa.
  - Seed fixa em CI garante reprodutibilidade. Em desenvolvimento local, a suite estatística pode rodar com seed aleatória (variável de ambiente) e ser tolerante a 1 falha em N execuções, mantendo o gate em CI.
- **Alternativas consideradas**:
  - **Apenas bound observado**: viola o espírito do Princípio III (chi-quadrado é literalmente citado).
  - **Kolmogorov-Smirnov**: KS é para distribuições contínuas; aqui temos buckets discretos.
  - **Lib `simple-statistics`**: razoável, mas adiciona dependência runtime para uma função que cabe num arquivo.

## R4. Persistência: LocalStorage com schema versionado

- **Decisão**: chave `pkmn-booster:collection:v1`, valor JSON `{ schemaVersion: 1, entries: { [cardId]: count } }`. Acesso atrás de `CollectionStore` (interface) com implementação `LocalStorageCollectionStore`.
- **Rationale**:
  - Coleção do jogador-alvo: até ~1.000 entradas × ~20 bytes/cada = ~20 KB. LocalStorage tem ~5 MB de quota — folga de 250×. (Princípio II)
  - API síncrona simplifica testes (`tests/unit/collection-store.test.ts`) e elimina a necessidade de um event bus.
  - Schema versionado permite migração quando, no futuro, mudarmos de LocalStorage para IndexedDB ou File System Access — a constituição exige que o módulo seja substituível.
  - Detecção de indisponibilidade: `try { localStorage.setItem('__probe__', '1'); localStorage.removeItem('__probe__'); }`. Se falhar (privacy mode, quota cheia), `CollectionStore.isAvailable()` retorna `false` e a UI exibe banner "progresso não será salvo" (FR-025, US3 cenário 4).
- **Alternativas consideradas**:
  - **IndexedDB**: complexidade desnecessária (API assíncrona, transações) para um mapa pequeno. Mantemos como hook futuro via interface.
  - **Cookies**: limite de ~4 KB e enviados em cada request — mau ajuste mesmo em SPA estática.
  - **File System Access API**: requer prompt de permissão, fragmentação de browser support; reservado para futuro export/import.

## R5. Fonte de dados: pokemontcg.io v2

- **Decisão**: o utilitário Python consome `GET https://api.pokemontcg.io/v2/cards?q=set.id:sv3pt5&pageSize=250` e itera as páginas. Imagem por carta vem em `card.images.large` (PNG, ~250 KB cada) ou `card.images.small`. Salvamos sempre como `.jpg`.
- **Rationale**:
  - É a API pública mencionada no input do usuário, gratuita, com filtro nativo `set.id:sv3pt5` (SV151).
  - `pageSize=250` cobre o set inteiro (~207 cartas) em uma página, evitando paginação na maioria dos casos. O utilitário ainda lida com paginação via `page` e o `count`/`totalCount` da resposta.
  - API key opcional eleva o rate limit; sem key, há limite de 1.000 requisições/dia, mais que suficiente para um download único do set.
- **Alternativas consideradas**:
  - **Scrape do site oficial Pokémon**: termos de uso ambíguos, HTML volátil. Descartado.
  - **Bulkbasic / Bulbapedia**: dados textuais bons, mas imagens dispersas por wiki.
  - **TCGdex / TCGPlayer API**: alternativas válidas, mas sem o filtro direto pelo identificador `sv3pt5` solicitado pelo usuário.

## R6. Conversão PNG → JPG

- **Decisão**: usar Pillow para abrir PNG da fonte, achatar contra fundo branco (cartas têm transparência mínima mas Pillow exige RGB para JPG), salvar como `.jpg` qualidade 85.
- **Rationale**:
  - O usuário pediu `.jpg` explicitamente. JPG qualidade 85 reduz cada imagem de ~250 KB (PNG) para ~60–90 KB (JPG), totalizando ~15 MB para o set inteiro — viável commitar e distribuir.
  - Pillow é dependência leve, padrão de fato em Python para manipulação de imagem.
  - Princípio V exige "assets pesados (>1 MB) MUST ser otimizados antes do commit" — JPG q85 garante que nenhuma imagem do set ultrapasse 1 MB.
- **Alternativas consideradas**:
  - **Manter PNG** e renomear para `.jpg`: viola formato de arquivo, quebra exibidores e aumenta repositório em ~3×. Descartado.
  - **WebP**: melhor compressão, mas o usuário pediu `.jpg`. Adiar para issue futura se peso virar problema.

## R7. Animação de revelação: CSS transforms + box-shadow

- **Decisão**: cada carta é um `<button>` com duas faces (`.face-back`, `.face-front`) em `position: absolute` e `backface-visibility: hidden`. A virada é `transform: rotateY(180deg)` com `transition: transform 600ms cubic-bezier(.4,.0,.2,1)`. O efeito de raridade é um halo via `box-shadow` aplicado por classe (`.rarity-04`, `.rarity-05`, …) com gradiente animado para 04+.
- **Rationale**:
  - 600 ms cai dentro da janela 400–1.200 ms da SC-008.
  - CSS é GPU-accelerated, sem custo em JS — o jogador pode disparar virada após virada sem queda de framerate.
  - `prefers-reduced-motion`: respeitado com `@media (prefers-reduced-motion: reduce) { transition: none; }` — alinhado com Acessibilidade (constituição) e WCAG.
- **Alternativas consideradas**:
  - **Web Animations API (JS)**: mais flexível mas overkill para um flip simples; CSS é suficiente.
  - **Lottie/After Effects**: dependência grande, alvo de bugs cross-browser; descartado.
  - **Canvas/WebGL para holograma**: fica para iteração visual posterior; CSS puro entrega o suficiente para MVP.

## R8. Layout responsivo do álbum

- **Decisão**: container `display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;`. Cabeçalho fixo com contador global e detalhamento por raridade. Filtro como `<select>` em mobile, segmented control horizontal em desktop (>768 px).
- **Rationale**:
  - `auto-fill` permite que o grid se ajuste de 2 colunas (320 px) a 10+ colunas (1440 px+) sem media queries por breakpoint.
  - `minmax(120px, 1fr)` garante que cada slot seja legível e que a silhueta tenha espaço para mostrar o número de coleção.
  - 207 slots × 1 imagem ~80 KB = 16 MB potencial em DOM. Usamos `loading="lazy"` em todas as `<img>`, e `content-visibility: auto` no container do grid para evitar layout em slots fora do viewport. SC-009 (<200 ms para 1.000 entradas) é confortável.
- **Alternativas consideradas**:
  - **Virtualização (react-window ou similar)**: descartada — não usamos framework, e 207 slots não justifica scroller virtual.
  - **Flexbox**: pior para grid 2D regular; CSS Grid é nativo para o caso.

## R9. Acessibilidade

- **Decisão**:
  - Todos os botões têm `aria-label` quando o texto não é autoexplicativo.
  - Foco visível via `:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`.
  - Atalho de teclado: `Espaço` na tela do booster avança a próxima carta (FR-017). Esc fecha modais futuros.
  - Contraste mínimo WCAG AA (4.5:1 para texto, 3:1 para componentes UI), validado via Lighthouse no CI opcional.
  - Animações respeitam `prefers-reduced-motion`.
- **Rationale**: alinhado com a seção "Acessibilidade" da constituição (Restrições Técnicas).

## R10. Estratégia de teste para o utilitário Python

- **Decisão**: `pytest` com fixtures para mockar `requests.get` (via `responses` ou `requests-mock`). Cobertura:
  - `test_rarity_mapping.py`: para cada raridade-fonte do set 151 que conhecemos, asserta o bucket destino (FR-003).
  - `test_idempotency.py`: roda o utilitário duas vezes, asserta que a segunda não emite chamada HTTP para imagens já presentes (FR-005).
  - `test_retry.py`: simula 3 falhas seguidas em uma carta, depois sucesso; asserta retentativa com backoff finito e sucesso final (FR-006).
  - `test_manifest_schema.py`: valida o `manifest.json` produzido contra `contracts/manifest.schema.json`.
- **Rationale**: o utilitário é classificado como ferramenta de build, mas FR-001 a FR-007a são requisitos funcionais. Cobertura via pytest dá confiança de que mapeamentos e idempotência não regridem.
- **Alternativas consideradas**:
  - **Sem testes (script ad hoc)**: descartado — FRs explícitos exigem comportamento testável.
  - **Testes E2E reais contra a API**: descartado — voláteis, custosos, dependem de rede em CI.

---

## Resumo dos artefatos a serem produzidos em Phase 1

- `data-model.md` — tipos TS para Card, Catalog, Booster, Collection, SlotDistribution, etc.
- `contracts/booster-engine.md` — contrato e invariantes de `generateBooster`.
- `contracts/collection-store.md` — interface `CollectionStore` e contrato de migração.
- `contracts/download-cli.md` — contrato CLI do `download_cards.py` (args, exit codes, side effects).
- `contracts/manifest.schema.json` — schema JSON do `assets/manifest.json`.
- `quickstart.md` — passo a passo: clone → setup → download de cartas → dev server → testes → build estático.
