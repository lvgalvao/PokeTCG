# Abridor de Boosters · Pokémon TCG · Set 151

Jogo web 100% client-side de abrir boosters do set Scarlet & Violet 151 (`sv3pt5`).
Sem backend, sem login, coleção persistente em LocalStorage. Front-end vanilla TS + Vite.

## Highlights

- **Booster manual** — abrir, pressionar `Espaço` ou clicar para virar carta a carta
  em ordem crescente de raridade.
- **Distribuição estatisticamente testada** — chi-quadrado α=0,01 + bound ±1 p.p. sobre
  10.000 boosters (Princípio III da constituição).
- **Modo álbum (binder)** — grid completo do set com silhuetas para cartas não puxadas
  e contadores de progresso por raridade.
- **Coleção persistente** com filtros, contagem de cópias e degradação suave quando o
  LocalStorage está indisponível.
- **Responsivo** de 320 px a ≥1.440 px, sem rolagem horizontal.
- **Zero deps runtime de UI** (vanilla TS); bundle final < 30 kB gzip.

## Quickstart

Ver [`specs/001-pokemon-booster-opener/quickstart.md`](specs/001-pokemon-booster-opener/quickstart.md)
para o passo-a-passo completo. Resumo:

```bash
npm install
python -m venv .venv && source .venv/bin/activate && pip install -r tools/requirements.txt
python tools/download_cards.py     # popula assets/ a partir da pokemontcg.io
npm run dev                        # http://localhost:5173
```

## Testes

```bash
npm test                           # unit + statistical (gate Princípio III)
npm run test:statistical           # só a suite estatística
.venv/bin/pytest tests_python/     # testes do utilitário de download
```

## Documentação viva

- [Constituição](.specify/memory/constitution.md) — invariantes do projeto (v1.0.0).
- [Spec da feature](specs/001-pokemon-booster-opener/spec.md) — user stories,
  requisitos funcionais e critérios de sucesso.
- [Plano](specs/001-pokemon-booster-opener/plan.md) — decisões técnicas e
  Constitution Check.
- [Tasks](specs/001-pokemon-booster-opener/tasks.md) — quebra de tarefas executável.

## Build estático

```bash
npm run build
npx serve dist                     # qualquer host estático serve
```

`dist/` é servível em GitHub Pages, Netlify, S3+CloudFront, Cloudflare Pages, etc.

## Licença

Ver [LICENSE](LICENSE) (a definir). As imagens das cartas são de propriedade da
Nintendo/Game Freak/The Pokémon Company; este projeto é uso pessoal/educacional sob
fair use, baixadas dinamicamente da API pública [pokemontcg.io](https://pokemontcg.io).
