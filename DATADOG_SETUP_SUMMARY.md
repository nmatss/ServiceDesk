# Resumo de Implementação - Datadog APM

## Visão Geral

Sistema completo de distributed tracing customizado para o ServiceDesk utilizando Datadog APM e OpenTelemetry.

---

## Arquivos Criados

### 1. Infraestrutura de Tracing

| Arquivo | Descrição |
|---------|-------------|
| `/lib/monitoring/datadog-tracer.ts` | Tracer principal com suporte a spans customizados |
| `/lib/monitoring/datadog-config.ts` | Configuração e inicialização do Datadog APM |

### 2. Tracers Customizados por Domínio

| Arquivo | Domínio | Operações |
|---------|---------|-----------|
| `/lib/monitoring/traces/auth-tracer.ts` | Autenticação | Login, Register, JWT, SSO, MFA |
| `/lib/monitoring/traces/ticket-tracer.ts` | Tickets | Create, Update, Assign, Resolve, Comments |
| `/lib/monitoring/traces/sla-tracer.ts` | SLA | Tracking, Compliance, Breaches, Escalation |
| `/lib/monitoring/traces/database-tracer.ts` | Database | Query, Transaction, CRUD, Migration |
| `/lib/monitoring/traces/index.ts` | Central | Export de todos os tracers + helpers |

### 3. Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `/DATADOG_TRACING_GUIDE.md` | Guia completo de boas práticas (150+ exemplos) |
| `/DATADOG_SETUP_SUMMARY.md` | Este arquivo - resumo executivo |
| `/.env.example` | Variáveis de ambiente atualizadas |

### 4. Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `/instrumentation.ts` | Adicionada inicialização do Datadog APM |

---

## Estrutura de Traces Implementada

```
ServiceDesk APM
│
├── Authentication (auth.*)
│   ├── auth.login
│   ├── auth.register
│   ├── auth.verify_token
│   ├── auth.hash_password
│   ├── auth.verify_password
│   ├── auth.generate_token
│   ├── auth.sso
│   └── auth.mfa_verification
│
├── Tickets (ticket.*)
│   ├── ticket.create
│   ├── ticket.update
│   ├── ticket.get
│   ├── ticket.list
│   ├── ticket.assign
│   ├── ticket.resolve
│   ├── ticket.comment.add
│   └── ticket.user_tickets
│
├── SLA Management (sla.*)
│   ├── sla.create_tracking
│   ├── sla.check_compliance
│   ├── sla.update_response
│   ├── sla.update_resolution
│   ├── sla.get_breaches
│   ├── sla.get_upcoming_breaches
│   ├── sla.calculate_metrics
│   ├── sla.escalation
│   └── sla.trend_analysis
│
├── Database (database.*)
│   ├── database.query
│   ├── database.transaction
│   ├── database.insert
│   ├── database.update
│   ├── database.delete
│   ├── database.select
│   ├── database.connect
│   ├── database.migration
│   ├── database.index
│   ├── database.vacuum
│   └── database.backup
│
└── Helpers
    ├── api.{method}
    ├── job.{name}
    ├── cache.{operation}
    └── external.{service}
```

---

## Configuração de Sampling

### Regras Implementadas

| Tipo de Operação | Sample Rate | Justificativa |
|------------------|-------------|---------------|
| Erros (5xx) | 100% | Crítico para troubleshooting |
| Autenticação (auth.*) | 100% | Segurança e auditoria |
| SLA (sla.*) | 100% | Compliance e métricas |
| Operações críticas de ticket | 100% | Rastreabilidade completa |
| Operações de leitura (.get, .list) | 10% | Reduzir overhead |
| Outras operações | Global (configurável) | Balancear custo vs visibilidade |

### Configuração por Ambiente

```typescript
// Development
DD_TRACE_ENABLED=true
DD_TRACE_DEBUG=true
DD_TRACE_SAMPLE_RATE=1.0

// Staging
DD_TRACE_ENABLED=true
DD_TRACE_DEBUG=false
DD_TRACE_SAMPLE_RATE=0.5

// Production
DD_TRACE_ENABLED=true
DD_TRACE_DEBUG=false
DD_TRACE_SAMPLE_RATE=0.1-0.3  // Ajustar conforme volume
```

