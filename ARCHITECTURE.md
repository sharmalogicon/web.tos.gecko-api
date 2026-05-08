# Gecko Platform — Architecture

> Single source of truth for "how Gecko is built." Every backend decision should
> reference this document. Update it when a decision changes — do **not** let
> the codebase drift away from this doc.

**Last updated:** 2026-05-08
**Owner:** Sharma (founding engineer)
**Status:** Locked for Phase 1 (Master Data). Re-review before Phase 2.

---

## 1. Mission

Build a SaaS Terminal Operating System platform that competes with NAVIS N4,
CargoWise One, and Envision — by being **modern, open, modular, and affordable
for SMEs and mid-tier terminals**, without sacrificing the operational depth
the giants are known for.

---

## 2. Locked Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 16 (App Router) + TypeScript** | Already built. Modern, SSR-capable, great DX. |
| API | **ASP.NET Core 9** | Strong typing, EF Core, best SQL Server integration, .NET ecosystem maturity. |
| Background workers | **.NET Worker Service** | Hosted services + Service Bus consumers + scheduled jobs in one process. |
| ORM | **EF Core 9** (default) + **Dapper** (hot read paths) | EF for command/write side, Dapper for query/read side. |
| Database | **Azure SQL — Elastic Pool, DB-per-tenant per module** | Tenant isolation; pool keeps cost manageable. |
| Cache | **Azure Cache for Redis** | Distributed cache, session store, rate limiting, pub/sub. |
| Inter-module bus (in-process) | **MediatR** | Single deployable, fast, transactional. |
| Inter-module bus (cross-process) | **Azure Service Bus** + **MassTransit** | Durable, DLQ, sessions, mature .NET SDK. |
| Auth | **Azure AD B2C** | OIDC, SAML, MFA, enterprise SSO out of the box. |
| Edge | **Azure Front Door (Standard)** | TLS, WAF, geo-routing. APIM added later for the developer portal. |
| Hosting | **Azure Container Apps** (now) → **AKS** (later when complexity warrants) | Managed Kubernetes lite without cluster ops. |
| Observability | **Application Insights** + **Log Analytics** | Single workspace across all modules. |
| Object storage | **Azure Blob Storage** | EDI payloads, EIR scans, repair photos, generated PDFs. |
| Search | **Azure AI Search** (Phase 3+) | Cross-module global search by container/booking. |
| Functions | **Azure Functions** (sparingly) | Webhooks, scheduled jobs, file-drop EDI parsers only. |
| CI/CD | **GitHub Actions** + Azure deploy tasks | One workflow per module; build once, deploy to all envs. |

### Decisions explicitly **not** chosen, and why

| Rejected | Reason |
|----------|--------|
| Microservices from day 1 | Operational overhead kills solo-dev velocity. Monolith first; extract later. |
| Self-managed Kubernetes (AKS) immediately | Cluster ops = 200+ hours/year of work. Container Apps gives the same K8s without it. |
| Self-managed Nginx for edge | Front Door is managed, cheaper than the labour. |
| PostgreSQL | SQL Server muscle memory + existing data + ecosystem. Switching engine while doing SaaS migration = 3 changes at once = failure. |
| Roll-your-own JWT auth | 4–6 weeks of dev + ongoing security tax. Azure AD B2C handles SSO/MFA/audit/compliance. |
| Node.js for the API | Two languages for business logic = bug surface. C# wins for SQL Server-heavy workloads. |
| GraphQL | OpenAPI/REST is enough; GraphQL adds complexity for a single-frontend app. Reconsider in Phase 4 if integrators demand it. |

---

## 3. Modules

### Phase scope
- **Phase 1 (now):** TOS — Master Data
- **Phase 2:** TOS — Booking, Yard, Gate
- **Phase 3:** TOS — Billing & Statement
- **Phase 4:** EDI Hub
- **Phase 5:** Trucking & Haulage
- **Phase 6:** Equipment Maintenance & Repair (M&R)
- **Phase 7:** Fleet

### Modules at a glance

