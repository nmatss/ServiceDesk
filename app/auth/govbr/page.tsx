/**
 * Gov.br Authentication Page
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function GovBrAuthPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGovBrLogin = () => {
    setIsLoading(true);
    setError(null);
    const returnUrl = searchParams?.get('returnUrl') || '/dashboard';
    const encoded = encodeURIComponent(returnUrl);
    window.location.href = `/api/auth/govbr?returnUrl=${encoded}`;
  };

  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam) {
      setIsLoading(false);
      const errors: Record<string, string> = {
        invalid_request: 'Requisição inválida. Tente novamente.',
        invalid_state: 'Falha na validação de segurança.',
        token_exchange_failed: 'Falha ao obter tokens do Gov.br.',
        profile_fetch_failed: 'Não foi possível obter seus dados.',
        user_sync_failed: 'Erro ao sincronizar sua conta.',
        unexpected_error: 'Erro inesperado.',
      };
      setError(errors[errorParam] || 'Ocorreu um erro.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-brand-50/30 to-neutral-100 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 p-4 animate-fade-in">
      <div className="max-w-md w-full glass-panel rounded-2xl shadow-xl p-8 animate-slide-up">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">Login com Gov.br</h1>
          <p className="text-description text-sm">Autenticação segura do governo federal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handleGovBrLogin}
          disabled={isLoading}
          className={`w-full px-6 py-4 rounded-lg font-semibold text-white transition-colors shadow-lg ${
            isLoading
              ? 'bg-brand-400 dark:bg-brand-600 cursor-not-allowed'
              : 'bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-brand-600/20 dark:shadow-brand-500/20'
          }`}
        >
          {isLoading ? 'Conectando...' : 'Entrar com Gov.br'}
        </button>

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm text-description hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
            Voltar para login tradicional
          </Link>
        </div>
      </div>
    </div>
  );
}
