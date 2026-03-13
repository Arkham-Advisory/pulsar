import { useState, useEffect, useCallback, useMemo } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from './store/settings'
import { capture } from './lib/analytics'
import { validatePAT } from './services/github'
import { usePRListData } from './hooks/usePRListData'
import { useDashboardData } from './hooks/useDashboardData'
import { AppHeader, type AppPage } from './components/layout/AppHeader'
import { AnalyticsConsent } from './components/layout/AnalyticsConsent'
import { PRListPage } from './pages/PRListPage'
import { DashboardPage } from './pages/DashboardPage'
import { APILimitsPage } from './pages/APILimitsPage'
import { EmptyState } from './components/dashboard/EmptyState'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SharedLinkPreviewModal, type SharedLinkPayload } from './components/pr-list/SharedLinkPreviewModal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppContent() {
  const {
    darkMode, hasValidSettings, refreshIntervalMinutes, pat, userLogin, setUserLogin,
    setRepoFilters, addRepoFilter, setSelectedRepos, setHideBotPRs, setSectionOrder,
  } = useSettingsStore()

  // Parse the share link payload once on mount.
  // When there is no PAT yet, we show the combined PAT+preview modal from here
  // instead of pushing the user into Settings.
  const [noPATSharePayload] = useState<SharedLinkPayload | null>(() => {
    if (pat) return null; // Already authenticated — PRListPage handles the modal
    try {
      const hash = window.location.hash;
      if (!hash.startsWith('#filter=')) return null;
      const raw = JSON.parse(atob(hash.slice(8)));
      if (raw.share === true) return raw as SharedLinkPayload;
    } catch { /* ignore */ }
    return null;
  });
  // Whether the no-PAT modal has been dismissed (so it doesn't re-appear after Cancel)
  const [noPATModalDismissed, setNoPATModalDismissed] = useState(false);

  // Detect share link once on mount — allows PRListPage to mount (and show the review
  // modal) even before the user has configured repo filters, as long as they have a PAT.
  const hasShareLink = useMemo(() => {
    try {
      const hash = window.location.hash;
      if (!hash.startsWith('#filter=')) return false;
      return JSON.parse(atob(hash.slice(8))).share === true;
    } catch { return false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [page, setPage] = useState<AppPage>('prs')
  const qc = useQueryClient()

  // PR list data — always active once settings are valid
  const {
    isLoading: prListLoading,
    isFetching: prListFetching,
    isError: prListError,
    dataUpdatedAt: prListUpdatedAt,
    progress: prListProgress,
  } = usePRListData()

  // Dashboard data — activates when user navigates to the dashboard
  const {
    isLoading: dashLoading,
    isFetching: dashFetching,
    isError: dashError,
    dataUpdatedAt: dashUpdatedAt,
    progress: dashProgress,
  } = useDashboardData(page === 'dashboard')

  const isLoading = page === 'prs' ? prListLoading : dashLoading
  const isFetching = page === 'prs' ? prListFetching : dashFetching
  const isError = page === 'prs' ? prListError : dashError
  const updatedAt = page === 'prs' ? prListUpdatedAt : dashUpdatedAt
  const progress = page === 'prs' ? prListProgress : dashProgress
  const lastUpdated = updatedAt ? new Date(updatedAt) : null

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Auto-refresh
  useEffect(() => {
    if (!hasValidSettings() || refreshIntervalMinutes <= 0) return
    const interval = setInterval(() => {
      capture('refresh_triggered', { method: 'auto' })
      qc.invalidateQueries({ queryKey: ['pr-list'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
      qc.invalidateQueries({ queryKey: ['ci-statuses'] })
      qc.invalidateQueries({ queryKey: ['approval-statuses'] })
    }, refreshIntervalMinutes * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshIntervalMinutes, hasValidSettings, qc])

  // Fullscreen
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Auto-populate userLogin if pat is already saved but login was never resolved
  // (happens when upgrading from a version that didn't store userLogin)
  useEffect(() => {
    if (pat && !userLogin) {
      validatePAT(pat).then((result) => {
        if (result.valid && result.login) setUserLogin(result.login)
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open settings on first visit — but skip if we're showing the no-PAT share modal
  useEffect(() => {
    if (!hasValidSettings() && !hasShareLink) setShowSettings(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = useCallback(() => {
    capture('refresh_triggered', { method: 'manual', page })
    if (page === 'prs') {
      qc.invalidateQueries({ queryKey: ['pr-list'] })
      qc.invalidateQueries({ queryKey: ['ci-statuses'] })
    } else if (page === 'dashboard') {
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    } else {
      qc.invalidateQueries({ queryKey: ['rate-limit'] })
    }
  }, [page, qc])

  // Apply the no-PAT share link: save repo settings to store and clear the hash.
  // The PAT itself is saved inside SharedLinkPreviewModal before this callback fires.
  const handleNoPATShareApply = useCallback((payload: SharedLinkPayload, replaceRepoFilters: boolean) => {
    if (Array.isArray(payload.repoFilters) && payload.repoFilters.length > 0) {
      if (replaceRepoFilters) {
        setRepoFilters(payload.repoFilters);
      } else {
        payload.repoFilters.forEach((f) => addRepoFilter(f));
      }
    }
    if (Array.isArray(payload.sectionOrder)) setSectionOrder(payload.sectionOrder);
    if (typeof payload.hideBotPRs === 'boolean') setHideBotPRs(payload.hideBotPRs);
    if (Array.isArray(payload.selectedRepos)) setSelectedRepos(payload.selectedRepos);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setNoPATModalDismissed(true);
  }, [setRepoFilters, addRepoFilter, setSectionOrder, setHideBotPRs, setSelectedRepos])

  const handleNoPATShareDismiss = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setNoPATModalDismissed(true);
  }, [])

  const validSettings = hasValidSettings()
  // Allow mounting PRListPage with just a PAT when a share link is in the URL,
  // so the share preview modal can appear and supply the missing repo configuration.
  const canMountPRList = validSettings || (!!pat && hasShareLink)

  // Show the no-PAT combined modal when: share link present, no PAT, not yet dismissed
  const showNoPATModal = !!noPATSharePayload && !pat && !noPATModalDismissed

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppHeader
        page={page}
        onNavigate={setPage}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenSettings={() => setShowSettings(true)}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        progress={progress}
      />

      {!canMountPRList ? (
        <EmptyState onOpenSettings={() => setShowSettings(true)} />
      ) : page === 'prs' ? (
        <PRListPage onOpenSettings={() => setShowSettings(true)} />
      ) : page === 'dashboard' ? (
        <DashboardPage />
      ) : (
        <APILimitsPage />
      )}

      {showNoPATModal && (
        <SharedLinkPreviewModal
          payload={noPATSharePayload!}
          currentRepoFilters={[]}
          onApply={handleNoPATShareApply}
          onDismiss={handleNoPATShareDismiss}
          requiresPAT
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      <AnalyticsConsent />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App

