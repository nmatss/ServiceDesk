import logger from '../monitoring/structured-logger';

/**
 * PWA Offline Sync Manager
 * Handles offline data synchronization and background sync
 */

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  data: unknown;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  enableBatching: boolean;
  syncInterval: number;
  maxQueueSize: number;
}

interface SyncResult {
  success: boolean;
  action: OfflineAction;
  response?: unknown;
  error?: Error;
}

class PWAOfflineSync {
  private db: IDBDatabase | null = null;
  private config: SyncConfig;
  private syncInProgress = false;
  private syncQueue: OfflineAction[] = [];
  private syncIntervalId: number | null = null;
  private storeName = 'offlineActions';
  private dbName = 'ServiceDeskOfflineDB';
  private dbVersion = 1;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 10,
      enableBatching: true,
      syncInterval: 30000, // 30 seconds
      maxQueueSize: 1000,
      ...config
    };

    this.init();
  }

  private async init() {
    try {
      await this.initDatabase();
      await this.loadQueueFromDB();
      this.startPeriodicSync();
      this.setupEventListeners();
      logger.info('[Offline Sync] Initialized successfully');
    } catch (error) {
      logger.error('[Offline Sync] Initialization failed', error);
    }
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('priority', 'priority');
          store.createIndex('entity', 'entity');
        }
      };
    });
  }

  private async loadQueueFromDB(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore('offlineActions');
      const request = store.getAll();

      request.onsuccess = () => {
        this.syncQueue = request.result || [];
        logger.info(`[Offline Sync] Loaded ${this.syncQueue.length} actions from DB`);
      };
    } catch (error) {
      logger.error('[Offline Sync] Failed to load queue from DB', error);
    }
  }

  private setupEventListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      logger.info('[Offline Sync] Back online, starting sync');
      this.sync();
    });

    window.addEventListener('offline', () => {
      logger.info('[Offline Sync] Gone offline');
    });

    // Listen for visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.sync();
      }
    });

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_SUCCESS') {
          this.handleSyncSuccess(event.data.action);
        }
      });
    }
  }

  private startPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = window.setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.sync();
      }
    }, this.config.syncInterval);
  }

  public async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const fullAction: OfflineAction = {
      ...action,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries: action.maxRetries || this.config.maxRetries
    };

    // Check queue size limit
    if (this.syncQueue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority actions
      this.syncQueue = this.syncQueue
        .filter(a => a.priority === 'critical' || a.priority === 'high')
        .slice(-this.config.maxQueueSize * 0.8);
    }

    this.syncQueue.push(fullAction);
    await this.saveActionToDB(fullAction);

    logger.info(`[Offline Sync] Queued action: ${fullAction.type} ${fullAction.entity}`);

    // Try immediate sync if online
    if (navigator.onLine && !this.syncInProgress) {
      setTimeout(() => this.sync(), 1000);
    }

    // Register background sync if available
    this.registerBackgroundSync();

    this.dispatchEvent('actionQueued', { action: fullAction });

    return fullAction.id;
  }

  public async sync(): Promise<SyncResult[]> {
    if (this.syncInProgress || !navigator.onLine || this.syncQueue.length === 0) {
      return [];
    }

    this.syncInProgress = true;
    this.dispatchEvent('syncStarted', { queueSize: this.syncQueue.length });

    logger.info(`[Offline Sync] Starting sync of ${this.syncQueue.length} actions`);

    const results: SyncResult[] = [];
    const actionsToSync = this.getSortedActions();

    try {
      if (this.config.enableBatching) {
        results.push(...await this.syncInBatches(actionsToSync));
      } else {
        results.push(...await this.syncSequentially(actionsToSync));
      }
    } catch (error) {
      logger.error('[Offline Sync] Sync failed', error);
    } finally {
      this.syncInProgress = false;
      this.dispatchEvent('syncCompleted', {
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });
    }

    return results;
  }

  private getSortedActions(): OfflineAction[] {
    // Sort by priority and timestamp
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return [...this.syncQueue].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
  }

  private async syncInBatches(actions: OfflineAction[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (let i = 0; i < actions.length; i += this.config.batchSize) {
      const batch = actions.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(action => this.syncAction(action));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const action = batch[index];
        if (!action) return;

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            action,
            error: new Error(result.reason)
          });
        }
      });

      // Small delay between batches
      if (i + this.config.batchSize < actions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private async syncSequentially(actions: OfflineAction[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const action of actions) {
      try {
        const result = await this.syncAction(action);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          action,
          error: error as Error
        });
      }
    }

    return results;
  }

  private async syncAction(action: OfflineAction): Promise<SyncResult> {
    try {
      logger.info(`[Offline Sync] Syncing: ${action.type} ${action.entity}`);

      const response = await fetch(action.url, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...action.headers
        },
        body: action.data ? JSON.stringify(action.data) : undefined
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => null);

        // Remove from queue and database
        const actionToRemove = this.syncQueue.find(a => a.id === action.id);
        if (actionToRemove) {
          await this.removeActionFromQueue(action.id);
        }

        logger.info(`[Offline Sync] Successfully synced: ${action.type} ${action.entity}`);

        this.dispatchEvent('actionSynced', { action, response: responseData });

        return {
          success: true,
          action,
          response: responseData
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`[Offline Sync] Failed to sync action ${action.id}:`, error);

      // Increment retry count
      action.retries += 1;

      if (action.retries >= action.maxRetries) {
        logger.info(`[Offline Sync] Max retries reached for action ${action.id}, removing from queue`);
        await this.removeActionFromQueue(action.id);
        this.dispatchEvent('actionFailed', { action, error });
      } else {
        logger.info(`[Offline Sync] Scheduling retry ${action.retries}/${action.maxRetries} for action ${action.id}`);
        await this.saveActionToDB(action);
        this.dispatchEvent('actionRetry', { action, error });
      }

      return {
        success: false,
        action,
        error: error as Error
      };
    }
  }

  private async removeActionFromQueue(actionId: string): Promise<void> {
    // Remove from memory queue
    this.syncQueue = this.syncQueue.filter(action => action.id !== actionId);

    // Remove from database
    await this.removeActionFromDB(actionId);
  }

  private async saveActionToDB(action: OfflineAction): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.put(action);
    } catch (error) {
      logger.error('[Offline Sync] Failed to save action to DB', error);
    }
  }

  private async removeActionFromDB(actionId: string): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.delete(actionId);
    } catch (error) {
      logger.error('[Offline Sync] Failed to remove action from DB', error);
    }
  }

  private async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as any).sync.register('servicedesk-offline-sync');
        }
      } catch (error) {
        logger.warn('[Offline Sync] Background sync registration failed', error);
      }
    }
  }

  private handleSyncSuccess(action: OfflineAction) {
    this.removeActionFromQueue(action.id);
    this.dispatchEvent('backgroundSyncSuccess', { action });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getQueueStatus() {
    const byPriority = this.syncQueue.reduce((acc, action) => {
      acc[action.priority] = (acc[action.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byEntity = this.syncQueue.reduce((acc, action) => {
      acc[action.entity] = (acc[action.entity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.syncQueue.length,
      byPriority,
      byEntity,
      syncInProgress: this.syncInProgress,
      isOnline: navigator.onLine
    };
  }

  public clearQueue(): Promise<void> {
    return new Promise(async (resolve) => {
      this.syncQueue = [];

      if (this.db) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        await store.clear();
      }

      this.dispatchEvent('queueCleared', {});
      resolve();
    });
  }

  private dispatchEvent(eventType: string, detail: unknown) {
    window.dispatchEvent(new CustomEvent(`pwa:${eventType}`, { detail }));
  }

  public addEventListener(eventType: string, listener: EventListener) {
    window.addEventListener(`pwa:${eventType}`, listener);
  }

  public removeEventListener(eventType: string, listener: EventListener) {
    window.removeEventListener(`pwa:${eventType}`, listener);
  }

  public destroy() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
let offlineSyncInstance: PWAOfflineSync | null = null;

export function getPWAOfflineSync(config?: Partial<SyncConfig>): PWAOfflineSync {
  if (!offlineSyncInstance) {
    offlineSyncInstance = new PWAOfflineSync(config);
  }
  return offlineSyncInstance;
}

export default PWAOfflineSync;