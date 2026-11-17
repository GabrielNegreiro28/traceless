# Ações que só o participante pode fazer

_O manager adiciona itens aqui com instruções passo a passo em português. Marque `[x]` quando fizer (ou apenas avise no chat)._

## Pendentes

- [x] **(Concluído 17/11) Hoje/amanhã (~5 min): publicar a versão em que o relato aprovado é organizado na nuvem.**
  1. No Claude Code: `! npm run deploy:hosting` (sem ponto no final; deve terminar com "Deploy complete!").
  2. No Chrome com o Nano: https://traceless-92f85.web.app → recarregue com Ctrl+Shift+R → **Try a sample report** → siga até o Outbox. No quadro "What the organization will receive", o selo agora deve dizer que foi organizado **na nuvem** (a análise do texto bruto continua "on your device").
  3. Me conte o que os dois selos disseram.

- [x] **(17/11: um amigo testou no celular, deu tudo certo; registrado no Devpost sem citação inventada) 18–21/11: pedir para 2 ou 3 pessoas testarem o link** (pelo menos uma sem o Gemini Nano, por exemplo no celular ou num Chrome comum). Mande só o link https://traceless-92f85.web.app e peça: "use o relato de exemplo e me diga o que achou, o que confundiu". Anote as frases delas e **pergunte se pode citar** (com o primeiro nome ou anônimo). Cole as respostas aqui no chat.

- [x] **(17/11: aceitar o e-mail atual) Até 23/11: decidir sobre o e-mail nos commits.** O histórico do GitHub mostra seu e-mail pessoal como autor de todos os commits. Quando o repositório ficar público, qualquer pessoa vê. Opções: (a) aceitar; (b) a partir de agora usar o e-mail "noreply" do GitHub (os commits antigos continuam com o e-mail atual, porque reescrever o histórico não é permitido). Me diga qual prefere.

- [ ] **21–23/11: gravar e publicar o vídeo.** Tudo pronto em `docs/submission/`: siga o guia em português `docs/submission/recording-guide.pt.md` (OBS → Clipchamp com voz em inglês → YouTube público com as legendas `video-captions.srt`). O roteiro com as cenas está em `docs/submission/video-script.md`. No ensaio, teste a cena "offline" antes de gravar e me avise se algo falhar. Também tire as 2 capturas de tela (`docs/screenshots/review.png` e `outbox.png`, no site com o Nano) e exporte o diagrama em PNG, como explica o guia. Cole o link do YouTube no chat.

- [x] **(Concluído 17/11) Tornar o repositório público.** Verificado: PUBLIC, licença Apache-2.0 reconhecida pelo GitHub, descrição, site e tópicos configurados; CI verde.

- [x] **(Concluído 17/11: "deu tudo certo"; 2ª publicação depois da correção 665f14b) Publicar a detecção nova e testar no seu Chrome com o Nano (~10 min).**
  1. No Claude Code: `! npm run deploy:hosting` (deve terminar com "Deploy complete!").
  2. No seu Chrome normal, abra https://traceless-92f85.web.app → **Try a sample report** → **Check my report**.
  3. Se aparecer **"Prepare private AI"**, clique e espere (agora prepara dois modelos).
  4. A análise deve levar cerca de 15–40 s, com o selo "Checked on your device". Siga até enviar e abrir o caso com a chave.
  5. Me conte quantos cartões apareceram e se algum era sobre o acusado ou estava estranho.

- [ ] **(OPCIONAL, ~30 min, pode rodar já) Medir a versão antiga no teste novo, só para comparar no README.** Na rodada final ela não foi medida: o Chrome travou o modelo antes dela começar.
  1. Feche a aba do /eval. Abra uma aba nova em `http://localhost:5174/eval`.
  2. Variant: **`v2-single2-rules`**. Preset: **"8. Final v2 test…"**. Digite `v2-single2-rules` na confirmação e rode.
  3. Não feche a aba até terminar. Avise: "rodei a referência".

- [x] **(Concluído 17/11) Teste final novo (preset 8) no Chrome, ~40 min. SÓ PODE SER FEITO UMA VEZ.**
  1. Deixe o Claude Code aberto. No seu Chrome normal, abra `http://localhost:5174/eval` (porta **5174**). Recarregue a página antes de começar.
  2. No seletor **Variant**, escolha **`v3-verifier+investigator`** (confira duas vezes).
  3. No seletor de preset, escolha **"8. Final v2 test (x 3, once)…"**.
  4. Na caixa de confirmação, digite exatamente `v3-verifier+investigator` e clique para rodar.
  5. Não feche nem minimize a aba; não deixe o computador dormir. Não olhe nem compartilhe números parciais.
  6. Se travar por causa do computador (OnDeviceStuck, aba congelada > 5 min): recarregue e rode do passo 2, **uma única vez**.
  7. Avise no chat: "rodei o teste final".

