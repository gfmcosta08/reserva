# RESERVA - Sistema de Controle de Materiais

Sistema para controle de custódia de armas e materiais.

## Depois de mudar o código

1. Envie tudo para o GitHub (commit + push na `main`).
2. Espere a Vercel terminar de publicar (painel do projeto).
3. Teste no **domínio de Production** que está em **Vercel → Settings → Domains** (não use outro link parecido).
4. Confira `https://SEU-DOMINIO/api/version` — deve mostrar `"app":"RESERVA"`.

Passo a passo em linguagem simples: [`docs/PUBLICAR.md`](docs/PUBLICAR.md).

## Documentação do produto (PRD)

- **Fonte da verdade:** Obsidian — espelhado em [`docs/obsidian-prd/`](docs/obsidian-prd/) (junction local).
- Índice: [`docs/README-PRD.md`](docs/README-PRD.md) · Protocolo de mudanças: [`docs/CHANGE-PROTOCOL.md`](docs/CHANGE-PROTOCOL.md).
- Abrir no Cursor: [`controle-material.code-workspace`](controle-material.code-workspace) (código + PRD).

## Ambiente de teste (Supabase)

Clonar produção → `teste_db`, desenvolver localmente e promover depois: [`docs/AMBIENTE-TESTE.md`](docs/AMBIENTE-TESTE.md).
