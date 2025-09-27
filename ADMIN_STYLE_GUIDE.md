# ServiceDesk Admin Panel - Style Guide

Este documento define os padrões de design, componentes e convenções para o painel administrativo do ServiceDesk.

## 🎨 Design System

### Cores Primárias

```css
/* Cores principais */
--primary-50: #eef2ff;
--primary-100: #e0e7ff;
--primary-500: #6366f1;
--primary-600: #4f46e5;
--primary-700: #4338ca;

/* Cores de estado */
--success-500: #10b981;
--warning-500: #f59e0b;
--danger-500: #ef4444;
--info-500: #3b82f6;

/* Cores neutras */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### Tipografia

```css
/* Hierarquia de títulos */
.heading-1 { @apply text-3xl font-bold text-gray-900; }
.heading-2 { @apply text-2xl font-bold text-gray-900; }
.heading-3 { @apply text-xl font-semibold text-gray-900; }
.heading-4 { @apply text-lg font-medium text-gray-900; }

/* Texto do corpo */
.body-large { @apply text-base text-gray-900; }
.body-medium { @apply text-sm text-gray-900; }
.body-small { @apply text-xs text-gray-900; }

/* Texto secundário */
.text-secondary { @apply text-gray-500; }
.text-muted { @apply text-gray-400; }
```

### Espaçamento

```css
/* Sistema de espaçamento baseado em 4px */
.space-xs { @apply space-y-1; }    /* 4px */
.space-sm { @apply space-y-2; }    /* 8px */
.space-md { @apply space-y-4; }    /* 16px */
.space-lg { @apply space-y-6; }    /* 24px */
.space-xl { @apply space-y-8; }    /* 32px */
.space-2xl { @apply space-y-12; }  /* 48px */
```

## 🧩 Componentes

### Botões

#### Variantes

```tsx
// Primary - Ação principal
<AdminButton variant="primary">Salvar</AdminButton>

// Secondary - Ação secundária
<AdminButton variant="secondary">Cancelar</AdminButton>

// Danger - Ação destrutiva
<AdminButton variant="danger">Excluir</AdminButton>
```

#### Tamanhos

```tsx
// Small - Para tabelas e formulários compactos
<AdminButton size="sm">Editar</AdminButton>

// Medium - Tamanho padrão
<AdminButton size="md">Salvar</AdminButton>

// Large - Para CTAs principais
<AdminButton size="lg">Criar Novo</AdminButton>
```

#### Estados

```tsx
// Loading
<AdminButton loading={true}>Processando...</AdminButton>

// Disabled
<AdminButton disabled={true}>Indisponível</AdminButton>
```

### Cards

#### Estrutura Básica

```tsx
<AdminCard title="Título do Card">
  <div className="space-y-4">
    {/* Conteúdo do card */}
  </div>
</AdminCard>
```

#### Cards de Estatística

```tsx
<AdminCard className="p-6">
  <div className="flex items-center">
    <div className="flex-shrink-0">
      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
        <span className="text-white text-sm font-medium">I</span>
      </div>
    </div>
    <div className="ml-5 w-0 flex-1">
      <dl>
        <dt className="text-sm font-medium text-gray-500 truncate">
          Label
        </dt>
        <dd className="text-2xl font-semibold text-gray-900">
          Valor
        </dd>
      </dl>
    </div>
  </div>
</AdminCard>
```

### Tabelas

#### Estrutura Básica

```tsx
<AdminTable
  columns={columns}
  data={data}
  loading={loading}
  emptyMessage="Nenhum item encontrado"
/>
```

#### Definição de Colunas

```tsx
const columns = [
  {
    key: 'name',
    label: 'Nome',
    sortable: true,
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        value === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {value}
      </span>
    ),
  },
  {
    key: 'actions',
    label: 'Ações',
    render: (value, row) => (
      <div className="flex space-x-2">
        <AdminButton variant="secondary" size="sm">
          Editar
        </AdminButton>
        <AdminButton variant="danger" size="sm">
          Excluir
        </AdminButton>
      </div>
    ),
  },
];
```

### Modais

#### Estrutura Básica

```tsx
<AdminModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título do Modal"
  size="lg"
