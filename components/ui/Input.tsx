'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, focusClasses } from '@/lib/design-system/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle, Search } from 'lucide-react';

const inputVariants = cva(
  [
    'flex w-full border bg-background text-foreground transition-colors',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-neutral-300 bg-white',
          'focus-visible:ring-brand-500 focus-visible:border-brand-500',
          'dark:border-neutral-600 dark:bg-neutral-800',
          'dark:focus-visible:ring-brand-400',
        ],
        error: [
          'border-error-300 bg-error-50',
          'focus-visible:ring-error-500 focus-visible:border-error-500',
          'dark:border-error-600 dark:bg-error-900/20',
          'dark:focus-visible:ring-error-400',
        ],
        success: [
          'border-success-300 bg-success-50',
          'focus-visible:ring-success-500 focus-visible:border-success-500',
          'dark:border-success-600 dark:bg-success-900/20',
          'dark:focus-visible:ring-success-400',
        ],
        ghost: [
          'border-transparent bg-transparent',
          'focus-visible:ring-brand-500 focus-visible:border-brand-500',
          'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
        ],
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
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
        enduser: 'rounded-lg shadow-soft focus-visible:shadow-medium transition-shadow',
        agent: 'rounded-md shadow-sm focus-visible:shadow transition-shadow',
        manager: 'rounded-xl shadow-md focus-visible:shadow-lg transition-shadow',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      rounded: 'md',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  isLoading?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      persona,
      type = 'text',
      label,
      description,
      error,
      success,
      leftIcon,
      rightIcon,
      leftAddon,
      rightAddon,
      isLoading,
      clearable,
      onClear,
      fullWidth = true,
      disabled,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value || '');
    const inputId = id || `input-${React.useId()}`;

    const isPassword = type === 'password';
    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const actualVariant = hasError ? 'error' : hasSuccess ? 'success' : variant;

    const iconSize = {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
      xl: 'w-6 h-6',
    }[size || 'md'];

    const handleClear = () => {
      setInternalValue('');
      onClear?.();
    };

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Left addon */}
          {leftAddon && (
            <div className="absolute inset-y-0 left-0 flex items-center">
              <div className="flex h-full items-center border-r border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                {leftAddon}
              </div>
            </div>
          )}

          {/* Left icon */}
          {leftIcon && !leftAddon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <span className={cn('text-neutral-400', iconSize)}>
                {leftIcon}
              </span>
            </div>
          )}

          <input
            id={inputId}
            type={inputType}
            className={cn(
              inputVariants({ variant: actualVariant, size, rounded, persona }),
              leftIcon && !leftAddon && 'pl-10',
              leftAddon && 'pl-16',
              (rightIcon || isPassword || clearable) && 'pr-10',
              rightAddon && 'pr-16',
              className
            )}
            ref={ref}
            disabled={disabled || isLoading}
            value={value !== undefined ? value : internalValue}
            onChange={(e) => {
              setInternalValue(e.target.value);
              props.onChange?.(e);
            }}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute inset-y-0 right-0 flex items-center">
            {/* Loading spinner */}
            {isLoading && (
              <div className="mr-3">
                <div className={cn('animate-spin rounded-full border-2 border-neutral-300 border-t-brand-600', iconSize)} />
              </div>
            )}

            {/* Clear button */}
            {clearable && !isLoading && (value || internalValue) && (
              <button
                type="button"
                onClick={handleClear}
                className="mr-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <span className={cn('block', iconSize)}>×</span>
              </button>
            )}

            {/* Password toggle */}
            {isPassword && !isLoading && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="mr-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                {showPassword ? (
                  <EyeOff className={iconSize} />
                ) : (
                  <Eye className={iconSize} />
                )}
              </button>
            )}

            {/* Status icons */}
            {hasError && !isLoading && (
              <div className="mr-3">
                <AlertCircle className={cn('text-error-500', iconSize)} />
              </div>
            )}

            {hasSuccess && !isLoading && (
              <div className="mr-3">
                <CheckCircle className={cn('text-success-500', iconSize)} />
              </div>
            )}

            {/* Right icon */}
            {rightIcon && !isPassword && !clearable && !hasError && !hasSuccess && !isLoading && (
              <div className="mr-3">
                <span className={cn('text-neutral-400', iconSize)}>
                  {rightIcon}
                </span>
              </div>
            )}
          </div>

          {/* Right addon */}
          {rightAddon && (
            <div className="absolute inset-y-0 right-0 flex items-center">
              <div className="flex h-full items-center border-l border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                {rightAddon}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {description && !error && !success && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
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

Input.displayName = 'Input';

// Textarea variant
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon' | 'clearable' | 'onClear'> {
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
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
      resize = 'vertical',
      fullWidth = true,
      disabled,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${React.useId()}`;
    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const actualVariant = hasError ? 'error' : hasSuccess ? 'success' : variant;

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          className={cn(
            inputVariants({ variant: actualVariant, size, rounded, persona }),
            'min-h-[80px]',
            resizeClasses[resize],
            className
          )}
          ref={ref}
          disabled={disabled}
          value={value}
          {...props}
        />

        {description && !error && !success && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        )}

        {error && (
          <p className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}

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

Textarea.displayName = 'Textarea';

// Search Input component
export interface SearchInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  onSearch?: (value: string) => void;
  searchDelay?: number;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, searchDelay = 300, ...props }, ref) => {
    const [searchValue, setSearchValue] = React.useState('');
    const timeoutRef = React.useRef<NodeJS.Timeout>();

    React.useEffect(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onSearch?.(searchValue);
      }, searchDelay);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [searchValue, onSearch, searchDelay]);

    return (
      <Input
        {...props}
        ref={ref}
        type="search"
        leftIcon={<Search />}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        clearable
        onClear={() => setSearchValue('')}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

// Persona-specific input components
export const EndUserInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'persona'>>(
  (props, ref) => <Input ref={ref} persona="enduser" {...props} />
);

export const AgentInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'persona'>>(
  (props, ref) => <Input ref={ref} persona="agent" {...props} />
);

export const ManagerInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'persona'>>(
  (props, ref) => <Input ref={ref} persona="manager" {...props} />
);

EndUserInput.displayName = 'EndUserInput';
AgentInput.displayName = 'AgentInput';
ManagerInput.displayName = 'ManagerInput';

export { Input, Textarea, SearchInput, inputVariants };
export type { VariantProps };