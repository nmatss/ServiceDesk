'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    BuildingOfficeIcon,
    UserIcon,
    SwatchIcon,
    CheckCircleIcon,
    ArrowRightIcon,
    ArrowLeftIcon
} from '@heroicons/react/24/outline'

export default function TenantOnboarding() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        companyName: '',
        slug: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        primaryColor: '#6366f1',
        logo: null as File | null
    })

    const handleNext = () => setStep(step + 1)
    const handleBack = () => setStep(step - 1)

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/saas/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                router.push('/auth/login?onboarding=success');
            } else {
                const data = await response.json();
                alert(data.error || 'Erro ao criar conta');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Progress Steps */}
            <div className="mb-12">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-white/10 rounded-full -z-10" />
                    {[1, 2, 3, 4].map((s) => (
                        <div
                            key={s}
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step >= s
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                                : 'bg-neutral-900 border-white/10 text-neutral-500'
                                }`}
                        >
                            {step > s ? <CheckCircleIcon className="w-6 h-6" /> : s}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-sm text-neutral-400">
                    <span>Empresa</span>
                    <span>Administrador</span>
                    <span>Personalização</span>
                    <span>Confirmação</span>
                </div>
            </div>

            {/* Form Content */}
            <div className="glass-panel p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                {step === 1 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <BuildingOfficeIcon className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Dados da Empresa</h2>
                            <p className="text-neutral-400">Comece configurando seu ambiente exclusivo.</p>
                        </div>

                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Nome da Empresa</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="Ex: Acme Corp"
                                    value={formData.companyName}
                                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">URL do Ambiente (Slug)</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-white/10 bg-white/5 text-neutral-400">
                                        servicedesk.com/
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-r-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        placeholder="acme"
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <UserIcon className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Administrador</h2>
                            <p className="text-neutral-400">Crie a conta do super administrador.</p>
                        </div>

                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="Seu nome"
                                    value={formData.adminName}
                                    onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">E-mail Corporativo</label>
                                <input
                                    type="email"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="admin@empresa.com"
                                    value={formData.adminEmail}
                                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Senha</label>
                                <input
                                    type="password"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    value={formData.adminPassword}
                                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <SwatchIcon className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Personalização</h2>
                            <p className="text-neutral-400">Deixe o sistema com a cara da sua empresa.</p>
                        </div>

                        <div className="grid gap-8">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-4">Cor Principal</label>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="color"
                                        className="w-16 h-16 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
                                        value={formData.primaryColor}
                                        onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                    />
                                    <div className="flex-1">
                                        <div
                                            className="h-24 rounded-xl flex items-center justify-center text-white font-medium shadow-lg transition-colors"
                                            style={{ backgroundColor: formData.primaryColor }}
                                        >
                                            Preview do Botão
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="text-center animate-fade-in py-8">
                        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-in">
                            <CheckCircleIcon className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">Tudo Pronto!</h2>
                        <p className="text-neutral-400 max-w-md mx-auto mb-8">
                            Vamos criar seu ambiente <strong>{formData.companyName}</strong>.
                            Você receberá um e-mail com os detalhes de acesso.
                        </p>

                        <div className="bg-white/5 rounded-xl p-6 max-w-sm mx-auto mb-8 text-left border border-white/10">
                            <div className="flex justify-between mb-2">
                                <span className="text-neutral-400">Empresa:</span>
                                <span className="text-white">{formData.companyName}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-neutral-400">URL:</span>
                                <span className="text-primary">{formData.slug}.servicedesk.com</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-400">Admin:</span>
                                <span className="text-white">{formData.adminEmail}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-12 pt-6 border-t border-white/10">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center px-6 py-3 text-neutral-400 hover:text-white transition-colors"
                        >
                            <ArrowLeftIcon className="w-4 h-4 mr-2" />
                            Voltar
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 4 ? (
                        <button
                            onClick={handleNext}
                            className="flex items-center px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/20 transition-all hover:scale-105"
                        >
                            Próximo
                            <ArrowRightIcon className="w-4 h-4 ml-2" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex items-center px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium shadow-lg shadow-green-600/20 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            ) : (
                                <CheckCircleIcon className="w-5 h-5 mr-2" />
                            )}
                            {loading ? 'Criando Ambiente...' : 'Finalizar Setup'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
