# Como publicar mudanças (sem confusão)

Eu **não consigo** abrir o site nem a Vercel por você. O que evita problema é sempre o mesmo fluxo:

## 1. Um lugar só para o código

- Trabalhe neste repositório e na branch **main** (ou abra um PR para **main**).
- Depois de editar: **salve tudo** e envie para o GitHub (commit + push).

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

## 5. GitHub Actions

Todo push no **main** dispara um **build de teste** aqui no GitHub. Se ficar vermelho, o código não compila — corrija antes de esperar a Vercel.
