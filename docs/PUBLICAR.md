# Como publicar mudanças (sem confusão)

Eu **não consigo** abrir o site nem a Vercel por você. O que evita problema é sempre o mesmo fluxo:

## 1. Um lugar só para o código

- Repositório: [github.com/gfmcosta08/reserva](https://github.com/gfmcosta08/reserva).
- No GitHub, a branch **padrão** é **`master`**. A Vercel costuma publicar essa branch — **não** a `main`.
- Se você trabalha na **`main`**, depois do `push` rode no projeto: `git checkout master && git merge main && git push origin master` (ou peça para alguém alinhar as duas).
- Alternativa: no GitHub em **Settings → General → Default branch**, troque para **`main`** e na Vercel em **Settings → Git → Production Branch**, aponte para **`main`** — aí um `push` só nessa branch basta.

## 2. Um endereço só para testar

- Na Vercel: **Settings → Domains** e use o domínio de **Production** que aparece lá (ex.: `reservafbpm.vercel.app`).
- Não misture com outros links parecidos; cada nome diferente pode ser outro projeto.

## 3. Conferir se a internet pegou a versão nova

No navegador, abra:

`https://SEU-DOMINIO-DO-PASSO-2/api/version`

Deve aparecer um texto JSON com `"app":"RESERVA"`. O site está certo.

## 4. Se a tela parecer antiga

- Abra em **aba anônima**, ou
- Limpe dados só desse site no navegador (o app pode estar guardando página velha).

## 5. Build automático no GitHub (opcional)

Na pasta do projeto existe `.github/workflows/ci.yml`. Para ele passar a rodar no GitHub, alguém com acesso ao repositório precisa **enviar esse arquivo** (commit + push). Se o push der erro de “workflow”, use o GitHub no site (ou um token com permissão **workflow**) — é uma limitação de segurança do GitHub.

Quando estiver ativo, todo push no **main** dispara um build de teste. Se ficar vermelho, o código não compila — corrija antes de esperar a Vercel.
