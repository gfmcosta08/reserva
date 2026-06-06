# Plano executável — RESERVA como Produto Vertical (25–30 PMs)

> **Status:** aprovado em 2026-06-06. Execução solo + subagentes de IA em paralelo.
> **Meta:** mesmo código, multi-unidade, contrato + implantação. Horizonte 12 meses.

## Governança teste → produção

**Regra obrigatória:** todo item do plano (M0–M5) é implementado e validado **primeiro** no ambiente de teste; **somente após aprovação explícita** o item é promovido para produção.

| Etapa | Onde | Critério |
|-------|------|----------|
| 1. Implementar | `teste_db` (`ajyvznrmbuistlcfckuh`) + https://reserva-teste.vercel.app | Código e/ou migration aplicados no teste |
| 2. Validar / QA | Mesmo ambiente de teste | Build verde, fluxo manual ou E2E conforme o milestone |
| 3. Aprovar | Conversa / PR / checklist do milestone | Responsável (você) marca **Aprovado para produção** |
| 4. Promover | `reserva1bpmto` (`mxlgkpfiugbodocyleij`) + https://reserva1bpm.vercel.app | Migration + deploy de produção **somente** após etapa 3 |

**Checklist padrão por milestone** (repetido em M0–M5):

- [ ] Implementado em teste_db
- [ ] Validado/QA
- [ ] Aprovado para produção
- [ ] Promovido produção

Referências: [`CHANGE-PROTOCOL.md`](./CHANGE-PROTOCOL.md), [`AMBIENTE-TESTE.md`](./AMBIENTE-TESTE.md), [`VERCEL-AMBIENTES.md`](./VERCEL-AMBIENTES.md), workflows `.github/workflows/deploy-test.yml` (teste) e `deploy.yml` (prod).

## Decisões travadas

| Tema | Decisão |
|------|---------|
| Tenancy | Banco compartilhado + `organization_id`/`unit_id` + RLS |
| Hosting | Vercel + Supabase Cloud (mantém stack) |
| Execução | Solo (você) + subagentes IA em tracks paralelos |
| Billing | **Indefinido** — track de decisão paralela (não bloqueia técnico) |
| Onboarding | Self-service |
| Prazo | 12 meses (conservador) |

## Princípio-mestre

A espinha dorsal é o **multitenancy (org/unit + RLS)**. O caminho crítico é sequencial e
conduzido por você. Tracks independentes (testes, CI, observabilidade, drift, billing,
segurança) rodam em background via subagentes, **sem** tocar o coração transacional ao mesmo tempo.

---

## Milestones

| Milestone | Janela | Entregável |
|-----------|--------|------------|
| M0 — Fundação | Mês 1 | Rede de segurança: CI gate + E2E + observabilidade |
| M1 — Tenancy data model | Mês 2–3 | org/unit/membership + `organization_id` + backfill |
| M2 — RLS org-scoped | Mês 4–5 | Isolamento provado entre orgs |
| M3 — Auth context + UI | Mês 6–7 | Sessão com org/unit ativa; UI sem hardcode |
| M4 — Admin + Self-service | Mês 8–10 | Cadastro de org, import guiado, gestão de usuários |
| M5 — Hardening + GA | Mês 11–12 | Audit append-only, PIN, billing, 2–3 PMs pagantes |

---

## Caminho crítico (você conduz, sequencial)

### M0 — Fundação (mês 1) — pré-requisito inegociável

**Governança:** [x] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [x] CI: workflow `ci.yml` (build + Vitest + E2E opcional); `deploy.yml` exige `workflow_dispatch` + confirmação `MIGRATE` para prod; `deploy-test.yml` aplica em teste_db (ref `ajyvznrmbuistlcfckuh`) no push de migrations.
- [ ] Tornar preview `reserva-teste` acessível para QA (sem SSO bloqueando) — **bloqueado:** Vercel Deployment Protection / SSO.
- [x] Sentry preparado (`sentry.*.config.ts`, `instrumentation.ts`, `docs/OBSERVABILIDADE-SENTRY.md`) — ativar com DSN; logs estruturados nos fluxos cautela/devolução **pendente**.
- [x] Harness: Vitest + script `npm test`; Playwright smoke em `tests/e2e/` + `playwright.config.ts`.

