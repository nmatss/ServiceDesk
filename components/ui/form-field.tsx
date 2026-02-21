// Re-export from canonical FormField component
export { FormField, type FormFieldProps } from './FormField'

// Keep validators for backwards compatibility
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
