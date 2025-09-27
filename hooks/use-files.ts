'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'

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
  entityType?: string
  entityId?: number
}

interface UseFilesOptions {
  entityType?: string
  entityId?: number
  autoLoad?: boolean
}

interface FilesPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function useFiles(options: UseFilesOptions = {}) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<FilesPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const { entityType, entityId, autoLoad = true } = options

  const loadFiles = useCallback(async (page = 1, limit = 20) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (entityType) params.append('entityType', entityType)
      if (entityId) params.append('entityId', entityId.toString())

      const response = await fetch(`/api/files/upload?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar arquivos')
      }

      const data = await response.json()
      setFiles(data.files || [])
      setPagination(data.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar arquivos'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  const addFile = useCallback((newFile: FileItem) => {
    setFiles(prev => [newFile, ...prev])
    setPagination(prev => ({
      ...prev,
      total: prev.total + 1
    }))
  }, [])

  const removeFile = useCallback((fileId: number) => {
    setFiles(prev => prev.filter(file => file.id !== fileId))
    setPagination(prev => ({
      ...prev,
      total: Math.max(0, prev.total - 1)
    }))
  }, [])

  const updateFile = useCallback((fileId: number, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(file =>
      file.id === fileId ? { ...file, ...updates } : file
    ))
  }, [])

  const refreshFiles = useCallback(() => {
    loadFiles(pagination.page, pagination.limit)
  }, [loadFiles, pagination.page, pagination.limit])

  const loadPage = useCallback((page: number) => {
    loadFiles(page, pagination.limit)
  }, [loadFiles, pagination.limit])

  const changePageSize = useCallback((limit: number) => {
    loadFiles(1, limit)
  }, [loadFiles])

  // Auto-load files on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadFiles()
    }
  }, [autoLoad, loadFiles])

  return {
    files,
    loading,
    error,
    pagination,
    loadFiles,
    addFile,
    removeFile,
    updateFile,
    refreshFiles,
    loadPage,
    changePageSize
  }
}