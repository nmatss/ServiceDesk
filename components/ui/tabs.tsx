'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ========================================
// TABS COMPONENT
// ========================================

const tabsListVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      default: 'border-b border-gray-200 dark:border-gray-700',
      pills: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1',
      underline: 'gap-4',
      segment: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'px-4 py-2 text-sm border-b-2 border-transparent data-[state=active]:border-brand-600 data-[state=active]:text-brand-600 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        pills: 'px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-sm text-gray-600 hover:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:text-gray-300',
        underline: 'px-1 py-2 text-sm border-b-2 border-transparent data-[state=active]:border-brand-600 data-[state=active]:text-brand-600 text-gray-500 hover:text-gray-700',
        segment: 'flex-1 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white dark:text-gray-400',
      },
      size: {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-5 py-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

// Context for sharing state between Tabs components
interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'default' | 'pills' | 'underline' | 'segment';
}

const TabsContext = React.createContext<TabsContextType | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within a Tabs component');
  }
  return context;
}

// ========================================
// TABS ROOT
// ========================================

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  defaultValue?: string;
  variant?: 'default' | 'pills' | 'underline' | 'segment';
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, defaultValue, variant = 'default', children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || value);

    const contextValue = React.useMemo(
      () => ({
        value: value ?? internalValue,
        onValueChange: onValueChange ?? setInternalValue,
        variant,
      }),
      [value, internalValue, onValueChange, variant]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

// ========================================
// TABS LIST
// ========================================

interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant, children, ...props }, ref) => {
    const context = useTabsContext();
    const resolvedVariant = variant ?? context.variant;

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(tabsListVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

// ========================================
// TABS TRIGGER
// ========================================

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, variant, size, children, ...props }, ref) => {
    const context = useTabsContext();
    const isActive = context.value === value;
    const resolvedVariant = variant ?? context.variant;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        onClick={() => context.onValueChange(value)}
        className={cn(tabsTriggerVariants({ variant: resolvedVariant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

// ========================================
// TABS CONTENT
// ========================================

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, forceMount, children, ...props }, ref) => {
    const context = useTabsContext();
    const isActive = context.value === value;

    if (!forceMount && !isActive) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={isActive ? 'active' : 'inactive'}
        hidden={!isActive}
        className={cn(
          'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          !isActive && 'hidden',
          className
        )}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';

// ========================================
// EXPORTS
// ========================================

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
