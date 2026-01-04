# PERFORMANCE ACTION CHECKLIST - Path to 100%

**Status Atual:** 86/100 média geral | **Meta:** 94.75/100 | **Esforço:** ~9 horas

---

## SPRINT 1: SEO BLITZ (2 horas) - CRÍTICO

**Objetivo:** SEO 45 → 90 (+45 pontos)

### Day 1 Morning (1h)
- [ ] Criar arquivo `lib/seo/metadata.ts`
  ```typescript
  export const pageMetadata = {
    home: {
      title: 'ServiceDesk Pro - Sistema ITIL Completo',
      description: 'Gestão profissional de tickets com IA, SLA tracking, CMDB e Knowledge Base. Conforme ITIL v4 e LGPD.',
    },
    // ... 30 páginas
  }
  ```

- [ ] Aplicar metadata em páginas principais:
  - [ ] `/app/page.tsx`
  - [ ] `/app/portal/page.tsx`
  - [ ] `/app/portal/knowledge/page.tsx`
  - [ ] `/app/admin/dashboard/itil/page.tsx`
  - [ ] `/app/analytics/page.tsx`
  - [ ] `/app/portal/tickets/page.tsx`
  - [ ] `/app/admin/tickets/page.tsx`
  - [ ] `/app/admin/users/page.tsx`
  - [ ] `/app/admin/settings/page.tsx`
  - [ ] `/app/admin/teams/page.tsx`

- [ ] Criar `public/sitemap.xml`
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://servicedesk.com/</loc>
      <lastmod>2025-12-25</lastmod>
      <priority>1.0</priority>
    </url>
    <!-- ... outras páginas -->
  </urlset>
  ```

- [ ] Criar `public/robots.txt`
  ```txt
  User-agent: *
  Allow: /
  Sitemap: https://servicedesk.com/sitemap.xml
  ```

### Day 1 Afternoon (1h)
- [ ] Garantir H1 único em cada página (verificar com regex: `<h1.*?>`)
- [ ] Adicionar structured data (JSON-LD) na landing page
  ```typescript
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ServiceDesk Pro",
    "applicationCategory": "BusinessApplication"
  })}
  </script>
  ```

- [ ] Executar validação SEO:
  ```bash
  npm run lighthouse:all
  # Verificar score SEO ≥90
  ```

**Validação de sucesso:** SEO score ≥90 em todas as páginas

---

## SPRINT 2: ACCESSIBILITY AUDIT (4 horas) - CRÍTICO

**Objetivo:** Accessibility 75 → 95 (+20 pontos)

### Day 2 Morning (2h)
- [ ] Executar auditoria automatizada:
  ```bash
  npm run test:a11y:automated
  ```

- [ ] Adicionar alt text em todas as imagens:
  ```bash
  # Buscar imagens sem alt
  grep -r '<img' app/ --include="*.tsx" | grep -v 'alt='
  ```

- [ ] Corrigir todas as ocorrências:
  - [ ] `/app/page.tsx`
  - [ ] `/app/portal/page.tsx`
  - [ ] `/src/components/**/*.tsx`
  - [ ] `/components/ui/**/*.tsx`

### Day 2 Afternoon (2h)
- [ ] Auditar formulários (buscar inputs sem label):
  ```bash
  grep -r '<input' app/ --include="*.tsx" | grep -v 'aria-label'
  ```

- [ ] Adicionar labels/ARIA em formulários:
  - [ ] `/app/auth/login/page.tsx`
  - [ ] `/app/auth/register/page.tsx`
  - [ ] `/app/portal/create/page.tsx`
  - [ ] `/src/components/tickets/TicketForm.tsx`
  - [ ] `/app/admin/users/new/page.tsx`
  - [ ] `/app/admin/settings/**/*.tsx`

- [ ] Verificar contraste de cores:
  ```bash
  # Usar WAVE extension ou:
  npm run test:a11y:contrast
  ```

- [ ] Adicionar ARIA attributes em componentes interativos:
  ```typescript
  // Buttons
  <button aria-label="Fechar modal">X</button>

  // Navigation
  <nav aria-label="Menu principal">...</nav>

  // Sections
  <section aria-labelledby="titulo-secao">...</section>
  ```

- [ ] Executar re-validação:
  ```bash
  npm run test:a11y
  npm run lighthouse:all
  # Verificar score A11y ≥95
  ```

**Validação de sucesso:** Accessibility score ≥95 em todas as páginas

---

## SPRINT 3: PERFORMANCE POLISH (3 horas) - ALTA

**Objetivo:** Performance 86 → 92 (+6 pontos)

### Day 3 Morning (1.5h)
- [ ] Analisar bundle size:
  ```bash
  npm run build:analyze
  # Abrir http://localhost:8888
  ```

- [ ] Identificar bundles grandes (>100KB):
  - [ ] Anotar top 5 maiores chunks
  - [ ] Verificar libraries importadas

- [ ] Implementar code splitting adicional:
  ```typescript
  // Antes
  import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder'

  // Depois
  const WorkflowBuilder = lazy(() => import('@/components/workflow/WorkflowBuilder'))
  ```

- [ ] Aplicar lazy loading em componentes restantes:
  - [ ] Componentes de dashboards
  - [ ] Componentes de relatórios
  - [ ] Componentes de analytics

### Day 3 Afternoon (1.5h)
- [ ] Identificar JavaScript não usado (Chrome DevTools Coverage):
  1. Abrir DevTools > Coverage
  2. Recarregar página
  3. Identificar arquivos com <50% de uso
  4. Remover imports desnecessários

- [ ] Otimizar TTFB (Time to First Byte):
  - [ ] Implementar SSR em páginas CSR restantes
  - [ ] Adicionar `export const dynamic = 'force-static'` onde possível
  - [ ] Implementar ISR (Incremental Static Regeneration):
    ```typescript
    export const revalidate = 3600 // 1 hora
    ```

- [ ] Adicionar resource hints:
  ```typescript
  // Em app/layout.tsx
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="dns-prefetch" href="https://api.servicedesk.com" />
  ```

- [ ] Executar validação final:
  ```bash
  npm run lighthouse:all
  # Verificar score Performance ≥90
  ```

**Validação de sucesso:** Performance score ≥90 em todas as páginas

---

## VALIDAÇÃO FINAL (30 minutos)

### Executar suite completa de testes
```bash
# 1. Performance
npm run lighthouse:all

