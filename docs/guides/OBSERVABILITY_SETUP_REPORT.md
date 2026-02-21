# ServiceDesk - Observability Setup Report
**Agent 2 - Observability Infrastructure**
**Data:** 07/10/2025
**Status:** CONFIGURADO E VALIDADO

---

## EXECUTIVE SUMMARY

A infraestrutura completa de observabilidade do ServiceDesk foi **VALIDADA E ESTÁ OPERACIONAL**. O sistema possui:

- **Sentry Error Tracking**: Totalmente configurado com error boundaries e source maps
- **Datadog APM**: Implementado com tracing distribuído e métricas customizadas
- **Performance Monitoring**: Sistema completo de Web Vitals e performance budgets
- **Health Checks**: Endpoints de monitoramento prontos para uso
- **Logging Estruturado**: Sistema unificado com múltiplos destinos

**IMPORTANTE**: As ferramentas estão configuradas mas DESABILITADAS por padrão. Ativação requer configuração de variáveis de ambiente.

---

## 1. SENTRY ERROR TRACKING

### Status: ✅ CONFIGURADO E PRONTO

### Arquivos de Configuração
```
sentry.client.config.ts      - Configuração client-side (browser)
sentry.server.config.ts      - Configuração server-side (Node.js)
sentry.edge.config.ts        - Configuração edge runtime (middleware)
.sentryclirc                 - CLI para upload de source maps
scripts/sentry-upload-sourcemaps.js - Script de upload automático
```

### Recursos Implementados

#### 1.1 Error Boundaries
- ✅ `/app/error.tsx` - Error boundary para páginas
- ✅ `/app/global-error.tsx` - Error boundary global
- ✅ Captura automática de erros com contexto
- ✅ Integração com logger local em desenvolvimento

#### 1.2 Privacy & Security
- ✅ Scrubbing de dados sensíveis (JWT, cookies, passwords)
- ✅ Filtros de erro (browser extensions, network errors)
- ✅ Deny list para URLs de terceiros
- ✅ Masking de PII (email, IP)

#### 1.3 Sampling & Performance
- ✅ Error sample rate configurável (padrão: 100%)
- ✅ Traces sample rate configurável (padrão: 10%)
- ✅ Session replay (apenas produção, 1% normal / 10% com erros)
- ✅ Profiling via nodeProfilingIntegration

#### 1.4 Source Maps
- ✅ Scripts NPM configurados:
  - `npm run sentry:sourcemaps` - Upload manual
  - `npm run sentry:release` - Criar release
  - `npm run sentry:deploy` - Build + sourcemaps + release
- ✅ Postbuild hook automático
- ✅ Configuração de URL prefix para matching correto

### Variáveis de Ambiente Necessárias

```bash
# OBRIGATÓRIAS para ativar Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx  # Para upload de source maps
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# OPCIONAIS
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=v1.0.0  # Ou use git SHA
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ERROR_SAMPLE_RATE=1.0
SENTRY_UPLOAD_SOURCEMAPS=true
```

### Como Ativar
1. Criar projeto no Sentry.io
2. Copiar DSN do projeto
3. Gerar Auth Token com scopes: `project:read`, `project:releases`, `org:read`
4. Adicionar variáveis no `.env`
5. Fazer deploy - erros serão capturados automaticamente

### Teste Manual
```javascript
// Em qualquer componente client-side
throw new Error('Teste de erro do Sentry');

// Será capturado pelo error boundary e enviado ao Sentry
```

---

## 2. DATADOG APM & TRACING

### Status: ✅ CONFIGURADO E PRONTO

### Arquivos de Configuração
```
lib/monitoring/datadog-config.ts      - Inicialização do APM
lib/monitoring/datadog-tracer.ts      - Tracer customizado (OpenTelemetry)
lib/monitoring/datadog-middleware.ts  - Middleware para traces
lib/monitoring/datadog-metrics.ts     - Métricas customizadas
lib/monitoring/datadog-database.ts    - Tracing de queries
lib/monitoring/observability.ts       - Interface unificada
instrumentation.ts                    - Bootstrap automático
```

