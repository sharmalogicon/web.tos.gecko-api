# Gecko Platform — Architecture

> Single source of truth. Update when decisions change — do not let the
> codebase drift away from this doc.

**Last updated:** 2026-05-13
**Owner:** Sharma (founding architect)
**Status:** Locked for Phase 1 (Identity + Master Data). Re-review before Phase 2.

---

## 1. Mission

SaaS Terminal Operating System platform competing with NAVIS N4, CargoWise One,
and Envision — modern, open, modular, SME-affordable, **SEA-native** (Thailand,
Malaysia, Singapore, Indonesia, Vietnam, Philippines), without sacrificing the
operational depth the giants are known for.

Target customer profile (Phase 1):
- Inland Container Depots (ICDs): LCB ICD, Westports ICDs, Tanjung Priok hinterland
- Off-dock terminals and CFS operators
- Mid-tier 3PLs running depot + trucking + M&R combined
- Forwarders subscribing to EDI-only
- Container-trucking operators wanting integrated dispatch + fleet

---

## 2. Locked Stack Decisions

| Layer | Choice |
|-------|--------|
| Frontend | **Next.js 16 (App Router) + TypeScript** |
| API | **ASP.NET Core 9** |
| Background workers | **.NET Worker Service** |
| ORM | **EF Core 9** (commands/writes) + **Dapper** (hot reads, reports) |
| Database | **Azure SQL — Elastic Pools, DB-per-tenant per module** |
| Cache | **Azure Cache for Redis** |
| Inter-module bus, in-process | **MediatR** |
| Inter-module bus, cross-process | **Azure Service Bus** + **MassTransit** |
| Auth | **Azure AD B2C** (OIDC + SAML, MFA, custom policies) |
| Edge | **Azure Front Door (Standard)** → APIM later for the developer portal |
| Hosting | **Azure Container Apps** (now) → AKS only when warranted |
| Observability | **Application Insights** + **Log Analytics**, OpenTelemetry traces |
| Object storage | **Azure Blob Storage** |
| Search | **Azure AI Search** (Phase 3+) |
| Functions | **Azure Functions** — webhooks, scheduled jobs, file-drop EDI parsers |
| CI/CD | **GitHub Actions** + Azure deploy tasks |

### Decisions explicitly NOT chosen

| Rejected | Reason |
|----------|--------|
| Microservices from day 1 | Solo dev. Modular monolith with strict module boundaries first; extract later when scale demands. |
| Self-managed AKS at the start | 200+ hours/year of cluster ops we don't need to pay yet. |
| Self-managed Nginx | Front Door is cheaper than the labour. |
| PostgreSQL | Switching engine + adding SaaS multi-tenancy + redesigning schema = three changes at once = failure pattern. |
| Roll-your-own JWT | 4–6 weeks dev + ongoing security tax. AD B2C handles SSO/MFA/SAML/audit/compliance out of box. |
| Node.js for the API | Two-language business logic = bug surface. EF Core + SQL Server = best in class with C#. |
| GraphQL | OpenAPI/REST is enough for one frontend. Reconsider in Phase 4 if integrators demand it. |

---

## 3. Modules

### Module taxonomy

The platform has three tiers, **and the Master tier is its own bounded context** —
not a sub-domain of TOS.

```
Tier 1 — PLATFORM (1 instance, shared globally across all tenants)
├── Identity              — users, roles, MFA secrets, tenant memberships
├── Subscription          — which modules each tenant has access to
├── Audit Log             — every state change across all modules + tenants
├── Notifications         — email / push / in-app
├── Reference Data        — countries, currencies, FX rates, time zones,
│                           UN/LOCODE catalog, ISO codes, holiday calendars
└── File Storage          — Blob abstractions, signed URLs, retention policy

Tier 2 — MASTER (per tenant, foundation for all operational modules)
└── Master Data           — customers, lines, vessels, ports, container types,
                            charge codes, commodities, locations, holds,
                            order types, lookups (per-tenant business reference)

Tier 3 — OPERATIONAL (per tenant, per module — only created if subscribed)
├── TOS                   — bookings, movements, yard, gate, CFS, billing
├── EDI Hub               — message inbox/outbox, partner configs, templates
├── Gate Appointments     — VBS slots, trucker/vehicle registration, booking,
│   (a.k.a. VBS)            queue smoothing  (see docs/db-design/CONTAINERCHAIN-GAPS.md)
├── Trucking & Haulage    — dispatch, trips, drivers, fuel
├── Fleet                 — vehicle registry, preventive maintenance
└── Equipment M & R       — damage inspection, repair work orders, chargeback
```

### Module dependency graph

```
                 ┌────────────────────────┐
                 │   PLATFORM (shared)     │
                 │   Identity, Subs,       │
                 │   Audit, RefData, ...   │
                 └───────────┬─────────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │   MASTER (per tenant)   │
                 │   customers, lines,     │
                 │   ports, vessels, ...   │
                 └───────────┬─────────────┘
                             │
        ┌────────┬───────────┼───────────┬────────┬────────┐
        ▼        ▼           ▼           ▼        ▼        ▼
      [TOS]    [EDI]      [VBS]      [Trucking] [Fleet] [M&R]
   (per ten)  (per ten)  (per ten)   (per ten)  (per ten)(per ten)
```

**Operational modules read Master via API or replicated read-model.** They never
join across DBs. Master is the source of truth for `customer.id`, `line.code`,
`port.locode`, `vessel.imo`, `container_type.iso_code`, etc.

### Module-specific extensions of master entities

A `customer` in Master DB carries the **base record**: code, name, country,
contact. Each operational module that consumes a customer has its own
**extension table** in its own DB, joined by `customer_id`:

```
Master DB:
  customers           (id, code, name, country, ...)

TOS DB:
  customer_extensions (customer_id, credit_limit, default_tariff_id,
                       bill_to_role, consignee_role, ...)

Trucking DB:
  customer_extensions (customer_id, billing_rate_card_id,
                       preferred_driver_id, payment_terms_days, ...)

M&R DB:
  customer_extensions (customer_id, damage_chargeback_rule,
                       preferred_repair_grade, ...)
```

