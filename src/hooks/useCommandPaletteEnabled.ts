import { useEffect, useState } from 'react';
import { subscribeToFeatureFlag } from '../lib/analytics';
import { useSettingsStore } from '../store/settings';

export function useCommandPaletteEnabled(): boolean {
  const analyticsConsent = useSettingsStore((state) => state.analyticsConsent);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (analyticsConsent !== true) return;

    let unsubscribe = subscribeToFeatureFlag('command_palette', setEnabled);

    const handleReady = () => {
      unsubscribe();
      unsubscribe = subscribeToFeatureFlag('command_palette', setEnabled);
    };

    window.addEventListener('posthog:ready', handleReady);

    return () => {
      unsubscribe();
      window.removeEventListener('posthog:ready', handleReady);
    };
  }, [analyticsConsent]);

  return analyticsConsent === true ? enabled : false;
}