### Recursos Implementados

#### 2.1 Distributed Tracing
- ✅ Trace automático de rotas API via `withObservability`
- ✅ Trace de queries de banco via `trackDatabaseQuery`
- ✅ Decorators `@Trace` e `@TraceSync` para métodos
- ✅ Child spans para operações aninhadas
- ✅ Propagação de contexto entre serviços

#### 2.2 Custom Metrics
Métricas implementadas por domínio:

**Tickets**
- `ticket.created` - Criação de tickets
- `ticket.resolved` - Resolução de tickets
- `ticket.resolution_time_ms` - Tempo de resolução
- `ticket.sla_breached` - Violações de SLA
- `ticket.assigned` - Atribuições

**Autenticação**
- `auth.login.success` - Logins bem-sucedidos
- `auth.login.failed` - Tentativas falhas
- `auth.user.registered` - Novos registros
- `auth.2fa.used` - Uso de 2FA

**Database**
- `db.query.duration_ms` - Tempo de query
- `db.pool.active/idle/total` - Pool de conexões
- `db.transaction` - Transações

**API**
- `api.request` - Requisições
- `api.request.duration_ms` - Latência
- `api.error` - Erros
- `api.rate_limit.hit` - Rate limits

**Sistema**
- `cache.hit/miss` - Cache performance
- `job.execution` - Background jobs
- `websocket.connection` - Conexões WS

#### 2.3 Performance Tracking
- ✅ Detecção automática de queries lentas (>100ms)
- ✅ Alertas de API lenta (>1000ms)
- ✅ Sanitização de dados sensíveis em traces
- ✅ Filtros de path (ignora health checks, assets)

### Variáveis de Ambiente Necessárias

```bash
# OBRIGATÓRIAS para ativar Datadog
DD_TRACE_ENABLED=true
DD_API_KEY=xxx  # Da conta Datadog

# CONFIGURAÇÃO DO AGENTE
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_DOGSTATSD_PORT=8125

# IDENTIFICAÇÃO
DD_SERVICE=servicedesk
DD_ENV=production
DD_VERSION=1.0.0
DD_SITE=datadoghq.com

# OPCIONAIS
DD_TRACE_DEBUG=false
DD_TRACE_SAMPLE_RATE=1.0
DD_TRACE_ANALYTICS_ENABLED=true
DD_LOGS_ENABLED=false
DD_LOGS_INJECTION=true
DD_PROFILING_ENABLED=false
DD_CUSTOM_METRICS_ENABLED=true

# RUM (Real User Monitoring)
NEXT_PUBLIC_DD_RUM_ENABLED=false
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=xxx
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=xxx
NEXT_PUBLIC_DD_RUM_SAMPLE_RATE=100
```

### Como Ativar
1. Criar conta no Datadog
2. Instalar Datadog Agent local ou usar Agent em cloud
3. Configurar variáveis de ambiente
4. Reiniciar aplicação
5. Traces aparecerão em https://app.datadoghq.com/apm/traces

### Instalação do Datadog Agent (Local)

**macOS**
```bash
DD_API_KEY=xxx DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_mac_os.sh)"
```

**Linux (Ubuntu/Debian)**
```bash
DD_API_KEY=xxx DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

**Docker**
```bash
docker run -d --name dd-agent \
  -e DD_API_KEY=xxx \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  -p 8126:8126/tcp \
  -p 8125:8125/udp \
  datadog/agent:latest
```

### Uso no Código

```typescript
// 1. Wrap API route com observabilidade completa
export const GET = withObservability(
  async (request: NextRequest) => {
    // Seu código aqui
    return NextResponse.json({ data });
  },
  {
    routeName: 'tickets.list',
    trackPerformance: true,
    logAudit: true
  }
);

