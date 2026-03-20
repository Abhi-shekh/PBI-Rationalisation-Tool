"""
PBI Report Rationalisation Tool — FastAPI Backend
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json, io, csv, zipfile, os

from analyser import run_analysis, AnalysisConfig

app = FastAPI(title="PBI Rationalisation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    reports: list[dict]
    config: dict


class CanonicalUpdate(BaseModel):
    group_id: int
    report_name: str


# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """
    Accept .pbip / .json files, parse metadata, return structured report list.
    """
    reports = []
    errors = []

    for f in files:
        content = await f.read()
        name_raw = f.filename or "unknown"
        stem = os.path.splitext(name_raw)[0]

        meta = None
        if name_raw.endswith(".json") or name_raw.endswith(".pbip"):
            try:
                meta = json.loads(content.decode("utf-8"))
            except Exception:
                pass

        reports.append({
            "name": stem,
            "file": name_raw,
            "size_kb": round(len(content) / 1024, 1),
            "meta": _normalise_meta(meta, stem),
            "parse_ok": meta is not None,
        })

    return {"reports": reports, "errors": errors, "count": len(reports)}


@app.post("/api/analyse")
def analyse(req: AnalysisRequest):
    """
    Two-pass rationalisation analysis.
    Returns groups with similarity scores, diff types, canonical suggestions.
    """
    if not req.reports:
        raise HTTPException(status_code=400, detail="No reports provided")

    config = AnalysisConfig(**req.config)
    result = run_analysis(req.reports, config)
    return result


@app.post("/api/export/csv")
def export_csv(req: AnalysisRequest):
    config = AnalysisConfig(**req.config)
    result = run_analysis(req.reports, config)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=[
        "report_name", "file", "name_group_id", "final_group_id",
        "similarity_pct", "diff_type", "is_canonical", "recommendation"
    ])
    writer.writeheader()
    for row in result["rows"]:
        writer.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pbi_rationalisation.csv"}
    )


@app.post("/api/export/json")
def export_json(req: AnalysisRequest):
    config = AnalysisConfig(**req.config)
    result = run_analysis(req.reports, config)

    content = json.dumps(result, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=pbi_rationalisation.json"}
    )


# ── Helpers ─────────────────────────────────────────────────────────────────

def _normalise_meta(raw: dict | None, name: str) -> dict | None:
    """
    Normalise PBIP JSON structure to the internal meta schema.
    Supports both real PBIP format and the simplified format used in tests.
    """
    if raw is None:
        return None

    # Already normalised (from frontend sample or simple format)
    if all(k in raw for k in ("tables", "visuals", "pages")):
        return raw

    # Real PBIP report.json format
    meta = {"tables": [], "visuals": [], "filters": [], "pages": 0}

    # Extract from sections.pages (PBIP format)
    pages = raw.get("sections") or raw.get("pages") or []
    if isinstance(pages, list):
        meta["pages"] = len(pages)
        for page in pages:
            visuals = page.get("visualContainers") or page.get("visuals") or []
            for v in visuals:
                vtype = (
                    v.get("config", {}).get("singleVisual", {}).get("visualType")
                    or v.get("type")
                    or "unknown"
                )
                meta["visuals"].append(vtype)
            # Filters
            for f in page.get("filters") or []:
                fstr = f.get("expression", {}).get("Column", {}).get("Property", "")
                if fstr:
                    meta["filters"].append(fstr)

    # Extract tables from dataTransforms / model
    model = raw.get("model") or {}
    tables = model.get("tables") or raw.get("tables") or []
    if isinstance(tables, list):
        for t in tables:
            tname = t.get("name") or (t if isinstance(t, str) else "")
            if tname and not tname.startswith("DateTableTemplate") and not tname.startswith("LocalDateTable"):
                meta["tables"].append(tname)

    return meta if any(meta.values()) else None
