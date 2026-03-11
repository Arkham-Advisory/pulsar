import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics.ts'

// Only init analytics for returning visitors who already gave consent.
// First-time visitors are handled by the AnalyticsConsent component.
try {
  const stored = localStorage.getItem('pr-dashboard-settings');
  if (stored && JSON.parse(stored)?.state?.analyticsConsent === true) {
    initAnalytics();
  }
} catch { /* ignore parse errors */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
