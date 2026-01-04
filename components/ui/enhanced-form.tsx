'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ExclamationCircleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

// ========================================
// ENHANCED FORM FIELD
// ========================================
interface EnhancedFormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'textarea'
  value: string
  onChange: (value: string) => void
  validate?: (value: string) => string | null // Returns error message or null
  required?: boolean
  maxLength?: number
  minLength?: number
  showCount?: boolean
  help?: string
  placeholder?: string
  debounceMs?: number
  disabled?: boolean
  className?: string
}

export function EnhancedFormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  validate,
  required = false,
  maxLength,
  minLength: _minLength,
  showCount = false,
  help,
  placeholder,
  debounceMs = 300,
  disabled = false,
  className,
}: EnhancedFormFieldProps) {
  const [error, setError] = useState<string | null>(null)
  const [isTouched, setIsTouched] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  // Debounced validation
  const validateField = useCallback(
    (val: string) => {
      if (!validate) return

      setIsValidating(true)
      const timer = setTimeout(() => {
        const errorMsg = validate(val)
        setError(errorMsg)
        setIsValidating(false)
      }, debounceMs)

      return () => clearTimeout(timer)
    },
    [validate, debounceMs]
  )

  useEffect(() => {
    if (isTouched) {
      validateField(value)
    }
  }, [value, isTouched, validateField])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (maxLength && newValue.length > maxLength) return
    onChange(newValue)
  }

  const handleBlur = () => {
    setIsTouched(true)
    if (validate) {
      setError(validate(value))
    }
  }

  const isError = isTouched && error
  const isValid = isTouched && !error && value.length > 0
  const characterCount = value.length
  const isNearLimit = maxLength && characterCount > maxLength * 0.8

  const inputClasses = cn(
    'input w-full',
    isError
      ? 'input-error'
      : isValid
      ? 'input-success'
      : 'input-bordered',
    disabled && 'input-disabled'
  )

  const InputComponent = type === 'textarea' ? 'textarea' : 'input'

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <div className="flex justify-between items-center">
        <label htmlFor={name} className="label label-text font-medium">
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
        {showCount && maxLength && (
          <span
            className={cn(
              'text-xs',
              isNearLimit ? 'text-warning-600 dark:text-warning-400' : 'text-muted-content'
            )}
          >
            {characterCount}/{maxLength}
          </span>
        )}
      </div>

      {/* Input/Textarea */}
      <div className="relative">
        <InputComponent
          id={name}
          name={name}
          type={type !== 'textarea' ? type : undefined}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={inputClasses}
          rows={type === 'textarea' ? 4 : undefined}
        />

        {/* Status Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isValidating && (
            <svg className="animate-spin h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {!isValidating && isError && <ExclamationCircleIcon className="h-5 w-5 text-error-500" />}
          {!isValidating && isValid && <CheckCircleIcon className="h-5 w-5 text-success-500" />}
        </div>
      </div>

      {/* Help Text or Error */}
      {isError ? (
        <p className="text-sm text-error-600 dark:text-error-400 flex items-start gap-1">
          <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </p>
      ) : help ? (
        <p className="text-sm text-muted-content flex items-start gap-1">
          <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {help}
        </p>
      ) : null}
    </div>
  )
}

// ========================================
// PASSWORD STRENGTH METER
// ========================================
interface PasswordStrengthMeterProps {
  password: string
  className?: string
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const calculateStrength = (pwd: string): number => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/\d/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++
    return strength
  }

  const strength = calculateStrength(password)
  const strengthLabels = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte']
  const strengthColors = ['bg-error-500', 'bg-warning-500', 'bg-warning-500', 'bg-success-500', 'bg-success-600']

  if (!password) return null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              level <= strength ? strengthColors[strength - 1] : 'bg-gray-200 dark:bg-gray-700'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-description">
        Força da senha: <span className="font-medium">{strengthLabels[strength - 1] || 'Muito fraca'}</span>
      </p>
    </div>
  )
}

// ========================================
// AUTO-SAVE FORM
// ========================================
interface AutoSaveFormProps {
  children: ReactNode
  onSave: (data: any) => Promise<void>
  data: any
  debounceMs?: number
  className?: string
}

export function AutoSaveForm({ children, onSave, data, debounceMs = 2000, className }: AutoSaveFormProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (saveStatus === 'idle') return

    const timer = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onSave(data)
        setSaveStatus('saved')
        setLastSaved(new Date())
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (error) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [data, onSave, debounceMs, saveStatus])

  useEffect(() => {
    setSaveStatus('idle')
  }, [data])

  return (
    <div className={className}>
      {/* Auto-save indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-description">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Salvando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="h-4 w-4" />
              Salvo {lastSaved && `às ${lastSaved.toLocaleTimeString()}`}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ExclamationCircleIcon className="h-4 w-4" />
              Erro ao salvar
            </span>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}

// ========================================
// UNSAVED CHANGES WARNING
// ========================================
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])
}

// ========================================
// FORM WITH KEYBOARD SHORTCUTS
// ========================================
interface FormWithShortcutsProps {
  children: ReactNode
  onSubmit: () => void
  onReset?: () => void
  className?: string
}

export function FormWithShortcuts({ children, onSubmit, onReset, className }: FormWithShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSubmit()
      }
      // Cmd/Ctrl + R to reset
      if (onReset && (e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        onReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSubmit, onReset])

  return <div className={className}>{children}</div>
}
