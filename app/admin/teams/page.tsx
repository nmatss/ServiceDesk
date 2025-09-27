'use client'

import { useState, useEffect } from 'react'
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  ServerIcon,
  CodeBracketIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline'

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

const teamTypeColors = {
  technical: '#3B82F6',
  business: '#10B981',
  support: '#F59E0B',
  management: '#EF4444'
}

const availabilityColors = {
  available: 'bg-green-100 text-green-800',
  busy: 'bg-yellow-100 text-yellow-800',
  away: 'bg-gray-100 text-gray-800',
  off_duty: 'bg-red-100 text-red-800'
}

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setTeams(data.teams)
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async (teamId: number) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setTeamMembers(data.members)
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const selectTeam = (team: Team) => {
    setSelectedTeam(team)
    fetchTeamMembers(team.id)
  }

  const formatSpecializations = (specializations: string[]) => {
    return specializations.map(spec =>
      spec.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    ).join(', ')
  }

  const getTeamTypeIcon = (teamType: string) => {
    const IconComponent = teamTypeIcons[teamType as keyof typeof teamTypeIcons] || UsersIcon
    return <IconComponent className=\"w-5 h-5\" />
  }

  if (loading) {
    return (
      <div className=\"min-h-screen bg-gray-50 flex items-center justify-center\">
        <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600\"></div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-gray-50\">
      <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8\">
        {/* Header */}
        <div className=\"mb-8\">
          <div className=\"flex items-center justify-between\">
            <div>
              <h1 className=\"text-3xl font-bold text-gray-900\">
                Gerenciamento de Equipes
              </h1>
              <p className=\"mt-2 text-gray-600\">
                Gerencie equipes, departamentos e seus perfis customizáveis
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className=\"flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors\"
            >
              <PlusIcon className=\"w-4 h-4 mr-2\" />
              Nova Equipe
            </button>
          </div>
        </div>

        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-8\">
          {/* Teams List */}
          <div className=\"lg:col-span-1\">
            <div className=\"bg-white rounded-lg border border-gray-200 overflow-hidden\">
              <div className=\"px-6 py-4 border-b border-gray-200\">
                <h2 className=\"text-lg font-semibold text-gray-900\">
                  Equipes ({teams.length})
                </h2>
              </div>
              <div className=\"divide-y divide-gray-200\">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => selectTeam(team)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedTeam?.id === team.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className=\"flex items-center justify-between\">
                      <div className=\"flex items-center space-x-3\">
                        <div
                          className=\"p-2 rounded-lg\"
                          style={{ backgroundColor: team.color + '20', color: team.color }}
                        >
                          {getTeamTypeIcon(team.team_type)}
                        </div>
                        <div>
                          <h3 className=\"font-medium text-gray-900\">{team.name}</h3>
                          <p className=\"text-sm text-gray-500\">{team.team_type}</p>
                        </div>
                      </div>
                      <ChevronRightIcon className=\"w-4 h-4 text-gray-400\" />
                    </div>

                    {team.description && (
                      <p className=\"mt-2 text-sm text-gray-600 line-clamp-2\">
                        {team.description}
                      </p>
                    )}

                    <div className=\"mt-3 flex items-center space-x-4 text-xs text-gray-500\">
                      {team.sla_response_time && (
                        <div className=\"flex items-center space-x-1\">
                          <ClockIcon className=\"w-3 h-3\" />
                          <span>SLA: {team.sla_response_time}min</span>
                        </div>
                      )}
                      <div className=\"flex items-center space-x-1\">
                        <UsersIcon className=\"w-3 h-3\" />
                        <span>Max: {team.max_concurrent_tickets}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Details */}
          <div className=\"lg:col-span-2\">
            {selectedTeam ? (
              <div className=\"space-y-6\">
                {/* Team Info Card */}
                <div className=\"bg-white rounded-lg border border-gray-200 overflow-hidden\">
                  <div className=\"px-6 py-4 border-b border-gray-200 flex items-center justify-between\">
                    <div className=\"flex items-center space-x-3\">
                      <div
                        className=\"p-3 rounded-lg\"
                        style={{ backgroundColor: selectedTeam.color + '20', color: selectedTeam.color }}
                      >
                        {getTeamTypeIcon(selectedTeam.team_type)}
                      </div>
                      <div>
                        <h2 className=\"text-xl font-semibold text-gray-900\">
                          {selectedTeam.name}
                        </h2>
                        <p className=\"text-gray-600\">{selectedTeam.description}</p>
                      </div>
                    </div>
                    <div className=\"flex space-x-2\">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className=\"p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors\"
                      >
                        <PencilIcon className=\"w-4 h-4\" />
                      </button>
                    </div>
                  </div>

                  <div className=\"p-6\">
                    <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
                      {/* Basic Info */}
                      <div>
                        <h3 className=\"text-sm font-medium text-gray-900 mb-3\">
                          Informações Básicas
                        </h3>
                        <div className=\"space-y-2 text-sm\">
                          <div className=\"flex justify-between\">
                            <span className=\"text-gray-500\">Tipo:</span>
                            <span className=\"text-gray-900 capitalize\">{selectedTeam.team_type}</span>
                          </div>
                          <div className=\"flex justify-between\">
                            <span className=\"text-gray-500\">SLA Resposta:</span>
                            <span className=\"text-gray-900\">{selectedTeam.sla_response_time || 'N/A'} min</span>
                          </div>
                          <div className=\"flex justify-between\">
                            <span className=\"text-gray-500\">Max Tickets:</span>
                            <span className=\"text-gray-900\">{selectedTeam.max_concurrent_tickets}</span>
                          </div>
                          <div className=\"flex justify-between\">
                            <span className=\"text-gray-500\">Auto Atribuição:</span>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              selectedTeam.auto_assignment_enabled
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedTeam.auto_assignment_enabled ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div>
                        <h3 className=\"text-sm font-medium text-gray-900 mb-3\">
                          Contato
                        </h3>
                        <div className=\"space-y-2\">
                          {selectedTeam.contact_email && (
                            <div className=\"flex items-center space-x-2 text-sm\">
                              <EnvelopeIcon className=\"w-4 h-4 text-gray-400\" />
                              <span className=\"text-gray-900\">{selectedTeam.contact_email}</span>
                            </div>
                          )}
                          {selectedTeam.contact_phone && (
                            <div className=\"flex items-center space-x-2 text-sm\">
                              <PhoneIcon className=\"w-4 h-4 text-gray-400\" />
                              <span className=\"text-gray-900\">{selectedTeam.contact_phone}</span>
                            </div>
                          )}
                          {selectedTeam.manager_name && (
                            <div className=\"flex items-center space-x-2 text-sm\">
                              <UsersIcon className=\"w-4 h-4 text-gray-400\" />
                              <span className=\"text-gray-900\">Gerente: {selectedTeam.manager_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Specializations */}
                    {selectedTeam.specializations.length > 0 && (
                      <div className=\"mt-6\">
                        <h3 className=\"text-sm font-medium text-gray-900 mb-3\">
                          Especializações
                        </h3>
                        <div className=\"flex flex-wrap gap-2\">
                          {selectedTeam.specializations.map((spec, index) => (
                            <span
                              key={index}
                              className=\"px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full\"
                            >
                              {spec.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Capabilities */}
                    {selectedTeam.capabilities.length > 0 && (
                      <div className=\"mt-6\">
                        <h3 className=\"text-sm font-medium text-gray-900 mb-3\">
                          Capacidades
                        </h3>
                        <div className=\"flex flex-wrap gap-2\">
                          {selectedTeam.capabilities.map((capability, index) => (
                            <span
                              key={index}
                              className=\"px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full\"
                            >
                              {capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Members Card */}
                <div className=\"bg-white rounded-lg border border-gray-200 overflow-hidden\">
                  <div className=\"px-6 py-4 border-b border-gray-200 flex items-center justify-between\">
                    <h3 className=\"text-lg font-semibold text-gray-900\">
                      Membros da Equipe ({teamMembers.length})
                    </h3>
                    <button className=\"flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors\">
                      <UserPlusIcon className=\"w-4 h-4 mr-2\" />
                      Adicionar Membro
                    </button>
                  </div>

                  <div className=\"divide-y divide-gray-200\">
                    {teamMembers.map((member) => (
                      <div key={member.id} className=\"p-4\">
                        <div className=\"flex items-center justify-between\">
                          <div className=\"flex items-center space-x-3\">
                            <div className=\"w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center\">
                              <span className=\"text-sm font-medium text-gray-600\">
                                {member.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h4 className=\"font-medium text-gray-900\">{member.name}</h4>
                              <p className=\"text-sm text-gray-500\">{member.email}</p>
                            </div>
                          </div>
                          <div className=\"flex items-center space-x-4\">
                            <span className={`px-2 py-1 text-xs rounded-full ${availabilityColors[member.availability_status]}`}>
                              {member.availability_status.replace('_', ' ')}
                            </span>
                            <span className=\"text-sm text-gray-500 capitalize\">{member.role}</span>
                            <span className=\"text-sm text-gray-500\">{member.workload_percentage}%</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {teamMembers.length === 0 && (
                      <div className=\"p-8 text-center text-gray-500\">
                        <UsersIcon className=\"w-12 h-12 mx-auto text-gray-300 mb-4\" />
                        <p>Nenhum membro na equipe ainda</p>
                        <p className=\"text-sm\">Adicione membros para começar</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className=\"bg-white rounded-lg border border-gray-200 p-8 text-center\">
                <UsersIcon className=\"w-16 h-16 mx-auto text-gray-300 mb-4\" />
                <h3 className=\"text-lg font-medium text-gray-900 mb-2\">
                  Selecione uma Equipe
                </h3>
                <p className=\"text-gray-600\">
                  Escolha uma equipe da lista para ver detalhes e gerenciar membros
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}