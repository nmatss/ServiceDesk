'use client'

import React, { useId } from 'react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select'
  placeholder?: string
  error?: string
  required?: boolean
  helpText?: string
  disabled?: boolean
  value?: string | number
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  children?: React.ReactNode
  className?: string
  rows?: number
}

const baseInputClasses =
  'w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all'

const errorInputClasses =
  'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'

const disabledInputClasses =
  'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900'

export function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  error,
  required,
  helpText,
  disabled,
  value,
  onChange,
  children,
  className,
  rows = 4,
}: FormFieldProps) {
  const autoId = useId()
  const fieldId = `${name}-${autoId}`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`

  const inputClasses = cn(
    baseInputClasses,
    error && errorInputClasses,
    disabled && disabledInputClasses,
    type === 'textarea' && 'resize-none',
    className
  )

  const describedBy = [
    error ? errorId : null,
    helpText ? helpId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined

  const sharedProps = {
    id: fieldId,
    name,
    disabled,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': describedBy,
  }

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
      >
        {label}
        {required && <span className="text-red-600 dark:text-red-400 ml-0.5">*</span>}
      </label>

      {type === 'select' ? (
        <select
          {...sharedProps}
          value={value ?? ''}
          onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
          className={inputClasses}
        >
          {children}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          {...sharedProps}
          value={value ?? ''}
          onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
          placeholder={placeholder}
          required={required}
          rows={rows}
          className={inputClasses}
        />
      ) : (
        <input
          {...sharedProps}
          type={type}
          value={value ?? ''}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          placeholder={placeholder}
          required={required}
          className={inputClasses}
        />
      )}

      {helpText && !error && (
        <p id={helpId} className="text-xs text-muted-content mt-2">
          {helpText}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400 mt-1.5" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
