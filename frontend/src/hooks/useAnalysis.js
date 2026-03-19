import { useState, useCallback } from 'react'
import { runAnalysis as apiRunAnalysis, exportCSV as apiCSV, exportJSON as apiJSON, SAMPLE_REPORTS } from '../utils/api'

export const DEFAULT_CONFIG = {
  name_threshold: 40,
  meta_threshold: 50,
  ignore_years: true,
  ignore_regions: true,
  ignore_versions: true,
  ignore_case: true,
  algo: 'token',
  weight_tables: 0.40,
  weight_visuals: 0.25,
  weight_filters: 0.20,
  weight_pages: 0.15,
  check_tables: true,
  check_visuals: true,
  check_filters: true,
  check_pages: true,
}

function getRelPath(file) {
  return (file.webkitRelativePath || file._relPath || file.name).replace(/\\/g, '/')
}

function extractReportName(relPath) {
  const match = relPath.match(/([^/]+)\.(Report|SemanticModel|Dataset)\//i)
  if (match) return match[1].trim()
  return relPath.split('/').pop().replace(/\.[^.]+$/, '')
}

function classifyFile(relPath) {
  const parts = relPath.toLowerCase().split('/')
  const ri = parts.findIndex(s => s.endsWith('.report'))
  if (ri !== -1) {
    const after = parts.slice(ri + 1)
    const last = after[after.length - 1]

    // definition/report  OR  definition/report.json
    if (after.length === 2 && after[0] === 'definition' && (last === 'report' || last === 'report.json'))
      return 'reportFile'

    // definition/pages/<section>/page  OR  page.json  (length 4)
    if (after.length === 4 && after[0] === 'definition' && after[1] === 'pages' && (last === 'page' || last === 'page.json'))
      return 'pageFile'

    // definition/pages/<section>/visuals/<guid>/visual  OR  visual.json  (length 6)
    if (after.length === 6 && after[0] === 'definition' && after[1] === 'pages' && after[3] === 'visuals' && (last === 'visual' || last === 'visual.json'))
      return 'visualFile'

    // Also handle pages.json at definition level (index file)
    if (after.length === 2 && after[0] === 'definition' && last === 'pages.json')
      return 'pagesIndex'

    return null
  }
  const si = parts.findIndex(s => s.endsWith('.semanticmodel') || s.endsWith('.dataset'))
  if (si !== -1) {
    const after = parts.slice(si + 1)
    const last = after[after.length - 1]
    if (after.length === 1 && last === 'model.bim') return 'modelBim'
    if (after.length === 4 && after[0] === 'definition' && after[1] === 'tables' && (last === 'table' || last === 'table.json'))
      return 'tableFile'
    return null
  }
  return null
}

async function readJson(file) {
  try { return JSON.parse(await file.text()) } catch { return null }
}

/*
  Confirmed filter format from real PBIP page file:
  filterConfig.filters[].field.Column.Expression.SourceRef.Entity  → "Store"
  filterConfig.filters[].field.Column.Property                     → "Chain"
  → label: "Store.Chain"

  Confirmed visual format:
  visual.query.queryState.<role>.projections[].queryRef  → "Store.Chain", "Sales.TotalSales"
  visual.visualType                                       → "barChart", "slicer" etc.
*/

function extractFilterValue(condition) {
  // Extract comparison value: Comparison, In, Not, Between etc.
  if (!condition) return null
  const cmp = condition.Comparison
  if (cmp) {
    const val = cmp.Right?.Literal?.Value
    if (val) return val.replace(/^'|'$/g, '').replace(/^"|"$/g, '')
  }
  const inCond = condition.In
  if (inCond) {
    const vals = (inCond.Values || []).map(v => {
      const lit = v?.[0]?.Literal?.Value
      return lit ? lit.replace(/^'|'$/g, '') : null
    }).filter(Boolean)
    if (vals.length) return vals.join(', ')
  }
  return null
}

function extractFilters(filterArr) {
  if (!Array.isArray(filterArr)) return []
  const results = []
  for (const f of filterArr) {
    if (!f) continue
    try {
      const obj = typeof f === 'string' ? JSON.parse(f) : f

      // Confirmed new PBIP format
      const entity = obj?.field?.Column?.Expression?.SourceRef?.Entity
      const prop   = obj?.field?.Column?.Property

      if (prop) {
        // Try to get the actual filter value from filter.Where[].Condition
        const whereClause = obj?.filter?.Where || []
        const values = whereClause
          .map(w => extractFilterValue(w?.Condition))
          .filter(Boolean)

        const label = entity ? `${entity}.${prop}` : prop
        const fullLabel = values.length ? `${label} = ${values.join(' OR ')}` : label
        if (!results.includes(fullLabel)) results.push(fullLabel)
        continue
      }

      // Old format fallback
      const oldProp = obj?.expression?.Column?.Property || obj?.expression?.Measure?.Property
      if (oldProp && !results.includes(oldProp)) results.push(oldProp)
    } catch {}
  }
  return results
}

function extractQueryRefs(queryState) {
  // Pull all queryRef strings from visual.query.queryState
  // e.g. "Store.Chain", "Sales.TotalSales", "Time.FiscalMonth"
  const refs = []
  for (const role of Object.values(queryState || {})) {
    for (const proj of role?.projections || []) {
      const qr = proj?.queryRef
      if (qr && !refs.includes(qr)) refs.push(qr)
    }
  }
  return refs
}

async function groupByReport(files) {
  const reportMap = {}
  const ensure = name => {
    if (!reportMap[name]) reportMap[name] = {
      reportFile: null, pageFiles: [], visualFiles: [], modelBim: null, tableFiles: []
    }
    return reportMap[name]
  }

  for (const file of files) {
    const relPath = getRelPath(file)
    const type = classifyFile(relPath)
    if (!type) continue
    const name = extractReportName(relPath)
    const b = ensure(name)
    if (type === 'reportFile')      b.reportFile = file
    else if (type === 'pageFile')   b.pageFiles.push(file)
    else if (type === 'visualFile') b.visualFiles.push(file)
    else if (type === 'modelBim')   b.modelBim = file
    else if (type === 'tableFile')  b.tableFiles.push(file)
  }

  const reports = []
  for (const [name, b] of Object.entries(reportMap)) {
    const meta = {
      tables: [],
      visuals: [],    // visual types: ["barChart", "slicer", ...]
      filters: [],    // filter columns: ["Store.Chain", "Item.Category", ...]
      fields: [],     // all queryRefs used across all visuals: ["Store.Chain", "Sales.TotalSales", ...]
      pages: 0,
    }
    let parseOk = false

    // ── Pages
    meta.pages = b.pageFiles.length
    if (meta.pages > 0) parseOk = true

    // ── Filters from page files (confirmed format: filterConfig.filters[])
    for (const pf of b.pageFiles) {
      const d = await readJson(pf)
      if (!d) continue
      extractFilters(d?.filterConfig?.filters).forEach(n => {
        if (!meta.filters.includes(n)) meta.filters.push(n)
      })
      extractFilters(d?.filters).forEach(n => {
        if (!meta.filters.includes(n)) meta.filters.push(n)
      })
    }

    // ── Filters from report-level file
    if (b.reportFile) {
      const d = await readJson(b.reportFile)
      if (d) {
        extractFilters(d?.filterConfig?.filters).forEach(n => { if (!meta.filters.includes(n)) meta.filters.push(n) })
        extractFilters(d?.filters).forEach(n => { if (!meta.filters.includes(n)) meta.filters.push(n) })
      }
    }

    // ── Visuals + fields from visual files
    for (const vf of b.visualFiles) {
      const d = await readJson(vf)
      if (!d) continue

      // Visual type
      const vtype = d?.visual?.visualType || d?.visualType || d?.singleVisual?.visualType || 'unknown'
      meta.visuals.push(vtype)
      if (vtype !== 'unknown') parseOk = true

      // All fields used in this visual via queryRef
      // e.g. "Store.Chain", "Sales.TotalSales", "Time.FiscalMonth"
      const refs = extractQueryRefs(d?.visual?.query?.queryState)
      refs.forEach(r => {
        // Clean up queryRef — remove trailing () or whitespace
        const clean = r.replace(/\s*\(\s*\)\s*$/, '').trim()
        if (clean && !meta.fields.includes(clean)) meta.fields.push(clean)
      })

      // Visual-level filters
      extractFilters(d?.visual?.filterConfig?.filters).forEach(n => { if (!meta.filters.includes(n)) meta.filters.push(n) })
      extractFilters(d?.visual?.filters).forEach(n => { if (!meta.filters.includes(n)) meta.filters.push(n) })
    }

    // ── Tables from model.bim
    if (b.modelBim) {
      const bim = await readJson(b.modelBim)
      if (bim) {
        const model = bim.model || bim
        const tables = (model.tables || []).map(t => t.name)
          .filter(n => n && !n.startsWith('DateTableTemplate') && !n.startsWith('LocalDateTable') && !n.startsWith('_'))
        meta.tables.push(...tables)
        if (tables.length) parseOk = true
      }
    }

    // ── Tables from table files
    if (!meta.tables.length) {
      for (const tf of b.tableFiles) {
        const d = await readJson(tf)
        const n = d?.name
        if (n && !n.startsWith('DateTableTemplate') && !n.startsWith('_')) {
          if (!meta.tables.includes(n)) meta.tables.push(n)
          parseOk = true
        }
      }
    }

    // ── Old format fallback: single report.json with sections[]
    if (!parseOk && b.reportFile) {
      const d = await readJson(b.reportFile)
      if (d?.sections) {
        meta.pages = d.sections.length
        for (const s of d.sections) {
          for (const vc of s.visualContainers || []) {
            try {
              const cfg = typeof vc.config === 'string' ? JSON.parse(vc.config) : vc.config
              const vt = cfg?.singleVisual?.visualType
              if (vt) meta.visuals.push(vt)
            } catch {}
          }
          extractFilters(s.filters).forEach(n => { if (!meta.filters.includes(n)) meta.filters.push(n) })
        }
        parseOk = true
      }
    }

    if (!parseOk && !meta.pages && !meta.visuals.length && !meta.tables.length) continue

    const ref = b.reportFile || b.pageFiles[0] || b.visualFiles[0] || b.modelBim
    reports.push({
      name,
      file: name + '.pbip',
      size_kb: ref ? +(ref.size / 1024).toFixed(1) : 0,
      meta,
      parse_ok: parseOk,
      pages: meta.pages || null,
    })
  }

  return reports
}

/* ══════════════════════════════════════════════
   Similarity — uses fields[] for richer comparison
   ══════════════════════════════════════════════ */
function metaSimFull(m1, m2, cfg) {
  if (!m1 || !m2) return null
  const jacc = (a, b) => {
    if (!a.length && !b.length) return 1
    if (!a.length || !b.length) return 0
    const sa = new Set(a), sb = new Set(b)
    return [...sa].filter(x => sb.has(x)).length / new Set([...sa, ...sb]).size
  }
  const pageSim = 1 - Math.abs((m1.pages||0) - (m2.pages||0)) / Math.max(m1.pages||1, m2.pages||1)

  // filters[] has 'Entity.Property = Value' strings — captures both column AND value diffs
  const filterSim = jacc(m1.filters || [], m2.filters || [])
  const fieldSim  = jacc(m1.fields  || [], m2.fields  || [])

  return 0.30 * jacc(m1.tables  || [], m2.tables  || [])
       + 0.20 * jacc(m1.visuals || [], m2.visuals || [])
       + 0.25 * filterSim
       + 0.10 * fieldSim
       + 0.15 * pageSim
}

export function useAnalysis() {
  const [reports, setReports] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ step: 0, label: '' })
  const [error, setError] = useState(null)
  const [canonicals, setCanonicals] = useState({})

  const STEPS = ['Parsing metadata…','Step 1: name clustering…','Step 2: metadata clustering…','Computing diffs…','Building report…']

  const fakeProgress = (cb) => {
    let i = 0
    const id = setInterval(() => {
      i++
      setProgress({ step: i, label: STEPS[i-1] || '' })
      if (i >= STEPS.length) { clearInterval(id); cb() }
    }, 280)
  }

  const addFiles = useCallback(async (files) => {
    setError(null)
    try {
      const parsed = await groupByReport(files)
      if (parsed.length > 0) {
        setReports(prev => {
          const existing = new Set(prev.map(r => r.name))
          return [...prev, ...parsed.filter(r => !existing.has(r.name))]
        })
      } else {
        setError('No PBIP reports found. Make sure you drop the folder containing *.Report subfolders.')
      }
    } catch (e) { setError('Failed to parse: ' + e.message) }
  }, [])

  const loadSample   = useCallback(() => { setReports(SAMPLE_REPORTS); setResult(null); setCanonicals({}) }, [])
  const removeReport = useCallback((f) => setReports(p => p.filter(r => r.file !== f)), [])
  const clearAll     = useCallback(() => { setReports([]); setResult(null); setCanonicals({}); setError(null) }, [])

  const runAnalysis = useCallback(async () => {
    if (!reports.length) return
    setLoading(true); setError(null); setProgress({ step: 0, label: STEPS[0] })
    try {
      let data
      await new Promise(resolve => {
        fakeProgress(async () => {
          // Always use client-side engine (it knows about fields[])
          data = clientAnalysis(reports, config)
          resolve()
        })
      })
      if (data?.groups && Object.keys(canonicals).length) {
        data.groups = data.groups.map(g => {
          if (!(g.id in canonicals)) return g
          const c = canonicals[g.id]
          return { ...g, canonical: c, members: g.members.map(m => ({ ...m, is_canonical: m.name === c })) }
        })
      }
      setResult(data)
    } catch (e) { setError(e.message || 'Analysis failed') }
    finally { setLoading(false) }
  }, [reports, config, canonicals])

  const setCanonical = useCallback((gid, name) => {
    setCanonicals(p => ({ ...p, [gid]: name }))
    setResult(p => !p ? p : {
      ...p, groups: p.groups.map(g => g.id !== gid ? g : {
        ...g, canonical: name,
        members: g.members.map(m => ({ ...m, is_canonical: m.name === name }))
      })
    })
  }, [])

  const doExportCSV = () => apiCSV(reports, config).catch(() => {
    const rows = buildRows(result)
    downloadBlob([Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v=>`"${v}"`).join(','))].join('\n'), 'pbi_rationalisation.csv', 'text/csv')
  })
  const doExportJSON = () => apiJSON(reports, config).catch(() =>
    downloadBlob(JSON.stringify(result, null, 2), 'pbi_rationalisation.json', 'application/json'))

  return { reports, setReports, config, setConfig, result, loading, progress, error, canonicals, addFiles, loadSample, removeReport, clearAll, runAnalysis, setCanonical, doExportCSV, doExportJSON }
}

