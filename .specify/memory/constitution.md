<!--
SYNC IMPACT REPORT
Version change: TEMPLATE → 1.0.0 (ratificação inicial)
Princípios definidos:
  - I. Front-End Puro (Sem Backend)
  - II. Persistência Client-Side
  - III. Distribuição Probabilística Testável (NON-NEGOTIABLE)
  - IV. Responsividade Obrigatória
  - V. Organização de Assets em Disco
Seções adicionadas:
  - Restrições Técnicas
  - Fluxo de Desenvolvimento
  - Governance
Seções removidas: nenhuma (placeholders genéricos do template substituídos)
Templates avaliados:
  ✅ .specify/templates/plan-template.md — Constitution Check delegada à constituição;
     a opção "Web application (frontend + backend)" do exemplo de estrutura permanece
     como exemplo, mas o Princípio I a torna inelegível para este projeto. Sem alteração
     estrutural exigida; gating ocorre no Constitution Check do plano.
  ✅ .specify/templates/spec-template.md — sem dependência direta dos princípios; sem mudança.
  ✅ .specify/templates/tasks-template.md — placeholders genéricos; compatível com os princípios.
  ✅ .specify/templates/checklist-template.md — não inspecionado em detalhe; estrutura genérica.
  ⚠ README.md — inexistente. Recomenda-se criar antes do primeiro `/speckit-plan` para
     dar contexto de produto (escopo do uso de aleatoriedade, público-alvo, etc.).
Follow-ups:
  - TODO(README): criar README descrevendo escopo do produto e tipos de distribuições suportadas.
  - TODO(RATIFICATION_AUTHORITY): confirmar mantenedor responsável pelas emendas (atualmente
     assumido como o autor do repositório, Luciano Filho).
-->

# FirstProjectSpecKit Constitution

## Core Principles

### I. Front-End Puro (Sem Backend)

A aplicação MUST executar inteiramente no navegador do cliente. É proibido depender de
servidor de aplicação próprio, banco remoto ou serviço backend custom. Quando comunicação
externa for necessária, ela MUST se limitar a recursos estáticos públicos (CDNs, JSON
estático, GitHub Pages ou equivalentes). A entrega final MUST ser servível como conjunto
de arquivos estáticos (HTML/CSS/JS/assets) sem runtime server-side.

**Rationale**: simplifica deploy (hosting estático), elimina superfície de ataque server-side,
garante portabilidade e mantém custo operacional próximo de zero.

### II. Persistência Client-Side

Todo estado persistente do usuário MUST viver no navegador (localStorage, IndexedDB,
sessionStorage ou File System Access API) — nunca em servidor remoto controlado pelo
projeto. O acesso à camada de persistência MUST ser encapsulado em um módulo dedicado
para permitir troca de mecanismo sem reescrever a aplicação. Mudanças de schema entre
versões MUST ser explícitas, versionadas em código e acompanhadas de migração não
destrutiva quando o dado já existir no cliente.

**Rationale**: coerente com o Princípio I, dá ao usuário controle total dos próprios dados,
viabiliza uso offline e evita compliance overhead de armazenamento server-side.

### III. Distribuição Probabilística Testável (NON-NEGOTIABLE)

Toda lógica que produz resultados aleatórios ou probabilísticos MUST:

- ser implementada atrás de uma interface determinística que aceite uma fonte de
  aleatoriedade injetável (RNG seedable, ex.: Mulberry32, PCG, xoroshiro);
- possuir testes automatizados que validem a distribuição esperada sob tolerância
  estatística declarada (chi-quadrado, intervalo de confiança ou bound equivalente),
  com seed fixa para reprodutibilidade;
- expor seed e parâmetros de configuração na UI ou em logs para permitir reprodução
  em bug reports.

PRs que introduzam, alterem ou removam comportamento aleatório sem teste estatístico
correspondente MUST ser rejeitados.

**Rationale**: a aleatoriedade é o núcleo funcional do produto; sem testes estatísticos,
regressões silenciosas viesam resultados e destroem a confiança do usuário.

### IV. Responsividade Obrigatória

