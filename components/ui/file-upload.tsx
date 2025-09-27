'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'react-hot-toast'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline'

export interface UploadedFile {
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
}

interface FileUploadProps {
  onFileUploaded?: (file: UploadedFile) => void
  onFilesUploaded?: (files: UploadedFile[]) => void
  entityType?: string
  entityId?: number
  isPublic?: boolean
  multiple?: boolean
  maxSize?: number // in MB
  acceptedTypes?: string[]
  className?: string
  disabled?: boolean
}

export default function FileUpload({
  onFileUploaded,
  onFilesUploaded,
  entityType,
  entityId,
  isPublic = false,
  multiple = false,
  maxSize = 10,
  acceptedTypes = [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ],
  className = '',
  disabled = false
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${maxSize}MB`
      }
    }

    // Check file type
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })

    if (!isValidType) {
      return {
        valid: false,
        error: 'Tipo de arquivo não permitido'
      }
    }

    return { valid: true }
  }

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData()
    formData.append('file', file)

    if (entityType) formData.append('entityType', entityType)
    if (entityId) formData.append('entityId', entityId.toString())
    if (isPublic) formData.append('isPublic', 'true')

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro no upload')
    }

    const result = await response.json()
    return result.file
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled || uploading) return

    const fileArray = Array.from(files)

    // Validate all files first
    for (const file of fileArray) {
      const validation = validateFile(file)
      if (!validation.valid) {
        toast.error(validation.error!)
        return
      }
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const uploadedFiles: UploadedFile[] = []

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]

        try {
          const uploadedFile = await uploadFile(file)
          uploadedFiles.push(uploadedFile)

          // Update progress
          setUploadProgress(((i + 1) / fileArray.length) * 100)

          // Call individual callback if provided
          if (onFileUploaded) {
            onFileUploaded(uploadedFile)
          }

          toast.success(`${file.name} enviado com sucesso`)
        } catch (error) {
          console.error('Upload error:', error)
          toast.error(`Erro ao enviar ${file.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
      }

      // Call batch callback if provided
      if (onFilesUploaded && uploadedFiles.length > 0) {
        onFilesUploaded(uploadedFiles)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Erro no upload dos arquivos')
    } finally {
      setUploading(false)
      setUploadProgress(0)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [disabled, uploading, entityType, entityId, isPublic, onFileUploaded, onFilesUploaded, maxSize, acceptedTypes])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const getFileTypeIcon = (type: string) => {
    if (type.startsWith('image/')) return PhotoIcon
    if (type === 'application/pdf') return DocumentTextIcon
    if (type.includes('word') || type.includes('document')) return DocumentIcon
    if (type.includes('excel') || type.includes('spreadsheet')) return DocumentIcon
    if (type.includes('zip') || type.includes('rar')) return ArchiveBoxIcon
    return DocumentIcon
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />

        <div className="text-center">
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              {uploading ? 'Enviando...' : 'Clique para selecionar ou arraste arquivos aqui'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tamanho máximo: {maxSize}MB
              {multiple && ' • Múltiplos arquivos permitidos'}
            </p>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-gray-500 mt-1 text-center">
              {Math.round(uploadProgress)}% concluído
            </p>
          </div>
        )}
      </div>

      {/* File Type Info */}
      <div className="text-xs text-gray-500">
        <p className="font-medium mb-1">Tipos de arquivo permitidos:</p>
        <div className="flex flex-wrap gap-2">
          {acceptedTypes.includes('image/*') && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              <PhotoIcon className="w-3 h-3 mr-1" />
              Imagens
            </span>
          )}
          {acceptedTypes.includes('application/pdf') && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
              <DocumentTextIcon className="w-3 h-3 mr-1" />
              PDF
            </span>
          )}
          {(acceptedTypes.includes('application/msword') ||
            acceptedTypes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
              <DocumentIcon className="w-3 h-3 mr-1" />
              Word
            </span>
          )}
          {(acceptedTypes.includes('application/vnd.ms-excel') ||
            acceptedTypes.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              <DocumentIcon className="w-3 h-3 mr-1" />
              Excel
            </span>
          )}
          {acceptedTypes.includes('text/plain') && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
              <DocumentTextIcon className="w-3 h-3 mr-1" />
              Texto
            </span>
          )}
        </div>
      </div>
    </div>
  )
}