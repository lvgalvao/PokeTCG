---

description: "Tasks list for feature 001-pokemon-booster-opener (Abridor de Boosters Pokémon TCG — Set 151)"
---

# Tasks: Abridor de Boosters Pokémon TCG (Set 151)

**Input**: Design documents from `/specs/001-pokemon-booster-opener/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

**Tests**: Esta feature inclui tarefas de teste **explicitamente requeridas** por:
- **Princípio III da constituição (NON-NEGOTIABLE)** — testes estatísticos de distribuição.
- **FR-013** — validação automatizada da distribuição com tolerância declarada.
- **Contratos** (`booster-engine.md`, `collection-store.md`, `download-cli.md`) — listas de testes específicos.

Por isso, tarefas de teste correspondentes a essas exigências são **mandatórias**, não opcionais.

**Organization**: Tarefas agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências de tarefa incompleta).
- **[Story]**: Mapeia a tarefa para uma user story (US1 acervo, US2 booster, US3 coleção, US4 filtros).
- Descrições incluem caminhos de arquivo absolutos a partir da raiz do repositório.

## Path Conventions

- **Single project**: `src/`, `tests/`, `tools/`, `tests_python/`, `assets/` na raiz do repo.
- Caminhos abaixo seguem a Structure Decision do `plan.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: bootstrap do repositório, ferramentas de build e estrutura de pastas.

