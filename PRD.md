# PRD — RESERVA: Sistema de Controle de Materiais
**Versão:** 1.0  
**Data:** 2026-05-13  
**Status:** Documentação do estado atual (As-Is)

---

## 1. Visão Geral do Sistema

**Nome:** RESERVA — Sistema de Controle de Materiais  
**Propósito:** Controle de custódia de armas e materiais (cautela) com rastreabilidade completa, autenticação biométrica e audit trail imutável.  
**Stack:** Next.js 14.2 + TypeScript + Supabase (PostgreSQL) + Tailwind CSS  
**Deploy:** Vercel + Supabase Cloud

### 1.1 Problema que Resolve
Controle manual de saída e devolução de materiais (especialmente armas e munições) é suscetível a falhas humanas, perda de rastreabilidade e ausência de histórico auditável. O RESERVA resolve isso com um fluxo digital, autenticado por PIN/biometria e registrado em audit log imutável.

### 1.2 Usuários

| Perfil | Descrição |
|--------|-----------|
| **Operador** | Executa operações do dia a dia: criação de cautelas, devolução de itens, cadastro de materiais e pessoas |
| **Supervisor** | Possui tudo do Operador + gerencia usuários do sistema e perfis |

---

## 2. Arquitetura de Dados

### 2.1 Tabelas Principais

#### `profiles` — Usuários do sistema
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | FK → auth.users |
| name | text | obrigatório |
| email | text | único |
| role | enum | `operator` \| `supervisor` |
| is_active | boolean | inativo não acessa o sistema |
| created_at / updated_at | timestamp | automático |

#### `persons` — Pessoas que recebem materiais em cautela
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| full_name | text | obrigatório |
| email | text | único, opcional |
| rg | text | número do RG — único |
| registration_number | text | matrícula funcional — único |
| function | text | cargo/função |
| status | enum | `active` \| `inactive` |
| pin_hash | text | bcrypt (custo 10) do PIN de 4 dígitos |
| rg_front_url | text | URL pública no Supabase Storage |
| rg_back_url | text | URL pública no Supabase Storage |
| face_descriptor | JSONB | vetor 128D do face-api.js |
| failed_pin_attempts | int | contador de tentativas falhas |
| pin_locked_until | timestamp | bloqueio automático após 3 falhas |

#### `categories` — Categorias de materiais
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| name | text | único |

#### `materials` — Inventário de materiais
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| name | text | obrigatório |
| category_id | UUID | FK → categories |
| patrimony_number | text | número de patrimônio — único |
| serial_number | text | número de série |
| internal_code | text | código interno — único |
| marca | text | fabricante/marca |
| modelo | text | modelo específico |
| calibre | text | calibre (ex: 9mm, .40, 12GA) — usado para armas e munições |
| status | enum | `available` \| `cautelado` \| `maintenance` \| `unavailable` |
| notes | text | observações livres |
| created_at / updated_at | timestamp | automático |

**Tipos de materiais controlados pelo sistema:**

| Nome popular | Nome técnico no sistema | Campo relevante |
|-------------|------------------------|-----------------|
| Arma de fogo | Arma (ex: "Pistola Taurus PT100") | marca, modelo, calibre |
| Munição | Munição (ex: "Munição 9mm CBC") | calibre (validado vs. arma) |
| HT / Rádio | **TRANSCEPTOR** (ex: "Transceptor Motorola DEP550") | marca, modelo |
| Colete | Colete balístico | marca, modelo |
| Algema | Algema | marca, modelo |
| Bornal | Bornal (colete portamunição) | — |
| Outros EPI/EPC | Conforme categoria cadastrada | — |

> **Nota técnica:** O campo `calibre` é exclusivo de armas e munições. Para transceptores e demais equipamentos, o campo não é preenchido. O nome técnico padrão para rádios HT no sistema é **TRANSCEPTOR**, devendo ser usado na criação do material para manter consistência nas buscas e relatórios.

#### `cautelas` — Registros de custódia
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| person_id | UUID | FK → persons |
| operator_id | UUID | FK → profiles (quem criou) |
| type | enum | `daily` \| `permanent` |
| status | enum | `open` \| `partial` \| `closed` \| `divergent` |
| notes | text | observações operacionais |
| created_at | timestamp | automático |
| closed_at | timestamp | preenchido ao fechar |

#### `cautela_items` — Itens dentro de cada cautela
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| cautela_id | UUID | FK → cautelas |
| material_id | UUID | FK → materials |
| status | enum | `pending` \| `returned` \| `missing` \| `damaged` |
| quantity_delivered | int | quantidade entregue |
| quantity_returned | int | quantidade devolvida |
| notes | text | observações de devolução |
| returned_at | timestamp | quando foi devolvido |
| returned_by | UUID | FK → profiles (operador que recebeu) |
| UNIQUE(cautela_id, material_id) | — | impede duplicata no mesmo registro |

