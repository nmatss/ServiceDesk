'use client'

import React, { useState, useEffect } from 'react'
import toast, { Toaster, ToastOptions } from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/solid'

const toastClass = '!bg-white dark:!bg-neutral-800 !text-neutral-900 dark:!text-neutral-100 !shadow-lg !border !border-neutral-200 dark:!border-neutral-700 !rounded-xl'

// Custom toast functions with icons
export const customToast = {
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: 4000,
      icon: <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
      className: toastClass,
      ...options,
    })
  },

  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, {
      duration: 5000,
      icon: <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />,
      className: toastClass,
      ...options,
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4500,
      icon: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />,
      className: toastClass,
      ...options,
    })
  },

  info: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4000,
      icon: <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />,
      className: toastClass,
      ...options,
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: Error) => string)
    },
    options?: ToastOptions
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        className: toastClass,
        ...options,
      }
    )
  },

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      className: toastClass,
      ...options,
    })
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId)
  },
}

// Toaster component — client-only to avoid SSR hydration mismatch
export function ToastProvider() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <Toaster
      position="bottom-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{
        bottom: 20,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--toast-bg, #ffffff)',
          color: 'var(--toast-color, #1f2937)',
          padding: '12px 16px',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          maxWidth: 'calc(100vw - 2rem)',
          width: '100%',
          fontSize: '0.875rem',
          border: '1px solid var(--toast-border, #e5e7eb)',
        },
        success: {
          duration: 4000,
        },
        error: {
          duration: 5000,
        },
      }}
    />
  )
}

// Export both for compatibility
export { toast }
export default customToast
