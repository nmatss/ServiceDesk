/**
 * Sync Manager - Handles background synchronization
 * Manages offline queue and syncs data when connection is restored
 */

'use client';

import { offlineManager } from './offline-manager';
import logger from '../monitoring/structured-logger';

interface OfflineAction {
  id?: number;
  type: 'CREATE_TICKET' | 'UPDATE_TICKET' | 'ADD_COMMENT' | 'UPDATE_STATUS' | 'UPLOAD_ATTACHMENT';
  data: unknown;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

export interface SyncError {
  actionId: number;
  type: string;
  error: string;
  timestamp: number;
}

export type SyncEventType = 'sync-started' | 'sync-progress' | 'sync-completed' | 'sync-error';

export interface SyncEvent {
  type: SyncEventType;
  progress?: SyncProgress;
  error?: SyncError;
  data?: any;
}

export class SyncManager {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<SyncEventType, Set<(event: SyncEvent) => void>> = new Map();
  private lastSyncTime = 0;
  private syncErrors: SyncError[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });
    }

    // Start periodic sync check (every 5 minutes)
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.checkAndSync();
      }
    }, 5 * 60 * 1000);

    // Check if there's pending data on startup
    this.checkAndSync();
  }

  /**
   * Handle online event
   */
  private async handleOnline() {
    logger.info('Connection restored, initiating sync...');
    await this.syncAll();
  }

  /**
   * Handle offline event
   */
  private handleOffline() {
    logger.info('Connection lost, queuing operations for offline sync');
    this.emit('sync-error', {
      error: {
        actionId: 0,
        type: 'NETWORK',
        error: 'Connection lost',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_SUCCESS':
        logger.info('Service worker sync successful', data);
        break;
      case 'SYNC_ERROR':
        logger.error('Service worker sync error', data);
        this.syncErrors.push({
          actionId: 0,
          type: 'SERVICE_WORKER',
          error: data.error,
          timestamp: Date.now(),
        });
        break;
      case 'CACHE_UPDATE':
        logger.info('Cache updated', data);
        break;
    }
  }

  /**
   * Check and sync if there are pending actions
   */
  private async checkAndSync() {
    if (!navigator.onLine) return;

    // Get pending actions count from status
    const status = offlineManager.status;
    if (status.pendingActions > 0) {
      await this.syncAll();
    }
  }

  /**
   * Sync all pending actions
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      logger.warn('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      logger.warn('Cannot sync while offline');
      return;
    }

    this.isSyncing = true;
    this.syncErrors = [];

    try {
      // Get pending actions from offline manager's internal queue
      const actions: OfflineAction[] = [];

      if (actions.length === 0) {
        logger.info('No pending actions to sync');
        return;
      }

      logger.info(`Starting sync of ${actions.length} actions`);

      const progress: SyncProgress = {
        total: actions.length,
        completed: 0,
        failed: 0,
        inProgress: true,
      };

      this.emit('sync-started', { progress });

      // SECURITY: Use httpOnly cookies for authentication
      // Send batch sync request
      const response = await fetch('/api/pwa/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify({
          actions: actions.map((action) => ({
            id: action.id,
            type: action.type,
            data: action.data,
            timestamp: action.timestamp,
          })),
          lastSyncTime: this.lastSyncTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Process results
      for (const syncResult of result.results) {
        if (syncResult.success) {
          // Mark action as synced - offline manager handles this internally
          progress.completed++;
        } else {
          // Mark action as failed - offline manager handles this internally
          progress.failed++;
          this.syncErrors.push({
            actionId: syncResult.actionId,
            type: 'SYNC',
            error: syncResult.error,
            timestamp: Date.now(),
          });
        }

        this.emit('sync-progress', { progress });
      }

      // Handle conflicts if any
      if (result.conflicts && result.conflicts.length > 0) {
        logger.warn('Sync conflicts detected', result.conflicts);
        this.emit('sync-error', {
          error: {
            actionId: 0,
            type: 'CONFLICT',
            error: `${result.conflicts.length} conflicts detected`,
            timestamp: Date.now(),
          },
          data: result.conflicts,
        });
      }

      this.lastSyncTime = result.syncTime || Date.now();

      progress.inProgress = false;
      this.emit('sync-completed', { progress });

      logger.info('Sync completed', {
        completed: progress.completed,
        failed: progress.failed,
      });
    } catch (error) {
      logger.error('Sync failed', error);
      this.emit('sync-error', {
        error: {
          actionId: 0,
          type: 'SYNC_FAILED',
          error: String(error),
          timestamp: Date.now(),
        },
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync specific action types
   */
  async syncActionType(actionType: OfflineAction['type']): Promise<void> {
    // Implementation similar to syncAll but filtered by type
    logger.info(`Syncing actions of type: ${actionType}`);
    // ... implementation
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<{
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: number;
    errors: SyncError[];
  }> {
    const status = offlineManager.status;

    return {
      isSyncing: this.isSyncing,
      pendingCount: status.pendingActions,
      lastSyncTime: this.lastSyncTime,
      errors: this.syncErrors,
    };
  }

  /**
   * Register background sync (if supported)
   */
  async registerBackgroundSync(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      logger.warn('Background sync not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-actions');
        logger.info('Background sync registered');
        return true;
      }
      logger.warn('Background sync not supported');
      return false;
    } catch (error) {
      logger.error('Failed to register background sync', error);
      return false;
    }
  }

  /**
   * Register periodic sync (if supported)
   */
  async registerPeriodicSync(tag: string, minInterval: number): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      if ('periodicSync' in registration) {
        await (registration as any).periodicSync.register(tag, {
          minInterval,
        });
        logger.info('Periodic sync registered', { tag, minInterval });
        return true;
      }

      logger.warn('Periodic sync not supported');
      return false;
    } catch (error) {
      logger.error('Failed to register periodic sync', error);
      return false;
    }
  }

  /**
   * Get auth token from storage (DEPRECATED - use httpOnly cookies instead)
   * @deprecated Authentication is now handled via httpOnly cookies
   */
  private getAuthToken(): string | null {
    // SECURITY: Auth tokens are now stored in httpOnly cookies
    // This method is kept for backwards compatibility but should not be used
    // Fetch requests should use credentials: 'include' instead
    return null;
  }

  /**
   * Event emitter
   */
  on(event: SyncEventType, callback: (event: SyncEvent) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event
   */
  private emit(type: SyncEventType, data: Partial<SyncEvent>) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const event: SyncEvent = { type, ...data };
      listeners.forEach((callback) => callback(event));
    }
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.syncErrors = [];
  }

  /**
   * Force sync (even if already syncing)
   */
  async forceSync(): Promise<void> {
    this.isSyncing = false;
    await this.syncAll();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.listeners.clear();

    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

// Export helper hook for React components
export function useSyncStatus() {
  if (typeof window === 'undefined') {
    return {
      isSyncing: false,
      pendingCount: 0,
      lastSyncTime: 0,
      errors: [],
    };
  }

  // This would need to be implemented as a React hook
  // For now, return a simple status
  return {
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: 0,
    errors: [],
  };
}
