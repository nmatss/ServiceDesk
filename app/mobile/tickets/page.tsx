'use client'

import React, { useState, useCallback } from 'react'
import { SwipeableCard } from '@/src/components/mobile/SwipeableCard'
import { PullToRefresh } from '@/src/components/mobile/PullToRefresh'
import { InfiniteScroll } from '@/src/components/mobile/InfiniteScroll'
import { MobileNav } from '@/src/components/mobile/MobileNav'
import {
  ArchiveBoxIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Ticket {
  id: number
  subject: string
  status: string
  priority: string
  created_at: string
  description?: string
}

export default function MobileTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: 1,
      subject: 'Login issue on mobile app',
      status: 'open',
      priority: 'high',
      created_at: '2024-01-15T10:30:00Z',
      description: 'Unable to login using mobile credentials'
    },
    {
      id: 2,
      subject: 'Password reset not working',
      status: 'in-progress',
      priority: 'medium',
      created_at: '2024-01-14T14:20:00Z',
      description: 'Reset link expires immediately'
    },
    {
      id: 3,
      subject: 'Feature request: Dark mode',
      status: 'open',
      priority: 'low',
      created_at: '2024-01-13T09:15:00Z',
      description: 'Would love to have a dark mode option'
    }
  ])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = useCallback(async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
  }, [])

  const handleLoadMore = useCallback(async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
    setHasMore(false)
  }, [])

  const handleArchive = useCallback((ticketId: number) => {
    setTickets(prev => prev.filter(t => t.id !== ticketId))
  }, [])

  const handleDelete = useCallback((ticketId: number) => {
    setTickets(prev => prev.filter(t => t.id !== ticketId))
  }, [])

  const handleResolve = useCallback((ticketId: number) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, status: 'resolved' } : t
    ))
  }, [])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-priority-critical bg-priority-critical/10 dark:bg-priority-critical/20'
      case 'high': return 'text-priority-high bg-priority-high/10 dark:bg-priority-high/20'
      case 'medium': return 'text-priority-medium bg-priority-medium/10 dark:bg-priority-medium/20'
      case 'low': return 'text-priority-low bg-priority-low/10 dark:bg-priority-low/20'
      default: return 'text-description bg-neutral-50 dark:bg-neutral-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-status-open bg-status-open/10 dark:bg-status-open/20'
      case 'in-progress': return 'text-status-progress bg-status-progress/10 dark:bg-status-progress/20'
      case 'resolved': return 'text-status-resolved bg-status-resolved/10 dark:bg-status-resolved/20'
      case 'closed': return 'text-description bg-neutral-50 dark:bg-neutral-800'
      default: return 'text-description bg-neutral-50 dark:bg-neutral-800'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            My Tickets
          </h1>
          <p className="text-sm text-description mt-1">
            {tickets.length} active tickets
          </p>
        </div>
      </header>

      {/* Tickets List with Pull to Refresh */}
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        <InfiniteScroll
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={handleLoadMore}
          className="px-4 py-4 space-y-3"
        >
          {tickets.map(ticket => (
            <SwipeableCard
              key={ticket.id}
              leftActions={[
                {
                  icon: <CheckCircleIcon className="w-6 h-6" />,
                  label: 'Resolve',
                  onClick: () => handleResolve(ticket.id),
                  color: 'success'
                },
                {
                  icon: <ArchiveBoxIcon className="w-6 h-6" />,
                  label: 'Archive',
                  onClick: () => handleArchive(ticket.id),
                  color: 'primary'
                }
              ]}
              rightActions={[
                {
                  icon: <TrashIcon className="w-6 h-6" />,
                  label: 'Delete',
                  onClick: () => handleDelete(ticket.id),
                  color: 'danger'
                }
              ]}
              className="rounded-lg overflow-hidden shadow-sm"
            >
              <div className="p-4 glass-panel border border-neutral-200 dark:border-neutral-700 rounded-lg transition-all hover:shadow-md">
                {/* Ticket Header */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex-1 pr-2">
                    {ticket.subject}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)} animate-fade-in`}>
                    {ticket.priority}
                  </span>
                </div>

                {/* Ticket Meta */}
                <div className="flex items-center space-x-3 text-sm text-description mb-2 flex-wrap gap-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-4 h-4" />
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Ticket Description */}
                {ticket.description && (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
                    {ticket.description}
                  </p>
                )}
              </div>
            </SwipeableCard>
          ))}
        </InfiniteScroll>
      </PullToRefresh>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  )
}
