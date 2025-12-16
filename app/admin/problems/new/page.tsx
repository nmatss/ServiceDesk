'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  TagIcon,
  UserIcon,
  ServerIcon,
  LinkIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

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
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/problems')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-purple-600" />
                Novo Problema
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Registrar um novo problema identificado
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-400" />
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título do Problema *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Lentidão intermitente no sistema ERP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Descreva os sintomas observados, quando ocorrem e quem é afetado..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridade *
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
              Impacto
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição do Impacto
              </label>
              <textarea
                value={formData.impact}
                onChange={(e) => setFormData(prev => ({ ...prev, impact: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Descreva o impacto nos negócios, número de usuários afetados, etc."
              />
            </div>
          </div>

          {/* Affected Services */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ServerIcon className="w-5 h-5 text-blue-500" />
              Serviços Afetados
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do serviço"
              />
              <button
                type="button"
                onClick={addService}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.affected_services.map((service, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center gap-2"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              ))}
              {formData.affected_services.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum serviço adicionado</p>
              )}
            </div>
          </div>

          {/* Related Incidents */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-gray-400" />
              Incidentes Relacionados
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IDs dos Incidentes (separados por vírgula)
              </label>
              <input
                type="text"
                value={formData.related_incidents}
                onChange={(e) => setFormData(prev => ({ ...prev, related_incidents: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: 1234, 1256, 1278"
              />
              <p className="text-xs text-gray-500 mt-1">
                Vincule incidentes recorrentes que levaram à identificação deste problema
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
              className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
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
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Problema'}
          </button>
        </div>
      </div>
    </div>
  )
}
