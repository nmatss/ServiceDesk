'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import {
  ArrowPathIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  UserGroupIcon,
  PlusIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

export default function NewChangePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    justification: '',
    category: 'normal',
    priority: 'medium',
    risk_level: 3,
    impact_level: 3,
    urgency_level: 3,
    scheduled_start: '',
    scheduled_end: '',
    implementation_plan: '',
    rollback_plan: '',
    test_plan: '',
    affected_services: [] as string[],
    cab_required: true,
    related_problem: ''
  })
  const [newService, setNewService] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/admin/changes')
    } catch (error) {
      console.error('Error creating change:', error)
    } finally {
      setLoading(false)
    }
  }

  const addService = () => {
    if (newService.trim() && !formData.affected_services.includes(newService.trim())) {
      setFormData(prev => ({
        ...prev,
        affected_services: [...prev.affected_services, newService.trim()]
      }))
      setNewService('')
    }
  }

  const removeService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      affected_services: prev.affected_services.filter(s => s !== service)
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-purple-50/20 pb-6">
      {/* Modern Header with Breadcrumbs */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-neutral-200/50 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <PageHeader
            title="Nova Requisição de Mudança (RFC)"
            description="Submeter uma nova mudança para aprovação pelo CAB"
            icon={ArrowPathIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Mudanças', href: '/admin/changes' },
              { label: 'Nova RFC' }
            ]}
            actions={[
              {
                label: 'Voltar',
                onClick: () => router.push('/admin/changes'),
                icon: ArrowLeftIcon,
                variant: 'ghost'
              }
            ]}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="glass-panel">
            <h2 className="font-bold text-lg text-neutral-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-brand-500" />
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Título da Mudança *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ex: Atualização de segurança do firewall"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Descrição *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Descreva o que será alterado..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Justificativa *
                </label>
                <textarea
                  required
                  value={formData.justification}
                  onChange={(e) => setFormData(prev => ({ ...prev, justification: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Por que esta mudança é necessária? Qual problema resolve?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="standard">Padrão (pré-aprovada)</option>
                    <option value="normal">Normal (requer CAB)</option>
                    <option value="emergency">Emergência</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Prioridade *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Problema Relacionado (opcional)
                </label>
                <input
                  type="text"
                  value={formData.related_problem}
                  onChange={(e) => setFormData(prev => ({ ...prev, related_problem: e.target.value }))}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Ex: PRB-123"
                />
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="glass-panel bg-gradient-to-br from-orange-50/50 to-red-50/30">
            <h2 className="font-bold text-lg text-neutral-900 mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
              Avaliação de Risco
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nível de Risco (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.risk_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, risk_level: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Baixo</span>
                  <span className="font-medium text-lg text-orange-600">{formData.risk_level}</span>
                  <span>Alto</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nível de Impacto (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.impact_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, impact_level: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Baixo</span>
                  <span className="font-medium text-lg text-red-600">{formData.impact_level}</span>
                  <span>Alto</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nível de Urgência (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.urgency_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, urgency_level: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Baixa</span>
                  <span className="font-medium text-lg text-yellow-600">{formData.urgency_level}</span>
                  <span>Alta</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="glass-panel bg-gradient-to-br from-brand-50/50 to-brand-50/30">
            <h2 className="font-bold text-lg text-neutral-900 mb-4 flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-brand-500" />
              Agendamento
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Início Planejado
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_start}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fim Planejado
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_end}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_end: e.target.value }))}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="cab_required"
                checked={formData.cab_required}
                onChange={(e) => setFormData(prev => ({ ...prev, cab_required: e.target.checked }))}
                className="w-4 h-4 text-brand-600 border-neutral-300 rounded focus:ring-brand-500"
              />
              <label htmlFor="cab_required" className="text-sm text-neutral-700 flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4" />
                Requer aprovação do CAB
              </label>
            </div>
          </div>

          {/* Plans */}
          <div className="glass-panel">
            <h2 className="font-bold text-lg text-neutral-900 mb-4">Planos de Execução</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Plano de Implementação *
                </label>
                <textarea
                  required
                  value={formData.implementation_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, implementation_plan: e.target.value }))}
                  rows={5}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  placeholder="1. Backup do sistema&#10;2. Parar serviços&#10;3. Aplicar mudanças&#10;4. Testar&#10;5. Reiniciar serviços"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Plano de Rollback *
                </label>
                <textarea
                  required
                  value={formData.rollback_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, rollback_plan: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  placeholder="Em caso de falha:&#10;1. Parar o processo&#10;2. Restaurar backup&#10;3. Reiniciar serviços"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Plano de Testes *
                </label>
                <textarea
                  required
                  value={formData.test_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, test_plan: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  placeholder="Testes de validação:&#10;1. Verificar conectividade&#10;2. Testar funcionalidades principais&#10;3. Validar logs"
                />
              </div>
            </div>
          </div>

          {/* Affected Services */}
          <div className="glass-panel bg-gradient-to-br from-brand-50/50 to-cyan-50/30">
            <h2 className="font-bold text-lg text-neutral-900 mb-4 flex items-center gap-2">
              <ServerIcon className="w-5 h-5 text-brand-500" />
              Serviços Afetados
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Nome do serviço"
              />
              <button
                type="button"
                onClick={addService}
                className="px-4 py-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.affected_services.map((service, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg text-sm flex items-center gap-2"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              ))}
              {formData.affected_services.length === 0 && (
                <p className="text-sm text-neutral-500">Nenhum serviço adicionado</p>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="glass-panel bg-gradient-to-br from-brand-50 to-brand-50 border-brand-200">
            <div className="flex gap-3">
              <InformationCircleIcon className="w-6 h-6 text-brand-600 flex-shrink-0" />
              <div className="text-sm text-brand-700">
                <p className="font-semibold mb-2">Próximos passos após submissão:</p>
                <ul className="list-disc list-inside space-y-1.5">
                  <li>A RFC será revisada pelo gestor responsável</li>
                  {formData.cab_required && <li>Será agendada revisão pelo CAB (Change Advisory Board)</li>}
                  <li>Após aprovação, você poderá agendar a execução</li>
                  <li>Todas as partes interessadas serão notificadas automaticamente</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Criando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-5 h-5" />
                  Submeter RFC
                </>
              )}
            </button>
            <button
              type="button"
              className="flex-1 sm:flex-none px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200"
            >
              Salvar Rascunho
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/changes')}
              className="flex-1 sm:flex-none px-6 py-3 text-neutral-600 rounded-lg font-medium hover:bg-neutral-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Submeter RFC'}
          </button>
        </div>
      </div>
    </div>
  )
}
