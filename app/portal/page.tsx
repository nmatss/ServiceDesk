import { Metadata } from 'next'
import { generatePageMetadata, pageSEOConfigs, generateStructuredData, generateConversationalDescription } from '@/lib/seo/metadata'
import PortalClient from './portal-client'

// SEO Metadata
export const metadata: Metadata = {
  ...generatePageMetadata(pageSEOConfigs.portal),
  description: generateConversationalDescription('portal', {
    features: 'criar tickets, acompanhar status em tempo real e acessar nossa base de conhecimento'
  }),
  other: {
    'structured-data': JSON.stringify(generateStructuredData('Service'))
  }
}

export default function PortalPage() {
  return <PortalClient />
}