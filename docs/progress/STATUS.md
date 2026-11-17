# STATUS — Traceless

_Atualizado pelo manager a cada iteração._

- **Data da última atualização:** 2026-11-17
- **AGORA (17/11): melhoria da detecção baseada em pesquisa** (plano aprovado pelo participante: `C:\Users\Gabriel\.claude\plans\zippy-floating-parasol.md`; resumo e pré-registro em DECISIONS 17/11). ✅ split de teste novo cego `eval/datasets/reports.v2.test.json` (`511f3bb`, SHA-256 registrado). ✅ Camada 2 (`00e7c3f`, candidatos gramaticais com compromise 14.20.0; recall de candidatos 0,966 no pool de dev, 9 por relato). ✅ Camada 3 (`bcf0cd8` + `910b6fe`: verificador Nano `disclosureVerify` + passe `identityScan.v3-investigator`, ambos RAW/only_on_device; revisão opus aprovada; presets 7 e 8 no /eval, o 8 exige digitar o id da variante). Produto ainda usa `v2-single2-rules`. ✅ Rodada 3 (`abc061a`) → escolhida `v3-verifier+investigator` com desvio registrado (`eef814f`). ✅ **Teste v2 uma vez (`0b6e89e`): recall estrito 0,709, ACCUSED 0,072 (faixa condicional), INCIDENT 0,070, precisão 0,662, p50 14,3 s / máx 36,0 s → GO CONDICIONAL.** Referência `v2-single2-rules` perdida (OnDeviceStuck terminal; opcional rodar de novo). ✅ Produto usa `v3-verifier+investigator` (`23c5f23`, revisão opus aprovada, 2261 testes, e2e 6/6). ✅ Publicado e testado pelo participante com Nano (17/11), depois da correção `665f14b` (sugestão do investigador para a assinatura criava nova assinatura e bloqueava a aprovação). Próximo: tarefa 5 do plano enxuto (README com a história da avaliação, diagrama, Devpost, roteiro do vídeo, auditoria do Fable). Sobras menores (revisão 17/11): teste síncrono do prepare; `ScanGroups` exportado sem uso; total de passos que diminui no progresso.
- **Plano ENXUTO (escolhido pelo participante em 16/11; ver DECISIONS.md):** faltam 5 tarefas:
  1. ✅ Modo nuvem com consentimento + checagem básica + passos para ativar o modo local (commits `79a14bd`…`8b2eadc`, 1876 testes, revisão opus + 1 rodada).
  2. ✅ Detecção congelada (`b065f9c`): `v2-single2-rules` no produto, Second look obrigatório, textos honestos.
  3. ⏳ Fase 4: ✅ envio + chave do caso + /case + regras com testes no emulador (`9ec25f3`…`6071748`, 2008 testes + 31 de regras; revisão opus + 1 rodada). ⏳ `structureReport` híbrido (implementer opus em andamento).
  4. ✅ Polimento (`c04c61d`) + deploy (16/11: regras, Remote Config e hosting publicados pelo participante; envio real → chave → /case verificado à mão no site). ⏳ Bugs do teste no navegador (texto reescrito quebrado, assinatura, cartões duplicados, risco que não cai, retry de 5xx), implementer opus em andamento. Depois: commit + `deploy:hosting` de novo.
  - Teste E2E: Playwright 1.65.1 instalado (devDependency; o roteiro de teste está em `node_modules/.walk.mjs`, não versionado). No headless, o App Check com reCAPTCHA dá 403 (esperado com robôs).
  5. README, diagrama, Devpost, roteiro do vídeo + auditoria do Fable. **Adiado pelo participante (16/11): foco no MVP primeiro.** Teste E2E com Playwright pronto (`610fb56`, 6/6, job no CI verde).
  - Cortado (roadmap): rights advisor, UI de quem investiga, triageCase, respostas ao denunciante.
- **PRÓXIMO PASSO (pedido do participante em 16/11, para 17/11): melhorar a detecção até recall estrito ≥ 0,70.** Hoje: 0,604 no split de teste (b065f9c). Plano a seguir:
  1. **Integridade antes de tudo (consultar o Fable primeiro):** o split de teste já foi usado na rodada final. Medir de novo nele seria reaproveitar dados vistos. Proposta: criar `reports.v2` com um **novo split de teste** inventado (≥ 16 relatos, gold escrito antes de rodar), usar o dev antigo + o teste antigo como dev, pré-registrar os limiares em DECISIONS e rodar o novo teste **uma vez**. O README mostra as duas medições.
  2. **Onde está a perda** (recall por categoria no teste final, em `eval/results/v2-single2-rules-test-*.json`): datas pessoais ~0,43, local ~0,58, função única ~0,56, turno ~0,71. Começar com `npm run eval:inspect` (ou a página /eval) sobre o dev para listar os erros por família.
  3. **Alavancas, da mais barata para a mais cara**, sempre on-device (o texto bruto nunca vai para a nuvem sem consentimento):
     - regras determinísticas novas para datas pessoais ("my birthday", "the day after my surgery", "when I came back from leave…"), lugares de 1ª pessoa ("my desk/station/bay…", "the [X] floor") e funções ("the only/one of two [role]");
     - medir de novo o efeito das correções pós-portão (`1a43719`: intervalo de turno, assinatura, junção de sobreposições) só no dev;
     - passada extra focada nas categorias fracas (estilo single3 só para DATE/LOCATION/ROLE), com latência máx ≤ 50 s no aparelho Medium;
     - few-shots novos só com exemplos do dev.
  4. **Guardas que não podem piorar:** ACCUSED ≤ 0,05, INCIDENT_FACT ≤ 0,10, precisão ≥ 0,35 (hoje 0,656), p50 ≤ 20 s, máx ≤ 60 s.
  5. **Custo:** implementer opus nas regras e no prompt, reviewer opus; o participante roda o dev ×3 e depois o novo teste ×3 uma única vez no Chrome.
