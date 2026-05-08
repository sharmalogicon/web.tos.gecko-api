# Gecko vs the Market — Competitive Analysis

> Honest read of where the incumbents fail, and how Gecko already mitigates
> those gaps using **what we have already built** — without changing our
> business logic, modules, or UI/UX.
>
> **Constraint:** Every "How Gecko wins" claim below maps to capability we
> have already shipped or have committed to building. No vapourware.

**Last updated:** 2026-05-08
**Audience:** Founder + future GTM team

---

## 1. The incumbents — who we're up against

| Vendor | Product | Typical customer | Estimated TCO (5 yr) |
|--------|---------|-----------------|---------------------|
| **NAVIS (Kaleris)** | N4 | Large container terminals, port operators | $5–15M+ |
| **WiseTech Global** | CargoWise One | 3PLs, freight forwarders, terminal operators | $2–8M+ |
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

| Capability | NAVIS N4 | CargoWise | Envision | Tideworks | Solvo | **Gecko** |
|---|---|---|---|---|---|---|
| **Modern web UX** | △ (web wrapper on legacy) | △ (dense, dated) | △ | ✗ | ✗ | **✓ G** |
| **Mobile / responsive** | ✗ | △ | ✗ | ✗ | ✗ | **✓ G** |
| **Native SaaS multi-tenant** | ✗ (hosted legacy) | △ (tenant-aware but old DB) | ✗ | △ | ✗ | **✓ G** |
| **Open APIs (OpenAPI/REST)** | △ (SOAP legacy) | △ (rate-limited, expensive) | ✗ | △ | ✗ | **✓ G** |
| **Real-time event streaming** | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ G** |
| **Per-module pricing** | ✗ | ✓ | △ | △ | ✗ | **✓ G** |
| **Self-service tenant provisioning** | ✗ (months) | ✗ (months) | ✗ | ✗ | ✗ | **✓ G** |
| **Modern observability** | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ G** |
| **In-product audit log** | △ (bolt-on) | △ | ✗ | ✗ | ✗ | **✓ G** |
| **Customer self-service portal** | ✗ ($$$ add-on) | ✗ ($$$ add-on) | ✗ | ✗ | ✗ | **✓ G** (using existing UI) |
| **Sub-30-day onboarding** | ✗ (6–18 mo) | ✗ (6–18 mo) | △ (3–6 mo) | △ | ✗ | **✓ G** |
| **EDI integration depth** | ✓ | ✓ | △ | △ | △ | △ → ✓ (Phase 4) |
| **Tariff & rate flexibility** | ✓ | ✓ | △ | △ | △ | **✓ G** (already designed) |
| **Yard planning & stowage** | ✓ | △ | △ | ✓ | △ | △ → ✓ (Phase 2–3) |
| **Vessel ops & berth planning** | ✓ | △ | △ | ✓ | △ | △ → ✓ (Phase 2) |
| **CFS / depot ops** | △ | ✓ | △ | △ | △ | **✓ G** |
| **Trucking / haulage integrated** | ✗ (separate product) | △ | ✗ | ✗ | ✗ | △ → ✓ (Phase 5) |
| **Equipment M&R integrated** | △ | △ | ✗ | ✗ | ✗ | △ → ✓ (Phase 6) |
| **Fleet / preventive maintenance** | ✗ | ✗ | ✗ | ✗ | ✗ | △ → ✓ (Phase 7) |
| **Multi-region / data residency** | △ | △ | ✗ | ✗ | ✗ | **✓ G** (Azure global) |
| **Customisation without code** | ✗ (XML config hell) | ✗ (XML config hell) | △ | △ | ✗ | **✓ G** (config-driven UI ready) |
| **Monthly cost for SME** | $$$$ | $$$$ | $$$ | $$ | $ | **$ G** |
| **Vendor lock-in escape** | ✗ | ✗ | △ | △ | △ | **✓ G** (open standards) |

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
