# Graph Report - .  (2026-04-27)

## Corpus Check
- 55 files · ~80,456 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 174 nodes · 160 edges · 44 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Project Overview & UI Concepts|Project Overview & UI Concepts]]
- [[_COMMUNITY_Design System & TOS Domain|Design System & TOS Domain]]
- [[_COMMUNITY_Yard Plan  Graph Layout|Yard Plan / Graph Layout]]
- [[_COMMUNITY_Booking & Container Logic|Booking & Container Logic]]
- [[_COMMUNITY_DateField Calendar UI|DateField Calendar UI]]
- [[_COMMUNITY_CFS Stuffing & Stripping|CFS Stuffing & Stripping]]
- [[_COMMUNITY_DateField Component|DateField Component]]
- [[_COMMUNITY_EntitySearch Autocomplete|EntitySearch Autocomplete]]
- [[_COMMUNITY_Gate Operations (EIR)|Gate Operations (EIR)]]
- [[_COMMUNITY_Order Types & Billing Tags|Order Types & Billing Tags]]
- [[_COMMUNITY_Project Config & Next.js Rules|Project Config & Next.js Rules]]
- [[_COMMUNITY_Barcode Display & Scan|Barcode Display & Scan]]
- [[_COMMUNITY_Yard Locations|Yard Locations]]
- [[_COMMUNITY_App Shell & Navigation|App Shell & Navigation]]
- [[_COMMUNITY_FilterPopover Component|FilterPopover Component]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Billing Unbilled|Billing Unbilled]]
- [[_COMMUNITY_New Booking Form|New Booking Form]]
- [[_COMMUNITY_Operations Dashboard|Operations Dashboard]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Type Declarations|Next.js Type Declarations]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Credit Notes Page|Credit Notes Page]]
- [[_COMMUNITY_Invoices List Page|Invoices List Page]]
- [[_COMMUNITY_Invoice Detail Page|Invoice Detail Page]]
- [[_COMMUNITY_Service Orders Page|Service Orders Page]]
- [[_COMMUNITY_LCL Cargo Page|LCL Cargo Page]]
- [[_COMMUNITY_Cargo Tally Page|Cargo Tally Page]]
- [[_COMMUNITY_EIR Gate-In Page|EIR Gate-In Page]]
- [[_COMMUNITY_Masters Hub|Masters Hub]]
- [[_COMMUNITY_Charge Codes List|Charge Codes List]]
- [[_COMMUNITY_Charge Code Detail|Charge Code Detail]]
- [[_COMMUNITY_Container Types|Container Types]]
- [[_COMMUNITY_Customers List|Customers List]]
- [[_COMMUNITY_Customer Detail|Customer Detail]]
- [[_COMMUNITY_Shipping Lines|Shipping Lines]]
- [[_COMMUNITY_Vessels & Voyages|Vessels & Voyages]]
- [[_COMMUNITY_Free Time & D&D Rules|Free Time & D&D Rules]]
- [[_COMMUNITY_Tariff Plans|Tariff Plans]]
- [[_COMMUNITY_Rate Cards|Rate Cards]]
- [[_COMMUNITY_Icon Library|Icon Library]]
- [[_COMMUNITY_Ops Primitives|Ops Primitives]]

