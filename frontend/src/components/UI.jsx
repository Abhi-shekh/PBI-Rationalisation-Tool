import React from 'react'

/* ── Badge ── */
export function Badge({ children, variant = 'default', size = 'sm' }) {
  const colors = {
    default: { bg: '#f0ede6', text: '#5a5852' },
    blue:    { bg: '#eef3ff', text: '#1a56db' },
    teal:    { bg: '#ecfdf5', text: '#0e9f6e' },
    amber:   { bg: '#fef3c7', text: '#c27803' },
    red:     { bg: '#fff5f5', text: '#c81e1e' },
    coral:   { bg: '#fff1ee', text: '#9b3a1a' },
    green:   { bg: '#f0fdf4', text: '#166534' },
    purple:  { bg: '#f5f3ff', text: '#5b21b6' },
  }
  const c = colors[variant] || colors.default
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: c.bg, color: c.text,
      fontSize: size === 'xs' ? 10 : 11,
      fontWeight: 600, letterSpacing: '0.3px',
      padding: size === 'xs' ? '1px 6px' : '2px 8px',
      borderRadius: 10, whiteSpace: 'nowrap',
      fontFamily: 'var(--font-body)',
    }}>
      {children}
    </span>
  )
}

/* ── Button ── */
export function Btn({ children, variant = 'ghost', size = 'md', onClick, disabled, style, icon }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'var(--font-body)', fontWeight: 500,
    transition: 'all 0.15s', borderRadius: 'var(--r-sm)',
    fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
    padding: size === 'sm' ? '5px 10px' : size === 'lg' ? '11px 24px' : '7px 14px',
    opacity: disabled ? 0.45 : 1,
  }
  const variants = {
    primary: { background: '#0e0d0b', color: '#f5f3ee' },
    ghost:   { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line-md)' },
    accent:  { background: 'var(--accent)', color: 'white' },
    danger:  { background: 'var(--danger-bg)', color: 'var(--danger)' },
  }
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.8' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {children}
    </button>
  )
}

/* ── Stat card ── */
export function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r)', padding: '16px 18px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: accent || 'var(--ink)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── Similarity bar ── */
export function SimBar({ value }) {
  const color = value >= 90 ? '#0e9f6e' : value >= 70 ? '#c27803' : '#c81e1e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 3, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{value}%</span>
    </div>
  )
}

/* ── Tag ── */
export function Tag({ children }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, padding: '1px 6px',
      borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--line)',
      color: 'var(--muted)', fontFamily: 'var(--font-mono)',
    }}>
      {children}
    </span>
  )
}

/* ── Spinner ── */
export function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid var(--line-md)`,
      borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

/* ── Toast ── */
let toastTimer
export function showToast(msg) {
  let el = document.getElementById('__toast')
  if (!el) {
    el = document.createElement('div')
    el.id = '__toast'
    Object.assign(el.style, {
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#0e0d0b', color: '#f5f3ee',
      padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      fontFamily: 'DM Sans, sans-serif',
      transform: 'translateY(20px)', opacity: 0,
      transition: 'all 0.2s', pointerEvents: 'none',
    })
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.transform = 'translateY(0)'
  el.style.opacity = 1
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.style.transform = 'translateY(20px)'; el.style.opacity = 0 }, 2800)
}

/* ── Section header ── */
export function SectionHeader({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{sub}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

/* ── Diff badge helper ── */
const DIFF_COLORS = {
  identical: 'teal',
  minor:     'amber',
  major:     'coral',
  unknown:   'default',
}
const DIFF_LABELS = {
  identical: 'Identical',
  minor:     'Minor diff',
  major:     'Major diff',
  unknown:   '—',
}
export function DiffBadge({ type }) {
  return <Badge variant={DIFF_COLORS[type] || 'default'}>{DIFF_LABELS[type] || type}</Badge>
}

/* ── Group badge colours ── */
const GROUP_VARIANTS = ['blue','teal','purple','amber','green','coral','red']
export function groupBadgeVariant(id) { return GROUP_VARIANTS[id % GROUP_VARIANTS.length] }
