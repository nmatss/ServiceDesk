'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  ComputerDesktopIcon,
  KeyIcon,
  CogIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  WrenchScrewdriverIcon,
  StarIcon,
  ClockIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
  FunnelIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface ServiceCategory {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  color: string
  item_count: number
}

interface CatalogItem {
  id: number
  name: string
  slug: string
  short_description: string
  description: string
  category_id: number
  category_name: string
  category_color: string
  icon: string
  is_featured: boolean
  is_public: boolean
  estimated_fulfillment_time: number
  cost_type: 'free' | 'fixed' | 'variable' | 'quote'
  base_cost: number
  cost_currency: string
  requires_approval: boolean
  satisfaction_rating: number
  request_count: number
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  access: KeyIcon,
  hardware: ComputerDesktopIcon,
  software: CogIcon,
  network: GlobeAltIcon,
  email: EnvelopeIcon,
  communications: PhoneIcon,
  hr: UserGroupIcon,
  facilities: BuildingOfficeIcon,
  support: WrenchScrewdriverIcon,
  default: CogIcon
}

interface CatalogClientProps {
  initialItems: CatalogItem[]
  initialCategories: ServiceCategory[]
}

export default function CatalogClient({ initialItems, initialCategories }: CatalogClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const [categories] = useState<ServiceCategory[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [showFeatured, setShowFeatured] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const getCategoryIcon = (iconName: string) => {
    return categoryIcons[iconName?.toLowerCase()] || categoryIcons.default
  }

  const formatCost = (item: CatalogItem) => {
    if (item.cost_type === 'free') return 'Gratuito'
    if (item.cost_type === 'quote') return 'Sob consulta'
    if (item.cost_type === 'variable') return 'Variável'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: item.cost_currency || 'BRL'
    }).format(item.base_cost)
  }

  const formatTime = (hours: number) => {
    if (!hours) return '-'
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days} dia${days > 1 ? 's' : ''}`
  }

  const handleRequestService = (item: CatalogItem) => {
    router.push(`/portal/catalog/${item.slug}/request`)
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory(null)
    setShowFeatured(false)
  }

  const hasActiveFilters = search || selectedCategory || showFeatured

  // Client-side filtering
  const filteredItems = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !item.short_description.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (selectedCategory && item.category_id !== selectedCategory) {
      return false
    }
    if (showFeatured && !item.is_featured) {
      return false
    }
    return true
  })

  const featuredItems = filteredItems.filter(item => item.is_featured)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 animate-fade-in">
      {/* Header */}
      <div className="glass-panel shadow-sm border-b sticky top-0 z-20 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 flex items-center gap-2 animate-slide-up">
                <SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600" />
                Catálogo de Serviços
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mt-1">
                Encontre e solicite os serviços que você precisa
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/portal/requests')}
                className="px-3 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-all duration-200"
              >
                Minhas Solicitações
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 flex gap-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviços..."
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-all duration-200 ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-600' : 'glass-panel border-neutral-200 text-neutral-600'}`}
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="glass-panel rounded-xl border border-neutral-200 shadow-sm p-4 mb-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Category Filter */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-500 mb-2">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const IconComponent = getCategoryIcon(cat.icon)
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                          selectedCategory === cat.id
                            ? 'bg-brand-100 text-brand-700 border-brand-200'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        } border`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span>{cat.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Featured Filter */}
              <div className="flex items-end">
                <button
                  onClick={() => setShowFeatured(!showFeatured)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${
                    showFeatured
                      ? 'bg-warning-100 text-warning-700 border-warning-200'
                      : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                  }`}
                >
                  <StarIconSolid className={`w-4 h-4 ${showFeatured ? 'text-warning-500' : 'text-neutral-400'}`} />
                  <span>Destaques</span>
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Categories Quick Access */}
        <div className="mb-6 relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-brand-50 to-transparent z-10 pointer-events-none sm:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-brand-50 to-transparent z-10 pointer-events-none sm:hidden" />

          <div className="-mx-3 px-3 overflow-x-auto scrollbar-hide sm:mx-0 sm:px-0 sm:overflow-visible">
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 min-w-max sm:min-w-0">
            {categories.slice(0, 6).map((cat) => {
              const IconComponent = getCategoryIcon(cat.icon)
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`flex flex-col items-center p-3 sm:p-4 rounded-xl border transition-all duration-200 animate-fade-in ${
                    selectedCategory === cat.id
                      ? 'bg-brand-50 border-brand-200 shadow-sm'
                      : 'glass-panel border-neutral-200 hover:border-brand-200 hover:shadow-sm'
                  }`}
                  style={{ minWidth: '100px' }}
                >
                  <div
                    className="p-2 sm:p-3 rounded-xl mb-2"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <div style={{ color: cat.color }}>
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-neutral-900 text-center line-clamp-1">{cat.name}</span>
                  <span className="text-[10px] sm:text-xs text-neutral-500">{cat.item_count || 0} serviços</span>
                </button>
              )
            })}
            </div>
          </div>
        </div>

        {/* Featured Services */}
        {!selectedCategory && !search && featuredItems.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <StarIconSolid className="w-5 h-5 text-warning-500" />
              Serviços em Destaque
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleRequestService(item)}
                  className="bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl p-4 sm:p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 group animate-slide-up"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <CogIcon className="w-6 h-6" />
                    </div>
                    <StarIconSolid className="w-5 h-5 text-warning-300" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                  <p className="text-sm text-white/80 line-clamp-2 mb-4">{item.short_description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">{formatCost(item)}</span>
                    <div className="flex items-center gap-1 text-sm group-hover:gap-2 transition-all duration-200">
                      <span>Solicitar</span>
                      <ArrowRightIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name || 'Serviços'
              : 'Todos os Serviços'}
            <span className="text-sm font-normal text-neutral-500 ml-2">({filteredItems.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-brand-100 text-brand-600' : 'glass-panel text-neutral-500 border border-neutral-200'}`}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-brand-100 text-brand-600' : 'glass-panel text-neutral-500 border border-neutral-200'}`}
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Items Grid/List */}
        {filteredItems.length === 0 ? (
          <div className="glass-panel rounded-xl border border-neutral-200 p-8 text-center animate-fade-in">
            <CogIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Nenhum serviço encontrado</h3>
            <p className="text-neutral-500">Tente ajustar os filtros de busca</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleRequestService(item)}
                className="glass-panel rounded-xl border border-neutral-200 p-4 hover:shadow-lg hover:border-brand-200 transition-all duration-200 cursor-pointer group animate-fade-in"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${item.category_color}15` }}
                  >
                    <CogIcon
                      className="w-5 h-5"
                      style={{ color: item.category_color }}
                    />
                  </div>
                  {item.is_featured && (
                    <StarIconSolid className="w-4 h-4 text-warning-400" />
                  )}
                </div>

                <h3 className="font-semibold text-neutral-900 mb-1 group-hover:text-brand-600 line-clamp-1 transition-colors">
                  {item.name}
                </h3>
                <p className="text-xs text-neutral-500 mb-2">{item.category_name}</p>
                <p className="text-sm text-neutral-600 line-clamp-2 mb-4">
                  {item.short_description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    {item.estimated_fulfillment_time && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatTime(item.estimated_fulfillment_time)}
                      </span>
                    )}
                    {item.requires_approval && (
                      <span className="flex items-center gap-1">
                        <CheckBadgeIcon className="w-3.5 h-3.5" />
                        Aprovação
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-brand-600">
                    {formatCost(item)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-xl border border-neutral-200 overflow-hidden animate-fade-in">
            <div className="divide-y divide-neutral-100">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleRequestService(item)}
                  className="flex items-center gap-4 p-4 hover:bg-neutral-50 cursor-pointer group transition-colors duration-200"
                >
                  <div
                    className="p-2 sm:p-3 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${item.category_color}15` }}
                  >
                    <CogIcon
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      style={{ color: item.category_color }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-neutral-900 group-hover:text-brand-600 truncate transition-colors">
                        {item.name}
                      </h3>
                      {item.is_featured && (
                        <StarIconSolid className="w-4 h-4 text-warning-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 line-clamp-1">{item.short_description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                      <span>{item.category_name}</span>
                      {item.estimated_fulfillment_time && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {formatTime(item.estimated_fulfillment_time)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-brand-600">{formatCost(item)}</p>
                    {item.requires_approval && (
                      <p className="text-xs text-neutral-500 flex items-center gap-1 justify-end mt-1">
                        <CheckBadgeIcon className="w-3.5 h-3.5" />
                        Aprovação
                      </p>
                    )}
                  </div>

                  <ArrowRightIcon className="w-5 h-5 text-neutral-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-lg p-3 sm:hidden safe-bottom backdrop-blur-lg">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/portal')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={() => router.push('/portal/requests')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors"
          >
            <span>Minhas Solicitações</span>
          </button>
        </div>
      </div>
    </div>
  )
}
