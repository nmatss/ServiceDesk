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
}) => (
  <div className={`bg-white shadow rounded-lg ${className}`}>
    {(title || headerAction) && (
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {title && (
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          )}
          {headerAction && (
            <div className="flex-shrink-0">
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