Same pattern for `vessels` (TOS extends with stowage params, EDI extends with
partner mappings), `ports` (TOS extends with local lift charges, Trucking
extends with trip-time defaults), and so on.

### Phase scope

| Phase | Scope | Output |
|-------|-------|--------|
| 1 | Platform (Identity, Subs, RefData) + Master DB schema + tenant onboarding. **Includes:** `notification_templates` + `notification_subscriptions` in Platform DB (closes ContainerChain Gap 4 — see CONTAINERCHAIN-GAPS.md). | Self-service tenant provisioning works |
| 1.5 | Master DB gap-close additions: `carrier_hire_terms`, `depot_locations` (foundations for ECP workflow). | Empty Container Park workflow modelable |
| 2 | TOS — booking, yard, gate, CFS. **Includes:** `ecp_hires` (empty hire-out/return movements) and `release_readiness` projection (closes ContainerChain Gaps 2 & 3). | First operational tenant runs gate-in/out + ECP |
| 3 | TOS — billing, statement, invoicing | Charges → invoices → receipts |
| 4 | EDI Hub — COPARN, CODECO, COARRI, BAPLIE, IFTMIN, CUSCAR | Live partner connection |
| **4.5** | **Gate Appointments (VBS) module** — appointment_slots, appointment_bookings, trucker_registrations, vehicle_registrations, appointment_audit_events, slot_availability_cache. Trucker self-service portal. Closes ContainerChain Gap 1 (the biggest competitive gap). | Trucker books a 30-min slot, arrives, gate-in matches by appointment_id |
| 5 | Trucking & Haulage | Dispatch + trip lifecycle integrated with TOS |
| 6 | Equipment M & R | Damage inspection → work order → chargeback |
| 7 | Fleet | Vehicle registry + preventive maintenance |

See [docs/db-design/CONTAINERCHAIN-GAPS.md](docs/db-design/CONTAINERCHAIN-GAPS.md)
for the four ContainerChain gaps and the schemas that close them across
Phase 1 / 1.5 / 2 / 4.5.

---

## 4. Tenancy & Database Topology

### The model

```
GLOBAL SHARED  (1 instance each, multi-region replicated)
─────────────────────────────────────────────────────────
gecko_platform     — tenants, tenant_subscriptions, modules,
                     reference_data (countries, currencies, FX rates,
                     UN/LOCODE, time zones, holidays)
gecko_identity     — users, roles, role_permissions, tenant_users
                     (junction — a user can belong to multiple tenants),
                     mfa_secrets, password_history
gecko_audit        — append-only event store of every action across
                     all tenants + modules (write-only from apps,
                     read by audit reports)

PER TENANT  (N tenants × M subscribed modules, in Azure SQL Elastic Pools)
─────────────────────────────────────────────────────────
master_<tenant>    — Always provisioned. Tenant's business reference data.
                     customers, lines, vessels, ports, container_types,
                     charge_codes, commodities, locations, holds,
                     order_types, lookups.

tos_<tenant>       — Provisioned if tenant subscribes to TOS.
                     bookings, units, movements, yard slots, gate visits,
                     cfs_operations, charges, invoices, statements.

edi_<tenant>       — Provisioned if tenant subscribes to EDI.
                     edi_messages (raw + parsed), partners, templates,
                     transmission_log, dlq.

vbs_<tenant>       — Provisioned if tenant subscribes to Gate Appointments.
                     appointment_slots, appointment_bookings,
                     trucker_registrations, vehicle_registrations,
                     appointment_audit_events, slot_availability_cache.

trucking_<tenant>  — Provisioned if tenant subscribes to Trucking.
                     trips, dispatch_plans, drivers, fuel_log.

fleet_<tenant>     — Provisioned if tenant subscribes to Fleet.
                     vehicles, maintenance_schedules, service_records.

mnr_<tenant>       — Provisioned if tenant subscribes to M&R.
                     work_orders, damage_records, parts_inventory,
                     repair_estimates.
```

### Subscription bundles — what each tenant actually gets

| Bundle | Use case | DBs |
|--------|----------|-----|
| **EDI-only** | Forwarder integrating with carriers | gecko_platform + gecko_identity + gecko_audit + master + edi |
| **Depot Lite** | Small ICD running depot ops | + tos |
| **Depot Lite Plus** | Depot + empty container park hire workflow | + tos (with ECP tables) |
| **Depot + EDI** | Mid-tier ICD with carrier EDI | + tos + edi |
| **VBS-only** | Terminal already on legacy TOS but wants gate-appointment booking | + vbs (TOS read-model via events) |
| **Terminal Pro** | ICD with appointment-controlled gate | + tos + vbs |
| **Trucking-only** | Haulage operator with fleet | + trucking + fleet |
| **Full Stack** | Full terminal (e.g., LCB ICD) | + tos + edi + vbs + trucking + fleet + mnr |

### Why this topology

| Concern | How it's addressed |
|---------|-------------------|
| Tenant isolation (legal & technical) | Hard isolation at DB level. Cross-tenant query is physically impossible. |
| Per-tenant scale (noisy neighbour) | Each tenant's DTU is theirs. Heavy users don't impact others. |
| Per-tenant region / data residency | Tenant DBs deployable in their preferred Azure region. PDPA / UU PDP / Cybersecurity Law compliant by construction. |
| Per-tenant backup / restore | Native Azure SQL point-in-time per DB. Restore one tenant without touching others. |
| Module subscription | A tenant without M&R subscription has no `mnr_<tenant>` DB. Zero cost, zero exposure. |
| Schema migration N-fold cost | EF Migrations + automated rollout pipeline. New schema deployed across all tenant DBs in parallel via deploy job. |
| Cross-tenant analytics (platform-level) | Audit DB + Reference Data DB are global. Platform-level dashboards (active tenants, revenue, support tickets) query these. Operational cross-tenant analytics not supported by design — that's a feature. |
| Cross-tenant user (consultant, auditor) | `gecko_identity.tenant_users` junction. One sign-in, switch tenant in UI. |

### Defense in depth — three layers of tenant isolation

