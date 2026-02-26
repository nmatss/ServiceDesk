'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import { contactInfo, formattedContacts } from '@/lib/config/contact';
import {
  ExclamationTriangleIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowRightIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
  PhoneIcon,
  EnvelopeIcon
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
      case 'incident': return 'border-error-200 bg-error-50'
      case 'request': return 'border-brand-200 bg-brand-50'
      case 'change': return 'border-warning-200 bg-warning-50'
      case 'problem': return 'border-purple-200 bg-purple-50'
      default: return 'border-neutral-200 bg-neutral-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in">
      {/* Header - Mobile Optimized */}
      <div className="glass-panel shadow-sm border-b sticky top-0 z-10">
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
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                Portal do Cliente
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 line-clamp-2 sm:line-clamp-none">
                Abra tickets, acompanhe chamados e acesse a base de conhecimento
              </p>
            </div>
            {/* Quick Actions - Mobile */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => router.push('/portal/tickets')}
                className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
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
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2 sm:mb-4">
            Como podemos ajudar você hoje?
          </h2>
          <p className="text-sm sm:text-base md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto px-2">
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
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTicketTypeSelect(ticketType) } }}
                role="button"
                tabIndex={0}
                className={`relative p-4 sm:p-5 md:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] sm:hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${getUrgencyColor(ticketType.workflow_type)}`}
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
                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1 sm:mb-2 truncate">
                      {ticketType.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 sm:line-clamp-none">
                      {ticketType.description}
                    </p>
                  </div>
                </div>

                {/* SLA Info */}
                <div className="flex items-center gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{workflowInfo.slaInfo}</span>
                </div>

                {/* Examples - Hidden on very small screens */}
                <div className="hidden xs:block mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 sm:mb-2">Exemplos:</p>
                  <ul className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-0.5 sm:space-y-1">
                    {workflowInfo.examples.slice(0, 2).map((example, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-neutral-400 rounded-full flex-shrink-0"></span>
                        <span className="truncate">{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 dark:border-neutral-700/50">
                  <span className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Toque para abrir
                  </span>
                  <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 dark:text-neutral-500" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Additional Resources - Mobile Optimized with Enhanced Design */}
        <div className="glass-panel rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3 sm:mb-4">
            Precisa de ajuda para decidir?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/knowledge')}
              className="group relative bg-gradient-to-br from-white to-green-50 dark:from-neutral-800 dark:to-green-950/20 p-4 sm:p-5 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left overflow-hidden"
            >
              {/* Icon with gradient background */}
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <BookOpenIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>

              {/* Badge counter */}
              <span className="absolute top-3 right-3 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
                150+ artigos
              </span>

              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                Base de Conhecimento
              </h4>
              <p className="text-xs sm:text-sm text-description mb-3">
                Encontre respostas para suas dúvidas
              </p>

              {/* Call to action */}
              <div className="flex items-center text-green-600 dark:text-green-400 font-medium text-sm">
                Explorar
                <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => router.push('/portal/faq')}
              className="group relative bg-gradient-to-br from-white to-orange-50 dark:from-neutral-800 dark:to-orange-950/20 p-4 sm:p-5 rounded-xl border-2 border-orange-200 dark:border-orange-700 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left overflow-hidden"
            >
              {/* Icon with gradient background */}
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <QuestionMarkCircleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>

              {/* Badge counter */}
              <span className="absolute top-3 right-3 px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-semibold rounded-full">
                50+ FAQs
              </span>

              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                Perguntas Frequentes
              </h4>
              <p className="text-xs sm:text-sm text-description mb-3">
                Respostas rápidas para dúvidas comuns
              </p>

              {/* Call to action */}
              <div className="flex items-center text-orange-600 dark:text-orange-400 font-medium text-sm">
                Ver FAQs
                <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Contact Info - Mobile Optimized with Enhanced Design */}
        <div className="mt-6 sm:mt-8 px-2">
          <div className="glass-panel rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 sm:p-6">
            <p className="text-sm sm:text-base text-description mb-4 sm:mb-5 text-center font-medium">
              Precisa de ajuda imediata?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Phone Contact */}
              <a
                href={`tel:${formattedContacts.tel.support}`}
                className="group flex flex-col items-center p-3 sm:p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all duration-200 hover:shadow-md"
              >
                <PhoneIcon className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-muted-content mb-1">Telefone</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{contactInfo.phone.support}</span>
              </a>

              {/* Email Contact */}
              <a
                href={formattedContacts.mailto.support}
                className="group flex flex-col items-center p-3 sm:p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all duration-200 hover:shadow-md"
              >
                <EnvelopeIcon className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-muted-content mb-1">E-mail</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-full">{contactInfo.email.support}</span>
              </a>

              {/* WhatsApp Contact */}
              <a
                href={formattedContacts.whatsapp.support}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center p-3 sm:p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-success-500 dark:hover:border-success-500 hover:bg-success-50 dark:hover:bg-success-950/20 transition-all duration-200 hover:shadow-md"
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-success-600 mb-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-xs text-muted-content mb-1">WhatsApp</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{contactInfo.phone.whatsapp}</span>
              </a>
            </div>

            {/* Business Hours */}
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-center">
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-content">
                <ClockIcon className="w-4 h-4" />
                <span>{contactInfo.hours.weekdays}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-lg p-3 sm:hidden safe-bottom">
        <button
          onClick={() => router.push('/portal/tickets')}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
        >
          <span>Ver Meus Tickets</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}