/* ==========================================================================
   Gecko Master DB — Temporal Tables + RLS (Migration 0002)
   --------------------------------------------------------------------------
   Run AFTER 0001_initial_schema.sql.

   Two concerns, intentionally bundled because they're both "switch-ons" of
   already-created tables:

   1. Activate SQL Server temporal tables (system-versioned) for free history
      audit. History tables are auto-created in the [history] schema.
      Replaces the legacy AuditID xml column pattern.

   2. Create Row-Level Security (RLS) policy that filters every row by
      tenant_id matching SESSION_CONTEXT('tenant_id'). Defense in depth:
      EF Core global query filters are layer 1, this RLS policy is layer 2.

   Tables EXCLUDED from temporal versioning (low value, high write churn):
     - legacy_migration_log    (ETL log; itself an audit table)
     - movements / holds / container_conditions / container_types  (lookup-style;
       changes are rare and the SCD tracking via row_version is enough)

   Tables EXCLUDED from RLS (no tenant_id column):
     - none — every table has tenant_id.
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== 0002_temporal_and_rls.sql starting at ' + CONVERT(NVARCHAR, SYSDATETIMEOFFSET(), 121);

-- ==========================================================================
-- SECTION A — Activate temporal tables
-- ==========================================================================

-- Helper: temporal tables need PERIOD columns. Add them, then enable
-- SYSTEM_VERSIONING with a history table in the [history] schema.

DECLARE @sql NVARCHAR(MAX);

-- Tables to enable system versioning (master entities with audit value)
DECLARE @temporal_tables TABLE (table_name NVARCHAR(128) PRIMARY KEY);

INSERT INTO @temporal_tables VALUES
  (N'companies'),
  (N'branches'),
  (N'yards'),
  (N'yard_blocks'),
  (N'parties'),
  (N'party_aliases'),
  (N'customer_extensions'),
  (N'shipping_line_extensions'),
  (N'haulier_extensions'),
  (N'forwarder_extensions'),
  (N'contacts'),
  (N'vessels'),
  (N'ports'),
  (N'locations'),
  (N'charge_codes'),
  (N'charge_code_variants'),
  (N'order_types'),
  (N'commodities');

-- Note: lookup-style tables (movements, holds, container_conditions,
-- container_types, order_type_movements, order_type_charges) are excluded —
-- they change rarely and audit is via row_version + manual change events.

DECLARE @table NVARCHAR(128);
DECLARE temporal_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT table_name FROM @temporal_tables;

OPEN temporal_cursor;
FETCH NEXT FROM temporal_cursor INTO @table;

WHILE @@FETCH_STATUS = 0
BEGIN
  -- Add PERIOD columns
  SET @sql = N'
    ALTER TABLE dbo.' + QUOTENAME(@table) + N' ADD
      sys_start DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN
        CONSTRAINT df_' + @table + N'_sys_start
        DEFAULT SYSUTCDATETIME() NOT NULL,
      sys_end   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN
        CONSTRAINT df_' + @table + N'_sys_end
        DEFAULT CONVERT(DATETIME2(3), N''9999-12-31 23:59:59.9999999'') NOT NULL,
      PERIOD FOR SYSTEM_TIME (sys_start, sys_end);';
  EXEC sp_executesql @sql;

  -- Enable system versioning, history table in [history] schema
  SET @sql = N'
    ALTER TABLE dbo.' + QUOTENAME(@table) + N' SET (
      SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = history.' + QUOTENAME(@table) + N',
        DATA_CONSISTENCY_CHECK = ON,
        HISTORY_RETENTION_PERIOD = 7 YEARS
      )
    );';
  EXEC sp_executesql @sql;

  PRINT N'  Temporal versioning enabled on dbo.' + @table + N' (history.' + @table + N')';

  FETCH NEXT FROM temporal_cursor INTO @table;
END

CLOSE temporal_cursor;
DEALLOCATE temporal_cursor;
GO

-- ==========================================================================
-- SECTION B — Row-Level Security policy
-- ==========================================================================

-- The fn_tenant_filter function was created in 0001_initial_schema.sql.
-- Apply it as a security policy across every tenant-scoped table.

CREATE SECURITY POLICY dbo.gecko_master_tenant_isolation

  -- Org hierarchy
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.companies,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.companies AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.companies AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.branches,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.branches AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.branches AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yards,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yards AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yards AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_blocks,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_blocks AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_blocks AFTER UPDATE,

  -- Parties
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.parties,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.parties AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.parties AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.party_aliases,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.party_aliases AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.party_aliases AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.customer_extensions,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.customer_extensions AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.customer_extensions AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.shipping_line_extensions,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.shipping_line_extensions AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.shipping_line_extensions AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.haulier_extensions,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.haulier_extensions AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.haulier_extensions AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.forwarder_extensions,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.forwarder_extensions AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.forwarder_extensions AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.contacts,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.contacts AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.contacts AFTER UPDATE,

  -- Master entities
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.vessels,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.vessels AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.vessels AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.ports,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.ports AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.ports AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.locations,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.locations AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.locations AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_types,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_types AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_types AFTER UPDATE,

  -- Charges
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_codes,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_codes AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_codes AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_code_variants,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_code_variants AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.charge_code_variants AFTER UPDATE,

  -- Order types
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.movements,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.movements AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.movements AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_types,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_types AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_types AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_movements,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_movements AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_movements AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_charges,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_charges AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.order_type_charges AFTER UPDATE,

  -- Holds + container conditions
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.holds,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.holds AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.holds AFTER UPDATE,

  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_conditions,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_conditions AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.container_conditions AFTER UPDATE,

  -- Commodities
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.commodities,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.commodities AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.commodities AFTER UPDATE,

  -- Migration log (also tenant-scoped — even ETL respects RLS, except db_owner)
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.legacy_migration_log,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.legacy_migration_log AFTER INSERT

WITH (STATE = ON, SCHEMABINDING = ON);
GO

PRINT N'  RLS policy gecko_master_tenant_isolation enabled across 23 tables';
GO

PRINT N'== 0002_temporal_and_rls.sql complete';
PRINT N'';
PRINT N'   To use the DB from app code:';
PRINT N'     EXEC sp_set_session_context @key=N''tenant_id'', @value=@tenant_uuid;';
PRINT N'   Then all queries auto-filter by tenant_id.';
PRINT N'';
PRINT N'   To bypass RLS for migration / backfill (db_owner only):';
PRINT N'     ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = OFF);';
PRINT N'     -- run ETL --';
PRINT N'     ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = ON);';
GO
