'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getCachedAuth } from '@/lib/hooks/useRequireAuth'

// ─── Feature data ──────────────────────────────────────────────────────────────

const features = [
  {
    title: 'Gerenciamento de Tickets',
    desc: 'Crie, organize e resolva chamados com fluxos inteligentes de priorizacao e escalonamento automatico.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
  {
    title: 'SLA e Escalonamento',
    desc: 'Defina politicas de SLA com alertas automaticos e escalonamento hierarquico para garantir prazos.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    title: 'Base de Conhecimento',
    desc: 'Artigos, tutoriais e solucoes documentadas para autoatendimento e reducao de chamados recorrentes.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    title: 'Inteligencia Artificial',
    desc: 'Classificacao automatica, sugestoes de resolucao e analise de sentimento com IA integrada.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'Analises e Dashboards',
    desc: 'Metricas em tempo real, relatorios personalizaveis e insights preditivos para sua operacao.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    title: 'ITIL Completo',
    desc: 'Gestao de problemas, mudancas, CMDB e catalogo de servicos seguindo as melhores praticas ITIL.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  }
]

const stats = [
  { value: '117', label: 'Tabelas no banco', suffix: '' },
  { value: '358', label: 'Endpoints de API', suffix: '' },
  { value: '99.9', label: 'Disponibilidade', suffix: '%' },
  { value: '<2', label: 'Tempo de resposta', suffix: 's' }
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const redirect = async () => {
      // Check global auth cache first
      const cached = getCachedAuth()
      if (cached) {
        const role = cached.user?.role
        router.replace(role === 'admin' || role === 'super_admin' || role === 'tenant_admin' ? '/admin' : '/dashboard')
        return
      }

      // Fallback: verify with API
      try {
        const response = await fetch('/api/auth/verify', { credentials: 'include' })
        if (!response.ok) { setChecked(true); return }
        const data = await response.json()
        if (!data.success || !data.user) { setChecked(true); return }
        router.replace(data.user.role === 'admin' ? '/admin' : '/dashboard')
      } catch {
        setChecked(true)
      }
    }

    redirect()
  }, [router])

  // Show loading while checking auth
  if (!checked) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-neutral-200 dark:border-neutral-700 border-t-brand-600 mx-auto mb-4"></div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>
        </div>
      </div>
    )
  }

  // ─── Landing Page ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-lg border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/favicon.svg" alt="ServiceDesk" width={32} height={32} className="rounded-lg" priority />
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">ServiceDesk</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-5 py-2.5 transition-colors shadow-sm"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-[500px] h-[500px] bg-brand-200/30 dark:bg-brand-800/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-[5%] w-[400px] h-[400px] bg-violet-200/20 dark:bg-violet-800/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-[40%] w-[300px] h-[300px] bg-brand-100/25 dark:bg-brand-900/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/40 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Plataforma ITSM completa</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-[1.1] max-w-4xl mx-auto animate-slide-up">
            Gerencie seu suporte com{' '}
            <span className="bg-gradient-to-r from-brand-500 to-brand-600 dark:from-brand-400 dark:to-brand-500 bg-clip-text text-transparent">
              inteligencia
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Plataforma profissional de Service Desk com gestao de tickets, SLA automatico, base de conhecimento, ITIL completo e inteligencia artificial integrada.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-8 py-3.5 text-base transition-all shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
            >
              Comecar agora
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold rounded-xl px-8 py-3.5 text-base transition-all active:scale-[0.98]"
            >
              Ja tenho conta
            </Link>
          </div>

          {/* Hero visual - mock dashboard preview */}
          <div className="mt-16 sm:mt-20 max-w-5xl mx-auto animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              {/* Glow behind */}
              <div className="absolute -inset-4 bg-gradient-to-b from-brand-500/10 to-transparent dark:from-brand-500/5 rounded-3xl blur-2xl" />
              {/* Card */}
              <div className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl shadow-neutral-900/8 dark:shadow-black/30 overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="max-w-xs mx-auto h-6 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center justify-center">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">servicedesk.app/dashboard</span>
                    </div>
                  </div>
                </div>
                {/* Mock dashboard content */}
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Tickets abertos', val: '24', color: 'text-brand-600 dark:text-brand-400' },
                      { label: 'Em andamento', val: '18', color: 'text-amber-600 dark:text-amber-400' },
                      { label: 'Resolvidos hoje', val: '12', color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'SLA no prazo', val: '96%', color: 'text-violet-600 dark:text-violet-400' }
                    ].map((s, i) => (
                      <div key={i} className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-100 dark:border-neutral-800">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mock table rows */}
                  <div className="space-y-2">
                    {[
                      { id: '#1042', title: 'Problema com acesso ao sistema', status: 'Aberto', statusColor: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' },
                      { id: '#1041', title: 'Solicitacao de novo equipamento', status: 'Em andamento', statusColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                      { id: '#1040', title: 'Atualizacao de software necessaria', status: 'Resolvido', statusColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-100/80 dark:border-neutral-800/50">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 hidden sm:inline">{row.id}</span>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate">{row.title}</span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${row.statusColor}`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
            <span className="inline-block text-sm font-semibold text-brand-600 dark:text-brand-400 mb-3">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
              Tudo que voce precisa em{' '}
              <span className="text-brand-600 dark:text-brand-400">uma plataforma</span>
            </h2>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              Ferramentas poderosas e integradas para transformar seu atendimento ao cliente.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 p-7 hover:shadow-lg hover:shadow-neutral-900/5 dark:hover:shadow-black/10 hover:border-brand-200 dark:hover:border-brand-800/40 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-100 dark:border-brand-800/30 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-5 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/40 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Section ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1a2e] via-[#0e2444] to-[#141432]" />
        <div className="absolute inset-0">
          <div className="absolute top-[20%] left-[15%] w-72 h-72 bg-brand-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] right-[10%] w-56 h-56 bg-violet-500/10 rounded-full blur-[80px]" />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '28px 28px'
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Construido para{' '}
              <span className="bg-gradient-to-r from-brand-300 to-brand-400 bg-clip-text text-transparent">escala</span>
            </h2>
            <p className="mt-4 text-lg text-blue-200/60 max-w-2xl mx-auto">
              Uma plataforma robusta e completa, pronta para as demandas mais exigentes.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white/[0.05] border border-white/[0.06] backdrop-blur-sm">
                <p className="text-4xl sm:text-5xl font-bold text-white">
                  {stat.value}<span className="text-brand-400">{stat.suffix}</span>
                </p>
                <p className="mt-2 text-sm text-blue-200/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white dark:bg-neutral-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Comece gratuitamente e descubra como o ServiceDesk pode otimizar a gestao do seu suporte.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-8 py-3.5 text-base transition-all shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98]"
            >
              Criar conta gratuita
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/landing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold rounded-xl px-8 py-3.5 text-base transition-all active:scale-[0.98]"
            >
              Ver mais detalhes
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/favicon.svg" alt="ServiceDesk" width={24} height={24} className="rounded-md" />
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">ServiceDesk</span>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-600">
            &copy; {new Date().getFullYear()} ServiceDesk. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="text-xs text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              Entrar
            </Link>
            <Link href="/auth/register" className="text-xs text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