1. **EF Core global query filters** auto-inject `WHERE tenant_id = @currentTenant`
2. **SQL Server Row-Level Security policies** enforce the same at the DB layer
3. **Tenant routing at connection level** — `IDbConnectionResolver` picks the
   correct per-tenant DB connection string based on `JWT.tid` claim, before
   any query runs

If any of layers 1–3 is bypassed, the others still hold. Belt + suspenders +
seatbelt.

### Tenant resolution flow

```
Incoming HTTP request
  ↓
Front Door (TLS, WAF)
  ↓
Container App (Gecko.Api)
  ↓
Auth middleware:
  - Validate JWT against AD B2C
  - Extract claims: sub (user_id), tid (tenant_id), modules[], roles[]
  ↓
Tenancy middleware:
  - ITenantContext.SetCurrent(tid)
  - Verify tenant subscription includes the module being called
    (return 403 if not — "Your subscription doesn't include EDI Hub")
  ↓
Connection resolver:
  - Lookup connection string for `<module>_<tenant>` from secrets
  - Cached for request scope
  ↓
DbContext factory:
  - Returns ModuleDbContext bound to the resolved connection
  - Global query filters auto-applied
  ↓
MediatR handler runs
```

This entire flow is transparent to handler code. Handlers just inject
`IXxxDbContext` and write business logic. The framework handles tenancy.

---

## 5. Inter-Module Communication

Three patterns, used together:

### 5.1 Domain Events (asynchronous, primary)

Source publishes, subscribers react. Cross-DB consistency is **eventual** —
acceptable for everything except in-transaction atomicity.

| Source → event | Subscribers |
|---------------|-------------|
| TOS → `container.gated_in` | EDI (CODECO), Billing (Lift-In auto-charge), M&R (queue inspection if customs hold), Audit |
| TOS → `container.gated_out` | EDI (CODECO), Trucking (close trip), Billing (Lift-Out), Audit |
| TOS → `container.loaded` | EDI (COARRI), Billing (stop storage accrual), Audit |
| TOS → `booking.created` | EDI (draft COPARN), Trucking (pre-create dispatch slot), Audit |
| EDI → `coparn.received` | TOS (create/update booking), Trucking (pre-create dispatch), Audit |
| EDI → `baplie.received` | TOS (voyage stowage plan), Audit |
| EDI → `cuscar.acked` | TOS (clear customs hold if successful), Audit |
| Trucking → `trip.completed` | TOS (gate-out), Fleet (mileage), Billing (haulage charge), Audit |
| M&R → `repair.completed` | TOS (release container), Billing (cost recovery to line), Audit |
| Fleet → `vehicle.in_maintenance` | Trucking (dispatch availability), Audit |
| Master → `customer.updated` | TOS (refresh extension cache), Trucking (refresh), Billing (refresh) |

### 5.2 Synchronous REST queries

When module A needs **current state** from module B:

| Caller → Callee | Example |
|-----------------|---------|
| Trucking → TOS | `GET /api/v1/tos/bookings/{no}` — current booking state |
| TOS → EDI | `GET /api/v1/edi/messages?reference={bookingNo}` — message history |
| Any → Master | `GET /api/v1/master/customers/{id}` — customer lookup |
| Any → Identity | `GET /api/v1/identity/users/{id}` — user info |

Each module exposes versioned APIs (`/api/v1/`, `/api/v2/`). OpenAPI specs
published per module.

### 5.3 Read replicas / cached projections

For read-hot data that doesn't need to be exactly current:
- Each module caches Master Data lookups (charge codes, ports, container types)
  in **Redis** with TTL of 5 min and pub/sub invalidation on `*.updated` events
- TOS keeps a denormalized projection of relevant Master data via event
  subscription — no synchronous Master API call on the hot booking path

### 5.4 Outbox pattern (reliability)

State changes write to an **`outbox` table in the same DB transaction** as the
business write. A relay process polls the outbox and publishes to Service Bus,
marking rows published. Solves the dual-write problem.

```sql
CREATE TABLE outbox (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id UNIQUEIDENTIFIER NOT NULL,
  topic NVARCHAR(100) NOT NULL,
  event_type NVARCHAR(200) NOT NULL,
  event_version INT NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  correlation_id UNIQUEIDENTIFIER NULL,
  causation_id UNIQUEIDENTIFIER NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  published_at DATETIMEOFFSET NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error NVARCHAR(MAX) NULL,
  INDEX ix_outbox_unpublished (published_at) WHERE published_at IS NULL
);
```

### 5.5 Idempotency

Every state-changing endpoint accepts an `Idempotency-Key` header. The
handler stores the key + result in a per-module `idempotency_log` table.
Replays return the cached result. Critical for unreliable mobile networks
(gate clerks on tablets in poor coverage).

---

## 6. Solution Structure (.NET)

```
gecko-api/
├── src/
│   ├── shared/
│   │   ├── Gecko.SharedKernel              — DDD primitives (Entity, ValueObject,
│   │   │                                     DomainEvent, Result<T>, etc.)
│   │   ├── Gecko.SharedInfra                — EF base, Outbox, EventBus,
│   │   │                                     Tenant resolver, Idempotency
│   │   └── Gecko.SharedContracts            — DTOs + event contracts
│   │                                          (referenced by every module)
│   │
│   ├── platform/
│   │   ├── Gecko.Platform.Identity.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Subscription.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Audit.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Notifications.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.ReferenceData.{Domain,Application,Infrastructure}
│   │   └── Gecko.Platform.FileStorage.{Domain,Application,Infrastructure}
│   │
│   ├── master/
│   │   └── Gecko.Master.{Domain,Application,Infrastructure}
│   │       — customers, lines, vessels, ports, container_types, charge_codes,
│   │         commodities, locations, holds, order_types, lookups
│   │
│   ├── modules/
│   │   ├── Gecko.Tos.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Edi.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Trucking.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Fleet.{Domain,Application,Infrastructure}
│   │   └── Gecko.Mnr.{Domain,Application,Infrastructure}
│   │
│   ├── hosts/
│   │   ├── Gecko.Api                        — ASP.NET Core HTTP host
│   │   └── Gecko.Worker                     — Worker Service (background)
│   │
│   └── functions/
│       ├── Gecko.Functions.EdiInbound       — Webhook + file-drop EDI receivers
│       └── Gecko.Functions.CustomsInbound   — Customs SW callbacks
│                                              (TradeNet, NSW, INSW, VNACCS)
│
├── tests/
│   ├── unit/                                — fast, no I/O
│   ├── integration/                         — Testcontainers for SQL + Service Bus
│   └── contract/                            — API contract tests per module
│
├── deploy/
│   ├── docker/
│   ├── azure/                               — Bicep
│   ├── github-actions/
│   └── tenant-provisioning/                 — scripts to create new tenant DBs
│
├── docs/
│   ├── ARCHITECTURE.md                      (this doc)
│   ├── DOMAIN-MODEL.md                      (per-module entity diagrams)
│   ├── API-CONVENTIONS.md
│   ├── EDI-MESSAGE-CATALOG.md
│   ├── CUSTOMS-INTEGRATION.md
│   └── adrs/
│
└── gecko.sln
```

