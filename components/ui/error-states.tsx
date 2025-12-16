'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
  WifiIcon,
  LockClosedIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'

// ========================================
// BASE ERROR STATE COMPONENT
// ========================================
interface ErrorStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function ErrorState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      {icon && (
        <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>

      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{description}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2',
              action.variant === 'secondary'
                ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white focus:ring-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md focus:ring-blue-500'
            )}
          >
            {action.label}
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ========================================
// NETWORK ERROR
// ========================================
interface NetworkErrorProps {
  onRetry?: () => void
  onGoBack?: () => void
  message?: string
}

export function NetworkError({ onRetry, onGoBack, message }: NetworkErrorProps) {
  return (
    <ErrorState
      icon={<WifiIcon className="w-10 h-10 text-red-600" />}
      title="Erro de Conexão"
      description={
        message || 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.'
      }
      action={
        onRetry
          ? {
              label: 'Tentar Novamente',
              onClick: onRetry,
            }
          : undefined
      }
      secondaryAction={
        onGoBack
          ? {
              label: 'Voltar',
              onClick: onGoBack,
            }
          : undefined
      }
    />
  )
}

// ========================================
// 404 NOT FOUND
// ========================================
interface NotFoundErrorProps {
  onGoHome?: () => void
  onGoBack?: () => void
  title?: string
  message?: string
}

export function NotFoundError({ onGoHome, onGoBack, title, message }: NotFoundErrorProps) {
  return (
    <ErrorState
      icon={
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      title={title || '404 - Página Não Encontrada'}
      description={message || 'A página que você está procurando não existe ou foi removida.'}
      action={
        onGoHome
          ? {
              label: 'Ir para Início',
              onClick: onGoHome,
            }
          : undefined
      }
      secondaryAction={
        onGoBack
          ? {
              label: 'Voltar',
              onClick: onGoBack,
            }
          : undefined
      }
    />
  )
}

// ========================================
// 500 SERVER ERROR
// ========================================
interface ServerErrorProps {
  onRetry?: () => void
  onContactSupport?: () => void
  errorId?: string
  message?: string
}

export function ServerError({ onRetry, onContactSupport, _errorId, message }: ServerErrorProps) {
  return (
    <ErrorState
      icon={<ServerIcon className="w-10 h-10 text-red-600" />}
      title="500 - Erro do Servidor"
      description={
        message ||
        'Desculpe, algo deu errado no servidor. Nossa equipe foi notificada e está trabalhando para resolver o problema.'
      }
      action={
        onRetry
          ? {
              label: 'Tentar Novamente',
              onClick: onRetry,
            }
          : undefined
      }
      secondaryAction={
        onContactSupport
          ? {
              label: 'Contatar Suporte',
              onClick: onContactSupport,
            }
          : undefined
      }
    />
  )
}

// ========================================
// PERMISSION DENIED
// ========================================
interface PermissionDeniedProps {
  onGoBack?: () => void
  onRequestAccess?: () => void
  message?: string
}

export function PermissionDenied({ onGoBack, onRequestAccess, message }: PermissionDeniedProps) {
  return (
    <ErrorState
      icon={<LockClosedIcon className="w-10 h-10 text-yellow-600" />}
      title="Acesso Negado"
      description={
        message ||
        'Você não tem permissão para acessar esta página. Entre em contato com um administrador se acredita que isto é um erro.'
      }
      action={
        onGoBack
          ? {
              label: 'Voltar',
              onClick: onGoBack,
              variant: 'secondary',
            }
          : undefined
      }
      secondaryAction={
        onRequestAccess
          ? {
              label: 'Solicitar Acesso',
              onClick: onRequestAccess,
            }
          : undefined
      }
    />
  )
}

// ========================================
// GENERIC ERROR
// ========================================
interface GenericErrorProps {
  title?: string
  message?: string
  onRetry?: () => void
  onDismiss?: () => void
}

export function GenericError({ title, message, onRetry, onDismiss }: GenericErrorProps) {
  return (
    <ErrorState
      icon={<ExclamationTriangleIcon className="w-10 h-10 text-red-600" />}
      title={title || 'Algo deu errado'}
      description={message || 'Ocorreu um erro inesperado. Por favor, tente novamente.'}
      action={
        onRetry
          ? {
              label: 'Tentar Novamente',
              onClick: onRetry,
            }
          : undefined
      }
      secondaryAction={
        onDismiss
          ? {
              label: 'Fechar',
              onClick: onDismiss,
            }
          : undefined
      }
    />
  )
}

// ========================================
// INLINE ERROR (for forms and small sections)
// ========================================
interface InlineErrorProps {
  message: string
  onDismiss?: () => void
  className?: string
  variant?: 'error' | 'warning'
}

export function InlineError({ message, onDismiss, className, variant = 'error' }: InlineErrorProps) {
  const variants = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: <XCircleIcon className="w-5 h-5 text-red-600" />,
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />,
    },
  }

  const style = variants[variant]

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border', style.bg, className)}>
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <p className={cn('flex-1 text-sm font-medium', style.text)}>{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('flex-shrink-0 hover:opacity-70 transition-opacity', style.text)}
          aria-label="Dismiss error"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ========================================
// FORM VALIDATION ERROR SUMMARY
// ========================================
interface FormErrorSummaryProps {
  errors: string[]
  onDismiss?: () => void
  className?: string
}

export function FormErrorSummary({ errors, onDismiss, className }: FormErrorSummaryProps) {
  if (errors.length === 0) return null

  return (
    <div
      className={cn(
        'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            {errors.length === 1 ? 'Corrija o seguinte erro:' : `Corrija os ${errors.length} erros a seguir:`}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-red-800 dark:text-red-200 hover:opacity-70 transition-opacity"
            aria-label="Dismiss errors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ========================================
// ERROR BOUNDARY FALLBACK
// ========================================
interface ErrorBoundaryFallbackProps {
  error: Error
  resetError: () => void
}

export function ErrorBoundaryFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl w-full">
        <ErrorState
          icon={<ShieldExclamationIcon className="w-10 h-10 text-red-600" />}
          title="Erro Crítico da Aplicação"
          description="A aplicação encontrou um erro inesperado. Clique em 'Tentar Novamente' para recarregar."
          action={{
            label: 'Tentar Novamente',
            onClick: resetError,
          }}
          secondaryAction={{
            label: 'Recarregar Página',
            onClick: () => window.location.reload(),
          }}
        />

        {isDev && (
          <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Stack Trace (Dev Only):</h4>
            <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto max-h-64">
              {error.stack || error.message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
