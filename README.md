# LOGICON TOS — Gecko Web UI

> **Terminal Operating System** for ICD + CFS operations.  
> Built to compete with NAVIS N4 and CargoWise at a fraction of the cost.

---

## Overview

**Gecko** is the modern browser-based front-end for the LOGICON Terminal Operating System. It covers the full gate-to-vessel lifecycle for an Inland Container Depot (ICD) and Container Freight Station (CFS) — from booking registration and gate entry through yard management, CFS stuffing/stripping, billing, and tariff management.

The UI is built on a proprietary **Gecko Design System** — a set of CSS custom properties, component classes, and layout primitives that give every screen a consistent, dense, and operator-friendly appearance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Runtime | React 19 |
| Language | TypeScript 5 |
| Styling | Gecko Design System (CSS custom properties) + Tailwind CSS 4 |
| State | React `useState` / `useMemo` (no external store) |
| Data | Mock/static — Redis-backed API integration ready |
| Node Target | Node.js 20+ |

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── dashboard/
│   │   ├── overview/             # Operations dashboard
│   │   └── yard-glance/          # Yard at a glance
│   ├── bookings/
│   │   ├── page.tsx              # Booking Register (list + KPIs)
│   │   ├── new/                  # New Booking — Phase 1 shell
│   │   └── [id]/                 # Booking Edit — Phase 2 full view
│   ├── gate/
│   │   ├── appointments/         # Gate Appointments
│   │   ├── eir-in/               # EIR-In (gate entry)
│   │   ├── eir-in-v2/            # EIR-In V2 HUD view
│   │   ├── eir-out/              # EIR-Out (gate exit)
│   │   ├── yard-view/            # Yard Plan
│   │   └── moves-planner/        # Moves Planner
│   ├── cfs/
│   │   ├── stuffing/             # CFS Stuffing
│   │   ├── stripping/            # CFS Stripping
│   │   ├── lcl-cargo/            # LCL Cargo Register
│   │   └── tally/                # Cargo Tally
│   ├── units/
│   │   ├── unit-inquiry/         # Unit Inquiry
│   │   ├── equipment-pool/       # Equipment Pool
│   │   ├── dwell/                # Detention & Demurrage
│   │   └── edi-inquiry/          # EDI Event Inquiry
│   ├── billing/
│   │   ├── service-orders/       # Service Orders
│   │   ├── invoices/             # Invoices
│   │   ├── credit-notes/         # Credit Notes
│   │   ├── statements/           # Statements
│   │   └── unbilled/             # Unbilled Services
│   ├── tariff/
│   │   ├── plans/                # Tariff Schedules
│   │   ├── rate-cards/           # Rate Cards
│   │   └── free-time/            # Free Time & D&D Rules
│   └── masters/
│       ├── page.tsx              # Masters Hub overview
│       ├── customers/            # Customer master
│       ├── lines/                # Shipping Lines
│       ├── vessels/              # Vessels & Voyages + Call Schedule
│       ├── container-types/      # ISO Container Types
│       ├── order-types/          # Work Order Types
│       ├── charge-codes/         # Charge Codes
│       ├── locations/            # Locations (6-level spatial tree)
│       └── lookups/              # Reference Codes (ISO/SMDG/IICL/EDIFACT)
│
└── components/
    ├── layout/
    │   └── AppShell.tsx          # Collapsible sidebar + sticky header
    └── ui/
        ├── Icon.tsx              # SVG icon library (40+ icons)
        ├── OpsPrimitives.tsx     # PageToolbar, badges, shared primitives
        └── EntitySearch.tsx      # Autocomplete: agent, customer, vessel, haulier…
```

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10+

### Install & Run

```bash
# Clone the repository
git clone https://github.com/sharmalogicon/web.tos.gecko-api.git
cd web.tos.gecko-api

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Commands

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Key Features

### Booking Management
- **Staged save (Phase 1 / Phase 2)** — Phase 1 creates a booking shell instantly (safe against power cuts / internet drops). Phase 2 adds voyage, containers, cargo.
- **Up to 100 containers per booking** — individual container drawer (440px fixed overlay) with conditional Reefer, DG, VAS charge sections and read-only auto-generated movement timeline.
- **CY cut-off countdown** — colour-coded urgency (green >7d · amber 3–7d · red <3d) in sticky header band and sidebar.
- **Order Type carousel** — EXPORT and IMPORT types with auto-generated movement preview strip (FULL IN → LOAD etc.).

