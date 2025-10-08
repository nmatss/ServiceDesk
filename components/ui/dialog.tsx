'use client';

import React from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/design-system/utils';

const dialogVariants = cva(
  [
    'relative bg-white rounded-lg shadow-xl',
    'w-full max-w-md transform overflow-hidden text-left align-middle transition-all',
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
        '7xl': 'max-w-7xl',
        full: 'max-w-full mx-4',
      },
      persona: {
        enduser: 'rounded-lg shadow-soft',
        agent: 'rounded-md shadow',
        manager: 'rounded-xl shadow-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface DialogProps extends VariantProps<typeof dialogVariants> {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      isOpen,
      onClose,
      children,
      size,
      persona,
      className,
      closeOnOverlayClick = true,
      showCloseButton = true,
      ...props
    },
    ref
  ) => {
    return (
      <Transition appear show={isOpen} as={React.Fragment}>
        <HeadlessDialog
          as="div"
          className="relative z-50"
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
            <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
          </Transition.Child>

          {/* Dialog panel */}
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
                <HeadlessDialog.Panel
                  ref={ref}
                  className={cn(dialogVariants({ size, persona }), className)}
                  {...props}
                >
                  {/* Close button */}
                  {showCloseButton && (
                    <button
                      type="button"
                      className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                      onClick={onClose}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  )}
                  {children}
                </HeadlessDialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </HeadlessDialog>
      </Transition>
    );
  }
);

Dialog.displayName = 'Dialog';

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left px-6 pt-6',
      className
    )}
    {...props}
  />
));
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <HeadlessDialog.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-neutral-900 dark:text-neutral-100',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <HeadlessDialog.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
));
DialogContent.displayName = 'DialogContent';

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6',
      className
    )}
    {...props}
  />
));
DialogFooter.displayName = 'DialogFooter';

// Persona-specific dialog components
export const EndUserDialog = React.forwardRef<HTMLDivElement, Omit<DialogProps, 'persona'>>(
  (props, ref) => <Dialog ref={ref} persona="enduser" {...props} />
);

export const AgentDialog = React.forwardRef<HTMLDivElement, Omit<DialogProps, 'persona'>>(
  (props, ref) => <Dialog ref={ref} persona="agent" {...props} />
);

export const ManagerDialog = React.forwardRef<HTMLDivElement, Omit<DialogProps, 'persona'>>(
  (props, ref) => <Dialog ref={ref} persona="manager" {...props} />
);

EndUserDialog.displayName = 'EndUserDialog';
AgentDialog.displayName = 'AgentDialog';
ManagerDialog.displayName = 'ManagerDialog';

export {
  Dialog,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogContent,
};