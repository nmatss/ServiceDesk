# Changelog

Todas as mudancas notaveis deste projeto serao documentadas neste arquivo.

O formato e baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto segue o [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-03-19

Auditoria completa de seguranca, qualidade de codigo e acessibilidade — 35 itens em 4 tiers de prioridade.

### Seguranca (TIER 1 — Critical)
- Protecao SSRF em webhook manager: validacao de URL com bloqueio de IPs privados, localhost, metadata endpoints e requisito HTTPS em producao
- Email webhook: secret agora obrigatorio (fail-closed), retorna 500 se `EMAIL_WEBHOOK_SECRET` nao configurado
- Email webhook: validacao de tenant ID (inteiro positivo) em payloads externos
- Billing webhook: correcao de bug NaN com `parseInt` → `Number()` + `isFinite()` para org ID
- Remocao de stack traces em respostas de erro de API (prevencao de information disclosure)
- Scanner de virus em uploads de arquivo via VirusTotal API (graceful degradation quando API key nao configurada)

### Qualidade de Codigo (TIER 2 — High)
- Eliminacao de 12+ empty catch blocks silenciosos em auth/register e statuses (agora logam warnings)
- Substituicao de ~30 hardcoded role strings por constantes `ROLES.*` e helpers `isAdmin()`/`isPrivileged()` em 17 arquivos
- Migracao de ~25 rotas de API do pattern antigo `getTenantContextFromRequest` para `requireTenantUserContext()` unificado
- Validacao de input Zod em POST routes (statuses, categories) — nome max 100 chars, cor #RRGGBB
- Validacao Zod client-side em formularios de ticket e problema (titulo, descricao, prioridade)
- Subscription manager: audit logging de mudancas de plano, cancelamento e falha de pagamento
- Billing webhook: substituicao de `as any` por tipos Stripe (`Stripe.Checkout.Session`, `Stripe.Invoice`, `Stripe.Subscription`)
- SSO callback: migracao de `jsonwebtoken` para `jose` (eliminacao de duplicacao)

### Acessibilidade e UX (TIER 2-3)
- Labels `htmlFor`/`id` em filtros de problemas, CMDB e mudancas (screen readers)
- Substituicao de `div[role="button"]` por `<button>` semantico em componente OnlineUsers
- Padronizacao de respostas de erro com `apiSuccess()`/`apiError()` em rotas de auth e billing

### Infraestrutura (TIER 3-4)
- Rate limiting em 3 cron jobs (process-emails, cleanup, lgpd-retention)
- Graceful shutdown para conexao Redis (handlers SIGTERM/SIGINT)
- Substituicao de `Math.random()` por `crypto.randomUUID()` em 27 arquivos (IDs e identificadores)
- Substituicao de MD5 por SHA-256 em 3 modulos de cache/checksum
- Remocao da rota example-with-sentry do build de producao

### Removido
- `app/api/example-with-sentry/route.ts` (rota de exemplo/teste)

### Estatisticas
- **91 arquivos modificados** em 35 itens de auditoria
- **0 erros TypeScript** | **Build SUCCESS**
- **0 stack traces** em respostas de API
- **0 hardcoded role arrays** em checks de autorizacao
- **0 empty catch blocks** em rotas criticas

---

## [1.0.0] - 2026-03-16

Lancamento inicial em producao do ServiceDesk — plataforma completa de gestao de servicos de TI com suporte ITIL, multi-tenancy e conformidade LGPD.

### Adicionado

#### Core — Gestao de Tickets
- Sistema completo de tickets com criacao, edicao, comentarios e anexos
- Prioridades (low, medium, high, critical) com cores e SLA associados
- Categorias, tags e templates de tickets
- Kanban board, timeline e editor colaborativo
- Relacionamentos entre tickets (bloqueia, duplicado, relacionado)
- Seguidores e atividades com historico completo
- Operacoes em lote (bulk update) para agentes
- Armazenamento de arquivos com controle de acesso

#### Core — SLA e Escalacoes
- Politicas de SLA configuraveis por prioridade e organizacao
- Tracking de SLA em tempo real com calculo de tempo restante
- Motor de escalacao com regras automaticas e instancias
- Notificacoes de breach e alertas proativos

#### ITIL — Problem Management
- Gestao de problemas com categorias de causa raiz
- Registro de erros conhecidos (Known Errors)
- Vinculacao problema-incidente para analise de impacto
- Atividades, anexos e historico de problemas

#### ITIL — Change Management
- Requisicoes de mudanca com tipos (standard, normal, emergency)
- Fluxo de aprovacao multi-nivel
- Tarefas de mudanca com atribuicao e acompanhamento
- Calendario de mudancas para planejamento

#### ITIL — CMDB
- Itens de configuracao (CIs) com tipos e status personalizaveis
- Relacionamentos entre CIs (depende de, conectado a, contem)
- Historico completo de alteracoes em CIs
- Analise de impacto com vinculacao CI-ticket

#### ITIL — Service Catalog
- Catalogo de servicos com categorias hierarquicas
- Requisicoes de servico com fluxo de aprovacao
- Tarefas de atendimento com SLA dedicado

#### ITIL — CAB (Change Advisory Board)
- Configuracao de CAB por organizacao
- Gestao de membros e reunioes
- Agendamento de reunioes com pauta automatica

#### Autenticacao e Autorizacao
- JWT com access token (15min) e refresh token (7d) em cookies httpOnly
- RBAC com 6 papeis (super_admin, admin, tenant_admin, team_manager, agent, user) e 29 permissoes
- MFA com suporte a TOTP, SMS, Email e codigos de backup
- SSO via OAuth2 e SAML
- Autenticacao Gov.br para orgaos publicos
- WebAuthn/biometria para login sem senha
- Politicas de senha (entropia, dicionario, historico, expiracao 90 dias)
- Auditoria de login com deteccao de tentativas suspeitas

#### Knowledge Base
- Artigos com categorias, tags e versionamento
- Busca semantica com vetores (vector embeddings)
- Auto-geracao de artigos por IA a partir de tickets resolvidos
- Feedback de utilidade e sugestoes de melhoria
- Anexos em artigos

#### AI/ML
- Classificacao automatica de tickets por categoria e prioridade
- NLP para extracao de entidades e intencoes
- Analise de sentimento em tempo real
- AI Copilot para sugestoes de resposta a agentes
- AI Chat para atendimento ao usuario
- Self-Healing para resolucao automatica de incidentes conhecidos
- Pipeline de treinamento com dados historicos

#### Workflows e Automacoes
- Builder visual de workflows com ReactFlow (15 tipos de nos, 3 tipos de arestas)
- Motor de execucao com steps e transicoes condicionais
- Aprovacoes com tokens seguros armazenados em banco
- Automacoes baseadas em eventos (criacao, atualizacao, SLA breach)
- Executor de webhooks com protecao SSRF

#### Multi-tenancy e Billing
- Isolamento completo por organizacao em todas as queries
- Resolucao de tenant via middleware (slug, header, JWT)
- Planos: Starter (gratis, 3 usuarios, 100 tickets), Professional (R$109, 15 usuarios), Enterprise (R$179, ilimitado)
- Integracao Stripe completa (checkout, portal, webhook, status)
- Onboarding self-service com criacao automatica de organizacao
- Landing page com pricing e comparativo de planos

#### Seguranca
- CSRF com Double Submit Cookie + HMAC-SHA256
- Criptografia AES-256-GCM com rotacao de chaves para campos sensiveis
- Content Security Policy (CSP) strict em producao
- Rate limiting por endpoint (login 5/15min, registro 3/hr, padrao 60/min)
- Protecao contra SQL injection com queries parametrizadas e escape de LIKE
- Sanitizacao XSS com isomorphic-dompurify
- Protecao SSRF em webhooks de workflow
- HSTS, X-Frame-Options DENY, Permissions-Policy
- PII detection e mascaramento

#### Conformidade LGPD
- Politica de privacidade e termos de uso
- Banner de consentimento de cookies
- Rastreamento de consentimentos com base legal
- Portabilidade de dados (export)
- Direito ao esquecimento (erasure)
- Retencao de dados com politica de 3 anos

#### Analytics e Dashboards
- Dashboard em tempo real com metricas de tickets, SLA e agentes
- Metricas diarias, por agente e por categoria
- Analytics preditivo com previsao de demanda
- Deteccao de anomalias
- Dashboard COBIT com indicadores de governanca
- 24 widgets configuraveis com builder de dashboard
- Graficos: heatmaps, sankey, radar (Recharts + D3)

#### Notificacoes
- Sistema multi-canal (in-app, email, push)
- Eventos configurraveis por tipo e prioridade
- Agrupamento em lotes (batch/digest)
- Regras de filtro personalizaveis
- Socket.io para notificacoes em tempo real

#### Integracoes
- Email via Resend e SMTP com 3 templates de billing
- WhatsApp com gestao de contatos, sessoes e mensagens
- Conectores bancarios e ERP (base connector pattern)
- Integracao Gov.br para autenticacao governamental
- Webhooks bidirecionais com log de entregas

#### PWA e Mobile
- Suporte offline com service worker
- Push notifications nativas
- Sincronizacao em background
- Autenticacao biometrica mobile
- 13 componentes mobile (gestos, voz, biometria)

#### Infraestrutura
- Docker multi-stage (<200MB) com usuario non-root e tini
- Health checks: /api/health/live, /ready, /startup
- Monitoramento Sentry (server/client/edge) + Prometheus
- Cron jobs para tarefas agendadas
- Cache Redis (ioredis) com fallback graceful
- Cache LRU em memoria e cache de browser
- Compressao gzip/brotli no servidor customizado
- Servidor customizado com Socket.io + graceful shutdown

#### Super Admin
- Dashboard cross-tenant com estatisticas agregadas e alertas
- CRUD de organizacoes com suspensao/reativacao
- Gestao de usuarios cross-tenant com acoes administrativas
- Audit logs cross-tenant com filtros por data/org/acao
- Configuracoes de sistema (manutencao, limites, SMTP, seguranca)
- Area com tema amber, restrita a organizacao 1 ou super_admin

#### Frontend e UX
- 125 componentes React com design system consistente
- 76 paginas com App Router (Next.js 15)
- Dark mode completo em todas as paginas
- Design system com tokens (cores brand-*, neutral-*)
- Animacoes com Framer Motion (fade-in, slide-up, pulse-soft)
- Gamificacao com badges, leaderboard e reconhecimento
- Lighthouse 92-95/100, LCP 2.1s, bundle 245KB gzipped

---

## [0.9.0] - 2026-03-16

Preparacao final para producao com novos endpoints, seguranca e infraestrutura.

### Adicionado
- Cron jobs para tarefas periodicas (limpeza, SLA, notificacoes)
- Rate limiting com Redis em producao
- Rotas de API para MFA (ativacao, verificacao, backup codes)
- Rotas de ITIL: aprovacao de mudancas, agendamento CAB, historico CMDB, analise de impacto
- Rota de requisicoes de catalogo por ID
- Rota de bulk update de tickets

### Corrigido
- Hardening de seguranca em rotas existentes
- Documentacao de variaveis de ambiente
- Favicon e rotas diversas
- Variavel `DEFAULT_TENANT_SLUG` para deploy serverless

---

## [0.8.0] - 2026-03-15

Conformidade legal, onboarding automatizado, comunicacao e testes.

### Adicionado
- Conformidade LGPD: politica de privacidade, termos de uso, consentimento de cookies
- Onboarding self-service com criacao automatica de organizacao no registro
- Landing page com pricing e comparativo de planos
- Provedor de email Resend com 3 templates de billing
- Integracao Stripe completa (checkout, portal, webhook)
- 79 testes automatizados (smoke, isolamento de tenant, prioridade de API)

### Corrigido
- Migracao SQLite para PostgreSQL — 100% completa
- Compatibilidade de booleanos PostgreSQL (`sqlTrue()`/`sqlFalse()`)
- Deploy Vercel com lazy-load de better-sqlite3
- Auditoria de seguranca completa (6 frentes, 90+ arquivos)
- Migracao de cores para brand-*/neutral-* (0 blue-*, 0 gray-*)

---

## [0.7.0] - 2026-03-14

### Adicionado
- AI Agent, Copilot, Chat, Self-Healing e modulos ESM
- Super Admin area com dashboard, organizacoes, usuarios, audit e configuracoes
- Modulos de integracao bancaria e ERP

### Corrigido
- QA completo em 8 sprints com 87+ correcoes
- Migracao do adapter SQLite para adapter unificado
- Correcoes de UX/UI responsivo em 128 arquivos

---

## [0.6.0] - 2026-03-13

### Adicionado
- Infraestrutura de seguranca enterprise (CSRF, CSP, encryption, rate limiting)
- Framework de testes automatizados
- Sistema de notificacoes com Socket.io

### Corrigido
- Overhaul de performance e redesign de layout
- Correcoes abrangentes de seguranca, QA e limpeza (233 arquivos)
