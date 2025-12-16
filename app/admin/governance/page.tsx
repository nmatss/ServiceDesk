'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheckIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  LockClosedIcon,
  KeyIcon,
  FingerPrintIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellAlertIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  ServerIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { ShieldCheckIcon as ShieldCheckIconSolid } from '@heroicons/react/24/solid'

interface AuditLog {
  id: string
  timestamp: string
  user_id: string
  user_name: string
  user_email: string
  action: string
  resource_type: string
  resource_id: string
  resource_name: string
  ip_address: string
  user_agent: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  status: 'success' | 'failure' | 'warning'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

interface ComplianceControl {
  id: string
  framework: 'COBIT' | 'LGPD' | 'ISO27001' | 'ITIL'
  control_id: string
  name: string
  description: string
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable'
  last_assessment: string
  owner: string
  evidence_count: number
}

interface AccessPolicy {
  id: string
  name: string
  description: string
  type: 'role' | 'permission' | 'data'
  scope: string
  users_affected: number
  last_modified: string
  status: 'active' | 'draft' | 'deprecated'
}

interface SecurityAlert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
  acknowledged: boolean
}

export default function GovernancePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'compliance' | 'access' | 'data'>('overview')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [controls, setControls] = useState<ComplianceControl[]>([])
  const [policies, setPolicies] = useState<AccessPolicy[]>([])
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState('7d')
  const [actionFilter, setActionFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')

  useEffect(() => {
    fetchGovernanceData()
  }, [])

  const fetchGovernanceData = async () => {
    setLoading(true)
    try {
      // Simulated data - would be API calls in production
      await new Promise(resolve => setTimeout(resolve, 500))

      setAuditLogs([
        {
          id: '1',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          user_id: '1',
          user_name: 'Admin Sistema',
          user_email: 'admin@empresa.com',
          action: 'UPDATE',
          resource_type: 'ticket',
          resource_id: '1234',
          resource_name: 'Ticket #1234',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 Chrome/120',
          old_values: { status: 'open' },
          new_values: { status: 'in_progress' },
          status: 'success',
          risk_level: 'low'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          user_id: '2',
          user_name: 'Maria Santos',
          user_email: 'maria@empresa.com',
          action: 'LOGIN',
          resource_type: 'session',
          resource_id: 'sess_abc123',
          resource_name: 'User Session',
          ip_address: '10.0.0.50',
          user_agent: 'Mozilla/5.0 Firefox/121',
          status: 'success',
          risk_level: 'low'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          user_id: '3',
          user_name: 'João Silva',
          user_email: 'joao@empresa.com',
          action: 'DELETE',
          resource_type: 'attachment',
          resource_id: 'att_456',
          resource_name: 'documento_confidencial.pdf',
          ip_address: '192.168.1.105',
          user_agent: 'Mozilla/5.0 Chrome/120',
          status: 'success',
          risk_level: 'medium'
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
          user_id: '4',
          user_name: 'Unknown',
          user_email: 'unknown@external.com',
          action: 'LOGIN_FAILED',
          resource_type: 'auth',
          resource_id: 'auth_789',
          resource_name: 'Authentication Attempt',
          ip_address: '203.0.113.50',
          user_agent: 'curl/7.88.1',
          status: 'failure',
          risk_level: 'high'
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
          user_id: '1',
          user_name: 'Admin Sistema',
          user_email: 'admin@empresa.com',
          action: 'PERMISSION_CHANGE',
          resource_type: 'user',
          resource_id: 'user_5',
          resource_name: 'Carlos Oliveira',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 Chrome/120',
          old_values: { role: 'user' },
          new_values: { role: 'agent' },
          status: 'success',
          risk_level: 'high'
        }
      ])

      setControls([
        {
          id: '1',
          framework: 'COBIT',
          control_id: 'DSS02',
          name: 'Gerenciar Requisições de Serviço e Incidentes',
          description: 'Fornecer resposta oportuna e eficaz às solicitações dos usuários',
          status: 'compliant',
          last_assessment: '2024-12-01',
          owner: 'Gerente de Service Desk',
          evidence_count: 12
        },
        {
          id: '2',
          framework: 'COBIT',
          control_id: 'DSS03',
          name: 'Gerenciar Problemas',
          description: 'Identificar e classificar problemas e suas causas raiz',
          status: 'partial',
          last_assessment: '2024-12-01',
          owner: 'Gerente de Problemas',
          evidence_count: 8
        },
        {
          id: '3',
          framework: 'COBIT',
          control_id: 'BAI06',
          name: 'Gerenciar Mudanças',
          description: 'Gerenciar todas as mudanças de forma controlada',
          status: 'compliant',
          last_assessment: '2024-11-15',
          owner: 'Gerente de Mudanças',
          evidence_count: 15
        },
        {
          id: '4',
          framework: 'LGPD',
          control_id: 'ART-7',
          name: 'Base Legal para Tratamento',
          description: 'Garantir base legal para todas as operações de tratamento de dados',
          status: 'compliant',
          last_assessment: '2024-12-10',
          owner: 'DPO',
          evidence_count: 20
        },
        {
          id: '5',
          framework: 'LGPD',
          control_id: 'ART-18',
          name: 'Direitos do Titular',
          description: 'Garantir o exercício dos direitos dos titulares',
          status: 'compliant',
          last_assessment: '2024-12-10',
          owner: 'DPO',
          evidence_count: 10
        },
        {
          id: '6',
          framework: 'LGPD',
          control_id: 'ART-46',
          name: 'Medidas de Segurança',
          description: 'Implementar medidas técnicas e administrativas de proteção',
          status: 'partial',
          last_assessment: '2024-12-05',
          owner: 'CISO',
          evidence_count: 18
        },
        {
          id: '7',
          framework: 'ISO27001',
          control_id: 'A.9.2',
          name: 'Gestão de Acesso do Usuário',
          description: 'Assegurar acesso autorizado e prevenir acesso não autorizado',
          status: 'compliant',
          last_assessment: '2024-11-20',
          owner: 'Gerente de Segurança',
          evidence_count: 25
        },
        {
          id: '8',
          framework: 'ITIL',
          control_id: 'CSI',
          name: 'Melhoria Contínua de Serviço',
          description: 'Identificar e implementar melhorias nos serviços',
          status: 'partial',
          last_assessment: '2024-12-01',
          owner: 'Gerente de Qualidade',
          evidence_count: 6
        }
      ])

      setPolicies([
        {
          id: '1',
          name: 'Administradores do Sistema',
          description: 'Acesso total a todas as funcionalidades',
          type: 'role',
          scope: 'Global',
          users_affected: 3,
          last_modified: '2024-12-01',
          status: 'active'
        },
        {
          id: '2',
          name: 'Agentes de Suporte',
          description: 'Gerenciamento de tickets e atendimento',
          type: 'role',
          scope: 'Service Desk',
          users_affected: 15,
          last_modified: '2024-11-28',
          status: 'active'
        },
        {
          id: '3',
          name: 'Gestores de Mudanças',
          description: 'Aprovação e gestão de RFCs',
          type: 'role',
          scope: 'Change Management',
          users_affected: 5,
          last_modified: '2024-11-15',
          status: 'active'
        },
        {
          id: '4',
          name: 'Visualização de Dados Sensíveis',
          description: 'Acesso a informações PII e dados confidenciais',
          type: 'data',
          scope: 'LGPD Protected',
          users_affected: 8,
          last_modified: '2024-12-10',
          status: 'active'
        },
        {
          id: '5',
          name: 'Relatórios Gerenciais',
          description: 'Acesso a dashboards e analytics',
          type: 'permission',
          scope: 'Analytics',
          users_affected: 12,
          last_modified: '2024-12-05',
          status: 'active'
        }
      ])

      setAlerts([
        {
          id: '1',
          type: 'login_failure',
          severity: 'warning',
          message: '5 tentativas de login falhadas para admin@empresa.com',
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          acknowledged: false
        },
        {
          id: '2',
          type: 'permission_escalation',
          severity: 'critical',
          message: 'Elevação de privilégios detectada: user → admin',
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          acknowledged: true
        },
        {
          id: '3',
          type: 'data_export',
          severity: 'info',
          message: 'Exportação em massa de dados realizada',
          timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
          acknowledged: true
        }
      ])

    } catch (error) {
      console.error('Error fetching governance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-700 bg-green-100'
      case 'partial': return 'text-yellow-700 bg-yellow-100'
      case 'non_compliant': return 'text-red-700 bg-red-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'compliant': return 'Conforme'
      case 'partial': return 'Parcial'
      case 'non_compliant': return 'Não Conforme'
      default: return 'N/A'
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'critical': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN':
      case 'LOGOUT':
        return <KeyIcon className="w-4 h-4" />
      case 'LOGIN_FAILED':
        return <ExclamationTriangleIcon className="w-4 h-4" />
      case 'CREATE':
        return <DocumentTextIcon className="w-4 h-4" />
      case 'UPDATE':
        return <ArrowPathIcon className="w-4 h-4" />
      case 'DELETE':
        return <XCircleIcon className="w-4 h-4" />
      case 'PERMISSION_CHANGE':
        return <ShieldCheckIcon className="w-4 h-4" />
      default:
        return <InformationCircleIcon className="w-4 h-4" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 60) return `${minutes}min atrás`
    if (hours < 24) return `${hours}h atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const complianceStats = {
    total: controls.length,
    compliant: controls.filter(c => c.status === 'compliant').length,
    partial: controls.filter(c => c.status === 'partial').length,
    nonCompliant: controls.filter(c => c.status === 'non_compliant').length
  }

  const compliancePercentage = Math.round((complianceStats.compliant / complianceStats.total) * 100)

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: ChartBarIcon },
    { id: 'audit', label: 'Trilha de Auditoria', icon: ClipboardDocumentListIcon },
    { id: 'compliance', label: 'Compliance', icon: DocumentCheckIcon },
    { id: 'access', label: 'Controle de Acesso', icon: LockClosedIcon },
    { id: 'data', label: 'Governança de Dados', icon: ServerIcon }
  ]

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    const matchesRisk = riskFilter === 'all' || log.risk_level === riskFilter
    return matchesSearch && matchesAction && matchesRisk
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheckIconSolid className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                Governança e Auditoria
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Controles COBIT, LGPD e gestão de conformidade
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchGovernanceData()}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Relatório</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 -mb-px flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Compliance Score */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                    <h3 className="text-lg font-medium opacity-90">Score de Conformidade</h3>
                    <div className="mt-4 flex items-end gap-4">
                      <span className="text-5xl font-bold">{compliancePercentage}%</span>
                      <span className="text-sm opacity-80 pb-2">
                        {complianceStats.compliant} de {complianceStats.total} controles
                      </span>
                    </div>
                    <div className="mt-4 bg-white/20 rounded-full h-3">
                      <div
                        className="bg-white rounded-full h-3 transition-all"
                        style={{ width: `${compliancePercentage}%` }}
                      />
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        {complianceStats.compliant} Conforme
                      </span>
                      <span className="flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        {complianceStats.partial} Parcial
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <ClipboardDocumentListIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Eventos Hoje</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{auditLogs.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Trilha de auditoria</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <BellAlertIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Alertas</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">
                        {alerts.filter(a => !a.acknowledged).length}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Pendentes</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <UserGroupIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Políticas</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{policies.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Ativas</p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <ShieldCheckIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Frameworks</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">4</p>
                      <p className="text-xs text-gray-500 mt-1">Monitorados</p>
                    </div>
                  </div>
                </div>

                {/* Security Alerts */}
                {alerts.filter(a => !a.acknowledged).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                      <BellAlertIcon className="w-5 h-5" />
                      Alertas de Segurança Pendentes
                    </h3>
                    <div className="space-y-2">
                      {alerts.filter(a => !a.acknowledged).map(alert => (
                        <div
                          key={alert.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            alert.severity === 'critical' ? 'bg-red-100' :
                            alert.severity === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className={`w-5 h-5 ${
                              alert.severity === 'critical' ? 'text-red-600' :
                              alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                            }`} />
                            <div>
                              <p className="font-medium text-gray-900">{alert.message}</p>
                              <p className="text-xs text-gray-500">{formatTimestamp(alert.timestamp)}</p>
                            </div>
                          </div>
                          <button className="text-sm text-gray-600 hover:text-gray-900">
                            Reconhecer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Framework Compliance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['COBIT', 'LGPD', 'ISO27001', 'ITIL'].map(framework => {
                    const frameworkControls = controls.filter(c => c.framework === framework)
                    const compliant = frameworkControls.filter(c => c.status === 'compliant').length
                    const total = frameworkControls.length
                    const percentage = total > 0 ? Math.round((compliant / total) * 100) : 0

                    return (
                      <div key={framework} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-900">{framework}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            percentage >= 80 ? 'bg-green-100 text-green-700' :
                            percentage >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {percentage}%
                          </span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2 mb-2">
                          <div
                            className={`rounded-full h-2 transition-all ${
                              percentage >= 80 ? 'bg-green-500' :
                              percentage >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{compliant} de {total} controles</p>
                      </div>
                    )
                  })}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Atividade Recente</h3>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      Ver tudo
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {auditLogs.slice(0, 5).map(log => (
                      <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          log.status === 'failure' ? 'bg-red-100 text-red-600' :
                          log.risk_level === 'high' || log.risk_level === 'critical' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{log.user_name}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {log.action} - {log.resource_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor(log.risk_level)}`}>
                            {log.risk_level.toUpperCase()}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{formatTimestamp(log.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por usuário, recurso ou ação..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="1h">Última hora</option>
                        <option value="24h">24 horas</option>
                        <option value="7d">7 dias</option>
                        <option value="30d">30 dias</option>
                      </select>
                      <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="all">Todas ações</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGIN_FAILED">Login Falhou</option>
                        <option value="CREATE">Criar</option>
                        <option value="UPDATE">Atualizar</option>
                        <option value="DELETE">Excluir</option>
                        <option value="PERMISSION_CHANGE">Permissão</option>
                      </select>
                      <select
                        value={riskFilter}
                        onChange={(e) => setRiskFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="all">Todos riscos</option>
                        <option value="low">Baixo</option>
                        <option value="medium">Médio</option>
                        <option value="high">Alto</option>
                        <option value="critical">Crítico</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Audit Log Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurso</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risco</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{log.user_name}</p>
                                <p className="text-xs text-gray-500">{log.user_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2 text-sm text-gray-900">
                                {getActionIcon(log.action)}
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-gray-900">{log.resource_name}</p>
                                <p className="text-xs text-gray-500">{log.resource_type}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{log.ip_address}</td>
                            <td className="px-4 py-3">
                              {log.status === 'success' ? (
                                <span className="flex items-center gap-1 text-green-600 text-sm">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Sucesso
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600 text-sm">
                                  <XCircleIcon className="w-4 h-4" />
                                  Falha
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRiskColor(log.risk_level)}`}>
                                {log.risk_level.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button className="text-indigo-600 hover:text-indigo-700">
                                <EyeIcon className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && (
              <div className="space-y-6">
                {/* Framework Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['Todos', 'COBIT', 'LGPD', 'ISO27001', 'ITIL'].map(fw => (
                    <button
                      key={fw}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50 whitespace-nowrap"
                    >
                      {fw}
                    </button>
                  ))}
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {controls.map(control => (
                    <div
                      key={control.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                            {control.framework}
                          </span>
                          <span className="text-sm font-mono text-gray-500">{control.control_id}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(control.status)}`}>
                          {getStatusLabel(control.status)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{control.name}</h3>
                      <p className="text-sm text-gray-500 mb-3">{control.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5" />
                          {control.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <DocumentTextIcon className="w-3.5 h-3.5" />
                          {control.evidence_count} evidências
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {new Date(control.last_assessment).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Access Control Tab */}
            {activeTab === 'access' && (
              <div className="space-y-6">
                {/* RBAC Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <UserGroupIcon className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {policies.filter(p => p.type === 'role').length}
                        </p>
                        <p className="text-sm text-gray-500">Roles Definidos</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <KeyIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {policies.reduce((acc, p) => acc + p.users_affected, 0)}
                        </p>
                        <p className="text-sm text-gray-500">Usuários Cobertos</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {policies.filter(p => p.status === 'active').length}
                        </p>
                        <p className="text-sm text-gray-500">Políticas Ativas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Policies List */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Políticas de Acesso</h3>
                    <button className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                      Nova Política
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {policies.map(policy => (
                      <div key={policy.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          policy.type === 'role' ? 'bg-purple-100 text-purple-600' :
                          policy.type === 'permission' ? 'bg-blue-100 text-blue-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          {policy.type === 'role' ? <UserGroupIcon className="w-5 h-5" /> :
                           policy.type === 'permission' ? <KeyIcon className="w-5 h-5" /> :
                           <LockClosedIcon className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{policy.name}</p>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              policy.status === 'active' ? 'bg-green-100 text-green-700' :
                              policy.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {policy.status === 'active' ? 'Ativa' :
                               policy.status === 'draft' ? 'Rascunho' : 'Depreciada'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{policy.description}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium text-gray-900">{policy.users_affected} usuários</p>
                          <p className="text-xs text-gray-500">{policy.scope}</p>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600">
                          <Cog6ToothIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SSO & MFA Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <GlobeAltIcon className="w-5 h-5 text-gray-400" />
                      Single Sign-On (SSO)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Azure AD</span>
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircleIcon className="w-4 h-4" />
                          Configurado
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Google Workspace</span>
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircleIcon className="w-4 h-4" />
                          Configurado
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Okta</span>
                        <span className="flex items-center gap-1 text-gray-400 text-sm">
                          <XCircleIcon className="w-4 h-4" />
                          Não configurado
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FingerPrintIcon className="w-5 h-5 text-gray-400" />
                      Autenticação Multi-Fator (MFA)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Administradores</span>
                        <span className="text-sm font-medium text-green-600">100% habilitado</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Agentes</span>
                        <span className="text-sm font-medium text-yellow-600">85% habilitado</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Usuários</span>
                        <span className="text-sm font-medium text-orange-600">42% habilitado</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Governance Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* LGPD Compliance Overview */}
                <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-6 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <ShieldCheckIcon className="w-6 h-6" />
                        Conformidade LGPD
                      </h3>
                      <p className="text-white/80 text-sm mt-1">
                        Status geral da proteção de dados pessoais
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold">92%</p>
                      <p className="text-sm text-white/80">Score de Conformidade</p>
                    </div>
                  </div>
                </div>

                {/* Data Protection Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500 mb-1">Titulares Cadastrados</p>
                    <p className="text-2xl font-bold text-gray-900">12.458</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500 mb-1">Consentimentos Ativos</p>
                    <p className="text-2xl font-bold text-green-600">11.892</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500 mb-1">Solicitações Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-600">23</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500 mb-1">Dados Anonimizados</p>
                    <p className="text-2xl font-bold text-blue-600">8.234</p>
                  </div>
                </div>

                {/* Data Categories */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Categorias de Dados Pessoais</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { category: 'Dados de Identificação', count: 15234, sensitivity: 'Médio', encrypted: true },
                      { category: 'Dados de Contato', count: 14892, sensitivity: 'Baixo', encrypted: true },
                      { category: 'Dados Profissionais', count: 12456, sensitivity: 'Baixo', encrypted: false },
                      { category: 'Dados Financeiros', count: 8923, sensitivity: 'Alto', encrypted: true },
                      { category: 'Dados de Saúde', count: 3421, sensitivity: 'Sensível', encrypted: true }
                    ].map((item, index) => (
                      <div key={index} className="p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.category}</p>
                          <p className="text-sm text-gray-500">{item.count.toLocaleString('pt-BR')} registros</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.sensitivity === 'Sensível' ? 'bg-red-100 text-red-700' :
                          item.sensitivity === 'Alto' ? 'bg-orange-100 text-orange-700' :
                          item.sensitivity === 'Médio' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.sensitivity}
                        </span>
                        {item.encrypted ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <LockClosedIcon className="w-4 h-4" />
                            Criptografado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-sm">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            Não criptografado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Subject Requests */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Solicitações de Titulares (DSAR)</h3>
                    <button className="text-sm text-indigo-600 hover:text-indigo-700">Ver todas</button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { id: 'DSAR-001', type: 'Acesso', requester: 'joao.silva@email.com', status: 'pending', date: '2024-12-10' },
                      { id: 'DSAR-002', type: 'Exclusão', requester: 'maria.santos@email.com', status: 'in_progress', date: '2024-12-08' },
                      { id: 'DSAR-003', type: 'Portabilidade', requester: 'carlos.lima@email.com', status: 'completed', date: '2024-12-05' }
                    ].map((request, index) => (
                      <div key={index} className="p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{request.id}</span>
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                              {request.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{request.requester}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-700' :
                          request.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {request.status === 'completed' ? 'Concluído' :
                           request.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                        </span>
                        <span className="text-sm text-gray-500">{new Date(request.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Retention Policies */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Políticas de Retenção de Dados</h3>
                  <div className="space-y-3">
                    {[
                      { type: 'Tickets Resolvidos', retention: '5 anos', autoDelete: true },
                      { type: 'Logs de Auditoria', retention: '7 anos', autoDelete: true },
                      { type: 'Dados de Sessão', retention: '30 dias', autoDelete: true },
                      { type: 'Anexos de Tickets', retention: '3 anos', autoDelete: false },
                      { type: 'Dados de Contato', retention: 'Até revogação', autoDelete: false }
                    ].map((policy, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-600">{policy.type}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-900">{policy.retention}</span>
                          {policy.autoDelete ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircleIcon className="w-4 h-4" />
                              Auto-exclusão
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400 text-xs">
                              <ClockIcon className="w-4 h-4" />
                              Manual
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Voltar
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg"
          >
            Exportar Relatório
          </button>
        </div>
      </div>
    </div>
  )
}