#### `divergences` — Divergências (danos/perdas)
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| cautela_item_id | UUID | FK → cautela_items |
| description | text | descrição do problema |
| status | enum | `open` \| `resolved` |
| resolved_by | UUID | FK → profiles |
| resolved_at | timestamp | quando foi resolvido |

#### `audit_logs` — Trail de auditoria imutável
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → profiles |
| action | text | ex: `cautela_created`, `item_returned` |
| entity | text | ex: `cautela`, `material`, `person` |
| entity_id | UUID | ID da entidade afetada |
| before_state | JSONB | snapshot antes da ação |
| after_state | JSONB | snapshot após a ação |
| ip_address | text | IP de origem |
| timestamp | timestamp | automático |

#### `corrections` — Histórico de alterações manuais
| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → profiles |
| entity | text | tipo da entidade |
| entity_id | UUID | ID da entidade |
| field_changed | text | campo alterado |
| old_value | text | valor anterior |
| new_value | text | novo valor |
| justification | text | motivo da alteração |

---

## 3. Autenticação e Autorização

### 3.1 Login do Operador/Supervisor

```
[Tela /auth/login]
  ├── Campo: Email
  ├── Campo: Senha
  ├── Botão: Entrar
  │     └── Chama Supabase Auth (email + password)
  │           ├── Sucesso → redireciona para /
  │           └── Erro → exibe mensagem de credencial inválida
  └── Link: "Esqueci minha senha"
        └── Envia e-mail de reset via Supabase + Resend
              └── Redireciona para /auth/reset-password com token
```

**Validações:**
- E-mail deve estar cadastrado em `auth.users` com perfil ativo em `profiles`
- Se `is_active = false` → acesso negado mesmo com senha correta
- Se perfil não encontrado → acesso negado (fail-closed)

### 3.2 Sessão e Middleware
- Middleware (`middleware.ts`) verifica token em **todas** as rotas protegidas
- Rota pública única: `GET /api/version`
- Token sem sessão válida → redirecionamento para `/auth/login`

### 3.3 Controle de Acesso por Papel

| Funcionalidade | Operador | Supervisor |
|----------------|:--------:|:----------:|
| Dashboard | ✓ | ✓ |
| Listar materiais | ✓ | ✓ |
| Criar/editar material | ✓ | ✓ |
| Alterar status de material | ✓ | ✓ |
| Importar CSV de materiais | ✓ | ✓ |
| Listar pessoas | ✓ | ✓ |
| Criar/editar pessoa | ✓ | ✓ |
| Criar cautela | ✓ | ✓ |
| Devolver itens | ✓ | ✓ |
| Renovar cautela | ✓ | ✓ |
| Ver relatórios | ✓ | ✓ |
| Ver histórico/audit log | ✓ | ✓ |
| Gerenciar usuários do sistema | ✗ | ✓ |
| Alterar papéis de usuário | ✗ | ✓ |
| Desativar usuários | ✗ | ✓ |

---

## 4. Cadastro de Materiais

### 4.1 Fluxo de Criação

```
[Tela /materials]
  └── Botão: "+ Novo Material"
        └── Abre formulário modal (MaterialForm)
              ├── nome* (text)
              ├── número de patrimônio* (único)
              ├── código interno* (único)
              ├── número de série (opcional)
              ├── categoria* (select com sugestões)
              ├── marca (opcional — ex: Taurus, Imbel)
              ├── modelo (opcional — ex: PT100, M964)
              ├── calibre (opcional — ex: 9mm, .40, .38)
              ├── observações (textarea)
              └── Botão: Salvar
                    └── Action: createMaterial(data)
                          ├── Valida via Zod schema
                          ├── Verifica unicidade: patrimony_number, internal_code
                          ├── status inicial: "available"
                          ├── Grava em `materials`
                          ├── Cria entrada em `audit_logs`
                          └── Revalida cache: /materials
```

**Validações Zod:**
- `name`: string obrigatória
- `patrimony_number`: string obrigatória, única no banco
- `internal_code`: string obrigatória, única no banco
- `calibre`: string livre (sem enum fixo)

### 4.2 Fluxo de Importação em Lote (CSV)

