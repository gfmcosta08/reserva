# Importação cautelados 1º BPM

Importa militares do relatório legado como **`persons`** (cautelados) e registra **cautelas permanentes** no banco de **teste** (`teste_bd` / `ajyvznrmbuistlcfckuh`).

## Pré-requisitos

- `scripts/.env.clone` com `SUPABASE_TEST_URL` e `SUPABASE_TEST_SERVICE_ROLE_KEY`
- Fonte de dados em um destes formatos:
  - `scripts/import/cautelados-1bpm-atualizada.docx` (oficial)
  - `scripts/import/cautelados-1bpm-source.csv` ou `public/cautelas_permanentes.csv`

## Fluxo

```powershell
cd "d:\Sistemas\Controle de material"

# 1) Extrair linhas → JSON
node scripts/import/parse-cautelados-docx.mjs
# ou: node scripts/import/parse-cautelados-docx.mjs --input caminho/arquivo.docx

# 2) Simular (padrão)
node scripts/import/import-cautelados-test.mjs

# 3) Aplicar em teste_bd
node scripts/import/import-cautelados-test.mjs --apply
```

## Saídas

| Arquivo | Conteúdo |
|---------|----------|
| `cautelados-1bpm.parsed.json` | Linhas normalizadas do parse |
| `dry-run-report.md` | Relatório da última execução (dry-run ou apply) |

## Regras de negócio

- Apenas linhas com situação **CAUTELADO(A)** entram na importação.
- **Pessoas novas**: e-mail `pendente+<matrícula>@cadastro.reserva.local`, PIN temporário **`0000`**, sem fotos/WhatsApp/biometria.
- **RG** no banco = matrícula numérica completa (`registration_number`) para evitar colisão dos 5 primeiros dígitos.
- **Materiais**: vínculo por serial / tokens numéricos no `serial_number` do inventário; status → `cautelado`.
- **Armas (PRD pacote)**: cada linha de arma gera `cautela_items` com `quantity_delivered: 1`. A coluna **Carregadores** do CSV vira linha separada de categoria **Carregador** (`charger_qty`), não quantidade na arma.
- **Munição**: não há coluna no CSV legado — munição só via wizard manual (PRD §6.1).
- Cautelas já importadas com qty na arma: `node scripts/import/backfill-charger-items.mjs` (dry-run) e `--apply` em teste_db.
- **Produção bloqueada** no script (só URL com ref `ajyvznrmbuistlcfckuh`).

## Lacunas PRD (cadastro incompleto)

Ver [docs/BACKLOG-PRD-GAPS.md](../../docs/BACKLOG-PRD-GAPS.md) — seção *Importação cautelados*.

## Após validar em teste

Repetir com aprovação explícita em produção (alterar guard no script ou variante `import-cautelados-prod.mjs` futura).