- [X] T001 Criar a estrutura de diretórios da raiz: `src/{core,domain,persistence,ui/styles,utils}`, `tests/{unit,statistical}`, `tools/`, `tests_python/`, `assets/{01_comum,02_incomum,03_raras,04_duplo_raras,05_arte_secreta,06_duplo_arte_secreta,07_legendaria}`.
- [X] T002 [P] Inicializar o projeto npm com `package.json` na raiz do repo, declarando deps `vite@^5`, `vitest@^1`, `typescript@^5`, `@types/node@^20`, e scripts `dev`, `build`, `preview`, `test`, `test:statistical`.
- [X] T003 [P] Criar `tsconfig.json` na raiz com `target: ES2020`, `module: ESNext`, `strict: true`, `moduleResolution: bundler`, `lib: ["ES2020", "DOM", "DOM.Iterable"]`, `noUncheckedIndexedAccess: true`.
- [X] T004 [P] Criar `vite.config.ts` na raiz com `root: "src"`, `publicDir: "../assets"`, `build.outDir: "../dist"`, `build.emptyOutDir: true`.
- [X] T005 [P] Criar `tools/requirements.txt` listando `requests>=2.31`, `Pillow>=10.0`, `jsonschema>=4.20` e `pyproject.toml` com metadados mínimos do projeto Python (Python ≥3.11).
- [X] T006 [P] Configurar lint/format: `.eslintrc.json` (TypeScript estrito), `.prettierrc` (largura 100, aspas duplas) e `ruff.toml` (Python, perfil `target-version = py311`).
- [X] T007 [P] Criar `.gitignore` na raiz cobrindo `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `*.pyc`, `coverage/`, `.tmp/`, e **explicitamente NÃO ignorar** `assets/` (princípio V).
- [X] T008 Criar `src/index.html` com shell mínimo: `<header>` para tabs Booster/Coleção, `<main id="app">` para a vista ativa, link para `./ui/styles/base.css`, script de bootstrap `<script type="module" src="./main.ts">`.

**Checkpoint Phase 1**: tooling pronto; `npm install` e `npm run dev` funcionam (ainda sem conteúdo).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos e estilos base usados por todas as user stories.

**⚠️ CRITICAL**: nenhuma user story pode começar sem esta fase concluída.

- [X] T009 Implementar enum/tipos de bucket e helpers (`bucketRank`, `bucketDowngrade`, `BUCKETS`) em `src/core/buckets.ts`, conforme `data-model.md §1`.
- [X] T010 [P] Implementar a interface `Card` com campos `id`, `name`, `rarityRaw`, `bucket`, `collectionNumber`, `imagePath` em `src/domain/card.ts`, conforme `data-model.md §2`.
- [X] T011 [P] Implementar helpers DOM mínimos (`$`, `$$`, `el`, `on`, `setText`, `toggleClass`) sem dependência de framework em `src/utils/dom.ts`.
- [X] T012 [P] Criar `src/ui/styles/base.css` com tokens CSS (cores, espaçamentos, tipografia), reset, breakpoints (320/480/768/1024/1440), `:focus-visible` global, `prefers-reduced-motion`, e contraste WCAG AA.
- [X] T013 Atualizar `src/index.html` para incluir o controle de tabs persistente (`<nav role="tablist">` com botões "Booster" e "Coleção"), atributos ARIA correspondentes, e os containers `<section role="tabpanel">` para cada vista — alvo persistente de FR-018a/FR-018b.

**Checkpoint Phase 2**: tipos e shell prontos; ainda nenhum comportamento.

---

## Phase 3: User Story 1 — Preparar acervo de cartas (Priority: P1) 🎯 Bloqueante

**Goal**: o operador roda `python tools/download_cards.py` em uma máquina com acesso à internet e fica com `assets/` populado nas 7 pastas e `assets/manifest.json` consistente, em formato consumível pelo client web.

**Independent Test**: a partir de uma cópia limpa, executar `python tools/download_cards.py`, conferir que (a) as 7 pastas existem com `.jpg` distribuídos pelo mapeamento de raridades (FR-003), (b) `assets/manifest.json` valida contra `contracts/manifest.schema.json`, (c) re-executar não rebaixa nada (idempotência) e (d) o exit code é `0`.

### Tests for User Story 1 (mandatórios — derivados de `contracts/download-cli.md`)

> Escreva os testes ANTES da implementação correspondente; rode e confirme que falham; depois implemente.

- [X] T014 [P] [US1] Teste do mapeamento de raridades (cobertura exaustiva da tabela do FR-003) em `tests_python/test_rarity_mapping.py`, com fixture JSON congelado da resposta da pokemontcg.io para o set sv3pt5.
- [X] T015 [P] [US1] Teste de idempotência (segunda execução: zero requests HTTP de imagem, `skipped == n_baixadas`) em `tests_python/test_idempotency.py`, usando `responses` ou `requests-mock`.
- [X] T016 [P] [US1] Teste de retry/backoff (2 falhas + 1 sucesso resulta em download bem-sucedido com atrasos crescentes) em `tests_python/test_retry.py`.
- [X] T017 [P] [US1] Teste de validação do `manifest.json` contra `contracts/manifest.schema.json` (via `jsonschema`) em `tests_python/test_manifest_schema.py`.
- [X] T018 [P] [US1] Teste de path safety (input com `id` malicioso contendo `../` é recusado) em `tests_python/test_safety.py`.

### Implementation for User Story 1

- [X] T019 [US1] Esqueleto da CLI em `tools/download_cards.py`: parsing de `--set-id`, `--assets-dir`, `--api-key`, `--retries`, `--retry-backoff`, `--quality`, `--force`, `--dry-run`, `--verbose`, `--help`; bloqueio `if __name__ == "__main__"`; logger Python configurado.
- [X] T020 [US1] Tabela de mapeamento de raridades-fonte → bucket local (FR-003) como constante em `tools/download_cards.py`, exposta como função pura `bucket_for(rarity_raw: str) -> Bucket | None`.
- [X] T021 [US1] Função `list_set_cards(set_id, api_key, page_size=250)` em `tools/download_cards.py` que itera páginas da pokemontcg.io e retorna lista normalizada de dicts.
- [X] T022 [US1] Função `download_image(card, dest_path, retries, backoff)` em `tools/download_cards.py` com retentativa exponencial e fallback `images.large` → `images.small`.
- [X] T023 [US1] Função `to_jpg(src_bytes, dest_path, quality)` em `tools/download_cards.py` usando Pillow (achata transparência contra fundo branco; salva JPG qualidade configurável).
- [X] T024 [US1] Lógica de idempotência em `tools/download_cards.py`: se `dest_path` existe e `--force` não foi passado, marca como `skipped` e não emite request da imagem (FR-005).
- [X] T025 [US1] Path safety em `tools/download_cards.py`: validar que `dest_path` está sob `--assets-dir/<bucket>/`, recusar IDs com separador de path ou `..` (FR-007).
- [X] T026 [US1] Função `write_manifest(cards, unmapped, set_id, set_name, assets_dir)` em `tools/download_cards.py` que persiste `assets/manifest.json` conforme `contracts/manifest.schema.json` (FR-007a).
- [X] T027 [US1] Função `print_report(downloaded, skipped, failed, unmapped)` em `tools/download_cards.py` para o relatório final em stdout (FR-006).
- [X] T028 [US1] Orquestração `main()` em `tools/download_cards.py`: cria as 7 pastas se faltam (e somente elas), itera cartas, aplica mapeamento, baixa+converte+salva, agrega resultados, escreve manifest, imprime relatório, retorna exit code (`0`/`2`/`3` conforme `contracts/download-cli.md`).
- [X] T029 [US1] Executar o utilitário contra a API real para popular `assets/` localmente; commitar as 7 pastas com os JPGs e `assets/manifest.json` no controle de versão (princípio V exige acervo versionado).

**Checkpoint US1**: `assets/` populado, `manifest.json` válido contra o schema, todos os testes em `tests_python/` passando. US2 está desbloqueada.

---

## Phase 4: User Story 2 — Abrir um booster e revelar 6 cartas (Priority: P1) 🎯 MVP

**Goal**: o jogador acessa o jogo no navegador, vê um booster fechado, abre, e revela manualmente 6 cartas únicas (espaço/clique/toque/Pular tudo) em ordem crescente de raridade, com a distribuição probabilística correta.

**Independent Test**: rodar `npm run dev`, acessar `http://localhost:5173`, clicar em "Abrir booster", confirmar (a) 6 cartas reveladas em ordem por raridade, (b) sem repetição interna, (c) distribuição estatisticamente correta sobre 10.000 boosters simulados (suite estatística), (d) input por `Espaço`/clique/toque funciona, (e) "Pular tudo" funciona, (f) é possível abrir outro booster em sequência.

