# Style-Catalog Audit

**Generated**: 2026-05-21T07:40:14.497Z
**Source**: `src`
**Files scanned**: 111
**Inline `style={{...}}` blocks (static-only)**: 4726
**Catalog-matchable violations**: **40**
**Files with violations**: 19

---

## What this report shows

Each row below is an inline `style={{...}}` block whose key/value set
matches a known catalog signature in `scripts/style-catalog/signatures.ts`.
These are **mechanical** mappings — the inline can be replaced with the
listed catalog class without judgment.

Inline styles that do NOT appear here are either:
  1. Dynamic (variables, conditionals, computed values) — should stay inline
  2. A new pattern not yet in the signature map — add to §14 if recurring
  3. A single-property override that no catalog class wraps

---

## Summary by catalog class

| Class | Catalog ref | Occurrences |
|---|---|---:|
| `.gecko-cell-meta` | §7.4 | **21** |
| `.gecko-stat-num` | §7.11 | **7** |
| `.gecko-eyebrow` | §7.5 | **5** |
| `.gecko-cell-sub` | §7.3 | **4** |
| `.gecko-page-title-lg` | §7.7 | **1** |
| `.gecko-stat-num gecko-stat-num-22` | §13.6 | **1** |
| `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 | **1** |

---

## Files by violation count

### `src\app\gate\kiosk\page.tsx` — 9 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 302 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 308 | 16 | `.gecko-page-title-lg` | §7.7 — Dashboard-level h1 (26px / 700) |
| 371 | 16 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 391 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 502 | 16 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 514 | 20 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 555 | 20 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 558 | 20 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 639 | 12 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

### `src\app\masters\container-types\[iso]\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 199 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 210 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 225 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 236 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 242 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 253 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\bookings\EGLV149602390729\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 1615 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1657 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2071 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-in\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 131 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 245 | 14 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 560 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\vessels\new\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 221 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 233 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 245 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-in-v2\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 64 | 20 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 90 | 21 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

### `src\app\gate\eir-out\[id]\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 206 | 14 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 505 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\billing\statement\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 1397 | 25 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

### `src\app\bookings\new\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 112 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\edi-partners\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 987 | 36 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\config\yard-zones\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 668 | 34 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\container-types\new\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 281 | 13 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\order-types\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 190 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 95 | 17 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\tariff\free-time\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 125 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\rate-cards\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 131 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\units\unit-inquiry\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 426 | 16 | `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 — 32px primary-tinted icon container |

### `src\components\ui\BarcodeDisplay.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 93 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\components\ui\EntitySearch.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 313 | 13 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

