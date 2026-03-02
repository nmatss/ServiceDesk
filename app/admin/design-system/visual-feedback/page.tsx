'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  InteractiveButton,
  InteractiveLink,
  InteractiveCard,
  FormLoadingOverlay,
  ActionFeedback,
  ProgressIndicator,
  useRipple,
} from '@/components/ui/visual-feedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { customToast } from '@/components/ui/toast';
import { InlineSpinner, ButtonLoading } from '@/components/ui/loading-states';

export default function VisualFeedbackShowcase() {
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [buttonSuccess, setButtonSuccess] = useState(false);
  const [buttonError, setButtonError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormLoading(true);
    customToast.loading('Processando sua solicitação...');

    setTimeout(() => {
      setIsFormLoading(false);
      customToast.dismiss();
      customToast.success('Formulário enviado com sucesso!');
    }, 2000);
  };

  const handleButtonClick = (type: 'success' | 'error') => {
    if (type === 'success') {
      setButtonSuccess(true);
      customToast.success('Ação concluída!');
    } else {
      setButtonError(true);
      customToast.error('Algo deu errado!');
    }
  };

  const handleProgressSimulation = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          customToast.success('Processo concluído!');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Sistema de Feedback Visual
          </h1>
          <p className="text-lg text-description max-w-2xl mx-auto">
            Demonstração completa de componentes interativos com estados de carregamento, efeitos hover
            e mecanismos de feedback ao usuário.
          </p>
        </div>

        {/* Interactive Buttons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Botões Interativos com Efeito Ripple</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Variantes de Botão
              </h3>
              <div className="flex flex-wrap gap-3">
                <InteractiveButton variant="primary">Primário</InteractiveButton>
                <InteractiveButton variant="secondary">Secundário</InteractiveButton>
                <InteractiveButton variant="outline">Contorno</InteractiveButton>
                <InteractiveButton variant="ghost">Fantasma</InteractiveButton>
                <InteractiveButton variant="destructive">Destrutivo</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Tamanhos de Botão
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <InteractiveButton size="sm">Pequeno</InteractiveButton>
                <InteractiveButton size="md">Médio</InteractiveButton>
                <InteractiveButton size="lg">Grande</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Estados do Botão
              </h3>
              <div className="flex flex-wrap gap-3">
                <InteractiveButton loading>Carregando</InteractiveButton>
                <InteractiveButton
                  success={buttonSuccess}
                  onClick={() => handleButtonClick('success')}
                >
                  Clique para Sucesso
                </InteractiveButton>
                <InteractiveButton
                  error={buttonError}
                  variant="destructive"
                  onClick={() => handleButtonClick('error')}
                >
                  Clique para Erro
                </InteractiveButton>
                <InteractiveButton disabled>Desabilitado</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Botão Padrão com Estados de Carregamento
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button loading>Processando...</Button>
                <ButtonLoading isLoading={false}>Enviar Formulário</ButtonLoading>
                <ButtonLoading isLoading={true}>Salvando...</ButtonLoading>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Links Section */}
        <Card>
          <CardHeader>
            <CardTitle>Links Interativos com Efeitos Hover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Variantes de Link
                </h3>
                <div className="flex flex-wrap gap-6">
                  <InteractiveLink href="#" variant="default" showIcon>
                    Link Padrão
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="underline">
                    Link Sublinhado
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="subtle">
                    Link Sutil
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="bold">
                    Link Negrito
                  </InteractiveLink>
                  <InteractiveLink href="https://example.com" external>
                    Link Externo
                  </InteractiveLink>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form with Loading Overlay */}
        <Card>
          <CardHeader>
            <CardTitle>Formulário com Overlay de Carregamento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="relative space-y-4">
              <FormLoadingOverlay isLoading={isFormLoading} message="Enviando seus dados..." />

              <Input label="Nome Completo" placeholder="Digite seu nome" required />

              <Input label="Email" type="email" placeholder="seu.email@exemplo.com" required />

              <Input
                label="Telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                description="Nunca compartilharemos seu telefone"
              />

              <div className="flex gap-3">
                <Button type="submit" disabled={isFormLoading}>
                  Enviar Formulário
                </Button>
                <Button type="button" variant="outline" disabled={isFormLoading}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Interactive Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Cards Interativos com Efeitos Hover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InteractiveCard clickable onClick={() => customToast.info('Card clicado!')}>
                <h3 className="text-lg font-semibold mb-2">Card Padrão</h3>
                <p className="text-sm text-description">
                  Clique para ver o feedback de interação!
                </p>
              </InteractiveCard>

              <InteractiveCard variant="elevated" clickable>
                <h3 className="text-lg font-semibold mb-2">Card Elevado</h3>
                <p className="text-sm text-description">
                  Este card tem efeito de sombra elevada ao passar o mouse.
                </p>
              </InteractiveCard>

              <InteractiveCard variant="outline" clickable>
                <h3 className="text-lg font-semibold mb-2">Card Contorno</h3>
                <p className="text-sm text-description">
                  Este card tem estilo de contorno com animação hover.
                </p>
              </InteractiveCard>
            </div>
          </CardContent>
        </Card>

        {/* Progress Indicators */}
        <Card>
          <CardHeader>
            <CardTitle>Indicadores de Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <ProgressIndicator
                value={progress}
                showLabel
                label="Progresso de Upload"
                variant="default"
              />
              <Button onClick={handleProgressSimulation} className="mt-4" size="sm">
                Simular Progresso
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Diferentes Variantes
              </h3>
              <div className="space-y-3">
                <ProgressIndicator value={75} variant="success" showLabel label="Estado de Sucesso" />
                <ProgressIndicator value={50} variant="warning" showLabel label="Estado de Alerta" />
                <ProgressIndicator value={30} variant="error" showLabel label="Estado de Erro" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Diferentes Tamanhos
              </h3>
              <div className="space-y-3">
                <ProgressIndicator value={60} size="sm" />
                <ProgressIndicator value={60} size="md" />
                <ProgressIndicator value={60} size="lg" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Toast Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notificações Toast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => customToast.success('Notificação de sucesso!')}>
                Mostrar Sucesso
              </Button>
              <Button onClick={() => customToast.error('Notificação de erro!')} variant="destructive">
                Mostrar Erro
              </Button>
              <Button onClick={() => customToast.warning('Notificação de alerta!')} variant="secondary">
                Mostrar Alerta
              </Button>
              <Button onClick={() => customToast.info('Notificação informativa!')} variant="outline">
                Mostrar Info
              </Button>
              <Button
                onClick={() => {
                  const promise = new Promise((resolve) => setTimeout(resolve, 2000));
                  customToast.promise(promise, {
                    loading: 'Processando...',
                    success: 'Concluído!',
                    error: 'Falhou!',
                  });
                }}
              >
                Mostrar Toast Promise
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Feedback Component */}
        <Card>
          <CardHeader>
            <CardTitle>Componente de Feedback de Ação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={() => setShowToast(!showToast)}>
                Alternar Feedback de Ação
              </Button>

              {showToast && (
                <ActionFeedback
                  type="success"
                  message="Ação concluída com sucesso!"
                  description="Suas alterações foram salvas no banco de dados."
                  onClose={() => setShowToast(false)}
                  action={{
                    label: 'Desfazer',
                    onClick: () => customToast.info('Ação desfeita!'),
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading Spinners */}
        <Card>
          <CardHeader>
            <CardTitle>Spinners de Carregamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="xs" />
                <span className="text-xs text-description">Extra Pequeno</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="sm" />
                <span className="text-xs text-description">Pequeno</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="md" />
                <span className="text-xs text-description">Médio</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="lg" />
                <span className="text-xs text-description">Grande</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Badges com Efeitos Hover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Badges de Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="open" dot>
                    Open
                  </Badge>
                  <Badge variant="inProgress" dot pulse>
                    In Progress
                  </Badge>
                  <Badge variant="pending" dot>
                    Pending
                  </Badge>
                  <Badge variant="resolved" dot>
                    Resolved
                  </Badge>
                  <Badge variant="closed" dot>
                    Closed
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Badges de Prioridade
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="low">Low Priority</Badge>
                  <Badge variant="medium">Medium Priority</Badge>
                  <Badge variant="high">High Priority</Badge>
                  <Badge variant="critical" pulse>
                    Critical Priority
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Badges Removíveis
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary" removable onRemove={() => customToast.info('Badge removido')}>
                    Removível
                  </Badge>
                  <Badge variant="success" removable>
                    Tag 1
                  </Badge>
                  <Badge variant="warning" removable>
                    Tag 2
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