```
[Tela /materials] → Botão: "Importar CSV"
  └── Upload de arquivo .csv
        └── Action: importMaterialsCsv(csvText)
              ├── Parse linha por linha
              ├── Colunas esperadas:
              │     nome, patrimonio, codigoInterno, numeroSerie,
              │     idReserva, categoria, marca, modelo, calibre, observacoes
              ├── Linhas inválidas → ignoradas (não aborta o processo)
              ├── Linhas válidas → insertadas em batch
              └── Retorna: { success: N, errors: M }
```

### 4.3 Ciclo de Vida do Status do Material

```
available (disponível)
    ↓ checkout via cautela
cautelado (em posse de alguém)
    ↓ devolvido normalmente
available
    ↓ devolvido com dano
maintenance (em manutenção/reparo)
    ↓ após reparo (status manual)
available
    ↓ devolvido como perdido/extraviado
unavailable (fora de uso permanente)
```

**Transições válidas:**
| De | Para | Gatilho |
|----|------|---------|
| available | cautelado | Criação de cautela |
| cautelado | available | Item devolvido (status: returned) |
| cautelado | maintenance | Item devolvido (status: damaged) |
| cautelado | unavailable | Item devolvido (status: missing) |
| maintenance | available | Alteração manual de status |
| qualquer | qualquer | Alteração manual pelo operador (com justificativa) |

### 4.4 Filtros na Listagem de Materiais

A tela `/materials` oferece os seguintes filtros combinados:
- **Busca textual:** nome, número de patrimônio, código interno, número de série
- **Categoria:** dropdown com todas as categorias cadastradas
- **Status:** available / cautelado / maintenance / unavailable
- **Marca:** filtro por fabricante
- **Modelo:** filtro por modelo
- **Calibre:** filtro por calibre (ex: 9mm)
- **ID de Reserva:** filtro por identificador de reserva específico

---

## 5. Cadastro de Pessoas

### 5.1 Fluxo de Registro

```
[Tela /persons] → Botão: "+ Nova Pessoa"
  └── Wizard de Cadastro (PersonRegistrationWizard)
        ├── Passo 1: Dados Básicos
        │     ├── nome completo*
        │     ├── email (único, opcional)
        │     ├── RG* (único)
        │     ├── matrícula* (único)
        │     ├── função/cargo (opcional)
        │     └── PIN de 4 dígitos* (digitado 2x para confirmação)
        │           └── Hash: bcrypt(pin, custo=10) → salvo em pin_hash
        │
        ├── Passo 2: Fotos do RG
        │     ├── Upload frente do RG
        │     │     └── Action: uploadRgPhoto(formData)
        │     │           ├── Bucket: "documents" (Supabase Storage)
        │     │           ├── Nome do arquivo: {uuid}_{timestamp}_front.{ext}
        │     │           └── Retorna URL pública → salva em rg_front_url
        │     └── Upload verso do RG
        │           └── Mesmo fluxo → salva em rg_back_url
        │
        └── Passo 3: Biometria Facial (opcional)
              └── Componente: FaceRegistration
                    ├── Acessa câmera do dispositivo
                    ├── Usa face-api.js + TensorFlow.js
                    ├── Detecta rosto ao vivo no vídeo
                    ├── Gera vetor 128D (face descriptor)
                    └── Salva em persons.face_descriptor (JSONB)

  └── Botão: Salvar
        └── Action: createPerson(data)
              ├── Valida unicidade: email, rg, registration_number
              ├── Grava todos os campos em `persons`
              ├── Cria entrada em `audit_logs`
              └── Revalida cache: /persons
```

### 5.2 Segurança do PIN

| Evento | Comportamento |
|--------|---------------|
| Tentativa incorreta (1ª/2ª) | Incrementa `failed_pin_attempts`, mensagem de erro |
| Tentativa incorreta (3ª) | `pin_locked_until` = agora + 15 min, bloqueio total |
| Tentativa durante bloqueio | Retorna erro com tempo restante |
| Após 15 minutos | `pin_locked_until` expirou, acesso liberado automaticamente |
| Tentativa correta | Zera `failed_pin_attempts` |

### 5.3 Fotos do RG — Imutabilidade
- Após upload, as fotos **nunca são sobrescritas**
- Cada upload gera nome de arquivo único com timestamp
- URLs são permanentes no Supabase Storage
- Visíveis nas telas de detalhe da cautela e da pessoa

---

## 6. Criação de Cautela (Checkout de Material)

### 6.1 Wizard de Cautela — 4 Passos

#### Passo 1: Seleção de Pessoa
```
[Busca de pessoa]
  ├── Campo de busca: nome, RG ou matrícula
  ├── Resultado: lista de pessoas ativas
  │     ├── Foto (frente do RG)
  │     ├── Nome completo
  │     ├── Matrícula / Função
  │     └── Badge: "X cautela(s) ativa(s)" se houver pendências
  └── Selecionar pessoa → avança para Passo 2
```

