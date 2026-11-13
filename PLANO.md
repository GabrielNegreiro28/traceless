# Plano: Traceless (execução e arquitetura)

## Contexto

O **Traceless** é o projeto do participante para o hackathon #BuildHybridAI (prazo 30/11/2026, projeto solo, participante sem experiência em programação; a LLM escreve o código). A ideia foi aprovada depois da pesquisa: **denúncias anônimas falham pelo conteúdo, não pelo canal**. O texto do relato traz detalhes (função única, turno, local, datas pessoais, estilo de escrita) que identificam quem denuncia.

O Traceless detecta esses detalhes **no próprio aparelho** (Gemini Nano via Firebase AI Logic, `ONLY_ON_DEVICE`) e sugere reescritas *antes* de qualquer envio. A nuvem só recebe texto **limpo e aprovado pela pessoa**, para tarefas que exigem a nuvem: direitos legais com busca no Google, triagem, conversa com várias trocas.

Fatos já verificados que restringem o design:
- O Gemini Nano **roda na máquina do participante**: `LanguageModel.availability()` retornou `'available'`; classe de desempenho "Medium"; Chrome 157.
- Idiomas suportados pelo modelo local: **en, es, de, fr, ja** (sem português). O produto é **em inglês**.
- Limitações locais: só turno único; limite de ~9.216 tokens; sem tools; saída estruturada **funciona** (`onDeviceParams.promptOptions.responseConstraint` no aparelho, `inCloudParams.generationConfig.responseSchema` na nuvem).
- Ferramentas da máquina: Node 24.20, npm 12.2, Git 2.53. **Java 1.8 é velho demais para os emuladores do Firebase**: precisa do **JDK 21** (Temurin). Firebase CLI não instalado: entra como devDependency.
- Versões mais recentes no npm hoje: firebase 13.3.0, vite 8.3.8, vitest 5.1.0, firebase-tools 15.36.0, typescript 7.0.2.

O pedido do participante: um plano de **execução e arquitetura** (sem cronograma), com princípios de engenharia de software, **reprodutível**, com **baixo acoplamento** e **funções de responsabilidade única**.

---

## 1. Princípios de engenharia (valem para todo o código)

1. **Arquitetura em camadas / hexagonal (ports & adapters).** O domínio é puro e não conhece Firebase, React nem o navegador. Casos de uso dependem de **interfaces (ports)**. Firebase e Gemini ficam em **adapters** substituíveis.
2. **Responsabilidade única.** Cada função faz uma coisa. Meta de ≤ ~40 linhas por função e ≤ ~200 por arquivo. Nada de "função faz-tudo": detectar, localizar, mesclar, pontuar e reescrever são funções separadas.
3. **Injeção de dependências.** Uma **composition root** (`src/app/compositionRoot.ts`) monta os adapters e os entrega à UI por um `ServicesProvider`. Testes e modo demo injetam *fakes*.
4. **Privacidade garantida por tipos.** *Branded types* `RawText` e `SanitizedText`. Adapters de nuvem **só aceitam `SanitizedText`**, e `SanitizedText` só nasce na função `approveReport()` (aprovação explícita da pessoa). Mandar texto bruto para a nuvem vira **erro de compilação**, não só uma convenção.
5. **Política de inferência declarativa e centralizada.** Uma tabela única (`src/ai/policy/inferencePolicy.ts`) define tarefa → modo do SDK → classe do dado. Os adapters leem a política e não escolhem o modo sozinhos.
6. **Erros explícitos.** Tipo `Result<T, AppError>` com variantes nomeadas (`OnDeviceUnavailable`, `LanguageNotSupported`, `ModelDownloading`, `InvalidModelOutput`, `Offline`, `QuotaExceeded`, `PermissionDenied`). Adapters convertem exceções em `AppError`, e a UI converte `AppError` em mensagens amigáveis.
7. **Validação em tempo de execução das respostas do modelo** com **zod**. Saída inválida vira `InvalidModelOutput`, com 1 nova tentativa.
8. **Reprodutibilidade.** Versões exatas (`save-exact`), `package-lock.json` versionado, `.nvmrc` e `engines`, `.env.example`, infraestrutura como código (rules, indexes, Remote Config template, hosting), emuladores locais, script de seed e CI que roda tudo do zero com `npm ci`.
9. **Fronteiras checadas automaticamente.** Regras do ESLint (`no-restricted-imports` / `eslint-plugin-boundaries`) proíbem, por exemplo, `domain` importar `firebase` ou `react`, e `features` importar `infrastructure`.
10. **Nunca registrar texto bruto.** Um `logger` próprio substitui `console.*` (ESLint `no-console`). Nada de analytics, rascunho em `localStorage` ou envio de telemetria com o conteúdo do relato. O texto bruto vive só em memória.

