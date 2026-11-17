# Guia de gravação do vídeo (passo a passo)

Meta: um vídeo de 2:40 (nunca mais que 2:50), em inglês, público no YouTube. O roteiro está em `docs/submission/video-script.md` e as legendas em `docs/submission/video-captions.srt`. Você não precisa falar: a voz vem do Clipchamp.

## 1. Instalar e configurar o OBS Studio

1. Baixe o OBS Studio em https://obsproject.com e instale (próximo, próximo, concluir).
2. Abra o OBS. Se aparecer o "Assistente de configuração automática", clique em **Cancelar**.
3. Vá em **Configurações > Vídeo**: Resolução base e de saída = **1920x1080**; FPS = **30**.
4. Vá em **Configurações > Saída**: modo Simples, formato de gravação **mp4**, qualidade "Alta qualidade, tamanho de arquivo médio". Anote a pasta de gravação (e mude para uma pasta fácil, como `Vídeos`).
5. Na caixa **Fontes**, clique em **+** e escolha **Captura de janela**. Selecione a janela do **Google Chrome**. Marque "Capturar cursor".
6. Redimensione a captura para preencher a tela (arraste os cantos vermelhos). Deixe o áudio do microfone mudo (não vamos narrar).

## 2. Preparar o Chrome

1. Feche todas as outras abas. Esconda a barra de favoritos (Ctrl+Shift+B). Ative "Não perturbe" do Windows 11.
2. Abra https://traceless-92f85.web.app e use zoom de 110% (Ctrl e +).
3. Abra o console (F12) e digite `await LanguageModel.availability()`. Deve responder `"available"`. Se não, siga o README, seção "Enabling Gemini Nano in Chrome". Feche o console.

## 3. Ensaio (dry run)

1. Sem gravar, siga a tabela do roteiro, cena por cena. Treine a parte offline: F12 > aba **Network** > menu "No throttling" > **Offline**. Depois volte para **No throttling**.
2. Cronometre. Se estourar 2:50, corte cenas curtas, nunca a parte offline.

## 4. Gravar cada cena

1. No OBS, clique em **Iniciar gravação**. Grave **uma cena por vez**, com 2 segundos de pausa antes e depois (facilita o corte). Pode regravar quantas vezes quiser.
2. Cenas: (1) tela inicial e cartão de abertura; (2) **Try a sample report** e **Prepare private AI** (se o modelo não estiver pronto); (3) offline + **Check my report**; (4) cartões de revisão: **Accept** e **Not about me**; (5) **Second look**; (6) Outbox, **Approve this text**; (7) **Send to organization**, chave do caso e página `/case`.
3. Os slides (abertura, números, final) podem ser feitos no próprio Clipchamp com texto sobre fundo escuro, usando o texto do roteiro.
4. Clique em **Parar gravação** ao fim de cada cena. Os arquivos ficam na pasta que você anotou.

## 5. Capturas de tela e diagrama

1. Durante o ensaio, tire duas capturas (tecla Windows + Shift + S) e salve em `docs/screenshots/`:
   - `docs/screenshots/review.png`: tela de revisão com os cartões;
   - `docs/screenshots/outbox.png`: tela do Outbox já com o selo da nuvem.
     O README já aponta para esses dois nomes.
2. Diagrama: abra `docs/architecture.md`, copie o código do primeiro bloco `mermaid` (seção 1, sem as três crases). Vá em https://mermaid.live, cole o código no painel da esquerda, clique em **Actions > PNG** (ou "Download PNG") e salve como `docs/screenshots/architecture.png`.

## 6. Montar no Clipchamp (Windows 11)

1. Abra o **Clipchamp** (menu Iniciar) > **Criar um novo vídeo**.
2. **Importar mídia**: arraste os arquivos mp4 das cenas e o `architecture.png`.
3. Arraste os clipes para a linha do tempo na ordem do roteiro. Corte as esperas (por exemplo, o download do modelo) com a ferramenta de dividir (tesoura).
4. Crie os slides de texto: aba **Texto** > arraste para a linha do tempo (abertura, "22 new reports...", cartão final com o link).
5. Voz: aba **Gravar e criar** > **Texto para fala**. Idioma **English**, escolha uma voz (por exemplo, uma voz "Neural"). Cole a narração da coluna "Narration" de cada cena (uma cena por vez) e clique em **Salvar na linha do tempo**. Alinhe cada voz com a cena certa.
6. Legendas: aba **Legendas** > **Carregar arquivo de legendas** e escolha `docs/submission/video-captions.srt`. Se preferir, use **Transcrição automática** em English e revise o texto.
7. Não use música. Confira que o total está em 2:40 (máximo 2:50).

## 7. Exportar e publicar

1. Clique em **Exportar** > **1080p**. Salve o arquivo.
2. Vá em https://studio.youtube.com > **Criar > Enviar vídeos**. Escolha o arquivo.
3. Título: "Traceless: check your report before it leaves your hands (#BuildHybridAI)". Marque "Não, não é conteúdo para crianças".
4. Em **Legendas**, envie o arquivo `video-captions.srt` com idioma English.
5. Em **Visibilidade**, escolha **Público**. Clique em **Publicar**.
6. Abra o link em uma janela anônima para conferir. **Cole o link aqui no chat** para eu colocar no README e na descrição do Devpost.
