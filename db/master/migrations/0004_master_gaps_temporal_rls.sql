/* ==========================================================================
   Gecko Master DB — Temporal + RLS extensions for gap-close tables (0004)
   --------------------------------------------------------------------------
   Run AFTER 0003_master_gaps_close.sql.

   Activates SYSTEM_VERSIONING on the new tenant-scoped tables, and extends
   the RLS policy gecko_master_tenant_isolation to cover them.

   Excluded from temporal versioning (no real audit value, low churn):
     - direction_types     (~5 rows, app-defined, system-wide)
     - cargo_classes       (~7 rows, app-defined, system-wide)
     - customer_tiers      (~6 rows, app-defined, system-wide)
     - incoterms           (11 rows, ISO standard)
     - document_types      (~30 rows, app-defined)
     - yard_rows           (optional, low write churn)
     - yard_slots          (optional, low write churn)

   Included in temporal versioning (per-tenant audit value):
     - service_types       (operators may customise their service catalog)
     - tax_codes           (rate changes need historical record for invoice replays)

   Excluded from RLS (no tenant_id — system-wide reference data):
     - direction_types
     - cargo_classes
     - customer_tiers
     - incoterms
     - document_types

   Included in RLS (have tenant_id):
     - service_types
     - tax_codes
     - yard_rows
     - yard_slots
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== 0004_master_gaps_temporal_rls.sql starting at ' + CONVERT(NVARCHAR, SYSDATETIMEOFFSET(), 121);

-- ==========================================================================
-- SECTION A — Activate temporal tables on per-tenant tables added in 0003
-- ==========================================================================

DECLARE @sql NVARCHAR(MAX);

DECLARE @temporal_tables TABLE (table_name NVARCHAR(128) PRIMARY KEY);
INSERT INTO @temporal_tables VALUES
  (N'service_types'),
  (N'tax_codes');

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

  SET @sql = N'
    ALTER TABLE dbo.' + QUOTENAME(@table) + N' SET (
      SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = history.' + QUOTENAME(@table) + N',
        DATA_CONSISTENCY_CHECK = ON,
        HISTORY_RETENTION_PERIOD = 7 YEARS
      )
    );';
  EXEC sp_executesql @sql;

  PRINT N'  Temporal versioning enabled on dbo.' + @table;

  FETCH NEXT FROM temporal_cursor INTO @table;
END

CLOSE temporal_cursor;
DEALLOCATE temporal_cursor;
GO

-- ==========================================================================
-- SECTION B — Extend RLS policy with new tenant-scoped tables
-- ==========================================================================

ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation
  -- service_types
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.service_types,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.service_types AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.service_types AFTER UPDATE,

  -- tax_codes
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.tax_codes,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.tax_codes AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.tax_codes AFTER UPDATE,

  -- yard_rows
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_rows,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_rows AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_rows AFTER UPDATE,

  -- yard_slots
  ADD FILTER PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_slots,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_slots AFTER INSERT,
  ADD BLOCK  PREDICATE dbo.fn_tenant_filter(tenant_id) ON dbo.yard_slots AFTER UPDATE;
GO

PRINT N'  RLS policy extended with 4 new tenant-scoped tables (service_types, tax_codes, yard_rows, yard_slots)';
GO

-- ==========================================================================
-- Note: direction_types, cargo_classes, customer_tiers, incoterms,
-- document_types — these are system-wide reference data (no tenant_id)
-- and are NOT part of the RLS policy. They're shared across all sessions
-- in the DB. Read-only for app users; only db_owner / migration scripts
-- can modify them.
-- ==========================================================================

PRINT N'== 0004_master_gaps_temporal_rls.sql complete';
GO
