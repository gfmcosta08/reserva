# Sync pool carregadores Glock 9mm — dry-run

> **Somente QA (teste_db).** Total alvo = 3 × pistolas Glock 9mm. **Não** é regra da Nova Cautela em runtime.

| Métrica | Valor |
|---------|-------|
| Pistolas Glock 9mm (N) | 90 |
| Alvo total carregadores (3×N) | 270 |
| Pool total antes | 270 |
| Disponíveis | 26 |
| Em uso (cautelado) | 244 |
| Inserir | 0 |
| Retirar (available POOL) | 0 |
| Cautelas Glock sem carregador | 0 |

## Backfill linhas de carregador (Etapa 4)

Após criar o pool (`sync-glock-charger-pool.mjs --apply`), cautelas legadas com Glock e sem linha de carregador foram corrigidas com:

```powershell
node scripts/import/backfill-glock-charger-lines.mjs --apply
```

| Etapa | Resultado |
|-------|-----------|
| Cautelas corrigidas | 79 |
| Carregadores por cautela | 3 (linhas separadas, qty 1) |
| Pool insuficiente | 0 |
| Erros | 0 |
| Flag pós-backfill | **0** cautelas sem carregador |

Relatório: `scripts/import/backfill-glock-charger-lines-report.md`
