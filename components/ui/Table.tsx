'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/design-system/utils';

const tableVariants = cva(
  'w-full caption-bottom text-sm',
  {
    variants: {
      variant: {
        default: 'border-collapse',
        separated: 'border-separate border-spacing-0',
      },
      density: {
        compact: '[&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1',
        normal: '[&_th]:px-4 [&_th]:py-2 [&_td]:px-4 [&_td]:py-2',
        comfortable: '[&_th]:px-6 [&_th]:py-3 [&_td]:px-6 [&_td]:py-3',
      },
      persona: {
        enduser: 'rounded-xl shadow-soft overflow-hidden',
        agent: 'rounded-lg shadow-sm overflow-hidden',
        manager: 'rounded-2xl shadow-lg overflow-hidden',
      },
    },
    defaultVariants: {
      variant: 'default',
      density: 'normal',
    },
  }
);

// Base Table Component
export interface TableProps
  extends React.TableHTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableVariants> {
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, variant, density, persona, striped, hoverable, bordered, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn(
          tableVariants({ variant, density, persona }),
          striped && '[&_tbody_tr:nth-child(even)]:bg-neutral-50 dark:[&_tbody_tr:nth-child(even)]:bg-neutral-800/50',
          hoverable && '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-neutral-50 dark:[&_tbody_tr:hover]:bg-neutral-800/50',
          bordered && 'border border-neutral-200 dark:border-neutral-700',
          className
        )}
        {...props}
      />
    </div>
  )
);

Table.displayName = 'Table';

// Table Header
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800',
      className
    )}
    {...props}
  />
));

TableHeader.displayName = 'TableHeader';

// Table Body
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      'divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900',
      className
    )}
    {...props}
  />
));

TableBody.displayName = 'TableBody';

// Table Footer
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-neutral-200 bg-neutral-50 font-medium dark:border-neutral-700 dark:bg-neutral-800',
      className
    )}
    {...props}
  />
));

TableFooter.displayName = 'TableFooter';

// Table Row
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors',
      className
    )}
    {...props}
  />
));

TableRow.displayName = 'TableRow';

// Table Head Cell
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sortDirection, onSort, children, ...props }, ref) => {
    const handleClick = () => {
      if (sortable && onSort) {
        onSort();
      }
    };

    const SortIcon = sortDirection === 'asc'
      ? ChevronUp
      : sortDirection === 'desc'
      ? ChevronDown
      : ChevronsUpDown;

    return (
      <th
        ref={ref}
        className={cn(
          'text-left align-middle font-medium text-muted-content',
          'border-b border-neutral-200 dark:border-neutral-700',
          sortable && 'cursor-pointer select-none hover:text-neutral-700 dark:hover:text-neutral-200',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <div className="flex items-center space-x-2">
          <span>{children}</span>
          {sortable && (
            <SortIcon
              className={cn(
                'h-4 w-4 transition-colors',
                sortDirection ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400'
              )}
            />
          )}
        </div>
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

// Table Cell
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'align-middle text-neutral-900 dark:text-neutral-100',
      'border-b border-neutral-200 dark:border-neutral-700 last:border-b-0',
      className
    )}
    {...props}
  />
));

TableCell.displayName = 'TableCell';

// Table Caption
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(
      'mt-4 text-sm text-muted-content',
      className
    )}
    {...props}
  />
));

TableCaption.displayName = 'TableCaption';

// Data Table with advanced features
export interface Column<T = any> {
  key: string;
  title: string;
  dataIndex?: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  className?: string;
}

export interface DataTableProps<T = any> extends Omit<TableProps, 'children'> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey?: string | ((record: T) => string);
  onRowClick?: (record: T, index: number) => void;
  expandable?: {
    expandedRowRender?: (record: T) => React.ReactNode;
    expandedRowKeys?: string[];
    onExpand?: (expanded: boolean, record: T) => void;
  };
  selection?: {
    selectedRowKeys?: string[];
    onSelectChange?: (selectedRowKeys: string[]) => void;
    getCheckboxProps?: (record: T) => { disabled?: boolean };
  };
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  onSort?: (key: string, direction: 'asc' | 'desc' | null) => void;
}

