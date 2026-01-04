'use client'

import { useEffect, useState } from 'react'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import {
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

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

  return (
    <>
      {/* Screen reader announcement for metric updates */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <StatsGrid cols={4}>
        <StatsCard
          title="Total de Tickets"
          value={data.totalTickets}
          icon="tickets"
          color="brand"
          change={{
            value: 12,
            type: 'increase',
            period: 'vs. mês passado'
          }}
        />

        <StatsCard
          title="Tickets Resolvidos"
          value={data.resolvedTickets}
          icon="resolved"
          color="success"
          change={{
            value: 8,
            type: 'increase',
            period: 'vs. mês passado'
          }}
        />

        <StatsCard
          title="Tickets Abertos"
          value={data.openTickets}
          icon="pending"
          color="warning"
          change={{
            value: 3,
            type: 'decrease',
            period: 'vs. semana passada'
          }}
        />

        <StatsCard
          title="Tickets Atrasados"
          value={data.overdueTickets}
          icon={<ExclamationTriangleIcon />}
          color="error"
          change={{
            value: 2,
            type: 'decrease',
            period: 'vs. semana passada'
          }}
        />

        <StatsCard
          title="Taxa de Resolução"
          value={`${data.resolutionRate}%`}
          icon={<CheckCircleIcon />}
          color="success"
          change={{
            value: 5,
            type: 'increase',
            period: 'vs. mês passado'
          }}
        />

        <StatsCard
          title="Tempo de Primeira Resposta"
          value={`${data.avgFirstResponseTime}h`}
          icon="time"
          color="info"
          change={{
            value: 0.5,
            type: 'decrease',
            period: 'vs. mês passado'
          }}
        />

        <StatsCard
          title="Tempo Médio de Resolução"
          value={`${data.avgResolutionTime}h`}
          icon={<ClockIcon />}
          color="neutral"
          change={{
            value: 1.2,
            type: 'decrease',
            period: 'vs. mês passado'
          }}
        />
      </StatsGrid>
    </>
  )
}