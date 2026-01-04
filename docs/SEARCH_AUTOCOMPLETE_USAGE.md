# 📖 DOCUMENTAÇÃO DE USO - SEARCH AUTOCOMPLETE

**Agent 34 Implementation**
**Versão**: 1.0.0
**Data**: 2025-12-26

---

## 🎯 VISÃO GERAL

O sistema de busca com autocomplete fornece sugestões em tempo real enquanto o usuário digita, facilitando a navegação e descoberta de conteúdo na plataforma ServiceDesk.

### Características Principais
- ⚡ Sugestões instantâneas
- 🎯 Busca multi-entidade (tickets, users, categories, KB)
- ⌨️ Navegação por teclado completa
- 📱 Suporte mobile otimizado
- 🎨 Agrupamento visual por tipo
- 💾 Cache inteligente
- 🔐 Segurança role-based

---

## 🚀 QUICK START

### Para Usuários Finais

#### Desktop
1. Localize o campo de busca no header (topo da página)
2. Digite pelo menos 2 caracteres
3. Aguarde as sugestões aparecerem (300ms)
4. Use mouse ou teclado para selecionar
5. Pressione Enter ou clique para navegar

#### Mobile
1. Toque no ícone de busca 🔍
2. Digite sua query
3. Toque na sugestão desejada
4. Feche com X se necessário

### Para Desenvolvedores

#### Importar o Componente
```typescript
import GlobalSearchWithAutocomplete from '@/src/components/search/GlobalSearchWithAutocomplete'
```

#### Uso Básico
```tsx
<GlobalSearchWithAutocomplete
  placeholder="Buscar tickets, artigos, usuários..."
/>
```

#### Uso Avançado
```tsx
<GlobalSearchWithAutocomplete
  placeholder="Buscar..."
  className="w-full md:w-96"
  isMobile={false}
  autoFocus={true}
  onClose={() => console.log('Closed')}
/>
```

---

## 📋 API REFERENCE

### Componente: GlobalSearchWithAutocomplete

#### Props
```typescript
interface GlobalSearchWithAutocompleteProps {
  /** CSS classes adicionais */
  className?: string

  /** Texto placeholder do input */
  placeholder?: string

  /** Ativa modo mobile (fullscreen overlay) */
  isMobile?: boolean

  /** Callback quando busca é fechada (mobile) */
  onClose?: () => void

  /** Auto-focus no input ao montar */
  autoFocus?: boolean
}
```

#### Exemplo Completo
```tsx
function MyHeader() {
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  return (
    <header>
      {/* Desktop Search */}
      <div className="hidden md:block">
        <GlobalSearchWithAutocomplete
          placeholder="Buscar tickets, artigos..."
          className="w-80"
        />
      </div>

      {/* Mobile Search Button */}
      <button
        className="md:hidden"
        onClick={() => setShowMobileSearch(true)}
      >
        🔍
      </button>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/50">
          <GlobalSearchWithAutocomplete
            placeholder="Buscar..."
            isMobile={true}
            autoFocus={true}
            onClose={() => setShowMobileSearch(false)}
          />
        </div>
      )}
    </header>
  )
}
```

---

### Hook: useDebouncedSearch

#### Importação
```typescript
import { useDebouncedSearch } from '@/lib/hooks/useDebouncedSearch'
```

#### Uso Básico
```tsx
function SearchComponent() {
  const {
    query,
    setQuery,
    suggestions,
    loading,
    showDropdown
  } = useDebouncedSearch()

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar..."
      />

      {loading && <Spinner />}

      {showDropdown && (
        <ul>
          {suggestions.map(s => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

#### Opções Avançadas
```tsx
const {
  query,
  setQuery,
  suggestions,
  relatedTerms,
  loading,
  error,
  showDropdown,
  setShowDropdown,
  clear,
  search
} = useDebouncedSearch({
  delay: 500,              // Debounce de 500ms
  minLength: 3,            // Mínimo 3 caracteres
  type: 'tickets',         // Buscar apenas tickets
  limit: 20,               // Máximo 20 resultados
  enableCache: true,       // Ativar cache

  // Callbacks
  onSearch: (q) => {
    console.log('Searching for:', q)
  },
  onSelect: (suggestion) => {
    console.log('Selected:', suggestion)
  }
})
```

#### Interface Completa
```typescript
interface UseDebouncedSearchReturn {
  // Estado
  query: string
  suggestions: SearchSuggestion[]
  relatedTerms: string[]
  loading: boolean
  error: string | null
  showDropdown: boolean

