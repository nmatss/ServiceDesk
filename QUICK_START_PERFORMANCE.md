# Quick Start - Performance Optimization

## TL;DR - Como Usar as Otimizações

### 1. Lazy Loading de Componentes Pesados

```typescript
// ANTES ❌
import ReactQuill from 'react-quill'
import { LineChart } from 'recharts'

// DEPOIS ✅
import { LazyRichTextEditor, LazyLineChart } from '@/components/LazyComponents'
```

### 2. Imagens Otimizadas

```typescript
// ANTES ❌
<img src="/image.jpg" alt="..." />

// DEPOIS ✅
import OptimizedImage from '@/components/OptimizedImage'
<OptimizedImage src="/image.jpg" alt="..." width={800} height={600} />
```

### 3. API com Cache

```typescript
// ANTES ❌
const response = await fetch('/api/tickets')
const tickets = await response.json()

// DEPOIS ✅
import { get } from '@/lib/api/client'
const tickets = await get('/api/tickets', { cache: true, cacheTTL: 60000 })
```

### 4. Search com Debounce

```typescript
// ANTES ❌
<input onChange={(e) => search(e.target.value)} />

// DEPOIS ✅
import { useDebounce } from '@/lib/hooks/useOptimized'
const debouncedSearch = useDebounce(searchTerm, 500)
```

### 5. Listas com Paginação

```typescript
// ANTES ❌
{items.map(item => <Item key={item.id} {...item} />)}

// DEPOIS ✅
import { usePagination } from '@/lib/hooks/useOptimized'
const { paginatedData } = usePagination(items, 10)
{paginatedData.map(item => <Item key={item.id} {...item} />)}
```

---

## Validação Rápida

```bash
# 1. Build e analise
npm run build:analyze

# 2. Gere relatório
npm run perf:report

# 3. Lighthouse
npm run lighthouse
```

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `components/LazyComponents.tsx` | Lazy loading |
| `components/OptimizedImage.tsx` | Imagens otimizadas |
| `lib/api/client.ts` | API com cache |
| `lib/hooks/useOptimized.ts` | Performance hooks |
| `lib/performance/web-vitals.ts` | Monitoring |

---

## Checklist Antes de Deploy

- [ ] `npm run build:analyze` - Bundle < 500KB
- [ ] `npm run perf:report` - Sem warnings
- [ ] `npm run lighthouse` - Score > 90
- [ ] Lazy loading em componentes pesados
- [ ] Imagens com OptimizedImage
- [ ] API requests com cache

---

## Dúvidas?

Consulte:
- `PERFORMANCE_SUMMARY.md` - Resumo completo
- `PERFORMANCE_OPTIMIZATION.md` - Guia detalhado
- `examples/performance-examples.tsx` - Exemplos práticos
