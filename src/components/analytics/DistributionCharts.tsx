'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'

interface DistributionItem {
  name?: string
  status?: string
  category?: string
  priority?: string
  count: number
  color: string
  level?: number
}

interface DistributionChartsProps {
  statusData: DistributionItem[]
  categoryData: DistributionItem[]
  priorityData: DistributionItem[]
}

export default function DistributionCharts({
  statusData,
  categoryData,
  priorityData
}: DistributionChartsProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">
            {data.status || data.category || data.priority || data.name}
          </p>
          <p className="text-sm text-gray-600">
            {payload[0].value} ticket(s)
          </p>
        </div>
      )
    }
    return null
  }

  const formatStatusData = statusData.map(item => ({
    name: item.status || item.name,
    value: item.count,
    color: item.color
  }))

  const formatCategoryData = categoryData.map(item => ({
    name: item.category || item.name,
    value: item.count,
    fill: item.color
  }))

  const formatPriorityData = priorityData
    .sort((a, b) => (b.level || 0) - (a.level || 0))
    .map(item => ({
      name: item.priority || item.name,
      value: item.count,
      fill: item.color
    }))

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      role="region"
      aria-label="Gráficos de distribuição de tickets"
    >
      {/* Status Distribution */}
      <div
        className="bg-white rounded-lg border border-gray-200 p-6"
        role="region"
        aria-labelledby="status-chart-title"
      >
        <h3 id="status-chart-title" className="text-lg font-semibold text-gray-900 mb-4">
          Distribuição por Status
        </h3>
        <div
          className="h-64"
          role="img"
          aria-label={`Gráfico de pizza mostrando distribuição de tickets por status: ${formatStatusData.map(item => `${item.name}: ${item.value}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formatStatusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {formatStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2" role="list" aria-label="Legenda do gráfico de status">
          {formatStatusData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm" role="listitem">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="text-gray-700">{item.name}</span>
              </div>
              <span className="font-medium text-gray-900" aria-label={`${item.value} tickets`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Distribution */}
      <div
        className="bg-white rounded-lg border border-gray-200 p-6"
        role="region"
        aria-labelledby="category-chart-title"
      >
        <h3 id="category-chart-title" className="text-lg font-semibold text-gray-900 mb-4">
          Tickets por Categoria
        </h3>
        <div
          className="h-64"
          role="img"
          aria-label={`Gráfico de barras mostrando tickets por categoria: ${formatCategoryData.map(item => `${item.name}: ${item.value}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formatCategoryData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority Distribution */}
      <div
        className="bg-white rounded-lg border border-gray-200 p-6"
        role="region"
        aria-labelledby="priority-chart-title"
      >
        <h3 id="priority-chart-title" className="text-lg font-semibold text-gray-900 mb-4">
          Tickets por Prioridade
        </h3>
        <div
          className="h-64"
          role="img"
          aria-label={`Gráfico de barras horizontais mostrando tickets por prioridade: ${formatPriorityData.map(item => `${item.name}: ${item.value}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formatPriorityData}
              layout="horizontal"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}