# Guia Rápido - Datadog Tracing

## Instalação Rápida (5 minutos)

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

Adicione ao `.env`:

```bash
DD_TRACE_ENABLED=true
DD_SERVICE=servicedesk
DD_ENV=development
DD_API_KEY=your-datadog-api-key
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_TRACE_SAMPLE_RATE=1.0
```

### 3. Iniciar Datadog Agent

```bash
docker run -d \
  --name datadog-agent \
  -e DD_API_KEY=your-api-key \
  -e DD_APM_ENABLED=true \
  -p 8126:8126 \
  datadog/agent:latest
```

### 4. Iniciar Aplicação

```bash
npm run dev
```

## Uso Básico

### Login com Trace

```typescript
import { traceLogin } from '@/lib/monitoring/traces';

const user = await traceLogin(email, async () => {
  return await authenticateUser({ email, password });
});
```

### Ticket com Trace

```typescript
import { traceCreateTicket } from '@/lib/monitoring/traces';

const ticket = await traceCreateTicket(userId, orgId, data, async () => {
  return await ticketQueries.create(data, orgId);
});
```

### SLA com Trace

```typescript
import { traceCheckSLACompliance } from '@/lib/monitoring/traces';

const compliance = await traceCheckSLACompliance(ticketId, slaId, orgId, async () => {
  return await checkSLA(ticketId);
});
```

## Ver Traces no Datadog

1. Acesse https://app.datadoghq.com/apm/traces
2. Filtre por `service:servicedesk`
3. Explore traces por operação

## Documentação Completa

- Guia Detalhado: `DATADOG_TRACING_GUIDE.md`
- Setup Completo: `DATADOG_SETUP_SUMMARY.md`
- Exemplos: `examples/datadog-tracing-example.ts`