Toda tela e componente MUST funcionar corretamente em viewports de 320px (mobile
pequeno) até ≥1440px (desktop wide), sem rolagem horizontal indesejada, sem corte de
conteúdo crítico e sem perda de interação por toque (alvos ≥44×44 CSS px). Cada feature
MUST declarar no plano os breakpoints validados e MUST ser verificada manualmente em
pelo menos um tamanho mobile (≤480px) e um desktop (≥1024px) antes do merge.

**Rationale**: o público acessa por dispositivos heterogêneos; falhas de responsividade
são bugs funcionais, não cosméticos, e quebram o produto na maioria dos contextos reais.

### V. Organização de Assets em Disco

Assets estáticos (imagens, áudios, vídeos, fontes, JSON de dados, ícones) MUST residir
em diretórios versionados sob uma raiz `assets/`, segmentados por tipo
(`assets/images/`, `assets/audio/`, `assets/data/`, `assets/fonts/`, `assets/icons/`, ...).
Nomes de arquivo MUST ser kebab-case e descritivos do conteúdo. Referências em código
MUST usar caminho relativo estável; URLs externas para assets de produto são proibidas
salvo justificativa registrada em Complexity Tracking do plano. Assets pesados (>1MB)
MUST ser otimizados (compressão, sprite, formato moderno) antes do commit.

**Rationale**: previsibilidade na localização dos assets reduz fricção entre design, dev e
revisão; mantém o repositório auto-contido, auditável e diff-friendly.

## Restrições Técnicas

- **Stack runtime**: HTML5, CSS3 (com ou sem framework leve), JavaScript/TypeScript ES2020+.
  Frameworks UI são permitidos desde que compilem para artefatos estáticos.
- **Build**: a saída MUST ser uma pasta de distribuição estática (`dist/` ou equivalente)
  servível por qualquer CDN/hosting estático sem runtime server-side.
- **Dependências**: dependências runtime MUST ser auditadas quanto a licença e peso.
  Dependências que exijam runtime server-only são proibidas no bundle.
- **Compatibilidade**: as duas últimas major versions de Chrome, Firefox, Safari e Edge
  MUST funcionar sem polyfill manual; quebras intencionais MUST ser documentadas.
- **Acessibilidade**: componentes interativos MUST ter rótulos acessíveis, foco visível e
  contraste mínimo WCAG AA.

## Fluxo de Desenvolvimento

- Cada feature MUST passar pelo ciclo `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
  → `/speckit-implement`, com Constitution Check executado no plano.
- Toda PR MUST incluir, quando aplicável: (a) testes de distribuição estatística para
  qualquer alteração que toque RNG (Princípio III); (b) evidência de validação responsiva
  — screenshots ou descrição com breakpoints (Princípio IV); (c) inventário dos assets
  adicionados ou modificados sob `assets/` (Princípio V).
- Violações de qualquer princípio MUST ser registradas em `Complexity Tracking` do plano
  com justificativa e alternativa simples rejeitada — sem essa entrada, o PR é bloqueado.
- Code review MUST verificar conformidade com cada princípio aplicável antes do merge;
  reviewers podem solicitar prova adicional para o Princípio III.

## Governance

Esta constituição supersede convenções e práticas tácitas do projeto. Emendas seguem o
seguinte rito:

- **Proposta**: PR alterando `.specify/memory/constitution.md` com Sync Impact Report
  prependado em comentário HTML no topo do arquivo.
- **Versionamento (semver)**: MAJOR para remoção ou redefinição incompatível de princípio
  (ex.: relaxar NON-NEGOTIABLE); MINOR para novo princípio ou expansão material de
  guidance; PATCH para clarificações, redação ou correções não semânticas.
- **Aprovação**: revisão explícita do mantenedor; emendas que toquem princípios marcados
  NON-NEGOTIABLE exigem plano de migração documentado.
- **Compliance**: todo `/speckit-plan` MUST executar Constitution Check; reviewers MUST
  recusar PRs que descumpram princípios sem justificativa registrada.
- **Guidance runtime**: orientação operacional viva em `CLAUDE.md` e demais arquivos de
  agent guidance referenciados pelo projeto.

**Version**: 1.0.0 | **Ratified**: 2026-05-01 | **Last Amended**: 2026-05-01
