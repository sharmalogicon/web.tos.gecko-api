# Style-Catalog Audit

**Generated**: 2026-05-21T07:21:59.682Z
**Source**: `src`
**Files scanned**: 111
**Inline `style={{...}}` blocks (static-only)**: 4753
**Catalog-matchable violations**: **105**
**Files with violations**: 34

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
| `.gecko-cell-meta` | §7.4 | **55** |
| `.gecko-eyebrow` | §7.5 | **18** |
| `.gecko-cell-sub` | §7.3 | **8** |
| `.gecko-stat-num` | §7.11 | **7** |
| `.gecko-page-subtitle` | §7.8 | **4** |
| `.gecko-money` | §7.13 | **4** |
| `.gecko-truncate` | §7.16 | **2** |
| `.gecko-stat-num gecko-stat-num-22` | §13.6 | **2** |
| `.gecko-inline-row` | §8.5 | **1** |
| `.gecko-page-title` | §7.6 | **1** |
| `.gecko-page-title-lg` | §7.7 | **1** |
| `.gecko-cell-primary` | §7.2 | **1** |
| `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 | **1** |

---

## Files by violation count

### `src\app\gate\eir-in\page.tsx` — 15 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 131 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 223 | 13 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 230 | 13 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 239 | 13 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 245 | 14 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 246 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 268 | 14 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 383 | 152 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 560 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 728 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 841 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 847 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 864 | 37 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 877 | 45 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 925 | 37 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-in-v2\page.tsx` — 11 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 64 | 20 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 90 | 21 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 117 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 127 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 128 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 129 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 130 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 157 | 24 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 175 | 24 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 194 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 220 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

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

### `src\app\gate\yard-view\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 400 | 14 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 560 | 15 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 563 | 17 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 598 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 637 | 15 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 665 | 19 | `.gecko-truncate` | §7.16 — Text truncation (overflow + ellipsis + nowrap) |
| 679 | 13 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |

### `src\app\gate\eir-out\[id]\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 206 | 14 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 505 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 521 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 792 | 15 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 825 | 27 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 868 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\container-types\[iso]\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 199 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 210 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 225 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 236 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 242 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 253 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\cfs\stripping\page.tsx` — 5 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 111 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 126 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 174 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 200 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 214 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\billing\service-orders\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 37 | 44 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 58 | 16 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 98 | 21 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 109 | 24 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\cfs\stuffing\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 140 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 155 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 221 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 235 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\billing\unbilled\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 412 | 36 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 420 | 36 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 555 | 9 | `.gecko-inline-row` | §8.5 — Inline-flex row with gap 6 |

### `src\app\bookings\EGLV149602390729\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 1615 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1657 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2071 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\order-types\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 190 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 244 | 11 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 579 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\vessels\new\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 221 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 233 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 245 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\reports\schedule\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 185 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 193 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 316 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-out\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 200 | 62 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 279 | 35 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\order-types\new\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 325 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1095 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\units\unit-inquiry\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 266 | 22 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 426 | 16 | `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 — 32px primary-tinted icon container |

### `src\app\billing\statement\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 1397 | 25 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

### `src\app\bookings\new\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 112 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\bookings\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 200 | 20 | `.gecko-page-title` | §7.6 — Page-level h1 (22px / 700 / -0.02em letter-spacing) |

### `src\app\config\edi-partners\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 987 | 36 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\config\integrations\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 576 | 44 | `.gecko-truncate` | §7.16 — Text truncation (overflow + ellipsis + nowrap) |

### `src\app\config\yard-zones\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 668 | 34 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\voyage\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 235 | 30 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\container-types\new\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 281 | 13 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 95 | 17 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\ports\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 602 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\free-time\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 125 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\plans\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 30 | 40 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\rate-cards\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 131 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\units\edi-inquiry\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 257 | 51 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\components\ui\BarcodeDisplay.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 93 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\components\ui\DateField.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 223 | 11 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\components\ui\EntitySearch.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 313 | 13 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