>
  <form className="space-y-4">
    {/* Conteúdo do modal */}
  </form>
</AdminModal>
```

#### Tamanhos

```tsx
// Small - Para confirmações simples
<AdminModal size="sm">Conteúdo</AdminModal>

// Medium - Para formulários simples
<AdminModal size="md">Conteúdo</AdminModal>

// Large - Para formulários complexos
<AdminModal size="lg">Conteúdo</AdminModal>

// Extra Large - Para visualizações detalhadas
<AdminModal size="xl">Conteúdo</AdminModal>
```

## 📱 Layout e Responsividade

### Grid System

```tsx
// Grid responsivo padrão
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
  {/* Cards */}
</div>

// Grid para estatísticas
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
  <AdminCard className="p-6">
    {/* Estatística */}
  </AdminCard>
</div>
```

### Breakpoints

| Breakpoint | Tamanho | Uso |
|------------|---------|-----|
| `sm` | 640px+ | Tablets pequenos |
| `md` | 768px+ | Tablets |
| `lg` | 1024px+ | Desktops |
| `xl` | 1280px+ | Desktops grandes |

### Layout de Páginas

```tsx
export default function AdminPage() {
  return (
    <AdminDashboard currentPage="página-atual">
      <div className="space-y-6">
        {/* Header da página */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Título da Página
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Descrição da página
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">
            <AdminButton variant="secondary">Ação Secundária</AdminButton>
            <AdminButton variant="primary">Ação Principal</AdminButton>
          </div>
        </div>

        {/* Conteúdo da página */}
        <AdminCard title="Conteúdo Principal">
          {/* Conteúdo */}
        </AdminCard>
      </div>
    </AdminDashboard>
  );
}
```

## 🎯 Estados e Feedback

### Estados de Loading

```tsx
// Botão com loading
<AdminButton loading={isLoading}>
  {isLoading ? 'Salvando...' : 'Salvar'}
</AdminButton>

// Tabela com loading
<AdminTable
  columns={columns}
  data={data}
  loading={isLoading}
/>

// Card com loading
<AdminCard>
  {isLoading ? (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  ) : (
    <div>Conteúdo carregado</div>
  )}
</AdminCard>
```

### Estados Vazios

```tsx
// Estado vazio em tabela
<AdminTable
  columns={columns}
  data={[]}
  emptyMessage="Nenhum item encontrado"
/>

// Estado vazio customizado
<div className="text-center py-12">
  <div className="mx-auto h-12 w-12 text-gray-400">
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  </div>
  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum item</h3>
  <p className="mt-1 text-sm text-gray-500">Comece criando um novo item.</p>
  <div className="mt-6">
    <AdminButton variant="primary">Novo Item</AdminButton>
  </div>
</div>
```

### Notificações

```tsx
// Notificação de sucesso
<AdminNotification type="success">
  Operação realizada com sucesso!
</AdminNotification>

// Notificação de erro
<AdminNotification type="error">
  Ocorreu um erro ao processar a solicitação.
</AdminNotification>

// Notificação de aviso
<AdminNotification type="warning">
  Esta ação não pode ser desfeita.
</AdminNotification>
```

## 🔍 Formulários

### Estrutura Básica

```tsx
<form className="space-y-6">
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Nome
      </label>
      <input
        type="text"
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        placeholder="Digite o nome"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Email
      </label>
      <input
        type="email"
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        placeholder="Digite o email"
      />
    </div>
  </div>
  
  <div className="flex justify-end space-x-3">
    <AdminButton variant="secondary">Cancelar</AdminButton>
    <AdminButton variant="primary">Salvar</AdminButton>
  </div>
</form>
```

### Validação

```tsx
// Campo com erro
<div>
  <label className="block text-sm font-medium text-gray-700">
    Email
  </label>
  <input
    type="email"
    className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
    placeholder="Digite o email"
  />
  <p className="mt-1 text-sm text-red-600">
    Email é obrigatório
  </p>
</div>
```

## 🎨 Badges e Status

### Status de Tickets

```tsx
// Status com cores
const getStatusBadge = (status: string) => {
  const styles = {
    'Aberto': 'bg-red-100 text-red-800',
    'Em Andamento': 'bg-yellow-100 text-yellow-800',
    'Pendente': 'bg-gray-100 text-gray-800',
    'Fechado': 'bg-green-100 text-green-800',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
};
```

### Prioridades

```tsx
// Prioridades com cores
const getPriorityBadge = (priority: string) => {
  const styles = {
    'Crítica': 'bg-red-100 text-red-800',
    'Alta': 'bg-orange-100 text-orange-800',
    'Média': 'bg-yellow-100 text-yellow-800',
    'Baixa': 'bg-green-100 text-green-800',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority]}`}>
      {priority}
    </span>
  );
};
```

## 📊 Gráficos e Visualizações

### Barras de Progresso

```tsx
// Barra de progresso simples
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="bg-indigo-600 h-2 rounded-full"
    style={{ width: '75%' }}
  ></div>
</div>

// Barra com label
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-600">Progresso</span>
    <span className="text-sm font-medium">75%</span>
  </div>
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-indigo-600 h-2 rounded-full"
      style={{ width: '75%' }}
    ></div>
  </div>
</div>
```

### Estatísticas com Ícones

```tsx
// Card de estatística com ícone
<AdminCard className="p-6">
  <div className="flex items-center">
    <div className="flex-shrink-0">
      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
        <UsersIcon className="h-5 w-5 text-white" />
      </div>
    </div>
    <div className="ml-5 w-0 flex-1">
      <dl>
        <dt className="text-sm font-medium text-gray-500 truncate">
          Total de Usuários
        </dt>
        <dd className="text-2xl font-semibold text-gray-900">
          1,234
        </dd>
      </dl>
    </div>
  </div>
</AdminCard>
```

## 🚀 Performance e Otimização

### Lazy Loading

```tsx
// Componente com lazy loading
const AdminModal = lazy(() => import('./AdminModal'));

// Uso com Suspense
<Suspense fallback={<div>Carregando...</div>}>
  <AdminModal isOpen={isOpen} onClose={onClose}>
    Conteúdo
  </AdminModal>
</Suspense>
```

### Memoização

```tsx
// Componente memoizado
const AdminTable = memo(({ columns, data, loading }) => {
  return (
    <div>
      {/* Tabela */}
    </div>
  );
});

// Callback memoizado
const handleRowClick = useCallback((row) => {
  console.log('Row clicked:', row);
}, []);
```

## ✅ Checklist de Qualidade

### Antes de Commitar

- [ ] Componente responsivo em todos os breakpoints
- [ ] Estados de loading implementados
- [ ] Estados vazios tratados
- [ ] Validação de formulários
- [ ] Acessibilidade (ARIA labels, keyboard navigation)
- [ ] TypeScript sem erros
- [ ] Testes básicos funcionando
- [ ] Performance otimizada (memo, lazy loading)
- [ ] Documentação atualizada

### Padrões de Código

- [ ] Nomes descritivos para componentes e props
- [ ] Props opcionais com valores padrão
- [ ] Destructuring de props
- [ ] Hooks no topo do componente
- [ ] Event handlers com useCallback
- [ ] Cleanup de effects
- [ ] Error boundaries implementados

Este style guide deve ser seguido por todos os desenvolvedores trabalhando no painel administrativo para manter consistência e qualidade do código.