function clientAnalysis(reports, cfg) {
  const n = reports.length
  const cosSim = (a, b) => {
    const ta=tok(a,cfg), tb=tok(b,cfg)
    if (!ta.length||!tb.length) return 0
    const vocab=[...new Set([...ta,...tb])]
    const va=vocab.map(t=>ta.filter(x=>x===t).length), vb=vocab.map(t=>tb.filter(x=>x===t).length)
    const dot=va.reduce((s,v,i)=>s+v*vb[i],0), mA=Math.sqrt(va.reduce((s,v)=>s+v*v,0)), mB=Math.sqrt(vb.reduce((s,v)=>s+v*v,0))
    return mA&&mB ? dot/(mA*mB) : 0
  }

  // Pass 1: name groups
  const p1=Array.from({length:n},(_,i)=>i), f1=x=>p1[x]===x?x:(p1[x]=f1(p1[x]))
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(cosSim(reports[i].name,reports[j].name)*100>=cfg.name_threshold) p1[f1(i)]=f1(j)
  const rootNg={}, ngIds=reports.map((_,i)=>{const r=f1(i);if(!(r in rootNg))rootNg[r]=Object.keys(rootNg).length;return rootNg[r]})

  // Pass 2: metadata groups
  const p2=Array.from({length:n},(_,i)=>i), f2=x=>p2[x]===x?x:(p2[x]=f2(p2[x]))
  for(let g=0;g<Object.keys(rootNg).length;g++){
    const mem=ngIds.map((gid,i)=>gid===g?i:-1).filter(i=>i>=0)
    for(let mi=0;mi<mem.length;mi++) for(let mj=mi+1;mj<mem.length;mj++){
      const s=metaSimFull(reports[mem[mi]].meta, reports[mem[mj]].meta, cfg)
      if(s===null||s*100>=cfg.meta_threshold) p2[f2(mem[mi])]=f2(mem[mj])
    }
  }

  const rootFg={}, fgIds=reports.map((_,i)=>{const r=f2(i);if(!(r in rootFg))rootFg[r]=Object.keys(rootFg).length;return rootFg[r]})
  const gmap={}; reports.forEach((r,i)=>{const gid=fgIds[i];if(!gmap[gid])gmap[gid]=[];gmap[gid].push({...r,name_group_id:ngIds[i],final_group_id:gid})})

  const groups=Object.entries(gmap).map(([gid,members])=>{
    const sc=r=>((r.meta?.pages||0)*3+(r.meta?.visuals?.length||0)+(r.meta?.fields?.length||0))
    const canon=members.reduce((b,r)=>sc(r)>sc(b)?r:b,members[0])
    const enriched=members.map(r=>{
      const ms=metaSimFull(r.meta,canon.meta,cfg)
      const ns=cosSim(r.name,canon.name)
      const fs=ms!==null?0.3*ns+0.7*ms:ns
      const isC=r.name===canon.name
      const dt=isC?'identical':ms>=0.97?'identical':ms>=0.78?'minor':ms!==null?'major':'unknown'
      return{...r,sim_score:Math.round(fs*100),diff_type:dt,is_canonical:isC,diff:isC?{}:buildDiff(canon.meta,r.meta)}
    })
    return{id:+gid,canonical:canon.name,size:members.length,members:enriched}
  }).sort((a,b)=>b.size-a.size||a.id-b.id)

  const totalR=reports.length, cands=groups.reduce((s,g)=>s+Math.max(g.size-1,0),0)
  return{groups,rows:buildRows({groups}),stats:{total_reports:totalR,unique_groups:groups.length,groups_with_duplicates:groups.filter(g=>g.size>1).length,rationalisation_candidates:cands,saving_pct:totalR?Math.round(cands/totalR*100):0}}
}

