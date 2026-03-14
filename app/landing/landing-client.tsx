"use client"

import React, { useEffect, useState, useCallback } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { contactInfo, formattedContacts } from '@/lib/config/contact'
import {
  Headphones,
  Clock,
  BookOpen,
  BrainCircuit,
  BarChart3,
  Plug,
  Check,
  ArrowRight,
  Menu,
  X,
  Linkedin,
  MessageCircle,
  Shield,
  Users,
  Zap,
  Star,
  Phone,
  Mail,
  Globe,
  Building2,
  Ticket,
  TrendingUp,
  Award,
  AlertTriangle,
  Database,
  GitBranch,
  FileSearch,
  Activity,
  Layers,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  Play,
  Sparkles,
  ArrowUpRight,
  CircleDot
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Shared Animation Variants ────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }
  })
}

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
}

// ─── Section Header Component ─────────────────────────────────────────────────

function SectionHeader({ label, title, highlight, description, light = false }: {
  label: string
  title: string
  highlight: string
  description: string
  light?: boolean
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={stagger}
      >
        <motion.span
          variants={fadeUp}
          custom={0}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6",
            light
              ? "bg-white/10 text-brand-200 border border-white/10"
              : "bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-100 dark:border-brand-900"
          )}
        >
          <CircleDot className="w-3 h-3" />
          {label}
        </motion.span>
        <motion.h2
          variants={fadeUp}
          custom={0.05}
          className={cn(
            "text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 leading-[1.15]",
            light ? "text-white" : "text-foreground"
          )}
        >
          {title}{" "}
          <span className={cn(
            "bg-clip-text text-transparent bg-gradient-to-r",
            light ? "from-brand-200 to-cyan-200" : "from-brand-600 to-brand-400 dark:from-brand-400 dark:to-cyan-400"
          )}>
            {highlight}
          </span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          custom={0.1}
          className={cn(
            "text-base sm:text-lg leading-relaxed",
            light ? "text-brand-100/80" : "text-muted-foreground"
          )}
        >
          {description}
        </motion.p>
      </motion.div>
    </div>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const navItems = [
    { name: 'Benefícios', url: '#beneficios' },
    { name: 'Recursos', url: '#recursos' },
    { name: 'ITIL', url: '#itil' },
    { name: 'Planos', url: '#precos' },
    { name: 'Clientes', url: '#depoimentos' }
  ]

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollTo = useCallback((e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (url.startsWith('#')) {
      e.preventDefault()
      const el = document.querySelector(url)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setMobileMenuOpen(false)
    }
  }, [])

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl shadow-sm border-b border-neutral-200/50 dark:border-neutral-800/50"
        : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[4.5rem]">
          {/* Logo */}
          <a href="#inicio" className="flex items-center gap-2.5 group" onClick={(e) => scrollTo(e, '#inicio')}>
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:shadow-brand-600/40 transition-shadow">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-lg text-foreground tracking-tight">ServiceDesk</span>
              <span className="text-[10px] font-semibold text-brand-500 block -mt-0.5 tracking-wider">PRO</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.url}
                onClick={(e) => scrollTo(e, item.url)}
                className="text-sm font-medium px-3.5 py-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="/auth/login"
              className="text-sm font-medium text-foreground/70 hover:text-foreground px-4 py-2 transition-colors"
            >
              Entrar
            </a>
            <a
              href="/auth/register"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 transition-all"
            >
              Comece Grátis
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.url}
                onClick={(e) => scrollTo(e, item.url)}
                className="block py-3 px-4 rounded-xl text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                {item.name}
              </a>
            ))}
            <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 flex gap-3">
              <a href="/auth/login" className="flex-1 text-center py-2.5 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                Entrar
              </a>
              <a href="/auth/register" className="flex-1 text-center py-2.5 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                Comece Grátis
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </header>
  )
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0])
  const heroY = useTransform(scrollY, [0, 500], [0, 80])

  return (
    <section id="inicio" className="relative min-h-[100svh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-white to-neutral-50 dark:from-brand-950/30 dark:via-neutral-950 dark:to-neutral-950" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] lg:w-[700px] h-[300px] sm:h-[500px] lg:h-[700px] bg-brand-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[250px] sm:w-[400px] lg:w-[600px] h-[250px] sm:h-[400px] lg:h-[600px] bg-cyan-300/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-[200px] sm:w-[300px] lg:w-[400px] h-[200px] sm:h-[300px] lg:h-[400px] bg-brand-200/10 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" />
      </div>

      <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 lg:pt-32 lg:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-wrap gap-2 mb-8"
              >
                {[
                  { label: "Certificado ITIL 4", icon: CheckCircle2, color: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400" },
                  { label: "Conforme LGPD", icon: Shield, color: "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/30 dark:border-brand-900 dark:text-brand-400" },
                  { label: "99,9% Disponibilidade", icon: Award, color: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-900 dark:text-violet-400" }
                ].map((badge) => (
                  <span key={badge.label} className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border", badge.color)}>
                    <badge.icon className="w-3 h-3" />
                    {badge.label}
                  </span>
                ))}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6"
              >
                A plataforma ITSM que{" "}
                <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 bg-clip-text text-transparent">
                  transforma seu suporte
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-muted-foreground leading-relaxed mb-8"
              >
                Unifique chamados, SLA, base de conhecimento e automações
                em uma única plataforma. Reduza o tempo de resposta em{" "}
                <strong className="text-foreground">60%</strong> com IA integrada
                e processos ITIL 4.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-8"
              >
                <a href="/auth/register" className="group">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 transition-all text-[15px]">
                    Teste Grátis por 14 Dias
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </a>
                <a href="#demonstracao" className="group">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all text-[15px]">
                    <Play className="w-4 h-4 text-brand-600" />
                    Ver Demonstração
                  </button>
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex items-center gap-6 text-sm text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Sem cartão de crédito
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Setup em 5 min
                </span>
              </motion.div>
            </div>

            {/* Right: Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                {/* Main Dashboard Card */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl shadow-neutral-300/40 dark:shadow-black/40 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 dark:from-neutral-800 dark:to-neutral-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <span className="text-white/60 text-xs font-medium ml-2">ServiceDesk Pro — Dashboard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 text-xs font-medium">Online</span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="p-5 grid grid-cols-3 gap-3">
                    {[
                      { value: "247", label: "Chamados Abertos", color: "text-brand-600", bg: "bg-brand-50 dark:bg-brand-950/50" },
                      { value: "98.2%", label: "SLA Cumprido", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
                      { value: "4.9", label: "Satisfação (CSAT)", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/50" }
                    ].map((stat) => (
                      <div key={stat.label} className={cn("rounded-xl p-3.5 text-center", stat.bg)}>
                        <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ticket List */}
                  <div className="px-5 pb-5 space-y-2">
                    {[
                      { id: "TK-1847", title: "Falha no acesso ao ERP", priority: "Crítica", pColor: "bg-red-500", time: "2min" },
                      { id: "TK-1848", title: "Solicitação de novo monitor", priority: "Media", pColor: "bg-yellow-500", time: "15min" },
                      { id: "TK-1849", title: "VPN não conecta no home office", priority: "Alta", pColor: "bg-orange-500", time: "8min" }
                    ].map((ticket, i) => (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", ticket.pColor)} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{ticket.title}</div>
                            <div className="text-xs text-muted-foreground">{ticket.id} · {ticket.time} atras</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 flex-shrink-0">
                          {ticket.priority}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Floating: AI Suggestion */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 1 }}
                  className="absolute -bottom-6 -left-8 bg-white dark:bg-neutral-900 rounded-xl shadow-xl shadow-neutral-300/30 dark:shadow-black/30 p-4 border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">IA sugeriu solução</div>
                      <div className="text-xs text-muted-foreground">Confiança: 95%</div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating: Online Users */}
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 1.1 }}
                  className="absolute -top-4 -right-6 bg-white dark:bg-neutral-900 rounded-xl shadow-xl shadow-neutral-300/30 dark:shadow-black/30 px-4 py-3 border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-2">
                      {["from-blue-400 to-blue-600", "from-violet-400 to-violet-600", "from-emerald-400 to-emerald-600"].map((g, i) => (
                        <div key={i} className={cn("w-7 h-7 bg-gradient-to-br rounded-full border-2 border-white dark:border-neutral-900", g)} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold">+12 online</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Trusted By */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-16 lg:mt-24 pt-8 border-t border-neutral-200/60 dark:border-neutral-800/60"
          >
            <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wider mb-6">
              Empresas que confiam no ServiceDesk Pro
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 opacity-40">
              {["TechCorp", "Grupo Viva", "LogiPrime", "MedCenter", "BancaSul", "IndoBrasil"].map((name) => (
                <span key={name} className="text-lg font-bold text-foreground tracking-tight">{name}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Benefits Section ─────────────────────────────────────────────────────────

function BenefitsSection() {
  const benefits = [
    {
      icon: TrendingUp,
      metric: "-60%",
      metricLabel: "Tempo Médio",
      title: "Redução drástica no TMA",
      description: "Automatize triagem com IA e regras de negócio. Classificação automática de tickets elimina gargalos e reduz o tempo médio de atendimento.",
      color: "from-blue-500 to-indigo-600"
    },
    {
      icon: Clock,
      metric: "98%",
      metricLabel: "SLA Cumprido",
      title: "Controle total de SLAs",
      description: "Defina acordos personalizados por cliente, fila e tipo de chamado. Alertas proativos e escalação automática garantem cumprimento.",
      color: "from-emerald-500 to-teal-600"
    },
    {
      icon: BrainCircuit,
      metric: "40%",
      metricLabel: "Autoatendimento",
      title: "Inteligência artificial integrada",
      description: "Classificação automática, sugestão de soluções, roteamento inteligente e preenchimento automático de campos com IA generativa.",
      color: "from-violet-500 to-purple-600"
    },
    {
      icon: MessageCircle,
      metric: "5+",
      metricLabel: "Canais",
      title: "Central omnichannel unificada",
      description: "E-mail, WhatsApp, portal, telefone e chat em um único painel. Histórico unificado e visão 360 graus de cada cliente.",
      color: "from-orange-500 to-amber-600"
    }
  ]

  return (
    <section id="beneficios" className="py-20 lg:py-28 bg-neutral-50/50 dark:bg-neutral-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Por que nos escolher"
          title="Transforme seu suporte em"
          highlight="vantagem competitiva"
          description="Empresas que usam o ServiceDesk Pro reportam aumento de produtividade e redução de custos operacionais desde o primeiro mês."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto"
        >
          {benefits.map((benefit, index) => (
            <motion.div key={index} variants={fadeUp} custom={index * 0.05}>
              <div className="group relative h-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 lg:p-8 hover:shadow-xl hover:shadow-neutral-200/50 dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between mb-5">
                  <div className={cn("w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-lg", benefit.color)}>
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">{benefit.metric}</div>
                    <div className="text-xs text-muted-foreground font-medium">{benefit.metricLabel}</div>
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-brand-600 transition-colors">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features Section ─────────────────────────────────────────────────────────

function FeaturesSection() {
  const features = [
    {
      icon: Ticket,
      title: "Central de Chamados",
      description: "Portal, e-mail, WhatsApp e telefone unificados. Categorize por incidente, requisição, problema ou mudançacom histórico completo.",
      badge: "Omnichannel",
      gradient: "from-blue-500 to-sky-600"
    },
    {
      icon: Clock,
      title: "Gestão de SLA",
      description: "Acordos por cliente e contrato. Alertas de violação, escalação automática, horário comercial e feriados configurados nativamente.",
      badge: "SLA",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      icon: BookOpen,
      title: "Base de Conhecimento",
      description: "Artigos públicos e internos com autoatendimento. Sugestão automática de soluções e geração de FAQ com inteligência artificial.",
      badge: "KB + IA",
      gradient: "from-violet-500 to-purple-600"
    },
    {
      icon: BrainCircuit,
      title: "Automação Inteligente",
      description: "Classificação automática, sugestão de resposta, preenchimento de campos e roteamento por IA. Workflows no-code configurados.",
      badge: "IA",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: BarChart3,
      title: "Relatórios e Dashboards",
      description: "TMA, NPS/CSAT, volume por fila, analista e canal. Dashboards em tempo real, exportação para BI e relatórios agendados.",
      badge: "Análises",
      gradient: "from-cyan-500 to-blue-600"
    },
    {
      icon: Plug,
      title: "Integrações Corporativas",
      description: "ERP, CRM, AD/SSO, Microsoft 365, Google Workspace, TOTVS, SAP e mais. API RESTful completa e webhooks bidirecionais.",
      badge: "API",
      gradient: "from-pink-500 to-rose-600"
    }
  ]

  return (
    <section id="recursos" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Recursos completos"
          title="Tudo que você precisa para"
          highlight="excelência no suporte"
          description="Uma plataforma completa para gerenciar todo o ciclo de vida do atendimento ao cliente e operações de TI."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={fadeUp} custom={index * 0.05}>
              <div className="group relative h-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:shadow-xl hover:shadow-neutral-200/50 dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300">
                {/* Top gradient line */}
                <div className={cn("h-1 bg-gradient-to-r w-full", feature.gradient)} />

                <div className="p-6 lg:p-7">
                  <div className="flex items-start justify-between mb-5">
                    <div className={cn("w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300", feature.gradient)}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-2.5 group-hover:text-brand-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {feature.description}
                  </p>

                  <div className="flex items-center text-sm font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Saiba mais
                    <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── ITIL Processes Section ───────────────────────────────────────────────────

function ITILProcessesSection() {
  const processes = [
    {
      icon: AlertTriangle,
      title: "Gestão de Incidentes",
      description: "Restaure serviços rapidamente com classificação por impacto e urgencia, escalação automática e vínculo com CI afetado.",
      features: ["Classificação automática", "Matriz de prioridade", "Escalação SLA", "Incidente grave"],
      gradient: "from-red-500 to-rose-600",
      tagBg: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
    },
    {
      icon: FileSearch,
      title: "Gestão de Problemas",
      description: "Identifique causa raiz e previna recorrências com KEDB, análise de tendências e vínculo com incidentes relacionados.",
      features: ["Análise de causa raiz", "Banco de erros conhecidos", "Solução de contorno", "Vínculo incidentes"],
      gradient: "from-orange-500 to-amber-600",
      tagBg: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
    },
    {
      icon: GitBranch,
      title: "Gestão de Mudancas",
      description: "Controle mudanças minimizando riscos. Tipos padrao, normal e emergencial, CAB virtual, plano de retorno e calendario.",
      features: ["Fluxo de aprovação", "CAB virtual", "Avaliação de risco", "Calendário"],
      gradient: "from-violet-500 to-purple-600",
      tagBg: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
    },
    {
      icon: ClipboardList,
      title: "Catálogo de Serviços",
      description: "Padronize requisições com formulários e aprovações. Portal de autoatendimento, SLAs por serviço e fulfillment automatizado.",
      features: ["Portal autoatendimento", "Formulários dinâmicos", "Aprovações em cadeia", "SLA por item"],
      gradient: "from-blue-500 to-indigo-600",
      tagBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
    },
    {
      icon: Database,
      title: "CMDB e Ativos",
      description: "Mapeie relacionamentos entre itens de configuração. Impacto de mudanças, dependências e ciclo de vida de ativos.",
      features: ["Mapa de dependências", "Ciclo de vida", "Análise de impacto", "Descoberta automática"],
      gradient: "from-emerald-500 to-teal-600",
      tagBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
    },
    {
      icon: Activity,
      title: "Monitoramento e SLA",
      description: "Acompanhe métricas em tempo real. Dashboards COBIT, KPIs de governança, audit trail e compliance reports automáticos.",
      features: ["Dashboards COBIT", "KPIs personalizados", "Trilha de auditoria", "Conformidade"],
      gradient: "from-cyan-500 to-blue-600",
      tagBg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400"
    }
  ]

  return (
    <section id="itil" className="py-20 lg:py-28 bg-neutral-50/50 dark:bg-neutral-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="ITIL 4 & COBIT"
          title="Processos ITSM"
          highlight="nível enterprise"
          description="Implementamos as melhores práticas ITIL 4 para garantir excelência operacional. Da gestão de incidentes ao catálogo de serviços, tudo integrado."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
        >
          {processes.map((process, index) => (
            <motion.div key={index} variants={fadeUp} custom={index * 0.05}>
              <div className="group h-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:shadow-xl hover:shadow-neutral-200/50 dark:hover:shadow-black/20 transition-all duration-300">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("w-11 h-11 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-md", process.gradient)}>
                      <process.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-base font-bold flex-1">{process.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{process.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {process.features.map((feat, i) => (
                      <span key={i} className={cn("px-2 py-0.5 rounded-md text-[11px] font-medium", process.tagBg)}>
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Compliance Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 lg:mt-16"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-neutral-900 to-neutral-800 dark:from-neutral-800 dark:to-neutral-700 rounded-2xl p-8 lg:p-10">
            <div className="absolute top-0 right-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">Pronto para Auditorias e Compliance</h3>
                <p className="text-neutral-400 text-sm lg:text-base leading-relaxed">
                  Trilhas de auditoria completas, retenção de dados configurável, conformidade LGPD e relatórios prontos para ISO 20000 e COBIT.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: Shield, label: "ISO 20000" },
                  { icon: CheckCircle2, label: "COBIT 2019" },
                  { icon: Database, label: "LGPD" }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-white/5">
                    <item.icon className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-medium text-white">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Pricing Section ──────────────────────────────────────────────────────────

function PricingSection() {
  const [isYearly, setIsYearly] = useState(true)

  const plans = [
    {
      name: "Starter",
      description: "Equipes pequenas ou primeiro Help Desk",
      price: 0,
      period: "para sempre",
      features: [
        "Ate 3 agentes",
        "100 tickets/mes",
        "Portal do cliente",
        "E-mail e formulario web",
        "SLAs básicos",
        "Base de conhecimento",
        "Relatórios essenciais"
      ],
      cta: "Começar Grátis",
      popular: false,
      icon: Users,
      gradient: "from-neutral-500 to-neutral-600"
    },
    {
      name: "Essencial",
      description: "Times de suporte em crescimento",
      priceMonthly: 109,
      priceYearly: 89,
      period: "/agente/mes",
      features: [
        "Ate 10 agentes",
        "Tickets ilimitados",
        "WhatsApp + E-mail + Portal",
        "SLA avancado com alertas",
        "Automações (ate 10 regras)",
        "Gestão de Incidentes ITIL",
        "Relatórios personalizados",
        "Suporte por chat"
      ],
      cta: "Teste Grátis 14 Dias",
      popular: false,
      icon: Zap,
      gradient: "from-brand-500 to-brand-600"
    },
    {
      name: "Profissional",
      description: "Service Desk corporativo completo",
      priceMonthly: 179,
      priceYearly: 149,
      period: "/agente/mes",
      features: [
        "Ate 50 agentes",
        "Tudo do Essencial +",
        "Gestão de Problemas e Mudancas",
        "CMDB e Catálogo de Serviços",
        "IA para classificação",
        "Automações ilimitadas",
        "API RESTful completa",
        "Integração ERP/CRM",
        "Suporte prioritario 24/7"
      ],
      cta: "Teste Grátis 14 Dias",
      popular: true,
      icon: Award,
      gradient: "from-brand-600 to-brand-700"
    },
    {
      name: "Enterprise",
      description: "BPO, MSP ou grandes corporações",
      price: null,
      period: "sob consulta",
      features: [
        "Agentes ilimitados",
        "Tudo do Profissional +",
        "Multi-tenant (multi-empresa)",
        "SSO/SAML/LDAP",
        "Audit trail 7 anos (COBIT)",
        "SLA contratual garantido",
        "Gerente de sucesso dedicado",
        "Onboarding e treinamento",
        "Ambiente dedicado opcional"
      ],
      cta: "Falar com Especialista",
      popular: false,
      icon: Building2,
      gradient: "from-neutral-700 to-neutral-800"
    }
  ]

  return (
    <section id="precos" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Planos e precos"
          title="Escolha o plano ideal para"
          highlight="sua empresa"
          description="Comece gratuitamente e escale conforme seu crescimento. Todos os planos incluem suporte em português."
        />

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12 lg:mb-16">
          <span className={cn("text-sm font-medium transition-colors", !isYearly ? "text-foreground" : "text-muted-foreground")}>
            Mensal
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              isYearly ? "bg-brand-600" : "bg-neutral-300 dark:bg-neutral-700"
            )}
            role="switch"
            aria-checked={isYearly}
            aria-label="Alternar entre plano mensal e anual"
          >
            <motion.div
              className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
              animate={{ x: isYearly ? 28 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={cn("text-sm font-medium transition-colors flex items-center gap-2", isYearly ? "text-foreground" : "text-muted-foreground")}>
            Anual
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              -17%
            </span>
          </span>
        </div>

        {/* Plans Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 max-w-7xl mx-auto"
        >
          {plans.map((plan, index) => {
            const displayPrice = 'priceMonthly' in plan
              ? (isYearly ? plan.priceYearly : plan.priceMonthly)
              : plan.price

            return (
              <motion.div key={index} variants={fadeUp} custom={index * 0.05}>
                <div className={cn(
                  "relative h-full flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border overflow-hidden transition-all duration-300",
                  plan.popular
                    ? "border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/20 scale-[1.02] z-10"
                    : "border-neutral-200 dark:border-neutral-800 hover:shadow-lg hover:shadow-neutral-200/50 dark:hover:shadow-black/20"
                )}>
                  {plan.popular && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600" />
                  )}

                  <div className={cn("p-6 lg:p-7", plan.popular && "pt-7")}>
                    {plan.popular && (
                      <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 dark:bg-brand-950/50 px-3 py-1 rounded-full mb-4">
                        Mais Popular
                      </span>
                    )}

                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={cn("w-9 h-9 bg-gradient-to-br rounded-lg flex items-center justify-center", plan.gradient)}>
                        <plan.icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>

                    <div className="mb-6">
                      {displayPrice !== null && displayPrice !== undefined ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-4xl font-bold tracking-tight">{displayPrice}</span>
                          <span className="text-sm text-muted-foreground">{plan.period}</span>
                        </div>
                      ) : (
                        <div className="text-2xl font-bold">Sob Consulta</div>
                      )}
                      {isYearly && 'priceMonthly' in plan && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through">R${plan.priceMonthly}</span> cobrado anualmente
                        </p>
                      )}
                    </div>

                    <a href={displayPrice === 0 ? "/auth/register" : "#contato"} className="block mb-6">
                      <button className={cn(
                        "w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all",
                        plan.popular
                          ? "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25"
                          : "bg-neutral-100 dark:bg-neutral-800 text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}>
                        {plan.cta}
                      </button>
                    </a>

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/80">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Testimonials Section ─────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      name: "Marcelo Ferreira",
      role: "Coordenador de Suporte TI",
      company: "Rede de Varejo — 180 lojas",
      segment: "Varejo",
      content: "Reduzimos o backlog de 340 para 45 chamados em 60 dias. A gestão de SLA com alertas automáticos e a base de conhecimento com IA foram decisivos. NPS subiu de 42 para 78.",
      metrics: { sla: "94%", tma: "-55%", nps: "+36 pts" }
    },
    {
      name: "Patricia Mendes",
      role: "Gerente de Service Desk",
      company: "Hospital Regional — 500 leitos",
      segment: "Saúde",
      content: "Em ambiente critico como saude, não podemos falhar. O ServiceDesk Pro nos deu visibilidade total com dashboards em tempo real e escalação automática. Passamos na auditoria ISO 20000.",
      metrics: { sla: "98%", uptime: "99.9%", audit: "ISO" }
    },
    {
      name: "Ricardo Almeida",
      role: "Diretor de TI",
      company: "Industria Metalurgica — 2.500 func.",
      segment: "Industria",
      content: "A integração com TOTVS e a gestão de mudanças nos permitiram controlar atualizações de ERP sem impactar produção. O CAB virtual reduziu reuniões de 4h para aprovações em 30min.",
      metrics: { changes: "Zero downtime", cab: "-87% tempo" }
    }
  ]

  const stats = [
    { value: "500+", label: "Empresas Brasileiras", color: "text-brand-600" },
    { value: "2M+", label: "Tickets Processados/Ano", color: "text-emerald-600" },
    { value: "99.9%", label: "Uptime Garantido", color: "text-violet-600" },
    { value: "4.8/5", label: "Avaliação Media", color: "text-amber-600" }
  ]

  return (
    <section id="depoimentos" className="py-20 lg:py-28 bg-neutral-50/50 dark:bg-neutral-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Depoimentos"
          title="O que nossos clientes"
          highlight="dizem sobre nós"
          description="Empresas de todos os tamanhos e segmentos confiam no ServiceDesk Pro para suas operações críticas de suporte."
        />

        {/* Testimonial Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 max-w-6xl mx-auto mb-16"
        >
          {testimonials.map((t, index) => (
            <motion.div key={index} variants={fadeUp} custom={index * 0.05}>
              <div className="h-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 lg:p-7 hover:shadow-lg hover:shadow-neutral-200/50 dark:hover:shadow-black/20 transition-all duration-300">
                {/* Stars + Segment */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400 rounded-md">
                    {t.segment}
                  </span>
                </div>

                {/* Quote */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  &ldquo;{t.content}&rdquo;
                </p>

                {/* Metrics */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {Object.entries(t.metrics).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-2 py-1 border border-emerald-100 dark:border-emerald-900/30">
                      <span className="text-xs font-bold text-emerald-600">{value}</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-medium">{key}</span>
                    </div>
                  ))}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{t.name}</h4>
                    <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                    <p className="text-xs text-brand-600 truncate">{t.company}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className={cn("text-3xl lg:text-4xl font-bold mb-1", stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Segments */}
        <div className="mt-10 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Atendemos diversos segmentos</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Building2, name: "Corporativo" },
              { icon: Globe, name: "TI / MSP" },
              { icon: Shield, name: "Financeiro" },
              { icon: Users, name: "Varejo" },
              { icon: Activity, name: "Saúde" }
            ].map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium text-muted-foreground">
                <s.icon className="w-3.5 h-3.5" />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── CTA Section ──────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-brand-950 to-brand-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-600/20 via-transparent to-transparent" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight"
            >
              Pronto para transformar
              <br />
              <span className="bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">
                seu atendimento?
              </span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              custom={0.05}
              className="text-lg text-brand-100/70 mb-10 max-w-xl mx-auto leading-relaxed"
            >
              Comece gratuitamente e descubra como o ServiceDesk Pro pode
              ajudar sua equipe a entregar um atendimento excepcional.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={0.1}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <a href="/auth/register" className="group">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 shadow-xl shadow-white/10 transition-all text-[15px]">
                  Criar Conta Grátis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </a>
              <a href="#contato" className="group">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-all text-[15px]">
                  <ArrowUpRight className="w-4 h-4" />
                  Agendar Demonstração
                </button>
              </a>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={0.15}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-brand-200/60"
            >
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Setup em 5 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Suporte em Português
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const footerLinks = {
    Produto: [
      { name: "Recursos", url: "#recursos" },
      { name: "Preços", url: "#precos" },
      { name: "Integrações", url: "#integrações" },
      { name: "API", url: "/docs/api" }
    ],
    Empresa: [
      { name: "Sobre", url: "/sobre" },
      { name: "Blog", url: "/blog" },
      { name: "Carreiras", url: "/carreiras" },
      { name: "Contato", url: "#contato" }
    ],
    Suporte: [
      { name: "Documentação", url: "/docs" },
      { name: "Central de Ajuda", url: "/ajuda" },
      { name: "Status", url: "/status" },
      { name: "Comunidade", url: "/comunidade" }
    ],
    Legal: [
      { name: "Privacidade", url: "/privacidade" },
      { name: "Termos de Uso", url: "/termos" },
      { name: "LGPD", url: "/lgpd" },
      { name: "Cookies", url: "/cookies" }
    ]
  }

  return (
    <footer id="contato" className="bg-neutral-950 text-neutral-400 border-t border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 mb-14">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <div className="leading-none">
                <span className="font-bold text-lg text-white tracking-tight">ServiceDesk</span>
                <span className="text-[10px] font-semibold text-brand-500 block -mt-0.5 tracking-wider">PRO</span>
              </div>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed mb-6 max-w-xs">
              A plataforma ITSM completa para transformar seu atendimento ao cliente e operações de TI.
            </p>
            <div className="space-y-2.5">
              <a
                href={formattedContacts.mailto.main}
                className="flex items-center gap-2.5 text-sm hover:text-white transition-colors group"
              >
                <Mail className="w-4 h-4 text-neutral-600 group-hover:text-brand-500 transition-colors" />
                <span>{contactInfo.email.main}</span>
              </a>
              <a
                href={`tel:${formattedContacts.tel.main}`}
                className="flex items-center gap-2.5 text-sm hover:text-white transition-colors group"
              >
                <Phone className="w-4 h-4 text-neutral-600 group-hover:text-brand-500 transition-colors" />
                <span>{contactInfo.phone.main}</span>
              </a>
              <div className="flex items-center gap-2.5 text-sm">
                <Globe className="w-4 h-4 text-neutral-600" />
                <span>{contactInfo.address.city}, {contactInfo.address.country}</span>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-white text-sm mb-4 tracking-wide">{category}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.name}>
                    <a href={link.url} className="text-sm text-neutral-500 hover:text-white transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-800/50 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-600">
            &copy; {new Date().getFullYear()} ServiceDesk Pro. Todos os direitos reservados.
          </p>
          <div className="flex gap-2">
            {[
              { href: contactInfo.social.linkedin, label: "LinkedIn", icon: <Linkedin className="w-4 h-4" />, hoverBg: "hover:bg-brand-600" },
              { href: formattedContacts.whatsapp.support, label: "WhatsApp", icon: <MessageCircle className="w-4 h-4" />, hoverBg: "hover:bg-green-600" },
              {
                href: contactInfo.social.twitter,
                label: "X (Twitter)",
                icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
                hoverBg: "hover:bg-neutral-700"
              }
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("w-9 h-9 bg-neutral-900 rounded-lg flex items-center justify-center text-neutral-500 hover:text-white transition-all border border-neutral-800", social.hoverBg)}
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function LandingClient() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <NavBar />
      <HeroSection />
      <BenefitsSection />
      <FeaturesSection />
      <ITILProcessesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  )
}
