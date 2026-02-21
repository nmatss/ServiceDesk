# Template para Novas Páginas Admin

Este template serve como base para criar novas páginas no painel administrativo do ServiceDesk.

## 📁 Estrutura de Arquivo

```tsx
'use client'

import AdminDashboard from '@/src/components/admin/AdminDashboard'
import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { AdminTable } from '@/src/components/admin/AdminTable'
import { useState, useEffect } from 'react'

export default function AdminNovaPaginaPage() {
  // Estados
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    // outros filtros
  })

  // Effects
  useEffect(() => {
    fetchData()
  }, [filters])

  // Funções
  const fetchData = async () => {
    setLoading(true)
    try {
      // Lógica para buscar dados
      // const response = await api.getData(filters)
      // setData(response.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    // Lógica para criar novo item
  }

  const handleEdit = (item: any) => {
    // Lógica para editar item
  }

  const handleDelete = (item: any) => {
    // Lógica para deletar item
  }

  // Definição das colunas da tabela
  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
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
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <AdminButton variant="secondary" size="sm" onClick={() => handleEdit(row)}>
            Editar
          </AdminButton>
          <AdminButton variant="danger" size="sm" onClick={() => handleDelete(row)}>
            Excluir
          </AdminButton>
        </div>
      ),
    },
  ]

  return (
    <AdminDashboard currentPage="nova-pagina">
      <div className="space-y-6">
        {/* Header da Página */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Título da Página
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Descrição da página e seu propósito
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">
            <AdminButton variant="secondary" onClick={() => {/* exportar */}}>
              Exportar
            </AdminButton>
            <AdminButton variant="primary" onClick={handleCreate}>
              Novo Item
            </AdminButton>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AdminCard className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">T</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {data.length}
                  </dd>
                </dl>
              </div>
            </div>
          </AdminCard>

          {/* Adicione mais cards de estatística conforme necessário */}
        </div>

        {/* Tabela Principal */}
        <AdminTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="Nenhum item encontrado"
          onRowClick={(row) => console.log('Item clicado:', row)}
        />

        {/* Filtros */}
        <AdminCard title="Filtros">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Digite para buscar..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="flex items-end">
              <AdminButton variant="primary" className="w-full" onClick={fetchData}>
                Aplicar Filtros
              </AdminButton>
            </div>
          </div>
        </AdminCard>
      </div>
    </AdminDashboard>
  )
}
```

## 🎯 Checklist para Nova Página

### Estrutura Básica
- [ ] Importar componentes necessários
- [ ] Definir estados (loading, data, filters)
- [ ] Implementar useEffect para carregar dados
- [ ] Criar funções de CRUD básicas
- [ ] Definir colunas da tabela

### Layout
- [ ] Header com título e descrição
- [ ] Botões de ação (criar, exportar)
- [ ] Cards de estatísticas
- [ ] Tabela principal
- [ ] Seção de filtros

### Funcionalidades
- [ ] Loading states
- [ ] Estados vazios
- [ ] Tratamento de erros
- [ ] Filtros funcionais
- [ ] Ações de linha (editar, excluir)

### Responsividade
- [ ] Grid responsivo para estatísticas
- [ ] Tabela responsiva
- [ ] Filtros adaptáveis
- [ ] Botões com tamanhos apropriados

### Acessibilidade
- [ ] Labels em formulários
- [ ] ARIA labels onde necessário
- [ ] Navegação por teclado
- [ ] Contraste adequado

## 📝 Exemplos de Uso

### Página de Categorias

```tsx
export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)

  const columns = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
    },
    {
      key: 'description',
      label: 'Descrição',
    },
    {
      key: 'ticketCount',
      label: 'Tickets',
      sortable: true,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (value: any, row: any) => (
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
  ]

  return (
    <AdminDashboard currentPage="categorias">
      {/* Implementação da página */}
    </AdminDashboard>
  )
}
```

### Página de Relatórios

```tsx
export default function AdminReportsPage() {
  const [reportData, setReportData] = useState(null)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })

  const handleGenerateReport = async () => {
    // Lógica para gerar relatório
  }

  return (
    <AdminDashboard currentPage="relatórios">
      <div className="space-y-6">
        {/* Filtros de data */}
        <AdminCard title="Período do Relatório">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Inicial
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Final
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <AdminButton variant="primary" onClick={handleGenerateReport}>
              Gerar Relatório
            </AdminButton>
          </div>
        </AdminCard>

        {/* Resultados do relatório */}
        {reportData && (
          <AdminCard title="Resultados">
            {/* Exibir dados do relatório */}
          </AdminCard>
        )}
      </div>
    </AdminDashboard>
  )
}
```

## 🔧 Configurações Adicionais

### Rota no App Router

```tsx
// app/admin/nova-pagina/page.tsx
export default function AdminNovaPaginaPage() {
  // Implementação da página
}
```

### Navegação no Sidebar

```tsx
// Atualizar AdminDashboard.tsx
const navigation = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon, current: false },
  { name: 'Usuários', href: '/admin/users', icon: UsersIcon, current: false },
  { name: 'Tickets', href: '/admin/tickets', icon: TicketIcon, current: false },
  { name: 'Nova Página', href: '/admin/nova-pagina', icon: NewIcon, current: false },
  // ...
]
```

### Permissões

```tsx
// Verificar permissões se necessário
export default function AdminNovaPaginaPage() {
  const user = useUser({ or: "redirect" })
  
  // Verificar se é admin
  const isAdmin = (user as any)?.serverMetadata?.isAdmin || user?.id === 'admin'
  
  if (!isAdmin) {
    return <div>Acesso negado</div>
  }

  // Resto da implementação
}
```

## 📚 Recursos Adicionais

- [Style Guide](./ADMIN_STYLE_GUIDE.md) - Padrões de design
- [Componentes](./src/components/admin/README.md) - Documentação dos componentes
- [Exemplos](./app/admin/) - Páginas existentes como referência

Use este template como base para criar novas páginas de forma consistente e seguindo os padrões estabelecidos do painel administrativo.

