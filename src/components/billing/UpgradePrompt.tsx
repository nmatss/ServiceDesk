'use client'

import Link from 'next/link'
import { ArrowUpRight, Lock } from 'lucide-react'

interface UpgradePromptProps {
  feature: string
  requiredPlan: string
  currentPlan?: string
}

export default function UpgradePrompt({ feature, requiredPlan, currentPlan }: UpgradePromptProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-brand-500" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 text-center">
        Recurso disponivel no plano {requiredPlan}
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-6">
        O modulo <strong>{feature}</strong> requer o plano {requiredPlan} ou superior.
        {currentPlan && (
          <span> Seu plano atual: <strong>{currentPlan}</strong>.</span>
        )}
      </p>
      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-6 py-3 transition-colors shadow-lg shadow-brand-600/25"
      >
        Ver planos e fazer upgrade
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
