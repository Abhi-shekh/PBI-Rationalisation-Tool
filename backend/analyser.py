"""
PBI Rationalisation — Core Analysis Engine

Two-pass clustering:
  Pass 1: Name-based fuzzy clustering  → name_group_id
  Pass 2: Metadata agglomerative clustering within name-groups → final_group_id
"""

from __future__ import annotations
import re, math
from dataclasses import dataclass, field
from typing import Any


# ── Config ───────────────────────────────────────────────────────────────────

@dataclass
class AnalysisConfig:
    name_threshold: float = 72.0       # 0–100
    meta_threshold: float = 60.0       # 0–100
    ignore_years: bool = True
    ignore_regions: bool = True
    ignore_versions: bool = True
    ignore_case: bool = True
    algo: str = "token"                # token | edit | jaro | combined
    weight_tables: float = 0.40
    weight_visuals: float = 0.25
    weight_filters: float = 0.20
    weight_pages: float = 0.15
    check_tables: bool = True
    check_visuals: bool = True
    check_filters: bool = True
    check_pages: bool = True


# ── Text normalisation ────────────────────────────────────────────────────────

YEAR_RE    = re.compile(r'\b(19|20)\d{2}\b')
VERSION_RE = re.compile(r'\b(v\d+(\.\d+)*|version\s*\d+|final|draft|copy|old|new|backup|bkp|temp)\b', re.I)
REGION_RE  = re.compile(r'\b(emea|apac|na|latam|us|uk|eu|global|india|in|us|ca)\b', re.I)
DATE_RE    = re.compile(r'\b(q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|fy\d*|ytd|mtd|qtd)\b', re.I)
SPLIT_RE   = re.compile(r'[\s_\-\.\/\\]+')


def normalise_name(name: str, cfg: AnalysisConfig) -> str:
    s = name.lower() if cfg.ignore_case else name
    if cfg.ignore_years:    s = YEAR_RE.sub('', s)
    if cfg.ignore_versions: s = VERSION_RE.sub('', s)
    if cfg.ignore_regions:  s = REGION_RE.sub('', s)
    return SPLIT_RE.sub(' ', s).strip()


def tokenise(name: str, cfg: AnalysisConfig) -> list[str]:
    return [t for t in normalise_name(name, cfg).split(' ') if t]


# ── Similarity algorithms ─────────────────────────────────────────────────────

def cosine_sim(a: str, b: str, cfg: AnalysisConfig) -> float:
    ta, tb = tokenise(a, cfg), tokenise(b, cfg)
    if not ta or not tb:
        return 0.0
    vocab = list(set(ta + tb))
    va = [ta.count(t) for t in vocab]
    vb = [tb.count(t) for t in vocab]
    dot  = sum(x * y for x, y in zip(va, vb))
    magA = math.sqrt(sum(x * x for x in va))
    magB = math.sqrt(sum(x * x for x in vb))
    return dot / (magA * magB) if magA and magB else 0.0


def levenshtein(a: str, b: str) -> int:
    if a == b: return 0
    if not a:  return len(b)
    if not b:  return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(min(prev[j] + 1, curr[j-1] + 1, prev[j-1] + (ca != cb)))
        prev = curr
    return prev[-1]


def edit_sim(a: str, b: str, cfg: AnalysisConfig) -> float:
    na, nb = normalise_name(a, cfg), normalise_name(b, cfg)
    d = levenshtein(na, nb)
    return 1.0 - d / max(len(na), len(nb), 1)


def jaro_winkler(s1: str, s2: str) -> float:
    if s1 == s2: return 1.0
    l1, l2 = len(s1), len(s2)
    if not l1 or not l2: return 0.0
    match_d = max(l1, l2) // 2 - 1
    m1 = [False] * l1
    m2 = [False] * l2
    matches = trans = 0
    for i, c in enumerate(s1):
        lo = max(0, i - match_d)
        hi = min(i + match_d + 1, l2)
        for j in range(lo, hi):
            if m2[j] or c != s2[j]: continue
            m1[i] = m2[j] = True
            matches += 1
            break
    if matches == 0: return 0.0
    c1 = [s1[i] for i in range(l1) if m1[i]]
    c2 = [s2[j] for j in range(l2) if m2[j]]
    trans = sum(a != b for a, b in zip(c1, c2)) / 2
    jaro = (matches/l1 + matches/l2 + (matches-trans)/matches) / 3
    prefix = min(sum(1 for a, b in zip(s1[:4], s2[:4]) if a == b), 4)
    return jaro + prefix * 0.1 * (1 - jaro)


