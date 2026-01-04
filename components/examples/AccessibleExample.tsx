/**
 * Accessible Example Component
 * Demonstra o uso correto de padrões de acessibilidade
 *
 * Este componente serve como referência para desenvolvimento futuro
 */

'use client';

import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  useAnnouncement,
  useFocusTrap,
  useId,
  useLoadingState,
  usePrefersReducedMotion,
} from '@/lib/accessibility/hooks';
import {
  getDialogProps,
  getCloseButtonProps,
  getFormFieldProps,
} from '@/lib/accessibility/utils';

/**
 * Example 1: Accessible Form
 * Demonstra form com labels, validação, aria-invalid, aria-describedby
 */
export function AccessibleFormExample() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const { isLoading, startLoading, stopLoading } = useLoadingState();

  const emailId = useId('email');
  const errorId = useId('email-error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação
    if (!email.includes('@')) {
      setEmailError('Por favor, insira um email válido');
      return;
    }

    setEmailError('');
    startLoading('Enviando formulário...');

    // Simular envio
    setTimeout(() => {
      stopLoading('Formulário enviado com sucesso!');
    }, 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium mb-1">
          Email <span className="text-red-600" aria-label="obrigatório">*</span>
        </label>
        <input
          {...getFormFieldProps(emailId, {
            required: true,
            invalid: !!emailError,
            describedBy: emailError ? errorId : undefined,
          })}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input w-full"
          placeholder="seu@email.com"
        />
        {emailError && (
          <p id={errorId} role="alert" className="text-red-600 text-sm mt-1">
            {emailError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="btn btn-primary"
      >
        {isLoading ? (
          <>
            <span className="loading-spinner mr-2" aria-hidden="true" />
            Enviando...
          </>
        ) : (
          'Enviar'
        )}
      </button>
    </form>
  );
}

/**
 * Example 2: Accessible Modal
 * Demonstra modal com focus trap, aria-modal, aria-labelledby
 */
export function AccessibleModalExample() {
  const [isOpen, setIsOpen] = useState(false);
  const announce = useAnnouncement();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  const titleId = useId('modal-title');
  const descId = useId('modal-desc');

  const handleClose = () => {
    setIsOpen(false);
    announce('Modal fechado', 'polite');
  };

  const handleConfirm = () => {
    announce('Ação confirmada', 'polite');
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        Abrir Modal
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              ref={dialogRef}
              {...getDialogProps(titleId, descId)}
              className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 id={titleId} className="text-xl font-semibold">
                    Confirmar Ação
                  </h2>
                  <p id={descId} className="text-sm text-description mt-1">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
                <button
                  {...getCloseButtonProps('modal de confirmação')}
                  onClick={handleClose}
                  className="rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  <span className="sr-only">Fechar</span>
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-6">
                <p>Tem certeza que deseja continuar?</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn btn-primary"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Example 3: Accessible Dropdown Menu
 * Demonstra menu com aria-haspopup, aria-expanded, role="menu"
 */
export function AccessibleDropdownExample() {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId('menu');
  const buttonId = useId('menu-button');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={menuId}
        aria-label="Menu de opções"
        className="btn btn-secondary"
      >
        Opções
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div
            id={menuId}
            role="menu"
            aria-labelledby={buttonId}
            onKeyDown={handleKeyDown}
            className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-20"
          >
            <button
              role="menuitem"
              onClick={() => {
                console.log('Editar');
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              Editar
            </button>
            <button
              role="menuitem"
              onClick={() => {
                console.log('Compartilhar');
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              Compartilhar
            </button>
            <div role="separator" className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
            <button
              role="menuitem"
              onClick={() => {
                console.log('Excluir');
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Example 4: Accessible Toast Notification
 * Demonstra notificação com role="alert", aria-live
 */
export function AccessibleToastExample() {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning';
    message: string;
  }>>([]);

  const announce = useAnnouncement();
  const prefersReducedMotion = usePrefersReducedMotion();

  const addToast = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);

    // Anunciar para screen readers
    const priority = type === 'error' ? 'assertive' : 'polite';
    announce(message, priority);

    // Auto-remover após 5 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const icons = {
    success: <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />,
    error: <XMarkIcon className="h-5 w-5" aria-hidden="true" />,
    warning: <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />,
  };

  const colors = {
    success: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
    warning: 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200',
  };

  return (
    <div>
      {/* Botões de demonstração */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => addToast('success', 'Operação concluída com sucesso')}
          className="btn btn-success"
        >
          Sucesso
        </button>
        <button
          onClick={() => addToast('error', 'Ocorreu um erro ao processar')}
          className="btn btn-danger"
        >
          Erro
        </button>
        <button
          onClick={() => addToast('warning', 'Atenção: verifique os dados')}
          className="btn btn-secondary"
        >
          Aviso
        </button>
      </div>

      {/* Container de toasts */}
      <div
        className="fixed top-4 right-4 z-50 space-y-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className={`
              flex items-start space-x-3 p-4 rounded-lg shadow-lg max-w-sm
              ${colors[toast.type]}
              ${!prefersReducedMotion && 'animate-slide-in'}
            `}
          >
            <div className="flex-shrink-0">
              {icons[toast.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Fechar notificação"
              className="flex-shrink-0 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <span className="sr-only">Fechar</span>
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 5: Accessible Tab Panel
 * Demonstra tabs com role="tablist", aria-selected, keyboard navigation
 */
export function AccessibleTabsExample() {
  const [selectedTab, setSelectedTab] = useState(0);
  const _tablistId = useId('tablist');
  const announce = useAnnouncement();

  const tabs = [
    { label: 'Perfil', content: 'Conteúdo do perfil' },
    { label: 'Configurações', content: 'Conteúdo de configurações' },
    { label: 'Notificações', content: 'Conteúdo de notificações' },
  ];

  const handleTabClick = (index: number) => {
    setSelectedTab(index);
    announce(`Aba ${tabs[index]?.label} selecionada`, 'polite');
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newIndex = index === 0 ? tabs.length - 1 : index - 1;
      setSelectedTab(newIndex);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newIndex = index === tabs.length - 1 ? 0 : index + 1;
      setSelectedTab(newIndex);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedTab(tabs.length - 1);
    }
  };

  return (
    <div>
      {/* Tab List */}
      <div
        role="tablist"
        aria-label="Configurações do usuário"
        className="flex border-b border-neutral-200 dark:border-neutral-700"
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            id={`tab-${index}`}
            aria-selected={selectedTab === index}
            aria-controls={`tabpanel-${index}`}
            tabIndex={selectedTab === index ? 0 : -1}
            onClick={() => handleTabClick(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              px-4 py-2 text-sm font-medium transition-colors
              ${selectedTab === index
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`tabpanel-${index}`}
          aria-labelledby={`tab-${index}`}
          hidden={selectedTab !== index}
          className="p-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/**
 * All Examples Combined
 */
export default function AccessibleExamples() {
  return (
    <div className="space-y-8 p-8">
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">1. Formulário Acessível</h2>
        </div>
        <div className="card-body">
          <AccessibleFormExample />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">2. Modal Acessível</h2>
        </div>
        <div className="card-body">
          <AccessibleModalExample />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">3. Dropdown Acessível</h2>
        </div>
        <div className="card-body">
          <AccessibleDropdownExample />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">4. Notificações Acessíveis</h2>
        </div>
        <div className="card-body">
          <AccessibleToastExample />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">5. Tabs Acessíveis</h2>
        </div>
        <div className="card-body">
          <AccessibleTabsExample />
        </div>
      </div>
    </div>
  );
}
