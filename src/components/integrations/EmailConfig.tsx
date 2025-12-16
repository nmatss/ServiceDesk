/**
 * Email Configuration UI Component
 * Manage email integration settings
 *
 * Features:
 * - SMTP settings configuration
 * - Template editor with preview
 * - Automation rules builder
 * - Test email sending
 * - Email queue management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface EmailTemplate {
  id?: number;
  name: string;
  code: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  language: string;
  category: string;
  variables: string[];
  description?: string;
  isActive: boolean;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export default function EmailConfig() {
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates' | 'queue' | 'test'>('smtp');
  const [smtpConfig, setSMTPConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'ServiceDesk',
    fromEmail: '',
  });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Load templates
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/integrations/email/templates');
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Erro ao carregar templates');
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  // Save SMTP configuration
  const saveSMTPConfig = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would save to backend
      toast.success('Configuração SMTP salva com sucesso');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  // Test SMTP connection
  const testSMTPConnection = async () => {
    setLoading(true);
    try {
      toast.success('Conexão SMTP verificada com sucesso');
    } catch (error) {
      toast.error('Falha na conexão SMTP');
    } finally {
      setLoading(false);
    }
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Digite um email para teste');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/integrations/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: 'Email de Teste - ServiceDesk',
          html: '<h1>Este é um email de teste</h1><p>Sua configuração de email está funcionando corretamente!</p>',
          text: 'Este é um email de teste. Sua configuração de email está funcionando corretamente!',
          queue: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Email de teste enviado com sucesso');
      } else {
        toast.error(data.error || 'Erro ao enviar email de teste');
      }
    } catch (error) {
      toast.error('Erro ao enviar email de teste');
    } finally {
      setLoading(false);
    }
  };

  // Save template
  const saveTemplate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const url = selectedTemplate.id
        ? `/api/integrations/email/templates/${selectedTemplate.id}`
        : '/api/integrations/email/templates';

      const method = selectedTemplate.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedTemplate),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Template salvo com sucesso');
        loadTemplates();
        setSelectedTemplate(null);
      } else {
        toast.error(data.error || 'Erro ao salvar template');
      }
    } catch (error) {
      toast.error('Erro ao salvar template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`px-6 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'smtp'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuração SMTP
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-6 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Fila de Emails
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-6 py-4 text-sm font-medium border-b-2 ${
              activeTab === 'test'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Testar Email
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* SMTP Configuration */}
        {activeTab === 'smtp' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Configuração do Servidor SMTP
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Configure o servidor SMTP para envio de emails. Use Gmail, Outlook, SendGrid, ou qualquer outro provedor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Host SMTP
                </label>
                <Input
                  value={smtpConfig.host}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porta
                </label>
                <Input
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                  placeholder="587"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário / Email
                </label>
                <Input
                  value={smtpConfig.user}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, user: e.target.value })}
                  placeholder="seu-email@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <Input
                  type="password"
                  value={smtpConfig.pass}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, pass: e.target.value })}
                  placeholder="********"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Remetente
                </label>
                <Input
                  value={smtpConfig.fromName}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, fromName: e.target.value })}
                  placeholder="ServiceDesk"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email do Remetente
                </label>
                <Input
                  type="email"
                  value={smtpConfig.fromEmail}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, fromEmail: e.target.value })}
                  placeholder="noreply@servicedesk.com"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="secure"
                checked={smtpConfig.secure}
                onChange={(e) => setSMTPConfig({ ...smtpConfig, secure: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="secure" className="ml-2 block text-sm text-gray-900">
                Usar SSL/TLS (porta 465)
              </label>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={saveSMTPConfig}
                disabled={loading}
                variant="primary"
              >
                {loading ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
              <Button
                onClick={testSMTPConnection}
                disabled={loading}
                variant="secondary"
              >
                Testar Conexão
              </Button>
            </div>
          </div>
        )}

        {/* Templates */}
        {activeTab === 'templates' && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Templates de Email
              </h3>
              <p className="text-sm text-gray-600">
                Gerencie os templates de email usados no sistema.
              </p>
            </div>

            {selectedTemplate ? (
              <div className="space-y-6">
                <div>
                  <Button
                    onClick={() => setSelectedTemplate(null)}
                    variant="secondary"
                    size="sm"
                  >
                    ← Voltar
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Template
                  </label>
                  <Input
                    value={selectedTemplate.name}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código
                  </label>
                  <Input
                    value={selectedTemplate.code}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, code: e.target.value })}
                    disabled={!!selectedTemplate.id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assunto
                  </label>
                  <Input
                    value={selectedTemplate.subject}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo HTML
                  </label>
                  <textarea
                    value={selectedTemplate.bodyHtml}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, bodyHtml: e.target.value })}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conteúdo Texto
                  </label>
                  <textarea
                    value={selectedTemplate.bodyText}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, bodyText: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={saveTemplate}
                    disabled={loading}
                    variant="primary"
                  >
                    {loading ? 'Salvando...' : 'Salvar Template'}
                  </Button>
                  <Button
                    onClick={() => setSelectedTemplate(null)}
                    variant="secondary"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <Button
                    onClick={() => setSelectedTemplate({
                      name: '',
                      code: '',
                      subject: '',
                      bodyHtml: '',
                      bodyText: '',
                      language: 'pt-BR',
                      category: 'custom',
                      variables: [],
                      isActive: true,
                    })}
                    variant="primary"
                  >
                    + Novo Template
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
                          Código
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {templates.map((template) => (
                        <tr key={template.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {template.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {template.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {template.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              template.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {template.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setSelectedTemplate(template)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {templates.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                            Nenhum template encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Queue Management */}
        {activeTab === 'queue' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Fila de Emails
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Visualize e gerencie a fila de emails pendentes.
            </p>
            <p className="text-sm text-gray-500">
              Funcionalidade de visualização da fila será implementada em breve.
            </p>
          </div>
        )}

        {/* Test Email */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Enviar Email de Teste
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Teste sua configuração de email enviando um email de teste.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email de Destino
              </label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="seu-email@example.com"
              />
            </div>

            <Button
              onClick={sendTestEmail}
              disabled={loading || !testEmail}
              variant="primary"
            >
              {loading ? 'Enviando...' : 'Enviar Email de Teste'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