function buildDiff(m1, m2) {
  if (!m1||!m2) return {}
  const v1=new Set(m1.visuals||[]), v2=new Set(m2.visuals||[])
  const f1=new Set(m1.filters||[]), f2=new Set(m2.filters||[])
  const fd1=new Set(m1.fields||[]),  fd2=new Set(m2.fields||[])
  const t1=new Set(m1.tables||[]),   t2=new Set(m2.tables||[])
  return {
    visuals_added:   [...v2].filter(x=>!v1.has(x)),
    visuals_removed: [...v1].filter(x=>!v2.has(x)),
    visuals_common:  [...v1].filter(x=>v2.has(x)),
    filters_added:   [...f2].filter(x=>!f1.has(x)),
    filters_removed: [...f1].filter(x=>!f2.has(x)),
    filters_common:  [...f1].filter(x=>f2.has(x)),
    fields_added:    [...fd2].filter(x=>!fd1.has(x)),
    fields_removed:  [...fd1].filter(x=>!fd2.has(x)),
    fields_common:   [...fd1].filter(x=>fd2.has(x)),
    tables_added:    [...t2].filter(x=>!t1.has(x)),
    tables_removed:  [...t1].filter(x=>!t2.has(x)),
    pages_delta:     (m2.pages||0)-(m1.pages||0),
  }
}

function tok(name,cfg){let s=cfg.ignore_case?name.toLowerCase():name;if(cfg.ignore_years)s=s.replace(/\b(19|20)\d{2}\b/g,'');if(cfg.ignore_versions)s=s.replace(/\b(v\d+|final|draft|copy|old|new|backup)\b/gi,'');if(cfg.ignore_regions)s=s.replace(/\b(emea|apac|na|us|uk|eu|india)\b/gi,'');return s.replace(/[\s_\-\.\/]+/g,' ').trim().split(' ').filter(Boolean)}
function buildRows({groups}){return(groups||[]).flatMap(g=>g.members.map(r=>({report_name:r.name,file:r.file||'',name_group_id:r.name_group_id,final_group_id:r.final_group_id,similarity_pct:r.sim_score,diff_type:r.diff_type,is_canonical:r.is_canonical,recommendation:r.is_canonical?'Keep (canonical)':g.size===1?'Keep (unique)':'Review for retirement'})))}
function downloadBlob(content,filename,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=filename;a.click()}