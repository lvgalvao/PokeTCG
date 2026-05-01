# Contract: Download CLI (`tools/download_cards.py`)

**Tipo**: utilitário Python 3.11+ executável a partir da raiz do projeto.
**Propósito**: popular `assets/` com as imagens do set 151 e gerar `assets/manifest.json` (FR-001 a FR-007a).

## Invocação

```bash
python tools/download_cards.py [OPTIONS]
```

### Options

| Flag | Default | Descrição |
|------|---------|-----------|
| `--set-id <id>` | `sv3pt5` | Identificador do set na pokemontcg.io. |
| `--assets-dir <path>` | `./assets` | Raiz onde criar as 7 subpastas e o manifest. |
| `--api-key <key>` | (env `POKEMONTCG_API_KEY`) | Opcional. Aumenta rate limit. |
| `--retries <n>` | `3` | Tentativas por carta antes de marcar falha. |
| `--retry-backoff <s>` | `1.0` | Backoff exponencial inicial em segundos. |
| `--quality <0..100>` | `85` | Qualidade JPG ao salvar. |
| `--force` | `false` | Re-baixa mesmo se o arquivo destino já existir (override de idempotência). |
| `--dry-run` | `false` | Lista o que seria feito sem tocar disco nem rede além de listar cartas. |
| `--verbose` | `false` | Log debug por carta. |
| `--help` | — | Mostra ajuda. |

## Comportamento

### Etapas

1. Cria as 7 pastas (`01_comum` … `07_legendaria`) sob `--assets-dir` se não existirem. **NÃO** cria nem toca em outras pastas.
2. Consulta `GET https://api.pokemontcg.io/v2/cards?q=set.id:<set-id>&pageSize=250`, paginando se `totalCount > pageSize`.
3. Para cada carta:
    a. Mapeia `card.rarity` (string da API) para um dos 7 buckets locais via tabela do FR-003. Se nenhum mapeamento bate, registra em `unmapped[]` e continua sem baixar.
    b. Caminho destino: `<assets-dir>/<bucket>/<card.id>.jpg` (kebab-case já é o formato do `id` na fonte).
    c. Se o arquivo destino existe e `--force` não foi passado: pula download, registra como `skipped` (idempotência — FR-005).
    d. Caso contrário: baixa `card.images.large` (fallback para `card.images.small` se `large` indisponível) com até `--retries` tentativas e backoff exponencial. Em caso de falha persistente, registra em `failed[]` e continua.
    e. Converte a imagem (PNG/qualquer) para JPG qualidade `--quality`, achatando contra fundo branco se houver alpha. Salva no caminho destino.
4. Após processar todas as cartas, escreve `<assets-dir>/manifest.json` com schema do `manifest.schema.json`. Inclui `cards`, `totalsByBucket`, `unmapped`, `setId`, `setName`, `generatedAt`, `downloaderVersion`, `totalSet`.
5. Imprime o **Relatório de Download** em stdout:
    ```
    [pkmn-cards] downloaded=5  skipped=200  failed=2  unmapped=1
    [pkmn-cards] manifest:    assets/manifest.json
    [pkmn-cards] failed:
      - sv3pt5-122 (HTTP 503 após 3 tentativas)
      - sv3pt5-153 (timeout)
    [pkmn-cards] unmapped:
      - sv3pt5-208 "??? card" (rarity="Promo")
    ```

### Side effects permitidos

- Cria diretórios sob `--assets-dir` apenas dentro do whitelist das 7 pastas (FR-007).
- Cria `<assets-dir>/manifest.json`.
- Cria `.tmp` durante download e renomeia atomicamente ao final (resistente a interrupção).

### Side effects proibidos

- NÃO toca arquivos fora de `--assets-dir`.
- NÃO deleta arquivos existentes (a menos que `--force` esteja ativo, e mesmo assim só para sobrescrever o JPG da mesma carta).
- NÃO cria pastas além das 7 oficiais sob `--assets-dir`.

## Exit codes

| Code | Significado |
|------|-------------|
| `0` | Tudo OK, nenhuma falha persistente. |
| `1` | Erro de uso (argumento inválido, set-id desconhecido pela API). |
| `2` | Falhas parciais — algumas cartas em `failed[]`, mas o manifest foi gerado e o restante baixou. CI pode tratar como warning. |
| `3` | Falha total — não conseguiu listar nenhuma carta da API (rede/auth). Manifest não é gerado. |
| `130` | Interrompido por SIGINT (Ctrl-C). Manifest não é gerado; arquivos `.tmp` são limpos. |

## Logging

- Logger Python configurado em `WARNING` por padrão; `--verbose` eleva para `DEBUG`.
- Stdout: relatório final + linhas de progresso (1 linha por bucket completo).
- Stderr: warnings e erros.

## Idempotência (FR-005)

Roda o utilitário a primeira vez:
- Resultado: arquivos baixados, `downloaded=N`, `skipped=0`.

Roda novamente sem `--force`:
- Resultado: nenhuma chamada HTTP para imagens já presentes (HEAD não é necessário; existência do arquivo é prova). `downloaded=0`, `skipped=N`.
- O manifest é regenerado (custo trivial), mas seu conteúdo é estável byte-a-byte se nada mudou na fonte.

## Testes (`tests_python/`)

- `test_rarity_mapping.py`: tabela exaustiva de raridades reais do set 151 (testa via fixture com JSON congelado da API). Cada raridade-fonte aceita só um bucket, e todas as 7 raridades estão cobertas.
- `test_idempotency.py`: roda duas vezes contra fixtures, asserta zero requests HTTP de imagem na segunda execução.
- `test_retry.py`: usa `responses` ou `requests-mock` para simular 2 falhas + 1 sucesso, valida que a carta é baixada e o atraso entre tentativas respeita o backoff.
- `test_manifest_schema.py`: valida o `manifest.json` gerado contra `contracts/manifest.schema.json` via `jsonschema`.
- `test_safety.py`: tenta forçar o utilitário a escrever fora de `assets/` (via path injection no `id`); confirma que ele recusa.

## Não-objetivos

- O utilitário **não** é instalado como pacote Python — é um script standalone com `if __name__ == '__main__'`.
- O utilitário **não** comprime, otimiza ou minifica imagens além da conversão JPG. Otimização avançada fica para futuro.
- O utilitário **não** assume o cliente web em si — só produz artefatos sob `assets/`.
