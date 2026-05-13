# Gecko vs the Market — Competitive Analysis

> Honest read of where the incumbents fail, and how Gecko already mitigates
> those gaps using **what we have already built** — without changing our
> business logic, modules, or UI/UX.
>
> **Constraint:** Every "How Gecko wins" claim below maps to capability we
> have already shipped or have committed to building. No vapourware.

**Last updated:** 2026-05-13
**Audience:** Founder + future GTM team

---

## 1. The incumbents — who we're up against

| Vendor | Product | Typical customer | Estimated TCO (5 yr) |
|--------|---------|-----------------|---------------------|
| **NAVIS (Kaleris)** | N4 | Large container terminals, port operators | $5–15M+ |
| **WiseTech Global** | CargoWise One | 3PLs, freight forwarders, terminal operators | $2–8M+ |
| **WiseTech / ContainerChain** | ContainerChain (Depot, VBS, Notify) | Empty-container depots + adjacent terminals (AU/NZ-strong, ASEAN-growing) | $0.3–1.5M |
| **Envision** | Terminal | Small-mid container terminals | $1–4M |
| **Tideworks** | TOS-Plus, GateVision | US-centric mid-tier | $1–3M |
| **Solvo** | Solvo.TOS | CIS / Eastern European | $0.8–2M |
| **RBS** | Various | Project-based, smaller terminals | $0.5–1.5M |
| **TGI Maritime** | TGI-TOS | French / European mid-tier | $1–2M |
| **TBA Group** | TEAMS | Large terminals (Cosco, ECT) | $3–8M |

**Excluded** from this analysis: in-house custom builds, terminal-specific
forks of the above. Most large terminals run heavily customized variants —
which is itself a pain point we exploit.

---

## 2. Master comparison matrix

✓ = strong, △ = partial / dated, ✗ = weak / missing, **G** = where Gecko wins

| Capability | NAVIS N4 | CargoWise | ContainerChain | Envision | Tideworks | Solvo | **Gecko** |
|---|---|---|---|---|---|---|---|
| **Modern web UX** | △ (web wrapper on legacy) | △ (dense, dated) | ✓ (modern web) | △ | ✗ | ✗ | **✓ G** |
| **Mobile / responsive** | ✗ | △ | ✓ (trucker mobile app) | ✗ | ✗ | ✗ | **✓ G** |
| **Native SaaS multi-tenant** | ✗ (hosted legacy) | △ (tenant-aware but old DB) | ✓ | ✗ | △ | ✗ | **✓ G** |
| **Open APIs (OpenAPI/REST)** | △ (SOAP legacy) | △ (rate-limited, expensive) | △ (partner-only) | ✗ | △ | ✗ | **✓ G** |
| **Real-time event streaming** | ✗ | ✗ | △ (webhooks) | ✗ | ✗ | ✗ | **✓ G** |
| **Per-module pricing** | ✗ | ✓ | ✓ | △ | △ | ✗ | **✓ G** |
| **Self-service tenant provisioning** | ✗ (months) | ✗ (months) | △ (weeks) | ✗ | ✗ | ✗ | **✓ G** |
| **Modern observability** | ✗ | ✗ | △ | ✗ | ✗ | ✗ | **✓ G** |
| **In-product audit log** | △ (bolt-on) | △ | △ | ✗ | ✗ | ✗ | **✓ G** |
| **Customer self-service portal** | ✗ ($$$ add-on) | ✗ ($$$ add-on) | ✓ (their core) | ✗ | ✗ | ✗ | **✓ G** (using existing UI) |
| **Trucker / VBS appointment portal** | ✗ (3rd-party bolt-on) | ✗ | **✓ (their flagship)** | ✗ | △ | ✗ | △ → ✓ (Phase 4.5) |
| **Empty Container Park (ECP) workflow** | △ (generic depot) | ✗ | **✓ (their flagship)** | ✗ | ✗ | ✗ | △ → ✓ (Phase 1.5/2) |
| **Sub-30-day onboarding** | ✗ (6–18 mo) | ✗ (6–18 mo) | △ (4–8 wk) | △ (3–6 mo) | △ | ✗ | **✓ G** |
| **EDI integration depth** | ✓ | ✓ | △ (not their focus) | △ | △ | △ | △ → ✓ (Phase 4) |
| **Tariff & rate flexibility** | ✓ | ✓ | △ (carrier-hire only) | △ | △ | △ | **✓ G** (already designed) |
| **Yard planning & stowage** | ✓ | △ | ✗ (not in scope) | △ | ✓ | △ | △ → ✓ (Phase 2–3) |
| **Vessel ops & berth planning** | ✓ | △ | ✗ | △ | ✓ | △ | △ → ✓ (Phase 2) |
| **CFS / depot ops** | △ | ✓ | **✓ (empty depot only)** | △ | △ | △ | **✓ G** |
| **Trucking / haulage integrated** | ✗ (separate product) | △ | △ (Trucker side only) | ✗ | ✗ | ✗ | △ → ✓ (Phase 5) |
| **Equipment M&R integrated** | △ | △ | ✗ | ✗ | ✗ | ✗ | △ → ✓ (Phase 6) |
| **Fleet / preventive maintenance** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | △ → ✓ (Phase 7) |
| **Multi-region / data residency** | △ | △ | △ | ✗ | ✗ | ✗ | **✓ G** (Azure global) |
| **Customisation without code** | ✗ (XML config hell) | ✗ (XML config hell) | △ | △ | △ | ✗ | **✓ G** (config-driven UI ready) |
| **Monthly cost for SME** | $$$$ | $$$$ | $$ | $$$ | $$ | $ | **$ G** |
| **Vendor lock-in escape** | ✗ | ✗ | ✗ (WiseTech ecosystem) | △ | △ | △ | **✓ G** (open standards) |

