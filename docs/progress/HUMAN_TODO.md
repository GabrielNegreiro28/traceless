# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [ ] **Rodada "Round 2" no Chrome (14/11, ~40–60 min, pode deixar rodando sozinho).** Serve para escolher a versão final da detecção.
  1. Deixe o Claude Code aberto (o servidor local roda nele, numa cópia congelada do código, para as mudanças em andamento não atrapalharem). Se a página não abrir, avise no chat em vez de rodar comandos: o manager religa o servidor.
  2. No **Chrome** (não use o Edge), abra: `http://localhost:5173/eval`
  3. No seletor de preset, escolha **"5. Round 2: dev x 3 runs, 2 variants only"**.
  4. Clique no botão de rodar e **não feche nem minimize a aba** até terminar (o computador pode ficar parado; só não deixe ele dormir).
  5. Ao terminar, a página mostra que salvou os resultados. Não precisa copiar nada: o manager recolhe os resultados.
  6. Se aparecer **"OnDeviceStuck"** ou a página travar por mais de 5 minutos: recarregue a aba e rode o preset 5 de novo, do começo.
  7. Avise no chat: "rodei o round 2".
  - **Não rode o preset 6 (Full evaluation / test split).** Ele só pode ser rodado uma única vez, e o manager vai pedir na hora certa.


## Arquivos a remover
_(os agentes não apagam arquivos; listam aqui o que poderia ser removido)_

- **No projeto, opcional:** `C:\Users\Gabriel\hackathon\src\app\ReportPage.review.snip` e `C:\Users\Gabriel\hackathon\src\app\ReportPage.review.test.tmp` (arquivos vazios criados por engano por um agente em 13/11; já estão ignorados pelo git). Pode apagar pelo Explorador de Arquivos.

- **Fora do projeto, opcional:** `C:\Users\Gabriel\filelist.tmp` (6 KB, só uma lista de nomes de arquivos do projeto, sem segredos), criado por engano por um agente revisor em 13/11. Pode apagar pelo Explorador de Arquivos.

- **Fora do projeto, opcional:** `C:\Users\Gabriel\node_modules`, `C:\Users\Gabriel\package.json` e `C:\Users\Gabriel\package-lock.json`, criados em 12/11 às 22:20 por um `npm install firebase` rodado por engano na pasta de usuário. Não atrapalham o projeto; apague pelo Explorador de Arquivos se quiser.

## Concluídos

- [x] **Dev matrix no Chrome** (13/11): 4 variantes × dev × 3 rodadas salvas em `eval/results/` (a 1ª tentativa travou com OnDeviceStuck; a 2ª completou). Resultado e decisão em `DECISIONS.md` (13/11).

- [x] **App Check enforced no Firebase AI Logic** (13/11): verificado pelo terminal, uma chamada sem token agora é recusada (HTTP 401).
- [x] **Console do Firebase, Fase 1** (12/11), verificado pelo terminal: Authentication (Anonymous e Email/Password ativos; o login anônimo de teste funcionou); Firestore `(default)` Standard/Native em `nam5`; Remote Config ativo (ainda sem versões publicadas); debug token `dev-laptop` registrado no App Check (a troca do token funciona, e a chamada ao AI Logic `gemini-3.5-flash-lite` com o token respondeu "OK"). **O App Check NÃO está enforced no AI Logic** (uma chamada sem token também foi aceita). O manager decide quando aplicar o enforce.
- [x] **Repositório PRIVADO no GitHub** (12/11): https://github.com/GabrielNegreiro28/traceless criado; `main` enviado (commits `50e082f`, `9d5ca1f`). O login do `gh` ganhou o escopo `workflow`, necessário para enviar `.github/workflows/ci.yml`.
- [x] **Java JDK 21 instalado** (12/11): Eclipse Temurin 21.0.13 em `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`; `JAVA_HOME` configurado e primeiro no PATH (à frente do Java 8). Vale para sessões/terminais abertos depois da instalação.
- [x] **Prazo confirmado** (12/11): **30/11/2026 às 19:00 GMT-3 (horário de Brasília)**, conforme o Devpost.
- [x] **Firebase Console** (12/11): projeto `traceless-92f85`, app Web `traceless-web`, AI Logic ativado (chamada de teste à nuvem respondeu "OK"), chave reCAPTCHA Enterprise criada e registrada no App Check (não aplicado/enforced).
- [x] **Login no GitHub pelo terminal** (12/11): conta `GabrielNegreiro28`, protocolo HTTPS, escopos `repo`, `read:org`, `gist`.
- [x] **Login no Firebase pelo terminal** (12/11): CLI autenticado; projeto `traceless-92f85` visível.
- Nota: logins interativos via `!` no Claude Code expiram em 120 s. Para o GitHub, rodar `gh auth login --web` em segundo plano funciona; para o Firebase, usar uma janela separada do PowerShell.
