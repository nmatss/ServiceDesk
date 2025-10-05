import validator from 'validator'

// Tipos de validação
export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: any
}

export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'email' | 'url' | 'date' | 'boolean' | 'array' | 'object'
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: string[]
  custom?: (value: any) => string | null
  sanitize?: boolean
}

export interface ValidationSchema {
  [key: string]: ValidationRule
}

/**
 * Sanitizar string removendo caracteres perigosos
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str

  return str
    .trim()
    .replace(/[<>\"']/g, '') // Remove caracteres HTML perigosos
    .replace(/\x00/g, '') // Remove null bytes
    .substring(0, 5000) // Limita tamanho
}

/**
 * Validar email
 */
function validateEmail(email: string): boolean {
  return validator.isEmail(email) && email.length <= 254
}

/**
 * Validar URL
 */
function validateUrl(url: string): boolean {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  })
}

/**
 * Validar data
 */
function validateDate(date: string): boolean {
  return validator.isISO8601(date) || validator.isDate(date)
}

/**
 * Validar valor individual
 */
function validateField(value: any, rule: ValidationRule, fieldName: string): ValidationResult {
  const errors: string[] = []
  let sanitized = value

  // Verificar se é obrigatório
  if (rule.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} é obrigatório`)
    return { valid: false, errors }
  }

  // Se não é obrigatório e está vazio, é válido
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true, errors: [], sanitized: value }
  }

  // Sanitização
  if (rule.sanitize && typeof value === 'string') {
    sanitized = sanitizeString(value)
  }

  // Validação por tipo
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} deve ser uma string`)
      }
      break

    case 'number':
      if (typeof value !== 'number' && !validator.isNumeric(String(value))) {
        errors.push(`${fieldName} deve ser um número`)
      } else {
        sanitized = Number(value)
      }
      break

    case 'email':
      if (!validateEmail(String(value))) {
        errors.push(`${fieldName} deve ser um email válido`)
      }
      break

    case 'url':
      if (!validateUrl(String(value))) {
        errors.push(`${fieldName} deve ser uma URL válida`)
      }
      break

    case 'date':
      if (!validateDate(String(value))) {
        errors.push(`${fieldName} deve ser uma data válida`)
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        // Tentar converter strings comuns
        if (value === 'true' || value === '1') {
          sanitized = true
        } else if (value === 'false' || value === '0') {
          sanitized = false
        } else {
          errors.push(`${fieldName} deve ser um boolean`)
        }
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${fieldName} deve ser um array`)
      }
      break

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        errors.push(`${fieldName} deve ser um objeto`)
      }
      break
  }

  // Validação de tamanho para strings
  if (rule.type === 'string' && typeof sanitized === 'string') {
    if (rule.minLength && sanitized.length < rule.minLength) {
      errors.push(`${fieldName} deve ter pelo menos ${rule.minLength} caracteres`)
    }
    if (rule.maxLength && sanitized.length > rule.maxLength) {
      errors.push(`${fieldName} deve ter no máximo ${rule.maxLength} caracteres`)
    }
  }

  // Validação de valor para números
  if (rule.type === 'number' && typeof sanitized === 'number') {
    if (rule.min !== undefined && sanitized < rule.min) {
      errors.push(`${fieldName} deve ser maior ou igual a ${rule.min}`)
    }
    if (rule.max !== undefined && sanitized > rule.max) {
      errors.push(`${fieldName} deve ser menor ou igual a ${rule.max}`)
    }
  }

  // Validação de padrão
  if (rule.pattern && !rule.pattern.test(String(sanitized))) {
    errors.push(`${fieldName} não atende ao formato exigido`)
  }

  // Validação de enum
  if (rule.enum && !rule.enum.includes(String(sanitized))) {
    errors.push(`${fieldName} deve ser um dos valores: ${rule.enum.join(', ')}`)
  }

  // Validação customizada
  if (rule.custom) {
    const customError = rule.custom(sanitized)
    if (customError) {
      errors.push(customError)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  }
}

/**
 * Validar objeto completo usando schema
 */
export function validateSchema(data: any, schema: ValidationSchema): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Dados devem ser um objeto válido']
    }
  }

  const allErrors: string[] = []
  const sanitizedData: any = {}

  // Validar cada campo do schema
  for (const [fieldName, rule] of Object.entries(schema)) {
    const result = validateField(data[fieldName], rule, fieldName)

    if (!result.valid) {
      allErrors.push(...result.errors)
    } else {
      sanitizedData[fieldName] = result.sanitized
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    sanitized: sanitizedData
  }
}

// Schemas pré-definidos
export const schemas = {
  // Schema para login
  login: {
    email: {
      required: true,
      type: 'email' as const,
      sanitize: true
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 6,
      maxLength: 100
    }
  },

  // Schema para registro de usuário
  userRegistration: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
      sanitize: true
    },
    email: {
      required: true,
      type: 'email' as const,
      sanitize: true
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 100,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, // Pelo menos 1 minúscula, 1 maiúscula, 1 número
      custom: (value: string) => {
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Senha deve conter pelo menos 1 letra minúscula, 1 maiúscula e 1 número'
        }
        return null
      }
    },
    role: {
      required: false,
      type: 'string' as const,
      enum: ['admin', 'agent', 'user']
    }
  },

  // Schema para criação de ticket
  ticketCreation: {
    title: {
      required: true,
      type: 'string' as const,
      minLength: 5,
      maxLength: 200,
      sanitize: true
    },
    description: {
      required: true,
      type: 'string' as const,
      minLength: 10,
      maxLength: 5000,
      sanitize: true
    },
    priority_id: {
      required: true,
      type: 'number' as const,
      min: 1
    },
    category_id: {
      required: true,
      type: 'number' as const,
      min: 1
    },
    user_email: {
      required: false,
      type: 'email' as const,
      sanitize: true
    }
  },

  // Schema para upload de arquivo
  fileUpload: {
    filename: {
      required: true,
      type: 'string' as const,
      maxLength: 255,
      sanitize: true,
      custom: (value: string) => {
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
          return 'Nome do arquivo contém caracteres inválidos'
        }
        return null
      }
    },
    size: {
      required: true,
      type: 'number' as const,
      min: 1,
      max: 50 * 1024 * 1024 // 50MB
    },
    mimeType: {
      required: true,
      type: 'string' as const,
      enum: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    }
  },

  // Schema para busca
  search: {
    query: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 200,
      sanitize: true
    },
    limit: {
      required: false,
      type: 'number' as const,
      min: 1,
      max: 100
    },
    offset: {
      required: false,
      type: 'number' as const,
      min: 0
    }
  },

  // Schema para comentário
  comment: {
    content: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 2000,
      sanitize: true
    },
    ticket_id: {
      required: true,
      type: 'number' as const,
      min: 1
    },
    is_internal: {
      required: false,
      type: 'boolean' as const
    }
  }
}

/**
 * Middleware de validação para APIs
 */
export function createValidationMiddleware(schemaName: keyof typeof schemas) {
  return function validateRequest(data: any): ValidationResult {
    const schema = schemas[schemaName]
    return validateSchema(data, schema)
  }
}

/**
 * Validação de parâmetros de URL
 */
export function validateParams(params: any, rules: ValidationSchema): ValidationResult {
  return validateSchema(params, rules)
}

/**
 * Validação de query parameters
 */
export function validateQuery(query: any, rules: ValidationSchema): ValidationResult {
  return validateSchema(query, rules)
}

export default {
  validateSchema,
  validateField,
  schemas,
  createValidationMiddleware,
  validateParams,
  validateQuery
}