'use client';

import * as React from 'react';
import { Menu, Transition } from '@headlessui/react';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronRightIcon } from '@heroicons/react/20/solid';

// ========================================
// DROPDOWN MENU ROOT
// ========================================

interface DropdownMenuProps {
  children: React.ReactNode;
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      {children}
    </Menu>
  );
};

// ========================================
// DROPDOWN MENU TRIGGER
// ========================================

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ children, asChild, className }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return (
        <Menu.Button as={React.Fragment}>
          {React.cloneElement(children as React.ReactElement<any>, { ref })}
        </Menu.Button>
      );
    }

    return (
      <Menu.Button ref={ref} className={className}>
        {children}
      </Menu.Button>
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

// ========================================
// DROPDOWN MENU CONTENT
// ========================================

interface DropdownMenuContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  sideOffset?: number;
  className?: string;
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ children, align = 'end', side = 'bottom', sideOffset = 4, className }, ref) => {
    const alignmentClasses = {
      start: 'left-0 origin-top-left',
      center: 'left-1/2 -translate-x-1/2 origin-top',
      end: 'right-0 origin-top-right',
    };

    const sideClasses = {
      top: 'bottom-full mb-1',
      bottom: 'top-full mt-1',
    };

    return (
      <Transition
        as={React.Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          ref={ref}
          style={{ marginTop: side === 'bottom' ? sideOffset : undefined, marginBottom: side === 'top' ? sideOffset : undefined }}
          className={cn(
            'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-lg',
            'dark:border-gray-700 dark:bg-gray-800',
            'focus:outline-none',
            alignmentClasses[align],
            sideClasses[side],
            className
          )}
        >
          {children}
        </Menu.Items>
      </Transition>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

// ========================================
// DROPDOWN MENU ITEM
// ========================================

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
  icon?: React.ReactNode;
  shortcut?: string;
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ children, onClick, onSelect, disabled, destructive, className, icon, shortcut }, ref) => {
    const handleClick = () => {
      if (disabled) return;
      onClick?.();
      onSelect?.();
    };

    return (
      <Menu.Item disabled={disabled}>
        {({ active }) => (
          <button
            ref={ref}
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
              active && 'bg-gray-100 dark:bg-gray-700',
              destructive
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-gray-100',
              disabled && 'pointer-events-none opacity-50',
              className
            )}
          >
            {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
            <span className="flex-1 text-left">{children}</span>
            {shortcut && (
              <span className="ml-auto text-xs tracking-widest text-gray-400 dark:text-gray-500">
                {shortcut}
              </span>
            )}
          </button>
        )}
      </Menu.Item>
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

// ========================================
// DROPDOWN MENU CHECKBOX ITEM
// ========================================

interface DropdownMenuCheckboxItemProps {
  children: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const DropdownMenuCheckboxItem = React.forwardRef<HTMLButtonElement, DropdownMenuCheckboxItemProps>(
  ({ children, checked, onCheckedChange, disabled, className }, ref) => {
    return (
      <Menu.Item disabled={disabled}>
        {({ active }) => (
          <button
            ref={ref}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={() => onCheckedChange?.(!checked)}
            disabled={disabled}
            className={cn(
              'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors',
              active && 'bg-gray-100 dark:bg-gray-700',
              disabled && 'pointer-events-none opacity-50',
              className
            )}
          >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              {checked && <CheckIcon className="h-4 w-4" />}
            </span>
            {children}
          </button>
        )}
      </Menu.Item>
    );
  }
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

// ========================================
// DROPDOWN MENU RADIO GROUP
// ========================================

interface DropdownMenuRadioGroupProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

const DropdownMenuRadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const DropdownMenuRadioGroup = ({ children, value, onValueChange }: DropdownMenuRadioGroupProps) => {
  return (
    <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
      <div role="group">{children}</div>
    </DropdownMenuRadioGroupContext.Provider>
  );
};

// ========================================
// DROPDOWN MENU RADIO ITEM
// ========================================

interface DropdownMenuRadioItemProps {
  children: React.ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
}

const DropdownMenuRadioItem = React.forwardRef<HTMLButtonElement, DropdownMenuRadioItemProps>(
  ({ children, value, disabled, className }, ref) => {
    const context = React.useContext(DropdownMenuRadioGroupContext);
    const checked = context.value === value;

    return (
      <Menu.Item disabled={disabled}>
        {({ active }) => (
          <button
            ref={ref}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            onClick={() => context.onValueChange?.(value)}
            disabled={disabled}
            className={cn(
              'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors',
              active && 'bg-gray-100 dark:bg-gray-700',
              disabled && 'pointer-events-none opacity-50',
              className
            )}
          >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              {checked && (
                <span className="h-2 w-2 rounded-full bg-current" />
              )}
            </span>
            {children}
          </button>
        )}
      </Menu.Item>
    );
  }
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

// ========================================
// DROPDOWN MENU SEPARATOR
// ========================================

interface DropdownMenuSeparatorProps {
  className?: string;
}

const DropdownMenuSeparator = ({ className }: DropdownMenuSeparatorProps) => {
  return (
    <div
      className={cn('-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700', className)}
      role="separator"
    />
  );
};

// ========================================
// DROPDOWN MENU LABEL
// ========================================

interface DropdownMenuLabelProps {
  children: React.ReactNode;
  className?: string;
  inset?: boolean;
}

const DropdownMenuLabel = ({ children, className, inset }: DropdownMenuLabelProps) => {
  return (
    <div
      className={cn(
        'px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400',
        inset && 'pl-8',
        className
      )}
    >
      {children}
    </div>
  );
};

// ========================================
// DROPDOWN MENU GROUP
// ========================================

interface DropdownMenuGroupProps {
  children: React.ReactNode;
  className?: string;
}

const DropdownMenuGroup = ({ children, className }: DropdownMenuGroupProps) => {
  return <div className={cn('', className)}>{children}</div>;
};

// ========================================
// DROPDOWN MENU SUB (Submenu)
// ========================================

interface DropdownMenuSubProps {
  children: React.ReactNode;
}

interface DropdownMenuSubTriggerProps {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface DropdownMenuSubContentProps {
  children: React.ReactNode;
  className?: string;
}

// Context for submenu state
const DropdownMenuSubContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

const DropdownMenuSub = ({ children }: DropdownMenuSubProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenuSubContext.Provider value={{ open, setOpen }}>
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
    </DropdownMenuSubContext.Provider>
  );
};

const DropdownMenuSubTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuSubTriggerProps>(
  ({ children, className, icon, disabled }, ref) => {
    const { open } = React.useContext(DropdownMenuSubContext);

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
          open && 'bg-gray-100 dark:bg-gray-700',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
      >
        {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
        <span className="flex-1 text-left">{children}</span>
        <ChevronRightIcon className="ml-auto h-4 w-4" />
      </button>
    );
  }
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

const DropdownMenuSubContent = ({ children, className }: DropdownMenuSubContentProps) => {
  const { open } = React.useContext(DropdownMenuSubContext);

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute left-full top-0 z-50 ml-1 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-lg',
        'dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      {children}
    </div>
  );
};

// ========================================
// EXPORTS
// ========================================

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