---

## Tags e Atributos Customizados

### Tags Globais (Sempre Presentes)

```typescript
{
  service: 'servicedesk',
  env: 'production',
  version: '1.0.0',
  operation.name: string,
  resource.name: string,
  duration_ms: number
}
```

### Tags por Domínio

#### Autenticação
```typescript
{
  'auth.user_id': number,
  'auth.email': string,
  'auth.role': 'admin' | 'agent' | 'user',
  'auth.method': 'credentials' | 'sso' | 'mfa',
  'auth.success': boolean,
  'auth.organization_id': number,
  'auth.failure_reason'?: string
}
```

#### Tickets
```typescript
{
  'ticket.id': number,
  'ticket.user_id': number,
  'ticket.organization_id': number,
  'ticket.category_id': number,
  'ticket.priority_id': number,
  'ticket.status_id': number,
  'ticket.operation': string,
  'ticket.modified_fields'?: string,
  'ticket.resolution_time_ms'?: number
}
```

#### SLA
```typescript
{
  'sla.ticket_id': number,
  'sla.policy_id': number,
  'sla.response_met': boolean,
  'sla.resolution_met': boolean,
  'sla.is_breached': boolean,
  'sla.response_time_minutes': number,
  'sla.resolution_time_minutes': number,
  'sla.escalation_level'?: number
}
```

#### Database
```typescript
{
  'db.system': 'sqlite' | 'postgresql',
  'db.operation': 'select' | 'insert' | 'update' | 'delete' | 'transaction',
  'db.table': string,
  'db.statement': string,
  'db.params_count': number,
  'db.rows_affected': number,
  'db.rows_returned': number
}
```

---

## Segurança e Privacidade

### Dados Sanitizados Automaticamente

1. **Headers Sensíveis**
   - authorization
   - cookie
   - set-cookie
   - x-api-key
   - x-auth-token

2. **Query Parameters Sensíveis**
   - token
   - api_key
   - password
   - secret