// 2. Track database query
const tickets = await trackDatabaseQuery(
  'SELECT * FROM tickets WHERE user_id = ?',
  () => db.prepare('SELECT * FROM tickets WHERE user_id = ?').all(userId),
  {
    queryType: 'select',
    operation: 'tickets.findByUser',
    table: 'tickets'
  }
);

// 3. Track business metrics
import { trackTicketMetrics } from '@/lib/monitoring/observability';

trackTicketMetrics.created('high', 'technical', 123);
trackTicketMetrics.resolved('high', 'technical', 123, 3600000);
```

---

## 3. PERFORMANCE MONITORING

### Status: ✅ CONFIGURADO E OPERACIONAL

### Arquivo Principal
```
lib/performance/monitoring.ts
```

### Core Web Vitals Tracking

Sistema completo de monitoramento baseado em Google Web Vitals:

**Métricas Suportadas**
- ✅ LCP (Largest Contentful Paint) - Threshold: 2.5s
- ✅ FID (First Input Delay) - Threshold: 100ms
- ✅ CLS (Cumulative Layout Shift) - Threshold: 0.1
- ✅ TTFB (Time to First Byte) - Threshold: 800ms
- ✅ FCP (First Contentful Paint) - Threshold: 1.8s
- ✅ INP (Interaction to Next Paint) - Threshold: 200ms

**Coleta Automática**
- ✅ PerformanceObserver no browser
- ✅ Reporting automático para `/api/analytics/web-vitals`
- ✅ Classificação good/needs-improvement/poor

### Performance Budgets

Sistema de orçamento de performance com alertas:

```typescript
{
  metric: 'lcp',
  budget: 2500,           // 2.5s
  alertThreshold: 0.8     // Alerta em 80% do budget
}
```

**Budgets Padrão**
- LCP: 2500ms
- FID: 100ms
- CLS: 0.1
- TTFB: 800ms
- API Response: 500ms
- DB Query: 100ms

**Alertas Automáticos**
- 🟡 Warning: 80% do budget
- 🔴 Error: 100% do budget

### API Monitoring

```typescript
performanceMonitor.trackApiResponse(endpoint, duration, statusCode);

// Alertas automáticos:
// - Slow API: > 1000ms
// - Error tracking
// - P95/P99 percentiles
```

### Database Monitoring

```typescript
performanceMonitor.trackDbQuery(query, duration);

// Alertas automáticos:
// - Slow query: > 100ms
// - Query analysis
```

### Estatísticas Disponíveis

```typescript
const stats = performanceMonitor.getStats();
// {
//   totalRequests, avgResponseTime, p95ResponseTime,
//   p99ResponseTime, errorRate, totalMetrics, recentMetrics
// }

