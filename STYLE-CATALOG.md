# Gecko Style Catalog

**Status**: DRAFT v1.0 · awaiting Sharma's review before §7 + §8 + §9 are
implemented in `src/app/gecko_design_system_components.css`.

**Purpose**: This is the **frozen contract** for visual primitives used
across every Gecko product:

  • `web.tos.gecko-api`         (terminal staff TOS)
  • `web.mnr.gecko-api`         (M&R workshop)
  • `web.trucking.gecko-api`    (trucking ops)
  • `my.gecko-api.com`          (customer + haulier portal)
  • Future Gecko products

All five apps `@import` the same six `gecko_design_system_*.css` files. The
classes documented below are the **only** styling primitives any Gecko app
should use for these patterns. Once committed to `gecko_design_system_components.css`,
class names **never change**. New patterns are added (numbered §7.x or §8.x);
old patterns are deprecated with a comment but not renamed.

---

## Contract rules

1. **Naming is locked.** Class names committed under §7, §8, §9 are not
   renamed. If a pattern's CSS rule changes, the change must be backwards
   compatible (e.g. unchanged tokens). Breaking changes require a major
   version bump and a CHANGELOG entry.

2. **No new inline visual styles.** After this catalog ships, an ESLint rule
   blocks any new `style={{...}}` block containing static visual properties
   (background, color, font-*, padding, margin, border, etc.). Inline
   `style={{...}}` is allowed only for **dynamic computed values**:
     ✓ `style={{ width: pct + '%' }}`
     ✓ `style={{ left: x, top: y }}`
     ✓ `style={{ marginLeft: collapsed ? 60 : 240 }}`
     ✗ `style={{ padding: '10px 12px' }}`              → use class
     ✗ `style={{ color: 'var(--gecko-primary-700)' }}` → use class
     ✗ `style={{ fontSize: 12, fontWeight: 700 }}`     → use class

3. **Tokens, not hex.** Every colour, spacing, radius reference uses a CSS
   variable from `gecko_design_system_tokens.css`. Hard-coded `#xxxxxx` in
   any file outside `tokens.css` is a code-review block.

4. **When the catalog doesn't cover something** — STOP and surface it for
   review. Either the catalog grows (new §7.x added formally), or the
   feature changes to fit an existing class. **Do not invent ad-hoc class
   names**.

5. **No project-specific overlays inside the core files.** App-specific
   overrides go in `gecko_<app>_overlay.css` numbered §6.x. The core six
   files are the shared contract.

---

# Section index

  §7   Atomic text patterns      (semantic single-purpose classes)
  §8   Layout helpers            (flex / grid / stack / row primitives)
  §9   Composed elements         (page header, KPI tile, cell-2-line, etc.)
  §10  Spacing utilities         (rarely needed — prefer Stack/Row)
  §11  Usage rules + ESLint
  §A   Drift report              (where current code has variants)
  §B   Cross-app contract        (rules for other Gecko apps consuming this)

Section numbers in this catalog map 1:1 to section markers in
`gecko_design_system_components.css`.

---

# §7 — Atomic text patterns

Single-purpose classes for recurring text shapes. Each class applies a
locked combination of font-family, size, weight, color, and letter-spacing.

## §7.1 `.gecko-id-link`

**Identifier link** — booking #, container #, B/L, EIR #, invoice #,
voyage code. Always a clickable navigation target.

```css
.gecko-id-link {
  font-family: var(--gecko-font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--gecko-primary-600);
  letter-spacing: 0.01em;
  text-decoration: none;
}
.gecko-id-link:hover { color: var(--gecko-primary-700); }
```

**Replaces inline pattern**: `style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-600|700)', letterSpacing: '0.01em' }}`.

**Used in**: booking register, container roster, unbilled services,
activity logs, statement line items, invoice lists. ≈ 28+ occurrences.

## §7.2 `.gecko-cell-primary`

**Primary cell value** — the main bold line in a 2-line table cell.

```css
.gecko-cell-primary {
  font-size: 12px;
  font-weight: 600;
  color: var(--gecko-text-primary);
}
```

## §7.3 `.gecko-cell-sub`

