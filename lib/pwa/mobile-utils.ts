import { logger } from '../monitoring/logger';

/**
 * Mobile Optimization Utilities
 * Touch gestures, camera integration, and mobile-specific features
 */

interface TouchGestureConfig {
  enableSwipe: boolean;
  enablePinch: boolean;
  enableLongPress: boolean;
  swipeThreshold: number;
  longPressDelay: number;
}

interface CameraConfig {
  facingMode: 'user' | 'environment';
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

interface BiometricAuthConfig {
  enabledMethods: ('fingerprint' | 'face' | 'voice')[];
  fallbackToPassword: boolean;
  timeout: number;
}

class MobileUtils {
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private longPressTimer: number | null = null;
  private isLongPressing = false;

  private config: TouchGestureConfig = {
    enableSwipe: true,
    enablePinch: true,
    enableLongPress: true,
    swipeThreshold: 50,
    longPressDelay: 500
  };

  // Device detection
  public isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  public isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  public isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  public hasTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Touch gesture handling
  public enableTouchGestures(element: HTMLElement, callbacks?: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onLongPress?: (event: TouchEvent) => void;
    onPinch?: (scale: number) => void;
  }): () => void {
    let initialDistance = 0;
    let currentScale = 1;

    const handleTouchStart = (e: TouchEvent) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
      this.isLongPressing = false;

      // Handle pinch gesture
      if (e.touches.length === 2 && this.config.enablePinch) {
        initialDistance = this.getDistance(e.touches[0], e.touches[1]);
      }

      // Setup long press detection
      if (this.config.enableLongPress && callbacks?.onLongPress) {
        this.longPressTimer = window.setTimeout(() => {
          this.isLongPressing = true;
          callbacks.onLongPress!(e);
        }, this.config.longPressDelay);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Cancel long press if finger moves
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && this.config.enablePinch && callbacks?.onPinch) {
        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;

        if (Math.abs(scale - currentScale) > 0.1) {
          currentScale = scale;
          callbacks.onPinch(scale);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      if (this.isLongPressing || e.touches.length > 0) {
        return;
      }

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - this.touchStartX;
      const deltaY = touchEndY - this.touchStartY;
      const deltaTime = Date.now() - this.touchStartTime;

      // Only consider it a swipe if it's fast enough
      if (deltaTime > 300) return;

      if (this.config.enableSwipe && callbacks) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (Math.abs(deltaX) > this.config.swipeThreshold) {
            if (deltaX > 0 && callbacks.onSwipeRight) {
              callbacks.onSwipeRight();
            } else if (deltaX < 0 && callbacks.onSwipeLeft) {
              callbacks.onSwipeLeft();
            }
          }
        } else {
          // Vertical swipe
          if (Math.abs(deltaY) > this.config.swipeThreshold) {
            if (deltaY > 0 && callbacks.onSwipeDown) {
              callbacks.onSwipeDown();
            } else if (deltaY < 0 && callbacks.onSwipeUp) {
              callbacks.onSwipeUp();
            }
          }
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
      }
    };
  }

