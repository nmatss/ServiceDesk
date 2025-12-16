'use client'

import { useState, useEffect } from 'react'

export interface BatteryStatus {
  level: number // 0 to 1
  charging: boolean
  chargingTime: number // seconds until fully charged, Infinity if not charging
  dischargingTime: number // seconds until empty, Infinity if charging
}

/**
 * Hook to monitor battery status
 */
export function useBattery(): BatteryStatus | null {
  const [battery, setBattery] = useState<BatteryStatus | null>(null)

  useEffect(() => {
    let batteryManager: any = null

    const updateBatteryStatus = (bm: any) => {
      setBattery({
        level: bm.level,
        charging: bm.charging,
        chargingTime: bm.chargingTime,
        dischargingTime: bm.dischargingTime
      })
    }

    // Store function references to ensure proper cleanup
    const handleLevelChange = () => batteryManager && updateBatteryStatus(batteryManager)
    const handleChargingChange = () => batteryManager && updateBatteryStatus(batteryManager)
    const handleChargingTimeChange = () => batteryManager && updateBatteryStatus(batteryManager)
    const handleDischargingTimeChange = () => batteryManager && updateBatteryStatus(batteryManager)

    const getBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          batteryManager = await (navigator as any).getBattery()
          updateBatteryStatus(batteryManager)

          // Add event listeners with named function references
          batteryManager.addEventListener('levelchange', handleLevelChange)
          batteryManager.addEventListener('chargingchange', handleChargingChange)
          batteryManager.addEventListener('chargingtimechange', handleChargingTimeChange)
          batteryManager.addEventListener('dischargingtimechange', handleDischargingTimeChange)
        } catch (error) {
          console.error('Battery API error:', error)
        }
      }
    }

    getBattery()

    return () => {
      if (batteryManager) {
        // Remove event listeners using the same function references
        batteryManager.removeEventListener('levelchange', handleLevelChange)
        batteryManager.removeEventListener('chargingchange', handleChargingChange)
        batteryManager.removeEventListener('chargingtimechange', handleChargingTimeChange)
        batteryManager.removeEventListener('dischargingtimechange', handleDischargingTimeChange)
      }
    }
  }, [])

  return battery
}

/**
 * Check if battery is low (below 20%)
 */
export function useIsLowBattery(): boolean {
  const battery = useBattery()
  return battery ? battery.level < 0.2 && !battery.charging : false
}

/**
 * Check if battery is charging
 */
export function useIsCharging(): boolean {
  const battery = useBattery()
  return battery?.charging || false
}

/**
 * Get battery level percentage
 */
export function useBatteryLevel(): number {
  const battery = useBattery()
  return battery ? Math.round(battery.level * 100) : 100
}

/**
 * Check if device should enable power saving mode
 */
export function useShouldSavePower(): boolean {
  const battery = useBattery()

  if (!battery) return false

  // Enable power saving if battery is low and not charging
  return battery.level < 0.15 && !battery.charging
}
