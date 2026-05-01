# Feature Specification: Abridor de Boosters Pokémon TCG (Set 151)

**Feature Branch**: `001-pokemon-booster-opener`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "Crie um jogo web de abrir boosters do Pokémon TCG. Antes de tudo, escreva um script Python (download_cards.py) que baixe todas as cartas do set 151 da API pokemontcg.io (filtro set.id:sv3pt5 no endpoint https://api.pokemontcg.io/v2/cards) e organize em ./assets/ nas 7 pastas a seguir mapeando as raridades da API: 01_comum (Common), 02_incomum (Uncommon), 03_raras (Rare, Rare Holo), 04_duplo_raras (Double Rare, Rare Ultra, Rare Holo EX/GX/V/VMAX), 05_arte_secreta (Illustration Rare), 06_duplo_arte_secreta (Special Illustration Rare, Rare Rainbow, Rare Secret), 07_legendaria (Hyper Rare); cada carta salva como .jpg dentro da pasta correspondente. Cada pacote tem 6 cartas únicas (nunca repete carta no mesmo pacote), exibidas em ordem da mais comum até a mais rara, com animação de revelação carta por carta. As 4 primeiras cartas são sempre comuns; a 5ª é incomum (90%) ou rara (10%); a 6ª segue a distribuição: comum 0%, incomum 0%, rara 60%, dupla rara 25%, arte secreta 10%, dupla arte secreta 4.5%, legendária 0.5%. Coleção persistente via LocalStorage com filtros por raridade e contagem de cópias. Front-end puro, responsivo, sem backend. Fora do escopo: trocas, batalhas, login, compra de boosters."

## Clarifications

### Session 2026-05-01

- Q: Modo de revelação das cartas — manual, automático ou híbrido? → A: Manual por carta, simulando a abertura real de um booster: o jogador pressiona a barra de espaço ou clica no botão "Próxima" para virar cada carta, uma de cada vez.
- Q: O que define "carta única" no booster e na coleção — o `id` da fonte (estampa específica) ou o `name` do Pokémon? → A: O `id` da fonte. Cada estampa/raridade é uma carta colecionável distinta (ex.: Pikachu Common e Pikachu Illustration Rare são duas cartas independentes), tanto para a regra de não-repetição no booster quanto para a contagem de cópias na coleção.
- Q: Estrutura de navegação da UI — tela inicial dedicada, página única com seções alternáveis, split persistente ou coleção como overlay? → A: Página única com duas seções alternáveis ("Booster" e "Coleção") em tabs/toggle no topo, sem tela intermediária e sem recarga. "Booster" é o estado inicial ao abrir o jogo.
- Q: Apresentação visual da coleção — galeria só de coletadas, modo álbum, lista textual ou galeria com contador por raridade? → A: Modo álbum (binder). Grid completo do set 151 ordenado pelo número de coleção, cartas não puxadas exibidas como silhueta/cinza, e contador global de progresso "X/Y" + contador por raridade visíveis no topo da seção.
- Q: Estratégia de fallback quando o bucket sorteado para um slot está vazio (sem cartas disponíveis no acervo)? → A: Downgrade para o bucket inferior mais próximo, com piso. Se Legendária está vazio, tenta Dupla Arte Secreta; se também vazio, Arte Secreta; e assim por diante. O slot 6 tem piso em Rara (nunca degrada para Incomum/Comum); o slot 5 tem piso em Incomum (nunca degrada para Comum); slots 1–4 falham se Comum estiver vazio. Cada fallback é registrado em log para o operador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preparar acervo de cartas do set 151 (Priority: P1)

Antes da experiência interativa existir, o jogo precisa de um acervo de imagens das cartas reais do set 151 (Scarlet & Violet 151). Um operador (desenvolvedor ou mantenedor do jogo) executa um utilitário de linha de comando que consulta a fonte oficial de dados de cartas, baixa todas as imagens do set e as organiza em uma estrutura de pastas pré-definida, com cada pasta representando um nível de raridade do jogo. Após a execução, qualquer pessoa que clonar o repositório encontra os arquivos prontos, sem necessidade de chamar APIs externas em tempo de jogo.