  // Pull-to-refresh implementation
  public enablePullToRefresh(
    element: HTMLElement,
    onRefresh: () => Promise<void>,
    options?: {
      threshold?: number;
      maxDistance?: number;
      refreshIcon?: string;
    }
  ): () => void {
    const threshold = options?.threshold || 80;
    const maxDistance = options?.maxDistance || 120;
    let startY = 0;
    let currentY = 0;
    let isRefreshing = false;
    let isPulling = false;

    // Create refresh indicator
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-to-refresh-indicator';
    refreshIndicator.style.cssText = `
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: all 0.3s ease;
      z-index: 1000;
      pointer-events: none;
    `;
    refreshIndicator.innerHTML = `
      <div class="refresh-icon" style="animation: spin 1s linear infinite; opacity: 0;">↻</div>
      <span>Puxe para atualizar</span>
    `;

    element.style.position = 'relative';
    element.appendChild(refreshIndicator);

    const handleTouchStart = (e: TouchEvent) => {
      if (element.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && element.scrollTop === 0) {
        e.preventDefault();

        const distance = Math.min(diff * 0.5, maxDistance);
        element.style.transform = `translateY(${distance}px)`;

        const progress = Math.min(distance / threshold, 1);
        refreshIndicator.style.top = `${-60 + (distance * 0.5)}px`;
        refreshIndicator.style.opacity = progress.toString();

        const icon = refreshIndicator.querySelector('.refresh-icon') as HTMLElement;
        const text = refreshIndicator.querySelector('span') as HTMLElement;

        if (distance >= threshold) {
          text.textContent = 'Solte para atualizar';
          icon.style.opacity = '1';
        } else {
          text.textContent = 'Puxe para atualizar';
          icon.style.opacity = '0';
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling) return;

      const diff = currentY - startY;
      isPulling = false;

      if (diff >= threshold && !isRefreshing) {
        isRefreshing = true;
        const text = refreshIndicator.querySelector('span') as HTMLElement;
        text.textContent = 'Atualizando...';

        onRefresh().finally(() => {
          isRefreshing = false;
          element.style.transform = '';
          refreshIndicator.style.top = '-60px';
          refreshIndicator.style.opacity = '0';
        });
      } else {
        element.style.transform = '';
        refreshIndicator.style.top = '-60px';
        refreshIndicator.style.opacity = '0';
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      if (refreshIndicator.parentNode) {
        refreshIndicator.parentNode.removeChild(refreshIndicator);
      }
    };
  }

  // Camera integration
  public async openCamera(config?: Partial<CameraConfig>): Promise<string | null> {
    const defaultConfig: CameraConfig = {
      facingMode: 'environment',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      ...config
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: defaultConfig.facingMode,
          width: { ideal: defaultConfig.maxWidth },
          height: { ideal: defaultConfig.maxHeight }
        }
      });

      return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Create camera UI
        const cameraModal = this.createCameraModal(video, () => {
          // Capture photo
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // Stop the stream
          stream.getTracks().forEach(track => track.stop());

          // Convert to base64
          const dataURL = canvas.toDataURL('image/jpeg', defaultConfig.quality);

          // Close modal
          document.body.removeChild(cameraModal);

          resolve(dataURL);
        }, () => {
          // Cancel
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(cameraModal);
          resolve(null);
        });

        video.srcObject = stream;
        video.play();

        document.body.appendChild(cameraModal);
      });
    } catch (error) {
      logger.error('Camera access failed', error);
      return null;
    }
  }

  // File picker with camera option
  public createFilePickerWithCamera(): Promise<File | string | null> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'file-picker-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      modal.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 320px;
          width: 90%;
          text-align: center;
        ">
          <h3 style="margin-bottom: 20px; color: #333;">Adicionar Arquivo</h3>

          <button class="camera-btn" style="
            display: block;
            width: 100%;
            padding: 12px;
            margin-bottom: 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          ">
            📸 Tirar Foto
          </button>

          <button class="gallery-btn" style="
            display: block;
            width: 100%;
            padding: 12px;
            margin-bottom: 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          ">
            🖼️ Escolher da Galeria
          </button>

          <button class="file-btn" style="
            display: block;
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          ">
            📁 Escolher Arquivo
          </button>

          <button class="cancel-btn" style="
            padding: 8px 16px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">
            Cancelar
          </button>
        </div>
      `;

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      // Camera button
      modal.querySelector('.camera-btn')?.addEventListener('click', async () => {
        cleanup();
        const photo = await this.openCamera();
        resolve(photo);
      });

      // Gallery button
      modal.querySelector('.gallery-btn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          cleanup();
          resolve(file || null);
        };
        input.click();
      });

      // File button
      modal.querySelector('.file-btn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          cleanup();
          resolve(file || null);
        };
        input.click();
      });

      // Cancel button
      modal.querySelector('.cancel-btn')?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      document.body.appendChild(modal);
    });
  }

  // Biometric authentication
  public async authenticateWithBiometrics(config?: Partial<BiometricAuthConfig>): Promise<boolean> {
    const defaultConfig: BiometricAuthConfig = {
      enabledMethods: ['fingerprint', 'face'],
      fallbackToPassword: true,
      timeout: 30000,
      ...config
    };

    if (!('credentials' in navigator) || !window.PublicKeyCredential) {
      logger.warn('WebAuthn not supported');
      return false;
    }

    try {
      // Check if biometric authentication is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

      if (!available) {
        logger.warn('Biometric authentication not available');
        return false;
      }

      // Create authentication options
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [],
          userVerification: 'required',
          timeout: defaultConfig.timeout
        }
      });

      return credential !== null;
    } catch (error) {
      logger.error('Biometric authentication failed', error);
      return false;
    }
  }

  // Haptic feedback
  public vibrate(pattern: number | number[]): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Device orientation handling
  public enableOrientationLock(orientation: 'portrait' | 'landscape'): Promise<void> {
    if ('orientation' in screen && 'lock' in screen.orientation) {
      return screen.orientation.lock(orientation);
    }
    return Promise.reject('Orientation lock not supported');
  }

  // Private helper methods
  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private createCameraModal(
    video: HTMLVideoElement,
    onCapture: () => void,
    onCancel: () => void
  ): HTMLElement {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: black;
      display: flex;
      flex-direction: column;
      z-index: 10000;
    `;

    video.style.cssText = `
      flex: 1;
      width: 100%;
      object-fit: cover;
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.8);
    `;

    controls.innerHTML = `
      <button class="cancel-btn" style="
        padding: 12px 24px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
      ">Cancelar</button>

      <button class="capture-btn" style="
        width: 70px;
        height: 70px;
        background: white;
        border: 3px solid #3b82f6;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      ">📸</button>

      <button class="switch-btn" style="
        padding: 12px 24px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
      ">Virar</button>
    `;

    controls.querySelector('.capture-btn')?.addEventListener('click', onCapture);
    controls.querySelector('.cancel-btn')?.addEventListener('click', onCancel);

    modal.appendChild(video);
    modal.appendChild(controls);

    return modal;
  }
}

// Singleton instance
let mobileUtilsInstance: MobileUtils | null = null;

export function getMobileUtils(): MobileUtils {
  if (!mobileUtilsInstance) {
    mobileUtilsInstance = new MobileUtils();
  }
  return mobileUtilsInstance;
}

export default MobileUtils;