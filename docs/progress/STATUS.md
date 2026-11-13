# STATUS — Traceless

_Atualizado pelo manager a cada iteração._

- **Data da última atualização:** 2026-11-12
- **Fase atual:** Fase 0 concluída localmente (commit 50e082f); Fase 1 (código Firebase) em preparação
- **Prazo:** **2026-11-30 às 19:00 GMT-3** (horário de Brasília). Rascunho completo até 28/11; congelamento de funcionalidades em 25/11; submeter com folga, nunca na última hora.

## Concluído
- **Fase 0 (12/11):** scaffold revisado e aprovado pelo reviewer; `npm run ci` verde (34 testes); commit `50e082f`. TypeScript fixado em 6.0.3 (typescript-eslint 8.72.2 não suporta TS 7).
- Pesquisa, ideia (Traceless) e plano aprovados — ver `HACKATHON.md` e `PLANO.md`.
- Máquina do participante verificada: Gemini Nano disponível (`LanguageModel.availability()` → `'available'`).
- Estrutura de agentes criada: `.claude/agents/` (fable-advisor, implementer, reviewer), `.claude/manager/PROTOCOL.md`, `.claude/settings.json`.

## Em andamento
- Repositório privado no GitHub criado e `main` enviado (12/11): https://github.com/GabrielNegreiro28/traceless
- Correções da revisão da Fase 0 commitadas (`9d5ca1f`).
- **Núcleo de detecção commitado** (`e4f223f`, 202 testes) após 2 rodadas de revisão.
- Implementer (opus): código da Fase 1 (Firebase) conforme DECISIONS 12/11.
- Fable consultado sobre a Fase 1 → decisões em DECISIONS.md (12/11, "Fase 1: design da integração Firebase"). Debug token gerado em `.env.development.local` (git-ignored). **Próximo implementer (opus) = código da Fase 1 conforme essa entrada**, depois do implementer de domínio terminar.

## Próximos passos
1. Commitar as correções da revisão da Fase 0.
2. Fase 1 (código): `firebase.json`, `.firebaserc`, `firebase/*` (regras deny-all, índices, template do Remote Config), `src/infrastructure/firebase/*`, env tipado, scripts `emulators`/`deploy`; aplicar as recomendações do Fable.
3. Fase 2 (domínio de detecção) pode começar em paralelo à espera dos passos humanos do Console.
4. Nota para a Fase 8: HACKATHON.md, PLANO.md e docs/progress estão em português e contêm detalhes pessoais (máquina, nome). Decidir antes de tornar o repo público se ficam ou vão para fora do repo.

## Firebase
- **Console pronto (12/11, verificado):** Auth (Anonymous e Email/Password), Firestore `(default)` em nam5 (Standard/Native), Remote Config ativo, debug token `dev-laptop` registrado (troca → OK; AI Logic com token → 200).
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
- App Check ainda NÃO está enforced no Firebase AI Logic (verificado em 12/11: uma chamada sem token foi aceita). Console (aba APIs): "Básico: não aplicado", data de aplicação automática **21/01/2027** (depois do prazo, então o enforce tem que ser manual), proteção contra repetição desativada; métricas de 12/11: 1 chamada verificada e 1 sem verificação (os dois testes do manager). Obrigatório antes da submissão; aplicar depois que o app enviar tokens (Fase 1) e testar o debug token.
