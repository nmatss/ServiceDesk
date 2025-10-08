'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design-system/utils';

const cardVariants = cva(
  [
    'rounded-lg border bg-card text-card-foreground shadow-sm',
    'transition-all duration-200 ease-in-out',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-white border-neutral-200 shadow-sm',
          'dark:bg-neutral-800 dark:border-neutral-700',
        ],
        elevated: [
          'bg-white border-neutral-200 shadow-md hover:shadow-lg',
          'dark:bg-neutral-800 dark:border-neutral-700',
        ],
        ghost: [
          'bg-transparent border-transparent shadow-none',
        ],
        outline: [
          'bg-transparent border-neutral-300',
          'dark:border-neutral-600',
        ],
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      persona: {
        enduser: 'rounded-lg shadow-soft hover:shadow-medium transition-shadow',
        agent: 'rounded-md shadow-sm hover:shadow transition-shadow',
        manager: 'rounded-xl shadow-md hover:shadow-lg transition-shadow',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, persona, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, size, persona, className }))}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Persona-specific card components
export const EndUserCard = React.forwardRef<HTMLDivElement, Omit<CardProps, 'persona'>>(
  (props, ref) => <Card ref={ref} persona="enduser" {...props} />
);

export const AgentCard = React.forwardRef<HTMLDivElement, Omit<CardProps, 'persona'>>(
  (props, ref) => <Card ref={ref} persona="agent" {...props} />
);

export const ManagerCard = React.forwardRef<HTMLDivElement, Omit<CardProps, 'persona'>>(
  (props, ref) => <Card ref={ref} persona="manager" {...props} />
);

EndUserCard.displayName = 'EndUserCard';
AgentCard.displayName = 'AgentCard';
ManagerCard.displayName = 'ManagerCard';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };