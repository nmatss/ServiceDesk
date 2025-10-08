'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { CameraIcon, PhotoIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { BottomSheet } from './BottomSheet'

export interface CapturedImage {
  file: File
  preview: string
  type: 'camera' | 'gallery'
  timestamp: number
}

export interface ImageCaptureProps {
  onCapture: (images: CapturedImage[]) => void
  onError?: (error: string) => void
  maxFiles?: number
  maxSize?: number // in MB
  acceptedTypes?: string[]
  quality?: number // 0-1 for compression
  showPreview?: boolean
  multiple?: boolean
  children?: React.ReactNode
}

export const ImageCapture: React.FC<ImageCaptureProps> = ({
  onCapture,
  onError,
  maxFiles = 5,
  maxSize = 10,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  quality = 0.8,
  showPreview = true,
  multiple = true,
  children
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check if device supports camera
  const [cameraSupported, setCameraSupported] = useState(false)

  useEffect(() => {
    const checkCameraSupport = () => {
      setCameraSupported(
        'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
      )
    }

    checkCameraSupport()
  }, [])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const compressImage = useCallback((file: File, quality: number): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions to maintain aspect ratio
        const maxWidth = 1920
        const maxHeight = 1080
        let { width, height } = img

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        }, 'image/jpeg', quality)
      }

      img.src = URL.createObjectURL(file)
    })
  }, [])

  const validateFile = useCallback((file: File): boolean => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      onError?.(`Tipo de arquivo não suportado: ${file.type}`)
      return false
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSize) {
      onError?.(`Arquivo muito grande: ${fileSizeMB.toFixed(1)}MB (máximo: ${maxSize}MB)`)
      return false
    }

    return true
  }, [acceptedTypes, maxSize, onError])

  const processFile = useCallback(async (file: File, type: 'camera' | 'gallery'): Promise<CapturedImage | null> => {
    if (!validateFile(file)) return null

    try {
      const compressedFile = await compressImage(file, quality)
      const preview = URL.createObjectURL(compressedFile)

      return {
        file: compressedFile,
        preview,
        type,
        timestamp: Date.now()
      }
    } catch (error) {
      onError?.('Erro ao processar imagem')
      return null
    }
  }, [validateFile, compressImage, quality, onError])

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      onError?.('Câmera não suportada neste dispositivo')
      return
    }

    try {
      setIsCapturing(true)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
    } catch (error) {
      onError?.('Erro ao acessar câmera')
      setIsCapturing(false)
    }
  }, [cameraSupported, onError])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCapturing(false)
  }, [stream])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `camera_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        })

        const capturedImage = await processFile(file, 'camera')
        if (capturedImage) {
          setCapturedImages(prev => [...prev, capturedImage])
        }
      }
    }, 'image/jpeg', quality)

    stopCamera()
  }, [processFile, quality, stopCamera])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    if (files.length === 0) return

    if (capturedImages.length + files.length > maxFiles) {
      onError?.(`Máximo de ${maxFiles} arquivos permitidos`)
      return
    }

    const processedImages: CapturedImage[] = []

    for (const file of files) {
      const processed = await processFile(file, 'gallery')
      if (processed) {
        processedImages.push(processed)
      }
    }

    setCapturedImages(prev => [...prev, ...processedImages])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [capturedImages.length, maxFiles, onError, processFile])

  const removeImage = useCallback((index: number) => {
    setCapturedImages(prev => {
      const newImages = [...prev]
      const removed = newImages.splice(index, 1)[0]
      URL.revokeObjectURL(removed.preview)
      return newImages
    })
  }, [])

  const handleConfirm = useCallback(() => {
    onCapture(capturedImages)
    setCapturedImages([])
    setIsSheetOpen(false)
  }, [capturedImages, onCapture])

  const handleCancel = useCallback(() => {
    // Cleanup object URLs
    capturedImages.forEach(img => URL.revokeObjectURL(img.preview))
    setCapturedImages([])
    stopCamera()
    setIsSheetOpen(false)
  }, [capturedImages, stopCamera])

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setIsSheetOpen(true)}>
        {children || (
          <button className="btn btn-secondary flex items-center space-x-2">
            <PhotoIcon className="h-5 w-5" />
            <span>Adicionar Imagem</span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={handleCancel}
        title="Capturar Imagem"
        snapPoints={[70, 90]}
        initialSnapPoint={1}
      >
        <div className="flex flex-col h-full">
          {/* Camera View */}
          {isCapturing && (
            <div className="relative flex-1 bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Controls */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-6">
                <button
                  onClick={stopCamera}
                  className="p-3 bg-neutral-800/80 text-white rounded-full"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="p-4 bg-white rounded-full shadow-lg"
                >
                  <div className="w-8 h-8 bg-neutral-800 rounded-full" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isCapturing && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {cameraSupported && (
                  <button
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-brand-400 transition-colors"
                  >
                    <CameraIcon className="h-8 w-8 text-neutral-500 mb-2" />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Câmera
                    </span>
                  </button>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-brand-400 transition-colors"
                >
                  <PhotoIcon className="h-8 w-8 text-neutral-500 mb-2" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Galeria
                  </span>
                </button>
              </div>

              {/* Preview Images */}
              {showPreview && capturedImages.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Imagens Selecionadas ({capturedImages.length}/{maxFiles})
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    {capturedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image.preview}
                          alt={`Captured ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 p-1 bg-error-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {capturedImages.length > 0 && (
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 btn btn-primary"
                  >
                    Confirmar ({capturedImages.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  )
}

// Hook for handling image capture state
export const useImageCapture = () => {
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])

  const addImages = useCallback((images: CapturedImage[]) => {
    setCapturedImages(prev => [...prev, ...images])
  }, [])

  const removeImage = useCallback((index: number) => {
    setCapturedImages(prev => {
      const newImages = [...prev]
      const removed = newImages.splice(index, 1)[0]
      URL.revokeObjectURL(removed.preview)
      return newImages
    })
  }, [])

  const clearImages = useCallback(() => {
    capturedImages.forEach(img => URL.revokeObjectURL(img.preview))
    setCapturedImages([])
  }, [capturedImages])

  return {
    capturedImages,
    addImages,
    removeImage,
    clearImages
  }
}