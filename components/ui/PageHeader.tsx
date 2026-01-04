import React from 'react'
import Link from 'next/link'
import { Button } from './Button'

/**
 * IconComponent type that accepts both regular components and forward refs from Heroicons
 */
type IconComponent = React.ComponentType<{ className?: string }> | React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>

/**
 * Action button configuration for PageHeader
 * @property {string} label - Button label text
 * @property {string} href - Optional link destination
 * @property {function} onClick - Optional click handler
 * @property {IconComponent} icon - Optional icon component
 * @property {string} variant - Button style variant
 * @property {boolean} external - Whether link opens in new tab
 */
interface PageHeaderAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: IconComponent
  variant?: 'primary' | 'secondary' | 'ghost'
  external?: boolean
}

/**
 * Breadcrumb navigation item
 * @property {string} label - Breadcrumb label text
 * @property {string} href - Optional link destination
 * @property {IconComponent} icon - Optional icon component
 */
interface PageHeaderBreadcrumb {
  label: string
  href?: string
  icon?: IconComponent
}

/**
 * Back button configuration
 * @property {string} label - Button label text
 * @property {string} href - Destination URL
 */
interface PageHeaderBackButton {
  label: string
  href: string
}

/**
 * PageHeader component props
 * @property {string} title - Page title
 * @property {string} description - Optional page description
 * @property {PageHeaderAction[]} actions - Optional action buttons
 * @property {PageHeaderBreadcrumb[]} breadcrumbs - Optional breadcrumb navigation
 * @property {IconComponent} icon - Optional header icon
 * @property {PageHeaderBackButton} backButton - Optional back button
 * @property {React.ReactNode} children - Optional additional content
 */
interface PageHeaderProps {
  title: string
  description?: string | React.ReactNode
  actions?: PageHeaderAction[] | React.ReactNode
  breadcrumbs?: PageHeaderBreadcrumb[]
  icon?: IconComponent
  backButton?: PageHeaderBackButton
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  icon: Icon,
  backButton,
  children
}: PageHeaderProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back Button */}
      {backButton && (
        <Link
          href={backButton.href}
          className="inline-flex items-center text-sm text-description hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          aria-label={`Voltar para ${backButton.label}`}
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          {backButton.label}
        </Link>
      )}

      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <svg
                    className="h-4 w-4 text-neutral-400 dark:text-neutral-600 mx-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-description hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-brand rounded-xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {title}
            </h1>
            {description && (
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-description">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          Array.isArray(actions) && actions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              {actions.map((action, index) => {
                if (action.href) {
                  return (
                    <Button
                      key={index}
                      asChild
                      variant={action.variant || 'primary'}
                      leftIcon={action.icon ? <action.icon className="h-5 w-5" aria-hidden="true" /> : undefined}
                    >
                      <Link
                        href={action.href}
                        {...(action.external && {
                          target: '_blank',
                          rel: 'noopener noreferrer'
                        })}
                      >
                        {action.label}
                      </Link>
                    </Button>
                  )
                }

                return (
                  <Button
                    key={index}
                    variant={action.variant || 'primary'}
                    onClick={action.onClick}
                    leftIcon={action.icon ? <action.icon className="h-5 w-5" aria-hidden="true" /> : undefined}
                  >
                    {action.label}
                  </Button>
                )
              })}
            </div>
          ) : (
            <>{actions}</>
          )
        )}
        {children}
      </div>
    </div>
  )
}

export default PageHeader
