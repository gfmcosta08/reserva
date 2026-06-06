# Backlog: lacunas PRD × implementação

Itens conhecidos **antes** de novas solicitações de mudança. Não implementar até pedido explícito.

**Referência PRD:** Obsidian v1.2 — `docs/obsidian-prd/PRD — Controle de Material.md`

---

## 1. Rotas de menu sem página

| Rota | Menu | Situação |
|------|------|----------|
| `/admin` | Administração (`DashboardShell.tsx`) | **Sem** `app/**/admin/**` |
| `/settings` | Configurações (`DashboardShell.tsx`) | **Sem** `app/**/settings/**` |

**PRD:** §3.3 — supervisor deve gerenciar usuários, papéis e desativação.

**Código hoje:** apenas checagens pontuais de `role === 'supervisor'` (ex.: exclusão de pessoa em `app/actions/persons.ts`).

**Escopo sugerido quando solicitado:**

- Listar/criar/desativar usuários em `profiles` + vínculo `auth.users`
- Restringir menu Admin/Settings a `supervisor`
- RLS ou policies alinhadas a papéis

---

## 2. Gestão de usuários do sistema

| Funcionalidade (PRD §3.3) | Operador | Supervisor | Implementado |
|---------------------------|:--------:|:----------:|:------------:|
| Gerenciar usuários | ✗ | ✓ | Não (sem UI/API dedicada) |
| Alterar papéis | ✗ | ✓ | Não |
| Desativar usuários | ✗ | ✓ | Parcial (`profiles.is_active` existe; sem tela) |

---

## 3. Cadastro de pessoa v1.3 (PRD atualizado 2026-05-18)

**PRD §5.1 (v1.3)** exige: nome completo, matrícula, RG, **CPF**, e-mail, WhatsApp, foto frente e verso do RG (+ PIN para cautela).

| Tema | PRD v1.3 | Implementação hoje |
|------|----------|-------------------|
| CPF | Obrigatório, único | **Coluna inexistente** em `persons`; sem campo no wizard |
| E-mail | Obrigatório | Wizard exige; schema `NOT NULL` |
| WhatsApp | Obrigatório | Campo `phone` existe; wizard **não** exige em todos os fluxos |
| Fotos RG | Obrigatórias antes de salvar | Passo 2 separado; import legado deixa `NULL` |
| Cadastro incompleto | Só teste / completar no balcão | Sem bloqueio de cautela por perfil incompleto |
| PIN | Obrigatório para assinatura | OK no wizard; import usa `0000` temporário |

Script legado: [`scripts/import/`](../scripts/import/README.md) — registros incompletos apenas em `teste_bd`.

---

## 4. Integrações (código pronto, config pendente)

Documentado no PRD §18.5:

| Integração | Arquivo | Bloqueio |
|------------|---------|----------|
| E-mail + PDF cautela | `app/actions/cautelas.ts`, Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ARCHIVE_EMAIL` |
| WhatsApp | `lib/whatsapp.ts` | `UAZAPI_URL`, `UAZAPI_TOKEN`, `UAZAPI_INSTANCE` |

Comportamento atual: falha silenciosa sem vars (não quebra o fluxo).

---

## 4. Documentação auxiliar desatualizada

| Arquivo | Problema |
|---------|----------|
| `STATE.md` | Data mar/2026; cita e-mail “mock” — PRD v1.2 já descreve Resend |
| `ROADMAP.md` | Item “e-mail mock” pode estar obsoleto |

Atualizar quando houver rodada de documentação (não automático).

---

## 5. Modelo de dados: categorias

- **PRD §2.1:** tabela `categories` + FK `category_id` em `materials`
- **Produção (migration):** `materials.category` TEXT; `categories` removida

Qualquer mudança em materiais/filtros/relatórios deve usar o modelo **real** (`category` texto), até o PRD no Obsidian ser revisado.

---

## 6. Devolução parcial por quantidade (PRD §7.3)

| Tema | PRD | Implementação (2026-05-22) |
|------|-----|---------------------------|
| 2 de 3 carregadores → cautela `partial`, linha `pending` | §7.3 | `lib/cautela-return-status.ts`, `returnItem`, `processBulkDevolution`, API `cautela-return` |
| Saldo **não** vira `divergent` | §7.3 | `computeCautelaStatus` — divergente só `damaged`/`missing` |
| UI total/parcial por linha | §7.3 | `CautelaReturnItemCard`, `CautelaReturnFlow` |
| Legado `divergent` por saldo | — | `scripts/import/fix-divergent-to-partial.mjs` (teste_db) |

**Obsidian:** espelhar §7.3 de [`PRD.md`](../PRD.md) no vault local quando revisar o PRD v1.3.

---

## 7. Junction Obsidian (`docs/obsidian-prd`)

- Aponta para `D:\cofre obsidian\obsidian-vault\Controle de Materiais` (máquina local).
- Não versionar no Git (ver `.gitignore`).
- Em outro PC: recriar junction ou abrir vault no workspace.

---

## Prioridade sugerida (quando você pedir)

1. Admin de usuários (`/admin`) — se operação precisar de supervisão sem Supabase Dashboard  
2. Alinhar PRD Obsidian §2.1 com schema `category` TEXT  
3. Configurar env vars Vercel (e-mail/WhatsApp)  
4. Settings (`/settings`) — definir escopo (perfil, notificações, etc.)  
5. Sincronizar Obsidian com §7.3 (se ainda não copiado do `PRD.md`)