### Per-module layering (clean architecture)

```
{Module}.Domain
  └── Pure C#. Entities, value objects, domain events, repository interfaces.
      No infrastructure references. No EF. No HTTP.

{Module}.Application
  └── MediatR command/query handlers, business logic, validators (FluentValidation),
      domain event dispatch. Depends on Domain only.

{Module}.Infrastructure
  └── EF Core DbContext, repository implementations, external service adapters,
      message bus consumers/producers. Depends on Application + Domain.

Hosts (Gecko.Api, Gecko.Worker) wire everything via the IModuleStartup contract.
```

### IModuleStartup

```csharp
public interface IModuleStartup
{
    string Name { get; }
    string ApiVersion { get; }
    void RegisterServices(IServiceCollection services, IConfiguration config);
    void MapEndpoints(IEndpointRouteBuilder endpoints);
    void RegisterEventConsumers(IBusRegistrationConfigurator bus);
}
```

Adding a new module = add the projects + register `IModuleStartup` in
`Program.cs`. **No circular references between modules.** Static analyzer
enforced via NetArchTest in CI.

---

## 7. Identity & Auth

### Provider: Azure AD B2C with custom policies

- OIDC + SAML for enterprise SSO (terminals integrating with their corporate AD)
- MFA, password reset, social login (when relevant for SME tenants)
- Custom policies for tenant-scoped sign-up and tenant-switching
- JWT access tokens (1 hour TTL), refresh tokens managed by client SDK

### Tenant membership model

```sql
-- gecko_identity.users          : the user identity (1 record per person)
-- gecko_identity.tenants        : not duplicated; FK to gecko_platform.tenants
-- gecko_identity.tenant_users   : many-to-many junction
--   user_id, tenant_id, default_tenant (bool), created_at

-- A user can belong to multiple tenants (consultants, auditors,
-- multi-terminal operators). UI shows tenant switcher in header.
```

### JWT claims contract

```json
{
  "sub": "user-id-uuid",
  "tid": "tenant-id-uuid",         // currently active tenant
  "tnm": "LCB ICD",
  "tids": ["...", "..."],          // all tenants the user can access
  "modules": ["tos", "edi"],       // modules subscribed by current tenant
  "roles": ["dispatcher"],         // roles within current tenant
  "perms": ["booking.create",      // fine-grained permissions
            "charge.waive"],
  "exp": 1234567890
}
```

### Authorization

- **RBAC + permissions**: roles map to permission sets, checked at handler level
- ASP.NET Core policies: `[Authorize(Policy = "BookingCreate")]`
- Module-scoped: a user with `tos.dispatcher` role gets nothing in `trucking`
- Audit captures every authorization decision (allow + deny) at sensitive endpoints

---

## 8. Data & Persistence

### Schema conventions
- `snake_case` table and column names
- Plural table names: `bookings`, not `booking`
- PK is always `id` (UNIQUEIDENTIFIER, sequential GUID via `NEWSEQUENTIALID()`)
- FK named `<entity>_id`: `booking_id`, not `booking`
- Audit columns on every table (no exceptions):
  - `tenant_id UNIQUEIDENTIFIER NOT NULL` (drives RLS)
  - `created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()`
  - `created_by UNIQUEIDENTIFIER NOT NULL`
  - `updated_at DATETIMEOFFSET NOT NULL`
  - `updated_by UNIQUEIDENTIFIER NOT NULL`
  - `deleted_at DATETIMEOFFSET NULL` (soft delete on master + reference, NOT on transactional)
  - `row_version ROWVERSION` (optimistic concurrency)
- **SQL Server temporal tables** for history audit (free, indexed, queryable)

### Money — multi-currency, SEA-aware

```sql
-- Two-column pattern, always together:
amount       DECIMAL(19,4) NOT NULL,
currency     CHAR(3)       NOT NULL,    -- ISO 4217: THB, SGD, MYR, IDR, VND, USD, ...
amount_local DECIMAL(19,4) NULL,        -- in tenant's base currency (denormalized)
fx_rate      DECIMAL(19,8) NULL,        -- locked at transaction time, not 'now'
fx_rate_at   DATETIMEOFFSET NULL,
```

**Decimal precision per region:**
- SGD, MYR, USD, EUR: 2 decimals — but stored as 4 to handle pro-rating without round-trip loss
- THB: 2 decimals (the satang is real but rarely billed; stored as 4)
- IDR: effectively no fractional unit (sen is dead). Stored DECIMAL(19,4) for consistency, displayed as integer
- VND: same — no fractional unit in practice
- PHP: 2 decimals (centavo)

Display formatting is the UI's problem. Storage uses one consistent shape.

### Time — timezone-aware everywhere

- Every timestamp: `DATETIMEOFFSET` (UTC + offset stored)
- Display layer converts to tenant timezone (`Asia/Bangkok`, `Asia/Singapore`,
  `Asia/Jakarta`, `Asia/Ho_Chi_Minh`, `Asia/Manila`, `Asia/Kuala_Lumpur`)
