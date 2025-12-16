# PLANO COMPLETO DE MELHORIAS - SERVICEDESK

**Data**: 2025-12-10
**Versao**: 1.0
**Escopo**: Backend + Frontend + Arquitetura + UX/UI

---

## SUMARIO EXECUTIVO

Apos analise profunda do codebase (200+ arquivos, 77 tabelas, 136 rotas API, 80+ componentes), identificamos que o sistema esta **~70% completo**. Este plano detalha melhorias em 8 areas principais para elevar a qualidade a nivel de producao.

### Estado Atual por Area

| Area | Completude | Status |
|------|-----------|--------|
| Tickets & Comments | 95% | Pronto |
| Autenticacao | 90% | Pronto |
| Knowledge Base | 75% | Melhorias necessarias |
| Notificacoes | 85% | Pronto |
| SLA | 90% | Pronto |
| Analytics/Reports | 40% | **CRITICO** |
| Workflows | 65% | **ALTA PRIORIDADE** |
| AI Features | 10% | **CRITICO** |

---

## FASE 1: FUNDACAO E CORRECOES CRITICAS (Prioridade Maxima)

### 1.1 Corrigir Arquitetura de Dados

**Problema**: Multi-tenant incompleto, tabelas faltando `organization_id`

**Acoes**:
```sql
-- Adicionar organization_id em tabelas faltantes
ALTER TABLE categories ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE priorities ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE statuses ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE sla_policies ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE ticket_templates ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE kb_categories ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- Criar indices para performance
CREATE INDEX idx_categories_org ON categories(organization_id);
CREATE INDEX idx_tickets_status_priority ON tickets(status_id, priority_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);
```

**Arquivos a modificar**:
- `lib/db/schema.sql` - Adicionar colunas e indices
- `lib/db/queries.ts` - Filtrar por organization_id em todas queries
- `lib/types/database.ts` - Atualizar interfaces

### 1.2 Implementar Tabelas Faltantes

**Tabelas a criar**:
```sql
-- Campos customizados (muito solicitado)
CREATE TABLE custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- text, number, date, select, multiselect
  options JSON, -- para select/multiselect
  required BOOLEAN DEFAULT false,
  entity_type VARCHAR(50) NOT NULL, -- ticket, user, organization
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  custom_field_id INTEGER NOT NULL REFERENCES custom_fields(id),
  entity_id INTEGER NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags para tickets
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B7280',
  UNIQUE(organization_id, name)
);

CREATE TABLE ticket_tags (
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (ticket_id, tag_id)
);

-- Followers de tickets
CREATE TABLE ticket_followers (
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, user_id)
);

-- Relacionamento entre tickets
CREATE TABLE ticket_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  target_ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  relationship_type VARCHAR(50) NOT NULL, -- parent, child, related, duplicate, blocks, blocked_by
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Macros/respostas rapidas
CREATE TABLE macros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  actions JSON, -- acoes automaticas (mudar status, atribuir, etc)
  created_by INTEGER REFERENCES users(id),
  is_shared BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 Remover Codigo Morto

**Arquivos a deletar**:
```
DELETE: final-migration.js
DELETE: fix-migration.js
DELETE: simple-migration.js
DELETE: scripts/migrate-multitenant-fixed.js
DELETE: scripts/migrate-multitenant.js
DELETE: scripts/run-migration.js
DELETE: scripts/run-missing-tables.js
DELETE: scripts/test-tenant-isolation.js
DELETE: lib/db/run-migration.js
DELETE: lib/validation/schemas.old.ts
DELETE: src/hooks/useDebounce.tsx
DELETE: src/lib/auth.ts
DELETE: src/middleware/auth.ts
DELETE: app/api/auth/test/route.ts
DELETE: app/api/protected/route.ts
```

---

## FASE 2: BACKEND - COMPLETAR APIs INCOMPLETAS

### 2.1 API de Tickets - Melhorias

**Arquivo**: `app/api/tickets/create/route.ts`

**Melhorias**:
```typescript
// Adicionar suporte a:
// 1. Tags
// 2. Custom fields
// 3. Followers
// 4. Relacionamentos
// 5. Macros application

interface CreateTicketRequest {
  title: string;
  description: string;
  category_id: number;
  priority_id: number;
  // NOVOS CAMPOS:
  tags?: number[];
  custom_fields?: { field_id: number; value: string }[];
  followers?: number[];
  related_tickets?: { ticket_id: number; type: string }[];
  apply_macro?: number;
}
```

**Novas rotas a criar**:
```
POST /api/tickets/[id]/tags - Adicionar/remover tags
POST /api/tickets/[id]/followers - Gerenciar followers
POST /api/tickets/[id]/relationships - Relacionar tickets
POST /api/tickets/[id]/merge - Mesclar tickets duplicados
POST /api/tickets/bulk - Operacoes em massa
GET  /api/tickets/export - Exportar tickets (CSV/Excel)
```

### 2.2 API de Analytics - IMPLEMENTAR (Critico)

**Problema**: Apenas framework, sem implementacao real

**Arquivo novo**: `app/api/analytics/tickets/route.ts`

```typescript
// GET /api/analytics/tickets
// Parametros: period (7d, 30d, 90d), groupBy (day, week, month)

