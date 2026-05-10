# Gecko Master DB — SQL artefacts

Phase 1 deliverable. Run against the SQL Server instance you want to host
Gecko Master databases.

## Files

```
db/master/
├── README.md                              (this file)
├── 01-create-database.sql                 ← run ONCE per tenant to create the DB
├── migrations/
│   ├── 0001_initial_schema.sql            ← creates 23 tables, indexes, checks
│   ├── 0002_temporal_and_rls.sql          ← enables temporal tables + RLS policy
│   ├── 0003_master_gaps_close.sql         ← adds 9 gap-close tables (incoterms,
│   │                                        document_types, customer_tiers,
│   │                                        tax_codes, direction/service/cargo
│   │                                        decomposition, yard_rows/yard_slots)
│   ├── 0004_master_gaps_temporal_rls.sql  ← extends temporal + RLS to the new tables
│   └── 0005_seed_lookups.sql              ← per-tenant seed data (movements,
│                                            holds, container types, service
│                                            types, tax codes for SEA region)
├── rollback/
│   └── 0001_rollback.sql                  ← drops everything (dev re-runs)
└── etl/
    └── (per-entity legacy → new ETL scripts — Phase 1 next deliverable)
```

## How to run (Phase 1 dev — single tenant `dev`)

```bash
SERVER='DESKTOP-6AQI384\APPIFY'
DB=gecko_master_dev

# 1. Create the database (uses SQLCMD variables for tenant slug)
sqlcmd -S "$SERVER" -U sa -P manager -i 01-create-database.sql

# 2. Initial schema (23 tables)
sqlcmd -S "$SERVER" -U sa -P manager -d "$DB" -i migrations/0001_initial_schema.sql

# 3. Temporal + RLS for initial schema
sqlcmd -S "$SERVER" -U sa -P manager -d "$DB" -i migrations/0002_temporal_and_rls.sql

# 4. Gap-close tables (incoterms, document_types, etc., + order_types decomposition)
sqlcmd -S "$SERVER" -U sa -P manager -d "$DB" -i migrations/0003_master_gaps_close.sql

# 5. Temporal + RLS for gap-close tables
sqlcmd -S "$SERVER" -U sa -P manager -d "$DB" -i migrations/0004_master_gaps_temporal_rls.sql

# 6. Seed per-tenant reference data (movements, holds, container types, etc.)
sqlcmd -S "$SERVER" -U sa -P manager -d "$DB" -i migrations/0005_seed_lookups.sql
```

## How to onboard a new tenant later (e.g. SCT)

Edit `01-create-database.sql`, change the SQLCMD variable:
```
:setvar TENANT_SLUG "sct"
```

Then run all three scripts pointing at `gecko_master_sct`. Same schema,
fresh tenant DB.

## Verification (after running all 5 migrations)

```sql
-- Should return 27 dbo tables (23 from 0001 + 4 from 0003: service_types, tax_codes, yard_rows, yard_slots)
SELECT COUNT(*) AS dbo_table_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'dbo' AND t.name <> N'sysdiagrams';

-- Should return 5 lookup tables (system-wide reference, no tenant_id)
SELECT COUNT(*) AS lookup_table_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'lookup';

-- Should return 20 history tables (18 from 0001 + 2 from 0003 — service_types + tax_codes)
SELECT COUNT(*) AS history_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'history';

-- Should return 1 active security policy (covers dbo tables only — lookup is system-wide, no RLS)
SELECT name, is_enabled
FROM sys.security_policies
WHERE name = N'gecko_master_tenant_isolation';

-- Verify seed data loaded
SELECT 'lookup.direction_types'      AS table_name, COUNT(*) AS rows FROM lookup.direction_types
UNION ALL SELECT 'lookup.cargo_classes',            COUNT(*) FROM lookup.cargo_classes
UNION ALL SELECT 'lookup.customer_tiers',           COUNT(*) FROM lookup.customer_tiers
UNION ALL SELECT 'lookup.incoterms',                COUNT(*) FROM lookup.incoterms
UNION ALL SELECT 'lookup.document_types',           COUNT(*) FROM lookup.document_types
UNION ALL SELECT 'dbo.movements (tenant)',          COUNT(*) FROM dbo.movements
UNION ALL SELECT 'dbo.holds (tenant)',              COUNT(*) FROM dbo.holds
UNION ALL SELECT 'dbo.container_conditions',        COUNT(*) FROM dbo.container_conditions
UNION ALL SELECT 'dbo.container_types (tenant)',    COUNT(*) FROM dbo.container_types
UNION ALL SELECT 'dbo.service_types (tenant)',      COUNT(*) FROM dbo.service_types
UNION ALL SELECT 'dbo.tax_codes (tenant)',          COUNT(*) FROM dbo.tax_codes;
```

Expected:
- 27 dbo tables, 5 lookup tables, 20 history tables, RLS policy enabled
- lookup.direction_types = 5, lookup.cargo_classes = 7, lookup.customer_tiers = 6, lookup.incoterms = 11, lookup.document_types = 30
- dbo.movements = 8, dbo.holds = 7, dbo.container_conditions = 10, dbo.container_types = 12
- dbo.service_types = 11, dbo.tax_codes = 8

## Schema convention

| Schema | Purpose | Tenant-scoped? | RLS applied? | Temporal? |
|--------|---------|----------------|--------------|-----------|
| `dbo` | Per-tenant operational + reference data | Yes (`tenant_id` column on every table) | Yes | Yes (audit-worthy) |
| `lookup` | System-wide reference data (industry standards, app-defined enums) | No | No (shared by all tenants) | No (low churn) |
| `history` | Temporal-table history (auto-managed) | Inherits from source | Inherits | n/a |

## Tenant context for app connections

The app sets the tenant context per-request before issuing any query:

```sql
EXEC sp_set_session_context @key = N'tenant_id', @value = @tenant_uuid;
```

After that, every query auto-filters to that tenant only. Cross-tenant
queries return zero rows (RLS blocks them silently).

## Bypass RLS for ETL / migration

Only `db_owner` can bypass:
```sql
ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = OFF);
-- run ETL scripts with explicit tenant_id values --
ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = ON);
```

The `dbo.fn_tenant_filter` function also returns true for `db_owner` so
SSMS sessions running as `sa` can see all rows for debugging.

## What's NOT here yet (Phase 1 next steps)

- ETL scripts per entity (`etl/01-companies.sql`, etc.) — to migrate
  data from the legacy `Vector` DB
- Seed data for lookups (`migrations/0003_seed_lookups.sql`) — initial
  movements, holds, container conditions
- EF Core entities + DbContext (`src/master/Gecko.Master.Infrastructure/`) —
  C# code consuming this schema
- Identity DB schema (`db/identity/`) — companion deliverable
