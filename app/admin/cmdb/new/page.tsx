'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import {
  ServerStackIcon,
  ArrowLeftIcon,
  HomeIcon,
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/20 to-neutral-50 dark:from-neutral-950 dark:via-brand-950/20 dark:to-neutral-950 pb-6">
      {/* Modern Header */}
      <div className="glass-panel border-b border-neutral-200/50 dark:border-neutral-700/50 backdrop-blur-lg bg-white/80 dark:bg-neutral-900/80 mb-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/cmdb')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-description" />
            </button>
          </div>

          <PageHeader
            title="Novo Item de Configuração"
            description="Adicionar um novo CI ao CMDB"
            icon={ServerStackIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'CMDB', href: '/admin/cmdb' },
              { label: 'Novo Item' }
            ]}
          />
        </div>
      </div>

      {/* Modern Progress Steps */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-lg animate-slide-up">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-all duration-300 ${
                    step >= s
                      ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white scale-110'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-description'
                  }`}
                >
                  {step > s ? <CheckIcon className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1.5 mx-3 rounded-full transition-all duration-300 ${step > s ? 'bg-gradient-to-r from-brand-500 to-brand-600' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs sm:text-sm font-medium">
            <span className={step >= 1 ? 'text-brand-600 dark:text-brand-400' : 'text-description'}>Tipo</span>
            <span className={step >= 2 ? 'text-brand-600 dark:text-brand-400' : 'text-description'}>Informações</span>
            <span className={step >= 3 ? 'text-brand-600 dark:text-brand-400' : 'text-description'}>Detalhes</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Type - Modern */}
          {step === 1 && (
            <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm animate-fade-in">
              <h2 className="font-bold text-lg text-neutral-900 dark:text-neutral-100 mb-5">
                Selecione o Tipo de CI
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {ciTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                    className={`p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-3 hover:scale-105 ${
                      formData.type === type.id
                        ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 shadow-lg'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:shadow-md'
                    }`}
                  >
                    <type.icon className={`w-9 h-9 transition-colors ${
                      formData.type === type.id ? 'text-brand-600 dark:text-brand-400' : 'text-icon-muted'
                    }`} />
                    <span className={`text-sm font-semibold text-center leading-tight ${
                      formData.type === type.id ? 'text-brand-700 dark:text-brand-300' : 'text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {type.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Basic Info - Modern */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                  {selectedType && <selectedType.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />}
                  Informações Básicas
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      placeholder="Ex: SRV-PROD-01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      placeholder="Descreva a função e características do CI..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Status *
                      </label>
                      <select
                        required
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      >
                        {statusOptions.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Criticidade *
                      </label>
                      <select
                        required
                        value={formData.criticality}
                        onChange={(e) => setFormData(prev => ({ ...prev, criticality: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      >
                        {criticalities.map(c => (
                          <option key={c.id} value={c.id}>{c.name} - {c.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Responsável
                      </label>
                      <input
                        type="text"
                        value={formData.owner}
                        onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Nome do responsável"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Localização
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: Datacenter SP, Rack 15"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Technical Details - Modern */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Detalhes Técnicos
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Fabricante
                      </label>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: Dell, HP, Microsoft"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Modelo
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: PowerEdge R740"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Número de Série
                      </label>
                      <input
                        type="text"
                        value={formData.serial_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="S/N"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Endereço IP
                      </label>
                      <input
                        type="text"
                        value={formData.ip_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: 192.168.1.100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Sistema Operacional
                      </label>
                      <input
                        type="text"
                        value={formData.os}
                        onChange={(e) => setFormData(prev => ({ ...prev, os: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: Windows Server 2022"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Versão
                      </label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: 21H2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Informações Financeiras
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Data de Compra
                    </label>
                    <input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Fim da Garantia
                    </label>
                    <input
                      type="date"
                      value={formData.warranty_expiry}
                      onChange={(e) => setFormData(prev => ({ ...prev, warranty_expiry: e.target.value }))}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Custo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Tags
                </h2>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                    placeholder="Adicionar tag..."
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-icon-muted hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                  {formData.tags.length === 0 && (
                    <p className="text-sm text-muted-content">Nenhuma tag adicionada</p>
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
                className="flex-1 sm:flex-none px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Voltar
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !formData.type}
                className="flex-1 sm:flex-none px-6 py-3 bg-brand-600 dark:bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-6 py-3 bg-brand-600 dark:bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
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
              className="flex-1 sm:flex-none px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 shadow-lg p-3 sm:hidden safe-bottom animate-slide-up">
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
            >
              Voltar
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.type}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 dark:bg-brand-500 rounded-lg disabled:opacity-50 transition-colors"
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 dark:bg-brand-500 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : 'Criar CI'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