def jaro_sim(a: str, b: str, cfg: AnalysisConfig) -> float:
    return jaro_winkler(normalise_name(a, cfg), normalise_name(b, cfg))


def name_similarity(a: str, b: str, cfg: AnalysisConfig) -> float:
    if cfg.algo == "edit":
        return edit_sim(a, b, cfg)
    if cfg.algo == "jaro":
        return jaro_sim(a, b, cfg)
    if cfg.algo == "combined":
        return (cosine_sim(a, b, cfg) + edit_sim(a, b, cfg) + jaro_sim(a, b, cfg)) / 3
    return cosine_sim(a, b, cfg)  # default: token


# ── Metadata similarity ───────────────────────────────────────────────────────

def jaccard(a: list, b: list) -> float:
    if not a and not b: return 1.0
    if not a or not b:  return 0.0
    sa, sb = set(a), set(b)
    return len(sa & sb) / len(sa | sb)


def page_sim(p1: int, p2: int) -> float:
    mx = max(p1, p2, 1)
    return 1.0 - abs(p1 - p2) / mx


def meta_similarity(m1: dict | None, m2: dict | None, cfg: AnalysisConfig) -> float | None:
    if m1 is None or m2 is None:
        return None

    score, total_w = 0.0, 0.0

    if cfg.check_tables and cfg.weight_tables > 0:
        score += cfg.weight_tables * jaccard(m1.get("tables", []), m2.get("tables", []))
        total_w += cfg.weight_tables

    if cfg.check_visuals and cfg.weight_visuals > 0:
        score += cfg.weight_visuals * jaccard(m1.get("visuals", []), m2.get("visuals", []))
        total_w += cfg.weight_visuals

    if cfg.check_filters and cfg.weight_filters > 0:
        score += cfg.weight_filters * jaccard(m1.get("filters", []), m2.get("filters", []))
        total_w += cfg.weight_filters

    if cfg.check_pages and cfg.weight_pages > 0:
        p1 = m1.get("pages") or 0
        p2 = m2.get("pages") or 0
        score += cfg.weight_pages * page_sim(p1, p2)
        total_w += cfg.weight_pages

    return score / total_w if total_w else None


# ── Diff classification ───────────────────────────────────────────────────────

def classify_diff(m1: dict | None, m2: dict | None) -> str:
    if m1 is None or m2 is None:
        return "unknown"
    sim = meta_similarity(m1, m2, AnalysisConfig())
    if sim is None:  return "unknown"
    if sim >= 0.97:  return "identical"
    if sim >= 0.78:  return "minor"
    return "major"


def diff_details(m1: dict | None, m2: dict | None) -> dict:
    """Return a structured diff between two metadata objects."""
    if not m1 or not m2:
        return {}
    v1, v2 = m1.get("visuals", []), m2.get("visuals", [])
    f1, f2 = m1.get("filters", []), m2.get("filters", [])
    t1, t2 = m1.get("tables", []), m2.get("tables", [])
    s1, s2 = set(v1), set(v2)
    sf1, sf2 = set(f1), set(f2)
    st1, st2 = set(t1), set(t2)
    return {
        "visuals_added":    sorted(s2 - s1),
        "visuals_removed":  sorted(s1 - s2),
        "visuals_common":   sorted(s1 & s2),
        "filters_added":    sorted(sf2 - sf1),
        "filters_removed":  sorted(sf1 - sf2),
        "filters_common":   sorted(sf1 & sf2),
        "tables_added":     sorted(st2 - st1),
        "tables_removed":   sorted(st1 - st2),
        "tables_common":    sorted(st1 & st2),
        "pages_delta":      (m2.get("pages") or 0) - (m1.get("pages") or 0),
    }


# ── Union-Find ────────────────────────────────────────────────────────────────

class UF:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, x, y):
        self.p[self.find(x)] = self.find(y)

    def same(self, x, y):
        return self.find(x) == self.find(y)


# ── Main analysis entry point ─────────────────────────────────────────────────

