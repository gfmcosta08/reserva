# AUDITORIA — RESERVA (Etapa 0)

> **Data:** 2026-06-08  
> **Ambiente inspecionado:** `teste_db` (`ajyvznrmbuistlcfckuh`) + código em `D:/Sistemas/Controle de material`  
> **Objetivo:** mapear o que existe antes de qualquer nova implementação. **Nenhuma alteração de produto foi feita nesta etapa.**

Snapshot live: [`audit-schema-live.json`](./audit-schema-live.json) (gerado por `scripts/qa/audit-schema-live.mjs`).

---

## Resumo executivo

O RESERVA **não é greenfield**. É um sistema operacional com **882 materiais**, **121 pessoas**, **198 cautelas** e fluxo real de cautela/devolução via wizard (PIN, face, PDF). A base é **Next.js 14 + Supabase**, com RLS reforçado recentemente.

O documento de implementação alvo (Shelf.nu / cadeia de custódia) descreve um modelo com `batalhoes`, `reservas`, `materiais.status_atual` em ENUM e tabela **`movimentacoes` imutável**. O código atual usa **`materials.status`** em inglês, **`cautelas` + `cautela_items`** como custódia, e **atualiza material diretamente** no RPC — sem movimentações.

**Trabalho parcial já aplicado (fora desta auditoria, sessão anterior):**

- Tenancy `organizations` + `units` + `usuarios` + `organization_id`/`unit_id` nas tabelas operacionais (migration `20260609140000`) — **somente teste_db**
- Consolidação categoria `PISTOLA` → `ARMA CURTA`
- Correções de resolução de pacote pistola na cautela

Isso **não substitui** o schema alvo do plano (`batalhoes`/`reservas`); é um **protótipo de M1** alinhado ao `docs/PLANO-PRODUTO-VERTICAL.md`.

---

## 0.1 — Banco de dados (Supabase)

### Tabelas existentes

| Tabela | Linhas (teste_db) | Decisão | Motivo |
|--------|-------------------|---------|--------|
| `profiles` | 2 | **MANTER + ADAPTAR** | Vínculo com `auth.users`; roles `operator`/`supervisor`. Coexistir com `usuarios` até convergir perfis do plano (`admin_geral`, `armeiro`, etc.). |
| `usuarios` | 2 | **ADAPTAR** | Tenancy Etapa 1 parcial: `auth_user_id`, `organization_id`, `unit_id`, `role`. Falta `matricula`, `cpf`, `patente`, `reserva_id`, perfis do plano. |
| `organizations` | 1 | **ADAPTAR → batalhoes** | Equivale conceitualmente a órgão; hoje só `1bpm`. Pode renomear/estender, não dropar dados. |
| `units` | 2 | **ADAPTAR → batalhoes/reservas** | Hoje `1BPM` + `QAISO` (teste). Plano separa **batalhão** e **reserva**; `units` pode virar batalhão ou reserva conforme decisão de modelagem. |
| `persons` | 121 | **MANTER + ADAPTAR** | **Não é** `usuarios` do plano: são **cautelados** (RG, PIN, face, matrícula). Recebem material na cautela. Precisa `batalhao_id`/`reserva_id` explícitos no modelo alvo (hoje `unit_id`). |
| `materials` | 882 | **ADAPTAR (crítico)** | Inventário real. Falta `status_atual` ENUM, `usuario_responsavel_id`, `localizacao_atual`, `reserva_id` FK. Status atual: `available`, `cautelado`, `maintenance`, etc. |
| `cautelas` | 198 | **MANTER + ADAPTAR** | Cabeçalho de custódia (`daily`/`permanent`, `open`/`closed`). Não substitui `movimentacoes`; deve alimentar histórico na Etapa 3. |
| `cautela_items` | 395 | **MANTER + ADAPTAR** | Itens por cautela, qty entregue/devolvida. Dupla cautela parcialmente impedida via status do material + RPC. |
| `divergences` | 0 | **MANTER** | Estrutura pronta; fluxo de divergência existe na UI. |
| `audit_logs` | 20 | **MANTER + ADAPTAR** | Append-only parcial (REVOKE UPDATE/DELETE). **Não** é cadeia de custódia por material; ações genéricas (`cautela_created`, etc.). |
| `corrections` | 0 | **MANTER** | Alinhado ao conceito de `CORRECAO` em movimentações. |
| `ammo_batches` | 4 | **ADAPTAR** | Lotes de munição paralelos a `materials` fungíveis. Unificar ou manter com mesmo RLS/tenancy. |
| `categories` | 0 (vazia) | **REMOVER** | Legado pós-migration `20260407120000`; categoria está em `materials.category` (TEXT). Tabela órfã. |

