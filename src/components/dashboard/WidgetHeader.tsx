'use client';

import React, { ReactNode } from 'react';
import {
  ArrowsPointingOutIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  XMarkIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';

export interface WidgetHeaderProps {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  onExpand?: () => void;
  isLoading?: boolean;
  isDraggable?: boolean;
  actions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger' | 'primary';
  }>;
}

export function WidgetHeader({
  title,
  icon,
  subtitle,
  onRefresh,
  onConfigure,
  onRemove,
  onExpand,
  isLoading = false,
  isDraggable = true,
  actions = []
}: WidgetHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${isDraggable ? 'widget-drag-handle cursor-move' : ''}`}>
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {icon && (
          <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
        {/* Quick Actions */}
        {onRefresh && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              isLoading ? 'animate-spin' : ''
            }`}
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {onExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Expand"
          >
            <ArrowsPointingOutIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* More Actions Menu */}
        {(onConfigure || onRemove || actions.length > 0) && (
          <Menu as="div" className="relative">
            <MenuButton className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <EllipsisVerticalIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </MenuButton>

            <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
              <div className="py-1">
                {onConfigure && (
                  <MenuItem>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfigure();
                        }}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <Cog6ToothIcon className="w-4 h-4 mr-3" />
                        Configure
                      </button>
                    )}
                  </MenuItem>
                )}

                {actions.map((action, index) => (
                  <MenuItem key={index}>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick();
                        }}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } flex items-center w-full px-4 py-2 text-sm ${
                          action.variant === 'danger'
                            ? 'text-red-600 dark:text-red-400'
                            : action.variant === 'primary'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {action.icon && <span className="w-4 h-4 mr-3">{action.icon}</span>}
                        {action.label}
                      </button>
                    )}
                  </MenuItem>
                ))}

                {onRemove && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <MenuItem>
                      {({ active }) => (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                          }}
                          className={`${
                            active ? 'bg-red-50 dark:bg-red-900/20' : ''
                          } flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400`}
                        >
                          <XMarkIcon className="w-4 h-4 mr-3" />
                          Remove Widget
                        </button>
                      )}
                    </MenuItem>
                  </>
                )}
              </div>
            </MenuItems>
          </Menu>
        )}
      </div>
    </div>
  );
}