---

## 3. Specific gaps — and how our existing UI/UX already addresses them

### 3.1 NAVIS N4 — pain point inventory

**Real, documented complaints from operators (industry forums, LinkedIn, Gartner reviews):**

| NAVIS pain point | What the operator feels | How Gecko already wins |
|---|---|---|
| **WinForms-feel UX, even in N4 web** | "Looks like 2008 software." Slow training, low adoption. | Gecko's modern Next.js UI with toast feedback, modals, search-first patterns. **Already shipped.** |
| **Customisation requires consultant army** | $200K–$500K consulting for any non-trivial change. | Gecko's filter popovers, master-data CRUD, modal patterns are config-driven from day 1. New screens follow the same shared components. **Already built.** |
| **6–18 month implementation** | Operators delay go-live by 12+ months. | Gecko provisions a new tenant in minutes (Phase 0 admin tool). UI works against any tenant. **Architectural commitment.** |
| **Closed APIs (SOAP, proprietary)** | Integrators (TMS, customs, lines) struggle to integrate. | Gecko publishes OpenAPI/Swagger per module. Public from day 1. **Architectural commitment.** |
| **Per-user licensing** | "Why am I paying $X for the gate clerk who logs in twice a day?" | Gecko: per-tenant + per-module pricing. Unlimited users per tenant. **Subscription service design.** |
| **No mobile** | Gate clerks tap on tablets that don't fit the UI. | Gecko's responsive Next.js works on tablet/phone. **Already responsive.** |
| **Reporting needs separate Cognos/PowerBI** | Operators wait for IT to build reports. | Gecko's filter + export buttons on every list page generate CSV today; PowerBI embed possible Phase 5. **Already shipped (export buttons everywhere).** |
| **Upgrade is project-level effort** | Annual upgrades are 6-month projects. | Gecko: continuous deployment, blue/green per module. **Architectural commitment.** |
| **Hard to extend tariff logic** | New surcharge = SP rewrite + DBA + downtime. | Gecko's tariff in TypeScript = code review + unit test + deploy. **Architectural commitment, ARCHITECTURE.md §2.** |

### 3.2 CargoWise One — pain point inventory

**Documented from forwarder operations leads (Reddit r/freightforwarder, LinkedIn):**

| CargoWise pain point | What the operator feels | How Gecko already wins |
|---|---|---|
| **XML configuration is a black art** | "I needed a CW-certified consultant for 3 months to add a single field." | Gecko's master-data extension tables (per-module customer extensions in ARCHITECTURE.md §3) — add fields via schema migration + auto-generated UI. **Patterns ready.** |
| **Steep learning curve** | "It takes 3+ months for a new ops person to be productive." | Gecko's UX is discoverable: search bars, breadcrumbs, filter popovers, empty states with helpful tips. **Already built across 74 pages.** |
| **API is rate-limited and expensive** | Pay extra for higher API tiers, burst limits hit you in production. | Gecko: no per-call API metering. Tenants pay flat module subscription. **Subscription model.** |
| **"CargoWise way" — single source of truth as a bottleneck** | Forced workflows that don't fit local practice. | Gecko's modules talk via events, not a giant central DB. Tenants run with their workflow. **Event-driven architecture.** |
| **Customer self-service portals are paid add-ons** | Lines/customers pay extra to see their own data. | Gecko: same UI shell, role-scoped views. Customer logs in, sees only their bookings. **Auth model + tenant-scoped queries.** |
| **WiseTech operational issues (2024–2025 turbulence)** | Customers worried about vendor stability. | Gecko: open-source-friendly stack, no vendor lock-in. Even if Gecko fails, schema is standard SQL. **Strategic positioning.** |
| **Per-module licensing complexity** | Hard to predict total bill — many micro-modules. | Gecko: 5 modules, transparent per-module pricing. **Subscription design.** |

### 3.3 Envision — pain point inventory

**Documented from smaller terminal operators:**

| Envision pain point | What the operator feels | How Gecko already wins |
|---|---|---|
| **Limited features vs. NAVIS** | Can't handle complex multi-vessel terminals. | Gecko's planned depth (TOS + EDI + Trucking + M&R + Fleet) covers full operation. **Roadmap commitment.** |
| **Not truly SaaS** | Single-tenant deployments, hosted-but-not-multi-tenant. | Gecko: native multi-tenant from day 1. **DB-per-tenant model.** |
| **Less polished UX** | Functional but not delightful. | Gecko: modern design system, consistent components. **Already shipped.** |
| **EDI support shallower** | Works for COPARN/CODECO but missing CUSCAR, MOVINS, BAPLIE depth. | Gecko EDI Hub designed for full message family, including customs (CUSCAR/CUSREP) — Phase 4. **Roadmap.** |

### 3.5 ContainerChain — pain point inventory

ContainerChain became part of WiseTech in 2019 and is the de-facto empty-
container-park + VBS layer in AU/NZ. They're spreading into ASEAN
(Singapore, Malaysia, Thailand) — that's our territory, so this is the
most directly relevant competitor for Phase 1–2 sales.

