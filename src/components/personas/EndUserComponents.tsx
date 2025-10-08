/**
 * End User Components
 *
 * Simplified, accessible components optimized for customer self-service.
 * Focus: Clarity, ease of use, minimal cognitive load
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';
import { getPersonaVariants } from '../../../lib/design-system/persona-variants';

interface EndUserComponentProps {
  className?: string;
  persona?: PersonaType;
}

// Simplified search bar with prominent help text
export function EndUserSearchBar({ className = '', ...props }: EndUserComponentProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const mockSuggestions = [
    'How to reset my password',
    'Submit a new support request',
    'Check my ticket status',
    'Update my profile information',
    'Download software installation guide'
  ];

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length > 2) {
      setSuggestions(mockSuggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      ));
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-persona-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="What can we help you with today?"
          className="input-persona-enduser pl-12 text-lg h-14"
          aria-label="Search for help"
        />
        <QuestionMarkCircleIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-persona-muted cursor-help" />
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-persona-elevated border border-persona-secondary rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(suggestion);
                setIsOpen(false);
              }}
              className="w-full text-left px-6 py-4 hover:bg-persona-secondary transition-smooth first:rounded-t-xl last:rounded-b-xl focus-ring-enduser"
            >
              <div className="flex items-center gap-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-persona-muted flex-shrink-0" />
                <span className="text-persona-primary">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick action cards for common tasks
export function EndUserQuickActions({ className = '', ...props }: EndUserComponentProps) {
  const quickActions = [
    {
      title: 'Submit Request',
      description: 'Need help? Create a new support ticket',
      icon: ChatBubbleLeftRightIcon,
      color: 'bg-blue-500',
      href: '/tickets/new'
    },
    {
      title: 'Knowledge Base',
      description: 'Find answers to common questions',
      icon: DocumentTextIcon,
      color: 'bg-green-500',
      href: '/kb'
    },
    {
      title: 'My Tickets',
      description: 'View and track your support requests',
      icon: ClockIcon,
      color: 'bg-amber-500',
      href: '/tickets'
    },
    {
      title: 'Contact Support',
      description: 'Speak directly with our team',
      icon: PhoneIcon,
      color: 'bg-purple-500',
      href: '/contact'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {quickActions.map((action, index) => (
        <button
          key={index}
          className="card-persona-enduser text-left group hover:scale-105 transition-smooth min-target-enduser"
          onClick={() => window.location.href = action.href}
        >
          <div className="flex items-start gap-4">
            <div className={`${action.color} p-3 rounded-xl text-white group-hover:scale-110 transition-smooth`}>
              <action.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-persona-primary text-lg mb-2">
                {action.title}
              </h3>
              <p className="text-persona-secondary text-sm leading-relaxed">
                {action.description}
              </p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-persona-muted group-hover:text-persona-primary group-hover:translate-x-1 transition-smooth" />
          </div>
        </button>
      ))}
    </div>
  );
}

// Simple status display for tickets
export function EndUserTicketStatus({ className = '', ...props }: EndUserComponentProps) {
  const [tickets] = useState([
    {
      id: 'REQ-001',
      title: 'Password reset request',
      status: 'resolved',
      createdAt: '2 days ago',
      priority: 'medium'
    },
    {
      id: 'REQ-002',
      title: 'Software installation help',
      status: 'in-progress',
      createdAt: '1 day ago',
      priority: 'low'
    }
  ]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved':
        return {
          icon: CheckCircleIcon,
          color: 'text-green-600',
          bg: 'bg-green-50',
          label: 'Resolved'
        };
      case 'in-progress':
        return {
          icon: ClockIcon,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          label: 'In Progress'
        };
      default:
        return {
          icon: ExclamationTriangleIcon,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          label: 'Open'
        };
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h2 className="text-2xl font-semibold text-persona-primary mb-6">
        Your Recent Requests
      </h2>

      {tickets.map((ticket) => {
        const statusConfig = getStatusConfig(ticket.status);
        return (
          <div key={ticket.id} className="card-persona-enduser hover:shadow-xl transition-smooth">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-sm font-semibold text-persona-secondary bg-persona-secondary px-3 py-1 rounded-full">
                    {ticket.id}
                  </span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bg}`}>
                    <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
                    <span className={`text-sm font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-persona-primary mb-2">
                  {ticket.title}
                </h3>

                <p className="text-persona-secondary">
                  Created {ticket.createdAt}
                </p>
              </div>

              <button className="btn-persona-enduser">
                View Details
              </button>
            </div>
          </div>
        );
      })}

      {tickets.length === 0 && (
        <div className="text-center py-12">
          <DocumentTextIcon className="h-16 w-16 text-persona-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-persona-primary mb-2">
            No requests yet
          </h3>
          <p className="text-persona-secondary mb-6">
            When you submit support requests, they'll appear here.
          </p>
          <button className="btn-persona-enduser">
            Submit Your First Request
          </button>
        </div>
      )}
    </div>
  );
}

// Support contact information
export function EndUserContactInfo({ className = '', ...props }: EndUserComponentProps) {
  const contactMethods = [
    {
      title: 'Live Chat',
      description: 'Chat with our support team',
      icon: ChatBubbleLeftRightIcon,
      action: 'Start Chat',
      available: true,
      hours: '24/7'
    },
    {
      title: 'Email Support',
      description: 'Send us a detailed message',
      icon: EnvelopeIcon,
      action: 'Send Email',
      available: true,
      hours: 'Response within 24h'
    },
    {
      title: 'Phone Support',
      description: 'Speak directly with an agent',
      icon: PhoneIcon,
      action: 'Call Now',
      available: false,
      hours: 'Mon-Fri 9AM-6PM'
    }
  ];

  return (
    <div className={`${className}`}>
      <h2 className="text-2xl font-semibold text-persona-primary mb-6">
        Contact Support
      </h2>

      <div className="grid gap-4">
        {contactMethods.map((method, index) => (
          <div key={index} className={`card-persona-enduser ${!method.available ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <method.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-persona-primary text-lg">
                    {method.title}
                  </h3>
                  <p className="text-persona-secondary mb-1">
                    {method.description}
                  </p>
                  <p className="text-sm text-persona-muted">
                    {method.hours}
                  </p>
                </div>
              </div>

              <button
                className={`btn-persona-enduser ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!method.available}
              >
                {method.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// FAQ component with simple accordion
export function EndUserFAQ({ className = '', ...props }: EndUserComponentProps) {
  const [openItem, setOpenItem] = useState<number | null>(null);

  const faqs = [
    {
      question: 'How do I reset my password?',
      answer: 'You can reset your password by clicking the "Forgot Password" link on the login page. You\'ll receive an email with instructions to create a new password.'
    },
    {
      question: 'How long does it take to get a response?',
      answer: 'We typically respond to support requests within 24 hours during business days. Urgent issues are prioritized and may receive faster responses.'
    },
    {
      question: 'Can I track my support request?',
      answer: 'Yes! Each support request gets a unique ID that you can use to track its progress. You\'ll also receive email updates when there are changes to your request.'
    },
    {
      question: 'What information should I include in my request?',
      answer: 'Please include as much detail as possible: what you were trying to do, what happened instead, any error messages, and screenshots if helpful.'
    }
  ];

  return (
    <div className={`${className}`}>
      <h2 className="text-2xl font-semibold text-persona-primary mb-6">
        Frequently Asked Questions
      </h2>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={index} className="card-persona-enduser">
            <button
              onClick={() => setOpenItem(openItem === index ? null : index)}
              className="w-full text-left focus-ring-enduser rounded-lg"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-persona-primary text-lg pr-4">
                  {faq.question}
                </h3>
                <ChevronRightIcon
                  className={`h-5 w-5 text-persona-muted transition-smooth ${
                    openItem === index ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </button>

            {openItem === index && (
              <div className="mt-4 pt-4 border-t border-persona-secondary animate-slide-down">
                <p className="text-persona-secondary leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-persona-secondary mb-4">
          Can't find what you're looking for?
        </p>
        <button className="btn-persona-enduser">
          Browse Knowledge Base
          <ArrowTopRightOnSquareIcon className="h-5 w-5 ml-2" />
        </button>
      </div>
    </div>
  );
}

// Simple notification banner
export function EndUserNotificationBanner({
  type = 'info',
  title,
  message,
  onDismiss,
  className = '',
  ...props
}: EndUserComponentProps & {
  type?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  onDismiss?: () => void;
}) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircleIcon,
          bg: 'bg-green-50',
          border: 'border-green-200',
          iconColor: 'text-green-600',
          textColor: 'text-green-900'
        };
      case 'warning':
        return {
          icon: ExclamationTriangleIcon,
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          iconColor: 'text-amber-600',
          textColor: 'text-amber-900'
        };
      case 'error':
        return {
          icon: ExclamationTriangleIcon,
          bg: 'bg-red-50',
          border: 'border-red-200',
          iconColor: 'text-red-600',
          textColor: 'text-red-900'
        };
      default:
        return {
          icon: QuestionMarkCircleIcon,
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          iconColor: 'text-blue-600',
          textColor: 'text-blue-900'
        };
    }
  };

  const config = getTypeConfig(type);

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <config.icon className={`h-6 w-6 ${config.iconColor} flex-shrink-0 mt-1`} />
        <div className="flex-1">
          <h3 className={`font-semibold text-lg ${config.textColor} mb-2`}>
            {title}
          </h3>
          <p className={`${config.textColor} leading-relaxed`}>
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${config.iconColor} hover:opacity-75 transition-smooth focus-ring-enduser rounded-lg p-1`}
            aria-label="Dismiss notification"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Export all components
export {
  EndUserSearchBar,
  EndUserQuickActions,
  EndUserTicketStatus,
  EndUserContactInfo,
  EndUserFAQ,
  EndUserNotificationBanner
};