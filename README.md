# RESERVA - Sistema de Controle de Materiais

Sistema SaaS para controle de custódia de armas e materiais.

## Deploy (URL correta)

O domínio **`controle-material.vercel.app`** pode estar ligado a **outro projeto** na Vercel (HTML estático antigo, sem Next.js). Se a tela de cautela não mudou após o deploy, você provavelmente está testando **o site errado**.

### Como confirmar o app certo

1. **Vercel** → projeto que está conectado ao repositório **`gfmcosta08/reserva`**, branch **`main`** → **Deployments** → abra o deployment de **Production** → **Visit**.
2. No site que abrir, acesse **`/api/version`**. Deve retornar JSON com `"app":"RESERVA"` e `"framework":"next"`. O campo `vercelGitCommitSha` deve bater com o último commit do GitHub.
3. Na página inicial logada, o título do separador deve ser algo como **Controle de Material - Reserva de Armas** (não um template “Create Next App”).

### Se `controle-material.vercel.app` não for este app

Em **Vercel** → projeto **deste** repositório → **Settings** → **Domains**: adicione ou mova o domínio desejado para o projeto que faz build deste código. Ou use sempre a URL `*.vercel.app` que o painel mostra em **Production**.

---
*Last update: 30/03/2026 — nota sobre URL de deploy*