### Tests for User Story 2 (mandatórios — derivados de `contracts/booster-engine.md` e Princípio III)

> Escreva os testes ANTES; rode e veja falhar; depois implemente.

- [X] T030 [P] [US2] Teste de determinismo do RNG Mulberry32 (mesma seed produz mesma sequência; valores em [0,1)) em `tests/unit/rng.test.ts`.
- [X] T031 [P] [US2] Teste de validade de `SLOT_DISTRIBUTIONS` (cada slot soma 1.0 ± 1e-9; valores ≥ 0; chaves só de buckets válidos) em `tests/unit/distributions.test.ts`.
- [X] T032 [P] [US2] Teste das invariantes I1–I9 do `generateBooster` (6 cartas, unicidade por id, slots 1–4 = comum, ordem por bucket, downgrade com piso, determinismo, não-repetição cross-slot) em `tests/unit/booster.test.ts`, conforme `contracts/booster-engine.md`.
- [X] T033 [US2] **Suite estatística (NON-NEGOTIABLE — Princípio III)**: 10.000 boosters com seed `0xC0FFEE`, asserta (a) slots 1–4 = 100% comum, (b) slot 5 nas faixas 89–91% incomum / 9–11% rara (±1 p.p., SC-002), (c) slot 6 nas faixas declaradas, (d) chi-quadrado de aderência aceito a α=0,01 para slots 5 e 6. Implementar em `tests/statistical/distribution.test.ts` incluindo a função interna `chiSquareCriticalValue(df, alpha)` com tabela inline.

### Implementation for User Story 2

