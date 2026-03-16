'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { logger } from '@/lib/monitoring/logger'
import {
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ServerIcon,
  LinkIcon,
  PlusIcon,
  XMarkIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  UserIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  BoltIcon,
  SignalIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'

interface Category {
  id: number
  name: string
  description?: string
  color?: string
}

interface Team {
  id: number
  name: string
}

interface User {
  id: number
  name: string
  email: string
}

const IMPACT_OPTIONS = [
  { value: 'low', label: 'Baixo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800', dot: 'bg-green-500' },
  { value: 'medium', label: 'Médio', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-500' },
  { value: 'high', label: 'Alto', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Crítico', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800', dot: 'bg-red-500' },
]

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800', dot: 'bg-green-500' },
  { value: 'medium', label: 'Média', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800', dot: 'bg-red-500' },
]

const PRIORITY_MAP: Record<string, Record<string, { label: string, id: number, color: string }>> = {
  low: {
    low: { label: 'Baixa', id: 1, color: 'text-green-600 dark:text-green-400' },
    medium: { label: 'Baixa', id: 1, color: 'text-green-600 dark:text-green-400' },
    high: { label: 'Média', id: 2, color: 'text-yellow-600 dark:text-yellow-400' },
    critical: { label: 'Alta', id: 3, color: 'text-orange-600 dark:text-orange-400' },
  },
  medium: {
    low: { label: 'Baixa', id: 1, color: 'text-green-600 dark:text-green-400' },
    medium: { label: 'Média', id: 2, color: 'text-yellow-600 dark:text-yellow-400' },
    high: { label: 'Alta', id: 3, color: 'text-orange-600 dark:text-orange-400' },
    critical: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
  },
  high: {
    low: { label: 'Média', id: 2, color: 'text-yellow-600 dark:text-yellow-400' },
    medium: { label: 'Alta', id: 3, color: 'text-orange-600 dark:text-orange-400' },
    high: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
    critical: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
  },
  critical: {
    low: { label: 'Alta', id: 3, color: 'text-orange-600 dark:text-orange-400' },
    medium: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
    high: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
    critical: { label: 'Crítica', id: 4, color: 'text-red-600 dark:text-red-400' },
  },
}

export default function NewProblemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [agents, setAgents] = useState<User[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    impact: '',
    urgency: '',
    assigned_to: '',
    assigned_team_id: '',
    affected_services: [] as string[],
    related_incidents: '',
  })
  const [newService, setNewService] = useState('')

  // Computed priority from impact × urgency matrix
  const computedPriority = formData.impact && formData.urgency
    ? PRIORITY_MAP[formData.impact]?.[formData.urgency]
    : null

  // Fetch categories, teams, and agents
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, teamRes, userRes] = await Promise.all([
          fetch('/api/categories', { credentials: 'include' }),
          fetch('/api/teams', { credentials: 'include' }),
          fetch('/api/users?role=agent&limit=100', { credentials: 'include' }),
        ])

        const [catData, teamData, userData] = await Promise.all([
          catRes.json(),
          teamRes.json(),
          userRes.json(),
        ])

        if (catData.success && catData.categories) setCategories(catData.categories)
        if (teamData.success && teamData.data) setTeams(teamData.data)
        else if (teamData.teams) setTeams(teamData.teams)
        if (userData.success && userData.data) setAgents(Array.isArray(userData.data) ? userData.data : userData.data.users || [])
        else if (userData.users) setAgents(userData.users)
      } catch (error) {
        logger.error('Erro ao buscar dados do formulário', error)
      }
    }
    fetchData()
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const categoryId = formData.category_id ? parseInt(formData.category_id, 10) : undefined
      const assignedTo = formData.assigned_to ? parseInt(formData.assigned_to, 10) : undefined
      const assignedTeamId = formData.assigned_team_id ? parseInt(formData.assigned_team_id, 10) : undefined

      const payload = {
        title: formData.title,
        description: formData.description,
        category_id: (categoryId && !isNaN(categoryId)) ? categoryId : undefined,
        priority_id: computedPriority?.id ?? 2,
        impact: formData.impact || undefined,
        urgency: formData.urgency || undefined,
        assigned_to: (assignedTo && !isNaN(assignedTo)) ? assignedTo : undefined,
        assigned_team_id: (assignedTeamId && !isNaN(assignedTeamId)) ? assignedTeamId : undefined,
        affected_services: formData.affected_services.length > 0 ? formData.affected_services : undefined,
      }

      const response = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao criar problema')
      }

      toast.success('Problema criado com sucesso!')
      router.push(data.data?.id ? `/admin/problems/${data.data.id}` : '/admin/problems')
    } catch (error) {
      logger.error('Erro ao criar problema', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar problema')
    } finally {
      setLoading(false)
    }
  }, [formData, computedPriority, router])

  const addService = () => {
    if (newService.trim() && !formData.affected_services.includes(newService.trim())) {
      setFormData(prev => ({
        ...prev,
        affected_services: [...prev.affected_services, newService.trim()]
      }))
      setNewService('')
    }
  }

  const removeService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      affected_services: prev.affected_services.filter(s => s !== service)
    }))
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Lifecycle steps for ITIL sidebar
  const lifecycleSteps = [
    { label: 'Registro', active: true },
    { label: 'Identificação', active: false },
    { label: 'Análise de Causa Raiz', active: false },
    { label: 'Erro Conhecido', active: false },
    { label: 'Resolução', active: false },
    { label: 'Encerramento', active: false },
  ]

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Page Header */}
      <PageHeader
        title="Novo Problema"
        description="Registrar um novo problema identificado — ITIL Problem Management"
        icon={ExclamationTriangleIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Problemas', href: '/admin/problems' },
          { label: 'Novo Problema' },
        ]}
        actions={[
          {
            label: 'Voltar',
            onClick: () => router.push('/admin/problems'),
            icon: ArrowLeftIcon,
            variant: 'ghost',
          },
        ]}
      />

      {/* Main Layout: Form + Sidebar */}
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left: Form */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Informações Básicas */}
            <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.05s' }}>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-brand-500" />
                Informações Básicas
              </h2>

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Título do Problema <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all"
                    placeholder="Ex: Lentidão intermitente no sistema ERP nas últimas 48h"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Descrição Detalhada <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all resize-none"
                    placeholder="Descreva os sintomas observados, quando ocorrem, padrões identificados e quem é afetado..."
                  />
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Inclua sintomas, padrões recorrentes e número de incidentes relacionados
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={formData.category_id}
                    onChange={(e) => updateField('category_id', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Impacto & Urgência (ITIL Matrix) */}
            <div className="glass-panel animate-slide-up bg-gradient-to-br from-orange-50/50 to-red-50/30 dark:from-orange-950/20 dark:to-red-950/10" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                <ShieldExclamationIcon className="w-5 h-5 text-orange-500" />
                Classificação de Impacto & Urgência
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                A prioridade é calculada automaticamente pela matriz ITIL (Impacto × Urgência)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Impact */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-1.5">
                    <BoltIcon className="w-4 h-4 text-orange-500" />
                    Impacto no Negócio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {IMPACT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField('impact', opt.value)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          formData.impact === opt.value
                            ? `${opt.color} border-current ring-2 ring-offset-1 ring-current/20 dark:ring-offset-neutral-900`
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${formData.impact === opt.value ? opt.dot : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-1.5">
                    <SignalIcon className="w-4 h-4 text-red-500" />
                    Urgência
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {URGENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField('urgency', opt.value)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          formData.urgency === opt.value
                            ? `${opt.color} border-current ring-2 ring-offset-1 ring-current/20 dark:ring-offset-neutral-900`
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${formData.urgency === opt.value ? opt.dot : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Computed Priority Badge */}
              {computedPriority && (
                <div className="mt-5 p-3 bg-white/60 dark:bg-neutral-800/60 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Prioridade calculada:
                  </span>
                  <span className={`text-sm font-bold ${computedPriority.color}`}>
                    {computedPriority.label}
                  </span>
                </div>
              )}
            </div>

            {/* Section 3: Atribuição */}
            <div className="glass-panel animate-slide-up bg-gradient-to-br from-brand-50/50 to-cyan-50/30 dark:from-brand-950/20 dark:to-cyan-950/10" style={{ animationDelay: '0.15s' }}>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-brand-500" />
                Atribuição
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Team */}
                <div>
                  <label htmlFor="team" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                    <UserGroupIcon className="w-4 h-4" />
                    Equipe Responsável
                  </label>
                  <select
                    id="team"
                    value={formData.assigned_team_id}
                    onChange={(e) => updateField('assigned_team_id', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="">Nenhuma equipe</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id.toString()}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agent */}
                <div>
                  <label htmlFor="agent" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    Analista Responsável
                  </label>
                  <select
                    id="agent"
                    value={formData.assigned_to}
                    onChange={(e) => updateField('assigned_to', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="">Não atribuído</option>
                    {agents.map((user) => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Serviços Afetados */}
            <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                <ServerIcon className="w-5 h-5 text-brand-500" />
                Serviços Afetados
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService() } }}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all"
                  placeholder="Nome do serviço (Enter para adicionar)"
                />
                <button
                  type="button"
                  onClick={addService}
                  aria-label="Adicionar serviço"
                  className="px-4 py-2.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors flex items-center justify-center"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {formData.affected_services.map((service, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-full text-sm flex items-center gap-2 animate-fade-in"
                  >
                    <ServerIcon className="w-3.5 h-3.5" />
                    {service}
                    <button
                      type="button"
                      onClick={() => removeService(service)}
                      aria-label={`Remover serviço ${service}`}
                      className="text-brand-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-0.5"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </span>
                ))}
                {formData.affected_services.length === 0 && (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
                    Nenhum serviço adicionado — adicione os serviços impactados por este problema
                  </p>
                )}
              </div>
            </div>

            {/* Section 5: Incidentes Relacionados */}
            <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.25s' }}>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                Incidentes Relacionados
              </h2>

              <div>
                <label htmlFor="incidents" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  IDs dos Incidentes
                </label>
                <input
                  id="incidents"
                  type="text"
                  value={formData.related_incidents}
                  onChange={(e) => updateField('related_incidents', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all"
                  placeholder="Ex: 1234, 1256, 1278"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                  Separe os IDs por vírgula. Os incidentes serão vinculados após a criação do problema.
                </p>
              </div>
            </div>

            {/* ITIL Info Box */}
            <div className="glass-panel animate-slide-up bg-gradient-to-br from-brand-50 to-brand-50/50 dark:from-brand-950/20 dark:to-brand-950/10 border-brand-200 dark:border-brand-800" style={{ animationDelay: '0.3s' }}>
              <div className="flex gap-3">
                <InformationCircleIcon className="w-6 h-6 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-brand-700 dark:text-brand-300">
                  <p className="font-semibold mb-2">Fluxo ITIL — Próximos passos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>O problema será registrado com status <strong>Aberto</strong></li>
                    <li>Será atribuído à equipe/analista para investigação</li>
                    <li>Análise de Causa Raiz (RCA) será conduzida</li>
                    <li>Workaround pode ser documentado como Erro Conhecido</li>
                    <li>Resolução permanente será planejada e aplicada</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions (desktop) */}
            <div className="hidden sm:flex flex-row gap-3 pt-2 animate-slide-up" style={{ animationDelay: '0.35s' }}>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? (
                  <>
                    <div aria-hidden="true" className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span className="sr-only">Carregando...</span>
                    Registrando...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-5 h-5" />
                    Registrar Problema
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/problems')}
                className="px-6 py-3 text-neutral-600 dark:text-neutral-400 rounded-lg font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        {/* Right: Sidebar — Lifecycle & Summary */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-6">
          {/* ITIL Lifecycle */}
          <div className="glass-panel animate-slide-up sticky top-6" style={{ animationDelay: '0.15s' }}>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wider">
              Ciclo de Vida ITIL
            </h3>
            <div className="space-y-1">
              {lifecycleSteps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    step.active
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step.active
                      ? 'bg-brand-500 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm ${step.active ? 'font-medium' : ''}`}>
                    {step.label}
                  </span>
                  {step.active && (
                    <ChevronRightIcon className="w-4 h-4 ml-auto text-brand-500" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Summary */}
          <div className="glass-panel animate-slide-up sticky top-[340px]" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wider">
              Resumo
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Título</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium truncate ml-3 max-w-[140px]" title={formData.title}>
                  {formData.title || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Categoria</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium truncate ml-3 max-w-[140px]">
                  {categories.find(c => c.id.toString() === formData.category_id)?.name || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Impacto</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                  {IMPACT_OPTIONS.find(o => o.value === formData.impact)?.label || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Urgência</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                  {URGENCY_OPTIONS.find(o => o.value === formData.urgency)?.label || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Prioridade</span>
                <span className={`font-bold ${computedPriority?.color || 'text-neutral-400 dark:text-neutral-500'}`}>
                  {computedPriority?.label || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Equipe</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium truncate ml-3 max-w-[140px]">
                  {teams.find(t => t.id.toString() === formData.assigned_team_id)?.name || '—'}
                </span>
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-800" />
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Serviços</span>
                <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                  {formData.affected_services.length || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-700 shadow-lg p-3 sm:hidden safe-bottom z-10">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-gradient-brand rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div aria-hidden="true" className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Registrando...
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                Registrar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
