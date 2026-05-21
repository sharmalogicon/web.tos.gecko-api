# Style-Catalog Audit

**Generated**: 2026-05-21T06:41:32.497Z
**Source**: `src`
**Files scanned**: 111
**Inline `style={{...}}` blocks (static-only)**: 4950
**Catalog-matchable violations**: **515**
**Files with violations**: 76

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
| `.gecko-cell-meta` | §7.4 | **263** |
| `.gecko-eyebrow` | §7.5 | **85** |
| `.gecko-page-subtitle` | §7.8 | **56** |
| `.gecko-cell-sub` | §7.3 | **31** |
| `.gecko-money` | §7.13 | **19** |
| `.gecko-stat-num gecko-stat-num-22` | §13.6 | **10** |
| `.gecko-flex-1` | §8.4 | **9** |
| `.gecko-stat-num` | §7.11 | **7** |
| `.gecko-row` | §8.2 | **7** |
| `.gecko-cell-primary` | §7.2 | **6** |
| `.gecko-row gecko-row-between` | §8.2 | **4** |
| `.gecko-inline-row` | §8.5 | **3** |
| `.gecko-page-title` | §7.6 | **2** |
| `.gecko-stack` | §8.1 | **2** |
| `.gecko-stack gecko-stack-sm` | §8.1 | **2** |
| `.gecko-page-title-lg` | §7.7 | **2** |
| `.gecko-truncate` | §7.16 | **2** |
| `.gecko-card-title` | §7.9 | **1** |
| `.gecko-stack gecko-stack-lg` | §8.1 | **1** |
| `.gecko-stack gecko-stack-xl` | §8.1 | **1** |
| `.gecko-helper-text` | §7.17 | **1** |
| `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 | **1** |

---

## Files by violation count

### `src\app\config\system-params\page.tsx` — 32 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 89 | 23 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 364 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 474 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 476 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 486 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 498 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 580 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 586 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 592 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 598 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 617 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 681 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 687 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 693 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 703 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 709 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 715 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 725 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 812 | 31 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 924 | 16 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 938 | 16 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 954 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 966 | 31 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 979 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 986 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1023 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1040 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1059 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1078 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1155 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1205 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1212 | 14 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |

### `src\app\tariff\plans\new\page.tsx` — 29 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 258 | 13 | `.gecko-inline-row` | §8.5 — Inline-flex row with gap 6 |
| 729 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 861 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1009 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1069 | 21 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 1078 | 19 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 1087 | 21 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 1089 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1175 | 19 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 1177 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1178 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1230 | 19 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 1232 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1273 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1274 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1275 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1276 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1305 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1306 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1307 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1308 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1768 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1802 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1919 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1933 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1954 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1977 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2270 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2304 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-out\[id]\page.tsx` — 23 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 115 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 198 | 13 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 206 | 14 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 207 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 239 | 15 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 269 | 17 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 284 | 17 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 505 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 521 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 524 | 19 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 525 | 19 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 529 | 38 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 558 | 43 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 589 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 651 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 749 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 762 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 769 | 65 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 779 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 787 | 16 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 792 | 15 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 825 | 27 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 868 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\bookings\EGLV149602390729\page.tsx` — 18 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 704 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 711 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 712 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 740 | 34 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 945 | 13 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1108 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1185 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1580 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1615 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1618 | 27 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 1657 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1755 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1814 | 41 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 2024 | 41 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 2071 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2080 | 55 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 2183 | 21 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 2184 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\order-types\new\page.tsx` — 18 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 325 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 483 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 503 | 26 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 521 | 42 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 644 | 28 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 754 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 803 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 833 | 28 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 835 | 30 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 854 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 879 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 989 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1015 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1041 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1067 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1093 | 15 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 1095 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1183 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\plans\[id]\page.tsx` — 18 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 134 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 138 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 356 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 358 | 22 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 418 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 545 | 20 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 554 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 570 | 15 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 584 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 609 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 610 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 611 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 612 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 640 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 641 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 642 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 804 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 829 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\gate-slots\page.tsx` — 17 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 159 | 13 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 363 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 372 | 29 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 392 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 441 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 468 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 476 | 28 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 491 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 524 | 34 | `.gecko-row gecko-row-between` | §8.2 — Row with justify-between |
| 541 | 38 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 570 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 622 | 30 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 625 | 30 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 642 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 651 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 664 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 673 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\gate-traffic\page.tsx` — 15 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 145 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 146 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 147 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 148 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 161 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 162 | 23 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 173 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 189 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 196 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 199 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 205 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 214 | 16 | `.gecko-stack gecko-stack-sm` | §8.1 — Vertical flex stack with sm gap (8px) |
| 223 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 227 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 230 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

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

### `src\app\masters\container-types\[iso]\page.tsx` — 13 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 199 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 210 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 225 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 236 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 242 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 253 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 342 | 14 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 371 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 372 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 396 | 14 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 427 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 463 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 491 | 14 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\config\integrations\page.tsx` — 11 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 434 | 107 | `.gecko-inline-row` | §8.5 — Inline-flex row with gap 6 |
| 576 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 793 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 826 | 29 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 841 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 842 | 24 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 963 | 12 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1034 | 14 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 1089 | 14 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 1143 | 14 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 1242 | 13 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |

