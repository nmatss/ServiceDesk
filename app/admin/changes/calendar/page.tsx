'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  PlusIcon
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
      await new Promise(resolve => setTimeout(resolve, 300))

      // Generate sample changes for the current month
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      setChanges([
        {
          id: '456',
          title: 'Otimização de índices do banco ERP',
          category: 'normal',
          status: 'scheduled',
          scheduled_start: new Date(year, month, 15, 22, 0).toISOString(),
          scheduled_end: new Date(year, month, 16, 2, 0).toISOString(),
          assigned_to: 'Pedro Almeida',
          risk_level: 3,
          services: ['ERP Financeiro', 'Relatórios']
        },
        {
          id: '457',
          title: 'Atualização de segurança do firewall',
          category: 'normal',
          status: 'scheduled',
          scheduled_start: new Date(year, month, 18, 23, 0).toISOString(),
          scheduled_end: new Date(year, month, 19, 1, 0).toISOString(),
          assigned_to: 'Ana Costa',
          risk_level: 4,
          services: ['Firewall', 'VPN']
        },
        {
          id: '458',
          title: 'Migração de servidor de arquivos',
          category: 'normal',
          status: 'scheduled',
          scheduled_start: new Date(year, month, 20, 20, 0).toISOString(),
          scheduled_end: new Date(year, month, 21, 6, 0).toISOString(),
          assigned_to: 'Carlos Silva',
          risk_level: 3,
          services: ['File Server', 'Backup']
        },
        {
          id: '459',
          title: 'Deploy de atualização mensal',
          category: 'standard',
          status: 'scheduled',
          scheduled_start: new Date(year, month, 22, 6, 0).toISOString(),
          scheduled_end: new Date(year, month, 22, 7, 0).toISOString(),
          assigned_to: 'DevOps Team',
          risk_level: 2,
          services: ['Portal', 'API']
        },
        {
          id: '455',
          title: 'Atualização do sistema de backup',
          category: 'standard',
          status: 'completed',
          scheduled_start: new Date(year, month, 10, 22, 0).toISOString(),
          scheduled_end: new Date(year, month, 10, 23, 0).toISOString(),
          assigned_to: 'João Oliveira',
          risk_level: 2,
          services: ['Backup System']
        },
        {
          id: '450',
          title: 'Hotfix crítico de segurança',
          category: 'emergency',
          status: 'completed',
          scheduled_start: new Date(year, month, 10, 8, 0).toISOString(),
          scheduled_end: new Date(year, month, 10, 9, 0).toISOString(),
          assigned_to: 'Security Team',
          risk_level: 4,
          services: ['All Systems']
        }
      ])
    } catch (error) {
      console.error('Error fetching changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-green-500'
      case 'normal': return 'bg-blue-500'
      case 'emergency': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getCategoryBgColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-green-100 border-green-300 text-green-800'
      case 'normal': return 'bg-blue-100 border-blue-300 text-blue-800'
      case 'emergency': return 'bg-red-100 border-red-300 text-red-800'
      default: return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <ClockIcon className="w-4 h-4 text-blue-500" />
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
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDaysSolid className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                Calendário de Mudanças
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Visualização de janelas de manutenção e mudanças agendadas
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin/changes')}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Lista de Mudanças
              </button>
              <button
                onClick={() => router.push('/admin/changes/new')}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Nova RFC
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Calendar Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900 capitalize min-w-[200px] text-center">
                {monthName}
              </h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                Hoje
              </button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">Todas categorias</option>
                <option value="standard">Padrão</option>
                <option value="normal">Normal</option>
                <option value="emergency">Emergência</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-sm text-gray-600">Padrão</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-sm text-gray-600">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-sm text-gray-600">Emergência</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Week Days Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {weekDays.map(day => (
                <div key={day} className="p-2 sm:p-3 text-center text-sm font-medium text-gray-700">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells for days before the first of the month */}
              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 bg-gray-50 border-b border-r border-gray-100"></div>
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dayChanges = getChangesForDay(day)
                const dayIsToday = isToday(day)

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-gray-100 ${
                      dayIsToday ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      dayIsToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center' : 'text-gray-700'
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
                        <div className="text-xs text-gray-500 pl-1">
                          +{dayChanges.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming Changes List */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Próximas Mudanças</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {changes
              .filter(c => c.status === 'scheduled')
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .slice(0, 5)
              .map(change => (
                <div
                  key={change.id}
                  onClick={() => router.push(`/admin/changes/${change.id}`)}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className={`w-1 h-12 rounded ${getCategoryColor(change.category)}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">CHG-{change.id}: {change.title}</p>
                    <p className="text-sm text-gray-500">
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
                    <p className="text-sm font-medium text-gray-900">{change.assigned_to}</p>
                    <div className="flex gap-1 justify-end mt-1">
                      {change.services.slice(0, 2).map((service, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
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
                <h3 className="font-semibold text-gray-900">CHG-{selectedChange.id}</h3>
              </div>
              <button
                onClick={() => setSelectedChange(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-700 mb-4">{selectedChange.title}</p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Início</span>
                <span className="font-medium">
                  {new Date(selectedChange.scheduled_start).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fim</span>
                <span className="font-medium">
                  {new Date(selectedChange.scheduled_end).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Responsável</span>
                <span className="font-medium">{selectedChange.assigned_to}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Risco</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      className={`w-4 h-2 rounded ${
                        level <= selectedChange.risk_level
                          ? selectedChange.risk_level <= 2 ? 'bg-green-500' :
                            selectedChange.risk_level <= 3 ? 'bg-yellow-500' :
                            selectedChange.risk_level <= 4 ? 'bg-orange-500' : 'bg-red-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Serviços Afetados</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedChange.services.map((service, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
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
                className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Ver Detalhes
              </button>
              <button
                onClick={() => setSelectedChange(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
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
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Lista
          </button>
          <button
            onClick={() => router.push('/admin/cab')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            CAB
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg"
          >
            Nova RFC
          </button>
        </div>
      </div>
    </div>
  )
}