**Why this priority**: sem o acervo, o jogo não tem o que mostrar e nenhuma das outras user stories é viável. Esta é a fundação do produto e bloqueia tudo o que vem depois.

**Independent Test**: executar o utilitário em uma máquina limpa e verificar que (a) as 7 pastas de raridade existem sob `assets/`, (b) cada pasta contém as cartas do set 151 cuja raridade da fonte foi mapeada para aquele bucket, (c) os arquivos estão em formato `.jpg` e (d) o total de imagens baixadas confere com o total de cartas anunciadas pela fonte.

**Acceptance Scenarios**:

1. **Given** uma máquina sem `assets/` populado e com acesso à internet, **When** o operador roda o utilitário de download, **Then** as 7 pastas de raridade são criadas e cada carta do set 151 é salva como `.jpg` na pasta correspondente ao mapeamento de raridade.
2. **Given** uma execução anterior bem-sucedida, **When** o operador roda o utilitário novamente, **Then** o utilitário não rebaixa imagens já presentes (re-execução é idempotente) e relata claramente o que foi pulado.
3. **Given** uma carta da fonte cuja raridade NÃO está no mapeamento das 7 pastas, **When** o utilitário processa essa carta, **Then** a carta é registrada em um relatório de pendências (não baixada na pasta padrão) sem interromper o restante do download.
4. **Given** uma falha de rede temporária ao baixar uma imagem específica, **When** o utilitário enfrenta o erro, **Then** ele tenta novamente um número finito de vezes e, se ainda falhar, segue para a próxima carta e reporta a falha ao final.

---

### User Story 2 - Abrir um booster e revelar 6 cartas (Priority: P1)

O jogador acessa o jogo no navegador, vê um booster fechado e clica para abri-lo. O booster apresenta 6 cartas únicas (nenhuma repetida dentro do mesmo pacote), reveladas uma a uma com animação, em ordem crescente de raridade — as comuns aparecem primeiro e a carta mais rara é a última, criando suspense. O jogador pode tocar/clicar para acelerar ou avançar a revelação.

**Why this priority**: é o coração do produto. Mesmo sem coleção persistente, abrir boosters é a experiência principal e já entrega valor por si só (entretenimento, surpresa, satisfação de "puxar" cartas raras).

**Independent Test**: abrir o jogo, clicar em "abrir booster" e confirmar que (a) exatamente 6 cartas são reveladas em sequência, (b) nenhuma se repete dentro do mesmo pacote, (c) a ordem de revelação respeita raridade crescente, (d) cada slot respeita as regras de probabilidade declaradas e (e) é possível abrir um novo booster em seguida.

**Acceptance Scenarios**:

1. **Given** o jogo carregado pela primeira vez, **When** o jogador toca em "abrir booster", **Then** uma animação de abertura é exibida e seis slots de carta surgem prontos para revelação.
2. **Given** o booster aberto, **When** o jogador pressiona a barra de espaço, clica no botão "Próxima" ou toca na carta atual, **Then** a próxima carta da sequência é virada com animação e sua raridade fica visualmente destacada (borda, brilho ou efeito apropriado ao bucket).
3. **Given** os 4 primeiros slots, **When** as cartas são reveladas, **Then** todas as 4 são da raridade Comum.
4. **Given** o 5º slot, **When** a carta é revelada, **Then** ela é Incomum em aproximadamente 90% dos boosters e Rara nos demais 10%, dentro de tolerância estatística sobre uma amostra grande.
5. **Given** o 6º slot, **When** a carta é revelada, **Then** ela respeita a distribuição declarada (rara 60%, dupla rara 25%, arte secreta 10%, dupla arte secreta 4,5%, legendária 0,5%) dentro de tolerância estatística, e nunca é Comum nem Incomum.
6. **Given** um booster em curso, **When** o jogador aciona o botão "Pular tudo", **Then** as cartas restantes são reveladas imediatamente, mantendo a ordem por raridade.
7. **Given** um booster totalmente revelado, **When** o jogador escolhe abrir outro, **Then** um novo booster é gerado de forma independente, seguindo as mesmas regras.

---

### User Story 3 - Coleção persistente entre sessões (Priority: P2)

