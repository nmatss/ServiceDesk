'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'
import { logger } from '@/lib/monitoring/logger';
import {
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
  DocumentIcon,
  DocumentTextIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline'

export interface FileItem {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  formattedSize: string
  icon: string
  isImage: boolean
  uploadedByName: string
  createdAt: string
  isPublic?: boolean
}

interface FileListProps {
  files: FileItem[]
  onFileDeleted?: (fileId: number) => void
  canDelete?: boolean
  showUploader?: boolean
  className?: string
}

export default function FileList({
  files,
  onFileDeleted,
  canDelete = false,
  showUploader = true,
  className = ''
}: FileListProps) {
  const [deletingFiles, setDeletingFiles] = useState<Set<number>>(new Set())

  const getFileIcon = (mimeType: string, isImage: boolean) => {
    if (isImage) return PhotoIcon
    if (mimeType === 'application/pdf') return DocumentTextIcon
    if (mimeType.includes('word') || mimeType.includes('document')) return DocumentIcon
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return DocumentIcon
    if (mimeType.includes('zip') || mimeType.includes('rar')) return ArchiveBoxIcon
    return DocumentIcon
  }

  const handleDelete = async (fileId: number, filename: string) => {
    if (!canDelete) return

    if (!confirm(`Tem certeza que deseja excluir o arquivo "${filename}"?`)) {
      return
    }

    setDeletingFiles(prev => new Set(prev).add(fileId))

    try {
      const file = files.find(f => f.id === fileId)
      if (!file) return

      const response = await fetch(`/api/files/${encodeURIComponent(file.url.replace('/api/files/', ''))}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao excluir arquivo')
      }

      toast.success('Arquivo excluído com sucesso')
      if (onFileDeleted) {
        onFileDeleted(fileId)
      }
    } catch (error) {
      logger.error('Delete error', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir arquivo')
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
    }
  }

  const handleView = (file: FileItem) => {
    window.open(file.url, '_blank')
  }

  const handleDownload = (file: FileItem) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (files.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p>Nenhum arquivo encontrado</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {files.map((file) => {
        const IconComponent = getFileIcon(file.mimeType, file.isImage)
        const isDeleting = deletingFiles.has(file.id)

        return (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {file.isImage ? (
                  <img
                    src={file.url}
                    alt={file.originalName}
                    className="w-10 h-10 object-cover rounded border"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded border">
                    <IconComponent className="w-6 h-6 text-gray-600" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalName}
                  </p>
                  {file.isPublic && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Público
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                  <span>{file.formattedSize}</span>
                  {showUploader && file.uploadedByName && (
                    <span>Por: {file.uploadedByName}</span>
                  )}
                  <span>{formatDate(file.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleView(file)}
                className="text-blue-600 hover:text-blue-800"
              >
                <EyeIcon className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(file)}
                className="text-green-600 hover:text-green-800"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </Button>

              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(file.id, file.originalName)}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}