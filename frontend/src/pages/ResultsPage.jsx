import React, { useState, useMemo } from 'react'
import { Badge, Btn, SimBar, DiffBadge, SectionHeader, StatCard, Tag, groupBadgeVariant, showToast } from '../components/UI'

export function ResultsPage({ result, canonicals, setCanonical, onExportCSV, onExportJSON }) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [diffFilter, setDiffFilter] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const [expandedDiff, setExpandedDiff] = useState(() => new Set())

  const { groups = [], stats = {} } = result || {}

  const filtered = useMemo(() => {
    return groups.filter(g => {
      if (groupFilter && String(g.id) !== groupFilter) return false
      if (diffFilter && !g.members.some(m => m.diff_type === diffFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!g.members.some(m => m.name.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [groups, search, groupFilter, diffFilter])

  const toggleGroup = id => setExpandedGroups(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const toggleDiff = key => setExpandedDiff(prev => {
    const s = new Set(prev)
    s.has(key) ? s.delete(key) : s.add(key)
    return s
  })

  const copyMarkdown = () => {
    const rows = groups.flatMap(g => g.members.map(r => ({
      name: r.name, ngid: r.name_group_id, fgid: r.final_group_id,
      sim: r.sim_score, diff: r.diff_type, rec: r.is_canonical ? 'Keep (canonical)' : g.size === 1 ? 'Keep (unique)' : 'Review'
    })))
    const header = '| Report name | Name-group | Final-group | Similarity | Diff | Recommendation |\n|---|---|---|---|---|---|'
    const body = rows.map(r => `| ${r.name} | ${r.ngid} | ${r.fgid} | ${r.sim}% | ${r.diff} | ${r.rec} |`).join('\n')
    navigator.clipboard.writeText(header + '\n' + body).then(() => showToast('Markdown copied to clipboard'))
  }

  if (!result) return (
    <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
      <p style={{ fontSize: 15 }}>Run an analysis to see results here.</p>
    </div>
  )

  return (
    <div>
      <SectionHeader
        title="Analysis Results"
        sub={`${stats.total_reports} reports · ${stats.unique_groups} groups · analysed`}
      >
        <Btn variant="ghost" size="sm" onClick={onExportCSV} icon="⬇">CSV</Btn>
        <Btn variant="ghost" size="sm" onClick={onExportJSON} icon="⬇">JSON</Btn>
        <Btn variant="ghost" size="sm" onClick={copyMarkdown} icon="⎘">Markdown</Btn>
      </SectionHeader>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
        <StatCard label="Total reports" value={stats.total_reports} />
        <StatCard label="Groups found" value={stats.unique_groups} />
        <StatCard label="Total similar reports" value={stats.rationalisation_candidates} sub={`${stats.saving_pct}% of reports`} accent="var(--coral)" />
        <StatCard label="Rational reports" value={stats.groups_with_duplicates} accent="var(--warn)" />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search reports…"
          style={{
            flex: 1, minWidth: 200,
            border: '1px solid var(--line-md)', borderRadius: 'var(--r-sm)',
            padding: '7px 12px', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)',
            fontFamily: 'var(--font-body)',
          }}
        />
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={selectStyle}>
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>Group {g.id} — {g.canonical}</option>)}
        </select>
        <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} style={selectStyle}>
          <option value="">All diff types</option>
          <option value="identical">Identical</option>
          <option value="minor">Minor diff</option>
          <option value="major">Major diff</option>
        </select>
      </div>

      {/* ── Groups ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>
            No groups match the current filter.
          </div>
        )}
        {filtered.map((group, gi) => {
          const expanded = expandedGroups.has(group.id) || group.size > 1
          return (
            <GroupCard
              key={group.id}
              group={group}
              gi={gi}
              expanded={expanded}
              onToggle={() => toggleGroup(group.id)}
              canonicals={canonicals}
              setCanonical={setCanonical}
              expandedDiff={expandedDiff}
              toggleDiff={toggleDiff}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── Group card ── */
function GroupCard({ group, gi, expanded, onToggle, canonicals, setCanonical, expandedDiff, toggleDiff }) {
  const variant = groupBadgeVariant(gi)
  const hasDiffs = group.members.some(m => m.diff_type !== 'identical')

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      animation: 'fadeUp 0.3s ease both',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 18px', cursor: 'pointer',
          background: expanded ? 'var(--surface2)' : 'var(--surface)',
          borderBottom: expanded ? '1px solid var(--line)' : 'none',
          transition: 'background 0.15s',
        }}
      >
        <Badge variant={variant}>Group {group.id}</Badge>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{group.canonical}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {group.size} report{group.size > 1 ? 's' : ''}
        </span>
        {hasDiffs && <Badge variant="amber">has diffs</Badge>}
        {group.size === 1 && <Badge variant="teal">unique</Badge>}
        <span style={{ color: 'var(--muted2)', fontSize: 12, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>

      {/* Body */}
      {expanded && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Report name','Name-group','Final-group','Similarity','Diff type','Action'].map(h => (
                  <th key={h} style={{
                    fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px',
                    fontWeight: 600, textAlign: 'left', padding: '8px 16px',
                    borderBottom: '1px solid var(--line)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.members.map((r, ri) => {
                const isCanon = canonicals[group.id] ? canonicals[group.id] === r.name : r.is_canonical
                return (
                  <tr key={r.name + ri} style={{ borderBottom: ri < group.members.length - 1 ? '1px solid var(--line)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>
                      {isCanon && <span style={{ color: '#c27803', marginRight: 5 }}>★</span>}
                      {r.name}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{r.name_group_id}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{r.final_group_id}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}><SimBar value={r.sim_score} /></td>
                    <td style={{ padding: '10px 16px' }}><DiffBadge type={r.diff_type} /></td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        onClick={() => { setCanonical(group.id, r.name); showToast('Canonical set: ' + r.name) }}
                        style={{
                          background: isCanon ? '#fef3c7' : 'transparent',
                          border: `1px solid ${isCanon ? '#c27803' : 'var(--line-md)'}`,
                          color: isCanon ? '#c27803' : 'var(--muted)',
                          borderRadius: 'var(--r-sm)', padding: '3px 10px', fontSize: 11,
                          cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
                        }}
                      >
                        {isCanon ? '★ Canonical' : 'Set canonical'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Diff panel ── */}
          {group.size > 1 && (
            <DiffSection group={group} expandedDiff={expandedDiff} toggleDiff={toggleDiff} canonicals={canonicals} />
          )}
        </div>
      )}
    </div>
  )
}

/* ── Diff section ── */
function DiffSection({ group, expandedDiff, toggleDiff, canonicals }) {
  const canon = group.members.find(m => canonicals[group.id] ? canonicals[group.id] === m.name : m.is_canonical)
              || group.members[0]
  const variants = group.members.filter(m => m.name !== canon.name)
  if (!variants.length) return null

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface2)', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Diff viewer
        </div>
        {/* <div style={{ fontSize: 11, color: 'var(--muted2)', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '3px 10px', borderRadius: 8, maxWidth: 380 }}>
          ⚠ Filter selected values are only available via Power BI Service API — this diff shows filter columns and fields used
        </div> */}
      </div>
      {variants.map((variant, vi) => {
        const key = `${group.id}-${vi}`
        const open = expandedDiff.has(key)
        const diff = variant.diff || {}
        return (
          <div key={vi} style={{ marginBottom: vi < variants.length - 1 ? 12 : 0 }}>
            <button
              onClick={() => toggleDiff(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 0', fontSize: 13, color: 'var(--ink)',
                textAlign: 'left',
              }}
            >
              <span style={{ color: 'var(--muted2)', fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : '' }}>▶</span>
              <span style={{ color: 'var(--muted)' }}>vs.</span>
              <span style={{ fontWeight: 500 }}>{variant.name}</span>
              <DiffBadge type={variant.diff_type} />
              <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 'auto' }}>
                {variant.sim_score}% similar
              </span>
            </button>

            {open && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <DiffCol title={`Canonical — ${canon.name}`} meta={canon.meta} other={variant.meta} side="left" />
                <DiffCol title={`Variant — ${variant.name}`} meta={variant.meta} other={canon.meta} side="right" diff={diff} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DiffCol({ title, meta, other, side, diff = {} }) {
  if (!meta) return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface2)', borderBottom: '1px solid var(--line)' }}>{title}</div>
      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>No metadata</div>
    </div>
  )

  const otherVisuals = new Set(other?.visuals || [])
  const otherFilters = new Set(other?.filters || [])
  const otherFields  = new Set(other?.fields  || [])
  const otherTables  = new Set(other?.tables  || [])
  const isRight = side === 'right'

  const rows = [
    // Tables
    ...(meta.tables || []).map(t => ({ type: 'table', val: t, added: isRight && !otherTables.has(t), removed: !isRight && !otherTables.has(t) })),
    // Visual types
    ...(meta.visuals || []).map(v => ({ type: 'visual', val: v, added: isRight && !otherVisuals.has(v), removed: !isRight && !otherVisuals.has(v) })),
    // Filters WITH values (e.g. "Store.Chain = New Store")
    ...(meta.filters || []).map(f => ({ type: 'filter', val: f, added: isRight && !otherFilters.has(f), removed: !isRight && !otherFilters.has(f) })),
    // Fields used in visuals
    ...(meta.fields || []).map(f => ({ type: 'field', val: f, added: isRight && !otherFields.has(f), removed: !isRight && !otherFields.has(f) })),
    // Pages
    { type: 'pages', val: meta.pages || 0, added: false, removed: false, pageDelta: isRight && diff.pages_delta },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface2)', borderBottom: '1px solid var(--line)' }}>
        {title}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', fontSize: 12,
          borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none',
          background: row.added ? 'var(--accent2-bg)' : row.removed ? '#fff5f5' : '',
        }}>
          <span style={{ color: row.added ? 'var(--accent2)' : row.removed ? 'var(--danger)' : 'var(--muted2)', fontWeight: 700, minWidth: 12 }}>
            {row.added ? '+' : row.removed ? '−' : '·'}
          </span>
          <span style={{ color: 'var(--muted2)', minWidth: 46, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{row.type}</span>
          <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {row.val}
            {row.pageDelta !== false && row.pageDelta !== 0 && (
              <span style={{ marginLeft: 6, color: row.pageDelta > 0 ? 'var(--accent2)' : 'var(--danger)' }}>
                ({row.pageDelta > 0 ? '+' : ''}{row.pageDelta})
              </span>
            )}
          </span>
          {(row.added || row.removed) && (
            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
              background: row.added ? 'var(--accent2-bg)' : '#fff5f5',
              color: row.added ? 'var(--accent2)' : 'var(--danger)' }}>
              {row.added ? 'ADDED' : 'REMOVED'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

const selectStyle = {
  border: '1px solid var(--line-md)', borderRadius: 'var(--r-sm)',
  padding: '7px 10px', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)',
  fontFamily: 'var(--font-body)', cursor: 'pointer',
}