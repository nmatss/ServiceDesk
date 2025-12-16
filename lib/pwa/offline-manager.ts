'use client';

// ServiceDesk PWA - Offline Data Management
import { toast } from 'react-hot-toast';
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

interface OfflineData {
  tickets: Map<string, TicketData>;
  comments: Map<string, CommentData[]>;
  attachments: Map<string, AttachmentData[]>;
  lastSync: number;
}

interface TicketData {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  userId?: string;
  lastModified: number;
  isOffline?: boolean;
  [key: string]: unknown;
}

interface CommentData {
  id: string;
  ticketId: string;
  createdAt?: string;
  isOffline?: boolean;
  [key: string]: unknown;
}

interface AttachmentData {
  id: string;
  ticketId?: string;
  commentId?: string;
  [key: string]: unknown;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncTime: Date | null;
  syncErrors: SyncError[];
}

interface SyncError {
  timestamp: number;
  error: string;
}

class OfflineManager {
  private db: IDBDatabase | null = null;
  private data: OfflineData = {
    tickets: new Map(),
    comments: new Map(),
    attachments: new Map(),
    lastSync: 0,
  };

  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingActions: 0,
    lastSyncTime: null,
    syncErrors: [],
  };

  private listeners: Map<string, Set<Function>> = new Map();
  private syncQueue: OfflineAction[] = [];
  private conflictResolver: ConflictResolver;

  constructor() {
    this.conflictResolver = new ConflictResolver();
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private async initialize() {
    await this.initializeIndexedDB();
    await this.loadOfflineData();
    this.setupNetworkListeners();
    this.startSyncProcess();
  }

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ServiceDeskOfflineDB', 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Actions queue store
        if (!db.objectStoreNames.contains('actions')) {
          const actionsStore = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
          actionsStore.createIndex('timestamp', 'timestamp');
          actionsStore.createIndex('type', 'type');
        }

        // Cached data stores
        if (!db.objectStoreNames.contains('tickets')) {
          const ticketsStore = db.createObjectStore('tickets', { keyPath: 'id' });
          ticketsStore.createIndex('lastModified', 'lastModified');
          ticketsStore.createIndex('status', 'status');
        }

        if (!db.objectStoreNames.contains('comments')) {
          const commentsStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentsStore.createIndex('ticketId', 'ticketId');
          commentsStore.createIndex('timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentsStore.createIndex('ticketId', 'ticketId');
          attachmentsStore.createIndex('commentId', 'commentId');
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async loadOfflineData(): Promise<void> {
    if (!this.db) return;

    try {
      // Load tickets
      const tickets = await this.getAllFromStore('tickets');
      tickets.forEach((ticket: any) => {
        this.data.tickets.set(ticket.id, ticket);
      });

      // Load comments
      const comments = await this.getAllFromStore('comments');
      comments.forEach((comment: any) => {
        if (!this.data.comments.has(comment.ticketId)) {
          this.data.comments.set(comment.ticketId, []);
        }
        this.data.comments.get(comment.ticketId)!.push(comment);
      });

      // Load attachments
      const attachments = await this.getAllFromStore('attachments');
      attachments.forEach((attachment: any) => {
        const key = attachment.ticketId || attachment.commentId;
        if (!this.data.attachments.has(key)) {
          this.data.attachments.set(key, []);
        }
        this.data.attachments.get(key)!.push(attachment);
      });

      // Load pending actions
      const actionsResult = await this.getAllFromStore('actions');
      this.syncQueue = actionsResult as OfflineAction[];
      this.syncStatus.pendingActions = this.syncQueue.length;

      // Load metadata
      const metadata = await this.getFromStore('metadata', 'lastSync');
      if (metadata && typeof metadata === 'object' && 'value' in metadata) {
        const metadataObj = metadata as { key: string; value: number };
        this.data.lastSync = metadataObj.value;
        this.syncStatus.lastSyncTime = new Date(metadataObj.value);
      }

      logger.info(`Loaded offline data: ${this.data.tickets.size} tickets, ${this.syncQueue.length} pending actions`);
    } catch (error) {
      logger.error('Failed to load offline data', error);
    }
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.syncStatus.isOnline = true;
    this.emit('network-status-change', true);
    this.startSyncProcess();
  }

  private handleOffline(): void {
    this.syncStatus.isOnline = false;
    this.emit('network-status-change', false);
  }

  private async startSyncProcess(): Promise<void> {
    if (!this.syncStatus.isOnline || this.syncStatus.isSyncing) {
      return;
    }

    this.syncStatus.isSyncing = true;
    this.emit('sync-status-change', this.syncStatus);

    try {
      // First, sync server changes
      await this.syncFromServer();

      // Then, sync local changes
      await this.syncToServer();

      this.syncStatus.lastSyncTime = new Date();
      this.data.lastSync = Date.now();
      await this.saveMetadata('lastSync', this.data.lastSync);

      logger.info('Sync completed successfully');
      toast.success('Dados sincronizados com sucesso!', {
        icon: '✅',
        duration: 2000,
      });
    } catch (error) {
      logger.error('Sync failed', error);
      this.syncStatus.syncErrors.push({
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      toast.error('Falha na sincronização', {
        icon: '❌',
        duration: 3000,
      });
    } finally {
      this.syncStatus.isSyncing = false;
      this.emit('sync-status-change', this.syncStatus);
    }
  }

  private async syncFromServer(): Promise<void> {
    const lastSync = this.data.lastSync;

    try {
      // Fetch updated tickets
      const response = await fetch(`/api/tickets/sync?since=${lastSync}`, {
        headers: {
          'X-Offline-Sync': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`Server sync failed: ${response.status}`);
      }

      const { tickets, comments, attachments } = await response.json();

      // Update local data with server changes
      for (const ticket of tickets) {
        await this.handleServerTicketUpdate(ticket);
      }

      for (const comment of comments) {
        await this.handleServerCommentUpdate(comment);
      }

      for (const attachment of attachments) {
        await this.handleServerAttachmentUpdate(attachment);
      }

    } catch (error) {
      logger.error('Failed to sync from server', error);
      throw error;
    }
  }

  private async syncToServer(): Promise<void> {
    const actionsToSync = [...this.syncQueue].sort((a, b) => a.timestamp - b.timestamp);

    for (const action of actionsToSync) {
      try {
        await this.syncAction(action);

        // Remove successful action from queue
        await this.removeFromStore('actions', action.id!);
        this.syncQueue = this.syncQueue.filter(a => a.id !== action.id);
        this.syncStatus.pendingActions = this.syncQueue.length;

      } catch (error) {
        logger.error('Failed to sync action', action, error);

        // Increment retry count
        action.retryCount++;

        if (action.retryCount >= action.maxRetries) {
          // Remove failed action after max retries
          await this.removeFromStore('actions', action.id!);
          this.syncQueue = this.syncQueue.filter(a => a.id !== action.id);
          this.syncStatus.pendingActions = this.syncQueue.length;

          toast.error(`Falha ao sincronizar ação: ${action.type}`, {
            icon: '❌',
            duration: 4000,
          });
        } else {
          // Update retry count in storage
          await this.saveToStore('actions', action);
        }
      }
    }
  }

  private async syncAction(action: OfflineAction): Promise<void> {
    const response = await fetch(action.url, {
      method: action.method,
      headers: {
        ...action.headers,
        'X-Offline-Sync': 'true',
      },
      body: action.method !== 'GET' ? JSON.stringify(action.data) : undefined,
    });

    if (!response.ok) {
      if (response.status === 409) {
        // Conflict - resolve using conflict resolver
        const serverData = await response.json();
        await this.conflictResolver.resolve(action, serverData);
      } else {
        throw new Error(`Sync failed: ${response.status}`);
      }
    }

    const result = await response.json();

    // Update local data with server response
    switch (action.type) {
      case 'CREATE_TICKET':
        await this.updateLocalTicket(result);
        break;
      case 'UPDATE_TICKET':
        await this.updateLocalTicket(result);
        break;
      case 'ADD_COMMENT':
        await this.updateLocalComment(result);
        break;
      // Add more cases as needed
    }
  }

  // Public API for offline actions

  async createTicketOffline(ticketData: Partial<TicketData>): Promise<string> {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const ticket = {
      id: tempId,
      ...ticketData,
      createdAt: new Date().toISOString(),
      lastModified: Date.now(),
      isOffline: true,
    };

    // Save to local storage
    this.data.tickets.set(tempId, ticket);
    await this.saveToStore('tickets', ticket);

    // Queue for sync
    const action: OfflineAction = {
      type: 'CREATE_TICKET',
      data: ticketData,
      url: '/api/tickets',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    await this.queueAction(action);

    this.emit('ticket-created-offline', ticket);

    toast.success('Ticket criado offline - será sincronizado quando online', {
      icon: '💾',
      duration: 3000,
    });

    return tempId;
  }

  async updateTicketOffline(ticketId: string, updates: Partial<TicketData>): Promise<void> {
    const existingTicket = this.data.tickets.get(ticketId);
    if (!existingTicket) {
      throw new Error('Ticket not found in offline storage');
    }

    const updatedTicket = {
      ...existingTicket,
      ...updates,
      lastModified: Date.now(),
      isOffline: true,
    };

    this.data.tickets.set(ticketId, updatedTicket);
    await this.saveToStore('tickets', updatedTicket);

    const action: OfflineAction = {
      type: 'UPDATE_TICKET',
      data: updates,
      url: `/api/tickets/${ticketId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    await this.queueAction(action);

    this.emit('ticket-updated-offline', updatedTicket);

    toast.success('Ticket atualizado offline', {
      icon: '💾',
      duration: 2000,
    });
  }

  async addCommentOffline(ticketId: string, commentData: Partial<CommentData>): Promise<string> {
    const tempId = `temp_comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const comment = {
      id: tempId,
      ticketId,
      ...commentData,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };

    // Save to local storage
    if (!this.data.comments.has(ticketId)) {
      this.data.comments.set(ticketId, []);
    }
    this.data.comments.get(ticketId)!.push(comment);
    await this.saveToStore('comments', comment);

    // Queue for sync
    const action: OfflineAction = {
      type: 'ADD_COMMENT',
      data: commentData,
      url: `/api/tickets/${ticketId}/comments`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    await this.queueAction(action);

    this.emit('comment-added-offline', comment);

    toast.success('Comentário adicionado offline', {
      icon: '💾',
      duration: 2000,
    });

    return tempId;
  }

  // Data retrieval methods

  getTicket(ticketId: string): TicketData | null {
    return this.data.tickets.get(ticketId) || null;
  }

  getTickets(filters?: { status?: string; userId?: string; search?: string }): TicketData[] {
    let tickets = Array.from(this.data.tickets.values());

    if (filters) {
      if (filters.status) {
        tickets = tickets.filter(t => t.status === filters.status);
      }
      if (filters.userId) {
        tickets = tickets.filter(t => t.userId === filters.userId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        tickets = tickets.filter(t =>
          t.title?.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
        );
      }
    }

    return tickets.sort((a, b) => b.lastModified - a.lastModified);
  }

  getComments(ticketId: string): CommentData[] {
    return this.data.comments.get(ticketId) || [];
  }

  getAttachments(targetId: string): AttachmentData[] {
    return this.data.attachments.get(targetId) || [];
  }

  // Utility methods

  private async queueAction(action: OfflineAction): Promise<void> {
    this.syncQueue.push(action);
    this.syncStatus.pendingActions = this.syncQueue.length;
    await this.saveToStore('actions', action);
    this.emit('sync-status-change', this.syncStatus);

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      setTimeout(() => this.startSyncProcess(), 1000);
    }
  }

  private async handleServerTicketUpdate(serverTicket: TicketData): Promise<void> {
    const localTicket = this.data.tickets.get(serverTicket.id);

    if (!localTicket || serverTicket.lastModified > localTicket.lastModified) {
      // Server version is newer or we don't have local version
      this.data.tickets.set(serverTicket.id, serverTicket);
      await this.saveToStore('tickets', serverTicket);
      this.emit('ticket-updated-from-server', serverTicket);
    } else if (localTicket.isOffline && localTicket.lastModified > serverTicket.lastModified) {
      // Local version has offline changes that are newer - conflict
      await this.conflictResolver.resolveTicketConflict(localTicket, serverTicket);
    }
  }

  private async handleServerCommentUpdate(serverComment: CommentData): Promise<void> {
    const ticketComments = this.data.comments.get(serverComment.ticketId) || [];
    const existingIndex = ticketComments.findIndex(c => c.id === serverComment.id);

    if (existingIndex === -1) {
      // New comment from server
      ticketComments.push(serverComment);
      this.data.comments.set(serverComment.ticketId, ticketComments);
      await this.saveToStore('comments', serverComment);
      this.emit('comment-added-from-server', serverComment);
    }
  }

  private async handleServerAttachmentUpdate(serverAttachment: AttachmentData): Promise<void> {
    const key = serverAttachment.ticketId || serverAttachment.commentId || '';
    if (!key) return;

    const attachments = this.data.attachments.get(key) || [];
    const existingIndex = attachments.findIndex(a => a.id === serverAttachment.id);

    if (existingIndex === -1) {
      // New attachment from server
      attachments.push(serverAttachment);
      this.data.attachments.set(key, attachments);
      await this.saveToStore('attachments', serverAttachment);
      this.emit('attachment-added-from-server', serverAttachment);
    }
  }

  private async updateLocalTicket(ticket: TicketData): Promise<void> {
    this.data.tickets.set(ticket.id, ticket);
    await this.saveToStore('tickets', ticket);
  }

  private async updateLocalComment(comment: CommentData): Promise<void> {
    if (!this.data.comments.has(comment.ticketId)) {
      this.data.comments.set(comment.ticketId, []);
    }

    const comments = this.data.comments.get(comment.ticketId)!;
    const existingIndex = comments.findIndex(c => c.id === comment.id);

    if (existingIndex === -1) {
      comments.push(comment);
    } else {
      comments[existingIndex] = comment;
    }

    await this.saveToStore('comments', comment);
  }

  // IndexedDB helper methods

  private async getAllFromStore(storeName: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getFromStore(storeName: string, key: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveToStore(storeName: string, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async removeFromStore(storeName: string, key: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveMetadata(key: string, value: unknown): Promise<void> {
    await this.saveToStore('metadata', { key, value });
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  // Getters
  get status(): SyncStatus {
    return { ...this.syncStatus };
  }

  get isOnline(): boolean {
    return this.syncStatus.isOnline;
  }

  get pendingActionsCount(): number {
    return this.syncStatus.pendingActions;
  }
}

// Conflict resolution strategy
class ConflictResolver {
  async resolve(localAction: OfflineAction, serverData: any): Promise<void> {
    // Implement conflict resolution logic based on action type
    switch (localAction.type) {
      case 'UPDATE_TICKET':
        await this.resolveTicketConflict(localAction.data as TicketData, serverData);
        break;
      case 'ADD_COMMENT':
        // Comments rarely conflict, but handle if needed
        break;
      default:
        logger.warn('No conflict resolution strategy for action type', localAction.type);
    }
  }

  async resolveTicketConflict(localTicket: TicketData, serverTicket: TicketData): Promise<TicketData> {
    // Simple last-write-wins strategy for now
    // In production, you might want more sophisticated conflict resolution

    const mergedTicket: TicketData = {
      ...serverTicket,
      ...localTicket,
      lastModified: Math.max(localTicket.lastModified, serverTicket.lastModified),
      conflictResolved: true,
    };

    // Notify user about conflict resolution
    toast('Conflito de dados resolvido automaticamente', {
      icon: '⚠️',
      duration: 4000,
    });

    return mergedTicket;
  }
}

// Export singleton
export const offlineManager = new OfflineManager();