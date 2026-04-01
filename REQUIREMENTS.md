# Requisitos do Sistema - Controle de Cautela

## Requisitos Funcionais (RF)
### RF01 - Autenticação de Usuários
- Login com email e senha.
- Dois perfis: Operator e Supervisor.
- Bloqueio de conta após 5 tentativas falhas por 30 minutos.

### RF02 - Gestão de Pessoas (Cautelados)
- Cadastro de pessoas com nome, matrícula e função.
- Definição de PIN (4 a 6 dígitos).
- Bloqueio de PIN após 3 tentativas falhas por 15 minutos.

### RF03 - Gestão de Materiais
- Cadastro de materiais com patrimônio, serial e categoria.
- Controle de status: available, cautelado, maintenance, unavailable.

### RF04 - Fluxo de Cautela
- Abertura de cautela (Daily/Permanent) com validação de PIN do cautelado.
- Devolução de cautela item a item com validação de PIN.
- Registro automático de divergências (damaged/missing).

### RF05 - Auditoria e Supervisão
- Log imutável de todas as ações críticas.
- Correções de registros apenas por Supervisores com justificativa.
- Dashboards e relatórios (PDF/CSV).

## Requisitos Não Funcionais (RNF)
- **Segurança**: Row Level Security (RLS) no Supabase.
- **Performance**: SSR e Server Actions para baixa latência.
- **UX**: Design profissional (Dark Mode), feedback via Toasts e Loading Skeletons.
