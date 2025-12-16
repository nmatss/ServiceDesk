/**
 * WhatsApp Business API Configuration Component
 * Admin interface for managing WhatsApp integration settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface WhatsAppTemplate {
  id?: number;
  name: string;
  category: string;
  language: string;
  status: string;
  components: any[];
}

interface WhatsAppStats {
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  uniqueContacts: number;
  ticketsCreated: number;
  avgResponseTime: number;
}

export function WhatsAppConfig() {
  const [config, setConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: '',
    apiVersion: 'v18.0',
  });

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [_showTemplateModal, _setShowTemplateModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');

  useEffect(() => {
    loadConfiguration();
    loadTemplates();
    loadStats();
  }, []);

  const loadConfiguration = async () => {
    try {
      // Load from system settings
      const response = await fetch('/api/admin/settings?category=whatsapp');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setConfig({
            phoneNumberId: data.settings.whatsapp_phone_number_id || '',
            accessToken: data.settings.whatsapp_access_token ? '••••••••' : '',
            businessAccountId: data.settings.whatsapp_business_account_id || '',
            webhookVerifyToken: data.settings.whatsapp_webhook_verify_token ? '••••••••' : '',
            apiVersion: data.settings.whatsapp_api_version || 'v18.0',
          });

          if (data.settings.whatsapp_access_token) {
            setConnectionStatus('connected');
          }
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/integrations/whatsapp/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/integrations/whatsapp/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            whatsapp_phone_number_id: config.phoneNumberId,
            whatsapp_access_token: config.accessToken.includes('••') ? undefined : config.accessToken,
            whatsapp_business_account_id: config.businessAccountId,
            whatsapp_webhook_verify_token: config.webhookVerifyToken.includes('••')
              ? undefined
              : config.webhookVerifyToken,
            whatsapp_api_version: config.apiVersion,
          },
        }),
      });

      if (response.ok) {
        alert('Configuração salva com sucesso!');
        setConnectionStatus('connected');
      } else {
        alert('Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setConnectionStatus('testing');

    try {
      const response = await fetch('/api/integrations/whatsapp/test', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.connected ? 'connected' : 'disconnected');
        alert(data.connected ? 'Conexão bem-sucedida!' : 'Falha na conexão: ' + data.error);
      } else {
        setConnectionStatus('disconnected');
        alert('Falha ao testar conexão');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('disconnected');
      alert('Erro ao testar conexão');
    } finally {
      setTestLoading(false);
    }
  };

  const handleRegisterPredefinedTemplates = async () => {
    if (!confirm('Deseja registrar todos os templates predefinidos? Isso pode levar alguns minutos.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/integrations/whatsapp/templates/register', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(
          `Templates registrados:\n✅ Sucesso: ${data.summary.success}\n❌ Falhas: ${data.summary.failed}\n\nOs templates estarão disponíveis após aprovação do WhatsApp.`
        );
        loadTemplates();
      } else {
        alert('Erro ao registrar templates');
      }
    } catch (error) {
      console.error('Error registering templates:', error);
      alert('Erro ao registrar templates');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'text-green-600 bg-green-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      case 'REJECTED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      TRANSACTIONAL: 'bg-blue-100 text-blue-800',
      MARKETING: 'bg-purple-100 text-purple-800',
      AUTHENTICATION: 'bg-green-100 text-green-800',
      UTILITY: 'bg-gray-100 text-gray-800',
    };

    return colors[category] || colors.UTILITY;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Integração WhatsApp Business</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure a integração com WhatsApp Business API para receber e enviar mensagens
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div
            className={`h-3 w-3 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'testing'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {connectionStatus === 'connected'
              ? 'Conectado'
              : connectionStatus === 'testing'
              ? 'Testando...'
              : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total de Mensagens</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.totalMessages.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Contatos Únicos</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.uniqueContacts.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Chamados Criados</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.ticketsCreated.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Configuração da API</h3>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="phoneNumberId" className="block text-sm font-medium text-gray-700">
                Phone Number ID
              </label>
              <Input
                id="phoneNumberId"
                type="text"
                value={config.phoneNumberId}
                onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                placeholder="123456789012345"
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">ID do número de telefone no WhatsApp Business Manager</p>
            </div>

            <div>
              <label htmlFor="businessAccountId" className="block text-sm font-medium text-gray-700">
                Business Account ID
              </label>
              <Input
                id="businessAccountId"
                type="text"
                value={config.businessAccountId}
                onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                placeholder="123456789012345"
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">ID da conta de negócios no WhatsApp Business Manager</p>
            </div>

            <div>
              <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                Access Token
              </label>
              <Input
                id="accessToken"
                type="password"
                value={config.accessToken}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                placeholder="EAAxxxxxxxxxx"
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">Token de acesso permanente da WhatsApp Cloud API</p>
            </div>

            <div>
              <label htmlFor="webhookVerifyToken" className="block text-sm font-medium text-gray-700">
                Webhook Verify Token
              </label>
              <Input
                id="webhookVerifyToken"
                type="password"
                value={config.webhookVerifyToken}
                onChange={(e) => setConfig({ ...config, webhookVerifyToken: e.target.value })}
                placeholder="my_secure_token_123"
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">Token para verificação do webhook (você define este valor)</p>
            </div>

            <div>
              <label htmlFor="apiVersion" className="block text-sm font-medium text-gray-700">
                API Version
              </label>
              <Input
                id="apiVersion"
                type="text"
                value={config.apiVersion}
                onChange={(e) => setConfig({ ...config, apiVersion: e.target.value })}
                placeholder="v18.0"
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">Versão da API do WhatsApp Business (padrão: v18.0)</p>
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <Button onClick={handleSaveConfiguration} loading={loading}>
              Salvar Configuração
            </Button>
            <Button onClick={handleTestConnection} variant="secondary" loading={testLoading}>
              Testar Conexão
            </Button>
          </div>
        </div>
      </div>

      {/* Webhook Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">📡 Configuração do Webhook</h4>
        <p className="text-sm text-blue-800 mb-2">Configure o webhook no WhatsApp Business Manager com:</p>
        <div className="bg-white rounded border border-blue-200 p-3 space-y-2">
          <div>
            <span className="text-xs font-medium text-blue-900">URL do Callback:</span>
            <code className="block mt-1 text-xs bg-blue-50 p-2 rounded border border-blue-200">
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}
              /api/integrations/whatsapp/webhook
            </code>
          </div>
          <div>
            <span className="text-xs font-medium text-blue-900">Token de Verificação:</span>
            <code className="block mt-1 text-xs bg-blue-50 p-2 rounded border border-blue-200">
              {config.webhookVerifyToken || '[Configure o token acima]'}
            </code>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Message Templates</h3>
            <Button onClick={handleRegisterPredefinedTemplates} variant="secondary" size="sm">
              Registrar Templates Padrão
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Idioma
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      Nenhum template cadastrado. Clique em "Registrar Templates Padrão" para começar.
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {template.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadge(template.category)}`}>
                          {template.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.language}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(template.status)}`}>
                          {template.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppConfig;