```
GECKO PLATFORM (one tenant fabric)
├── PLATFORM SERVICES (cross-cutting, shared platform DB)
│   ├── Identity & Auth        — users, roles, SSO
│   ├── Subscription & Billing — which modules each tenant has
│   ├── Audit Log              — every action across modules
│   ├── Notifications          — email/push
│   ├── Reference Data         — countries, currencies, time zones, FX
│   └── File Storage proxy     — Azure Blob abstractions
│
├── TOS                          — master data, booking, yard, gate, CFS, billing
├── EDI Hub                      — COPARN, CODECO, COARRI, BAPLIE, MOVINS, CUSCAR
├── Trucking & Haulage           — dispatch, trips, drivers, fuel, billing
├── Fleet                        — vehicle registry, preventive maintenance
└── Equipment M & R              — damage inspection, repair work orders, chargeback
```

### Module ownership

Each module:
- Owns its database (per tenant — see Tenancy)
- Owns its API surface (`/api/v1/{module}/...`)
- Owns its events (publishes to topics it owns)
- Subscribes to events from other modules via clear contracts
- **Never** queries another module's database directly. Always via API or event.

---

## 4. Tenancy Model

### Strategy: **DB-per-tenant per module**, pooled with Azure SQL Elastic Pools

```
Platform DB (1, shared, global)
├── tenants
├── users
├── roles
├── tenant_subscriptions    (which modules each tenant has access to)
└── reference_data

Per-module, per-tenant DBs (N tenants × M modules)
├── tos_lcb_icd
├── tos_sct
├── edi_lcb_icd
├── edi_sct
├── trucking_lcb_icd
└── ...
```

### Why DB-per-tenant
- **Hard isolation** — accidental cross-tenant leaks impossible at the DB layer
- **Per-tenant scale** — noisy neighbour problem solved
- **Per-tenant backup/restore** — compliance-friendly
- **Per-tenant region** — Thai tenant DB in `southeastasia`, Singapore tenant in `singapore`
- **Elastic pools** — many small DBs share resources, cost-effective at idle

### Defense in depth
1. **EF Core global query filters** auto-inject `WHERE tenant_id = @currentTenant`
   ```csharp
   modelBuilder.Entity<Customer>().HasQueryFilter(c => c.TenantId == _tenantContext.Id);
   ```
2. **SQL Server Row-Level Security** as the second line — DB rejects cross-tenant queries even if EF filter is bypassed
3. **Tenant context** comes from JWT claims — set by middleware before any controller code runs

### Tenant resolution flow
```
Request → JWT validated → Claims read → Tenant resolved →
  ITenantContext.SetCurrent(tenantId) → DbContext picks correct connection string
  → All queries auto-filtered.
```

---

## 5. Module Communication Patterns

### Pattern 1 — Domain Events (asynchronous, primary)

When state changes in a module, it **publishes an event**. Other modules subscribe.

| Source | Event | Subscribers |
|--------|-------|-------------|
| TOS | `container.gated_in` | EDI (CODECO), Billing (auto-charge Lift-In), M&R (queue inspection) |
| TOS | `container.gated_out` | EDI (CODECO), Trucking (close trip), Billing (Lift-Out) |
| TOS | `container.loaded` | EDI (COARRI), Billing (stop storage accrual) |
| EDI | `coparn.received` | TOS (create booking), Trucking (pre-create dispatch) |
| EDI | `baplie.received` | TOS (voyage stowage plan) |
| Trucking | `trip.completed` | TOS (gate-out confirmation), Fleet (mileage), Billing (haulage charge) |
| M&R | `repair.completed` | TOS (release container), Billing (cost recovery) |
| Fleet | `vehicle.in_maintenance` | Trucking (dispatch availability update) |

### Pattern 2 — REST APIs (synchronous queries)

Each module exposes versioned APIs (`/api/v1/{module}/...`). OpenAPI/Swagger
docs published per module. Authenticated via Azure AD B2C JWT.

```
Trucking → GET /api/v1/tos/bookings/{no}     — current booking state
Fleet    → GET /api/v1/trucking/vehicles      — truck registry
TOS      → GET /api/v1/edi/messages?ref={no}  — EDI events for this booking
Any      → GET /api/v1/identity/users/me      — current user info
```

### Pattern 3 — Outbox (reliability)

State changes write to **outbox table in same DB transaction** as the
business write. A relay process polls the outbox and publishes to Service Bus,
marking rows published. Solves the dual-write problem.

