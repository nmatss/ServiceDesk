"use client"

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
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
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  Settings,
  Database,
  GitBranch,
  FileSearch,
  Workflow,
  Server,
  HardDrive,
  Network,
  CheckCircle2,
  XCircle,
  Timer,
  Activity,
  Layers,
  Package,
  ClipboardList,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// Navigation Component
interface NavItem {
  name: string
  url: string
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

function NavBar({ items, className }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0]?.name || '')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-background/95 backdrop-blur-md shadow-md" : "bg-transparent",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-xl text-foreground">ServiceDesk</span>
              <span className="text-xs text-muted-foreground block -mt-1">Pro</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {items.map((item) => {
              const isActive = activeTab === item.name
              return (
                <a
                  key={item.name}
                  href={item.url}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "relative cursor-pointer text-sm font-medium px-4 py-2 rounded-lg transition-all",
                    "hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950",
                    isActive ? "text-blue-600 bg-blue-50 dark:bg-blue-950" : "text-foreground/80"
                  )}
                >
                  {item.name}
                </a>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <a href="/auth/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Entrar
              </Button>
            </a>
            <a href="/auth/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                Comece Gratis
              </Button>
            </a>
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden bg-background border-b shadow-lg"
        >
          <div className="container mx-auto px-4 py-4">
            {items.map((item) => (
              <a
                key={item.name}
                href={item.url}
                className="block py-3 px-4 rounded-lg hover:bg-muted transition-colors font-medium"
                onClick={() => {
                  setActiveTab(item.name)
                  setMobileMenuOpen(false)
                }}
              >
                {item.name}
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Hero Section
function HeroSection() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-blue-50 via-background to-background dark:from-blue-950/30 pt-20">
      {/* Background decorations - pushed to back with z-0 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-blue-500/5 to-transparent rounded-full" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-wrap gap-2 mb-6"
            >
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-xs sm:text-sm font-medium text-green-700 dark:text-green-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                ITIL 4 Compliant
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                LGPD Ready
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300">
                <Award className="w-3.5 h-3.5 mr-1.5" />
                98% SLA
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight"
            >
              ServiceDesk Pro{" "}
              <span className="block sm:inline bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Central Completa
              </span>
              <br className="hidden sm:block" />
              <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">de Atendimento ao Cliente e TI</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-xl leading-relaxed"
            >
              Unifique <strong>chamados, SLA, base de conhecimento e automacoes</strong> em um unico painel,
              reduzindo tempo de resposta e aumentando a satisfacao dos clientes.
              Plataforma <strong>ITSM completa</strong> com IA integrada.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8"
            >
              <a href="/auth/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-base sm:text-lg px-6 sm:px-8 h-12 sm:h-14">
                  Teste Gratis por 14 Dias <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </a>
              <a href="#demonstracao" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full text-base sm:text-lg px-6 sm:px-8 h-12 sm:h-14">
                  Agendar Demonstracao
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span>Implantacao em poucos dias</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>WhatsApp e E-mail</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <BarChart3 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>Dashboards em tempo real</span>
              </div>
            </motion.div>
          </div>

          {/* Right Content - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative order-1 lg:order-2"
          >
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border overflow-hidden">
              {/* Mock Dashboard Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-semibold">ServiceDesk Pro</span>
                </div>
              </div>

              {/* Mock Dashboard Stats */}
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">247</div>
                  <div className="text-xs text-muted-foreground mt-1">Chamados Abertos</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">98%</div>
                  <div className="text-xs text-muted-foreground mt-1">SLA Cumprido</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">4.9</div>
                  <div className="text-xs text-muted-foreground mt-1">Satisfacao</div>
                </div>
              </div>

              {/* Mock Ticket List */}
              <div className="px-6 pb-6 space-y-3">
                {[
                  { id: "TK-1234", title: "Erro no sistema ERP", priority: "Alta", status: "Em Andamento" },
                  { id: "TK-1235", title: "Solicitacao de novo monitor", priority: "Media", status: "Aguardando" },
                  { id: "TK-1236", title: "Problema com VPN", priority: "Urgente", status: "Novo" },
                ].map((ticket, index) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Ticket className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{ticket.title}</div>
                        <div className="text-xs text-muted-foreground">{ticket.id}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      ticket.priority === "Urgente" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      ticket.priority === "Alta" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                      ticket.priority === "Media" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    )}>
                      {ticket.priority}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Floating elements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute -bottom-4 -left-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">IA Sugeriu Solucao</div>
                  <div className="text-xs text-muted-foreground">Confianca: 95%</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="absolute -top-4 -right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 border"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white" />
                  ))}
                </div>
                <span className="text-sm font-medium">+12 online</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// Benefits Section
function BenefitsSection() {
  const benefits = [
    {
      icon: Timer,
      title: "Reduza o Tempo Medio de Atendimento (TMA)",
      description: "Automatize triagem com IA e regras de negocio. Classificacao automatica de tickets reduz TMA em ate 60% e elimina gargalos.",
      metric: "-60%",
      metricLabel: "TMA"
    },
    {
      icon: Clock,
      title: "Controle SLAs por Fila e Tipo de Chamado",
      description: "Defina acordos de nivel de servico personalizados. Alertas proativos, escalacao automatica e relatorios de cumprimento em tempo real.",
      metric: "98%",
      metricLabel: "SLA"
    },
    {
      icon: BrainCircuit,
      title: "Automatize Triagem com IA e Regras de Negocio",
      description: "Classificacao automatica, sugestao de solucoes da base de conhecimento, roteamento inteligente e preenchimento automatico de campos.",
      metric: "40%",
      metricLabel: "Autoatendimento"
    },
    {
      icon: MessageCircle,
      title: "Centralize E-mail, WhatsApp e Portal",
      description: "Todos os canais em um unico lugar. Historico unificado do cliente, respostas padronizadas e visao 360 graus do atendimento.",
      metric: "5+",
      metricLabel: "Canais"
    }
  ]

  return (
    <section id="beneficios" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-blue-600 font-semibold mb-4"
          >
            POR QUE ESCOLHER O SERVICEDESK PRO?
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
          >
            Transforme seu Suporte em{" "}
            <span className="text-blue-600">Vantagem Competitiva</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Empresas que usam o ServiceDesk Pro reportam aumento de produtividade
            e reducao de custos operacionais
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-5xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 border-2 hover:border-blue-200 dark:hover:border-blue-800">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <div className="flex items-center gap-4 sm:block">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <benefit.icon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                      </div>
                      {/* Mobile metric display */}
                      <div className="sm:hidden text-right flex-1">
                        <div className="text-2xl font-bold text-blue-600">{benefit.metric}</div>
                        <div className="text-xs text-muted-foreground">{benefit.metricLabel}</div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{benefit.title}</h3>
                        {/* Desktop metric display */}
                        <div className="hidden sm:block text-right flex-shrink-0">
                          <div className="text-2xl md:text-3xl font-bold text-blue-600">{benefit.metric}</div>
                          <div className="text-xs text-muted-foreground">{benefit.metricLabel}</div>
                        </div>
                      </div>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Features Section - ITIL/ITSM Focused
function FeaturesSection() {
  const features = [
    {
      icon: Ticket,
      title: "Central de Chamados Omnichannel",
      description: "Portal, e-mail, WhatsApp e telefone em um so lugar. Categorize por incidente, requisicao, problema ou mudanca. Historico unificado do cliente.",
      color: "blue",
      badge: "ITIL"
    },
    {
      icon: Clock,
      title: "Gestao de SLA e Prioridades",
      description: "Acordos de nivel de servico por cliente e contrato. Alertas de violacao, escalacao automatica, horario comercial e feriados configurados.",
      color: "green",
      badge: "SLA"
    },
    {
      icon: BookOpen,
      title: "Base de Conhecimento com IA",
      description: "Artigos publicos e internos, autoatendimento para usuario final. Sugestao automatica de solucoes e geracao de FAQ com inteligencia artificial.",
      color: "purple",
      badge: "KB"
    },
    {
      icon: BrainCircuit,
      title: "Automacao Inteligente",
      description: "Classificacao automatica de tickets, sugestao de resposta, preenchimento de campos e roteamento por IA. Workflows no-code configurados.",
      color: "orange",
      badge: "IA"
    },
    {
      icon: BarChart3,
      title: "Relatorios e Dashboards",
      description: "TMA, NPS/CSAT, volume por fila, por analista e por canal. Dashboards em tempo real, exportacao para BI e relatorios agendados.",
      color: "cyan",
      badge: "Analytics"
    },
    {
      icon: Plug,
      title: "Integracoes Corporativas",
      description: "ERP, CRM, AD/SSO, Microsoft 365, Google Workspace, TOTVS, SAP e muito mais. API RESTful completa e webhooks bidirecionais.",
      color: "pink",
      badge: "API"
    }
  ]

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600", border: "border-blue-200 dark:border-blue-800" },
    green: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600", border: "border-green-200 dark:border-green-800" },
    purple: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600", border: "border-purple-200 dark:border-purple-800" },
    orange: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600", border: "border-orange-200 dark:border-orange-800" },
    cyan: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600", border: "border-cyan-200 dark:border-cyan-800" },
    pink: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-600", border: "border-pink-200 dark:border-pink-800" }
  }

  return (
    <section id="recursos" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-blue-600 font-semibold mb-4"
          >
            RECURSOS COMPLETOS
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
          >
            Tudo que Voce Precisa para{" "}
            <span className="text-blue-600">Excelencia no Suporte</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Uma plataforma completa para gerenciar todo o ciclo de vida do atendimento ao cliente
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {features.map((feature, index) => {
            const colors = colorClasses[feature.color]
            const gradientMap: Record<string, string> = {
              blue: 'from-sky-500 to-blue-600',
              green: 'from-green-500 to-emerald-600',
              purple: 'from-purple-500 to-indigo-600',
              orange: 'from-orange-500 to-amber-600',
              cyan: 'from-cyan-500 to-blue-600',
              pink: 'from-pink-500 to-rose-600'
            }
            const gradient = gradientMap[feature.color]

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={cn(
                  "group relative h-full bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 overflow-hidden",
                  colors.border,
                  `hover:${colors.border}`
                )}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      {/* Icon with gradient background */}
                      <div className={cn("w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300", gradient)}>
                        <feature.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                      </div>
                      {/* Badge */}
                      <span className={cn("px-3 py-1 rounded-full text-xs font-bold shadow-md", colors.bg, colors.text)}>
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {feature.title}
                    </h3>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">{feature.description}</p>

                    {/* Call to action indicator */}
                    <div className={cn("flex items-center font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity", colors.text)}>
                      Saiba mais
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ITIL Processes Section
function ITILProcessesSection() {
  const processes = [
    {
      icon: AlertTriangle,
      title: "Gestao de Incidentes",
      description: "Restaure o servico normal o mais rapido possivel. Classificacao por impacto e urgencia, escalacao automatica e vinculo com CI afetado.",
      color: "red",
      features: ["Classificacao automatica", "Matriz de prioridade", "Escalacao SLA", "Major Incident"]
    },
    {
      icon: FileSearch,
      title: "Gestao de Problemas",
      description: "Identifique a causa raiz e previna recorrencias. KEDB (Known Error Database), analise de tendencias e vinculo com incidentes.",
      color: "orange",
      features: ["Analise de causa raiz", "Known Error DB", "Workaround", "Vinculo com incidentes"]
    },
    {
      icon: GitBranch,
      title: "Gestao de Mudancas",
      description: "Controle mudancas minimizando riscos. Tipos de mudanca (padrao, normal, emergencial), CAB, plano de retorno e calendario.",
      color: "purple",
      features: ["Fluxo de aprovacao", "CAB virtual", "Risk assessment", "Calendario de mudancas"]
    },
    {
      icon: ClipboardList,
      title: "Catalogo de Servicos",
      description: "Padronize requisicoes com formularios e aprovacoes. Portal de autoatendimento, SLAs por servico e fulfillment automatizado.",
      color: "blue",
      features: ["Portal self-service", "Formularios dinamicos", "Aprovacoes em cadeia", "SLA por item"]
    },
    {
      icon: Database,
      title: "CMDB e Ativos",
      description: "Mapeie relacionamentos entre itens de configuracao. Impacto de mudancas, dependencias e ciclo de vida de ativos.",
      color: "green",
      features: ["Mapa de dependencias", "Ciclo de vida", "Impacto analysis", "Integracao discovery"]
    },
    {
      icon: Activity,
      title: "Monitoramento e SLA",
      description: "Acompanhe metricas em tempo real. Dashboards COBIT, KPIs de governanca, audit trail e compliance reports.",
      color: "cyan",
      features: ["Dashboards COBIT", "KPIs personalizados", "Audit trail", "Compliance reports"]
    }
  ]

  const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    red: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600", border: "border-red-200 dark:border-red-800", gradient: "from-red-500 to-red-600" },
    orange: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600", border: "border-orange-200 dark:border-orange-800", gradient: "from-orange-500 to-orange-600" },
    purple: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600", border: "border-purple-200 dark:border-purple-800", gradient: "from-purple-500 to-purple-600" },
    blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600", border: "border-blue-200 dark:border-blue-800", gradient: "from-blue-500 to-blue-600" },
    green: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600", border: "border-green-200 dark:border-green-800", gradient: "from-green-500 to-green-600" },
    cyan: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600", border: "border-cyan-200 dark:border-cyan-800", gradient: "from-cyan-500 to-cyan-600" }
  }

  return (
    <section id="itil" className="py-16 sm:py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 mb-4"
          >
            <Layers className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              ITIL 4 e COBIT Compliant
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6"
          >
            Processos ITSM{" "}
            <span className="text-blue-600">Nivel Enterprise</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto"
          >
            Implementamos as melhores praticas ITIL 4 para garantir excelencia operacional.
            Da gestao de incidentes ate o catalogo de servicos, tudo integrado.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {processes.map((process, index) => {
            const colors = colorClasses[process.color]
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={cn(
                  "h-full hover:shadow-xl transition-all hover:-translate-y-1 border-l-4 overflow-hidden",
                  colors.border
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center", colors.bg)}>
                        <process.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", colors.text)} />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold flex-1">{process.title}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{process.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {process.features.map((feature, i) => (
                        <span key={i} className={cn("px-2 py-0.5 rounded text-xs font-medium", colors.bg, colors.text)}>
                          {feature}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* ITIL Compliance Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 sm:mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white"
        >
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 items-center">
            <div className="md:col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Pronto para Auditorias e Compliance</h3>
              <p className="text-blue-100 text-sm sm:text-base">
                Trilhas de auditoria completas, retencao de dados configuravel, conformidade LGPD e relatorios prontos para auditorias ISO 20000 e COBIT.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center md:justify-end">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">ISO 20000</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">COBIT 2019</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <Database className="w-5 h-5" />
                <span className="text-sm font-medium">LGPD</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// Pricing Section
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
        "SLAs basicos",
        "Base de conhecimento",
        "Relatorios essenciais"
      ],
      cta: "Comecar Gratis",
      popular: false,
      highlight: false,
      icon: Users
    },
    {
      name: "Essencial",
      description: "Times de suporte em crescimento",
      pricePerAgent: isYearly ? 89 : 109,
      period: isYearly ? "/agente/mes (anual)" : "/agente/mes",
      features: [
        "Ate 10 agentes",
        "Tickets ilimitados",
        "WhatsApp + E-mail + Portal",
        "SLA avancado com alertas",
        "Automacoes (ate 10 regras)",
        "Gestao de Incidentes ITIL",
        "Relatorios personalizados",
        "Suporte por chat"
      ],
      cta: "Teste Gratis 14 Dias",
      popular: false,
      highlight: false,
      icon: Zap
    },
    {
      name: "Profissional",
      description: "Service Desk corporativo completo",
      pricePerAgent: isYearly ? 149 : 179,
      period: isYearly ? "/agente/mes (anual)" : "/agente/mes",
      features: [
        "Ate 50 agentes",
        "Tudo do Essencial +",
        "Gestao de Problemas e Mudancas",
        "CMDB e Catalogo de Servicos",
        "IA para classificacao",
        "Automacoes ilimitadas",
        "API RESTful completa",
        "Integracao ERP/CRM",
        "Suporte 24/7"
      ],
      cta: "Teste Gratis 14 Dias",
      popular: true,
      highlight: true,
      icon: Award
    },
    {
      name: "Enterprise",
      description: "BPO, MSP ou grandes corporacoes",
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
      highlight: false,
      icon: Building2
    }
  ]

  return (
    <section id="precos" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-blue-600 font-semibold mb-4"
          >
            PLANOS E PRECOS
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
          >
            Escolha o Plano Ideal para{" "}
            <span className="text-blue-600">Sua Empresa</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground mb-8"
          >
            Comece gratuitamente e escale conforme seu crescimento
          </motion.p>

          <div className="flex items-center justify-center gap-4">
            <span className={cn("text-sm font-medium transition-colors", !isYearly ? "text-blue-600" : "text-muted-foreground")}>
              Mensal
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={cn(
                "relative w-14 h-7 rounded-full transition-colors",
                isYearly ? "bg-blue-600" : "bg-muted-foreground/30"
              )}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                animate={{ x: isYearly ? 28 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn("text-sm font-medium transition-colors", isYearly ? "text-blue-600" : "text-muted-foreground")}>
              Anual <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full ml-1">-17%</span>
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const PlanIcon = plan.icon
            const displayPrice = 'pricePerAgent' in plan ? plan.pricePerAgent : plan.price
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={cn(
                  "relative h-full flex flex-col",
                  plan.highlight && "border-blue-500 border-2 shadow-xl shadow-blue-500/10 scale-[1.02]"
                )}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-lg whitespace-nowrap">
                      Mais Popular
                    </div>
                  )}
                  <CardHeader className={cn("pb-3 sm:pb-4", plan.popular && "pt-6 sm:pt-8")}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        plan.highlight ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"
                      )}>
                        <PlanIcon className={cn(
                          "w-4 h-4",
                          plan.highlight ? "text-blue-600" : "text-muted-foreground"
                        )} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold">{plan.name}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-3 sm:mt-4">
                      {displayPrice !== null && displayPrice !== undefined ? (
                        <>
                          <span className="text-3xl sm:text-4xl font-bold">R${displayPrice}</span>
                          <span className="text-muted-foreground text-xs sm:text-sm ml-1">{plan.period}</span>
                        </>
                      ) : (
                        <span className="text-xl sm:text-2xl font-bold">Sob Consulta</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    <a href={displayPrice === 0 ? "/auth/register" : "#contato"} className="mb-4 sm:mb-6">
                      <Button
                        className={cn(
                          "w-full text-sm",
                          plan.highlight ? "bg-blue-600 hover:bg-blue-700" : ""
                        )}
                        variant={plan.highlight ? "primary" : "outline"}
                        size="sm"
                      >
                        {plan.cta}
                      </Button>
                    </a>
                    <ul className="space-y-2 sm:space-y-3 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Marcelo Ferreira",
      role: "Coordenador de Suporte TI",
      company: "Rede de Varejo - 180 lojas",
      segment: "Varejo",
      content: "Reduzimos o backlog de 340 para 45 chamados em 60 dias. A gestao de SLA com alertas automaticos e a base de conhecimento com sugestao de IA foram decisivos. NPS subiu de 42 para 78.",
      rating: 5,
      metrics: { sla: "94%", tma: "-55%", nps: "+36" }
    },
    {
      name: "Patricia Mendes",
      role: "Gerente de Service Desk",
      company: "Hospital Regional 500 leitos",
      segment: "Saude",
      content: "Em ambiente critico como saude, nao podemos ter falhas. O ServiceDesk Pro nos deu visibilidade total com dashboards em tempo real e escalacao automatica. Passamos na auditoria ISO 20000.",
      rating: 5,
      metrics: { sla: "98%", uptime: "99.9%", audit: "ISO" }
    },
    {
      name: "Ricardo Almeida",
      role: "Diretor de TI",
      company: "Industria Metalurgica - 2.500 func.",
      segment: "Industria",
      content: "A integracao com TOTVS e a gestao de mudancas nos permitiu controlar atualizacoes de ERP sem impactar producao. O CAB virtual reduziu reunioes de 4h para aprovacoes em 30min.",
      rating: 5,
      metrics: { changes: "Zero downtime", integracao: "TOTVS", cab: "-87%" }
    }
  ]

  return (
    <section id="depoimentos" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-blue-600 font-semibold mb-4"
          >
            DEPOIMENTOS
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
          >
            O que Nossos Clientes{" "}
            <span className="text-blue-600">Dizem</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Empresas de todos os tamanhos confiam no ServiceDesk Pro
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex gap-0.5">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      {testimonial.segment}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed italic">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>

                  {/* Metrics Row */}
                  <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                    {Object.entries(testimonial.metrics).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg px-2 py-1">
                        <span className="text-sm font-bold text-green-600">{value}</span>
                        <span className="text-xs text-green-700 dark:text-green-400 uppercase">{key}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3 sm:pt-4 border-t">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base truncate">{testimonial.name}</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{testimonial.role}</p>
                      <p className="text-xs text-blue-600 truncate">{testimonial.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats and Trust */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 sm:mt-16"
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">500+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Empresas Brasileiras</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">2M+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Tickets/Ano</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">98%</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Uptime SLA</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <div className="text-2xl sm:text-3xl font-bold text-orange-600">4.8</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Avaliacao Media</div>
            </div>
          </div>

          {/* Segments we serve */}
          <p className="text-sm text-muted-foreground text-center mb-4">Atendemos diversos segmentos</p>
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6">
            {[
              { icon: Building2, name: "Empresas" },
              { icon: Server, name: "TI/MSP" },
              { icon: Shield, name: "Financeiro" },
              { icon: Users, name: "Varejo" },
              { icon: Activity, name: "Saude" }
            ].map((segment, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                <segment.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{segment.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// CTA Section
function CTASection() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
          >
            Pronto para Transformar seu Suporte?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto"
          >
            Comece gratuitamente e descubra como o ServiceDesk Pro pode ajudar
            sua equipe a entregar um atendimento excepcional.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a href="/auth/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 h-14">
                Criar Conta Gratis <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <a href="#contato">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8 h-14">
                Agendar Demonstracao
              </Button>
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-sm text-blue-200"
          >
            Sem cartao de credito - Setup em menos de 5 minutos - Suporte em Portugues
          </motion.p>
        </div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  const footerLinks = {
    Produto: [
      { name: "Recursos", url: "#recursos" },
      { name: "Precos", url: "#precos" },
      { name: "Integracoes", url: "#integracoes" },
      { name: "API", url: "/docs/api" }
    ],
    Empresa: [
      { name: "Sobre", url: "/sobre" },
      { name: "Blog", url: "/blog" },
      { name: "Carreiras", url: "/carreiras" },
      { name: "Contato", url: "#contato" }
    ],
    Recursos: [
      { name: "Documentacao", url: "/docs" },
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
    <footer id="contato" className="bg-gray-900 text-gray-300 py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Headphones className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl text-white">ServiceDesk</span>
                <span className="text-xs text-gray-500 block -mt-1">Pro</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              A plataforma completa de Service Desk para transformar seu atendimento
              ao cliente e equipe de suporte.
            </p>
            <div className="space-y-2">
              <a
                href={formattedContacts.mailto.main}
                className="flex items-center gap-2 text-sm hover:text-blue-400 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>{contactInfo.email.main}</span>
              </a>
              <a
                href={`tel:${formattedContacts.tel.main}`}
                className="flex items-center gap-2 text-sm hover:text-blue-400 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>{contactInfo.phone.main}</span>
              </a>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4" />
                <span>{contactInfo.address.city}, {contactInfo.address.country}</span>
              </div>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.url}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} ServiceDesk Pro. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a
              href={contactInfo.social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href={formattedContacts.whatsapp.support}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a
              href={contactInfo.social.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-sky-500 transition-colors"
              aria-label="Twitter"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
export default function LandingClient() {
  const navItems = [
    { name: 'Inicio', url: '#inicio' },
    { name: 'Funcionalidades', url: '#recursos' },
    { name: 'ITIL', url: '#itil' },
    { name: 'Planos', url: '#precos' },
    { name: 'Clientes', url: '#depoimentos' }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar items={navItems} />
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