- [x] **(Concluído 17/11) Rodada 3 no Chrome (17/11 ou 18/11, ~1h30, pode deixar rodando sozinho).** Compara as 3 versões novas da detecção com a atual.
  1. Deixe o Claude Code aberto (o servidor local já está ligado). Se a página não abrir, avise no chat.
  2. No seu **Chrome normal** (com o Gemini Nano), abra: `http://localhost:5174/eval` (atenção: porta **5174**).
  3. No seletor de preset, escolha **"7. Round 3: dev pool (all 24 v1 reports) x 3 runs, 4 variants"** e clique para rodar.
  4. **Não feche nem minimize a aba** até terminar (não deixe o computador dormir).
  5. Se aparecer **OnDeviceStuck** ou a página travar por mais de 5 minutos: recarregue e rode o preset 7 de novo, do começo.
  6. **Não rode o preset 8** (ele só pode ser rodado uma única vez; o manager pede na hora certa).
  7. Avise no chat: "rodei o round 3".

- [x] **(Concluído 16/11: "tudo certo") Publicar a versão corrigida e testar o modo LOCAL (no seu Chrome com o Gemini Nano), ~10 min.**
  1. No Claude Code: `! npm run deploy:hosting` (deve terminar com "Deploy complete!").
  2. No seu Chrome **normal** (não anônimo; é nele que a flag do Gemini Nano está ligada), abra https://traceless-92f85.web.app
  3. **Try a sample report** → **Check my report**. Se aparecer "Prepare private AI", clique e espere. A análise deve rodar **no seu computador** (selo "Checked on your device"), em cerca de 10–40 s.
  4. Aceite os cartões, marque a releitura, **Continue**, aprove. No quadro "What the organization will receive", o selo deve dizer **"Organized on your device"**.
  5. Envie e confira a chave em **Follow up on your case**.
  6. Me conte o que apareceu (principalmente os dois selos) e qualquer erro.

- [x] **(Concluído 16/11: regras, config e hosting publicados; teste manual OK, a chave abriu o caso) Firebase + colocar o site no ar (~10 min, hoje ou amanhã).**
  1. Abra https://console.firebase.google.com → projeto **traceless-92f85**.
  2. Menu **Security → App Check** → aba **APIs** → linha **Cloud Firestore** → **Enforce** → confirme. Deve aparecer "Enforced".
  3. No Claude Code, digite um de cada vez (cada um deve terminar com **"Deploy complete!"**):
     - `! npm run deploy:rules`
     - `! npm run deploy:config`
     - `! npm run deploy:hosting`
  4. Teste rápido: abra https://traceless-92f85.web.app numa **janela anônima** do Chrome → **Try a sample report** → siga até o fim (analisar, revisar, marcar a releitura, aprovar, **Send**). Deve aparecer uma **chave do caso**. Copie a chave, abra "Follow up on your case" e cole: o caso deve aparecer.
  5. Avise no chat: "fiz o firebase" e diga se algo deu errado (copie a mensagem da tela).
  - O login anônimo já está ativado (conferido em 12/11).


- [x] **(Concluído 16/11) Avaliação final no Chrome (16/11, ~30–45 min, pode deixar rodando sozinho). Só pode ser feita UMA vez.**
  1. Deixe o Claude Code aberto (o servidor local já está ligado). Se a página não abrir, avise no chat.
  2. No **Chrome**, abra: `http://localhost:5173/eval`
  3. No seletor **Variant**, escolha **`v2-single2-rules`** (confira duas vezes: é essa exatamente).
  4. Clique no botão **"6. Full evaluation (test split, 3 runs)"**.
  5. **Não feche nem minimize a aba** até terminar (não deixe o computador dormir). **Não olhe/compartilhe números parciais.**
  6. Se travar por causa do computador (OnDeviceStuck, aba congelada > 5 min): recarregue e rode o passo 3–4 **de novo do começo, uma única vez**.
  7. Avise no chat: "rodei a avaliação final".


- [x] **(Concluído 14/11) Rodada "Round 2" no Chrome (14/11, ~40–60 min, pode deixar rodando sozinho).** Serve para escolher a versão final da detecção.
  1. Deixe o Claude Code aberto (o servidor local roda nele, numa cópia congelada do código, para as mudanças em andamento não atrapalharem). Se a página não abrir, avise no chat em vez de rodar comandos: o manager religa o servidor.
  2. No **Chrome** (não use o Edge), abra: `http://localhost:5173/eval`
  3. No seletor de preset, escolha **"5. Round 2: dev x 3 runs, 2 variants only"**.
  4. Clique no botão de rodar e **não feche nem minimize a aba** até terminar (o computador pode ficar parado; só não deixe ele dormir).
  5. Ao terminar, a página mostra que salvou os resultados. Não precisa copiar nada: o manager recolhe os resultados.
  6. Se aparecer **"OnDeviceStuck"** ou a página travar por mais de 5 minutos: recarregue a aba e rode o preset 5 de novo, do começo.
  7. Avise no chat: "rodei o round 2".
  - **Não rode o preset 6 (Full evaluation / test split).** Ele só pode ser rodado uma única vez, e o manager vai pedir na hora certa.


## Arquivos a remover (o manager não apaga nada)

- (nenhum no momento; os 8 da lista anterior foram removidos pelo participante em 17/11)

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
