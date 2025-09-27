import nodemailer from 'nodemailer'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    name: string
    email: string
  }
}

// Email configuration - should be moved to environment variables
const getEmailConfig = (): EmailConfig => {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'ServiceDesk Pro',
      email: process.env.EMAIL_FROM_ADDRESS || 'noreply@servicedesk.com'
    }
  }
}

// Create email transporter
export const createEmailTransporter = () => {
  const config = getEmailConfig()

  // For development/testing, log emails to console
  if (process.env.NODE_ENV === 'development' && !config.auth.user) {
    console.log('⚠️  Email not configured. Using test account...')

    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    })
  }

  return nodemailer.createTransporter({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  })
}

export const getFromAddress = () => {
  const config = getEmailConfig()
  return `"${config.from.name}" <${config.from.email}>`
}

// Email provider configurations
export const emailProviders = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false
  },
  outlook: {
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false
  },
  yahoo: {
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false
  },
  sendgrid: {
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false
  },
  mailgun: {
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false
  }
}

export default getEmailConfig