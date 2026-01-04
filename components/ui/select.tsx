'use client';

import React from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/design-system/utils';

const selectVariants = cva(
  [
    'relative w-full cursor-default bg-white border text-left shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:border-transparent',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors duration-200',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-neutral-300 focus:ring-brand-500 focus:border-brand-500',
          'dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-brand-400',
        ],
        error: [
          'border-error-300 bg-error-50 focus:ring-error-500 focus:border-error-500',
          'dark:border-error-600 dark:bg-error-900/20 dark:focus:ring-error-400',
        ],
        success: [
          'border-success-300 bg-success-50 focus:ring-success-500 focus:border-success-500',
          'dark:border-success-600 dark:bg-success-900/20 dark:focus:ring-success-400',
        ],
      },
      size: {
        xs: 'h-7 px-2 py-1 text-xs',
        sm: 'h-8 px-3 py-1.5 text-sm',
        md: 'h-10 px-3 py-2 text-base',
        lg: 'h-12 px-4 py-3 text-lg',
        xl: 'h-14 px-6 py-4 text-xl',
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
        enduser: 'rounded-lg shadow-soft focus:shadow-medium transition-shadow',
        agent: 'rounded-md shadow-sm focus:shadow transition-shadow',
        manager: 'rounded-xl shadow-md focus:shadow-lg transition-shadow',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      rounded: 'md',
    },
  }
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface SelectProps extends VariantProps<typeof selectVariants> {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  className?: string;
  fullWidth?: boolean;
  id?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder = 'Select an option...',
      disabled = false,
      label,
      description,
      error,
      success,
      variant,
      size,
      rounded,
      persona,
      className,
      fullWidth = true,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id || `select-${generatedId}`;
    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const actualVariant = hasError ? 'error' : hasSuccess ? 'success' : variant;

    const selectedOption = options.find((option) => option.value === value);

    const iconSize = {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
      xl: 'w-6 h-6',
    }[size || 'md'];

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            {label}
          </label>
        )}

        <Listbox value={value} onChange={onValueChange} disabled={disabled}>
          <div className="relative">
            <Listbox.Button
              ref={ref}
              id={selectId}
              className={cn(
                selectVariants({ variant: actualVariant, size, rounded, persona }),
                'pr-10 text-left',
                className
              )}
              {...props}
            >
              <span className="block truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown className={cn('text-neutral-400', iconSize)} aria-hidden="true" />
              </span>
            </Listbox.Button>

            {/* Status icons */}
            {(hasError || hasSuccess) && (
              <div className="absolute inset-y-0 right-10 flex items-center pr-3">
                {hasError && (
                  <AlertCircle className={cn('text-error-500', iconSize)} />
                )}
                {hasSuccess && (
                  <CheckCircle className={cn('text-success-500', iconSize)} />
                )}
              </div>
            )}

            <Transition
              as={React.Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-neutral-800 dark:ring-neutral-700 sm:text-sm">
                {options.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    className={({ active, disabled: optionDisabled }) =>
                      cn(
                        'relative cursor-default select-none py-2 pl-10 pr-4',
                        active
                          ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/20 dark:text-brand-100'
                          : 'text-neutral-900 dark:text-neutral-100',
                        (optionDisabled || option.disabled) && 'opacity-50 cursor-not-allowed'
                      )
                    }
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              'block truncate',
                              selected ? 'font-medium' : 'font-normal'
                            )}
                          >
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="text-xs text-muted-content">
                              {option.description}
                            </span>
                          )}
                        </div>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>

        {/* Description */}
        {description && !error && !success && (
          <p className="text-sm text-description">
            {description}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}

        {/* Success message */}
        {success && !error && (
          <p className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
            <CheckCircle className="w-4 h-4" />
            {success}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Multi-select variant
export interface MultiSelectProps extends Omit<SelectProps, 'value' | 'onValueChange'> {
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  maxSelections?: number;
}

const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      values = [],
      onValuesChange,
      options,
      placeholder = 'Select options...',
      maxSelections,
      ...props
    },
    ref
  ) => {
    const handleChange = (selectedValues: string[]) => {
      if (maxSelections && selectedValues.length > maxSelections) {
        return;
      }
      onValuesChange?.(selectedValues);
    };

    const selectedOptions = options.filter((option) => values.includes(option.value));
    const displayText =
      selectedOptions.length === 0
        ? placeholder
        : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`;

    return (
      <Select
        {...props}
        ref={ref}
        value=""
        placeholder={displayText}
        onValueChange={() => {}}
        options={options.map((option) => ({
          ...option,
          disabled: option.disabled || (maxSelections ? values.length >= maxSelections && !values.includes(option.value) : false),
        }))}
      />
    );
  }
);

MultiSelect.displayName = 'MultiSelect';

// Persona-specific select components
export const EndUserSelect = React.forwardRef<HTMLButtonElement, Omit<SelectProps, 'persona'>>(
  (props, ref) => <Select ref={ref} persona="enduser" {...props} />
);

export const AgentSelect = React.forwardRef<HTMLButtonElement, Omit<SelectProps, 'persona'>>(
  (props, ref) => <Select ref={ref} persona="agent" {...props} />
);

export const ManagerSelect = React.forwardRef<HTMLButtonElement, Omit<SelectProps, 'persona'>>(
  (props, ref) => <Select ref={ref} persona="manager" {...props} />
);

EndUserSelect.displayName = 'EndUserSelect';
AgentSelect.displayName = 'AgentSelect';
ManagerSelect.displayName = 'ManagerSelect';

export { Select, MultiSelect };