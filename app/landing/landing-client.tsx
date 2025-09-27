'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  StarIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export default function LandingClient() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const features = [
    {
      icon: <ChartBarIcon className="h-8 w-8" />,
      title: 'Dashboard Inteligente',
      description: 'Visualize métricas em tempo real e acompanhe o desempenho da sua equipe com gráficos interativos.'
    },
    {
      icon: <ClockIcon className="h-8 w-8" />,
      title: 'Gestão de SLA',
      description: 'Controle rigoroso de prazos e tempos de resposta para garantir a qualidade do atendimento.'
    },
    {
      icon: <ShieldCheckIcon className="h-8 w-8" />,
      title: 'Segurança Avançada',
      description: 'Proteção de dados com criptografia e controle de acesso baseado em funções.'
    },
    {
      icon: <UserGroupIcon className="h-8 w-8" />,
      title: 'Colaboração em Equipe',
      description: 'Facilite a comunicação entre agentes e compartilhe conhecimento eficientemente.'
    }
  ]

  const stats = [
    { label: 'Tickets Resolvidos', value: '50K+' },
    { label: 'Empresas Ativas', value: '500+' },
    { label: 'Satisfação', value: '98%' },
    { label: 'Tempo Médio', value: '2h' }
  ]

  const testimonials = [
    {
      name: 'Maria Silva',
      role: 'Gerente de TI',
      company: 'TechCorp',
      content: 'O ServiceDesk revolucionou nossa gestão de tickets. Reduzimos o tempo de resposta em 60%.',
      rating: 5
    },
    {
      name: 'João Santos',
      role: 'CEO',
      company: 'InnovaCorp',
      content: 'Interface intuitiva e recursos poderosos. Nossa equipe aumentou a produtividade significativamente.',
      rating: 5
    },
    {
      name: 'Ana Costa',
      role: 'Diretora de Operações',
      company: 'GlobalTech',
      content: 'Excelente ferramenta para gestão de suporte. Recomendo para qualquer empresa.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-brand-600">ServiceDesk Pro</h1>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#features" className="text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Recursos
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Preços
                </a>
                <a href="#about" className="text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Sobre
                </a>
                <a href="#contact" className="text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Contato
                </a>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Entrar
              </Link>
              <Link href="/register" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                Começar Grátis
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-brand-600 p-2"
              >
                {isMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <a href="#features" className="block text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-base font-medium">
                  Recursos
                </a>
                <a href="#pricing" className="block text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-base font-medium">
                  Preços
                </a>
                <a href="#about" className="block text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-base font-medium">
                  Sobre
                </a>
                <a href="#contact" className="block text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-base font-medium">
                  Contato
                </a>
                <div className="border-t border-gray-200 pt-4">
                  <Link href="/login" className="block text-gray-600 hover:text-brand-600 px-3 py-2 rounded-md text-base font-medium">
                    Entrar
                  </Link>
                  <Link href="/register" className="block bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-md text-base font-medium mt-2">
                    Começar Grátis
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-50 to-brand-100 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
            <div className="lg:col-span-6">
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block">Sistema Completo de</span>
                <span className="block text-brand-600">Atendimento ao Cliente</span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 max-w-3xl">
                Como posso te ajudar com atendimento ao cliente? O ServiceDesk Pro oferece gestão completa de tickets, SLA automático e relatórios avançados. Ideal para empresas que buscam excelência no suporte.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 transition-colors">
                  Começar Grátis
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Link>
                <Link href="/portal" className="inline-flex items-center justify-center px-8 py-4 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                  <PlayCircleIcon className="mr-2 h-5 w-5" />
                  Portal do Cliente
                </Link>
              </div>

              <div className="mt-8 flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Setup em 5 minutos
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Suporte 24/7
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  30 dias grátis
                </div>
              </div>
            </div>

            <div className="mt-16 lg:mt-0 lg:col-span-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-brand-600 rounded-lg transform rotate-3"></div>
                <div className="relative bg-white rounded-lg shadow-2xl p-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-800">Ticket #1234 - Resolvido</span>
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm font-medium text-yellow-800">Ticket #1235 - Em Andamento</span>
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-blue-800">Ticket #1236 - Novo</span>
                      <ArrowRightIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-brand-600">{stat.value}</div>
                <div className="mt-2 text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Recursos Poderosos
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600">
              Tudo que você precisa para gerenciar seu atendimento de forma eficiente
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-brand-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}, {testimonial.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-brand-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="mt-4 text-xl text-brand-100">
            Junte-se às empresas que já transformaram seu atendimento com o ServiceDesk Pro
          </p>
          <div className="mt-8">
            <Link href="/register" className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-brand-600 bg-white hover:bg-gray-50 transition-colors">
              Começar Agora - É Grátis
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">ServiceDesk Pro</h3>
              <p className="text-gray-400">
                Sistema completo de ServiceDesk para gestão de tickets, atendimento ao cliente e suporte técnico.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Produto</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Recursos</a></li>
                <li><a href="/knowledge" className="text-gray-400 hover:text-white transition-colors">Base de Conhecimento</a></li>
                <li><a href="/portal" className="text-gray-400 hover:text-white transition-colors">Portal do Cliente</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Empresa</h4>
              <ul className="space-y-2">
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">Sobre</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contato</a></li>
                <li><a href="/login" className="text-gray-400 hover:text-white transition-colors">Login</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Suporte</h4>
              <ul className="space-y-2">
                <li><a href="/knowledge" className="text-gray-400 hover:text-white transition-colors">Central de Ajuda</a></li>
                <li><a href="/portal" className="text-gray-400 hover:text-white transition-colors">Abrir Ticket</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2024 ServiceDesk Pro. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}