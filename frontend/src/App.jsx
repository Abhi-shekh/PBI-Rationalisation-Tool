import React, { useState } from 'react'
import { useAnalysis } from './hooks/useAnalysis'
import { UploadPage } from './pages/UploadPage'
import { ResultsPage } from './pages/ResultsPage'
import { HowItWorksPage, SettingsPage } from './pages/OtherPages'
import { showToast } from './components/UI'

const TABS = [
  { id: 'upload',  label: 'Upload' },
  { id: 'results', label: 'Results' },
  { id: 'settings',label: 'Settings' },
  { id: 'howto',   label: 'How it works' },
]

export default function App() {
  const [tab, setTab] = useState('upload')

  // Listen for navigate events from child components
  React.useEffect(() => {
    const handler = (e) => setTab(e.detail)
    window.addEventListener('navigate', handler)
    return () => window.removeEventListener('navigate', handler)
  }, [])

  const {
    reports, config, setConfig,
    result, loading, progress, error,
    canonicals,
    addFiles, loadSample, removeReport, clearAll,
    runAnalysis, setCanonical,
    doExportCSV, doExportJSON,
  } = useAnalysis()

  const handleRun = async () => {
    await runAnalysis()
    if (!loading) setTab('results')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 28px', height: 54,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 16 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
              <rect x="0" y="0" width="5" height="5" rx="1"/>
              <rect x="7" y="0" width="5" height="5" rx="1"/>
              <rect x="0" y="7" width="5" height="5" rx="1"/>
              <rect x="7" y="7" width="5" height="5" rx="1"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.2px' }}>
            PBI Rationalisation
          </span>
        </div>

        {/* Tabs */}
        <nav style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '5px 13px', border: 'none', borderRadius: 'var(--r-sm)',
                background: tab === t.id ? 'var(--ink)' : 'transparent',
                color: tab === t.id ? 'var(--surface)' : 'var(--muted)',
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              {t.id === 'results' && result && (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontFamily: 'var(--font-mono)',
                  background: tab === 'results' ? 'rgba(255,255,255,0.2)' : 'var(--line-md)',
                  padding: '1px 5px', borderRadius: 8,
                }}>
                  {result.stats?.unique_groups}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right side: status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && (
            <span style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '3px 10px', borderRadius: 12 }}>
              {error}
            </span>
          )}
          {reports.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {reports.length} file{reports.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* ── Accent strip ── */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent2) 50%, transparent 100%)' }} />

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {tab === 'upload' && (
          <UploadPage
            reports={reports}
            config={config}
            setConfig={setConfig}
            addFiles={addFiles}
            loadSample={loadSample}
            removeReport={removeReport}
            clearAll={clearAll}
            onRun={async () => { await runAnalysis(); setTimeout(() => setTab('results'), 200) }}
            loading={loading}
            progress={progress}
          />
        )}
        {tab === 'results' && (
          <ResultsPage
            result={result}
            canonicals={canonicals}
            setCanonical={setCanonical}
            onExportCSV={doExportCSV}
            onExportJSON={doExportJSON}
          />
        )}
        {tab === 'settings' && <SettingsPage config={config} setConfig={setConfig} />}
        {tab === 'howto' && <HowItWorksPage />}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--line)', padding: '12px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, color: 'var(--muted2)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>PBI Rationalisation v1.0</span>
        <span>FastAPI + React · Two-pass clustering</span>
      </footer>
    </div>
  )
}