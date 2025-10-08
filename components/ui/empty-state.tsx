import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      {icon && (
        <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-sm',
            action.variant === 'secondary'
              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Pre-built empty states for common scenarios
export function TicketsEmptyState({ onCreateTicket }: { onCreateTicket: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      }
      title="Nenhum ticket encontrado"
      description="Você ainda não tem tickets. Crie seu primeiro ticket para começar a usar o sistema."
      action={{
        label: 'Criar primeiro ticket',
        onClick: onCreateTicket,
      }}
    />
  )
}

export function SearchEmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title={`Nenhum resultado para "${query}"`}
      description="Tente usar palavras-chave diferentes ou remova alguns filtros."
      action={{
        label: 'Limpar filtros',
        onClick: onClear,
        variant: 'secondary',
      }}
    />
  )
}

export function DashboardEmptyState() {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      title="Sem dados disponíveis"
      description="Ainda não há dados suficientes para exibir gráficos e estatísticas. Continue usando o sistema para gerar insights."
    />
  )
}

export function KnowledgeBaseEmptyState({
  isAdmin,
  onCreateArticle
}: {
  isAdmin?: boolean
  onCreateArticle?: () => void
}) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      }
      title="Base de conhecimento vazia"
      description={
        isAdmin
          ? 'Comece criando artigos para ajudar sua equipe e usuários a resolver problemas comuns.'
          : 'Ainda não há artigos disponíveis. Volte mais tarde ou entre em contato com o suporte.'
      }
      action={
        isAdmin && onCreateArticle
          ? {
              label: 'Criar primeiro artigo',
              onClick: onCreateArticle,
            }
          : undefined
      }
    />
  )
}

export function NoDataEmptyState({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      }
      title="Sem dados"
      description={message || 'Não há informações para exibir no momento.'}
    />
  )
}
