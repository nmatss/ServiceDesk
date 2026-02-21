'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
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

// Icon mapping for CI types
const iconMapping: Record<string, any> = {
  server: ServerStackIcon,
  database: CircleStackIcon,
  application: CpuChipIcon,
  network: GlobeAltIcon,
  workstation: ComputerDesktopIcon,
  desktop: ComputerDesktopIcon,
  laptop: ComputerDesktopIcon,
  mobile: DevicePhoneMobileIcon,
  printer: PrinterIcon,
  cloud: CloudIcon,
  service: WrenchScrewdriverIcon,
  storage: CircleStackIcon,
  document: DocumentTextIcon,
  default: ServerStackIcon
}

const criticalities = [
  { id: 'critical', name: 'Crítico', color: 'red', description: 'Impacto direto nos negócios' },
  { id: 'high', name: 'Alto', color: 'orange', description: 'Afeta operações principais' },
  { id: 'medium', name: 'Médio', color: 'yellow', description: 'Impacto moderado' },
  { id: 'low', name: 'Baixo', color: 'green', description: 'Impacto limitado' }
]

interface CIType {
  id: number
  name: string
  icon: string
  color: string
}

interface CIStatus {
  id: number
  name: string
  color: string
  is_operational: boolean
}

export default function NewCIPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [step, setStep] = useState(1)
  const [ciTypes, setCiTypes] = useState<CIType[]>([])
  const [statusOptions, setStatusOptions] = useState<CIStatus[]>([])
  const [formData, setFormData] = useState({
    ci_type_id: 0,
    name: '',
    description: '',
    status_id: 1,
    criticality: 'medium',
    location: '',
    manufacturer: '',
    vendor: '',
    serial_number: '',
    asset_tag: '',
    ip_address: '',
    mac_address: '',
    hostname: '',
    os_version: '',
    environment: '',
    data_center: '',
    rack_position: '',
    business_service: '',
    business_impact: '',
    recovery_time_objective: undefined as number | undefined,
    recovery_point_objective: undefined as number | undefined,
    purchase_date: '',
    installation_date: '',
    warranty_expiry: '',
    end_of_life_date: '',
    owner_id: undefined as number | undefined,
    managed_by_team_id: undefined as number | undefined,
    custom_attributes: {} as Record<string, any>
  })
  const [newTag, setNewTag] = useState('') // eslint-disable-line @typescript-eslint/no-unused-vars

  // Fetch CI Types and Statuses on mount
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoadingData(true)
    try {
      const [typesRes, statusesRes] = await Promise.all([
        fetch('/api/cmdb/types'),
        fetch('/api/cmdb/statuses')
      ])

      const typesData = await typesRes.json()
      const statusesData = await statusesRes.json()

      if (typesData.success) {
        setCiTypes(typesData.types)
      }

      if (statusesData.success) {
        setStatusOptions(statusesData.statuses)
        // Set default status to first operational status
        const defaultStatus = statusesData.statuses.find((s: CIStatus) => s.is_operational)
        if (defaultStatus) {
          setFormData(prev => ({ ...prev, status_id: defaultStatus.id }))
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Erro ao carregar dados iniciais')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Prepare data for API
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        ci_type_id: formData.ci_type_id,
        status_id: formData.status_id,
        owner_id: formData.owner_id,
        managed_by_team_id: formData.managed_by_team_id,
        vendor: formData.vendor || undefined,
        manufacturer: formData.manufacturer || undefined,
        location: formData.location || undefined,
        environment: formData.environment || undefined,
        data_center: formData.data_center || undefined,
        rack_position: formData.rack_position || undefined,
        serial_number: formData.serial_number || undefined,
        asset_tag: formData.asset_tag || undefined,
        ip_address: formData.ip_address || undefined,
        mac_address: formData.mac_address || undefined,
        hostname: formData.hostname || undefined,
        os_version: formData.os_version || undefined,
        business_service: formData.business_service || undefined,
        criticality: formData.criticality,
        business_impact: formData.business_impact || undefined,
        recovery_time_objective: formData.recovery_time_objective,
        recovery_point_objective: formData.recovery_point_objective,
        purchase_date: formData.purchase_date || undefined,
        installation_date: formData.installation_date || undefined,
        warranty_expiry: formData.warranty_expiry || undefined,
        end_of_life_date: formData.end_of_life_date || undefined,
        custom_attributes: formData.custom_attributes
      }

      const response = await fetch('/api/cmdb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar item de configuração')
      }

      toast.success(data.message || 'Item de configuração criado com sucesso!')
      router.push('/admin/cmdb')
    } catch (error) {
      console.error('Error creating CI:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar item de configuração')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    const tags = (formData as any).tags || []
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        custom_attributes: { ...prev.custom_attributes, tags: [...tags, newTag.trim()] }
      }))
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    const tags = ((formData as any).custom_attributes?.tags || []) as string[]
    setFormData(prev => ({
      ...prev,
      custom_attributes: { ...prev.custom_attributes, tags: tags.filter((t: string) => t !== tag) }
    }))
  }

  const selectedType = ciTypes.find(t => t.id === formData.ci_type_id)
  const getTypeIcon = (iconName: string) => {
    return iconMapping[iconName?.toLowerCase()] || iconMapping.default
  }

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
              {loadingData ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  {ciTypes.map((type) => {
                    const TypeIcon = getTypeIcon(type.icon)
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, ci_type_id: type.id }))}
                        className={`p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-3 hover:scale-105 ${
                          formData.ci_type_id === type.id
                            ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 shadow-lg'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:shadow-md'
                        }`}
                      >
                        <TypeIcon className={`w-9 h-9 transition-colors ${
                          formData.ci_type_id === type.id ? 'text-brand-600 dark:text-brand-400' : 'text-icon-muted'
                        }`} />
                        <span className={`text-sm font-semibold text-center leading-tight ${
                          formData.ci_type_id === type.id ? 'text-brand-700 dark:text-brand-300' : 'text-neutral-700 dark:text-neutral-300'
                        }`}>
                          {type.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Basic Info - Modern */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                  {selectedType && (() => {
                    const TypeIcon = getTypeIcon(selectedType.icon)
                    return <TypeIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  })()}
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
                        value={formData.status_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, status_id: parseInt(e.target.value) }))}
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
                        Fornecedor
                      </label>
                      <input
                        type="text"
                        value={formData.vendor}
                        onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Nome do fornecedor"
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
                        Tag de Ativo
                      </label>
                      <input
                        type="text"
                        value={formData.asset_tag}
                        onChange={(e) => setFormData(prev => ({ ...prev, asset_tag: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: ASSET-001"
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
                        Sistema Operacional / Versão
                      </label>
                      <input
                        type="text"
                        value={formData.os_version}
                        onChange={(e) => setFormData(prev => ({ ...prev, os_version: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: Windows Server 2022"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Hostname
                      </label>
                      <input
                        type="text"
                        value={formData.hostname}
                        onChange={(e) => setFormData(prev => ({ ...prev, hostname: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: srv-prod-01.domain.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Informações Financeiras
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      Data de Instalação
                    </label>
                    <input
                      type="date"
                      value={formData.installation_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, installation_date: e.target.value }))}
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
                      Fim de Vida (EOL)
                    </label>
                    <input
                      type="date"
                      value={formData.end_of_life_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_of_life_date: e.target.value }))}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Informações Adicionais
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Ambiente
                      </label>
                      <select
                        value={formData.environment}
                        onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      >
                        <option value="">Selecione...</option>
                        <option value="production">Produção</option>
                        <option value="staging">Homologação</option>
                        <option value="development">Desenvolvimento</option>
                        <option value="test">Teste</option>
                        <option value="dr">DR (Disaster Recovery)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Serviço de Negócio
                      </label>
                      <input
                        type="text"
                        value={formData.business_service}
                        onChange={(e) => setFormData(prev => ({ ...prev, business_service: e.target.value }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: E-commerce, CRM"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Impacto no Negócio
                    </label>
                    <textarea
                      value={formData.business_impact}
                      onChange={(e) => setFormData(prev => ({ ...prev, business_impact: e.target.value }))}
                      rows={2}
                      className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                      placeholder="Descreva o impacto no negócio caso este CI falhe..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        RTO (Recovery Time Objective) - minutos
                      </label>
                      <input
                        type="number"
                        value={formData.recovery_time_objective || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, recovery_time_objective: e.target.value ? parseInt(e.target.value) : undefined }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: 240"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        RPO (Recovery Point Objective) - minutos
                      </label>
                      <input
                        type="number"
                        value={formData.recovery_point_objective || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, recovery_point_objective: e.target.value ? parseInt(e.target.value) : undefined }))}
                        className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-colors"
                        placeholder="Ex: 60"
                      />
                    </div>
                  </div>
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
                disabled={step === 1 && !formData.ci_type_id}
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
              disabled={step === 1 && !formData.ci_type_id}
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
