# UI Standardization — Pilot: Customers Page

**Date:** 2026-04-25  
**Scope:** Pilot on `/src/app/masters/customers/page.tsx` before rolling out to all 12+ data-table pages.  
**Goal:** Establish the two UI standards that will be applied globally — toolbar button sizing and filter-popover pattern.

---

## Context

This is a TOS/DMS (Terminal Operating System / Depot Management System) competing at the level of Navis N4, CargoWise, and OPUS Terminal. Consistency, information density, and ease of use for port/depot/ICD operators are non-negotiable.

Two problems have been identified:

1. **Inconsistent toolbar button sizing.** The EIR-In page (the gold standard) uses `gecko-btn-sm` (32px, text-xs) for all header action buttons. Data-table pages use bare `gecko-btn` (40px) — a mismatch that makes every table page feel out of family.

2. **Inline filter bar card wastes vertical chrome.** The current pattern (a bordered card with search input + select dropdowns below the header) consumes ~56px of vertical space permanently, even when no filters are active. For a data-dense TOS, this pushes the table down unnecessarily.

---

## Change 1 — Toolbar Button Size Standardization

### Rule

Every button in the page header action row must include `gecko-btn-sm`.

### On the Customers Page

| Button | Before | After |
|---|---|---|
| Export | `gecko-btn gecko-btn-ghost` | `gecko-btn gecko-btn-ghost gecko-btn-sm` |
| Import | `gecko-btn gecko-btn-outline` | `gecko-btn gecko-btn-outline gecko-btn-sm` |
| New Customer | `gecko-btn gecko-btn-primary` | `gecko-btn gecko-btn-primary gecko-btn-sm` |

Icon sizes remain `size={16}`.

---

## Change 2 — FilterPopover Component

### File Location

**New file:** `/src/components/ui/FilterPopover.tsx`

Must be a separate file with `"use client"` at the top. Do **not** add `FilterPopover` to `OpsPrimitives.tsx` — that file currently has no `"use client"` directive and adding a stateful hook-based component would force all its exports (including server-safe ones) to become client components, which may break other consumers.

Export it as a named export: `export function FilterPopover(...)`.

### Imports Required

```tsx
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
```

### Component API

```tsx
type FilterField =
  | { type: 'search'; key: string; placeholder: string }
  | { type: 'select'; key: string; label: string; options: { label: string; value: string }[] }

interface FilterPopoverProps {
  fields: FilterField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void  // fires on every field change (wired but has no visible effect in this UI-only sprint)
  onApply: (values: Record<string, string>) => void   // fires on "Apply Filters" click
  onClear: () => void                                  // fires on "Clear All" click
}
```

Note: `type: 'text'` (plain text input) is deferred — not needed for the Customers pilot. Only `'search'` and `'select'` are implemented this sprint.

### Outside-Click and Escape Close

Use a `useRef` on the wrapper div and a `useEffect` with a `mousedown` listener:

```tsx
const wrapperRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  function handleOutside(e: MouseEvent) {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }
  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
  }
  document.addEventListener('mousedown', handleOutside);
  document.addEventListener('keydown', handleEscape);
  return () => {
    document.removeEventListener('mousedown', handleOutside);
    document.removeEventListener('keydown', handleEscape);
  };
}, []);
```

### Active Filter Count

Count = number of fields where `values[field.key]` is a non-empty string (`!== ''`).

```tsx
const activeCount = fields.filter(f => (values[f.key] ?? '') !== '').length;
```

### Trigger Button States

| State | Class | Label |
|---|---|---|
| `activeCount === 0` | `gecko-btn gecko-btn-outline gecko-btn-sm` | `Filter` |
| `activeCount >= 1` | `gecko-btn gecko-btn-primary gecko-btn-sm` | `Filter · {activeCount}` |

### Customers Page — Default Values and Initial State

```tsx
const [filters, setFilters] = useState({
  query: '', role: '', tier: '', tariff: '', status: 'active', country: 'TH'
});
```

With these defaults, `activeCount` on first render = **2** (`status` and `country` are non-empty). The Filter button renders as `gecko-btn-primary` with label `"Filter · 2"` on load. This is intentional — it communicates to the operator that two filters are pre-applied.

"Clear All" calls `onClear()` — the parent owns the reset. The canonical reset sets all known keys to empty string: `{ query: '', role: '', tier: '', tariff: '', status: '', country: '' }`. After clearing, `activeCount === 0` and the button returns to `gecko-btn-outline` / "Filter". In the data-wiring sprint, `onChange` (fires on every keystroke/change) and `onApply` (fires on button click) will be differentiated: `onChange` will update a local draft copy; `onApply` will commit to server query params. Do not collapse them.

### Popover Placement and Overflow Safety

The `position: relative` wrapper div must wrap **only** the trigger button and the popover panel — it is placed inside the toolbar action row div, which sits outside the `overflow: hidden` table container. This ensures the popover is not clipped.

```tsx
<div ref={wrapperRef} style={{ position: 'relative' }}>
  {/* trigger button */}
  {open && (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 'var(--gecko-z-modal)' as any, ... }}>
      {/* popover panel */}
    </div>
  )}
</div>
```

### Popover Panel Visual Spec

- **Width:** 320px
- **Background:** `var(--gecko-bg-surface)`
- **Border:** `1px solid var(--gecko-border)`
- **Border-radius:** `var(--gecko-radius-lg)` (8px)
- **Box-shadow:** `var(--gecko-shadow-md)`
- **z-index:** `var(--gecko-z-modal)` (resolves to 50 — clears header/sidebar, below true modals)

