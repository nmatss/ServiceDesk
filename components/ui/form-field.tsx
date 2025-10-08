'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { Spinner } from './spinner'

interface FormFieldProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  validate?: (value: string) => Promise<string | null> | string | null
  className?: string
  autoComplete?: string
  rows?: number
}

export function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required,
  disabled,
  validate,
  className,
  autoComplete,
  rows,
}: FormFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [touched, setTouched] = useState(false)

  const displayError = error || localError
  const showSuccess = touched && !displayError && !isValidating && value && isValid

  const handleBlur = async () => {
    setTouched(true)

    if (validate && value) {
      setIsValidating(true)
      try {
        const result = await validate(value)
        setLocalError(result)
        setIsValid(!result)
      } catch (err) {
        setLocalError('Erro ao validar campo')
        setIsValid(false)
      } finally {
        setIsValidating(false)
      }
    }

    onBlur?.()
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
    if (touched) {
      setLocalError(null)
      setIsValid(false)
    }
  }

  const inputClasses = cn(
    'w-full px-4 py-2.5 text-base border rounded-lg',
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
    'placeholder-gray-500 dark:placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'transition-all duration-200 ease-out',
    displayError && touched
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
      : showSuccess
      ? 'border-green-500 focus:border-green-500 focus:ring-green-500/50'
      : isValidating
      ? 'border-blue-500 focus:border-blue-500 focus:ring-blue-500/50'
      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/50',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900',
    className
  )

  const InputElement = type === 'textarea' ? 'textarea' : 'input'

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <InputElement
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          rows={rows}
          className={inputClasses}
          aria-invalid={!!displayError}
          aria-describedby={
            displayError ? `${name}-error` : helperText ? `${name}-helper` : undefined
          }
        />

        {/* Status Icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {isValidating && <Spinner size="sm" color="primary" />}
          {showSuccess && (
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          )}
          {displayError && touched && (
            <XCircleIcon className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>

      {/* Helper Text */}
      {helperText && !displayError && (
        <p id={`${name}-helper`} className="text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

      {/* Error Message */}
      {displayError && touched && (
        <p
          id={`${name}-error`}
          className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          role="alert"
        >
          <XCircleIcon className="w-4 h-4 flex-shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  )
}

// Simple validation helpers
export const validators = {
  required: (message = 'Este campo é obrigatório') => (value: string) => {
    return value.trim() ? null : message
  },

  email: (message = 'Email inválido') => (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? null : message
  },

  minLength: (min: number, message?: string) => (value: string) => {
    return value.length >= min
      ? null
      : message || `Mínimo de ${min} caracteres`
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    return value.length <= max
      ? null
      : message || `Máximo de ${max} caracteres`
  },

  password: (message = 'Senha deve ter pelo menos 8 caracteres, 1 maiúscula e 1 número') => (
    value: string
  ) => {
    const hasMinLength = value.length >= 8
    const hasUpperCase = /[A-Z]/.test(value)
    const hasNumber = /[0-9]/.test(value)
    return hasMinLength && hasUpperCase && hasNumber ? null : message
  },

  match: (otherValue: string, message = 'Os valores não coincidem') => (value: string) => {
    return value === otherValue ? null : message
  },

  combine: (...validators: Array<(value: string) => string | null>) => (value: string) => {
    for (const validator of validators) {
      const error = validator(value)
      if (error) return error
    }
    return null
  },
}
