import React, { useCallback, useState, useRef } from 'react'
import { Btn, Spinner, Tag, showToast } from '../components/UI'

export function UploadPage({ reports, config, setConfig, addFiles, loadSample, removeReport, clearAll, onRun, loading, progress }) {
  const [isDragActive, setIsDragActive] = useState(false)
  const folderInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const walkEntry = useCallback((entry, path = '') => {
    return new Promise(async (resolve) => {
      if (entry.isFile) {
        entry.file(f => {
          try { Object.defineProperty(f, '_relPath', { value: path + f.name }) } catch {}
          resolve([f])
        })
      } else if (entry.isDirectory) {
        const reader = entry.createReader()
        const allFiles = []
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (!entries.length) return resolve(allFiles)
            for (const child of entries) {
              const files = await walkEntry(child, path + entry.name + '/')
              allFiles.push(...files)
            }
            readBatch()
          })
        }
        readBatch()
      } else {
        resolve([])
      }
    })
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragActive(false)
    const items = Array.from(e.dataTransfer.items || [])
    const allFiles = []
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        const files = await walkEntry(entry)
        allFiles.push(...files)
      } else if (item.kind === 'file') {
        allFiles.push(item.getAsFile())
      }
    }
    if (!allFiles.length) return
    await addFiles(allFiles)
    // toast shown after parse
  }, [addFiles, walkEntry])

  const handleFolderInput = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    await addFiles(files)
    // toast shown after parse
    e.target.value = ''
  }, [addFiles])

  const handleFileInput = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    await addFiles(files)
    showToast(`${files.length} file(s) loaded`)
    e.target.value = ''
  }, [addFiles])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          v1.1 · Two-pass clustering · Folder-aware
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.1, margin: '8px 0 10px' }}>
          PBI Report<br />Rationalisation Tool
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 520 }}>
          Drop your entire PBIP root folder — the tool automatically finds all reports inside, reads their metadata, and groups near-duplicates.
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragActive(true) }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${isDragActive ? 'var(--accent)' : 'var(--line-md)'}`,
          borderRadius: 'var(--r-lg)',
          background: isDragActive ? 'var(--accent-bg)' : 'var(--surface)',
          padding: '44px 24px', textAlign: 'center',
          transition: 'all 0.2s', marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          {isDragActive ? 'Release to scan…' : 'Drop your PBIP root folder here'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          Auto-discovers all <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>.Report</code> subfolders
          and reads <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>report.json</code> metadata
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => folderInputRef.current?.click()} style={primaryBtn}>
            📂 Browse Folder
          </button>
          <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple
            style={{ display: 'none' }} onChange={handleFolderInput} />
          <button onClick={() => fileInputRef.current?.click()} style={ghostBtn}>
            📄 Pick individual files
          </button>
          <input ref={fileInputRef} type="file" multiple
            style={{ display: 'none' }} onChange={handleFileInput} />
        </div>
      </div>

      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)', padding: '10px 14px', marginBottom: 12,
        fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        <span>🔍 Finds: <code style={{ fontFamily: 'var(--font-mono)' }}>*.Report/definition/report.json</code></span>
        <span>📊 Reads: <code style={{ fontFamily: 'var(--font-mono)' }}>*.SemanticModel/model.bim</code></span>
        <span>📄 Or drop any <code style={{ fontFamily: 'var(--font-mono)' }}>report.json</code> directly</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Btn variant="ghost" size="sm" onClick={loadSample} icon="✦">Load sample dataset (8 reports)</Btn>
        {reports.length > 0 && <Btn variant="ghost" size="sm" onClick={clearAll}>Clear all</Btn>}
      </div>

      {reports.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {reports.length} report{reports.length > 1 ? 's' : ''} discovered
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reports.map((r) => (
              <div key={r.file} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 13,
              }}>
                <span style={{ fontSize: 15 }}>📊</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{r.name}</span>
                {r.parse_ok ? <Tag>meta ✓</Tag> : <span style={{ fontSize: 10, color: 'var(--muted2)' }}>name only</span>}
                {r.pages != null && <Tag>{r.pages} pages</Tag>}
                {r.size_kb > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--font-mono)', minWidth: 52, textAlign: 'right' }}>
                    {r.size_kb} KB
                  </span>
                )}
                <button onClick={() => removeReport(r.file)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', fontSize: 14, padding: '0 4px' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)', padding: 22, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 14, marginBottom: 18, letterSpacing: '-0.2px' }}>
          Analysis configuration
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ConfigBlock title="Step 1 — Name similarity" accent="var(--accent)">
            <SliderField label="Threshold" value={config.name_threshold} min={30} max={100}
              onChange={v => setConfig(c => ({ ...c, name_threshold: v }))} suffix="%" />
            <SelectField label="Algorithm" value={config.algo}
              onChange={v => setConfig(c => ({ ...c, algo: v }))}
              options={[
                { value: 'token', label: 'Token cosine (recommended)' },
                { value: 'edit',  label: 'Edit distance' },
                { value: 'jaro',  label: 'Jaro-Winkler' },
                { value: 'combined', label: 'Combined (avg)' },
              ]} />
            <CheckRow label="Ignore year numbers (2024, 2025…)" checked={config.ignore_years}
              onChange={v => setConfig(c => ({ ...c, ignore_years: v }))} />
            <CheckRow label="Ignore version markers (v2, final…)" checked={config.ignore_versions}
              onChange={v => setConfig(c => ({ ...c, ignore_versions: v }))} />
            <CheckRow label="Ignore region suffixes (EMEA, NA…)" checked={config.ignore_regions}
              onChange={v => setConfig(c => ({ ...c, ignore_regions: v }))} />
          </ConfigBlock>

          <ConfigBlock title="Step 2 — Metadata similarity" accent="var(--accent2)">
            <SliderField label="Threshold" value={config.meta_threshold} min={20} max={100}
              onChange={v => setConfig(c => ({ ...c, meta_threshold: v }))} suffix="%" />
            <CheckRow label="Compare tables / sources (40%)" checked={config.check_tables}
              onChange={v => setConfig(c => ({ ...c, check_tables: v }))} />
            <CheckRow label="Compare visuals per page (25%)" checked={config.check_visuals}
              onChange={v => setConfig(c => ({ ...c, check_visuals: v }))} />
            <CheckRow label="Compare filters applied (20%)" checked={config.check_filters}
              onChange={v => setConfig(c => ({ ...c, check_filters: v }))} />
            <CheckRow label="Compare page count (15%)" checked={config.check_pages}
              onChange={v => setConfig(c => ({ ...c, check_pages: v }))} />
          </ConfigBlock>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--accent-bg)', borderRadius: 'var(--r)' }}>
          <Spinner />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Running analysis…</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{progress.label}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}><ProgressPips total={5} current={progress.step} /></div>
        </div>
      ) : (
        <button onClick={onRun} disabled={!reports.length} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: reports.length ? 'var(--ink)' : 'var(--surface3)',
          color: reports.length ? 'var(--surface)' : 'var(--muted2)',
          border: 'none', borderRadius: 'var(--r-sm)', padding: '11px 28px',
          fontSize: 14, fontWeight: 600, cursor: reports.length ? 'pointer' : 'default',
          fontFamily: 'var(--font-display)', letterSpacing: '0.1px', transition: 'all 0.15s',
        }}>
          <span>▶</span> Run Analysis
        </button>
      )}
    </div>
  )
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'var(--ink)', color: 'var(--surface)',
  border: 'none', borderRadius: 'var(--r-sm)', padding: '9px 20px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
}
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--line-md)', borderRadius: 'var(--r-sm)', padding: '9px 20px',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
}

function ConfigBlock({ title, accent, children }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r)', padding: 16, borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}
function SliderField({ label, value, min, max, onChange, suffix = '' }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
        onChange={e => onChange(+e.target.value)} />
    </div>
  )
}
function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', background: 'var(--surface)', border: '1px solid var(--line-md)',
        borderRadius: 'var(--r-sm)', padding: '5px 8px', fontSize: 12,
        color: 'var(--ink)', fontFamily: 'var(--font-body)',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
      {label}
    </label>
  )
}
function ProgressPips({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: i < current ? 'var(--accent)' : 'var(--line-md)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}