interface TicketAnalytics {
  summary: {
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
    avg_resolution_time: number; // horas
    avg_first_response_time: number; // minutos
    sla_compliance_rate: number; // percentual
  };
  trends: {
    date: string;
    created: number;
    resolved: number;
    backlog: number;
  }[];
  distribution: {
    by_category: { name: string; count: number }[];
    by_priority: { name: string; count: number }[];
    by_status: { name: string; count: number }[];
    by_agent: { name: string; count: number; avg_time: number }[];
  };
  predictions: {
    expected_volume_next_week: number;
    at_risk_sla: { ticket_id: number; probability: number }[];
  };
}
```

**Implementar queries**:
```typescript
// lib/db/queries.ts - adicionar

export async function getTicketAnalytics(
  organizationId: number,
  period: '7d' | '30d' | '90d' | '1y'
): Promise<TicketAnalytics> {
  const startDate = getStartDate(period);

  // Query para summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_tickets,
      SUM(CASE WHEN status_id IN (1,2) THEN 1 ELSE 0 END) as open_tickets,
      SUM(CASE WHEN status_id IN (3,4) THEN 1 ELSE 0 END) as resolved_tickets,
      AVG(CASE WHEN resolved_at IS NOT NULL
        THEN (julianday(resolved_at) - julianday(created_at)) * 24
        ELSE NULL END) as avg_resolution_time,
      AVG(CASE WHEN first_response_at IS NOT NULL
        THEN (julianday(first_response_at) - julianday(created_at)) * 24 * 60
        ELSE NULL END) as avg_first_response_time
    FROM tickets
    WHERE organization_id = ? AND created_at >= ?
  `).get(organizationId, startDate);

  // Query para trends por dia
  const trends = db.prepare(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as created,
      SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
    FROM tickets
    WHERE organization_id = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(organizationId, startDate);

  // ... mais queries para distribution
}
```

### 2.3 API de Workflows - COMPLETAR

**Problema**: Execute route nao funciona

**Arquivo**: `app/api/workflows/execute/route.ts`

```typescript
// Implementar execucao real

import { workflowEngine } from '@/lib/workflow/engine';
import { db } from '@/lib/db/queries';

export async function POST(request: Request) {
  const { workflow_id, trigger_data, context } = await request.json();

  // 1. Buscar workflow do banco
  const workflow = await getWorkflowById(workflow_id);
  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  // 2. Criar execution record
  const executionId = await createWorkflowExecution({
    workflow_id,
    status: 'running',
    started_at: new Date(),
    trigger_data: JSON.stringify(trigger_data),
    context: JSON.stringify(context)
  });

  // 3. Executar workflow
  try {
    const result = await workflowEngine.execute(workflow, {
      ...context,
      executionId,
      triggerData: trigger_data
    });

    // 4. Atualizar execution com resultado
    await updateWorkflowExecution(executionId, {
      status: 'completed',
      completed_at: new Date(),
      result: JSON.stringify(result)
    });

    return NextResponse.json({ executionId, result });
  } catch (error) {
    await updateWorkflowExecution(executionId, {
      status: 'failed',
      completed_at: new Date(),
      error: error.message
    });
    throw error;
  }
}
```

**Novas queries necessarias**:
```typescript
// lib/db/queries.ts

export function getWorkflowById(id: number) {
  return db.prepare(`
    SELECT w.*,
      json_group_array(json_object(
        'id', ws.id,
        'type', ws.type,
        'config', ws.config,
        'position', ws.position
      )) as steps
    FROM workflows w
    LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
    WHERE w.id = ?
    GROUP BY w.id
  `).get(id);
}

export function createWorkflowExecution(data: WorkflowExecution) {
  return db.prepare(`
    INSERT INTO workflow_executions (workflow_id, status, started_at, trigger_data, context)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.workflow_id, data.status, data.started_at, data.trigger_data, data.context);
}

export function updateWorkflowExecution(id: number, data: Partial<WorkflowExecution>) {
  // ... implementar update
}
```

### 2.4 Sistema de Macros - NOVO

**Criar arquivo**: `app/api/macros/route.ts`

```typescript
// GET - Listar macros
// POST - Criar macro

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = getOrganizationId(request);
  const userId = getUserId(request);

  const macros = await getMacros(organizationId, userId);
  return NextResponse.json(macros);
}

