# HACKATHON.md: contexto do projeto #BuildHybridAI

> **Para a LLM que está lendo isto:** este arquivo é a fonte principal de contexto do projeto. Leia-o inteiro antes de propor qualquer coisa. Ele traz (1) quem é o participante, (2) as regras e critérios do hackathon, (3) o contexto técnico do Firebase AI Logic, (4) as boas práticas de vencedores de hackathons, com as fontes, e (5) como você deve trabalhar com o participante. Quando uma decisão nova for tomada, atualize a seção **"Estado atual do projeto"** no fim do arquivo.

---

## 1. Quem é o participante

| Item | Valor |
|---|---|
| Formação da equipe | **Sozinho** (solo) |
| Experiência com programação | **Nenhuma**: o participante não programa. A LLM escreve todo o código e explica cada passo. |
| Sistema operacional | Windows 11 (PowerShell e Git Bash disponíveis) |
| Idioma de trabalho | **Português** nas conversas com o participante |
| Idioma da submissão | **Inglês** (obrigatório: vídeo, descrição, README e interface do app) |
| Data de hoje (início) | 12/11/2026 |
| **Prazo final** | **30/11/2026**: confirmar o horário exato e o fuso na página do Devpost |
| Tempo disponível | cerca de 18 dias |

### O que isso significa na prática
- **iOS está fora**: exige Mac e Xcode.
- **Web (Chrome desktop) é a plataforma principal.** É o caminho mais rápido, mais barato e mais fácil de hospedar (Firebase Hosting) e de mostrar aos jurados por um link.
- **Android é opcional (stretch goal).** Só vale tentar se o produto Web estiver pronto, polido e submetível até ~24/11. Android com Gemini Nano exige Android Studio e um aparelho compatível, e a API híbrida ainda é experimental. Para quem nunca programou, o risco é alto.
- A pesquisa mostra que um projeto solo vence quando o **escopo é pequeno e a execução impecável**. Uma única funcionalidade bem resolvida vence equipes de 4 ou 5 pessoas com problemas de coordenação.

---

## 2. O hackathon: #BuildHybridAI (Devpost + Firebase)

### 2.1 Proposta
Construir apps de IA generativa que usam **inferência híbrida**: o prompt roda **no aparelho** quando existe um modelo local disponível (rápido, privado, grátis) e **cai para a nuvem** quando não existe. Tudo isso pelo **Firebase AI Logic Hybrid Inference SDK**.

Plataformas aceitas (pelo menos uma):
- **Web (Chrome):** Gemini Nano via Firebase AI Logic. Pode ser um web app ou uma **extensão do Chrome**.
- **Android:** Gemini Nano via Firebase AI Logic.
- **iOS:** Apple Foundation Models via Firebase AI Logic.

Apps **multiplataforma** recebem "strong consideration" para o Grand Prize, mas um app excelente em uma única plataforma também pode vencer.

### 2.2 Prêmios (US$ 30.000 no total)
| Prêmio | Valor | Extras |
|---|---|---|
| Grand Prize | US$ 10.000 | Entrevista, post no blog do Firebase, menção em redes sociais |
| 1st Runner Up | US$ 7.000 | Entrevista, post no blog, menção |
| 2nd Runner Up | US$ 4.000 | Menção |
| **Best Web/Chrome App** | **US$ 3.000** | Menção ← **alvo realista principal** |
| Best Android App | US$ 3.000 | Menção |
| Best iOS App | US$ 3.000 | Menção |

### 2.3 Requisitos técnicos obrigatórios
- A IA do app precisa rodar via **Firebase AI Logic**, com **inferência híbrida**.
- **App Check é obrigatório** para o Firebase AI Logic. Tokens de debug são aceitos na submissão.
- Uso **encorajado** de outros produtos Firebase: **Authentication, Firestore, Remote Config, App Check**. Os jurados avaliam "how effectively" a plataforma é usada, então usar 2 ou 3 desses produtos com propósito real conta pontos.
- Qualquer IDE ou agente de código é permitido (Claude Code incluso). Ferramentas do Google (Antigravity) e "Firebase Agent Skills" são recomendadas, mas não obrigatórias.

### 2.4 O que submeter (checklist obrigatório)
- [ ] **Projeto funcionando**, construído com as ferramentas exigidas.
- [ ] **Plataforma selecionada** no formulário (escolher **Web/Chrome**).
- [ ] **Descrição em texto** (inglês) contendo: como o Firebase AI Logic foi usado, um resumo das funcionalidades e a proposta de valor.
- [ ] **URL do repositório público** (GitHub ou GitLab) com:
  - todo o código-fonte, os assets e as **instruções para rodar**;
  - a proposta de valor explicada;
  - **uso real do Firebase AI Logic em tempo de execução**: importado **e chamado** no código. Citar só no README não vale.
  - **Licença open source** em um arquivo `LICENSE` detectável pelo GitHub (aparece na seção "About"). **Apache 2.0 é a preferida.**
- [ ] **Vídeo de demonstração**:
  - **no máximo 3 minutos** (só os 3 primeiros minutos são avaliados);
  - mostrando o app **funcionando na plataforma** (Chrome);
  - **publicado e público no YouTube**, com o link no formulário;
  - em **inglês** ou com **legendas em inglês**.
