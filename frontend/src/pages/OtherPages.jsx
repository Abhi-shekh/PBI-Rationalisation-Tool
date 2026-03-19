import React from 'react'

/* ══════════════════════════════════════════════
   How It Works page
   ══════════════════════════════════════════════ */
export function HowItWorksPage() {
  const steps = [
    {
      n: 1,
      color: 'var(--accent)',
      title: 'Parse PBIP metadata',
      body: `Each .pbip file is parsed alongside its companion report.json and definition.pbidataset. Extracted fields include: report name, tables used, data source connections, number of pages, visuals on each page, and filters applied.`,
      chips: ['.pbip', 'report.json', '.pbidataset'],
    },
    {
      n: 2,
      color: 'var(--accent)',
      title: 'Step 1 — Name-based clustering',
      body: `Report names are tokenised and compared using token-level TF-IDF cosine similarity (or Jaro-Winkler / Levenshtein depending on settings). Reports whose similarity meets the configured threshold are assigned the same name-group-id. Year-ignore strips tokens like 2024, 2025 before comparison.`,
      chips: ['cosine', 'jaro-winkler', 'levenshtein', 'name_group_id'],
    },
    {
      n: 3,
      color: 'var(--accent2)',
      title: 'Step 2 — Metadata agglomerative clustering',
      body: `Within each name-group, metadata vectors are compared using union-find clustering. Similarity is a weighted blend: tables (40%), visuals (25%), filters (20%), page count (15%). Reports below the metadata threshold get their own unique final-group-id even if name-similar.`,
      chips: ['jaccard', 'union-find', 'final_group_id'],
    },
    {
      n: 4,
      color: 'var(--warn)',
      title: 'Diff classification',
      body: `Each pair within a final-group is classified: identical (≥97% similar), minor diff (≥78%, e.g. one extra visual or filter), major diff (below 78%, e.g. extra page or different table set).`,
      chips: ['identical', 'minor', 'major'],
    },
    {
      n: 5,
      color: '#c27803',
      title: 'Canonical selection',
      body: `The most feature-complete report (highest pages × 3 + visuals score) is auto-suggested as canonical. You can override this per group. Canonical = keep; others = review for retirement.`,
      chips: ['is_canonical', 'recommendation'],
    },
    {
      n: 6,
      color: 'var(--accent2)',
      title: 'Export',
      body: `Final table columns: report_name, name_group_id, final_group_id, similarity_pct, diff_type, is_canonical, recommendation. Export as CSV or JSON to drive your rationalisation backlog.`,
      chips: ['CSV', 'JSON', 'markdown'],
    },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 6 }}>
        How the two-pass rationalisation works
      </h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
        The engine runs two independent clustering passes, then merges them. Each pass uses a different signal.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map(s => (
          <div key={s.n} style={{
            display: 'flex', gap: 18,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)', padding: '20px 22px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: s.color + '22', color: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)',
            }}>{s.n}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, fontFamily: 'var(--font-display)' }}>{s.title}</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 10 }}>{s.body}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {s.chips.map(c => (
                  <span key={c} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 8px',
                    background: 'var(--surface2)', border: '1px solid var(--line)',
                    borderRadius: 4, color: 'var(--muted)',
                  }}>{c}</span>
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
   Settings page
   ══════════════════════════════════════════════ */
export function SettingsPage({ config, setConfig }) {
  const field = (label, key, desc) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</label>
      {desc && <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>{desc}</p>}
    </div>
  )

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 24 }}>
        Analysis settings
      </h2>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 24 }}>

        <Section title="Step 1 — Name clustering">
          <RangeField label="Name similarity threshold" value={config.name_threshold} min={30} max={100}
            desc="Reports with name similarity ≥ this value share a name-group-id."
            onChange={v => setConfig(c => ({ ...c, name_threshold: v }))} suffix="%" />

          <SelectField label="Similarity algorithm"
            value={config.algo}
            onChange={v => setConfig(c => ({ ...c, algo: v }))}
            options={[
              { value: 'token',    label: 'Token cosine (TF-IDF) — recommended' },
              { value: 'edit',     label: 'Edit distance (Levenshtein)' },
              { value: 'jaro',     label: 'Jaro-Winkler' },
              { value: 'combined', label: 'Combined (average of all)' },
            ]}
            desc="Algorithm used to compare report names in Step 1." />

          <CheckField label="Ignore year numbers (2024, 2025…)" checked={config.ignore_years}
            onChange={v => setConfig(c => ({ ...c, ignore_years: v }))} />
          <CheckField label="Ignore version markers (v2, final, draft…)" checked={config.ignore_versions}
            onChange={v => setConfig(c => ({ ...c, ignore_versions: v }))} />
          <CheckField label="Ignore region suffixes (EMEA, NA, APAC…)" checked={config.ignore_regions}
            onChange={v => setConfig(c => ({ ...c, ignore_regions: v }))} />
          <CheckField label="Case-insensitive matching" checked={config.ignore_case}
            onChange={v => setConfig(c => ({ ...c, ignore_case: v }))} />
        </Section>

        <div style={{ borderTop: '1px solid var(--line)', margin: '20px 0' }} />

        <Section title="Step 2 — Metadata clustering">
          <RangeField label="Metadata similarity threshold" value={config.meta_threshold} min={20} max={100}
            desc="Combined metadata score needed to merge reports into the same final-group."
            onChange={v => setConfig(c => ({ ...c, meta_threshold: v }))} suffix="%" />

          <CheckField label="Compare tables / data sources (weight: 40%)" checked={config.check_tables}
            onChange={v => setConfig(c => ({ ...c, check_tables: v }))} />
          <CheckField label="Compare visuals per page (weight: 25%)" checked={config.check_visuals}
            onChange={v => setConfig(c => ({ ...c, check_visuals: v }))} />
          <CheckField label="Compare filters applied (weight: 20%)" checked={config.check_filters}
            onChange={v => setConfig(c => ({ ...c, check_filters: v }))} />
          <CheckField label="Compare page count (weight: 15%)" checked={config.check_pages}
            onChange={v => setConfig(c => ({ ...c, check_pages: v }))} />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--ink)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
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
