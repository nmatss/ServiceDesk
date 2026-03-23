'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Cog6ToothIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type TabKey = 'geral' | 'limites' | 'email' | 'seguranca';

interface SystemSettings {
  system_name: string;
  base_url: string;
  maintenance_mode: boolean;
  max_organizations: number;
  default_max_users_per_org: number;
  default_max_tickets_per_org: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from_email: string;
  smtp_from_name: string;
  password_min_length: number;
  session_timeout_minutes: number;
  require_2fa: boolean;
  max_login_attempts: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  system_name: 'Insighta',
  base_url: 'http://localhost:3000',
  maintenance_mode: false,
  max_organizations: 100,
  default_max_users_per_org: 50,
  default_max_tickets_per_org: 1000,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_from_email: '',
  smtp_from_name: 'Insighta',
  password_min_length: 8,
  session_timeout_minutes: 60,
  require_2fa: false,
  max_login_attempts: 5,
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'limites', label: 'Limites' },
  { key: 'email', label: 'Email / SMTP' },
  { key: 'seguranca', label: 'Segurança' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('geral');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/super/settings');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSettings({ ...DEFAULT_SETTINGS, ...json.data });
        }
      }
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function updateField<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/super/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Falha ao salvar');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...json.data });
      }
      toast.success('Configurações salvas com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Configurações do Sistema"
          description="Configurações globais do Insighta"
          icon={Cog6ToothIcon}
        />
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Configurações globais do Insighta"
        icon={Cog6ToothIcon}
      />

      {/* Tab navigation */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="flex flex-wrap gap-0 -mb-px" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-6">
        {activeTab === 'geral' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Configurações Gerais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Nome do Sistema"
                name="system_name"
                value={settings.system_name}
                onChange={(e) => updateField('system_name', e.target.value)}
                placeholder="Insighta"
              />
              <FormField
                label="URL Base"
                name="base_url"
                value={settings.base_url}
                onChange={(e) => updateField('base_url', e.target.value)}
                placeholder="https://seudominio.com"
                helpText="URL principal de acesso ao sistema"
              />
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenance_mode}
                  onChange={(e) => updateField('maintenance_mode', e.target.checked)}
                  className="h-5 w-5 rounded border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-500 dark:bg-neutral-900"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Modo de Manutenção</span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Quando ativo, apenas administradores podem acessar o sistema
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'limites' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Limites Globais</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                label="Máximo de Organizações"
                name="max_organizations"
                type="number"
                value={settings.max_organizations}
                onChange={(e) => updateField('max_organizations', parseInt(e.target.value, 10) || 0)}
                helpText="Número máximo de organizações no sistema"
              />
              <FormField
                label="Usuários por Organização"
                name="default_max_users_per_org"
                type="number"
                value={settings.default_max_users_per_org}
                onChange={(e) => updateField('default_max_users_per_org', parseInt(e.target.value, 10) || 0)}
                helpText="Limite padrão para novas organizações"
              />
              <FormField
                label="Tickets por Organização"
                name="default_max_tickets_per_org"
                type="number"
                value={settings.default_max_tickets_per_org}
                onChange={(e) => updateField('default_max_tickets_per_org', parseInt(e.target.value, 10) || 0)}
                helpText="Limite mensal padrão para novas organizações"
              />
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Configurações de Email / SMTP</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Servidor SMTP"
                name="smtp_host"
                value={settings.smtp_host}
                onChange={(e) => updateField('smtp_host', e.target.value)}
                placeholder="smtp.gmail.com"
              />
              <FormField
                label="Porta SMTP"
                name="smtp_port"
                type="number"
                value={settings.smtp_port}
                onChange={(e) => updateField('smtp_port', parseInt(e.target.value, 10) || 587)}
              />
              <FormField
                label="Usuário SMTP"
                name="smtp_user"
                value={settings.smtp_user}
                onChange={(e) => updateField('smtp_user', e.target.value)}
                placeholder="usuario@exemplo.com"
              />
              <FormField
                label="E-mail de Envio"
                name="smtp_from_email"
                type="email"
                value={settings.smtp_from_email}
                onChange={(e) => updateField('smtp_from_email', e.target.value)}
                placeholder="noreply@exemplo.com"
              />
              <FormField
                label="Nome do Remetente"
                name="smtp_from_name"
                value={settings.smtp_from_name}
                onChange={(e) => updateField('smtp_from_name', e.target.value)}
                placeholder="Insighta"
              />
            </div>
          </div>
        )}

        {activeTab === 'seguranca' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Políticas de Segurança</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                label="Tamanho Mínimo de Senha"
                name="password_min_length"
                type="number"
                value={settings.password_min_length}
                onChange={(e) => updateField('password_min_length', parseInt(e.target.value, 10) || 8)}
                helpText="Mínimo de 4, máximo de 128 caracteres"
              />
              <FormField
                label="Timeout de Sessão (min)"
                name="session_timeout_minutes"
                type="number"
                value={settings.session_timeout_minutes}
                onChange={(e) => updateField('session_timeout_minutes', parseInt(e.target.value, 10) || 60)}
                helpText="Tempo de inatividade antes do logout"
              />
              <FormField
                label="Máximo de Tentativas de Login"
                name="max_login_attempts"
                type="number"
                value={settings.max_login_attempts}
                onChange={(e) => updateField('max_login_attempts', parseInt(e.target.value, 10) || 5)}
                helpText="Antes do bloqueio temporário da conta"
              />
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.require_2fa}
                  onChange={(e) => updateField('require_2fa', e.target.checked)}
                  className="h-5 w-5 rounded border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-500 dark:bg-neutral-900"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Exigir Autenticação de Dois Fatores</span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Todos os usuários deverão configurar 2FA para acessar o sistema
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          loadingText="Salvando..."
          leftIcon={<CheckIcon className="h-5 w-5" />}
        >
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
