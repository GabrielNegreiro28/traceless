# STATUS — Traceless

_Atualizado pelo manager a cada iteração._

- **Data da última atualização:** 2026-11-13
- **Fase atual:** Fase 2 (detecção + avaliação) em andamento — tarefa 2 de 7. Fase 1 concluída (App Check enforced no AI Logic, verificado em 13/11).
- **Prazo:** **2026-11-30 às 19:00 GMT-3** (horário de Brasília). Rascunho completo até 28/11; congelamento de funcionalidades em 25/11; submeter com folga, nunca na última hora.

## Concluído
- **Fase 2, tarefa 1 (13/11):** commit `c32b9f9` (325 testes, revisado) — política de inferência (RAW ⇒ only_on_device garantido em compilação), prompt `identityScan.v1` + few-shot, schema JSON + zod com salvamento, port `IdentityScanner`, caso de uso `scanReport`, fakes. Desenho da Fase 2 em `docs/design/fase2-ai-layer.md`.
- **riskScorer + endurecimento das regras (12/11):** commit `70e8efd` (revisão opus pegou regressão de privacidade — telefones após "from/to" e datas antes de "the" — corrigida com testes).
- **Fase 1 (12–13/11):** commit `eadc293`. Hosting no ar: https://traceless-92f85.web.app (CSP, Referrer-Policy, Permissions-Policy e cache verificados com curl). Regras deny-all + índices no Firestore; Remote Config template versão 1. Emuladores com `npm run emulators`. **App Check enforced no AI Logic** (13/11: chamada sem token → HTTP 401).
- **Núcleo de detecção (12/11):** commit `e4f223f` (2 rodadas de revisão).
- Repositório privado no GitHub: https://github.com/GabrielNegreiro28/traceless (`main` sincronizado a cada commit; CI do GitHub verde).
- **Fase 0 (12/11):** commit `50e082f`. TypeScript fixado em 6.0.3 (typescript-eslint 8.72.2 não suporta TS 7).
- Pesquisa, ideia (Traceless) e plano aprovados — ver `HACKATHON.md` e `PLANO.md`.
- Máquina do participante verificada: Gemini Nano disponível (`LanguageModel.availability()` → `'available'`).
- Estrutura de agentes: `.claude/agents/` (fable-advisor, implementer, reviewer), `.claude/manager/PROTOCOL.md`.

## Em andamento
- **Fase 3 núcleo commitado** (`a46f044`, 817 testes; 2 rodadas de revisão adversarial): rewriteApplier, propagação de decisões, approveReport (bloqueia identificador direto não decidido, mutilado ou digitado), reducer do fluxo com outbox. Pendências menores para a tarefa de UI: scanId ausente em runtime = stale; APPROVE_OK conferir texto = preview; cancelar scan; CONSENT_REQUIRED com scanId; removalJoin com aspas raras.
- **T1 commitado** (`f60ae34`, 835 testes): registro de variantes, Dev matrix, eval-inspect, critérios novos do portão (revisado; as 3 travas intactas).
- **Fase 3 base de UI commitada** (`68f1584`, 1118 testes, revisão opus aprovada): tokens + teste de contraste, kit `src/ui`, AppShell, rotas `/`, `/report`, `/case`, ServicesProvider/useServices, lucide-react 1.60.0.
- **Fase 3 parte A commitada** (1272 testes; revisão opus, 1 rodada de correção): Compose (limite 6.000, exemplo inventado em Brackenford), Scanning com cancelamento real (`isCancelled` até `scanChunks`, AppError `Cancelled`), etapa "Prepare private AI" (`needsPrepare`; prepare() no clique), `ScanningState.mode` (on-device/consentedCloud), bootstrap.ts. 
- **Fase 3 parte B commitada** (1348 testes; revisão opus, 1 rodada): tela de Review — texto destacado, cartões Accept/Edit/Keep/Not about me (atalhos só no cartão em foco, WCAG 2.1.4), prévia por `previewClusters` (mesma lógica do applier; estado "covered" em sobreposições), menções protegidas (só exibição), Second look, layout 360 px. Empresa fictícia: Halvern Freight. Sobras: esconder "Also applied" em card covered; passe axe + checagem 360 px em navegador real (E2E).
- **Fase 3 parte C commitada** (1426 testes; revisão opus aprovada): Outbox (prévia, regra única de confirmação `approvalCheck.ts`, trava de texto ≠ prévia `ApprovalMismatch`), ApprovedScreen (envio desabilitado até a Fase 4), registro de privacidade (port + memória, decorators no composition root; fonte vem do `inferenceSource`; modo fake = "demo scanner").
- **Sobras menores (fazer numa tarefa de limpeza):** ledger registra aprovação antes da trava de mismatch; badge "Checked on your device" fixo (derivar da fonte antes do scan na nuvem); regex ESLint de approveReport sem extensão; teste de que `fakeScanner` é ignorado em modo real; dividir reportFlowMachine/Review tests; FindingCard diz "On-device AI" mesmo no modo demo.
- **Próximo (§G do desenho):** (1) recuperação de travamento + padrão v2-single2; (2) pacote de regras de 1ª pessoa; (3) pedir dev ×3 ao participante; (4) teste ×3 uma vez.
- **T2 commitado** (13/11, 1024 testes; implementer opus + 2 rodadas de revisão opus): identityScan.v2 (rótulos REPORTED_PERSON/OTHER_PERSON → menções protegidas + filtro de 3ª pessoa; nunca suprime REGRA nem 1ª pessoa), single2, regra de assinatura (`signOffRule.ts`), 3 few-shots inventados (checagem lexical e semântica contra o split de teste), sobras do T1. Variantes: v1-single, v2-single, v2-grouped2, v2-single2. Padrão do produto continua v1/single até o portão. Limitações conhecidas documentadas no §B.3 do desenho (sobrenome/primeiro nome compartilhado com o acusado).
- **Tarefa 2** (`9f50798`) + **endurecimento** (`94b7cfe`): camada on-device fail-closed; revisão adversarial com sonda no SDK real; teste de contrato verificado por mutações.
- **Tarefas 3+4 commitadas** (`e51d2ee`, 491 testes): métricas + portão (refinado após revisão adversarial: pooled, strictRecallAll, falhas de scan, achados gigantes) e dataset de 24 relatos (88 gold, 150 must-not; revisado e corrigido).
- **Tarefa 5 commitada** (`f752b72`, 533 testes): página `/eval` só em dev (canário confirma ausência no build), plugin que salva em `eval/results/` (só mesma origem; testado: POST de outra origem → 403), fila on-device compartilhada entre estratégias. Servidor de dev testado: `/eval` responde 200.

