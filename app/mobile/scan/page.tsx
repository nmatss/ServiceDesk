'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileNav } from '@/src/components/mobile/MobileNav'
import {
  XMarkIcon,
  QrCodeIcon,
  LightBulbIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function MobileScanPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scannedData, setScannedData] = useState<string | null>(null)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()
    }
  }, [facingMode])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setHasPermission(true)
      }

      // Start scanning
      scanQRCode()
    } catch (error) {
      console.error('Camera access error:', error)
      setHasPermission(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const toggleTorch = async () => {
    if (!streamRef.current) return

    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    const capabilities = track.getCapabilities() as any

    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled } as any]
        })
        setTorchEnabled(!torchEnabled)
      } catch (error) {
        console.error('Torch error:', error)
      }
    }
  }

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  const scanQRCode = () => {
    // This is a placeholder - in production, use a library like jsQR or zxing
    // For demonstration, we'll simulate scanning
    setTimeout(() => {
      if (!scannedData) {
        // Simulate QR code detection
        const canvas = canvasRef.current
        const video = videoRef.current

        if (canvas && video) {
          const context = canvas.getContext('2d')
          if (context) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            context.drawImage(video, 0, 0, canvas.width, canvas.height)

            // In production, use jsQR here:
            // const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
            // const code = jsQR(imageData.data, imageData.width, imageData.height)
            // if (code) {
            //   handleScan(code.data)
            // }
          }
        }

        // Continue scanning
        requestAnimationFrame(scanQRCode)
      }
    }, 100)
  }

  /*
  const handleScan = (data: string) => {
    setScannedData(data)

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10])
    }

    // Process scanned data
    console.log('Scanned QR Code:', data)

    // Navigate based on scanned data
    // For example, if it's an asset ID, go to asset details
    setTimeout(() => {
      router.push(`/assets/${data}`)
    }, 1500)
  }
  */

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Requesting camera access...</p>
        </div>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 p-6">
        <QrCodeIcon className="w-24 h-24 text-neutral-600 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Camera Access Denied</h2>
        <p className="text-neutral-400 text-center mb-6">
          Please grant camera permission to scan QR codes
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black pb-20">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-white">
            Scan QR Code
          </h1>
          <button
            onClick={() => router.back()}
            className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Hidden canvas for QR detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

          {/* Scanning line */}
          {!scannedData && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" style={{
              animation: 'scan 2s linear infinite'
            }} />
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-32 left-0 right-0 px-6 text-center">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4">
          <p className="text-white text-sm">
            {scannedData ? 'QR Code Scanned!' : 'Position QR code within the frame'}
          </p>
          {scannedData && (
            <p className="text-blue-400 text-xs mt-2 font-mono">
              {scannedData}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center space-x-4 px-6">
        {/* Toggle Torch */}
        <button
          onClick={toggleTorch}
          className={`p-4 rounded-full transition-colors min-h-[56px] min-w-[56px] ${
            torchEnabled
              ? 'bg-yellow-500 text-white'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          aria-label="Toggle flashlight"
        >
          <LightBulbIcon className="w-6 h-6" />
        </button>

        {/* Switch Camera */}
        <button
          onClick={switchCamera}
          className="p-4 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors min-h-[56px] min-w-[56px]"
          aria-label="Switch camera"
        >
          <ArrowPathIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      <style jsx>{`
        @keyframes scan {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(256px);
          }
        }
      `}</style>
    </div>
  )
}
