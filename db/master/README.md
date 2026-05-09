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
-- Should return 32 user tables (23 from 0001 + 9 from 0003)
SELECT COUNT(*) AS table_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'dbo' AND t.name <> N'sysdiagrams';

-- Should return 20 history tables (18 from 0001 + 2 from 0003 — service_types + tax_codes)
SELECT COUNT(*) AS history_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'history';

-- Should return 1 active security policy
SELECT name, is_enabled
FROM sys.security_policies
WHERE name = N'gecko_master_tenant_isolation';

-- Verify seed data loaded
SELECT 'direction_types'      AS table_name, COUNT(*) AS rows FROM dbo.direction_types
UNION ALL SELECT 'cargo_classes',            COUNT(*) FROM dbo.cargo_classes
UNION ALL SELECT 'customer_tiers',           COUNT(*) FROM dbo.customer_tiers
UNION ALL SELECT 'incoterms',                COUNT(*) FROM dbo.incoterms
UNION ALL SELECT 'document_types',           COUNT(*) FROM dbo.document_types
UNION ALL SELECT 'movements (tenant)',       COUNT(*) FROM dbo.movements
UNION ALL SELECT 'holds (tenant)',           COUNT(*) FROM dbo.holds
UNION ALL SELECT 'container_conditions',     COUNT(*) FROM dbo.container_conditions
UNION ALL SELECT 'container_types (tenant)', COUNT(*) FROM dbo.container_types
UNION ALL SELECT 'service_types (tenant)',   COUNT(*) FROM dbo.service_types
UNION ALL SELECT 'tax_codes (tenant)',       COUNT(*) FROM dbo.tax_codes;
```

Expected:
- 32 dbo tables, 20 history tables, RLS policy enabled
- direction_types = 5, cargo_classes = 7, customer_tiers = 6, incoterms = 11, document_types = 30
- movements = 8, holds = 7, container_conditions = 10, container_types = 12
- service_types = 11, tax_codes = 8

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