export function DataTable<T = any>({
  columns,
  data,
  loading = false,
  emptyText = 'No data available',
  rowKey = 'id',
  onRowClick,
  sortConfig,
  onSort,
  className,
  ...tableProps
}: DataTableProps<T>) {
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return (record as any)[rowKey] || index.toString();
  };

  const handleSort = (columnKey: string) => {
    if (!onSort) return;

    let newDirection: 'asc' | 'desc' | null = 'asc';

    if (sortConfig?.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        newDirection = 'desc';
      } else if (sortConfig.direction === 'desc') {
        newDirection = null;
      }
    }

    onSort(columnKey, newDirection);
  };

  if (loading) {
    return (
      <Table {...tableProps} className={className}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} style={{ width: column.width }}>
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column.key}>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (data.length === 0) {
    return (
      <Table {...tableProps} className={className}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} style={{ width: column.width }}>
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center py-8">
              <div className="text-muted-content">
                {emptyText}
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table {...tableProps} className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              style={{ width: column.width }}
              className={cn(
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                column.className
              )}
              sortable={column.sortable}
              sortDirection={
                sortConfig?.key === column.key ? sortConfig.direction : null
              }
              onSort={() => handleSort(column.key)}
            >
              {column.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record, index) => (
          <TableRow
            key={getRowKey(record, index)}
            className={onRowClick ? 'cursor-pointer' : undefined}
            onClick={() => onRowClick?.(record, index)}
          >
            {columns.map((column) => {
              let value;
              if (column.dataIndex) {
                value = (record as any)[column.dataIndex];
              } else {
                value = record;
              }

              let content;
              if (column.render) {
                content = column.render(value, record, index);
              } else {
                content = value?.toString() || '';
              }

              return (
                <TableCell
                  key={column.key}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.className
                  )}
                >
                  {content}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Action Cell Component for common table actions
export interface ActionCellProps {
  actions: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
  }>;
  trigger?: React.ReactNode;
}

export const ActionCell: React.FC<ActionCellProps> = ({
  actions,
  trigger = <MoreHorizontal className="h-4 w-4" />,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {trigger}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 dark:ring-neutral-700">
            <div className="py-1">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors',
                    'hover:bg-neutral-50 dark:hover:bg-neutral-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    action.variant === 'destructive' && 'text-error-600 dark:text-error-400'
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Status Badge for table cells
export interface StatusBadgeProps {
  status: string;
  variant?: 'priority' | 'status' | 'custom';
  color?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'status',
  color,
}) => {
  const getVariantClasses = () => {
    if (variant === 'priority') {
      const priorityClasses = {
        low: 'bg-success-100 text-success-800 border-success-200 dark:bg-success-900/20 dark:text-success-300',
        medium: 'bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300',
        high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300',
        critical: 'bg-error-100 text-error-800 border-error-200 dark:bg-error-900/20 dark:text-error-300',
      };
      return priorityClasses[status as keyof typeof priorityClasses] || priorityClasses.medium;
    }

    if (variant === 'status') {
      const statusClasses = {
        open: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300',
        'in-progress': 'bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300',
        resolved: 'bg-success-100 text-success-800 border-success-200 dark:bg-success-900/20 dark:text-success-300',
        closed: 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
        cancelled: 'bg-error-100 text-error-800 border-error-200 dark:bg-error-900/20 dark:text-error-300',
      };
      return statusClasses[status as keyof typeof statusClasses] || statusClasses.open;
    }

    return 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300';
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        getVariantClasses()
      )}
      style={color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {status}
    </span>
  );
};

// Persona-specific table components
export const EndUserTable = React.forwardRef<HTMLTableElement, Omit<TableProps, 'persona'>>(
  (props, ref) => <Table ref={ref} persona="enduser" density="comfortable" {...props} />
);

export const AgentTable = React.forwardRef<HTMLTableElement, Omit<TableProps, 'persona'>>(
  (props, ref) => <Table ref={ref} persona="agent" density="compact" {...props} />
);

export const ManagerTable = React.forwardRef<HTMLTableElement, Omit<TableProps, 'persona'>>(
  (props, ref) => <Table ref={ref} persona="manager" density="normal" {...props} />
);

EndUserTable.displayName = 'EndUserTable';
AgentTable.displayName = 'AgentTable';
ManagerTable.displayName = 'ManagerTable';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  tableVariants,
};