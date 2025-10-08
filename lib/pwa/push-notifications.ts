import { logger } from '../monitoring/logger';

/**
 * Push Notifications Manager
 * Handles push notification subscriptions, sending, and management
 */

interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: NotificationAction[];
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string = '';

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      logger.warn('Push notifications not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      await this.checkExistingSubscription();
    } catch (error) {
      logger.error('Push notification initialization failed', error);
    }
  }

  // Check permission status
  public async getPermissionStatus(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    return Notification.permission;
  }

  // Request notification permission
  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('Notifications not supported');
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      logger.info('Notification permission granted');
      return true;
    } else {
      logger.info('Notification permission denied');
      return false;
    }
  }

  // Subscribe to push notifications
  public async subscribe(vapidPublicKey: string): Promise<PushSubscriptionData | null> {
    if (!this.registration) {
      logger.error('Service worker not ready');
      return null;
    }

    this.vapidPublicKey = vapidPublicKey;

    try {
      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();

      if (existingSubscription) {
        this.subscription = existingSubscription;
        return this.formatSubscriptionData(existingSubscription);
      }

      // Create new subscription
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      this.subscription = subscription;

      // Send subscription to server
      const subscriptionData = this.formatSubscriptionData(subscription);
      await this.sendSubscriptionToServer(subscriptionData);

      logger.info('Push subscription successful');
      return subscriptionData;

    } catch (error) {
      logger.error('Push subscription failed', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  public async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();

      if (success) {
        // Notify server about unsubscription
        await this.notifyServerUnsubscription();
        this.subscription = null;
        logger.info('Push unsubscription successful');
      }

      return success;
    } catch (error) {
      logger.error('Push unsubscription failed', error);
      return false;
    }
  }

  // Show local notification
  public async showNotification(config: NotificationConfig): Promise<void> {
    if (!this.registration) {
      // Fallback to browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(config.title, {
          body: config.body,
          icon: config.icon,
          tag: config.tag,
          data: config.data,
          requireInteraction: config.requireInteraction,
          silent: config.silent,
          vibrate: config.vibrate
        });
      }
      return;
    }

    try {
      await this.registration.showNotification(config.title, {
        body: config.body,
        icon: config.icon || '/icon-192.png',
        badge: config.badge || '/icon-96.png',
        image: config.image,
        tag: config.tag,
        data: config.data,
        requireInteraction: config.requireInteraction || false,
        silent: config.silent || false,
        vibrate: config.vibrate || [200, 100, 200],
        actions: config.actions || [
          {
            action: 'view',
            title: 'Ver',
            icon: '/icons/action-view.png'
          },
          {
            action: 'dismiss',
            title: 'Dispensar',
            icon: '/icons/action-dismiss.png'
          }
        ]
      });
    } catch (error) {
      logger.error('Failed to show notification', error);
    }
  }

  // Schedule notification
  public scheduleNotification(config: NotificationConfig, delay: number): number {
    return window.setTimeout(() => {
      this.showNotification(config);
    }, delay);
  }

  // Cancel scheduled notification
  public cancelScheduledNotification(notificationId: number): void {
    clearTimeout(notificationId);
  }

  // Get active notifications
  public async getActiveNotifications(): Promise<Notification[]> {
    if (!this.registration) {
      return [];
    }

    try {
      return await this.registration.getNotifications();
    } catch (error) {
      logger.error('Failed to get active notifications', error);
      return [];
    }
  }

  // Clear all notifications
  public async clearAllNotifications(): Promise<void> {
    const notifications = await this.getActiveNotifications();

    notifications.forEach(notification => {
      notification.close();
    });
  }

  // Send notification categories-based notification
  public async sendTicketNotification(ticket: {
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: string;
  }): Promise<void> {
    const priorityEmojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const config: NotificationConfig = {
      title: `${priorityEmojis[ticket.priority]} Ticket #${ticket.id}`,
      body: ticket.title,
      icon: '/icon-192.png',
      tag: `ticket-${ticket.id}`,
      data: {
        type: 'ticket',
        ticketId: ticket.id,
        url: `/tickets/${ticket.id}`
      },
      requireInteraction: ticket.priority === 'critical',
      actions: [
        {
          action: 'view-ticket',
          title: 'Ver Ticket',
          icon: '/icons/ticket.png'
        },
        {
          action: 'mark-read',
          title: 'Marcar como Lido',
          icon: '/icons/check.png'
        }
      ]
    };

    await this.showNotification(config);
  }

  // Send comment notification
  public async sendCommentNotification(comment: {
    ticketId: string;
    author: string;
    content: string;
  }): Promise<void> {
    const config: NotificationConfig = {
      title: `💬 Novo comentário de ${comment.author}`,
      body: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
      icon: '/icon-192.png',
      tag: `comment-${comment.ticketId}`,
      data: {
        type: 'comment',
        ticketId: comment.ticketId,
        url: `/tickets/${comment.ticketId}#comments`
      },
      actions: [
        {
          action: 'reply',
          title: 'Responder',
          icon: '/icons/reply.png'
        },
        {
          action: 'view-ticket',
          title: 'Ver Ticket',
          icon: '/icons/ticket.png'
        }
      ]
    };

    await this.showNotification(config);
  }

  // Send system notification
  public async sendSystemNotification(message: {
    title: string;
    body: string;
    type: 'info' | 'warning' | 'error' | 'success';
    urgent?: boolean;
  }): Promise<void> {
    const typeEmojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    const config: NotificationConfig = {
      title: `${typeEmojis[message.type]} ${message.title}`,
      body: message.body,
      icon: '/icon-192.png',
      tag: `system-${message.type}`,
      data: {
        type: 'system',
        messageType: message.type
      },
      requireInteraction: message.urgent || message.type === 'error',
      silent: message.type === 'info'
    };

    await this.showNotification(config);
  }

  // Notification analytics
  public async trackNotificationInteraction(action: string, notificationData?: any): Promise<void> {
    try {
      await fetch('/api/analytics/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          data: notificationData,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        })
      });
    } catch (error) {
      logger.error('Failed to track notification interaction', error);
    }
  }

  // Notification frequency management
  public setNotificationFrequency(frequency: 'instant' | 'hourly' | 'daily' | 'disabled'): void {
    localStorage.setItem('notification-frequency', frequency);
  }

  public getNotificationFrequency(): string {
    return localStorage.getItem('notification-frequency') || 'instant';
  }

  // Do Not Disturb mode
  public enableDoNotDisturb(until?: Date): void {
    const dndData = {
      enabled: true,
      until: until?.toISOString()
    };

    localStorage.setItem('notification-dnd', JSON.stringify(dndData));
  }

  public disableDoNotDisturb(): void {
    localStorage.removeItem('notification-dnd');
  }

  public isDoNotDisturbActive(): boolean {
    const dndData = localStorage.getItem('notification-dnd');

    if (!dndData) return false;

    try {
      const { enabled, until } = JSON.parse(dndData);

      if (!enabled) return false;

      if (until && new Date(until) < new Date()) {
        this.disableDoNotDisturb();
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods
  private async checkExistingSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();

      if (this.subscription) {
        logger.info('Existing push subscription found');
      }
    } catch (error) {
      logger.error('Failed to check existing subscription', error);
    }
  }

  private formatSubscriptionData(subscription: PushSubscription): PushSubscriptionData {
    const key = subscription.getKey('p256dh');
    const token = subscription.getKey('auth');

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: key ? this.arrayBufferToBase64(key) : '',
        auth: token ? this.arrayBufferToBase64(token) : ''
      },
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
  }

  private async sendSubscriptionToServer(subscriptionData: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      logger.error('Failed to send subscription to server', error);
    }
  }

  private async notifyServerUnsubscription(): Promise<void> {
    if (!this.subscription) return;

    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });
    } catch (error) {
      logger.error('Failed to notify server about unsubscription', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  }

  // Public getters
  public isSubscribed(): boolean {
    return this.subscription !== null;
  }

  public getSubscription(): PushSubscription | null {
    return this.subscription;
  }
}

// Singleton instance
let pushNotificationManagerInstance: PushNotificationManager | null = null;

export function getPushNotificationManager(): PushNotificationManager {
  if (!pushNotificationManagerInstance) {
    pushNotificationManagerInstance = new PushNotificationManager();
  }
  return pushNotificationManagerInstance;
}

export default PushNotificationManager;