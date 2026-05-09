/* ==========================================================================
   Gecko Master DB — Rollback for 0001 + 0002
   --------------------------------------------------------------------------
   Drops everything created by 0001_initial_schema.sql + 0002_temporal_and_rls.sql.
   Use for clean re-runs during dev.

   Order matters: drop policy first (depends on function), turn off temporal
   (depends on tables), drop tables, drop function, drop schema.
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== Rolling back 0001 + 0002';

-- 1. Drop security policy
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'gecko_master_tenant_isolation')
  DROP SECURITY POLICY dbo.gecko_master_tenant_isolation;
GO

-- 2. Disable temporal versioning on all tables (must be done before DROP)
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql = @sql +
  N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) +
  N' SET (SYSTEM_VERSIONING = OFF);' + CHAR(10)
FROM sys.tables t
WHERE t.temporal_type = 2;   -- 2 = SYSTEM_VERSIONED_TEMPORAL_TABLE

EXEC sp_executesql @sql;
GO

-- 3. Drop history tables
DECLARE @drop NVARCHAR(MAX) = N'';
SELECT @drop = @drop + N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'history';
EXEC sp_executesql @drop;
GO

-- 4. Drop main tables in reverse dependency order
IF OBJECT_ID(N'dbo.legacy_migration_log', N'U') IS NOT NULL DROP TABLE dbo.legacy_migration_log;
IF OBJECT_ID(N'dbo.commodities',           N'U') IS NOT NULL DROP TABLE dbo.commodities;
IF OBJECT_ID(N'dbo.container_conditions',  N'U') IS NOT NULL DROP TABLE dbo.container_conditions;
IF OBJECT_ID(N'dbo.holds',                 N'U') IS NOT NULL DROP TABLE dbo.holds;
IF OBJECT_ID(N'dbo.order_type_charges',    N'U') IS NOT NULL DROP TABLE dbo.order_type_charges;
IF OBJECT_ID(N'dbo.order_type_movements',  N'U') IS NOT NULL DROP TABLE dbo.order_type_movements;
IF OBJECT_ID(N'dbo.order_types',           N'U') IS NOT NULL DROP TABLE dbo.order_types;
IF OBJECT_ID(N'dbo.movements',             N'U') IS NOT NULL DROP TABLE dbo.movements;
IF OBJECT_ID(N'dbo.charge_code_variants',  N'U') IS NOT NULL DROP TABLE dbo.charge_code_variants;
IF OBJECT_ID(N'dbo.charge_codes',          N'U') IS NOT NULL DROP TABLE dbo.charge_codes;
IF OBJECT_ID(N'dbo.container_types',       N'U') IS NOT NULL DROP TABLE dbo.container_types;
IF OBJECT_ID(N'dbo.locations',             N'U') IS NOT NULL DROP TABLE dbo.locations;
IF OBJECT_ID(N'dbo.ports',                 N'U') IS NOT NULL DROP TABLE dbo.ports;
IF OBJECT_ID(N'dbo.vessels',               N'U') IS NOT NULL DROP TABLE dbo.vessels;
IF OBJECT_ID(N'dbo.contacts',              N'U') IS NOT NULL DROP TABLE dbo.contacts;
IF OBJECT_ID(N'dbo.forwarder_extensions',  N'U') IS NOT NULL DROP TABLE dbo.forwarder_extensions;
IF OBJECT_ID(N'dbo.haulier_extensions',    N'U') IS NOT NULL DROP TABLE dbo.haulier_extensions;
IF OBJECT_ID(N'dbo.shipping_line_extensions', N'U') IS NOT NULL DROP TABLE dbo.shipping_line_extensions;
IF OBJECT_ID(N'dbo.customer_extensions',   N'U') IS NOT NULL DROP TABLE dbo.customer_extensions;
IF OBJECT_ID(N'dbo.party_aliases',         N'U') IS NOT NULL DROP TABLE dbo.party_aliases;
IF OBJECT_ID(N'dbo.parties',               N'U') IS NOT NULL DROP TABLE dbo.parties;
IF OBJECT_ID(N'dbo.yard_blocks',           N'U') IS NOT NULL DROP TABLE dbo.yard_blocks;
IF OBJECT_ID(N'dbo.yards',                 N'U') IS NOT NULL DROP TABLE dbo.yards;
IF OBJECT_ID(N'dbo.branches',              N'U') IS NOT NULL DROP TABLE dbo.branches;
IF OBJECT_ID(N'dbo.companies',             N'U') IS NOT NULL DROP TABLE dbo.companies;
GO

-- 5. Drop RLS function
IF OBJECT_ID(N'dbo.fn_tenant_filter', N'IF') IS NOT NULL DROP FUNCTION dbo.fn_tenant_filter;
GO

-- 6. Drop history schema
IF SCHEMA_ID(N'history') IS NOT NULL DROP SCHEMA history;
GO

PRINT N'== Rollback complete';
GO
