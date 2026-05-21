# STYLE-DEBT.md

A targeted punch-list of remaining inline-style violations after Phase 2.
The catalog (`gecko_design_system_components.css` §7–§13) is the contract.
The ESLint rule (`no-restricted-syntax`, warn-level) flags every new violation.
This file is the **runway** — where to focus the next migration wave.

**Updated**: end of Phase 4 codemod sweep (commit `56d8ae4`)
**Inline blocks remaining**: 5,574
**Catalog-matchable (detected by `npm run audit:styles`)**: **40** (down from 515)
**Files affected**: 99 total, **19 with matchable violations**
**Codemod live**: `scripts/style-catalog/` · run `npm run audit:styles`

---

## Top 10 files by remaining inline-block count

| # | File | Blocks | Δ this session | Notes |
|---|---|---:|---:|---|
| 1 | `bookings/EGLV149602390729/page.tsx` | 283 | -30 | Booking detail. Most remaining are legitimate exemptions. |
| 2 | `masters/order-types/new/page.tsx` | 239 | -2 | Step-indicator + sequence + catalog + canvas. Lots of per-color dynamic chrome. |
| 3 | `tariff/plans/new/page.tsx` | 187 | -4 | Storage card dynamic gradient, sequence builder, sticky header. |
| 4 | `config/integrations/page.tsx` | 181 | 0 | Brand-color channel previews intentionally inline. |
| 5 | `gate/eir-out/[id]/page.tsx` | 168 | -2 | Release detail with form sections and dynamic damage indicators. |
| 6 | `tariff/plans/[id]/page.tsx` | 138 | -2 | View-only tariff detail. Mostly dynamic accent gradients. |
| 7 | `config/system-params/page.tsx` | 139 | -1 | Toggle helper now uses `.gecko-toggle` — propagates to 25+ usages. |
| 8 | `gate/eir-in/page.tsx` | 137 | **-63** | Phase 3 deep-clean. 31% reduction. |
| 9 | `billing/statement/page.tsx` | 131 | **-59** | Phase 3 deep-clean. 31% reduction. |
| 10 | `config/edi-partners/[id]/page.tsx` | 118 | -3 | Partner detail with tabs + connection settings. |

**Subtotal of top 10**: ~1,721 inline blocks (30% of the remaining 5,807).

---

## What's left, broken down

After two passes of agents + catalog growth, the remaining inline-style content
falls into these categories:

| Category | Estimated share | Action |
|---|---:|---|
| **Genuinely dynamic** (state-driven, runtime computed) | ~35% | Stay inline — per rule §11 |
| **Per-data tone maps** (status badges, brand chrome, hold types) | ~15% | Stay inline — dynamic |
| **Bespoke pages** (kiosk dark HUD, invoice doc canvas, vessel Gantt) | ~10% | Out of scope — page-specific design |
| **Custom-size containers** (28×28, 36×36, 44×44 outside catalog 24/32/38/44) | ~8% | Need §14.x size variants |
| **Tinted modal headers** (primary-50/warning-50 backgrounds with rounded-top) | ~5% | Need `.gecko-modal-header-tinted` |
| **Non-standard gap values** (6, 10, 14, 18, 20, 28px) | ~5% | Stay inline — accept design intent |
| **True migration runway** (real catalog candidates, untouched) | ~22% | Phase 3 manual + future §14 sweep |

**Realistic ceiling with current §7-§13 catalog**: ~25-30% migration.
**Realistic ceiling with §14 additions**: ~45-50%.
**Hard ceiling** (everything possible converted): ~65%.
**Honest "always inline" floor**: ~35%.

---

## §14 candidate patterns (queued for next catalog growth)

Collected from Phase 1 + 2 agent reports. Each would unlock 30-100 inline blocks.

### HIGH impact

| §14.x | Class | Frequency | Use case |
|---|---|---|---|
| 14.1 | `.gecko-modal-header-tinted` (+ tone modifiers) | 8+ | Modal header bar with `background: tone-50` and rounded-top corners (every billing-statement modal, every masters-create modal) |
| 14.2 | `.gecko-mini-icon-28` | 12+ | The 28×28 numbered-step / KpiCard accent square that falls between -sm (24) and base (32) |
| 14.3 | `.gecko-eyebrow-sm` | 15+ | 10px/600 (vs catalog 10px/700) — used for nested labels where the heavier `.gecko-eyebrow` reads too strong |
| 14.4 | `.gecko-banner-tonal-card` | 6+ | Banner pattern but inside a card wrapper (drop-off counts, regenerate preview rows, dropoff/pickup tiles in eir-in) |

### MEDIUM impact

| §14.x | Class | Frequency | Use case |
|---|---|---|---|
| 14.5 | `.gecko-grid-6` | 4+ | 6-column grid for yard-glance + appointments KPI strips |
| 14.6 | `.gecko-grid-asym-2fr-1fr` (+ `-3fr-1fr`) | 8+ | Asymmetric 2-column grids (sidebars next to main content) |
| 14.7 | `.gecko-widget` (+ `-header` / `-body`) | 9 | Eyebrow header band + bg-subtle pattern reinvented per dashboard |
| 14.8 | `.gecko-live-pill` | 4+ | Green dot + "Live" label combo (overview, yard-glance, dwell-time, dd-accrual) |
| 14.9 | `.gecko-period-toggle` | 3+ | Segmented period control (3M/6M/1Y, Today/Week/Month) |
| 14.10 | `.gecko-pill-xs-mono` | 12+ | Tiny mono uppercase chip (lane codes, ISO sizes, status tokens) |