- [X] T034 [P] [US2] Implementar `mulberry32(seed)` e `autoSeed()` em `src/core/rng.ts`, conforme `data-model.md §5`.
- [X] T035 [P] [US2] Definir `SLOT_DISTRIBUTIONS` (única fonte da verdade, FR-011) e `SLOT_DOWNGRADE_FLOOR` em `src/core/distributions.ts`, conforme `data-model.md §4`.
- [X] T036 [US2] Implementar `loadCatalog(manifestUrl)` que faz `fetch`, valida e indexa por `id` e por `bucket` em `src/domain/catalog.ts`, conforme `data-model.md §3` (depende de T010, T026).
- [X] T037 [US2] Implementar `generateBooster(rng, catalog, seed)` em `src/core/booster.ts` honrando todas as invariantes de `contracts/booster-engine.md` — sortear bucket pela distribuição, aplicar downgrade com piso quando o bucket está vazio, escolher carta uniforme sem reposição local ao booster, ordenar slots por raridade crescente, registrar `downgrades[]`. Lançar `EmptyBaseBucketError`/`EmptyMandatorySlotError`/`InsufficientCardsError` conforme contrato. (Depende de T034, T035, T036.)
- [X] T038 [US2] Implementar `BoosterRevealState` e a função `advanceReveal(state)` em `src/ui/booster-view.ts` (modelo efêmero conforme `data-model.md §9`).
- [X] T039 [P] [US2] Criar `src/ui/styles/booster.css` com:
    - layout do pacote fechado (responsivo 320–1440 px),
    - layout dos 6 slots em cascata (mobile: foco na carta atual + carrossel; desktop: leque),
    - animação `flip` via `transform: rotateY(180deg)` com `transition` de 600 ms,
    - classes de "glow" por bucket (`.rarity-04`…`.rarity-07`) com `box-shadow` + gradiente,
    - bloco `@media (prefers-reduced-motion: reduce)` zerando transitions.
- [X] T040 [US2] Implementar a vista do booster em `src/ui/booster-view.ts`:
    - render do pacote fechado e do botão "Abrir booster",
    - render dos 6 slots quando `Booster` é gerado,
    - virada da carta atual ao receber `advance` event,
    - botão "Próxima" persistente,
    - botão "Pular tudo" que chama `advanceAllRemaining(state)`.
- [X] T041 [US2] Em `src/ui/booster-view.ts`, registrar listeners para entrada do jogador (FR-017): `keydown` global de `Space` (ignorando se o foco está em campo editável), `click` no botão "Próxima", `click`/`touchend` na carta atual ainda virada para baixo. Garantir FR-017b: cada gesto avança exatamente uma carta (debounce/lock interno enquanto a animação de 600 ms está em curso).
- [X] T042 [US2] Implementar `src/main.ts` para bootstrap: chamar `loadCatalog("/manifest.json")`, ler seed de `?seed=` na URL (parse hex/decimal; se ausente, `autoSeed()`), criar `mulberry32(seed)`, montar `BoosterView` e `App`. (Depende de T036.)
- [X] T043 [US2] Implementar `src/ui/app.ts` com gerenciamento de tabs (alterna entre "Booster" e "Coleção" sem reload, FR-018a) e expõe API `app.openNewBooster()`, `app.showCollection()`. Mantém o controle de tabs visível durante a animação (FR-018b).
- [X] T044 [US2] Adicionar suporte a `?seed=<n>` em `src/main.ts` e expor `window.__pkmnSeed` (somente em build dev) para reprodução de bug reports (FR-012, alinhado com Princípio III).

**Checkpoint US2 (MVP)**: jogador consegue abrir N boosters em sequência, ler 6 cartas únicas com animação respeitando a distribuição. Suite estatística passa em CI. Sem persistência ainda.

---

## Phase 5: User Story 3 — Coleção persistente entre sessões (Priority: P2)

**Goal**: cartas puxadas em qualquer booster passam a fazer parte da coleção do jogador, persistida em LocalStorage e exibida em modo álbum (binder) com silhuetas para cartas não puxadas e contadores de progresso.