Toda carta que o jogador puxa em qualquer booster passa a fazer parte de sua coleção pessoal, que sobrevive ao recarregar a página e fechar/abrir o navegador. O jogador pode acessar uma área dedicada de "Minha Coleção" para ver todas as cartas obtidas, com a contagem de cópias de cada uma (já que a mesma carta pode aparecer em boosters diferentes).

**Why this priority**: persistência transforma o jogo de "passatempo de uma sessão" em "progresso ao longo do tempo", que é o ciclo de engajamento natural de jogos de coleção. Não bloqueia o MVP da US2, mas é o que dá longevidade ao produto.

**Independent Test**: abrir alguns boosters, fechar e reabrir o navegador na mesma máquina e confirmar que a coleção e os contadores de cópias permanecem idênticos ao estado anterior.

**Acceptance Scenarios**:

1. **Given** um jogador novo sem coleção, **When** ele abre seu primeiro booster, **Then** as 6 cartas reveladas passam a constar em "Minha Coleção" com contagem 1 cada.
2. **Given** uma coleção existente onde a carta X tem contagem 2, **When** o jogador puxa novamente a carta X em um booster, **Then** a contagem da carta X passa a 3.
3. **Given** uma coleção persistida, **When** o jogador recarrega a página, **Then** a coleção é exibida exatamente como estava antes do recarregamento.
4. **Given** um navegador onde o armazenamento local está bloqueado/indisponível, **When** o jogador abre um booster, **Then** o jogo informa claramente que o progresso não será salvo nesta sessão e ainda assim permite jogar.
5. **Given** um jogador que deseja recomeçar do zero, **When** ele aciona uma opção de "limpar coleção" (com confirmação), **Then** todas as cartas e contadores são apagados do armazenamento local.

---

### User Story 4 - Filtrar e explorar a coleção por raridade (Priority: P3)

Na área de coleção, o jogador filtra a vista por uma das 7 raridades para focar nas cartas daquele bucket, e vê rapidamente quantas cópias possui de cada uma e quais ainda lhe faltam dentro daquela raridade.

**Why this priority**: melhora a usabilidade depois que a coleção cresce. Sem filtros o jogador ainda consegue jogar e ver a coleção, mas perde tempo localizando cartas específicas. É polimento sobre a US3.

**Independent Test**: com pelo menos 30 cartas na coleção espalhadas por raridades diferentes, aplicar cada um dos 7 filtros e confirmar que apenas cartas do bucket selecionado aparecem, com contagens corretas.

**Acceptance Scenarios**:

1. **Given** uma coleção com cartas de múltiplas raridades, **When** o jogador seleciona o filtro "Comum", **Then** apenas cartas Comuns são exibidas com suas respectivas contagens de cópias.
2. **Given** o filtro "Legendária" selecionado, **When** o jogador ainda não puxou nenhuma Hyper Rare, **Then** a vista exibe todos os slots de Legendárias como silhuetas (nenhuma revelada), com o contador da raridade exibindo `0/<total Legendárias>`.
3. **Given** qualquer filtro ativo, **When** o jogador volta para o filtro "Todas", **Then** a coleção completa volta a ser exibida.

---

### Edge Cases

