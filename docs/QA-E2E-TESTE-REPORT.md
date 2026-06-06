# Relatório QA E2E — Controle de Material (teste_bd)

**Data:** 22/05/2026  
**Ambiente:** `http://localhost:3000` → Supabase `ajyvznrmbuistlcfckuh` (clone `teste_bd`)  
**Operador:** `qa.supervisor@reserva.test` / `ReservaQA2026!Super`  
**Pessoa de teste:** TESTE QA E2E BROWSER — mat. `999888`, PIN `5678`  
**Preview Vercel:** não utilizado (Deployment Protection / SSO); fluxo validado localmente.

---

## Resumo executivo

| Área | Resultado |
|------|-----------|
| Login supervisor | ✅ |
| Busca pessoa + PIN na cautela | ✅ (após correção de bug) |
| Cautela diária + assinatura PIN | ✅ |
| Devolução (extraviado / pendência) | ✅ |
| Cautela permanente + PIN | ✅ |
| E-mail / WhatsApp | ⏭️ não configurado (esperado) |
| Preview `reserva-teste.vercel.app` | ⏭️ bloqueado por SSO |

**Correção aplicada em código:** `searchPersons` passou a expor `has_registered_pin` (derivado de `pin_hash` no servidor, sem vazar o hash). Sem isso, o wizard exibia “Assinatura indisponível” mesmo com PIN cadastrado.

---

## Cenários executados

### 1. Login e smoke

- Dashboard, Cautelas, listagem com filtros (Todas / Abertas / Fechadas).
- Contadores coerentes com base importada (~587 materiais, ~123 cautelas abertas de importação).

### 2. Cautela diária (TESTE QA E2E BROWSER)

| Passo | Status |
|-------|--------|
| Nova Cautela → busca `999888` | ✅ |
| Mensagem “assinatura com PIN” | ✅ |
| Material: ESPINGARDA PAT-00005 / SN KXF5131731 | ✅ |
| Pacote arma longa → Resumo → PIN `5678` | ✅ |
| Cautela aparece como **Aberta** (diária) | ✅ |

### 3. Devolução — item extraviado (material em dívida)

| Passo | Status |
|-------|--------|
| Detalhes → Devolver (1) | ✅ |
| Marcar **Extraviado** + justificativa | ✅ |
| Finalizar devolução | ✅ |
| Cautela **Fechada** com observação registrada | ✅ |
| Material PAT-00005: fluxo de divergência/extravio registrado | ✅ |

**Nota:** Devolução **total** com checkbox “devolvido completo” não foi repetida nesta sessão (cautela diária encerrada via extravio). O fluxo de devolução completa usa o mesmo componente `CautelaReturnFlow` (toggle ✔️).

### 4. Cautela permanente

| Passo | Status |
|-------|--------|
| Nova Cautela → TESTE QA | ✅ |
| Pistola PAT-00116 (TAURUS PT100) | ✅ |
| Tipo **Permanente** + PIN `5678` | ✅ |
| Listagem **Aberta** / Permanente | ✅ |

### 5. Devolução PRD §7.1–7.3 (lista única + total/parcial)

**UX:** uma seção “Itens cautelados (N com saldo pendente)”, agrupados por **Armas / Carregadores / Munição / Demais**. Por linha: **Devolver total**, **Devolver parcial** (qtd acumulada), **Danificado**, **Extraviado**; data da cautela; entregue / já devolvido / saldo pendente.

**Backend:** `lib/cautela-return-status.ts` — parcial mantém `pending` até `quantity_returned === quantity_delivered`; material `cautelado` com saldo; cautela `partial` (não `divergent` só por saldo).

| Cenário | Passos | Resultado esperado |
|---------|--------|-------------------|
| **JHONNY** (mat. `064272`) | Seed: `node scripts/qa/seed-partial-return-demo.mjs --apply` (após `seed-pack-accessories.mjs --apply`) | 3 linhas: pistola (1), carregador (3), munição (50). Devolver → 3 seções no fluxo. |
| Pistola → **Devolver total** | Uma linha, modo total, Finalizar | Item `returned`; material `available`. |
| Carregadores → **parcial 2** | Modo parcial, qtd acumulada = 2 | Item `pending`, `quantity_returned=2`, saldo 1; cautela `partial`. |
| Munição → **parcial 10** | Modo parcial, qtd = 10 | `pending`, saldo 40; cautela `partial`. |
| Reabrir devolução | Cautela parcial → Devolver | Só linhas com saldo; carregador mostra “Já devolvido: 2”. |
| **ALBUQUERQUE** | Cautela com longa + curta | Duas linhas em **Armas**. |
| **Import legado** | `backfill-charger-items.mjs --apply` | ~94 cautelas: qty na arma 3→1 + linha Carregador separada (ignora linhas já categoria Carregador). |
| Danificado / Extraviado | Modo + justificativa | Cautela `divergent`; não confundir com parcial por saldo. |

