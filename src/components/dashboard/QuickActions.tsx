'use client'

import Link from 'next/link'
import { 
  PlusIcon, 
  DocumentTextIcon, 
  UserGroupIcon, 
  ChartBarIcon,
  CogIcon,
  BellIcon
} from '@heroicons/react/24/outline'

interface QuickAction {
  name: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'
}

interface QuickActionsProps {
  userRole: 'admin' | 'agent' | 'user'
}

export default function QuickActions({ userRole }: QuickActionsProps) {
  const getActions = (): QuickAction[] => {
    const baseActions: QuickAction[] = [
      {
        name: 'Novo Ticket',
        description: 'Criar um novo ticket de suporte',
        href: '/tickets/new',
        icon: PlusIcon,
        color: 'blue'
      }
    ]

    if (userRole === 'admin') {
      return [
        ...baseActions,
        {
          name: 'Gerenciar Usuários',
          description: 'Adicionar e editar usuários',
          href: '/admin/users',
          icon: UserGroupIcon,
          color: 'green'
        },
        {
          name: 'Relatórios',
          description: 'Visualizar métricas e relatórios',
          href: '/admin/reports',
          icon: ChartBarIcon,
          color: 'purple'
        },
        {
          name: 'Configurações',
          description: 'Configurar o sistema',
          href: '/admin/settings',
          icon: CogIcon,
          color: 'indigo'
        }
      ]
    }

    if (userRole === 'agent') {
      return [
        ...baseActions,
        {
          name: 'Tickets Atribuídos',
          description: 'Ver tickets atribuídos a você',
          href: '/admin/tickets',
          icon: DocumentTextIcon,
          color: 'green'
        },
        {
          name: 'Relatórios',
          description: 'Visualizar métricas',
          href: '/admin/reports',
          icon: ChartBarIcon,
          color: 'purple'
        }
      ]
    }

    return baseActions
  }

  const actions = getActions()

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 text-blue-600 hover:bg-blue-100'
      case 'green':
        return 'bg-green-50 text-green-600 hover:bg-green-100'
      case 'yellow':
        return 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
      case 'red':
        return 'bg-red-50 text-red-600 hover:bg-red-100'
      case 'purple':
        return 'bg-purple-50 text-purple-600 hover:bg-purple-100'
      case 'indigo':
        return 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      default:
        return 'bg-gray-50 text-gray-600 hover:bg-gray-100'
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Ações Rápidas</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {actions.map((action) => {
          const IconComponent = action.icon
          return (
            <Link
              key={action.name}
              href={action.href}
              className={`relative rounded-lg border border-gray-300 ${getColorClasses(action.color)} p-4 hover:shadow-md transition-all duration-200`}
            >
              <div>
                <span className="rounded-lg inline-flex p-3 ring-4 ring-white">
                  <IconComponent className="h-6 w-6" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">{action.name}</h3>
                <p className="mt-2 text-sm opacity-75">{action.description}</p>
              </div>
              <span
                className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                aria-hidden="true"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                </svg>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
