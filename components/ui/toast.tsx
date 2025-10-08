'use client'

import toast, { Toaster, ToastOptions } from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/solid'

// Custom toast functions with icons
export const customToast = {
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: 4000,
      icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
      ...options,
    })
  },

  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, {
      duration: 5000,
      icon: <XCircleIcon className="w-5 h-5 text-red-500" />,
      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
      ...options,
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4500,
      icon: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />,
      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
      ...options,
    })
  },

  info: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4000,
      icon: <InformationCircleIcon className="w-5 h-5 text-blue-500" />,
      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
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
        className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
        ...options,
      }
    )
  },

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      className: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg',
      ...options,
    })
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId)
  },
}

// Toaster component with customized settings
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'white',
          color: '#1f2937',
          padding: '12px 16px',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px',
        },
        success: {
          duration: 4000,
          style: {
            border: '1px solid #10b981',
          },
        },
        error: {
          duration: 5000,
          style: {
            border: '1px solid #ef4444',
          },
        },
      }}
    />
  )
}

// Export both for compatibility
export { toast }
export default customToast
