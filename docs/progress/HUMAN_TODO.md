# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [ ] **Rodar a avaliação do Gemini Nano no seu Chrome** (adicionado em 13/11; meta: até a noite de 14/11). É o teste que decide se a detecção no aparelho é boa o bastante (o "portão" da Fase 2). Leva cerca de 30 a 60 minutos, a maior parte esperando. Use o computador ligado na tomada.
  1. Feche outros programas pesados (jogos, muitas abas), porque o seu computador tem 8 GB de memória.
  2. Abra uma janela **separada** do PowerShell (menu Iniciar → digite "PowerShell" → Enter) e cole, uma linha por vez:
     - `cd C:\Users\Gabriel\hackathon`
     - `npm run eval`
     - Isso liga um servidor só no seu computador e abre o Chrome em `http://localhost:5173/eval`. Se o Chrome não abrir sozinho, abra-o e cole esse endereço.
     - ⚠️ Não feche essa janela do PowerShell enquanto a avaliação estiver rodando. (Use uma janela separada porque comandos com `!` no Claude Code são encerrados depois de 2 minutos.)
     - Alternativa: me diga "pode ligar o servidor da avaliação" e eu ligo pelo meu lado.
  3. No topo da página, veja a linha **Device status**:
     - **"On-device AI is ready"** → siga para o passo 4.
     - **"not downloaded yet"** → clique em **Prepare on-device AI**, espere a barra chegar ao fim e a mensagem mudar para "ready".
     - **"downloading"** → espere alguns minutos e recarregue a página (F5).
     - **"unavailable"** → siga os passos que aparecem na própria página (ativar a flag no Chrome e reiniciá-lo) e me avise.
  4. Deixe a estratégia em **single**.
  5. Clique em **1. Smoke test (1 report)**. Deve terminar em 1 ou 2 minutos sem mensagem de erro e mostrar "Saved to eval/results/…". Se aparecer erro, **pare aqui** e me diga a mensagem que apareceu.
  6. Clique em **2. Dev split (8 reports, 1 run)** e espere terminar (alguns minutos).
  7. Clique em **3. Full evaluation (test split, 3 runs)**. É o mais demorado. **Deixe a aba aberta e na frente** (não minimize o Chrome nem deixe o computador hibernar). A página mostra o andamento ("run x/3, report n/16").
  8. No fim, a página mostra uma tabela, a lista **PASS / FAIL / UNSTABLE** e "Saved to eval/results/…". Se aparecer "save failed", clique em **Download JSON** e salve o arquivo na pasta `C:\Users\Gabriel\hackathon\eval\results\`.
  9. Me avise no chat ("avaliação feita"). Eu leio os arquivos salvos e levo o resultado para a decisão com o Fable. Você não precisa interpretar os números.
  10. Para desligar o servidor: clique na janela do PowerShell e aperte **Ctrl+C** (ou feche a janela).


## Arquivos a remover
_(os agentes não apagam arquivos; listam aqui o que poderia ser removido)_

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