**Header row** (`display: flex, justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0'`):
- Left: "Filter Options" — `fontSize: 14, fontWeight: 600, color: var(--gecko-text-primary)`
- Right: × close — `<button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">` with `<Icon name="x" size={14} />`. The compound CSS rule `.gecko-btn-icon.gecko-btn-sm` resolves to 32×32px — no override needed.

**Field area** (`display: flex, flexDirection: 'column', gap: 16, padding: 16`):

- `type: 'search'` → no label; `<div style={{ position: 'relative' }}>` containing `<Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gecko-text-disabled)' }} />` and `<input className="gecko-input" style={{ paddingLeft: 32, width: '100%' }} />`
- `type: 'select'` → `<label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>` above `<select className="gecko-select" style={{ width: '100%' }}>`. Use `gecko-select` (not `gecko-input`) — `gecko-select` in globals.css applies the correct chevron background-image and `appearance: none` treatment.

**Footer** (`display: flex, justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTop: '1px solid var(--gecko-border)', marginTop: 4`):
- Left: "Clear All" — `gecko-btn gecko-btn-outline gecko-btn-sm` — resets all values to `{}` (empty strings), calls `onClear()`, and **leaves popover open** so the operator can see the cleared state before deciding to apply or dismiss
- Right: "Apply Filters" — `gecko-btn gecko-btn-primary gecko-btn-sm` — calls `onApply(values)` and **closes the popover**

### Toolbar Placement in customers/page.tsx

```tsx
// Action row — all buttons gecko-btn-sm
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  <button className="gecko-btn gecko-btn-ghost gecko-btn-sm">
    <Icon name="download" size={16} /> Export
  </button>
  <button className="gecko-btn gecko-btn-outline gecko-btn-sm">
    <Icon name="upload" size={16} /> Import
  </button>
  <FilterPopover
    fields={CUSTOMER_FILTER_FIELDS}
    values={filters}
    onChange={setFilters}
    onApply={(v) => setFilters(v)}
    onClear={() => setFilters({ query: '', role: '', tier: '', tariff: '', status: '', country: '' })}
  />
  <button className="gecko-btn gecko-btn-primary gecko-btn-sm">
    <Icon name="plus" size={16} /> New Customer
  </button>
</div>
```

The page must be converted from a pure static component to a `"use client"` component (it already is — `"use client"` is on line 1).

### Customers Page Filter Fields Constant

```tsx
const CUSTOMER_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search by name, code, tax ID, or SCAC...' },
  { type: 'select', key: 'role',    label: 'Role',    options: [{ label: 'All', value: '' }, { label: 'Bill-to', value: 'bill-to' }, { label: 'Consignee', value: 'consignee' }, { label: 'Shipper', value: 'shipper' }] },
  { type: 'select', key: 'tier',    label: 'Tier',    options: [{ label: 'All', value: '' }, { label: 'Key', value: 'key' }, { label: 'Standard', value: 'standard' }] },
  { type: 'select', key: 'tariff',  label: 'Tariff',  options: [{ label: 'All', value: '' }, { label: 'Custom', value: 'custom' }, { label: 'Standard LCB', value: 'standard' }] },
  { type: 'select', key: 'status',  label: 'Status',  options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'On hold', value: 'on-hold' }] },
  { type: 'select', key: 'country', label: 'Country', options: [{ label: 'All', value: '' }, { label: 'Thailand', value: 'TH' }, { label: 'Other', value: 'other' }] },
];
```

---

## Change 3 — Remove Filter Bar Card

The entire filter bar `<div>` block (lines 46–77 in the current `page.tsx`, including the search input, all selects, the "Add filter" ghost button, and the List/Grid view toggle) is **removed**. The table renders directly below the page header. The view-toggle is non-functional and removed in this sprint; it can be revisited when grid view is implemented.

---

## What is NOT Changing

- Table structure, columns, row data — untouched
- `RoleBadge` component — untouched
- Page layout, max-width container — untouched
- No live filtering of table rows (UI-only sprint — `onApply` fires but table remains static mock data)

---

## Known Gaps / Follow-ups (not in scope for this sprint)

- **Accessibility:** `aria-expanded` on trigger, `role="dialog"` on panel, focus management on open. Required before full rollout.
- **Scroll behavior:** Popover scrolls with the page (not fixed). Acceptable for pilot; portal rendering can be added at rollout if needed.
- **`type: 'text'`** field variant — deferred until a page requires it (e.g., a Supplier Name free-text filter).
- **Live table filtering** — deferred to the data-wiring sprint.

---

## Acceptance Criteria

- [ ] Export, Import, New Customer buttons all render at 32px height (gecko-btn-sm), consistent with EIR-In toolbar
- [ ] No filter bar card is rendered below the page header
- [ ] FilterPopover trigger button appears between Import and New Customer in the toolbar
- [ ] On first load, Filter button shows `gecko-btn-primary` style with label "Filter · 2" (status + country pre-set)
- [ ] Clicking Filter button opens the popover panel anchored below-right of the trigger
- [ ] Popover contains: 1 search field + 5 select fields (Role, Tier, Tariff, Status, Country) with correct labels and options
- [ ] Changing a field value calls `onChange`; no visible table change expected
- [ ] "Apply Filters" closes the popover and calls `onApply`
- [ ] "Clear All" resets all values to empty string, updates badge to "Filter" (outline, no count), and **leaves popover open**
- [ ] Clicking outside the popover closes it
- [ ] Pressing Escape closes the popover
- [ ] `FilterPopover` lives in `/src/components/ui/FilterPopover.tsx` with `"use client"` and is importable by other pages