**Alerta:** Se a pessoa já tem cautela aberta, exibe aviso mas não bloqueia a criação.

#### Passo 2: Seleção de Materiais
```
[Seleção de materiais]
  ├── Campo de busca: nome, patrimônio, código interno, serial
  ├── Filtros: categoria, status (apenas available)
  ├── Adicionar item à cautela:
  │     ├── Quantidade a entregar (padrão: 1)
  │     └── Para munição: valida calibre compatível com arma selecionada
  │           └── lib/cautela-caliber.ts: verifica se calibres são compatíveis
  ├── Campo: "Inclui bornal?" (sim/não) — para munições
  └── Campo: Observações adicionais do item
```

**Validação de Calibre:**
- Ao adicionar munição junto com arma, verifica se `material.calibre` da munição é compatível com o `material.calibre` da arma
- Incompatibilidade → aviso (não bloqueia, apenas alerta)

#### Passo 3: Revisão e Tipo de Cautela
```
[Resumo]
  ├── Tabela de itens selecionados:
  │     ├── Nome do material
  │     ├── Patrimônio / Código interno
  │     ├── Categoria
  │     └── Quantidade
  ├── Tipo de cautela:
  │     ├── [x] Diária — deve ser devolvida no mesmo dia
  │     │         └── Dashboard exibe alerta se não devolvida até fim do dia
  │     └── [ ] Permanente — sem prazo de devolução definido
  └── Observações operacionais (com sugestões rápidas):
        ├── "Operação"
        ├── "Treinamento"
        ├── "Plantão"
        └── "Judicial"
```

#### Passo 4: Autorização
```
[Autorização]
  ├── Opção A: PIN (padrão)
  │     ├── Campo: 4 dígitos
  │     ├── Action: validatePin(personId, pin)
  │     │     ├── Hash do input comparado com pin_hash (bcrypt.compare)
  │     │     ├── Verifica pin_locked_until
  │     │     └── Gerencia failed_pin_attempts
  │     └── PIN correto → prossegue
  │
  └── Opção B: Reconhecimento Facial (se person.face_descriptor existir)
        ├── Componente: FaceVerification
        ├── Acessa câmera
        ├── Captura face ao vivo
        ├── Gera vetor 128D
        ├── Calcula distância euclidiana vs. face_descriptor cadastrado
        │     ├── Distância < threshold → match → prossegue
        │     └── Distância >= threshold → falha → pede PIN como fallback
        └── Match → prossegue
```

### 6.2 Criação Atômica no Banco

```
Action: createCautela(data) / createCautelaFaceAuth(data)
  └── RPC: create_cautela_atomic(params)
        ├── Dentro de uma única transação PostgreSQL:
        │     ├── Verifica disponibilidade de TODOS os materiais (status = 'available')
        │     │     └── Se qualquer material não está disponível → ROLLBACK + erro
        │     ├── Insere registro em `cautelas`
        │     ├── Insere N registros em `cautela_items`
        │     ├── Atualiza status de cada material → 'cautelado'
        │     └── COMMIT
        └── Após sucesso:
              ├── Cria entrada em `audit_logs` (action: 'cautela_created')
              └── Revalida cache: /cautelas, /materials
```

**Proteção contra race condition:** A transação garante que dois operadores não possam cautelar o mesmo material simultaneamente.

---

## 7. Devolução de Itens (Checkin)

### 7.1 Fluxo de Devolução

```
[Tela /cautelas]
  └── Cautela selecionada → Ver itens
        └── Para cada item pendente (status: pending):
              ├── Botão: "Devolver"
              │     └── Modal de devolução:
              │           ├── Status de devolução:
              │           │     ├── [x] Devolvido (returned)
              │           │     ├── [ ] Danificado (damaged)
              │           │     └── [ ] Extraviado (missing)
              │           ├── Quantidade devolvida (para itens com quantidade > 1)
              │           ├── Campo: Observações
              │           └── Botão: Confirmar
              │                 └── POST /api/cautela-return
              │                       ├── Atualiza cautela_items.status
              │                       ├── Atualiza cautela_items.quantity_returned
              │                       ├── Atualiza cautela_items.returned_at = agora
              │                       ├── Atualiza cautela_items.returned_by = operador atual
              │                       └── Atualiza materials.status:
              │                             ├── returned → 'available'
              │                             ├── damaged → 'maintenance'
              │                             └── missing → 'unavailable'
              │
              └── Após cada devolução: recalcula status da cautela
                    ├── Todos os itens returned → cautela.status = 'closed'
                    ├── Alguns itens returned → cautela.status = 'partial'
                    └── Algum item damaged ou missing → cautela.status = 'divergent'
```

