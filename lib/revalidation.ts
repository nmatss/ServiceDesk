import { revalidateTag, revalidatePath } from 'next/cache'

/**
 * Revalidation utilities for on-demand ISR cache invalidation
 * Use these functions in API routes after data mutations
 */

// Knowledge Base
export async function revalidateKnowledge() {
  revalidateTag('knowledge-articles')
  revalidatePath('/portal/knowledge')
}

export async function revalidateKnowledgeArticle(slug: string) {
  revalidateTag(`knowledge-article-${slug}`)
  revalidatePath(`/portal/knowledge/${slug}`)
}

// Service Catalog
export async function revalidateCatalog() {
  revalidateTag('catalog-items')
  revalidatePath('/portal/catalog')
}

export async function revalidateCatalogItem(slug: string) {
  revalidateTag(`catalog-item-${slug}`)
  revalidatePath(`/portal/catalog/${slug}`)
}

// Services
export async function revalidateServices() {
  revalidateTag('services')
  revalidatePath('/portal/services')
}

// Dashboard
export async function revalidateDashboard() {
  revalidateTag('dashboard-stats')
  revalidatePath('/admin')
}

// Analytics
export async function revalidateAnalytics() {
  revalidateTag('analytics-data')
  revalidatePath('/analytics')
}

// Reports
export async function revalidateReports() {
  revalidateTag('reports-data')
  revalidatePath('/reports')
}

// Settings
export async function revalidateSettings() {
  revalidateTag('settings')
  revalidatePath('/admin/settings')
}

// Tickets - for real-time updates
export async function revalidateTickets() {
  revalidateTag('tickets-list')
  revalidatePath('/admin/tickets')
  revalidatePath('/portal/tickets')
}

export async function revalidateTicket(id: string) {
  revalidateTag(`ticket-${id}`)
  revalidatePath(`/tickets/${id}`)
  revalidatePath(`/portal/tickets/${id}`)
}

// Users
export async function revalidateUsers() {
  revalidateTag('users-list')
  revalidatePath('/admin/users')
}

// Global revalidation for major updates
export async function revalidateAll() {
  revalidateTag('knowledge-articles')
  revalidateTag('catalog-items')
  revalidateTag('services')
  revalidateTag('dashboard-stats')
  revalidateTag('analytics-data')
  revalidateTag('reports-data')
  revalidateTag('settings')
  revalidateTag('tickets-list')
  revalidateTag('users-list')
}