---

## 2. Stack (fixar versões exatas na instalação, conferindo compatibilidade)

| Camada | Escolha | Motivo |
|---|---|---|
| Build | **Vite 8** + **TypeScript** (modo strict) | Padrão de mercado; a LLM gera código confiável para ele. TS: usar a versão mais recente **compatível com typescript-eslint** (conferir no setup; a 7.0 nativa pode ainda não ser suportada) |
| UI | **React** + **React Router** | Componentes isolados; muita documentação |
| Estilo | **Tailwind CSS v4** (plugin do Vite) + tokens de design em CSS | Rápido, consistente, modo escuro |
| IA | **firebase** (`firebase/ai`), ≥ 13.x | Inferência híbrida, `inferenceSource`, saída estruturada |
| Backend | Firebase **Auth** (anônimo + e-mail/senha para quem investiga), **Firestore**, **Remote Config**, **App Check** (**reCAPTCHA Enterprise** via `ReCaptchaEnterpriseProvider`, chave criada no Google Cloud "Fraud Defense"; o reCAPTCHA clássico/v3 foi descontinuado; plano grátis: 10 mil verificações por mês, sem faturamento), **Hosting** | Exigidos ou incentivados pelo hackathon |
| Validação | **zod** | Valida o JSON do modelo e os formulários |
| Offline | **vite-plugin-pwa** (app shell em cache) + cache persistente do Firestore (envio fica em fila offline) | Momento "uau" offline |
| Testes | **Vitest** + Testing Library (jsdom), **@firebase/rules-unit-testing**, **Playwright** | Testes unitários, de componentes, de regras e E2E |
| Qualidade | ESLint (typescript-eslint, boundaries), Prettier, Husky + lint-staged, commitlint (Conventional Commits) | Padronização automática |
| CLI | **firebase-tools** como devDependency (via `npx`) | Versão fixada e reprodutível |

---

## 3. Arquitetura

### 3.1 Visão geral

```
                    ┌──────────────── navegador (Chrome) ────────────────┐
  Quem denuncia ──▶ │ features/ (UI React)                                │
                    │      │ usa                                          │
                    │ application/ usecases ──▶ ports (interfaces)         │
                    │      │ usa                     ▲ implementam          │
                    │ domain/ (puro)            infrastructure/adapters     │
                    │                              │            │          │
                    │              Gemini Nano (ONLY_ON_DEVICE)  │          │
                    └──────────────────────────────────────────│──────────┘
                                                                 │ só SanitizedText
                              Firebase: AI Logic (nuvem) · Firestore · Auth · Remote Config · App Check
                                                                 │
  Quem investiga ◀── features/handler (lê só relatos limpos; triagem/conversa na nuvem)
```

### 3.2 Estrutura de pastas