### 7.2 Ciclo de Vida da Cautela

```
open (criada, todos os itens pendentes)
    ↓ primeira devolução parcial
partial (alguns itens devolvidos, outros pendentes)
    ↓ todos os itens devolvidos sem problemas
closed (encerrada com sucesso)
    OU
    ↓ qualquer item com dano ou extravio
divergent (requer investigação/revisão do supervisor)
```

**Transitions:**
| Status Cautela | Condição |
|----------------|----------|
| open | Nenhum item foi devolvido ainda |
| partial | Pelo menos 1 item devolvido, outros ainda pendentes |
| closed | Todos os itens com status `returned` |
| divergent | Qualquer item com status `damaged` ou `missing` |

---

## 8. Funcionalidades Adicionais de Cautela

### 8.1 Renovação de Cautela Diária (RenewalModal)

```
[Cautela com tipo: daily e status: open/partial]
  └── Botão: "Renovar"
        └── Modal: RenewalModal
              ├── Opções rápidas:
              │     ├── +30 dias
              │     ├── +60 dias
              │     └── +90 dias
              └── Campo: Data personalizada
                    └── Action: renewCautela(cautelaId, novaData)
                          ├── Atualiza cautela (campo expires_at ou similar)
                          ├── Registra em audit_logs
                          └── Revalida cache
```

### 8.2 Visualização de Fotos do RG na Cautela

```
[Detalhe da cautela]
  └── Link/botão: "Ver RG"
        └── Modal com frente e verso do RG da pessoa
              ├── Carrega rg_front_url da person
              └── Carrega rg_back_url da person
```

### 8.3 Leitor de Código de Barras / QR Code (BarcodeScanner)

```
[Disponível em telas de seleção de material]
  └── Botão: "Escanear"
        └── Componente: BarcodeScanner
              ├── Acessa câmera
              ├── Usa BarcodeDetector API (browsers modernos)
              ├── Suporta formatos:
              │     QR Code, Code128, Code39, EAN-13, EAN-8, UPC-A, UPC-E
              ├── Toggle lanterna (flashlight) para ambientes escuros
              ├── Modo one-shot: lê 1 código e confirma
              └── Código lido → preenche campo de busca automaticamente
```

---

## 9. Dashboard

### 9.1 Componentes da Tela Principal (`/`)

```
[Dashboard]
  ├── Cards de Estatísticas (getDashboardStats):
  │     ├── Total de materiais no inventário
  │     ├── Cautelas ativas (open + partial)
  │     ├── Pessoas cadastradas
  │     └── Alertas (divergências abertas + cautelas diárias vencidas)
  │
  ├── Gráfico: Distribuição de Materiais (Pie Chart)
  │     └── Fatias: available / cautelado / maintenance / unavailable
  │
  ├── Gráfico: Visão Geral de Cautelas (Bar Chart)
  │     └── Barras: open / partial / closed / divergent
  │
  ├── Feed de Atividade Recente (últimas 10 entradas do audit_log):
  │     ├── Quem fez o quê
  │     ├── Em qual entidade
  │     └── Quando
  │
  ├── Painel de Status do Arsenal:
  │     ├── % de disponibilidade
  │     └── Contagem por status
  │
  └── Alerta de Cautelas Diárias Vencidas:
        └── Se existe cautela do tipo 'daily' com status 'open'/'partial'
              criada antes de hoje → exibe alerta destacado
```

---

## 10. Relatórios

### 10.1 Relatório de Materiais (`/reports/materials`)
- Agrupamento por categoria
- Para cada categoria: lista os materiais com nome, patrimônio, código interno, status
- Quantidade: available / cautelado / maintenance / unavailable
- Para itens **cautelado**: mostra quem está com o material, qual cautela, data de saída

### 10.2 Relatório de Cautelas Ativas (`/reports/cautelas`)
- Todas as cautelas com status `open` ou `partial`
- Por cautela: pessoa, RG, função, operador que criou, data de criação
- Por item: nome do material, patrimônio, código interno, status do item
- Contagem resumo: total de itens, devolvidos, pendentes

### 10.3 Relatório de Divergências (`/reports/divergencias`)
- Todas as cautelas com status `divergent`
- Filtros: período (data início/fim), tipo (daily/permanent)
- Por divergência: item afetado, tipo de problema (dano/extravio), responsável, status (open/resolved)
- Ação supervisor: marcar divergência como resolvida

---

## 11. Histórico e Auditoria (`/history`)