| ContainerChain pain point | What the operator feels | How Gecko already wins / will win |
|---|---|---|
| **Empty-park only — no full TOS** | "Great for empties, but we still run a separate system for laden boxes, billing, CFS." | Gecko TOS handles both laden + empty in one DB, one UI. ECP workflow (`ecp_hires`) is a Phase 1.5/2 add-on to the full TOS — not a separate product. **See CONTAINERCHAIN-GAPS.md Gap 2.** |
| **WiseTech ecosystem lock-in** | Tightly coupled to CargoWise / WiseTech Global. Pricing, contracts, and roadmap are dictated by parent. | Gecko: open SQL schema, OpenAPI, exportable data. No parent vendor agenda. |
| **Closed APIs** | Integration is partner-portal only, often via webhook + flat-file. No public OpenAPI. | Gecko: public OpenAPI per module, day 1. |
| **Notify-Party automation is a paid premium** | SMS/email to consignee when container arrives is the upsell, not the baseline. | Gecko: `notification_templates` + `notification_subscriptions` in Platform DB, baseline feature. **See CONTAINERCHAIN-GAPS.md Gap 4.** |
| **Trucker registration is national-marketplace style** | Truckers register once with ContainerChain to access all depots — depots can't deny or filter to their own approved list. | Gecko VBS: per-tenant trucker registration. Each depot owns its trucker whitelist. Optional cross-tenant lookup possible later. |
| **D&D / detention not first-class** | Detention is calculated outside ContainerChain, then keyed in. | Gecko: D&D rules in TOS billing module, evaluated continuously, posted to charges automatically. Phase 3. |
| **Doesn't handle multi-modal (CFS, rail)** | Box leaves depot → out of system. | Gecko TOS covers gate-out → trucking dispatch → trip lifecycle (Phase 5). |
| **No mainland/region-specific customs hooks** | Built for AU/NZ Customs; SEA single-window (Thai e-Customs, Indonesia INSW, Vietnam VNACCS) is bolt-on per integration. | Gecko EDI Hub designed with `ICustomsAdapter` abstraction for all 6 SEA NSW systems. Phase 4. |
| **Pricing in USD/AUD only** | Local-currency invoicing not native. | Gecko: every money column is `DECIMAL(19,4) + currency`, FX from Platform.ReferenceData. THB/SGD/MYR/IDR/VND/PHP native. |

**Strategic risk:** ContainerChain is the closest direct competitor in our
Phase 1 GTM zone (SEA empty-container depots). They have first-mover
brand recognition in AU/NZ and a growing ASEAN footprint. Our wedge is
**"full TOS for the same price as ContainerChain's depot module."**

---

### 3.4 Cross-cutting industry gaps

**Things every TOS gets wrong, that we get right by default:**

| Industry-wide gap | Why it persists | How Gecko already wins |
|---|---|---|
| **Audit log is bolt-on or non-existent** | Built decades ago without GDPR/SOX in mind. | Gecko's `Platform.Audit` module captures every state change, queryable centrally. **ARCHITECTURE.md §3.** |
| **Tenant data leakage risk** | Application-layer enforcement only. | Gecko: EF global query filters + SQL Server RLS = defense in depth. **ARCHITECTURE.md §4.** |
| **Real-time visibility is poor** | Polling-based UIs from the 2000s. | Gecko: event bus + Redis pub/sub + Next.js can push live updates. **Architecture supports it.** |
| **Multi-currency / multi-region** | Hard-coded single currency in many systems. | Gecko: every money column is `DECIMAL(19,4) + currency_code`. FX from Platform.ReferenceData. **ARCHITECTURE.md §8.** |
| **Time zone bugs** | Operators in Bangkok see UTC timestamps. | Gecko: `DATETIMEOFFSET` everywhere. UI converts on display. **Already in design.** |
| **Reports always lag** | Run against operational DB, slowing both. | Gecko: read replicas for reporting (Phase 5). Operational DB stays fast. **Roadmap.** |
| **Disaster recovery is opaque** | "Trust us, we have backups." | Gecko: per-tenant backup, point-in-time restore, documented RTO/RPO. **Azure SQL native.** |
| **Per-tenant region compliance** | "Sorry, all data is in our Frankfurt DC." | Gecko: deploy tenant DB in their preferred region. **Multi-region commitment.** |
| **Open data export** | Vendor lock-in by file format. | Gecko: every list has CSV export today. SQL schema is standard. **Already shipped (`<ExportButton>` on 30+ pages).** |

---

## 3A. Deep per-vendor analysis

This is the long-form read of the five vendors that matter most to Gecko's
GTM. Each section follows the same structure: positioning, what they do
well, what they do poorly, gaps vs Gecko, where they will beat us, where
we beat them, strategic threats / opportunities.

### 3A.1 NAVIS N4 (Kaleris) — the 800-pound gorilla

**Positioning.** NAVIS N4 is the most-deployed container TOS globally —
roughly 300+ container terminals run on it, including the largest
operators (APM, PSA on selected sites, Hutchison, COSCO Shipping Ports).
Kaleris bought NAVIS from Cargotec in 2022; since then the product
roadmap has been turbulent (re-platforming attempts, leadership churn).

**Customer profile.** Large container terminals, port operators,
mega-ports (10M+ TEU/year). Typical deal size $5–15M+ over 5 years
inclusive of consulting, hardware, integration, and per-user licensing.

**Strengths (genuinely hard to match).**
- **Stowage planning depth.** N4's vessel-stowage editor (StowMan
  integration) handles complex deck/hold rules, hazardous segregation,
  reefer power slots, IMO class checks. This is decades of domain
  encoding.
