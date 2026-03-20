import React, { useMemo } from 'react'

/* ══════════════════════════════════════════════
   How It Works page
   ══════════════════════════════════════════════ */
export function HowItWorksPage() {
  const steps = [
    {
      n: 1, color: 'var(--accent)',
      title: 'Parse PBIP metadata',
      body: 'Each .pbip folder is scanned. The tool reads page.json (filters + filter values), visual.json (visual types + fields used), and table.json (table names). Everything is extracted into a structured metadata object per report.',
      chips: ['page.json', 'visual.json', 'table.json', 'filterConfig'],
    },
    {
      n: 2, color: 'var(--accent)',
      title: 'Step 1 — Name-based clustering',
      body: 'Report names are tokenised and compared using Token Cosine Similarity. Year numbers, version markers (v2, final) and region suffixes (EMEA, NA) are stripped before comparison. Reports above the name threshold share a name-group-id.',
      chips: ['cosine similarity', 'tokenise', 'name_group_id'],
    },
    {
      n: 3, color: 'var(--accent2)',
      title: 'Step 2 — Metadata clustering',
      body: 'Within each name group, Jaccard similarity is computed on tables, visuals, filters (with values), fields, and page count using union-find clustering. Each dimension has a configurable weight. Reports above the metadata threshold share a final-group-id.',
      chips: ['jaccard', 'weighted score', 'final_group_id'],
    },
    {
      n: 4, color: 'var(--warn)',
      title: 'Diff classification',
      body: 'Each pair within a final-group is classified: Identical (≥97%), Minor diff (≥78% — e.g. one extra filter value or visual), Major diff (<78% — extra page or different tables).',
      chips: ['identical', 'minor', 'major'],
    },
    {
      n: 5, color: '#c27803',
      title: 'Canonical selection',
      body: 'The most complete report (highest pages × 3 + visuals score) is auto-suggested as canonical. You can override per group. Canonical = keep; others = review for retirement.',
      chips: ['is_canonical', 'recommendation'],
    },
    {
      n: 6, color: 'var(--accent2)',
      title: 'Export',
      body: 'Final table: report_name, name_group_id, final_group_id, similarity_pct, diff_type, is_canonical, recommendation. Export as CSV or JSON.',
      chips: ['CSV', 'JSON', 'markdown'],
    },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 6 }}>
        How the two-pass rationalisation works
      </h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
        Two independent clustering passes — name similarity then metadata similarity — merged into one final grouping.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: s.color + '22', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{s.n}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, fontFamily: 'var(--font-display)' }}>{s.title}</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 10 }}>{s.body}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {s.chips.map(c => (
                  <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--muted)' }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Settings page — with manual weight sliders
   ══════════════════════════════════════════════ */
export function SettingsPage({ config, setConfig }) {

  // Total weight — used to show warning if not 100%
  const totalWeight = useMemo(() => {
    const t = (config.check_tables  ? (config.weight_tables  || 0) : 0)
            + (config.check_visuals ? (config.weight_visuals || 0) : 0)
            + (config.check_filters ? (config.weight_filters || 0) : 0)
            + (config.check_fields  ? (config.weight_fields  || 0) : 0)
            + (config.check_pages   ? (config.weight_pages   || 0) : 0)
    return Math.round(t * 100)
  }, [config])

  const weightOk = totalWeight === 100

  // Normalise all weights to sum to 1.0
  const autoNormalise = () => {
    const active = [
      config.check_tables  && 'weight_tables',
      config.check_visuals && 'weight_visuals',
      config.check_filters && 'weight_filters',
      config.check_fields  && 'weight_fields',
      config.check_pages   && 'weight_pages',
    ].filter(Boolean)
    if (!active.length) return
    const total = active.reduce((s, k) => s + (config[k] || 0), 0)
    if (total === 0) return
    const updates = {}
    active.forEach(k => { updates[k] = Math.round((config[k] / total) * 100) / 100 })
    setConfig(c => ({ ...c, ...updates }))
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 24 }}>
        Analysis settings
      </h2>

      {/* ── Step 1 ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 24, marginBottom: 16 }}>
        <SectionTitle>Step 1 — Name clustering</SectionTitle>

        <RangeField
          label="Name similarity threshold" suffix="%"
          value={config.name_threshold} min={10} max={100}
          desc="Reports with name similarity ≥ this value are placed in the same name-group. Lower = more aggressive grouping."
          onChange={v => setConfig(c => ({ ...c, name_threshold: v }))} />

        <div style={{ marginTop: 16 }}>
          <SelectField
            label="Similarity algorithm"
            value={config.algo}
            onChange={v => setConfig(c => ({ ...c, algo: v }))}
            options={[
              { value: 'token',    label: 'Token cosine (TF-IDF) — recommended' },
              { value: 'edit',     label: 'Edit distance (Levenshtein)' },
              { value: 'jaro',     label: 'Jaro-Winkler' },
              { value: 'combined', label: 'Combined (average of all three)' },
            ]}
            desc="Algorithm used to compare report names." />
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CheckField label="Ignore year numbers (2024, 2025…)" checked={config.ignore_years}
            onChange={v => setConfig(c => ({ ...c, ignore_years: v }))} />
          <CheckField label="Ignore version markers (v2, final, draft…)" checked={config.ignore_versions}
            onChange={v => setConfig(c => ({ ...c, ignore_versions: v }))} />
          <CheckField label="Ignore region suffixes (EMEA, NA, APAC…)" checked={config.ignore_regions}
            onChange={v => setConfig(c => ({ ...c, ignore_regions: v }))} />
          <CheckField label="Case-insensitive matching" checked={config.ignore_case}
            onChange={v => setConfig(c => ({ ...c, ignore_case: v }))} />
        </div>
      </div>

      {/* ── Step 2 ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 24 }}>
        <SectionTitle>Step 2 — Metadata clustering</SectionTitle>

        <RangeField
          label="Metadata similarity threshold" suffix="%"
          value={config.meta_threshold} min={20} max={100}
          desc="Combined weighted score needed to merge reports into the same final-group."
          onChange={v => setConfig(c => ({ ...c, meta_threshold: v }))} />

        {/* ── Weight sliders ── */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Dimension weights
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                background: weightOk ? 'var(--accent2-bg)' : 'var(--warn-bg)',
                color: weightOk ? 'var(--accent2)' : 'var(--warn)',
              }}>
                Total: {totalWeight}% {weightOk ? '✓' : '≠ 100%'}
              </div>
              <button onClick={autoNormalise} style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 10,
                background: 'var(--surface2)', border: '1px solid var(--line-md)',
                color: 'var(--muted)', cursor: 'pointer',
              }}>
                Auto-normalise
              </button>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 14 }}>
            Weights must sum to 100%. Toggle a dimension off to exclude it from comparison entirely.
          </div>

          {/* Tables */}
          <WeightRow
            label="Tables / data sources"
            desc="Which data tables the report connects to (e.g. Sales, Store, Item)"
            checked={config.check_tables}
            weight={Math.round((config.weight_tables || 0) * 100)}
            color="var(--accent)"
            onCheck={v => setConfig(c => ({ ...c, check_tables: v }))}
            onWeight={v => setConfig(c => ({ ...c, weight_tables: v / 100 }))}
          />

          {/* Visuals */}
          <WeightRow
            label="Visual types per page"
            desc="Types of visuals used: barChart, slicer, pieChart, table etc."
            checked={config.check_visuals}
            weight={Math.round((config.weight_visuals || 0) * 100)}
            color="var(--coral)"
            onCheck={v => setConfig(c => ({ ...c, check_visuals: v }))}
            onWeight={v => setConfig(c => ({ ...c, weight_visuals: v / 100 }))}
          />

          {/* Filters */}
          <WeightRow
            label="Filters applied (with values)"
            desc="Filter columns AND their applied values e.g. Store.Store Type = New Store"
            checked={config.check_filters}
            weight={Math.round((config.weight_filters || 0) * 100)}
            color="var(--accent2)"
            onCheck={v => setConfig(c => ({ ...c, check_filters: v }))}
            onWeight={v => setConfig(c => ({ ...c, weight_filters: v / 100 }))}
          />

          {/* Fields */}
          <WeightRow
            label="Fields used in visuals"
            desc="Columns/measures placed on visual axes, legends, tooltips e.g. Sales.TotalSales"
            checked={config.check_fields !== false}
            weight={Math.round((config.weight_fields || 0) * 100)}
            color="var(--warn)"
            onCheck={v => setConfig(c => ({ ...c, check_fields: v }))}
            onWeight={v => setConfig(c => ({ ...c, weight_fields: v / 100 }))}
          />

          {/* Pages */}
          <WeightRow
            label="Number of pages"
            desc="How many report pages exist — extra page = major structural difference"
            checked={config.check_pages}
            weight={Math.round((config.weight_pages || 0) * 100)}
            color="var(--coral)"
            onCheck={v => setConfig(c => ({ ...c, check_pages: v }))}
            onWeight={v => setConfig(c => ({ ...c, weight_pages: v / 100 }))}
          />
        </div>

        {/* Preset buttons */}
        <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Quick presets</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Default',        w: { weight_tables: 0.30, weight_visuals: 0.20, weight_filters: 0.25, weight_fields: 0.10, weight_pages: 0.15 } },
              { label: 'Filter-heavy',   w: { weight_tables: 0.20, weight_visuals: 0.15, weight_filters: 0.40, weight_fields: 0.10, weight_pages: 0.15 } },
              { label: 'Visual-heavy',   w: { weight_tables: 0.20, weight_visuals: 0.40, weight_filters: 0.20, weight_fields: 0.10, weight_pages: 0.10 } },
              { label: 'Source-heavy',   w: { weight_tables: 0.50, weight_visuals: 0.15, weight_filters: 0.20, weight_fields: 0.10, weight_pages: 0.05 } },
            ].map(p => (
              <button key={p.label} onClick={() => setConfig(c => ({ ...c, ...p.w }))} style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 6,
                background: 'var(--surface2)', border: '1px solid var(--line-md)',
                color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.target.style.background = 'var(--accent-bg)'; e.target.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.background = 'var(--surface2)'; e.target.style.color = 'var(--muted)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Weight row with checkbox + slider + bar ── */
function WeightRow({ label, desc, checked, weight, color, onCheck, onWeight }) {
  return (
    <div style={{
      padding: '12px 14px',
      marginBottom: 8,
      background: checked ? 'var(--surface2)' : 'var(--surface)',
      border: '1px solid var(--line)',
      borderLeft: `3px solid ${checked ? color : 'var(--line)'}`,
      borderRadius: 'var(--r-sm)',
      opacity: checked ? 1 : 0.5,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: checked ? 10 : 0 }}>
        <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)}
          style={{ accentColor: color, cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{desc}</div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          color: checked ? color : 'var(--muted2)', minWidth: 36, textAlign: 'right',
        }}>
          {weight}%
        </div>
      </div>

      {checked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Background bar */}
            <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${weight}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.2s' }} />
            </div>
            <input
              type="range" min={0} max={100} step={5} value={weight}
              onChange={e => onWeight(+e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--ink)', letterSpacing: '-0.2px' }}>{children}</div>
}

function RangeField({ label, value, min, max, onChange, suffix, desc }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}{suffix}</span>
      </div>
      {desc && <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 6 }}>{desc}</p>}
      <input type="range" min={min} max={max} value={value}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
        onChange={e => onChange(+e.target.value)} />
    </div>
  )
}

function SelectField({ label, value, onChange, options, desc }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {desc && <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 6 }}>{desc}</p>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', background: 'var(--surface2)', border: '1px solid var(--line-md)',
        borderRadius: 'var(--r-sm)', padding: '6px 10px', fontSize: 13,
        color: 'var(--ink)', fontFamily: 'var(--font-body)',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }} />
      {label}
    </label>
  )
}