**Secondary line under a primary cell value** — e.g. order number under
booking, customer code under name, voyage/wharf under vessel.

```css
.gecko-cell-sub {
  font-family: var(--gecko-font-mono);
  font-size: 10px;
  color: var(--gecko-text-disabled);
  margin-top: 2px;
  font-weight: 500;
}
```

**Replaces inline pattern**: `style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2, fontFamily: 'var(--gecko-font-mono)' }}`.

**Used in**: ≈ 60+ occurrences across booking register, billing, units,
masters/customers.

## §7.4 `.gecko-cell-meta`

**Secondary line, non-mono variant** — date under booking, description
under code, similar where the secondary text is prose, not an identifier.

```css
.gecko-cell-meta {
  font-size: 11px;
  color: var(--gecko-text-secondary);
  margin-top: 2px;
}
```

## §7.5 `.gecko-eyebrow`

**Small-caps section label** — "CUSTOMER NOTIFICATION CHANNELS",
"OUTBOUND REPORTS", "GROUP LABEL" inside cards.

```css
.gecko-eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: var(--gecko-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

**Replaces**: `style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06–0.09em' }}` (drift: snap all to 0.08em).

**Used in**: form section dividers, KPI tile labels, report grid headers,
masters group labels. ≈ 80+ occurrences.

## §7.6 `.gecko-page-title`

**Page-level h1**.

```css
.gecko-page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--gecko-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.15;
}
```

**Drift to normalise**: current pages use 22 / 24 / 26 px. Catalog snaps to
**22px**. Larger feature pages (dashboards) may use `.gecko-page-title-lg`
(26px) — see §7.7.

## §7.7 `.gecko-page-title-lg`

**Dashboard-level h1** for executive overviews only.

```css
.gecko-page-title-lg {
  font-size: 26px;
  font-weight: 700;
  color: var(--gecko-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.1;
}
```

## §7.8 `.gecko-page-subtitle`

**Page-level descriptive line** under the h1.

```css
.gecko-page-subtitle {
  font-size: 13px;
  color: var(--gecko-text-secondary);
  line-height: 1.5;
  max-width: 720px;
}
```

## §7.9 `.gecko-card-title`

**Title at the top of a card** — section heading inside a card panel.

```css
.gecko-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gecko-text-primary);
  line-height: 1.3;
}
```

## §7.10 `.gecko-card-subtitle`

**Descriptive line under a card title**.

```css
.gecko-card-subtitle {
  font-size: 11px;
  color: var(--gecko-text-secondary);
  line-height: 1.4;
  margin-top: 2px;
}
```

## §7.11 `.gecko-stat-num`

**KPI / stat value** — large bold figure.

```css
.gecko-stat-num {
  font-size: 26px;
  font-weight: 700;
  color: var(--gecko-text-primary);
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
```

**Variants**:
- `.gecko-stat-num.gecko-stat-num-sm` — 20px (for nested stats)
- `.gecko-stat-num.gecko-stat-num-lg` — 32px (for hero KPIs)

**Tones (modifiers)**: `.gecko-tone-primary`, `.gecko-tone-success`,
`.gecko-tone-warning`, `.gecko-tone-error`, `.gecko-tone-info`,
`.gecko-tone-neutral` — applied as a second class to colour the value.

## §7.12 `.gecko-stat-label`

**KPI / stat label** — small caps eyebrow above or below a stat number.