- **Crane / equipment optimisation.** N4's TOS+ECN stack drives RTG /
  STS crane sequencing in real time. SME terminals don't need this; mega-
  ports can't operate without it.
- **Reference customers.** "APM uses it" carries weight in every RFP.
- **Decades of EDI partner mappings.** Every quirky carrier filter that
  takes a quarter to figure out — they already figured it out.
- **24/7 global support.** Three follow-the-sun centres.

**Weaknesses (where they bleed customers).**
- **UX is dated.** Even the N4 "Web" client is a thin wrapper over the
  Java Swing legacy. Gate clerks complain. Training takes weeks.
- **Implementation is brutal.** Industry-standard implementation timeline
  is 12–24 months. Mid-cycle scope creep is the norm.
- **Per-user licensing.** $X per named user, per year. Gate clerks on
  rotating shifts get expensive fast.
- **Customisation requires Kaleris-certified consultants** at $200–500/hr.
- **APIs are SOAP-era.** Modern REST/OpenAPI is a roadmap item, perennially.
- **Reporting is a separate product** (Cognos / Tableau integration).
- **No real SaaS multi-tenancy.** Each customer is a hosted instance,
  not a tenant. Operational economics scale linearly with customer count.

**Specific gaps vs Gecko.**

| Gap | Gecko advantage |
|-----|-----------------|
| No native VBS — relies on third-party (ContainerChain, eModal) | Gecko Phase 4.5 VBS is in-platform, same DB, same auth |
| No empty-park (ECP) workflow — depots run separate systems | Gecko ECP is built into TOS DB |
| No trucker self-service portal in product | Gecko VBS portal is part of the platform |
| Multi-region by hosting only, not by data residency design | Gecko per-tenant region selection |
| No event-driven architecture — polling everywhere | Gecko Service Bus + outbox + idempotency-keys |
| SEA single-window customs requires per-country custom dev | Gecko `ICustomsAdapter` abstraction for 6 SEA NSWs |

**Where NAVIS will beat us (honestly).**
- **Bid for a mega-port.** Year 1–3, we cannot win an RFP at Tanjung
  Pelepas or Laem Chabang main berth. Their depth in stowage, crane
  optimisation, and vessel sequencing is real.
- **Stickiness.** Once a terminal is on NAVIS for 5+ years, switching
  cost (operator retraining, EDI re-mapping, migration risk) keeps them
  there even when they complain.
- **Reference effect.** "APM uses NAVIS" closes deals we cannot.

**Where we beat them (honestly).**
- **Mid-tier ICDs, depots, CFS.** They were never designed for the
  $200–$2,000/month tenant. Their cost structure can't go there.
- **Modern UX.** They cannot rewrite N4's UI without re-encoding 20
  years of business rules. We have a 5-year head start on UX.
- **Time to value.** Days vs. months.
- **Per-module pricing.** A forwarder wanting just EDI cannot buy that
  from NAVIS without buying the rest. We sell it standalone.

**Strategic positioning.** NAVIS is **not the enemy in Phase 1**. They
ignored the SME market for two decades — it's ours to take. Worry about
NAVIS in Phase 5+ when we approach mid-tier mainline terminals. By then
the moat (modular monolith, open APIs, per-tenant region, real event
streaming) is durable.

---

### 3A.2 ContainerChain (WiseTech) — the most directly relevant competitor

**Positioning.** ContainerChain (1-Stop's depot product, acquired by
WiseTech 2019) is the de-facto empty-container park (ECP) and Vehicle
Booking System (VBS) layer in AU/NZ. Active expansion into SEA
(Singapore, Malaysia, Thailand) since 2022 makes them **our most
directly competitive vendor in Phase 1**.

**Customer profile.** Empty-container depots, container freight stations,
small-mid terminals that want modern gate-appointment and notify-party
automation. Typical deal $50K–$500K/year subscription.

**Product surface.**
- **Depot.** Empty container park management (hire-out / hire-return,
  carrier-hire terms, condition grading, EOR/EIR receipts).
- **VBS.** Vehicle Booking System — truckers self-book gate slots,
  depots manage slot capacity, no-shows tracked.
- **Notify.** Carrier-driven SMS/email to consignees on container
  arrival, release readiness, payment received.
- **Trucker app.** Mobile app for truck drivers — slot booking, QR-code
  arrival, document upload.

**Strengths (genuinely hard to match).**
- **Network effect on truckers.** In Sydney, virtually every container
  trucker has the ContainerChain Trucker app. New depot joining the
  network instantly gets a trucker base.
- **Modern web UX.** Built post-2010, not a legacy port-over.
- **VBS is mature.** They solved the no-show problem with credit-system
  + booking deposits years ago.
- **Webhooks + partner API.** Integrators can subscribe to events.
- **AU/NZ dominance.** They are the standard.

**Weaknesses.**
- **Empty-park only — not a full TOS.** Laden containers, billing
  beyond hire fees, CFS operations, vessel ops — all require a separate
  system. Operators end up running two stacks.
- **WiseTech ecosystem dependency.** Pricing, contracts, roadmap
  dictated by WiseTech corporate. Independent operators worry about it.
- **Notify-Party is the upsell.** Baseline SMS volume is metered.
- **National-marketplace trucker model** — depots can't enforce a
  trucker whitelist, must accept anyone with a ContainerChain account.
  Some terminals want this; others don't.
- **SEA-localisation thin.** Currency, language, customs hooks for
  Thailand / Indonesia / Vietnam are bolt-on, not native.
- **No D&D engine.** Detention / demurrage calculated externally, then
  entered.

**Specific gaps vs Gecko.**

| Gap | Gecko advantage |
|-----|-----------------|
| Empty-park only — no laden TOS, billing, CFS | Gecko TOS handles laden + empty + CFS + billing in one platform |
| No D&D / detention engine | Gecko Phase 3 billing handles D&D rules natively |
| Notify-Party is paid add-on | Gecko `notification_templates` is baseline (CONTAINERCHAIN-GAPS.md Gap 4) |
| Closed partner API only | Gecko: public OpenAPI per module |
| AU-currency / USD pricing native; SEA currencies bolt-on | Gecko: DECIMAL(19,4) + ISO 4217, FX from Platform.ReferenceData, native THB/SGD/MYR/IDR/VND/PHP |
| Marketplace trucker model — depot can't filter | Gecko VBS: per-tenant trucker whitelist owned by depot |
| Customs single-window for SEA is bolt-on | Gecko EDI Hub `ICustomsAdapter` per country |
| Yard slot / position tracking absent | Gecko Master DB has yard_blocks → yard_rows → yard_slots hierarchy |

**Where ContainerChain will beat us (honestly).**
- **Year 1 in AU/NZ.** Their trucker network is impossible to replicate
  in months. We're not chasing that market in Phase 1.
- **In SEA depot-only deals where the operator already runs NAVIS / a
  legacy TOS for laden.** They get "VBS-only" deals we'd have to ask
  the customer to migrate their whole stack for. *This is what our
  "VBS-only" bundle (ARCHITECTURE.md §4) targets.*
- **Brand recognition.** A depot operator searching "empty container
  depot software" finds them. We need 12–18 months of inbound SEO.

**Where we beat them (honestly).**
- **One-platform story.** Tenants don't want a second login, second
  bill, second support contact for ECP + VBS on top of their TOS.
- **Full TOS at SME pricing.** Their "Depot + VBS + Notify" lands at
  the price point of our full Phase 1–2 stack.
- **SEA-native.** Thai, Bahasa, Vietnamese — Phase 4 commitment.
  ContainerChain's localisation is shallow.
- **No WiseTech overlord.** Independent operators wary of WiseTech
  vendor risk (CEO controversies, slowing growth, integration record)
  are an active market for us.
- **D&D billing.** A real revenue lever for depots that ContainerChain
  forces them to handle externally.

**Strategic positioning.** **ContainerChain is the vendor we will
displace deal-by-deal in Phase 1.** Our Phase 4.5 VBS module is the
direct counter-punch. The CONTAINERCHAIN-GAPS.md doc is our spec for
that fight. Bundles to lead with:

- **Depot Lite Plus** ($X/mo) — TOS + ECP — beats their "Depot" alone
- **Terminal Pro** ($Y/mo) — TOS + VBS — beats their "Depot + VBS"
- **VBS-only** ($Z/mo) — for terminals on legacy NAVIS who want
  appointment control without a full migration — direct steal from
  ContainerChain's wedge product

---

### 3A.3 CargoWise One (WiseTech) — the forwarder-leaning incumbent

**Positioning.** CargoWise One is the dominant freight-forwarder
operations platform globally. Marketed as "one platform for the entire
logistics chain" — forwarding, customs, accounting, warehousing, and
terminal/depot via embedded modules. **Not primarily a TOS** but
competes for tenant attention because forwarders + 3PLs are an overlap
buyer.

**Customer profile.** Mid-large freight forwarders, NVOCCs, customs
brokers, 3PLs. Some terminal operators running combined forwarding +
depot. Typical TCO $2–8M over 5 years.

**Strengths.**
- **End-to-end forwarder workflow.** Quote → booking → shipment →
  customs → invoice → accounting, in one DB.
- **Customs broker module.** Mature integration with customs authorities
  in 30+ countries (including Singapore TradeNet, Malaysia uCustoms).
- **EDI integration breadth.** Every major carrier mapping is in there.
- **Accounting built-in.** No external GL integration headache for
  forwarder-side P&L.
- **WiseTech-trained consultant ecosystem.** Plenty of implementation
  partners.

**Weaknesses (well-documented in operator forums).**
- **"CargoWise way" rigidity.** Forced workflows don't fit local
  practice. Customisation requires CW-certified consultants and XML
  hacking.
- **XML config is a black art.** "I needed a CW-certified consultant
  for 3 months to add a single field." — actual quote.
- **Steep learning curve.** 3+ months for new ops staff to be
  productive.
- **API rate-limiting + metering.** Pay extra for higher API tiers;
  bursts hit production.
- **Customer self-service portals are paid add-ons.** Lines / shippers
  pay extra to see their own data.
- **WiseTech turbulence (2024–2025).** Founder controversies, growth
  slowdown, multiple failed acquisitions — customers actively looking
  for exit strategies.
- **Per-module licensing micro-fragmentation.** Final bill hard to
  predict.
- **Terminal-side functionality is thin.** Yard, gate, stowage all
  weaker than NAVIS / Tideworks.

**Specific gaps vs Gecko.**

| Gap | Gecko advantage |
|-----|-----------------|
| Terminal/depot ops shallow | Gecko TOS is purpose-built for terminal, not adapted from forwarding |
| XML config + consultant lock-in | Gecko: schema migrations + code in version control |
| API metered/rate-limited | Gecko: flat per-module subscription, no metering |
| Customer portal is paid add-on | Gecko: same UI shell, role-scoped views, included |
| WiseTech vendor risk | Gecko: open SQL schema, exportable, no vendor lock-in |
| No event-driven architecture | Gecko: Service Bus + outbox |
| No real SaaS multi-tenant — hosted single-tenant deployments | Gecko: native DB-per-tenant SaaS |