- **Bucket de raridade vazio em tempo de sorteio**: se o bucket sorteado para um slot estiver sem cartas disponíveis no acervo (set incompleto, pendência de download ou já esgotado pela regra de unicidade do booster), o sistema MUST aplicar **downgrade para o bucket inferior mais próximo, com piso**: o slot 6 cai sucessivamente Legendária → Dupla Arte Secreta → Arte Secreta → Dupla Rara → Rara, mas **nunca** para Incomum ou Comum; o slot 5 cai Rara → Incomum, mas **nunca** para Comum; slots 1–4 não têm fallback (se Comum estiver vazio, o booster não pode ser gerado e o jogador recebe mensagem clara de "acervo insuficiente"). Cada fallback aplicado MUST ser registrado em log para o operador, sem travar a sessão do jogador.
- **Imagem da carta falha ao carregar**: o slot exibe um placeholder com o nome da carta e mantém a contabilidade da raridade puxada para fins de coleção e estatística.
- **LocalStorage cheio/indisponível**: o jogo continua funcional em modo "sessão volátil"; nada quebra, mas a coleção não é persistida e o usuário é avisado.
- **Set ainda em download/parcial**: se `assets/` existir mas estiver incompleto, o jogo trabalha com o que tem, e o sorteio só usa as cartas presentes em cada bucket.
- **Probabilidades não somam 100%**: caso futuras alterações resultem em soma diferente de 100% para um slot, o sistema deve falhar de forma visível em modo de desenvolvimento (não silenciosa) e usar normalização documentada como fallback.
- **Animação interrompida por navegação**: se o jogador sair da tela durante a revelação, o booster atual é considerado concluído; cartas ainda não exibidas são adicionadas à coleção mesmo assim (consistência sobre apresentação).
- **Carta da fonte sem raridade reconhecida**: o utilitário de download a registra em relatório de pendências e não a inclui nas pastas oficiais; ela não entra em sorteio até que a regra de mapeamento seja atualizada.
- **Reabertura rápida de boosters consecutivos**: a interface deve aceitar abrir vários boosters seguidos sem regressão de desempenho perceptível.
- **Viewport muito estreito (320px)**: a tela de booster deve mostrar o pacote e a carta atual sem corte; cartas reveladas anteriores podem deslizar para um carrossel/lista.

## Requirements *(mandatory)*

### Functional Requirements

#### Acervo de cartas (utilitário de preparação)

- **FR-001**: O utilitário de preparação de acervo MUST consultar a fonte oficial de dados de cartas para obter todas as cartas pertencentes ao set conhecido como "151" (Scarlet & Violet 151) e baixar a imagem em alta resolução de cada carta no formato `.jpg`.
- **FR-002**: O utilitário MUST organizar as imagens sob a raiz `assets/` em exatamente 7 subpastas, nesta ordem fixa: `01_comum`, `02_incomum`, `03_raras`, `04_duplo_raras`, `05_arte_secreta`, `06_duplo_arte_secreta`, `07_legendaria`.
- **FR-003**: O utilitário MUST mapear as raridades da fonte para os buckets locais segundo a tabela:
    - `01_comum` ← Common
    - `02_incomum` ← Uncommon
    - `03_raras` ← Rare, Rare Holo
    - `04_duplo_raras` ← Double Rare, Rare Ultra, Rare Holo EX, Rare Holo GX, Rare Holo V, Rare Holo VMAX
    - `05_arte_secreta` ← Illustration Rare
    - `06_duplo_arte_secreta` ← Special Illustration Rare, Rare Rainbow, Rare Secret
    - `07_legendaria` ← Hyper Rare
- **FR-004**: O utilitário MUST nomear cada arquivo de forma estável e única (por exemplo, identificador da carta na fonte) para que execuções repetidas reconheçam arquivos já baixados.
- **FR-005**: O utilitário MUST ser idempotente: ao re-executar, ele NÃO rebaixa imagens já presentes localmente e produz o mesmo estado final.
- **FR-006**: O utilitário MUST tratar falhas de rede com retentativas finitas por carta e MUST emitir um relatório final listando cartas baixadas, puladas, falhas e cartas com raridade não mapeada.
- **FR-007**: O utilitário MUST recusar-se a sobrescrever pastas que não pertençam ao conjunto das 7 oficiais e MUST nunca tocar em arquivos fora de `assets/`.
- **FR-007a**: O utilitário MUST produzir, ao final da execução, um manifesto consolidado do catálogo (artefato estático sob `assets/`) contendo, para cada carta baixada com sucesso, ao menos: `id` estável da fonte, `name`, raridade-fonte, bucket de raridade local, número de coleção (collection number) e caminho relativo da imagem. O manifesto MUST ser o suficiente para a aplicação web montar o álbum completo sem chamadas externas.

#### Sorteio do booster

