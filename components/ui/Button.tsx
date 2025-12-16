'use client';

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/design-system/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
    'transition-all duration-200 ease-in-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'active:scale-[0.98] active:transition-transform active:duration-75',
  ],
  {
    variants: {
      variant: {
        // Primary variants
        primary: [
          'bg-brand-600 text-white shadow-sm',
          'hover:bg-brand-700 hover:shadow-md',
          'focus-visible:ring-brand-500',
          'dark:bg-brand-500 dark:hover:bg-brand-600',
        ],
        destructive: [
          'bg-error-600 text-white shadow-sm',
          'hover:bg-error-700 hover:shadow-md',
          'focus-visible:ring-error-500',
          'dark:bg-error-500 dark:hover:bg-error-600',
        ],
        success: [
          'bg-success-600 text-white shadow-sm',
          'hover:bg-success-700 hover:shadow-md',
          'focus-visible:ring-success-500',
          'dark:bg-success-500 dark:hover:bg-success-600',
        ],

        // Secondary variants
        secondary: [
          'bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm',
          'hover:bg-neutral-200 hover:shadow-md',
          'focus-visible:ring-neutral-500',
          'dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700',
          'dark:hover:bg-neutral-700',
        ],
        outline: [
          'border border-neutral-300 bg-transparent text-neutral-700 shadow-sm',
          'hover:bg-neutral-50 hover:text-neutral-900 hover:shadow-md',
          'focus-visible:ring-neutral-500',
          'dark:border-neutral-600 dark:text-neutral-300',
          'dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
        ],

        // Ghost variants
        ghost: [
          'bg-transparent text-neutral-700 shadow-none',
          'hover:bg-neutral-100 hover:text-neutral-900',
          'focus-visible:ring-neutral-500',
          'dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
        ],
        link: [
          'bg-transparent text-brand-600 underline-offset-4 shadow-none',
          'hover:underline hover:text-brand-700',
          'focus-visible:ring-brand-500',
          'dark:text-brand-400 dark:hover:text-brand-300',
        ],
      },
      size: {
        xs: 'h-7 px-2 text-xs gap-1',
        sm: 'h-8 px-3 text-sm gap-1.5',
        md: 'h-10 px-4 py-2 gap-2',
        lg: 'h-12 px-6 py-3 text-base gap-2',
        xl: 'h-14 px-8 py-4 text-lg gap-3',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        full: 'rounded-full',
      },
      persona: {
        enduser: 'rounded-lg shadow-soft hover:shadow-medium transition-shadow',
        agent: 'rounded-md shadow-sm hover:shadow transition-shadow',
        manager: 'rounded-xl shadow-md hover:shadow-lg transition-shadow',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      rounded: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loadingText?: string;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      persona,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      loadingText,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const iconSize = {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
      xl: 'w-6 h-6',
      icon: 'w-4 h-4',
      'icon-sm': 'w-4 h-4',
      'icon-lg': 'w-5 h-5',
    }[size || 'md'];

    // When asChild is true, Slot expects exactly one child element
    // So we pass children directly without any wrapper elements
    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size, rounded, persona }),
            fullWidth && 'w-full',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, rounded, persona }),
          fullWidth && 'w-full',
          className
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <Loader2 className={cn('animate-spin', iconSize)} />
        )}
        {!loading && leftIcon && (
          <span className={cn('flex-shrink-0', iconSize)}>
            {leftIcon}
          </span>
        )}

        {loading && loadingText ? loadingText : children}

        {!loading && rightIcon && (
          <span className={cn('flex-shrink-0', iconSize)}>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export type { VariantProps };

// Persona-specific button components
export const EndUserButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'persona'>>(
  (props, ref) => <Button ref={ref} persona="enduser" {...props} />
);

export const AgentButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'persona'>>(
  (props, ref) => <Button ref={ref} persona="agent" {...props} />
);

export const ManagerButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'persona'>>(
  (props, ref) => <Button ref={ref} persona="manager" {...props} />
);

EndUserButton.displayName = 'EndUserButton';
AgentButton.displayName = 'AgentButton';
ManagerButton.displayName = 'ManagerButton';