**Where CargoWise will beat us.**
- **Pure freight-forwarder buyers.** We are TOS, not a forwarder TMS.
  A forwarder needs quote management, customs filing, accounting —
  CargoWise is purpose-built. We explicitly de-scoped this
  (COMPETITIVE-ANALYSIS.md §9).
- **Combined forwarder + terminal buyers** who already have CargoWise
  for forwarding. Convincing them to run two systems is hard.

**Where we beat them.**
- **Pure terminal / depot buyers** who want depot ops + EDI without
  forwarder-style workflow ceiling.
- **Operators fleeing WiseTech vendor risk.**
- **Modern UX.** Their UI is denser and more dated than even NAVIS.
- **Self-service everything** — customer portals, API access,
  provisioning — all without consultant gates.

**Strategic positioning.** Don't compete head-on with CargoWise on
forwarder operations. **Compete sideways** by being the obvious choice
for the depot / terminal half of combined operators, and intercept
WiseTech-fleeing customers on the terminal side. Our EDI Hub module
(Phase 4) is the bridge — if we publish carrier-EDI compatibility on
par with CargoWise, the terminal side switches even when the
forwarder side stays.

---

### 3A.4 WiseTech Global (the portfolio risk)

**Positioning.** Australian-listed parent of CargoWise + ContainerChain +
several acquisitions (Envase, Trinium, BlackPearl, Cargosphere,
etc.). Strategy is **"one supply-chain platform"** via aggressive
acquisition. Market cap fluctuated dramatically 2024–2025.

**Why analyse them as a portfolio.** Because in a real RFP, WiseTech's
bid is "CargoWise + ContainerChain + Envase (trucking) — one bill,
one integration." That bundle competes directly with Gecko's "Full
Stack" subscription (TOS + EDI + VBS + Trucking + Fleet + M&R).

**Strengths.**
- **Bundle story.** Single vendor for forwarder + terminal + trucker.
- **Cross-product data sharing** (in theory — execution patchy).
- **Acquisition firepower.** Can buy any modern competitor that gets
  traction.
- **Sales scale.** Global teams, established procurement relationships.

**Weaknesses.**
- **Integration debt.** Acquisitions sit alongside, not integrated.
  Customers using two WiseTech products often still re-key data.
- **Vendor concentration risk.** Customers increasingly nervous about
  the size of their WiseTech bill.
- **Innovation velocity.** Big-co rhythm — quarterly releases,
  conservative roadmaps. Acquired startups slow down after integration.
- **Founder/governance controversies (2024–2025)** spilling into
  customer confidence.
- **Pricing power, used aggressively.** Renewal increases of 15–30%
  reported.

**Specific gaps vs Gecko.**

| Gap | Gecko advantage |
|-----|-----------------|
| Portfolio is integration-fragmented, not single-platform | Gecko: one modular monolith, one DB topology, one auth, one UI |
| Each acquisition retains its own UX and DB | Gecko: shared design system across all modules |
| Bundled pricing not transparent | Gecko: per-module flat subscription, public pricing page |
| Vendor risk concentration is *increasing* with their growth | Gecko: open-source-friendly stack, schema is standard SQL |

**Where WiseTech will beat us.**
- **Mega-deals with global 3PLs / forwarders** that need a single
  vendor for compliance. We aren't pitching there in Phase 1–4.
- **Stickiness.** Once a customer has CW + CC + Envase, switching is
  expensive even when painful.

**Where we beat them.**
- **Single-platform truth.** Our 5 modules + Master + Platform all
  share one DbContext convention, one event bus, one auth. WiseTech's
  acquisitions don't.
- **Independent operators wary of WiseTech concentration.** Active
  pipeline.
- **Modern UX delta is widening, not closing.**
- **SEA-native vs WiseTech AU-centric heritage.**

**Strategic positioning.** **Treat WiseTech as the portfolio risk to
position against.** In SEA pitches, the line is: *"You can buy
CargoWise + ContainerChain + Envase and run three integrations, or
you can run Gecko."* Single-vendor message + lower TCO + modern UX is
the wedge.

---

### 3A.5 Envision — the mid-tier mirror

**Positioning.** Envision Enterprise Solutions (US-based, mid-tier
container TOS vendor). Customers are small-mid container terminals,
ICDs, off-dock yards in Americas, MENA, parts of SEA. Direct
competitor in our SME wheelhouse.

**Customer profile.** 50K–500K TEU/year terminals. Typical TCO
$1–4M over 5 years.

**Strengths.**
- **Coverage of TOS basics.** Yard, gate, billing, CFS, EDI — all
  present.
- **Lower price than NAVIS.** A real consideration for mid-tier.
- **Faster implementation than NAVIS.** 3–6 months typical.
- **Decent customer support reputation.**

**Weaknesses.**
- **Limited feature depth.** Multi-vessel complex stowage, dense
  scheduling, advanced equipment optimisation — they don't try.
- **Not truly SaaS.** Each customer is a hosted single-tenant
  deployment. Operational scaling is linear.
- **UI is functional but not delightful.** Mid-2010s web tech.
- **EDI is COPARN/CODECO baseline.** CUSCAR, MOVINS, BAPLIE depth
  weaker than NAVIS / CargoWise.
- **Trucking, M&R, Fleet** all not in product. Integrate or live
  without.