- **Never** use `DATETIME` without timezone. Old WinForms apps almost
  always store local time without TZ — that's a migration trap.
- Vessel ETD, gate cutoffs, customs windows: all UTC-stored, locally-displayed
- Cron jobs (overnight billing, FX update) scheduled in **UTC**, with
  per-tenant override possible

### Codes & free text
- `VARCHAR(N)` with explicit max for codes (`container_no VARCHAR(11)`,
  `locode CHAR(5)`, `currency CHAR(3)`)
- `NVARCHAR(N)` for human-readable names (international names need Unicode:
  Thai นิตยสาร, Vietnamese tiếng Việt, Indonesian, Chinese for some shipper names)
- `NVARCHAR(MAX)` only for truly free-form fields (notes, remarks, EDI payload)
- Customer / vessel / commodity name often arrives in mixed scripts —
  Unicode by default, no exceptions

### Migration tool
- **EF Core Migrations** (code-first)
- One migration per logical schema change, descriptive name
- All migrations idempotent and rollback-safe
- Production migrations applied via release pipeline, never manually
- For tenant DB deploys: rolling fan-out — apply to one DB, verify, then
  parallelise across the pool

### Read/write split
- Default: EF Core for write-side
- Hot read paths: **Dapper** + raw SQL for performance (booking lookup,
  charge code resolution, dashboard tiles, gate-clerk recall)
- Reporting / analytics: read replica + dedicated reporting DB (Phase 5+),
  populated via change data capture from operational DBs

### Referential integrity — no physical FK constraints

We do **not** create physical FK constraints on operational DBs. Every
reference is a "logical FK" enforced by application code + index +
reconciliation. See ADR-007 for rationale.

**Companion disciplines (non-negotiable):**

1. **Index every `<entity>_id` column.** CI lints reject `*_id` columns
   without an accompanying index. Composite indexes when the column is
   part of a tenant-scoped query (`(tenant_id, customer_id)`).

2. **Naming convention** for cross-module references. Within a module DB,
   `<entity>_id` points to `<entity>.id` in the same DB. Across module
   boundaries, prefix the source module: `master_customer_id` →
   `master.customers.id` (different DB).

3. **Nightly reconciliation jobs** in `Gecko.Worker` (Quartz scheduled,
   per-tenant) detect orphans and either auto-cleanup, alert, or page
   depending on severity. Logged to `gecko_audit`.

4. **EF Core configuration** uses `HasOne().WithMany().HasForeignKey()`
   for navigation property setup, but a custom `NoForeignKeyConvention`
   strips constraint generation from migrations. Indexes still emitted.

5. **Logical-reference documentation** per module in `docs/DOMAIN-MODEL.md`
   lists every cross-table reference (source, source column, target,
   target column, cross-DB flag). This is the join graph for BI consumers
   and onboarding.

**The reporting DB (Phase 5+) gets FK constraints added back** — purely
for BI tool join detection. Operational DBs stay FK-less.

---

## 9. Background Work & Events

### Service Bus topology

```
Topic: master-events
  Subscriptions: tos-master-listener, edi-master-listener,
                 trucking-master-listener, audit-all

Topic: tos-events
  Subscriptions: edi-tos-listener, billing-tos-listener,
                 mnr-tos-listener, trucking-tos-listener, audit-all

Topic: edi-events
  Subscriptions: tos-edi-listener, audit-all

Topic: trucking-events, fleet-events, mnr-events — same pattern

Topic: customs-events  (events from CUSCAR/CUSREP processing)
  Subscriptions: tos-customs-listener, audit-all
```

### Event versioning

```csharp
public abstract record DomainEvent(
    Guid EventId, Guid TenantId, DateTimeOffset OccurredAt,
    string EventType,    // "container.gated_in"
    int Version,         // schema version
    Guid? CorrelationId,
    Guid? CausationId
);
```

- Events are immutable. Add fields only by bumping `Version`.
- Consumers tolerate unknown fields (forward-compat).
- Removing or renaming a field = new version + dual publish for grace period.
- Schema registry: per-event JSON schema in `Gecko.SharedContracts/Events/`.

### Retry & DLQ
- MassTransit: 3 immediate retries, then exponential backoff up to 5 attempts
- After max attempts → subscription DLQ
- DLQ depth alert in App Insights at > 10
- Manual replay tooling in admin UI (Phase 4+)
- **Poison message handler**: messages that fail validation (not transient
  errors) go straight to DLQ with diagnostic payload

---

## 10. Deployment Topology

### Production

```
                            [Custom domain]
                                  │
                       [Azure Front Door]  ─── WAF, TLS, geo-routing
                                  │
              ┌───────────────────┴───────────────────┐
              │                                        │
       [Vercel — Next.js]                  [Azure Container Apps env]
        (UI render, BFF route)         ┌───────────┼───────────┐
                                       │           │           │
                                  [Gecko.Api]  [Gecko.Worker] [Functions]
                                  (n replicas) (n replicas)   (event-driven)
                                       │           │
                                       └─────┬─────┘
                                             │
   ┌──────────┬──────────┬──────────┬─────┐  │  ┌──────┬──────┬──────────┐
   ▼          ▼          ▼          ▼     ▼  ▼  ▼      ▼      ▼          ▼
[Platform] [Identity] [Audit]   [Master  Pool — Per-tenant] [Service [Redis]
 DB]        DB         DB]         tos / edi / trucking /   Bus]
                                   fleet / mnr DBs
                                                                 │
                                                                 ▼
                                                          [Blob Storage]
                                                                 │
                                                                 ▼
                                                  [App Insights + Log Analytics]
                          ▲
                          │
                  [Azure AD B2C]
                  (auth)
```

### Multi-region (Phase 5+)

- Tenants in **Thailand / Indonesia / Vietnam** require in-region data
  residency (UU PDP, Cybersecurity Law). Tenant DBs deployed in:
  - `southeastasia` (Singapore region) — default for SG/MY/PH
  - Future: `indonesia-central` (Jakarta) when Azure GA — for ID tenants
  - Future: in-region for VN when local Azure region opens; meanwhile
    Singapore region may meet the Personal Data Protection Decree if
    DPO + cross-border transfer agreement is in place
- Platform DB + Identity DB: geo-replicated (read replicas in each region)
- Service Bus: per-region with cross-region forwarding for
  tenant→platform events only

### Environments
- **dev** — single shared resource group, smallest tier
- **staging** — production-shape, smaller scale, real partner sandboxes
  (TradeNet sandbox, e-Customs UAT)
- **prod** — full scale, multi-region from Phase 5

### CI/CD
- One GitHub Actions workflow per host
- Build → unit test → integration test (Testcontainers SQL + Service Bus
  emulator) → push image to ACR
- Deploy: dev auto, staging on PR merge, prod on tag
- DB migrations applied as part of deploy step (EF Migrations are idempotent)

---

## 11. Naming Conventions

### Code
- C# classes / methods: `PascalCase`
- C# private fields: `_camelCase`
- C# constants: `PascalCase`
- TypeScript: `camelCase` for variables, `PascalCase` for types/components
- File names match the primary type

### URLs / API
- Path segments: `kebab-case` — `/api/v1/tos/charge-codes`
- Query params: `camelCase` — `?customerId=...`
- JSON: `camelCase` (auto via `System.Text.Json`)
- Resource paths: plural, hierarchical
  - `GET /api/v1/master/customers`
  - `GET /api/v1/tos/bookings/{bookingNo}/units`

### Database
- Tables: `snake_case`, plural
- Columns: `snake_case`
- Indexes: `ix_<table>_<columns>` — `ix_bookings_tenant_id_etd`
- FKs: `fk_<from>_<to>` — `fk_bookings_customers`
- Check constraints: `ck_<table>_<rule>`
- Stored procedures (rare): `usp_<verb>_<noun>` — `usp_recalc_storage_charges`

### Events
- Type: `domain.action_past_tense` — `container.gated_in`, `booking.created`
- Topic: `<module>-events` — `tos-events`
- Subscription: `<consumer>-<source>-listener` — `edi-tos-listener`

### Git
- Branches: `feat/`, `fix/`, `chore/`, `refactor/`
- Commits: Conventional Commits

---

## 12. Observability

### Logging
- Structured via Serilog (sink → App Insights + Log Analytics)
- Every log: `tenantId`, `userId`, `traceId`, `module`, `correlationId`
- Log levels:
  - `Information`: business events (`booking.created`, `charge.waived`)
  - `Warning`: recoverable (`fx_rate_stale`, `partner_endpoint_slow`)
  - `Error`: handled bug or external failure
  - `Critical`: pages someone

### Tracing
- **OpenTelemetry** auto-instrumentation
- W3C trace context propagated through HTTP + Service Bus headers
- One trace = full lifecycle of a user action across modules

### Metrics
- Custom counters: `bookings_created_total`, `edi_messages_dlq_total`,
  `charges_waived_amount_total`, `tenant_dtu_pct`
- Standard ASP.NET metrics for ops
- Per-tenant slicing on every metric — drill from "errors are up" to
  "errors are up *for tenant X*"

### Alerts
- 5xx rate > 1% over 5 min → page
- Service Bus DLQ depth > 10 → page
- Outbox publish lag > 30s → warn
- Tenant DTU > 80% sustained 5 min → warn (suggests DB tier bump)
- EDI partner endpoint failure rate > 5% over 15 min → warn
- Customs single-window submission failure > 0 → page (regulatory)

---

## 13. Cross-Cutting Concerns

| Concern | Solution |
|---------|----------|
| Validation | FluentValidation in Application layer. RFC 7807 problem details on errors. |
| Mapping | Mapster (faster than AutoMapper, simpler). |
| Time | `IClock` injected. No `DateTimeOffset.UtcNow` direct in handlers. |
| Currency conversion | Platform.ReferenceData provides FX. Locked at transaction time. |
| PII | TDE at rest + TLS 1.3 in transit. PII columns documented. |
| Feature flags | Microsoft.FeatureManagement + Azure App Configuration. Per-tenant overrides. |
| Localization | Resource files. Phase 1: English. Phase 4: Thai, Bahasa Malaysia, Bahasa Indonesia, Vietnamese. |

---

## 14. SEA Regional Concerns

This is not generic SaaS. Specific compliance and integration requirements
that shape the architecture:

### 14.1 Data residency & privacy

| Country | Law | Implication for Gecko |
|---------|-----|----------------------|
| **Thailand** | PDPA 2019 (effective 2022) | Personal data of Thai data subjects requires DPO, lawful basis, breach notification within 72h. **Region:** Singapore region acceptable with cross-border transfer agreement; in-Thailand region not yet on Azure but acceptable on AWS Bangkok. |
| **Singapore** | PDPA 2012 + amendments | Less strict residency, but Cybersecurity Act + sectoral rules apply for terminal operators (CII designation possible for major ports). |
| **Malaysia** | PDPA 2010 (amended 2024) | Localization not strict; consent + DPO requirements. Cross-border to "white-listed" jurisdictions (Singapore included). |
| **Indonesia** | UU PDP 2022 (effective 2024) | **Strict.** Indonesian personal data must be processable from Indonesia. Azure does not yet have an Indonesia region with full feature parity — Phase 5+ migration when `indonesia-central` is GA. Until then: Singapore region with documented transfer mechanism + DPO. |
| **Vietnam** | Cybersecurity Law 2018, Decree 53/2022 | Local data storage required for "Vietnamese citizen data" by foreign service providers. Practical compliance: Singapore region + Vietnamese local copy via replication is the common pattern. |
| **Philippines** | Data Privacy Act 2012 | DPO required, breach notification, NPC registration. Cross-border permitted with adequacy. |

**Architectural answer:** Per-tenant DB region selection at provisioning time.
Platform DB and Identity DB geo-replicated. The DB-per-tenant model makes
this trivial — assign tenant to the region they need.

### 14.2 Customs single-window integration

Each country has its own NSW. EDI Hub must speak each:

| Country | System | EDI dialect | Phase |
|---------|--------|-------------|-------|
| Thailand | NSW (Thai e-Customs) | EDIFACT D.96B + local extensions, XML for newer | Phase 4 |
| Malaysia | uCustoms (post-SMK) | SMK-EDI gradually migrated to JSON/REST | Phase 4 |
| Singapore | TradeNet | EDIFACT, mature, well-documented | Phase 4 |
| Indonesia | INSW + CEISA 4.0 | XML-based, regional | Phase 5 |
| Vietnam | VNACCS / VCIS | XML-based | Phase 5 |
| Philippines | E2M / TRS | EDIFACT + XML | Phase 5+ |

EDI Hub module abstracts these behind a common `ICustomsAdapter` interface.
Per-tenant configuration selects the correct adapter based on
`tenant.country`. Adapter-specific message generation lives in
`Gecko.Edi.Infrastructure.Customs.{Country}`.

### 14.3 Carrier EDI partners — SEA-specific quirks

- **PSA Singapore** (PortNet): EDIFACT, mature, real-time
- **Westports / NPC (Klang)**: file-drop SFTP with EDIFACT, slower turnaround
- **PTP**: API-based, modern
- **LCB ICD operators**: mix — some EDIFACT, some flat files
- **Tanjung Priok (Indonesia)**: INAPORT system, partial EDIFACT
- **Cat Lai / Hai Phong**: Vietnamese local + EDIFACT mix

Adapter pattern in EDI Hub. Each partner gets its own adapter class with
its own quirks documented.

### 14.4 Currencies in active circulation
- **THB** (Thai Baht), **SGD** (Singapore Dollar), **MYR** (Malaysian Ringgit),
  **IDR** (Indonesian Rupiah), **VND** (Vietnamese Dong), **PHP** (Philippine
  Peso), **USD** (cross-border invoicing), occasionally **JPY**, **EUR**, **CNY**
- FX rate source: Platform.ReferenceData syncs daily from a published source
  (Bank of Thailand, MAS, Bank Negara — whichever the tenant prefers as
  authority). Stored with rate timestamp; transaction FX locked at time of
  charge generation.

### 14.5 Time zones & regional ops

- **ICT (UTC+7)**: Thailand, Vietnam, parts of Indonesia (WIB)
- **MYT / SGT (UTC+8)**: Malaysia, Singapore, Brunei, Philippines, parts of
  Indonesia (WITA)
- **WIT (UTC+9)**: Eastern Indonesia
- Vessel ETD, gate cutoffs, customs windows: stored UTC, displayed in tenant TZ
- Holiday calendars per country (Lunar New Year, Hari Raya, Songkran, etc.)
  affect cutoff windows — Platform.ReferenceData carries them
- Operational shifts in SEA terminals: typically 24/7 with shift breaks at
  06:00, 14:00, 22:00 local — affects "effective hours" for D&D calculation

### 14.6 Localization

Phase 1 launches English-only. Phase 4 adds:
- **Thai** (UTF-8, Thai script)
- **Bahasa Malaysia** (Latin script + some Jawi for older docs)
- **Bahasa Indonesia** (Latin)
- **Vietnamese** (Latin with diacritics, normalisation matters)
- **Tagalog / Filipino** (Latin)
- **Simplified Chinese** for some shipper names (Unicode)

Resource files per language. UI components already use design tokens —
swapping language is content-only, layout already handles RTL/long-string
expansion (gate-clerk dropdowns must not break in Thai which is ~20% longer
than English on average).

### 14.7 SME operational realities (informs UX & architecture)

- Many depot operators still rely on Excel + WhatsApp for daily ops.
  Migration tooling needs CSV import for first-day usability.
- Internet reliability variable, especially Indonesian outer islands and
  rural Vietnam. Mobile-first, offline-tolerant where possible (gate
  clerk records movement, syncs when online).
- ERP integrations: SAP B1 (mid-tier), Tally (accounting in India/SEA),
  Oracle EBS at larger players. EDI Hub must be able to push invoice
  data via flat files for the SAP-less middle tier.
- Cash payments still common at gate (small operators). Receipt-printing
  via thermal printer is a real Phase 3 requirement.
- Multi-language operators: Thai gate clerk + English ops manager + Chinese
  shipper name on the bill. UI must handle gracefully without it being a
  feature flag.

---

## 15. Scaling Strategy

### Vertical (within a tenant DB)
1. Indexes from query analysis (Phase 1+)
2. Partitioning of high-volume tables (`unit_movements`, `edi_messages`,
   `audit_events`) by month — Phase 4+
3. Move tenant to higher Elastic Pool tier or dedicated DB if DTU > 70% sustained

### Horizontal (across tenants)
1. Multiple Container Apps replicas (auto-scale on CPU + queue depth)
2. Multi-region deployment for tenants close to their region (Phase 5+)
3. Read replicas for reporting workloads (Phase 5+)
4. Archive DB per tenant (operational ≤ 1 yr, archive 1–7 yr) on cheaper tier

### Module extraction (when monolith hurts)
Triggers to extract a module to its own service:
- Module's deploy cadence diverges (different release schedule)
- Module's scale profile diverges (e.g., EDI peaks at vessel cutoffs)
- Module needs different SLA / region
- Compliance requires module isolation (rare)

Extraction steps:
1. Module already has its own DB → no DB change
2. Move module projects to separate solution, build as separate container
3. Replace in-process MediatR calls with HTTP/event calls
4. Deploy as independent Container App revision
5. Update Front Door routing

This is the **escape hatch** the modular monolith preserves.

---

## 16. Architecture Decision Records

### ADR-001: Modular Monolith over Microservices (2026-05-08)
**Decision:** Build as one .NET solution with strict module boundaries, single
deployable unit until extraction is justified.
**Why:** Solo dev. Microservice ops cost would swamp feature velocity.
Boundaries kept clean enough that extraction later is a 1-week effort.

### ADR-002: DB-per-tenant per module (2026-05-08)
**Decision:** Each tenant has its own DB per module; pooled via Elastic Pools.
**Why:** Hard isolation, per-tenant scale, regulatory simplicity for SEA
data residency.

