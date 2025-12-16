'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { XMarkIcon } from '@heroicons/react/20/solid';

// ========================================
// BADGE VARIANTS
// ========================================

const badgeVariants = cva(
  'inline-flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        primary: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
        secondary: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        outline: 'border border-gray-300 text-gray-700 bg-transparent dark:border-gray-600 dark:text-gray-300',
        // Status variants
        open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        inProgress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        // Priority variants
        low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      },
      size: {
        xs: 'text-[10px] px-1.5 py-0.5 rounded',
        sm: 'text-xs px-2 py-0.5 rounded',
        md: 'text-xs px-2.5 py-1 rounded-md',
        lg: 'text-sm px-3 py-1 rounded-md',
      },
      shape: {
        default: 'rounded-md',
        pill: 'rounded-full',
        square: 'rounded-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      shape: 'default',
    },
  }
);

// ========================================
// BADGE COMPONENT
// ========================================

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Whether the badge can be removed */
  removable?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Icon to display before the text */
  icon?: React.ReactNode;
  /** Dot indicator before text */
  dot?: boolean;
  /** Dot color (when dot is true) */
  dotColor?: string;
  /** Pulsing dot animation */
  pulse?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      shape,
      removable,
      onRemove,
      icon,
      dot,
      dotColor,
      pulse,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, shape }), className)}
        {...props}
      >
        {/* Dot indicator */}
        {dot && (
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              pulse && 'animate-pulse',
              !dotColor && 'bg-current'
            )}
            style={dotColor ? { backgroundColor: dotColor } : undefined}
          />
        )}

        {/* Icon */}
        {icon && <span className="mr-1 -ml-0.5">{icon}</span>}

        {/* Content */}
        {children}

        {/* Remove button */}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className={cn(
              'ml-1 -mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current',
              'transition-colors'
            )}
            aria-label="Remove"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

// ========================================
// BADGE GROUP COMPONENT
// ========================================

interface BadgeGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum number of badges to show before collapsing */
  max?: number;
  /** Size for all badges in the group */
  size?: VariantProps<typeof badgeVariants>['size'];
}

const BadgeGroup = React.forwardRef<HTMLDivElement, BadgeGroupProps>(
  ({ className, max, size, children, ...props }, ref) => {
    const childArray = React.Children.toArray(children);
    const visibleChildren = max ? childArray.slice(0, max) : childArray;
    const hiddenCount = max ? childArray.length - max : 0;

    return (
      <div
        ref={ref}
        className={cn('flex flex-wrap items-center gap-1.5', className)}
        {...props}
      >
        {visibleChildren.map((child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<BadgeProps>, {
              key: index,
              size: size ?? (child.props as BadgeProps).size,
            });
          }
          return child;
        })}

        {hiddenCount > 0 && (
          <Badge variant="secondary" size={size}>
            +{hiddenCount}
          </Badge>
        )}
      </div>
    );
  }
);
BadgeGroup.displayName = 'BadgeGroup';

// ========================================
// STATUS BADGE COMPONENT
// ========================================

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed' | string;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, ...props }, ref) => {
    const variantMap: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
      open: 'open',
      in_progress: 'inProgress',
      'in progress': 'inProgress',
      pending: 'pending',
      waiting: 'pending',
      resolved: 'resolved',
      closed: 'closed',
    };

    const variant = variantMap[status.toLowerCase()] || 'default';

    return (
      <Badge ref={ref} variant={variant} dot {...props}>
        {props.children || status.replace(/_/g, ' ')}
      </Badge>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

// ========================================
// PRIORITY BADGE COMPONENT
// ========================================

interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
  priority: 1 | 2 | 3 | 4 | 'low' | 'medium' | 'high' | 'critical' | string | number;
}

const PriorityBadge = React.forwardRef<HTMLSpanElement, PriorityBadgeProps>(
  ({ priority, ...props }, ref) => {
    const variantMap: Record<string | number, VariantProps<typeof badgeVariants>['variant']> = {
      1: 'low',
      2: 'medium',
      3: 'high',
      4: 'critical',
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical',
      urgent: 'critical',
    };

    const labelMap: Record<string | number, string> = {
      1: 'Baixa',
      2: 'Média',
      3: 'Alta',
      4: 'Crítica',
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      critical: 'Crítica',
      urgent: 'Urgente',
    };

    const key = typeof priority === 'string' ? priority.toLowerCase() : priority;
    const variant = variantMap[key] || 'default';
    const label = labelMap[key] || String(priority);

    return (
      <Badge ref={ref} variant={variant} {...props}>
        {props.children || label}
      </Badge>
    );
  }
);
PriorityBadge.displayName = 'PriorityBadge';

// ========================================
// COUNT BADGE COMPONENT
// ========================================

interface CountBadgeProps extends BadgeProps {
  count: number;
  /** Maximum count to show (displays "99+" if exceeded) */
  maxCount?: number;
  /** Show badge even when count is 0 */
  showZero?: boolean;
}

const CountBadge = React.forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ count, maxCount = 99, showZero = false, ...props }, ref) => {
    if (count === 0 && !showZero) {
      return null;
    }

    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

    return (
      <Badge ref={ref} shape="pill" {...props}>
        {displayCount}
      </Badge>
    );
  }
);
CountBadge.displayName = 'CountBadge';

// ========================================
// EXPORTS
// ========================================

export { Badge, BadgeGroup, StatusBadge, PriorityBadge, CountBadge, badgeVariants };
