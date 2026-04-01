# DEPLOY - Sistema RESERVA

Guia completo para deployment e configuração do sistema.

---

## 1. VISÃO GERAL

### Repositórios e URLs

| Serviço | URL | Projeto |
|---------|-----|---------|
| **GitHub** | https://github.com/gfmcosta08/reserva | gfmcosta08/reserva |
| **Vercel** | https://vercel.com/gianpaolo-ferreira-matos-costas-projects/reserva-master | reserva-master |
| **Produção** | https://reserva-master.vercel.app | Alias: reserva-master.vercel.app |
| **Supabase** | https://chguaozitzwfsmqyhreb.supabase.co | chguaozitzwfsmqyhreb |

### Arquitetura

```
Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend: Vercel (Serverless Functions)
Database: Supabase (PostgreSQL)
Auth: Supabase Auth
State: Zustand
```

---

## 2. CONFIGURAÇÃO DE AMBIENTE

### 2.1 Variáveis de Ambiente (.env)

Criar arquivo `.env.local` na raiz do projeto:

```env
# ============================================
# SUPABASE (OBRIGATÓRIO)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://chguaozitzwfsmqyhreb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ3Vhb3ppdHp3ZnNtcXlocmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjAxNzYsImV4cCI6MjA4OTgzNjE3Nn0.N3M6Tg0u58mZaP31eAJHDpBEtZkN7PvKng44IWCs0b4

# ============================================
# WHATSAPP API (OPCIONAL)
# ============================================
# URL da API do WhatsApp (uazapi.dev ou similar)
WHATSAPP_API_URL=https://api.uazapi.dev/v1
# Token de verificação do webhook
WHATSAPP_VERIFY_TOKEN=reserva_webhook_verify

# ============================================
# EMAIL API (OPCIONAL)
# ============================================
# Endpoint da API de email (Resend, SendGrid, etc)
EMAIL_API_URL=https://api.resend.com
# Token da API de email
EMAIL_TOKEN=re_seu_token_aqui
# Email remetente padrão
EMAIL_FROM=Sistema RESERVA <noreply@seudominio.com>

# ============================================
# SISTEMA
# ============================================
# Nome do órgão nas notificações
NOME_ORGAO=Organização de Segurança
```

### 2.2 Como Obter as Chaves do Supabase

1. Acesse https://supabase.com/dashboard
2. Selecione o projeto `chguaozitzwfsmqyhreb`
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.3 Configurar Vercel (Environment Variables)

Se não estiver configurado, adicione via Vercel CLI:

```bash
# Login na Vercel
npx vercel login

# Linkar projeto
npx vercel link

# Adicionar variáveis (via stdin para evitar problemas com caracteres especiais)
echo "https://chguaozitzwfsmqyhreb.supabase.co" | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "eyJhbGci..." | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Ou manualmente via dashboard:
1. Acesse https://vercel.com/gianpaolo-ferreira-matos-costas-projects/reserva-master/settings/environment-variables
2. Adicione `NEXT_PUBLIC_SUPABASE_URL` com valor `https://chguaozitzwfsmqyhreb.supabase.co`
3. Adicione `NEXT_PUBLIC_SUPABASE_ANON_KEY` com a chave anon

---

## 3. DEPLOY

### 3.1 Deploy Automático (Recomendado)

A cada `push` na branch `main`, o deploy é disparado automaticamente via GitHub Integration.

```bash
# 1. Fazer commit das alterações
git add .
git commit -m "descrição das alterações"

# 2. Push para GitHub
git push origin main

# 3. Aguardar deploy (2-5 minutos)
# Acompanhe em: https://vercel.com/gianpaolo-ferreira-matos-costas-projects/reserva-master
```

### 3.2 Deploy via Vercel CLI

```bash
# 1. Instalar Vercel CLI (se necessário)
npm i -g vercel

# 2. Login
npx vercel login

# 3. Deploy para Preview
npx vercel

# 4. Deploy para Produção
npx vercel --prod
```

### 3.3 Configurar GitHub Integration

Se a integração não estiver ativa:

```bash
# Conectar repositório GitHub ao Vercel
npx vercel git connect
```

---

## 4. MIGRAÇÕES DE BANCO

Ao adicionar novas funcionalidades, pode ser necessário executar migrations SQL no Supabase.

### 4.1 Arquivos de Migration