### Colunas relevantes — `materials` (estado atual)

| Coluna | Presente | Modelo alvo | Gap |
|--------|----------|-------------|-----|
| `patrimony_number` | Sim | `patrimonio` | Renomear/alias |
| `serial_number` | Sim | `numero_serie` | OK |
| `category` (TEXT) | Sim | `tipo` ENUM | Migrar para ENUM |
| `status` | Sim | `status_atual` ENUM | Valores e semântica diferentes |
| `marca`, `modelo`, `calibre` | Sim | Sim | OK |
| `stock_quantity` | Sim | — | Fungíveis (munição); regra “um responsável” é por unidade de estoque |
| `reservation_id` | Sim (TEXT) | `reserva_id` UUID FK | Tipo errado, sem FK |
| `organization_id`, `unit_id` | Sim (teste_db) | `batalhao_id`, `reserva_id` | Nomenclatura e granularidade |
| Responsável atual | **Não** | `usuario_responsavel_id` | Inferido via cautela aberta |
| Localização | **Não** | `localizacao_atual` | Ausente |
| Vistoria anual | **Não** | `data_ultima/proxima_vistoria` | Parcial em `cautelas.review_date` |

### Constraints de status (`materials`)

Valores permitidos hoje (migration `20260330100000`):

`available`, `in_use`, `maintenance`, `blocked`, `cautelado`, `pending_return`, `unavailable`

Plano exige: `DISPONIVEL`, `CAUTELADO_TEMPORARIO`, `CAUTELADO_PERMANENTE`, `MANUTENCAO`, `BAIXADO`, `EXTRAVIADO`, etc.

### RLS (Row Level Security)

| Estado | Detalhe |
|--------|---------|
| RLS ativo | `persons`, `materials`, `cautelas`, `cautela_items`, `divergences`, `audit_logs`, `corrections`, `ammo_batches`, `organizations`, `units`, `usuarios` |
| Funções | `is_active_operator()`, `is_supervisor()`, `current_unit_id()`, `user_can_access_unit()` |
| Escopo | Operador: **só sua `unit_id`**; supervisor/admin: **toda a `organization_id`** |
| Validação | `scripts/qa/validate-tenant-rls-test.mjs` — operador 1BPM não vê material QAISO |
| Produção | **Não auditado neste snapshot** — migrations de tenancy aplicadas só em teste_db |

### O que **não existe** no banco

- `batalhoes`, `reservas` (nomes do plano)
- `movimentacoes` / `tipo_movimentacao`
- `status_material`, `tipo_material` (ENUMs)
- `materiais` (tabela renomeada)
- `inventarios`, `inventario_itens`
- Triggers `verificar_disponibilidade_material` no modelo ENUM
- Função `registrar_cautela` com movimentação obrigatória

---

## 0.2 — Autenticação

