'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ServerIcon,
  LinkIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'

export default function NewProblemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    impact: '',
    affected_services: [] as string[],
    related_incidents: ''
  })
  const [newService, setNewService] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/admin/problems')
    } catch (error) {
      console.error('Error creating problem:', error)
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
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Page Header with Breadcrumbs */}
      <PageHeader
        title="Novo Problema"
        description="Registrar um novo problema identificado no sistema"
        icon={ExclamationTriangleIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Problemas', href: '/admin/problems' },
          { label: 'Novo Problema' }
        ]}
      />

      {/* Form Container */}
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-brand-500" />
              Informações Básicas
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Título do Problema *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all"
                  placeholder="Ex: Lentidão intermitente no sistema ERP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Descrição *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all resize-none"
                  placeholder="Descreva os sintomas observados, quando ocorrem e quem é afetado..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="Performance">Performance</option>
                    <option value="Disponibilidade">Disponibilidade</option>
                    <option value="Segurança">Segurança</option>
                    <option value="Integração">Integração</option>
                    <option value="Infraestrutura">Infraestrutura</option>
                    <option value="Aplicação">Aplicação</option>
                    <option value="Rede">Rede</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Prioridade *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Impact */}
          <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
              Impacto
            </h2>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Descrição do Impacto
              </label>
              <textarea
                value={formData.impact}
                onChange={(e) => setFormData(prev => ({ ...prev, impact: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all resize-none"
                placeholder="Descreva o impacto nos negócios, número de usuários afetados, etc."
              />
            </div>
          </div>

          {/* Affected Services */}
          <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <ServerIcon className="w-5 h-5 text-info-500" />
              Serviços Afetados
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all"
                placeholder="Nome do serviço"
              />
              <button
                type="button"
                onClick={addService}
                className="px-4 py-2.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors flex items-center justify-center"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.affected_services.map((service, index) => (
                <span
                  key={index}
                  className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm flex items-center gap-2 animate-fade-in group"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="text-neutral-400 hover:text-error-500 dark:hover:text-error-400 transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              ))}
              {formData.affected_services.length === 0 && (
                <p className="text-sm text-muted-content">Nenhum serviço adicionado</p>
              )}
            </div>
          </div>

          {/* Related Incidents */}
          <div className="glass-panel animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-muted-content" />
              Incidentes Relacionados
            </h2>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                IDs dos Incidentes (separados por vírgula)
              </label>
              <input
                type="text"
                value={formData.related_incidents}
                onChange={(e) => setFormData(prev => ({ ...prev, related_incidents: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all"
                placeholder="Ex: 1234, 1256, 1278"
              />
              <p className="text-xs text-muted-content mt-2">
                Vincule incidentes recorrentes que levaram à identificação deste problema
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-gradient-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Criando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-5 h-5" />
                  Criar Problema
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/problems')}
              className="flex-1 sm:flex-none px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 shadow-lg p-3 sm:hidden safe-bottom z-10">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-gradient-brand rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          >
            {loading ? 'Criando...' : 'Criar Problema'}
          </button>
        </div>
      </div>
    </div>
  )
}