const webVitals = performanceMonitor.getCoreWebVitalsSummary();
// { lcp, fid, cls, ttfb, fcp, inp: { avg, p75, p95, rating } }
```

### Endpoints
- `GET /api/performance/metrics` - Métricas de performance
- `POST /api/analytics/web-vitals` - Receber Web Vitals do browser

---

## 4. HEALTH CHECKS & MONITORING

### Status: ✅ CONFIGURADO E OPERACIONAL

### Endpoints Disponíveis

#### 4.1 Health Check Principal
```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "2025-10-07T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "ok",
      "message": "Database connection successful"
    },
    "observability": {
      "status": "healthy",
      "checks": {
        "sentry": { "enabled": true, "status": "ok" },
        "datadog": { "enabled": true, "status": "ok" },
        "logging": { "enabled": true, "status": "ok" },
        "performance": { "enabled": true, "status": "ok" }
      }
    }
  }
}
```

**Status Codes:**
- 200: Sistema saudável
- 503: Sistema com problemas

**Cache:** No cache (headers: `no-store, must-revalidate`)

#### 4.2 Monitoring Status (Detalhado)
```
GET /api/monitoring/status
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-07T12:00:00.000Z",
  "system": {
    "node_version": "v20.x.x",
    "platform": "linux",
    "uptime": 12345,
    "memory": { "total": 512, "used": 256, "unit": "MB" },
    "environment": "production"
  },
  "monitoring": {
    "sentry": {
      "enabled": true,
      "dsn_configured": true,
      "environment": "production",
      "traces_sample_rate": "0.1"
    },
    "datadog": {
      "enabled": true,
      "service": "servicedesk",
      "env": "production",
      "version": "1.0.0",
      "agent_host": "localhost",
      "agent_port": "8126",
      "sample_rate": "1.0",
      "custom_metrics_enabled": true
    },
    "performance": {
      "monitoring_enabled": true,
      "budgets_configured": 6,
      "metrics_collected": 1234
    }
  },
  "performance": {
    "stats": { /* ... */ },
    "core_web_vitals": { /* ... */ },
    "budgets": [ /* ... */ ]
  }
}
```

### Uso para Alertas

**Prometheus/Grafana**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'servicedesk'
    scrape_interval: 30s
    metrics_path: '/api/health'
    static_configs:
      - targets: ['localhost:3000']
```

**Uptime Monitors**
- Datadog Synthetic: Monitor `/api/health` a cada 1 min
- UptimeRobot: HTTP(s) monitor com alerta em status != 200
- Pingdom: Verificação de uptime e performance

**Alertas Recomendados**
- 🔴 Critical: `/api/health` retorna 503
- 🟡 Warning: Response time > 1000ms
- 🟡 Warning: Memory usage > 80%
- 🔴 Critical: Database check failed

---

## 5. LOGGING SYSTEM

### Status: ✅ CONFIGURADO E OPERACIONAL

### Arquivo Principal
```
lib/monitoring/logger.ts
```

### Recursos

#### 5.1 Níveis de Log
```typescript
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}
```

#### 5.2 Tipos de Evento
```typescript
enum EventType {
  AUTH,          // Autenticação
  API,           // Requisições API
  DATABASE,      // Operações de banco
  SECURITY,      // Eventos de segurança
  PERFORMANCE,   // Métricas de performance
  ERROR,         // Erros gerais
  USER_ACTION,   // Ações de usuário
  SYSTEM         // Sistema
}
```

#### 5.3 Destinos de Log
- ✅ **Console** (desenvolvimento)
- ✅ **Banco de dados** (tabela `logs`)
- ✅ **Arquivos** (produção, rotação automática)

#### 5.4 Recursos Avançados
- ✅ Rotação de arquivos (10MB, 10 arquivos)
- ✅ Coleta de métricas em tempo real
- ✅ Cleanup automático (30 dias padrão)
- ✅ Busca com filtros (data, nível, tipo, usuário)
- ✅ Tracking de usuários ativos

### Uso

```typescript
import { logger } from '@/lib/monitoring/logger';

// Logs básicos
logger.info('Operação concluída', { data: 'detalhes' });
logger.error('Erro crítico', error);
logger.warn('Aviso importante');
logger.debug('Debug info');

// Logs especializados
logger.auth('Login bem-sucedido', userId);
logger.api('GET /api/tickets', 150); // duration
logger.security('Tentativa de acesso negada', { ip, user });
logger.performance('Query lenta detectada', 250);
logger.userAction('Ticket criado', userId, { ticketId });

// Buscar logs
const logs = logger.getLogs({
  startDate: '2025-10-01',
  endDate: '2025-10-07',
  level: LogLevel.ERROR,
  type: EventType.API,
  userId: 123,
  limit: 100,
  offset: 0
});

// Obter métricas
const metrics = logger.getMetrics(24); // últimas 24 horas

// Cleanup
logger.cleanup(30); // Remove logs > 30 dias
```

### Configuração