```sql
-- Per-module DB
CREATE TABLE outbox (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  tenant_id UNIQUEIDENTIFIER NOT NULL,
  topic NVARCHAR(100) NOT NULL,
  event_type NVARCHAR(200) NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  published_at DATETIMEOFFSET NULL,
  attempts INT NOT NULL DEFAULT 0,
  INDEX ix_outbox_unpublished (published_at) WHERE published_at IS NULL
);
```

The outbox publisher runs in `Gecko.Worker`, every 1–2 seconds, batched.

### Idempotency

Every state-changing endpoint accepts an `Idempotency-Key` header.
The handler stores the key + result; replays return the cached result.
Critical for reliable event processing — consumers can retry without
double-applying.

---

## 6. Solution Structure (.NET)

```
gecko-api/
├── src/
│   ├── shared/
│   │   ├── Gecko.SharedKernel              — DDD primitives (Entity, ValueObject, DomainEvent)
│   │   ├── Gecko.SharedInfra                — EF Core base, Outbox, EventBus, Tenant resolver
│   │   └── Gecko.SharedContracts            — DTOs + event contracts (referenced by all modules)
│   │
│   ├── platform/
│   │   ├── Gecko.Platform.Identity.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Subscription.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Audit.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Platform.Notifications.{Domain,Application,Infrastructure}
│   │   └── Gecko.Platform.ReferenceData.{Domain,Application,Infrastructure}
│   │
│   ├── modules/
│   │   ├── Gecko.Tos.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Edi.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Trucking.{Domain,Application,Infrastructure}
│   │   ├── Gecko.Fleet.{Domain,Application,Infrastructure}
│   │   └── Gecko.Mnr.{Domain,Application,Infrastructure}
│   │
│   ├── hosts/
│   │   ├── Gecko.Api                        — ASP.NET Core host (HTTP)
│   │   └── Gecko.Worker                     — Worker Service (background)
│   │
│   └── functions/
│       └── Gecko.Functions.EdiInbound       — Webhook + file-drop EDI receivers
│
├── tests/
│   ├── Gecko.Tos.Tests
│   ├── Gecko.Edi.Tests
│   └── ...
│
├── deploy/
│   ├── docker/                              — Dockerfile per host
│   ├── azure/                               — Bicep / ARM templates
│   └── github-actions/                      — CI/CD workflows
│
├── docs/
│   ├── ARCHITECTURE.md                      — this doc
│   ├── DOMAIN-MODEL.md                      — entity diagrams per module
│   ├── API-CONVENTIONS.md                   — REST conventions, error shapes
│   └── ADRS/                                — architecture decision records
│
└── gecko.sln
```

### Per-module layering

```
{Module}.Domain
  └── Entities, value objects, domain events, repository interfaces.
      Pure C#, no infrastructure references.

{Module}.Application
  └── MediatR command/query handlers, business logic, validators.
      Depends on Domain only.

{Module}.Infrastructure
  └── EF Core DbContext, repository implementations, external service
      adapters. Depends on Application + Domain.

Hosts (Gecko.Api, Gecko.Worker) wire all modules' Infrastructure
into the runtime via IModuleStartup contract.
```

### IModuleStartup

```csharp
public interface IModuleStartup
{
    void RegisterServices(IServiceCollection services, IConfiguration config);
    void MapEndpoints(IEndpointRouteBuilder endpoints);
    void RegisterEventConsumers(IBusRegistrationConfigurator bus);
}
```

Each module implements once. Adding a new module = create the projects + add
one line to `Program.cs`. **No circular references between modules.**

---

## 7. Identity & Auth

### Provider: **Azure AD B2C**

- OIDC + SAML for enterprise SSO
- Built-in MFA, password reset, social login (if needed)
- Custom policies for tenant-scoped sign-up
- JWT access tokens (short-lived, 1 hour)
- Refresh tokens managed by client SDK

### JWT claims contract

```json
{
  "sub": "user-id-uuid",
  "tid": "tenant-id-uuid",
  "tnm": "Laem Chabang ICD",
  "roles": ["dispatcher", "tos-operator"],
  "modules": ["tos", "edi"],
  "exp": 1234567890
}
```

### Authorization model

