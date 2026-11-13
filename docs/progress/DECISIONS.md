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

## 2026-11-13 · Paralelismo excepcional: dataset de avaliação
- **Desvio do PROTOCOL §4.5 (um implementer por vez):** a tarefa 4 (dataset `eval/datasets/reports.v1.json`) roda em paralelo à tarefa 3 (métricas, código), porque é só conteúdo, restrita a `eval/datasets/`, sem rodar CI e sem tocar em `src/`. Motivo: cumprir a meta de avaliação no Chrome em 14/11. O teste de validação do dataset entra depois, junto com a tarefa 5.

## 2026-11-13 · Refinamento do portão da Fase 2 (revisão adversarial das métricas)
- **Problema:** com as métricas iniciais, um modelo que falha muito (scans excluídos dos denominadores) ou que cita frases inteiras (achados gigantes) passaria no portão.
- **Decisão (manager, a partir da recomendação do reviewer opus; Fable revisa no portão):** veredito sobre taxas **agregadas (pooled) nas 3 execuções**, com média/mín/máx e a pior execução exibidas (`unstable` se a pior estourar). Critérios no split de teste: `strictRecallAll` ≥ 0,70 (achados gigantes não contam; scans que falharam contam como perdidos); ACCUSED ≤ 0,05; INCIDENT_FACT ≤ 0,10; saída inválida ≤ 0,05; **falha de scan ≤ 0,05**; **achados gigantes ≤ 0,25**. Atribuição de origem (regra/modelo) calculada antes da junção dos achados.

## 2026-11-13 · /eval: avaliação completa por estratégia
- **Desvio do desenho §4 ("full = todas as estratégias ×3"):** o botão "Full" roda só a estratégia selecionada. Motivo: no aparelho Medium, `grouped2` leva cerca de 2× mais tempo. O desenho §1 já diz para lançar com `single` e testar `grouped2` só se o recall ficar abaixo da meta. O guia do participante segue essa ordem.

## 2026-11-13 · Plano de produto da Fase 3+ (consulta ao Fable)
- **Decisão (manager): aceito.** Fonte da verdade: `docs/design/fase3-product-plan.md`.
- **Revisão:** decisões por achado ACCEPTED/EDITED/KEPT_RISK/NOT_ABOUT_ME; sem "Accept all"; "Not about me" se propaga para o mesmo texto; approveReport bloqueia só identificador direto **não decidido** (o e-mail do acusado pode ser evidência).
- **Jurados sem Nano:** construir (b) scan na nuvem **com consentimento explícito** (ConsentedRawText, port separado, kill switch no Remote Config), (c) instruções e (a) só regras. **Sem modo demo pré-gravado** (simularia o núcleo). A landing não afirma processamento local incondicional.
- **Desvios do PLANO:** sem PWA/service worker; sem envio em fila offline (Auth e App Check precisam de rede; ADR 0005 já limitava à aba aberta). Envio offline mostra "Reconnect to send".
- **Nuvem:** `structureReport` (PREFER_ON_DEVICE sobre SanitizedText) é a demonstração principal de "só texto limpo vai para a nuvem". Grounding/rights advisor rebaixado para spike de 1 h em 19/11 (grounding parece indisponível no plano grátis para Gemini 3+ e conflita com a CSP); alternativa: painel estático "Your rights" com fontes. Handler mínimo + `triageCase`.
- **Ordem de corte se atrasar:** rights advisor → respostas do denunciante → triageCase → opção (a) → UI do handler → structureReport. Nunca cortar: fluxo do denunciante, (b), envio + chave do caso, polimento, vídeo.

## 2026-11-13 · Portão da Fase 2, 1ª rodada: REPROVADO → ITERAR (consulta ao Fable)
- **Resultado v1 (teste 16×3):** recall estrito 0,604; ACCUSED 0,632; infraestrutura impecável (0 falhas, p50 ~7 s).
- **Diagnóstico:** o Nano tipa entidades, mas não atribui o sujeito (marca o título e o nome do acusado na apresentação "[cargo], [Nome]"); o recall cai porque o modelo para cedo e tem viés de posição.
- **Decisão (manager): aceito, sem relaxar metas.** Desenho em `docs/design/fase2-gate-iteration.md`:
  - identityScan.v2 com rótulos de escape REPORTED_PERSON/OTHER_PERSON, descartados pelo código e transformados em "menções protegidas" determinísticas, mais um filtro de 3ª pessoa. Nunca suprime achados de REGRA nem achados com I/me/my.
  - Segunda passada (single2 vs grouped2).
  - Regra determinística de assinatura.
  - 3 novos few-shots, só com exemplos do dev.
- **Limiares pré-registrados ANTES dos dados v2:** recall estrito ≥ 0,70; ACCUSED ≤ 0,05; INCIDENT_FACT ≤ 0,10; inválida ≤ 0,05; falhas ≤ 0,05; gigantes ≤ 0,25; **novos:** precisão ≥ 0,35, p50 ≤ 20 s, máx ≤ 60 s.
  - ACCUSED entre 0,05 e 0,15 = go condicional: confirmação por chips na UI e o número real no README.
  - ACCUSED acima de 0,15 = Plano C (checagem de sujeito em lote).
- **Integridade:** o split de teste é rodado **uma única vez** com a variante escolhida no dev (15/11). Os briefs dos implementadores usam só exemplos do dev. Os artefatos de métrica são divulgados, e o dataset de teste não é editado.
- **Rejeitado:** relaxar a meta de ACCUSED porque "dispensar é um clique" (apagar o acusado por engano prejudica o relato). Também rejeitado: tornar obrigatório o campo "quem você denuncia?" antes do scan (vira chip editável na revisão).
