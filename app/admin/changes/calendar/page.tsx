'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  PlusIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { CalendarDaysIcon as CalendarDaysSolid } from '@heroicons/react/24/solid'

interface ScheduledChange {
  id: string
  title: string
  category: 'standard' | 'normal' | 'emergency'
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed'
  scheduled_start: string
  scheduled_end: string
  assigned_to: string
  risk_level: number
  services: string[]
}

export default function ChangeCalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [changes, setChanges] = useState<ScheduledChange[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedChange, setSelectedChange] = useState<ScheduledChange | null>(null)

  useEffect(() => {
    fetchChanges()
  }, [currentDate])

  const fetchChanges = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/changes?page=1&limit=100')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar mudanças')
      }

      if (data.success && data.change_requests) {
        // Map API data to calendar format
        const mappedChanges: ScheduledChange[] = data.change_requests
          .filter((cr: Record<string, unknown>) => cr.scheduled_start_date)
          .map((cr: Record<string, unknown>) => {
            // Map risk_level to numeric 1-5 scale
            const riskLevelMap: Record<string, number> = {
              'very_low': 1,
              'low': 2,
              'medium': 3,
              'high': 4,
              'very_high': 5
            }

            // Parse affected_services
            const services = cr.affected_services
              ? (typeof cr.affected_services === 'string' ? cr.affected_services.split(',').map(s => s.trim()) : [])
              : []

            return {
              id: String(cr.id),
              title: cr.title as string || 'Sem título',
              category: (cr.category as 'standard' | 'normal' | 'emergency') || 'normal',
              status: (cr.status as 'scheduled' | 'in_progress' | 'completed' | 'failed') || 'scheduled',
              scheduled_start: cr.scheduled_start_date as string,
              scheduled_end: cr.scheduled_end_date as string || cr.scheduled_start_date as string,
              assigned_to: cr.assignee_name as string || 'Não atribuído',
              risk_level: riskLevelMap[cr.risk_level as string] || 3,
              services: services.length > 0 ? services : ['N/A']
            }
          })

        setChanges(mappedChanges)
      }
    } catch (error) {
      console.error('Error fetching changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-green-500'
      case 'normal': return 'bg-brand-500'
      case 'emergency': return 'bg-red-500'
      default: return 'bg-neutral-500'
    }
  }

  const getCategoryBgColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-green-100 border-green-300 text-green-800'
      case 'normal': return 'bg-brand-100 border-brand-300 text-brand-800'
      case 'emergency': return 'bg-red-100 border-red-300 text-red-800'
      default: return 'bg-neutral-100 border-neutral-300 text-neutral-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <ClockIcon className="w-4 h-4 text-brand-500" />
      case 'in_progress': return <ArrowPathIcon className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'completed': return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircleIcon className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getChangesForDay = (day: number) => {
    return changes.filter(change => {
      const changeDate = new Date(change.scheduled_start)
      return changeDate.getDate() === day &&
        changeDate.getMonth() === currentDate.getMonth() &&
        changeDate.getFullYear() === currentDate.getFullYear() &&
        (categoryFilter === 'all' || change.category === categoryFilter)
    })
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = getFirstDayOfMonth(currentDate)
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const today = new Date()
  const isToday = (day: number) => {
    return day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-purple-50/20 pb-6">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-neutral-200/50 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <PageHeader
            title="Calendário de Mudanças"
            description="Visualização de janelas de manutenção e mudanças agendadas"
            icon={CalendarDaysSolid}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Mudanças', href: '/admin/changes' },
              { label: 'Calendário' }
            ]}
            actions={[
              {
                label: 'Voltar',
                onClick: () => router.push('/admin/changes'),
                icon: ArrowLeftIcon,
                variant: 'ghost'
              },
              {
                label: 'Nova RFC',
                href: '/admin/changes/new',
                icon: PlusIcon,
                variant: 'primary'
              }
            ]}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Modern Calendar Controls */}
        <div className="glass-panel mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-brand-50 rounded-lg transition-colors group"
                title="Mês anterior"
              >
                <ChevronLeftIcon className="w-5 h-5 text-neutral-600 group-hover:text-brand-600 transition-colors" />
              </button>
              <h2 className="text-lg font-bold text-neutral-900 capitalize min-w-[200px] text-center">
                {monthName}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-brand-50 rounded-lg transition-colors group"
                title="Próximo mês"
              >
                <ChevronRightIcon className="w-5 h-5 text-neutral-600 group-hover:text-brand-600 transition-colors" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-1.5 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
              >
                Hoje
              </button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              >
                <option value="all">Todas categorias</option>
                <option value="standard">Padrão</option>
                <option value="normal">Normal</option>
                <option value="emergency">Emergência</option>
              </select>
            </div>
          </div>

          {/* Modern Legend */}
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-neutral-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 shadow-md"></div>
              <span className="text-sm font-medium text-neutral-700">Padrão</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-brand-500 shadow-md"></div>
              <span className="text-sm font-medium text-neutral-700">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-md animate-pulse"></div>
              <span className="text-sm font-medium text-neutral-700">Emergência</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden">
            {/* Scrollable wrapper for mobile */}
            <div className="overflow-x-auto scrollbar-thin">
              <div className="min-w-[640px]">
                {/* Week Days Header */}
                <div className="grid grid-cols-7 border-b border-neutral-200 bg-gradient-to-r from-brand-50 to-brand-50">
                  {weekDays.map(day => (
                    <div key={day} className="p-2 sm:p-3 text-center text-sm font-semibold text-neutral-700">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7">
              {/* Empty cells for days before the first of the month */}
              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 bg-neutral-50 border-b border-r border-neutral-100"></div>
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dayChanges = getChangesForDay(day)
                const dayIsToday = isToday(day)

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-neutral-100 ${
                      dayIsToday ? 'bg-brand-50' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      dayIsToday ? 'w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center' : 'text-neutral-700'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayChanges.slice(0, 3).map(change => (
                        <div
                          key={change.id}
                          onClick={() => setSelectedChange(change)}
                          className={`text-xs p-1 rounded border cursor-pointer truncate ${getCategoryBgColor(change.category)}`}
                        >
                          <span className="hidden sm:inline">{formatTime(change.scheduled_start)} - </span>
                          CHG-{change.id}
                        </div>
                      ))}
                      {dayChanges.length > 3 && (
                        <div className="text-xs text-neutral-500 pl-1">
                          +{dayChanges.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Changes List */}
        <div className="mt-6 glass-panel">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-brand-500" />
              Próximas Mudanças
            </h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {changes
              .filter(c => c.status === 'scheduled')
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .slice(0, 5)
              .map(change => (
                <div
                  key={change.id}
                  onClick={() => router.push(`/admin/changes/${change.id}`)}
                  className="p-4 flex items-center gap-4 hover:bg-neutral-50 cursor-pointer"
                >
                  <div className={`w-1 h-12 rounded ${getCategoryColor(change.category)}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">CHG-{change.id}: {change.title}</p>
                    <p className="text-sm text-neutral-500">
                      {new Date(change.scheduled_start).toLocaleDateString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {' → '}
                      {formatTime(change.scheduled_end)}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-neutral-900">{change.assigned_to}</p>
                    <div className="flex gap-1 justify-end mt-1">
                      {change.services.slice(0, 2).map((service, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-neutral-400" />
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Change Detail Modal */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs rounded ${getCategoryBgColor(selectedChange.category)}`}>
                    {selectedChange.category}
                  </span>
                  {getStatusIcon(selectedChange.status)}
                </div>
                <h3 className="font-semibold text-neutral-900">CHG-{selectedChange.id}</h3>
              </div>
              <button
                onClick={() => setSelectedChange(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <p className="text-neutral-700 mb-4">{selectedChange.title}</p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Início</span>
                <span className="font-medium">
                  {new Date(selectedChange.scheduled_start).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Fim</span>
                <span className="font-medium">
                  {new Date(selectedChange.scheduled_end).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Responsável</span>
                <span className="font-medium">{selectedChange.assigned_to}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Risco</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      className={`w-4 h-2 rounded ${
                        level <= selectedChange.risk_level
                          ? selectedChange.risk_level <= 2 ? 'bg-green-500' :
                            selectedChange.risk_level <= 3 ? 'bg-yellow-500' :
                            selectedChange.risk_level <= 4 ? 'bg-orange-500' : 'bg-red-500'
                          : 'bg-neutral-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className="text-neutral-500">Serviços Afetados</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedChange.services.map((service, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setSelectedChange(null)
                  router.push(`/admin/changes/${selectedChange.id}`)
                }}
                className="flex-1 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
              >
                Ver Detalhes
              </button>
              <button
                onClick={() => setSelectedChange(null)}
                className="flex-1 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg"
          >
            Lista
          </button>
          <button
            onClick={() => router.push('/admin/cab')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg"
          >
            CAB
          </button>
          <button
            onClick={() => router.push('/admin/changes/new')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg"
          >
            Nova RFC
          </button>
        </div>
      </div>
    </div>
  )
}
