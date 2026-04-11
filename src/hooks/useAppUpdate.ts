import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_APPLY_FALLBACK_MS = 3000;

interface AppUpdateState {
  updateAvailable: boolean;
  isApplyingUpdate: boolean;
  applyError: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const updateServiceWorkerRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setApplyError(false);
        setDismissed(false);
        setHasPendingUpdate(true);
      },
      onRegisteredSW(_swUrl, nextRegistration) {
        setRegistration(nextRegistration ?? null);
      },
      onRegisterError(error) {
        console.error('Failed to register the Pulsar service worker.', error);
      },
    });
  }, []);

  useEffect(() => {
    if (!registration) return;

    const checkForUpdates = () => {
      registration.update().catch(() => {});
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    const intervalId = window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [registration]);

  const applyUpdate = useCallback(async () => {
    setApplyError(false);
    setIsApplyingUpdate(true);

    try {
      if (!updateServiceWorkerRef.current) {
        window.location.reload();
        return;
      }

      await updateServiceWorkerRef.current(true);

      // If the browser doesn't emit the controller change event promptly,
      // fall back to a regular reload so the UI doesn't spin forever.
      window.setTimeout(() => {
        window.location.reload();
      }, UPDATE_APPLY_FALLBACK_MS);
    } catch (error) {
      console.error('Failed to activate the updated Pulsar app.', error);
      setApplyError(true);
      setIsApplyingUpdate(false);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    updateAvailable: hasPendingUpdate && !dismissed,
    isApplyingUpdate,
    applyError,
    applyUpdate,
    dismissUpdate,
  };
}
