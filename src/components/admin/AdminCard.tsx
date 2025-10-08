import React from 'react'

interface AdminCardProps {
  title?: string
  children: React.ReactNode
  className?: string
  headerAction?: React.ReactNode
}

export const AdminCard: React.FC<AdminCardProps> = ({
  title,
  children,
  className = '',
  headerAction
}) => {
  const headerId = title ? `card-header-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined

  return (
    <div
      className={`bg-white shadow rounded-lg ${className}`}
      role="region"
      aria-labelledby={headerId}
    >
      {(title || headerAction) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {title && (
              <h3
                id={headerId}
                className="text-lg font-medium text-gray-900"
              >
                {title}
              </h3>
            )}
            {headerAction && (
              <div
                className="flex-shrink-0"
                role="toolbar"
                aria-label="Ações do card"
              >
                {headerAction}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