- [ ] (Fortemente encorajado) **URL do projeto hospedado** para os jurados testarem: Firebase Hosting, ou a extensão publicada/instalável.
- [ ] O app precisa ser **gratuito**.
- [ ] Todo o material em **inglês**.

### 2.5 Critérios de julgamento (peso igual, salvo indicação em contrário)
1. **Technological Implementation:** o projeto é bem construído? Usa a inferência híbrida do Firebase AI Logic **de forma eficaz** como parte da solução?
2. **Design:** entrega uma **experiência de produto completa e coerente**, e não apenas uma prova de conceito técnica?
3. **Potential Impact:** defende de forma **crível e específica** que resolve um **problema real para um público real**? A solução demonstrada de fato resolve esse problema?
4. **Quality of the Idea:** é um uso **criativo e não óbvio** do Firebase AI Logic? A pessoa mostra **compreensão genuína do problema**?

### 2.6 Datas relevantes
| Data | Evento |
|---|---|
| 12/11 (qui), 10h PT / 15h BRT | Build Session com Cynthia Jiang (Firebase), inscrição pelo Luma. Assistir à gravação se perder. |
| 18/11 (qua), 10h PT | Prazo do pedido de Google Account Quota, Sprint 2 (só se precisar de cota extra, como geração de imagem) |
| 25/11 (qua), 10h PT | Prazo do pedido de Quota, Sprint 3 (final) |
| **30/11** | **Prazo de submissão** (confirmar horário/fuso) |

> Cota extra quase certamente **não é necessária**: inferência de texto no Firebase AI Logic é gratuita dentro dos limites de uso. Cada conta de cota vale 4 dias, e excedentes são cobrados do participante. Evitar.

### 2.7 Canais de ajuda
- Discord do Devpost, canal `#hackathon-help`.
- Página "Resources" do hackathon no Devpost.
- Documentação: https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference

---

## 3. Contexto técnico: Firebase AI Logic com inferência híbrida (Web)

> Informações coletadas da documentação oficial em 12/11/2026. **Versões mudam: confira a documentação antes de instalar.** Em caso de conflito, a documentação oficial vale mais que este arquivo.

### 3.1 Requisitos
- **SDK:** pacote npm `firebase`, versão **≥ 12.5.0** (o modelo de nuvem padrão `gemini-3.5-flash-lite` exige **≥ 13.0.0**).
- **Navegador:** **Chrome Desktop ≥ 139**. Não funciona em celular nem em outros navegadores; nesses casos o app cai para a nuvem.
- **Flag do Chrome (desenvolvimento e teste):** `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → **Enabled** → reiniciar o Chrome.
- **Espaço em disco** para baixar o modelo (vários GB). O download pode levar minutos.
- **Hardware (documentação oficial da Prompt API, nov/2026):** Windows 10/11, macOS 13+, Linux ou Chromebook Plus; **≥ 22 GB livres** no disco do perfil do Chrome (o modelo é apagado se o espaço livre cair abaixo de 10 GB); **GPU com mais de 4 GB de VRAM** *ou* **CPU com 16 GB+ de RAM e 4+ núcleos**; conexão sem limite de dados só para o download inicial. Celulares (Android/iOS) **não** rodam o Gemini Nano do Chrome. **Teste cedo se a máquina do participante roda o modelo local.** Se não rodar, o desenvolvimento continua (cai para a nuvem), mas o vídeo precisa mostrar a execução local, então seria necessário outro computador para gravar.
- **⚠️ IDIOMAS (restrição crítica):** o modelo local suporta oficialmente só **inglês (`en`), japonês (`ja`), espanhol (`es`), alemão (`de`) e francês (`fr`)**. **Português NÃO é suportado oficialmente**; entradas ou saídas em idioma não suportado podem lançar `NotSupportedError`. Consequência: produtos cujo núcleo local depende de gerar ou entender texto em português **não são viáveis on-device hoje**. Testar com `await LanguageModel.availability({ expectedInputs: [{ type: "text", languages: ["pt"] }], expectedOutputs: [{ type: "text", languages: ["pt"] }] })`.
- Projeto Firebase com **AI Logic habilitado** (provedor recomendado: **Gemini Developer API**, plano grátis) e **App Check aplicado (enforced)**.

### 3.2 Inicialização básica
```javascript
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const firebaseApp = initializeApp(firebaseConfig);

