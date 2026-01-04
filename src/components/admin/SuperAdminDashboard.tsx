'use client'

import React, { useState, useEffect } from 'react'
import {
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    ServerIcon,
    UserGroupIcon,
    ArrowTrendingUpIcon,
    EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, tenantsRes] = await Promise.all([
                    fetch('/api/admin/super/stats'),
                    fetch('/api/admin/super/tenants')
                ]);

                if (statsRes.ok) setStats(await statsRes.json());
                if (tenantsRes.ok) setTenants(await tenantsRes.json());
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-neutral-500">Carregando dashboard...</div>;

    const statCards = [
        { name: 'Total de Tenants', value: stats?.totalTenants || 0, change: '+12%', icon: BuildingOfficeIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { name: 'Receita Mensal (MRR)', value: `R$ ${stats?.mrr || 0}`, change: '+8.2%', icon: CurrencyDollarIcon, color: 'text-green-500', bg: 'bg-green-500/10' },
        { name: 'Usuários Ativos', value: stats?.activeUsers || 0, change: '+24%', icon: UserGroupIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { name: 'Saúde do Sistema', value: `${stats?.systemHealth || 0}%`, change: 'Estável', icon: ServerIcon, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Visão Geral do Sistema</h1>
                    <p className="text-muted-content">Gerencie todos os tenants e monitore a saúde da plataforma.</p>
                </div>
                <button className="btn btn-primary">
                    Novo Tenant
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <div key={stat.name} className="glass-panel p-6 rounded-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-100 transition-opacity`} />
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-medium text-muted-content">{stat.name}</p>
                                <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-2">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm relative z-10">
                            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                            <span className="text-green-500 font-medium">{stat.change}</span>
                            <span className="text-muted-content ml-2">vs mês anterior</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Tenants Table */}
            <div className="glass-panel rounded-xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Tenants Recentes</h3>
                    <button className="text-sm text-primary hover:text-primary/80">Ver todos</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-neutral-50/50 dark:bg-neutral-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">Empresa</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">Plano</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">Entrou em</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-content uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {tenants.map((tenant) => (
                                <tr key={tenant.slug} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20">
                                                {tenant.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-neutral-900 dark:text-white">{tenant.name}</div>
                                                <div className="text-sm text-muted-content">{tenant.slug}.servicedesk.com</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                                            {tenant.subscription_plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${tenant.subscription_status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            tenant.subscription_status === 'trial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {tenant.subscription_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-content">
                                        {new Date(tenant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                                            <EllipsisHorizontalIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