## Próximos passos
1. **Passo humano (HUMAN_TODO):** Dev matrix no Chrome (14/11) → manager escolhe a variante pelas regras do §E do desenho → split de teste ×3 **uma única vez** (15/11) → portão com o Fable.
2. Enquanto espera: Fase 3 UI (tela de revisão do denunciante) sobre o núcleo já commitado, usando o FakeIdentityScanner.
6. Nota para a Fase 8: HACKATHON.md, PLANO.md e docs/progress estão em português e contêm detalhes pessoais (máquina, nome). Decidir antes de tornar o repo público se ficam ou vão para fora do repo.

## Firebase
- **Console pronto (12/11, verificado):** Auth (Anonymous e Email/Password), Firestore `(default)` em nam5 (Standard/Native), Remote Config ativo, debug token `dev-laptop` registrado.
- **App Check:** `ReCaptchaEnterpriseProvider`; chave Web (pública) **`6LdToB0uAAAAAABzcCtn3w5sysp8c74sIwBeq-cr`** em `.env.local` (`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`). **Enforced no AI Logic** (13/11). Firestore: enforce no portão da Fase 4 (e antes de tornar o repo público). Debug token em `.env.development.local` (git-ignored).
- **ID do projeto:** `traceless-92f85` (`.firebaserc` default). Domínios: `traceless-92f85.web.app`, `traceless-92f85.firebaseapp.com`.
- **Configuração pública do app Web** (não é segredo; está em `.env.local` como `VITE_FIREBASE_*`):
  - apiKey `AIzaSyBNxXIwy4NMJzF_IRkgDUXMNWp35SZ19CI`
  - authDomain `traceless-92f85.firebaseapp.com`
  - projectId `traceless-92f85`
  - storageBucket `traceless-92f85.firebasestorage.app`
  - messagingSenderId `689455220067`
  - appId `1:689455220067:web:3e46a511d37ea61948bf56`
  - (também recuperável com `npx firebase apps:sdkconfig WEB --project traceless-92f85`)

## Ambiente / versões
- GitHub CLI 2.104.0 (`C:\Program Files\GitHub CLI\gh.exe`).
- Node 24.20.0 · npm 12.2.1 · Git 2.53 · JDK 21 (Temurin 21.0.13, `JAVA_HOME` primeiro no PATH) · Chrome 157.
- Dependências fixadas (exatas): firebase 13.3.0 · react 19.3.1 · react-router 8.5.1 · zod 4.6.7 · vite 8.3.8 · vitest 5.1.0 · typescript 6.0.3 · typescript-eslint 8.72.2 · eslint 10.14.0 · tailwindcss 4.3.5 · firebase-tools 15.36.0.
- npm 12 bloqueia scripts de instalação de dependências (re2, protobufjs, @firebase/util postinstall) — sem impacto.

## Métricas
- Testes: 1024 (13/11).
- **1ª avaliação real (13/11, identityScan.v1, single, teste 16×3, pooled):** strictRecallAll **0,604** (meta ≥ 0,70) · violações ACCUSED **0,632** (meta ≤ 0,05; todas do modelo) · INCIDENT_FACT 0,091 (passa, instável) · OTHER_PERSON 0,267 · precisão 0,387 · acurácia de categoria 0,724 · aspas inventadas 0,083 · falhas 0 · saída inválida 0 · latência p50 ~7,1 s / máx ~19,3 s por relato. **Portão: REPROVADO** (recall e ACCUSED). Latência baixa deixa margem para mais inferência por relato.

## Riscos
- Qualidade do Gemini Nano na detecção (portão da Fase 2), especialmente marcar o nome do acusado.
- Latência no aparelho "Medium" (estimativa não medida: 15–40 s por relato curto).
- SDK firebase 13.3.0: `ONLY_ON_DEVICE` cai para a nuvem sem `window.LanguageModel` (mitigado pelas três camadas fail-closed da tarefa 2).
