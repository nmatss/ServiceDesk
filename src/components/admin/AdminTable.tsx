'use client'

import React from 'react'

interface AdminTableColumn {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

interface AdminTableProps {
  columns: AdminTableColumn[]
  data: any[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: any) => void
  className?: string
}

export const AdminTable: React.FC<AdminTableProps> = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'Nenhum dado encontrado',
  onRowClick,
  className = ''
}) => {
  if (loading) {
    return (
      <div className={`bg-white shadow rounded-lg ${className}`}>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                {columns.map((_, j) => (
                  <div key={j} className="flex-1">
                    <div className="h-4 bg-neutral-200 rounded"></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white shadow rounded-lg ${className}`}>
        <div className="p-6 text-center">
          <p className="text-neutral-500">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white shadow rounded-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {data.map((row, index) => (
              <tr
                key={index}
                className={onRowClick ? 'hover:bg-neutral-50 cursor-pointer' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                    {column.render 
                      ? column.render(row[column.key], row)
                      : row[column.key]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

