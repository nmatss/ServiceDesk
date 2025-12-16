import logger from '../monitoring/structured-logger';

/**
 * PWA Update Manager
 * Handles service worker updates and user notifications
 */

interface UpdateManagerConfig {
  checkInterval: number;
  enableAutoUpdate: boolean;
  enableUpdateNotifications: boolean;
  updateCheckDelay: number;
}

interface UpdateInfo {
  isUpdateAvailable: boolean;
  currentVersion: string;
  newVersion: string;
  updateSize?: number;
  updateDescription?: string;
  isForced: boolean;
}

class PWAUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: UpdateManagerConfig;
  private updateInfo: UpdateInfo | null = null;
  private isUpdatePending = false;
  private checkIntervalId: number | null = null;

  constructor(config: Partial<UpdateManagerConfig> = {}) {
    this.config = {
      checkInterval: 30 * 60 * 1000, // 30 minutes
      enableAutoUpdate: false,
      enableUpdateNotifications: true,
      updateCheckDelay: 60 * 1000, // 1 minute
      ...config
    };

    this.init();
  }

  private async init() {
    if (!('serviceWorker' in navigator)) {
      logger.warn('[PWA Update] Service Worker not supported');
      return;
    }

    try {
      // Register service worker if not already registered
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      logger.info('[PWA Update] Service Worker registered');

      // Set up event listeners
      this.setupEventListeners();

      // Start periodic update checks
      this.startPeriodicChecks();

      // Check for updates after initial delay
      setTimeout(() => {
        this.checkForUpdates();
      }, this.config.updateCheckDelay);

    } catch (error) {
      logger.error('[PWA Update] Service Worker registration failed', error);
    }
  }

  private setupEventListeners() {
    if (!this.registration) return;

    // Listen for waiting service worker
    this.registration.addEventListener('updatefound', () => {
      logger.info('[PWA Update] New service worker found');

      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Update available
            this.handleUpdateAvailable();
          } else {
            // First time install
            logger.info('[PWA Update] Service worker installed for the first time');
          }
        }
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'UPDATE_AVAILABLE':
          this.handleUpdateAvailable(data);
          break;
        case 'UPDATE_INSTALLED':
          this.handleUpdateInstalled();
          break;
        case 'CACHE_UPDATE':
          this.handleCacheUpdate(data);
          break;
        default:
          logger.info('[PWA Update] Unknown message from SW', event.data);
      }
    });

    // Listen for service worker controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.info('[PWA Update] Service worker controller changed');
      this.handleControllerChange();
    });

    // Listen for page visibility change to check for updates
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.checkForUpdates();
    });
  }

  private startPeriodicChecks() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    this.checkIntervalId = window.setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  private stopPeriodicChecks() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  public async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      logger.warn('[PWA Update] No service worker registration');
      return false;
    }

    try {
      logger.info('[PWA Update] Checking for updates...');
      await this.registration.update();

      // Check if there's a waiting service worker
      if (this.registration.waiting) {
        this.handleUpdateAvailable();
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[PWA Update] Update check failed', error);
      return false;
    }
  }

  private handleUpdateAvailable(data?: { version?: string; size?: number; description?: string; forced?: boolean }) {
    logger.info('[PWA Update] Update available');

    this.updateInfo = {
      isUpdateAvailable: true,
      currentVersion: this.getCurrentVersion(),
      newVersion: data?.version || 'unknown',
      updateSize: data?.size,
      updateDescription: data?.description,
      isForced: data?.forced || false
    };

    this.isUpdatePending = true;

    if (this.config.enableUpdateNotifications) {
      this.dispatchEvent('updateAvailable', this.updateInfo);
    }

    if (this.config.enableAutoUpdate || this.updateInfo.isForced) {
      this.applyUpdate();
    }
  }

  private handleUpdateInstalled() {
    logger.info('[PWA Update] Update installed');
    this.dispatchEvent('updateInstalled', {});
  }

  private handleCacheUpdate(data: unknown) {
    this.dispatchEvent('cacheUpdate', data);
  }

  private handleControllerChange() {
    logger.info('[PWA Update] New service worker is controlling the page');
    this.isUpdatePending = false;
    this.updateInfo = null;
    this.dispatchEvent('updateApplied', {});

    // Optionally reload the page
    if (this.shouldReloadOnUpdate()) {
      window.location.reload();
    }
  }

  public async applyUpdate(): Promise<boolean> {
    if (!this.registration || !this.registration.waiting) {
      logger.warn('[PWA Update] No waiting service worker');
      return false;
    }

    try {
      logger.info('[PWA Update] Applying update...');

      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      this.dispatchEvent('updateApplying', {});
      return true;
    } catch (error) {
      logger.error('[PWA Update] Failed to apply update', error);
      return false;
    }
  }

  public dismissUpdate() {
    this.isUpdatePending = false;
    this.updateInfo = null;
    this.dispatchEvent('updateDismissed', {});
  }

  public getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  public isUpdatePendingStatus(): boolean {
    return this.isUpdatePending;
  }

  private getCurrentVersion(): string {
    // Try to get version from various sources
    const metaVersion = document.querySelector('meta[name="version"]');
    if (metaVersion) {
      return metaVersion.getAttribute('content') || '1.0.0';
    }

    // Try to get from build info
    const buildInfo = (window as any).__BUILD_INFO__;
    if (buildInfo?.version) {
      return buildInfo.version;
    }

    // Default version
    return '1.0.0';
  }

  private shouldReloadOnUpdate(): boolean {
    // Check if critical updates require reload
    return this.updateInfo?.isForced || false;
  }

  public async getRegistrationInfo() {
    if (!this.registration) return null;

    return {
      scope: this.registration.scope,
      updateViaCache: this.registration.updateViaCache,
      active: {
        scriptURL: this.registration.active?.scriptURL,
        state: this.registration.active?.state
      },
      waiting: {
        scriptURL: this.registration.waiting?.scriptURL,
        state: this.registration.waiting?.state
      },
      installing: {
        scriptURL: this.registration.installing?.scriptURL,
        state: this.registration.installing?.state
      }
    };
  }

  public async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      this.stopPeriodicChecks();
      const unregistered = await this.registration.unregister();
      logger.info('[PWA Update] Service worker unregistered', unregistered);
      return unregistered;
    } catch (error) {
      logger.error('[PWA Update] Failed to unregister service worker', error);
      return false;
    }
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
    this.stopPeriodicChecks();
    this.registration = null;
    this.updateInfo = null;
    this.isUpdatePending = false;
  }
}

// Singleton instance
let updateManagerInstance: PWAUpdateManager | null = null;

export function getPWAUpdateManager(config?: Partial<UpdateManagerConfig>): PWAUpdateManager {
  if (!updateManagerInstance) {
    updateManagerInstance = new PWAUpdateManager(config);
  }
  return updateManagerInstance;
}

export default PWAUpdateManager;