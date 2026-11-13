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
- **Tarefa 2 commitada** (`9f50798`, 416 testes): camada on-device fail-closed. Revisão adversarial (opus) com sonda no SDK real: nenhum caminho do texto bruto para a rede em produção; a CSP também bloqueia `*.invalid`.
- **Endurecimento commitado** (`94b7cfe`, 447 testes; teste de contrato com o SDK real verificado por mutações).
- Em paralelo: tarefa 3 (sonnet, métricas + `evaluateDetection`) e tarefa 4 (opus, dataset de 24 relatos — só conteúdo em `eval/datasets/`).

## Próximos passos
1. Revisar/commitar o endurecimento.
2. Tarefa 3 (sonnet): métricas de avaliação, schema zod do dataset, `evaluateDetection`.
3. Tarefa 4 (opus): dataset de 24 relatos sintéticos + teste de validação (disjunto dos few-shots: farmacêutico da Elm Street / Dana Ruiz; faturas do irmão do diretor financeiro).
4. Tarefa 5 (sonnet): router, `devRoutes`, `EvalPage`, plugin Vite que salva resultados, canário `verify-no-eval-in-dist`.
5. Passo humano: rodar `/eval` no Chrome (meta 14/11 à noite) → portão das Fases 1+2 com o Fable (15/11).
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
- Testes: 325 (13/11). Cobertura do domínio de detecção ~99% statements.
- Avaliação de detecção (Fase 2): ainda não medida. Portão: recall combinado ≥ 0,70; violações ACCUSED ≤ 0,05; INCIDENT_FACT ≤ 0,10; saída inválida ≤ 0,05.

## Riscos
- Qualidade do Gemini Nano na detecção (portão da Fase 2), especialmente marcar o nome do acusado.
- Latência no aparelho "Medium" (estimativa não medida: 15–40 s por relato curto).
- SDK firebase 13.3.0: `ONLY_ON_DEVICE` cai para a nuvem sem `window.LanguageModel` (mitigado pelas três camadas fail-closed da tarefa 2).
