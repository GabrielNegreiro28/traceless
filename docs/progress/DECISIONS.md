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