  // Ações
  setQuery: (query: string) => void
  setShowDropdown: (show: boolean) => void
  clear: () => void
  search: (q?: string) => void
}
```

---

### API Endpoint: /api/search/suggestions

#### Request
```typescript
GET /api/search/suggestions?q={query}&type={type}&limit={limit}

// Headers
Authorization: Bearer {jwt_token}
// ou
Cookie: auth_token={jwt_token}
```

#### Parâmetros
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `q` | string | - | Query de busca (min 2 chars) |
| `type` | string | 'all' | Tipo: all\|tickets\|users\|categories\|knowledge |
| `limit` | number | 10 | Máximo de resultados (max 50) |

#### Response Success (200)
```json
{
  "success": true,
  "suggestions": [
    {
      "type": "ticket",
      "id": 123,
      "title": "Problema com login",
      "subtitle": "Ticket #123 • aberto • alta",
      "url": "/tickets/123",
      "icon": "TicketIcon",
      "priority": "high"
    },
    {
      "type": "knowledge",
      "id": 45,
      "title": "Como fazer login",
      "subtitle": "Artigo da base de conhecimento",
      "url": "/knowledge/45",
      "icon": "BookOpenIcon"
    }
  ],
  "relatedTerms": ["autenticação", "senha"],
  "query": "login",
  "total": 2
}
```

#### Response Error (401)
```json
{
  "error": "Token de autenticação necessário"
}
```

#### Response Error (500)
```json
{
  "error": "Erro interno do servidor"
}
```

---

## 🎨 CUSTOMIZAÇÃO

### Estilização

#### CSS Classes Disponíveis
O componente usa Tailwind CSS. Você pode customizar via `className` prop:

```tsx
<GlobalSearchWithAutocomplete
  className="w-full max-w-lg shadow-xl"
/>
```

#### Cores do Tema
```css
/* Highlight de busca */
.bg-warning-200 { background: #fef3c7; }
.dark .bg-warning-900/30 { background: rgba(120, 53, 15, 0.3); }

/* Item selecionado */
.bg-brand-50 { background: #eff6ff; }
.dark .bg-brand-900/20 { background: rgba(30, 58, 138, 0.2); }

/* Loading spinner */
.border-brand-500 { border-color: #3b82f6; }
```

#### Personalizar Ícones
```typescript
// No componente GlobalSearchWithAutocomplete.tsx
const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    TicketIcon,
    UserIcon,
    FolderIcon,
    BookOpenIcon,
    CustomIcon,  // Adicione aqui
  }
  return icons[iconName] || MagnifyingGlassIcon
}
```

### Personalizar Labels

```typescript
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    ticket: 'Chamados',      // Customizado
    user: 'Usuários',
    category: 'Categorias',
    knowledge: 'Artigos',
    custom: 'Customizado',   // Novo tipo
  }
  return labels[type] || type
}
```

---

## ⌨️ ATALHOS DE TECLADO

| Tecla | Ação |
|-------|------|
| `↓` | Selecionar próxima sugestão |
| `↑` | Selecionar sugestão anterior |
| `Enter` | Navegar para sugestão selecionada ou buscar |
| `Escape` | Fechar dropdown |
| `Tab` | Sair do campo de busca |
| `Ctrl/Cmd + K` | Focar no campo de busca (futuro) |

---

## 📱 COMPORTAMENTO MOBILE

### Breakpoints
```css
/* Mobile: < 640px */
sm:hidden        → Mostra ícone de busca
sm:block         → Esconde ícone, mostra input

/* Tablet: 640px - 768px */
md:w-64          → Input com 256px

