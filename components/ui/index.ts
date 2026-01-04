// Core shadcn/ui components
export * from './card';
export * from './dialog';
export * from './select';
export * from './label';
export * from './checkbox';
export * from './dropdown-menu';
export * from './tabs';
export * from './progress';

// Textarea - export from textarea.tsx (avoid duplicate with Input.tsx)
export { Textarea, AutoTextarea, textareaVariants, EndUserTextarea, AgentTextarea, ManagerTextarea } from './textarea';
export type { TextareaProps, AutoTextareaProps } from './textarea';

// Badge - export from badge.tsx (avoid duplicate StatusBadge from Table.tsx)
export { Badge, BadgeGroup, StatusBadge, PriorityBadge, CountBadge, badgeVariants } from './badge';

// Custom components - Forms
export * from './Button';
export * from './Input';
export * from './enhanced-form';
export * from './form-field';

// Custom components - Layout
export * from './Modal';
export { Table } from './Table';
export * from './animated-card';

// Custom components - UI Elements
export * from './TicketCard';
export * from './QuickActions';
export * from './CommandPalette';
export * from './enhanced-search';
export * from './help-tooltip';

// Custom components - Feedback
export * from './empty-state';
export * from './error-states';
export * from './visual-feedback';
// Loading states - export from loading-states.tsx (avoid duplicate with skeleton.tsx)
export {
  SkeletonTable,
  SkeletonListItem,
  SkeletonForm,
  SkeletonCardWithImage,
  PageLoadingBar,
  FullPageLoading,
  InlineSpinner,
  ButtonLoading,
  ImageWithLoading
} from './loading-states';
// Skeleton primitives from skeleton.tsx
export { Skeleton } from './skeleton';
export * from './toast';

// Custom components - Mobile
export * from './MobileOptimized';

// Custom components - Notifications & Status
export * from './NotificationCenter';
export * from './StatusIndicators';
export * from './StatsCard';

// Custom components - Utilities
export * from './file-list';
export * from './file-upload';
export * from './comunidade-builder';