- **RBAC with module scoping**: `roles` × `modules` matrix
- **Custom policies** in ASP.NET Core for each role
- Every endpoint decorated: `[Authorize(Policy = "TosOperator")]`
- Permissions checked at the handler level for fine-grained operations
  (e.g., "can waive a charge" vs "can view a charge")

### Tenant context middleware

```csharp
public class TenantMiddleware
{
    public async Task InvokeAsync(HttpContext ctx, ITenantContext tenant)
    {
        var tenantId = ctx.User.FindFirst("tid")?.Value;
        if (string.IsNullOrEmpty(tenantId))
            throw new UnauthorizedAccessException("Missing tenant claim.");
        tenant.SetCurrent(Guid.Parse(tenantId));
        await _next(ctx);
    }
}
```

`ITenantContext` is scoped (per-request). Injected into DbContext factory to
choose the correct per-tenant connection string.

---

## 8. Data & Persistence

### Schema conventions
- `snake_case` table and column names
- Plural table names: `bookings`, not `booking`
- PK is always `id` (UNIQUEIDENTIFIER, sequential GUID via NEWSEQUENTIALID)
- FK named `<entity>_id`: `booking_id`, not `booking`
- Audit columns on every table:
  - `tenant_id UNIQUEIDENTIFIER NOT NULL`
  - `created_at DATETIMEOFFSET NOT NULL`
  - `created_by UNIQUEIDENTIFIER NOT NULL` (user id)
  - `updated_at DATETIMEOFFSET NOT NULL`
  - `updated_by UNIQUEIDENTIFIER NOT NULL`
  - `deleted_at DATETIMEOFFSET NULL` (soft delete on master tables only)
- **Temporal tables** for history audit (free, built-in to SQL Server 2016+)

### Data types
- Currency: `DECIMAL(19,4)` + `currency_code CHAR(3)` — never `MONEY`, never `FLOAT`
- Timestamps: `DATETIMEOFFSET` — UTC + offset stored, never naive `DATETIME`
- Codes: `VARCHAR(N)` with explicit max length, never `NVARCHAR(MAX)`
- Free text: `NVARCHAR(N)` for known max, `NVARCHAR(MAX)` only for true free-form

### Migration tool
- **EF Core Migrations** (code-first)
- One migration per logical schema change, descriptive name
- All migrations idempotent and rollback-safe
- Production migrations applied via release pipeline, never manually

### Read/write split
- Default: EF Core
- Hot read paths (booking lookup, charge code resolution, dashboards):
  **Dapper + raw SQL** for performance
- Reporting / analytics: read replica or dedicated reporting DB (Phase 5+)

---

## 9. Background Work & Events

### `Gecko.Worker` host runs:
1. **Outbox publisher** — polls per-module outbox tables, publishes to Service Bus
2. **Service Bus consumers** — subscribe to topics, dispatch to MediatR handlers
3. **Scheduled jobs** — Quartz.NET for cron-like scheduling
4. **Long-running processes** — anything that doesn't fit in an HTTP request

### Service Bus topology

```
Topic: tos-events
  Subscription: edi-tos-listener   (filter: container.* + booking.*)
  Subscription: billing-tos-listener (filter: container.gated_*)
  Subscription: mnr-tos-listener    (filter: container.gated_in)
  Subscription: audit-all           (filter: *)

Topic: edi-events
  Subscription: tos-edi-listener    (filter: coparn.* + baplie.*)
  ...

Topic: trucking-events, fleet-events, mnr-events — same pattern
```

### Event contract

```csharp
public abstract record DomainEvent(
    Guid EventId,
    Guid TenantId,
    DateTimeOffset OccurredAt,
    string EventType,    // "container.gated_in"
    int Version          // for schema evolution
);

public record ContainerGatedIn(
    Guid EventId, Guid TenantId, DateTimeOffset OccurredAt, string EventType, int Version,
    string ContainerNo,
    string BookingNo,
    DateTimeOffset GatedInAt,
    string YardLocation
) : DomainEvent(EventId, TenantId, OccurredAt, EventType, Version);
```

Events are **immutable** and **versioned**. Consumers tolerate unknown fields
forward; producers never remove fields without deprecation.