### ADR-003: Azure AD B2C for identity (2026-05-08)
**Decision:** Use AD B2C, not custom JWT, not Auth0.
**Why:** Native Azure integration, enterprise SSO/SAML out of box, ongoing
security burden owned by Microsoft.

### ADR-004: ASP.NET Core 9 over Node.js (2026-05-08)
**Decision:** API and Worker in C# .NET. UI stays Next.js.
**Why:** Tariff/stowage logic benefits from .NET performance. EF Core +
SQL Server is best-in-class. Avoids two-language business logic.

### ADR-005: Master Data as its own bounded context, not part of TOS (2026-05-08)
**Decision:** `Gecko.Master.*` is a top-level module with its own
per-tenant `master_<tenant>` DB. Operational modules (TOS, EDI, Trucking,
Fleet, M&R) consume Master via API or replicated read-model with extension
tables.
**Why:** EDI-only and Trucking-only tenants need master data without
provisioning a TOS DB. Master is a bounded context in its own right —
its lifecycle, ownership, and audit needs differ from operational data.
**Consequence:** Master is provisioned for every tenant at onboarding,
regardless of which operational modules they subscribe to. Slight cost
overhead per tenant, justified by clean separation.

### ADR-006: Multi-region per-tenant for SEA data residency (2026-05-08)
**Decision:** Per-tenant DB region selectable at provisioning. Platform DB
and Identity DB geo-replicated. Indonesia tenants will migrate to
`indonesia-central` when Azure GA's it.
**Why:** UU PDP (Indonesia), Cybersecurity Law (Vietnam), and PDPA
sectoral rules (Thailand) require region awareness. DB-per-tenant model
makes this near-zero-cost to implement.

### ADR-007: No physical FK constraints on operational DBs (2026-05-09)
**Decision:** Operational module DBs (Master, TOS, EDI, Trucking, Fleet,
M&R) carry **no physical FK constraints**. References between tables are
"logical FKs" — `<entity>_id` columns enforced by:
  - mandatory indexes (CI-linted),
  - application-layer validation in domain handlers,
  - nightly reconciliation jobs in `Gecko.Worker`,
  - explicit naming convention,
  - documented logical-reference list per module.
**Why:**
  - DB-per-tenant per module already prohibits cross-module FKs by topology
    (different physical DBs). The no-FK rule extends that consistency
    within each DB.
  - Faster commits at gate-in/out peak (each gate write touches 4+ tables;
    no FK validation per write).
  - Schema evolution / partitioning / archive moves are constraint-free.
  - Bulk ETL from legacy `Vector` runs without constraint-disable dance.
  - Microservice extraction unchanged — modules already enforce integrity
    in code, not via DB.
**Tradeoffs accepted:**
  - Application bugs can create orphan rows. Reconciliation jobs detect
    these nightly with audit logging + alerts.
  - BI tools lose auto-join detection on operational DBs. Mitigated by
    rebuilding FK constraints in the reporting DB (Phase 5+) and by
    documented logical-reference tables.
  - More EF Core configuration boilerplate. Centralised in a
    `NoForeignKeyConvention` so every module is consistent.
**Reporting DB exception:** the read-replica reporting DB (Phase 5+) will
have FK constraints added back, purely for BI tool consumption. This is a
one-way ETL concern, not an operational design.

### ADR-008: Gate Appointments (VBS) as its own module, not a sub-module of TOS (2026-05-13)
**Decision:** Gate Appointments (Vehicle Booking System) is a top-level
operational module — `vbs_<tenant>` DB, `Gecko.Vbs.*` projects — not a
feature inside `Gecko.Tos.*`.
**Why:**
  - **Standalone monetisable bundle.** Many tenants on legacy NAVIS / Envision
    want to bolt on a modern appointment portal without replacing their TOS.
    "VBS-only" must be deployable without provisioning a `tos_<tenant>` DB.
    The TOS read-model arrives via events (`container.ready_for_pickup`,
    `appointment.booked`).
  - **Different scale profile.** Appointment slot availability queries can
    burst 100× the TOS booking-write rate (truckers refreshing the portal at
    07:00 looking for slots). Keeping it in its own DB avoids polluting the
    TOS query plan cache and DTU budget.
  - **Different consumer.** Truckers / dispatchers are external users with
    their own auth flow (limited-scope JWTs, mobile-first). TOS users are
    internal terminal ops staff. Mixing the two in one DB invites a tenant-
    boundary slip.
  - **Different release cadence.** Appointment policy (no-show penalties,
    cancellation windows, peak-hour pricing) changes far more often than
    core TOS gate logic. Keeping them separate avoids tying core-gate
    deploys to portal-policy tweaks.
**Tradeoffs accepted:**
  - One more DB per "Terminal Pro" tenant (cheap in Elastic Pool, expensive
    in mental model).
  - Cross-DB consistency on `appointment ↔ booking ↔ unit` is eventual, via
    events. Designed with idempotency from the start — `appointment.no_show`
    and `gate_in.recorded` arrive in any order.
**See:** [docs/db-design/CONTAINERCHAIN-GAPS.md](docs/db-design/CONTAINERCHAIN-GAPS.md)
Gap 1 for the full schema and design.

---

## 17. Open Questions

These need decisions before Phase 2:
- [ ] **Reporting DB design** — CDC from operational DBs into a dedicated
      reporting DB (Phase 5+)? Or read replicas of operational DBs?
- [ ] **Tenant onboarding automation** — provisioning a new tenant's
      Platform/Identity entries + Master DB + selected module DBs +
      running migrations + seeding reference data. Will need an admin UI.
- [ ] **Pricing model** — per-module flat per-tenant? Tiered by transaction
      volume? Affects subscription service design.
- [ ] **Holiday & cutoff calendar** — central source per country, or
      per-tenant override? My lean: central with per-tenant override
      capability.
- [ ] **Customs adapter strategy for Phase 4** — build all 6 country
      adapters at once or sequence by tenant demand?
- [ ] **EF Core vs Dapper split rules** — tighter rule than "hot reads use
      Dapper". Document specific patterns in `API-CONVENTIONS.md`.