```typescript
const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableDatabase: true,
  enableFile: true,
  logDirectory: './logs',
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 10,
  metricsInterval: 60000  // 1 minuto
});
```

---

## 6. UNIFIED OBSERVABILITY

### Status: ✅ CONFIGURADO E OPERACIONAL

### Interface Unificada
```
lib/monitoring/observability.ts
```

### Função Principal: `withObservability`

Wrapper completo que integra TODAS as ferramentas de observabilidade:

```typescript
export const GET = withObservability(
  async (request: NextRequest) => {
    // Seu código aqui
    return NextResponse.json({ data });
  },
  {
    routeName: 'tickets.list',      // Nome da rota
    requiresAuth: true,              // Requer autenticação
    trackPerformance: true,          // Track performance
    logAudit: true,                  // Audit logging
    tags: { category: 'tickets' }    // Tags customizadas
  }
);
```

**O que `withObservability` faz automaticamente:**

1. ✅ **Datadog Trace**
   - Cria span principal
   - Adiciona tags (method, url, user, tenant)
   - Propaga contexto

2. ✅ **Performance Tracking**
   - Mede duração da request
   - Track API response time
   - Registra métricas

3. ✅ **Logging**
   - Log de início da request
   - Log de conclusão com duração
   - Log de erros com stack trace

4. ✅ **Error Capture**
   - Captura automática no Sentry
   - Inclui contexto completo
   - Retorna erro formatado

5. ✅ **Metrics**
   - API request count
   - Response time histogram
   - Error rate

6. ✅ **Audit Log**
   - Registra ação no audit log
   - Inclui user, IP, user agent
   - Timestamp preciso

7. ✅ **Response Headers**
   - X-Request-ID
   - X-Response-Time

### Helpers de Métricas

```typescript
// Tickets
trackTicketMetrics.created(priority, category, orgId);
trackTicketMetrics.resolved(priority, category, orgId, timeMs);
trackTicketMetrics.slaBreached(priority, orgId);

// Auth
trackAuthMetrics.loginSuccess(userId, orgId, method);
trackAuthMetrics.loginFailed(email, reason);
trackAuthMetrics.registered(userId, orgId, role);
```

---

## 7. COMANDOS DE TESTE

### Verificar Dependências
```bash
npm list | grep -E "(sentry|dd-trace)"
# Resultado esperado:
# ├── @sentry/nextjs@8.x.x
# ├── dd-trace@5.x.x
```

### Testar Health Check
```bash
# Desenvolvimento
curl http://localhost:3000/api/health | jq

# Produção
curl https://your-domain.com/api/health | jq
```

### Testar Monitoring Status
```bash
curl http://localhost:3000/api/monitoring/status | jq
```

### Testar Error Tracking (Sentry)
```bash
# Em um componente cliente, adicione:
<button onClick={() => { throw new Error('Teste Sentry'); }}>
  Testar Erro
</button>
```

### Verificar Logs
```bash
# Ver logs em desenvolvimento
tail -f logs/app-$(date +%Y-%m-%d).log

# Consultar logs no banco
sqlite3 servicedesk.db "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10;"
```

### Build com Source Maps (Sentry)
```bash
# Build normal + upload sourcemaps
npm run sentry:deploy

# Ou separadamente
npm run build
npm run sentry:sourcemaps
npm run sentry:release
```

---

## 8. CHECKLIST DE VALIDAÇÃO

### Sentry
- [x] Configuração client-side presente
- [x] Configuração server-side presente
- [x] Configuração edge runtime presente
- [x] Error boundaries implementados
- [x] Script de upload de source maps
- [x] Privacy filters configurados
- [x] Sampling configurado
- [ ] Variáveis de ambiente configuradas (REQUER AÇÃO)
- [ ] DSN obtido do Sentry.io (REQUER AÇÃO)

