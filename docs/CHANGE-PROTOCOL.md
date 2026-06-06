# Protocolo de mudanças — RESERVA

Fluxo obrigatório para o agente (e desenvolvedores) ao implementar alterações solicitadas.

## 1. Fonte da verdade

1. Ler trecho relevante em **`docs/obsidian-prd/PRD — Controle de Material.md`** (Obsidian).
2. Se o pedido citar `PRD.md` no repo, confirmar que está sincronizado ([`PRD-OBSIDIAN-BASELINE.md`](./PRD-OBSIDIAN-BASELINE.md)).

## 2. Mapear código

| Área | Onde buscar |
|------|-------------|
| Cautela | `components/CautelaWizard.tsx`, `CautelaReturnFlow.tsx`, `app/actions/cautelas.ts`, `app/api/cautela-return/route.ts`, migrations `create_cautela_atomic*` |
| Materiais / pessoas | `components/MaterialsClient.tsx`, `MaterialForm.tsx`, `PersonRegistrationWizard.tsx`, `app/actions/materials.ts`, `app/actions/persons.ts` |
| Relatórios / alertas | `app/actions/dashboard.ts`, `app/actions/alerts.ts`, `app/(dashboard)/reports/*`, `lib/excel.ts`, `app/api/export/*` |
| Auth / perfis | `middleware.ts`, `app/auth/*`, `lib/auth-cautela.ts`, `supabase/migrations/*rls*` |
| Integrações | `lib/whatsapp.ts`, `lib/pdf-cautela.ts`, `app/api/ocr/route.ts`, variáveis Vercel |
| UI / menu | `components/DashboardShell.tsx`, `app/globals.css`, PWA em `public/` |

## 3. Delta explícito

Antes de codar, registrar em comentário no PR ou na conversa:

- **PRD diz:** …
- **Código faz:** …
- **Mudança:** …

Consultar [`BACKLOG-PRD-GAPS.md`](./BACKLOG-PRD-GAPS.md) se a funcionalidade já estiver listada como lacuna.

## 4. Implementação

- Diff mínimo; seguir convenções existentes (Server Actions, Zod, Tailwind).
- Migration Supabase **somente** se o PRD/schema exigir.
- Não implementar itens do backlog sem pedido (ex.: `/admin` completo).

## 5. Teste → aprovação → produção (obrigatório)

Nenhuma alteração de código ou schema vai para **produção** sem passar por teste e aprovação explícita.

| Passo | Ação | Ambiente |
|-------|------|----------|
| 1 | Implementar (código + migration, se houver) | **teste_db** `ajyvznrmbuistlcfckuh` |
| 2 | Aplicar migration no teste | `workflow_dispatch` em [`.github/workflows/deploy-test.yml`](../.github/workflows/deploy-test.yml) ou `supabase db push --project-ref ajyvznrmbuistlcfckuh` |
| 3 | Validar app | https://reserva-teste.vercel.app — confirmar `/api/version` (`supabaseEnv`: `teste_db`) |
| 4 | QA | `npm run build` + teste manual do fluxo alterado (E2E quando existir) |
| 5 | **Aprovação explícita** | Responsável confirma na conversa/PR: *"Aprovado para produção"* |
| 6 | Promover | Migration prod (`mxlgkpfiugbodocyleij`) + merge/deploy em https://reserva1bpm.vercel.app |

**Proibido:** `db push` direto em produção, merge em `master` ou deploy prod sem etapas 1–5 concluídas.

Detalhes de ambientes: [`AMBIENTE-TESTE.md`](./AMBIENTE-TESTE.md), [`VERCEL-AMBIENTES.md`](./VERCEL-AMBIENTES.md). Plano vertical: [`PLANO-PRODUTO-VERTICAL.md`](./PLANO-PRODUTO-VERTICAL.md) § Governança.

## 6. Validação

```bash
npm run build
```

- Vercel é mais estrito que dev local (ver PRD §18.2).
- Testar manualmente a rota/fluxo alterado.

## 7. Pós-mudança

1. Usuário atualiza PRD no **Obsidian** se a regra de negócio mudou.
2. Opcional: sincronizar `PRD.md` do repo a partir de `docs/obsidian-prd/`.
3. Atualizar `STATE.md` / `ROADMAP.md` só se solicitado.

## Formato do pedido (recomendado)

```
O quê: [descrição]
PRD: [seção ou trecho]
Aceite: [comportamento esperado / exemplo]
```

## Workspace Cursor

Abrir [`controle-material.code-workspace`](../controle-material.code-workspace) para código + PRD lado a lado.
