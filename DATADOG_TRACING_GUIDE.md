# Guia de Boas Práticas - Datadog Tracing

Este guia apresenta as melhores práticas para uso do sistema de tracing do Datadog no ServiceDesk.

## Índice

1. [Configuração Inicial](#configuração-inicial)
2. [Estrutura de Traces](#estrutura-de-traces)
3. [Boas Práticas de Implementação](#boas-práticas-de-implementação)
4. [Sampling e Performance](#sampling-e-performance)
5. [Tags e Atributos](#tags-e-atributos)
6. [Segurança e Privacidade](#segurança-e-privacidade)
7. [Troubleshooting](#troubleshooting)
8. [Exemplos Práticos](#exemplos-práticos)

---

## Configuração Inicial

### 1. Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```bash
# Datadog Configuration
DD_AGENT_HOST=localhost                    # Host do Datadog Agent
DD_TRACE_AGENT_PORT=8126                   # Porta do trace agent
DD_SERVICE=servicedesk                     # Nome do serviço
DD_ENV=production                          # Ambiente (development, staging, production)
DD_VERSION=1.0.0                          # Versão da aplicação
DD_TRACE_ENABLED=true                     # Habilitar tracing
DD_TRACE_DEBUG=false                      # Modo debug (apenas development)
DD_TRACE_SAMPLE_RATE=1.0                  # Taxa de sampling (0.0 a 1.0)
DD_API_KEY=your-datadog-api-key           # API Key do Datadog
```

### 2. Inicialização

O tracing é inicializado automaticamente no `instrumentation.ts`:

```typescript
// instrumentation.ts
import { initializeDatadogAPM } from '@/lib/monitoring/datadog-config';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Inicializar Datadog APM
    initializeDatadogAPM();

    // Outras inicializações...
  }
}
```

### 3. Instalação de Dependências

```bash
npm install --save @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

---

## Estrutura de Traces

### Hierarquia de Traces

```
Service: servicedesk
├── auth (Autenticação)
│   ├── auth.login
│   ├── auth.register
│   ├── auth.verify_token
│   └── auth.sso
├── ticket (Tickets)
│   ├── ticket.create
│   ├── ticket.update
│   ├── ticket.assign
│   └── ticket.resolve
├── sla (SLA Management)
│   ├── sla.create_tracking
│   ├── sla.check_compliance
│   └── sla.escalation
└── database (Database Operations)
    ├── database.query
    ├── database.transaction
    └── database.migration
```

### Tipos de Spans

1. **Root Span**: Operação principal (ex: `auth.login`)
2. **Child Span**: Sub-operações (ex: `database.query` dentro de `auth.login`)
3. **External Span**: Chamadas externas (ex: APIs, webhooks)

---

## Boas Práticas de Implementação

### 1. Nomenclatura de Operações

**✅ BOM:**
```typescript
// Usar nomenclatura clara e hierárquica
await traceLogin(email, async () => { ... });
await traceCreateTicket(userId, orgId, data, async () => { ... });
```

**❌ RUIM:**
```typescript
// Evitar nomes genéricos
await ddTracer.trace('operation', async () => { ... });
await ddTracer.trace('doSomething', async () => { ... });
```

### 2. Usar Tracers Específicos

**✅ BOM:**
```typescript
// Usar tracers específicos para cada domínio
import { traceLogin, traceRegister } from '@/lib/monitoring/traces';

const user = await traceLogin(email, async () => {
  return await authenticateUser({ email, password });
});
```

**❌ RUIM:**
```typescript
// Evitar criar traces manualmente quando há tracer específico
const user = await ddTracer.trace('auth', async () => {
  return await authenticateUser({ email, password });
});
```

### 3. Adicionar Contexto Relevante

**✅ BOM:**
```typescript
await traceCreateTicket(userId, orgId, ticketData, async (span) => {
  // O tracer já adiciona atributos relevantes automaticamente
  const ticket = await createTicket(ticketData);

  // Adicionar contexto adicional se necessário
  span.setAttribute('ticket.has_attachments', ticket.attachments.length > 0);

  return ticket;
});
```

**❌ RUIM:**
```typescript
await traceCreateTicket(userId, orgId, ticketData, async () => {
  // Perder oportunidade de adicionar contexto útil
  return await createTicket(ticketData);
});
```

### 4. Tratar Erros Adequadamente

**✅ BOM:**
```typescript
try {
  await traceLogin(email, async () => {
    return await authenticateUser({ email, password });
  });
} catch (error) {
  // O tracer já registra o erro automaticamente
  // Adicionar lógica de tratamento específica
  if (error.code === 'INVALID_PASSWORD') {
    // Lógica de rate limiting, etc.
  }
  throw error;
}
```

**❌ RUIM:**
```typescript
try {
  await traceLogin(email, async () => {
    return await authenticateUser({ email, password });
  });
} catch (error) {
  // Silenciar erro sem propagar
  console.error(error);
  return null; // ❌ Não fazer isso!
}
```

---

## Sampling e Performance

### 1. Configuração de Sampling

O sampling é configurado em `lib/monitoring/datadog-config.ts`:

```typescript
const samplingConfig = {
  // Sample rate global (default: 100%)
  probability: DD_TRACE_SAMPLE_RATE,

  // Regras de sampling customizadas
  rules: [
    // Sempre capturar erros
    { probability: 1.0, attributes: { 'http.status_code': { $gte: 500 } } },

    // Sempre capturar autenticação
    { probability: 1.0, attributes: { 'operation.name': { $regex: /^auth\./ } } },

    // Sempre capturar SLA
    { probability: 1.0, attributes: { 'operation.name': { $regex: /^sla\./ } } },

    // Sample reduzido para leituras (10%)
    { probability: 0.1, attributes: { 'operation.name': { $regex: /\.(get|list)$/ } } },
  ],
};
```

### 2. Otimizar Performance

**Operações de Alta Frequência:**
- Reduzir sample rate para operações de leitura
- Usar batch processing para spans
- Configurar limites de queue

**Operações Críticas:**
- 100% de sampling para autenticação
- 100% de sampling para SLA
- 100% de sampling para erros

### 3. Recomendações por Ambiente

| Ambiente | Sample Rate | Debug Mode |
|----------|-------------|------------|
| Development | 100% | true |
| Staging | 50% | false |
| Production | 10-30% | false |

---

## Tags e Atributos

### 1. Tags Padrão

Sempre incluídas automaticamente:
- `service`: Nome do serviço
- `env`: Ambiente
- `version`: Versão da aplicação
- `operation.name`: Nome da operação
- `resource.name`: Nome do recurso

### 2. Tags Customizadas

**Autenticação:**
```typescript
{
  'auth.user_id': number,
  'auth.email': string,
  'auth.role': string,
  'auth.method': 'credentials' | 'sso' | 'mfa',
  'auth.success': boolean,
  'auth.organization_id': number
}
```

**Tickets:**
```typescript
{
  'ticket.id': number,
  'ticket.user_id': number,
  'ticket.organization_id': number,
  'ticket.category_id': number,
  'ticket.priority_id': number,
  'ticket.status_id': number,
  'ticket.operation': 'create' | 'update' | 'resolve' | 'assign'
}
```

**SLA:**
```typescript
{
  'sla.ticket_id': number,
  'sla.policy_id': number,
  'sla.response_met': boolean,
  'sla.resolution_met': boolean,
  'sla.is_breached': boolean,
  'sla.response_time_minutes': number,
  'sla.resolution_time_minutes': number
}
```

**Database:**
```typescript
{
  'db.system': 'sqlite',
  'db.operation': 'select' | 'insert' | 'update' | 'delete',
  'db.table': string,
  'db.statement': string,
  'db.rows_affected': number
}
```

### 3. Evitar Tags Sensíveis

**❌ NÃO INCLUIR:**
- Senhas
- Tokens de acesso
- Dados de cartão de crédito
- PII (Personally Identifiable Information) sem necessidade
- Conteúdo completo de comentários/mensagens

**✅ USAR:**
- IDs de recursos
- Nomes de operações
- Status e resultados
- Métricas de performance

---

## Segurança e Privacidade

### 1. Sanitização de Dados

O sistema inclui sanitização automática em `datadog-config.ts`:

```typescript
// Headers sensíveis
const sensitiveHeaders = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
];

// Query params sensíveis
const sensitiveQueryParams = [
  'token',
  'api_key',
  'password',
  'secret',
];
```

### 2. Filtros de Path

Paths ignorados automaticamente:
- `/health`, `/healthz`, `/ping`
- `/_next/static`, `/_next/image`
- `/favicon.ico`
- `/public`

### 3. Conformidade com LGPD/GDPR

**Princípios:**
1. Minimização de dados
2. Anonimização quando possível
3. Retenção limitada (configurar em Datadog)
4. Direito ao esquecimento

**Implementação:**
```typescript
// Usar IDs ao invés de dados pessoais
span.setAttribute('user.id', userId);
// ❌ span.setAttribute('user.email', email);
// ❌ span.setAttribute('user.name', name);

// Para debug, usar hash
span.setAttribute('user.email_hash', hashEmail(email));
```

---

## Troubleshooting

### 1. Traces Não Aparecem no Datadog

**Verificar:**
```bash
# 1. Datadog Agent está rodando?
docker ps | grep datadog-agent

# 2. Conectividade
curl http://localhost:8126/info

# 3. Variáveis de ambiente
echo $DD_TRACE_ENABLED
echo $DD_AGENT_HOST
```

**Solução:**
```bash
# Habilitar debug mode
DD_TRACE_DEBUG=true npm run dev

# Verificar logs
tail -f logs/app-*.log | grep "Datadog"
```

### 2. Performance Degradada

**Sintomas:**
- Aumento de latência nas requests
- Alto uso de CPU
- Memória crescente

**Soluções:**
```typescript
// 1. Reduzir sample rate
DD_TRACE_SAMPLE_RATE=0.1

// 2. Desabilitar instrumentação de FS
'@opentelemetry/instrumentation-fs': {
  enabled: false,
}

// 3. Aumentar batch size
maxExportBatchSize: 1024,
scheduledDelayMillis: 10000,
```

### 3. Spans Órfãos

**Problema:** Spans sem parent, criando traces fragmentados

**Solução:**
```typescript
// ✅ Sempre usar context.with para child spans
await ddTracer.trace('parent', async (parentSpan) => {
  await ddTracer.trace('child', async (childSpan) => {
    // child span automaticamente vinculado ao parent
  });
});
```

---

## Exemplos Práticos

### Exemplo 1: API de Login

```typescript
// app/api/auth/login/route.ts
import { traceLogin } from '@/lib/monitoring/traces';

export async function POST(request: Request) {
  const { email, password } = await request.json();

  try {
    const user = await traceLogin(email, async () => {
      return await authenticateUser({ email, password });
    });

    const token = await traceGenerateToken(user.id, async () => {
      return await generateToken(user);
    });

    return NextResponse.json({ user, token });
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
```

### Exemplo 2: Criação de Ticket com SLA

```typescript
// app/api/tickets/route.ts
import { traceCreateTicket } from '@/lib/monitoring/traces/ticket-tracer';
import { traceCreateSLATracking } from '@/lib/monitoring/traces/sla-tracer';

export async function POST(request: Request) {
  const ticketData = await request.json();
  const { user, organizationId } = await getAuthContext(request);

  // 1. Criar ticket
  const ticket = await traceCreateTicket(
    user.id,
    organizationId,
    ticketData,
    async () => {
      return await ticketQueries.create(ticketData, organizationId);
    }
  );

  // 2. Criar tracking de SLA
  const slaPolicy = await getSLAPolicyForTicket(ticket);

  if (slaPolicy) {
    await traceCreateSLATracking(
      ticket.id,
      slaPolicy,
      organizationId,
      async () => {
        return await createSLATracking(ticket.id, slaPolicy.id);
      }
    );
  }

  return NextResponse.json({ ticket });
}
```

### Exemplo 3: Background Job com Trace

```typescript
// lib/jobs/sla-monitor.ts
import { traceBackgroundJob } from '@/lib/monitoring/traces';
import { traceCheckSLACompliance } from '@/lib/monitoring/traces/sla-tracer';

export async function monitorSLACompliance(organizationId: number) {
  await traceBackgroundJob(
    'sla-compliance-monitor',
    { organizationId },
    async () => {
      const activeTickets = await getActiveTickets(organizationId);

      for (const ticket of activeTickets) {
        const slaTracking = await getSLATracking(ticket.id);

        if (slaTracking) {
          await traceCheckSLACompliance(
            ticket.id,
            slaTracking.id,
            organizationId,
            async () => {
              return await checkSLACompliance(slaTracking);
            }
          );
        }
      }
    }
  );
}
```

### Exemplo 4: Query de Database Complexa

```typescript
// lib/db/analytics.ts
import { traceQuery, traceTransaction } from '@/lib/monitoring/traces/database-tracer';

export async function getComplexAnalytics(organizationId: number) {
  return await traceTransaction('complex-analytics', async () => {
    // Query 1: Tickets por categoria
    const ticketsByCategory = await traceQuery(
      'tickets-by-category',
      'SELECT category_id, COUNT(*) as count FROM tickets WHERE organization_id = ? GROUP BY category_id',
      [organizationId],
      () => db.prepare(query).all(organizationId)
    );

    // Query 2: SLA compliance
    const slaMetrics = await traceQuery(
      'sla-compliance-metrics',
      'SELECT AVG(response_met) as response_rate, AVG(resolution_met) as resolution_rate FROM sla_tracking st JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ?',
      [organizationId],
      () => db.prepare(query).get(organizationId)
    );

    return {
      ticketsByCategory,
      slaMetrics,
    };
  });
}
```

### Exemplo 5: External API Call

```typescript
// lib/integrations/whatsapp.ts
import { traceExternalAPI } from '@/lib/monitoring/traces';

export async function sendWhatsAppMessage(to: string, message: string) {
  return await traceExternalAPI(
    'whatsapp',
    'POST',
    '/messages',
    async () => {
      const response = await fetch('https://api.whatsapp.com/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      });

      return await response.json();
    }
  );
}
```

---

## Métricas e Alertas Recomendados

### 1. Métricas de Performance

**Latência:**
- P50, P95, P99 por operação
- Alertar se P99 > 1000ms

**Taxa de Erro:**
- % de traces com erro
- Alertar se > 1%

**SLA Compliance:**
- % de SLAs atendidos
- Alertar se < 95%

### 2. Alertas Críticos

```yaml
# Exemplo de alerta no Datadog
- name: "High Authentication Failure Rate"
  query: "sum:auth.login.failure.count{env:production}.as_rate()"
  threshold: 0.1  # 10%

- name: "SLA Breach Spike"
  query: "sum:sla.breach.count{env:production}.as_rate()"
  threshold: 5  # 5 breaches/min

- name: "Slow Database Queries"
  query: "avg:database.query.duration{env:production}"
  threshold: 500  # 500ms
```

---

## Recursos Adicionais

### Documentação
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [OpenTelemetry](https://opentelemetry.io/docs/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)

### Ferramentas
- [Datadog Dashboard Templates](https://app.datadoghq.com/dashboard/lists)
- [APM Trace Search](https://app.datadoghq.com/apm/traces)
- [Service Map](https://app.datadoghq.com/apm/map)

### Suporte
- [Datadog Support](https://www.datadoghq.com/support/)
- [Community Forum](https://datadoghq.com/community)

---

## Checklist de Implementação

- [ ] Configurar variáveis de ambiente do Datadog
- [ ] Instalar dependências do OpenTelemetry
- [ ] Inicializar APM no `instrumentation.ts`
- [ ] Implementar traces em operações de autenticação
- [ ] Implementar traces em operações de ticket
- [ ] Implementar traces em operações SLA
- [ ] Configurar sampling adequado ao ambiente
- [ ] Adicionar sanitização de dados sensíveis
- [ ] Configurar alertas no Datadog
- [ ] Testar traces em desenvolvimento
- [ ] Validar traces em staging
- [ ] Deploy em produção com monitoring

---

**Última atualização:** 2025-10-05
**Versão:** 1.0.0
**Autor:** ServiceDesk Team
