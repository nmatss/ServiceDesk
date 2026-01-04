/**
 * ContactCard Component
 *
 * Reusable contact information display card
 * Uses centralized contact configuration
 */

import React from 'react'
import { contactInfo, formattedContacts } from '@/lib/config/contact'
import {
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'

interface ContactCardProps {
  variant?: 'default' | 'minimal' | 'detailed'
  showWhatsApp?: boolean
  showAddress?: boolean
  showHours?: boolean
  className?: string
  contactType?: 'support' | 'sales' | 'main'
}

export default function ContactCard({
  variant = 'default',
  showWhatsApp = true,
  showAddress = false,
  showHours = true,
  className = '',
  contactType = 'support'
}: ContactCardProps) {
  const getContactData = () => {
    switch (contactType) {
      case 'sales':
        return {
          phone: contactInfo.phone.sales,
          email: contactInfo.email.sales,
          phoneLink: formattedContacts.tel.sales,
          emailLink: formattedContacts.mailto.sales,
          whatsappLink: formattedContacts.whatsapp.sales,
          title: 'Fale com Vendas'
        }
      case 'main':
        return {
          phone: contactInfo.phone.main,
          email: contactInfo.email.main,
          phoneLink: formattedContacts.tel.main,
          emailLink: formattedContacts.mailto.main,
          whatsappLink: formattedContacts.whatsapp.support,
          title: 'Entre em Contato'
        }
      default:
        return {
          phone: contactInfo.phone.support,
          email: contactInfo.email.support,
          phoneLink: formattedContacts.tel.support,
          emailLink: formattedContacts.mailto.support,
          whatsappLink: formattedContacts.whatsapp.support,
          title: 'Precisa de Suporte?'
        }
    }
  }

  const data = getContactData()

  if (variant === 'minimal') {
    return (
      <div className={`flex gap-4 ${className}`}>
        <a
          href={`tel:${data.phoneLink}`}
          className="flex items-center gap-2 text-sm hover:text-brand-600 transition-colors"
        >
          <PhoneIcon className="w-4 h-4" />
          <span>{data.phone}</span>
        </a>
        <a
          href={data.emailLink}
          className="flex items-center gap-2 text-sm hover:text-brand-600 transition-colors"
        >
          <EnvelopeIcon className="w-4 h-4" />
          <span>{data.email}</span>
        </a>
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={`bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6 ${className}`}>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          {data.title}
        </h3>

        <div className="space-y-4">
          {/* Phone */}
          <a
            href={`tel:${data.phoneLink}`}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
          >
            <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <PhoneIcon className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <div className="text-xs text-muted-content">Telefone</div>
              <div className="font-medium text-neutral-900 dark:text-neutral-100">{data.phone}</div>
            </div>
          </a>

          {/* Email */}
          <a
            href={data.emailLink}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
          >
            <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <EnvelopeIcon className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <div className="text-xs text-muted-content">E-mail</div>
              <div className="font-medium text-neutral-900 dark:text-neutral-100 break-all">{data.email}</div>
            </div>
          </a>

          {/* WhatsApp */}
          {showWhatsApp && (
            <a
              href={data.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors group"
            >
              <div className="w-10 h-10 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-success-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <div className="text-xs text-muted-content">WhatsApp</div>
                <div className="font-medium text-neutral-900 dark:text-neutral-100">{contactInfo.phone.whatsapp}</div>
              </div>
            </a>
          )}

          {/* Address */}
          {showAddress && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="w-5 h-5 text-description" />
              </div>
              <div>
                <div className="text-xs text-muted-content">Endereço</div>
                <div className="text-sm text-neutral-900 dark:text-neutral-100">
                  {contactInfo.address.street}<br />
                  {contactInfo.address.city} - {contactInfo.address.state}, {contactInfo.address.zip}
                </div>
              </div>
            </div>
          )}

          {/* Business Hours */}
          {showHours && (
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-sm text-description">
                <ClockIcon className="w-4 h-4" />
                <div>
                  <div>{contactInfo.hours.weekdays}</div>
                  <div className="text-xs">{contactInfo.hours.saturday} • {contactInfo.hours.sunday}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      {/* Phone */}
      <a
        href={`tel:${data.phoneLink}`}
        className="flex flex-col items-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all duration-200 hover:shadow-md group"
      >
        <PhoneIcon className="w-6 h-6 text-brand-600 mb-2 group-hover:scale-110 transition-transform" />
        <span className="text-xs text-muted-content mb-1">Telefone</span>
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{data.phone}</span>
      </a>

      {/* Email */}
      <a
        href={data.emailLink}
        className="flex flex-col items-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all duration-200 hover:shadow-md group"
      >
        <EnvelopeIcon className="w-6 h-6 text-brand-600 mb-2 group-hover:scale-110 transition-transform" />
        <span className="text-xs text-muted-content mb-1">E-mail</span>
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-full">{data.email}</span>
      </a>

      {/* WhatsApp */}
      {showWhatsApp && (
        <a
          href={data.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-success-500 dark:hover:border-success-500 hover:bg-success-50 dark:hover:bg-success-950/20 transition-all duration-200 hover:shadow-md group"
        >
          <svg className="w-6 h-6 text-success-600 mb-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-xs text-muted-content mb-1">WhatsApp</span>
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{contactInfo.phone.whatsapp}</span>
        </a>
      )}
    </div>
  )
}