**Dados teste_db (22/05/2026):** `seed-pack-accessories.mjs --apply` (PAT-QA-CAR-002, PAT-QA-MUN-001); `seed-partial-return-demo.mjs --apply` → cautela `63374c82-9ca3-4892-beda-990b17585c66`; backfill aplicado (94 correções).

**Importação:** `parse-rows` + `import-cautelados-test.mjs` — linha carregador separada; munição só via wizard (`scripts/import/README.md`).

---

## Bug corrigido

### B-001 — PIN não reconhecido no wizard de cautela

- **Sintoma:** Após “Próximo: Assinatura”, tela “Assinatura indisponível” para pessoa com `pin_hash` no banco.
- **Causa:** `searchPersons()` não retornava `has_registered_pin`.
- **Correção:** `app/actions/cautelas.ts` — seleciona `pin_hash` no servidor e mapeia para `has_registered_pin: boolean` na resposta (hash removido do payload).
- **Impacto:** Militares importados com PIN `0000` e pessoas QA passam a ver “Próximo: PIN” corretamente.

---

## Lacunas conhecidas (PRD / produção)

Documentadas em `docs/BACKLOG-PRD-GAPS.md`:

- Campo **CPF** e validação completa PRD v1.3 ainda não implementados no schema/UI.
- E-mail (`RESEND_API_KEY`) e WhatsApp não testados.
- Preview Vercel exige desativar Deployment Protection ou usar `vercel curl` para E2E online.

---

## Credenciais de retomada

| Papel | Identificador | Senha / PIN |
|-------|---------------|-------------|
| Supervisor QA | `qa.supervisor@reserva.test` | `ReservaQA2026!Super` |
| Pessoa E2E | mat. `999888` | PIN `5678` |
| Importados 1º BPM | matrícula no RG | PIN `0000` (placeholder) |

---

## Arquivos alterados nesta sessão QA

| Arquivo | Alteração |
|---------|-----------|
| `app/actions/cautelas.ts` | `searchPersons` → `has_registered_pin` |
| `components/CautelaReturnFlow.tsx` | Lista única por bucket; modos total/parcial/danif./extrav.; saldo acumulado |
| `components/cautela/CautelaReturnItemCard.tsx` | Card por linha (PRD §7.1) |
| `lib/cautela-return-status.ts` | `itemNeedsReturn`, `computeCautelaStatus`, parcial → `pending` |
| `app/api/cautela-return/route.ts` | Alinhado a saldo parcial reaberto |
| `scripts/qa/seed-partial-return-demo.mjs` | JHONNY: pistola + 3 carregadores + 50 munições |
| `scripts/import/backfill-charger-items.mjs` | Ignora linhas Carregador; pula cautela com linha carregador |
| `components/CautelaDetail.tsx` | Itens agrupados por bucket; contexto para devolução |
| `components/cautela/CautelaItemBucketList.tsx` | UI compartilhada de listagem por bucket |
| `lib/cautela-summary-buckets.ts` | Helpers `groupByBucket`, `formatPendingBucketSummary`, etc. |
| `scripts/import/lib/parse-rows.mjs` | `charger_qty` + `quantity_delivered: 1` para armas |
| `scripts/import/import-cautelados-test.mjs` | Linha de carregador separada + relatório `chargerLinesToAdd` |
| `scripts/import/backfill-charger-items.mjs` | Dry-run/apply para cautelas open legadas |
| `scripts/import/README.md` | Documentação munição ausente no CSV |
| `docs/QA-E2E-TESTE-REPORT.md` | Este relatório |

---

## Recomendações antes de produção

1. Fazer deploy da correção de `searchPersons` em preview e validar um fluxo PIN em `reserva-teste.vercel.app` (ou liberar preview).
2. Manter `reserva1bpm.vercel.app` em `producao` sem alterar env.
3. Replicar importação de cautelados em produção **somente** com aprovação explícita.
4. Opcional: smoke de devolução **total** (checkbox) em cautela diária descartável.

---

## Test plan rápido (regressão)

- [ ] Nova cautela diária com militar importado + PIN `0000`
- [ ] Nova cautela permanente + data de revisão
- [ ] JHONNY: pistola total + carregador parcial 2/3 + munição parcial 10/50 → cautela `partial`
- [ ] Reabrir devolução: saldos 1 carregador + 40 munições
- [ ] Detalhe/Devolver: seções Armas / Carregadores / Munição (3+ linhas)
- [ ] Devolução total por botão “Devolver total” (não checkbox legado)
- [ ] Relatório `/reports/divergencias` após extravio
- [ ] Cadastro pessoa com upload RG no browser (limitação de automação)
