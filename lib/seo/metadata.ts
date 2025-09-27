import { Metadata } from 'next'

interface SEOData {
  title: string
  description: string
  keywords?: string[]
  canonical?: string
  ogImage?: string
  noindex?: boolean
  structured?: any
}

export interface PageSEOConfig {
  title: string
  description: string
  keywords: string[]
  category: 'service' | 'product' | 'support' | 'knowledge' | 'company'
  structured?: any
}

// Base metadata for the application
export const baseMetadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'),
  title: {
    template: '%s | ServiceDesk Pro - Sistema Completo de Atendimento',
    default: 'ServiceDesk Pro - Sistema Completo de Atendimento ao Cliente'
  },
  description: 'Sistema completo de ServiceDesk para gerenciamento de tickets, atendimento ao cliente e suporte técnico. Solução profissional com SLA, relatórios e automação.',
  keywords: [
    'servicedesk',
    'help desk',
    'sistema de tickets',
    'atendimento ao cliente',
    'suporte técnico',
    'gestão de incidentes',
    'ITSM',
    'SLA',
    'automação',
    'relatórios'
  ],
  authors: [{ name: 'ServiceDesk Pro' }],
  creator: 'ServiceDesk Pro',
  publisher: 'ServiceDesk Pro',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'ServiceDesk Pro',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ServiceDesk Pro - Sistema Completo de Atendimento'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@servicedeskpro'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    bing: process.env.BING_VERIFICATION,
  }
}

// Generate metadata for specific pages
export function generatePageMetadata(config: PageSEOConfig): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicedesk.com'

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords.join(', '),
    openGraph: {
      title: config.title,
      description: config.description,
      url: baseUrl,
      siteName: 'ServiceDesk Pro',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: config.title
        }
      ],
      type: 'website',
      locale: 'pt_BR'
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: ['/og-image.png']
    },
    alternates: {
      canonical: baseUrl
    }
  }
}

// SEO configurations for different pages
export const pageSEOConfigs = {
  home: {
    title: 'ServiceDesk Pro - Sistema Completo de Atendimento ao Cliente',
    description: 'Transforme seu atendimento com o ServiceDesk Pro. Sistema completo para gestão de tickets, SLA automático, relatórios avançados e suporte multi-tenant. Aumente a satisfação dos clientes.',
    keywords: [
      'sistema servicedesk',
      'help desk completo',
      'gestão de tickets',
      'atendimento ao cliente',
      'SLA automático',
      'ITSM',
      'suporte técnico',
      'sistema de chamados',
      'automação',
      'relatórios'
    ],
    category: 'service' as const
  },

  portal: {
    title: 'Portal do Cliente - Abra e Acompanhe seus Tickets',
    description: 'Portal do cliente ServiceDesk Pro. Abra tickets, acompanhe o status em tempo real, acesse a base de conhecimento e comunique-se diretamente com nossa equipe de suporte.',
    keywords: [
      'portal do cliente',
      'abrir ticket',
      'acompanhar ticket',
      'suporte online',
      'autoatendimento',
      'base de conhecimento',
      'status do ticket',
      'chat suporte'
    ],
    category: 'service' as const
  },

  knowledge: {
    title: 'Base de Conhecimento - Encontre Respostas Rapidamente',
    description: 'Base de conhecimento completa do ServiceDesk Pro. Encontre respostas, tutoriais, guias e soluções para os problemas mais comuns. Suporte 24/7 ao seu alcance.',
    keywords: [
      'base de conhecimento',
      'FAQ',
      'tutoriais',
      'guias',
      'soluções',
      'autoatendimento',
      'documentação',
      'perguntas frequentes',
      'suporte'
    ],
    category: 'knowledge' as const
  },

  admin: {
    title: 'Painel Administrativo - Gerencie seu ServiceDesk',
    description: 'Painel administrativo completo do ServiceDesk Pro. Gerencie tickets, usuários, relatórios, SLA e configurações. Dashboard com métricas em tempo real.',
    keywords: [
      'painel administrativo',
      'dashboard',
      'gestão de tickets',
      'relatórios',
      'métricas',
      'configurações',
      'usuários',
      'SLA',
      'automação'
    ],
    category: 'service' as const
  },

  tickets: {
    title: 'Gestão de Tickets - Controle Total dos Chamados',
    description: 'Sistema avançado de gestão de tickets do ServiceDesk Pro. Acompanhe, priorize e resolva chamados com eficiência. SLA automático e notificações em tempo real.',
    keywords: [
      'gestão de tickets',
      'chamados',
      'incidentes',
      'requisições',
      'SLA',
      'priorização',
      'workflow',
      'automação',
      'notificações'
    ],
    category: 'service' as const
  }
}