```
/ (raiz do repo = C:\Users\Gabriel\hackathon)
├─ .github/workflows/ci.yml           # lint, typecheck, unit, rules (emulador), build, e2e(fake)
├─ docs/
│  ├─ architecture.md                 # diagramas + tabela de roteamento (vai pro README/vídeo)
│  └─ adr/                            # decisões: 0001-hybrid-routing-policy, 0002-branded-text-types,
│                                     # 0003-capability-url-case-key, 0004-deterministic-risk-scoring
├─ eval/
│  ├─ datasets/reports.v1.json        # relatos sintéticos com spans "gold" anotados
│  └─ results/                        # resultados versionados (prompt v, data, métricas)
├─ firebase/
│  ├─ firestore.rules · firestore.indexes.json · remoteconfig.template.json
├─ firebase.json · .firebaserc
├─ scripts/seed-demo.ts               # cria org demo, handler demo e casos de exemplo (emulador ou prod)
├─ tests/
│  ├─ rules/                          # testes das security rules no emulador
│  └─ e2e/                            # Playwright com IA fake (determinístico)
├─ src/
│  ├─ domain/                         # PURO: sem React/Firebase/DOM
│  │  ├─ text/brandedText.ts          # RawText, SanitizedText, ConsentedRawText
│  │  ├─ report/types.ts              # Report, ReportFields, CaseKey, Message
│  │  ├─ detection/
│  │  │  ├─ types.ts                  # Finding {span, category, reason, suggestion, origin}
│  │  │  ├─ ruleDetector.ts           # regex: e-mail, telefone, URL, matrícula, datas explícitas
│  │  │  ├─ spanLocator.ts            # citação do modelo → offsets; descarta citação inexistente (anti-alucinação)
│  │  │  ├─ findingMerger.ts          # remove duplicatas e resolve sobreposições
│  │  │  └─ textChunker.ts            # divide por parágrafos dentro do limite de tokens; reajusta offsets
│  │  ├─ risk/riskScorer.ts           # pontuação DETERMINÍSTICA e explicável (pesos + combinação)
│  │  └─ rewrite/rewriteApplier.ts    # aplica sugestões aceitas (do fim pro início, offsets estáveis)
│  ├─ application/
│  │  ├─ ports/                       # IdentityScanner, StyleNeutralizer, ReportStructurer, RightsAdvisor,
│  │  │                               # CaseTriager, ReportRepository, AuthService, ConfigService, DeviceCapability
│  │  └─ usecases/                    # scanReport, approveReport, submitReport, sendMessage,
│  │                                  # loadCase, triageCase, adviseRights (cada um orquestra; sem lógica de IO)
│  ├─ ai/                             # conhecimento de IA sem inicialização de Firebase
│  │  ├─ policy/inferencePolicy.ts    # tabela tarefa → modo → classe de dado
│  │  ├─ prompts/                     # identityScan.v1.ts, styleNeutralize.v1.ts, ... (versionados)
│  │  └─ schemas/                     # Schema do Firebase + schema zod pareado por tarefa
│  ├─ infrastructure/
│  │  ├─ firebase/                    # app.ts, appCheck.ts, auth.ts, firestore.ts, remoteConfig.ts (só init/config)
│  │  ├─ ai/
│  │  │  ├─ modelFactory.ts           # cria GenerativeModel a partir da política (idioma en, schema)
│  │  │  ├─ deviceCapability.ts       # availability() com as opções exatas + initializeDeviceModel(progresso)
│  │  │  ├─ errorMapper.ts            # exceções do SDK/Chrome → AppError
│  │  │  └─ adapters/                 # OnDeviceIdentityScanner, ConsentedCloudIdentityScanner,
│  │  │                               # OnDeviceStyleNeutralizer, HybridReportStructurer,
│  │  │                               # CloudRightsAdvisor (googleSearch), CloudCaseTriager
│  │  ├─ repositories/FirestoreReportRepository.ts
│  │  └─ fakes/                       # Fake* de cada port (testes, E2E, modo demo)
│  ├─ app/                            # compositionRoot.ts, ServicesProvider.tsx, router.tsx, App.tsx
│  ├─ features/
│  │  ├─ onboarding/                  # checagem do aparelho, download do modelo, tela de consentimento
│  │  ├─ compose/                     # editor do relato
│  │  ├─ review/                      # destaques, medidor de risco, cartões de sugestão, máquina de estados
│  │  ├─ submit/                      # revisão final, envio, exibição única da chave do caso
│  │  ├─ followup/                    # entrar com a chave, mensagens nos dois sentidos
│  │  ├─ rights/                      # orientação legal + sugestões de busca + fontes
│  │  └─ handler/                     # login, caixa de entrada, detalhe do caso, triagem, resposta, prazos
│  ├─ ui/                             # Button, Card, Dialog, ProgressBar, InferenceBadge, RiskMeter, Highlight
│  └─ shared/                         # result.ts, appError.ts, logger.ts, ids.ts (crypto.getRandomValues)
├─ .env.example · .nvmrc · .npmrc (save-exact) · LICENSE (Apache-2.0) · README.md
├─ CLAUDE.md (regras de engenharia) · HACKATHON.md (contexto)
```

Cada `features/*` segue o mesmo padrão: **componentes de apresentação** (só props, sem IO) + **um hook container** (`useX`) que chama casos de uso via `useServices()`. Componentes nunca importam adapters.

### 3.3 Política de inferência (o coração do híbrido)