### Retry & DLQ
- MassTransit retry: 3 immediate, then exponential backoff up to 5 attempts
- After max attempts → message moves to subscription DLQ
- DLQ monitored by Application Insights alerts
- Manual replay tooling in admin UI (Phase 4+)

---

## 10. Deployment Topology

### Production

```
                                [Custom domain]
                                       │
                            [Azure Front Door]
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                  │
       [Vercel: Next.js]                          [Azure Container Apps]
       (renders UI, calls API)                   (one environment)
                                       ┌──────────┼──────────┐
                                       │          │          │
                                  [Gecko.Api]  [Gecko.Worker] [Functions]
                                  (n replicas) (n replicas)   (event-driven)
                                       │          │
                                       └────┬─────┘
                                            │
        ┌──────────────┬─────────────┬─────┼─────┬──────────┬───────────┐
        ▼              ▼             ▼     ▼     ▼          ▼           ▼
  [Azure SQL    [Azure SQL    [Azure SQL  [SB]  [Redis]   [Blob       [App
   Platform DB] Tenant Pool — Tenant Pool —              Storage]    Insights]
                TOS]          EDI]
                                                                      ▲
                                                                      │
                                                              [All components
                                                               send telemetry]
        ▲
        │
  [Azure AD B2C]
```

### Environments
- **dev** — single shared resource group, smallest tier of everything
- **staging** — production-shape, smaller scale
- **prod** — full scale, multi-region (Phase 5+)

### CI/CD
- One GitHub Actions workflow per host (`api`, `worker`, `functions`)
- Build → unit test → integration test (Testcontainers) → push image to ACR
- Deploy: dev auto, staging on PR merge, prod on tag
- DB migrations applied as part of deploy step (idempotent EF migrations)

---

## 11. Naming Conventions

### Code
- **C# classes / methods:** `PascalCase`
- **C# private fields:** `_camelCase`
- **C# constants:** `PascalCase` (not SCREAMING_CASE)
- **TypeScript:** `camelCase` for variables, `PascalCase` for types/components
- **File names:** match the primary type name

### URLs / API
- **Path segments:** `kebab-case` (`/api/v1/tos/charge-codes`)
- **Query parameters:** `camelCase` (`?customerId=...`)
- **JSON properties:** `camelCase` (auto-converted by `System.Text.Json`)

### Database
- **Tables:** `snake_case`, plural (`charge_codes`, `bookings`)
- **Columns:** `snake_case` (`created_at`, `customer_id`)
- **Indexes:** `ix_<table>_<columns>` (`ix_bookings_tenant_id_etd`)
- **FKs:** `fk_<from_table>_<to_table>` (`fk_bookings_customers`)

### Events
- **Event types:** `domain.action_past_tense` (`container.gated_in`, `booking.created`)
- **Topics:** `<module>-events` (`tos-events`, `edi-events`)
- **Subscriptions:** `<consumer>-<source>-listener` (`edi-tos-listener`)

### Git
- **Branches:** `feat/`, `fix/`, `chore/`, `refactor/` prefix
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)

---

## 12. Observability

### Logging
- **Structured** logging via `Microsoft.Extensions.Logging` + Serilog sink
- Every log has: `tenantId`, `userId`, `traceId`, `module`
- Log levels:
  - `Trace`: dev only
  - `Debug`: dev + staging
  - `Information`: business-meaningful events ("booking.created")
  - `Warning`: recoverable issues
  - `Error`: bug or external failure
  - `Critical`: needs paging

### Tracing
- **OpenTelemetry** auto-instrumentation
- W3C trace context propagated through HTTP + Service Bus
- One trace = full lifecycle of a user action across modules

### Metrics
- **Custom counters** for business KPIs (bookings/hour, charges/day, EDI errors)
- **Standard ASP.NET Core metrics** for ops (request rate, latency, error rate)

### Alerts (Application Insights)
- 5xx rate > 1% over 5 min → page
- Service Bus DLQ depth > 10 → page
- Outbox publish lag > 30s → warn
- DTU > 80% sustained 5 min on tenant DB → warn

---

## 13. Cross-Cutting Concerns

