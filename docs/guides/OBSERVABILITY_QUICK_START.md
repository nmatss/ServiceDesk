# ServiceDesk - Observability Quick Start Guide

## ATIVAÇÃO RÁPIDA (5 MINUTOS)

### 1. SENTRY ERROR TRACKING

**Passo 1:** Criar conta gratuita
```
https://sentry.io/signup/
```

**Passo 2:** Criar projeto
- Platform: Next.js
- Nome: ServiceDesk

**Passo 3:** Copiar DSN
```
Settings → Projects → ServiceDesk → Client Keys (DSN)
Formato: https://xxx@xxx.ingest.sentry.io/xxx
```

**Passo 4:** Gerar Auth Token
```
Settings → Auth Tokens → Create New Token
Nome: ServiceDesk Source Maps
Scopes: project:read, project:releases, org:read
```

**Passo 5:** Configurar .env
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=servicedesk
SENTRY_ENVIRONMENT=production
```

**Passo 6:** Reiniciar aplicação
```bash
npm run dev
```

**Passo 7:** Testar
- Acesse qualquer página
- Abra console do browser
- Execute: `throw new Error('Teste Sentry')`
- Verifique erro em Sentry.io

---

### 2. DATADOG APM (OPCIONAL)

**Passo 1:** Criar conta
```
https://www.datadoghq.com/
```

**Passo 2:** Obter API Key
```
Organization Settings → API Keys → New Key
```

**Passo 3:** Instalar Agent Local
```bash
# macOS
DD_API_KEY=xxx DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_mac_os.sh)"

# Linux
DD_API_KEY=xxx DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"

# Docker
docker run -d --name dd-agent \
  -e DD_API_KEY=xxx \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -p 8126:8126/tcp \
  datadog/agent:latest
```

**Passo 4:** Configurar .env
```bash
DD_TRACE_ENABLED=true
DD_API_KEY=xxx
DD_SERVICE=servicedesk
DD_ENV=production
DD_VERSION=1.0.0
```

**Passo 5:** Reiniciar aplicação
```bash
npm run dev
```

**Passo 6:** Testar
- Faça algumas requisições
- Acesse https://app.datadoghq.com/apm/traces
- Verifique traces aparecendo

---

## ENDPOINTS DE TESTE

### Health Check
```bash
curl http://localhost:3000/api/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-07T...",
  "checks": {
    "database": { "status": "ok" },
    "observability": { "status": "healthy" }
  }
}
```

### Monitoring Status
```bash
curl http://localhost:3000/api/monitoring/status
```

---

## VERIFICAÇÃO DE CONFIGURAÇÃO

### Ver o que está ativo
```bash
curl http://localhost:3000/api/monitoring/status | jq '.monitoring'
```

Resultado:
```json
{
  "sentry": {
    "enabled": true,  // ✅ Se true, Sentry está ativo
    "dsn_configured": true
  },
  "datadog": {
    "enabled": true,  // ✅ Se true, Datadog está ativo
    "service": "servicedesk"
  },
  "performance": {
    "monitoring_enabled": true  // ✅ Sempre ativo
  }
}
```

---

## COMANDOS NPM ÚTEIS

### Build com Source Maps (Sentry)
```bash
npm run build                  # Build normal
npm run sentry:sourcemaps     # Upload sourcemaps
npm run sentry:release        # Criar release
npm run sentry:deploy         # Tudo junto
```

### Ver Logs
```bash
# Logs em tempo real (desenvolvimento)
tail -f logs/app-$(date +%Y-%m-%d).log

# Logs no banco de dados
sqlite3 servicedesk.db "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10;"
```

### Verificar Dependências
```bash
npm list | grep -E "(sentry|dd-trace)"
```

---

## TROUBLESHOOTING RÁPIDO

### Sentry não funciona
1. Verificar se `SENTRY_DSN` está no .env
2. Reiniciar servidor
3. Limpar cache do browser
4. Verificar console do browser (Network tab)

### Datadog não funciona
1. Verificar se Agent está rodando:
   ```bash
   # macOS
   datadog-agent status

   # Linux
   sudo service datadog-agent status
   ```
2. Verificar se `DD_TRACE_ENABLED=true`
3. Reiniciar servidor

### Logs não aparecem
1. Verificar pasta `logs/` existe
2. Verificar permissões de escrita
3. Verificar nível de log em `LOG_LEVEL`

---

## MÉTRICAS DISPONÍVEIS

### Core Web Vitals (Automático)
- LCP - Largest Contentful Paint
- FID - First Input Delay
- CLS - Cumulative Layout Shift
- TTFB - Time to First Byte
- FCP - First Contentful Paint
- INP - Interaction to Next Paint

### Business Metrics (Via Código)
```typescript
import { trackTicketMetrics, trackAuthMetrics } from '@/lib/monitoring/observability';

// Tickets
trackTicketMetrics.created('high', 'technical', orgId);
trackTicketMetrics.resolved('high', 'technical', orgId, durationMs);
trackTicketMetrics.slaBreached('high', orgId);

// Auth
trackAuthMetrics.loginSuccess(userId, orgId, 'password');
trackAuthMetrics.loginFailed(email, 'invalid_credentials');
trackAuthMetrics.registered(userId, orgId, 'agent');
```

---

## PRÓXIMOS PASSOS

1. ✅ Ativar Sentry (5 min) - **RECOMENDADO PRIMEIRO**
2. ⏳ Ativar Datadog (15 min) - **Opcional, mas muito útil**
3. ⏳ Configurar alertas no Sentry/Datadog
4. ⏳ Criar dashboards customizados
5. ⏳ Integrar com CI/CD para upload de source maps
6. ⏳ Configurar uptime monitors

---

## LINKS ÚTEIS

- **Relatório Completo**: `OBSERVABILITY_SETUP_REPORT.md`
- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Datadog Docs**: https://docs.datadoghq.com/tracing/
- **Sentry Dashboard**: https://sentry.io/organizations/[ORG]/issues/
- **Datadog Dashboard**: https://app.datadoghq.com/apm/traces

---

**Tempo estimado total:** 20 minutos
**Benefício:** Visibilidade completa de erros, performance e métricas de negócio