export async function POST(request: Request) {
  const data = await request.json();
  const organizationId = getOrganizationId(request);
  const userId = getUserId(request);

  const macro = await createMacro({
    ...data,
    organization_id: organizationId,
    created_by: userId
  });

  return NextResponse.json(macro, { status: 201 });
}
```

**Criar arquivo**: `app/api/macros/[id]/apply/route.ts`

```typescript
// POST - Aplicar macro a um ticket

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { ticket_id } = await request.json();
  const macroId = parseInt(params.id);

  const macro = await getMacroById(macroId);
  if (!macro) {
    return NextResponse.json({ error: 'Macro not found' }, { status: 404 });
  }

  // Aplicar acoes do macro
  const actions = JSON.parse(macro.actions);

  for (const action of actions) {
    switch (action.type) {
      case 'set_status':
        await updateTicket(ticket_id, { status_id: action.value });
        break;
      case 'set_priority':
        await updateTicket(ticket_id, { priority_id: action.value });
        break;
      case 'assign':
        await updateTicket(ticket_id, { assigned_to: action.value });
        break;
      case 'add_comment':
        await addComment(ticket_id, { content: macro.content, is_internal: action.is_internal });
        break;
      case 'add_tags':
        await addTagsToTicket(ticket_id, action.tags);
        break;
    }
  }

  // Incrementar uso
  await incrementMacroUsage(macroId);

  return NextResponse.json({ success: true });
}
```

### 2.5 Sistema de Tags - NOVO

**Criar arquivo**: `app/api/tags/route.ts`

```typescript
// CRUD de tags

export async function GET(request: Request) {
  const organizationId = getOrganizationId(request);
  const tags = await getTags(organizationId);
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const { name, color } = await request.json();
  const organizationId = getOrganizationId(request);

  const tag = await createTag({ organization_id: organizationId, name, color });
  return NextResponse.json(tag, { status: 201 });
}
```

---

## FASE 3: FRONTEND - UNIFICAR DESIGN SYSTEM

### 3.1 Criar Design Tokens Centralizados

**Criar arquivo**: `lib/design-system/tokens.ts`

```typescript
// Design tokens centralizados

export const colors = {
  // Brand
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Status
  status: {
    open: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    inProgress: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    resolved: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    closed: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
    pending: { bg: '#fae8ff', text: '#86198f', border: '#e879f9' },
  },

  // Priority
  priority: {
    low: { bg: '#d1fae5', text: '#065f46', icon: '#10b981' },
    medium: { bg: '#fef3c7', text: '#92400e', icon: '#f59e0b' },
    high: { bg: '#fed7aa', text: '#9a3412', icon: '#f97316' },
    critical: { bg: '#fee2e2', text: '#991b1b', icon: '#ef4444' },
  },

  // SLA
  sla: {
    onTrack: '#10b981',
    warning: '#f59e0b',
    breached: '#ef4444',
  }
};

export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
};

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
  }
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