**Independent Test**: abrir 2–3 boosters; alternar para a tab "Coleção" e ver as cartas puxadas com badges `×N` no álbum, e os slots não puxados como silhuetas; recarregar a página; confirmar que tudo permanece. Em modo privacy (LocalStorage indisponível), o jogo continua funcionando e exibe banner "progresso não salvo".

### Tests for User Story 3 (mandatórios — derivados de `contracts/collection-store.md`)

- [X] T045 [P] [US3] Testes da `CollectionStore` (load vazio, save+load round-trip, `addCards` acumulando contagens incluindo duplicatas no array, `clear`, indisponibilidade quando o probe falha, resiliência a JSON corrompido) em `tests/unit/collection-store.test.ts`.

### Implementation for User Story 3

- [X] T046 [P] [US3] Definir os tipos `Collection`, `CollectionEntry`, `CollectionStore` em `src/domain/collection.ts`, conforme `data-model.md §7`.
- [X] T047 [US3] Implementar `createLocalStorageCollectionStore(key?)` em `src/persistence/collection-store.ts`: probe de disponibilidade com cache, `load()` com fallback e backup em corrupção, `save()` filtrando counts ≤ 0, `addCards()` atomicamente, `clear()` apagando a key principal. (Depende de T046.)
- [X] T048 [US3] Implementar `buildCollectionView(catalog, collection, filter='all')` puro em `src/ui/collection-view.ts` (modelo efêmero, `data-model.md §9`): retorna lista de slots ordenados por `collectionNumber` com `count: number` (0 se não puxada) e `progress: { owned, total, byBucket }`.
- [X] T049 [P] [US3] Criar `src/ui/styles/collection.css` com:
    - cabeçalho persistente para contadores (X/Y global + por raridade),
    - grid `repeat(auto-fill, minmax(120px, 1fr))` com `gap: 8px`,
    - estilo de slot revelado (imagem real + badge `×N` no canto inferior direito),
    - estilo de silhueta (filtro `grayscale(1) opacity(0.45)` + número da coleção visível em overlay),
    - `content-visibility: auto` no container do grid para o álbum inteiro.
- [X] T050 [US3] Implementar a renderização do álbum (sem filtros ainda — só `'all'`) em `src/ui/collection-view.ts`: header com `progress.owned/progress.total`, detalhamento por raridade, grid com slots renderizados a partir de `buildCollectionView(...)`. Suporta `<img loading="lazy">`. (Depende de T048, T049.)
- [X] T051 [US3] Em `src/ui/app.ts`, integrar a coleção: após o jogador concluir a revelação do booster (todos os 6 slots virados), chamar `collectionStore.addCards(boosterIds)` e re-renderizar a coleção. (Depende de T047.)
- [X] T052 [US3] Adicionar banner "progresso não salvo nesta sessão" em `src/ui/app.ts`, exibido quando `collectionStore.isAvailable()` é `false` na primeira chamada (FR-025, US3 cenário 4). Estilo em `src/ui/styles/base.css`.
- [X] T053 [US3] Adicionar botão "Limpar coleção" no cabeçalho da seção Coleção em `src/ui/collection-view.ts`, com `confirm()` nativo ou modal simples antes de chamar `collectionStore.clear()` e re-renderizar. (FR-023, US3 cenário 5.)

**Checkpoint US3**: coleção sobrevive a recargas; álbum renderiza ~207 slots sob 200 ms; banner aparece em privacy mode; "Limpar coleção" funciona com confirmação.

---

## Phase 6: User Story 4 — Filtrar e explorar a coleção por raridade (Priority: P3)

**Goal**: na seção Coleção, o jogador pode filtrar por uma das 7 raridades (ou ver "todas"), e os contadores e slots refletem o filtro ativo.

**Independent Test**: com pelo menos 30 cartas espalhadas por raridades distintas, alternar pelos 7 filtros + "todas" e confirmar que apenas slots do bucket selecionado aparecem (revelados e silhuetas), e que o contador no topo mostra `X/Y` apenas daquele bucket.

### Implementation for User Story 4