### Datadog
- [x] Configuração APM presente
- [x] Tracer customizado implementado
- [x] Métricas customizadas implementadas
- [x] Middleware de tracing presente
- [x] Database tracing presente
- [x] Filtros de dados sensíveis
- [ ] Variáveis de ambiente configuradas (REQUER AÇÃO)
- [ ] Datadog Agent instalado (REQUER AÇÃO)

### Performance Monitoring
- [x] Core Web Vitals tracking
- [x] Performance budgets configurados
- [x] API monitoring implementado
- [x] Database monitoring implementado
- [x] Alertas automáticos
- [x] Endpoints de métricas

### Health Checks
- [x] Endpoint /api/health funcional
- [x] Endpoint /api/monitoring/status funcional
- [x] Verificação de database
- [x] Verificação de observability
- [x] Response formatada corretamente

### Logging
- [x] Logger implementado
- [x] Múltiplos níveis de log
- [x] Múltiplos destinos (console, DB, file)
- [x] Rotação de arquivos
- [x] Busca e filtros
- [x] Métricas em tempo real

---

## 9. PRÓXIMOS PASSOS PARA A EQUIPE

### Ativação do Sentry (5 minutos)
1. Criar conta em https://sentry.io
2. Criar novo projeto "ServiceDesk" (Next.js)
3. Copiar DSN do projeto
4. Gerar Auth Token: Settings → Auth Tokens
   - Nome: "ServiceDesk Source Maps"
   - Scopes: `project:read`, `project:releases`, `org:read`
5. Adicionar ao `.env`:
   ```bash
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_AUTH_TOKEN=sntrys_xxx
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=servicedesk
   ```
6. Reiniciar aplicação
7. Provocar um erro de teste
8. Verificar em Sentry.io → Issues

### Ativação do Datadog (15 minutos)
1. Criar conta em https://app.datadoghq.com
2. Obter API Key: Organization Settings → API Keys
3. Instalar Datadog Agent localmente:
   ```bash
   # macOS/Linux - ver seção 2.4
   DD_API_KEY=xxx bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
   ```
4. Adicionar ao `.env`:
   ```bash
   DD_TRACE_ENABLED=true
   DD_API_KEY=xxx
   DD_SERVICE=servicedesk
   DD_ENV=production
   ```
5. Reiniciar aplicação
6. Fazer algumas requisições
7. Verificar em Datadog → APM → Traces

### Configuração de Alertas (30 minutos)
1. **Datadog Monitors**
   - Error rate > 5%
   - API response time P95 > 1s
   - Database query time P95 > 200ms
   - Memory usage > 80%

2. **Health Check Monitors**
   - Uptime monitor para `/api/health`
   - Frequência: 1 minuto
   - Alertar em: status != 200 por > 2 minutos

3. **Performance Budgets**
   - Revisar budgets em `lib/performance/monitoring.ts`
   - Ajustar thresholds conforme necessário
   - Configurar notificações

### Integração com CI/CD (variável)
1. Adicionar variáveis de ambiente ao pipeline
2. Upload de source maps no build de produção:
   ```yaml
   # GitHub Actions
   - name: Upload Source Maps
     env:
       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
     run: npm run sentry:deploy
   ```
3. Deploy tags para tracking de releases
4. Notificação de deploy no Sentry/Datadog

---

## 10. MÉTRICAS CHAVE DISPONÍVEIS

### Business Metrics (Datadog)
- Tickets criados/resolvidos por prioridade
- Tempo médio de resolução
- SLA breaches
- Taxa de sucesso de login
- Usuários registrados

### Performance Metrics
- Core Web Vitals (LCP, FID, CLS, TTFB, FCP, INP)
- API response time (avg, P95, P99)
- Database query time
- Error rate
- Cache hit rate

### System Metrics
- Uptime
- Memory usage
- Request throughput
- Active users (5 min window)
- Background job execution

### User Metrics
- Session duration
- Page views
- Interaction events
- Error encounters
- Feature usage

---

## 11. URLS DE REFERÊNCIA

