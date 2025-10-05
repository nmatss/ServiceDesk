'use client';

// ServiceDesk PWA - Service Worker Registration and Management
import { toast } from 'react-hot-toast';

interface PWAInstallPrompt extends Event {
  platforms: string[];
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface SwRegistrationState {
  registration: ServiceWorkerRegistration | null;
  isOnline: boolean;
  isInstallable: boolean;
  installPrompt: PWAInstallPrompt | null;
  updateAvailable: boolean;
}

class PWAManager {
  private state: SwRegistrationState = {
    registration: null,
    isOnline: navigator.onLine,
    isInstallable: false,
    installPrompt: null,
    updateAvailable: false,
  };

  private listeners: Map<string, Set<Function>> = new Map();
  private offlineQueue: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: number;
  }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializePWA();
    }
  }

  private async initializePWA() {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return;
    }

    // Register service worker
    await this.registerServiceWorker();

    // Setup online/offline detection
    this.setupNetworkDetection();

    // Setup install prompt handling
    this.setupInstallPrompt();

    // Setup push notifications
    this.setupPushNotifications();

    // Setup background sync
    this.setupBackgroundSync();

    // Setup periodic sync (if supported)
    this.setupPeriodicSync();

    // Listen for app updates
    this.setupUpdateDetection();
  }

  private async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      this.state.registration = registration;
      console.log('Service Worker registered successfully:', registration);

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

      // Check for updates immediately
      registration.update();

      // Setup automatic update checks
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      this.emit('sw-registered', registration);

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.emit('sw-error', error);
      throw error;
    }
  }

  private setupNetworkDetection() {
    const updateOnlineStatus = () => {
      const wasOnline = this.state.isOnline;
      this.state.isOnline = navigator.onLine;

      if (!wasOnline && this.state.isOnline) {
        // Just came back online
        this.handleOnlineStatusChange(true);
      } else if (wasOnline && !this.state.isOnline) {
        // Just went offline
        this.handleOnlineStatusChange(false);
      }

      this.emit('network-status-change', this.state.isOnline);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.state.installPrompt = e as PWAInstallPrompt;
      this.state.isInstallable = true;

      console.log('PWA install prompt available');
      this.emit('install-available', true);

      // Show install banner after a delay
      setTimeout(() => {
        this.showInstallBanner();
      }, 30000); // Show after 30 seconds
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.state.isInstallable = false;
      this.state.installPrompt = null;
      this.emit('app-installed', true);

      toast.success('ServiceDesk instalado com sucesso!', {
        icon: '📱',
        duration: 4000,
      });
    });
  }

  private async setupPushNotifications() {
    if (!('Notification' in window) || !this.state.registration) {
      console.warn('Push notifications not supported');
      return;
    }

    // Request permission if not already granted
    if (Notification.permission === 'default') {
      await this.requestNotificationPermission();
    }

    if (Notification.permission === 'granted') {
      await this.subscribeToPushNotifications();
    }
  }

  private setupBackgroundSync() {
    if (!this.state.registration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Background Sync not supported');
      return;
    }

    // Register background sync events
    this.on('offline-action', (action) => {
      this.queueOfflineAction(action);
    });
  }

  private setupPeriodicSync() {
    if (!this.state.registration || !('periodicSync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Periodic Background Sync not supported');
      return;
    }

    // Register periodic sync for notifications
    this.state.registration.periodicSync?.register('notification-sync', {
      minInterval: 24 * 60 * 60 * 1000, // 24 hours
    }).catch((error) => {
      console.warn('Periodic sync registration failed:', error);
    });
  }

  private setupUpdateDetection() {
    if (!this.state.registration) return;

    this.state.registration.addEventListener('updatefound', () => {
      const newWorker = this.state.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New update available
          this.state.updateAvailable = true;
          this.emit('update-available', true);
          this.showUpdateBanner();
        }
      });
    });
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { data } = event;

    switch (data.type) {
      case 'CACHE_UPDATE':
        this.emit('cache-update', data);
        break;

      case 'SYNC_SUCCESS':
        this.handleSyncSuccess(data.action);
        break;

      case 'NOTIFICATIONS_UPDATE':
        this.emit('notifications-update', data.notifications);
        break;

      default:
        console.log('Unknown service worker message:', data);
    }
  }

  private handleOnlineStatusChange(isOnline: boolean) {
    if (isOnline) {
      toast.success('Conexão restaurada!', {
        icon: '🌐',
        duration: 3000,
      });

      // Trigger background sync for queued actions
      if (this.offlineQueue.length > 0) {
        this.triggerBackgroundSync();
      }
    } else {
      toast.error('Você está offline', {
        icon: '📴',
        duration: 3000,
      });
    }
  }

  private handleSyncSuccess(action: any) {
    // Remove from local queue
    this.offlineQueue = this.offlineQueue.filter(
      (item) => item.timestamp !== action.timestamp
    );

    toast.success('Ação sincronizada com sucesso!', {
      icon: '✅',
      duration: 2000,
    });

    this.emit('sync-success', action);
  }

  // Public API methods

  async installApp(): Promise<boolean> {
    if (!this.state.installPrompt) {
      console.warn('No install prompt available');
      return false;
    }

    try {
      await this.state.installPrompt.prompt();
      const { outcome } = await this.state.installPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  async updateApp(): Promise<void> {
    if (!this.state.registration) {
      throw new Error('No service worker registration');
    }

    const waitingWorker = this.state.registration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    this.emit('notification-permission-change', permission);
    return permission;
  }

  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    if (!this.state.registration || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const subscription = await this.state.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      console.log('Push subscription created:', subscription);

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      this.emit('push-subscription-created', subscription);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  async queueOfflineAction(action: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<void> {
    const queuedAction = {
      ...action,
      timestamp: Date.now(),
    };

    this.offlineQueue.push(queuedAction);

    // Send to service worker for persistence
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'QUEUE_OFFLINE_ACTION',
        action: queuedAction,
      });
    }

    toast.info('Ação salva para sincronizar quando online', {
      icon: '💾',
      duration: 3000,
    });
  }

  async triggerBackgroundSync(): Promise<void> {
    if (!this.state.registration) return;

    try {
      await this.state.registration.sync.register('ticket-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  async cacheAPIResponse(url: string, response: any): Promise<void> {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_API_RESPONSE',
        url,
        response,
      });
    }
  }

  // Utility methods

  private showInstallBanner() {
    if (!this.state.isInstallable) return;

    toast((t) => (
      <div className="flex items-center space-x-3">
        <span className="text-2xl">📱</span>
        <div>
          <p className="font-medium">Instalar ServiceDesk</p>
          <p className="text-sm text-gray-600">
            Adicione à tela inicial para acesso rápido
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              this.installApp();
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Instalar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 text-gray-500 text-sm rounded hover:bg-gray-100"
          >
            Agora não
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'bottom-center',
    });
  }

  private showUpdateBanner() {
    toast((t) => (
      <div className="flex items-center space-x-3">
        <span className="text-2xl">🔄</span>
        <div>
          <p className="font-medium">Atualização disponível</p>
          <p className="text-sm text-gray-600">
            Nova versão do ServiceDesk disponível
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              this.updateApp();
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            Atualizar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 text-gray-500 text-sm rounded hover:bg-gray-100"
          >
            Depois
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      position: 'bottom-center',
    });
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
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

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  // Getters
  get isOnline(): boolean {
    return this.state.isOnline;
  }

  get isInstallable(): boolean {
    return this.state.isInstallable;
  }

  get updateAvailable(): boolean {
    return this.state.updateAvailable;
  }

  get registration(): ServiceWorkerRegistration | null {
    return this.state.registration;
  }
}

// Export singleton instance
export const pwaManager = new PWAManager();

// React hook for PWA state
export function usePWA() {
  const [state, setState] = React.useState({
    isOnline: pwaManager.isOnline,
    isInstallable: pwaManager.isInstallable,
    updateAvailable: pwaManager.updateAvailable,
  });

  React.useEffect(() => {
    const updateState = () => {
      setState({
        isOnline: pwaManager.isOnline,
        isInstallable: pwaManager.isInstallable,
        updateAvailable: pwaManager.updateAvailable,
      });
    };

    pwaManager.on('network-status-change', updateState);
    pwaManager.on('install-available', updateState);
    pwaManager.on('update-available', updateState);
    pwaManager.on('app-installed', updateState);

    return () => {
      pwaManager.off('network-status-change', updateState);
      pwaManager.off('install-available', updateState);
      pwaManager.off('update-available', updateState);
      pwaManager.off('app-installed', updateState);
    };
  }, []);

  return {
    ...state,
    installApp: () => pwaManager.installApp(),
    updateApp: () => pwaManager.updateApp(),
    requestNotifications: () => pwaManager.requestNotificationPermission(),
  };
}

// Import React for the hook
import React from 'react';