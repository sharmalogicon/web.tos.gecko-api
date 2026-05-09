# Gecko Master DB — SQL artefacts

Phase 1 deliverable. Run against the SQL Server instance you want to host
Gecko Master databases.

## Files

```
db/master/
├── README.md                          (this file)
├── 01-create-database.sql             ← run ONCE per tenant to create the DB
├── migrations/
│   ├── 0001_initial_schema.sql        ← creates all 23 tables, indexes, checks
│   └── 0002_temporal_and_rls.sql      ← enables temporal tables + RLS policy
├── rollback/
│   └── 0001_rollback.sql              ← drops everything (dev re-runs)
└── etl/
    └── (per-entity migration scripts — Phase 1 next deliverable)
```

## How to run (Phase 1 dev — single tenant `dev`)

```bash
# 1. Create the database (uses SQLCMD variables for tenant slug)
sqlcmd -S "DESKTOP-6AQI384\APPIFY" -U sa -P manager -i 01-create-database.sql

# 2. Apply schema migration
sqlcmd -S "DESKTOP-6AQI384\APPIFY" -U sa -P manager -d gecko_master_dev \
       -i migrations/0001_initial_schema.sql

# 3. Apply temporal + RLS
sqlcmd -S "DESKTOP-6AQI384\APPIFY" -U sa -P manager -d gecko_master_dev \
       -i migrations/0002_temporal_and_rls.sql
```

## How to onboard a new tenant later (e.g. SCT)

Edit `01-create-database.sql`, change the SQLCMD variable:
```
:setvar TENANT_SLUG "sct"
```

Then run all three scripts pointing at `gecko_master_sct`. Same schema,
fresh tenant DB.

## Verification (after running 0001 + 0002)

```sql
-- Should return 23 user tables
SELECT COUNT(*) AS table_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'dbo' AND t.name <> N'sysdiagrams';

-- Should return 18 history tables (temporal-versioned tables)
SELECT COUNT(*) AS history_count
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'history';

-- Should return 1 active security policy
SELECT name, is_enabled
FROM sys.security_policies
WHERE name = N'gecko_master_tenant_isolation';
```

Expected output: 23 dbo tables, 18 history tables, RLS policy enabled.

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
