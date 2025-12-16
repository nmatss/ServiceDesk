'use client'

import toast, { ToastOptions } from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import { createElement } from 'react'

// ========================================
// ENHANCED TOAST UTILITIES
// ========================================

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface EnhancedToastOptions extends ToastOptions {
  action?: ToastAction
  undo?: () => void
  dismissible?: boolean
}

/**
 * Success toast with optional action button
 */
export function toastSuccess(message: string, options?: EnhancedToastOptions) {
  const { action, undo, dismissible = true, ...restOptions } = options || {}

  return toast.custom(
    (t) =>
      createElement(
        'div',
        {
          className: `${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-green-500`,
        },
        [
          // Content container
          createElement(
            'div',
            { className: 'flex-1 w-0 p-4', key: 'content' },
            createElement(
              'div',
              { className: 'flex items-start' },
              [
                // Icon
                createElement(
                  'div',
                  { className: 'flex-shrink-0', key: 'icon' },
                  createElement(CheckCircleIcon, { className: 'h-6 w-6 text-green-500' })
                ),
                // Message
                createElement(
                  'div',
                  { className: 'ml-3 flex-1', key: 'message' },
                  createElement('p', { className: 'text-sm font-medium text-gray-900 dark:text-white' }, message)
                ),
              ]
            )
          ),
          // Actions
          createElement(
            'div',
            { className: 'flex border-l border-gray-200 dark:border-gray-700', key: 'actions' },
            [
              action &&
                createElement(
                  'button',
                  {
                    key: 'action',
                    onClick: () => {
                      action.onClick()
                      toast.dismiss(t.id)
                    },
                    className:
                      'w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none',
                  },
                  action.label
                ),
              undo &&
                createElement(
                  'button',
                  {
                    key: 'undo',
                    onClick: () => {
                      undo()
                      toast.dismiss(t.id)
                    },
                    className:
                      'w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 focus:outline-none',
                  },
                  'Desfazer'
                ),
              dismissible &&
                createElement(
                  'button',
                  {
                    key: 'dismiss',
                    onClick: () => toast.dismiss(t.id),
                    className:
                      'w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 focus:outline-none',
                  },
                  createElement(
                    'svg',
                    { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    createElement('path', {
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      strokeWidth: 2,
                      d: 'M6 18L18 6M6 6l12 12',
                    })
                  )
                ),
            ]
          ),
        ]
      ),
    { duration: 5000, ...restOptions }
  )
}

/**
 * Error toast with optional retry action
 */
export function toastError(message: string, options?: EnhancedToastOptions) {
  const { action, dismissible = true, ...restOptions } = options || {}

  return toast.custom(
    (t) =>
      createElement(
        'div',
        {
          className: `${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-red-500`,
        },
        [
          createElement(
            'div',
            { className: 'flex-1 w-0 p-4', key: 'content' },
            createElement('div', { className: 'flex items-start' }, [
              createElement(
                'div',
                { className: 'flex-shrink-0', key: 'icon' },
                createElement(XCircleIcon, { className: 'h-6 w-6 text-red-500' })
              ),
              createElement(
                'div',
                { className: 'ml-3 flex-1', key: 'message' },
                createElement('p', { className: 'text-sm font-medium text-gray-900 dark:text-white' }, message)
              ),
            ])
          ),
          createElement('div', { className: 'flex border-l border-gray-200 dark:border-gray-700', key: 'actions' }, [
            action &&
              createElement(
                'button',
                {
                  key: 'action',
                  onClick: () => {
                    action.onClick()
                    toast.dismiss(t.id)
                  },
                  className:
                    'w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none',
                },
                action.label
              ),
            dismissible &&
              createElement(
                'button',
                {
                  key: 'dismiss',
                  onClick: () => toast.dismiss(t.id),
                  className:
                    'w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 focus:outline-none',
                },
                createElement(
                  'svg',
                  { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: 2,
                    d: 'M6 18L18 6M6 6l12 12',
                  })
                )
              ),
          ]),
        ]
      ),
    { duration: 6000, ...restOptions }
  )
}

/**
 * Warning toast
 */