- [X] T054 [P] [US4] Adicionar estado `currentFilter: CollectionFilter` em `src/ui/collection-view.ts` e refatorar `renderCollection()` para receber/repassar o filtro a `buildCollectionView`.
- [X] T055 [US4] Adicionar UI de filtro em `src/ui/collection-view.ts`: segmented control com 8 botões (`Todas` + 7 raridades) em desktop (≥768 px) e `<select>` nativo em mobile. Cada botão tem `aria-pressed` correspondente. (Depende de T054.)
- [X] T056 [US4] Em `src/ui/collection-view.ts`, ao trocar filtro: atualizar `currentFilter`, recomputar `buildCollectionView`, re-renderizar grid e contador. Garantir que a transição completa (interação → DOM atualizado) ocorra em <200 ms para 1.000 entradas (SC-009).
- [X] T057 [US4] Estado vazio para filtro (US4 cenário 2): quando o filtro restringe a um bucket onde o jogador não tem 0 cartas reveladas, exibir todas as silhuetas daquele bucket e contador `0/<total>`. Garantir cobertura visual em `src/ui/styles/collection.css`.

**Checkpoint US4**: 8 filtros funcionando, contadores refletindo o filtro, transição fluida em <200 ms.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: melhorias que tocam múltiplas user stories e validações finais antes do merge.

- [X] T058 [P] Auditoria de acessibilidade: verificar foco visível em todos os controles, `aria-label`/`aria-pressed`/`aria-live` onde necessário, contraste WCAG AA em todas as combinações de cor, suporte a `prefers-reduced-motion`. Ajustar `src/ui/styles/base.css`, `src/ui/styles/booster.css`, `src/ui/styles/collection.css` conforme necessário.
- [X] T059 [P] Configurar `vite.config.ts` para garantir que `assets/` (incluindo `manifest.json` e os JPGs das 7 pastas) seja copiado para `dist/` no build de produção; rodar `npm run build` e confirmar com `npx serve dist` que o jogo funciona offline.
- [X] T060 [P] Validação responsiva manual: abrir o jogo nos viewports `320×568`, `375×667`, `768×1024`, `1280×800` e `1440×900` no DevTools; documentar checklist preenchido em `specs/001-pokemon-booster-opener/quickstart.md` ou seção "Validação" do PR.
- [X] T061 [P] Validação cross-browser: rodar smoke manual no Chrome, Firefox, Safari (ou WebKit via Playwright) e Edge — abrir booster, revelar 6 cartas, ver coleção, recarregar.
- [X] T062 [P] Smoke E2E opcional com Playwright em `tests/e2e/smoke.spec.ts`: abrir jogo, abrir booster, pressionar Espaço 6×, verificar tab Coleção mostra 6 entradas (com seed fixa via `?seed=...`).
- [X] T063 [P] Lighthouse audit local: rodar contra `dist/` e confirmar Performance ≥90, Accessibility ≥95, Best Practices ≥95 (SC-005, SC-006). Anotar resultados no PR.
- [X] T064 Criar `README.md` na raiz com: descrição curta do jogo, link para `quickstart.md`, badge da licença, link para a constituição. (Constituição lista isto como TODO follow-up.)
- [X] T065 Rodar a suite completa: `npm test`, `npm run test:statistical`, `pytest tests_python/`, `npm run build`. Confirmar que todos os passos do `quickstart.md §6` estão verdes antes de marcar a feature pronta.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências; pode começar imediatamente.
- **Foundational (Phase 2)**: depende de Setup; **bloqueia todas as user stories**.
- **US1 (Phase 3)**: depende de Foundational. Tecnicamente independente das outras stories, mas **na prática produz o `manifest.json` consumido por US2/US3/US4** — sem T029, US2 só roda contra fixture.
- **US2 (Phase 4)**: depende de Foundational + (efetivamente) T029 do US1 para ter manifest real. MVP termina aqui.
- **US3 (Phase 5)**: depende de Foundational e de US2 (para obter cartas via revelação). Independente de US4.
- **US4 (Phase 6)**: depende de US3 (precisa do `collection-view.ts` para adicionar filtros). Não depende de US1 além do que US3 já depende.
- **Polish (Phase 7)**: depende de todas as user stories incluídas no PR.

