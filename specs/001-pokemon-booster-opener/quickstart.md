# Quickstart — Abridor de Boosters Pokémon TCG

**Feature**: 001-pokemon-booster-opener
**Phase**: 1 (Design)
**Audience**: desenvolvedores que vão clonar o repositório e reproduzir o ambiente.

---

## Pré-requisitos

- **Node.js** 20.x ou superior, com **npm** (ou pnpm/yarn).
- **Python** 3.11 ou superior.
- (Opcional) **API key gratuita** de [pokemontcg.io](https://pokemontcg.io) — eleva rate limit, mas não é obrigatório para um set inteiro.
- Acesso à internet apenas durante o setup inicial (download das cartas).

---

## 1. Clone e instalação

```bash
git clone <url-do-repo> pokemon-booster-opener
cd pokemon-booster-opener

# Dependências do client web
npm install

# Dependências do utilitário Python (em venv para isolamento)
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r tools/requirements.txt
```

---

## 2. Popular o acervo de cartas (one-time)

```bash
# Sem API key (rate-limited mas suficiente):
python tools/download_cards.py

# Com API key:
POKEMONTCG_API_KEY=<sua-key> python tools/download_cards.py
```

Resultado esperado em ~1–3 minutos:

```
[pkmn-cards] Listing set sv3pt5… 207 cards
[pkmn-cards] downloaded=207  skipped=0  failed=0  unmapped=0
[pkmn-cards] manifest:    assets/manifest.json
```

E a estrutura sob `assets/`:

```
assets/
├── 01_comum/                   (~41 .jpg)
├── 02_incomum/                 (~22 .jpg)
├── 03_raras/                   (~14 .jpg)
├── 04_duplo_raras/             (~17 .jpg)
├── 05_arte_secreta/            (~13 .jpg)
├── 06_duplo_arte_secreta/      (~9 .jpg)
├── 07_legendaria/              (~4 .jpg)
└── manifest.json
```

> **Idempotência**: rodar de novo sem `--force` é seguro e barato — só re-emite o manifest. Se quiser refazer todas as imagens, use `--force`.

---

## 3. Rodar o jogo em dev

```bash
npm run dev
```

Abra `http://localhost:5173` (porta padrão do Vite). A primeira tela é a seção **Booster** com um pacote fechado.

### Atalhos no jogo

| Tecla / Gesto | Efeito |
|---------------|--------|
| `Espaço`      | Avança a próxima carta. |
| Clique/toque na carta | Avança a próxima carta. |
| Botão **Próxima** | Avança a próxima carta. |
| Botão **Pular tudo** | Revela todas as cartas restantes. |
| Tab **Coleção** | Alterna para o álbum. |
| `?seed=<n>` na URL | Força a seed do RNG para reprodução de bug reports. |

---

## 4. Rodar testes

### Testes unitários (Vitest)

```bash
npm test                     # roda tudo (unit + statistical)
npm test -- tests/unit       # só unit
```

### Suite estatística (gate do Princípio III)

```bash
npm run test:statistical
# ou:
npm test -- tests/statistical
```

A suite roda 10.000 boosters com seed `0xC0FFEE` (fixa em CI). Espera:
- Slots 1–4: 100% Comum.
- Slot 5: incomum 89–91%, rara 9–11% (±1 p.p.) **e** chi-quadrado aceito a α = 0,01.
- Slot 6: rara 59–61%, dupla 24–26%, arte 9–11%, dupla-arte 3,5–5,5%, legendária 0–1,5% (faixa larga porque 0,5% × 10k = 50 ± noise) **e** chi-quadrado aceito a α = 0,01.

> **Nota sobre o slot 6 com legendária**: 0,5% sobre 10k boosters = ~50 amostras esperadas, com desvio binomial ~7. Por isso a tolerância para 07_legendaria é mais larga que ±1 p.p. — aceitamos `[0%, 1,5%]` no bound observado, e o chi-quadrado captura o resto.

### Testes do utilitário Python

```bash
source .venv/bin/activate
pytest tests_python/ -v
```

---

## 5. Build estático (para deploy)

```bash
npm run build
# Saída: dist/
```

`dist/` contém:
- `index.html`
- `assets/` (bundle JS/CSS gerado pelo Vite)
- O `assets/` raiz (cartas + manifest) **NÃO** é movido para `dist/` automaticamente — é copiado por uma etapa do Vite (`publicDir: 'assets'` mapeado para o caminho `assets/` da rota). Confira `vite.config.ts`.

Sirva `dist/` em qualquer CDN/host estático:

```bash
# Smoke local:
npx serve dist
```

Deploys testados como aderentes ao Princípio I:
- GitHub Pages
- Netlify (drop)
- Cloudflare Pages
- S3 + CloudFront
- Qualquer servidor HTTP estático

---

## 6. Validações antes de abrir PR

Conforme **Fluxo de Desenvolvimento** da constituição:

- [ ] `npm test` passa (incluindo `tests/statistical/`).
- [ ] `pytest tests_python/` passa.
- [ ] Validação manual responsiva: abrir o jogo em DevTools com viewports `375×667` (mobile) e `1280×800` (desktop). Confirmar:
  - Sem rolagem horizontal indesejada.
  - Tabs sempre visíveis.
  - Animação de revelação fluida em ambos.
  - Álbum legível em ambos.
- [ ] Inventário de assets adicionados/modificados sob `assets/` no corpo da PR.
- [ ] Se houver mudança em `src/core/distributions.ts` ou `src/core/booster.ts`: **prova** de que o teste estatístico foi rerodado e passou.

---

## 7. Troubleshooting

| Sintoma | Diagnóstico | Solução |
|--------|-------------|---------|
| `manifest.json` ausente | utilitário não rodou ou falhou | rodar `python tools/download_cards.py` |
| Álbum vazio mesmo após download | `vite.config.ts` não está copiando `assets/` para `dist/` | verificar `publicDir` |
| Booster falha com "acervo insuficiente" | bucket comum vazio | re-rodar download; conferir `unmapped[]` no manifest |
| Suite estatística falha em CI mas passa local | seed do CI ≠ seed local | confirmar `STATISTICAL_SEED=0xC0FFEE` no CI |
| LocalStorage cheio | quota >5 MB excedida (improvável; 1k entradas = ~20 KB) | `clear()` na coleção via UI |

---

## 8. Resumo do ciclo de desenvolvimento

```
clone → npm install → python tools/download_cards.py → npm run dev → editar → npm test → npm run build → ship
```

Bons sorteios. 🎴