```
[Tela /history]
  ├── Filtros:
  │     ├── Entidade: cautela / material / person
  │     └── Tipo de ação: cautela_created / item_returned / material_updated / etc.
  ├── Lista paginada de entradas do audit_log:
  │     ├── Quem: nome do usuário
  │     ├── Ação: tipo (cautela_created, item_returned, ...)
  │     ├── Entidade: tipo e ID
  │     ├── Estado anterior (before_state JSON)
  │     ├── Estado posterior (after_state JSON)
  │     └── Timestamp
  └── Paginação: action countAuditLogs() para total, getCautelaById() para página
```

**Ações registradas no audit_log:**
| Ação | Entidade | Gatilho |
|------|----------|---------|
| cautela_created | cautela | Criação do wizard |
| item_returned | cautela_item | Devolução de item |
| item_damaged | cautela_item | Devolução com dano |
| item_missing | cautela_item | Devolução como extraviado |
| material_created | material | Cadastro de material |
| material_updated | material | Edição de material |
| material_status_changed | material | Alteração de status |
| person_created | person | Cadastro de pessoa |
| person_updated | person | Edição de pessoa |

---

## 12. API Routes e Server Actions

### 12.1 Rotas de API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/version` | Retorna `{app:"RESERVA"}` — rota pública usada para health check |
| GET | `/api/materials-page` | Lista de materiais com filtros (query params) |
| POST | `/api/cautela-return` | Processa devolução de item de cautela |
| POST | `/api/email` | Envia e-mail via Resend (reset de senha, alertas) |
| POST | `/api/ocr` | Extrai texto de imagem via Tesseract.js |

### 12.2 Server Actions (app/actions/)

**Cautelas (`cautelas.ts`):**
| Action | Parâmetros | Retorno |
|--------|-----------|---------|
| getCautelas(filters) | status, search | CautelaWithDetails[] |
| getCautelaById(id) | UUID | CautelaWithDetails |
| createCautela(data) | CautelaCreateInput | { success, cautelaId } |
| createCautelaFaceAuth(data) | CautelaCreateInput | { success, cautelaId } |
| returnItem(itemId, status, notes) | UUID, enum, string | void |
| renewCautela(id, expiresAt) | UUID, Date | void |
| getPendingCautelasForPerson(personId) | UUID | Cautela[] |
| validatePin(personId, pin) | UUID, string | { valid, locked, remainingTime } |

**Materiais (`materials.ts`):**
| Action | Parâmetros | Retorno |
|--------|-----------|---------|
| createMaterial(data) | MaterialCreateInput | { success, id } |
| updateMaterial(id, data) | UUID, Partial<Material> | void |
| updateMaterialStatus(id, status, notes) | UUID, enum, string | void |
| importMaterialsCsv(csvText) | string | { success: N, errors: M } |

**Pessoas (`persons.ts`):**
| Action | Parâmetros | Retorno |
|--------|-----------|---------|
| getPersons(query) | search string | Person[] |
| createPerson(data) | PersonCreateInput | { success, id } |
| uploadRgPhoto(formData) | FormData | { url } |
| searchPersons(query) | string | Person[] |

**Dashboard (`dashboard.ts`):**
| Action | Parâmetros | Retorno |
|--------|-----------|---------|
| getDashboardStats() | — | DashboardStats |

---

## 13. Estrutura de Arquivos

```
app/
  (dashboard)/                    # Rotas protegidas (requerem autenticação)
    layout.tsx                    # Layout com sidebar + verificação de auth
    page.tsx                      # Dashboard (/)
    materials/
      page.tsx                    # Lista de materiais
    persons/
      page.tsx                    # Gestão de pessoas
    cautelas/
      page.tsx                    # Lista de cautelas
    history/
      page.tsx                    # Histórico de auditoria
    reports/
      materials/page.tsx          # Relatório de materiais
      cautelas/page.tsx           # Relatório de cautelas ativas
      divergencias/               # Relatório de divergências
  auth/
    login/page.tsx                # Tela de login
    reset-password/page.tsx       # Redefinição de senha
  actions/                        # Server actions (lógica de negócio no servidor)
    cautelas.ts
    materials.ts
    persons.ts
    dashboard.ts
    divergences.ts
    audit.ts
    notifications.ts
  api/                            # Rotas de API REST
    cautela-return/route.ts
    materials-page/route.ts
    email/route.ts
    ocr/route.ts
    version/route.ts
  layout.tsx                      # Layout raiz

components/
  CautelaWizard.tsx               # Wizard de 4 passos para criação de cautela
  CautelasClient.tsx              # Listagem e gestão de cautelas (client-side)
  MaterialsClient.tsx             # Listagem e filtros de materiais (client-side)
  PersonsClient.tsx               # Listagem e gestão de pessoas (client-side)
  FaceRegistration.tsx            # Captura de biometria facial
  FaceVerification.tsx            # Verificação biométrica no checkout
  BarcodeScanner.tsx              # Leitor de QR/código de barras
  MaterialForm.tsx                # Formulário de criação/edição de material
  PersonRegistrationWizard.tsx    # Wizard de cadastro de pessoa
  RenewalModal.tsx                # Modal de renovação de cautela diária
  CategoryManager.tsx             # Gerenciador de categorias
  DashboardShell.tsx              # Shell com sidebar de navegação
  NotificationsDropdown.tsx       # Dropdown de notificações

lib/
  auth-cautela.ts                 # requireCautelaOperator() — guarda de rota
  cautela-helpers.ts              # Helpers de merge e validação
  cautela-schemas.ts              # Schemas Zod de validação
  cautela-caliber.ts              # Validação de compatibilidade de calibres
  supabase-server.ts              # Cliente Supabase (server-side)
  supabase-client.ts              # Cliente Supabase (client-side)

middleware.ts                     # Verificação de autenticação em todas as rotas
```

