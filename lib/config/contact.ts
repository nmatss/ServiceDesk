/**
 * Centralized Contact Information Configuration
 *
 * This file contains all contact details used across the application.
 * Update here to change contact information globally.
 */

export interface ContactInfo {
  phone: {
    main: string
    whatsapp: string
    support: string
    sales: string
  }
  email: {
    main: string
    support: string
    sales: string
    noreply: string
  }
  address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  social: {
    linkedin: string
    twitter: string
    github: string
    youtube: string
  }
  hours: {
    weekdays: string
    saturday: string
    sunday: string
  }
  emergency: {
    available: boolean
    phone: string
    description: string
  }
}

/**
 * Get contact information from environment variables or defaults
 */
export const getContactInfo = (): ContactInfo => {
  return {
    phone: {
      main: process.env.NEXT_PUBLIC_CONTACT_PHONE || '+55 (11) 3040-5000',
      whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '+55 (11) 97890-1234',
      support: process.env.NEXT_PUBLIC_CONTACT_SUPPORT_PHONE || '+55 (11) 3040-5001',
      sales: process.env.NEXT_PUBLIC_CONTACT_SALES_PHONE || '+55 (11) 3040-5002'
    },
    email: {
      main: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@servicedeskpro.com.br',
      support: process.env.NEXT_PUBLIC_CONTACT_SUPPORT_EMAIL || 'suporte@servicedeskpro.com.br',
      sales: process.env.NEXT_PUBLIC_CONTACT_SALES_EMAIL || 'vendas@servicedeskpro.com.br',
      noreply: process.env.NEXT_PUBLIC_CONTACT_NOREPLY_EMAIL || 'noreply@servicedeskpro.com.br'
    },
    address: {
      street: process.env.NEXT_PUBLIC_CONTACT_ADDRESS_STREET || 'Av. Paulista, 1234 - Conj. 567',
      city: process.env.NEXT_PUBLIC_CONTACT_ADDRESS_CITY || 'São Paulo',
      state: process.env.NEXT_PUBLIC_CONTACT_ADDRESS_STATE || 'SP',
      zip: process.env.NEXT_PUBLIC_CONTACT_ADDRESS_ZIP || '01310-100',
      country: process.env.NEXT_PUBLIC_CONTACT_ADDRESS_COUNTRY || 'Brasil'
    },
    social: {
      linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || 'https://linkedin.com/company/servicedesk-pro',
      twitter: process.env.NEXT_PUBLIC_SOCIAL_TWITTER || 'https://twitter.com/servicedeskpro',
      github: process.env.NEXT_PUBLIC_SOCIAL_GITHUB || 'https://github.com/servicedesk-pro',
      youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || 'https://youtube.com/@servicedeskpro'
    },
    hours: {
      weekdays: process.env.NEXT_PUBLIC_HOURS_WEEKDAYS || 'Segunda a Sexta: 8h às 18h',
      saturday: process.env.NEXT_PUBLIC_HOURS_SATURDAY || 'Sábado: Fechado',
      sunday: process.env.NEXT_PUBLIC_HOURS_SUNDAY || 'Domingo: Fechado'
    },
    emergency: {
      available: process.env.NEXT_PUBLIC_EMERGENCY_AVAILABLE === 'true',
      phone: process.env.NEXT_PUBLIC_EMERGENCY_PHONE || '+55 (11) 98765-4321',
      description: process.env.NEXT_PUBLIC_EMERGENCY_DESCRIPTION || 'Suporte emergencial 24/7 para clientes Enterprise'
    }
  }
}

/**
 * Format phone number for tel: links (remove non-digits)
 */
export const formatPhoneForLink = (phone: string): string => {
  return phone.replace(/\D/g, '')
}

/**
 * Format phone number for WhatsApp links (remove non-digits)
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  return phone.replace(/\D/g, '')
}

/**
 * Generate WhatsApp link with optional pre-filled message
 */
export const getWhatsAppLink = (phone: string, message?: string): string => {
  const formattedPhone = formatPhoneForWhatsApp(phone)
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${formattedPhone}${encodedMessage}`
}

/**
 * Generate mailto link with optional subject and body
 */
export const getMailtoLink = (email: string, subject?: string, body?: string): string => {
  const params = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  const queryString = params.length > 0 ? `?${params.join('&')}` : ''
  return `mailto:${email}${queryString}`
}

// Export singleton instance
export const contactInfo = getContactInfo()

// Export formatted contact info for common use cases
export const formattedContacts = {
  tel: {
    main: formatPhoneForLink(contactInfo.phone.main),
    whatsapp: formatPhoneForLink(contactInfo.phone.whatsapp),
    support: formatPhoneForLink(contactInfo.phone.support),
    sales: formatPhoneForLink(contactInfo.phone.sales)
  },
  whatsapp: {
    support: getWhatsAppLink(contactInfo.phone.whatsapp, 'Olá, preciso de suporte!'),
    sales: getWhatsAppLink(contactInfo.phone.whatsapp, 'Olá, gostaria de saber mais sobre o ServiceDesk Pro')
  },
  mailto: {
    support: getMailtoLink(contactInfo.email.support),
    sales: getMailtoLink(contactInfo.email.sales, 'Solicitação de Orçamento'),
    main: getMailtoLink(contactInfo.email.main)
  }
}
