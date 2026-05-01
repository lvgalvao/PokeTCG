# Feature Specification: Abridor de Boosters Pokémon TCG (Set 151)

**Feature Branch**: `001-pokemon-booster-opener`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description: "Crie um jogo web de abrir boosters do Pokémon TCG. Antes de tudo, escreva um script Python (download_cards.py) que baixe todas as cartas do set 151 da API pokemontcg.io (filtro set.id:sv3pt5 no endpoint https://api.pokemontcg.io/v2/cards) e organize em ./assets/ nas 7 pastas a seguir mapeando as raridades da API: 01_comum (Common), 02_incomum (Uncommon), 03_raras (Rare, Rare Holo), 04_duplo_raras (Double Rare, Rare Ultra, Rare Holo EX/GX/V/VMAX), 05_arte_secreta (Illustration Rare), 06_duplo_arte_secreta (Special Illustration Rare, Rare Rainbow, Rare Secret), 07_legendaria (Hyper Rare); cada carta salva como .jpg dentro da pasta correspondente. Cada pacote tem 6 cartas únicas (nunca repete carta no mesmo pacote), exibidas em ordem da mais comum até a mais rara, com animação de revelação carta por carta. As 4 primeiras cartas são sempre comuns; a 5ª é incomum (90%) ou rara (10%); a 6ª segue a distribuição: comum 0%, incomum 0%, rara 60%, dupla rara 25%, arte secreta 10%, dupla arte secreta 4.5%, legendária 0.5%. Coleção persistente via LocalStorage com filtros por raridade e contagem de cópias. Front-end puro, responsivo, sem backend. Fora do escopo: trocas, batalhas, login, compra de boosters."

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
2. **Given** o booster aberto, **When** o jogador interage para revelar a próxima carta, **Then** a próxima carta da sequência é virada com animação e sua raridade fica visualmente destacada (borda, brilho ou efeito apropriado ao bucket).
3. **Given** os 4 primeiros slots, **When** as cartas são reveladas, **Then** todas as 4 são da raridade Comum.
4. **Given** o 5º slot, **When** a carta é revelada, **Then** ela é Incomum em aproximadamente 90% dos boosters e Rara nos demais 10%, dentro de tolerância estatística sobre uma amostra grande.
5. **Given** o 6º slot, **When** a carta é revelada, **Then** ela respeita a distribuição declarada (rara 60%, dupla rara 25%, arte secreta 10%, dupla arte secreta 4,5%, legendária 0,5%) dentro de tolerância estatística, e nunca é Comum nem Incomum.
6. **Given** um booster em curso, **When** o jogador opta por pular a animação, **Then** as cartas restantes são reveladas imediatamente, mantendo a ordem por raridade.
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
2. **Given** o filtro "Legendária" selecionado, **When** o jogador ainda não puxou nenhuma Hyper Rare, **Then** a vista exibe um estado vazio claro indicando "nenhuma carta nesta raridade ainda".
3. **Given** qualquer filtro ativo, **When** o jogador volta para o filtro "Todas", **Then** a coleção completa volta a ser exibida.

---

### Edge Cases

- **Bucket de raridade vazio em tempo de sorteio**: se um bucket exigido pelas regras (por exemplo, "legendária" no slot 6) estiver sem cartas no acervo (set incompleto ou pendência de download), o jogo deve detectar e degradar de forma previsível — substituir pelo bucket mais próximo disponível e informar o ocorrido em log/mensagem para o operador, sem travar a sessão do jogador.
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

#### Sorteio do booster

- **FR-008**: O sistema MUST gerar um booster com exatamente 6 cartas; nenhuma carta MUST se repetir dentro do mesmo booster.
- **FR-009**: O sistema MUST sortear os slots 1, 2, 3 e 4 sempre do bucket `01_comum`.
- **FR-010**: O sistema MUST sortear o slot 5 segundo a distribuição: 90% `02_incomum`, 10% `03_raras`.
- **FR-011**: O sistema MUST sortear o slot 6 segundo a distribuição: 60% `03_raras`, 25% `04_duplo_raras`, 10% `05_arte_secreta`, 4,5% `06_duplo_arte_secreta`, 0,5% `07_legendaria`. As probabilidades MUST somar 100% e MUST ser parametrizadas em um único ponto da configuração.
- **FR-012**: O sistema MUST usar uma fonte de aleatoriedade testável e capaz de receber uma seed determinística para reprodução em testes e bug reports.
- **FR-013**: O sistema MUST validar a distribuição via testes automatizados que comparem frequências observadas em uma amostra grande de boosters contra as probabilidades esperadas, com tolerância estatística declarada.
- **FR-014**: Dentro de um bucket sorteado, o sistema MUST escolher uma carta uniformemente entre as cartas presentes naquele bucket que ainda não foram usadas neste booster.

