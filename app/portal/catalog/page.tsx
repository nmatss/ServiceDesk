import { Metadata } from 'next'
import { headers } from 'next/headers'
import CatalogClient from './catalog-client'

export const metadata: Metadata = {
  title: 'Catálogo de Serviços | ServiceDesk',
  description: 'Encontre e solicite os serviços que você precisa',
}

// Evita pré-render em build, já que os dados são carregados de APIs internas autenticadas.
export const dynamic = 'force-dynamic'

interface ServiceCategory {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  color: string
  item_count: number
}

interface CatalogItem {
  id: number
  name: string
  slug: string
  short_description: string
  description: string
  category_id: number
  category_name: string
  category_color: string
  icon: string
  is_featured: boolean
  is_public: boolean
  estimated_fulfillment_time: number
  cost_type: 'free' | 'fixed' | 'variable' | 'quote'
  base_cost: number
  cost_currency: string
  requires_approval: boolean
  satisfaction_rating: number
  request_count: number
}

interface CatalogData {
  success: boolean
  catalog_items: CatalogItem[]
  categories: ServiceCategory[]
}

async function getCatalogData(): Promise<CatalogData> {
  try {
    const requestHeaders = await headers()
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
    const protocol = requestHeaders.get('x-forwarded-proto') || 'http'
    const baseUrl =
      host
        ? `${protocol}://${host}`
        : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/catalog`, {
      headers: {
        cookie: requestHeaders.get('cookie') || '',
        authorization: requestHeaders.get('authorization') || '',
        'x-tenant-id': requestHeaders.get('x-tenant-id') || '',
        'x-tenant-slug': requestHeaders.get('x-tenant-slug') || '',
        'x-tenant-name': requestHeaders.get('x-tenant-name') || ''
      },
      next: {
        revalidate: 300,
        tags: ['catalog', 'services']
      }
    })

    if (!res.ok) {
      console.error('Failed to fetch catalog data')
      return {
        success: false,
        catalog_items: [],
        categories: []
      }
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        catalog_items: [],
        categories: []
      }
    }

    return res.json()
  } catch (error) {
    console.error('Error fetching catalog:', error)
    return {
      success: false,
      catalog_items: [],
      categories: []
    }
  }
}

export default async function ServiceCatalogPage() {
  const data = await getCatalogData()

  return (
    <CatalogClient
      initialItems={data.catalog_items}
      initialCategories={data.categories}
    />
  )
}
