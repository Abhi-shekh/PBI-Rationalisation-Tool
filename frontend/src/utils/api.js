import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL

if (!BASE_URL) {
  throw new Error("VITE_API_URL is not defined")
}

const api = axios.create({
  baseURL: BASE_URL + '/api',
})

export const uploadFiles = (files) => {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  return api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const runAnalysis = (reports, config) =>
  api.post('/analyse', { reports, config })

export const exportCSV = async (reports, config) => {
  const res = await api.post('/export/csv', { reports, config }, { responseType: 'blob' })
  triggerDownload(res.data, 'pbi_rationalisation.csv', 'text/csv')
}

export const exportJSON = async (reports, config) => {
  const res = await api.post('/export/json', { reports, config }, { responseType: 'blob' })
  triggerDownload(res.data, 'pbi_rationalisation.json', 'application/json')
}

function triggerDownload(blob, filename, type) {
  const url = URL.createObjectURL(new Blob([blob], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── Sample data (used when backend unavailable) ── */
export const SAMPLE_REPORTS = [
  { name: 'Sales Report 2024', file: 'SalesReport2024.pbip', size_kb: 18.2, parse_ok: true,
    meta: { tables: ['fact_sales','dim_customer','dim_date'], pages: 3,
            visuals: ['bar_chart','line_chart','kpi','slicer'],
            filters: ['Date=YTD','Region=All'] } },
  { name: 'Sales Report 2025', file: 'SalesReport2025.pbip', size_kb: 20.1, parse_ok: true,
    meta: { tables: ['fact_sales','dim_customer','dim_date'], pages: 3,
            visuals: ['bar_chart','line_chart','kpi','slicer','bar_chart'],
            filters: ['Date=YTD','Region=All'] } },
  { name: 'Sales Report 2025 v2', file: 'SalesReport2025v2.pbip', size_kb: 21.3, parse_ok: true,
    meta: { tables: ['fact_sales','dim_customer','dim_date'], pages: 4,
            visuals: ['bar_chart','line_chart','kpi','slicer','scatter'],
            filters: ['Date=YTD','Region=EMEA'] } },
  { name: 'Sales Report 2025 Final', file: 'SalesReport2025_Final.pbip', size_kb: 19.8, parse_ok: true,
    meta: { tables: ['fact_sales','dim_customer','dim_date'], pages: 3,
            visuals: ['bar_chart','line_chart','kpi','slicer'],
            filters: ['Date=YTD','Region=All'] } },
  { name: 'HR Dashboard', file: 'HR_Dashboard.pbip', size_kb: 14.5, parse_ok: true,
    meta: { tables: ['fact_headcount','dim_employee','dim_date'], pages: 2,
            visuals: ['donut_chart','table','kpi','bar_chart'],
            filters: ['Department=All'] } },
  { name: 'HR Report', file: 'HR_Report.pbip', size_kb: 13.9, parse_ok: true,
    meta: { tables: ['fact_headcount','dim_employee','dim_date'], pages: 2,
            visuals: ['donut_chart','table','kpi','bar_chart'],
            filters: ['Department=All'] } },
  { name: 'Marketing Analysis', file: 'Marketing_Analysis.pbip', size_kb: 30.2, parse_ok: true,
    meta: { tables: ['fact_campaigns','dim_channel','dim_date'], pages: 5,
            visuals: ['funnel','bar_chart','line_chart','kpi','map','slicer'],
            filters: ['Channel=All','Period=Last90'] } },
  { name: 'Inventory Tracker', file: 'Inventory_Tracker.pbip', size_kb: 11.0, parse_ok: true,
    meta: { tables: ['fact_inventory','dim_product','dim_warehouse'], pages: 2,
            visuals: ['table','gauge','kpi'],
            filters: ['Status=Active'] } },
]