| Item | Estado | Decisão |
|------|--------|---------|
| Login | Supabase Auth (`app/auth/login`) | **MANTER** |
| Middleware | Verifica `profiles.is_active` | **MANTER + ADAPTAR** — incluir `usuarios.is_active` |
| Perfis | `profiles.role`: `operator` \| `supervisor` | **ADAPTAR** — plano tem 5 perfis (`admin_geral`, `armeiro`, …) |
| Tenancy na sessão | `usuarios` consultado em Server Actions (`lib/tenant-context.ts`) | **ADAPTAR** — expor `batalhao_id`/`reserva_id` na sessão (Etapa 1 plano) |
| `batalhao_id` no JWT | **Não** — resolvido via RLS + query a `usuarios` | **CONSTRUIR** acesso explícito no contexto da app |
| Fail-closed | `lib/auth-cautela.ts` exige `profiles` + `usuarios` | **MANTER** |

**Duplicidade a resolver (não remover às cegas):**

- `profiles` (legado operador) + `usuarios` (tenancy novo) — sincronizados por backfill; convergir sem quebrar login.

---

## 0.3 — Cadastro de materiais

| Aspecto | Código atual | Modelo alvo | Avaliação |
|---------|--------------|-------------|-----------|
| Tabela | `materials` | `materiais` | ADAPTAR in-place |
| Status | `status` string EN | `status_atual` ENUM PT | ADAPTAR com migration mapeando valores |
| Categoria | `category` TEXT | `tipo` ENUM | ADAPTAR (`ARMA CURTA` já consolidado) |
| Responsável | Via cautela aberta | Coluna no material | CONSTRUIR + backfill |
| Localização | Ausente | `localizacao_atual` | CONSTRUIR |
| UI | `MaterialsClient.tsx`, `MaterialForm` | Telas do plano | ADAPTAR |
| Import CSV | `importMaterialsCsv` + `canonicalizeMaterialCategory` | — | MANTER |
| Listagem | `/materials` com filtros | Lista disponíveis | MANTER + ADAPTAR status visual |

**Problema crítico:** listagem e cautela usavam regras diferentes de disponibilidade (corrigido parcialmente com `canReserveStock` / `isMaterialReservable`). Ainda não há ENUM `DISPONIVEL` nem movimentação.

---

## 0.4 — Fluxo de cautela

### Como funciona hoje

```
UI: CautelaWizard → app/actions/cautelas.ts
  → RPC create_cautela_atomic (SECURITY DEFINER)
  → INSERT cautelas + cautela_items
  → UPDATE materials SET status='cautelado', stock_quantity -= qty
  → logAudit (audit_logs)
```

Devolução: `processBulkDevolution` / `app/api/cautela-return` — atualiza `cautela_items`, restaura `materials.stock_quantity` e status.

### Comparativo com o plano

| Regra do plano | Situação atual |
|----------------|----------------|
| Só `DISPONIVEL` pode cautelar | Parcial: `status = 'available'` + `canReserveStock` |
| Toda alteração gera movimentação | **Violado:** UPDATE direto em `materials` |
| Um responsável por material | Parcial: uma cautela aberta por material unitário; fungíveis com qty > 1 |
| Dupla cautela bloqueada | Parcial: RPC valida `available` + lock `FOR UPDATE` |
| Histórico imutável por material | **Ausente:** só `audit_logs` genérico + estado em `cautelas` |
| Cautela temporária vs permanente | Sim: `cautelas.type` = `daily` \| `permanent` |
| Vistoria anual | Parcial: `cautelas.review_date`; não gera movimentação |
| Pacote pistola (arma + carregadores + munição) | Sim: `resolvePackAccessoriesForWeapon` |

### RPC `create_cautela_atomic`

- Versão atual: valida `unit_id` do operador (teste_db)
- **Não** insere em `movimentacoes`
- **Não** seta `usuario_responsavel_id` no material

---

## 0.5 — Frontend

### Telas existentes