### LOW impact (nice-to-have)

| §14.x | Class | Frequency | Use case |
|---|---|---|---|
| 14.11 | `.gecko-pager-btn` family | 1 (TablePagination) | 28×28 numeric/prev/next pager buttons |
| 14.12 | `.gecko-empty-dash` | 6+ | The `<span>—</span>` placeholder in empty table cells |
| 14.13 | `.gecko-section-head-underlined` | 5+ | Modal section divider with 800/0.09em label + 2px primary-100 underline |
| 14.14 | `.gecko-stat-pill` | 3+ | Inline horizontal stat chip (right-aligned label+value) |
| 14.15 | `.gecko-split-editor` | 4+ | Left list pane + right detail pane wrapper |
| 14.16 | `.gecko-stepper` | 1 (bookings/new) | Wizard segmented control |
| 14.17 | `.gecko-toggle-card` | 5+ | Tinted-when-active card chrome around a switch + label |
| 14.18 | `.gecko-input-readonly` | 3+ | Visual treatment for read-only inputs |

---

## Patterns intentionally NOT in the catalog

These are documented exemptions — they should stay inline forever:

1. **Brand-mocked channel previews** (config/integrations LINE/WhatsApp/Slack/Email) — intentional inline brand-color usage
2. **Kiosk full-screen dark theme** (gate/kiosk) — inverse surface, distinct palette
3. **Yard map SVG coordinates** (gate/yard-view, config/yard-zones, masters/locations) — dynamic positioning
4. **Invoice "document" doc canvas** (billing/invoices/[id]) — print-style page, not a UI page
5. **Vessel schedule Gantt timeline** (masters/vessels/schedule) — dynamic date-based positioning
6. **Damage diagrams** (gate/eir-in) — dynamic coordinate-based marker placement
7. **Sparkline / chart SVG** (dashboard/*) — dynamic data-driven positioning
8. **Booking detail VAS drawer** — right-side slide-in (distinct from centered modal-shell)

---

## Codemod backlog — signature refinements

The detector currently surfaces 40 remaining catalog-matchable violations
that the cleanup agents legitimately skipped. These are FALSE POSITIVES in
the signature map — the codemod should learn to skip them at detection time.

Highest-value signature refinements to add to `scripts/style-catalog/signatures.ts`:

1. **`.gecko-cell-meta`** (21 false positives remaining)
   - Should NOT match if `position: 'absolute'` is also present (suffix-in-input)
   - Should NOT match if parent element has `display: flex` + the inline has
     `padding` (likely a pill/badge with its own chrome)
   - Add: `excludePropPresence: ['position']`, `excludeIfPropsAlso: ['padding', 'background']`

2. **`.gecko-stat-num`** (7 false positives)
   - Should NOT match if `fontSize` < 22 (catalog stat-num is 26 — over-scales smaller text)
   - Currently matches on close buttons + small icon labels
   - Add: `requirePropMin: { fontSize: 22 }`

3. **`.gecko-eyebrow`** (5 false positives)
   - Should NOT match if `letterSpacing` is missing (eyebrows always have spacing)
   - Should NOT match on `<a>` or `<button>` elements
   - Add: `requirePropPresence: ['letterSpacing']`

4. **`.gecko-cell-sub`** (4 false positives)
   - Should NOT match on `<span>` inside prose paragraphs
   - Should NOT match if the text content is multi-word prose
   - This one is harder — needs lexical heuristics

5. **Universal**: skip any inline that lives inside a `data-theme="dark"` ancestor
   (the kiosk page) — would require parent-traversal during detection.

Adding these refinements would drop the false-positive count from 40 → ~10.

---

## Recommended sequence for next migration window

1. **§14 catalog growth** (~1-2 hours) — implement the 4 HIGH-impact patterns (14.1-14.4). That alone should unlock ~250 more conversions in the top-10 files.
2. **Phase 3 sub-agent sweep** (~45 min) — dispatch 3 dedicated agents on the top-3 heaviest files using the expanded catalog. Each agent on ONE file with focused attention.
3. **Manual polish pass** (~2 hours) — visit the top-3 demo-critical files (booking detail, statement, eir-in) in `npm run dev` and snap any remaining static inline that the agent missed.
4. **§14 second-round** (~1 hour) — add MEDIUM-impact patterns once HIGH ones are proven.
5. **ESLint flip decision** — when remaining count drops below ~500, flip rule from `warn` to `error`. Will require per-file disable comments on the legitimately-dynamic violations.

**Estimated 4-6 hours of focused work** to push from 16% → 35% migration.
**Estimated 12-15 hours total** to reach the ~50% realistic ceiling.