## God Nodes (most connected - your core abstractions)
1. `Gecko Web UI â€” LOGICON TOS` - 26 edges
2. `FilterPopover Component` - 11 edges
3. `UI Standardization â€” Pilot: Customers Page (Spec)` - 6 edges
4. `set()` - 5 edges
5. `Gecko Design System (CSS Custom Properties)` - 5 edges
6. `getTopoOrder()` - 4 edges
7. `rerender()` - 4 edges
8. `Master Data Module` - 4 edges
9. `Customers Master Page` - 4 edges
10. `daysUntil()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `vercel.svg â€” Vercel Triangle Logo` --conceptually_related_to--> `Gecko Web UI â€” LOGICON TOS`  [INFERRED]
  public/vercel.svg → README.md
- `file.svg â€” Generic File / Document Icon` --conceptually_related_to--> `Gecko Web UI â€” LOGICON TOS`  [INFERRED]
  public/file.svg → README.md
- `globe.svg â€” Globe / Web / World Icon` --conceptually_related_to--> `Gecko Web UI â€” LOGICON TOS`  [INFERRED]
  public/globe.svg → README.md
- `window.svg â€” Browser Window / Desktop App Icon` --conceptually_related_to--> `Gecko Web UI â€” LOGICON TOS`  [INFERRED]
  public/window.svg → README.md
- `next.svg â€” Next.js Wordmark Logo` --conceptually_related_to--> `Next.js 16 (App Router)`  [INFERRED]
  public/next.svg → README.md

## Hyperedges (group relationships)
- **Gecko Web UI Tech Stack** — readme_gecko_web_ui, readme_nextjs16, readme_react19, readme_typescript5, readme_gecko_design_system, readme_tailwind_css4 [EXTRACTED 1.00]
- **TOS Core Modules** — readme_logicon_tos, readme_booking_management, readme_gate_yard, readme_cfs_operations, readme_billing_tariff, readme_masters [EXTRACTED 1.00]
- **UI Standardization Pilot Changes** — spec_ui_standardization, spec_filterpopover_component, spec_gecko_btn_sm, spec_customers_page, spec_eir_in_gold_standard [EXTRACTED 1.00]
- **FilterPopover Component API and Supporting Types** — spec_filterpopover_component, spec_filter_field_type, spec_customer_filter_fields, spec_active_filter_count, spec_outside_click_escape [EXTRACTED 1.00]
- **Gecko Design System Tokens Used in Spec** — readme_gecko_design_system, spec_gecko_btn_sm, spec_gecko_z_modal, spec_gecko_select [INFERRED 0.85]
- **Default Next.js Public Assets (Boilerplate SVGs)** — public_file_svg, public_globe_svg, public_next_svg, public_vercel_svg, public_window_svg [INFERRED 0.80]

## Communities

### Community 0 - "Project Overview & UI Concepts"
Cohesion: 0.09
Nodes (24): file.svg â€” Generic File / Document Icon, globe.svg â€” Globe / Web / World Icon, vercel.svg â€” Vercel Triangle Logo, window.svg â€” Browser Window / Desktop App Icon, AppShell Component (Collapsible Sidebar + Sticky Header), Architecture Decision: Flat Component Hierarchy, Architecture Decision: Mock Data at Top of File, Architecture Decision: No External State Management (+16 more)

### Community 1 - "Design System & TOS Domain"
Cohesion: 0.12
Nodes (20): Architecture Decision: Inline Styles via Gecko CSS Tokens, CargoWise (Competing TOS Platform), Gecko Design System (CSS Custom Properties), Icon Component (SVG Library 40+ icons), NAVIS N4 (Competing TOS Platform), OpsPrimitives Component (PageToolbar, Badges, Shared Primitives), Active Filter Count Badge Logic, CUSTOMER_FILTER_FIELDS Constant (query, role, tier, tariff, status, country) (+12 more)

### Community 2 - "Yard Plan / Graph Layout"
Cohesion: 0.18
Nodes (11): exitAdvanced(), getTopoOrder(), onDrop(), onMove(), onNodeMouseUp(), onUp(), rerender(), setErrors() (+3 more)

### Community 3 - "Booking & Container Logic"
Cohesion: 0.16
Nodes (5): cutoffColor(), daysUntil(), set(), toggle(), toggleAll()

### Community 4 - "DateField Calendar UI"
Cohesion: 0.2
Nodes (0): 

### Community 5 - "CFS Stuffing & Stripping"
Cohesion: 0.22
Nodes (1): toggleWh()

### Community 6 - "DateField Component"
Cohesion: 0.25
Nodes (2): jumpToday(), selectDay()

### Community 7 - "EntitySearch Autocomplete"
Cohesion: 0.38
Nodes (4): doSearch(), handleChange(), handleKeyDown(), handleSelect()

### Community 8 - "Gate Operations (EIR)"
Cohesion: 0.6
Nodes (3): handleKeyDown(), toggleReady(), updateContainer()

### Community 9 - "Order Types & Billing Tags"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Project Config & Next.js Rules"
Cohesion: 0.4
Nodes (5): Next.js Agent Rules, Next.js Docs in node_modules, CLAUDE.md Configuration, next.svg â€” Next.js Wordmark Logo, Next.js 16 (App Router)

### Community 11 - "Barcode Display & Scan"
Cohesion: 0.5
Nodes (0): 

### Community 12 - "Yard Locations"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "App Shell & Navigation"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "FilterPopover Component"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Billing Unbilled"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "New Booking Form"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Operations Dashboard"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "ESLint Config"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Next.js Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Credit Notes Page"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Invoices List Page"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Invoice Detail Page"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Service Orders Page"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "LCL Cargo Page"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Cargo Tally Page"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "EIR Gate-In Page"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Masters Hub"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Charge Codes List"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Charge Code Detail"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Container Types"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Customers List"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Customer Detail"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Shipping Lines"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Vessels & Voyages"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Free Time & D&D Rules"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Tariff Plans"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Rate Cards"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Icon Library"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Ops Primitives"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **31 isolated node(s):** `Next.js Docs in node_modules`, `CLAUDE.md Configuration`, `React 19`, `TypeScript 5`, `Tailwind CSS 4` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Root Layout`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page`** (2 nodes): `Home()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Billing Unbilled`** (2 nodes): `toggleSO()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Booking Form`** (2 nodes): `handleTypeChange()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Operations Dashboard`** (2 nodes): `Sparkline()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Type Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Credit Notes Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Invoices List Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Invoice Detail Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Orders Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LCL Cargo Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cargo Tally Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `EIR Gate-In Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Masters Hub`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Charge Codes List`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Charge Code Detail`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Container Types`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customers List`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customer Detail`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shipping Lines`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vessels & Voyages`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Free Time & D&D Rules`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tariff Plans`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rate Cards`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icon Library`** (1 nodes): `Icon.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ops Primitives`** (1 nodes): `OpsPrimitives.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Gecko Web UI â€” LOGICON TOS` connect `Project Overview & UI Concepts` to `Design System & TOS Domain`, `Project Config & Next.js Rules`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `set()` connect `Booking & Container Logic` to `Yard Plan / Graph Layout`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `getTopoOrder()` connect `Yard Plan / Graph Layout` to `Booking & Container Logic`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Gecko Web UI â€” LOGICON TOS` (e.g. with `vercel.svg â€” Vercel Triangle Logo` and `file.svg â€” Generic File / Document Icon`) actually correct?**
  _`Gecko Web UI â€” LOGICON TOS` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Gecko Design System (CSS Custom Properties)` (e.g. with `gecko-z-modal CSS Variable (z-index 50)` and `gecko-select CSS Class (Chevron + appearance:none)`) actually correct?**
  _`Gecko Design System (CSS Custom Properties)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js Docs in node_modules`, `CLAUDE.md Configuration`, `React 19` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Overview & UI Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._