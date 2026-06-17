# Teste R4 — RESERVA: Validação dos Fixes do Round 6

## Ambiente

- **URL:** https://reserva-teste.vercel.app
- **Login QA:** qa.supervisor@reserva.test / ReservaQA2026!Super
- **Supabase URL:** https://ajyvznrmbuistlcfckuh.supabase.co
- **Supabase Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeXZ6bnJtYnVpc3RsY2Zja3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzE0NjgsImV4cCI6MjA5NDk0NzQ2OH0.tEDojB4Ug89gxBzr6ggyEUjW1AWMf_DaR6t-rgImWsw
- **Supabase Service Role Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeXZ6bnJtYnVpc3RsY2Zja3VoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3MTQ2OCwiZXhwIjoyMDk0OTQ3NDY4fQ.Muk1oCpJ_-eycDbsgwiDdeO-o0tZTrh_Kl6iUXcsZ9Y

## Contexto

O RESERVA passou por 4 rodadas de correções (R1→R4). Esta é a validação dos fixes do R4, que corrigiu os 3 blocantes remanescentes do R6:

### Correções R4 aplicadas
1. **V8 (ALTA):** Trigger `validate_material_reserva_consistency` bloqueia UPDATE de `materials.reserva_id` para reserva de outra unit, UPDATE de `unit_id` para outra organization, e qualquer mudança de `organization_id`
2. **BUG 9.2 (ALTA):** Audit triggers `audit_cautela_item_changes` e `audit_cautela_changes` agora usam `operator_id` da cautela como fallback quando `auth.uid()` é NULL (service_role/chamadas internas)
3. **BUG 10 (ALTA):** Corrigido TypeScript para chamar `aplicar_movimentacao_material` RPC em transferências diretas; `NOTIFY pgrst 'reload schema'` para refresh do PostgREST cache
4. **UX RLS:** 3 RESTRICTIVE policies adicionadas (profiles, persons, materials) — agora PATCH cross-user/cross-reserva retorna **403** em vez de 204 silencioso

### Como testar

- **API REST:** Base `https://ajyvznrmbuistlcfckuh.supabase.co/rest/v1/`
- Headers: `apikey: <ANON_KEY>`, `Authorization: Bearer <token_do_login>`, `Content-Type: application/json`, `Prefer: return=representation`
- Use **token do login QA** para testes de RLS (autenticação)
- Use **service_role key** para verificar dados no banco pós-teste (bypassa RLS)
- Para RPCs, use `POST /rest/v1/rpc/<nome>` com body JSON

### Dados de teste

- Supervisor QA: id `02260499-1d50-4719-be08-e73a7e6c3eea`, reserva `00000000-0000-4000-8000-000000000201`, unit `00000000-0000-4000-8000-000000000101`, org `00000000-0000-4000-8000-000000000001`
- Segunda reserva (outra unit): `00000000-0000-4000-8000-000000000202`, unit `f8b20373-87d7-4969-9da9-93b0daf4cafb` (mesma org)
- Material de teste fungível: PAT-QA-FUNG-001 (stock=20)

---

## Roteiro de Teste R4

### 1. V8 — Cross-unit materials.reserva_id UPDATE (3 testes)

| # | Teste | Passos | Esperado |
|---|-------|--------|----------|
| 1.1 | Usar service_role para encontrar um material da reserva 201 | `GET /materials?reserva_id=eq.00000000-0000-4000-8000-000000000201&select=id,name,reserva_id,unit_id,organization_id&limit=1` usando service_role | 200, 1 material com reserva_id=201, unit_id=101 |
| 1.2 | **V8-a:** Tentar mudar reserva_id para reserva de outra unit | `PATCH /materials?id=eq.<id_do_material> {"reserva_id":"00000000-0000-4000-8000-000000000202"}` usando token do supervisor QA | **403** (RESTRICTIVE policy bloqueia — material pertence à unit 101, reserva 202 é da unit f8b2...) |
| 1.3 | **V8-b:** Tentar mudar organization_id via service_role | `PATCH /materials?id=eq.<id_do_material> {"organization_id":"f8b20373-87d7-4969-9da9-93b0daf4cafb"}` usando service_role | **400** com mensagem MATERIAL_ORG_CHANGE_BLOCKED (trigger bloqueou) |
| 1.4 | **V8-c:** Tentar mudar unit_id para unit de outra org via service_role | `PATCH /materials?id=eq.<id_do_material> {"unit_id":"f8b20373-87d7-4969-9da9-93b0daf4cafb"}` usando service_role | **400** com mensagem MATERIAL_UNIT_CHANGE_BLOCKED (trigger bloqueou) |

