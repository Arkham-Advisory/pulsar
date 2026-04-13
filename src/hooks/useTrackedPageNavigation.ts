import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { capture } from '../lib/analytics';
import type { AppPage, NavigationSource } from '../types/navigation';
import { isKnownAppPath, pageToPath, pathToPage } from '../lib/navigation';

function toDurationSeconds(startedAt: number): number {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

export function useTrackedPageNavigation(
  initialPage: AppPage,
  analyticsEnabled: boolean,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = useMemo(() => pathToPage(location.pathname), [location.pathname]);
  const pageRef = useRef<AppPage>(page);
  const sourceRef = useRef<NavigationSource>('default');
  const previousPageRef = useRef<AppPage | null>(null);
  const pendingSourceRef = useRef<NavigationSource | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const analyticsEnabledRef = useRef(analyticsEnabled);

  const flushDwell = useCallback(() => {
    if (!analyticsEnabledRef.current || startedAtRef.current === null) return;

    capture('page_dwell_completed', {
      page: pageRef.current,
      source: sourceRef.current,
      duration_seconds: toDurationSeconds(startedAtRef.current),
    });

    startedAtRef.current = null;
  }, []);

  const startTracking = useCallback((currentPage: AppPage, source: NavigationSource, previousPage: AppPage | null) => {
    if (!analyticsEnabledRef.current) return;

    capture('page_viewed', {
      page: currentPage,
      source,
      previous_page: previousPage,
    });
    startedAtRef.current = Date.now();
  }, []);

  const navigateToPage = useCallback((nextPage: AppPage, source: NavigationSource) => {
    const previousPage = pageRef.current;
    if (nextPage === previousPage) return;

    if (analyticsEnabledRef.current) {
      flushDwell();
      capture('navigation_used', {
        target_page: nextPage,
        source,
        previous_page: previousPage,
      });
    }

    pendingSourceRef.current = source;
    navigate(pageToPath(nextPage));
  }, [flushDwell, navigate]);

  useEffect(() => {
    if (!isKnownAppPath(location.pathname)) {
      navigate(pageToPath(initialPage), { replace: true });
    }
  }, [initialPage, location.pathname, navigate]);

  useEffect(() => {
    const previousPage = previousPageRef.current;
    const source = pendingSourceRef.current ?? (previousPage ? 'default' : sourceRef.current);

    pageRef.current = page;
    sourceRef.current = source;

    if (analyticsEnabledRef.current) {
      startTracking(page, source, previousPage);
    }

    startedAtRef.current = analyticsEnabledRef.current ? Date.now() : null;
    previousPageRef.current = page;
    pendingSourceRef.current = null;
  }, [page, startTracking]);

  useEffect(() => {
    analyticsEnabledRef.current = analyticsEnabled;

    if (!analyticsEnabled) {
      startedAtRef.current = null;
      return;
    }

    if (startedAtRef.current === null) {
      startTracking(pageRef.current, sourceRef.current, null);
    }
  }, [analyticsEnabled, startTracking]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDwell();
        return;
      }

      if (analyticsEnabledRef.current && startedAtRef.current === null) {
        startedAtRef.current = Date.now();
      }
    };

    const handlePageHide = () => {
      flushDwell();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushDwell();
    };
  }, [flushDwell]);

  return { page, navigateToPage };
}
