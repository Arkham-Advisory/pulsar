import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useNotifications } from './hooks/useNotifications'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useTrackedPageNavigation } from './hooks/useTrackedPageNavigation'
import { useSettingsStore } from './store/settings'
import { capture, identifyGitHubUser, resetAnalyticsIdentity } from './lib/analytics'
import { validatePAT } from './services/github'
import { usePRListData } from './hooks/usePRListData'
import { useDashboardData } from './hooks/useDashboardData'
import { AppHeader } from './components/layout/AppHeader'
import { AppUpdateBanner } from './components/layout/AppUpdateBanner'
import { CommandPalette } from './components/command/CommandPalette'
import { AnalyticsConsent } from './components/layout/AnalyticsConsent'
import { PRListPage } from './pages/PRListPage'
import { OverviewPage } from './pages/OverviewPage'
import { TeamPage } from './pages/TeamPage'
import { APILimitsPage } from './pages/APILimitsPage'
import { EmptyState } from './components/dashboard/EmptyState'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SharedLinkPreviewModal, type SharedLinkPayload } from './components/pr-list/SharedLinkPreviewModal'
import type { CommandItem, PRListCommandBridge } from './types/commandPalette'

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

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
    updateAvailable,
    isApplyingUpdate,
    applyError,
    applyUpdate,
    dismissUpdate,
  } = useAppUpdate()
  const {
    darkMode,
    toggleDarkMode,
    hasValidSettings,
    refreshIntervalMinutes,
    pat,
    userLogin,
    analyticsConsent,
    setUserLogin,
    setRepoFilters,
    addRepoFilter,
    setSelectedRepos,
    setHideBotPRs,
    setSectionOrder,
  } = useSettingsStore()
  const hasTrackedUpdatePromptRef = useRef(false)

  // Parse the share link payload once on mount.
  // When there is no PAT yet, we show the combined PAT+preview modal from here
  // instead of pushing the user into Settings.
  const [noPATSharePayload] = useState<SharedLinkPayload | null>(() => {
    if (pat) return null
    try {
      const hash = window.location.hash
      if (!hash.startsWith('#filter=')) return null
      const raw = JSON.parse(atob(hash.slice(8)))
      if (raw.share === true) return raw as SharedLinkPayload
    } catch { /* ignore */ }
    return null
  })
  const [noPATModalDismissed, setNoPATModalDismissed] = useState(false)

  useEffect(() => {
    if (!noPATSharePayload) return
    capture('share_link_opened', {
      requires_pat: true,
      repo_filter_count: Array.isArray(noPATSharePayload.repoFilters) ? noPATSharePayload.repoFilters.length : 0,
      selected_repo_count: Array.isArray(noPATSharePayload.selectedRepos) ? noPATSharePayload.selectedRepos.length : 0,
    })
  }, [noPATSharePayload])

  const hasShareLink = useMemo(() => {
    try {
      const hash = window.location.hash
      if (!hash.startsWith('#filter=')) return false
      return JSON.parse(atob(hash.slice(8))).share === true
    } catch {
      return false
    }
  }, [])

  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const { page, navigateToPage } = useTrackedPageNavigation('prs', analyticsConsent === true)
  const [prListCommandBridge, setPRListCommandBridge] = useState<PRListCommandBridge | null>(null)
  const qc = useQueryClient()
  const commandPaletteShortcutLabel = useMemo(
    () => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'),
    [],
  )

  const openSettings = useCallback((source: 'header' | 'empty_state' | 'share_link' | 'first_visit' | 'command_palette') => {
    setShowSettings(true)
    capture('settings_opened', { source })
  }, [])

  const {
    isLoading: prListLoading,
    isFetching: prListFetching,
    isError: prListError,
    dataUpdatedAt: prListUpdatedAt,
    progress: prListProgress,
  } = usePRListData()

  const {
    isLoading: dashLoading,
    isFetching: dashFetching,
    isError: dashError,
    dataUpdatedAt: dashUpdatedAt,
    progress: dashProgress,
  } = useDashboardData(page === 'overview' || page === 'team')

  const isDashboardPage = page === 'overview' || page === 'team'
  const isLoading = page === 'prs' ? prListLoading : isDashboardPage ? dashLoading : false
  const isFetching = page === 'prs' ? prListFetching : isDashboardPage ? dashFetching : false
  const isError = page === 'prs' ? prListError : isDashboardPage ? dashError : false
  const updatedAt = page === 'prs' ? prListUpdatedAt : isDashboardPage ? dashUpdatedAt : null
  const progress = page === 'prs' ? prListProgress : isDashboardPage ? dashProgress : undefined
  const lastUpdated = updatedAt ? new Date(updatedAt) : null

  useNotifications()

  useEffect(() => {
    if (!updateAvailable || hasTrackedUpdatePromptRef.current) return
    hasTrackedUpdatePromptRef.current = true
    capture('app_update_available')
  }, [updateAvailable])

  useEffect(() => {
    if (updateAvailable) return
    hasTrackedUpdatePromptRef.current = false
  }, [updateAvailable])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

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

  const handleToggleFullscreen = useCallback(() => {
    const enabled = !document.fullscreenElement
    capture('fullscreen_toggled', { enabled, page })
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [page])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    if (!pat || (userLogin && analyticsConsent !== true)) return

    let cancelled = false

    validatePAT(pat).then((result) => {
      if (cancelled || !result.valid) return

      if (!userLogin) setUserLogin(result.user.login)
      if (analyticsConsent === true) identifyGitHubUser(result.user)
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [analyticsConsent, pat, setUserLogin, userLogin])

  useEffect(() => {
    if (!pat) {
      resetAnalyticsIdentity()
    }
  }, [pat])

  useEffect(() => {
    if (!hasValidSettings() && !hasShareLink) openSettings('first_visit')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = useCallback(() => {
    capture('refresh_triggered', { method: 'manual', page })
    if (page === 'prs') {
      qc.invalidateQueries({ queryKey: ['pr-list'] })
      qc.invalidateQueries({ queryKey: ['ci-statuses'] })
    } else if (isDashboardPage) {
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    } else {
      qc.invalidateQueries({ queryKey: ['rate-limit'] })
    }
  }, [isDashboardPage, page, qc])

  const handleNoPATShareApply = useCallback((payload: SharedLinkPayload, replaceRepoFilters: boolean) => {
    if (Array.isArray(payload.repoFilters) && payload.repoFilters.length > 0) {
      if (replaceRepoFilters) {
        setRepoFilters(payload.repoFilters)
      } else {
        payload.repoFilters.forEach((f) => addRepoFilter(f))
      }
    }
    if (Array.isArray(payload.sectionOrder)) setSectionOrder(payload.sectionOrder)
    if (typeof payload.hideBotPRs === 'boolean') setHideBotPRs(payload.hideBotPRs)
    if (Array.isArray(payload.selectedRepos)) setSelectedRepos(payload.selectedRepos)
    capture('share_link_applied', {
      replace_repo_filters: replaceRepoFilters,
      repo_filter_count: Array.isArray(payload.repoFilters) ? payload.repoFilters.length : 0,
      selected_repo_count: Array.isArray(payload.selectedRepos) ? payload.selectedRepos.length : 0,
    })
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setNoPATModalDismissed(true)
  }, [setRepoFilters, addRepoFilter, setSectionOrder, setHideBotPRs, setSelectedRepos])

  const handleNoPATShareDismiss = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setNoPATModalDismissed(true)
  }, [])

  const handleApplyUpdate = useCallback(() => {
    capture('app_update_refresh_clicked')
    void applyUpdate()
  }, [applyUpdate])

  const handleDismissUpdate = useCallback(() => {
    capture('app_update_dismissed')
    dismissUpdate()
  }, [dismissUpdate])

  const validSettings = hasValidSettings()
  const canMountPRList = validSettings || (!!pat && hasShareLink)
  const showNoPATModal = !!noPATSharePayload && !pat && !noPATModalDismissed

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false)
  }, [])

  const openCommandPalette = useCallback((source: 'shortcut' | 'header_button') => {
    if (showSettings || showNoPATModal) return
    if (document.querySelector('[role="dialog"]')) return
    setIsCommandPaletteOpen(true)
    capture('command_palette_opened', { source, page })
  }, [page, showNoPATModal, showSettings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (isEditableElement(event.target)) return
      event.preventDefault()
      if (isCommandPaletteOpen) {
        closeCommandPalette()
      } else {
        openCommandPalette('shortcut')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeCommandPalette, isCommandPaletteOpen, openCommandPalette])

  const commandItems = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-prs',
        group: 'navigation',
          title: 'Go to Pull Requests',
          keywords: ['prs', 'pull requests', 'triage'],
          perform: () => {
          navigateToPage('prs', 'command_palette')
          },
      },
      {
        id: 'nav-overview',
        group: 'navigation',
        title: 'Go to Overview',
        keywords: ['overview', 'dashboard', 'metrics', 'charts'],
        perform: () => {
          navigateToPage('overview', 'command_palette')
        },
      },
      {
        id: 'nav-team',
        group: 'navigation',
        title: 'Go to Team',
        keywords: ['team', 'collaboration', 'reviewers'],
        perform: () => {
          navigateToPage('team', 'command_palette')
        },
      },
      {
        id: 'nav-api',
        group: 'navigation',
        title: 'Go to API Limits',
        keywords: ['api', 'limits', 'rate limit'],
        perform: () => {
          navigateToPage('api', 'command_palette')
        },
      },
      {
        id: 'action-settings',
        group: 'actions',
        title: 'Open Settings',
        keywords: ['settings', 'preferences', 'config'],
        perform: () => openSettings('command_palette'),
      },
      {
        id: 'action-refresh',
        group: 'actions',
        title: 'Refresh data',
        keywords: ['refresh', 'reload', 'sync'],
        perform: () => handleRefresh(),
      },
      {
        id: 'action-theme',
        group: 'actions',
        title: darkMode ? 'Switch to light mode' : 'Switch to dark mode',
        keywords: ['theme', 'dark mode', 'light mode', 'appearance'],
        perform: () => {
          const nextMode = darkMode ? 'light' : 'dark'
          toggleDarkMode()
          capture('theme_toggled', { mode: nextMode, source: 'command_palette' })
        },
      },
      {
        id: 'action-fullscreen',
        group: 'actions',
        title: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
        keywords: ['fullscreen', 'presentation'],
        perform: () => handleToggleFullscreen(),
      },
    ]

    if (page === 'prs' && prListCommandBridge) {
      items.push(
        {
          id: 'action-search-prs',
          group: 'actions',
          title: 'Search PRs…',
          subtitle: 'Apply the current palette query to the PR list',
          keywords: ['search', 'find', 'query'],
          perform: (query) => prListCommandBridge.setSearch(query.trim()),
        },
        {
          id: 'filter-open',
          group: 'filters',
          title: 'Show open PRs',
          subtitle: prListCommandBridge.stateFilter === 'open' ? 'Currently active' : undefined,
          keywords: ['open', 'state', 'filter'],
          perform: () => prListCommandBridge.setStateFilter('open'),
        },
        {
          id: 'filter-merged',
          group: 'filters',
          title: 'Show merged PRs',
          subtitle: prListCommandBridge.stateFilter === 'merged' ? 'Currently active' : undefined,
          keywords: ['merged', 'state', 'filter'],
          perform: () => prListCommandBridge.setStateFilter('merged'),
        },
        {
          id: 'filter-bots',
          group: 'filters',
          title: prListCommandBridge.hideBotPRs ? 'Show bot PRs' : 'Hide bot PRs',
          keywords: ['bots', 'dependabot', 'renovate'],
          perform: () => prListCommandBridge.toggleHideBotPRs(),
        },
        {
          id: 'filter-clear',
          group: 'filters',
          title: 'Clear all filters',
          keywords: ['clear', 'reset', 'filters'],
          perform: () => prListCommandBridge.clearFilters(),
        },
        {
          id: 'action-share-link',
          group: 'actions',
          title: 'Copy share link',
          keywords: ['share', 'link', 'copy'],
          perform: () => prListCommandBridge.copyShareLink(),
        },
        {
          id: 'action-save-preset-settings',
          group: 'actions',
          title: 'Save current filters as preset',
          subtitle: 'Opens Settings to name and save the preset',
          keywords: ['save preset', 'bookmark', 'filters'],
          perform: () => openSettings('command_palette'),
        },
      )

      prListCommandBridge.repos.forEach((repo) => {
        items.push({
          id: `repo-${repo}`,
          group: 'filters',
          title: `Filter by repo: ${repo.split('/')[1]}`,
          subtitle: repo,
          keywords: ['repo', 'repository', repo],
          perform: () => prListCommandBridge.setSingleRepo(repo),
        })
      })

      prListCommandBridge.reviewers.forEach((reviewer) => {
        items.push({
          id: `reviewer-${reviewer}`,
          group: 'filters',
          title: `Filter by reviewer: ${reviewer}`,
          keywords: ['reviewer', reviewer],
          perform: () => prListCommandBridge.setSingleReviewer(reviewer),
        })
      })

      prListCommandBridge.filterPresets.forEach((preset) => {
        items.push({
          id: `preset-${preset.id}`,
          group: 'presets',
          title: preset.name,
          subtitle: [
            preset.stateFilter,
            preset.search && `"${preset.search}"`,
            preset.selectedRepos.length > 0 && `${preset.selectedRepos.length} repos`,
            preset.selectedReviewers.length > 0 && `${preset.selectedReviewers.length} reviewers`,
            preset.hideBotPRs && 'No bots',
          ].filter(Boolean).join(' · '),
          keywords: ['preset', preset.name],
          perform: () => prListCommandBridge.applyPreset(preset.id),
        })
      })

      prListCommandBridge.allPRs.forEach((pr) => {
        items.push({
          id: `pr-${pr.id}`,
          group: 'pull_requests',
          title: pr.title,
          subtitle: `${pr.repo} #${pr.number} · ${pr.user.login}`,
          keywords: ['pr', 'pull request', `#${pr.number}`, String(pr.number), pr.repo, pr.user.login],
          perform: () => prListCommandBridge.openPR(pr.id),
        })
      })
    }

    return items
  }, [
    darkMode,
    handleRefresh,
    handleToggleFullscreen,
    isFullscreen,
    openSettings,
    page,
    prListCommandBridge,
    toggleDarkMode,
    navigateToPage,
  ])

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppHeader
        page={page}
        onNavigate={navigateToPage}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenSettings={() => openSettings('header')}
        onOpenCommandPalette={() => openCommandPalette('header_button')}
        showCommandPaletteTrigger={true}
        commandPaletteShortcutLabel={commandPaletteShortcutLabel}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        progress={progress}
      />

      {updateAvailable && (
        <AppUpdateBanner
          isApplyingUpdate={isApplyingUpdate}
          applyError={applyError}
          onApplyUpdate={handleApplyUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}

      {!canMountPRList ? (
        <EmptyState onOpenSettings={() => openSettings('empty_state')} />
      ) : page === 'prs' ? (
        <PRListPage
          onOpenSettings={() => openSettings('share_link')}
          onCommandStateChange={setPRListCommandBridge}
        />
      ) : page === 'overview' ? (
        <OverviewPage />
      ) : page === 'team' ? (
        <TeamPage />
      ) : (
        <APILimitsPage />
      )}

      {isCommandPaletteOpen && (
        <CommandPalette
          commands={commandItems}
          onClose={closeCommandPalette}
          onCommandRun={(command, query) => {
            capture('command_palette_command_run', {
              command_id: command.id,
              command_group: command.group,
              page,
              has_query: query.trim().length > 0,
            })
          }}
          onZeroResults={(query) => {
            capture('command_palette_zero_results', {
              page,
              query_length: query.trim().length,
            })
          }}
        />
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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
