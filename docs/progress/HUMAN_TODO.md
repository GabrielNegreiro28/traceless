# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [ ] **Ligar a proteção App Check para a IA (enforce do Firebase AI Logic)** (adicionado em 12/11, ~1 minuto). Hoje qualquer pessoa com o ID do projeto consegue usar a sua cota de IA. Ligar a proteção agora é seguro: o seu computador de desenvolvimento já tem o token registrado, e o site publicado ainda não chama a IA.
  1. Abra https://console.firebase.google.com/project/traceless-92f85/appcheck/apis
  2. Na linha **Firebase AI Logic**, clique em **Enforce** (Aplicar).
  3. Na janela de confirmação, clique em **Enforce** de novo. A linha deve passar a mostrar **Enforced**.
  4. **Não** mexa na linha do **Cloud Firestore**; isso fica para depois.
  5. Me avise ("feito"). Eu confiro pelo terminal: uma chamada sem token tem que ser recusada.

_(nenhuma no momento)_


## Arquivos a remover
_(os agentes não apagam arquivos; listam aqui o que poderia ser removido)_

- **Fora do projeto, opcional:** `C:\Users\Gabriel\node_modules`, `C:\Users\Gabriel\package.json` e `C:\Users\Gabriel\package-lock.json`, criados em 12/11 às 22:20 por um `npm install firebase` rodado por engano na pasta de usuário. Não atrapalham o projeto; apague pelo Explorador de Arquivos se quiser.

## Concluídos

- [x] **Console do Firebase, Fase 1** (12/11), verificado pelo terminal: Authentication (Anonymous e Email/Password ativos; o login anônimo de teste funcionou); Firestore `(default)` Standard/Native em `nam5`; Remote Config ativo (ainda sem versões publicadas); debug token `dev-laptop` registrado no App Check (a troca do token funciona, e a chamada ao AI Logic `gemini-3.5-flash-lite` com o token respondeu "OK"). **O App Check NÃO está enforced no AI Logic** (uma chamada sem token também foi aceita). O manager decide quando aplicar o enforce.
- [x] **Repositório PRIVADO no GitHub** (12/11): https://github.com/GabrielNegreiro28/traceless criado; `main` enviado (commits `50e082f`, `9d5ca1f`). O login do `gh` ganhou o escopo `workflow`, necessário para enviar `.github/workflows/ci.yml`.
- [x] **Java JDK 21 instalado** (12/11): Eclipse Temurin 21.0.13 em `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`; `JAVA_HOME` configurado e primeiro no PATH (à frente do Java 8). Vale para sessões/terminais abertos depois da instalação.
- [x] **Prazo confirmado** (12/11): **30/11/2026 às 19:00 GMT-3 (horário de Brasília)**, conforme o Devpost.
- [x] **Firebase Console** (12/11): projeto `traceless-92f85`, app Web `traceless-web`, AI Logic ativado (chamada de teste à nuvem respondeu "OK"), chave reCAPTCHA Enterprise criada e registrada no App Check (não aplicado/enforced).
- [x] **Login no GitHub pelo terminal** (12/11): conta `GabrielNegreiro28`, protocolo HTTPS, escopos `repo`, `read:org`, `gist`.
- [x] **Login no Firebase pelo terminal** (12/11): CLI autenticado; projeto `traceless-92f85` visível.
- Nota: logins interativos via `!` no Claude Code expiram em 120 s. Para o GitHub, rodar `gh auth login --web` em segundo plano funciona; para o Firebase, usar uma janela separada do PowerShell.