- **No VBS / appointment system in product.**
- **Reporting lags.** Operational DB doubles as reporting DB.
- **Customisation limited** without vendor engagement.

**Specific gaps vs Gecko.**

| Gap | Gecko advantage |
|-----|-----------------|
| Single-tenant hosted deployments | Gecko: native multi-tenant DB-per-tenant SaaS |
| No VBS / appointment booking | Gecko Phase 4.5 VBS module |
| No integrated trucking | Gecko Phase 5 |
| No integrated M&R | Gecko Phase 6 |
| Polling-based UI | Gecko: event-driven + Redis pub/sub |
| Reporting on operational DB | Gecko: reporting replica (Phase 5+) |
| Mid-2010s UI | Gecko: 2026 design system |
| No customer self-service portal | Gecko: role-scoped views in same UI |

**Where Envision will beat us.**
- **Existing references.** They've been at it 15+ years; we are new.
- **Year 1 inbound** — operators searching for a mid-tier TOS find
  Envision before they find us.

**Where we beat them.**
- **Modern stack.** They will not rewrite their UI / event model in
  the next 3 years. We start there.
- **Full breadth.** TOS + EDI + VBS + Trucking + Fleet + M&R, all on
  one platform.
- **SEA-native.** Their SEA footprint is thin.
- **Sub-30-day onboarding.** They quote 3–6 months. We can quote 30
  days because tenant provisioning is automated.

