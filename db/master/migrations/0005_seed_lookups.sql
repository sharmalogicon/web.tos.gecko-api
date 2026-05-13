/* ==========================================================================
   Gecko Master DB — Per-tenant seed data (0005)
   --------------------------------------------------------------------------
   Run AFTER 0004_master_gaps_temporal_rls.sql.

   Seeds initial reference data for the dev tenant:
     - movements           (4 codes: FULL_IN, FULL_OUT, MTY_IN, MTY_OUT)
     - holds               (5 hold codes: CUSTOMS, DAMAGE, OFFHIRE, SALE, SURVEY)
     - container_conditions (5 conditions: AV, DMG, SOUND, SW, WW)
     - container_types     (12 standard ISO container types)
     - service_types       (11 standard service patterns)
     - tax_codes           (8 SEA-region VAT/GST codes)

   IMPORTANT: This script seeds data for ONE tenant. The tenant_id and the
   default 'system' user_id must be set as SQLCMD variables OR you must
   already have a tenant row in gecko_platform.tenants and a user_id you
   want to attribute the seed records to.

   For dev: this script uses sentinel UUIDs:
     tenant_id = '00000000-0000-0000-0000-000000000001'  (dev tenant)
     created_by/updated_by = '00000000-0000-0000-0000-000000000001'  (system user)

   When you onboard a real tenant, run this script with their actual
   tenant_id and a real user_id.
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== 0005_seed_lookups.sql starting at ' + CONVERT(NVARCHAR, SYSDATETIMEOFFSET(), 121);
GO
-- Bypass RLS for seed (we're running as db_owner)
ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = OFF);
GO

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

-- ==========================================================================
-- 1. movements
-- ==========================================================================

INSERT INTO dbo.movements
  (tenant_id, movement_code, description_en, ef_indicator, direction, applies_to_module,
   changes_yard_position, changes_status, created_by, updated_by)
VALUES
  (@tenant_id, N'FULL_IN',  N'Laden container gate-in',  N'FULL',  N'IN',  N'BOTH', 1, 1, @system_user, @system_user),
  (@tenant_id, N'FULL_OUT', N'Laden container gate-out', N'FULL',  N'OUT', N'BOTH', 1, 1, @system_user, @system_user),
  (@tenant_id, N'MTY_IN',   N'Empty container gate-in',  N'EMPTY', N'IN',  N'BOTH', 1, 1, @system_user, @system_user),
  (@tenant_id, N'MTY_OUT',  N'Empty container gate-out', N'EMPTY', N'OUT', N'BOTH', 1, 1, @system_user, @system_user),
  (@tenant_id, N'LOAD',     N'Container loaded onto vessel',     N'FULL',  N'OUT', N'TOS', 1, 1, @system_user, @system_user),
  (@tenant_id, N'DISCHARGE',N'Container discharged from vessel', N'FULL',  N'IN',  N'TOS', 1, 1, @system_user, @system_user),
  (@tenant_id, N'TRANSFER', N'Yard-to-yard transfer',            N'FULL',  N'TRANSFER', N'TOS', 1, 0, @system_user, @system_user),
  (@tenant_id, N'WEIGH',    N'Container weighed (VGM)',          N'FULL',  N'TRANSFER', N'TOS', 0, 0, @system_user, @system_user);
GO

PRINT N'  Seeded movements (8 rows)';
GO

-- ==========================================================================
-- 2. holds
-- ==========================================================================

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

INSERT INTO dbo.holds
  (tenant_id, hold_code, description_en, hold_type, blocking_scope, release_authority,
   priority, display_color_hex, notify_on_apply, created_by, updated_by)
VALUES
  (@tenant_id, N'CUSTOMS',  N'Customs hold — pending clearance',     N'CUSTOMS',    N'GATE_OUT', N'CUSTOMS_OFFICER',     1, N'#DC2626', 1, @system_user, @system_user),
  (@tenant_id, N'AGENT',    N'Agent hold — line-instructed',         N'AGENT',      N'GATE_OUT', N'LINE_AGENT',          2, N'#F59E0B', 1, @system_user, @system_user),
  (@tenant_id, N'FINANCE',  N'Finance hold — outstanding payment',   N'FINANCE',    N'GATE_OUT', N'FINANCE_TEAM',        3, N'#EF4444', 1, @system_user, @system_user),
  (@tenant_id, N'DAMAGE',   N'Damage hold — survey required',        N'OPERATIONS', N'BOTH',     N'OPS_MANAGER',         4, N'#F97316', 1, @system_user, @system_user),
  (@tenant_id, N'OFFHIRE',  N'Off-hire — line container being returned', N'AGENT',  N'LOAD',     N'LINE_AGENT',          5, N'#6B7280', 0, @system_user, @system_user),
  (@tenant_id, N'SURVEY',   N'Pre-load survey required',             N'OPERATIONS', N'LOAD',     N'OPS_MANAGER',         6, N'#3B82F6', 0, @system_user, @system_user),
  (@tenant_id, N'LEGAL',    N'Legal hold — court / dispute',         N'LEGAL',     N'BOTH',     N'LEGAL_TEAM',          1, N'#7C3AED', 1, @system_user, @system_user);
GO

PRINT N'  Seeded holds (7 rows)';
GO

-- ==========================================================================
-- 3. container_conditions
-- ==========================================================================

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

INSERT INTO dbo.container_conditions
  (tenant_id, condition_code, description_en, severity, is_serviceable, requires_repair, created_by, updated_by)
VALUES
  (@tenant_id, N'AV',     N'Available — good condition, ready for use',  1, 1, 0, @system_user, @system_user),
  (@tenant_id, N'SOUND',  N'Sound — verified ready',                     1, 1, 0, @system_user, @system_user),
  (@tenant_id, N'AW',     N'Awaiting inspection',                        3, 0, 0, @system_user, @system_user),
  (@tenant_id, N'CL',     N'Cleaning required',                          4, 0, 0, @system_user, @system_user),
  (@tenant_id, N'SW',     N'Sweeping required',                          4, 0, 0, @system_user, @system_user),
  (@tenant_id, N'WW',     N'Water wash required',                        4, 0, 0, @system_user, @system_user),
  (@tenant_id, N'STUFF',  N'Strip / stuff in progress',                  3, 0, 0, @system_user, @system_user),
  (@tenant_id, N'MN',     N'Minor damage',                               5, 0, 1, @system_user, @system_user),
  (@tenant_id, N'MJ',     N'Major damage',                               7, 0, 1, @system_user, @system_user),
  (@tenant_id, N'DMG',    N'Damaged — survey required',                  8, 0, 1, @system_user, @system_user);
GO

PRINT N'  Seeded container_conditions (10 rows)';
GO

-- ==========================================================================
-- 4. container_types (12 standard ISO types covering 95% of trade)
-- ==========================================================================

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

INSERT INTO dbo.container_types
  (tenant_id, iso_code, type_size_code, size_ft, type_code, height_class, description_en,
   teu, is_reefer, is_oog, tare_weight_kg, max_payload_kg, max_gross_kg, display_color_hex,
   created_by, updated_by)
VALUES
  -- Dry cargo
  (@tenant_id, N'22G1', N'20GP', 20, N'GP', N'STANDARD',  N'20'' Standard Dry Cargo',          1.0, 0, 0, 2300.00, 28230.00, 30480.00, N'#3B82F6', @system_user, @system_user),
  (@tenant_id, N'42G1', N'40GP', 40, N'GP', N'STANDARD',  N'40'' Standard Dry Cargo',          2.0, 0, 0, 3750.00, 26700.00, 30480.00, N'#3B82F6', @system_user, @system_user),
  (@tenant_id, N'45G1', N'40HC', 40, N'HC', N'HIGH_CUBE', N'40'' High-Cube Dry Cargo',         2.0, 0, 0, 3900.00, 26500.00, 30480.00, N'#3B82F6', @system_user, @system_user),
  (@tenant_id, N'L5G1', N'45HC', 45, N'HC', N'HIGH_CUBE', N'45'' High-Cube Dry Cargo',         2.0, 0, 0, 4800.00, 26500.00, 32500.00, N'#3B82F6', @system_user, @system_user),

  -- Reefer
  (@tenant_id, N'22R1', N'20RF', 20, N'RF', N'STANDARD',  N'20'' Reefer (refrigerated)',       1.0, 1, 0, 3000.00, 27400.00, 30480.00, N'#06B6D4', @system_user, @system_user),
  (@tenant_id, N'42R1', N'40RF', 40, N'RF', N'STANDARD',  N'40'' Reefer (refrigerated)',       2.0, 1, 0, 4800.00, 26900.00, 32500.00, N'#06B6D4', @system_user, @system_user),
  (@tenant_id, N'45R1', N'40RH', 40, N'RH', N'HIGH_CUBE', N'40'' High-Cube Reefer',            2.0, 1, 0, 4580.00, 29520.00, 34000.00, N'#06B6D4', @system_user, @system_user),

  -- Open-top
  (@tenant_id, N'22U1', N'20OT', 20, N'OT', N'STANDARD',  N'20'' Open Top',                    1.0, 0, 1, 2450.00, 28080.00, 30480.00, N'#F59E0B', @system_user, @system_user),
  (@tenant_id, N'42U1', N'40OT', 40, N'OT', N'STANDARD',  N'40'' Open Top',                    2.0, 0, 1, 3870.00, 26580.00, 30480.00, N'#F59E0B', @system_user, @system_user),

  -- Flat rack
  (@tenant_id, N'22P3', N'20FR', 20, N'FR', N'STANDARD',  N'20'' Flat Rack (collapsible)',     1.0, 0, 1, 2800.00, 27600.00, 30480.00, N'#EF4444', @system_user, @system_user),
  (@tenant_id, N'42P3', N'40FR', 40, N'FR', N'STANDARD',  N'40'' Flat Rack (collapsible)',     2.0, 0, 1, 5350.00, 39200.00, 45000.00, N'#EF4444', @system_user, @system_user),

  -- Tank
  (@tenant_id, N'22T1', N'20TK', 20, N'TK', N'STANDARD',  N'20'' Tank Container (liquid)',     1.0, 0, 0, 3700.00, 22000.00, 30480.00, N'#8B5CF6', @system_user, @system_user);
GO

PRINT N'  Seeded container_types (12 rows — covers 95% of global trade)';
GO

-- ==========================================================================
-- 5. service_types (11 standard service patterns, NAVIS-aligned)
-- ==========================================================================

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

INSERT INTO dbo.service_types
  (tenant_id, service_code, description_en, origin_form, destination_form, display_order, created_by, updated_by)
VALUES
  (@tenant_id, N'CY_CY',     N'CY-to-CY — full container terminal-to-terminal',       N'CY',   N'CY',   10,  @system_user, @system_user),
  (@tenant_id, N'CY_CFS',    N'CY-to-CFS — terminal to deconsolidation',              N'CY',   N'CFS',  20,  @system_user, @system_user),
  (@tenant_id, N'CFS_CY',    N'CFS-to-CY — consolidation to terminal',                N'CFS',  N'CY',   30,  @system_user, @system_user),
  (@tenant_id, N'CFS_CFS',   N'CFS-to-CFS — full consolidation chain',                N'CFS',  N'CFS',  40,  @system_user, @system_user),
  (@tenant_id, N'CY_IN',     N'Gate-in only (drop-off at terminal)',                  N'CY',   N'CY',   50,  @system_user, @system_user),
  (@tenant_id, N'CY_OUT',    N'Gate-out only (pickup from terminal)',                 N'CY',   N'CY',   60,  @system_user, @system_user),
  (@tenant_id, N'DOOR_CY',   N'Door pickup, terminal yard delivery',                  N'DOOR', N'CY',   70,  @system_user, @system_user),
  (@tenant_id, N'CY_DOOR',   N'Terminal yard pickup, door delivery',                  N'CY',   N'DOOR', 80,  @system_user, @system_user),
  (@tenant_id, N'DOOR_DOOR', N'Door-to-door (full transport)',                        N'DOOR', N'DOOR', 90,  @system_user, @system_user),
  (@tenant_id, N'RAMP_CY',   N'Rail ramp to container yard (intermodal)',             N'RAMP', N'CY',   100, @system_user, @system_user),
  (@tenant_id, N'CY_RAMP',   N'Container yard to rail ramp (intermodal)',             N'CY',   N'RAMP', 110, @system_user, @system_user);
GO

PRINT N'  Seeded service_types (11 rows)';
GO

-- ==========================================================================
-- 6. tax_codes (SEA region — current rates as of 2026)
-- ==========================================================================

DECLARE @tenant_id UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';
DECLARE @system_user UNIQUEIDENTIFIER = N'00000000-0000-0000-0000-000000000001';

INSERT INTO dbo.tax_codes
  (tenant_id, tax_code, description_en, country_code, tax_type, rate_pct,
   effective_from, is_default_for_country, is_export_zero_rated,
   created_by, updated_by)
VALUES
  -- Thailand
  (@tenant_id, N'VAT_TH_7',     N'Thailand VAT 7%',                          N'TH', N'VAT',         7.00, N'2017-10-01', 1, 1, @system_user, @system_user),

  -- Singapore (GST raised to 9% on 2024-01-01)
  (@tenant_id, N'GST_SG_9',     N'Singapore GST 9%',                         N'SG', N'GST',         9.00, N'2024-01-01', 1, 1, @system_user, @system_user),

  -- Malaysia (SST replaced GST in 2018, then raised to 8% in 2024)
  (@tenant_id, N'SST_MY_8',     N'Malaysia Service Tax 8%',                  N'MY', N'SST',         8.00, N'2024-03-01', 1, 0, @system_user, @system_user),

  -- Indonesia (VAT raised to 11% in 2022)
  (@tenant_id, N'VAT_ID_11',    N'Indonesia VAT (PPN) 11%',                  N'ID', N'VAT',        11.00, N'2022-04-01', 1, 1, @system_user, @system_user),

  -- Vietnam
  (@tenant_id, N'VAT_VN_10',    N'Vietnam VAT 10%',                          N'VN', N'VAT',        10.00, N'2010-01-01', 1, 1, @system_user, @system_user),

  -- Philippines
  (@tenant_id, N'VAT_PH_12',    N'Philippines VAT 12%',                      N'PH', N'VAT',        12.00, N'2006-02-01', 1, 1, @system_user, @system_user),

  -- Special codes
  (@tenant_id, N'ZERO_RATED',   N'Zero-rated (exports, international transport)', N'**', N'ZERO_RATED', 0.00, N'2000-01-01', 0, 1, @system_user, @system_user),
  (@tenant_id, N'EXEMPT',       N'Tax-exempt supply',                         N'**', N'EXEMPT',      0.00, N'2000-01-01', 0, 0, @system_user, @system_user);
GO

PRINT N'  Seeded tax_codes (8 rows — Thailand, Singapore, Malaysia, Indonesia, Vietnam, Philippines + zero-rated/exempt)';
GO

-- Re-enable RLS now that seed is complete
ALTER SECURITY POLICY dbo.gecko_master_tenant_isolation WITH (STATE = ON);
GO

PRINT N'== 0005_seed_lookups.sql complete';
PRINT N'';
PRINT N'   Total seed rows:';
PRINT N'     movements             — 8';
PRINT N'     holds                 — 7';
PRINT N'     container_conditions  — 10';
PRINT N'     container_types       — 12';
PRINT N'     service_types         — 11';
PRINT N'     tax_codes             — 8';
PRINT N'                              ───';
PRINT N'                              56';
GO
