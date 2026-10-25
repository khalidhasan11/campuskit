import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

// True only inside the Capacitor native shell (Android app). On the web /
// GitHub Pages build this is always false, so full PWA behaviour (service
// worker registration, install prompt) is preserved there. In the native
// app the web service worker must NOT register: the native bridge serves
// the bundled assets itself, and a web SW could cache/interfere with them.
const isNativeShell = (): boolean => Capacitor.isNativePlatform();

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  });

  useEffect(() => {
    // Native shell: there is no browser install prompt to manage.
    if (isNativeShell()) return;

    const media = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    media.addEventListener?.('change', handleDisplayChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      media.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    installApp,
  };
}

export function useServiceWorkerStatus() {
  const [swState, setSwState] = useState<'checking' | 'ready' | 'unsupported' | 'unavailable'>(
    'checking'
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Native shell: never register the web service worker (see note at the
    // top of this file). The Capacitor bridge serves bundled assets.
    if (isNativeShell()) {
      setSwState('unsupported');
      return;
    }

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setSwState('unsupported');
      return;
    }

    let cancelled = false;

    const registerSw = async () => {
      try {
        // Base-relative registration: import.meta.env.BASE_URL is './'
        // (vite.config.ts base), so this registers '<app-directory>/sw.js'
        // both at a domain root and under a subpath like /campuskit/.
        // No explicit scope is passed: the default scope is the directory
        // containing sw.js, which is exactly the app root in both cases.
        const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
        if (cancelled) return;
        setSwState('ready');

        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
              setUpdateAvailable(true);
            }
          });
        });
      } catch {
        if (!cancelled) setSwState('unavailable');
      }
    };

    registerSw();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      window.location.reload();
    }
  }, [waitingWorker]);

  return { swState, updateAvailable, applyUpdate };
}
