'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/design-system/utils';

const checkboxVariants = cva(
  [
    'peer h-4 w-4 shrink-0 border border-primary ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-all duration-200 ease-in-out',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-neutral-300 bg-white',
          'data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600 data-[state=checked]:text-white',
          'data-[state=indeterminate]:bg-brand-600 data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:text-white',
          'hover:border-brand-400',
          'dark:border-neutral-600 dark:bg-neutral-800',
          'dark:data-[state=checked]:bg-brand-500 dark:data-[state=checked]:border-brand-500',
          'dark:data-[state=indeterminate]:bg-brand-500 dark:data-[state=indeterminate]:border-brand-500',
          'dark:hover:border-brand-500',
        ],
        destructive: [
          'border-neutral-300 bg-white',
          'data-[state=checked]:bg-error-600 data-[state=checked]:border-error-600 data-[state=checked]:text-white',
          'data-[state=indeterminate]:bg-error-600 data-[state=indeterminate]:border-error-600 data-[state=indeterminate]:text-white',
          'hover:border-error-400',
          'dark:border-neutral-600 dark:bg-neutral-800',
          'dark:data-[state=checked]:bg-error-500 dark:data-[state=checked]:border-error-500',
          'dark:data-[state=indeterminate]:bg-error-500 dark:data-[state=indeterminate]:border-error-500',
          'dark:hover:border-error-500',
        ],
        success: [
          'border-neutral-300 bg-white',
          'data-[state=checked]:bg-success-600 data-[state=checked]:border-success-600 data-[state=checked]:text-white',
          'data-[state=indeterminate]:bg-success-600 data-[state=indeterminate]:border-success-600 data-[state=indeterminate]:text-white',
          'hover:border-success-400',
          'dark:border-neutral-600 dark:bg-neutral-800',
          'dark:data-[state=checked]:bg-success-500 dark:data-[state=checked]:border-success-500',
          'dark:data-[state=indeterminate]:bg-success-500 dark:data-[state=indeterminate]:border-success-500',
          'dark:hover:border-success-500',
        ],
      },
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded',
        lg: 'rounded-md',
        full: 'rounded-full',
      },
      persona: {
        enduser: 'rounded-md shadow-soft',
        agent: 'rounded-sm shadow-sm',
        manager: 'rounded-lg shadow-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      rounded: 'sm',
    },
  }
);

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof checkboxVariants> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      persona,
      label,
      description,
      error,
      success,
      checked,
      indeterminate = false,
      onCheckedChange,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(checked || false);
    const generatedId = React.useId();
    const checkboxId = id || `checkbox-${generatedId}`;

    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const actualVariant = hasError ? 'destructive' : hasSuccess ? 'success' : variant;

    const iconSize = {
      xs: 'w-2 h-2',
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }[size || 'sm'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;

      if (!isControlled) {
        setInternalChecked(newChecked);
      }

      onCheckedChange?.(newChecked);
      props.onChange?.(e);
    };

    React.useEffect(() => {
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.indeterminate = indeterminate;
      }
    }, [indeterminate, ref]);

    const checkboxElement = (
      <div className="relative inline-flex items-center">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={cn(
            checkboxVariants({ variant: actualVariant, size, rounded, persona }),
            'absolute opacity-0',
            className
          )}
          checked={isChecked}
          onChange={handleChange}
          disabled={disabled}
          data-state={indeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked'}
          {...props}
        />

        {/* Visual checkbox */}
        <div
          className={cn(
            checkboxVariants({ variant: actualVariant, size, rounded, persona }),
            'flex items-center justify-center bg-white border',
            isChecked && !indeterminate && 'bg-current border-current',
            indeterminate && 'bg-current border-current',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          data-state={indeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked'}
        >
          {isChecked && !indeterminate && (
            <Check className={cn('text-white', iconSize)} strokeWidth={3} />
          )}
          {indeterminate && (
            <Minus className={cn('text-white', iconSize)} strokeWidth={3} />
          )}
        </div>
      </div>
    );

    if (!label && !description && !error && !success) {
      return checkboxElement;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-start space-x-3">
          {checkboxElement}

          {(label || description) && (
            <div className="grid gap-1.5 leading-none">
              {label && (
                <label
                  htmlFor={checkboxId}
                  className={cn(
                    'text-sm font-medium leading-none cursor-pointer',
                    disabled && 'cursor-not-allowed opacity-50',
                    hasError && 'text-error-600 dark:text-error-400',
                    hasSuccess && 'text-success-600 dark:text-success-400'
                  )}
                >
                  {label}
                </label>
              )}

              {description && !error && !success && (
                <p className={cn(
                  'text-sm text-muted-foreground',
                  disabled && 'opacity-50'
                )}>
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

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

Checkbox.displayName = 'Checkbox';

// Checkbox group component
export interface CheckboxGroupProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  disabled?: boolean;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  description?: string;
  error?: string;
  success?: string;
}

const CheckboxGroup = React.forwardRef<HTMLDivElement, CheckboxGroupProps>(
  (
    {
      value = [],
      onValueChange,
      options,
      disabled = false,
      className,
      orientation = 'vertical',
      label,
      description,
      error,
      success,
      ...props
    },
    ref
  ) => {
    const handleChange = (optionValue: string, checked: boolean) => {
      const newValue = checked
        ? [...value, optionValue]
        : value.filter((v) => v !== optionValue);

      onValueChange?.(newValue);
    };

    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        {/* Group label and description */}
        {(label || description) && (
          <div className="space-y-1">
            {label && (
              <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {label}
              </label>
            )}
            {description && !error && !success && (
              <p className="text-sm text-description">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Checkbox options */}
        <div
          className={cn(
            'space-y-3',
            orientation === 'horizontal' && 'flex flex-wrap gap-6 space-y-0'
          )}
        >
          {options.map((option) => (
            <Checkbox
              key={option.value}
              checked={value.includes(option.value)}
              onCheckedChange={(checked) => handleChange(option.value, checked as boolean)}
              disabled={disabled || option.disabled}
              label={option.label}
              description={option.description}
            />
          ))}
        </div>

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

CheckboxGroup.displayName = 'CheckboxGroup';

// Persona-specific checkbox components
export const EndUserCheckbox = React.forwardRef<HTMLInputElement, Omit<CheckboxProps, 'persona'>>(
  (props, ref) => <Checkbox ref={ref} persona="enduser" {...props} />
);

export const AgentCheckbox = React.forwardRef<HTMLInputElement, Omit<CheckboxProps, 'persona'>>(
  (props, ref) => <Checkbox ref={ref} persona="agent" {...props} />
);

export const ManagerCheckbox = React.forwardRef<HTMLInputElement, Omit<CheckboxProps, 'persona'>>(
  (props, ref) => <Checkbox ref={ref} persona="manager" {...props} />
);

EndUserCheckbox.displayName = 'EndUserCheckbox';
AgentCheckbox.displayName = 'AgentCheckbox';
ManagerCheckbox.displayName = 'ManagerCheckbox';

export { Checkbox, CheckboxGroup, checkboxVariants };