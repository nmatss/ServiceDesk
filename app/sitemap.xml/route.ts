import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servicedesk.com'

  try {
    // Get published knowledge articles for sitemap
    const articles = db.prepare(`
      SELECT
        id,
        slug,
        updated_at
      FROM knowledge_articles
      WHERE status = 'published'
      ORDER BY updated_at DESC
    `).all()

    const staticPages = [
      {
        url: baseUrl,
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 1.0
      },
      {
        url: `${baseUrl}/portal`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 0.9
      },
      {
        url: `${baseUrl}/knowledge`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly',
        priority: 0.8
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: 0.5
      },
      {
        url: `${baseUrl}/register`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: 0.5
      }
    ]

    // Add knowledge articles to sitemap
    const articlePages = articles.map((article: any) => ({
      url: `${baseUrl}/knowledge/${article.slug}`,
      lastModified: new Date(article.updated_at).toISOString(),
      changeFrequency: 'weekly',
      priority: 0.7
    }))

    const allPages = [...staticPages, ...articlePages]

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    })
  } catch (error) {
    logger.error('Error generating sitemap', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}