/* Desktop: > 1024px */
lg:w-80          → Input com 320px
```

### Touch Targets
Todos os elementos interativos têm mínimo 44x44px:
```css
.min-h-touch { min-height: 44px; }
.min-w-touch { min-width: 44px; }
```

---

## 🔐 CONTROLE DE ACESSO

### Permissões por Role

#### Admin
```typescript
// Vê TUDO
- Tickets (todos)
- Usuários ✅
- Categorias
- Base de Conhecimento
```

#### Agent
```typescript
// Vê tickets atribuídos + criados
- Tickets (assigned_to ou created_by)
- Usuários ❌
- Categorias
- Base de Conhecimento
```

#### User
```typescript
// Vê apenas seus tickets
- Tickets (created_by)
- Usuários ❌
- Categorias
- Base de Conhecimento
```

### Implementação
```typescript
// No backend (route.ts)
if (type === 'users' && user.role !== 'admin') {
  // Não retorna usuários para não-admins
  return []
}

if (type === 'tickets') {
  // Filtro por role
  WHERE (
    ? = 'admin' OR
    created_by = ? OR
    assigned_to = ?
  )
}
```

---

## 💾 CACHE E PERFORMANCE

### Estratégia de Cache

#### In-Memory Cache
```typescript
// Cache de 5 minutos
const CACHE_TTL = 5 * 60 * 1000 // 300000ms

// Cache key format
const cacheKey = `${query}:${type}:${limit}`
// Exemplo: "login:all:10"
```

#### Limpeza Automática
```typescript
// Mantém apenas últimos 50 resultados
if (searchCache.size > 50) {
  // Remove mais antigos
  entries.sort((a, b) => b.timestamp - a.timestamp)
  entries.slice(50).forEach(([key]) => cache.delete(key))
}
```

### Debounce

```typescript
// Aguarda 300ms após última tecla
const debounceTimerRef = useRef<NodeJS.Timeout>()

useEffect(() => {
  clearTimeout(debounceTimerRef.current)

  debounceTimerRef.current = setTimeout(() => {
    fetchSuggestions(query)
  }, 300)
}, [query])
```

### Request Cancellation

```typescript
// Cancela requisições obsoletas
const abortControllerRef = useRef<AbortController>()

// Cancela anterior
abortControllerRef.current?.abort()

// Nova requisição
abortControllerRef.current = new AbortController()
fetch(url, { signal: abortControllerRef.current.signal })
```

---

## 🐛 TROUBLESHOOTING

### Problema: Dropdown não aparece

**Soluções**:
1. Verificar que digitou >= 2 caracteres
2. Verificar autenticação (JWT válido)
3. Verificar console do navegador (erros)
4. Verificar Network tab (requisição falhou?)

### Problema: Resultados duplicados

**Soluções**:
1. Limpar cache manualmente:
   ```typescript
   searchCache.clear()
   ```
2. Recarregar página (Ctrl+R)
3. Verificar lógica de deduplicação

### Problema: Lentidão

**Soluções**:
1. Verificar Network throttling (DevTools)
2. Reduzir `limit` de resultados
3. Aumentar `delay` de debounce
4. Verificar server performance (DB queries)

### Problema: Keyboard navigation quebrada

**Soluções**:
1. Verificar que dropdown está aberto
2. Verificar que há sugestões
3. Testar em navegador diferente
4. Verificar console (JavaScript errors)

### Problema: Cache não funciona

**Soluções**:
1. Verificar `enableCache: true`
2. Verificar TTL não expirou
3. Verificar cache key (query, type, limit)
4. Limpar cache e testar novamente

---

## 📊 ANALYTICS (Futuro)

### Trackear Eventos
```typescript
// Exemplo de implementação futura
useDebouncedSearch({
  onSearch: (query) => {
    analytics.track('search_performed', {
      query,
      timestamp: Date.now()
    })
  },
  onSelect: (suggestion) => {
    analytics.track('search_result_clicked', {
      type: suggestion.type,
      id: suggestion.id,
      position: index
    })
  }
})
```

### Métricas Sugeridas
- Total de buscas
- Termos mais buscados
- Taxa de clique (CTR)
- Posição média de clique
- Buscas sem resultado
- Tempo até seleção

---

## 🧪 TESTES

### Teste Manual Rápido
```bash
# 1. Iniciar dev server
npm run dev

# 2. Abrir browser
http://localhost:3000

# 3. Login
admin@servicedesk.com / Admin123!

