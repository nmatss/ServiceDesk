import { Metadata } from 'next'
import CatalogClient from './catalog-client'

export const metadata: Metadata = {
  title: 'Catálogo de Serviços | ServiceDesk',
  description: 'Encontre e solicite os serviços que você precisa',
}

// ISR Configuration - Revalidate every 5 minutes (catalog data changes infrequently)
export const revalidate = 300

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/catalog`, {
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
