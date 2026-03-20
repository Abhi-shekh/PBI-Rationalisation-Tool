"""
pbix_parser.py — Extract metadata from .pbix files for rationalisation

A .pbix file is a ZIP archive containing:
  Report/Layout        ← UTF-16-LE encoded JSON with ALL report metadata
  DataModel            ← Compressed data model (read via pbixray)

This module extracts the same metadata schema as the PBIP parser:
  { tables, visuals, filters, fields, pages }
"""

import zipfile
import json
import io
from typing import Optional

# ── Constants ────────────────────────────────────────────────────────────────

POWERBI_TYPE_CODES = {
    1: "Text", 2: "Whole Number", 3: "Date/Time",
    259: "Decimal Number", 519: "Date", 520: "Time",
    2048: "Text (Category)", 260: "Currency",
    261: "Boolean", 262: "Binary",
}

STATIC_VISUAL_TYPES = {"image", "textbox", "shape", "button", "actionbutton", "basicShape"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(text) -> str:
    """Remove invisible Unicode characters from text."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    invisible = ["\u200e", "\u200f", "\u202a", "\u202b", "\u202c",
                 "\u202d", "\u202e", "\ufeff", "\u200b", "\u200c", "\u200d"]
    for ch in invisible:
        text = text.replace(ch, "")
    return text.strip()


def _parse_json_field(raw, default=None):
    """Parse a field that may be a JSON string or already a dict/list."""
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return default
    return default


def _clean_literal(value: str) -> str:
    """
    Remove Power BI literal quotes and type suffixes.
    'New Store'  → New Store
    1000D        → 1000
    """
    if not isinstance(value, str):
        return str(value)
    # Strip surrounding single quotes
    if value.startswith("'") and value.endswith("'"):
        value = value[1:-1]
    # Strip type suffixes D/L/M from numbers
    if value and value[-1] in ("D", "L", "M"):
        base = value[:-1].replace("-", "").replace(".", "").replace(",", "")
        if base.isdigit():
            return value[:-1]
    return value


# ── Filter extraction ─────────────────────────────────────────────────────────

COMPARISON_OPS = {0: "=", 1: "<>", 2: ">", 3: ">=", 4: "<", 5: "<="}


def _parse_filter_item(f: dict) -> Optional[str]:
    """
    Parse one filter entry and return a human-readable string like:
      Store.Chain = New Store
      Item.Category IN (Clothing, Electronics)
      Sales.Amount BETWEEN 100 AND 500
    Returns None if no meaningful condition found.
    """
    filter_data = f.get("filter", {})
    where = filter_data.get("Where", [])
    if not where:
        return None

    # Get table and column
    expr = f.get("expression", {})
    col_info = expr.get("Column", {})
    entity_ref = col_info.get("Expression", {}).get("SourceRef", {})
    table = _clean(entity_ref.get("Entity", ""))
    column = _clean(col_info.get("Property", ""))
    if not column:
        return None

    label = f"{table}.{column}" if table else column
    conditions = []

    for where_item in where:
        cond = where_item.get("Condition", {})

        # Comparison (=, <>, >, >=, <, <=)
        if "Comparison" in cond:
            cmp = cond["Comparison"]
            op = COMPARISON_OPS.get(cmp.get("ComparisonKind", 0), "=")
            right = cmp.get("Right", {})
            if "Literal" in right:
                val = _clean_literal(right["Literal"].get("Value", ""))
                conditions.append(f"{op} {val}")

        # IN operator
        elif "In" in cond:
            values = cond["In"].get("Values", [])
            vals = []
            for va in values:
                if isinstance(va, list):
                    for v in va:
                        if "Literal" in v:
                            vals.append(_clean_literal(v["Literal"].get("Value", "")))
            if vals:
                conditions.append(f"IN ({', '.join(vals)})")

        # NOT IN
        elif "Not" in cond:
            inner = cond["Not"].get("Expression", {})
            if "In" in inner:
                values = inner["In"].get("Values", [])
                vals = []
                for va in values:
                    if isinstance(va, list):
                        for v in va:
                            if "Literal" in v:
                                vals.append(_clean_literal(v["Literal"].get("Value", "")))
                if vals:
                    conditions.append(f"NOT IN ({', '.join(vals)})")

        # BETWEEN
        elif "Between" in cond:
            bc = cond["Between"]
            lo = _clean_literal(bc.get("Lower", {}).get("Literal", {}).get("Value", ""))
            hi = _clean_literal(bc.get("Upper", {}).get("Literal", {}).get("Value", ""))
            if lo and hi:
                conditions.append(f"BETWEEN {lo} AND {hi}")

        # CONTAINS
        elif "Contains" in cond:
            right = cond["Contains"].get("Right", {})
            if "Literal" in right:
                val = _clean_literal(right["Literal"].get("Value", ""))
                conditions.append(f"CONTAINS {val}")

    if not conditions:
        return None

    return f"{label}: {' '.join(conditions)}"


def _extract_filters(filters_raw) -> list[str]:
    """
    Extract all filters from a filters field (JSON string or list).
    Returns list of strings like ["Store.Chain: = New Store", "Item.Category: IN (...)"]
    """
    filters = _parse_json_field(filters_raw, [])
    if not isinstance(filters, list):
        return []
    results = []
    for f in filters:
        if not isinstance(f, dict):
            continue
        label = _parse_filter_item(f)
        if label and label not in results:
            results.append(label)
    return results


# ── Layout reader ─────────────────────────────────────────────────────────────

def _read_layout(zip_ref: zipfile.ZipFile) -> Optional[dict]:
    """Read and parse Report/Layout from a PBIX ZIP. Handles UTF-16-LE encoding."""
    for name in zip_ref.namelist():
        if name == "Report/Layout":
            raw = zip_ref.read(name)
            for enc in ("utf-16-le", "utf-16", "utf-8"):
                try:
                    return json.loads(raw.decode(enc))
                except Exception:
                    continue
            # Fallback with replacement
            try:
                return json.loads(raw.decode("utf-8", errors="replace"))
            except Exception:
                return None
    return None


# ── Main PBIX parser ──────────────────────────────────────────────────────────

def parse_pbix(file_bytes: bytes, filename: str) -> dict:
    """
    Parse a .pbix file and return a normalised metadata dict:
    {
      name:     str,
      file:     str,
      size_kb:  float,
      parse_ok: bool,
      pages:    int,
      meta: {
        tables:  [str],   # table names from data model
        visuals: [str],   # visual types per page
        filters: [str],   # "Table.Column: OP Value"
        fields:  [str],   # "Table.Column" queryRefs used in visuals
        pages:   int,
        page_names: [str],
      }
    }
    """
    name = filename.replace(".pbix", "").replace(".PBIX", "").strip()
    size_kb = round(len(file_bytes) / 1024, 1)
    meta = {"tables": [], "visuals": [], "filters": [], "fields": [], "pages": 0, "page_names": []}

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
            layout = _read_layout(zf)
            if not layout:
                return {"name": name, "file": filename, "size_kb": size_kb, "parse_ok": False, "pages": None, "meta": None}

            sections = layout.get("sections", [])
            meta["pages"] = len(sections)

            # Report-level filters
            report_filters_raw = layout.get("filters", "[]")
            for f in _extract_filters(report_filters_raw):
                if f not in meta["filters"]:
                    meta["filters"].append(f)

            for section in sections:
                page_name = _clean(section.get("displayName", ""))
                if page_name:
                    meta["page_names"].append(page_name)

                # Page-level filters
                for f in _extract_filters(section.get("filters", "[]")):
                    if f not in meta["filters"]:
                        meta["filters"].append(f)

                # Visuals
                for vc in section.get("visualContainers", []):
                    config = _parse_json_field(vc.get("config", "{}"), {})
                    single_visual = config.get("singleVisual", {})

                    # Skip groups (singleVisualGroup)
                    if "singleVisualGroup" in config:
                        continue

                    vtype = _clean(single_visual.get("visualType", ""))
                    projections = single_visual.get("projections", {})
                    has_projections = projections and any(projections.values())

                    # Skip pure static elements with no data
                    if not has_projections and vtype.lower() in {v.lower() for v in STATIC_VISUAL_TYPES}:
                        continue

                    if vtype:
                        meta["visuals"].append(vtype)

                    # Fields from projections (queryRef)
                    for role_items in projections.values():
                        if isinstance(role_items, list):
                            for item in role_items:
                                qr = _clean(item.get("queryRef", ""))
                                if qr and qr not in meta["fields"]:
                                    meta["fields"].append(qr)

                    # Visual-level filters
                    for f in _extract_filters(vc.get("filters", "[]")):
                        if f not in meta["filters"]:
                            meta["filters"].append(f)

            # Tables from data model via pbixray (optional — graceful fallback)
            try:
                from pbixray.core import PBIXRay
                tmp_path = f"/tmp/_pbix_{name}.pbix"
                with open(tmp_path, "wb") as fp:
                    fp.write(file_bytes)
                model = PBIXRay(tmp_path)
                tables_df = model.tables
                if tables_df is not None and not tables_df.empty:
                    col = "Name" if "Name" in tables_df.columns else tables_df.columns[0]
                    for t in tables_df[col].dropna().tolist():
                        t = _clean(str(t))
                        if t and not t.startswith("DateTableTemplate") and not t.startswith("LocalDateTable") and not t.startswith("_"):
                            if t not in meta["tables"]:
                                meta["tables"].append(t)
                import os; os.remove(tmp_path)
            except Exception:
                # pbixray unavailable or failed — extract table names from queryRefs
                for field in meta["fields"]:
                    if "." in field:
                        table = field.split(".")[0]
                        if table and table not in meta["tables"]:
                            meta["tables"].append(table)

    except Exception as e:
        return {"name": name, "file": filename, "size_kb": size_kb, "parse_ok": False, "pages": None, "meta": None}

    parse_ok = bool(meta["pages"] or meta["visuals"] or meta["fields"])
    return {
        "name": name,
        "file": filename,
        "size_kb": size_kb,
        "parse_ok": parse_ok,
        "pages": meta["pages"] or None,
        "meta": meta if parse_ok else None,
    }