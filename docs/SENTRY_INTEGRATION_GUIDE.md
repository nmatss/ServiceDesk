# Guia de Integração Sentry - ServiceDesk

## Visão Geral

Este guia explica como testar e usar a integração do Sentry para rastreamento de erros e monitoramento de performance no ServiceDesk.

## Arquivos Criados

### Configuração Principal

1. **next.config.js** - Configuração do Sentry webpack plugin
2. **sentry.client.config.ts** - Configuração do Sentry no cliente (browser)
3. **sentry.server.config.ts** - Configuração do Sentry no servidor (Node.js)
4. **sentry.edge.config.ts** - Configuração do Sentry no Edge Runtime (middleware)
5. **instrumentation.ts** - Inicialização do Sentry no startup

### Error Boundaries

6. **app/error.tsx** - Error boundary para páginas da aplicação
7. **app/global-error.tsx** - Error boundary global (root-level)

### Utilitários

8. **lib/monitoring/sentry-helpers.ts** - Funções auxiliares para captura de erros
9. **app/api/example-with-sentry/route.ts** - Exemplo de API route com Sentry
10. **scripts/sentry-upload-sourcemaps.js** - Script de upload de source maps

### Variáveis de Ambiente

11. **.env.example** - Atualizado com variáveis do Sentry

## Configuração Inicial

### 1. Criar Conta no Sentry