### M1 — Modelo de dados multi-tenant (mês 2–3)

**Governança:** [ ] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [ ] Migration: `organizations`, `units`, `memberships(user_id, org_id, unit_id, role)`.
- [ ] `organization_id` (+ `unit_id` onde fizer sentido) em: `persons`, `materials`, `cautelas`, `cautela_items`, `divergences`, `audit_logs`, `corrections`, `ammo_batches`, `categories`.
- [ ] Backfill reversível: dados atuais → org "1º BPM" (testar em teste_db primeiro).
- [ ] `create_cautela_atomic` grava `organization_id`.

### M2 — RLS org-scoped (mês 4–5) — coração do produto

**Governança:** [ ] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [ ] Função `current_org_ids()` baseada em `memberships`.
- [ ] Reescrever todas as policies; eliminar todo `USING (true)` (inclui `ammo_batches`).
- [ ] Isolar `service_role` (scripts) — nunca exposto a tenant.
- [ ] **Aceite:** teste automatizado provando Org A → 0 linhas da Org B (inclusive via PostgREST).

### M3 — Auth context + UI scoping (mês 6–7)

**Governança:** [ ] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [ ] Middleware/session resolve org+unit ativa.
- [ ] Remover "Unidade de Comando | Monitorando" hardcoded → nome dinâmico.
- [ ] Seletor de unidade + persistência da seleção.

### M4 — Admin + Self-service onboarding (mês 8–10) — destrava escala

**Governança:** [ ] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [ ] `/admin`: gestão de usuários, roles, desativação.
- [ ] Self-service: signup → cria org → wizard de setup → import CSV → primeira cautela.
- [ ] Templates de categorias/materiais padrão de PM.

### M5 — Hardening + GA (mês 11–12)

**Governança:** [ ] Implementado em teste_db → [ ] Validado/QA → [ ] Aprovado para produção → [ ] Promovido produção

- [ ] `audit_logs` append-only (revoke UPDATE/DELETE) + export pericial.
- [ ] PIN ≥ 6 dígitos, rate-limit server-side, sem `0000` em prod.
- [ ] Billing plugado (ver track E).
- [ ] 2–3 PMs reais em produção isolada.

---

## Tracks de background (subagentes IA, paralelos)

| Track | Escopo | Arquivos-alvo | Janela |
|-------|--------|---------------|--------|
| A — E2E | Playwright dos 5 fluxos (cautela, devolução total/parcial, extravio, relatório) | `tests/`, `playwright.config.ts` | M0+ |
| B — CI/CD | Workflows gate teste_db→preview→prod | `.github/workflows/` | M0 |
| C — Observabilidade | Sentry + alertas 5xx / falha de migration | `sentry.*.config.ts`, `package.json` | M0–M1 |
| D — Drift PRD/schema | CPF, `categories` TEXT vs tabela, rotas 404, fonte única da verdade | `PRD.md`, migrations, `docs/` | M1–M3 |
| E — Billing/contrato | Comparativo empenho público vs recorrente vs híbrido + recomendação | `docs/` | M2–M5 |
| F — Segurança | Spec audit append-only, política de PIN, isolamento service_role | migrations, `lib/` | M4–M5 |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Refatorar RLS sem testes | M0 obrigatório antes de M1 |
| Backfill corromper dados de prod (armas reais) | teste_db primeiro + migration reversível + backup |
| Solo → burnout no caminho crítico | Background agents tiram tracks A–F do prato |
| Licitação trava receita | Track E começa cedo; 1º BPM como âncora |
| Residência de dados gov exigida por PM | Validar com 1ª PM contratante antes de M4 |

---

## Ordem de execução imediata

1. M0 — Track A (E2E) + Track B (CI) + Track C (Sentry) em paralelo.
2. Caminho crítico só avança para M1 quando M0 estiver verde.