| Tarefa | Classe do dado | Modo | Por quê |
|---|---|---|---|
| `identityScan` | RAW | `ONLY_ON_DEVICE` | Texto bruto é o dado mais perigoso. Cair para a nuvem sem avisar seria uma falha de privacidade |
| `styleNeutralize` | RAW | `ONLY_ON_DEVICE` | Ainda é texto bruto |
| `structureReport` (o quê, quando, onde, evidência) | SANITIZED | `PREFER_ON_DEVICE` | Barato e local quando possível |
| `adviseRights` | SANITIZED | `ONLY_IN_CLOUD` + `tools: [{googleSearch:{}}]` | A busca no Google só existe na nuvem |
| `triageCase` / `draftReply` | SANITIZED | `ONLY_IN_CLOUD` | Contexto longo, lado de quem investiga |
| `caseChat` | SANITIZED | `ONLY_IN_CLOUD` (`startChat`) | Conversa com várias trocas não roda no aparelho |
| `identityScan` (alternativa) | CONSENTED_RAW | `ONLY_IN_CLOUD` | **Só** com consentimento explícito quando o aparelho não roda IA local |

**Regras:**
- Toda resposta de IA devolve `{ data, source: 'ON_DEVICE' | 'IN_CLOUD' }`, vindo de `response.inferenceSource`. Esse `source` alimenta o `<InferenceBadge>` da interface.
- Todo modelo local declara `expectedInputs` e `expectedOutputs` com `languages: ["en"]` (evita o aviso de qualidade do Chrome).
- `initializeDeviceModel()` só é chamado por um clique (botão "Prepare private AI" no onboarding), com barra de progresso.

### 3.4 Pipeline de detecção (passos desacoplados, cada um testável sozinho)

```
RawText
  → textChunker (domínio)                    pedaços dentro do limite de tokens
  → ruleDetector (domínio, determinístico)   identificadores diretos
  → IdentityScanner port (adapter local)     quasi-identificadores: {quote, category, reason, suggestion}[]
  → spanLocator (domínio)                    citação → offsets; descarta o que não existe no texto
  → findingMerger (domínio)                  junta regras + modelo; resolve sobreposições
  → riskScorer (domínio)                     nível LOW / MEDIUM / HIGH + explicação (combinação de categorias)
  → UI de revisão                            a pessoa aceita, edita ou ignora cada achado
  → rewriteApplier (domínio)                 aplica as escolhas
  → approveReport (caso de uso)              RawText → SanitizedText (único ponto de criação)
```

- **Categorias** (enum compartilhado): `ROLE_UNIQUE`, `SCHEDULE`, `LOCATION`, `PERSONAL_EVENT_DATE`, `PERSONAL_TRAIT`, `TEAM_SIZE`, `DIRECT_IDENTIFIER`, `WRITING_STYLE`.
- O prompt instrui explicitamente: **proteger quem denuncia, preservar os fatos e quem é acusado.** O nome do acusado e os fatos do incidente **não** são marcados.
- `scanReport` usa o padrão *strategy*: a estratégia de prompt (uma passada ou uma passada por categoria) pode mudar com base na avaliação sem alterar quem chama.
- O risco é calculado **por código, não pelo modelo**. É determinístico, testável e explicável ("3 detalhes combinados: função + turno + local").

### 3.5 Dados no Firestore e segurança

```
orgs/{orgId}                               { name }                       # org demo: "acme-demo"
orgs/{orgId}/handlers/{uid}                { displayName }                # quem pode investigar
orgs/{orgId}/reports/{caseKey}             { sanitizedText, fields, category, status,
                                             createdAt, schemaVersion, triage? }
orgs/{orgId}/reports/{caseKey}/messages/{id} { from: 'reporter'|'handler', text, createdAt }
```

- **Chave do caso = ID do documento.** São 128 bits aleatórios gerados com `crypto.getRandomValues` e codificados em base62 (uma "URL de capacidade"). Quem tem a chave acompanha o caso de qualquer aparelho, sem conta. Atende ao requisito da Diretiva de confirmar recebimento e dar retorno. Ela aparece **uma única vez** na tela, com opção de copiar ou baixar. Registrar como ADR 0003.
- **Regras:** quem denuncia (anônimo e autenticado) pode **criar** um relato (com validação de campos e tamanhos), fazer **get** (nunca **list**) de um relato pelo ID e ler e criar mensagens desse caso. Quem investiga (UID em `handlers`) pode listar e ler relatos da org, escrever `triage` e mensagens e mudar `status`. Todo o resto é negado.
- **Testes das regras** no emulador cobrem todos os papéis e as tentativas proibidas (listar relatos sendo anônimo, alterar o relato de outra pessoa, campos extras).
- **Remote Config** (template versionado em `firebase/remoteconfig.template.json` + valores padrão no código em `remoteConfigDefaults.ts`, para o app funcionar mesmo sem buscar): `report_categories`, `ack_deadline_days` (7), `feedback_deadline_days` (90), `cloud_model_name`, `rights_advice_enabled`, `identity_prompt_version`.
- **Hosting:** cabeçalhos de segurança no `firebase.json` (CSP, `Referrer-Policy`, `Permissions-Policy`) e SPA rewrite.

