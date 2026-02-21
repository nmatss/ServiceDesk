'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';
import toast from 'react-hot-toast'
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  UserPlusIcon,
  ServerIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

interface Team {
  id: number
  tenant_id: number
  name: string
  slug: string
  description?: string
  team_type: 'technical' | 'business' | 'support' | 'management'
  specializations: string[]
  capabilities: string[]
  icon: string
  color: string
  manager_id?: number
  manager_name?: string
  sla_response_time?: number
  max_concurrent_tickets: number
  auto_assignment_enabled: boolean
  assignment_algorithm: 'round_robin' | 'least_loaded' | 'skill_based'
  contact_email?: string
  contact_phone?: string
  is_active: boolean
  created_at: string
}

interface TeamMember {
  id: number
  team_id: number
  user_id: number
  name: string
  email: string
  role: 'manager' | 'lead' | 'senior' | 'member' | 'trainee'
  specializations?: string[]
  availability_status: 'available' | 'busy' | 'away' | 'off_duty'
  workload_percentage: number
  joined_at: string
}

const teamTypeIcons = {
  technical: ServerIcon,
  business: UserGroupIcon,
  support: UserGroupIcon,
  management: ShieldCheckIcon
}

const availabilityColors = {
  available: 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400',
  busy: 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400',
  away: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400',
  off_duty: 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
}

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [_showCreateModal, setShowCreateModal] = useState(false)
  const [_showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch('/api/teams', {
        credentials: 'include' // Use httpOnly cookies
      })
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams)
      }
    } catch (error) {
      logger.error('Error fetching teams', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async (teamId: number) => {
    try {
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/teams/${teamId}/members`, {
        credentials: 'include' // Use httpOnly cookies
      })
      const data = await response.json()
      if (data.success) {
        setTeamMembers(data.members)
      }
    } catch (error) {
      logger.error('Error fetching team members', error)
    }
  }

  const selectTeam = (team: Team) => {
    setSelectedTeam(team)
    fetchTeamMembers(team.id)
  }

  const getTeamTypeIcon = (teamType: string) => {
    const IconComponent = teamTypeIcons[teamType as keyof typeof teamTypeIcons] || UsersIcon
    return <IconComponent className="w-5 h-5" />
  }

  // Calcular estatísticas
  const totalTeams = teams.length
  const activeTeams = teams.filter(t => t.is_active).length
  const technicalTeams = teams.filter(t => t.team_type === 'technical').length
  const totalMembers = teams.reduce((acc, team) => {
    // Aqui você precisaria buscar os membros de cada equipe
    // Por enquanto, vamos usar um placeholder
    return acc
  }, teamMembers.length)

  const handleExport = () => {
    logger.info('Exportando equipes...')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header moderno com breadcrumbs */}
      <PageHeader
        title="Gerenciamento de Equipes"
        description="Gerencie equipes, departamentos e seus perfis customizáveis"
        icon={UserGroupIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Equipes' }
        ]}
        actions={[
          {
            label: 'Exportar',
            icon: DocumentArrowDownIcon,
            variant: 'secondary',
            onClick: handleExport
          },
          {
            label: 'Nova Equipe',
            icon: PlusIcon,
            variant: 'primary',
            onClick: () => setShowCreateModal(true)
          }
        ]}
      />

      {/* Stats Grid */}
      <StatsGrid cols={4}>
        <StatsCard
          title="Total de Equipes"
          value={totalTeams}
          icon={UserGroupIcon}
          color="brand"
          loading={loading}
          change={{
            value: 12,
            type: 'increase',
            period: 'vs último mês'
          }}
        />
        <StatsCard
          title="Equipes Ativas"
          value={activeTeams}
          icon={ChartBarIcon}
          color="success"
          loading={loading}
        />
        <StatsCard
          title="Equipes Técnicas"
          value={technicalTeams}
          icon={ServerIcon}
          color="info"
          loading={loading}
        />
        <StatsCard
          title="Total de Membros"
          value={totalMembers || 0}
          icon={UserCircleIcon}
          color="warning"
          loading={loading}
        />
      </StatsGrid>

      {/* Grid de Equipes e Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
        {/* Teams List - Glass Panel */}
        <div className="lg:col-span-1">
          <div className="glass-panel overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Equipes ({teams.length})
              </h2>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-700 max-h-[calc(100vh-400px)] overflow-y-auto">
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  onClick={() => selectTeam(team)}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 animate-slide-up ${
                    selectedTeam?.id === team.id
                      ? 'bg-brand-50 dark:bg-brand-900/20 border-r-2 border-brand-500'
                      : ''
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="p-2 rounded-lg transition-transform hover:scale-110"
                        style={{
                          backgroundColor: team.color + '20',
                          color: team.color
                        }}
                      >
                        {getTeamTypeIcon(team.team_type)}
                      </div>
                      <div>
                        <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                          {team.name}
                        </h3>
                        <p className="text-sm text-muted-content capitalize">
                          {team.team_type}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-neutral-400" />
                  </div>

                  {team.description && (
                    <p className="mt-2 text-sm text-description line-clamp-2">
                      {team.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center space-x-4 text-xs text-muted-content">
                    {team.sla_response_time && (
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>SLA: {team.sla_response_time}min</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <UsersIcon className="w-3 h-3" />
                      <span>Max: {team.max_concurrent_tickets}</span>
                    </div>
                    {!team.is_active && (
                      <span className="badge badge-error badge-sm">Inativa</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Details */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="space-y-6">
              {/* Team Info Card - Glass Panel */}
              <div className="glass-panel overflow-hidden animate-slide-up">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="p-3 rounded-lg transition-transform hover:scale-110"
                      style={{
                        backgroundColor: selectedTeam.color + '20',
                        color: selectedTeam.color
                      }}
                    >
                      {getTeamTypeIcon(selectedTeam.team_type)}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                        {selectedTeam.name}
                      </h2>
                      <p className="text-description">
                        {selectedTeam.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="p-2 text-description hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200"
                      aria-label="Editar equipe"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Stats da Equipe */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-description">
                            SLA Resposta
                          </p>
                          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                            {selectedTeam.sla_response_time || 'N/A'}
                          </p>
                          {selectedTeam.sla_response_time && (
                            <p className="text-xs text-neutral-500">minutos</p>
                          )}
                        </div>
                        <ClockIcon className="w-8 h-8 text-brand-600 dark:text-brand-400 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-description">
                            Max Tickets
                          </p>
                          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                            {selectedTeam.max_concurrent_tickets}
                          </p>
                          <p className="text-xs text-neutral-500">simultâneos</p>
                        </div>
                        <ChartBarIcon className="w-8 h-8 text-success-600 dark:text-success-400 opacity-50" />
                      </div>
                    </div>

                    <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-description">
                            Algoritmo
                          </p>
                          <p className="text-lg font-bold text-warning-600 dark:text-warning-400 capitalize">
                            {selectedTeam.assignment_algorithm.replace('_', ' ')}
                          </p>
                        </div>
                        <ServerIcon className="w-8 h-8 text-warning-600 dark:text-warning-400 opacity-50" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                        Informações Básicas
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-content">
                            Tipo:
                          </span>
                          <span className="badge badge-primary capitalize">
                            {selectedTeam.team_type}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-content">
                            Auto Atribuição:
                          </span>
                          <span className={`badge ${
                            selectedTeam.auto_assignment_enabled
                              ? 'badge-success'
                              : 'badge-neutral'
                          }`}>
                            {selectedTeam.auto_assignment_enabled ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-content">
                            Status:
                          </span>
                          <span className={`badge ${
                            selectedTeam.is_active ? 'badge-success' : 'badge-error'
                          }`}>
                            {selectedTeam.is_active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                        Informações de Contato
                      </h3>
                      <div className="space-y-3">
                        {selectedTeam.contact_email && (
                          <div className="flex items-center space-x-2 text-sm">
                            <EnvelopeIcon className="w-4 h-4 text-neutral-400" />
                            <span className="text-neutral-900 dark:text-neutral-100">
                              {selectedTeam.contact_email}
                            </span>
                          </div>
                        )}
                        {selectedTeam.contact_phone && (
                          <div className="flex items-center space-x-2 text-sm">
                            <PhoneIcon className="w-4 h-4 text-neutral-400" />
                            <span className="text-neutral-900 dark:text-neutral-100">
                              {selectedTeam.contact_phone}
                            </span>
                          </div>
                        )}
                        {selectedTeam.manager_name && (
                          <div className="flex items-center space-x-2 text-sm">
                            <UserCircleIcon className="w-4 h-4 text-neutral-400" />
                            <span className="text-neutral-900 dark:text-neutral-100">
                              Gerente: {selectedTeam.manager_name}
                            </span>
                          </div>
                        )}
                        {!selectedTeam.contact_email &&
                         !selectedTeam.contact_phone &&
                         !selectedTeam.manager_name && (
                          <p className="text-sm text-muted-content italic">
                            Nenhuma informação de contato disponível
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Specializations */}
                  {selectedTeam.specializations.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                        Especializações
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeam.specializations.map((spec, index) => (
                          <span
                            key={index}
                            className="badge badge-info animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {spec.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Capabilities */}
                  {selectedTeam.capabilities.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                        Capacidades
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeam.capabilities.map((capability, index) => (
                          <span
                            key={index}
                            className="badge badge-success animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Members Card - Glass Panel */}
              <div className="glass-panel overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Membros da Equipe ({teamMembers.length})
                  </h3>
                  <button onClick={() => toast.error('Adição de membros ainda não implementada')} className="btn btn-primary">
                    <UserPlusIcon className="w-4 h-4 mr-2" />
                    Adicionar Membro
                  </button>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {teamMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-brand rounded-full flex items-center justify-center shadow-md">
                            <span className="text-sm font-medium text-white">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                              {member.name}
                            </h4>
                            <p className="text-sm text-muted-content">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`badge ${
                            member.availability_status === 'available'
                              ? 'badge-success'
                              : member.availability_status === 'busy'
                              ? 'badge-warning'
                              : member.availability_status === 'away'
                              ? 'badge-neutral'
                              : 'badge-error'
                          }`}>
                            {member.availability_status.replace('_', ' ')}
                          </span>
                          <span className="badge badge-primary capitalize">
                            {member.role}
                          </span>
                          <div className="text-right min-w-[60px]">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {member.workload_percentage}%
                            </p>
                            <p className="text-xs text-muted-content">
                              carga
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Workload progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              member.workload_percentage >= 80
                                ? 'bg-error-500'
                                : member.workload_percentage >= 60
                                ? 'bg-warning-500'
                                : 'bg-success-500'
                            }`}
                            style={{
                              width: `${member.workload_percentage}%`,
                              animationDelay: `${index * 50 + 200}ms`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {teamMembers.length === 0 && (
                    <div className="p-8 text-center text-muted-content">
                      <UsersIcon className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-4" />
                      <p className="font-medium">Nenhum membro na equipe ainda</p>
                      <p className="text-sm mt-1">Adicione membros para começar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 text-center animate-fade-in">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                  <UsersIcon className="w-10 h-10 text-neutral-400" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Selecione uma Equipe
                </h3>
                <p className="text-description">
                  Escolha uma equipe da lista à esquerda para ver detalhes e gerenciar membros
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}