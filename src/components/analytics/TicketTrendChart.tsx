'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface TicketTrendData {
  date: string
  created: number
  resolved: number
}

interface TicketTrendChartProps {
  data: TicketTrendData[]
}

export default function TicketTrendChart({ data }: TicketTrendChartProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formattedData = data.map(item => ({
    ...item,
    date: formatDate(item.date)
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 shadow-xl">
          <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: item.color }}>
              {item.name}: <span className="font-bold">{item.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const totalCreated = data.reduce((sum, item) => sum + item.created, 0)
  const totalResolved = data.reduce((sum, item) => sum + item.resolved, 0)
  const difference = totalCreated - totalResolved

  return (
    <div
      className="glass-panel p-6"
      role="region"
      aria-labelledby="trend-chart-title"
    >
      <div className="mb-6">
        <h3 id="trend-chart-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Tendência de Tickets
        </h3>
        <p className="text-sm text-description">
          Comparação entre tickets criados e resolvidos nos últimos 14 dias
        </p>
      </div>

      <div
        className="h-80"
        role="img"
        aria-label={`Gráfico de linhas mostrando tendência de tickets. Total criados: ${totalCreated}, Total resolvidos: ${totalResolved}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-neutral-700" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '14px'
              }}
            />
            <Line
              type="monotone"
              dataKey="created"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              name="Criados"
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
              name="Resolvidos"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-neutral-200 dark:border-neutral-700"
        role="region"
        aria-label="Resumo de estatísticas de tickets"
        aria-live="polite"
      >
        <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg" role="article" aria-label={`Total de tickets criados: ${totalCreated}`}>
          <p className="text-xs text-description mb-1" id="stat-created">Total Criados</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400" aria-labelledby="stat-created">
            {totalCreated}
          </p>
        </div>
        <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg" role="article" aria-label={`Total de tickets resolvidos: ${totalResolved}`}>
          <p className="text-xs text-description mb-1" id="stat-resolved">Total Resolvidos</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400" aria-labelledby="stat-resolved">
            {totalResolved}
          </p>
        </div>
        <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg" role="article" aria-label={`Diferença de tickets: ${difference}`}>
          <p className="text-xs text-description mb-1" id="stat-difference">Diferença</p>
          <p
            className={`text-2xl font-bold ${difference > 0 ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'}`}
            aria-labelledby="stat-difference"
          >
            {difference > 0 ? '+' : ''}{difference}
          </p>
        </div>
      </div>
    </div>
  )
}