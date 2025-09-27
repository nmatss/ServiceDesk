# Admin Panel Components

Este diretório contém todos os componentes reutilizáveis do painel administrativo do ServiceDesk.

## Estrutura

```
src/components/admin/
├── AdminDashboard.tsx    # Componente principal do dashboard
├── AdminCard.tsx         # Card reutilizável
├── AdminButton.tsx       # Botão com variantes
├── AdminTable.tsx        # Tabela com funcionalidades avançadas
├── AdminModal.tsx        # Modal reutilizável
├── AdminBreadcrumb.tsx   # Navegação breadcrumb
├── AdminNotification.tsx # Sistema de notificações
├── AdminLoading.tsx      # Estados de carregamento
└── README.md            # Esta documentação
```

## Componentes

### AdminDashboard

Componente principal que fornece a estrutura base do painel admin:
- Sidebar responsiva
- Header com busca e perfil
- Área de conteúdo principal
- Navegação entre páginas

**Props:**
- `currentPage?: string` - Página atual para highlight na navegação
- `children: React.ReactNode` - Conteúdo da página

**Exemplo:**
```tsx
<AdminDashboard currentPage="usuários">
  <div>Conteúdo da página</div>
</AdminDashboard>
```

### AdminCard

Card reutilizável para agrupar conteúdo:

**Props:**
- `title?: string` - Título do card
- `children: React.ReactNode` - Conteúdo do card
- `className?: string` - Classes CSS adicionais

**Exemplo:**
```tsx
<AdminCard title="Estatísticas" className="p-6">
  <div>Conteúdo do card</div>
</AdminCard>
```

### AdminButton

Botão com variantes e estados:

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger'` - Variante do botão
- `size?: 'sm' | 'md' | 'lg'` - Tamanho do botão
- `loading?: boolean` - Estado de carregamento
- `children: React.ReactNode` - Conteúdo do botão
- `className?: string` - Classes CSS adicionais
- `...props` - Props nativas do button

**Exemplo:**
```tsx
<AdminButton variant="primary" size="lg" loading={isLoading}>
  Salvar
</AdminButton>
```

### AdminTable

Tabela com funcionalidades avançadas:

**Props:**
- `columns: Column[]` - Definição das colunas
- `data: any[]` - Dados da tabela
- `loading?: boolean` - Estado de carregamento
- `emptyMessage?: string` - Mensagem quando vazio
- `onRowClick?: (row: any) => void` - Callback para clique na linha
- `sortable?: boolean` - Se permite ordenação
- `searchable?: boolean` - Se permite busca

**Exemplo:**
```tsx
const columns = [
  {
    key: 'name',
    label: 'Nome',
    sortable: true,
  },
  {
    key: 'email',
    label: 'Email',
    render: (value) => <span className="font-medium">{value}</span>
  }
];

<AdminTable
  columns={columns}
  data={users}
  loading={loading}
  onRowClick={(user) => console.log(user)}
/>
```

### AdminModal

Modal reutilizável:

**Props:**
- `isOpen: boolean` - Se o modal está aberto
- `onClose: () => void` - Callback para fechar
- `title?: string` - Título do modal
- `children: React.ReactNode` - Conteúdo do modal
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Tamanho do modal

**Exemplo:**
```tsx
<AdminModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Editar Usuário"
  size="lg"
>
  <form>Conteúdo do modal</form>
</AdminModal>
```

## Padrões de Design

### Cores

- **Primary**: `indigo-600` (botões principais, links)
- **Secondary**: `gray-200` (botões secundários)
- **Danger**: `red-600` (ações destrutivas)
- **Success**: `green-600` (confirmações)
- **Warning**: `yellow-600` (avisos)

### Espaçamento

- **Padding padrão**: `p-6` para cards
- **Margin entre seções**: `space-y-6`
- **Gap em grids**: `gap-5` ou `gap-6`

### Tipografia

- **Títulos principais**: `text-2xl font-bold`
- **Títulos de seção**: `text-lg font-medium`
- **Texto padrão**: `text-sm text-gray-900`
- **Texto secundário**: `text-sm text-gray-500`

### Estados

- **Loading**: Spinner + texto "Carregando..."
- **Empty**: Mensagem centralizada
- **Error**: Mensagem de erro com ícone
- **Success**: Feedback visual positivo

## Responsividade

Todos os componentes seguem o padrão mobile-first:

- **Mobile**: Layout em coluna única
- **Tablet**: Grid de 2 colunas
- **Desktop**: Grid de 4+ colunas

### Breakpoints Tailwind

- `sm`: 640px+
- `md`: 768px+
- `lg`: 1024px+
- `xl`: 1280px+

## Acessibilidade

- Todos os botões têm `aria-label` quando necessário
- Formulários têm labels associados
- Modais têm foco trap
- Tabelas têm headers apropriados
- Cores têm contraste adequado

## Performance

- Componentes são memoizados quando apropriado
- Lazy loading para modais pesados
- Debounce em campos de busca
- Paginação para listas grandes

## Exemplos de Uso

### Página de Usuários

```tsx
export default function UsersPage() {
  return (
    <AdminDashboard currentPage="usuários">
      <div className="space-y-6">
        <AdminCard title="Lista de Usuários">
          <AdminTable
            columns={userColumns}
            data={users}
            loading={loading}
          />
        </AdminCard>
      </div>
    </AdminDashboard>
  );
}
```

### Formulário com Modal

```tsx
export default function CreateUser() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <AdminButton onClick={() => setIsModalOpen(true)}>
        Novo Usuário
      </AdminButton>
      
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Criar Usuário"
      >
        <form>
          {/* Campos do formulário */}
        </form>
      </AdminModal>
    </>
  );
}
```

## Manutenção

- Sempre use TypeScript para type safety
- Mantenha componentes pequenos e focados
- Documente props complexas
- Teste responsividade em diferentes dispositivos
- Valide acessibilidade com screen readers

