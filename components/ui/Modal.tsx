'use client';

import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design-system/utils';
import { Button } from './Button';

const modalVariants = cva(
  [
    'relative transform rounded-lg bg-white text-left shadow-xl transition-all',
    'dark:bg-neutral-800',
  ],
  {
    variants: {
      size: {
        xs: 'max-w-xs',
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
        full: 'max-w-full',
      },
      persona: {
        enduser: 'rounded-xl shadow-large',
        agent: 'rounded-lg shadow-medium',
        manager: 'rounded-2xl shadow-xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface ModalProps extends VariantProps<typeof modalVariants> {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  overlayClassName?: string;
  initialFocus?: React.MutableRefObject<HTMLElement | null>;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  description,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size,
  persona,
  className,
  overlayClassName,
  initialFocus,
}) => {
  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog
        as="div"
        className="relative z-modal"
        onClose={closeOnOverlayClick ? onClose : () => {}}
        initialFocus={initialFocus}
      >
        {/* Backdrop */}
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={cn(
              'fixed inset-0 bg-black/25 backdrop-blur-sm',
              'dark:bg-black/50',
              overlayClassName
            )}
          />
        </Transition.Child>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={cn(
                  modalVariants({ size, persona }),
                  'w-full max-w-[calc(100vw-2rem)]',
                  className
                )}
              >
                {/* Header */}
                {(title || showCloseButton) && (
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div className="flex-1 min-w-0">
                      {title && (
                        <Dialog.Title
                          as="h3"
                          className="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
                        >
                          {title}
                        </Dialog.Title>
                      )}
                      {description && (
                        <Dialog.Description className="mt-2 text-sm text-description">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>

                    {showCloseButton && (
                      <button
                        type="button"
                        className="ml-4 rounded-md bg-white text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:bg-neutral-800 dark:hover:text-neutral-300"
                        onClick={onClose}
                        aria-label="Fechar modal"
                      >
                        <span className="sr-only">Fechar</span>
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className={cn(
                  'px-6',
                  title || showCloseButton ? 'pt-0 pb-6' : 'py-6'
                )}>
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>

        {/* Handle escape key */}
        {closeOnEscape && (
          <div
            className="sr-only"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        )}
      </Dialog>
    </Transition>
  );
};

// Alert Modal for confirmations and notifications
export interface AlertModalProps extends Omit<ModalProps, 'children'> {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  loading?: boolean;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  type = 'info',
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = false,
  loading = false,
  onClose,
  ...modalProps
}) => {
  const icons = {
    info: <Info className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden="true" />,
    success: <CheckCircle className="h-6 w-6 text-success-600" aria-hidden="true" />,
    warning: <AlertTriangle className="h-6 w-6 text-warning-600" aria-hidden="true" />,
    error: <AlertCircle className="h-6 w-6 text-error-600" aria-hidden="true" />,
  };

  const handleConfirm = () => {
    onConfirm?.();
    if (!loading) {
      onClose();
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal
      {...modalProps}
      onClose={showCancel ? handleCancel : onClose}
      size="sm"
    >
      <div className="flex items-start space-x-4" role="alert" aria-live="polite">
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
        {showCancel && (
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
        )}
        <Button
          variant={type === 'error' ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          loading={loading}
          className="w-full sm:w-auto"
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

// Form Modal wrapper
export interface FormModalProps extends ModalProps {
  onSubmit?: (e: React.FormEvent) => void;
  submitText?: string;
  cancelText?: string;
  showFooter?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
}

export const FormModal: React.FC<FormModalProps> = ({
  children,
  onSubmit,
  submitText = 'Save',
  cancelText = 'Cancel',
  showFooter = true,
  loading = false,
  submitDisabled = false,
  onClose,
  ...modalProps
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <Modal {...modalProps} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>{children}</div>

        {showFooter && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={submitDisabled}
              className="w-full sm:w-auto"
            >
              {submitText}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
};

// Drawer variant for mobile
export interface DrawerProps extends Omit<ModalProps, 'size'> {
  side?: 'left' | 'right' | 'top' | 'bottom';
  width?: string;
  height?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  title,
  description,
  showCloseButton = true,
  closeOnOverlayClick = true,
  side = 'right',
  width = '320px',
  height = '100vh',
  className,
  overlayClassName,
}) => {
  const sideClasses = {
    left: 'inset-y-0 left-0',
    right: 'inset-y-0 right-0',
    top: 'inset-x-0 top-0',
    bottom: 'inset-x-0 bottom-0',
  };

  const transformClasses = {
    left: {
      enter: 'translate-x-0',
      enterFrom: '-translate-x-full',
      leave: '-translate-x-full',
      leaveFrom: 'translate-x-0',
    },
    right: {
      enter: 'translate-x-0',
      enterFrom: 'translate-x-full',
      leave: 'translate-x-full',
      leaveFrom: 'translate-x-0',
    },
    top: {
      enter: 'translate-y-0',
      enterFrom: '-translate-y-full',
      leave: '-translate-y-full',
      leaveFrom: 'translate-y-0',
    },
    bottom: {
      enter: 'translate-y-0',
      enterFrom: 'translate-y-full',
      leave: 'translate-y-full',
      leaveFrom: 'translate-y-0',
    },
  };

  const sizeStyle = side === 'left' || side === 'right'
    ? { width }
    : { height };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog
        as="div"
        className="relative z-modal"
        onClose={closeOnOverlayClick ? onClose : () => {}}
      >
        {/* Backdrop */}
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={cn(
              'fixed inset-0 bg-black/25 backdrop-blur-sm',
              'dark:bg-black/50',
              overlayClassName
            )}
          />
        </Transition.Child>

        {/* Drawer */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className={cn('pointer-events-none fixed', sideClasses[side])}>
              <Transition.Child
                as={React.Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom={transformClasses[side].enterFrom}
                enterTo={transformClasses[side].enter}
                leave="transform transition ease-in-out duration-300"
                leaveFrom={transformClasses[side].leaveFrom}
                leaveTo={transformClasses[side].leave}
              >
                <Dialog.Panel
                  className={cn(
                    'pointer-events-auto relative flex flex-col bg-white shadow-xl',
                    'dark:bg-neutral-800',
                    className
                  )}
                  style={sizeStyle}
                >
                  {/* Header */}
                  {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
                      <div className="flex-1 min-w-0">
                        {title && (
                          <Dialog.Title
                            as="h3"
                            className="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
                          >
                            {title}
                          </Dialog.Title>
                        )}
                        {description && (
                          <Dialog.Description className="mt-2 text-sm text-description">
                            {description}
                          </Dialog.Description>
                        )}
                      </div>

                      {showCloseButton && (
                        <button
                          type="button"
                          className="ml-4 rounded-md bg-white text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:bg-neutral-800 dark:hover:text-neutral-300"
                          onClick={onClose}
                          aria-label="Fechar drawer"
                        >
                          <span className="sr-only">Fechar</span>
                          <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                      {children}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Persona-specific modal components
export const EndUserModal: React.FC<Omit<ModalProps, 'persona'>> = (props) => (
  <Modal {...props} persona="enduser" />
);

export const AgentModal: React.FC<Omit<ModalProps, 'persona'>> = (props) => (
  <Modal {...props} persona="agent" />
);

export const ManagerModal: React.FC<Omit<ModalProps, 'persona'>> = (props) => (
  <Modal {...props} persona="manager" />
);

// Hooks for modal state management
export function useModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}

export function useAlertModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<Partial<AlertModalProps>>({});

  const show = React.useCallback((alertConfig: Partial<AlertModalProps>) => {
    setConfig(alertConfig);
    setIsOpen(true);
  }, []);

  const hide = React.useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setConfig({}), 200); // Clear config after animation
  }, []);

  return {
    isOpen,
    show,
    hide,
    config,
  };
}