```css
.gecko-stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--gecko-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

## §7.13 `.gecko-money`

**Currency amount cell** — right-aligned, mono, tabular numerals, bold.

```css
.gecko-money {
  font-family: var(--gecko-font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-align: right;
  color: var(--gecko-text-primary);
}
.gecko-money-lg { font-size: 14px; font-weight: 800; }
.gecko-money-md { font-size: 13px; }
.gecko-money-sm { font-size: 12px; }
```

**Used in**: invoice tables, statements, unbilled totals, booking totals.
≈ 40+ occurrences.

## §7.14 `.gecko-num-tabular`

**Generic right-aligned numeric cell** — counts, quantities, line numbers.

```css
.gecko-num-tabular {
  font-family: var(--gecko-font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

Note: `.gecko-num` (right-align only) and `.gecko-mono` (font-family only)
already exist in §5.39 — both kept. `.gecko-num-tabular` is the combined
helper.

## §7.15 `.gecko-mono-strong`

**Mono identifier, non-link** — when an identifier is displayed but not
clickable (e.g. internal reference, agent code in a sub-line).

```css
.gecko-mono-strong {
  font-family: var(--gecko-font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--gecko-text-primary);
}
```

## §7.16 `.gecko-truncate`

**Truncating cell content** — overflow hidden + ellipsis + nowrap. Apply
with a max-width on the cell or use inside a `.gecko-cell-clamp` wrapper.

```css
.gecko-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## §7.17 `.gecko-helper-text`

**Form helper / hint text** under an input.

```css
.gecko-helper-text {
  font-size: 11px;
  color: var(--gecko-text-disabled);
  margin-top: 4px;
  line-height: 1.4;
}
```

## §7.18 `.gecko-form-label`

**Form field label** — left of an input in a 2-column form, or above in a
stacked form.

```css
.gecko-form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gecko-text-primary);
  line-height: 1.4;
}
.gecko-form-label-required::after {
  content: ' *';
  color: var(--gecko-error-600);
}
```

## §7.19 `.gecko-link`

**Plain semantic link** — non-identifier (e.g. "See all", "View details").

```css
.gecko-link {
  color: var(--gecko-primary-600);
  font-weight: 500;
  text-decoration: none;
}
.gecko-link:hover { color: var(--gecko-primary-700); text-decoration: underline; }
```

## §7.20 `.gecko-link-muted`

**Subdued link** — used for utility links (footer, breadcrumb tail).

```css
.gecko-link-muted {
  color: var(--gecko-text-secondary);
  font-weight: 500;
  text-decoration: none;
}
.gecko-link-muted:hover { color: var(--gecko-text-primary); }
```

---

# §8 — Layout helpers

Tiny set of flex/grid utility classes. Not a Tailwind clone — the minimum
needed to cover the top ~80% of layout inline-style violations. Anything
more bespoke goes inside a named composed pattern in §9.

## §8.1 Stack (vertical flex)

```css
.gecko-stack    { display: flex; flex-direction: column; gap: 12px; }
.gecko-stack-xs { gap: 4px; }
.gecko-stack-sm { gap: 8px; }
.gecko-stack-md { gap: 12px; }   /* same as base */
.gecko-stack-lg { gap: 16px; }
.gecko-stack-xl { gap: 24px; }
```

Apply gap by adding a size modifier: `<div class="gecko-stack gecko-stack-lg">`.

## §8.2 Row (horizontal flex)

```css
.gecko-row             { display: flex; align-items: center;     gap: 8px; }
.gecko-row-baseline    { align-items: baseline; }
.gecko-row-start       { align-items: flex-start; }
.gecko-row-end         { align-items: flex-end; }
.gecko-row-between     { justify-content: space-between; }
.gecko-row-right       { justify-content: flex-end; }
.gecko-row-wrap        { flex-wrap: wrap; }
```

Modifiers compose: `<div class="gecko-row gecko-row-between gecko-row-wrap">`.

Gap modifiers: same `-xs/-sm/-md/-lg/-xl` as Stack.

## §8.3 Grid

Fixed-column responsive grids for KPI strips, card grids, form layouts.

```css
.gecko-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.gecko-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.gecko-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.gecko-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }

@media (max-width: 1100px) {
  .gecko-grid-5, .gecko-grid-4 { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 760px) {
  .gecko-grid-5, .gecko-grid-4, .gecko-grid-3 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .gecko-grid-2 { grid-template-columns: 1fr; }
}
```

Gap modifiers: `-xs/-sm/-md/-lg/-xl`.

## §8.4 Flex utilities

```css
.gecko-flex-1       { flex: 1; min-width: 0; }
.gecko-flex-none    { flex: none; }
.gecko-flex-grow    { flex-grow: 1; }
.gecko-flex-shrink-0 { flex-shrink: 0; }
.gecko-min-w-0     { min-width: 0; }      /* lets truncate work inside flex */
```

## §8.5 Inline (inline-flex)

```css
.gecko-inline-row { display: inline-flex; align-items: center; gap: 6px; }
```

For inline icon + text combinations inside larger text contexts.

---

# §9 — Composed elements

Named patterns built from §7 + §8 primitives. These are the **only**
patterns where a single component name covers structure + visuals.
Use them as-is; don't compose §7/§8 to reinvent these.

## §9.1 `.gecko-page-header`

Standard page header — h1 + subtitle on the left, action toolbar on the right.

```html
<div class="gecko-page-header">
  <div class="gecko-page-header-left">
    <div class="gecko-row gecko-row-baseline">
      <h1 class="gecko-page-title">Booking Register</h1>
      <span class="gecko-count-badge">127</span>
    </div>
    <p class="gecko-page-subtitle">Gate-to-vessel lifecycle tracker — LCB · Import Yard</p>
  </div>
  <div class="gecko-page-header-actions">
    <!-- buttons -->
  </div>
</div>
```

```css
.gecko-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.gecko-page-header-left  { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.gecko-page-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
```

## §9.2 `.gecko-mini-icon`

**Small colored icon container** — 32–38px square, rounded, used in page
headers, KPI tiles, hero strips.

```css
.gecko-mini-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.gecko-mini-icon-lg { width: 38px; height: 38px; border-radius: 10px; }

.gecko-mini-icon-primary { background: var(--gecko-primary-50); color: var(--gecko-primary-700); }
.gecko-mini-icon-success { background: var(--gecko-success-50); color: var(--gecko-success-700); }
.gecko-mini-icon-warning { background: var(--gecko-warning-50); color: var(--gecko-warning-700); }
.gecko-mini-icon-error   { background: var(--gecko-error-50);   color: var(--gecko-error-700); }
.gecko-mini-icon-info    { background: var(--gecko-info-50);    color: var(--gecko-info-700); }
.gecko-mini-icon-accent  { background: var(--gecko-accent-50);  color: var(--gecko-accent-700); }
.gecko-mini-icon-neutral { background: var(--gecko-bg-subtle);  color: var(--gecko-text-secondary); }
.gecko-mini-icon-solid   { background: var(--gecko-primary-600); color: #fff; }  /* page-header brand square */
```

**Replaces**: `style={{ width: 32, height: 32, borderRadius: 8, background: '...', color: '...', display: 'flex', alignItems: 'center', justifyContent: 'center' }}`.
≈ 50+ occurrences.

## §9.3 `.gecko-cell-two-line`

**Two-line table cell** — primary value + secondary line, the most common
table cell shape in the app.

```html
<td>
  <div class="gecko-cell-two-line">
    <div class="gecko-cell-primary gecko-truncate">{customer.name}</div>
    <div class="gecko-cell-sub">{customer.code}</div>
  </div>
</td>
```

```css
.gecko-cell-two-line {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
```

## §9.4 `.gecko-stat-card`

**Standalone stat card** — used outside of KPI strips for inline metrics
(e.g. inside drawers, side panels).

```css
.gecko-stat-card {
  background: var(--gecko-bg-surface);
  border: 1px solid var(--gecko-border);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gecko-stat-card .gecko-stat-label { /* inherits §7.12 */ }
.gecko-stat-card .gecko-stat-num   { /* inherits §7.11 */ }
```

## §9.5 `.gecko-kpi-strip`

**KPI strip** — a 4 or 5-tile row at the top of dashboards, masters, ops
pages. Standardises the existing ad-hoc patterns in `/billing/unbilled`,
`/masters/charge-codes`, `/gate/reefer-ops`.

```css
.gecko-kpi-strip {
  display: grid;
  grid-template-columns: repeat(var(--gecko-kpi-cols, 4), 1fr);
  gap: 1px;
  background: var(--gecko-border);
  border: 1px solid var(--gecko-border);
  border-radius: 12px;
  overflow: hidden;
}
.gecko-kpi-strip-5 { --gecko-kpi-cols: 5; }
.gecko-kpi-strip-3 { --gecko-kpi-cols: 3; }

.gecko-kpi-strip > .gecko-kpi-cell {
  background: var(--gecko-bg-surface);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

The existing `.gecko-kpi-tile` (§5.39) is the **icon-left** variant of this
pattern; `.gecko-kpi-cell` is the **stacked** variant. Both are valid; pick
one per page based on density.

## §9.6 `.gecko-card`

(Already exists in §5.x.) Standard card panel. Document here for catalog
completeness.

```css
.gecko-card {
  background: var(--gecko-bg-surface);
  border: 1px solid var(--gecko-border);
  border-radius: 12px;
  padding: 16px 18px;
}
.gecko-card-flush   { padding: 0; }
.gecko-card-tight   { padding: 12px 14px; }
.gecko-card-padded  { padding: 20px 22px; }   /* breathing-room variant */
```

## §9.7 `.gecko-section-divider`

**Horizontal divider** between sections in a long form / drawer body.

```css
.gecko-section-divider {
  height: 1px;
  background: var(--gecko-border);
  margin: 6px 0;
}
.gecko-section-divider-dashed {
  border-top: 1px dashed var(--gecko-border);
  background: transparent;
}
```

## §9.8 `.gecko-action-toolbar`

**Right-aligned action row** at the bottom of forms, drawers, modal footers.

```css
.gecko-action-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.gecko-action-toolbar-between { justify-content: space-between; }
.gecko-action-toolbar-start   { justify-content: flex-start; }
```

## §9.9 `.gecko-empty-card`

**In-section empty state** — small, centered, used inside cards or panels.
(Distinct from the larger `.gecko-empty-state` in §5.12 for full-page
empty.)

```css
.gecko-empty-card {
  padding: 16px;
  background: var(--gecko-bg-subtle);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--gecko-text-secondary);
  text-align: center;
}
```

## §9.10 `.gecko-table-card`

**Table wrapper card** — standard chrome around a `.gecko-table`.

```css
.gecko-table-card {
  background: var(--gecko-bg-surface);
  border: 1px solid var(--gecko-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--gecko-shadow-sm);
}
```

---

# §10 — Spacing utilities

**Use sparingly.** Prefer `.gecko-stack`/`.gecko-row` with gap modifiers.
These exist only for the cases where a single element needs explicit
spacing inside a non-flex parent.

```css
/* Top margin */
.gecko-mt-1 { margin-top: 4px; }
.gecko-mt-2 { margin-top: 8px; }
.gecko-mt-3 { margin-top: 12px; }
.gecko-mt-4 { margin-top: 16px; }
.gecko-mt-5 { margin-top: 24px; }

/* Bottom margin */
.gecko-mb-1 { margin-bottom: 4px; }
.gecko-mb-2 { margin-bottom: 8px; }
.gecko-mb-3 { margin-bottom: 12px; }
.gecko-mb-4 { margin-bottom: 16px; }
.gecko-mb-5 { margin-bottom: 24px; }
```

No horizontal margins; horizontal layout is always achieved with
flex/grid. If you find yourself wanting `margin-left` or `margin-right`,
restructure with §8 helpers.

---

# §11 — Usage rules + ESLint

## When inline style is OK

Only for **dynamic computed values**:

  ✓ `style={{ width: progressPct + '%' }}`
  ✓ `style={{ left: chartX, top: chartY }}`
  ✓ `style={{ marginLeft: sidebarCollapsed ? 60 : 240 }}`
  ✓ `style={{ transform: \`translateX(\${offset}px)\` }}`
  ✓ `style={{ '--my-var': dynamicColor }}`   (CSS custom prop)

## When inline style is forbidden

Anything **static** that could be expressed as a class:

  ✗ `style={{ padding: '10px 12px' }}`
  ✗ `style={{ display: 'flex', gap: 8 }}`
  ✗ `style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-600)' }}`
  ✗ `style={{ borderRadius: 8, background: 'var(--gecko-bg-surface)' }}`

## ESLint rule (to be added in Phase D)

Custom rule `gecko/no-inline-static-styles` that flags any `style={{...}}`
JSX attribute whose object literal contains only **static-typed** values
(string / number literals) for any of these properties:

  background · backgroundColor · color · border · borderRadius · padding
  paddingLeft/Right/Top/Bottom · margin (top/bottom only)
  fontSize · fontWeight · fontFamily · letterSpacing · lineHeight
  display · flexDirection · alignItems · justifyContent · gap
  textAlign · textTransform

Dynamic values (variable references, conditionals, template strings,
computed expressions) are NOT flagged.

---

# §A — Drift report

Variants found in the current codebase that need normalising as the catalog
rolls in. Sub-agents must snap to the catalog value, not the in-code value.

| Pattern | Current variants | Catalog value |
|---|---|---|
| Identifier link font-size | 12, 12.5 | **12** |
| Identifier link letter-spacing | 0.01em, 0.02em, 0.04em | **0.01em** |
| Eyebrow letter-spacing | 0.04em, 0.06em, 0.08em, 0.09em | **0.08em** |
| Cell sub margin-top | 1, 2, 3, 4 | **2** |
| Page title font-size | 22, 24, 26 | **22** (or 26 via `-lg` modifier on dashboards only) |
| KPI value font-size | 20, 24, 26, 28, 32 | **26** (or via `-sm`/`-lg` modifiers) |
| Card padding | 12 / 14 / 16 / 18 / 20 / 22 | **16 18** (use `-tight`/`-padded` modifiers for the others) |
| Mini-icon size | 30, 32, 36, 38 | **32** (or `-lg` for 38) |
| Money cell font-size | 12, 13, 14 | use `-sm`/`-md`/`-lg` modifier |
| Page subtitle max-width | 600, 680, 720, none | **720** |

---

# §B — Cross-app contract

Rules for other Gecko apps (`web.mnr.gecko-api`, `web.trucking.gecko-api`,
`my.gecko-api.com`, future apps) that import the same six CSS files.

1. **Copy, don't edit.** Each app's repo has its own copy of the six files
   in `src/app/`. Apps may NOT modify the core files. Periodic diff against
   `web.tos.gecko-api` (the canonical source) must show byte-equality.

2. **App-specific patterns go in overlay.** If an app needs a visual pattern
   not covered by §7–§9, it adds rules to its own `gecko_<app>_overlay.css`
   file, numbered §6.x. Examples:
     - `gecko_mnr_overlay.css` §6.x — M&R workshop-specific cards
     - `gecko_my_overlay.css` §6.x — customer-facing density variants

3. **Catalog additions propagate.** When `web.tos.gecko-api` adds §7.x /
   §8.x / §9.x, the same lines are added to every other app's CSS file in
   the next sync. Sync cadence: monthly OR per major feature batch.

4. **No app-specific names in core files.** `gecko_design_system_*.css` may
   not contain `.gecko-mnr-*`, `.gecko-trucking-*`, `.gecko-my-*` classes.

5. **Tokens are also frozen.** `gecko_design_system_tokens.css` is the
   canonical token table. Apps don't add tokens; they consume.

6. **Phase 3 plan**: extract `gecko_design_system_*.css` into a standalone
   `@gecko/design-system` package consumed by all apps via npm. Until then,
   the copy-and-sync workflow above is the contract.

---

# Open questions for review

Before I implement §7 / §8 / §9 in `gecko_design_system_components.css`,
please confirm:

1. **Catalog scope** — does §7/§8/§9 cover everything you'd want named, or
   is something missing (e.g. specific patterns from M&R, customer
   portal, trucking)?

2. **Class names** — anything you'd rename? `id-link`, `eyebrow`,
   `stat-num` are common in design systems; happy to adjust if your team
   uses different terminology.

3. **Drift normalisation** — the §A table snaps variants to single
   canonical values. Any value you want to keep different from what I've
   proposed?

4. **§10 spacing utilities** — should I include them or rely entirely on
   Stack/Row gap? My recommendation: include them (covers 5–10% of cases
   that don't fit Stack/Row).

5. **§11 ESLint rule** — confirm we want this. Implementing it before
   Phase C refactor would block sub-agents from regressing.

6. **Cross-app sync workflow** — is monthly diff acceptable, or do you
   want a different cadence (e.g. per-PR check, automated sync script)?

Once you confirm, I'll add §7 / §8 / §9 to
`src/app/gecko_design_system_components.css` as a single commit (no other
changes), and we move to Phase B (component refactor).