export const animations = {
  fadeIn: 'fadeIn 0.2s ease-out',
  slideUp: 'slideUp 0.3s ease-out',
  slideDown: 'slideDown 0.3s ease-out',
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
};
```

### 3.2 Componentes UI Faltantes

**Criar**: `components/ui/tabs.tsx`

```tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const tabsVariants = cva('', {
  variants: {
    variant: {
      default: 'border-b border-gray-200',
      pills: 'bg-gray-100 rounded-lg p-1',
      underline: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType | null>(null);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof tabsVariants> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ children, value, onValueChange, variant, className, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn(tabsVariants({ variant }), className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex space-x-1', className)} role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className
}: {
  value: string;
  children: React.ReactNode;
  className?: string
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => context.onValueChange(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'text-brand-600 border-b-2 border-brand-600'
          : 'text-gray-500 hover:text-gray-700',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className
}: {
  value: string;
  children: React.ReactNode;
  className?: string
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div role="tabpanel" className={cn('mt-4', className)}>
      {children}
    </div>
  );
}
```

**Criar**: `components/ui/badge.tsx`

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        primary: 'bg-brand-100 text-brand-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        danger: 'bg-red-100 text-red-800',
        outline: 'border border-gray-200 text-gray-600',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
        lg: 'px-3 py-1 text-sm',
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  removable?: boolean;
  onRemove?: () => void;
}

export function Badge({
  className,
  variant,
  size,
  removable,
  onRemove,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 -mr-0.5 h-4 w-4 rounded-full hover:bg-black/10 inline-flex items-center justify-center"
        >
          <span className="sr-only">Remove</span>
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 4l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}
    </span>
  );
}
```

**Criar**: `components/ui/dropdown-menu.tsx`

```tsx
'use client';

import * as React from 'react';
import { Menu, Transition } from '@headlessui/react';
import { cn } from '@/lib/utils';

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <Menu as="div" className="relative inline-block text-left">{children}</Menu>;
}

export function DropdownMenuTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Menu.Button className={className}>{children}</Menu.Button>;
}

export function DropdownMenuContent({
  children,
  align = 'right',
  className
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string
}) {
  return (
    <Transition
      as={React.Fragment}
      enter="transition ease-out duration-100"
      enterFrom="transform opacity-0 scale-95"
      enterTo="transform opacity-100 scale-100"
      leave="transition ease-in duration-75"
      leaveFrom="transform opacity-100 scale-100"
      leaveTo="transform opacity-0 scale-95"
    >
      <Menu.Items
        className={cn(
          'absolute z-50 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
          align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          className
        )}
      >
        <div className="py-1">{children}</div>
      </Menu.Items>
    </Transition>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled,
  destructive,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string
}) {
  return (
    <Menu.Item disabled={disabled}>
      {({ active }) => (
        <button
          onClick={onClick}
          className={cn(
            'flex w-full items-center px-4 py-2 text-sm',
            active && 'bg-gray-100',
            destructive ? 'text-red-600' : 'text-gray-700',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          {children}
        </button>
      )}
    </Menu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-gray-200" />;
}
```

### 3.3 Melhorar Pagina de Tickets

**Modificar**: `app/tickets/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/src/components/layout/AppLayout';
import { TicketList } from '@/src/components/tickets/TicketList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BulkOperations } from '@/src/components/tickets/BulkOperations';
import {
  PlusIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  ViewColumnsIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';

type ViewMode = 'list' | 'board' | 'table';
type FilterState = {
  status: string[];
  priority: string[];
  category: string[];
  assignee: string[];
  dateRange: { from: Date | null; to: Date | null };
};

export default function TicketsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: [],
    category: [],
    assignee: [],
    dateRange: { from: null, to: null }
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Tabs para status rapido
  const [activeTab, setActiveTab] = useState('all');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie todos os tickets do sistema
            </p>
          </div>
          <Button onClick={() => router.push('/tickets/new')}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Novo Ticket
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedTickets.length > 0 && (
          <BulkOperations
            selectedIds={selectedTickets}
            onClear={() => setSelectedTickets([])}
            onAction={(action) => handleBulkAction(action)}
          />
        )}

        {/* Filters Bar */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <Input
              type="search"
              placeholder="Buscar tickets por titulo, descricao ou numero..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlassIcon className="h-5 w-5" />}
            />
          </div>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="primary" size="sm" className="ml-2">
                    {countActiveFilters}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4">
              {/* Filter content */}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowsUpDownIcon className="h-5 w-5 mr-2" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('created_at')}>
                Data de criacao
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('updated_at')}>
                Ultima atualizacao
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority_id')}>
                Prioridade
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('sla_due')}>
                SLA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-l-lg',
                viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'
              )}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={cn(
                'p-2',
                viewMode === 'board' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'
              )}
            >
              <ViewColumnsIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-2 rounded-r-lg',
                viewMode === 'table' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'
              )}
            >
              <TableCellsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              Todos <Badge className="ml-2">156</Badge>
            </TabsTrigger>
            <TabsTrigger value="my">
              Meus Tickets <Badge className="ml-2">23</Badge>
            </TabsTrigger>
            <TabsTrigger value="unassigned">
              Nao Atribuidos <Badge variant="warning" className="ml-2">8</Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue">
              SLA Vencido <Badge variant="danger" className="ml-2">3</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ticket List/Board/Table */}
        {viewMode === 'list' && (
          <TicketList
            filters={filters}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            selectedIds={selectedTickets}
            onSelectionChange={setSelectedTickets}
          />
        )}

        {viewMode === 'board' && (
          <TicketKanbanBoard
            filters={filters}
            searchQuery={searchQuery}
          />
        )}

        {viewMode === 'table' && (
          <TicketDataTable
            filters={filters}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            selectedIds={selectedTickets}
            onSelectionChange={setSelectedTickets}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

### 3.4 Criar Componente Kanban Board

**Criar**: `src/components/tickets/TicketKanbanBoard.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TicketCard } from './TicketCard';
import { Ticket, Status } from '@/lib/types/database';

interface Column {
  id: string;
  title: string;
  tickets: Ticket[];
  color: string;
}

interface TicketKanbanBoardProps {
  filters: any;
  searchQuery: string;
}

export function TicketKanbanBoard({ filters, searchQuery }: TicketKanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([
    { id: 'open', title: 'Abertos', tickets: [], color: '#3b82f6' },
    { id: 'in_progress', title: 'Em Progresso', tickets: [], color: '#f59e0b' },
    { id: 'pending', title: 'Aguardando', tickets: [], color: '#8b5cf6' },
    { id: 'resolved', title: 'Resolvidos', tickets: [], color: '#10b981' },
  ]);

  useEffect(() => {
    loadTickets();
  }, [filters, searchQuery]);

  async function loadTickets() {
    const response = await fetch('/api/tickets?' + new URLSearchParams({
      search: searchQuery,
      ...filters
    }));
    const data = await response.json();

    // Agrupar por status
    const grouped = columns.map(col => ({
      ...col,
      tickets: data.filter((t: Ticket) => t.status?.name?.toLowerCase().replace(' ', '_') === col.id)
    }));

    setColumns(grouped);
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const ticketId = parseInt(draggableId);
    const newStatusId = getStatusIdFromColumnId(destination.droppableId);

    // Optimistic update
    const newColumns = [...columns];
    const sourceCol = newColumns.find(c => c.id === source.droppableId)!;
    const destCol = newColumns.find(c => c.id === destination.droppableId)!;

    const [movedTicket] = sourceCol.tickets.splice(source.index, 1);
    destCol.tickets.splice(destination.index, 0, movedTicket);

    setColumns(newColumns);

    // API call
    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: newStatusId })
      });
    } catch (error) {
      // Rollback on error
      loadTickets();
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-50 rounded-lg"
          >
            {/* Column Header */}
            <div
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
              style={{ borderTopColor: column.color, borderTopWidth: '3px' }}
            >
              <h3 className="font-medium text-gray-900">{column.title}</h3>
              <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {column.tickets.length}
              </span>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'p-2 min-h-[500px] space-y-2',
                    snapshot.isDraggingOver && 'bg-blue-50'
                  )}
                >
                  {column.tickets.map((ticket, index) => (
                    <Draggable
                      key={ticket.id}
                      draggableId={ticket.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            snapshot.isDragging && 'shadow-lg'
                          )}
                        >
                          <TicketCard ticket={ticket} compact />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
```

---

## FASE 4: FUNCIONALIDADES NOVAS

### 4.1 Sistema de Respostas Rapidas (Macros)

**Frontend**: `src/components/tickets/QuickReplies.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BoltIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Macro {
  id: number;
  name: string;
  content: string;
  actions: any[];
  usage_count: number;
}

interface QuickRepliesProps {
  ticketId: number;
  onApply: (content: string, actions: any[]) => void;
}

export function QuickReplies({ ticketId, onApply }: QuickRepliesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) loadMacros();
  }, [isOpen]);

  async function loadMacros() {
    setLoading(true);
    const res = await fetch('/api/macros');
    const data = await res.json();
    setMacros(data);
    setLoading(false);
  }

  async function applyMacro(macro: Macro) {
    await fetch(`/api/macros/${macro.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId })
    });

    onApply(macro.content, macro.actions);
    setIsOpen(false);
  }

  const filteredMacros = macros.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        <BoltIcon className="h-5 w-5 mr-1" />
        Respostas Rapidas
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b">
              <Dialog.Title className="text-lg font-semibold">
                Respostas Rapidas
              </Dialog.Title>
              <Input
                type="search"
                placeholder="Buscar macro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-3"
              />
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {filteredMacros.map((macro) => (
                <button
                  key={macro.id}
                  onClick={() => applyMacro(macro)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{macro.name}</span>
                    <span className="text-xs text-gray-500">
                      Usado {macro.usage_count}x
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {macro.content}
                  </p>
                </button>
              ))}
            </div>

            <div className="p-4 border-t flex justify-between">
              <Button variant="outline" onClick={() => router.push('/admin/macros')}>
                <PlusIcon className="h-5 w-5 mr-1" />
                Gerenciar Macros
              </Button>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
```

### 4.2 Tags nos Tickets

**Componente**: `src/components/tickets/TicketTags.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@headlessui/react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TicketTagsProps {
  ticketId: number;
  initialTags?: Tag[];
  editable?: boolean;
}

export function TicketTags({ ticketId, initialTags = [], editable = false }: TicketTagsProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isAdding) loadAvailableTags();
  }, [isAdding]);

  async function loadAvailableTags() {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setAvailableTags(data.filter((t: Tag) => !tags.find(existing => existing.id === t.id)));
  }

  async function addTag(tag: Tag) {
    await fetch(`/api/tickets/${ticketId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tag.id })
    });

    setTags([...tags, tag]);
    setIsAdding(false);
  }

  async function removeTag(tagId: number) {
    await fetch(`/api/tickets/${ticketId}/tags/${tagId}`, {
      method: 'DELETE'
    });

    setTags(tags.filter(t => t.id !== tagId));
  }

  const filteredTags = query === ''
    ? availableTags
    : availableTags.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          style={{ backgroundColor: tag.color + '20', color: tag.color }}
          removable={editable}
          onRemove={() => removeTag(tag.id)}
        >
          {tag.name}
        </Badge>
      ))}

      {editable && !isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Adicionar tag
        </button>
      )}

      {isAdding && (
        <div className="relative">
          <Combobox onChange={addTag}>
            <Combobox.Input
              className="w-40 text-sm border rounded px-2 py-1"
              placeholder="Buscar tag..."
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Combobox.Options className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
              {filteredTags.map((tag) => (
                <Combobox.Option
                  key={tag.id}
                  value={tag}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <Badge style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                    {tag.name}
                  </Badge>
                </Combobox.Option>
              ))}
              {filteredTags.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Nenhuma tag encontrada
                </div>
              )}
            </Combobox.Options>
          </Combobox>
          <button
            onClick={() => setIsAdding(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4.3 Relacionamentos entre Tickets

**Componente**: `src/components/tickets/TicketRelationships.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@headlessui/react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  LinkIcon,
  DocumentDuplicateIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';

interface Relationship {
  id: number;
  type: 'parent' | 'child' | 'related' | 'duplicate' | 'blocks' | 'blocked_by';
  ticket: {
    id: number;
    title: string;
    status: { name: string; color: string };
  };
}

const relationshipConfig = {
  parent: { icon: ArrowUpIcon, label: 'Ticket Pai', color: 'text-purple-600' },
  child: { icon: ArrowDownIcon, label: 'Subtarefa', color: 'text-purple-600' },
  related: { icon: LinkIcon, label: 'Relacionado', color: 'text-blue-600' },
  duplicate: { icon: DocumentDuplicateIcon, label: 'Duplicado', color: 'text-yellow-600' },
  blocks: { icon: NoSymbolIcon, label: 'Bloqueia', color: 'text-red-600' },
  blocked_by: { icon: NoSymbolIcon, label: 'Bloqueado por', color: 'text-red-600' },
};

interface TicketRelationshipsProps {
  ticketId: number;
  editable?: boolean;
}

export function TicketRelationships({ ticketId, editable = false }: TicketRelationshipsProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadRelationships();
  }, [ticketId]);

  async function loadRelationships() {
    const res = await fetch(`/api/tickets/${ticketId}/relationships`);
    const data = await res.json();
    setRelationships(data);
  }

  async function createRelationship(targetTicketId: number, type: string) {
    await fetch(`/api/tickets/${ticketId}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_ticket_id: targetTicketId, type })
    });

    loadRelationships();
    setIsModalOpen(false);
  }

  async function removeRelationship(relationshipId: number) {
    await fetch(`/api/tickets/${ticketId}/relationships/${relationshipId}`, {
      method: 'DELETE'
    });

    setRelationships(relationships.filter(r => r.id !== relationshipId));
  }

  // Agrupar por tipo
  const grouped = relationships.reduce((acc, rel) => {
    if (!acc[rel.type]) acc[rel.type] = [];
    acc[rel.type].push(rel);
    return acc;
  }, {} as Record<string, Relationship[]>);

  if (relationships.length === 0 && !editable) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Relacionamentos</h4>
        {editable && (
          <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(true)}>
            <LinkIcon className="h-4 w-4 mr-1" />
            Vincular
          </Button>
        )}
      </div>

      {Object.entries(grouped).map(([type, rels]) => {
        const config = relationshipConfig[type as keyof typeof relationshipConfig];
        const Icon = config.icon;

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center text-xs font-medium text-gray-500">
              <Icon className={`h-4 w-4 mr-1 ${config.color}`} />
              {config.label}
            </div>
            {rels.map((rel) => (
              <Link
                key={rel.id}
                href={`/tickets/${rel.ticket.id}`}
                className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">#{rel.ticket.id}</span>
                  <span className="text-sm text-gray-900">{rel.ticket.title}</span>
                </div>
                <Badge size="sm" style={{ backgroundColor: rel.ticket.status.color + '20' }}>
                  {rel.ticket.status.name}
                </Badge>
              </Link>
            ))}
          </div>
        );
      })}

      {relationships.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum relacionamento</p>
      )}

      {/* Modal para adicionar relacionamento */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {/* ... implementar modal de busca e selecao */}
      </Dialog>
    </div>
  );
}
```

---

## FASE 5: DASHBOARD E ANALYTICS

### 5.1 Dashboard Principal Melhorado

**Modificar**: `app/dashboard/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/src/components/layout/AppLayout';
import { StatsCard } from '@/src/components/dashboard/StatsCard';
import { TicketTrendChart } from '@/src/components/analytics/TicketTrendChart';
import { DistributionCharts } from '@/src/components/analytics/DistributionCharts';
import { SLAGauge } from '@/src/components/dashboard/widgets/SLAGauge';
import { RecentTickets } from '@/src/components/dashboard/RecentTickets';
import { QuickActions } from '@/src/components/dashboard/QuickActions';
import { ActivityFeed } from '@/src/components/dashboard/ActivityFeed';
import { AgentLeaderboard } from '@/src/components/gamification/AgentLeaderboard';
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  open_tickets: number;
  open_tickets_change: number;
  avg_response_time: number;
  avg_response_change: number;
  resolved_today: number;
  resolved_change: number;
  sla_compliance: number;
  sla_change: number;
  at_risk_tickets: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  async function loadDashboardData() {
    setLoading(true);
    const res = await fetch(`/api/dashboard?period=${period}`);
    const data = await res.json();
    setStats(data);
    setLoading(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Visao geral do seu ServiceDesk
            </p>
          </div>

          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">Hoje</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Tickets Abertos"
            value={stats?.open_tickets ?? 0}
            change={stats?.open_tickets_change ?? 0}
            changeLabel="vs periodo anterior"
            icon={TicketIcon}
            loading={loading}
          />
          <StatsCard
            title="Tempo Medio de Resposta"
            value={`${stats?.avg_response_time ?? 0}min`}
            change={stats?.avg_response_change ?? 0}
            changeLabel="vs periodo anterior"
            icon={ClockIcon}
            inverseChange // menor e melhor
            loading={loading}
          />
          <StatsCard
            title="Resolvidos Hoje"
            value={stats?.resolved_today ?? 0}
            change={stats?.resolved_change ?? 0}
            changeLabel="vs ontem"
            icon={CheckCircleIcon}
            loading={loading}
          />
          <StatsCard
            title="Conformidade SLA"
            value={`${stats?.sla_compliance ?? 0}%`}
            change={stats?.sla_change ?? 0}
            changeLabel="vs periodo anterior"
            icon={ExclamationTriangleIcon}
            loading={loading}
          />
        </div>

        {/* Alert Banner for At-Risk Tickets */}
        {stats?.at_risk_tickets > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-3" />
              <span className="text-yellow-800">
                <strong>{stats.at_risk_tickets}</strong> tickets em risco de violar SLA
              </span>
            </div>
            <Button variant="outline" size="sm">
              Ver tickets
            </Button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trend Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Tendencia de Tickets</h3>
              <TicketTrendChart period={period} />
            </div>

            {/* Distribution Charts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Distribuicao</h3>
              <DistributionCharts period={period} />
            </div>
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            {/* SLA Gauge */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">SLA Performance</h3>
              <SLAGauge value={stats?.sla_compliance ?? 0} />
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Acoes Rapidas</h3>
              <QuickActions />
            </div>

            {/* Activity Feed */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
              <ActivityFeed limit={5} />
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tickets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Tickets Recentes</h3>
            <RecentTickets limit={5} />
          </div>

          {/* Agent Leaderboard */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Top Agentes</h3>
            <AgentLeaderboard limit={5} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

### 5.2 SLA Gauge Component

**Criar**: `src/components/dashboard/widgets/SLAGauge.tsx`

```tsx
'use client';

import { useMemo } from 'react';

interface SLAGaugeProps {
  value: number; // 0-100
  size?: number;
}

export function SLAGauge({ value, size = 200 }: SLAGaugeProps) {
  const { color, label, strokeDasharray } = useMemo(() => {
    let color = '#10b981'; // green
    let label = 'Excelente';

    if (value < 70) {
      color = '#ef4444'; // red
      label = 'Critico';
    } else if (value < 85) {
      color = '#f59e0b'; // yellow
      label = 'Atencao';
    } else if (value < 95) {
      color = '#3b82f6'; // blue
      label = 'Bom';
    }

    // Calculate stroke dasharray for SVG
    const circumference = 2 * Math.PI * 80; // radius = 80
    const strokeDasharray = `${(value / 100) * circumference * 0.75} ${circumference}`;

    return { color, label, strokeDasharray };
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.7} viewBox="0 0 200 140">
        {/* Background arc */}
        <path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />

        {/* Center text */}
        <text
          x="100"
          y="100"
          textAnchor="middle"
          className="text-3xl font-bold"
          fill={color}
        >
          {value}%
        </text>
        <text
          x="100"
          y="125"
          textAnchor="middle"
          className="text-sm"
          fill="#6b7280"
        >
          {label}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>&lt;70%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>70-85%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>85-95%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>&gt;95%</span>
        </div>
      </div>
    </div>
  );
}
```

---

## FASE 6: MELHORIAS DE UX

### 6.1 Sistema de Dark Mode Global

**Criar**: `src/contexts/ThemeContext.tsx`

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const resolved = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      root.classList.toggle('dark', resolved === 'dark');

      const listener = (e: MediaQueryListEvent) => {
        const newResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        root.classList.toggle('dark', newResolved === 'dark');
      };

      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      setResolvedTheme(theme);
      root.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

**Modificar**: `app/layout.tsx`

```tsx
import { ThemeProvider } from '@/src/contexts/ThemeContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 6.2 Skeleton Loaders Uniformes

**Criar**: `components/ui/skeletons/index.tsx`

```tsx
import { cn } from '@/lib/utils';

// Base skeleton
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
        className
      )}
    />
  );
}

// Ticket card skeleton
export function TicketCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-4 py-3 border-t flex gap-4"
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.3 Notificacoes Toast Melhoradas

**Criar**: `src/components/ui/toast-notifications.tsx`

```tsx
'use client';

import { Toaster, toast } from 'react-hot-toast';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Toast container com tema
export function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        className: 'dark:bg-gray-800 dark:text-white',
      }}
    />
  );
}

// Helper functions
export const notify = {
  success: (message: string, options?: { description?: string }) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message}
              </p>
              {options?.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ));
  },

  error: (message: string, options?: { description?: string }) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-red-500 ring-opacity-50`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message}
              </p>
              {options?.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ));
  },

  warning: (message: string, options?: { description?: string }) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-yellow-500 ring-opacity-50`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message}
              </p>
              {options?.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ));
  },

  info: (message: string, options?: { description?: string }) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-blue-500 ring-opacity-50`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <InformationCircleIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message}
              </p>
              {options?.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ));
  },

  // Toast com acao
  action: (
    message: string,
    action: { label: string; onClick: () => void },
    options?: { description?: string }
  ) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <InformationCircleIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message}
              </p>
              {options?.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              action.onClick();
              toast.dismiss(t.id);
            }}
            className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
          >
            {action.label}
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent border-l border-gray-200 dark:border-gray-700 rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    ));
  },
};
```

---

## FASE 7: TESTES E QUALIDADE

### 7.1 Setup de Testes

**Criar**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Criar**: `tests/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 7.2 Testes de API

