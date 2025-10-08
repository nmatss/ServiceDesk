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
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            {tenant?.logo_url && (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-12 w-auto"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Portal do Cliente - Abra e Acompanhe seus Tickets
              </h1>
              <p className="text-gray-600">
                Precisa abrir um ticket ou acompanhar seu chamado? No portal do cliente você pode criar tickets, acompanhar status em tempo real e acessar nossa base de conhecimento. Suporte disponível 24/7.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Como podemos ajudar você hoje?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Escolha o tipo de solicitação que melhor descreve sua necessidade.
            Nossa equipe está pronta para atendê-lo.
          </p>
        </div>

        {/* Ticket Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {ticketTypes.map((ticketType) => {
            const workflowInfo = workflowTypeInfo[ticketType.workflow_type]

            return (
              <div
                key={ticketType.id}
                onClick={() => handleTicketTypeSelect(ticketType)}
                className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${getUrgencyColor(ticketType.workflow_type)}`}
                style={{
                  borderColor: ticketType.color + '40'
                }}
              >
                {/* Urgency Badge */}
                <div className="absolute top-4 right-4">
                  <span
                    className="px-3 py-1 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: ticketType.color }}
                  >
                    {workflowInfo.urgencyLabel}
                  </span>
                </div>

                {/* Icon and Title */}
                <div className="flex items-start space-x-4 mb-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: ticketType.color + '20' }}
                  >
                    {getWorkflowIcon(ticketType.icon, ticketType.color)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {ticketType.name}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {ticketType.description}
                    </p>
                  </div>
                </div>

                {/* SLA Info */}
                <div className="flex items-center space-x-2 mb-4 text-sm text-gray-500">
                  <ClockIcon className="w-4 h-4" />
                  <span>{workflowInfo.slaInfo}</span>
                </div>

                {/* Examples */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Exemplos:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {workflowInfo.examples.map((example, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Clique para continuar
                  </span>
                  <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Additional Resources */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Precisa de ajuda para decidir?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/knowledge')}
              className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
            >
              <BookOpenIcon className="w-6 h-6 text-blue-600" />
              <div>
                <h4 className="font-medium text-gray-900">Base de Conhecimento</h4>
                <p className="text-sm text-gray-600">Busque artigos e tutoriais</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/portal/faq')}
              className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
            >
              <QuestionMarkCircleIcon className="w-6 h-6 text-green-600" />
              <div>
                <h4 className="font-medium text-gray-900">Perguntas Frequentes</h4>
                <p className="text-sm text-gray-600">Respostas para dúvidas comuns</p>
              </div>
            </button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-2">
            Precisa de ajuda imediata? Entre em contato:
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm">
            <span className="text-gray-500">
              📞 (11) 1234-5678
            </span>
            <span className="text-gray-500">
              📧 suporte@empresa-demo.com
            </span>
            <span className="text-gray-500">
              🕒 Seg-Sex 8h às 18h
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}