import { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from './store/settings'
import { validatePAT } from './services/github'
import { usePRListData } from './hooks/usePRListData'
import { useDashboardData } from './hooks/useDashboardData'
import { AppHeader, type AppPage } from './components/layout/AppHeader'
import { PRListPage } from './pages/PRListPage'
import { DashboardPage } from './pages/DashboardPage'
import { APILimitsPage } from './pages/APILimitsPage'
import { EmptyState } from './components/dashboard/EmptyState'
import { SettingsPanel } from './components/settings/SettingsPanel'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppContent() {
  const { darkMode, hasValidSettings, refreshIntervalMinutes, pat, userLogin, setUserLogin } = useSettingsStore()
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
      qc.invalidateQueries({ queryKey: ['pr-list'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
      qc.invalidateQueries({ queryKey: ['ci-statuses'] })
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

  // Open settings on first visit
  useEffect(() => {
    if (!hasValidSettings()) setShowSettings(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = useCallback(() => {
    if (page === 'prs') {
      qc.invalidateQueries({ queryKey: ['pr-list'] })
      qc.invalidateQueries({ queryKey: ['ci-statuses'] })
    } else if (page === 'dashboard') {
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    } else {
      qc.invalidateQueries({ queryKey: ['rate-limit'] })
    }
  }, [page, qc])

  const validSettings = hasValidSettings()

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

      {!validSettings ? (
        <EmptyState onOpenSettings={() => setShowSettings(true)} />
      ) : page === 'prs' ? (
        <PRListPage />
      ) : page === 'dashboard' ? (
        <DashboardPage />
      ) : (
        <APILimitsPage />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
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

