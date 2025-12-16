'use client'

import { useState, useEffect, useCallback } from 'react'
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
  CurrencyDollarIcon,
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

export default function ServiceCatalogPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [showFeatured, setShowFeatured] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedCategory) params.append('category_id', selectedCategory.toString())
      if (showFeatured) params.append('is_featured', 'true')

      const response = await fetch(`/api/catalog?${params}`)
      const data = await response.json()

      if (data.success) {
        setItems(data.catalog_items || [])
        setCategories(data.categories || [])
      }
    } catch {
      console.error('Error fetching catalog')
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, showFeatured])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

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

  // Featured items
  const featuredItems = items.filter(item => item.is_featured)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                Catálogo de Serviços
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Encontre e solicite os serviços que você precisa
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/portal/requests')}
                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
              >
                Minhas Solicitações
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviços..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Category Filter */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-2">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const IconComponent = getCategoryIcon(cat.icon)
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                    showFeatured
                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  <StarIconSolid className={`w-4 h-4 ${showFeatured ? 'text-yellow-500' : 'text-gray-400'}`} />
                  <span>Destaques</span>
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Categories Quick Access - Mobile */}
        <div className="mb-6 -mx-3 px-3 overflow-x-auto sm:mx-0 sm:px-0 sm:overflow-visible">
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 min-w-max sm:min-w-0">
            {categories.slice(0, 6).map((cat) => {
              const IconComponent = getCategoryIcon(cat.icon)
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`flex flex-col items-center p-3 sm:p-4 rounded-xl border transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                  }`}
                  style={{ minWidth: '100px' }}
                >
                  <div
                    className="p-2 sm:p-3 rounded-xl mb-2"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <IconComponent
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      style={{ color: cat.color }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 text-center line-clamp-1">{cat.name}</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">{cat.item_count || 0} serviços</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Featured Services */}
        {!selectedCategory && !search && featuredItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <StarIconSolid className="w-5 h-5 text-yellow-500" />
              Serviços em Destaque
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleRequestService(item)}
                  className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 sm:p-6 text-white cursor-pointer hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <CogIcon className="w-6 h-6" />
                    </div>
                    <StarIconSolid className="w-5 h-5 text-yellow-300" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                  <p className="text-sm text-white/80 line-clamp-2 mb-4">{item.short_description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">{formatCost(item)}</span>
                    <div className="flex items-center gap-1 text-sm group-hover:gap-2 transition-all">
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
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name || 'Serviços'
              : 'Todos os Serviços'}
            <span className="text-sm font-normal text-gray-500 ml-2">({items.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CogIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum serviço encontrado</h3>
            <p className="text-gray-500">Tente ajustar os filtros de busca</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleRequestService(item)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
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
                    <StarIconSolid className="w-4 h-4 text-yellow-400" />
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 line-clamp-1">
                  {item.name}
                </h3>
                <p className="text-xs text-gray-500 mb-2">{item.category_name}</p>
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                  {item.short_description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
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
                  <span className="text-sm font-medium text-blue-600">
                    {formatCost(item)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleRequestService(item)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer group"
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
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                        {item.name}
                      </h3>
                      {item.is_featured && (
                        <StarIconSolid className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{item.short_description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
                    <p className="text-sm font-semibold text-blue-600">{formatCost(item)}</p>
                    {item.requires_approval && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-1">
                        <CheckBadgeIcon className="w-3.5 h-3.5" />
                        Aprovação
                      </p>
                    )}
                  </div>

                  <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
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
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg flex items-center justify-center gap-2"
          >
            <span>Minhas Solicitações</span>
          </button>
        </div>
      </div>
    </div>
  )
}
