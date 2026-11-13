# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [ ] **Ativar Authentication, Firestore e Remote Config no Firebase** (adicionado em 12/11; não bloqueia o trabalho de agora, mas é necessário para as Fases 1 e 4). Verifiquei pelo terminal: o Firestore ainda não está ativado.
  1. Abra https://console.firebase.google.com/project/traceless-92f85 e entre com a sua conta Google.
  2. **Authentication:** no menu da esquerda, clique em **Build → Authentication** → **Get started**. Na aba **Sign-in method**:
     - clique em **Anonymous** → ligue a chave **Enable** → **Save**;
     - clique em **Add new provider** → **Email/Password** → ligue só a primeira chave (**Email/Password**, deixe "Email link" desligado) → **Save**.
  3. **Firestore:** menu **Build → Firestore Database** → **Create database**.
     - Edição: se perguntar, escolha **Standard edition**.
     - Database ID: deixe **(default)**.
     - Location: escolha **nam5 (United States)**. ⚠️ Não dá para mudar depois.
     - Regras: escolha **Start in production mode** (tudo bloqueado; os agentes vão publicar as regras certas depois) → **Create**.
  4. **Remote Config:** menu **Run → Remote Config** → se aparecer **Create configuration**, clique e depois feche/cancele a criação do primeiro parâmetro (os agentes publicam o template pelo terminal). Basta a página abrir sem pedir para "Get started".
  5. **App Check: registrar o token de desenvolvimento.** O valor do token está no arquivo `C:\Users\Gabriel\hackathon\.env.development.local`, depois de `VITE_APPCHECK_DEBUG_TOKEN=`. Abra esse arquivo com o Bloco de Notas (botão direito → Abrir com → Bloco de Notas) e copie só o valor. Ele **não** vai para o GitHub e não deve ser compartilhado. Menu **Build → App Check** (ou **Security → App Check**) → aba **Apps** → na linha **traceless-web**, clique nos **três pontinhos (⋮)** → **Manage debug tokens** → **Add debug token** → Name: `dev-laptop` → Value: cole o token → **Save**.
  6. **App Check: conferir o enforce.** Na mesma página, aba **APIs**: veja se **Firebase AI Logic** aparece como **Enforced**. Se aparecer "Unenforced" ou "Monitoring", **não mude nada**. Só me diga o que aparece. **Não** ative o enforce do Cloud Firestore ainda.
  7. Me avise no chat ("feito") — eu confiro pelo terminal.


## Arquivos a remover
_(os agentes não apagam arquivos; listam aqui o que poderia ser removido)_

- **Fora do projeto, opcional:** `C:\Users\Gabriel\node_modules`, `C:\Users\Gabriel\package.json` e `C:\Users\Gabriel\package-lock.json`, criados em 12/11 às 22:20 por um `npm install firebase` rodado por engano na pasta de usuário. Não atrapalham o projeto; apague pelo Explorador de Arquivos se quiser.

## Concluídos

- [x] **Repositório PRIVADO no GitHub** (12/11): https://github.com/GabrielNegreiro28/traceless criado; `main` enviado (commits `50e082f`, `9d5ca1f`). O login do `gh` ganhou o escopo `workflow`, necessário para enviar `.github/workflows/ci.yml`.
- [x] **Java JDK 21 instalado** (12/11): Eclipse Temurin 21.0.13 em `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`; `JAVA_HOME` configurado e primeiro no PATH (à frente do Java 8). Vale para sessões/terminais abertos depois da instalação.
- [x] **Prazo confirmado** (12/11): **30/11/2026 às 19:00 GMT-3 (horário de Brasília)**, conforme o Devpost.
- [x] **Firebase Console** (12/11): projeto `traceless-92f85`, app Web `traceless-web`, AI Logic ativado (chamada de teste à nuvem respondeu "OK"), chave reCAPTCHA Enterprise criada e registrada no App Check (não aplicado/enforced).
- [x] **Login no GitHub pelo terminal** (12/11): conta `GabrielNegreiro28`, protocolo HTTPS, escopos `repo`, `read:org`, `gist`.
- [x] **Login no Firebase pelo terminal** (12/11): CLI autenticado; projeto `traceless-92f85` visível.
- Nota: logins interativos via `!` no Claude Code expiram em 120 s. Para o GitHub, rodar `gh auth login --web` em segundo plano funciona; para o Firebase, usar uma janela separada do PowerShell.