// Generate structured data for different content types
export function generateStructuredData(type: string, data: any = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicedesk.com'

  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ServiceDesk Pro',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Sistema completo de ServiceDesk para atendimento ao cliente',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+55-11-1234-5678',
      contactType: 'customer service',
      availableLanguage: 'Portuguese'
    },
    sameAs: [
      'https://linkedin.com/company/servicedeskpro',
      'https://twitter.com/servicedeskpro'
    ]
  }

  switch (type) {
    case 'SoftwareApplication':
      return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'ServiceDesk Pro',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'Sistema completo de ServiceDesk para gestão de tickets e atendimento ao cliente',
        url: baseUrl,
        screenshot: `${baseUrl}/screenshot.png`,
        softwareVersion: '1.0.0',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'BRL',
          price: '0',
          priceValidUntil: '2024-12-31'
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '150'
        },
        publisher: {
          '@type': 'Organization',
          name: 'ServiceDesk Pro'
        }
      }

    case 'Article':
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title,
        description: data.description,
        author: {
          '@type': 'Organization',
          name: 'ServiceDesk Pro'
        },
        publisher: {
          '@type': 'Organization',
          name: 'ServiceDesk Pro',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/logo.png`
          }
        },
        datePublished: data.publishedAt || new Date().toISOString(),
        dateModified: data.updatedAt || new Date().toISOString(),
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': data.url || baseUrl
        }
      }

    case 'Service':
      return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: data.name || 'ServiceDesk Pro',
        description: data.description || 'Sistema completo de atendimento ao cliente',
        provider: {
          '@type': 'Organization',
          name: 'ServiceDesk Pro'
        },
        serviceType: 'Help Desk Software',
        areaServed: 'BR',
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: baseUrl,
          serviceSmsNumber: '+55-11-1234-5678'
        }
      }

    case 'FAQPage':
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: data.faqs?.map((faq: any) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        })) || []
      }

    default:
      return structuredData
  }
}

// Generate conversational meta descriptions optimized for AI
export function generateConversationalDescription(pageType: string, data: any = {}) {
  const descriptions = {
    service: `Como posso te ajudar com atendimento ao cliente? O ServiceDesk Pro oferece ${data.features || 'gestão completa de tickets, SLA automático e relatórios avançados'}. Ideal para empresas que buscam excelência no suporte.`,

    knowledge: `Procurando respostas sobre ${data.topic || 'suporte técnico'}? Nossa base de conhecimento tem ${data.articleCount || 'centenas de'} artigos com soluções práticas e guias detalhados para resolver seus problemas rapidamente.`,

    portal: `Precisa abrir um ticket ou acompanhar seu chamado? No portal do cliente você pode ${data.features || 'criar tickets, acompanhar status em tempo real e acessar nossa base de conhecimento'}. Suporte disponível 24/7.`,

    admin: `Quer gerenciar seu ServiceDesk com eficiência? O painel administrativo oferece ${data.features || 'dashboard completo, relatórios em tempo real, gestão de SLA e automação de processos'}. Controle total em suas mãos.`
  }

  return descriptions[pageType as keyof typeof descriptions] || descriptions.service
}

export default {
  baseMetadata,
  generatePageMetadata,
  pageSEOConfigs,
  generateStructuredData,
  generateConversationalDescription
}