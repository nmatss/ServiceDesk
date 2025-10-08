'use client';

/**
 * SwipeActions Component
 * Implements swipeable list items with customizable actions (delete, archive, etc.)
 * iOS-style swipe to reveal actions
 */

import React, { useRef, useState, useCallback, ReactNode } from 'react';
import { TrashIcon, ArchiveBoxIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface SwipeAction {
  id: string;
  label: string;
  icon?: ReactNode;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'gray';
  onAction: () => void | Promise<void>;
  confirm?: boolean;
  confirmMessage?: string;
}

export interface SwipeActionsProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
  threshold?: number;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

const colorClasses = {
  red: 'bg-red-500 text-white',
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  gray: 'bg-gray-500 text-white',
};

export default function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  className = '',
  disabled = false,
  threshold = 80,
  onSwipeStart,
  onSwipeEnd,
}: SwipeActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const maxLeftSwipe = leftActions.length > 0 ? threshold * leftActions.length : 0;
  const maxRightSwipe = rightActions.length > 0 ? threshold * rightActions.length : 0;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isExecuting) return;

      const touch = e.touches[0];
      setStartX(touch.clientX);
      setCurrentX(touch.clientX);
      setIsSwiping(true);
      onSwipeStart?.();

      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(5);
      }
    },
    [disabled, isExecuting, onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping || disabled || isExecuting) return;

      const touch = e.touches[0];
      setCurrentX(touch.clientX);

      const deltaX = touch.clientX - startX;

      // Limit swipe distance
      let newTranslateX = deltaX;

      if (deltaX > 0) {
        // Swiping right (left actions)
        newTranslateX = Math.min(deltaX, maxLeftSwipe);
      } else {
        // Swiping left (right actions)
        newTranslateX = Math.max(deltaX, -maxRightSwipe);
      }

      setTranslateX(newTranslateX);

      // Prevent default scroll if swiping horizontally
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    },
    [isSwiping, disabled, isExecuting, startX, maxLeftSwipe, maxRightSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || disabled || isExecuting) return;

    setIsSwiping(false);
    onSwipeEnd?.();

    // Snap to action position or close
    const absTranslateX = Math.abs(translateX);

    if (absTranslateX < threshold / 2) {
      // Close if not swiped far enough
      setTranslateX(0);
    } else {
      // Snap to nearest action
      const actionIndex = Math.floor(absTranslateX / threshold);
      const snapPosition = (actionIndex + 1) * threshold;

      if (translateX > 0) {
        setTranslateX(Math.min(snapPosition, maxLeftSwipe));
      } else {
        setTranslateX(Math.max(-snapPosition, -maxRightSwipe));
      }
    }
  }, [isSwiping, disabled, isExecuting, translateX, threshold, maxLeftSwipe, maxRightSwipe, onSwipeEnd]);

  const executeAction = async (action: SwipeAction) => {
    if (action.confirm && !showConfirm) {
      setShowConfirm(action.id);
      return;
    }

    setIsExecuting(true);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    try {
      await action.onAction();
    } finally {
      setIsExecuting(false);
      setShowConfirm(null);
      setTranslateX(0);
    }
  };

  const cancelConfirm = () => {
    setShowConfirm(null);
    setTranslateX(0);
  };

  const visibleLeftActions = Math.min(
    Math.ceil(Math.abs(translateX) / threshold),
    leftActions.length
  );

  const visibleRightActions = Math.min(
    Math.ceil(Math.abs(translateX) / threshold),
    rightActions.length
  );

  return (
    <div className={`relative overflow-hidden ${className}`} ref={containerRef}>
      {/* Left actions */}
      {leftActions.length > 0 && translateX > 0 && (
        <div className="absolute inset-y-0 left-0 flex">
          {leftActions.slice(0, visibleLeftActions).map((action, index) => (
            <button
              key={action.id}
              onClick={() => executeAction(action)}
              disabled={isExecuting}
              className={`
                flex items-center justify-center px-6 min-w-[80px] font-medium
                transition-all duration-200 active:brightness-90
                ${colorClasses[action.color]}
                ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={{
                transform: `translateX(${Math.min((translateX / threshold - index) * threshold, threshold)}px)`,
              }}
              aria-label={action.label}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && translateX < 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {rightActions.slice(0, visibleRightActions).map((action, index) => (
            <button
              key={action.id}
              onClick={() => executeAction(action)}
              disabled={isExecuting}
              className={`
                flex items-center justify-center px-6 min-w-[80px] font-medium
                transition-all duration-200 active:brightness-90
                ${colorClasses[action.color]}
                ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={{
                transform: `translateX(${Math.max((translateX / threshold + index) * threshold, -threshold)}px)`,
              }}
              aria-label={action.label}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={`
          relative bg-white dark:bg-gray-800 transition-transform
          ${isSwiping ? '' : 'duration-300 ease-out'}
        `}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mx-4 shadow-xl max-w-sm">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Confirmar ação
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {
                (leftActions.find((a) => a.id === showConfirm) ||
                  rightActions.find((a) => a.id === showConfirm))?.confirmMessage ||
                'Tem certeza que deseja executar esta ação?'
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelConfirm}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium active:brightness-90"
              >
                <XMarkIcon className="h-5 w-5 inline mr-1" />
                Cancelar
              </button>
              <button
                onClick={() => {
                  const action =
                    leftActions.find((a) => a.id === showConfirm) ||
                    rightActions.find((a) => a.id === showConfirm);
                  if (action) executeAction(action);
                }}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium active:brightness-90
                  ${
                    colorClasses[
                      (leftActions.find((a) => a.id === showConfirm) ||
                        rightActions.find((a) => a.id === showConfirm))?.color || 'red'
                    ]
                  }
                `}
              >
                <CheckIcon className="h-5 w-5 inline mr-1" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Pre-configured swipe actions
export const DeleteAction: SwipeAction = {
  id: 'delete',
  label: 'Excluir',
  icon: <TrashIcon className="h-5 w-5" />,
  color: 'red',
  onAction: () => {},
  confirm: true,
  confirmMessage: 'Tem certeza que deseja excluir este item?',
};

export const ArchiveAction: SwipeAction = {
  id: 'archive',
  label: 'Arquivar',
  icon: <ArchiveBoxIcon className="h-5 w-5" />,
  color: 'blue',
  onAction: () => {},
};

export const CompleteAction: SwipeAction = {
  id: 'complete',
  label: 'Concluir',
  icon: <CheckIcon className="h-5 w-5" />,
  color: 'green',
  onAction: () => {},
};