| Concern | Solution |
|---------|----------|
| **Validation** | FluentValidation in Application layer. Returns RFC 7807 problem details. |
| **Mapping** | Mapster (faster than AutoMapper, simpler). |
| **Time** | `IClock` abstraction injected everywhere. No `DateTimeOffset.UtcNow` directly in handlers. |
| **Currency conversion** | Platform.ReferenceData provides FX rates. Stored at transaction time. |
| **PII** | Encrypted at rest (Azure SQL TDE) + in transit (TLS 1.3). PII columns documented in `DOMAIN-MODEL.md`. |
| **GDPR / data retention** | 7-year operational retention, then archive DB. Right-to-erasure handled via tombstone (preserve referential integrity, drop personal fields). |
| **Feature flags** | `Microsoft.FeatureManagement` + Azure App Configuration. |
| **Localization** | Resource files per supported language. Initial: English. Phase 4: Thai, Vietnamese, Bahasa. |

---

## 14. Scaling Strategy

### Vertical (within a tenant DB)
1. Indexes from query analysis (Phase 1+)
2. Partitioning of high-volume tables (`unit_movements`, `edi_events`) by month — Phase 4+
3. Move tenant to higher Elastic Pool tier or dedicated DB if DTU consistently > 70%

### Horizontal (across tenants)
1. Multiple Container Apps replicas (auto-scale on CPU + queue depth)
2. Multi-region deployment for tenants close to their region (Phase 5+)
3. Read replicas for reporting workloads (Phase 5+)

### Module extraction (when monolith hurts)
Triggers to extract a module to its own service:
- Module's deploy cadence diverges (different team / release schedule)
- Module's scale profile diverges (e.g., EDI peaks at vessel cutoffs)
- Module needs different SLA / region

Extraction steps:
1. Module already has its own DB → no DB change
2. Move module projects to new solution
3. Replace in-process MediatR calls with HTTP/event calls
4. Deploy as independent Container App revision
5. Update Front Door routing

This is the **escape hatch** the modular monolith preserves. We don't pay
microservice costs unless we benefit from them.

---

## 15. The Big Decisions, Recorded

### ADR-001: Modular Monolith over Microservices (2026-05-08)
**Decision:** Build as one .NET solution with strict module boundaries.
**Why:** Solo dev, 24-month roadmap, 5 modules. Microservice ops cost would
swamp feature velocity. Module boundaries kept clean enough that extraction
later is a 1-week effort, not a rewrite.
**Tradeoff accepted:** All modules deploy together. If TOS needs to scale
independently, that's the trigger to extract.

### ADR-002: DB-per-tenant per module (2026-05-08)
**Decision:** Each tenant has its own DB per module, in Azure SQL Elastic Pools.
**Why:** Hard isolation, per-tenant scale, regulatory simplicity. Pools
keep cost manageable.
**Tradeoff accepted:** Schema migrations are N-fold. Mitigated by
EF Migrations + automated rollout pipeline.

### ADR-003: Azure AD B2C for identity (2026-05-08)
**Decision:** Use Azure AD B2C, not custom JWT, not Auth0.
**Why:** Native Azure integration, enterprise SSO out of the box, lower ongoing
security burden than rolling our own.
**Tradeoff accepted:** UI customisation is more limited than Auth0; custom
policies are a learning curve.

### ADR-004: ASP.NET Core 9 over Node.js (2026-05-08)
**Decision:** API and Worker in C# .NET. UI stays Next.js.
**Why:** Tariff and stowage logic benefit from .NET performance. EF Core +
SQL Server is best-in-class. Avoids two-language business logic.
**Tradeoff accepted:** Two languages overall (TS + C#). Acceptable because
the boundary is clean (UI vs. backend).

---

## 16. Open Questions

These need decisions before Phase 2:
- [ ] **EF Core vs Dapper split** — define exact rules for which queries go
      where (currently "hot reads use Dapper" is too vague).
- [ ] **Migration tool for legacy data** — direct ETL via SQL scripts, or
      Azure Data Factory? Lean SQL scripts.
- [ ] **Tenant onboarding automation** — provisioning a new tenant DB +
      running migrations + seeding reference data. Will need an admin UI.
- [ ] **Pricing model** — per-module, per-user, per-tenant flat? Affects
      subscription service design.
- [ ] **Multi-region timing** — Thailand-only at launch, multi-region from
      Phase 5? Or build region-aware now?
