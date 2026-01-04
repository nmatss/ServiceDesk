'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon
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

interface ServicesClientProps {
  serviceAreas: ServiceArea[]
  quickActions: QuickAction[]
}

export default function ServicesClient({ serviceAreas, quickActions }: ServicesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [recentRequests, setRecentRequests] = useState<{ id: number; title: string; status: string; area: string }[]>([])

  useEffect(() => {
    // Fetch recent requests - client-side only
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
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 animate-fade-in">
      <div className="glass-panel shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600" />
                Central de Serviços
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mt-1">
                Todas as áreas da empresa em um só lugar
              </p>
            </div>
            <button
              onClick={() => router.push('/portal/requests')}
              className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg"
            >
              Minhas Solicitações
            </button>
          </div>

          <div className="mt-4">
            <div className="relative max-w-2xl">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O que você precisa? Busque serviços, áreas ou palavras-chave..."
                className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <StarIconSolid className="w-5 h-5 text-warning-500" />
            Ações Mais Usadas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="group relative bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 rounded-xl p-4 border-2 border-neutral-200 dark:border-neutral-700 hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-left overflow-hidden"
              >
                {/* Icon with gradient */}
                <div className={`w-12 h-12 ${action.color} bg-gradient-to-br rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-1 transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-description line-clamp-2 mb-2">
                  {action.description}
                </p>

                {/* Call to action indicator */}
                <div className="flex items-center text-sky-600 dark:text-sky-400 text-xs font-medium">
                  <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {recentRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-neutral-400" />
              Suas Solicitações Recentes
            </h2>
            <div className="glass-panel rounded-xl border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-700">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => router.push(`/portal/requests/${request.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-neutral-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      request.status === 'approved' ? 'bg-success-500' :
                      request.status === 'in_progress' ? 'bg-warning-500' : 'bg-brand-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-neutral-900">{request.title}</p>
                      <p className="text-xs text-neutral-500 capitalize">{request.area}</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-5 h-5 text-neutral-300" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Áreas de Atendimento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAreas.map((area) => (
              <div
                key={area.id}
                onClick={() => handleAreaClick(area.id)}
                className="group relative bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 p-5 hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
              >
                {/* Featured badge */}
                {area.featured && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <StarIconSolid className="w-3 h-3" />
                    Destaque
                  </div>
                )}

                {/* Icon with gradient background - improved */}
                <div className={`h-16 w-16 bg-gradient-to-br ${area.bgColor.replace('bg-', 'from-')}/50 ${area.bgColor.replace('bg-', 'to-')}/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg relative`}>
                  <area.icon className={`w-8 h-8 ${area.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-2 transition-colors">
                  {area.name}
                </h3>
                <p className="text-sm text-description line-clamp-2 mb-4">
                  {area.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-content mb-3">
                  <span className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                    {area.services} serviços
                  </span>
                  <span className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {area.avgResponseTime}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIconSolid
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(area.satisfaction) ? 'text-yellow-400' : 'text-neutral-200 dark:text-neutral-700'}`}
                    />
                  ))}
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 ml-1">{area.satisfaction}</span>
                </div>

                {/* Call to action */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1">
                    Ver serviços
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-panel/20 rounded-xl">
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
              className="px-6 py-3 glass-panel text-brand-600 rounded-lg font-medium hover:bg-brand-50 transition-colors"
            >
              Falar com Atendente
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/portal')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg"
          >
            Voltar
          </button>
          <button
            onClick={() => router.push('/portal/requests')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg"
          >
            Minhas Solicitações
          </button>
        </div>
      </div>
    </div>
  )
}