def run_analysis(reports: list[dict], cfg: AnalysisConfig) -> dict:
    n = len(reports)

    # ── Pass 1: name-based clustering ────────────────────────────────────────
    uf1 = UF(n)
    for i in range(n):
        for j in range(i + 1, n):
            sim = name_similarity(reports[i]["name"], reports[j]["name"], cfg)
            if sim * 100 >= cfg.name_threshold:
                uf1.union(i, j)

    # Assign name_group_id (sequential, sorted by first appearance)
    root_to_ngid: dict[int, int] = {}
    name_group_ids = []
    for i in range(n):
        root = uf1.find(i)
        if root not in root_to_ngid:
            root_to_ngid[root] = len(root_to_ngid)
        name_group_ids.append(root_to_ngid[root])

    # ── Pass 2: metadata clustering within name-groups ────────────────────────
    uf2 = UF(n)
    for g in set(name_group_ids):
        members = [i for i, gid in enumerate(name_group_ids) if gid == g]
        for mi in range(len(members)):
            for mj in range(mi + 1, len(members)):
                a, b = members[mi], members[mj]
                sim = meta_similarity(reports[a].get("meta"), reports[b].get("meta"), cfg)
                # If no metadata → keep name-grouping (stay unioned)
                # If metadata available → only union if above threshold
                if sim is None or sim * 100 >= cfg.meta_threshold:
                    uf2.union(a, b)

    root_to_fgid: dict[int, int] = {}
    final_group_ids = []
    for i in range(n):
        root = uf2.find(i)
        if root not in root_to_fgid:
            root_to_fgid[root] = len(root_to_fgid)
        final_group_ids.append(root_to_fgid[root])

    # ── Build annotated report list ───────────────────────────────────────────
    annotated = []
    for i, r in enumerate(reports):
        annotated.append({
            **r,
            "name_group_id": name_group_ids[i],
            "final_group_id": final_group_ids[i],
        })

    # ── Build groups ──────────────────────────────────────────────────────────
    group_map: dict[int, list] = {}
    for r in annotated:
        gid = r["final_group_id"]
        group_map.setdefault(gid, []).append(r)

    groups = []
    for gid, members in group_map.items():
        # Pick canonical: highest (pages * 3 + len(visuals)) score
        def score(r):
            m = r.get("meta") or {}
            return (m.get("pages") or 0) * 3 + len(m.get("visuals") or [])
        canonical = max(members, key=score)

        enriched = []
        for r in members:
            msim = meta_similarity(r.get("meta"), canonical.get("meta"), cfg)
            nsim = name_similarity(r["name"], canonical["name"], cfg)
            final_sim = (
                (0.3 * nsim + 0.7 * msim) if msim is not None
                else nsim
            )
            is_canon = r["name"] == canonical["name"]
            diff_type = "identical" if is_canon else classify_diff(canonical.get("meta"), r.get("meta"))
            diff = diff_details(canonical.get("meta"), r.get("meta")) if not is_canon else {}

            enriched.append({
                **r,
                "sim_score": round(final_sim * 100),
                "diff_type": diff_type,
                "is_canonical": is_canon,
                "diff": diff,
            })

        enriched.sort(key=lambda x: (-x["sim_score"], x["name"]))

        groups.append({
            "id": gid,
            "canonical": canonical["name"],
            "size": len(members),
            "members": enriched,
        })

    groups.sort(key=lambda g: (-g["size"], g["id"]))

    # ── Flat rows for export ──────────────────────────────────────────────────
    rows = []
    for g in groups:
        for r in g["members"]:
            rows.append({
                "report_name":    r["name"],
                "file":           r.get("file", ""),
                "name_group_id":  r["name_group_id"],
                "final_group_id": r["final_group_id"],
                "similarity_pct": r["sim_score"],
                "diff_type":      r["diff_type"],
                "is_canonical":   r["is_canonical"],
                "recommendation": (
                    "Keep (canonical)" if r["is_canonical"]
                    else "Keep (unique)" if g["size"] == 1
                    else "Review for retirement"
                ),
            })

    # ── Stats ─────────────────────────────────────────────────────────────────
    total = len(reports)
    unique_groups = len(groups)
    groups_with_dups = sum(1 for g in groups if g["size"] > 1)
    rationalisation_candidates = sum(g["size"] - 1 for g in groups if g["size"] > 1)

    return {
        "groups": groups,
        "rows": rows,
        "stats": {
            "total_reports":              total,
            "unique_groups":              unique_groups,
            "groups_with_duplicates":     groups_with_dups,
            "rationalisation_candidates": rationalisation_candidates,
            "saving_pct": round(rationalisation_candidates / total * 100) if total else 0,
        },
    }
