# Importação cautelados 1º BPM — apply (06/06/2026)

**Fonte:** `cautelados-1bpm-atualizada-2026-06-06.docx`  
**Banco:** teste_db (`ajyvznrmbuistlcfckuh`)  
**Operador:** Gianpaolo Costa (supervisor)

## Resultado (apply inicial)

| Métrica | Valor |
|--------|-------|
| Linhas CAUTELADO no DOCX | 141 |
| Pessoas criadas | 118 |
| Pessoas já existentes (reutilizadas) | 2 (JHONNY, TESTE QA E2E) |
| Cautelas permanentes abertas/parciais | 119 |
| Itens de cautela vinculados | 134 (após remoção de 6 duplicatas) |
| Materiais com status `cautelado` | ~127 |
| Seriais não encontrados no estoque | 0 (4 cadastrados via `seed-missing-serials-etapa4.mjs`) |
| Conflitos material→pessoa (limpos) | 6 removidos |

## Estado live pós-Etapa 4 (06/06/2026)

| Métrica | Valor |
|--------|-------|
| Materials | 863 |
| Persons | 121 (120 import + seeds E2E) |
| Cautelas | 176 (import + cautelas E2E/diárias) |
| Cautela items | 444 |
| Dry-run reimport | 0 itens a criar, 0 seriais não encontrados |
| Cautelas Glock sem carregador | 0 (backfill 79 + 2 E2E) |
| Pool Glock 9mm | 270 total (3×90 pistolas), 26 disponíveis |

## Anti-duplicação aplicada

1. **Pessoa:** chave `registration_number` (matrícula) — não recria se já existe.
2. **Cautela:** uma cautela `open`/`partial` por pessoa — reutiliza a existente (ex.: JHONNY QA).
3. **Item pessoa+material:** ignora se já vinculado na cautela ativa.
4. **Material global:** ignora se o patrimônio já está cautelado a **outra** pessoa (seriais curtos ambíguos no DOCX).
5. **Linha repetida no mesmo grupo:** ignora mesmo material duas vezes na mesma matrícula.

## 4 seriais resolvidos (Etapa 4.1)

| Militar | Serial DOCX | Patrimônio |
|---------|-------------|------------|
| ATAIDES | 56703 | PAT-56703 |
| VALDSON | 3709 | PAT-03709 |
| GOUVEIA | 27007 | PAT-27007 |
| MACEDO | 9327 | PAT-09327 |

## Backfill carregadores Glock

- `backfill-glock-charger-lines.mjs --apply`: 79 cautelas legadas + 2 cautelas E2E (06/06)
- Dry-run final: **0** cautelas alvo
- Relatório: `scripts/import/backfill-glock-charger-lines-report.md`
- Pool QA: `scripts/qa/sync-glock-charger-pool-report.md` — 0 flags

## Pessoas novas — credenciais temporárias

- **PIN:** `0000` (trocar no balcão)
- **E-mail placeholder:** `pendente+<matrícula>@cadastro.reserva.local`

## Reimportar (seguro)

```powershell
node scripts/import/parse-cautelados-docx.mjs --input scripts/import/cautelados-1bpm-atualizada-2026-06-06.docx
node scripts/import/import-cautelados-test.mjs          # dry-run
node scripts/import/import-cautelados-test.mjs --apply  # só se dry-run OK
```

## Validação

- https://reserva-teste.vercel.app/persons — ~121 pessoas
- https://reserva-teste.vercel.app/cautelas — filtros Abertas/Parciais
- https://reserva-teste.vercel.app/materials — filtro status **Em Uso**
- E2E remoto **8/8** CI=1 (1 flaky E2E-06, retry OK)