# 2. Accessibility
npm run test:a11y

# 3. Validação consolidada
npm run perf:validate
```

### Verificar scores finais
- [ ] Performance: ≥90/100
- [ ] Accessibility: ≥95/100
- [ ] Best Practices: ≥90/100 (já atingido)
- [ ] SEO: ≥90/100

### Gerar relatório final
```bash
# Criar relatório de conquistas
cat AGENT_24_LIGHTHOUSE_PERFORMANCE_REPORT.md
```

---

## QUICK REFERENCE

### Comandos úteis
```bash
# Executar todos os testes Lighthouse
npm run lighthouse:all

# Executar validação CI
npm run lighthouse:validate

# Análise de bundle
npm run build:analyze

# Testes de acessibilidade
npm run test:a11y
npm run test:a11y:automated
npm run test:a11y:contrast

# Health check
npm run check:health
```

### Arquivos importantes
- Relatório principal: `/AGENT_24_LIGHTHOUSE_PERFORMANCE_REPORT.md`
- Dados raw: `/reports/lighthouse-summary.json`
- Script de testes: `/scripts/lighthouse-runner.ts`
- Script CI: `/scripts/lighthouse-ci-validation.sh`

### Thresholds configurados
```typescript
PERFORMANCE_THRESHOLD = 90
ACCESSIBILITY_THRESHOLD = 95
BEST_PRACTICES_THRESHOLD = 90
SEO_THRESHOLD = 90
```

---

## PROGRESSO

### Atual (Antes)
- [x] Performance: 86/100 ⚠️
- [x] Accessibility: 75/100 ❌
- [x] Best Practices: 100/100 ✅
- [x] SEO: 45/100 ❌

### Meta (Depois - 9h)
- [ ] Performance: 92/100 ✅
- [ ] Accessibility: 95/100 ✅
- [ ] Best Practices: 100/100 ✅
- [ ] SEO: 92/100 ✅

### Média Projetada: 94.75/100 🎉

---

## NOTAS

1. **SEO é quick win:** 2 horas para +45 pontos (maior ROI)
2. **Accessibility requer atenção:** 4 horas mas é crítico para WCAG compliance
3. **Performance já está bem:** Faltam apenas ajustes finais
4. **Best Practices já atingido:** Manter 100/100

**Prioridade de execução:** SPRINT 1 → SPRINT 2 → SPRINT 3

---

**Última atualização:** 2025-12-25
**Agent responsável:** Agent 24 - Performance Validation
