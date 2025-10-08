'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPWAInstallPrompt } from '@/lib/pwa/install-prompt';
import { getPWAUpdateManager } from '@/lib/pwa/update-manager';
import { getPWAOfflineSync } from '@/lib/pwa/offline-sync';
import { getOfflineOperations } from '@/lib/pwa/offline-operations';
import { getMobileUtils } from '@/lib/pwa/mobile-utils';
import { getPerformanceOptimizer } from '@/lib/pwa/performance-optimizer';
import { getPushNotificationManager } from '@/lib/pwa/push-notifications';
import { getBiometricAuthManager } from '@/lib/pwa/biometric-auth';
import PWAInstallBanner from './PWAInstallBanner';
import PWAUpdateBanner from './PWAUpdateBanner';
import PWAOfflineIndicator from './PWAOfflineIndicator';
import PWASyncIndicator from './PWASyncIndicator';

interface PWAContextType {
  // Connection status
  isOnline: boolean;

  // Installation
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<boolean>;
  installPrompt: any;

  // Updates
  updateAvailable: boolean;
  updateApp: () => Promise<boolean>;
  updateManager: any;

  // Offline functionality
  offlineSync: any;
  offlineOperations: any;
  pendingActions: number;
  isSyncing: boolean;

  // Mobile features
  mobileUtils: any;
  isMobile: boolean;
  hasTouch: boolean;

  // Performance
  performanceOptimizer: any;
  performanceMetrics: any;

  // Notifications
  pushNotifications: any;
  notificationPermission: NotificationPermission;
  requestNotifications: () => Promise<boolean>;

  // Biometric authentication
  biometricAuth: any;
  biometricSupported: boolean;
  biometricEnabled: boolean;

  // Utility methods
  createOfflineTicket: (ticketData: any) => Promise<string>;
  enablePullToRefresh: (element: HTMLElement, onRefresh: () => Promise<void>) => () => void;
  openCamera: () => Promise<string | null>;
}

const PWAContext = createContext<PWAContextType | null>(null);

export const usePWAContext = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWAContext must be used within PWAProvider');
  }
  return context;
};

interface PWAProviderProps {
  children: React.ReactNode;
}

export default function PWAProvider({ children }: PWAProviderProps) {
  // Core PWA state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pendingActions, setPendingActions] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);

  // Notifications state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Performance state
  const [performanceMetrics, setPerformanceMetrics] = useState({});

  // PWA managers (initialized once)
  const [managers] = useState(() => ({
    installPrompt: getPWAInstallPrompt(),
    updateManager: getPWAUpdateManager(),
    offlineSync: getPWAOfflineSync(),
    offlineOperations: getOfflineOperations(),
    mobileUtils: getMobileUtils(),
    performanceOptimizer: getPerformanceOptimizer(),
    pushNotifications: getPushNotificationManager(),
    biometricAuth: getBiometricAuthManager()
  }));

  // Utility methods
  const createOfflineTicket = useCallback(async (ticketData: any) => {
    return await managers.offlineOperations.createOfflineTicket(ticketData);
  }, [managers.offlineOperations]);

  const enablePullToRefresh = useCallback((element: HTMLElement, onRefresh: () => Promise<void>) => {
    return managers.mobileUtils.enablePullToRefresh(element, onRefresh);
  }, [managers.mobileUtils]);

  const openCamera = useCallback(async () => {
    return await managers.mobileUtils.openCamera();
  }, [managers.mobileUtils]);

  const installApp = useCallback(async () => {
    return await managers.installPrompt.showInstallPrompt();
  }, [managers.installPrompt]);

  const updateApp = useCallback(async () => {
    return await managers.updateManager.applyUpdate();
  }, [managers.updateManager]);

  const requestNotifications = useCallback(async () => {
    const granted = await managers.pushNotifications.requestPermission();
    if (granted) {
      setNotificationPermission('granted');
      // Subscribe to push notifications
      await managers.pushNotifications.subscribe(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');
    }
    return granted;
  }, [managers.pushNotifications]);

  useEffect(() => {
    // Initialize mobile detection
    setIsMobile(managers.mobileUtils.isMobile());
    setHasTouch(managers.mobileUtils.hasTouch());

    // Initialize notification permission
    managers.pushNotifications.getPermissionStatus().then(setNotificationPermission);

    // Initialize biometric status
    managers.biometricAuth.getBiometricInfo().then(info => {
      setBiometricSupported(info.isSupported);
      setBiometricEnabled(info.hasStoredCredentials);
    });

    // Check if app is installed
    const checkInstallStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkInstallStatus();

    // Set up event listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleInstallableEvent = (e: Event) => {
      e.preventDefault();
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
    };

    // Network status listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallableEvent);
    window.addEventListener('appinstalled', handleAppInstalled);

    // PWA event listeners
    managers.installPrompt.addEventListener('installable', () => setIsInstallable(true));
    managers.installPrompt.addEventListener('installed', () => {
      setIsInstalled(true);
      setIsInstallable(false);
    });

    managers.updateManager.addEventListener('updateAvailable', () => setUpdateAvailable(true));
    managers.updateManager.addEventListener('updateApplied', () => setUpdateAvailable(false));

    managers.offlineSync.addEventListener('actionQueued', () => {
      const status = managers.offlineSync.getQueueStatus();
      setPendingActions(status.total);
    });

    managers.offlineSync.addEventListener('syncStarted', () => setIsSyncing(true));
    managers.offlineSync.addEventListener('syncCompleted', () => {
      setIsSyncing(false);
      const status = managers.offlineSync.getQueueStatus();
      setPendingActions(status.total);
    });

    // Performance metrics listener
    window.addEventListener('performanceMetrics', (event: any) => {
      setPerformanceMetrics(event.detail);
    });

    // Enable lazy loading
    managers.performanceOptimizer.enableLazyLoading();

    // Preload critical resources
    managers.performanceOptimizer.preloadResources({
      fonts: [
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
      ]
    });

    // Cleanup listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallableEvent);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [managers]);

  const contextValue: PWAContextType = {
    // Connection status
    isOnline,

    // Installation
    isInstallable,
    isInstalled,
    installApp,
    installPrompt: managers.installPrompt,

    // Updates
    updateAvailable,
    updateApp,
    updateManager: managers.updateManager,

    // Offline functionality
    offlineSync: managers.offlineSync,
    offlineOperations: managers.offlineOperations,
    pendingActions,
    isSyncing,

    // Mobile features
    mobileUtils: managers.mobileUtils,
    isMobile,
    hasTouch,

    // Performance
    performanceOptimizer: managers.performanceOptimizer,
    performanceMetrics,

    // Notifications
    pushNotifications: managers.pushNotifications,
    notificationPermission,
    requestNotifications,

    // Biometric authentication
    biometricAuth: managers.biometricAuth,
    biometricSupported,
    biometricEnabled,

    // Utility methods
    createOfflineTicket,
    enablePullToRefresh,
    openCamera
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {/* PWA UI Components */}
      <PWAInstallBanner />
      <PWAUpdateBanner />
      <PWAOfflineIndicator />
      <PWASyncIndicator />
    </PWAContext.Provider>
  );
}