### `src\app\dashboard\customs\page.tsx` — 11 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 130 | 25 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 133 | 22 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 137 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 162 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 193 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 205 | 31 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 207 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 209 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 232 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 233 | 24 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 238 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

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

### `src\app\masters\order-types\page.tsx` — 10 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 190 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 244 | 11 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 308 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 341 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 362 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 397 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 508 | 24 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 548 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 572 | 21 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 579 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\components\ui\BarcodeDisplay.tsx` — 10 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 34 | 14 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 61 | 14 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 64 | 14 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 91 | 26 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 93 | 16 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 138 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 161 | 16 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 171 | 24 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 182 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 284 | 14 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

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

### `src\app\masters\vessels\schedule\[id]\page.tsx` — 9 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 118 | 14 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 120 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 357 | 31 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 360 | 30 | `.gecko-truncate` | §7.16 — Text truncation (overflow + ellipsis + nowrap) |
| 458 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 464 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 472 | 22 | `.gecko-helper-text` | §7.17 — Form helper hint (11 / text-disabled / marginTop 4) |
| 498 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 501 | 24 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\bookings\new\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 94 | 16 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 112 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 126 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 140 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 146 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 161 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 180 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 228 | 16 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\config\edi-partners\[id]\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 608 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 667 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 904 | 28 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 916 | 67 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1037 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1079 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1098 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 1100 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\gate-hours\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 188 | 17 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 331 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 383 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 390 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 397 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 402 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 604 | 32 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 663 | 33 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\dashboard\dd-accrual\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 127 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 159 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 172 | 31 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 190 | 16 | `.gecko-stack gecko-stack-lg` | §8.1 — Vertical flex stack with lg gap (16px) |
| 194 | 25 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 200 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 207 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 208 | 20 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |

### `src\app\dashboard\yard-glance\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 490 | 69 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 527 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 549 | 27 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 551 | 61 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 605 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 609 | 27 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 624 | 33 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 666 | 12 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\charge-codes\[code]\page.tsx` — 8 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 520 | 18 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 546 | 21 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 547 | 21 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 577 | 21 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 598 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 723 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 740 | 20 | `.gecko-cell-primary` | §7.2 — Cell primary value (12 / 600 / text-primary) |
| 741 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\edi-partners\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 559 | 44 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 570 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 694 | 38 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 900 | 35 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 913 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 936 | 35 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 989 | 36 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\config\users\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 241 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 387 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 451 | 21 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 556 | 43 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 621 | 19 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 775 | 18 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 825 | 54 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\billing-health\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 145 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 179 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 192 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 195 | 31 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 243 | 16 | `.gecko-stack` | §8.1 — Vertical flex stack (default gap 12) |
| 249 | 23 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 250 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\kpi\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 193 | 38 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 205 | 31 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 216 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 233 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 257 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 274 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 314 | 53 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

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

### `src\app\masters\vessels\schedule\new\page.tsx` — 7 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 117 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 354 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 406 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 422 | 20 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 455 | 20 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 508 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 529 | 14 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |

### `src\app\bookings\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 88 | 12 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 200 | 20 | `.gecko-page-title` | §7.6 — Page-level h1 (22px / 700 / -0.02em letter-spacing) |
| 250 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 273 | 58 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 381 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 401 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\roles\[id]\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 475 | 19 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 485 | 19 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 776 | 27 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1013 | 47 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 1041 | 19 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 1150 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\accounts\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 145 | 16 | `.gecko-stack` | §8.1 — Vertical flex stack (default gap 12) |
| 152 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 179 | 25 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 180 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 198 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 244 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\cfs-ops\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 75 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 109 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 131 | 31 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 149 | 26 | `.gecko-row` | §8.2 — Horizontal flex row (default gap 8 / items-center) |
| 152 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 197 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