### 2. BUG 9.2 — Audit em devolução (2 testes)

| # | Teste | Passos | Esperado |
|---|-------|--------|----------|
| 2.1 | Audit em devolução via app | 1. Fazer login como QA 2. Criar cautela diária com material disponível via UI 3. Devolver item (status=returned) via UI 4. Verificar audit_logs com service_role: `GET /audit_logs?entity=eq.cautela_items&action=eq.item_returned&order=timestamp.desc&limit=1` | 200, 1 entrada com action=item_returned |
| 2.2 | Audit em devolução via API direta | 1. Criar cautela via RPC `create_cautela_atomic` 2. PATCH do cautela_item com status=returned via service_role 3. Verificar audit_logs | 1 entrada item_returned (operador_id preenchido como fallback) |

### 3. BUG 10 — Movimentações via RPC (3 testes)

| # | Teste | Passos | Esperado |
|---|-------|--------|----------|
| 3.1 | RPC aplicar_movimentacao_material visível | `POST /rest/v1/rpc/aplicar_movimentacao_material` com body: `{"p_material_id":"<id_material>","p_tipo":"AJUSTE_ESTOQUE","p_stock_novo":20,"p_status_novo":"DISPONIVEL","p_quantidade":1,"p_observacao":"TESTE_R4_QA"}` usando token QA | **200** com UUID retornado (não PGRST202) |
| 3.2 | Movimentação em criação de cautela | 1. Criar cautela via RPC `create_cautela_atomic` 2. Verificar movimentacoes com service_role `GET /movimentacoes?cautela_id=eq.<cautela_id>&select=id,tipo,status_novo` | Pelo menos 1 movimentação CAUTELA_SAIDA ou CAUTELA_PERMANENTE |
| 3.3 | RPC registrar_movimentacao_devolucao visível | `POST /rest/v1/rpc/registrar_movimentacao_devolucao` com body: `{"p_cautela_item_id":"<item_id>","p_previous_returned":0,"p_new_returned":1,"p_item_status":"returned","p_qty_delivered":1}` usando token QA | **200** com UUID (não PGRST202) |

> **Limpeza:** Após teste 3.1, apagar a movimentação criada e restaurar o material com service_role: `DELETE /movimentacoes?observacao=eq.TESTE_R4_QA` e restaurar stock_quantity

### 4. UX RLS — 403 explícito em vez de 204 silencioso (3 testes)

| # | Teste | Passos | Esperado |
|---|-------|--------|----------|
| 4.1 | **V1/V2 (recheck):** PATCH nome de outro profile | `PATCH /profiles?id=eq.<id_de_outro_usuario> {"name":"HACKED R4"}` usando token do QA | **403** (antes era 204 silencioso; agora RESTRICTIVE policy bloqueia explicitamente) |
| 4.2 | **V7 (recheck):** PATCH person de outra reserva | `PATCH /persons?id=eq.<id_de_outra_reserva> {"full_name":"HACKED R4"}` usando token do QA | **403** (RESTRICTIVE policy) |
| 4.3 | **V8 (recheck):** PATCH material de outra reserva | `PATCH /materials?id=eq.<id_de_outra_reserva> {"name":"HACKED R4"}` usando token do QA | **403** (RESTRICTIVE policy) |

### 5. Fluxo End-to-End simplificado (1 teste)

| # | Teste | Passos | Esperado |
|---|-------|--------|----------|
| 5.1 | Fluxo E2E com movimentações | 1. Login QA 2. Criar cautela diária com material via UI 3. Verificar que movimentacao CAUTELA_SAIDA foi gerada (service_role GET /movimentacoes) 4. Devolver item total via UI 5. Verificar que movimentacao CAUTELA_ENTRADA foi gerada 6. Verificar audit_logs tem item_returned | Tudo OK: movimentações geradas em ambos os passos, audit_logs preenchidos |

---

## Formato do relatório

Para cada teste, reporte:

| # | Teste | Status | Código HTTP | Observação |
|---|-------|--------|-------------|------------|
| 1.1 | ... | PASS/FAIL | 200 | ... |

No final, incluir:
- Resumo: X/Y PASS
- Lista de bugs encontrados (se houver)
- Veredicto: PRONTO PARA PRODUÇÃO ou BLOQUEADO