### 3.6 Máquina de estados do fluxo de quem denuncia

Um reducer puro em `features/review/reportFlowMachine.ts`, testado isoladamente:
`composing → scanning → reviewing → approved → submitting → submitted`, além de `error(AppError)` e `needsConsent`. Transições inválidas são impossíveis por tipo.

### 3.7 Quando não há IA local (o caso da maioria dos jurados)

`deviceCapability` informa `available | downloadable | downloading | unavailable`. Se `unavailable`, o onboarding oferece três caminhos:
- (a) só a verificação local por regras;
- (b) análise na nuvem com **consentimento explícito** e o risco explicado (gera um `ConsentedRawText` → `ConsentedCloudIdentityScanner`);
- (c) instruções para ativar o modelo local.

O consentimento vale só para a sessão e não é persistido.

---

## 4. Estratégia de testes

| Nível | Ferramenta | O que cobre |
|---|---|---|
| Unitário (domínio) | Vitest | `ruleDetector`, `spanLocator`, `findingMerger`, `textChunker`, `riskScorer`, `rewriteApplier`, `reportFlowMachine`, métricas da avaliação. **Meta: ~100% do domínio** |
| Adapters | Vitest + `GenerativeModel` falso | Montagem do prompt, opções (modo, idioma, schema), parse com zod, conversão de erros, `source` |
| Contrato | Vitest | Uma suíte compartilhada que **todas** as implementações de cada port precisam passar (fake e reais com modelo falso) |
| Componentes | Testing Library | Estados de UI: carregando, erro, sem IA local, destaques, medidor |
| Security rules | rules-unit-testing + emulador | Permissões por papel |
| E2E | Playwright + build com `VITE_AI_MODE=fake` | Fluxo completo determinístico: compor → analisar → aceitar → enviar → acompanhar → quem investiga vê e responde |
| **Qualidade do modelo real** | Página `/eval` (só em dev) no Chrome | Precisão e recall por categoria contra `reports.v1.json`, várias execuções (a saída do Nano não é determinística na web); exporta JSON para `eval/results/` com a versão do prompt |

---

## 5. Plano de execução (fases com critério de pronto)