#### Apresentação e revelação

- **FR-015**: O sistema MUST exibir as 6 cartas reveladas em ordem crescente de raridade (slots 1→6 do mais comum ao mais raro), respeitando a sequência fixa: 4 comuns, depois o slot incomum/raro, depois o slot raro+.
- **FR-016**: O sistema MUST animar a revelação carta por carta, com efeito visual coerente com a raridade (por exemplo, brilho/holográfico para raridades superiores).
- **FR-017**: O sistema MUST permitir ao jogador acelerar ou pular a animação restante e revelar todas as cartas ao mesmo tempo.
- **FR-018**: O sistema MUST permitir abrir múltiplos boosters consecutivos sem recarregar a página.

#### Coleção e persistência

- **FR-019**: O sistema MUST persistir a coleção do jogador no armazenamento local do navegador (LocalStorage), de forma a sobreviver a recargas de página e reaberturas do navegador no mesmo dispositivo.
- **FR-020**: O sistema MUST registrar cada carta puxada na coleção, mantendo uma contagem de cópias por carta única.
- **FR-021**: O sistema MUST oferecer uma área de "Minha Coleção" com todas as cartas obtidas e suas contagens.
- **FR-022**: O sistema MUST oferecer filtros que permitam ao jogador visualizar a coleção restrita a uma das 7 raridades, ou ver "todas".
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

- **Carta**: representa uma carta única do set 151. Atributos relevantes: identificador estável (vindo da fonte), nome, raridade-fonte, bucket de raridade local (1 a 7), caminho do arquivo de imagem em `assets/`. Não há estado mutável por carta — é referência fixa.
- **Bucket de Raridade**: um dos 7 níveis (`01_comum` a `07_legendaria`). Agrupa cartas para fins de sorteio e filtragem; cada bucket conhece o conjunto de cartas que possui.
- **Booster**: instância gerada no momento da abertura. Composto por 6 entradas ordenadas por raridade crescente; cada entrada referencia uma Carta única dentro do booster. Efêmero — não precisa ser persistido após a coleção registrar as cartas.
- **Coleção do Jogador**: estado persistente local. Mapeia identificador da carta → contagem de cópias possuídas. Inclui também versão do schema para permitir migrações futuras.
- **Distribuição de Slot**: configuração que mapeia o índice do slot (1 a 6) para uma distribuição de probabilidade sobre buckets. Definida em um único ponto de configuração e usada tanto pelo runtime quanto pelos testes estatísticos.
- **Relatório de Download**: artefato gerado pelo utilitário de preparação. Lista cartas baixadas, puladas (já presentes), com falha, e cartas cuja raridade-fonte não foi mapeada nos 7 buckets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir de uma cópia limpa do projeto e com acesso à internet, um operador completa o download de todas as cartas do set 151 e tem `assets/` populado nas 7 pastas em até 10 minutos.
- **SC-002**: Em uma amostra de 10.000 boosters simulados, a frequência observada de cada bucket no slot 5 e no slot 6 está dentro de ±1 ponto percentual da probabilidade declarada (com seed fixa para reprodutibilidade), e os slots 1–4 são 100% Comum.
- **SC-003**: Em 100 boosters consecutivos abertos por um mesmo usuário, 0 boosters apresentam carta repetida internamente.
- **SC-004**: Após abrir boosters, fechar o navegador e reabrir, 100% das cartas previamente coletadas e suas contagens permanecem visíveis na coleção.
- **SC-005**: A primeira tela útil do jogo (booster pronto para ser aberto) carrega em até 3 segundos em uma conexão de banda larga típica e em um dispositivo de gama média.
- **SC-006**: O jogo é operável e legível em viewports de 320px a 1440px de largura, em pelo menos as duas últimas major versions de Chrome, Firefox, Safari e Edge.
- **SC-007**: Em testes de usabilidade rápidos (5+ usuários), 100% completam a abertura de um booster e a visualização da coleção sem assistência, na primeira tentativa.
- **SC-008**: O tempo de abertura completa de um booster (do clique até a 6ª carta revelada, sem pular animação) fica entre 5 e 12 segundos — suficiente para suspense, sem cansar.
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
