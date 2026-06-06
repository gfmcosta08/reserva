# Relatório final — importação cautelados (teste_bd)

**Data:** 2026-05-22  
**Ambiente:** `ajyvznrmbuistlcfckuh` (teste_bd)  
**Fonte aplicada:** `cautelados-1bpm-source.csv` (equivalente ao DOCX atualizado)

## Resultado no banco

| Entidade | Quantidade |
|----------|------------|
| `persons` | 123 |
| `cautelas` (permanentes, open) | 123 |
| `cautela_items` (pending) | 146 |
| `materials` status `cautelado` | 134 |
| `materials` status `available` | 453 |

## Cadastro incompleto (conforme PRD)

Todas as pessoas novas:

- E-mail: `pendente+<matrícula>@cadastro.reserva.local`
- PIN temporário: **`0000`** (trocar no balcão)
- Sem fotos RG, WhatsApp, biometria

## Pendências

- **9 seriais** do CSV não encontrados no inventário (ver `dry-run-report.md` seção *Materiais não encontrados*).
- **1 colisão RG** corrigida manualmente: BADARÓ (`067192`) vs NOBRE (`06719`).
- **DOCX:** parser Python disponível (`parse-docx-tables.py`); re-parse com `--input cautelados-1bpm-atualizada.docx` antes de nova apply se a fonte oficial for só o Word.

## Validação sugerida (UI)

1. https://reserva-teste.vercel.app/persons — buscar ALBUQUERQUE, SOARES  
2. https://reserva-teste.vercel.app/materials — filtro status `cautelado`  
3. https://reserva-teste.vercel.app/cautelas — cautelas abertas por militar  
4. `npx vercel curl https://reserva-teste.vercel.app/api/version` → `teste_db`

## Produção

Não alterada. Repetir fluxo só com aprovação explícita.