---

## 14. Funcionalidades em Infraestrutura (Não Totalmente Integradas)

### 14.1 OCR via Tesseract.js
- Rota: `POST /api/ocr`
- Capacidade: extrair texto de fotos de RG ou etiquetas de materiais
- Status: infraestrutura pronta, não integrada ao fluxo principal

### 14.2 E-mails via Resend
- Rota: `POST /api/email`
- Atualmente usado para: reset de senha
- Infraestrutura disponível para: alertas de cautelas vencidas, notificações de divergências

### 14.3 Notificações In-App
- Componente: `NotificationsDropdown`
- Exibe alertas de cautelas diárias não devolvidas
- Action: `getNotifications()` (em `notifications.ts`)

---

## 15. Requisitos Não-Funcionais (Estado Atual)

| Requisito | Implementação |
|-----------|--------------|
| Autenticação | Supabase Auth (JWT) |
| Autorização | Middleware + RLS no Supabase |
| Atomicidade | RPC PostgreSQL (`create_cautela_atomic`) |
| Audit Trail | Tabela `audit_logs` com before/after state |
| Segurança de PIN | bcrypt (custo 10) + lockout após 3 falhas |
| Biometria | face-api.js + TensorFlow.js (128D descriptor) |
| Imutabilidade de documentos | Fotos com nomes únicos (UUID + timestamp) |
| Performance | Next.js SSR + cache revalidation por rota |
| Scanning | BarcodeDetector API (Web Standard) |
| Storage | Supabase Storage (bucket: documents) |

---

## 16. Fluxo Completo — Visão End-to-End

```
OPERADOR                              SISTEMA
    │                                    │
    ├─ Login (email + senha) ───────────►│
    │◄──────────────────────── Sessão JWT│
    │                                    │
    ├─ Cadastrar pessoa ────────────────►│
    │  (nome, RG, matrícula, PIN, foto)  │
    │◄──────────────────── Pessoa salva  │
    │                                    │
    ├─ Cadastrar material ──────────────►│
    │  (nome, patrimônio, calibre, etc.) │
    │◄────────────────── Material salvo  │
    │                                    │
    ├─ Criar cautela ───────────────────►│
    │  Passo 1: Seleciona pessoa         │
    │  Passo 2: Seleciona materiais      │
    │  Passo 3: Define tipo (daily/perm) │
    │  Passo 4: Pessoa insere PIN        │
    │◄───────────────────── Cautela open │
    │  Materiais → 'cautelado'           │
    │                                    │
    │  [... período de uso ...]          │
    │                                    │
    ├─ Devolver item ───────────────────►│
    │  Seleciona cautela → item          │
    │  Status: returned/damaged/missing  │
    │◄────────────────── Item atualizado │
    │  Material → available/maint/unavail│
    │  Cautela → partial/closed/divergent│
    │                                    │
    ├─ Ver dashboard ───────────────────►│
    │◄──────────── Stats + alertas + log │
    │                                    │
    └─ Ver relatórios ──────────────────►│
       ◄────────── Relatórios filtrados  │
```

---

## 17. Novas Funcionalidades Implementadas (v1.1 — 2026-05-13)

### 17.1 PDF de Cautela por E-mail
- Ao criar uma cautela, o sistema gera automaticamente um PDF profissional (`lib/pdf-cautela.ts` via jspdf)
- O PDF é enviado por e-mail via Resend para:
  - E-mail da pessoa que cautelou (campo `persons.email`)
  - E-mail de arquivo institucional (`ARCHIVE_EMAIL` env var)
