import logger from '../monitoring/structured-logger';

/**
 * PWA Install Prompt Manager
 * Handles intelligent PWA installation prompts and user engagement
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallPromptConfig {
  delayAfterVisits: number;
  delayAfterDismissal: number;
  maxDismissals: number;
  enableAutoPrompt: boolean;
  enableSmartTiming: boolean;
}

class PWAInstallPrompt {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstallable = false;
  private config: PWAInstallPromptConfig;
  private storageKeys = {
    visitCount: 'pwa-visit-count',
    dismissCount: 'pwa-dismiss-count',
    lastDismissal: 'pwa-last-dismissal',
    lastPrompt: 'pwa-last-prompt',
    isInstalled: 'pwa-is-installed',
    userEngagement: 'pwa-user-engagement'
  };

  constructor(config: Partial<PWAInstallPromptConfig> = {}) {
    this.config = {
      delayAfterVisits: 3,
      delayAfterDismissal: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxDismissals: 3,
      enableAutoPrompt: true,
      enableSmartTiming: true,
      ...config
    };

    this.init();
  }

  private init() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.isInstallable = true;
      this.onInstallable();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.onInstalled();
    });

    // Track page visibility for smart timing
    if (this.config.enableSmartTiming) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.trackUserEngagement();
        }
      });
    }

    // Check if already installed
    if (this.isAlreadyInstalled()) {
      this.markAsInstalled();
      return;
    }

    // Track visit
    this.trackVisit();

    // Auto-prompt if conditions are met
    if (this.config.enableAutoPrompt) {
      this.checkAutoPrompt();
    }
  }

  private onInstallable() {
    logger.info('[PWA] App is installable');
    this.dispatchEvent('installable', { canInstall: true });
  }

  private onInstalled() {
    logger.info('[PWA] App was installed');
    this.markAsInstalled();
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.dispatchEvent('installed', {});
  }

  private trackVisit() {
    const visitCount = this.getStorageItem(this.storageKeys.visitCount, 0) + 1;
    this.setStorageItem(this.storageKeys.visitCount, visitCount);
  }

  private trackUserEngagement() {
    const engagement = this.getStorageItem(this.storageKeys.userEngagement, {
      sessions: 0,
      totalTime: 0,
      lastSession: Date.now()
    });

    engagement.sessions += 1;
    engagement.lastSession = Date.now();
    this.setStorageItem(this.storageKeys.userEngagement, engagement);
  }

  private checkAutoPrompt() {
    if (!this.shouldShowPrompt()) {
      return;
    }

    // Smart timing - wait for user engagement
    if (this.config.enableSmartTiming) {
      setTimeout(() => {
        if (this.isUserEngaged() && this.isInstallable) {
          this.showInstallPrompt();
        }
      }, 10000); // Wait 10 seconds
    } else {
      setTimeout(() => {
        if (this.isInstallable) {
          this.showInstallPrompt();
        }
      }, 5000); // Wait 5 seconds
    }
  }

  private shouldShowPrompt(): boolean {
    const visitCount = this.getStorageItem(this.storageKeys.visitCount, 0);
    const dismissCount = this.getStorageItem(this.storageKeys.dismissCount, 0);
    const lastDismissal = this.getStorageItem(this.storageKeys.lastDismissal, 0);
    const lastPrompt = this.getStorageItem(this.storageKeys.lastPrompt, 0);

    // Check if already installed
    if (this.isAlreadyInstalled()) {
      return false;
    }

    // Check visit count threshold
    if (visitCount < this.config.delayAfterVisits) {
      return false;
    }

    // Check dismissal limit
    if (dismissCount >= this.config.maxDismissals) {
      return false;
    }

    // Check time since last dismissal
    if (lastDismissal && (Date.now() - lastDismissal) < this.config.delayAfterDismissal) {
      return false;
    }

    // Check if already prompted recently (24 hours)
    if (lastPrompt && (Date.now() - lastPrompt) < 24 * 60 * 60 * 1000) {
      return false;
    }

    return true;
  }

  private isUserEngaged(): boolean {
    // Check if user has scrolled or interacted with the page
    const scrollPercentage = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    return scrollPercentage > 25 || document.hasFocus();
  }

  private isAlreadyInstalled(): boolean {
    // Check if running in standalone mode
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check if running in fullscreen mode
    if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }

    // Check Navigator.standalone for iOS
    if ('standalone' in window.navigator && (window.navigator as any).standalone) {
      return true;
    }

    return false;
  }

  private markAsInstalled() {
    this.setStorageItem(this.storageKeys.isInstalled, true);
    this.dispatchEvent('alreadyInstalled', {});
  }

  public async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      logger.warn('[PWA] No deferred prompt available');
      return false;
    }

    try {
      this.setStorageItem(this.storageKeys.lastPrompt, Date.now());

      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      logger.info(`[PWA] User ${outcome} the install prompt`);

      if (outcome === 'accepted') {
        this.dispatchEvent('installAccepted', {});
        return true;
      } else {
        this.trackDismissal();
        this.dispatchEvent('installDismissed', {});
        return false;
      }
    } catch (error) {
      logger.error('[PWA] Error showing install prompt', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }

  private trackDismissal() {
    const dismissCount = this.getStorageItem(this.storageKeys.dismissCount, 0) + 1;
    this.setStorageItem(this.storageKeys.dismissCount, dismissCount);
    this.setStorageItem(this.storageKeys.lastDismissal, Date.now());
  }

  public canInstall(): boolean {
    return this.isInstallable && !this.isAlreadyInstalled();
  }

  public isInstalled(): boolean {
    return this.isAlreadyInstalled();
  }

  public getInstallStats() {
    return {
      visitCount: this.getStorageItem(this.storageKeys.visitCount, 0),
      dismissCount: this.getStorageItem(this.storageKeys.dismissCount, 0),
      lastDismissal: this.getStorageItem(this.storageKeys.lastDismissal, null),
      lastPrompt: this.getStorageItem(this.storageKeys.lastPrompt, null),
      isInstalled: this.isAlreadyInstalled(),
      canInstall: this.canInstall(),
      userEngagement: this.getStorageItem(this.storageKeys.userEngagement, {})
    };
  }

  public resetStats() {
    Object.values(this.storageKeys).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private getStorageItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setStorageItem<T>(key: string, value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.warn('[PWA] Failed to save to localStorage', error);
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
}

// Singleton instance
let installPromptInstance: PWAInstallPrompt | null = null;

export function getPWAInstallPrompt(config?: Partial<PWAInstallPromptConfig>): PWAInstallPrompt {
  if (!installPromptInstance) {
    installPromptInstance = new PWAInstallPrompt(config);
  }
  return installPromptInstance;
}

export default PWAInstallPrompt;