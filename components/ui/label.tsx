'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design-system/utils';

const labelVariants = cva(
  [
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  ],
  {
    variants: {
      variant: {
        default: 'text-neutral-900 dark:text-neutral-100',
        muted: 'text-neutral-600 dark:text-neutral-400',
        error: 'text-error-600 dark:text-error-400',
        success: 'text-success-600 dark:text-success-400',
        warning: 'text-warning-600 dark:text-warning-400',
      },
      size: {
        xs: 'text-xs',
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
      weight: {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
      },
      persona: {
        enduser: 'tracking-wide',
        agent: 'tracking-normal',
        manager: 'tracking-tight',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      weight: 'medium',
    },
  }
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
  optional?: boolean;
  description?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      className,
      variant,
      size,
      weight,
      persona,
      required = false,
      optional = false,
      description,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div className="space-y-1">
        <label
          ref={ref}
          className={cn(labelVariants({ variant, size, weight, persona }), className)}
          {...props}
        >
          {children}
          {required && (
            <span className="ml-1 text-error-500 dark:text-error-400" aria-label="required">
              *
            </span>
          )}
          {optional && (
            <span className="ml-1 text-neutral-500 dark:text-neutral-400 font-normal text-xs">
              (optional)
            </span>
          )}
        </label>
        {description && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    );
  }
);

Label.displayName = 'Label';

// Form field wrapper component that includes label
export interface FieldProps {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  required?: boolean;
  optional?: boolean;
  labelProps?: Omit<LabelProps, 'children' | 'required' | 'optional' | 'description'>;
  children: React.ReactNode;
  className?: string;
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      label,
      description,
      error,
      success,
      required = false,
      optional = false,
      labelProps,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const labelVariant = hasError ? 'error' : hasSuccess ? 'success' : 'default';

    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {label && (
          <Label
            {...labelProps}
            variant={labelVariant}
            required={required}
            optional={optional}
            description={!error && !success ? description : undefined}
          >
            {label}
          </Label>
        )}

        {children}

        {/* Description (only show if no label or if there's an error/success state) */}
        {description && !label && !error && !success && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-error-600 dark:text-error-400">
            {error}
          </p>
        )}

        {/* Success message */}
        {success && !error && (
          <p className="text-sm text-success-600 dark:text-success-400">
            {success}
          </p>
        )}
      </div>
    );
  }
);

Field.displayName = 'Field';

// Persona-specific label components
export const EndUserLabel = React.forwardRef<HTMLLabelElement, Omit<LabelProps, 'persona'>>(
  (props, ref) => <Label ref={ref} persona="enduser" {...props} />
);

export const AgentLabel = React.forwardRef<HTMLLabelElement, Omit<LabelProps, 'persona'>>(
  (props, ref) => <Label ref={ref} persona="agent" {...props} />
);

export const ManagerLabel = React.forwardRef<HTMLLabelElement, Omit<LabelProps, 'persona'>>(
  (props, ref) => <Label ref={ref} persona="manager" {...props} />
);

EndUserLabel.displayName = 'EndUserLabel';
AgentLabel.displayName = 'AgentLabel';
ManagerLabel.displayName = 'ManagerLabel';

// Utility components
export const FormLabel = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ variant = 'default', weight = 'medium', ...props }, ref) => (
    <Label ref={ref} variant={variant} weight={weight} {...props} />
  )
);

export const FieldLabel = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ variant = 'default', size = 'sm', weight = 'medium', ...props }, ref) => (
    <Label ref={ref} variant={variant} size={size} weight={weight} {...props} />
  )
);

FormLabel.displayName = 'FormLabel';
FieldLabel.displayName = 'FieldLabel';

export { Label, Field, labelVariants };