### Within Each User Story

- **Tests first**: tarefas de teste mandatórias precedem a implementação correspondente.
- **Models before services**: em US3, `Collection` types (T046) antes de `LocalStorageCollectionStore` (T047).
- **Engine before UI**: em US2, `generateBooster` (T037) antes de `booster-view.ts` (T040).
- **CSS pode rodar paralelo**: T039, T049 são `[P]` — não dependem da lógica TS correspondente.

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005, T006, T007 podem rodar em paralelo após T001.
- Phase 2: T010, T011, T012 em paralelo após T009 (que define os buckets compartilhados).
- US1: todos os testes (T014–T018) em paralelo. T019 sozinha (CLI scaffold), depois T020–T028 sequenciais por compartilharem o mesmo arquivo `download_cards.py`.
- US2: T030, T031 em paralelo com T034, T035 (testes vs. implementação correspondem em arquivos distintos). T032 em paralelo com T039 (CSS). T033 (suite estatística) **depois** de T037 estar passando localmente.
- US3: T045 em paralelo com T046+T049 (testes/types/CSS em arquivos distintos). T047 sozinha. Depois T048–T053 em ordem.
- US4: T054 → T055 → T056/T057 sequencial (todas no mesmo arquivo).
- Polish: T058–T063 todos em paralelo. T064–T065 ao final.

---

## Parallel Example: User Story 2 (MVP)

```bash
# Após Phase 2 concluída, três pessoas/agentes podem trabalhar em paralelo:

Person A — Tests:
  T030  tests/unit/rng.test.ts
  T031  tests/unit/distributions.test.ts
  T032  tests/unit/booster.test.ts

Person B — Core/Engine:
  T034  src/core/rng.ts
  T035  src/core/distributions.ts
  T036  src/domain/catalog.ts          (depende de manifest.json gerado por US1 T029)
  T037  src/core/booster.ts            (depende de T034, T035, T036)
  T033  tests/statistical/distribution.test.ts (depende de T037)

Person C — UI:
  T039  src/ui/styles/booster.css
  T038  src/ui/booster-view.ts (modelo)
  T040  src/ui/booster-view.ts (render)         (depende de T037)
  T041  src/ui/booster-view.ts (input)
  T042  src/main.ts
  T043  src/ui/app.ts
  T044  src/main.ts (?seed=)
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + US1 + US2)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. Concluir US1 inteira, incluindo T029 (rodar download e commitar `assets/`).
3. Concluir US2 inteira, com a suite estatística (T033) verde.
4. **Pare e valide**: jogo abre, 10.000 boosters batem com a distribuição, jogador consegue abrir e ler boosters de verdade. Sem coleção persistente ainda.
5. Deploy/demo opcional do MVP.

### Incremental Delivery

1. Setup + Foundational → fundação pronta.
2. Adicionar US1 → acervo populado.
3. Adicionar US2 → MVP jogável (testar e demoar).
4. Adicionar US3 → coleção persistente (testar e demoar).
5. Adicionar US4 → filtros (testar e demoar).
6. Polish (Phase 7) → preparar para release/PR final.

### Solo Strategy

Mesmo desenvolvedor passando pelas fases em ordem: cada fase entrega valor verificável. Ao terminar US2, já tem um produto demonstrável.

---

## Notes

- `[P]` significa arquivos diferentes e sem dependência em tarefa incompleta — pode ser feito em paralelo.
- `[Story]` mapeia a tarefa para a user story correspondente para rastreabilidade.
- Cada user story tem `Independent Test` que pode ser executado mesmo sem as próximas user stories.
- A suite estatística (T033) é o **gate** do Princípio III — PR sem ela verde é bloqueado.
- Commit após cada tarefa ou agrupamento lógico (recomendado: por tarefa em US1/US3/US4; por sub-grupo em US2 dado o volume).
- `assets/` é versionado: o repositório fica auto-contido (Princípio V).