// Somente em desenvolvimento: gera um token de debug no console do navegador.
// Registrar esse token em Firebase Console > Security > App Check > Apps > Manage debug tokens.
if (import.meta.env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider("SITE_KEY"),
  isTokenAutoRefreshEnabled: true,
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
```

### 3.3 Modos de inferência
| Modo | Comportamento |
|---|---|
| `PREFER_ON_DEVICE` | Usa o modelo local se disponível; senão, nuvem. |
| `ONLY_ON_DEVICE` | Só local; lança erro se indisponível (e espera o download terminar). |
| `PREFER_IN_CLOUD` | Usa a nuvem se disponível; senão, local (útil para o modo offline). |
| `ONLY_IN_CLOUD` | Só nuvem; lança erro se indisponível. |

**Dica de arquitetura:** é possível criar **várias instâncias** de modelo com modos diferentes (por exemplo, um `ONLY_ON_DEVICE` para dados sensíveis e um `ONLY_IN_CLOUD` para tarefas pesadas) e **rotear explicitamente** cada tarefa. Isso mostra domínio do híbrido, em vez de usar a nuvem só como fallback passivo.

### 3.4 Download do modelo local
`initializeDeviceModel()` precisa ser chamado **durante ou depois de uma interação do usuário** (clique), antes do primeiro prompt:
```javascript
button.addEventListener("click", () => {
  model.initializeDeviceModel((progress) => {
    progressBar.value = progress; // 0 a 1
  });
});
```
- Enquanto o download acontece: `PREFER_*` cai para a nuvem sem esperar; `ONLY_ON_DEVICE` espera.
- Para baixar manualmente (DevTools > Console): `await LanguageModel.availability()` retorna `"available" | "downloading" | "downloadable"`; depois, `await LanguageModel.create()`.
- **UX:** mostrar uma barra de progresso amigável no primeiro uso ("Preparing your private on-device AI…").

### 3.5 Saber onde a inferência rodou
```javascript
const result = await model.generateContent(prompt);
result.response.inferenceSource; // "ON_DEVICE" ou "IN_CLOUD"
result.response.text();
```
**Use isso na interface.** Um selo visível como "🔒 Processed on your device" ou "☁️ Processed in the cloud" torna o híbrido **visível** para jurados e usuários. É um ponto forte direto em Technological Implementation.

### 3.6 Configurações
```javascript
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: "gemini-3.5-flash-lite",          // modelo de nuvem (substituível)
    generationConfig: { maxOutputTokens: 500 },
  },
  onDeviceParams: {
    createOptions: {                          // opções da Prompt API do Chrome
      expectedInputs:  [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        { role: "system", content: [{ type: "text", value: "You are a concise assistant." }] },
      ],
    },
  },
});
```
Também são suportados: `generateContentStream` (streaming), **saída estruturada (JSON schema e enums)** e entrada **texto + imagem (JPEG/PNG)**.

### 3.7 O que o modelo LOCAL suporta e o que não suporta
**Suporta (local):** geração de texto em **turno único**, com ou sem streaming; entrada de texto; entrada de texto + imagem (JPEG/PNG, enviada como `inlineData`); saída estruturada (JSON/enum). **Limite de ~9.216 tokens.**

**Não suporta localmente (só nuvem; `ONLY_ON_DEVICE` lança erro):**
- chat de múltiplos turnos;
- tools / function calling, code execution, URL context, grounding com Google Search/Maps;
- áudio, vídeo, PDF; imagens em formatos diferentes de JPEG/PNG; arquivos por URL;
- geração de imagem.

**Não suportado no híbrido em geral:** Gemini Live API, server prompt templates, countTokens.

**Monitoramento:** o painel "AI monitoring" do Firebase não mostra as inferências locais.

> Essas limitações são uma **oportunidade de design**: elas dão uma **razão técnica legítima** para rotear tarefas. Por exemplo: classificar ou filtrar localmente (turno único, curto, privado) e mandar para a nuvem o que exige chat, PDF, busca na web ou contexto longo.

### 3.8 App Check: regras de segurança
- Confirmar em **Console > Security > App Check > APIs** que o Firebase AI Logic aparece como **Enforced**.
- Em desenvolvimento local, usar o **debug provider** e registrar o token no console.
- **Nunca** colocar `localhost` nos domínios permitidos do reCAPTCHA.
- **Nunca** commitar o token de debug no repositório público. O objeto `firebaseConfig` (apiKey etc.) **pode** ser público: ele identifica o projeto, não é segredo.
- Em produção (link hospedado), usar **reCAPTCHA Enterprise** (Web).

### 3.9 Android (só se houver tempo)
- Dependências: `firebase-ai` + `firebase-ai-ondevice` (beta; fora do BoM; ver as versões atuais na documentação).
- O modelo local usa a **Prompt API do ML Kit** (beta), disponível só em **aparelhos específicos** (ver a lista do ML Kit).
- Guia: https://firebase.google.com/docs/ai-logic/hybrid/android/get-started
- O blog do Android Developers chama a API híbrida de **experimental**. Para um iniciante, o risco é alto.

### 3.10 Recomendação de stack (Web)
Escolher tecnologias **populares e bem documentadas**, porque a LLM gera código mais confiável para elas:
- **Vite + TypeScript** (ou JavaScript puro) com um framework de UI leve. React é aceitável se a interface for rica; JS/TS puro é aceitável se o app for simples.
- **Firebase Hosting** para o link público (deploy com `firebase deploy`).
- **Firebase Authentication**, de preferência **login anônimo** ou "Continue as guest" + Google opcional. **Nunca obrigar o jurado a criar conta** (ver 4.6).
- **Firestore** para persistir dados do usuário, se o produto precisar.
- **Remote Config** para ajustar prompts, limites de roteamento local/nuvem ou feature flags sem novo deploy. É um bom uso "com propósito" de mais um produto Firebase.
- Alternativa: **extensão do Chrome (Manifest V3)**. Tem mais impacto se o problema acontece "enquanto a pessoa navega", mas é mais complexa de configurar (App Check e Firebase em contexto de extensão). Decidir com base na ideia.

---

## 4. Boas práticas de vencedores e jurados de hackathons

> Síntese de relatos de vencedores, jurados e organizadores (fontes na seção 11). Cada prática vem acompanhada de **como aplicá-la neste projeto**.

### 4.1 A escolha da ideia é a decisão mais importante
- Gleb Bahmutov, jurado e vencedor, diz que escolher o projeto é "a decisão mais importante" e recomenda **gastar algumas horas nisso**. Rascunhar a ideia em papel ou num protótipo rápido economiza de 5 a 10 horas de retrabalho depois.
- **Comece por um problema real**, de preferência uma **dor pessoal**: assim a pessoa que constrói é o primeiro usuário e responde naturalmente à pergunta dos jurados, "quem usaria isso?" (Browser Use).
- **Não force a originalidade estudando projetos passados.** Pergunte: "o que eu queria que existisse e ainda não existe?" (Browser Use).
- Checagem de sanidade antes de se comprometer: **É impressionante? Que problema resolve? Para quem é?**
- Jurados apontam com frequência que **ter conversado com usuários reais antes de construir** pesou mais que a tecnologia.
- **Aplicação:** a ideia precisa fazer o híbrido ser **necessário**, não decorativo (ver 4.3). Ter **um público específico** (ex.: "idosos que recebem golpes por mensagem" e não "pessoas") pesa direto em *Potential Impact*. Conversar com 2 ou 3 pessoas do público-alvo e citar o que elas disseram no vídeo e na descrição.

### 4.2 Escopo pequeno, execução impecável
- **Um fluxo de usuário específico**, construído em torno da demo e o mais curto possível (Browser Use).
- "Scope ruthlessly": **um caminho feliz polido**; ignorar casos extremos raros; cortar tudo o que pode quebrar na demo (Push to Prod).
- Equipes de 1 ou 2 pessoas produzem quase o mesmo que equipes de 3 a 5, mas os jurados **esperam mais** de equipes grandes. Projeto solo precisa de escopo realista (Bahmutov).
- "Hackathons recompensam **clareza, velocidade e demos que funcionam** mais do que ambição." Um projeto "claro, completo e executável" vence um mais complexo (Momen).
- **Aplicação:** definir no máximo **1 fluxo principal + 1 ou 2 funcionalidades de apoio**. Tudo o mais vira "roadmap" na descrição.

### 4.3 A tecnologia do patrocinador precisa estar no centro
- "Se o hackathon é sobre uma tecnologia, o projeto **tem que mostrá-la** de um jeito que não seria possível sem ela" (Bahmutov).
- Hackathons são, em parte, **marketing para o patrocinador**: ele quer ver o produto dele brilhar. Construa para essa audiência (Push to Prod).
- **Destaque o nome dos produtos do patrocinador** na apresentação (Push to Prod). Na descrição, **nomeie cada produto usado, por que foi usado e o que faz** no projeto (guia de submissões do Devpost).
- Usar vários produtos do patrocinador de forma integrada aumenta as chances.
- **Aplicação (crítico):** o tema é **inferência HÍBRIDA**. O pior projeto possível é um "chat com IA" que usa `PREFER_ON_DEVICE` e só. O projeto precisa de uma **estratégia de roteamento com justificativa**. Padrões fortes:
  | Padrão | Ideia | Por que justifica o híbrido |
  |---|---|---|
  | **Privacidade** | Dados sensíveis são processados só localmente | Os dados nunca saem do aparelho |
  | **Pré-processamento local** | O modelo local anonimiza ou resume, e a nuvem recebe só o texto limpo | Combina privacidade com o poder da nuvem |
  | **Cascata / escalonamento** | O local decide rápido; se a confiança for baixa, escala para a nuvem | Custo e latência baixos na maioria dos casos |
  | **Alto volume x tarefa rara** | Tarefas frequentes e baratas no local; análises profundas e raras na nuvem | Custo de nuvem perto de zero |
  | **Offline-first** | Funciona sem internet; sincroniza e enriquece na nuvem quando volta | Conectividade ruim é um problema real |
  | **Capacidade** | O local faz o turno único; a nuvem faz chat, PDF, busca e contexto longo | Respeita as limitações reais do modelo local |
  | **Latência / tempo real** | Feedback instantâneo enquanto o usuário digita ou navega | Ir à nuvem a cada tecla é inviável |
  - Mostrar na UI **onde cada inferência rodou** (`inferenceSource`) e, se possível, um pequeno painel com algo como "X requests on-device · Y in cloud · Z data kept private".
  - Usar **Auth, Firestore e Remote Config com propósito real**, sem enfeite.

### 4.4 Construa para a demo
- "A maioria das equipes passa tempo demais codando e tempo de menos no pitch. **Inverta essa proporção**" (Push to Prod).
- "**A promessa central tem que ser real.** A coisa mais difícil que você afirma fazer precisa funcionar de verdade. O resto pode ser simulado, estático ou rústico" (Push to Prod). Simular o **núcleo** do produto prejudica muito o projeto (Browser Use).
- Tenha **um momento "uau"** memorável e garanta que ele funcione (Push to Prod).
- Adicione só funcionalidades que **aumentam o "uau" sem atrito** no fluxo (Browser Use).
- **Funcionalidades que faltam viram decisões de escopo e roadmap**, sem desonestidade (Push to Prod).
- **Aplicação:** o momento "uau" provavelmente é ver o app funcionar **com a internet desligada** (modo avião ou DevTools > Offline) ou ver dados sensíveis **ficarem no aparelho**, com o selo "🔒 on-device" aparecendo. E então algo que só a nuvem consegue fazer, com o selo "☁️ cloud". Esse contraste é a tese do hackathon numa cena.

### 4.5 Design e polimento contam muito
- Jurados não conseguem absorver profundidade técnica em poucos minutos, mas **reconhecem e valorizam UI/UX polida** (Browser Use).
- O critério *Design* deste hackathon pede uma "**experiência de produto completa e coerente**": onboarding, estados vazios, carregamento, erros amigáveis, identidade visual consistente, nome e logo.
- **Aplicação:** reservar tempo explícito para polimento (dias 22 a 25 do cronograma). Detalhes que contam: barra de progresso do download do modelo, mensagem quando o modelo local não está disponível ("Running in cloud mode: here's how to enable on-device AI"), modo escuro, responsividade, microtextos claros.

### 4.6 Tire todo o atrito dos jurados
- Cada jurado avalia talvez 10 a 20 projetos e tem **pouco tempo**. Instruções precisam ser fáceis (Bahmutov).
- Bahmutov **não executa** apps que pedem login com conta pessoal e permissões amplas. Ofereça **conta demo** ou acesso somente leitura.
- Escreva o README de modo que **um jurado que não assista à demo ainda consiga avaliar** o projeto.
- **Aplicação:**
  - Link hospedado que **funciona em um clique**; login anônimo / "Try as guest".
  - **Dados de exemplo pré-carregados** ("Try a sample") para o jurado ver valor em 10 segundos.
  - **Importante:** a maioria dos jurados **não terá a flag do Gemini Nano ativada**. O app precisa funcionar **muito bem na nuvem** e explicar no README e na própria UI como ativar o modo local (passos curtos com a URL da flag). O vídeo é onde se **prova** a execução local.

### 4.7 Faça o deploy cedo e teste com pessoas reais
- Configure **deploy contínuo desde a primeira hora**; isso evita a falha clássica de tentar colocar o app no ar na última hora (Bahmutov).
- Coloque as primeiras funcionalidades no ar cedo e **peça para amigos usarem**. Isso dá feedback e revela bugs (Bahmutov).
- Use comunidades (Discord do hackathon) como "equipe estendida" para testes e feedback (relatos de projetos solo).
- **Aplicação:** o primeiro `firebase deploy` acontece **na primeira sessão de código**, mesmo com um "Hello world". Pedir para 2 ou 3 pessoas testarem o link a partir do dia ~20/11.

### 4.8 Use tecnologia conhecida e não empilhe novidades
- Mantenha ~90% do trabalho em tecnologia **conhecida**; cada plataforma, linguagem ou biblioteca nova é risco (Bahmutov). Comece de um **starter/template** (Bahmutov).
- Para um participante sem experiência, a "tecnologia conhecida" é **a que a LLM domina melhor**: stacks populares (Vite, TypeScript, React, Firebase). Evitar frameworks exóticos e dependências desnecessárias.
- Construir uma **prova de conceito ponta a ponta funcionando** cedo; polimento depois (Browser Use).
- Manter o **branch principal sempre funcionando** (Browser Use).

### 4.9 O vídeo de demonstração (o artefato que os jurados mais consomem)
- **Prova primeiro, polimento depois** (RevenueCat Shipaton).
- **Primeiros 15 a 20 segundos:** quem é o usuário e qual frustração ele sente, com 1 ou 2 momentos concretos e reconhecíveis.
- **Gancho e prova nos primeiros 60 a 90 segundos.** Cortes rápidos.
- **Mostrar o app rodando na plataforma real**, narrando **o que o usuário conquista**, não como a interface é. **Não fazer tour de funcionalidades.**
- Mostrar números quando houver (tempo economizado, % processado localmente, antes/depois).
- **Fechamento (últimos 20 a 30 s):** o "novo normal", a transformação numa frase e a chamada para ação.
- **Não mostrar o editor de código nem o terminal** durante a demo (dev.to/Cloudinary). Exceção curta e justificada: um diagrama de arquitetura de ~10 s mostrando o roteamento local/nuvem, já que *Technological Implementation* é critério.
- Abrir com **uma frase curta e clara** que é o pitch (Browser Use). Estrutura: pitch → problema → solução → demo.
- **Sem música ou material com direitos autorais** sem licença.
- **Começar o vídeo cedo:** gravar e editar sempre leva mais tempo que o esperado, e o upload pode demorar.
- Ferramentas grátis: **OBS Studio** (gravação), **Clipchamp** (edição, vem no Windows 11), legendas automáticas do YouTube (revisar). Narração em inglês: o participante pode gravar a própria voz lendo um roteiro, ou usar legendas em inglês sobre narração em português (permitido pelas regras), ou TTS.
- **Duração-alvo: 2:30 a 2:50.** Nunca passar de 3:00.

### 4.10 A descrição escrita (Devpost)
- **Manter os títulos do template do Devpost**; quem apaga costuma esquecer informações importantes.
- Escrever para jurados que têm **~5 minutos por projeto**: **o mais importante primeiro**.
- **Responder explicitamente a cada critério de julgamento.**
- Estrutura recomendada (RevenueCat):
  1. **Logline:** "For [usuário específico], [app] helps them [tarefa] by [diferencial], so they [resultado]."
  2. **Necessidade:** o problema e por que as opções atuais falham.
  3. **Como funciona e o que é diferente:** fluxos e resultados, não uma lista de funcionalidades.
  4. **Evidência:** testes com usuários, feedback, números.
  5. Depois do gancho: a lista de funcionalidades e a história de construção.
- **Vídeo e texto contam a mesma história**; o texto é a versão comprimida do vídeo.
- Adicionar **screenshots** atualizados e um **diagrama de arquitetura**.

### 4.11 Tempo e submissão
- **Submeter é, de longe, a parte mais importante.** Um projeto não submetido não concorre.
- **Submeter um rascunho cedo** (o Devpost permite editar até o prazo). Meta: rascunho completo submetido em **28/11**, deixando 29 e 30/11 só para ajustes.
- Conferir **cada item obrigatório** (repo público, licença visível, vídeo público, link funcionando) antes do prazo.
- Em caso de dúvida sobre regras, **perguntar aos organizadores** no Discord.
- **Dormir.** Fazer o projeto com 18 dias de antecedência existe justamente para não precisar de virada de noite.

### 4.12 Mentalidade
- "**A melhor demo frequentemente vence o melhor código**" (Push to Prod). Mesmo assim, aqui o código é público e *Technological Implementation* é critério; ele precisa estar limpo e o uso do SDK, claro.
- Jurados discordam sobre ideias, mas **quase sempre concordam sobre se o produto é utilizável** (Momen).
- Notas baixas não são pessoais (Bahmutov).

---

## 5. O que vencedores de hackathons parecidos fizeram

O antecessor direto deste hackathon é o **Google Chrome Built-in AI Challenge** (2024 e 2025, Gemini Nano no Chrome). Em 2025 ele **já tinha a categoria "Best Hybrid AI Application" com Firebase AI Logic**.

**Vencedores 2025:**
- *Most Helpful:* **Nutshell** (extensão: navegação na web sem as mãos para pessoas com deficiência motora); **AAC Board AI** (comunicação aumentativa: corrige, reescreve e traduz mensagens de forma **privada e offline**).
- *Best Multimodal:* **Phonaify** (feedback de pronúncia em tempo real enquanto o usuário lê na web); **Pet Shelter App** (ajuda abrigos com poucos recursos a encontrar lares para animais).
- *Best Hybrid:* **Mentelo** (extensão conversacional de suporte técnico na própria página); **Trail** (companheiro de trilha **offline**: planejar, navegar e explorar sem internet).
- *Menções honrosas:* BrowseBack (memória "fotográfica" do navegador), EduAdapt (páginas adaptadas para TDAH/dislexia), Marionette (agente multimodal local), The Turing Werewolf (jogo de dedução social com IAs).

**Vencedores 2024:** WP on-device AI assistant (plugin WordPress), **Mochi** (leitura adaptada para dislexia/TDAH), The Crooked Tankard (jogo de aventura com IA controlada por regras), Opale (prompts reutilizáveis), **Orma** e **BrowseGraph** (híbridos: memória e GraphRAG do histórico de navegação).

**Padrões observados nos vencedores:**
1. **Público específico e muitas vezes vulnerável ou mal atendido** (pessoas com deficiência, neurodivergentes, abrigos de animais, trilheiros sem sinal). Isso pesa forte em *Potential Impact*.
2. **Acessibilidade** aparece repetidamente entre os premiados.
3. **Privacidade e offline como benefício real ao usuário**, não como detalhe técnico.
4. Nos híbridos premiados, **o offline ou o local resolve algo que a nuvem não consegue** (Trail: sem sinal) e a nuvem acrescenta poder.
5. Nomes curtos e memoráveis; proposta explicável em uma frase.

> **Cuidado:** não copiar essas ideias. Usar os **padrões**, não os projetos. Ideias muito parecidas com vencedores anteriores perdem pontos em *Quality of the Idea*.

---

## 6. Antipadrões a evitar

- ❌ **"Chatbot genérico"** ou "resumidor de notas". É o exemplo dado na própria descrição do hackathon, logo vai haver dezenas iguais.
- ❌ **Híbrido decorativo:** `PREFER_ON_DEVICE` sem nenhuma lógica, justificativa ou visibilidade de roteamento.
- ❌ Depender de **chat multi-turno, PDF, áudio ou tools no modelo local** (não é suportado; ver 3.7).
- ❌ Exigir **login com conta pessoal** ou cadastro para testar.
- ❌ App que **só funciona com a flag do Chrome ativada**. Os jurados precisam conseguir testar na nuvem.
- ❌ Deixar **deploy, vídeo ou submissão para o último dia**.
- ❌ **Escopo grande** com muitas funcionalidades pela metade.
- ❌ **Simular o núcleo** do produto (o resto pode ser simples; o núcleo, não).
- ❌ Vídeo com **mais de 3 minutos**, com tour de funcionalidades ou mostrando código e terminal.
- ❌ **Commitar segredos** (token de debug do App Check, chaves de serviço).
- ❌ Esquecer o arquivo **LICENSE** ou deixar o repositório privado.
- ❌ README que cita o Firebase AI Logic, mas o código não o chama de verdade.
- ❌ Música, imagens ou marcas com direitos autorais no vídeo ou no app.

---

## 7. Cronograma sugerido (12/11 → 30/11)

| Fase | Datas | Entregas |
|---|---|---|
| **0. Ideia e validação** | 12–13/11 | Escolher a ideia (seção 4.1), escrever a logline, conversar com 2 ou 3 pessoas do público-alvo, rascunhar o fluxo único da demo e o momento "uau". Assistir à Build Session. |
| **1. Fundação** | 13–15/11 | Instalar Node.js, Git e Firebase CLI; criar o projeto Firebase (AI Logic + App Check); criar o repo no GitHub com **LICENSE Apache 2.0**; criar o app Vite; **primeiro deploy no Firebase Hosting**; testar se o Gemini Nano roda na máquina (flag + `LanguageModel.availability()`). |
| **2. Núcleo** | 15–19/11 | Fluxo principal ponta a ponta funcionando com inferência híbrida real e roteamento intencional; selo `inferenceSource` na UI; deploy a cada avanço. |
| **3. Produto** | 19–22/11 | Auth (anônimo), Firestore e Remote Config com propósito; dados de exemplo ("Try a sample"); estados de carregamento, erro e "modelo local indisponível". Testes com 2 ou 3 pessoas. |
| **4. Polimento** | 22–25/11 | Identidade visual, onboarding, responsividade, textos em inglês revisados, correções dos testes. **Congelar funcionalidades em 25/11.** Decisão sobre Android: só se tudo estiver pronto (provavelmente não). |
| **5. Materiais** | 25–28/11 | README completo + diagrama de arquitetura + screenshots; roteiro do vídeo; gravação; edição; legendas; upload no YouTube (público); descrição no Devpost. **Submeter o rascunho completo em 28/11.** |
| **6. Folga** | 29–30/11 | Revisão final do checklist (2.4), correções pequenas. Sem funcionalidades novas. |

---

## 8. Modelos (templates)

### 8.1 Roteiro do vídeo (≤ 3:00, em inglês)
| Tempo | Conteúdo |
|---|---|
| 0:00–0:20 | **Problema humano:** quem é o usuário + uma cena concreta da dor. Uma frase de pitch. |
| 0:20–0:35 | **Solução numa frase** + nome do app. |
| 0:35–1:50 | **Demo do fluxo principal** no Chrome, com o selo "🔒 on-device" visível. **Momento "uau"**: desligar a internet e continuar funcionando, ou mostrar que os dados sensíveis não saem do aparelho. Depois, uma tarefa que vai para a nuvem ("☁️ cloud") e por quê. |
| 1:50–2:20 | **Como o híbrido funciona:** diagrama simples de roteamento (o que fica local, o que vai à nuvem e por quê) + produtos Firebase usados (AI Logic, App Check, Auth, Firestore, Remote Config). |
| 2:20–2:50 | **Impacto:** quem se beneficia, feedback de usuários reais, próximo passo (ex.: Android). Chamada para ação + link. |

### 8.2 Descrição do Devpost (em inglês; manter os títulos do template)
- **Inspiration:** a dor real, de quem, e por que importa (com o feedback dos usuários entrevistados).
- **What it does:** logline + fluxo principal + resultado para o usuário.
- **How we built it:** **Firebase AI Logic hybrid inference** (modos usados, estratégia de roteamento, `inferenceSource`, saída estruturada), App Check, Auth, Firestore, Remote Config, Hosting; stack; diagrama.
- **Challenges we ran into:** limitações reais do modelo local e como o design lidou com elas.
- **Accomplishments that we're proud of:** o momento "uau"; % de inferências locais; privacidade.
- **What we learned.**
- **What's next:** Android/iOS com o mesmo SDK, novas funcionalidades.

### 8.3 Estrutura do README (em inglês)
1. Nome + logline + badges + link do app hospedado + link do vídeo
2. Screenshot/GIF principal
3. The problem / Who it's for
4. How it works: **hybrid inference strategy** (tabela do que roda onde e por quê) + diagrama
5. Firebase products used and why (cada um com o arquivo onde é chamado, ex.: `src/ai/router.ts`)
6. Try it: link hospedado; como ativar o Gemini Nano no Chrome (flag, passo a passo); o que acontece sem ele (fallback para a nuvem)
7. Run locally: pré-requisitos, `npm install`, configuração do Firebase, App Check debug token, `npm run dev`
8. Tech stack
9. Roadmap
10. License (Apache 2.0)

---

## 9. Como a LLM deve trabalhar com este participante

1. **Explicar em português simples.** O participante não programa. Antes de cada etapa, dizer **o que** vai ser feito e **por quê** em 1 ou 2 frases. Evitar jargão ou explicá-lo.
2. **Fazer o trabalho técnico.** A LLM escreve o código, os comandos e as configurações. Quando o participante precisar agir (criar conta, clicar no Console do Firebase, ativar flag, gravar vídeo), dar **passos numerados, curtos e exatos**, com o que deve aparecer na tela.
3. **Uma coisa de cada vez.** Avançar em passos pequenos e verificáveis; confirmar que funcionou antes de seguir.
4. **Proteger o escopo.** Se o participante (ou a própria LLM) quiser adicionar funcionalidades, comparar com o cronograma (seção 7) e com o princípio "um fluxo, impecável". Lembrar do congelamento em 25/11.
5. **Sempre funcionando.** Manter o app em estado deployável; fazer commits frequentes com mensagens claras; deploy a cada avanço significativo.
6. **Segurança:** nunca commitar o token de debug do App Check nem chaves de serviço; usar `.env` + `.gitignore` quando necessário.
7. **Conferir a documentação atual** do Firebase AI Logic antes de escrever código do SDK (as APIs mudam). Em caso de dúvida, buscar na documentação oficial em vez de chutar.
8. **Pensar nos critérios.** Para cada decisão, perguntar: isso melhora *Technological Implementation*, *Design*, *Potential Impact* ou *Quality of the Idea*? Se não melhora nenhum, provavelmente não vale o tempo.
9. **Tudo o que o jurado vê fica em inglês** (UI, README, commits idealmente, vídeo, descrição). A conversa com o participante fica em português.
10. **Atualizar a seção 10** deste arquivo quando decisões forem tomadas.

---

## 10. Estado atual do projeto

- **Data:** 12/11/2026
- **Pasta do projeto:** `C:\Users\Gabriel\hackathon` (vazia além deste arquivo)
- **Plataforma:** Web/Chrome (decidido pelas restrições; Android = talvez, só no fim)
- **Máquina do participante (verificada em 12/11, somente leitura):** Acer Nitro AN515-57, Windows 11 Home, i5-11400H (6 núcleos), **RAM 8 GB (um único pente DDR4-3200 de 8 GB, A-DATA AD4S320038G22)**, **GPU NVIDIA GTX 1650 com 4 GB de VRAM** + Intel UHD, C: com 53 GB livres, **Chrome 157**, Node.js e Git instalados, **Firebase CLI não instalado**. ✅ **CONFIRMADO em 12/11: o Gemini Nano RODA nesta máquina.** `chrome://on-device-internals` mostra "Device performance class: Medium", e `await LanguageModel.availability()` retorna `'available'` (modelo já baixado). O próprio Chrome confirmou os idiomas de saída suportados: `[de, en, es, fr, ja]`. **Sempre especificar `expectedOutputs` com idioma (ex.: `en`)**, senão o Chrome emite um aviso de qualidade/segurança. Não é preciso comprar RAM.
- **Nome do projeto: Traceless** (escolhido em 12/11; "Unseen" descartado por haver pedido de marca nos EUA na classe de software).
- **Plano de execução e arquitetura:** `PLANO.md`. **Execução autônoma:** `.claude/manager/PROTOCOL.md`; progresso em `docs/progress/`.
- **Ideia APROVADA pelo participante (12/11):** ferramenta do lado de quem denuncia que detecta **no próprio aparelho** os detalhes do relato que identificariam o denunciante (quasi-identificadores: função única, turno, local, datas, estilo de escrita) e sugere reescritas *antes* de qualquer coisa ser enviada. A nuvem só recebe texto já limpo e aprovado (direitos legais com grounding, tradução, triagem do lado de quem investiga). Tese: "o anonimato falha pelo conteúdo, não pelo canal". Ver a conversa de 12/11 para a justificativa completa.
- **Ideias anteriores (descartadas ou secundárias):**
  1. **Detector de golpes** (extensão do Chrome): analisa mensagens, e-mails e páginas localmente, por privacidade; escala casos duvidosos para a nuvem já anonimizados. Público: idosos e famílias; golpes de Pix são um problema enorme no Brasil.
  2. **"Câmara de privacidade" para documentos sensíveis:** anonimiza localmente (exames, contratos), analisa na nuvem e reidentifica localmente.
  3. **Ferramenta offline para agentes comunitários de saúde:** registro e triagem offline no aparelho, sincronização via Firestore e relatórios pela nuvem quando houver conexão.
