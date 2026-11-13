# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [ ] **Rodar o "Dev matrix" do Gemini Nano no seu Chrome** (adicionado em 13/11; meta: 14/11). Compara 4 versões do detector (a antiga v1 e três versões da nova v2) nos 8 relatos de treino, 3 vezes cada. É isso que escolhe a versão que vai para a prova final. Leva cerca de 30 a 60 minutos, quase tudo esperando. Deixe o computador ligado na tomada.
  1. Feche programas pesados (jogos, muitas abas). Seu computador tem 8 GB de memória.
  2. Abra uma janela **separada** do PowerShell (menu Iniciar → digite "PowerShell" → Enter) e cole uma linha por vez:
     - `cd C:\Users\Gabriel\hackathon`
     - `npm run eval`
     - O Chrome abre em `http://localhost:5173/eval`. Se não abrir sozinho, abra o Chrome e cole esse endereço.
     - ⚠️ Não feche essa janela do PowerShell enquanto a avaliação estiver rodando.
  3. Confira a linha **Device status** no topo: precisa dizer **"On-device AI is ready"**. Se disser "not downloaded yet", clique em **Prepare on-device AI** e espere. Se disser "unavailable", me avise.
  4. Clique em **1. Smoke test (1 report)**. Em 1 ou 2 minutos deve aparecer "Saved to eval/results/…". Se aparecer erro, **pare** e me mande a mensagem.
  5. Clique em **4. Dev matrix: every variant x dev x 3 runs**. Ele ignora a caixa "variant" e roda todas as versões sozinho. **Deixe a aba aberta e na frente** (sem minimizar e sem deixar o computador hibernar).
  6. No fim, cada versão aparece com "Saved to eval/results/…". Se aparecer "save failed", clique em **Download JSON** e salve o arquivo em `C:\Users\Gabriel\hackathon\eval\results\`.
  7. **NÃO clique em "5. Full evaluation (test split)".** A prova final só pode rodar uma vez, depois que eu escolher a versão. Eu peço esse passo separadamente.
  8. Me avise no chat ("dev matrix feito"). Para desligar o servidor, clique na janela do PowerShell e aperte **Ctrl+C**.


## Arquivos a remover
_(os agentes não apagam arquivos; listam aqui o que poderia ser removido)_

- **No projeto, opcional:** `C:\Users\Gabriel\hackathon\src\app\ReportPage.review.snip` e `C:\Users\Gabriel\hackathon\src\app\ReportPage.review.test.tmp` (arquivos vazios criados por engano por um agente em 13/11; já estão ignorados pelo git). Pode apagar pelo Explorador de Arquivos.

- **Fora do projeto, opcional:** `C:\Users\Gabriel\filelist.tmp` (6 KB, só uma lista de nomes de arquivos do projeto, sem segredos), criado por engano por um agente revisor em 13/11. Pode apagar pelo Explorador de Arquivos.

- **Fora do projeto, opcional:** `C:\Users\Gabriel\node_modules`, `C:\Users\Gabriel\package.json` e `C:\Users\Gabriel\package-lock.json`, criados em 12/11 às 22:20 por um `npm install firebase` rodado por engano na pasta de usuário. Não atrapalham o projeto; apague pelo Explorador de Arquivos se quiser.

## Concluídos

- [x] **App Check enforced no Firebase AI Logic** (13/11): verificado pelo terminal, uma chamada sem token agora é recusada (HTTP 401).
- [x] **Console do Firebase, Fase 1** (12/11), verificado pelo terminal: Authentication (Anonymous e Email/Password ativos; o login anônimo de teste funcionou); Firestore `(default)` Standard/Native em `nam5`; Remote Config ativo (ainda sem versões publicadas); debug token `dev-laptop` registrado no App Check (a troca do token funciona, e a chamada ao AI Logic `gemini-3.5-flash-lite` com o token respondeu "OK"). **O App Check NÃO está enforced no AI Logic** (uma chamada sem token também foi aceita). O manager decide quando aplicar o enforce.
- [x] **Repositório PRIVADO no GitHub** (12/11): https://github.com/GabrielNegreiro28/traceless criado; `main` enviado (commits `50e082f`, `9d5ca1f`). O login do `gh` ganhou o escopo `workflow`, necessário para enviar `.github/workflows/ci.yml`.
- [x] **Java JDK 21 instalado** (12/11): Eclipse Temurin 21.0.13 em `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`; `JAVA_HOME` configurado e primeiro no PATH (à frente do Java 8). Vale para sessões/terminais abertos depois da instalação.
- [x] **Prazo confirmado** (12/11): **30/11/2026 às 19:00 GMT-3 (horário de Brasília)**, conforme o Devpost.
- [x] **Firebase Console** (12/11): projeto `traceless-92f85`, app Web `traceless-web`, AI Logic ativado (chamada de teste à nuvem respondeu "OK"), chave reCAPTCHA Enterprise criada e registrada no App Check (não aplicado/enforced).
- [x] **Login no GitHub pelo terminal** (12/11): conta `GabrielNegreiro28`, protocolo HTTPS, escopos `repo`, `read:org`, `gist`.
- [x] **Login no Firebase pelo terminal** (12/11): CLI autenticado; projeto `traceless-92f85` visível.
- Nota: logins interativos via `!` no Claude Code expiram em 120 s. Para o GitHub, rodar `gh auth login --web` em segundo plano funciona; para o Firebase, usar uma janela separada do PowerShell.