- **MVP verificado (16/11):** bugs do teste no navegador corrigidos (`1a43719`, 2135 testes), hosting publicado de novo; o participante testou no Chrome com Nano: análise no aparelho → organizar → enviar → chave → /case, "tudo certo".
- **Portão da Fase 2 (16/11): SHIP WITH DISCLOSED MISS.** Teste ×3 `v2-single2-rules`: recall estrito 0,604 (meta 0,70), ACCUSED 0,046, INCIDENT 0,030, precisão 0,656, p50 10,2 s / máx 36,7 s. Detecção congelada.
- **Prazo:** **2026-11-30 às 19:00 GMT-3**. Rascunho até 28/11; congelamento em 25/11.

## Histórico (detalhes)
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
- **§G.1 + §G.2 commitados** (1473 testes; revisão adversarial opus aprovada): padrão do produto = v2-single2 (`scanPipelines.ts`, mesma definição da variante de eval); recuperação de travamento (AbortController por modelo verificado no SDK 3.1.0, `abandon()`, 5 s de carência, limite 2, terminal fixo), UI "Try again" / "Continue with basic checks" (scan só regras, ledger `rules`) / "Copy my text and reload"; eval registra `stalls`. Falta confirmar no Chrome real que o abort encerra a sessão.
- **Sobras menores do pacote de regras:** `clauseStart` quadrático em cláusula sem pontuação (desprezível a 6.000 caracteres); achado renomeado RULE mostra o selo "Rules" com texto do modelo; `firstPersonFamilies.ts` com 197 linhas.
- **Sobras desta tarefa:** chamadas na janela de 5 s recebem erro terminal; chamada enfileirada atrás de travamento terminal espera sem prazo; modo basic com 0 achados mostra risco NONE (decidir: exigir confirmação no Outbox quando `checks === 'basic'`).
- **§G.3 + §G.4 commitados (14/11, 1663 testes; revisão opus + 1 rodada de correção):** pacote de regras de 1ª pessoa (`firstPerson*.ts`, `rulePacks.ts`, 6 famílias, fala citada rejeitada), `STRATEGIES.single3`, variantes `v2-single2-rules` e `v2-single3-rules`, preset "Round 2" no /eval. Correção de privacidade no `directIdentifiers` (DIRECT_IDENTIFIER renomeado RULE pelo merger voltou a bloquear). Padrão do produto e basic checks continuam com o pacote `core`. Recall só-regras no dev: 0,114 → 0,257, sem alarme falso.
- **Próximo (§G):** (3) participante roda o preset Round 2 (dev ×3) → manager escolhe a variante pelo §G.4 → (4) teste ×3 uma única vez → portão com o Fable. Enquanto isso: deploy v0.1 + caminho sem Nano (scan na nuvem com consentimento; implementer opus em andamento, 14/11).
- **Round 2 roda numa worktree congelada** em `bb60625` (scratchpad da sessão, `eval-wt`, servidor vite na porta 5173 em segundo plano). Os resultados ficam em `eval-wt/eval/results/`; o manager copia para `eval/results/` do repositório e commita. Se a sessão cair: `git worktree list` mostra o caminho; religar com `npx vite --port 5173 --strictPort` dentro dele.
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
- Testes: 1663 (14/11).
- **1ª avaliação real (13/11, identityScan.v1, single, teste 16×3, pooled):** strictRecallAll **0,604** (meta ≥ 0,70) · violações ACCUSED **0,632** (meta ≤ 0,05; todas do modelo) · INCIDENT_FACT 0,091 (passa, instável) · OTHER_PERSON 0,267 · precisão 0,387 · acurácia de categoria 0,724 · aspas inventadas 0,083 · falhas 0 · saída inválida 0 · latência p50 ~7,1 s / máx ~19,3 s por relato. **Portão: REPROVADO** (recall e ACCUSED). Latência baixa deixa margem para mais inferência por relato.

## Riscos
- Qualidade do Gemini Nano na detecção (portão da Fase 2), especialmente marcar o nome do acusado.
- Latência no aparelho "Medium" (estimativa não medida: 15–40 s por relato curto).
- SDK firebase 13.3.0: `ONLY_ON_DEVICE` cai para a nuvem sem `window.LanguageModel` (mitigado pelas três camadas fail-closed da tarefa 2).
