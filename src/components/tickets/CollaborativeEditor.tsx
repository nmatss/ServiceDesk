'use client';

/**
 * CollaborativeEditor - Real-time collaborative editing component
 * Features live cursors, conflict resolution, and synchronized editing
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '@/src/hooks/useSocket';
import { useDebounce } from '@/src/hooks/useDebounce';
import type { User } from '@/lib/types/database';
import type { Socket } from 'socket.io-client';

// Icons
import {
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface CollaborativeUser {
  user: User;
  cursor: {
    position: number;
    selection: { start: number; end: number } | null;
  };
  lastSeen: Date;
  isTyping: boolean;
  color: string;
}

interface EditOperation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: number;
  timestamp: Date;
}

interface ConflictResolution {
  conflictId: string;
  operations: EditOperation[];
  resolved: boolean;
  strategy: 'last_write_wins' | 'merge' | 'manual';
}

interface CollaborativeEditorProps {
  ticketId: number;
  initialContent: string;
  currentUser: User;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  showCollaborators?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

interface EditorState {
  content: string;
  version: number;
  lastSaved: Date | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
}

// Reserved for future use when assigning colors to new collaborators
// const COLLABORATOR_COLORS = [
//   '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
//   '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
// ];

export function CollaborativeEditor({
  ticketId,
  initialContent,
  currentUser,
  onContentChange,
  onSave,
  readOnly = false,
  className = '',
  placeholder = 'Start typing...',
  maxLength = 10000,
  showCollaborators = true,
  autoSave = true,
  autoSaveDelay = 2000
}: CollaborativeEditorProps) {
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const operationIdRef = useRef(0);

  // State
  const [editorState, setEditorState] = useState<EditorState>({
    content: initialContent,
    version: 0,
    lastSaved: null,
    isDirty: false,
    isSaving: false,
    saveError: null
  });

  const [collaborators, setCollaborators] = useState<Map<number, CollaborativeUser>>(new Map());
  const [_operations, setOperations] = useState<EditOperation[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Socket connection
  const socketConnection = useSocket();
  const socket: Socket | null = socketConnection.socket;

  // Debounced content for auto-save
  const debouncedContent = useDebounce(editorState.content, autoSaveDelay);

  // Auto-save effect
  useEffect(() => {
    if (autoSave && editorState.isDirty && debouncedContent && onSave) {
      handleAutoSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedContent, autoSave, editorState.isDirty]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Join collaboration room
    socket.emit('join-editor', { ticketId, user: currentUser });

    // Handle connection status
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // Handle collaborator events
    const handleUserJoined = (data: { user: User; color: string }) => {
      setCollaborators(prev => {
        const updated = new Map(prev);
        updated.set(data.user.id, {
          user: data.user,
          cursor: { position: 0, selection: null },
          lastSeen: new Date(),
          isTyping: false,
          color: data.color
        });
        return updated;
      });
    };

    const handleUserLeft = (userId: number) => {
      setCollaborators(prev => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });
    };

    const handleCursorUpdate = (data: {
      userId: number;
      cursor: { position: number; selection: { start: number; end: number } | null };
    }) => {
      setCollaborators(prev => {
        const updated = new Map(prev);
        const collaborator = updated.get(data.userId);
        if (collaborator) {
          updated.set(data.userId, {
            ...collaborator,
            cursor: data.cursor,
            lastSeen: new Date()
          });
        }
        return updated;
      });
    };

    const handleTypingStatus = (data: { userId: number; isTyping: boolean }) => {
      setCollaborators(prev => {
        const updated = new Map(prev);
        const collaborator = updated.get(data.userId);
        if (collaborator) {
          updated.set(data.userId, {
            ...collaborator,
            isTyping: data.isTyping,
            lastSeen: new Date()
          });
        }
        return updated;
      });
    };

    // Handle edit operations
    const handleOperation = (operation: EditOperation) => {
      if (operation.userId === currentUser.id) return; // Skip own operations

      applyOperation(operation);
    };

    const handleConflict = (conflict: ConflictResolution) => {
      setConflicts(prev => [...prev, conflict]);
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('typing-status', handleTypingStatus);
    socket.on('edit-operation', handleOperation);
    socket.on('edit-conflict', handleConflict);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('cursor-update', handleCursorUpdate);
      socket.off('typing-status', handleTypingStatus);
      socket.off('edit-operation', handleOperation);
      socket.off('edit-conflict', handleConflict);
      socket.emit('leave-editor', { ticketId, userId: currentUser.id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, ticketId, currentUser.id]);

  // Apply received operation
  const applyOperation = useCallback((operation: EditOperation) => {
    setEditorState(prev => {
      let newContent = prev.content;

      switch (operation.type) {
        case 'insert':
          if (operation.content) {
            newContent = newContent.slice(0, operation.position) +
                        operation.content +
                        newContent.slice(operation.position);
          }
          break;

        case 'delete':
          if (operation.length) {
            newContent = newContent.slice(0, operation.position) +
                        newContent.slice(operation.position + operation.length);
          }
          break;

        case 'retain':
          // No change to content, just cursor movement
          break;
      }

      return {
        ...prev,
        content: newContent,
        version: prev.version + 1
      };
    });

    setOperations(prev => [...prev, operation]);
  }, []);

  // Send operation to other collaborators
  const sendOperation = useCallback((operation: EditOperation) => {
    if (socket && isConnected) {
      socket.emit('edit-operation', {
        ticketId,
        operation: {
          ...operation,
          id: `${currentUser.id}-${operationIdRef.current++}`,
          userId: currentUser.id,
          timestamp: new Date()
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected, ticketId, currentUser.id]);

  // Handle text area changes
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const selectionStart = e.target.selectionStart;
    const selectionEnd = e.target.selectionEnd;

    // Calculate the operation
    const oldContent = editorState.content;
    const operation = calculateOperation(oldContent, newContent, selectionStart);

    if (operation) {
      sendOperation(operation);
    }

    // Update local state
    setEditorState(prev => ({
      ...prev,
      content: newContent,
      version: prev.version + 1,
      isDirty: true,
      saveError: null
    }));

    // Send cursor position
    if (socket && isConnected) {
      socket.emit('cursor-update', {
        ticketId,
        cursor: {
          position: selectionStart,
          selection: selectionStart !== selectionEnd ? { start: selectionStart, end: selectionEnd } : null
        }
      });
    }

    // Notify parent component
    if (onContentChange) {
      onContentChange(newContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.content, socket, isConnected, ticketId, sendOperation, onContentChange]);

  // Handle selection changes
  const handleSelectionChange = useCallback(() => {
    if (!textareaRef.current || !socket || !isConnected) return;

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;

    socket.emit('cursor-update', {
      ticketId,
      cursor: {
        position: selectionStart,
        selection: selectionStart !== selectionEnd ? { start: selectionStart, end: selectionEnd } : null
      }
    });
  }, [socket, isConnected, ticketId]);

  // Typing indicator
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback(() => {
    if (!socket || !isConnected) return;

    // Send typing status
    socket.emit('typing-status', { ticketId, isTyping: true });

    // Clear existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    // Set timer to stop typing indicator
    const timer = setTimeout(() => {
      socket.emit('typing-status', { ticketId, isTyping: false });
    }, 1000);

    typingTimerRef.current = timer;
  }, [socket, isConnected, ticketId]);

  // Auto-save handler
  const handleAutoSave = useCallback(async () => {
    if (!onSave || editorState.isSaving) return;

    setEditorState(prev => ({ ...prev, isSaving: true, saveError: null }));

    try {
      await onSave(editorState.content);
      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false,
        lastSaved: new Date()
      }));
    } catch (error) {
      setEditorState(prev => ({
        ...prev,
        isSaving: false,
        saveError: error instanceof Error ? error.message : 'Save failed'
      }));
    }
  }, [onSave, editorState.content, editorState.isSaving]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    await handleAutoSave();
  }, [handleAutoSave]);

  // Calculate operation from content changes
  const calculateOperation = (
    oldContent: string,
    newContent: string,
    cursorPosition: number
  ): EditOperation | null => {
    // Simple diff algorithm - in production, use a more sophisticated one
    if (newContent.length > oldContent.length) {
      // Insertion
      const insertPosition = cursorPosition - (newContent.length - oldContent.length);
      const insertedText = newContent.slice(insertPosition, cursorPosition);

      return {
        id: '',
        type: 'insert',
        position: insertPosition,
        content: insertedText,
        userId: currentUser.id,
        timestamp: new Date()
      };
    } else if (newContent.length < oldContent.length) {
      // Deletion
      const deleteLength = oldContent.length - newContent.length;

      return {
        id: '',
        type: 'delete',
        position: cursorPosition,
        length: deleteLength,
        userId: currentUser.id,
        timestamp: new Date()
      };
    }

    return null;
  };

  // Resolve conflicts
  const resolveConflict = useCallback((conflictId: string, strategy: 'last_write_wins' | 'merge' | 'manual') => {
    setConflicts(prev => prev.map(conflict =>
      conflict.conflictId === conflictId
        ? { ...conflict, resolved: true, strategy }
        : conflict
    ));
  }, []);

  // Get active collaborators list
  const activeCollaborators = useMemo(() => {
    return Array.from(collaborators.values()).filter(c => c.user.id !== currentUser.id);
  }, [collaborators, currentUser.id]);

  // Status indicators
  const statusColor = isConnected ? 'green' : 'red';
  const statusText = isConnected ? 'Connected' : 'Disconnected';

  return (
    <div className={`relative ${className}`}>
      {/* Header with collaborators and status */}
      {showCollaborators && (
        <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-t-lg border border-gray-200 dark:border-gray-700">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${statusColor === 'green' ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-300">{statusText}</span>
            {editorState.isSaving && (
              <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span className="text-sm">Saving...</span>
              </div>
            )}
          </div>

          {/* Active Collaborators */}
          <div className="flex items-center space-x-2">
            {activeCollaborators.map((collaborator) => (
              <div
                key={collaborator.user.id}
                className="flex items-center space-x-1 px-2 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                style={{ borderLeftColor: collaborator.color, borderLeftWidth: '3px' }}
              >
                <UserIcon className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {collaborator.user.name}
                </span>
                {collaborator.isTyping && (
                  <div className="flex space-x-0.5">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            ))}
            {activeCollaborators.length === 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">No other collaborators</span>
            )}
          </div>
        </div>
      )}

      {/* Conflict Alerts */}
      {conflicts.filter(c => !c.resolved).length > 0 && (
        <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Edit Conflicts Detected
            </span>
          </div>
          <div className="space-y-2">
            {conflicts.filter(c => !c.resolved).map((conflict) => (
              <div key={conflict.conflictId} className="flex items-center justify-between">
                <span className="text-sm text-orange-700 dark:text-orange-300">
                  {conflict.operations.length} conflicting operations
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => resolveConflict(conflict.conflictId, 'last_write_wins')}
                    className="text-xs px-2 py-1 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded"
                  >
                    Keep Latest
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict.conflictId, 'merge')}
                    className="text-xs px-2 py-1 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded"
                  >
                    Merge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={editorState.content}
          onChange={handleContentChange}
          onSelect={handleSelectionChange}
          onKeyDown={handleTyping}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          className={`w-full min-h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none ${
            readOnly ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''
          } ${showCollaborators ? 'rounded-t-none' : ''}`}
          style={{ minHeight: '200px' }}
        />

        {/* Collaborator Cursors Overlay */}
        {isConnected && activeCollaborators.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {activeCollaborators.map((collaborator) => {
              if (!collaborator.cursor.selection) return null;

              const { start } = collaborator.cursor.selection;
              // In a real implementation, you'd calculate pixel positions
              // This is a simplified example
              return (
                <div
                  key={collaborator.user.id}
                  className="absolute border-l-2 border-opacity-70"
                  style={{
                    borderColor: collaborator.color,
                    // These would be calculated based on actual text measurements
                    left: `${Math.min(start * 8, 90)}%`,
                    top: `${Math.floor(start / 50) * 20 + 12}px`,
                    height: '20px'
                  }}
                >
                  <div
                    className="absolute -top-6 left-0 px-1 py-0.5 rounded text-xs text-white whitespace-nowrap"
                    style={{ backgroundColor: collaborator.color }}
                  >
                    {collaborator.user.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          <span>{editorState.content.length}/{maxLength} characters</span>
          {editorState.lastSaved && (
            <div className="flex items-center space-x-1">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>Saved {editorState.lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          {editorState.isDirty && !editorState.isSaving && (
            <div className="flex items-center space-x-1">
              <ClockIcon className="h-4 w-4 text-orange-500" />
              <span>Unsaved changes</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {editorState.saveError && (
            <span className="text-red-500">Save failed</span>
          )}
          {onSave && !autoSave && (
            <button
              onClick={handleManualSave}
              disabled={!editorState.isDirty || editorState.isSaving}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editorState.isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}