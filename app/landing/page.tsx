import { Metadata } from 'next'
import { generatePageMetadata, pageSEOConfigs, generateStructuredData, generateConversationalDescription } from '@/lib/seo/metadata'
import LandingClient from './landing-client'
import {
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  StarIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'

// SEO Metadata
export const metadata: Metadata = {
  ...generatePageMetadata(pageSEOConfigs.home),
  description: generateConversationalDescription('service', {
    features: 'gestão completa de tickets, SLA automático, relatórios avançados e multi-tenancy'
  }),
  other: {
    'structured-data': JSON.stringify(generateStructuredData('SoftwareApplication'))
  }
}

export default function LandingPage() {
  return <LandingClient />
}