- O envio é assíncrono — não bloqueia a criação da cautela
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ARCHIVE_EMAIL`

### 17.2 Notificações WhatsApp via uazapi.dev
- Ao criar uma cautela, envia automaticamente resumo por WhatsApp para o número cadastrado na pessoa (`persons.phone`)
- Formato da mensagem: emoji + nome + tipo + data + lista de materiais + operador
- Campo `phone` adicionado ao cadastro de pessoas (wizard passo 1)
- **Env vars:** `UAZAPI_URL`, `UAZAPI_TOKEN`, `UAZAPI_INSTANCE` (opcional)
- Integração em `lib/whatsapp.ts` — nunca lança exceção, log de erro gracioso

### 17.3 Tela de Alertas (`/alerts`)
- Substitui os alertas por e-mail de cautelas vencidas (decisão: tela dedicada é mais adequada)
- Três seções:
  - **Cautelas Diárias Vencidas** (vermelho): cautelas `daily` + `open/partial` criadas antes de hoje
  - **Divergências Abertas** (âmbar): itens `damaged/missing` com divergência sem resolução
  - **Revisões Pendentes** (azul): cautelas permanentes com `review_date` nos próximos 30 dias
- Contador total de alertas no topo da página
- Server action: `getAlerts()` em `app/actions/alerts.ts`

### 17.4 OCR Integrado no Cadastro de Materiais
- Botão "Escanear Etiqueta (OCR)" no formulário de cadastro de material
- Abre câmera ou picker de arquivo
- Envia imagem para `POST /api/ocr` (Tesseract.js / OCR.Space)
- Preenche automaticamente os campos Nº de Série e Patrimônio

### 17.5 Histórico por Pessoa (`/persons/[id]`)
- Página de timeline completa de todas as cautelas de uma pessoa
- Card com dados da pessoa (foto RG, nome, matrícula, função, telefone)
- Estatísticas: total de cautelas, encerradas, com divergência
- Lista de cautelas com: status, tipo, data, itens (com status de devolução), operador
- Botão "Ver histórico" (ícone History) na listagem de pessoas

### 17.6 QR Code nos Materiais
- Componente `MaterialQRCode` e `QRCodeModal` já integrados na listagem de materiais
- Botão de QR na linha de cada material
- Modal com imagem do QR Code (via api.qrserver.com)
- Botão de cópia do código interno
- Botão de download da imagem do QR

### 17.7 Revisão Periódica de Cautelas Permanentes
- Campo `review_date` (timestamptz) adicionado à tabela `cautelas`
- Exibido no Wizard de cautela (Passo 3) quando tipo = Permanente
- Alertas de revisão pendente na tela `/alerts`
- Código de cor: < 7 dias = vermelho, < 15 dias = âmbar, demais = azul

### 17.8 Controle de Lote de Munição (`/ammo-batches`)
- Nova tabela `ammo_batches`: calibre, marca, lote, qtd total, qtd disponível, validade
- CRUD completo: listar, criar, editar, excluir (só se sem uso)
- Indicador de expiração (vencido / próximo do vencimento)
- Barra de progresso de disponibilidade
- Server actions em `app/actions/ammo-batches.ts`

### 17.9 Exportação Excel nos Relatórios
- Biblioteca `xlsx` adicionada às dependências
- `lib/excel.ts` com funções: `exportMaterialsToExcel`, `exportCautelasToExcel`, `exportDivergenciasToExcel`
- Rotas de API: `GET /api/export/materials`, `/api/export/cautelas`, `/api/export/divergencias`
- Botão "Exportar Excel" nos relatórios de Materiais, Cautelas e Divergências
- Componente `ExcelExportButton` reutilizável

### 17.10 PWA (Progressive Web App)
- `public/manifest.json` e `public/sw.js` configurados
- Instalável na tela inicial do celular (Android + iOS)
- Funciona offline para páginas já carregadas
- `PWARegistration` component registra o service worker automaticamente

### 17.11 Novo Schema — Alterações de Banco
**Migration `20260513000000_add_features.sql`:**
- `persons.phone` — campo WhatsApp/telefone (text, nullable)
- `cautelas.review_date` — data de revisão periódica (timestamptz, nullable)
- Nova tabela `ammo_batches` — controle de lote de munição com RLS

### 17.12 Sidebar Atualizada
- Link "Central de Alertas" (`/alerts`) com ícone Bell
- Link "Munição (Lotes)" (`/ammo-batches`) com ícone Crosshair

---

*Documento atualizado em 2026-05-13 — v1.1 com todas as novas funcionalidades.*
