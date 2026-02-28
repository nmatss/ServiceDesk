'use client'

import Link from 'next/link'

export default function TenantNotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8 animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-neutral-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 animate-slide-up">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 animate-pulse-soft">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900 dark:text-white">
              Tenant não encontrado
            </h2>

            <p className="mt-2 text-sm text-description">
              O tenant especificado não foi encontrado ou não está ativo.
            </p>
          </div>

          <div className="mt-6">
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400 dark:text-yellow-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Possíveis causas:
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>URL incorreta ou expirada</li>
                      <li>Tenant desativado ou removido</li>
                      <li>Problemas de configuração</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/landing"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 dark:focus:ring-offset-neutral-800 transition-all duration-200 hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Voltar à página inicial
            </Link>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-content">
              Se o problema persistir, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}