# PBI Report Rationalisation Tool

Detect near-duplicate Power BI reports and group them using a two-pass
clustering engine. Upload `.pbip` / `report.json` files, configure thresholds,
and get actionable groups with similarity scores and diff views.

---

## Architecture

```
pbi-tool/
├── backend/
│   ├── main.py          # FastAPI routes (upload, analyse, export)
│   ├── analyser.py      # Two-pass clustering engine (pure Python, no ML deps)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Root + navigation
│   │   ├── hooks/useAnalysis.js     # All state + API calls + fallback engine
│   │   ├── pages/
│   │   │   ├── UploadPage.jsx       # File drop + config
│   │   │   ├── ResultsPage.jsx      # Groups, diff viewer, export
│   │   │   └── OtherPages.jsx       # Settings + How it works
│   │   ├── components/UI.jsx        # Shared design system components
│   │   ├── utils/api.js             # Axios helpers + sample data
│   │   └── styles/global.css        # Design tokens + animations
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# From the pbi-tool/ directory
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### Option B — Manual

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:3000
# Proxies /api/* to http://localhost:8000
```

---

## How it works

### Pass 1 — Name-based clustering
Tokenises report names (stripping years, version markers, regions per config)
and computes cosine similarity. Reports above the **name threshold** share a
`name_group_id`.

### Pass 2 — Metadata agglomerative clustering
Within each name-group, metadata vectors are compared using union-find:

| Dimension | Metric | Default weight |
|---|---|---|
| Tables / data sources | Jaccard | 40% |
| Visuals per page | Jaccard | 25% |
| Filters applied | Jaccard | 20% |
| Page count | Normalised delta | 15% |

Reports above the **metadata threshold** share a `final_group_id`. Those below
get their own group even if name-similar.

### Diff classification
- **Identical** — combined similarity ≥ 97%
- **Minor diff** — ≥ 78% (extra visual, extra filter)
- **Major diff** — < 78% (extra page, different table set)

---

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload files, returns parsed report list |
| POST | `/api/analyse` | Run two-pass analysis |
| POST | `/api/export/csv` | Download CSV |
| POST | `/api/export/json` | Download JSON |
| GET  | `/health` | Health check |

### Example: POST /api/analyse
```json
{
  "reports": [
    {
      "name": "Sales Report 2024",
      "file": "SalesReport2024.pbip",
      "meta": {
        "tables": ["fact_sales", "dim_date"],
        "visuals": ["bar_chart", "kpi"],
        "filters": ["Date=YTD"],
        "pages": 3
      }
    }
  ],
  "config": {
    "name_threshold": 72,
    "meta_threshold": 60,
    "ignore_years": true,
    "algo": "token"
  }
}
```

---

## PBIP JSON support

The backend accepts two JSON formats:

**Simplified** (frontend sample format)
```json
{ "tables": [...], "visuals": [...], "filters": [...], "pages": 3 }
```

**Real PBIP `report.json`** — the normaliser extracts:
- `sections[].visualContainers[].config.singleVisual.visualType`
- `sections[].filters[].expression.Column.Property`
- `model.tables[].name` (skips DateTableTemplate / LocalDateTable)

---

## Configuration options

| Option | Default | Description |
|---|---|---|
| `name_threshold` | 72 | Min name similarity % for same name-group |
| `meta_threshold` | 60 | Min metadata similarity % for same final-group |
| `algo` | token | token / edit / jaro / combined |
| `ignore_years` | true | Strip 2024, 2025… before comparison |
| `ignore_versions` | true | Strip v2, final, draft… |
| `ignore_regions` | true | Strip EMEA, NA, APAC… |
| `check_tables` | true | Include table Jaccard in metadata score |
| `check_visuals` | true | Include visual Jaccard in metadata score |
| `check_filters` | true | Include filter Jaccard |
| `check_pages` | true | Include page count delta |