### Gate & Yard
- EIR-In with full container inspection fields
- EIR-In V2 — HUD-style layout for fast gate throughput
- EIR-Out, Yard Plan, Moves Planner

### CFS Operations
- Stuffing and Stripping job management
- LCL Cargo Register
- Cargo Tally

### Billing & Tariff
- Service Orders, Invoices, Credit Notes, Statements
- Tariff Schedules with rate matrix support
- Free Time & D&D Rules engine
- Unbilled Services queue

### Master Data
- **EntitySearch** — single autocomplete input, min 3 chars, searches both code and name, keyboard navigable (↑↓ Enter Escape). Used across Agent, Shipper, Consignee, Forwarder, Vessel, Haulier, Charge Code fields. Drop-in Redis/API ready.
- Reference Codes with lifecycle states: `DRAFT → ACTIVE → DEPRECATED → RETIRED`. SMDG / ISO / IICL / EDIFACT compliant.
- 6-level spatial location tree: Facility → Yard → Block → Row → Slot.

### Design System
- All colours and spacing via `var(--gecko-*)` CSS custom properties
- Dark / light theme toggle (header)
- Collapsible sidebar with active-module auto-expand
- Sticky headers, sticky sidebars, responsive content area

---

## Terminology

This UI follows **NAVIS N4 / CargoWise / SMDG** global TOS standard terminology:

| Gecko (this app) | Legacy / old term |
|---|---|
| Booking Register | Order Register |
| Container Mode (CY / CFS / Door / Ramp) | P/U Mode |
| Haulage Type (Merchant / Carrier) | — |
| Detention & Demurrage | Dwell & Demurrage |
| Tariff Schedules | Tariff Plans |
| Free Time & D&D Rules | Free-time Rules |
| ISO Container Types | Container Types |
| Work Order Types | Order Types |
| Reference Codes | Lookup Master |
| Vessel Call Schedule | Vessel Schedule |
| Unbilled Services | Unbilled |
| Cargo Tally | Tally Lists |
| LCL Cargo Register | LCL Cargo |

---

## Architecture Decisions

- **No external state management** — React `useState` / `useMemo` only. Every page is self-contained; global state is intentionally avoided at this stage.
- **Inline styles throughout** — all styling uses Gecko CSS token variables directly in JSX style props. No CSS modules, no Tailwind utility classes in components.
- **Mock data at top of file** — each page contains its own realistic mock data, making pages independently runnable. API integration is a single-function swap per page.
- **`"use client"` everywhere** — all interactive pages are client components. Server components are not yet used.
- **Flat component hierarchy** — sub-components (drawers, tabs, rows) are defined in the same file as the page that uses them. Extract to `/components/` only when shared across 2+ pages.

---

## Roadmap

- [ ] Convert static booking route `/bookings/EGLV149602390729` to dynamic `/bookings/[id]`
- [ ] Connect `EntitySearch` to Redis autocomplete API endpoint
- [ ] Gate EIR-In V2 — complete HUD implementation
- [ ] Yard Plan — drag-and-drop slot allocation
- [ ] EDI event import pipeline (COPARN, CODECO, COARRI, IFTMBC)
- [ ] Multi-facility / multi-yard tenant context switcher
- [ ] Mobile-optimised gate operator view (PWA)
- [ ] Report builder with scheduled PDF/Excel exports
- [ ] Role-based access control (Gate Operator · Terminal Supervisor · Billing Clerk)

---

## Contributing

1. Branch off `main`: `git checkout -b feature/your-feature-name`
2. Follow the existing file pattern — `"use client"`, Gecko CSS tokens, mock data at top
3. Commit with a clear message describing the *why*, not the *what*
4. Open a Pull Request against `main`

---

## License

Proprietary — LOGICON Group. All rights reserved.

---

*Built with care by the LOGICON engineering team · Laem Chabang ICD · Thailand*
