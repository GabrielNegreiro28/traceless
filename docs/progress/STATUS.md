# STATUS — Traceless

_Atualizado pelo manager a cada iteração._

- **Data da última atualização:** 2026-11-12
- **Fase atual:** Fase 0 — Fundação do repositório (em andamento)
- **Prazo:** **2026-11-30 às 19:00 GMT-3** (horário de Brasília). Rascunho completo até 28/11; congelamento de funcionalidades em 25/11; submeter com folga, nunca na última hora.

## Concluído
- Pesquisa, ideia (Traceless) e plano aprovados — ver `HACKATHON.md` e `PLANO.md`.
- Máquina do participante verificada: Gemini Nano disponível (`LanguageModel.availability()` → `'available'`).
- Estrutura de agentes criada: `.claude/agents/` (fable-advisor, implementer, reviewer), `.claude/manager/PROTOCOL.md`, `.claude/settings.json`.

## Em andamento
- `git init -b main` feito (12/11). Repo GitHub `traceless` ainda NÃO existe (verificado com `gh repo list`); criar como PRIVADO no primeiro push.
- Implementer (opus) executando o scaffold da Fase 0 (Vite/React/TS, ESLint de fronteiras, Vitest, Husky, CI, LICENSE, `.env.example`/`.env.local`, `result`/`appError`/`logger`/`brandedText`).

## Próximos passos
1. Fase 0: `git init`, Vite + React + TS strict, Tailwind, ESLint (fronteiras), Prettier, Husky, commitlint, Vitest, `.nvmrc`, `.npmrc`, `.env.example`, LICENSE Apache-2.0, esqueleto de pastas, README inicial, CI.
2. Atualizar `CLAUDE.md` com as regras de engenharia (PLANO §1) — já feito no setup; manter atualizado.

## Firebase
- **ID do projeto Firebase:** `traceless-92f85` (criado pelo participante em 12/11). Usar em `.firebaserc` (`default`).
- Domínios de produção: `traceless-92f85.web.app` e `traceless-92f85.firebaseapp.com` (para a chave do reCAPTCHA Enterprise).
- **App Check:** usar `ReCaptchaEnterpriseProvider` (o reCAPTCHA clássico/v3 foi descontinuado em favor do Google Cloud Fraud Defense). Chave Web (baseada em pontuação, sem checkbox) criada pelo participante em 12/11: **`6LdToB0uAAAAAABzcCtn3w5sysp8c74sIwBeq-cr`** (pública; vai em `.env.local` como `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` e o nome da variável é documentado em `.env.example`). **Não aplicar (enforce) até o manager decidir.** Confirmar com o participante se ela já foi registrada no Firebase (App Check → Apps → traceless-web → reCAPTCHA Enterprise).
- **App Web registrado** (12/11). Configuração pública do Firebase (não é segredo; identifica o projeto). Colocar em `.env.local` como `VITE_FIREBASE_*` e documentar os nomes em `.env.example`:
  - apiKey `AIzaSyBNxXIwy4NMJzF_IRkgDUXMNWp35SZ19CI`
  - authDomain `traceless-92f85.firebaseapp.com`
  - projectId `traceless-92f85`
  - storageBucket `traceless-92f85.firebasestorage.app`
  - messagingSenderId `689455220067`
  - appId `1:689455220067:web:3e46a511d37ea61948bf56`
  - (também recuperável com `npx firebase apps:sdkconfig WEB --project traceless-92f85`)

## Ambiente / versões
- GitHub CLI 2.104.0 instalado em 12/11 (`C:\Program Files\GitHub CLI\gh.exe`).
- Node 24.20.0 · npm 12.2.1 · Git 2.53 · **JDK 21 (Temurin 21.0.13) instalado em 12/11**, `JAVA_HOME` definido e primeiro no PATH (o Java 1.8 continua instalado, mas fica atrás) · Chrome 157
- npm latest em 12/11: firebase 13.3.0 · vite 8.3.8 · vitest 5.1.0 · firebase-tools 15.36.0 · typescript 7.0.2 (checar compatibilidade com typescript-eslint)

## Métricas
- Avaliação de detecção (Fase 2): ainda não medida.

## Riscos
- Qualidade do Gemini Nano na detecção de quasi-identificadores (portão da Fase 2).
- Passos humanos no Console do Firebase podem atrasar Fases 1/4/5.
