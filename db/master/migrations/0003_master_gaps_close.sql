/* ==========================================================================
   Gecko Master DB — Gap-Close Migration (0003)
   --------------------------------------------------------------------------
   Run AFTER 0002_temporal_and_rls.sql.

   Closes the gaps identified in the Phase 1 cross-check:
     1. Decompose order_types into proper global-standard structure:
        - direction_types  (IMPORT / EXPORT / TRANSHIPMENT / DOMESTIC / INTRA)
        - service_types    (CY/CY, CY/CFS, CFS/CY, CFS/CFS, CY-IN, CY-OUT, ...)
        - cargo_classes    (GENERAL / REEFER / DG / OOG / EMPTY / BREAKBULK)
        - order_types now references all three (composite "booking template")
     2. customer_tiers       — VIP / Gold / Silver / Bronze / Standard / Prospect
     3. incoterms             — INCOTERMS 2020 (11 codes)
     4. document_types        — BL / DO / EIR / Manifest / etc.
     5. tax_codes             — Country-specific VAT/GST with effective dates
     6. yard_rows + yard_slots — Optional sub-block dimensions (NAVIS-style)
     7. customer_extensions.tier_code

   This is a forward-only migration. Assumes 0001 + 0002 have run on a
   fresh DB (no order_types data yet). For tenants with data already loaded,
   adapt the order_types decomposition section.
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== 0003_master_gaps_close.sql starting at ' + CONVERT(NVARCHAR, SYSDATETIMEOFFSET(), 121);

-- ==========================================================================
-- SECTION 0 — Schemas
-- ==========================================================================
-- The `lookup` schema holds system-wide reference data (no tenant_id):
-- direction_types, cargo_classes, customer_tiers, incoterms, document_types.
-- These are shared across all tenants in the same DB; they're industry
-- standards (INCOTERMS, document categories) or app-defined enums that
-- don't need per-tenant customisation. Hybrid model:
--   dbo    = tenant-scoped operational data (parties, vessels, charges, ...)
--   lookup = system-wide reference data (no tenant_id, shared)
--   history = temporal-table history (auto-managed)

IF SCHEMA_ID(N'lookup') IS NULL
  EXEC(N'CREATE SCHEMA lookup AUTHORIZATION dbo');
GO

PRINT N'  Schema lookup created';

-- ==========================================================================
-- SECTION 1 — Decompose order_types into 3 dimensions + composite
-- ==========================================================================

-- 1a. direction_types — small, stable, app-defined (system-wide → lookup schema)
CREATE TABLE lookup.direction_types (
  code              VARCHAR(20)      NOT NULL,    -- IMPORT / EXPORT / TRANSHIPMENT / DOMESTIC / INTRA_TERMINAL
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,
  display_order     SMALLINT         NOT NULL CONSTRAINT df_dt_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_dt_is_active DEFAULT 1,

  -- Audit (system-defined; no tenant_id — these are platform-wide values)
  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_dt_created_at DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_dt_updated_at DEFAULT SYSDATETIMEOFFSET(),
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_direction_types PRIMARY KEY CLUSTERED (code)
);
GO

INSERT INTO lookup.direction_types (code, description_en, display_order) VALUES
  (N'IMPORT',         N'Import — cargo arriving at terminal',                 10),
  (N'EXPORT',         N'Export — cargo leaving terminal',                     20),
  (N'TRANSHIPMENT',   N'Through-port transfer between vessels',               30),
  (N'DOMESTIC',       N'Cabotage — cargo within country',                     40),
  (N'INTRA_TERMINAL', N'Movement within same terminal (rebooking, repos.)',   50);
GO

-- 1b. service_types — covers all combinations operators may need globally
CREATE TABLE dbo.service_types (
  id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,    -- Per-tenant: terminals customise their service catalog

  service_code      VARCHAR(15)      NOT NULL,    -- CY_CY, CY_CFS, CFS_CY, ...
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- The classic two-end model: where cargo enters service, where it leaves
  -- Helps generic queries like "all services that originate at CFS" without
  -- string parsing of the code
  origin_form       VARCHAR(10)      NOT NULL,    -- CY | CFS | DOOR | RAMP | VESSEL | BREAKBULK
  destination_form  VARCHAR(10)      NOT NULL,    -- CY | CFS | DOOR | RAMP | VESSEL | BREAKBULK

  display_order     SMALLINT         NOT NULL CONSTRAINT df_st_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_st_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_st_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by        UNIQUEIDENTIFIER  NOT NULL,
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_st_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by        UNIQUEIDENTIFIER  NOT NULL,
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_service_types PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_st_origin
    CHECK (origin_form IN (N'CY', N'CFS', N'DOOR', N'RAMP', N'VESSEL', N'BREAKBULK')),
  CONSTRAINT ck_st_destination
    CHECK (destination_form IN (N'CY', N'CFS', N'DOOR', N'RAMP', N'VESSEL', N'BREAKBULK'))
);

CREATE UNIQUE INDEX uq_service_types_tenant_code
  ON dbo.service_types (tenant_id, service_code);
CREATE INDEX ix_service_types_origin
  ON dbo.service_types (tenant_id, origin_form, destination_form);
GO

-- Service-type seed data is inserted by the seed-lookups migration (0005)
-- because seeds need a tenant context (tenant_id is a column).
-- See db/master/migrations/0005_seed_lookups.sql.

-- 1c. cargo_classes — small, stable, app-defined (system-wide → lookup schema)
CREATE TABLE lookup.cargo_classes (
  code              VARCHAR(20)      NOT NULL,    -- GENERAL / REEFER / DG / OOG / EMPTY / BREAKBULK / PROJECT
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- Behavioural flags that drive workflow / charge / yard rules
  requires_temp_control     BIT NOT NULL CONSTRAINT df_cgc_temp DEFAULT 0,
  requires_imdg_handling    BIT NOT NULL CONSTRAINT df_cgc_imdg DEFAULT 0,
  requires_oog_handling     BIT NOT NULL CONSTRAINT df_cgc_oog DEFAULT 0,
  is_empty_repositioning    BIT NOT NULL CONSTRAINT df_cgc_empty DEFAULT 0,

  display_order     SMALLINT         NOT NULL CONSTRAINT df_cgc_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_cgc_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cgc_created_at DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cgc_updated_at DEFAULT SYSDATETIMEOFFSET(),
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_cargo_classes PRIMARY KEY CLUSTERED (code)
);
GO

INSERT INTO lookup.cargo_classes
  (code, description_en, requires_temp_control, requires_imdg_handling, requires_oog_handling, is_empty_repositioning, display_order)
VALUES
  (N'GENERAL',     N'General / dry cargo',                              0, 0, 0, 0, 10),
  (N'REEFER',      N'Refrigerated / temperature controlled',            1, 0, 0, 0, 20),
  (N'DG',          N'Dangerous goods (IMDG / IMO classified)',          0, 1, 0, 0, 30),
  (N'OOG',         N'Out of gauge — open-top, flat-rack, oversize',     0, 0, 1, 0, 40),
  (N'BREAKBULK',   N'Non-containerised cargo (project, heavy lift)',    0, 0, 1, 0, 50),
  (N'EMPTY',       N'Empty container repositioning',                    0, 0, 0, 1, 60),
  (N'PROJECT',     N'Project cargo / heavy lift / oversized',           0, 0, 1, 0, 70);
GO

-- 1d. ALTER order_types: drop legacy embedded columns, add proper FK columns
PRINT N'  Decomposing order_types into FK references...';

-- Drop existing CHECK constraints referencing the columns we're removing
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_ot_direction')
  ALTER TABLE dbo.order_types DROP CONSTRAINT ck_ot_direction;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_ot_shipment_type')
  ALTER TABLE dbo.order_types DROP CONSTRAINT ck_ot_shipment_type;
GO

-- Drop the legacy embedded columns (no data yet — fresh install assumption)
ALTER TABLE dbo.order_types DROP COLUMN direction;
ALTER TABLE dbo.order_types DROP COLUMN shipment_type;
ALTER TABLE dbo.order_types DROP COLUMN cargo_type;
GO

-- Add proper FK columns
ALTER TABLE dbo.order_types ADD
  direction_code     VARCHAR(20)      NOT NULL CONSTRAINT df_ot_direction_code DEFAULT N'EXPORT',
  service_type_id    UNIQUEIDENTIFIER NULL,        -- → service_types.id (nullable: simple templates)
  cargo_class_code   VARCHAR(20)      NOT NULL CONSTRAINT df_ot_cargo_class_code DEFAULT N'GENERAL';
GO

-- Drop the defaults (they were just to satisfy NOT NULL during ALTER ADD)
ALTER TABLE dbo.order_types DROP CONSTRAINT df_ot_direction_code;
ALTER TABLE dbo.order_types DROP CONSTRAINT df_ot_cargo_class_code;
GO

-- Index the new FKs (logical refs per ADR-007)
CREATE INDEX ix_order_types_direction
  ON dbo.order_types (tenant_id, direction_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_order_types_service_type
  ON dbo.order_types (tenant_id, service_type_id)
  WHERE service_type_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_order_types_cargo_class
  ON dbo.order_types (tenant_id, cargo_class_code) WHERE deleted_at IS NULL;
GO

PRINT N'  Section 1: order_types decomposed into direction + service + cargo class';
GO

-- ==========================================================================
-- SECTION 2 — customer_tiers (system-wide → lookup schema)
-- ==========================================================================

CREATE TABLE lookup.customer_tiers (
  code              VARCHAR(20)      NOT NULL,    -- VIP / GOLD / SILVER / BRONZE / STANDARD / PROSPECT
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- Service-level expectations (informational, drives UI badge + reports)
  priority          TINYINT          NOT NULL CONSTRAINT df_ctier_priority DEFAULT 5,
  display_color_hex CHAR(7)          NULL,        -- Tier badge colour
  default_credit_term_days SMALLINT  NULL,        -- Default credit terms for this tier

  display_order     SMALLINT         NOT NULL CONSTRAINT df_ctier_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_ctier_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ctier_created_at DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ctier_updated_at DEFAULT SYSDATETIMEOFFSET(),
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_customer_tiers PRIMARY KEY CLUSTERED (code),
  CONSTRAINT ck_ctier_priority CHECK (priority BETWEEN 1 AND 9),
  CONSTRAINT ck_ctier_color
    CHECK (display_color_hex IS NULL
           OR display_color_hex LIKE N'#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);
GO

INSERT INTO lookup.customer_tiers
  (code, description_en, priority, display_color_hex, default_credit_term_days, display_order)
VALUES
  (N'VIP',      N'VIP — dedicated account manager, top priority',  1, N'#9333EA', 60, 10),
  (N'GOLD',     N'Gold — premium tier, preferential pricing',      2, N'#F59E0B', 45, 20),
  (N'SILVER',   N'Silver — established customer, standard premium',3, N'#94A3B8', 30, 30),
  (N'BRONZE',   N'Bronze — standard credit terms',                 4, N'#92400E', 30, 40),
  (N'STANDARD', N'Standard — default tier for new customers',      5, N'#3B82F6', 15, 50),
  (N'PROSPECT', N'Prospect — pre-customer / lead, prepay only',    6, N'#6B7280', 0,  60);
GO

-- Add tier_code FK column to customer_extensions
ALTER TABLE dbo.customer_extensions ADD
  tier_code VARCHAR(20) NOT NULL CONSTRAINT df_cust_ext_tier_code DEFAULT N'STANDARD';
GO

-- Drop the default after adding (default value already applied to existing rows)
ALTER TABLE dbo.customer_extensions DROP CONSTRAINT df_cust_ext_tier_code;
GO

CREATE INDEX ix_customer_extensions_tier
  ON dbo.customer_extensions (tenant_id, tier_code) WHERE deleted_at IS NULL;
GO

PRINT N'  Section 2: customer_tiers + customer_extensions.tier_code added';
GO

-- ==========================================================================
-- SECTION 3 — incoterms (ISO standard, INCOTERMS 2020 — lookup schema)
-- ==========================================================================

CREATE TABLE lookup.incoterms (
  code              CHAR(3)          NOT NULL,    -- EXW / FCA / CPT / CIP / DAP / DPU / DDP / FAS / FOB / CFR / CIF
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- INCOTERMS classification
  transport_mode    VARCHAR(20)      NOT NULL,    -- ANY / SEA_INLAND_WATERWAY
  edition           CHAR(4)          NOT NULL CONSTRAINT df_inco_edition DEFAULT N'2020',

  -- Risk transfer point (informational, helps booking validation)
  seller_pays_main_carriage BIT      NOT NULL CONSTRAINT df_inco_main_carriage DEFAULT 0,
  seller_pays_insurance     BIT      NOT NULL CONSTRAINT df_inco_insurance DEFAULT 0,

  display_order     SMALLINT         NOT NULL CONSTRAINT df_inco_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_inco_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_inco_created_at DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_inco_updated_at DEFAULT SYSDATETIMEOFFSET(),
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_incoterms PRIMARY KEY CLUSTERED (code),
  CONSTRAINT ck_incoterms_mode CHECK (transport_mode IN (N'ANY', N'SEA_INLAND_WATERWAY'))
);
GO

INSERT INTO lookup.incoterms
  (code, description_en, transport_mode, seller_pays_main_carriage, seller_pays_insurance, display_order)
VALUES
  -- Group I — Any mode of transport
  (N'EXW', N'Ex Works — buyer collects from seller premises',         N'ANY', 0, 0, 10),
  (N'FCA', N'Free Carrier — seller delivers to buyer''s carrier',     N'ANY', 0, 0, 20),
  (N'CPT', N'Carriage Paid To — seller pays carriage to destination', N'ANY', 1, 0, 30),
  (N'CIP', N'Carriage and Insurance Paid To — CPT plus insurance',    N'ANY', 1, 1, 40),
  (N'DAP', N'Delivered at Place — seller delivers ready for unloading', N'ANY', 1, 0, 50),
  (N'DPU', N'Delivered at Place Unloaded — seller unloads at place',  N'ANY', 1, 0, 60),
  (N'DDP', N'Delivered Duty Paid — seller covers all incl. duty',     N'ANY', 1, 0, 70),
  -- Group II — Sea and inland waterway only
  (N'FAS', N'Free Alongside Ship — seller delivers alongside vessel', N'SEA_INLAND_WATERWAY', 0, 0, 80),
  (N'FOB', N'Free on Board — seller delivers on board the vessel',    N'SEA_INLAND_WATERWAY', 0, 0, 90),
  (N'CFR', N'Cost and Freight — seller pays freight to destination',  N'SEA_INLAND_WATERWAY', 1, 0, 100),
  (N'CIF', N'Cost, Insurance and Freight — CFR plus insurance',       N'SEA_INLAND_WATERWAY', 1, 1, 110);
GO

PRINT N'  Section 3: incoterms (INCOTERMS 2020) seeded with 11 codes';
GO

-- ==========================================================================
-- SECTION 4 — document_types (system-wide → lookup schema)
-- ==========================================================================

CREATE TABLE lookup.document_types (
  code              VARCHAR(20)      NOT NULL,
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- Classification
  document_category VARCHAR(30)      NOT NULL,    -- TRANSPORT / CUSTOMS / FINANCIAL / EMR / INTERNAL
  is_legal_document BIT              NOT NULL CONSTRAINT df_dty_legal DEFAULT 0,
  requires_signature BIT             NOT NULL CONSTRAINT df_dty_signature DEFAULT 0,
  retention_years   SMALLINT         NULL,        -- Per-jurisdiction; can override

  -- EDI / file-format hints
  edi_message_type  VARCHAR(20)      NULL,        -- COPARN / CODECO / CUSCAR / etc.
  default_format    VARCHAR(10)      NULL,        -- PDF / XML / EDI / CSV

  display_order     SMALLINT         NOT NULL CONSTRAINT df_dty_display_order DEFAULT 99,
  is_active         BIT              NOT NULL CONSTRAINT df_dty_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_dty_created_at DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_dty_updated_at DEFAULT SYSDATETIMEOFFSET(),
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_document_types PRIMARY KEY CLUSTERED (code),
  CONSTRAINT ck_document_types_category
    CHECK (document_category IN (N'TRANSPORT', N'CUSTOMS', N'FINANCIAL', N'EMR', N'INTERNAL'))
);
GO

INSERT INTO lookup.document_types
  (code, description_en, document_category, is_legal_document, requires_signature, retention_years, edi_message_type, default_format, display_order)
VALUES
  -- Transport documents
  (N'BL',         N'Bill of Lading (Master)',              N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 10),
  (N'HBL',        N'House Bill of Lading',                 N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 20),
  (N'MBL',        N'Master Bill of Lading',                N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 30),
  (N'SWB',        N'Sea Waybill',                          N'TRANSPORT', 1, 0, 7, NULL,         N'PDF', 40),
  (N'DO',         N'Delivery Order',                       N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 50),
  (N'GP',         N'Gate Pass',                            N'TRANSPORT', 0, 0, 2, NULL,         N'PDF', 60),
  (N'EIR',        N'Equipment Interchange Receipt',        N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 70),
  (N'COC',        N'Container Operator Certificate',       N'TRANSPORT', 0, 0, 2, NULL,         N'PDF', 80),
  (N'MANIFEST',   N'Vessel / Cargo Manifest',              N'TRANSPORT', 1, 0, 7, N'BAPLIE',    N'PDF', 90),
  (N'LOI',        N'Letter of Indemnity',                  N'TRANSPORT', 1, 1, 7, NULL,         N'PDF', 100),
  (N'PL',         N'Packing List',                         N'TRANSPORT', 0, 0, 5, NULL,         N'PDF', 110),

  -- Customs documents
  (N'CUSDEC',     N'Customs Declaration',                  N'CUSTOMS',   1, 0, 7, N'CUSDEC',    N'XML', 200),
  (N'CUSCAR',     N'Customs Cargo Report',                 N'CUSTOMS',   1, 0, 7, N'CUSCAR',    N'EDI', 210),
  (N'COO',        N'Certificate of Origin',                N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 220),
  (N'PHYTO',      N'Phytosanitary Certificate',            N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 230),
  (N'HEALTH',     N'Health / Veterinary Certificate',      N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 240),
  (N'DG_DECL',    N'Dangerous Goods Declaration',          N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 250),
  (N'VGM',        N'Verified Gross Mass Declaration',      N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 260),
  (N'SOC',        N'Shipper-Owned Container Declaration',  N'CUSTOMS',   1, 1, 7, NULL,         N'PDF', 270),

  -- Financial documents
  (N'INV',        N'Invoice',                              N'FINANCIAL', 1, 0, 7, NULL,         N'PDF', 300),
  (N'CN',         N'Credit Note',                          N'FINANCIAL', 1, 0, 7, NULL,         N'PDF', 310),
  (N'DN',         N'Debit Note',                           N'FINANCIAL', 1, 0, 7, NULL,         N'PDF', 320),
  (N'RECEIPT',    N'Payment Receipt',                      N'FINANCIAL', 0, 0, 7, NULL,         N'PDF', 330),
  (N'STATEMENT',  N'Account Statement',                    N'FINANCIAL', 0, 0, 7, NULL,         N'PDF', 340),
  (N'RFQ',        N'Request for Quotation',                N'FINANCIAL', 0, 0, 3, NULL,         N'PDF', 350),
  (N'QUOTE',      N'Quotation',                            N'FINANCIAL', 0, 0, 3, NULL,         N'PDF', 360),

  -- EMR documents
  (N'SURVEY',     N'Container Survey Report',              N'EMR',       0, 1, 7, NULL,         N'PDF', 400),
  (N'WO',         N'Work Order (Repair)',                  N'EMR',       0, 0, 7, NULL,         N'PDF', 410),
  (N'EOR',        N'Estimate of Repair',                   N'EMR',       0, 1, 7, NULL,         N'PDF', 420);
GO

PRINT N'  Section 4: document_types seeded with 30 codes (TRANSPORT + CUSTOMS + FINANCIAL + EMR)';
GO

-- ==========================================================================
-- SECTION 5 — tax_codes (multi-country, time-bound)
-- ==========================================================================

CREATE TABLE dbo.tax_codes (
  id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  tax_code          VARCHAR(30)      NOT NULL,    -- VAT_TH_7 / GST_SG_9 / SST_MY_8 / VAT_ID_11 etc.
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  country_code      CHAR(2)          NOT NULL,    -- ISO 3166-1 alpha-2
  tax_type          VARCHAR(20)      NOT NULL,    -- VAT / GST / SST / SALES_TAX / WITHHOLDING / EXEMPT / ZERO

  rate_pct          DECIMAL(5,2)     NOT NULL,    -- e.g. 7.00 for Thai VAT
  effective_from    DATE             NOT NULL,
  effective_to      DATE             NULL,        -- NULL = currently effective

  -- Special handling
  is_default_for_country BIT         NOT NULL CONSTRAINT df_tax_default_country DEFAULT 0,
  is_export_zero_rated   BIT         NOT NULL CONSTRAINT df_tax_export_zero DEFAULT 0,
  is_reverse_charge      BIT         NOT NULL CONSTRAINT df_tax_reverse DEFAULT 0,

  -- Accounting integration
  output_tax_gl     VARCHAR(20)      NULL,        -- Output VAT GL
  input_tax_gl      VARCHAR(20)      NULL,        -- Input VAT GL

  is_active         BIT              NOT NULL CONSTRAINT df_tax_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_tax_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by        UNIQUEIDENTIFIER  NOT NULL,
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_tax_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by        UNIQUEIDENTIFIER  NOT NULL,
  deleted_at        DATETIMEOFFSET(3) NULL,
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_tax_codes PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_tax_country CHECK (LEN(country_code) = 2),
  CONSTRAINT ck_tax_rate CHECK (rate_pct >= 0 AND rate_pct <= 100),
  CONSTRAINT ck_tax_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_tax_type
    CHECK (tax_type IN (N'VAT', N'GST', N'SST', N'SALES_TAX', N'WITHHOLDING', N'EXEMPT', N'ZERO_RATED'))
);

CREATE UNIQUE INDEX uq_tax_codes_tenant_code
  ON dbo.tax_codes (tenant_id, tax_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_tax_codes_country_effective
  ON dbo.tax_codes (tenant_id, country_code, effective_from, effective_to)
  WHERE deleted_at IS NULL;
GO

-- Tax-code seed data is per-tenant (uses tenant_id) — see 0005_seed_lookups.sql

PRINT N'  Section 5: tax_codes table created (seed data in 0005)';
GO

-- ==========================================================================
-- SECTION 6 — Yard sub-block: yard_rows + yard_slots (optional)
-- ==========================================================================
-- These are OPTIONAL tables. Tenants who only need block-level granularity
-- leave them empty and rely on yard_blocks.{max_rows, max_columns, max_tiers}
-- as capacity constraints. Tenants that need explicit row/slot management
-- (e.g., reefer Row 5 has special cooling, Slot A1-R3-B12-T4 is reserved)
-- populate these tables.

CREATE TABLE dbo.yard_rows (
  id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  yard_block_id     UNIQUEIDENTIFIER NOT NULL,

  row_label         VARCHAR(10)      NOT NULL,    -- 'A', '1', 'R01', etc.
  description_en    NVARCHAR(100)    NULL,

  -- Row-level overrides (when row differs from block default)
  is_reefer_row     BIT              NOT NULL CONSTRAINT df_yr_is_reefer DEFAULT 0,
  is_oog_row        BIT              NOT NULL CONSTRAINT df_yr_is_oog DEFAULT 0,
  reefer_plug_count SMALLINT         NULL,        -- For reefer rows
  is_blocked        BIT              NOT NULL CONSTRAINT df_yr_is_blocked DEFAULT 0,    -- Maintenance / reserved

  is_active         BIT              NOT NULL CONSTRAINT df_yr_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yr_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by        UNIQUEIDENTIFIER  NOT NULL,
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yr_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by        UNIQUEIDENTIFIER  NOT NULL,
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_yard_rows PRIMARY KEY CLUSTERED (id)
);

CREATE UNIQUE INDEX uq_yard_rows_block_label
  ON dbo.yard_rows (tenant_id, yard_block_id, row_label);
GO

CREATE TABLE dbo.yard_slots (
  id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  yard_block_id     UNIQUEIDENTIFIER NOT NULL,

  -- Position address: row + bay + tier
  row_label         VARCHAR(10)      NOT NULL,
  bay_number        SMALLINT         NOT NULL,
  tier_number       SMALLINT         NOT NULL,

  -- Slot-level attributes
  has_reefer_plug   BIT              NOT NULL CONSTRAINT df_ys_reefer_plug DEFAULT 0,
  reefer_plug_id    VARCHAR(20)      NULL,        -- Physical plug identifier
  is_reserved       BIT              NOT NULL CONSTRAINT df_ys_reserved DEFAULT 0,
  reserved_for_party_id UNIQUEIDENTIFIER NULL,    -- → parties.id (line/customer reservation)

  is_blocked        BIT              NOT NULL CONSTRAINT df_ys_blocked DEFAULT 0,            -- Maintenance / damage
  block_reason      NVARCHAR(200)    NULL,

  is_active         BIT              NOT NULL CONSTRAINT df_ys_is_active DEFAULT 1,

  created_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ys_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by        UNIQUEIDENTIFIER  NOT NULL,
  updated_at        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ys_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by        UNIQUEIDENTIFIER  NOT NULL,
  row_version       ROWVERSION        NOT NULL,

  CONSTRAINT pk_yard_slots PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_yard_slots_bay CHECK (bay_number >= 1),
  CONSTRAINT ck_yard_slots_tier CHECK (tier_number >= 1)
);

CREATE UNIQUE INDEX uq_yard_slots_position
  ON dbo.yard_slots (tenant_id, yard_block_id, row_label, bay_number, tier_number);
CREATE INDEX ix_yard_slots_block
  ON dbo.yard_slots (tenant_id, yard_block_id, is_active);
CREATE INDEX ix_yard_slots_reserved
  ON dbo.yard_slots (tenant_id, reserved_for_party_id)
  WHERE reserved_for_party_id IS NOT NULL;
GO

PRINT N'  Section 6: yard_rows + yard_slots created (optional sub-block dimensions)';
GO

-- ==========================================================================
-- SECTION 7 — Notes for migration 0004 (temporal + RLS extension)
-- ==========================================================================
-- The new tables are NOT yet temporal-versioned and NOT yet protected by
-- the RLS policy. That's done in db/master/migrations/0004_master_gaps_temporal_rls.sql
-- to keep concerns separated.

PRINT N'== 0003_master_gaps_close.sql complete';
PRINT N'';
PRINT N'   Tables added in lookup schema (5, system-wide reference, no tenant_id):';
PRINT N'     lookup.direction_types  (5 rows seeded)';
PRINT N'     lookup.cargo_classes    (7 rows seeded)';
PRINT N'     lookup.customer_tiers   (6 rows: VIP/GOLD/SILVER/BRONZE/STANDARD/PROSPECT)';
PRINT N'     lookup.incoterms        (11 rows: INCOTERMS 2020)';
PRINT N'     lookup.document_types   (30 rows: Transport/Customs/Financial/EMR)';
PRINT N'';
PRINT N'   Tables added in dbo schema (4, per-tenant):';
PRINT N'     dbo.service_types       (seed in 0005)';
PRINT N'     dbo.tax_codes           (seed in 0005)';
PRINT N'     dbo.yard_rows           (optional)';
PRINT N'     dbo.yard_slots          (optional)';
PRINT N'';
PRINT N'   Tables altered:';
PRINT N'     dbo.order_types          — direction/shipment_type/cargo_type cols replaced';
PRINT N'                                with direction_code + service_type_id + cargo_class_code';
PRINT N'     dbo.customer_extensions  — added tier_code (default STANDARD)';
PRINT N'';
PRINT N'   Next: db/master/migrations/0004_master_gaps_temporal_rls.sql';
GO
