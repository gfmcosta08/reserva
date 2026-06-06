# Importação cautelados 1º BPM — apply (Etapa 4, 06/06/2026)

**Fonte:** `cautelados-1bpm-atualizada-2026-06-06.docx`  
**Banco:** teste_db (`ajyvznrmbuistlcfckuh`)  
**Operador:** Gianpaolo Costa (supervisor)

## Resultado final (pós reimport + seriais + backfill Glock)

| Métrica | Valor |
|--------|-------|
| Linhas CAUTELADO no DOCX | 141 |
| Pessoas no banco | 121 (120 import + 1 QA E2E) |
| Cautelas open/partial (live) | ~148 (incl. seeds QA/E2E) |
| Cautelas permanentes import | 120 grupos / ~131 itens vinculados |
| Itens criados na reexecução `--apply` | 7 (+ 1 cautela nova) |
| Seriais não encontrados | **0** |
| Import idempotente (2º dry-run) | 0 itens a criar, 131 skip, 0 erros |
| Conflitos serial→outra pessoa (ignorados) | 10 |

## Seriais cadastrados (Etapa 4.0)

| Militar | Serial | Patrimônio |
|---------|--------|------------|
| ATAIDES | 56703 | PAT-56703 |
| VALDSON | 3709 | PAT-03709 |
| GOUVEIA | 27007 | PAT-27007 |
| MACEDO | 9327 | PAT-09327 |

## Pool e backfill carregadores Glock 9mm

| Métrica | Valor |
|--------|-------|
| Pistolas Glock 9mm | 90 |
| Pool carregadores (3×N) | 270 |
| Pool disponível / em uso | 28 / 242 |
| Cautelas Glock sem carregador (antes) | 79 |
| Correções `backfill-glock-charger-lines.mjs --apply` | **79** (3 linhas/cautela) |
| Cautelas Glock sem carregador (depois) | **0** |

Relatório detalhado: `scripts/import/backfill-glock-charger-lines-report.md`  
Sync pool: `scripts/qa/sync-glock-charger-pool-report.md`

## Anti-duplicação (import)

1. **Pessoa:** chave `registration_number` — não recria se já existe.
2. **Cautela:** uma cautela `open`/`partial` por pessoa — reutiliza a existente.
3. **Item pessoa+material:** ignora se já vinculado na cautela ativa.
4. **Material global:** ignora se patrimônio já cautelado a **outra** pessoa.
5. **Linha repetida no mesmo grupo:** ignora duplicata na mesma matrícula.

## Reimportar (seguro)

```powershell
node scripts/import/parse-cautelados-docx.mjs --input scripts/import/cautelados-1bpm-atualizada-2026-06-06.docx
node scripts/import/import-cautelados-test.mjs          # dry-run
node scripts/import/import-cautelados-test.mjs --apply  # só se dry-run OK
node scripts/qa/sync-glock-charger-pool.mjs --apply     # pool 3×N
node scripts/import/backfill-glock-charger-lines.mjs --apply  # se flags Glock
```

## Validação (live teste_db)

- `/persons` — 121 pessoas
- `/cautelas` — filtros Abertas/Parciais coerentes (~148 open/partial)
- `/materials` — filtro **Em Uso** (~400 materiais cautelados)
- Regressão: `npm test` 14/14, `tsc` OK, E2E core 8/8 remoto (`reserva-teste`)
