'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/design-system/utils';
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

// ========================================
// RIPPLE EFFECT COMPONENT
// ========================================
interface RippleProps {
  color?: string;
  duration?: number;
}

export const useRipple = () => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const createRipple = (event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);
  };

  const RippleContainer = ({ color = 'rgba(255, 255, 255, 0.5)' }: RippleProps) => (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            background: color,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </span>
  );

  return { createRipple, RippleContainer };
};

// ========================================
// FORM LOADING OVERLAY
// ========================================
interface FormLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export const FormLoadingOverlay: React.FC<FormLoadingOverlayProps> = ({
  isLoading,
  message = 'Processing...',
  className,
}) => {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm z-50',
        'flex items-center justify-center rounded-lg',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-600 dark:text-brand-400 animate-spin" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {message}
        </p>
      </div>
    </motion.div>
  );
};

// ========================================
// ACTION FEEDBACK TOAST (Enhanced)
// ========================================
interface ActionFeedbackProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  onClose?: () => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const ActionFeedback: React.FC<ActionFeedbackProps> = ({
  type,
  message,
  description,
  onClose,
  duration = 5000,
  action,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />,
    error: <XCircle className="w-5 h-5 text-error-600 dark:text-error-400" />,
    warning: <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400" />,
    info: <Info className="w-5 h-5 text-brand-600 dark:text-brand-400" />,
  };

  const colors = {
    success: 'border-success-200 bg-success-50 dark:bg-success-900/20 dark:border-success-800',
    error: 'border-error-200 bg-error-50 dark:bg-error-900/20 dark:border-error-800',
    warning: 'border-warning-200 bg-warning-50 dark:bg-warning-900/20 dark:border-warning-800',
    info: 'border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
            'max-w-md w-full',
            colors[type]
          )}
          role="alert"
          aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
          <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {message}
            </p>
            {description && (
              <p className="mt-1 text-sm text-description">
                {description}
              </p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 underline-offset-2 hover:underline"
              >
                {action.label}
              </button>
            )}
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            aria-label="Close notification"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ========================================
// BUTTON WITH STATES (Enhanced from existing Button)
// ========================================
interface InteractiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  ripple?: boolean;
  children: React.ReactNode;
}

export const InteractiveButton = React.forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      success = false,
      error = false,
      ripple = true,
      className,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const { createRipple, RippleContainer } = useRipple();
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);

    useEffect(() => {
      if (success) {
        setShowSuccess(true);
        const timer = setTimeout(() => setShowSuccess(false), 2000);
        return () => clearTimeout(timer);
      }
    }, [success]);

    useEffect(() => {
      if (error) {
        setShowError(true);
        const timer = setTimeout(() => setShowError(false), 2000);
        return () => clearTimeout(timer);
      }
    }, [error]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !loading) {
        createRipple(e);
      }
      onClick?.(e);
    };

    const variants = {
      primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus:ring-brand-500',
      secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
      outline: 'border border-neutral-300 bg-transparent text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 focus:ring-neutral-500 dark:border-neutral-600 dark:text-neutral-300',
      ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-500 dark:text-neutral-300 dark:hover:bg-neutral-800',
      destructive: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 focus:ring-error-500',
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 py-2 text-base gap-2',
      lg: 'h-12 px-6 py-3 text-lg gap-2.5',
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md font-medium',
          'transition-all duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[0.98] active:transition-transform active:duration-75',
          'overflow-hidden',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {ripple && <RippleContainer />}

        <span className={cn('flex items-center gap-2', (loading || showSuccess || showError) && 'invisible')}>
          {children}
        </span>

        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}

        {showSuccess && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <CheckCircle className="w-5 h-5" />
          </motion.span>
        )}

        {showError && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <XCircle className="w-5 h-5" />
          </motion.span>
        )}
      </button>
    );
  }
);

InteractiveButton.displayName = 'InteractiveButton';

// ========================================
// LINK WITH HOVER STATES
// ========================================
interface InteractiveLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: 'default' | 'underline' | 'subtle' | 'bold';
  showIcon?: boolean;
  external?: boolean;
}

export const InteractiveLink = React.forwardRef<HTMLAnchorElement, InteractiveLinkProps>(
  ({ variant = 'default', showIcon = false, external = false, className, children, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);

    const variants = {
      default: 'text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300',
      underline: 'text-brand-600 underline underline-offset-4 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300',
      subtle: 'text-neutral-700 hover:text-brand-600 dark:text-neutral-300 dark:hover:text-brand-400',
      bold: 'text-brand-600 font-semibold hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300',
    };

    return (
      <a
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 transition-all duration-200',
          'hover:gap-2',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-sm',
          variants[variant],
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
        {(showIcon || external) && (
          <motion.svg
            className="w-4 h-4"
            animate={{ x: isHovered ? 2 : 0, y: isHovered && external ? -2 : 0 }}
            transition={{ duration: 0.2 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {external ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            )}
          </motion.svg>
        )}
      </a>
    );
  }
);

InteractiveLink.displayName = 'InteractiveLink';

// ========================================
// CARD WITH HOVER STATES
// ========================================
interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
  variant?: 'default' | 'elevated' | 'outline';
  hoverEffect?: boolean;
}

export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  (
    {
      clickable = false,
      variant = 'default',
      hoverEffect = true,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'bg-white border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700',
      elevated: 'bg-white shadow-md border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700',
      outline: 'bg-transparent border-2 border-neutral-300 dark:border-neutral-600',
    };

    return (
      <motion.div
        ref={ref}
        whileHover={hoverEffect ? { y: -4 } : undefined}
        whileTap={clickable ? { scale: 0.98 } : undefined}
        onClick={onClick as any}
        className={cn(
          'rounded-lg p-6 transition-all duration-200',
          variants[variant],
          clickable && 'cursor-pointer',
          hoverEffect && 'hover:shadow-lg',
          'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
          className
        )}
      >
        {children}
      </motion.div>
    );
  }
);

InteractiveCard.displayName = 'InteractiveCard';

// ========================================
// PROGRESS INDICATOR
// ========================================
interface ProgressIndicatorProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  className,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    default: 'bg-brand-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    error: 'bg-error-600',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">{label || 'Progress'}</span>
          <span className="text-muted-content">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn('w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden', sizes[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', variants[variant])}
        />
      </div>
    </div>
  );
};

// Add CSS for ripple animation
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple {
      to {
        width: 400px;
        height: 400px;
        opacity: 0;
      }
    }
    .animate-ripple {
      animation: ripple 0.6s ease-out;
    }
  `;
  document.head.appendChild(style);
}
