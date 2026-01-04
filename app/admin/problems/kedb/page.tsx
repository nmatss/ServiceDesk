'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TagIcon,
  ArrowRightIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  HomeIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline'
import { BookOpenIcon as BookOpenSolid } from '@heroicons/react/24/solid'
import PageHeader from '@/components/ui/PageHeader'

interface KnownError {
  id: number
  ke_number: string
  problem_id: number | null
  title: string
  description: string
  symptoms: string[] // Array of symptom strings
  root_cause: string
  workaround: string
  workaround_instructions: string | null
  permanent_fix_status: 'pending' | 'planned' | 'in_progress' | 'completed' | 'wont_fix'
  permanent_fix_eta: string | null
  permanent_fix_notes: string | null
  affected_services: number[] | null
  affected_cis: number[] | null
  is_active: boolean
  is_public: boolean
  times_referenced: number
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: number | null
  problem?: {
    id: number
    problem_number: string
    title: string
  }
  created_by_user?: {
    id: number
    name: string
    email: string
  }
}

export default function KEDBPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<KnownError[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [fixStatusFilter, setFixStatusFilter] = useState<'all' | 'pending' | 'planned' | 'in_progress' | 'completed' | 'wont_fix'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchKnownErrors()
  }, [statusFilter, fixStatusFilter])

  // Debounced search
  useEffect(() => {
    if (!search) return

    const timeout = setTimeout(() => {
      fetchKnownErrors()
    }, 500)

    return () => clearTimeout(timeout)
  }, [search])

  const fetchKnownErrors = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()

      if (statusFilter !== 'all') {
        params.set('is_active', statusFilter === 'active' ? 'true' : 'false')
      }

      if (fixStatusFilter !== 'all') {
        params.set('permanent_fix_status', fixStatusFilter)
      }

      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/known-errors?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch known errors')
      }

      const data = await response.json()

      if (data.success && data.data) {
        setErrors(data.data.data || [])
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error fetching known errors:', error)
      setError(error instanceof Error ? error.message : 'Failed to load known errors')
      setErrors([])
    } finally {
      setLoading(false)
    }
  }

  const getFixStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-400'
      case 'planned': return 'bg-info-100 text-info-700 dark:bg-info-500/20 dark:text-info-400'
      case 'in_progress': return 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400'
      case 'completed': return 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400'
      case 'wont_fix': return 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-400'
    }
  }

  const getFixStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente'
      case 'planned': return 'Planejado'
      case 'in_progress': return 'Em Andamento'
      case 'completed': return 'Concluído'
      case 'wont_fix': return 'Não Será Corrigido'
      default: return status
    }
  }

  const getActiveStatusLabel = (isActive: boolean) => {
    return isActive ? 'Ativo' : 'Inativo'
  }

  const getActiveStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400'
      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-400'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const filteredErrors = errors

  const stats = {
    total: errors.length,
    active: errors.filter(e => e.is_active).length,
    inactive: errors.filter(e => !e.is_active).length,
    totalReferences: errors.reduce((acc, e) => acc + e.times_referenced, 0),
    pending: errors.filter(e => e.permanent_fix_status === 'pending').length,
    completed: errors.filter(e => e.permanent_fix_status === 'completed').length
  }

  return (
    <div className="pb-6 space-y-6 animate-fade-in">
      {/* Page Header with Breadcrumbs */}
      <PageHeader
        title="Known Error Database (KEDB)"
        description="Base de erros conhecidos e soluções documentadas"
        icon={BookOpenSolid}
        breadcrumbs={[
          { label: 'Admin', icon: HomeIcon, href: '/admin' },
          { label: 'Problemas', icon: WrenchScrewdriverIcon, href: '/admin/problems' },
          { label: 'Base de Erros Conhecidos', icon: BookOpenIcon }
        ]}
        actions={
          <button
            onClick={() => router.push('/admin/problems')}
            className="px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 rounded-lg transition-colors"
          >
            ← Voltar para Problemas
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6 animate-slide-up">
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Total</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{stats.total}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Ativos</p>
            <p className="text-2xl font-bold text-success-600 dark:text-success-400">{stats.active}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Inativos</p>
            <p className="text-2xl font-bold text-description">{stats.inactive}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Pendentes</p>
            <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{stats.pending}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Resolvidos</p>
            <p className="text-2xl font-bold text-success-600 dark:text-success-400">{stats.completed}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm text-muted-content">Referências</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.totalReferences}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-panel p-4 mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-icon-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchKnownErrors()}
                placeholder="Buscar por título, sintomas ou causa raiz..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter)
                // Fetch will be triggered by useEffect
              }}
              className="px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 transition-colors"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
            <select
              value={fixStatusFilter}
              onChange={(e) => {
                setFixStatusFilter(e.target.value as typeof fixStatusFilter)
                // Fetch will be triggered by useEffect
              }}
              className="px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 transition-colors"
            >
              <option value="all">Todos status de correção</option>
              <option value="pending">Pendente</option>
              <option value="planned">Planejado</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluído</option>
              <option value="wont_fix">Não Será Corrigido</option>
            </select>
            <button
              onClick={fetchKnownErrors}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-panel p-4 mb-6 bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 animate-fade-in">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-error-900 dark:text-error-50">Erro ao carregar erros conhecidos</h3>
                <p className="text-sm text-error-700 dark:text-error-300 mt-1">{error}</p>
              </div>
              <button
                onClick={fetchKnownErrors}
                className="ml-auto px-3 py-1.5 text-sm font-medium text-error-600 dark:text-error-400 bg-error-100 dark:bg-error-500/20 hover:bg-error-200 dark:hover:bg-error-500/30 rounded-lg transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Error List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400"></div>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            {filteredErrors.map((error, index) => (
              <div
                key={error.id}
                className="glass-panel overflow-hidden animate-fade-in hover:shadow-lg transition-shadow"
                style={{ animationDelay: `${300 + index * 50}ms` }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}
                  className="p-4 sm:p-6 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-muted-content">{error.ke_number}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getActiveStatusColor(error.is_active)}`}>
                          {getActiveStatusLabel(error.is_active)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getFixStatusColor(error.permanent_fix_status)}`}>
                          {getFixStatusLabel(error.permanent_fix_status)}
                        </span>
                        {error.is_public && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-700 text-brand-700 dark:text-brand-300">
                            Público
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2">{error.title}</h3>
                      <p className="text-sm text-description line-clamp-2">
                        {error.symptoms.length > 0 ? error.symptoms.join('; ') : error.description}
                      </p>
                    </div>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-icon-muted transition-transform flex-shrink-0 ${
                        expandedId === error.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-content">
                    <span className="flex items-center gap-1">
                      <DocumentDuplicateIcon className="w-4 h-4" />
                      {error.times_referenced} referências
                    </span>
                    {error.problem && (
                      <span className="flex items-center gap-1">
                        <TagIcon className="w-4 h-4" />
                        Problema: {error.problem.problem_number}
                      </span>
                    )}
                    {error.created_by_user && (
                      <span className="flex items-center gap-1">
                        Criado por: {error.created_by_user.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      Atualizado: {formatDate(error.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === error.id && (
                  <div className="border-t border-neutral-200 dark:border-neutral-700 p-4 sm:p-6 bg-neutral-50 dark:bg-neutral-800/50 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Root Cause */}
                      <div>
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2 flex items-center gap-2">
                          <ExclamationTriangleIcon className="w-5 h-5 text-error-500 dark:text-error-400" />
                          Causa Raiz
                        </h4>
                        <div className="bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 rounded-lg p-3">
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{error.root_cause}</p>
                        </div>
                      </div>

                      {/* Workaround */}
                      <div>
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2 flex items-center gap-2">
                          <LightBulbIcon className="w-5 h-5 text-warning-500 dark:text-warning-400" />
                          Workaround
                        </h4>
                        <div className="bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 rounded-lg p-3">
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{error.workaround}</p>
                        </div>
                      </div>
                    </div>

                    {/* Permanent Fix Status */}
                    {(error.permanent_fix_status !== 'pending' || error.permanent_fix_notes) && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2 flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-success-500 dark:text-success-400" />
                          Correção Permanente
                        </h4>
                        <div className="bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Status:</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getFixStatusColor(error.permanent_fix_status)}`}>
                              {getFixStatusLabel(error.permanent_fix_status)}
                            </span>
                          </div>
                          {error.permanent_fix_eta && (
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">ETA:</span> {formatDate(error.permanent_fix_eta)}
                            </div>
                          )}
                          {error.permanent_fix_notes && (
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{error.permanent_fix_notes}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Workaround Instructions */}
                    {error.workaround_instructions && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2">Instruções do Workaround</h4>
                        <div className="bg-info-50 dark:bg-info-500/10 border border-info-200 dark:border-info-500/30 rounded-lg p-3">
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{error.workaround_instructions}</p>
                        </div>
                      </div>
                    )}

                    {/* Affected Resources */}
                    {(error.affected_services || error.affected_cis) && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2">Recursos Afetados</h4>
                        <div className="flex flex-wrap gap-2">
                          {error.affected_services && error.affected_services.length > 0 && (
                            <span className="px-3 py-1 bg-warning-100 dark:bg-warning-700 text-warning-700 dark:text-warning-300 rounded-lg text-sm">
                              {error.affected_services.length} serviço(s)
                            </span>
                          )}
                          {error.affected_cis && error.affected_cis.length > 0 && (
                            <span className="px-3 py-1 bg-info-100 dark:bg-info-700 text-info-700 dark:text-info-300 rounded-lg text-sm">
                              {error.affected_cis.length} CI(s)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      {error.problem && (
                        <button
                          onClick={() => error.problem && router.push(`/admin/problems/${error.problem.id}`)}
                          className="px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-500/20 hover:bg-brand-200 dark:hover:bg-brand-500/30 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          Ver Problema {error.problem?.problem_number}
                          <ArrowRightIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(error.workaround)
                          alert('Workaround copiado para a área de transferência!')
                        }}
                        className="px-4 py-2 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        Copiar Workaround
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredErrors.length === 0 && (
              <div className="glass-panel p-8 text-center animate-fade-in">
                <BookOpenIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <h3 className="font-medium text-neutral-900 dark:text-neutral-50">Nenhum erro conhecido encontrado</h3>
                <p className="text-sm text-muted-content mt-1">Ajuste os filtros ou crie um novo registro</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Voltar
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Novo
          </button>
        </div>
      </div>
    </div>
  )
}
