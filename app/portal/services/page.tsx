'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ComputerDesktopIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  TruckIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface ServiceArea {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  services: number
  avgResponseTime: string
  satisfaction: number
  featured?: boolean
}

interface QuickAction {
  id: string
  title: string
  description: string
  area: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  popular?: boolean
}

const serviceAreas: ServiceArea[] = [
  {
    id: 'ti',
    name: 'Tecnologia da Informação',
    description: 'Suporte técnico, sistemas, infraestrutura e segurança',
    icon: ComputerDesktopIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    services: 45,
    avgResponseTime: '15min',
    satisfaction: 4.8,
    featured: true
  },
  {
    id: 'rh',
    name: 'Recursos Humanos',
    description: 'Folha de pagamento, benefícios, férias e admissões',
    icon: UserGroupIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    services: 28,
    avgResponseTime: '2h',
    satisfaction: 4.6
  },
  {
    id: 'facilities',
    name: 'Facilities',
    description: 'Manutenção predial, limpeza, segurança patrimonial',
    icon: BuildingOfficeIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    services: 22,
    avgResponseTime: '4h',
    satisfaction: 4.5
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    description: 'Reembolsos, pagamentos, notas fiscais e orçamentos',
    icon: CurrencyDollarIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    services: 18,
    avgResponseTime: '1d',
    satisfaction: 4.4
  },
  {
    id: 'juridico',
    name: 'Jurídico',
    description: 'Contratos, compliance e questões legais',
    icon: ShieldCheckIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    services: 12,
    avgResponseTime: '2d',
    satisfaction: 4.7
  },
  {
    id: 'treinamento',
    name: 'Treinamento',
    description: 'Capacitação, cursos e desenvolvimento profissional',
    icon: AcademicCapIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    services: 15,
    avgResponseTime: '1d',
    satisfaction: 4.9
  },
  {
    id: 'logistica',
    name: 'Logística',
    description: 'Entregas, frota e gestão de materiais',
    icon: TruckIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    services: 10,
    avgResponseTime: '4h',
    satisfaction: 4.3
  },
  {
    id: 'saude',
    name: 'Saúde e Segurança',
    description: 'Medicina do trabalho, EPIs e segurança ocupacional',
    icon: HeartIcon,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    services: 8,
    avgResponseTime: '30min',
    satisfaction: 4.8
  }
]

const quickActions: QuickAction[] = [
  { id: 'reset-senha', title: 'Redefinir Senha', description: 'Recupere acesso ao sistema', area: 'ti', icon: ComputerDesktopIcon, color: 'bg-blue-500', popular: true },
  { id: 'novo-usuario', title: 'Novo Usuário', description: 'Criar acesso para colaborador', area: 'ti', icon: UserGroupIcon, color: 'bg-blue-500', popular: true },
  { id: 'ferias', title: 'Solicitar Férias', description: 'Agendar período de férias', area: 'rh', icon: DocumentTextIcon, color: 'bg-purple-500', popular: true },
  { id: 'reembolso', title: 'Reembolso', description: 'Solicitar reembolso de despesas', area: 'financeiro', icon: CurrencyDollarIcon, color: 'bg-yellow-500', popular: true },
  { id: 'manutencao', title: 'Manutenção', description: 'Reportar problema predial', area: 'facilities', icon: WrenchScrewdriverIcon, color: 'bg-green-500' },
  { id: 'equipamento', title: 'Novo Equipamento', description: 'Solicitar computador/periférico', area: 'ti', icon: ComputerDesktopIcon, color: 'bg-blue-500' }
]

export default function MultiServicePortalPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [recentRequests, setRecentRequests] = useState<{ id: number; title: string; status: string; area: string }[]>([])

  useEffect(() => {
    // Fetch recent requests
    // This would be an API call in production
    setRecentRequests([
      { id: 1, title: 'Reset de senha - SAP', status: 'in_progress', area: 'ti' },
      { id: 2, title: 'Férias - Janeiro 2025', status: 'pending', area: 'rh' },
      { id: 3, title: 'Reembolso viagem SP', status: 'approved', area: 'financeiro' }
    ])
  }, [])

  const handleAreaClick = (areaId: string) => {
    router.push(`/portal/services/${areaId}`)
  }

  const handleQuickAction = (actionId: string) => {
    router.push(`/portal/request/${actionId}`)
  }

  const filteredAreas = serviceAreas.filter(area =>
    area.name.toLowerCase().includes(search.toLowerCase()) ||
    area.description.toLowerCase().includes(search.toLowerCase())
  )

  const popularActions = quickActions.filter(a => a.popular)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                Central de Serviços
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Todas as áreas da empresa em um só lugar
              </p>
            </div>
            <button
              onClick={() => router.push('/portal/requests')}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
            >
              Minhas Solicitações
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative max-w-2xl">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O que você precisa? Busque serviços, áreas ou palavras-chave..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <StarIconSolid className="w-5 h-5 text-yellow-500" />
            Ações Mais Usadas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all text-left group"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600 mb-1">
                  {action.title}
                </h3>
                <p className="text-xs text-gray-500">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Requests */}
        {recentRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              Suas Solicitações Recentes
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => router.push(`/portal/requests/${request.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      request.status === 'approved' ? 'bg-green-500' :
                      request.status === 'in_progress' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{request.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{request.area}</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-5 h-5 text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Areas */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Áreas de Atendimento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAreas.map((area) => (
              <div
                key={area.id}
                onClick={() => handleAreaClick(area.id)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group relative"
              >
                {area.featured && (
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                    <StarIcon className="w-3 h-3" />
                    Destaque
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${area.bgColor} flex-shrink-0`}>
                    <area.icon className={`w-6 h-6 ${area.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                      {area.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {area.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <DocumentTextIcon className="w-3.5 h-3.5" />
                        {area.services} serviços
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {area.avgResponseTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarIconSolid
                          key={star}
                          className={`w-3.5 h-3.5 ${star <= Math.round(area.satisfaction) ? 'text-yellow-400' : 'text-gray-200'}`}
                        />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">{area.satisfaction}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100">
                  <span className="text-sm text-blue-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Ver serviços
                    <ArrowRightIcon className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <ChatBubbleLeftRightIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Não encontrou o que procura?</h3>
                <p className="text-white/80 text-sm">
                  Nossa equipe está pronta para ajudar você
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/portal/support')}
              className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Falar com Atendente
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/portal')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Voltar
          </button>
          <button
            onClick={() => router.push('/portal/requests')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg"
          >
            Minhas Solicitações
          </button>
        </div>
      </div>
    </div>
  )
}
