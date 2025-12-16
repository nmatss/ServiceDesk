/**
 * Web Vitals Reporter Component
 * Client-side component that reports Web Vitals metrics
 */

'use client'

import { useEffect } from 'react'
import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals, initPerformanceMonitoring } from '@/lib/performance/web-vitals'

export default function WebVitalsReporter() {
  // Report Web Vitals using Next.js hook
  useReportWebVitals((metric) => {
    reportWebVitals(metric)
  })

  // Initialize performance monitoring on mount
  useEffect(() => {
    initPerformanceMonitoring()
  }, [])

  return null // This component doesn't render anything
}