| Rota | Componente | Decisão | Observação |
|------|------------|---------|------------|
| `/` | Dashboard | **MANTER + ADAPTAR** | Métricas básicas; falta cards do plano (atraso, vistoria) |
| `/auth/login` | Login | **MANTER** | |
| `/materials` | MaterialsClient | **MANTER + ADAPTAR** | Filtros OK; status não usa ENUM alvo |
| `/persons` | PersonsClient + wizard | **MANTER** | Cadastro cautelado com PIN/face |
| `/cautelas` | CautelasClient + Wizard | **MANTER + ADAPTAR** | Fluxo principal; não é o fluxo “armeiro” simplificado do plano |
| `/history` | Histórico | **MANTER + ADAPTAR** | Não é extrato de movimentações |
| `/alerts` | Alertas | **MANTER + ADAPTAR** | |
| `/ammo-batches` | Lotes munição | **ADAPTAR** | Sobreposição com materials fungíveis |
| `/reports/cautelas` | Relatório | **MANTER** | |
| `/reports/materials` | Relatório | **MANTER** | |
| `/reports/divergencias` | Divergências | **MANTER** | |
| `/admin` | — | **REMOVER do menu ou CONSTRUIR** | Link no `DashboardShell` sem página |
| `/settings` | — | **REMOVER do menu ou CONSTRUIR** | Idem |

### Testes automatizados existentes

- **Vitest:** 31 testes (`lib/*.test.ts`) — stock, categorias, tenant, RLS migration, pack accessories
- **Playwright E2E:** 9+ specs (login, cautela, devolução, estoque, pacote pistola, cobertura)
- **Scripts QA:** bootstrap, validação RLS, auditoria categoria, diagnóstico pacote

---

## PROBLEMAS CRÍTICOS ENCONTRADOS

| # | Problema | Impacto | Solução proposta (próximas etapas) |
|---|----------|---------|-------------------------------------|
| 1 | **Sem tabela `movimentacoes`** | Não há cadeia de custódia imutável por material | Etapa 3: criar tabela + migrar histórico de `cautelas` |
| 2 | **UPDATE direto em `materials`** no RPC/devolução | Viola princípio “toda alteração gera movimentação” | Etapa 3: funções `registrar_cautela` / `registrar_devolucao` |
| 3 | **Status em inglês** sem ENUM alvo | Relatórios, regras e UI inconsistentes | Etapa 2: migration mapeando `available`→`DISPONIVEL`, etc. |
| 4 | **Dois modelos de usuário** (`profiles` + `usuarios` + `persons`) | Confusão com `usuarios` do plano (policial vs operador) | Etapa 1 plano: documentar `persons`=cautelado, `usuarios`=operador; evoluir schema |
| 5 | **`organizations`/`units` vs `batalhoes`/`reservas`** | Divergência com documento de execução | Decidir: renomear/estender vs views; não duplicar tenancy |
| 6 | **`reservation_id` TEXT** sem FK para reserva | Localização/reserva não rastreável | Etapa 2: `reserva_id` UUID + backfill |
| 7 | **Sem responsável/localização no material** | Estado atual incompleto | Etapa 2: colunas + backfill a partir de cautelas abertas |
| 8 | **Fungíveis (`stock_quantity`)** | Um registro, N unidades; “um responsável” é por qty | Manter modelo híbrido; movimentação por quantidade |
| 9 | **Tenancy só em teste_db** | Produção sem isolamento por batalhão | Promover migrations após QA explícito |
| 10 | **Tabela `categories` órfã** | Ruído no schema | Migration DROP segura (já vazia) |
| 11 | **Menu `/admin` sem rota** | UX quebrada | Remover link ou implementar M4 |
| 12 | **`ammo_batches` com RLS antigo corrigido** | OK em teste_db pós-etapa1 | Replicar em prod |

---

## O QUE ESTÁ FUNCIONANDO CORRETAMENTE

- Login Supabase + bloqueio de inativo no middleware
- RBAC básico operador/supervisor em `profiles` + políticas RLS
- Cadastro de pessoas (cautelados) com PIN, RG, face opcional
- Cadastro e listagem de materiais com patrimônio, calibre, estoque fungível
- Nova cautela (diária/permanente) com wizard, validação de estoque, pacote pistola
- Devolução total e parcial com atualização de estoque
- RPC atômica `create_cautela_atomic` com lock de material
- Audit log em ações principais (`logAudit`)
- Relatórios e export CSV
- Ambiente teste_db separado + scripts QA + E2E Playwright
- Isolamento por unidade (operador) validado em teste_db
- Consolidação de categorias duplicadas (PISTOLA → ARMA CURTA)

