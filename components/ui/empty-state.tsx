import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

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
        <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-description mb-6 max-w-md">
        {description}
      </p>

      {action && (
        <Button
          variant={action.variant || 'primary'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
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

// Notifications Empty State
export function NotificationsEmptyState() {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      }
      title="Nenhuma notificação"
      description="Você está em dia! Não há notificações pendentes no momento."
    />
  )
}

// Comments Empty State
export function CommentsEmptyState({ onAddComment }: { onAddComment?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      }
      title="Nenhum comentário ainda"
      description="Seja o primeiro a comentar neste ticket."
      action={
        onAddComment
          ? {
              label: 'Adicionar comentário',
              onClick: onAddComment,
            }
          : undefined
      }
    />
  )
}

// Filter Results Empty State
export function FilterEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      }
      title="Nenhum resultado encontrado"
      description="Nenhum item corresponde aos filtros aplicados. Tente ajustar ou limpar os filtros."
      action={{
        label: 'Limpar todos os filtros',
        onClick: onClearFilters,
        variant: 'secondary',
      }}
    />
  )
}

// Team Members Empty State
export function TeamEmptyState({ isAdmin, onInviteMember }: { isAdmin?: boolean; onInviteMember?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      }
      title="Equipe vazia"
      description={
        isAdmin
          ? 'Comece adicionando membros à sua equipe para colaborar em tickets.'
          : 'Ainda não há membros nesta equipe.'
      }
      action={
        isAdmin && onInviteMember
          ? {
              label: 'Convidar membro',
              onClick: onInviteMember,
            }
          : undefined
      }
    />
  )
}

// Attachments Empty State
export function AttachmentsEmptyState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      }
      title="Nenhum anexo"
      description="Este ticket ainda não possui arquivos anexados."
      action={
        onUpload
          ? {
              label: 'Adicionar anexo',
              onClick: onUpload,
              variant: 'secondary',
            }
          : undefined
      }
    />
  )
}

// Analytics Empty State
export function AnalyticsEmptyState({ dateRange }: { dateRange?: string }) {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      title="Sem dados analíticos"
      description={
        dateRange
          ? `Não há dados disponíveis para o período selecionado: ${dateRange}`
          : 'Ainda não há dados suficientes para gerar análises. Continue usando o sistema.'
      }
    />
  )
}