# 4. Buscar
Digite: "ticket"

# 5. Verificar
✅ Dropdown aparece
✅ Sugestões corretas
✅ Keyboard navigation
✅ Click funciona
```

### Teste de Performance
```javascript
// Console do navegador
console.time('search')
// Digite busca
console.timeEnd('search')
// Deve ser < 500ms
```

### Teste de Cache
```javascript
// 1ª busca
console.time('first')
// Digite: "login"
console.timeEnd('first')  // ~150ms

// 2ª busca (mesmo termo)
console.time('second')
// Digite: "login"
console.timeEnd('second')  // ~5ms (cache!)
```

---

## 📚 RECURSOS ADICIONAIS

### Arquivos Relacionados
```
/app/api/search/suggestions/route.ts      # API endpoint
/lib/hooks/useDebouncedSearch.ts          # Hook customizado
/src/components/search/                   # Componentes
  └─ GlobalSearchWithAutocomplete.tsx
/src/components/layout/Header.tsx         # Integração
```

### Documentação Adicional
- [AGENT_34_SEARCH_AUTOCOMPLETE_REPORT.md](../AGENT_34_SEARCH_AUTOCOMPLETE_REPORT.md) - Relatório completo
- [SEARCH_AUTOCOMPLETE_TESTING_GUIDE.md](../SEARCH_AUTOCOMPLETE_TESTING_GUIDE.md) - Guia de testes
- [CLAUDE.md](../CLAUDE.md) - Documentação geral do projeto

### Bibliotecas Utilizadas
- React 18+
- Next.js 15
- TypeScript 5+
- Tailwind CSS 3+
- Heroicons
- SQLite (database)

---

## 🤝 CONTRIBUINDO

### Adicionar Novo Tipo de Sugestão

#### 1. Backend (API)
```typescript
// app/api/search/suggestions/route.ts
if (type === 'all' || type === 'custom') {
  const customSuggestions = db.prepare(`
    SELECT * FROM custom_table
    WHERE name LIKE ?
    LIMIT ?
  `).all(`%${query}%`, limit)

  suggestions.push(...customSuggestions.map(item => ({
    type: 'custom',
    id: item.id,
    title: item.name,
    subtitle: item.description,
    url: `/custom/${item.id}`,
    icon: 'CustomIcon'
  })))
}
```

#### 2. Frontend (Componente)
```typescript
// src/components/search/GlobalSearchWithAutocomplete.tsx
const getIconComponent = (iconName: string) => {
  const icons = {
    // ... outros ícones
    CustomIcon: CustomIcon,
  }
  return icons[iconName] || MagnifyingGlassIcon
}

const getTypeLabel = (type: string): string => {
  const labels = {
    // ... outros labels
    custom: 'Customizado',
  }
  return labels[type] || type
}
```

#### 3. TypeScript (Tipos)
```typescript
// lib/hooks/useDebouncedSearch.ts
export interface SearchSuggestion {
  type: 'ticket' | 'user' | 'category' | 'knowledge' | 'custom'
  // ... resto
}
```

---

## 📞 SUPORTE

### Perguntas Frequentes

**Q: Posso desabilitar o cache?**
```typescript
useDebouncedSearch({ enableCache: false })
```

**Q: Como mudar o debounce delay?**
```typescript
useDebouncedSearch({ delay: 500 }) // 500ms
```

**Q: Como filtrar por tipo específico?**
```typescript
useDebouncedSearch({ type: 'tickets' })
```

**Q: Como aumentar limite de resultados?**
```typescript
useDebouncedSearch({ limit: 20 })
// Max: 50
```

**Q: Como trackear analytics?**
```typescript
useDebouncedSearch({
  onSearch: (q) => analytics.track('search', { q }),
  onSelect: (s) => analytics.track('select', { s })
})
```

---

## 🎉 CONCLUSÃO

A busca com autocomplete está pronta para produção com:
- ✅ Performance otimizada
- ✅ UX excepcional
- ✅ Segurança robusta
- ✅ Acessibilidade completa
- ✅ Documentação extensa

**Happy Coding!** 🚀

---

**Última atualização**: 2025-12-26
**Versão**: 1.0.0
**Autor**: Agent 34