**Criar**: `tests/api/tickets.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/tickets/create/route';
import { NextRequest } from 'next/server';

describe('POST /api/tickets/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a ticket with valid data', async () => {
    const request = new NextRequest('http://localhost/api/tickets/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Ticket',
        description: 'Test description',
        category_id: 1,
        priority_id: 2,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.title).toBe('Test Ticket');
  });

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost/api/tickets/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Ticket',
        // missing description, category_id, priority_id
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 401 for unauthenticated requests', async () => {
    const request = new NextRequest('http://localhost/api/tickets/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Ticket',
        description: 'Test description',
        category_id: 1,
        priority_id: 2,
      }),
      headers: {
        'Content-Type': 'application/json',
        // no Authorization header
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
```

### 7.3 Testes de Componentes

**Criar**: `tests/components/TicketCard.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketCard } from '@/src/components/tickets/TicketCard';

const mockTicket = {
  id: 1,
  title: 'Test Ticket',
  description: 'Test description',
  status: { id: 1, name: 'Open', color: '#3b82f6' },
  priority: { id: 2, name: 'Medium', color: '#f59e0b' },
  category: { id: 1, name: 'General' },
  user: { id: 1, name: 'John Doe', email: 'john@example.com' },
  assigned_to: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('TicketCard', () => {
  it('renders ticket title', () => {
    render(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });

  it('displays ticket number', () => {
    render(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    render(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('displays user name', () => {
    render(<TicketCard ticket={mockTicket} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

---

## FASE 8: DOCUMENTACAO E DEPLOY

### 8.1 Documentacao da API

**Modificar**: `openapi.yaml` - adicionar novas rotas

```yaml
paths:
  /api/tickets:
    get:
      summary: List tickets
      parameters:
        - name: status
          in: query
          schema:
            type: string
        - name: priority
          in: query
          schema:
            type: string
        - name: search
          in: query
          schema:
            type: string
        - name: page
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: List of tickets
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Ticket'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /api/tickets/{id}/tags:
    post:
      summary: Add tag to ticket
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tag_id:
                  type: integer
      responses:
        '201':
          description: Tag added

  /api/macros:
    get:
      summary: List macros
      responses:
        '200':
          description: List of macros
    post:
      summary: Create macro
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MacroInput'
      responses:
        '201':
          description: Macro created

