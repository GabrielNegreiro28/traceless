# Registro de decisões

_Formato: data · pergunta · opções · recomendação (quem) · decisão final. Decisões arquiteturais também viram ADR em `docs/adr/`._

## 2026-11-12 · Decisões de base (antes do loop autônomo)
- **Ideia:** Traceless — detecção no aparelho de detalhes que identificam quem denuncia (aprovado pelo participante).
- **Nome:** "Traceless" (escolhido no lugar de "Unseen", que tem marca pendente nos EUA na classe de software).
- **Plataforma:** Web/Chrome desktop; produto em inglês (o Nano não suporta português).
- **Arquitetura:** hexagonal (ports & adapters), branded types `RawText`/`SanitizedText`, política de inferência centralizada — ver `PLANO.md`.
- **Organização dos agentes:** manager (sessão principal em loop) + `fable-advisor` (Fable 5.2) + `implementer` + `reviewer`; implementadores em série no mesmo diretório (sem paralelismo de escrita).
- **Repositório GitHub:** criado PRIVADO; tornar público é passo humano no final.

## 2026-11-12 · Provedor do App Check
- **Pergunta:** reCAPTCHA v3 (planejado) ou reCAPTCHA Enterprise?
- **Fato novo:** o console do reCAPTCHA clássico mostra "O reCAPTCHA Clássico foi descontinuado. Use o Google Cloud Fraud Defense". A documentação do Firebase recomenda o Enterprise para integrações novas; o plano Spark tem 10 mil verificações grátis por mês, sem exigir faturamento.
- **Decisão:** `ReCaptchaEnterpriseProvider` com chave Web baseada em pontuação criada em console.cloud.google.com/security/recaptcha. Domínios: `traceless-92f85.web.app`, `traceless-92f85.firebaseapp.com` (sem localhost; em dev usar o debug provider).

## 2026-11-12 · Fase 1: design da integração Firebase (consulta ao Fable)
- **Perguntas:** como tratar o debug token do App Check; quando aplicar o enforce; CSP; cache persistente do Firestore x modelo de ameaça; escopo e modelo do implementer.
- **Recomendação (Fable) → decisão (manager): aceita integralmente.**
  - **Debug token:** UUID fixo em `.env.development.local` (git-ignored; Vite só carrega em dev). O participante registra uma vez no Console. Leitura de env só em `src/app/env.ts`, variável por variável (nunca o objeto `import.meta.env` inteiro), `parseEnv` puro com `Result` + novo `AppError` `Misconfigured { missing }`. ESLint permite `import.meta.env` em um único arquivo. Script canário `scripts/verify-no-debug-token.mjs` no `npm run ci` garante que o token nunca vai para o `dist`. CI/E2E (`VITE_AI_MODE=fake` + emuladores) não inicializa App Check.
  - **Enforce:** a doc oficial diz que o App Check é obrigatório no AI Logic desde 02/11/2026 e aplicado automaticamente em projetos novos → assumir que já está enforced; participante confirma no Console. Firestore: enforce no portão da Fase 4 (e sempre antes de tornar o repo público). Auth: sem App Check (exigiria Identity Platform). Fase 2: `useLimitedUseAppCheckTokens: true` no `getAI`.
  - **CSP aplicada (não report-only) desde já**, com allowlist explícita de hosts (Firebase AI, App Check, Auth, Firestore, Installations, Remote Config, reCAPTCHA); `Referrer-Policy: no-referrer` (a chave do caso não pode vazar); `Permissions-Policy` sem listar `language-model` (senão desliga o Gemini Nano); checar o console por violações de CSP após cada deploy.
  - **Sem armazenamento persistente no cliente (desvio do PLANO §2 "cache persistente"):** Firestore com `memoryLocalCache()`, Auth com `inMemoryPersistence`. Motivo: computador compartilhado/de trabalho; texto, mensagens e chave do caso não podem ficar no IndexedDB. Trade-off: envio offline sobrevive só com a aba aberta (banner "keep this tab open" + aviso `beforeunload`). Vira ADR 0005. Textos públicos devem dizer "no report content, case key or identity is stored on this device", não "nothing is stored".
  - **Escopo:** inits idempotentes sem efeito colateral no import; emuladores com projeto `demo-traceless` em `127.0.0.1`; scripts `deploy:hosting`/`deploy:rules`/`deploy:config`/`deploy`; regras deny-all; template do Remote Config + `remoteConfigDefaults.ts` com teste de divergência; sem smoke call, sem preview channels. Modelo: **opus**; reviewer checa token, CSP e Permissions-Policy.

## 2026-11-12 · Núcleo de detecção: trade-offs aceitos (revisão opus, 2 rodadas)
- Limite de palavra estilo `\b`: só checado no lado em que a citação começa/termina com letra ou dígito (`#4471` casa após letra).
- Não detectados pelas regras (o modelo é o backstop): datas com ponto e ano de 2 dígitos (`14.03.26`), `Staff ABC 1234`, "March 2026", "may 5" minúsculo, "In May 12 people quit" (falso positivo documentado em teste).
- Pendências menores para a próxima tarefa de domínio: chunks só com espaço via NBSP; clamp de `maxChars` NaN/≤0 deve cair no tamanho padrão (não em 2); faixas numéricas (`300-4000`) e frações após gatilho (`on 3/4 of`) ainda são marcadas.

## 2026-11-12 · Fase 2: estratégia de detecção on-device e harness de avaliação (consulta ao Fable)
- **Achado crítico (verificado no código do SDK firebase 13.3.0):** se `window.LanguageModel` não existe, `ONLY_ON_DEVICE` chama a NUVEM silenciosamente. **Decisão:** três camadas fail-closed para dados RAW (guarda na factory antes de criar o modelo; `baseUrl` morto `https://on-device-only.invalid`; descarte se `inferenceSource !== 'on_device'`). Fila serial única para chamadas on-device. Exigir `available` antes de chamar (evita download sem gesto).
- **Prompt:** um prompt v1 parametrizado por grupo de categorias; estratégia `single` por padrão, `grouped2` só se ganhar ≥ ~8 pontos de recall. System prompt + 2 few-shots em `initialPrompts`. Sem temperature/topK (não existem na API). Chunks de 3.000 caracteres para o modelo; regras no texto inteiro. `WRITING_STYLE` fora do enum do modelo.
- **Schema:** um JSON Schema compartilhado device/nuvem + zod com salvamento por item.
- **Portão da Fase 2 (split de teste, média de 3 execuções):** recall combinado ≥ 0,70; violações ACCUSED ≤ 0,05; INCIDENT_FACT ≤ 0,10; saída inválida ≤ 0,05.
- **Desenho completo:** `docs/design/fase2-ai-layer.md`. Sequência de 7 tarefas; a execução real do `/eval` é passo humano (meta 14/11 à noite; portão 15/11).
- **Decisão do manager:** aceita integralmente. `riskScorer` já foi feito (fica para uso na Fase 3).

## 2026-11-13 · App Check enforced no AI Logic com replay protection
- O participante aplicou o enforce no Console com **proteção contra repetição** ligada. Verificado: sem token → 401; token normal → 401; token limited-use → 200; reuso do mesmo token → 401.
- **Consequência obrigatória para a Fase 2:** `getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })` deixa de ser só recomendação: sem isso, toda chamada à nuvem falha com 401. Cada chamada consome um token novo (uma troca extra com o App Check por chamada); aceitável no volume do app.