export function toastWarning(message: string, options?: EnhancedToastOptions) {
  const { action, dismissible = true, ...restOptions } = options || {}

  return toast.custom(
    (t) =>
      createElement(
        'div',
        {
          className: `${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-yellow-500`,
        },
        [
          createElement(
            'div',
            { className: 'flex-1 w-0 p-4', key: 'content' },
            createElement('div', { className: 'flex items-start' }, [
              createElement(
                'div',
                { className: 'flex-shrink-0', key: 'icon' },
                createElement(ExclamationTriangleIcon, { className: 'h-6 w-6 text-yellow-500' })
              ),
              createElement(
                'div',
                { className: 'ml-3 flex-1', key: 'message' },
                createElement('p', { className: 'text-sm font-medium text-gray-900 dark:text-white' }, message)
              ),
            ])
          ),
          createElement('div', { className: 'flex border-l border-gray-200 dark:border-gray-700', key: 'actions' }, [
            action &&
              createElement(
                'button',
                {
                  key: 'action',
                  onClick: () => {
                    action.onClick()
                    toast.dismiss(t.id)
                  },
                  className:
                    'w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none',
                },
                action.label
              ),
            dismissible &&
              createElement(
                'button',
                {
                  key: 'dismiss',
                  onClick: () => toast.dismiss(t.id),
                  className:
                    'w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 focus:outline-none',
                },
                createElement(
                  'svg',
                  { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: 2,
                    d: 'M6 18L18 6M6 6l12 12',
                  })
                )
              ),
          ]),
        ]
      ),
    { duration: 5000, ...restOptions }
  )
}

/**
 * Info toast
 */
export function toastInfo(message: string, options?: EnhancedToastOptions) {
  const { action, dismissible = true, ...restOptions } = options || {}

  return toast.custom(
    (t) =>
      createElement(
        'div',
        {
          className: `${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-blue-500`,
        },
        [
          createElement(
            'div',
            { className: 'flex-1 w-0 p-4', key: 'content' },
            createElement('div', { className: 'flex items-start' }, [
              createElement(
                'div',
                { className: 'flex-shrink-0', key: 'icon' },
                createElement(InformationCircleIcon, { className: 'h-6 w-6 text-blue-500' })
              ),
              createElement(
                'div',
                { className: 'ml-3 flex-1', key: 'message' },
                createElement('p', { className: 'text-sm font-medium text-gray-900 dark:text-white' }, message)
              ),
            ])
          ),
          createElement('div', { className: 'flex border-l border-gray-200 dark:border-gray-700', key: 'actions' }, [
            action &&
              createElement(
                'button',
                {
                  key: 'action',
                  onClick: () => {
                    action.onClick()
                    toast.dismiss(t.id)
                  },
                  className:
                    'w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none',
                },
                action.label
              ),
            dismissible &&
              createElement(
                'button',
                {
                  key: 'dismiss',
                  onClick: () => toast.dismiss(t.id),
                  className:
                    'w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 focus:outline-none',
                },
                createElement(
                  'svg',
                  { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: 2,
                    d: 'M6 18L18 6M6 6l12 12',
                  })
                )
              ),
          ]),
        ]
      ),
    { duration: 4000, ...restOptions }
  )
}

/**
 * Promise toast with loading state
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: Error) => string)
  },
  options?: ToastOptions
) {
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
}

/**
 * Undo toast - shows a message with undo action
 */
export function toastUndo(message: string, onUndo: () => void, options?: ToastOptions) {
  return toastSuccess(message, {
    undo: onUndo,
    duration: 8000, // Longer duration for undo
    ...options,
  })
}

/**
 * Action toast - shows a message with custom action
 */
export function toastAction(message: string, actionLabel: string, onAction: () => void, options?: ToastOptions) {
  return toastInfo(message, {
    action: {
      label: actionLabel,
      onClick: onAction,
    },
    ...options,
  })
}

// Export all functions
export const enhancedToast = {
  success: toastSuccess,
  error: toastError,
  warning: toastWarning,
  info: toastInfo,
  promise: toastPromise,
  undo: toastUndo,
  action: toastAction,
  dismiss: toast.dismiss,
  loading: toast.loading,
}

export default enhancedToast
