'use client'

import Link from 'next/link'
import { ExclamationTriangleIcon, HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Ícone animado */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-brand-100 dark:bg-brand-900/20 rounded-full flex items-center justify-center animate-pulse">
            <ExclamationTriangleIcon className="w-12 h-12 text-brand-600 dark:text-brand-400" />
          </div>
        </div>

        {/* Título */}
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          404
        </h1>

        <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
          Página não encontrada
        </h2>

        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          A página que você está procurando não existe ou foi movida para outro local.
        </p>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="btn btn-primary flex items-center justify-center gap-2"
          >
            <HomeIcon className="w-5 h-5" />
            Página Inicial
          </Link>

          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Voltar
          </button>
        </div>

        {/* Links úteis */}
        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Links úteis:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/dashboard" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Dashboard
            </Link>
            <Link href="/tickets" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Tickets
            </Link>
            <Link href="/search" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Busca
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}