**Fase 0. Fundação do repositório**
- `git init`, Vite + React + TS strict, Tailwind, ESLint (com regras de fronteira), Prettier, Husky, lint-staged, commitlint, Vitest.
- `.nvmrc`, `.npmrc` com save-exact, `.env.example`, LICENSE Apache-2.0, esqueleto de pastas, README inicial.
- Atualizar `HACKATHON.md` (nome **Traceless**, arquitetura) e o `CLAUDE.md` com as regras de engenharia da seção 1.
- CI no GitHub Actions: `npm ci`, lint, typecheck, test, build.
- ✅ Pronto quando: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` passa do zero, localmente e no CI.

**Fase 1. Fundação Firebase** (o participante faz os passos no Console com um guia passo a passo)
- Criar projeto; ativar AI Logic (Gemini Developer API); App Check com reCAPTCHA Enterprise (enforced só quando o app estiver pronto) e debug token **fora do git**.
- Ativar Auth (anônimo + e-mail/senha), Firestore e Remote Config.
- Instalar JDK 21; `firebase.json` com emuladores (Auth, Firestore); primeiro deploy no Hosting.
- `infrastructure/firebase/*` só com inicialização.
- ✅ Pronto quando: o link público abre; `npm run emulators` sobe; a App Check aparece como enforced.

**Fase 2. Spike de detecção + avaliação (portão de decisão)**
- Domínio: `textChunker`, `ruleDetector`, `spanLocator`, `findingMerger`, `riskScorer` com testes.
- Política de inferência, `modelFactory`, `deviceCapability`, `errorMapper`, `OnDeviceIdentityScanner`, prompt v1 e schema.
- Dataset `reports.v1.json` (~20–30 relatos sintéticos com spans anotados) e página `/eval`.
- ✅ Pronto quando há métricas versionadas em `eval/results/`. **Portão:** recall combinado (regras + modelo) dos detalhes identificadores ≥ ~70%, sem marcar fatos do incidente nem o acusado. Se não atingir, iterar no prompt ou na estratégia por categoria antes de seguir.

**Fase 3. Fluxo principal de quem denuncia**
- `onboarding` (capacidade do aparelho, download com progresso, consentimento), `compose`, `review` (destaques, medidor, cartões de sugestão, máquina de estados).
- `rewriteApplier`, `approveReport` (cria `SanitizedText`), `InferenceBadge`, botão "Try a sample report".
- ✅ Pronto quando o fluxo compor → analisar → revisar → aprovar funciona **com o Wi-Fi desligado** e há testes de componentes e E2E (fake).

**Fase 4. Envio e acompanhamento**
- `AuthService` (anônimo), `FirestoreReportRepository`, `submitReport`, chave do caso, `followup` com mensagens.
- Regras e testes das regras; cache persistente do Firestore (envio em fila offline); PWA.
- ✅ Pronto quando um relato enviado offline sincroniza ao voltar a internet, a chave abre o caso em outra aba anônima e os testes das regras passam no CI.

**Fase 5. Recursos de nuvem**
- `CloudRightsAdvisor` (grounding, exibindo `searchEntryPoint.renderedContent` e as fontes de `groundingChunks`, como exigem os termos).
- `HybridReportStructurer`, `OnDeviceStyleNeutralizer`, `ConfigService` com Remote Config e template versionado.
- ✅ Pronto quando cada recurso mostra o selo correto (`IN_CLOUD` / `ON_DEVICE`) e recebe só `SanitizedText` (garantido pelo compilador).

**Fase 6. Lado de quem investiga**
- Login demo (credenciais públicas da org demo no README), caixa de entrada, detalhe do caso, `CloudCaseTriager`, resposta, indicadores de prazo (7 dias / 3 meses via Remote Config).
- `scripts/seed-demo.ts`.
- ✅ Pronto quando o relato enviado por quem denuncia aparece na caixa de entrada, recebe triagem e resposta, e quem denuncia vê a resposta.

**Fase 7. Robustez e acabamento**
- Acessibilidade (teclado, contraste, ARIA nos destaques), todos os estados de erro mapeados, CSP, modo escuro, responsividade, textos em inglês revisados, E2E completo no CI.
- ✅ Pronto quando o checklist de UX está completo e o CI está verde.

**Fase 8. Material da submissão**
- README completo (problema, tabela de roteamento, diagrama, produtos Firebase com o arquivo de cada um, como rodar, como ativar o Gemini Nano, resultados da avaliação).
- `docs/architecture.md`, ADRs, roteiro do vídeo e texto do Devpost (modelos do `HACKATHON.md`, seção 8).

---

## 6. Scripts npm (interface reprodutível)

`dev` · `build` · `preview` · `lint` · `typecheck` · `format` · `test` (unit + componentes) · `test:rules` (sobe o emulador e roda) · `test:e2e` (build fake + Playwright) · `emulators` · `seed:emulator` · `seed:prod` · `deploy` (hosting + rules + indexes + remoteconfig) · `ci` (encadeia tudo que o CI roda).

## 7. Arquivos críticos a criar primeiro

`src/domain/text/brandedText.ts`, `src/ai/policy/inferencePolicy.ts`, `src/infrastructure/ai/modelFactory.ts`, `src/application/ports/IdentityScanner.ts`, `src/application/usecases/scanReport.ts`, `src/app/compositionRoot.ts`, `firebase/firestore.rules`, `eval/datasets/reports.v1.json`, `CLAUDE.md`.

## 8. Verificação ponta a ponta

1. **Do zero:** clonar, `npm ci`, copiar `.env.example` para `.env.local`, `npm run ci`. Tudo passa.
2. **Local com emuladores:** `npm run emulators` + `npm run seed:emulator` + `npm run dev`. Fazer o fluxo completo de quem denuncia e de quem investiga.
3. **Privacidade:** DevTools > Network durante a análise, com **zero requisições**. Repetir com Wi-Fi desligado (DevTools > Offline). Os selos mostram "On-device".
4. **Garantia por tipo:** um teste de compilação (`@ts-expect-error`) prova que um `RawText` não pode ser passado para um adapter de nuvem.
5. **Sem IA local:** abrir em um perfil ou navegador sem o Nano. Aparece a tela de consentimento e nada é enviado sem aceite.
6. **Qualidade:** rodar `/eval`, salvar o resultado em `eval/results/` e conferir se o portão da Fase 2 foi atingido.
7. **Produção:** `npm run deploy`, abrir o link público em aba anônima e repetir os passos 3 e 5. A App Check bloqueia chamadas sem token válido.