1. Acesse [sentry.io](https://sentry.io)
2. Crie uma conta gratuita
3. Crie um novo projeto Next.js

### 2. Configurar Variáveis de Ambiente

Copie as variáveis do `.env.example` para seu `.env` local:

```bash
# ============================================
# SENTRY ERROR TRACKING & SOURCE MAPS
# ============================================

# DSN público (safe to expose)
SENTRY_DSN=https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxx

# Auth token para upload de source maps (MANTER SECRETO!)
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Organização (encontre na URL: sentry.io/organizations/YOUR_ORG/)
SENTRY_ORG=your-org-slug

# Projeto (encontre na URL: sentry.io/organizations/YOUR_ORG/projects/YOUR_PROJECT/)
SENTRY_PROJECT=servicedesk

# Ambiente
SENTRY_ENVIRONMENT=development

# Release (opcional, auto-detecta do Git)
SENTRY_RELEASE=

# Upload de source maps (true em produção)
SENTRY_UPLOAD_SOURCEMAPS=false

# Performance monitoring
ENABLE_PERFORMANCE_MONITORING=true
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ERROR_SAMPLE_RATE=1.0
```

### 3. Obter as Credenciais do Sentry

#### DSN (Data Source Name)

1. Vá para: Settings > Projects > [seu-projeto] > Client Keys (DSN)
2. Copie o DSN público
3. Adicione em `SENTRY_DSN`

#### Auth Token

1. Vá para: Settings > Account > API > Auth Tokens
2. Clique em "Create New Token"
3. Defina as permissões:
   - `project:read`
   - `project:releases`
   - `org:read`
4. Copie o token
5. Adicione em `SENTRY_AUTH_TOKEN` (NUNCA commite este valor!)

#### Organização e Projeto

1. Verifique a URL do dashboard: `https://sentry.io/organizations/YOUR_ORG/projects/YOUR_PROJECT/`
2. `YOUR_ORG` = valor de `SENTRY_ORG`
3. `YOUR_PROJECT` = valor de `SENTRY_PROJECT`

## Como Testar a Integração

### Teste 1: Erro no Cliente (Browser)

1. **Criar um componente de teste:**

```tsx
// app/test-sentry/page.tsx
'use client'

export default function TestSentry() {
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Teste de Erros - Sentry</h1>

      <div className="space-y-4">
        <button
          onClick={() => {
            throw new Error('Erro de teste do cliente')
          }}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Erro Síncrono
        </button>

        <button
          onClick={async () => {
            await Promise.reject(new Error('Erro async de teste'))
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded"
        >
          Erro Assíncrono
        </button>

        <button
          onClick={() => {
            // @ts-ignore
            undefined.property.access
          }}
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          Erro de Runtime
        </button>
      </div>
    </div>
  )
}
```

2. **Testar:**
   - Acesse: `http://localhost:3000/test-sentry`
   - Clique em cada botão
   - Verifique no dashboard do Sentry se os erros foram capturados

### Teste 2: Erro em API Route

1. **Usar a rota de exemplo:**

```bash
# Erro síncrono
curl http://localhost:3000/api/example-with-sentry?type=sync

# Erro assíncrono
curl http://localhost:3000/api/example-with-sentry?type=async

# Erro de banco de dados
curl http://localhost:3000/api/example-with-sentry?type=database

# Erro de validação
curl http://localhost:3000/api/example-with-sentry?type=validation
```

2. **Verificar no Sentry:**
   - Acesse: Issues
   - Verifique os erros capturados com contexto completo

### Teste 3: Error Boundary

1. **Criar componente que gera erro:**

```tsx
// app/test-error-boundary/page.tsx
'use client'

import { useState } from 'react'

function ComponentWithError() {
  const [shouldError, setShouldError] = useState(false)

  if (shouldError) {
    throw new Error('Erro capturado pelo Error Boundary')
  }

  return (
    <button
      onClick={() => setShouldError(true)}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Acionar Error Boundary
    </button>
  )
}

export default function TestErrorBoundary() {
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Teste Error Boundary</h1>
      <ComponentWithError />
    </div>
  )
}
```

2. **Testar:**
   - Acesse: `http://localhost:3000/test-error-boundary`
   - Clique no botão
   - Verifique se a tela de erro aparece
   - Verifique se o erro foi enviado ao Sentry

### Teste 4: Performance Monitoring

1. **Verificar transações:**
   - Navegue pela aplicação normalmente
   - Acesse várias páginas
   - Faça chamadas à API

2. **No Sentry:**
   - Vá para: Performance
   - Verifique as transações capturadas
   - Analise tempos de carregamento

### Teste 5: Breadcrumbs

1. **Simular jornada de usuário:**
   - Login
   - Navegação por várias páginas
   - Ações (criar ticket, etc.)
   - Gerar um erro

2. **No Sentry:**
   - Abra o erro capturado
   - Vá para "Breadcrumbs"
   - Verifique o histórico de ações do usuário

## Uso em Produção

### 1. Build com Source Maps

```bash
# Desenvolvimento (source maps locais)
npm run build

# Produção (com upload de source maps)
SENTRY_UPLOAD_SOURCEMAPS=true \
SENTRY_ENVIRONMENT=production \
npm run build
```

### 2. Upload Manual de Source Maps

```bash
# Configurar variáveis
export SENTRY_AUTH_TOKEN=your-token
export SENTRY_ORG=your-org
export SENTRY_PROJECT=your-project
export SENTRY_ENVIRONMENT=production

# Upload
node scripts/sentry-upload-sourcemaps.js
```

### 3. CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: servicedesk
          SENTRY_ENVIRONMENT: production
          SENTRY_UPLOAD_SOURCEMAPS: true
          SENTRY_RELEASE: ${{ github.sha }}
        run: npm run build

      - name: Deploy
        run: # seu comando de deploy
```

## Melhores Práticas

### 1. Contexto do Usuário

```typescript
import { setUser } from '@/lib/monitoring/sentry-helpers'

// Após login bem-sucedido
setUser({
  id: user.id,
  username: user.name,
  // Não inclua email ou dados sensíveis a menos que necessário
})

// Após logout
clearUser()
```

### 2. Breadcrumbs Customizados

```typescript
import { addBreadcrumb } from '@/lib/monitoring/sentry-helpers'

// Registrar ação importante
addBreadcrumb('Ticket criado', 'ticket', 'info', {
  ticketId: ticket.id,
  priority: ticket.priority,
})
```

### 3. Captura de Erros com Contexto

```typescript
import { captureException } from '@/lib/monitoring/sentry-helpers'

try {
  await riskyOperation()
} catch (error) {
  captureException(error, {
    tags: {
      operation: 'ticket-creation',
      module: 'tickets',
    },
    extra: {
      ticketData: sanitizedData, // Não inclua dados sensíveis
    },
    level: 'error',
  })
}
```

### 4. Wrapper de API Routes

```typescript
import { withSentry } from '@/lib/monitoring/sentry-helpers'

export const GET = withSentry(
  async (request: NextRequest) => {
    // Seu código aqui
  },
  {
    routeName: 'GET /api/tickets',
    tags: { version: 'v1' },
  }
)
```

### 5. Erro de Banco de Dados

```typescript
import { captureDatabaseError } from '@/lib/monitoring/sentry-helpers'

try {
  db.prepare(query).all(...params)
} catch (error) {
  captureDatabaseError(error, query, params)
  throw error
}
```

## Filtragem de Dados Sensíveis

O Sentry está configurado para **automaticamente** remover:

- Tokens de autenticação
- Cookies
- Senhas em query strings
- IPs de usuários
- Emails (opcional)

### Adicionar Filtros Customizados

Edite `sentry.client.config.ts` ou `sentry.server.config.ts`:

```typescript
beforeSend(event, hint) {
  // Remover campo customizado
  if (event.extra?.customField) {
    delete event.extra.customField
  }

  return event
}
```

## Monitoramento de Performance

### Configurar Sample Rate

```bash
# .env
# 1.0 = 100% das transações (caro!)
# 0.1 = 10% das transações (recomendado)
# 0.01 = 1% das transações (alta escala)
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Medir Operações Específicas

```typescript
import { measurePerformance } from '@/lib/monitoring/sentry-helpers'

const result = await measurePerformance(
  'expensive-operation',
  async () => {
    return await heavyComputation()
  },
  { category: 'compute' }
)
```

## Troubleshooting

### Erros não aparecem no Sentry

1. **Verificar variáveis:**
```bash
echo $SENTRY_DSN
echo $NEXT_PUBLIC_SENTRY_DSN
```

2. **Verificar console:**
- Erros em desenvolvimento aparecem no console
- Verifique se há mensagens de erro do Sentry

3. **Verificar network:**
- Abra DevTools > Network
- Procure por requisições para `sentry.io`
- Verifique se estão com status 200

### Source maps não funcionam

1. **Verificar build:**
```bash
# Deve gerar .map files
ls -la .next/static/chunks/*.map
```

2. **Verificar upload:**
```bash
# Testar upload manual
node scripts/sentry-upload-sourcemaps.js
```

3. **Verificar no Sentry:**
- Settings > Projects > [projeto] > Source Maps
- Verifique se os arquivos foram enviados

### Performance não aparece

1. **Verificar sample rate:**
```bash
echo $SENTRY_TRACES_SAMPLE_RATE
```

2. **Aumentar temporariamente:**
```bash
SENTRY_TRACES_SAMPLE_RATE=1.0 npm run dev
```

## Recursos Adicionais

- [Documentação Sentry Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/guides/nextjs/best-practices/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

## Custos e Limites

### Plano Free (Gratuito)

- 5.000 errors/mês
- 10.000 performance units/mês
- Retenção de 30 dias
- 1 usuário

### Plano Team ($26/mês)

- 50.000 errors/mês
- 100.000 performance units/mês
- Retenção de 90 dias
- Usuários ilimitados

### Otimizar Custos

1. **Ajustar sample rates:**
```bash
SENTRY_TRACES_SAMPLE_RATE=0.05  # 5% em vez de 10%
SENTRY_ERROR_SAMPLE_RATE=1.0     # Manter 100% para erros
```

2. **Filtrar erros conhecidos:**
```typescript
ignoreErrors: [
  'ChunkLoadError',
  'ResizeObserver loop',
]
```

3. **Usar Release Health sem Performance:**
```bash
ENABLE_PERFORMANCE_MONITORING=false
```

## Checklist de Implantação

- [ ] Configurar SENTRY_DSN no ambiente de produção
- [ ] Configurar SENTRY_AUTH_TOKEN como secret (CI/CD)
- [ ] Configurar SENTRY_ENVIRONMENT=production
- [ ] Habilitar upload de source maps (SENTRY_UPLOAD_SOURCEMAPS=true)
- [ ] Testar captura de erros em staging
- [ ] Configurar alertas no Sentry
- [ ] Configurar integrações (Slack, PagerDuty, etc.)
- [ ] Revisar sample rates para produção
- [ ] Documentar processo de resposta a incidentes
- [ ] Treinar equipe no uso do Sentry

## Suporte

Para dúvidas sobre a integração:
1. Consulte este guia
2. Revise os exemplos em `app/api/example-with-sentry/`
3. Consulte a documentação oficial do Sentry
4. Contate a equipe de desenvolvimento
