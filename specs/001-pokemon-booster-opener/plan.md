# Implementation Plan: Abridor de Boosters Pokémon TCG (Set 151)

**Branch**: `001-pokemon-booster-opener` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pokemon-booster-opener/spec.md`

## Summary

Aplicação web 100% client-side que simula a abertura de boosters do Pokémon TCG (set Scarlet & Violet 151). O acervo de imagens é populado por um utilitário Python idempotente (`tools/download_cards.py`) que consulta a API pública `pokemontcg.io`, mapeia as raridades para 7 buckets locais sob `assets/`, salva as cartas como `.jpg` e produz um manifesto JSON. Em runtime, a aplicação carrega o manifesto e expõe duas seções alternáveis: **Booster** (abertura manual carta-a-carta com espaço/clique e distribuição probabilística parametrizada) e **Coleção** (modo álbum com silhuetas para cartas não puxadas e contadores de progresso por raridade). A coleção é persistida em LocalStorage via camada encapsulada com schema versionado. RNG é Mulberry32 seedable, alinhado ao Princípio III da constituição, com testes estatísticos de aderência (chi-quadrado + tolerância de ±1 p.p. em 10.000 boosters).

## Technical Context

**Language/Version**: TypeScript ES2020+ (vanilla, sem framework de UI) para a aplicação web; Python 3.11+ para o utilitário de download.
**Primary Dependencies**: Web app — zero dependências runtime de UI; build via **Vite 5**; testes via **Vitest** (unit + statistical) e **Playwright** (smoke E2E opcional). Python — `requests` (HTTP) e `Pillow` (conversão PNG→JPG quando necessário); testes via `pytest`.
**Storage**: `localStorage` para a coleção do jogador, encapsulado por `CollectionStore` com `schemaVersion: 1` (Princípio II). Acervo: arquivos estáticos `assets/<bucket>/<id>.jpg` + `assets/manifest.json`.
**Testing**: Vitest para módulos TS (`tests/unit/*`), suite estatística dedicada (`tests/statistical/distribution.test.ts`) com 10.000+ boosters e seed fixa, pytest para o utilitário Python (`tests_python/`). Playwright opcional para smoke-test do fluxo completo no Chromium.
**Target Platform**: navegadores modernos (últimas 2 majors de Chrome, Firefox, Safari, Edge), sem polyfill manual; Node.js 20+ apenas para build/teste.
**Project Type**: aplicação web estática single-project + utilitário Python auxiliar no mesmo repositório.
**Performance Goals**: animação de revelação 400–1.200 ms por carta (SC-008); filtro/render do álbum < 200 ms para até 1.000 entradas (SC-009); first paint útil < 3 s em banda larga típica (SC-005).
**Constraints**: 100% client-side, servível como artefatos estáticos (Princípio I); responsivo de 320 px a ≥1.440 px (Princípio IV); WCAG AA para contraste e foco; sem URLs externas para assets do produto (Princípio V); offline após primeira carga (consequência, não exigência formal de PWA).
**Scale/Scope**: ~207 cartas no manifesto do set 151; coleção do jogador limitada a ~1.000 entradas únicas (SC-009); single user por navegador (sem multi-perfil).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação contra `.specify/memory/constitution.md` v1.0.0 (todos os princípios em vigor):

| Princípio | Veredicto | Evidência |
|-----------|-----------|-----------|
| **I. Front-End Puro (Sem Backend)** | ✅ Pass | Stack vanilla TS + Vite produz `dist/` estático. Sem servidor de aplicação. API externa (pokemontcg.io) consumida **apenas** pelo utilitário Python em build-time, nunca em runtime do jogador. (FR-026, FR-029) |
| **II. Persistência Client-Side** | ✅ Pass | Coleção em `localStorage` atrás de `CollectionStore` (camada substituível), com `schemaVersion: 1` registrado e migração documentada como hook futuro. (FR-019, FR-024, FR-025) |
| **III. Distribuição Probabilística Testável (NON-NEGOTIABLE)** | ✅ Pass | RNG Mulberry32 seedable injetado em `generateBooster(rng, catalog, distribution)`. Distribuição centralizada em `src/core/distributions.ts`. Testes em `tests/statistical/` cobrem slots 1–4 (100% Comum), slot 5 (90/10), slot 6 (60/25/10/4,5/0,5) com α = 0,01 chi-quadrado **e** bound observado ±1 p.p. sobre 10.000 boosters (SC-002). Seed fixa em CI para reprodutibilidade; UI permite forçar seed via query string `?seed=...` para bug reports. (FR-012, FR-013) |
| **IV. Responsividade Obrigatória** | ✅ Pass | Breakpoints validados: 320 px / 480 px / 768 px / 1024 px / 1440 px. Booster usa carta-única-em-foco no mobile e cartas reveladas em carrossel; álbum usa CSS Grid `repeat(auto-fill, minmax(120px, 1fr))`. Alvos clicáveis ≥44×44 CSS px. Validação manual obrigatória em ≤480 px e ≥1024 px antes do merge. (FR-027, FR-028) |
| **V. Organização de Assets em Disco** | ✅ Pass | Acervo sob `assets/01_comum/`, …, `assets/07_legendaria/`, `assets/manifest.json`. Nomes em kebab-case derivados do `id` da fonte (já é kebab-case por natureza, ex.: `sv3pt5-25.jpg`). Imagens >1 MB são re-comprimidas pelo utilitário (qualidade JPG 85). Sem URLs externas em runtime. (FR-002, FR-007, FR-029) |

**Verdict**: **Pass — sem violações.** Nenhuma entrada em Complexity Tracking exigida.

## Project Structure

### Documentation (this feature)

```text
specs/001-pokemon-booster-opener/
├── spec.md                      # /speckit-specify (com Clarifications session 2026-05-01)
├── plan.md                      # Este arquivo (/speckit-plan)
├── research.md                  # Phase 0 (/speckit-plan)
├── data-model.md                # Phase 1 (/speckit-plan)
├── quickstart.md                # Phase 1 (/speckit-plan)
├── contracts/                   # Phase 1 (/speckit-plan)
│   ├── booster-engine.md
│   ├── collection-store.md
│   ├── download-cli.md
│   └── manifest.schema.json
├── checklists/
│   └── requirements.md          # /speckit-specify
└── tasks.md                     # /speckit-tasks (próximo comando)
```

### Source Code (repository root)

```text
assets/                                    # Princípio V — acervo versionado
├── 01_comum/<id>.jpg
├── 02_incomum/<id>.jpg
├── 03_raras/<id>.jpg
├── 04_duplo_raras/<id>.jpg
├── 05_arte_secreta/<id>.jpg
├── 06_duplo_arte_secreta/<id>.jpg
├── 07_legendaria/<id>.jpg
└── manifest.json                          # FR-007a — catálogo consumido em runtime

src/
├── index.html                             # Shell estático com tabs Booster/Coleção
├── main.ts                                # Bootstrap: carrega manifest + monta App
├── core/                                  # Lógica pura, sem DOM, 100% testável
│   ├── rng.ts                             # Mulberry32 seedable
│   ├── distributions.ts                   # SLOT_DISTRIBUTIONS — única fonte da verdade
│   ├── booster.ts                         # generateBooster(rng, catalog) → Booster
│   └── buckets.ts                         # Bucket enum + ordering helpers
├── domain/
│   ├── card.ts                            # Card type
│   ├── catalog.ts                         # loadCatalog() do manifest.json + index por bucket
│   └── collection.ts                      # tipos Collection, CollectionEntry
├── persistence/
│   └── collection-store.ts                # LocalStorage-backed, schemaVersion + migrations
├── ui/
│   ├── app.ts                             # Tabs persistentes, gestão de seção ativa
│   ├── booster-view.ts                    # Booster fechado → reveal manual + Pular tudo
│   ├── collection-view.ts                 # Álbum binder + filtros + contadores
│   └── styles/
│       ├── base.css                       # tokens, reset, tipografia, breakpoints
│       ├── booster.css                    # animação flip + glow por raridade
│       └── collection.css                 # grid responsivo + silhuetas
└── utils/
    └── dom.ts                             # helpers mínimos sem framework

tests/
├── unit/                                  # Vitest
│   ├── rng.test.ts                        # determinismo, distribuição uniforme básica
│   ├── distributions.test.ts              # soma == 1.0, parâmetros corretos
│   ├── booster.test.ts                    # 6 cartas, todas únicas por id, ordem por bucket,
│   │                                      # downgrade com piso (FR-014a/b)
│   └── collection-store.test.ts           # add/clear/load/migrate, fallback sem LocalStorage
└── statistical/                           # Princípio III — gating de PR
    └── distribution.test.ts               # 10k boosters seed-fixo:
                                           # · slot 1–4 == 100% Comum
                                           # · slot 5 ~ 90/10 (chi² α=0,01 + ±1 p.p.)
                                           # · slot 6 ~ 60/25/10/4,5/0,5 (idem)

tools/
└── download_cards.py                      # CLI idempotente — popula assets/ + manifest.json

tests_python/                              # pytest
├── test_rarity_mapping.py                 # FR-003 cobertura completa do mapeamento
├── test_idempotency.py                    # FR-005 segunda execução não rebaixa
├── test_retry.py                          # FR-006 retentativas com fixture de falha
└── test_manifest_schema.py                # FR-007a — manifest.json bate com contracts/

# Build & raiz
index.html → src/index.html (vite)
package.json
tsconfig.json
vite.config.ts
pyproject.toml                             # ou requirements.txt + setup.cfg
.gitignore                                 # ignora dist/, node_modules/, .venv/, mas NÃO assets/
README.md                                  # criado nesta feature (constituição flagged como follow-up)
```

**Structure Decision**: **Single project**. A aplicação web vive em `src/` com módulos por responsabilidade (`core/` puro, `domain/`, `persistence/`, `ui/`, `utils/`); os testes ficam em `tests/` espelhando essa divisão, com **diretório `tests/statistical/` dedicado** para o gate do Princípio III. O utilitário Python é tratado como ferramenta de build separada em `tools/` (com `tests_python/` próprio) — não compartilha runtime com a aplicação web e roda apenas em build-time. Não há backend, então o layout "Web application" do template (com `frontend/` + `backend/`) é explicitamente rejeitado pelo Princípio I.

## Complexity Tracking

> Não há violações da constituição a justificar. Nenhuma linha adicional necessária.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(vazio — sem violações)_ | — | — |