- **FR-008**: O sistema MUST gerar um booster com exatamente 6 cartas; nenhuma carta MUST se repetir dentro do mesmo booster, onde "mesma carta" é definida pela igualdade do `id` estável da fonte (estampa específica). Variantes de raridade do mesmo Pokémon (ex.: Pikachu Common vs. Pikachu Illustration Rare) são cartas distintas e podem coexistir no mesmo booster.
- **FR-009**: O sistema MUST sortear os slots 1, 2, 3 e 4 sempre do bucket `01_comum`.
- **FR-010**: O sistema MUST sortear o slot 5 segundo a distribuição: 90% `02_incomum`, 10% `03_raras`.
- **FR-011**: O sistema MUST sortear o slot 6 segundo a distribuição: 60% `03_raras`, 25% `04_duplo_raras`, 10% `05_arte_secreta`, 4,5% `06_duplo_arte_secreta`, 0,5% `07_legendaria`. As probabilidades MUST somar 100% e MUST ser parametrizadas em um único ponto da configuração.
- **FR-012**: O sistema MUST usar uma fonte de aleatoriedade testável e capaz de receber uma seed determinística para reprodução em testes e bug reports.
- **FR-013**: O sistema MUST validar a distribuição via testes automatizados que comparem frequências observadas em uma amostra grande de boosters contra as probabilidades esperadas, com tolerância estatística declarada.
- **FR-014**: Dentro de um bucket sorteado, o sistema MUST escolher uma carta uniformemente entre as cartas presentes naquele bucket que ainda não foram usadas neste booster.
- **FR-014a**: Quando o bucket sorteado para um slot estiver vazio (zero cartas disponíveis para escolha), o sistema MUST aplicar **downgrade determinístico** para o bucket imediatamente inferior na ordem `07_legendaria > 06_duplo_arte_secreta > 05_arte_secreta > 04_duplo_raras > 03_raras > 02_incomum > 01_comum`, repetindo até encontrar um bucket não vazio. O downgrade MUST respeitar pisos:
    - **Slot 6**: piso em `03_raras` (nunca degrada para `02_incomum` ou `01_comum`).
    - **Slot 5**: piso em `02_incomum` (nunca degrada para `01_comum`).
    - **Slots 1–4**: sem fallback. Se `01_comum` estiver vazio, o booster falha e o jogador é informado de "acervo insuficiente".
- **FR-014b**: Cada aplicação de downgrade MUST ser registrada em log estruturado (bucket sorteado original, bucket efetivo após downgrade, slot afetado), sem interromper a sessão do jogador.

#### Apresentação e revelação

- **FR-015**: O sistema MUST exibir as 6 cartas reveladas em ordem crescente de raridade (slots 1→6 do mais comum ao mais raro), respeitando a sequência fixa: 4 comuns, depois o slot incomum/raro, depois o slot raro+.
- **FR-016**: O sistema MUST animar a revelação carta por carta, com efeito visual coerente com a raridade (por exemplo, brilho/holográfico para raridades superiores).
- **FR-017**: O sistema MUST exigir uma ação explícita do jogador para revelar cada uma das 6 cartas — uma por vez, na ordem definida — aceitando como gatilho:
    - tecla `Espaço` (barra de espaço) no teclado;
    - clique/toque no botão dedicado "Próxima";
    - clique/toque na carta atual ainda virada para baixo.
- **FR-017a**: O sistema MUST oferecer um botão "Pular tudo" que revela imediatamente todas as cartas restantes do booster, mantendo a ordem por raridade.
- **FR-017b**: O sistema MUST impedir que uma mesma ação (uma tecla/clique) avance mais de uma carta — cada gesto revela exatamente a próxima carta da sequência.
- **FR-018**: O sistema MUST permitir abrir múltiplos boosters consecutivos sem recarregar a página.
- **FR-018a**: A aplicação MUST apresentar uma única página com duas seções alternáveis em um controle persistente no topo (tabs/toggle): **"Booster"** (estado inicial ao abrir o jogo) e **"Coleção"**. Trocar entre seções MUST acontecer em uma interação (clique/toque) e sem recarga de página.
- **FR-018b**: O controle de navegação entre seções MUST permanecer visível e acessível em todos os tamanhos de viewport suportados, incluindo durante a animação de revelação de cartas.

#### Coleção e persistência