3. **Paths Ignorados**
   - /health, /healthz, /ping
   - /_next/static, /_next/image
   - /favicon.ico
   - /public/*

### Conformidade LGPD/GDPR

- ✅ Minimização de dados
- ✅ Anonimização de PII
- ✅ IDs ao invés de dados pessoais
- ✅ Retenção configurável
- ✅ Sanitização automática

---

## Métricas de Performance

### Queries Lentas

Queries com duração > 100ms são automaticamente logadas:

```typescript
// Exemplo de log de query lenta
{
  type: 'performance',
  message: 'Slow database query detected',
  duration_ms: 250,
  query_name: 'tickets-by-category',
  sql: 'SELECT...'
}
```

### Operações Assíncronas

Todas as operações async são rastreadas com:
- Tempo de início
- Tempo de conclusão
- Duração total
- Status (sucesso/erro)

---

## Instalação e Configuração

### 1. Instalar Dependências

```bash
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/core
```

### 2. Configurar Variáveis de Ambiente

Copiar configurações do `.env.example`:

```bash
# Datadog Agent
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126

# Service Info
DD_SERVICE=servicedesk
DD_ENV=production
DD_VERSION=1.0.0

# API Key
DD_API_KEY=your-datadog-api-key

# Tracing
DD_TRACE_ENABLED=true
DD_TRACE_SAMPLE_RATE=0.3
```

### 3. Instalar Datadog Agent

#### Docker (Recomendado)

```bash
docker run -d \
  --name datadog-agent \
  -e DD_API_KEY=your-api-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  datadog/agent:latest
```

#### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agent
data:
  DD_API_KEY: "your-api-key"
  DD_SITE: "datadoghq.com"
  DD_APM_ENABLED: "true"
  DD_APM_NON_LOCAL_TRAFFIC: "true"
```

### 4. Iniciar Aplicação

```bash
# Development
DD_TRACE_ENABLED=true DD_TRACE_DEBUG=true npm run dev

# Production
DD_TRACE_ENABLED=true npm run build && npm run start
```

---

## Exemplos de Uso

### Exemplo 1: API de Login

```typescript
import { traceLogin, traceGenerateToken } from '@/lib/monitoring/traces';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const user = await traceLogin(email, async () => {
    return await authenticateUser({ email, password });
  });

  const token = await traceGenerateToken(user.id, async () => {
    return await generateToken(user);
  });

  return NextResponse.json({ user, token });
}
```

### Exemplo 2: Criação de Ticket

```typescript
import { traceCreateTicket, traceCreateSLATracking } from '@/lib/monitoring/traces';

const ticket = await traceCreateTicket(userId, orgId, data, async () => {
  return await ticketQueries.create(data, orgId);
});

if (slaPolicy) {
  await traceCreateSLATracking(ticket.id, slaPolicy, orgId, async () => {
    return await createSLATracking(ticket.id, slaPolicy.id);
  });
}
```

### Exemplo 3: Query de Database

```typescript
import { traceQuery } from '@/lib/monitoring/traces';

const tickets = await traceQuery(
  'get-user-tickets',
  'SELECT * FROM tickets WHERE user_id = ?',
  [userId],
  () => db.prepare(sql).all(userId)
);
```

---

## Dashboards Recomendados

### 1. Service Overview
- Request rate
- Error rate
- Latency (P50, P95, P99)
- Apdex score

### 2. Authentication Monitoring
- Login success/failure rate
- JWT verification time
- SSO performance
- MFA usage

### 3. SLA Compliance
- SLA breach rate
- Response time compliance
- Resolution time compliance
- Upcoming breaches

### 4. Database Performance
- Query duration
- Slow queries count
- Transaction success rate
- Connection pool usage

---

## Alertas Críticos Sugeridos

### Alta Prioridade

```yaml
1. Authentication Failure Spike
   Condition: auth.login failures > 10% in 5min
   Action: Alert security team

2. SLA Breach Critical
   Condition: sla.breach count > 5 in 1min
   Action: Alert operations team

3. Database Performance Degradation
   Condition: database.query avg > 500ms
   Action: Alert devops team

4. Error Rate High
   Condition: errors > 1% of requests
   Action: Alert on-call engineer
```

### Média Prioridade

```yaml
5. Slow API Responses
   Condition: api.{method} P95 > 1000ms
   Action: Create incident

6. High Memory Usage
   Condition: memory > 80%
   Action: Notify ops team

7. SLA Warning
   Condition: upcoming breaches > 10
   Action: Notify managers
```

---

## Troubleshooting

### Problema: Traces não aparecem no Datadog

**Checklist:**
1. Verificar Datadog Agent rodando: `docker ps | grep datadog`
2. Verificar conectividade: `curl http://localhost:8126/info`
3. Verificar variáveis de ambiente
4. Habilitar debug mode: `DD_TRACE_DEBUG=true`
5. Verificar logs: `tail -f logs/app-*.log | grep Datadog`

### Problema: Performance degradada

**Soluções:**
1. Reduzir sample rate para 10-30%
2. Desabilitar instrumentação de FS
3. Aumentar batch size de spans
4. Filtrar paths não essenciais

### Problema: Spans órfãos

**Solução:**
Sempre usar `context.with` para child spans ou usar os tracers específicos que já fazem isso automaticamente.

---

## Próximos Passos

1. **Integração com RUM (Real User Monitoring)**
   - Adicionar Datadog RUM no frontend
   - Correlacionar traces backend com frontend

2. **Profiling**
   - Habilitar CPU profiling
   - Habilitar memory profiling

3. **Logs Correlation**
   - Integrar logs com traces
   - Adicionar trace_id aos logs

4. **Métricas Customizadas**
   - Business metrics
   - User journey tracking

5. **Synthetic Monitoring**
   - Health checks automáticos
   - API endpoint monitoring

---

## Recursos Adicionais

- **Documentação Completa**: `/DATADOG_TRACING_GUIDE.md`
- **Datadog Docs**: https://docs.datadoghq.com/tracing/
- **OpenTelemetry**: https://opentelemetry.io/docs/
- **Best Practices**: https://docs.datadoghq.com/tracing/guide/

---

## Suporte

Para questões ou problemas:
1. Consultar o guia completo em `/DATADOG_TRACING_GUIDE.md`
2. Verificar logs da aplicação
3. Consultar Datadog Support: https://www.datadoghq.com/support/

---

**Versão**: 1.0.0
**Data**: 2025-10-05
**Status**: ✅ Implementação Completa
