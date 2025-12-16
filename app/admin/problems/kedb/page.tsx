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
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { BookOpenIcon as BookOpenSolid } from '@heroicons/react/24/solid'

interface KnownError {
  id: string
  problem_id: string
  title: string
  symptoms: string
  root_cause: string
  workaround: string
  permanent_fix: string | null
  status: 'active' | 'resolved' | 'superseded'
  category: string
  services: string[]
  created_at: string
  updated_at: string
  resolved_at: string | null
  views: number
  uses: number
  related_incidents: number
}

export default function KEDBPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<KnownError[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchKnownErrors()
  }, [])

  const fetchKnownErrors = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      setErrors([
        {
          id: 'KE-001',
          problem_id: '123',
          title: 'Lentidão no ERP durante horário de pico',
          symptoms: 'Usuários experimentam lentidão significativa (>10s de resposta) no módulo financeiro do ERP entre 9h-11h e 14h-16h. Afeta principalmente relatórios e consultas complexas.',
          root_cause: 'Índices fragmentados no banco de dados e queries não otimizadas no módulo de relatórios. Durante horários de pico, o processamento de relatórios concorrentes causa locks extensos.',
          workaround: '1. Executar relatórios pesados fora do horário de pico\n2. Limitar a 5 usuários simultâneos no módulo de relatórios\n3. Usar versão resumida dos relatórios quando possível',
          permanent_fix: 'RFC CHG-456 agendada para domingo: reconstrução de índices e otimização de queries',
          status: 'active',
          category: 'Performance',
          services: ['ERP Financeiro', 'Relatórios Gerenciais'],
          created_at: '2024-12-10T10:30:00Z',
          updated_at: '2024-12-13T11:00:00Z',
          resolved_at: null,
          views: 245,
          uses: 89,
          related_incidents: 15
        },
        {
          id: 'KE-002',
          problem_id: '98',
          title: 'Falha de autenticação SSO intermitente',
          symptoms: 'Alguns usuários recebem erro "Token expired" mesmo com sessão ativa. Ocorre principalmente após períodos de inatividade >30min.',
          root_cause: 'Configuração de refresh token com timeout menor que o timeout de sessão do IdP. Race condition na renovação automática.',
          workaround: 'Fazer logout e login novamente quando o erro ocorrer. Manter atividade na aplicação pelo menos a cada 25 minutos.',
          permanent_fix: null,
          status: 'active',
          category: 'Autenticação',
          services: ['Portal SSO', 'Identity Provider'],
          created_at: '2024-11-20T14:00:00Z',
          updated_at: '2024-12-01T09:00:00Z',
          resolved_at: null,
          views: 178,
          uses: 56,
          related_incidents: 8
        },
        {
          id: 'KE-003',
          problem_id: '85',
          title: 'Erro de sincronização de calendário Exchange',
          symptoms: 'Eventos criados no Outlook não aparecem no calendário do sistema. Afeta usuários com mais de 500 eventos no calendário.',
          root_cause: 'Limite de paginação da API do Exchange configurado muito baixo. Sincronização falha silenciosamente ao atingir o limite.',
          workaround: 'Arquivar eventos antigos do calendário (>6 meses) para reduzir o total abaixo de 500.',
          permanent_fix: 'Implementado em v2.3.4 - Aumentado limite de paginação e adicionado log de erros',
          status: 'resolved',
          category: 'Integração',
          services: ['Calendário', 'Exchange Integration'],
          created_at: '2024-10-15T08:00:00Z',
          updated_at: '2024-11-28T16:00:00Z',
          resolved_at: '2024-11-28T16:00:00Z',
          views: 312,
          uses: 124,
          related_incidents: 23
        },
        {
          id: 'KE-004',
          problem_id: '110',
          title: 'Timeout em upload de arquivos grandes',
          symptoms: 'Upload de arquivos maiores que 50MB falha com erro de timeout após 2 minutos.',
          root_cause: 'Timeout do proxy reverso configurado para 120s. Uploads grandes em conexões lentas excedem este limite.',
          workaround: 'Dividir arquivos grandes em partes menores (<50MB) ou usar conexão de rede mais rápida.',
          permanent_fix: null,
          status: 'active',
          category: 'Infraestrutura',
          services: ['File Upload', 'Storage'],
          created_at: '2024-12-05T11:00:00Z',
          updated_at: '2024-12-10T15:00:00Z',
          resolved_at: null,
          views: 89,
          uses: 34,
          related_incidents: 5
        }
      ])
    } catch (error) {
      console.error('Error fetching known errors:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-yellow-100 text-yellow-700'
      case 'resolved': return 'bg-green-100 text-green-700'
      case 'superseded': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'resolved': return 'Resolvido'
      case 'superseded': return 'Substituído'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const filteredErrors = errors.filter(error => {
    const matchesSearch = error.title.toLowerCase().includes(search.toLowerCase()) ||
      error.symptoms.toLowerCase().includes(search.toLowerCase()) ||
      error.root_cause.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || error.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || error.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const categories = [...new Set(errors.map(e => e.category))]

  const stats = {
    total: errors.length,
    active: errors.filter(e => e.status === 'active').length,
    resolved: errors.filter(e => e.status === 'resolved').length,
    totalViews: errors.reduce((acc, e) => acc + e.views, 0),
    totalUses: errors.reduce((acc, e) => acc + e.uses, 0)
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpenSolid className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                Known Error Database (KEDB)
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Base de erros conhecidos e soluções documentadas
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/problems')}
              className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg"
            >
              ← Voltar para Problemas
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Ativos</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Resolvidos</p>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Visualizações</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalViews}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Utilizações</p>
            <p className="text-2xl font-bold text-purple-600">{stats.totalUses}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, sintomas ou causa raiz..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativos</option>
              <option value="resolved">Resolvidos</option>
            </select>
          </div>
        </div>

        {/* Error List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredErrors.map(error => (
              <div
                key={error.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}
                  className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-gray-500">{error.id}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(error.status)}`}>
                          {getStatusLabel(error.status)}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                          {error.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{error.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{error.symptoms}</p>
                    </div>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                        expandedId === error.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <EyeIcon className="w-4 h-4" />
                      {error.views} visualizações
                    </span>
                    <span className="flex items-center gap-1">
                      <DocumentDuplicateIcon className="w-4 h-4" />
                      {error.uses} utilizações
                    </span>
                    <span className="flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      {error.related_incidents} incidentes
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      Atualizado: {formatDate(error.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === error.id && (
                  <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Root Cause */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                          Causa Raiz
                        </h4>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{error.root_cause}</p>
                        </div>
                      </div>

                      {/* Workaround */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <LightBulbIcon className="w-5 h-5 text-yellow-500" />
                          Workaround
                        </h4>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{error.workaround}</p>
                        </div>
                      </div>
                    </div>

                    {/* Permanent Fix */}
                    {error.permanent_fix && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          Solução Permanente
                        </h4>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{error.permanent_fix}</p>
                        </div>
                      </div>
                    )}

                    {/* Services */}
                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Serviços Afetados</h4>
                      <div className="flex flex-wrap gap-2">
                        {error.services.map((service, index) => (
                          <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => router.push(`/admin/problems/${error.problem_id}`)}
                        className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-lg flex items-center gap-2"
                      >
                        Ver Problema PRB-{error.problem_id}
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                      <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2">
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        Copiar Workaround
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredErrors.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900">Nenhum erro conhecido encontrado</h3>
                <p className="text-sm text-gray-500 mt-1">Ajuste os filtros ou crie um novo registro</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Voltar
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Novo
          </button>
        </div>
      </div>
    </div>
  )
}