- **FR-019**: O sistema MUST persistir a coleção do jogador no armazenamento local do navegador (LocalStorage), de forma a sobreviver a recargas de página e reaberturas do navegador no mesmo dispositivo.
- **FR-020**: O sistema MUST registrar cada carta puxada na coleção, mantendo uma contagem de cópias por carta única, sendo a unicidade definida pelo `id` estável da fonte. Variantes do mesmo Pokémon em raridades diferentes ocupam entradas independentes na coleção.
- **FR-021**: O sistema MUST oferecer uma seção "Coleção" em **modo álbum (binder)**: um grid responsivo com **um slot para cada carta do set 151**, ordenado pelo número de coleção crescente. Cartas já puxadas pelo jogador MUST exibir a imagem real e um indicador de cópias possuídas (`×N`). Cartas ainda não puxadas MUST aparecer como **silhueta/placeholder** (sem revelar a arte) com o número de coleção visível, deixando claro que o slot existe e o que falta para preenchê-lo.
- **FR-021a**: A seção "Coleção" MUST exibir, em local persistente no topo, um **contador global de progresso** no formato `X/Y` (cartas únicas possuídas / total do set) e um **detalhamento por raridade** (uma contagem por bucket: ex.: `Comum 18/41 · Incomum 9/22 · …`). Os totais por bucket MUST ser derivados do catálogo (FR-007a), não codificados manualmente.
- **FR-022**: O sistema MUST oferecer filtros que permitam ao jogador visualizar a coleção restrita a uma das 7 raridades, ou ver "todas". Quando um filtro de raridade está ativo, o álbum exibe apenas os slots daquele bucket (coletados e não coletados), e o contador de progresso reflete somente o bucket filtrado.
- **FR-023**: O sistema MUST oferecer uma ação explícita para limpar a coleção, com confirmação do jogador.
- **FR-024**: O sistema MUST encapsular o acesso à persistência atrás de uma camada substituível, para permitir trocar o mecanismo de armazenamento sem reescrever a aplicação.
- **FR-025**: O sistema MUST tratar com clareza o caso de armazenamento local indisponível ou cheio: a sessão continua jogável, mas o jogador é avisado de que o progresso não será salvo.

#### Plataforma e responsividade

- **FR-026**: O sistema MUST funcionar como aplicação 100% client-side, servível como arquivos estáticos, sem nenhum servidor de aplicação próprio.
- **FR-027**: O sistema MUST funcionar em viewports a partir de 320px de largura até pelo menos 1440px sem rolagem horizontal indesejada e sem corte de conteúdo crítico.
- **FR-028**: O sistema MUST suportar interação por toque e por mouse, com alvos clicáveis adequados ao toque (≥44×44 CSS px).
- **FR-029**: O sistema MUST referenciar imagens das cartas exclusivamente por caminhos relativos sob `assets/`, sem URLs externas.

#### Fora do escopo

- **FR-030**: O sistema MUST NOT incluir trocas entre jogadores, batalhas, sistema de login/contas ou compra/economia de boosters nesta versão.

### Key Entities *(include if feature involves data)*