- **Próximos passos:** escolher a ideia → logline → fluxo da demo → fase 1 do cronograma.
- **Pendências:** confirmar o horário exato do prazo no Devpost; testar se a máquina do participante roda o Gemini Nano.

---

## 11. Fontes

**Documentação oficial**
- Firebase AI Logic, inferência híbrida (visão geral): https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
- Web, get started: https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
- Web, configuration options: https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
- Android, get started: https://firebase.google.com/docs/ai-logic/hybrid/android/get-started
- Android Developers Blog, "Hybrid inference and new AI models are coming to Android" (abr/2026): https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html

**Hackathons anteriores (Chrome Built-in AI Challenge)**
- Vencedores 2025: https://developer.chrome.com/blog/ai-challenge-winners-2025
- Vencedores 2024: https://developer.chrome.com/blog/ai-challenge-winners

**Boas práticas de vencedores, jurados e organizadores**
- Gleb Bahmutov, "Winning hackathons" (visão de jurado): https://glebbahmutov.com/blog/winning-hackathons/
- Browser Use, "How to win hackathons": https://browser-use.com/posts/how-to-win-hackathons
- Push to Prod, "How To Win Hackathons": https://getpushtoprod.substack.com/p/how-to-win-hackathons
- RevenueCat, "How to win Shipaton, part 4: pitching your app" (vídeo e texto para hackathon online): https://www.revenuecat.com/blog/engineering/how-to-win-shipaton-part-4-pitching-your-app
- Jacklyn Biggin, "How to make your Devpost submissions not suck": https://dev.to/jacklynbiggin/how-to-make-your-devpost-submissions-not-suck-37i0
- Momen, "Hackathon survival guide: what actually matters": https://dev.to/momen_hq/hackathon-survival-guide-what-actually-matters-3hme
- Cloudinary, "How to win a hackathon": https://dev.to/cloudinary/how-to-win-a-hackathon-1377
- hackathon.com, "Creating the best demo video for a hackathon": https://tips.hackathon.com/article/creating-the-best-demo-video-for-a-hackathon-what-to-know
- Medium (Developer Circles Lusaka), "Tips on how to win an online hackathon on Devpost": https://medium.com/developer-circles-lusaka/tips-on-how-to-win-an-online-hackathon-on-devpost-c548027e0eae
