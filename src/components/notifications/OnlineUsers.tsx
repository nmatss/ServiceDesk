'use client'

import { useState } from 'react'
import {
  UsersIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import { useSocket } from '@/src/hooks/useSocket'

interface OnlineUser {
  id: number
  name: string
  role: string
  last_activity: string
}

interface OnlineUsersProps {
  showCompact?: boolean
}

export default function OnlineUsers({ showCompact = false }: OnlineUsersProps) {
  const { onlineUsers, isConnected } = useSocket()
  const [isExpanded, setIsExpanded] = useState(false)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'agent':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'user':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'agent':
        return 'Agente'
      case 'user':
        return 'Usuário'
      default:
        return role
    }
  }

  const formatLastActivity = (lastActivity: string) => {
    const date = new Date(lastActivity)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}m atrás`
    return 'Há mais tempo'
  }

  if (showCompact) {
    return (
      <div className=\"flex items-center space-x-2 text-sm text-gray-600\">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
        <UsersIcon className=\"w-4 h-4\" />
        <span>{onlineUsers.length} online</span>
      </div>
    )
  }

  return (
    <div className=\"bg-white rounded-lg border border-gray-200 shadow-sm\">
      {/* Header */}
      <div
        className=\"flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors\"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className=\"flex items-center space-x-3\">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <div className=\"flex items-center space-x-2\">
            <UsersIcon className=\"w-5 h-5 text-gray-600\" />
            <h3 className=\"text-sm font-medium text-gray-900\">
              Usuários Online ({onlineUsers.length})
            </h3>
          </div>
        </div>

        {isExpanded ? (
          <ChevronUpIcon className=\"w-4 h-4 text-gray-400\" />
        ) : (
          <ChevronDownIcon className=\"w-4 h-4 text-gray-400\" />
        )}
      </div>

      {/* Lista de usuários */}
      {isExpanded && (
        <div className=\"border-t border-gray-200\">
          {!isConnected ? (
            <div className=\"p-4 text-center text-sm text-gray-500\">
              Desconectado - Não é possível mostrar usuários online
            </div>
          ) : onlineUsers.length === 0 ? (
            <div className=\"p-4 text-center text-sm text-gray-500\">
              Nenhum usuário online no momento
            </div>
          ) : (
            <div className=\"max-h-64 overflow-y-auto\">
              {/* Agrupar por role */}
              {['admin', 'agent', 'user'].map((role) => {
                const usersInRole = onlineUsers.filter(user => user.role === role)

                if (usersInRole.length === 0) return null

                return (
                  <div key={role} className=\"border-b border-gray-100 last:border-b-0\">
                    <div className=\"px-4 py-2 bg-gray-50\">
                      <h4 className=\"text-xs font-medium text-gray-700 uppercase tracking-wider\">
                        {getRoleLabel(role)}s ({usersInRole.length})
                      </h4>
                    </div>

                    <div className=\"divide-y divide-gray-100\">
                      {usersInRole.map((user) => (
                        <div key={user.id} className=\"p-3 hover:bg-gray-50 transition-colors\">
                          <div className=\"flex items-center space-x-3\">
                            <div className=\"flex-shrink-0\">
                              <div className=\"w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center\">
                                <UserIcon className=\"w-4 h-4 text-blue-600\" />
                              </div>
                            </div>

                            <div className=\"flex-1 min-w-0\">
                              <div className=\"flex items-center justify-between\">
                                <p className=\"text-sm font-medium text-gray-900 truncate\">
                                  {user.name}
                                </p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                                  {getRoleLabel(user.role)}
                                </span>
                              </div>

                              <div className=\"flex items-center mt-1\">
                                <div className=\"w-2 h-2 bg-green-500 rounded-full mr-2\" />
                                <p className=\"text-xs text-gray-500\">
                                  {formatLastActivity(user.last_activity)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Status de conexão */}
      <div className={`px-4 py-2 text-xs border-t border-gray-200 ${
        isConnected
          ? 'text-green-700 bg-green-50'
          : 'text-red-700 bg-red-50'
      }`}>
        {isConnected ? '🟢 Conectado em tempo real' : '🔴 Desconectado - Tentando reconectar...'}
      </div>
    </div>
  )
}