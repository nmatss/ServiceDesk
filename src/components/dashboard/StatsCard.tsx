'use client'

import { 
  ChartBarIcon, 
  UserGroupIcon, 
  TicketIcon, 
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
  }
  icon: 'tickets' | 'users' | 'time' | 'resolved' | 'pending' | 'chart'
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'
}

const iconMap = {
  tickets: TicketIcon,
  users: UserGroupIcon,
  time: ClockIcon,
  resolved: CheckCircleIcon,
  pending: ExclamationTriangleIcon,
  chart: ChartBarIcon
}

const colorMap = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    bgLight: 'bg-blue-50'
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    bgLight: 'bg-green-50'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    bgLight: 'bg-yellow-50'
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    bgLight: 'bg-red-50'
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    bgLight: 'bg-purple-50'
  },
  indigo: {
    bg: 'bg-indigo-500',
    text: 'text-indigo-600',
    bgLight: 'bg-indigo-50'
  }
}

export default function StatsCard({ 
  title, 
  value, 
  change, 
  icon, 
  color = 'blue' 
}: StatsCardProps) {
  const IconComponent = iconMap[icon]
  const colors = colorMap[color]

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString()
    }
    return val
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase':
        return 'text-green-600'
      case 'decrease':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return '↗'
      case 'decrease':
        return '↘'
      default:
        return '→'
    }
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${colors.bgLight} p-3 rounded-md`}>
              <IconComponent className={`h-6 w-6 ${colors.text}`} aria-hidden="true" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {formatValue(value)}
                </div>
                {change && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${getChangeColor(change.type)}`}>
                    <span className="mr-1">{getChangeIcon(change.type)}</span>
                    {Math.abs(change.value)}%
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
      {change && (
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className={`font-medium ${getChangeColor(change.type)}`}>
              {change.type === 'increase' ? 'Aumento' : change.type === 'decrease' ? 'Diminuição' : 'Sem mudança'}
            </span>
            <span className="text-gray-500 ml-1">em relação ao período anterior</span>
          </div>
        </div>
      )}
    </div>
  )
}
