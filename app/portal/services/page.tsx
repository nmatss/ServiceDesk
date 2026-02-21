import { Metadata } from 'next'
import ServicesClient from './services-client'

export const metadata: Metadata = {
  title: 'Central de Serviços | ServiceDesk',
  description: 'Todas as áreas da empresa em um só lugar',
}

// Disable static generation to avoid build errors
export const dynamic = 'force-dynamic'

// ISR Configuration - Revalidate every 5 minutes (service areas change infrequently)
export const revalidate = 300

interface ServiceArea {
  id: string
  name: string
  description: string
  icon: string
  color: string
  bgColor: string
  services: number
  avgResponseTime: string
  satisfaction: number
  featured?: boolean
}

interface QuickAction {
  id: string
  title: string
  description: string
  area: string
  icon: string
  color: string
  popular?: boolean
}

// Server-side data - can be fetched from API or database
const serviceAreas: ServiceArea[] = [
  {
    id: 'ti',
    name: 'Tecnologia da Informação',
    description: 'Suporte técnico, sistemas, infraestrutura e segurança',
    icon: 'ComputerDesktopIcon',
    color: 'text-brand-600',
    bgColor: 'bg-brand-100',
    services: 45,
    avgResponseTime: '15min',
    satisfaction: 4.8,
    featured: true
  },
  {
    id: 'rh',
    name: 'Recursos Humanos',
    description: 'Folha de pagamento, benefícios, férias e admissões',
    icon: 'UserGroupIcon',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    services: 28,
    avgResponseTime: '2h',
    satisfaction: 4.6
  },
  {
    id: 'facilities',
    name: 'Facilities',
    description: 'Manutenção predial, limpeza, segurança patrimonial',
    icon: 'BuildingOfficeIcon',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    services: 22,
    avgResponseTime: '4h',
    satisfaction: 4.5
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    description: 'Reembolsos, pagamentos, notas fiscais e orçamentos',
    icon: 'CurrencyDollarIcon',
    color: 'text-warning-600',
    bgColor: 'bg-warning-100',
    services: 18,
    avgResponseTime: '1d',
    satisfaction: 4.4
  },
  {
    id: 'juridico',
    name: 'Jurídico',
    description: 'Contratos, compliance e questões legais',
    icon: 'ShieldCheckIcon',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    services: 12,
    avgResponseTime: '2d',
    satisfaction: 4.7
  },
  {
    id: 'treinamento',
    name: 'Treinamento',
    description: 'Capacitação, cursos e desenvolvimento profissional',
    icon: 'AcademicCapIcon',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    services: 15,
    avgResponseTime: '1d',
    satisfaction: 4.9
  },
  {
    id: 'logistica',
    name: 'Logística',
    description: 'Entregas, frota e gestão de materiais',
    icon: 'TruckIcon',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    services: 10,
    avgResponseTime: '4h',
    satisfaction: 4.3
  },
  {
    id: 'saude',
    name: 'Saúde e Segurança',
    description: 'Medicina do trabalho, EPIs e segurança ocupacional',
    icon: 'HeartIcon',
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    services: 8,
    avgResponseTime: '30min',
    satisfaction: 4.8
  }
]

const quickActions: QuickAction[] = [
  { id: 'reset-senha', title: 'Redefinir Senha', description: 'Recupere acesso ao sistema', area: 'ti', icon: 'ComputerDesktopIcon', color: 'bg-brand-500', popular: true },
  { id: 'novo-usuario', title: 'Novo Usuário', description: 'Criar acesso para colaborador', area: 'ti', icon: 'UserGroupIcon', color: 'bg-brand-500', popular: true },
  { id: 'ferias', title: 'Solicitar Férias', description: 'Agendar período de férias', area: 'rh', icon: 'UserGroupIcon', color: 'bg-purple-500', popular: true },
  { id: 'reembolso', title: 'Reembolso', description: 'Solicitar reembolso de despesas', area: 'financeiro', icon: 'CurrencyDollarIcon', color: 'bg-warning-500', popular: true },
  { id: 'manutencao', title: 'Manutenção', description: 'Reportar problema predial', area: 'facilities', icon: 'WrenchScrewdriverIcon', color: 'bg-success-500' },
  { id: 'equipamento', title: 'Novo Equipamento', description: 'Solicitar computador/periférico', area: 'ti', icon: 'ComputerDesktopIcon', color: 'bg-brand-500' }
]

export default async function MultiServicePortalPage() {
  // In a real implementation, you could fetch recent requests from API here
  // For now, using static data which is perfect for SSR

  return (
    <ServicesClient
      serviceAreas={serviceAreas}
      quickActions={quickActions}
    />
  )
}
