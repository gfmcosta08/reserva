# Relatório de Regressão Completa — RESERVA

**Data:** 06/06/2026, 22:19:41 — 06/06/2026, 22:31:07  
**Ambiente:** https://reserva-teste.vercel.app  
**Supabase:** `?` (ref `?`)  
**Commit (Vercel):** `desconhecido`  
**Motor de testes:** Playwright + Chromium Desktop Chrome (headless em CI)

---

## Gate principal: testes de browser (Playwright)

A regressão funcional **obrigatoriamente** passa pelo Playwright com Chromium.
Cada teste abre páginas reais, faz login, clica em botões, preenche formulários
e valida o DOM — simulando uso humano do sistema. `headed: false` em CI usa
o mesmo motor do Chrome, apenas sem janela visível.

Comandos:

```powershell
$env:CI="1"
$env:E2E_BASE_URL="https://reserva-teste.vercel.app"
npx playwright test
```

```bash
npm run test:regression:browser:3x   # somente Playwright ×3
npm run test:regression:3x           # Vitest + validate-stock + Playwright ×3
```

---

## Specs E2E (browser)

| Arquivo | Cobertura |
|---------|-----------|
| `e2e-01-login.spec.ts` | Login supervisor e navegação para Cautelas |
| `e2e-02-nova-cautela.spec.ts` | Nova cautela diária (mat. 999888 + PIN) |
| `e2e-03-devolucao-total.spec.ts` | Devolução total de item da cautela demo |
| `e2e-04-devolucao-parcial.spec.ts` | Devolução parcial mantém status Parcial |
| `e2e-05-divergencias.spec.ts` | Página /reports/divergencias |
| `e2e-06-stock.spec.ts` | Devolução restaura Disponível em /materials |
| `e2e-07-etapa5-smoke.spec.ts` | Logout, relatórios, alerts, ammo-batches, deep links, exports autenticados |
| `e2e-08-full-coverage.spec.ts` | Dashboard, CRUD material, estoque fungível, cautela permanente, pessoa, /api/version, exports 401 |
| `e2e-lists.spec.ts` | Listagens /materials e /persons |

---

## Resultados por rodada (Playwright)

| Rodada | Passed | Failed | Skipped | Status | Duração |
|--------|--------|--------|---------|--------|---------|
| 1 | 24 | 0 | 0 | ✅ OK | 228s |
| 2 | 24 | 0 | 0 | ✅ OK | 227s |
| 3 | 24 | 0 | 0 | ✅ OK | 228s |

---

## Vitest (unitário)

| Status | Duração |
|--------|---------|
| ✅ OK | 2s |

## Gate stock_quantity (validate-stock-etapa3)

| Status | Duração |
|--------|---------|
| ✅ OK | 1s |

---

## Itens manuais (fora da suíte browser)

- OCR de documentos / reconhecimento facial
- Layout e gestos em dispositivos móveis
- Bloqueio por tentativas de PIN incorretas
- Impressão física de comprovantes
- Performance sob carga concorrente
- Integração e-mail (Resend) em produção

---

## Recomendação de gate — Etapa 7

**APROVADO**

Todas as 3 rodadas Playwright passaram, com Vitest e validate-stock OK.

---

*Gerado automaticamente por `scripts/qa/run-full-regression-3x.mjs`*