**Strategic positioning.** **Envision is the mid-tier mirror — we
look exactly like them but with a 5-year tech advantage and broader
module suite.** Win deals on (a) modern UX, (b) module bundle (they
can't sell trucking + M&R), (c) faster onboarding, (d) per-tenant
region for SEA data residency.

---

### 3A.6 Summary — who to fear in each phase

| Phase | Primary threat | Why | Our response |
|-------|---------------|-----|--------------|
| **1 (Identity + Master)** | None — pre-revenue | We're not selling yet | Ship the foundation |
| **2 (TOS operational)** | ContainerChain | SEA depot operators evaluating their first modern system | Lead with "Full TOS at ContainerChain's depot price" |
| **3 (Billing)** | ContainerChain + Envision | Our differentiator becomes real — D&D engine, multi-currency billing | Public D&D rule examples; case study from pilot |
| **4 (EDI Hub)** | CargoWise on EDI breadth | Forwarders need carrier-EDI parity | Publish supported message matrix; partner certifications |
| **4.5 (VBS)** | ContainerChain — direct counter-punch | This is the deal we steal | VBS-only bundle for legacy-TOS operators |
| **5 (Trucking)** | WiseTech (Envase) | Trucker dispatch consolidation pitches | Bundle pricing + single-platform message |
| **6 (M&R)** | None major in SME segment | Most competitors don't offer this | Differentiator — close M&R-led deals |
| **7 (Fleet)** | Generic fleet vendors | Out of TOS scope, but our customers want it | Integration story; do not over-build |
| **8+ (Up-market)** | NAVIS, TBA, TGI | When we approach mid-tier mainline | Stowage depth + crane optimisation gaps real; partner or build |

---

## 4. SME-specific differentiation

The big incumbents priced themselves out of SME and mid-tier markets. This is
**our addressable market**, often dismissed by the giants.

### Who is the SME terminal / depot?
- Small inland container depots (5K–50K TEU/year)
- CFS operators handling LCL cargo
- Off-dock container yards
- Trucking-haulage operators wanting integrated dispatch
- 3PLs running depot + trucking + M&R as a combined service

### What they want, in priority order
1. **Predictable, low monthly cost** — $200–2000/month, not $20K/month
2. **Implementation in days, not months** — they have no IT team
3. **Works on the equipment they have** — laptops, tablets, no special hardware
4. **Multilingual** — Thai, Vietnamese, Bahasa, Spanish, Portuguese
5. **Local compliance built-in** — Thai Customs, Indian DGFT, ASEAN single window
6. **Customer-facing portal included** — their customers self-serve, reduces phone calls
7. **Simple billing** — no per-user surprises, no over-broker integrations

### How Gecko delivers all of this

| Want | Gecko delivery | What we already have |
|------|----------------|---------------------|
| Predictable cost | Per-module flat subscription, unlimited users | Subscription service in `Platform` (designed) |
| Days to onboard | Self-service tenant provisioning + sample data seed | Architecture supports it; admin UI Phase 0 |
| Works on existing kit | Next.js responsive UI, runs in any modern browser | **Already shipped** — UI works on laptop/tablet |
| Multilingual | i18n via resource files, Phase 4+ | UI uses gecko design tokens, easy to localize |
| Local compliance | Per-region modules (`tos.compliance.thai`, `tos.compliance.india`) | Architecture leaves room — config-driven |
| Customer portal | Same UI, role-scoped views | **Auth model + role-scoped queries** — built into design |
| Simple billing | Per-tenant per-module flat pricing | Subscription service design |

---

## 5. The reliability moat — why customers stay

Reliability is the most commonly cited reason terminals stay with NAVIS despite
its problems: "It works, even if we hate it." We need to match that operational
reliability while keeping our cost / UX edge. Here's how:

| Reliability concern | How Gecko addresses it |
|---|---|
| **Data integrity** | Every state change in DB transaction with outbox event. SQL Server temporal tables for free history. RLS for tenant isolation. Defense in depth. |
| **Idempotency** | Every state-changing endpoint accepts `Idempotency-Key`. Replay-safe. Critical for unreliable mobile networks. |
| **Event delivery** | Outbox pattern ensures no event is lost between DB commit and bus publish. MassTransit retries + DLQ. |
| **Disaster recovery** | Azure SQL geo-replication. Point-in-time restore per tenant. Documented RTO 4h / RPO 15min. |
| **Observability** | Every request has a trace ID. Every error logs with tenant + user + correlation. App Insights dashboards. |
| **Predictable performance** | Per-tenant DB = no noisy neighbour. Elastic Pool DTU monitored, auto-scale before pain. |
| **Backwards-compatible API** | API versioning (v1, v2). Events versioned. Deprecation policies documented. Integrators sleep at night. |
| **Audit trail for legal** | Every action recorded with who/when/what. Defensible in customs / port authority disputes. |
| **Security posture** | Azure AD B2C MFA. TLS 1.3. SQL TDE. RLS. Regular dependency audits. SOC 2 path documented (Phase 5+). |
| **Open data, no lock-in** | Export everything to CSV / parquet. Standard SQL schema. Customer can leave if we fail them. |

---

## 6. Where the giants will respond — and our defenses

Realistic threat model: when Gecko gains traction, incumbents will respond.

### Threat 1: Price cut on smaller customers
**What they'll do:** NAVIS / CargoWise launch a "lite" tier for SMEs.
**Why it won't save them:** Their codebase is 20+ years of monolithic legacy.
A "lite" UX won't ship in under 2 years.
**Our defense:** Stay 24 months ahead by extending modules, not rewriting.

### Threat 2: Acquihire / OEM partnerships
**What they'll do:** Acquire a modern competitor to plug the UX gap.
**Why it won't save them:** Acquisitions in this space have a poor track record
(WiseTech itself has had multiple failed integrations).
**Our defense:** Maintain modular architecture. Each module is acquirable
on its own (defensible exit strategy too).

### Threat 3: Aggressive lock-in pricing for existing customers
**What they'll do:** Existing customers locked into multi-year contracts.
**Why it won't save them:** Customers actively seeking exits — that's our
inbound pipeline.
**Our defense:** Migration tooling. Provide a "from NAVIS" / "from CargoWise"
ETL path. Make switching painless.

### Threat 4: Spreading FUD on reliability
**What they'll do:** "Can a startup really run your terminal?"
**Why it might work:** Reasonable concern.
**Our defense:**
- Pilot with a credible regional terminal (LCB ICD).
- Public uptime / incident transparency (status page).
- SOC 2 Type II by Phase 5.
- Sponsor industry events with operator testimonials.

---

## 7. Our 7 defensible moats (ranked by durability)

### Moat 1 (strongest): Modern UX + open data
**Why durable:** Incumbents can't rewrite their UI without rewriting their
codebase. We have 5+ year head start.

### Moat 2: Per-module pricing + per-tenant isolation
**Why durable:** Their licensing models are baked into their sales orgs. Hard
to change without alienating large existing customers.

### Moat 3: Sub-30-day onboarding via self-service
**Why durable:** Their consultant ecosystems are profit centres. They cannot
self-cannibalise.

### Moat 4: Open APIs from day 1
**Why durable:** They've spent decades not opening up. Reversing that takes a
generation.

### Moat 5: Real-time event-driven architecture
**Why durable:** Polling-based architectures are hard to migrate to event-driven
without a full rebuild.

### Moat 6: Native multi-region SaaS
**Why durable:** Hosted legacy is tied to specific data centres.

### Moat 7 (weakest, most replicable): Modular monolith → microservices path
**Why weak:** This is just good engineering. They can do it too eventually.
**Why we still win:** First-mover advantage compounds in this market.

---

## 8. The summary line

> **Gecko wins because the giants are too big to fix what's broken about
> them — and too small to outpace a modern stack designed for SaaS economics
> and SME affordability.**
>
> We are not trying to outbuild NAVIS on stowage planning depth in year 1. We
> are taking the 80% of operators they ignore (SME terminals, depots, CFS,
> trucking) and giving them software that doesn't make them want to scream.
> Then we extend up-market — module by module, tenant by tenant.

---

## 9. What we will NOT do (intentional gaps)

To stay focused, we explicitly de-prioritise:

| What | Why we won't do it |
|------|--------------------|
| Rail / intermodal terminal ops | Different domain, different customer. Maybe Phase 8+. |
| Berth planning at scale of mega-ports (10M+ TEU/year) | Different problem class. Stay with mid-tier where the math works. |
| Crane optimisation algorithms | Specialised, low ROI. Integrate with third-party (TBA, Konecranes) instead. |
| Customs broker module | Heavy regulatory load. Integrate with existing brokers via EDI. |
| Liner shipping module (line-side) | We are terminal-side. Stay there. |
| Forwarder TMS (CargoWise overlap) | Different buyer. We are TOS, not freight forwarder system. |

These boundaries protect the focus. SMEs don't need rail intermodal. They
need a TOS that works.

---

## 10. Action items (next 90 days)

These are the only things that matter for proving the competitive position:

- [ ] **Pilot tenant signed** (LCB ICD or similar regional player)
- [ ] **Status page live** (status.gecko-tos.com)
- [ ] **Public OpenAPI docs** for TOS Master Data module
- [ ] **Public pricing page** with per-module flat tiers
- [ ] **Two case studies** from existing UI demo (yes, demo is enough early)
- [ ] **Migration tool: NAVIS export → Gecko import** (POC for one entity)

The product is (mostly) ready. The proof points are what's missing.
