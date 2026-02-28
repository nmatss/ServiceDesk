'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 animate-fade-in">
      <div className="max-w-md w-full space-y-8 animate-slide-up">
        {/* Logo + Header */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <Image
              src="/favicon.svg"
              alt="ServiceDesk Logo"
              width={48}
              height={48}
              className="rounded-xl shadow-md"
              priority
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              Recuperar senha
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Informe seu email para redefinir sua senha
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl p-8 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 shadow-xl">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <EnvelopeIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Verifique seu email
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                Se o email existir, enviaremos instrucoes de recuperacao.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                    <EnvelopeIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-label="Endereco de email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10 hover-lift"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Enviando..."
                className="hover-lift shadow-lg"
              >
                Enviar instrucoes
              </Button>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-1" />
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
