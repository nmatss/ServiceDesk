import { Suspense } from 'react'
import { Metadata } from 'next'
import KnowledgePageClient from './knowledge-client'

interface KnowledgeArticle {
  id: number
  title: string
  slug?: string
  excerpt: string
  category: string
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  authorName: string
  featured: boolean
}

interface Category {
  name: string
  count: number
}

interface KnowledgeData {
  articles: KnowledgeArticle[]
  categories: Category[]
}

export const metadata: Metadata = {
  title: 'Base de Conhecimento | ServiceDesk',
  description: 'Encontre respostas para suas dúvidas em nossa base de conhecimento',
}

async function getKnowledgeData(): Promise<KnowledgeData> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const [articlesRes, categoriesRes] = await Promise.all([
      fetch(`${baseUrl}/api/knowledge/articles`, {
        next: {
          revalidate: 300, // 5 minutes
          tags: ['knowledge-articles']
        }
      }),
      fetch(`${baseUrl}/api/knowledge/categories`, {
        next: {
          revalidate: 600, // 10 minutes
          tags: ['knowledge-categories']
        }
      })
    ])

    const articlesData = articlesRes.ok ? await articlesRes.json() : { success: false, articles: [] }
    const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { success: false, categories: [] }

    return {
      articles: articlesData.success ? articlesData.articles : [],
      categories: categoriesData.success ? categoriesData.categories : []
    }
  } catch (error) {
    console.error('Error fetching knowledge data:', error)
    return {
      articles: [],
      categories: []
    }
  }
}

export default async function KnowledgeBasePage() {
  const data = await getKnowledgeData()

  return (
    <Suspense fallback={<KnowledgeLoadingSkeleton />}>
      <KnowledgePageClient initialData={data} />
    </Suspense>
  )
}

function KnowledgeLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100">
      <div className="glass-panel shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-neutral-200 rounded animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse"></div>
              <div className="h-4 w-64 bg-neutral-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="glass-panel rounded-lg p-6">
              <div className="h-5 w-24 bg-neutral-200 rounded mb-4 animate-pulse"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-neutral-200 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-8">
              <div className="h-12 bg-neutral-200 rounded-lg animate-pulse"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-panel p-6 rounded-lg">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-neutral-200 rounded w-3/4"></div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}