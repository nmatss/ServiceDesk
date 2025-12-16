'use client'

import { useState, useEffect } from 'react'

export interface NetworkStatus {
  online: boolean
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g'
  downlink?: number
  rtt?: number
  saveData?: boolean
}

/**
 * Hook to track network status and connection quality
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true
  })

  useEffect(() => {
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection

      setStatus({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData
      })
    }

    updateNetworkStatus()

    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    // Listen for connection changes if supported
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection

    if (connection) {
      connection.addEventListener('change', updateNetworkStatus)
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus)
      }
    }
  }, [])

  return status
}

/**
 * Check if user is online
 */
export function useIsOnline(): boolean {
  const status = useNetworkStatus()
  return status.online
}

/**
 * Check if user is offline
 */
export function useIsOffline(): boolean {
  const status = useNetworkStatus()
  return !status.online
}

/**
 * Check if connection is slow
 */
export function useIsSlowConnection(): boolean {
  const status = useNetworkStatus()
  return status.effectiveType === '2g' || status.effectiveType === 'slow-2g'
}

/**
 * Check if user has data saver enabled
 */
export function useDataSaver(): boolean {
  const status = useNetworkStatus()
  return status.saveData || false
}
