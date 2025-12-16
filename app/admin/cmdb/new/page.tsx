'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ServerStackIcon,
  ArrowLeftIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  PrinterIcon,
  CloudIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  LinkIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline'

const ciTypes = [
  { id: 'server', name: 'Servidor', icon: ServerStackIcon, color: 'blue' },
  { id: 'database', name: 'Banco de Dados', icon: CircleStackIcon, color: 'purple' },
  { id: 'application', name: 'Aplicação', icon: CpuChipIcon, color: 'green' },
  { id: 'network', name: 'Equipamento de Rede', icon: GlobeAltIcon, color: 'orange' },
  { id: 'workstation', name: 'Estação de Trabalho', icon: ComputerDesktopIcon, color: 'gray' },
  { id: 'mobile', name: 'Dispositivo Móvel', icon: DevicePhoneMobileIcon, color: 'pink' },
  { id: 'printer', name: 'Impressora', icon: PrinterIcon, color: 'indigo' },
  { id: 'cloud', name: 'Serviço Cloud', icon: CloudIcon, color: 'cyan' },
  { id: 'service', name: 'Serviço de TI', icon: WrenchScrewdriverIcon, color: 'yellow' },
  { id: 'document', name: 'Documentação', icon: DocumentTextIcon, color: 'emerald' }
]

const statusOptions = [
  { id: 'active', name: 'Ativo', color: 'green' },
  { id: 'inactive', name: 'Inativo', color: 'gray' },
  { id: 'maintenance', name: 'Em Manutenção', color: 'yellow' },
  { id: 'decommissioned', name: 'Desativado', color: 'red' },
  { id: 'planned', name: 'Planejado', color: 'blue' }
]

const criticalities = [
  { id: 'critical', name: 'Crítico', color: 'red', description: 'Impacto direto nos negócios' },
  { id: 'high', name: 'Alto', color: 'orange', description: 'Afeta operações principais' },
  { id: 'medium', name: 'Médio', color: 'yellow', description: 'Impacto moderado' },
  { id: 'low', name: 'Baixo', color: 'green', description: 'Impacto limitado' }
]

export default function NewCIPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    description: '',
    status: 'active',
    criticality: 'medium',
    owner: '',
    location: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    ip_address: '',
    mac_address: '',
    os: '',
    version: '',
    purchase_date: '',
    warranty_expiry: '',
    cost: '',
    tags: [] as string[],
    relationships: [] as { type: string; target: string }[]
  })
  const [newTag, setNewTag] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/admin/cmdb')
    } catch (error) {
      console.error('Error creating CI:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const selectedType = ciTypes.find(t => t.id === formData.type)

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/cmdb')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ServerStackIcon className="w-6 h-6 text-blue-600" />
                Novo Item de Configuração
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Adicionar um novo CI ao CMDB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > s ? <CheckIcon className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs sm:text-sm text-gray-600">
          <span>Tipo</span>
          <span>Informações</span>
          <span>Detalhes</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Type */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Selecione o Tipo de CI
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {ciTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      formData.type === type.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <type.icon className={`w-8 h-8 ${
                      formData.type === type.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium text-center ${
                      formData.type === type.id ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {type.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  {selectedType && <selectedType.icon className="w-5 h-5 text-blue-600" />}
                  Informações Básicas
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: SRV-PROD-01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Descreva a função e características do CI..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status *
                      </label>
                      <select
                        required
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {statusOptions.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Criticidade *
                      </label>
                      <select
                        required
                        value={formData.criticality}
                        onChange={(e) => setFormData(prev => ({ ...prev, criticality: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {criticalities.map(c => (
                          <option key={c.id} value={c.id}>{c.name} - {c.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Responsável
                      </label>
                      <input
                        type="text"
                        value={formData.owner}
                        onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome do responsável"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Localização
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Datacenter SP, Rack 15"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Technical Details */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  Detalhes Técnicos
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fabricante
                      </label>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Dell, HP, Microsoft"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Modelo
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: PowerEdge R740"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Série
                      </label>
                      <input
                        type="text"
                        value={formData.serial_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="S/N"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Endereço IP
                      </label>
                      <input
                        type="text"
                        value={formData.ip_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 192.168.1.100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sistema Operacional
                      </label>
                      <input
                        type="text"
                        value={formData.os}
                        onChange={(e) => setFormData(prev => ({ ...prev, os: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Windows Server 2022"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Versão
                      </label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: 21H2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  Informações Financeiras
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Compra
                    </label>
                    <input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fim da Garantia
                    </label>
                    <input
                      type="date"
                      value={formData.warranty_expiry}
                      onChange={(e) => setFormData(prev => ({ ...prev, warranty_expiry: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  Tags
                </h2>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Adicionar tag..."
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                  {formData.tags.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhuma tag adicionada</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Voltar
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !formData.type}
                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-5 h-5" />
                    Criar CI
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push('/admin/cmdb')}
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
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
            >
              Voltar
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.type}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Criar CI'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