### `src\app\dashboard\dwell-time\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 170 | 53 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 196 | 40 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 209 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 221 | 31 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 223 | 27 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 296 | 29 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\voyage\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 160 | 28 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 170 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 177 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 227 | 24 | `.gecko-flex-1` | §8.4 — Flex grow + min-width 0 |
| 231 | 30 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 235 | 30 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\locations\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 540 | 38 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 552 | 22 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 591 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 599 | 20 | `.gecko-stack gecko-stack-sm` | §8.1 — Vertical flex stack with sm gap (8px) |
| 603 | 34 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 610 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\vessels\new\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 10 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 102 | 15 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 103 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 221 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 233 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 245 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\vessels\schedule\page.tsx` — 6 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 136 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 140 | 18 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 157 | 16 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 416 | 26 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 485 | 20 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 486 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\cfs\stripping\page.tsx` — 5 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 111 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 126 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 174 | 22 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 200 | 23 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 214 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\container-types\new\page.tsx` — 5 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 281 | 13 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 314 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 508 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 530 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 547 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

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

### `src\app\config\auto-gate\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 420 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 603 | 17 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 623 | 51 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 671 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\edi\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 137 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 138 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 158 | 29 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 177 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

### `src\app\dashboard\overview\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 35 | 29 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 139 | 32 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 234 | 26 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 301 | 23 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\dashboard\special-cargo\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 109 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 132 | 29 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 151 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 191 | 33 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |

### `src\app\masters\charge-codes\new\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 460 | 10 | `.gecko-stack gecko-stack-xl` | §8.1 — Vertical flex stack with xl gap (24px) |
| 478 | 20 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 515 | 13 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 533 | 12 | `.gecko-row gecko-row-between` | §8.2 — Row with justify-between |

### `src\app\masters\lookups\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 392 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 521 | 56 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 633 | 29 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 676 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 25 | 16 | `.gecko-page-title` | §7.6 — Page-level h1 (22px / 700 / -0.02em letter-spacing) |
| 95 | 17 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |
| 104 | 19 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 149 | 26 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\vessels\[imo]\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 273 | 49 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 296 | 18 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 511 | 25 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 512 | 25 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\tariff\free-time\page.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 79 | 22 | `.gecko-row gecko-row-between` | §8.2 — Row with justify-between |
| 80 | 24 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 101 | 102 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 125 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\components\print\GatePrint.tsx` — 4 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 163 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 239 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 270 | 12 | `.gecko-row gecko-row-between` | §8.2 — Row with justify-between |
| 278 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\billing\unbilled\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 412 | 36 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 420 | 36 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 555 | 9 | `.gecko-inline-row` | §8.5 — Inline-flex row with gap 6 |

### `src\app\config\roles\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 309 | 19 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 444 | 28 | `.gecko-card-title` | §7.9 — Card heading (14 / 600 / text-primary) |
| 544 | 30 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\charge-codes\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 266 | 21 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 267 | 21 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 271 | 51 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\masters\countries\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 528 | 57 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 535 | 55 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 554 | 59 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\masters\ports\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 207 | 38 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 602 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 701 | 59 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\reports\schedule\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 185 | 33 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 193 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 316 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\rate-cards\page.tsx` — 3 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 91 | 22 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |
| 113 | 97 | `.gecko-money` | §7.13 — Currency cell (right / mono / 700+) |
| 131 | 24 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\config\yard-zones\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 634 | 14 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 668 | 34 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\gate\eir-out\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 200 | 62 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 279 | 35 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\app\masters\lines\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 180 | 53 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |
| 459 | 49 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\units\unit-inquiry\page.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 266 | 22 | `.gecko-stat-num gecko-stat-num-22` | §13.6 — Stat number sidebar variant (22 / 700) |
| 426 | 16 | `.gecko-mini-icon gecko-mini-icon-primary` | §9.2 — 32px primary-tinted icon container |

### `src\components\billing\SendToInvoice.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 83 | 12 | `.gecko-eyebrow` | §7.5 — Eyebrow (uppercase small-caps section label) |
| 108 | 14 | `.gecko-cell-sub` | §7.3 — Cell sub-line (order#, code, voyage — mono small grey) |

### `src\components\ui\EntitySearch.tsx` — 2 matches

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 313 | 13 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |
| 395 | 18 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\billing\credit-notes\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 53 | 16 | `.gecko-page-subtitle` | §7.8 — Page descriptive subtitle (13 secondary) |

### `src\app\billing\statement\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 1397 | 25 | `.gecko-stat-num` | §7.11 — KPI/stat number (26 / 700 / line-1 / mono) |

### `src\app\config\approval-workflows\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 180 | 22 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\login\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 105 | 20 | `.gecko-page-title-lg` | §7.7 — Dashboard-level h1 (26px / 700) |

### `src\app\masters\container-types\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 154 | 25 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\customers\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 265 | 20 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\holds\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 506 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\masters\vessels\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 114 | 21 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\tariff\plans\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 30 | 40 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\app\units\edi-inquiry\page.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 257 | 51 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

### `src\components\ui\DateField.tsx` — 1 match

| Line | Col | Suggested class | Matched signature |
|---:|---:|---|---|
| 223 | 11 | `.gecko-cell-meta` | §7.4 — Cell meta sub-line (non-mono — date hint, order type, etc.) |

