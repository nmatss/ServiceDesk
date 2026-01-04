'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design-system/utils';
import { AlertCircle, CheckCircle } from 'lucide-react';

const textareaVariants = cva(
  [
    'flex min-h-[80px] w-full border bg-background px-3 py-2 text-sm transition-colors',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'resize-vertical',
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
        xs: 'min-h-[60px] px-2 py-1 text-xs',
        sm: 'min-h-[70px] px-3 py-1.5 text-sm',
        md: 'min-h-[80px] px-3 py-2 text-base',
        lg: 'min-h-[100px] px-4 py-3 text-lg',
        xl: 'min-h-[120px] px-6 py-4 text-xl',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        full: 'rounded-full',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
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
      resize: 'vertical',
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  fullWidth?: boolean;
  maxLength?: number;
  showCounter?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      resize,
      persona,
      label,
      description,
      error,
      success,
      fullWidth = true,
      maxLength,
      showCounter = false,
      disabled,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || '');
    const generatedId = React.useId();
    const textareaId = id || `textarea-${generatedId}`;

    const hasError = !!error;
    const hasSuccess = !!success && !hasError;
    const actualVariant = hasError ? 'error' : hasSuccess ? 'success' : variant;

    const currentValue = value !== undefined ? value : internalValue;
    const currentLength = String(currentValue).length;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;

      if (maxLength && newValue.length > maxLength) {
        return;
      }

      setInternalValue(newValue);
      props.onChange?.(e);
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

        <div className="relative">
          <textarea
            id={textareaId}
            className={cn(
              textareaVariants({ variant: actualVariant, size, rounded, resize, persona }),
              className
            )}
            ref={ref}
            disabled={disabled}
            value={value !== undefined ? value : internalValue}
            onChange={handleChange}
            maxLength={maxLength}
            {...props}
          />

          {/* Character counter */}
          {(showCounter || maxLength) && (
            <div className="absolute bottom-2 right-2 text-xs text-muted-content">
              {maxLength ? `${currentLength}/${maxLength}` : currentLength}
            </div>
          )}
        </div>

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

Textarea.displayName = 'Textarea';

// Auto-resizing textarea variant
export interface AutoTextareaProps extends Omit<TextareaProps, 'resize'> {
  minRows?: number;
  maxRows?: number;
}

const AutoTextarea = React.forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
  ({ minRows = 3, maxRows = 10, className, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => textareaRef.current!);

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to recalculate
      textarea.style.height = 'auto';

      // Calculate new height
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const scrollHeight = textarea.scrollHeight;

      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }, [minRows, maxRows]);

    React.useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    return (
      <Textarea
        {...props}
        ref={textareaRef}
        resize="none"
        className={cn('overflow-hidden', className)}
        onChange={(e) => {
          props.onChange?.(e);
          adjustHeight();
        }}
        style={{ minHeight: `${minRows * 1.5}rem` }}
      />
    );
  }
);

AutoTextarea.displayName = 'AutoTextarea';

// Persona-specific textarea components
export const EndUserTextarea = React.forwardRef<HTMLTextAreaElement, Omit<TextareaProps, 'persona'>>(
  (props, ref) => <Textarea ref={ref} persona="enduser" {...props} />
);

export const AgentTextarea = React.forwardRef<HTMLTextAreaElement, Omit<TextareaProps, 'persona'>>(
  (props, ref) => <Textarea ref={ref} persona="agent" {...props} />
);

export const ManagerTextarea = React.forwardRef<HTMLTextAreaElement, Omit<TextareaProps, 'persona'>>(
  (props, ref) => <Textarea ref={ref} persona="manager" {...props} />
);

EndUserTextarea.displayName = 'EndUserTextarea';
AgentTextarea.displayName = 'AgentTextarea';
ManagerTextarea.displayName = 'ManagerTextarea';

export { Textarea, AutoTextarea, textareaVariants };