Todos os arquivos SQL estão em `supabase/migrations/`:
- `20260401000000_novas_tabelas_sistema.sql` - Tabelas para WhatsApp, Escala, Configurações

### 4.2 Como Executar

1. Acesse https://supabase.com/dashboard
2. Selecione o projeto
3. Vá em **SQL Editor**
4. Copie e cole o conteúdo do arquivo de migration
5. Execute

### 4.3 Verificar Schema

```bash
# Executar script de verificação
node check_schema.js
```

---

## 5. ESTRUTURA DO PROJETO

```
reserva-master/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Páginas autenticadas
│   ├── api/                      # API Routes (Serverless)
│   │   ├── cautelas/            # CRUD cautelas
│   │   ├── persons/             # CRUD pessoas
│   │   ├── materials/           # CRUD materiais
│   │   ├── whatsapp/            # Webhook WhatsApp
│   │   └── escala/              # Escala de serviço
│   └── auth/                     # Páginas de autenticação
├── components/                    # Componentes React
│   ├── cautela/                 # Componentes de cautela
│   ├── material/                # QR Code, Scanner
│   │   ├── QRCodeGenerator.tsx
│   │   └── QRCodeScanner.tsx
│   ├── pessoa/                  # AlertaFotoRG
│   └── shared/                  # PinInput, etc
├── store/                        # Zustand stores
│   ├── authStore.ts
│   ├── cautelaStore.ts
│   ├── escalaStore.ts
│   └── uiStore.ts
├── lib/                          # Utilitários
│   ├── escalaParser.ts          # Parser de escala WhatsApp
│   ├── notificacoes.ts          # Envio de notificações
│   └── whatsapp/
│       └── whatsapp.ts          # API WhatsApp
├── supabase/
│   └── migrations/              # Scripts SQL
├── store/                        # Zustand stores
└── types/                        # TypeScript types
```

---

## 6. FUNCIONALIDADES IMPLEMENTADAS

| # | Funcionalidade | Status |
|---|----------------|--------|
| 1 | PIN 6 dígitos com bloqueo 30min | ✅ |
| 2 | Badge "Foto RG pendente" | ✅ |
| 3 | Upload fotos RG | ✅ |
| 4 | Verificação escala + autorização manual | ✅ |
| 5 | Wizard 4 etapas cautela | ✅ |
| 6 | WhatsApp Monitor | ✅ |
| 7 | Parser automático de escala | ✅ |
| 8 | Notificações WhatsApp/Email | ✅ |
| 9 | QR Code gerador e scanner | ✅ |
| 10 | Configurações completas | ✅ |

---

## 7. TROUBLESHOOTING

### Build Falha - Type Errors

```bash
# Executar localmente para ver erros
npm run build
```

Erros comuns:
- `Property 'xxx' does not exist` → Verificar tipagem
- `Expected 1 arguments, but got 2` → Função chamada com parâmetros errados
- `is not assignable to type` → Tipos incompatíveis entre store e componente

### Build Falha - Variáveis de Ambiente

1. Verificar se `.env.local` existe na raiz
2. Verificar se as variáveis estão configuradas na Vercel
3. Reiniciar o build: `npx vercel --prod --force`

### Erro de Conexão Supabase

1. Verificar `NEXT_PUBLIC_SUPABASE_URL` está correto
2. Verificar `NEXT_PUBLIC_SUPABASE_ANON_KEY` está correto
3. Verificar se o projeto Supabase está ativo

### Warnings de face-api.js (pode ignorar)

```
Module not found: Can't resolve 'fs'
Module not found: Can't resolve 'encoding'
```

Esses warnings são de bibliotecas de reconhecimento facial que usam APIs de filesystem. Não afetam o funcionamento.

---

## 8. CONTATO E SUPORTE

- **GitHub Issues:** https://github.com/gfmcosta08/reserva/issues
- **Vercel Dashboard:** https://vercel.com/gianpaolo-ferreira-matos-costas-projects/reserva-master
- **Supabase Dashboard:** https://supabase.com/dashboard/project/chguaozitzwfsmqyhreb

---

## 9. CHANGELOG

### 2026-04-01 - Deployment Completo
- Sistema de controle de custódia implementado
- PIN 6 dígitos com bloqueo
- WhatsApp Monitor integrado
- QR Code gerador/scanner
- Notificações automáticas
- Autorização manual de escala
