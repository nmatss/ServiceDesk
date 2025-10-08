'use client'

import { useEffect, useState } from 'react'
import {
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline'

interface MetricCard {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period: string
  }
  icon: React.ReactNode
  color: string
}

interface OverviewCardsProps {
  data: {
    totalTickets: number
    resolvedTickets: number
    openTickets: number
    overdueTickets: number
    resolutionRate: number
    avgFirstResponseTime: number
    avgResolutionTime: number
  }
}

export default function OverviewCards({ data }: OverviewCardsProps) {
  const [announcement, setAnnouncement] = useState('')

  // Announce significant changes to screen readers
  useEffect(() => {
    if (data.totalTickets > 0) {
      setAnnouncement(`Métricas atualizadas: ${data.totalTickets} tickets totais, ${data.openTickets} em aberto, ${data.resolvedTickets} resolvidos`)
    }
  }, [data])

  const cards: MetricCard[] = [
    {
      title: 'Total de Tickets',
      value: data.totalTickets,
      icon: <TicketIcon className="w-6 h-6" />,
      color: 'blue',
      change: {
        value: 12,
        type: 'increase',
        period: 'vs. mês passado'
      }
    },
    {
      title: 'Tickets Resolvidos',
      value: data.resolvedTickets,
      icon: <CheckCircleIcon className="w-6 h-6" />,
      color: 'green',
      change: {
        value: 8,
        type: 'increase',
        period: 'vs. mês passado'
      }
    },
    {
      title: 'Tickets Abertos',
      value: data.openTickets,
      icon: <ClockIcon className="w-6 h-6" />,
      color: 'yellow',
      change: {
        value: 3,
        type: 'decrease',
        period: 'vs. semana passada'
      }
    },
    {
      title: 'Tickets Atrasados',
      value: data.overdueTickets,
      icon: <ExclamationTriangleIcon className="w-6 h-6" />,
      color: 'red',
      change: {
        value: 2,
        type: 'decrease',
        period: 'vs. semana passada'
      }
    },
    {
      title: 'Taxa de Resolução',
      value: `${data.resolutionRate}%`,
      icon: <CheckCircleIcon className="w-6 h-6" />,
      color: 'emerald',
      change: {
        value: 5,
        type: 'increase',
        period: 'vs. mês passado'
      }
    },
    {
      title: 'Tempo de Primeira Resposta',
      value: `${data.avgFirstResponseTime}h`,
      icon: <ClockIcon className="w-6 h-6" />,
      color: 'indigo',
      change: {
        value: 0.5,
        type: 'decrease',
        period: 'vs. mês passado'
      }
    },
    {
      title: 'Tempo Médio de Resolução',
      value: `${data.avgResolutionTime}h`,
      icon: <ClockIcon className="w-6 h-6" />,
      color: 'purple',
      change: {
        value: 1.2,
        type: 'decrease',
        period: 'vs. mês passado'
      }
    }
  ]

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      red: 'bg-red-50 text-red-600 border-red-200',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200'
    }
    return colorMap[color as keyof typeof colorMap] || colorMap.blue
  }

  const getChangeIcon = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return <ArrowUpIcon className="w-4 h-4 text-green-500" />
      case 'decrease':
        return <ArrowDownIcon className="w-4 h-4 text-red-500" />
      default:
        return <MinusIcon className="w-4 h-4 text-gray-500" />
    }
  }

  const getChangeTextColor = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return 'text-green-600'
      case 'decrease':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <>
      {/* Screen reader announcement for metric updates */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8"
        role="region"
        aria-label="Visão geral de métricas"
      >
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          role="article"
          aria-label={`${card.title}: ${typeof card.value === 'number' ? card.value.toLocaleString() : card.value}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className={`p-3 rounded-lg border ${getColorClasses(card.color)}`}
              aria-hidden="true"
            >
              {card.icon}
            </div>
            {card.change && (
              <div
                className={`flex items-center space-x-1 ${getChangeTextColor(card.change.type)}`}
                aria-label={`Mudança: ${card.change.type === 'increase' ? 'aumento' : card.change.type === 'decrease' ? 'diminuição' : 'sem mudança'} de ${card.change.value}%`}
              >
                {getChangeIcon(card.change.type)}
                <span className="text-sm font-medium" aria-hidden="true">
                  {card.change.value}%
                </span>
              </div>
            )}
          </div>

          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-600 mb-1" id={`metric-title-${index}`}>
              {card.title}
            </h3>
            <p
              className="text-2xl font-bold text-gray-900"
              aria-labelledby={`metric-title-${index}`}
              aria-live="polite"
            >
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
          </div>

          {card.change && (
            <p className="text-xs text-gray-500" aria-label={`Comparação: ${card.change.period}`}>
              {card.change.period}
            </p>
          )}
        </div>
      ))}
      </div>
    </>
  )
}