- **Carta**: representa uma carta única do set 151. Atributos relevantes: identificador estável (vindo da fonte) — **chave de identidade**, nome do Pokémon, raridade-fonte, bucket de raridade local (1 a 7), caminho do arquivo de imagem em `assets/`. Não há estado mutável por carta — é referência fixa. Cartas com o mesmo `name` mas `id` diferentes (variantes de estampa/raridade) são entidades distintas em todos os contextos do sistema (sorteio, unicidade, coleção, filtros).
- **Bucket de Raridade**: um dos 7 níveis (`01_comum` a `07_legendaria`). Agrupa cartas para fins de sorteio e filtragem; cada bucket conhece o conjunto de cartas que possui.
- **Booster**: instância gerada no momento da abertura. Composto por 6 entradas ordenadas por raridade crescente; cada entrada referencia uma Carta única dentro do booster. Efêmero — não precisa ser persistido após a coleção registrar as cartas.
- **Coleção do Jogador**: estado persistente local. Mapeia identificador da carta → contagem de cópias possuídas. Inclui também versão do schema para permitir migrações futuras.
- **Distribuição de Slot**: configuração que mapeia o índice do slot (1 a 6) para uma distribuição de probabilidade sobre buckets. Definida em um único ponto de configuração e usada tanto pelo runtime quanto pelos testes estatísticos.
- **Relatório de Download**: artefato gerado pelo utilitário de preparação. Lista cartas baixadas, puladas (já presentes), com falha, e cartas cuja raridade-fonte não foi mapeada nos 7 buckets.
- **Catálogo (Manifesto)**: artefato estático persistido sob `assets/` pelo utilitário de preparação. Lista todas as cartas do set 151 baixadas com sucesso, com `id`, `name`, raridade-fonte, bucket local, número de coleção e caminho da imagem. Consumido pela aplicação web em runtime para montar o álbum completo (FR-021), os contadores de progresso (FR-021a) e validar o sorteio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir de uma cópia limpa do projeto e com acesso à internet, um operador completa o download de todas as cartas do set 151 e tem `assets/` populado nas 7 pastas em até 10 minutos.
- **SC-002**: Em uma amostra de 10.000 boosters simulados, a frequência observada de cada bucket no slot 5 e no slot 6 está dentro de ±1 ponto percentual da probabilidade declarada (com seed fixa para reprodutibilidade), e os slots 1–4 são 100% Comum.
- **SC-003**: Em 100 boosters consecutivos abertos por um mesmo usuário, 0 boosters apresentam carta repetida internamente.
- **SC-004**: Após abrir boosters, fechar o navegador e reabrir, 100% das cartas previamente coletadas e suas contagens permanecem visíveis na coleção.
- **SC-005**: A primeira tela útil do jogo (booster pronto para ser aberto) carrega em até 3 segundos em uma conexão de banda larga típica e em um dispositivo de gama média.
- **SC-006**: O jogo é operável e legível em viewports de 320px a 1440px de largura, em pelo menos as duas últimas major versions de Chrome, Firefox, Safari e Edge.
- **SC-007**: Em testes de usabilidade rápidos (5+ usuários), 100% completam a abertura de um booster e a visualização da coleção sem assistência, na primeira tentativa.
- **SC-008**: A animação de revelação de uma carta (do gatilho do jogador até a imagem totalmente visível e legível) leva entre 400 ms e 1.200 ms, com a próxima ação do jogador aceita imediatamente após esse intervalo — suficiente para criar suspense, sem travar o ritmo.
- **SC-009**: A área de coleção, com qualquer filtro de raridade aplicado, atualiza visualmente em menos de 200 ms para coleções com até 1.000 entradas.

## Assumptions

- O set "151" referido pelo usuário corresponde ao set Scarlet & Violet 151 (identificador `sv3pt5` na fonte de dados pública), conforme indicado no input do usuário.
- A fonte oficial de dados de cartas fornece, para cada carta do set, uma imagem em resolução adequada que pode ser persistida localmente como `.jpg`. Caso a fonte forneça PNG, o utilitário converte para JPG.
- O total de cartas do set é estável durante o desenvolvimento (na ordem de ~200 cartas); pequenas variações da fonte são absorvidas pelo utilitário sem mudança de código.
- O jogador-alvo joga sozinho, sem identificação. Não há multiusuário no mesmo navegador além de "perfil único por dispositivo/navegador" implícito pelo armazenamento local.
- Não há economia interna: boosters são abertos sob demanda, sem custo, sem limite, sem moeda.
- Não há som obrigatório nesta versão; efeitos sonoros podem ser adicionados depois sem mudar a especificação.
- O jogo pode rodar offline após a primeira carga, desde que o navegador tenha cacheado os assets — não é uma exigência formal de PWA, apenas uma consequência do design client-side.
- Português é o idioma da interface por padrão; nomes próprios de cartas permanecem como vêm da fonte (em inglês).
- A distribuição de probabilidade do slot 6 dada pelo usuário soma exatamente 100% (60 + 25 + 10 + 4,5 + 0,5) e é a fonte da verdade para implementação e testes.
- A "ordem da mais comum até a mais rara" segue a ordem dos buckets `01_comum < 02_incomum < 03_raras < 04_duplo_raras < 05_arte_secreta < 06_duplo_arte_secreta < 07_legendaria`. Empates de bucket são exibidos na ordem em que foram sorteados.
- O acervo é tratado como conteúdo somente-leitura distribuído com o jogo; o jogador final não roda o utilitário de download.