components:
  schemas:
    Ticket:
      type: object
      properties:
        id:
          type: integer
        title:
          type: string
        description:
          type: string
        status:
          $ref: '#/components/schemas/Status'
        priority:
          $ref: '#/components/schemas/Priority'
        category:
          $ref: '#/components/schemas/Category'
        tags:
          type: array
          items:
            $ref: '#/components/schemas/Tag'
        created_at:
          type: string
          format: date-time

    Tag:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        color:
          type: string

    MacroInput:
      type: object
      required:
        - name
        - content
      properties:
        name:
          type: string
        content:
          type: string
        actions:
          type: array
          items:
            type: object
        is_shared:
          type: boolean
```

---

## CRONOGRAMA SUGERIDO

### Sprint 1 (Fundacao)
- [ ] Corrigir schema multi-tenant
- [ ] Criar tabelas faltantes (custom_fields, tags, macros)
- [ ] Remover codigo morto
- [ ] Setup de testes

### Sprint 2 (Backend Core)
- [ ] Implementar API de Analytics completa
- [ ] Completar API de Workflows
- [ ] Criar API de Tags e Macros
- [ ] Criar API de relacionamentos

### Sprint 3 (Frontend Core)
- [ ] Unificar design tokens
- [ ] Criar componentes UI faltantes
- [ ] Melhorar pagina de tickets (views, filters)
- [ ] Implementar Kanban board

### Sprint 4 (Funcionalidades)
- [ ] Sistema de macros/respostas rapidas
- [ ] Tags nos tickets
- [ ] Relacionamentos entre tickets
- [ ] Custom fields

### Sprint 5 (Dashboard/UX)
- [ ] Dashboard melhorado
- [ ] Dark mode global
- [ ] Skeleton loaders
- [ ] Notificacoes toast

### Sprint 6 (Polish)
- [ ] Testes de API
- [ ] Testes de componentes
- [ ] Documentacao OpenAPI
- [ ] Performance optimization

---

## METRICAS DE SUCESSO

| Metrica | Atual | Meta |
|---------|-------|------|
| Cobertura de testes | 0% | >70% |
| APIs funcionais | 70% | 95% |
| Componentes integrados | 60% | 90% |
| Performance Lighthouse | N/A | >85 |
| Acessibilidade WCAG | Parcial | AA |

---

**Documento criado**: 2025-12-10
**Autor**: Claude Code
**Versao**: 1.0