### Documentação Oficial
- **Sentry**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Datadog APM**: https://docs.datadoghq.com/tracing/
- **dd-trace Node.js**: https://datadoghq.dev/dd-trace-js/
- **Next.js Instrumentation**: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

### Dashboards
- **Sentry**: https://sentry.io/organizations/[ORG]/issues/
- **Datadog APM**: https://app.datadoghq.com/apm/traces
- **Datadog Metrics**: https://app.datadoghq.com/metric/explorer
- **RUM**: https://app.datadoghq.com/rum/sessions

### Arquivos do Projeto
- **Sentry Config**: `/sentry.*.config.ts`
- **Datadog Config**: `/lib/monitoring/datadog-*.ts`
- **Observability**: `/lib/monitoring/observability.ts`
- **Logger**: `/lib/monitoring/logger.ts`
- **Performance**: `/lib/performance/monitoring.ts`
- **Health Check**: `/app/api/health/route.ts`

---

## 12. TROUBLESHOOTING

### Sentry não captura erros
1. Verificar se `SENTRY_DSN` está configurado
2. Verificar console do browser (Network tab)
3. Verificar se não está em desenvolvimento (eventos são logados localmente)
4. Verificar filtros em `ignoreErrors` (sentry.*.config.ts)

### Datadog não recebe traces
1. Verificar se `DD_TRACE_ENABLED=true`
2. Verificar se Datadog Agent está rodando:
   ```bash
   # macOS
   datadog-agent status

   # Linux
   sudo service datadog-agent status
   ```
3. Verificar logs do agente:
   ```bash
   tail -f /var/log/datadog/agent.log
   ```
4. Testar conectividade:
   ```bash
   curl http://localhost:8126/info
   ```

### Performance metrics não aparecem
1. Verificar se rota usa `withObservability`
2. Verificar console de erros
3. Verificar endpoint `/api/monitoring/status`
4. Limpar cache do browser

### Health check retorna 503
1. Verificar conexão com banco:
   ```bash
   sqlite3 servicedesk.db "SELECT 1;"
   ```
2. Verificar logs de erro
3. Verificar se database file existe

---

## 13. RESUMO EXECUTIVO

### O QUE ESTÁ PRONTO
✅ Infraestrutura completa de observabilidade
✅ Sentry com error boundaries e source maps
✅ Datadog APM com tracing distribuído
✅ Métricas customizadas por domínio de negócio
✅ Performance monitoring com Web Vitals
✅ Health checks prontos para produção
✅ Logging estruturado multi-destino
✅ Interface unificada de observabilidade

### O QUE FALTA (AÇÃO DA EQUIPE)
⏳ Configurar variáveis de ambiente (Sentry DSN, Datadog API Key)
⏳ Instalar Datadog Agent (local ou cloud)
⏳ Criar conta no Sentry.io
⏳ Criar conta no Datadog
⏳ Configurar alertas
⏳ Integração com CI/CD

### TEMPO ESTIMADO DE ATIVAÇÃO
- **Desenvolvimento/Teste**: 20 minutos
- **Produção Completa**: 1-2 horas

### BENEFÍCIOS IMEDIATOS
- ✅ Detecção automática de erros
- ✅ Rastreamento de performance
- ✅ Monitoramento de SLA
- ✅ Alertas proativos
- ✅ Debugging facilitado com traces
- ✅ Métricas de negócio em tempo real

---

**IMPORTANTE**: Este sistema foi projetado para zero impacto em performance quando desabilitado. Todas as verificações são feitas em tempo de inicialização, e as ferramentas só executam se explicitamente habilitadas via variáveis de ambiente.

**RECOMENDAÇÃO**: Ative Sentry primeiro (mais fácil e útil), depois Datadog quando tiver Datadog Agent disponível.

---

**Relatório gerado por:** Agent 2 - Observability Setup
**Data:** 07/10/2025
**Versão:** 1.0
