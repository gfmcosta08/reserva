# Importação cautelados 1º BPM — apply (06/06/2026)

**Fonte:** `cautelados-1bpm-atualizada-2026-06-06.docx` (cópia do DOCX do usuário)  
**Banco:** teste_db (`ajyvznrmbuistlcfckuh`)  
**Operador:** Gianpaolo Costa (supervisor)

## Resultado

| Métrica | Valor |
|--------|-------|
| Linhas CAUTELADO no DOCX | 141 |
| Pessoas criadas | 118 |
| Pessoas já existentes (reutilizadas) | 2 (JHONNY, TESTE QA E2E) |
| Cautelas permanentes abertas/parciais | 119 |
| Itens de cautela vinculados | 134 (após remoção de 6 duplicatas) |
| Materiais com status `cautelado` | ~127 |
| Seriais não encontrados no estoque | 4 |
| Conflitos material→pessoa (limpos) | 6 removidos |

## Anti-duplicação aplicada

1. **Pessoa:** chave `registration_number` (matrícula) — não recria se já existe.
2. **Cautela:** uma cautela `open`/`partial` por pessoa — reutiliza a existente (ex.: JHONNY QA).
3. **Item pessoa+material:** ignora se já vinculado na cautela ativa.
4. **Material global:** ignora se o patrimônio já está cautelado a **outra** pessoa (seriais curtos ambíguos no DOCX).
5. **Linha repetida no mesmo grupo:** ignora mesmo material duas vezes na mesma matrícula.

## 4 linhas sem material no inventário

| Militar | Serial DOCX | Seção |
|---------|-------------|-------|
| ATAIDES | 56703 | TAURUS |
| VALDSON | 3709 | TAURUS |
| GOUVEIA | 27007 | TAURUS |
| MACEDO | 9327 | Coletes |

Cadastrar no estoque ou ajustar serial no inventário e reexecutar import (idempotente).

## Pessoas novas — credenciais temporárias

- **PIN:** `0000` (trocar no balcão)
- **E-mail placeholder:** `pendente+<matrícula>@cadastro.reserva.local`

## Reimportar (seguro)

```powershell
node scripts/import/parse-cautelados-docx.mjs --input scripts/import/cautelados-1bpm-atualizada-2026-06-06.docx
node scripts/import/import-cautelados-test.mjs          # dry-run
node scripts/import/import-cautelados-test.mjs --apply  # só se dry-run OK
```

## Validação sugerida

- https://reserva-teste.vercel.app/persons — 120 pessoas
- https://reserva-teste.vercel.app/cautelas — filtros Abertas/Parciais
- https://reserva-teste.vercel.app/materials — filtro status **Em Uso**
