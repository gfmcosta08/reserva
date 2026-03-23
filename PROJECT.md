# CONTROLE DE CAUTELA DE MATERIAL – RESERVA DE ARMAS

## Stack Tecnológica
- **Frontend**: Next.js 14+ (App Router)
- **Backend**: Next.js Server Actions
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Estilização**: Tailwind CSS + shadcn/ui
- **Validadores**: Zod

## Decisões Fixas
- Sistema auditável (Audit Logs via Triggers)
- Row Level Security (RLS) habilitado em todas as tabelas
- PIN de cautelado (4 a 6 dígitos numéricos) com hash bcrypt
- Suporte a múltiplos perfis (Operator, Supervisor)
- Deploy na Vercel + Supabase