---

## O QUE PRECISA SER CONSTRUÍDO DO ZERO

1. **Tabela `movimentacoes`** imutável + tipos ENUM
2. **Funções transacionais** `registrar_cautela`, `registrar_devolucao`, `registrar_vistoria`, etc.
3. **Modelo ENUM** `status_material` e `tipo_material` com migration de backfill
4. **Tabelas `batalhoes` e `reservas`** (ou equivalência formal com `organizations`/`units`)
5. **`usuarios` completo** do plano (matrícula, CPF, patente, perfis estendidos) — sem apagar `persons`
6. **Colunas de estado** em material: responsável, localização, vistoria
7. **Inventário físico** (`inventarios`, `inventario_itens`)
8. **Telas do plano:** materiais em atraso, vistoria anual, inventário, dashboard por perfil
9. **Migração de histórico** cautelas → movimentações
10. **Admin geral** multi-batalhão (22 PMs)

---

## MAPEAMENTO: PLANO DE EXECUÇÃO × ESTADO ATUAL

| Etapa plano | Status | Nota |
|-------------|--------|------|
| **0 — Auditoria** | ✅ Este documento | |
| **1 — Fundação DB/Auth** | 🟡 Parcial | `organizations`/`units`/`usuarios` + RLS em teste_db; **não** é schema `batalhoes`/`reservas` do PDF |
| **2 — Entidade MATERIAL** | 🔴 Não iniciada | `materials` existe; falta ENUM, responsável, triggers |
| **3 — Movimentações** | 🔴 Não existe | Maior gap arquitetural |
| **4 — Cautela temporária** | 🟡 Parcial | Fluxo UI existe; falta modelo movimentação + status ENUM |
| **5 — Cautela permanente / vistoria** | 🟡 Parcial | `type=permanent`, `review_date`; sem movimentação VISTORIA_ANUAL |
| **6 — Inventário** | 🔴 Não existe | |
| **7 — Dashboard/relatórios** | 🟡 Parcial | Dashboard básico + relatórios; não por perfil do plano |
| **8 — Hardening** | 🟡 Parcial | RLS, E2E, Sentry prep; falta carga/concorrência formal |

---

## CRITÉRIO PARA AVANÇAR (Etapa 0 → Etapa 1)

- [x] Relatório de auditoria gerado
- [x] Lista MANTER / ADAPTAR / REMOVER por tabela e tela
- [ ] **Decisão explícita** sobre nomenclatura tenancy: `batalhoes`/`reservas` **vs** evoluir `organizations`/`units`
- [ ] **Decisão explícita** sobre `persons` (cautelados) **vs** `usuarios` do plano (operadores/policiais no sistema)

**Recomendação (não implementada):** não renomear tudo de uma vez. Tratar `organizations`→órgão PM, `units`→batalhão, adicionar `reservas` como filha do batalhão, manter `persons` como cautelados, estender `usuarios` com campos do plano. Introduzir `movimentacoes` na Etapa 3 antes de remover lógica de UPDATE em `materials`.

---

## Próximo passo sugerido

**Etapa 1 (plano PDF):** comparar migration alvo com `20260609140000`, produzir **plano de delta** (migrations aditivas apenas), validar em teste_db, **sem DROP** de tabelas com dados.

Aguardar sua confirmação sobre:

1. Evoluir `organizations`/`units` ou criar `batalhoes`/`reservas` em paralelo  
2. Ordem: completar Etapa 1 tenancy **ou** pular para Etapa 2 status ENUM primeiro

---

*Gerado na Etapa 0 — sem implementação de produto.*
