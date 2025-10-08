/**
 * Offline Operations Manager
 * Handles offline ticket creation, editing, and synchronization
 */

import { getPWAOfflineSync } from './offline-sync';
import { logger } from '../monitoring/logger';

interface OfflineTicket {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  attachments?: File[];
  createdAt: number;
  status: 'draft' | 'pending_sync' | 'synced' | 'error';
  userId?: string;
  metadata?: {
    userAgent: string;
    location?: GeolocationPosition;
    screenshot?: string;
  };
}

interface OfflineComment {
  id: string;
  ticketId: string;
  content: string;
  createdAt: number;
  status: 'draft' | 'pending_sync' | 'synced' | 'error';
  userId?: string;
  attachments?: File[];
}

interface OfflineAttachment {
  id: string;
  file: File;
  ticketId?: string;
  commentId?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
}

class OfflineOperations {
  private dbName = 'ServiceDeskOfflineOperations';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private offlineSync = getPWAOfflineSync();

  constructor() {
    this.initDatabase();
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

        // Create object stores
        if (!db.objectStoreNames.contains('tickets')) {
          const ticketStore = db.createObjectStore('tickets', { keyPath: 'id' });
          ticketStore.createIndex('status', 'status');
          ticketStore.createIndex('createdAt', 'createdAt');
          ticketStore.createIndex('userId', 'userId');
        }

        if (!db.objectStoreNames.contains('comments')) {
          const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentStore.createIndex('ticketId', 'ticketId');
          commentStore.createIndex('status', 'status');
          commentStore.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentStore.createIndex('ticketId', 'ticketId');
          attachmentStore.createIndex('commentId', 'commentId');
          attachmentStore.createIndex('uploadStatus', 'uploadStatus');
        }

        if (!db.objectStoreNames.contains('drafts')) {
          const draftStore = db.createObjectStore('drafts', { keyPath: 'id' });
          draftStore.createIndex('type', 'type');
          draftStore.createIndex('updatedAt', 'updatedAt');
        }
      };
    });
  }

  // Ticket operations
  public async createOfflineTicket(ticketData: Omit<OfflineTicket, 'id' | 'createdAt' | 'status'>): Promise<string> {
    await this.ensureDatabase();

    const ticket: OfflineTicket = {
      ...ticketData,
      id: this.generateId(),
      createdAt: Date.now(),
      status: 'draft',
      metadata: {
        userAgent: navigator.userAgent,
        ...(ticketData.metadata || {})
      }
    };

    // Save to IndexedDB
    await this.saveTicket(ticket);

    // Queue for background sync
    await this.queueTicketSync(ticket);

    this.dispatchEvent('offlineTicketCreated', { ticket });

    return ticket.id;
  }

  public async saveTicketDraft(ticketData: Partial<OfflineTicket> & { id: string }): Promise<void> {
    await this.ensureDatabase();

    const draft = {
      ...ticketData,
      type: 'ticket',
      updatedAt: Date.now()
    };

    const transaction = this.db!.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');
    await store.put(draft);

    this.dispatchEvent('draftSaved', { draft });
  }

  public async getOfflineTickets(status?: OfflineTicket['status']): Promise<OfflineTicket[]> {
    await this.ensureDatabase();

    const transaction = this.db!.transaction(['tickets'], 'readonly');
    const store = transaction.objectStore('tickets');

    if (status) {
      const index = store.index('status');
      const request = index.getAll(status);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Comment operations
  public async addOfflineComment(commentData: Omit<OfflineComment, 'id' | 'createdAt' | 'status'>): Promise<string> {
    await this.ensureDatabase();

    const comment: OfflineComment = {
      ...commentData,
      id: this.generateId(),
      createdAt: Date.now(),
      status: 'draft'
    };

    // Save to IndexedDB
    await this.saveComment(comment);

    // Queue for background sync
    await this.queueCommentSync(comment);

    this.dispatchEvent('offlineCommentCreated', { comment });

    return comment.id;
  }

  // Attachment operations
  public async addOfflineAttachment(file: File, ticketId?: string, commentId?: string): Promise<string> {
    await this.ensureDatabase();

    const attachment: OfflineAttachment = {
      id: this.generateId(),
      file,
      ticketId,
      commentId,
      uploadStatus: 'pending'
    };

    // Save to IndexedDB
    await this.saveAttachment(attachment);

    // Queue for upload when online
    await this.queueAttachmentUpload(attachment);

    this.dispatchEvent('offlineAttachmentAdded', { attachment });

    return attachment.id;
  }

  // Synchronization operations
  public async syncPendingTickets(): Promise<void> {
    const pendingTickets = await this.getOfflineTickets('pending_sync');

    for (const ticket of pendingTickets) {
      try {
        await this.syncTicket(ticket);
      } catch (error) {
        logger.error(`Failed to sync ticket ${ticket.id}:`, error);
        ticket.status = 'error';
        await this.saveTicket(ticket);
      }
    }
  }

  public async syncPendingComments(): Promise<void> {
    const pendingComments = await this.getOfflineComments('pending_sync');

    for (const comment of pendingComments) {
      try {
        await this.syncComment(comment);
      } catch (error) {
        logger.error(`Failed to sync comment ${comment.id}:`, error);
        comment.status = 'error';
        await this.saveComment(comment);
      }
    }
  }

  // Auto-save for drafts
  public setupAutoSave(formElement: HTMLFormElement, type: 'ticket' | 'comment', id?: string): () => void {
    const draftId = id || this.generateId();
    let saveTimeout: number;

    const handleInput = () => {
      clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(async () => {
        const formData = new FormData(formElement);
        const draft = {
          id: draftId,
          type,
          data: Object.fromEntries(formData.entries()),
          updatedAt: Date.now()
        };

        const transaction = this.db!.transaction(['drafts'], 'readwrite');
        const store = transaction.objectStore('drafts');
        await store.put(draft);

        this.dispatchEvent('draftAutoSaved', { draft });
      }, 1000); // Save after 1 second of inactivity
    };

    formElement.addEventListener('input', handleInput);
    formElement.addEventListener('change', handleInput);

    // Return cleanup function
    return () => {
      clearTimeout(saveTimeout);
      formElement.removeEventListener('input', handleInput);
      formElement.removeEventListener('change', handleInput);
    };
  }

  // Location capture for better context
  public async captureLocation(): Promise<GeolocationPosition | null> {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  // Screenshot capture for visual context
  public async captureScreenshot(): Promise<string | null> {
    if (!('html2canvas' in window)) {
      // html2canvas not available, try native screen capture API
      if ('getDisplayMedia' in navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { mediaSource: 'screen' }
          });

          const video = document.createElement('video');
          video.srcObject = stream;
          await video.play();

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          ctx!.drawImage(video, 0, 0);

          stream.getTracks().forEach(track => track.stop());

          return canvas.toDataURL('image/png');
        } catch (error) {
          logger.warn('Screen capture failed', error);
          return null;
        }
      }
      return null;
    }

    try {
      // Use html2canvas if available
      const canvas = await (window as any).html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.warn('Screenshot capture failed', error);
      return null;
    }
  }

  // Private helper methods
  private async ensureDatabase(): Promise<void> {
    if (!this.db) {
      await this.initDatabase();
    }
  }

  private async saveTicket(ticket: OfflineTicket): Promise<void> {
    const transaction = this.db!.transaction(['tickets'], 'readwrite');
    const store = transaction.objectStore('tickets');
    await store.put(ticket);
  }

  private async saveComment(comment: OfflineComment): Promise<void> {
    const transaction = this.db!.transaction(['comments'], 'readwrite');
    const store = transaction.objectStore('comments');
    await store.put(comment);
  }

  private async saveAttachment(attachment: OfflineAttachment): Promise<void> {
    const transaction = this.db!.transaction(['attachments'], 'readwrite');
    const store = transaction.objectStore('attachments');
    await store.put(attachment);
  }

  private async getOfflineComments(status?: OfflineComment['status']): Promise<OfflineComment[]> {
    const transaction = this.db!.transaction(['comments'], 'readonly');
    const store = transaction.objectStore('comments');

    if (status) {
      const index = store.index('status');
      const request = index.getAll(status);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  private async queueTicketSync(ticket: OfflineTicket): Promise<void> {
    ticket.status = 'pending_sync';
    await this.saveTicket(ticket);

    await this.offlineSync.queueAction({
      type: 'CREATE',
      entity: 'ticket',
      data: {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        metadata: ticket.metadata
      },
      url: '/api/tickets/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      priority: 'high',
      maxRetries: 5
    });
  }

  private async queueCommentSync(comment: OfflineComment): Promise<void> {
    comment.status = 'pending_sync';
    await this.saveComment(comment);

    await this.offlineSync.queueAction({
      type: 'CREATE',
      entity: 'comment',
      data: {
        ticketId: comment.ticketId,
        content: comment.content
      },
      url: `/api/tickets/${comment.ticketId}/comments`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      priority: 'medium',
      maxRetries: 3
    });
  }

  private async queueAttachmentUpload(attachment: OfflineAttachment): Promise<void> {
    const formData = new FormData();
    formData.append('file', attachment.file);
    if (attachment.ticketId) formData.append('ticketId', attachment.ticketId);
    if (attachment.commentId) formData.append('commentId', attachment.commentId);

    await this.offlineSync.queueAction({
      type: 'CREATE',
      entity: 'attachment',
      data: formData,
      url: '/api/attachments',
      method: 'POST',
      headers: {},
      priority: 'low',
      maxRetries: 3
    });
  }

  private async syncTicket(ticket: OfflineTicket): Promise<void> {
    const response = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        metadata: ticket.metadata
      })
    });

    if (response.ok) {
      ticket.status = 'synced';
      await this.saveTicket(ticket);
      this.dispatchEvent('ticketSynced', { ticket });
    } else {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
  }

  private async syncComment(comment: OfflineComment): Promise<void> {
    const response = await fetch(`/api/tickets/${comment.ticketId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: comment.content
      })
    });

    if (response.ok) {
      comment.status = 'synced';
      await this.saveComment(comment);
      this.dispatchEvent('commentSynced', { comment });
    } else {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private dispatchEvent(type: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(`offline:${type}`, { detail }));
  }

  public addEventListener(type: string, listener: EventListener): void {
    window.addEventListener(`offline:${type}`, listener);
  }

  public removeEventListener(type: string, listener: EventListener): void {
    window.removeEventListener(`offline:${type}`, listener);
  }
}

// Singleton instance
let offlineOperationsInstance: OfflineOperations | null = null;

export function getOfflineOperations(): OfflineOperations {
  if (!offlineOperationsInstance) {
    offlineOperationsInstance = new OfflineOperations();
  }
  return offlineOperationsInstance;
}

export default OfflineOperations;