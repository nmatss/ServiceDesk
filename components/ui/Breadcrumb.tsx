import React from 'react'
import Link from 'next/link'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center space-x-2 text-xs sm:text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRightIcon
                className="h-4 w-4 text-neutral-400 dark:text-neutral-600 mx-2"
                aria-hidden="true"
              />
            )}

            {item.href ? (
              <Link
                href={item.href}
                className="text-description hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center"
              >
                {item.icon && <item.icon className="h-4 w-4 mr-1" />}
                {item.label}
              </Link>
            ) : (
              <span className="text-neutral-900 dark:text-neutral-100 font-medium flex items-center">
                {item.icon && <item.icon className="h-4 w-4 mr-1" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumb
