'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  ExclamationTriangleIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowRightIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'

interface TicketType {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  color: string
  workflow_type: 'incident' | 'request' | 'change' | 'problem'
  sort_order: number
}

interface Tenant {
  id: number
  name: string
  slug: string
  logo_url?: string
  primary_color: string
  secondary_color: string
}

const workflowTypeInfo = {
  incident: {
    urgencyLabel: 'Urgente',
    description: 'Problemas que afetam sistemas em produção',
    examples: ['Sistema fora do ar', 'Erro crítico', 'Falha de segurança'],
    slaInfo: 'Resposta em até 15-30 minutos'
  },
  request: {
    urgencyLabel: 'Normal',
    description: 'Solicitações de novos serviços ou recursos',
    examples: ['Novo usuário', 'Acesso a sistema', 'Instalação de software'],
    slaInfo: 'Resposta em até 2-4 horas'
  },
  change: {
    urgencyLabel: 'Planejado',
    description: 'Mudanças planejadas em sistemas',
    examples: ['Atualização de sistema', 'Manutenção programada'],
    slaInfo: 'Análise em até 1-2 dias'
  },
  problem: {
    urgencyLabel: 'Análise',
    description: 'Investigação de problemas recorrentes',
    examples: ['Análise de causa raiz', 'Problema conhecido'],
    slaInfo: 'Investigação conforme prioridade'
  }
}

const iconComponents = {
  'ExclamationTriangleIcon': ExclamationTriangleIcon,
  'PlusCircleIcon': PlusCircleIcon,
  'ArrowPathIcon': ArrowPathIcon,
  'MagnifyingGlassIcon': MagnifyingGlassIcon,
  'UserGroupIcon': UserGroupIcon
}

export default function PortalClient() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchTenant()
    fetchTicketTypes()
  }, [])

  const fetchTenant = async () => {
    try {
      // In a real implementation, this would get tenant info based on domain/subdomain
      // For now, we'll use the default tenant
      setTenant({
        id: 1,
        name: 'Empresa Demo',
        slug: 'empresa-demo',
        primary_color: '#3B82F6',
        secondary_color: '#1F2937'
      })
    } catch (error) {
      logger.error('Error fetching tenant info', error)
    }
  }

  const fetchTicketTypes = async () => {
    try {
      const response = await fetch('/api/ticket-types?customer_visible=true')
      const data = await response.json()

      if (data.success) {
        setTicketTypes(data.ticket_types)
      }
    } catch (error) {
      logger.error('Error fetching ticket types', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTicketTypeSelect = (ticketType: TicketType) => {
    // Navigate to ticket creation form with pre-selected type
    router.push(`/portal/create?type=${ticketType.slug}`)
  }

  const getWorkflowIcon = (iconName: string, color: string) => {
    const IconComponent = iconComponents[iconName as keyof typeof iconComponents] || ExclamationTriangleIcon
    return <IconComponent className="w-8 h-8" style={{ color }} />
  }

  const getUrgencyColor = (workflowType: string) => {
    switch (workflowType) {
      case 'incident': return 'border-red-200 bg-red-50'
      case 'request': return 'border-blue-200 bg-blue-50'
      case 'change': return 'border-yellow-200 bg-yellow-50'
      case 'problem': return 'border-purple-200 bg-purple-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header - Mobile Optimized */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {tenant?.logo_url && (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-10 sm:h-12 w-auto flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                Portal do Cliente
              </h1>
              <p className="text-sm sm:text-base text-gray-600 line-clamp-2 sm:line-clamp-none">
                Abra tickets, acompanhe chamados e acesse a base de conhecimento
              </p>
            </div>
            {/* Quick Actions - Mobile */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => router.push('/portal/tickets')}
                className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Meus Tickets
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Welcome Section */}
        <div className="text-center mb-6 sm:mb-8 md:mb-12">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">
            Como podemos ajudar você hoje?
          </h2>
          <p className="text-sm sm:text-base md:text-xl text-gray-600 max-w-2xl mx-auto px-2">
            Escolha o tipo de solicitação que melhor descreve sua necessidade.
          </p>
        </div>

        {/* Ticket Types Grid - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12">
          {ticketTypes.map((ticketType) => {
            const workflowInfo = workflowTypeInfo[ticketType.workflow_type]

            return (
              <div
                key={ticketType.id}
                onClick={() => handleTicketTypeSelect(ticketType)}
                className={`relative p-4 sm:p-5 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] sm:hover:scale-105 ${getUrgencyColor(ticketType.workflow_type)}`}
                style={{
                  borderColor: ticketType.color + '40'
                }}
              >
                {/* Urgency Badge */}
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
                  <span
                    className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: ticketType.color }}
                  >
                    {workflowInfo.urgencyLabel}
                  </span>
                </div>

                {/* Icon and Title */}
                <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4 pr-16 sm:pr-20">
                  <div
                    className="p-2 sm:p-3 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: ticketType.color + '20' }}
                  >
                    {getWorkflowIcon(ticketType.icon, ticketType.color)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-1 sm:mb-2 truncate">
                      {ticketType.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 sm:line-clamp-none">
                      {ticketType.description}
                    </p>
                  </div>
                </div>

                {/* SLA Info */}
                <div className="flex items-center gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-gray-500">
                  <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{workflowInfo.slaInfo}</span>
                </div>

                {/* Examples - Hidden on very small screens */}
                <div className="hidden xs:block mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Exemplos:</p>
                  <ul className="text-xs sm:text-sm text-gray-600 space-y-0.5 sm:space-y-1">
                    {workflowInfo.examples.slice(0, 2).map((example, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0"></span>
                        <span className="truncate">{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                  <span className="text-xs sm:text-sm text-gray-500">
                    Toque para abrir
                  </span>
                  <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Additional Resources - Mobile Optimized */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Precisa de ajuda para decidir?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/knowledge')}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Base de Conhecimento</h4>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Busque artigos e tutoriais</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/portal/faq')}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <QuestionMarkCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Perguntas Frequentes</h4>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Respostas para dúvidas comuns</p>
              </div>
            </button>
          </div>
        </div>

        {/* Contact Info - Mobile Optimized */}
        <div className="mt-6 sm:mt-8 text-center px-2">
          <p className="text-sm sm:text-base text-gray-600 mb-2 sm:mb-3">
            Precisa de ajuda imediata?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs sm:text-sm">
            <a href="tel:+551112345678" className="text-gray-600 hover:text-blue-600 flex items-center gap-1.5">
              <span>📞</span>
              <span>(11) 1234-5678</span>
            </a>
            <a href="mailto:suporte@empresa-demo.com" className="text-gray-600 hover:text-blue-600 flex items-center gap-1.5">
              <span>📧</span>
              <span className="truncate max-w-[200px]">suporte@empresa-demo.com</span>
            </a>
            <span className="text-gray-500 flex items-center gap-1.5">
              <span>🕒</span>
              <span>Seg-Sex 8h-18h</span>
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <button
          onClick={() => router.push('/portal/tickets')}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
        >
          <span>Ver Meus Tickets</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}