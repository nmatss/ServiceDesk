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
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {item.name}: {item.value}
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
      className="bg-white rounded-lg border border-gray-200 p-6"
      role="region"
      aria-labelledby="trend-chart-title"
    >
      <div className="mb-6">
        <h3 id="trend-chart-title" className="text-lg font-semibold text-gray-900 mb-2">
          Tendência de Tickets
        </h3>
        <p className="text-sm text-gray-600">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6, fill: '#3b82f6' }}
              name="Criados"
            />
            <Line
              type="monotone"
              dataKey="resolved"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 6, fill: '#10b981' }}
              name="Resolvidos"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200"
        role="region"
        aria-label="Resumo de estatísticas de tickets"
        aria-live="polite"
      >
        <div className="text-center" role="article" aria-label={`Total de tickets criados: ${totalCreated}`}>
          <p className="text-sm text-gray-600" id="stat-created">Total Criados</p>
          <p className="text-lg font-semibold text-blue-600" aria-labelledby="stat-created">
            {totalCreated}
          </p>
        </div>
        <div className="text-center" role="article" aria-label={`Total de tickets resolvidos: ${totalResolved}`}>
          <p className="text-sm text-gray-600" id="stat-resolved">Total Resolvidos</p>
          <p className="text-lg font-semibold text-green-600" aria-labelledby="stat-resolved">
            {totalResolved}
          </p>
        </div>
        <div className="text-center" role="article" aria-label={`Diferença de tickets: ${difference}`}>
          <p className="text-sm text-gray-600" id="stat-difference">Diferença</p>
          <p
            className={`text-lg font-semibold ${difference > 0 ? 'text-red-600' : 'text-green-600'}`}
            aria-labelledby="stat-difference"
          >
            {difference}
          </p>
        </div>
      </div>
    </div>
  )
}