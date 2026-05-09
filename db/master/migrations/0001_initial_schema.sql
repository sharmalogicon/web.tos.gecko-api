/* ==========================================================================
   Gecko Master DB — Initial Schema (Migration 0001)
   --------------------------------------------------------------------------
   Run inside an existing gecko_master_<tenant> database.
   Source: docs/db-design/MASTER-SCHEMA.md v2 (all 10 architect Qs resolved).

   Sections:
     1. Schemas + RLS infrastructure
     2. Org hierarchy: companies, branches, yards, yard_blocks
     3. Parties: parties, party_aliases, customer_extensions,
                 shipping_line_extensions, haulier_extensions,
                 forwarder_extensions, contacts
     4. Master entities: vessels, ports, locations, container_types
     5. Charges: charge_codes, charge_code_variants
     6. Order types + movements: order_types, order_type_movements,
                                 order_type_charges, movements
     7. Holds + container conditions
     8. Commodities

   Conventions (per ARCHITECTURE.md §11 + MASTER-SCHEMA.md §2):
     - snake_case tables (plural), columns
     - id = UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()
     - audit columns on every table
     - NO physical FK constraints (ADR-007); logical refs via *_id + indexes
     - DECIMAL(19,4) for money + 3-char currency
     - DATETIMEOFFSET(3) for all timestamps
     - NVARCHAR for human-readable names (multi-script)
     - Temporal tables activated in 0002 migration
     - RLS policies activated in 0002 migration
   ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'== 0001_initial_schema.sql starting at ' + CONVERT(NVARCHAR, SYSDATETIMEOFFSET(), 121);

-- ==========================================================================
-- SECTION 1 — Schemas + RLS infrastructure
-- ==========================================================================

IF SCHEMA_ID(N'history') IS NULL
  EXEC(N'CREATE SCHEMA history AUTHORIZATION dbo');
GO

PRINT N'  Schema history created';

-- RLS predicate function: row visible if its tenant_id matches session context,
-- OR caller is db_owner (for migration / backfill operations).
CREATE OR ALTER FUNCTION dbo.fn_tenant_filter(@tenant_id UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS RETURN
  SELECT 1 AS allowed
  WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS UNIQUEIDENTIFIER)
     OR DATABASE_PRINCIPAL_ID() = DATABASE_PRINCIPAL_ID(N'dbo');
GO

PRINT N'  RLS function dbo.fn_tenant_filter created';
GO

-- ==========================================================================
-- SECTION 2 — Org hierarchy (companies → branches → yards → yard_blocks)
-- ==========================================================================

CREATE TABLE dbo.companies (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  company_code          VARCHAR(10)      NOT NULL,
  company_name_en       NVARCHAR(255)    NOT NULL,
  company_name_local    NVARCHAR(255)    NULL,
  registration_no       NVARCHAR(100)    NULL,
  tax_id                VARCHAR(30)      NULL,
  default_currency      CHAR(3)          NULL,
  is_active             BIT              NOT NULL CONSTRAINT df_companies_is_active DEFAULT 1,

  -- Audit
  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_companies_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_companies_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_companies PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_companies_currency_iso CHECK (default_currency IS NULL OR LEN(default_currency) = 3)
);

CREATE UNIQUE INDEX uq_companies_tenant_code
  ON dbo.companies (tenant_id, company_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_companies_tenant
  ON dbo.companies (tenant_id) INCLUDE (company_name_en) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.branches (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  company_id            UNIQUEIDENTIFIER NOT NULL,    -- → companies.id (logical)
  branch_code           VARCHAR(10)      NOT NULL,
  branch_name_en        NVARCHAR(255)    NOT NULL,
  branch_name_local     NVARCHAR(255)    NULL,

  -- Embedded address (most branches have one fixed address)
  address1              NVARCHAR(255)    NULL,
  address2              NVARCHAR(255)    NULL,
  city                  NVARCHAR(100)    NULL,
  state                 NVARCHAR(100)    NULL,
  postcode              VARCHAR(25)      NULL,
  country_code          CHAR(2)          NULL,
  phone                 VARCHAR(50)      NULL,
  email                 VARCHAR(255)     NULL,

  -- Geographic
  latitude              DECIMAL(9,6)     NULL,
  longitude             DECIMAL(9,6)     NULL,
  timezone              VARCHAR(50)      NULL,    -- IANA tz: 'Asia/Bangkok', etc.

  is_active             BIT              NOT NULL CONSTRAINT df_branches_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_branches_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_branches_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_branches PRIMARY KEY CLUSTERED (id)
);

CREATE UNIQUE INDEX uq_branches_tenant_code
  ON dbo.branches (tenant_id, branch_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_branches_company
  ON dbo.branches (tenant_id, company_id) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.yards (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  branch_id             UNIQUEIDENTIFIER NOT NULL,
  yard_code             VARCHAR(20)      NOT NULL,
  yard_name_en          NVARCHAR(255)    NOT NULL,
  yard_name_local       NVARCHAR(255)    NULL,
  yard_type             VARCHAR(20)      NOT NULL,    -- 'IMPORT' | 'EXPORT' | 'EMPTY' | 'CFS' | 'MIXED'
  capacity_teu          INT              NULL,
  is_active             BIT              NOT NULL CONSTRAINT df_yards_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yards_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yards_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_yards PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_yards_type CHECK (yard_type IN (N'IMPORT', N'EXPORT', N'EMPTY', N'CFS', N'MIXED'))
);

CREATE UNIQUE INDEX uq_yards_tenant_code
  ON dbo.yards (tenant_id, yard_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_yards_branch
  ON dbo.yards (tenant_id, branch_id) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.yard_blocks (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  yard_id               UNIQUEIDENTIFIER NOT NULL,
  block_code            VARCHAR(20)      NOT NULL,

  -- Layout
  max_rows              TINYINT          NULL,
  max_columns           TINYINT          NULL,
  max_tiers             TINYINT          NULL,

  -- Allocation
  allocated_to_party_id UNIQUEIDENTIFIER NULL,    -- → parties.id (line/customer block reservation)
  allocated_size_ft     TINYINT          NULL,
  is_reefer_block       BIT              NOT NULL CONSTRAINT df_yard_blocks_is_reefer DEFAULT 0,
  is_oog_block          BIT              NOT NULL CONSTRAINT df_yard_blocks_is_oog DEFAULT 0,
  is_active             BIT              NOT NULL CONSTRAINT df_yard_blocks_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yard_blocks_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_yard_blocks_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_yard_blocks PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_yard_blocks_size CHECK (allocated_size_ft IS NULL OR allocated_size_ft IN (20, 40, 45))
);

CREATE UNIQUE INDEX uq_yard_blocks_tenant_yard_code
  ON dbo.yard_blocks (tenant_id, yard_id, block_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_yard_blocks_yard
  ON dbo.yard_blocks (tenant_id, yard_id) WHERE deleted_at IS NULL;

CREATE INDEX ix_yard_blocks_allocated_party
  ON dbo.yard_blocks (tenant_id, allocated_to_party_id)
  WHERE allocated_to_party_id IS NOT NULL AND deleted_at IS NULL;
GO

PRINT N'  Section 2: Org hierarchy (companies, branches, yards, yard_blocks) created';
GO

-- ==========================================================================
-- SECTION 3 — Parties + extensions + aliases + contacts
-- ==========================================================================

CREATE TABLE dbo.parties (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  -- Canonical code (auto-generated per tenant via sequence — Q1 resolution)
  party_code            VARCHAR(25)      NOT NULL,
  name_en               NVARCHAR(255)    NOT NULL,
  name_local            NVARCHAR(255)    NULL,
  registration_no       NVARCHAR(100)    NULL,
  tax_id                VARCHAR(30)      NULL,

  -- Country & default currency (logical refs to platform.countries / platform.currencies)
  country_code          CHAR(2)          NOT NULL,
  default_currency      CHAR(3)          NULL,

  -- Primary contact (embedded — most parties have one main address)
  primary_address1      NVARCHAR(255)    NULL,
  primary_address2      NVARCHAR(255)    NULL,
  primary_city          NVARCHAR(100)    NULL,
  primary_state         NVARCHAR(100)    NULL,
  primary_postcode      VARCHAR(25)      NULL,
  primary_phone         VARCHAR(50)      NULL,
  primary_email         VARCHAR(255)     NULL,
  primary_website       VARCHAR(500)     NULL,

  remarks               NVARCHAR(500)    NULL,
  is_active             BIT              NOT NULL CONSTRAINT df_parties_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_parties_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_parties_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_parties PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_parties_country_iso CHECK (LEN(country_code) = 2),
  CONSTRAINT ck_parties_currency_iso CHECK (default_currency IS NULL OR LEN(default_currency) = 3),
  CONSTRAINT ck_parties_email CHECK (primary_email IS NULL OR primary_email LIKE N'%@%.%')
);

CREATE UNIQUE INDEX uq_parties_tenant_party_code
  ON dbo.parties (tenant_id, party_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_parties_tenant_country
  ON dbo.parties (tenant_id, country_code) WHERE deleted_at IS NULL;

CREATE INDEX ix_parties_name_en
  ON dbo.parties (tenant_id, name_en) WHERE deleted_at IS NULL;

CREATE INDEX ix_parties_tax_id
  ON dbo.parties (tenant_id, tax_id) WHERE tax_id IS NOT NULL AND deleted_at IS NULL;
GO

CREATE TABLE dbo.party_aliases (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  party_id              UNIQUEIDENTIFIER NOT NULL,    -- → parties.id

  alias_type            VARCHAR(30)      NOT NULL,
  alias_value           VARCHAR(50)      NOT NULL,
  alias_label           NVARCHAR(100)    NULL,

  valid_from            DATE             NULL,
  valid_to              DATE             NULL,

  is_primary_for_type   BIT              NOT NULL CONSTRAINT df_party_aliases_is_primary DEFAULT 0,
  is_active             BIT              NOT NULL CONSTRAINT df_party_aliases_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_party_aliases_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_party_aliases_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_party_aliases PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_party_aliases_type CHECK (alias_type IN
    (N'LEGACY', N'CUSTOMER_ERP', N'BANK_REF', N'SCAC', N'SMDG',
     N'CUSTOMS_REG', N'TAX_ID', N'EDI_PARTNER', N'OTHER'))
);

-- Uniqueness: same alias_value can't be reused within (tenant, alias_type) while active
CREATE UNIQUE INDEX uq_party_aliases_value
  ON dbo.party_aliases (tenant_id, alias_type, alias_value) WHERE is_active = 1;

-- Find-by-any-code lookup
CREATE INDEX ix_party_aliases_value
  ON dbo.party_aliases (tenant_id, alias_value)
  INCLUDE (party_id, alias_type) WHERE is_active = 1;

CREATE INDEX ix_party_aliases_party
  ON dbo.party_aliases (tenant_id, party_id, alias_type) WHERE is_active = 1;
GO

CREATE TABLE dbo.customer_extensions (
  id                          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,
  party_id                    UNIQUEIDENTIFIER NOT NULL,    -- → parties.id

  -- Sub-roles that share customer-extension columns (no own extension table)
  is_billing                  BIT NOT NULL CONSTRAINT df_cust_ext_is_billing DEFAULT 1,
  is_shipper                  BIT NOT NULL CONSTRAINT df_cust_ext_is_shipper DEFAULT 0,
  is_consignee                BIT NOT NULL CONSTRAINT df_cust_ext_is_consignee DEFAULT 0,
  is_transporter              BIT NOT NULL CONSTRAINT df_cust_ext_is_transporter DEFAULT 0,

  -- Accounting
  debtor_code                 VARCHAR(20)      NULL,
  revenue_account             VARCHAR(20)      NULL,
  credit_term_days            SMALLINT         NULL,
  credit_limit                DECIMAL(19,4)    NULL,
  credit_limit_currency       CHAR(3)          NULL,
  long_standing_threshold_days SMALLINT        NULL,

  -- Defaults for booking (cross-module logical refs)
  default_tariff_id           UNIQUEIDENTIFIER NULL,    -- → tos.tariff_plans.id (cross-DB)
  default_payment_term        VARCHAR(20)      NULL,    -- 'CASH' | 'CREDIT' | 'PREPAID' | 'COD'

  is_active                   BIT              NOT NULL CONSTRAINT df_cust_ext_is_active DEFAULT 1,

  created_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cust_ext_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by                  UNIQUEIDENTIFIER  NOT NULL,
  updated_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cust_ext_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by                  UNIQUEIDENTIFIER  NOT NULL,
  deleted_at                  DATETIMEOFFSET(3) NULL,
  row_version                 ROWVERSION        NOT NULL,

  CONSTRAINT pk_customer_extensions PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_cust_ext_payment_term CHECK
    (default_payment_term IS NULL OR default_payment_term IN (N'CASH', N'CREDIT', N'PREPAID', N'COD')),
  CONSTRAINT ck_cust_ext_credit_currency CHECK
    (credit_limit_currency IS NULL OR LEN(credit_limit_currency) = 3),
  CONSTRAINT ck_cust_ext_credit_pair CHECK
    ((credit_limit IS NULL AND credit_limit_currency IS NULL)
     OR (credit_limit IS NOT NULL AND credit_limit_currency IS NOT NULL))
);

CREATE UNIQUE INDEX uq_customer_extensions_party
  ON dbo.customer_extensions (tenant_id, party_id) WHERE deleted_at IS NULL;

CREATE INDEX ix_customer_extensions_debtor
  ON dbo.customer_extensions (tenant_id, debtor_code)
  WHERE debtor_code IS NOT NULL AND deleted_at IS NULL;
GO

CREATE TABLE dbo.shipping_line_extensions (
  id                          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,
  party_id                    UNIQUEIDENTIFIER NOT NULL,

  scac_code                   VARCHAR(4)       NULL,
  smdg_code                   VARCHAR(10)      NULL,
  imo_company_no              VARCHAR(15)      NULL,
  iata_code                   VARCHAR(3)       NULL,

  -- Operator identity (Q2 — slot charter / alliance / vessel-sharing)
  operator_code               VARCHAR(10)      NULL,

  container_prefix_primary    VARCHAR(4)       NULL,
  container_prefix_secondary  VARCHAR(4)       NULL,

  alliance_code               VARCHAR(20)      NULL,
  alliance_name               NVARCHAR(100)    NULL,

  edi_partner_code            VARCHAR(20)      NULL,
  edi_handler_url             VARCHAR(500)     NULL,
  edi_supports_coparn         BIT              NOT NULL CONSTRAINT df_sl_ext_coparn DEFAULT 0,
  edi_supports_codeco         BIT              NOT NULL CONSTRAINT df_sl_ext_codeco DEFAULT 0,
  edi_supports_coarri         BIT              NOT NULL CONSTRAINT df_sl_ext_coarri DEFAULT 0,
  edi_supports_baplie         BIT              NOT NULL CONSTRAINT df_sl_ext_baplie DEFAULT 0,

  brand_color_hex             CHAR(7)          NULL,
  is_active                   BIT              NOT NULL CONSTRAINT df_sl_ext_is_active DEFAULT 1,

  created_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_sl_ext_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by                  UNIQUEIDENTIFIER  NOT NULL,
  updated_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_sl_ext_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by                  UNIQUEIDENTIFIER  NOT NULL,
  deleted_at                  DATETIMEOFFSET(3) NULL,
  row_version                 ROWVERSION        NOT NULL,

  CONSTRAINT pk_shipping_line_extensions PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_sl_ext_brand_color CHECK
    (brand_color_hex IS NULL OR brand_color_hex LIKE N'#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE UNIQUE INDEX uq_sl_ext_party
  ON dbo.shipping_line_extensions (tenant_id, party_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_sl_ext_scac
  ON dbo.shipping_line_extensions (tenant_id, scac_code)
  WHERE scac_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX ix_sl_ext_alliance
  ON dbo.shipping_line_extensions (tenant_id, alliance_code)
  WHERE alliance_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX ix_sl_ext_container_prefix
  ON dbo.shipping_line_extensions (tenant_id, container_prefix_primary)
  WHERE container_prefix_primary IS NOT NULL AND deleted_at IS NULL;
GO

CREATE TABLE dbo.haulier_extensions (
  id                          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,
  party_id                    UNIQUEIDENTIFIER NOT NULL,

  fleet_size                  SMALLINT         NULL,
  primary_chassis_size_ft     TINYINT          NULL,    -- 20 | 40 | 45
  owns_trucks                 BIT              NOT NULL CONSTRAINT df_haul_ext_owns_trucks DEFAULT 0,
  rate_card_based             BIT              NOT NULL CONSTRAINT df_haul_ext_rate_card DEFAULT 0,
  default_rate_card_id        UNIQUEIDENTIFIER NULL,    -- → trucking.rate_cards.id (cross-DB)
  trucking_zone_codes         NVARCHAR(500)    NULL,    -- Comma-separated zone tags

  is_active                   BIT              NOT NULL CONSTRAINT df_haul_ext_is_active DEFAULT 1,

  created_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_haul_ext_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by                  UNIQUEIDENTIFIER  NOT NULL,
  updated_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_haul_ext_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by                  UNIQUEIDENTIFIER  NOT NULL,
  deleted_at                  DATETIMEOFFSET(3) NULL,
  row_version                 ROWVERSION        NOT NULL,

  CONSTRAINT pk_haulier_extensions PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_haul_ext_chassis_size CHECK
    (primary_chassis_size_ft IS NULL OR primary_chassis_size_ft IN (20, 40, 45))
);

CREATE UNIQUE INDEX uq_haul_ext_party
  ON dbo.haulier_extensions (tenant_id, party_id) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.forwarder_extensions (
  id                          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,
  party_id                    UNIQUEIDENTIFIER NOT NULL,

  aeo_certified               BIT              NOT NULL CONSTRAINT df_fwd_ext_aeo DEFAULT 0,
  aeo_certificate_no          VARCHAR(50)      NULL,
  aeo_expiry_date             DATE             NULL,
  iata_code                   VARCHAR(3)       NULL,
  ifff_code                   VARCHAR(20)      NULL,    -- Membership in regional fwd federation

  preferred_customs_broker_id UNIQUEIDENTIFIER NULL,    -- → parties.id (a customs broker party)
  default_freight_term        VARCHAR(20)      NULL,    -- INCOTERM: 'FOB' | 'CFR' | 'CIF' | etc.

  is_active                   BIT              NOT NULL CONSTRAINT df_fwd_ext_is_active DEFAULT 1,

  created_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_fwd_ext_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by                  UNIQUEIDENTIFIER  NOT NULL,
  updated_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_fwd_ext_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by                  UNIQUEIDENTIFIER  NOT NULL,
  deleted_at                  DATETIMEOFFSET(3) NULL,
  row_version                 ROWVERSION        NOT NULL,

  CONSTRAINT pk_forwarder_extensions PRIMARY KEY CLUSTERED (id)
);

CREATE UNIQUE INDEX uq_fwd_ext_party
  ON dbo.forwarder_extensions (tenant_id, party_id) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.contacts (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  -- Exactly one of these is non-null (CHECK constraint enforces)
  party_id              UNIQUEIDENTIFIER NULL,
  vessel_id             UNIQUEIDENTIFIER NULL,
  port_id               UNIQUEIDENTIFIER NULL,
  branch_id             UNIQUEIDENTIFIER NULL,

  contact_type          VARCHAR(30)      NOT NULL,    -- 'BILLING' | 'SHIPPING' | 'OPERATIONS' | 'EMERGENCY'
  contact_person        NVARCHAR(100)    NULL,
  job_title             NVARCHAR(100)    NULL,
  address1              NVARCHAR(255)    NULL,
  address2              NVARCHAR(255)    NULL,
  city                  NVARCHAR(100)    NULL,
  state                 NVARCHAR(100)    NULL,
  postcode              VARCHAR(25)      NULL,
  country_code          CHAR(2)          NULL,
  phone                 VARCHAR(50)      NULL,
  mobile                VARCHAR(50)      NULL,
  fax                   VARCHAR(50)      NULL,
  email                 VARCHAR(255)     NULL,
  website               VARCHAR(500)     NULL,

  -- LINE / WhatsApp / WeChat (SEA reality)
  social_handle_1       VARCHAR(255)     NULL,
  social_handle_2       VARCHAR(255)     NULL,

  is_default            BIT              NOT NULL CONSTRAINT df_contacts_is_default DEFAULT 0,
  is_active             BIT              NOT NULL CONSTRAINT df_contacts_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_contacts_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_contacts_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_contacts PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_contacts_one_parent CHECK (
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN vessel_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN port_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT ck_contacts_type CHECK
    (contact_type IN (N'BILLING', N'SHIPPING', N'OPERATIONS', N'EMERGENCY', N'TECHNICAL', N'OTHER'))
);

CREATE INDEX ix_contacts_party    ON dbo.contacts (tenant_id, party_id)
  WHERE party_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_contacts_vessel   ON dbo.contacts (tenant_id, vessel_id)
  WHERE vessel_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_contacts_port     ON dbo.contacts (tenant_id, port_id)
  WHERE port_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_contacts_branch   ON dbo.contacts (tenant_id, branch_id)
  WHERE branch_id IS NOT NULL AND deleted_at IS NULL;
GO

PRINT N'  Section 3: Parties + extensions + aliases + contacts created';
GO

-- ==========================================================================
-- SECTION 4 — Master entities: vessels, ports, locations, container_types
-- ==========================================================================

CREATE TABLE dbo.vessels (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  vessel_code           VARCHAR(20)      NOT NULL,
  vessel_name           NVARCHAR(255)    NOT NULL,
  vessel_name_local     NVARCHAR(255)    NULL,

  imo_number            VARCHAR(7)       NULL,    -- 7-digit IMO number
  call_sign             VARCHAR(10)      NULL,
  mmsi                  VARCHAR(9)       NULL,    -- Maritime Mobile Service ID

  operator_party_id     UNIQUEIDENTIFIER NULL,    -- → parties.id
  flag_country_code     CHAR(2)          NULL,

  teu_capacity          INT              NULL,
  gross_tonnage         INT              NULL,

  edi_mapping_code      VARCHAR(20)      NULL,

  is_active             BIT              NOT NULL CONSTRAINT df_vessels_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_vessels_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_vessels_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_vessels PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_vessels_imo CHECK (imo_number IS NULL OR imo_number LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  CONSTRAINT ck_vessels_mmsi CHECK (mmsi IS NULL OR mmsi LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);

CREATE UNIQUE INDEX uq_vessels_tenant_code
  ON dbo.vessels (tenant_id, vessel_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_vessels_tenant_imo
  ON dbo.vessels (tenant_id, imo_number) WHERE imo_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_vessels_operator
  ON dbo.vessels (tenant_id, operator_party_id) WHERE operator_party_id IS NOT NULL AND deleted_at IS NULL;
GO

CREATE TABLE dbo.ports (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  port_code             VARCHAR(20)      NOT NULL,
  un_locode             VARCHAR(5)       NULL,
  port_name_en          NVARCHAR(255)    NOT NULL,
  port_name_local       NVARCHAR(255)    NULL,

  port_type             VARCHAR(20)      NOT NULL,
  country_code          CHAR(2)          NOT NULL,
  trade_mode            VARCHAR(20)      NOT NULL CONSTRAINT df_ports_trade_mode DEFAULT N'INTERNATIONAL',

  latitude              DECIMAL(9,6)     NULL,
  longitude             DECIMAL(9,6)     NULL,
  timezone              VARCHAR(50)      NULL,

  postcode              VARCHAR(25)      NULL,
  edi_mapping_code      VARCHAR(25)      NULL,
  paperless_code        VARCHAR(10)      NULL,

  is_active             BIT              NOT NULL CONSTRAINT df_ports_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ports_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ports_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_ports PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_ports_type CHECK (port_type IN
    (N'SEAPORT', N'INLAND_DEPOT', N'CFS', N'AIRPORT', N'RAIL', N'BORDER_CROSSING')),
  CONSTRAINT ck_ports_trade_mode CHECK (trade_mode IN (N'DOMESTIC', N'INTERNATIONAL', N'BOTH')),
  CONSTRAINT ck_ports_country CHECK (LEN(country_code) = 2)
);

CREATE UNIQUE INDEX uq_ports_tenant_code
  ON dbo.ports (tenant_id, port_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_ports_tenant_locode
  ON dbo.ports (tenant_id, un_locode) WHERE un_locode IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_ports_country_type
  ON dbo.ports (tenant_id, country_code, port_type) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.locations (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  location_code         VARCHAR(30)      NOT NULL,
  location_name_en      NVARCHAR(255)    NOT NULL,
  location_name_local   NVARCHAR(255)    NULL,

  location_type         VARCHAR(30)      NOT NULL,    -- 'FACTORY' | 'WAREHOUSE' | 'INDUSTRIAL_ESTATE' | 'CFS' | 'OTHER'
  area_code             VARCHAR(20)      NULL,        -- Optional sub-region code

  address1              NVARCHAR(255)    NULL,
  address2              NVARCHAR(255)    NULL,
  city                  NVARCHAR(100)    NULL,
  state                 NVARCHAR(100)    NULL,
  postcode              VARCHAR(25)      NULL,
  country_code          CHAR(2)          NULL,

  latitude              DECIMAL(9,6)     NULL,
  longitude             DECIMAL(9,6)     NULL,

  is_active             BIT              NOT NULL CONSTRAINT df_locations_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_locations_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_locations_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_locations PRIMARY KEY CLUSTERED (id)
);

CREATE UNIQUE INDEX uq_locations_tenant_code
  ON dbo.locations (tenant_id, location_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_locations_area
  ON dbo.locations (tenant_id, area_code) WHERE area_code IS NOT NULL AND deleted_at IS NULL;
GO

CREATE TABLE dbo.container_types (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  iso_code              VARCHAR(4)       NOT NULL,    -- Single ISO code (22G1, 45G1, etc.)
  type_size_code        VARCHAR(4)       NOT NULL,    -- 20GP, 40HC, etc.

  size_ft               TINYINT          NOT NULL,
  type_code             VARCHAR(2)       NOT NULL,    -- GP/HC/RF/RH/OT/FR/TK/PL
  height_class          VARCHAR(20)      NOT NULL,    -- STANDARD | HIGH_CUBE

  description_en        NVARCHAR(255)    NOT NULL,
  description_local     NVARCHAR(255)    NULL,

  teu                   DECIMAL(3,1)     NOT NULL,
  is_reefer             BIT              NOT NULL CONSTRAINT df_ct_is_reefer DEFAULT 0,
  is_oog                BIT              NOT NULL CONSTRAINT df_ct_is_oog DEFAULT 0,

  tare_weight_kg        DECIMAL(8,2)     NULL,
  max_payload_kg        DECIMAL(8,2)     NULL,
  max_gross_kg          DECIMAL(8,2)     NULL,

  display_color_hex     CHAR(7)          NULL,
  is_active             BIT              NOT NULL CONSTRAINT df_ct_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ct_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ct_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_container_types PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_ct_size      CHECK (size_ft IN (20, 40, 45, 53)),
  CONSTRAINT ck_ct_height    CHECK (height_class IN (N'STANDARD', N'HIGH_CUBE')),
  CONSTRAINT ck_ct_teu       CHECK (teu > 0)
);

CREATE UNIQUE INDEX uq_ct_tenant_iso
  ON dbo.container_types (tenant_id, iso_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_ct_tenant_typesize
  ON dbo.container_types (tenant_id, type_size_code) WHERE deleted_at IS NULL;
GO

PRINT N'  Section 4: Vessels, Ports, Locations, Container Types created';
GO

-- ==========================================================================
-- SECTION 5 — Charges: charge_codes + charge_code_variants
-- ==========================================================================

CREATE TABLE dbo.charge_codes (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  charge_code           VARCHAR(15)      NOT NULL,    -- Canonical: "SA001" (no -CA/-CR suffix)
  description_en        NVARCHAR(200)    NOT NULL,
  description_local     NVARCHAR(200)    NULL,

  module                VARCHAR(20)      NOT NULL,    -- TOS | CFS | TRUCKING | EMR
  charge_type           VARCHAR(30)      NOT NULL,    -- STORAGE | LIFT | GATE | DOC | VAS | MOVEMENT
  charge_category       VARCHAR(30)      NOT NULL,    -- GENERAL | REEFER | DG | OOG | EMPTY | LADEN
  billing_unit          VARCHAR(30)      NOT NULL,    -- PER_CONTAINER | PER_TEU | PER_DAY | PER_TON | PER_BL
  is_by_service         BIT              NOT NULL CONSTRAINT df_cc_by_service DEFAULT 0,

  is_active             BIT              NOT NULL CONSTRAINT df_cc_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cc_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cc_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_charge_codes PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_cc_module CHECK (module IN (N'TOS', N'CFS', N'TRUCKING', N'EMR', N'PLATFORM'))
);

CREATE UNIQUE INDEX uq_charge_codes_tenant_code
  ON dbo.charge_codes (tenant_id, charge_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_charge_codes_module_type
  ON dbo.charge_codes (tenant_id, module, charge_type) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.charge_code_variants (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  charge_code_id        UNIQUEIDENTIFIER NOT NULL,    -- → charge_codes.id

  bill_to               VARCHAR(20)      NOT NULL,    -- CUSTOMER | AGENT | LINE | SHIPPER | CONSIGNEE | FORWARDER
  payment_term          VARCHAR(20)      NOT NULL,    -- CASH | CREDIT | PREPAID | COD

  default_rate          DECIMAL(19,4)    NULL,
  currency              CHAR(3)          NOT NULL,
  vat_rate              DECIMAL(5,2)     NOT NULL CONSTRAINT df_ccv_vat_rate DEFAULT 0.00,
  credit_term_days      SMALLINT         NULL,
  revenue_gl            VARCHAR(20)      NULL,
  cost_gl               VARCHAR(20)      NULL,

  legacy_charge_code    VARCHAR(15)      NULL,        -- Audit trail for migration
  is_active             BIT              NOT NULL CONSTRAINT df_ccv_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ccv_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ccv_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_charge_code_variants PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_ccv_bill_to CHECK
    (bill_to IN (N'CUSTOMER', N'AGENT', N'LINE', N'SHIPPER', N'CONSIGNEE', N'FORWARDER', N'HAULIER')),
  CONSTRAINT ck_ccv_payment_term CHECK
    (payment_term IN (N'CASH', N'CREDIT', N'PREPAID', N'COD')),
  CONSTRAINT ck_ccv_currency CHECK (LEN(currency) = 3),
  CONSTRAINT ck_ccv_vat_range CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

CREATE UNIQUE INDEX uq_ccv_matrix
  ON dbo.charge_code_variants (tenant_id, charge_code_id, bill_to, payment_term)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_ccv_legacy
  ON dbo.charge_code_variants (tenant_id, legacy_charge_code)
  WHERE legacy_charge_code IS NOT NULL;
GO

PRINT N'  Section 5: Charge codes + variants created';
GO

-- ==========================================================================
-- SECTION 6 — Order types + junctions + movements
-- ==========================================================================

CREATE TABLE dbo.movements (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  movement_code         VARCHAR(20)      NOT NULL,    -- FULL_IN, FULL_OUT, MTY_IN, MTY_OUT, LOAD, DISCHARGE, ...
  description_en        NVARCHAR(100)    NOT NULL,
  description_local     NVARCHAR(100)    NULL,

  ef_indicator          VARCHAR(10)      NOT NULL,    -- FULL | EMPTY
  direction             VARCHAR(10)      NOT NULL,    -- IN | OUT | TRANSFER
  applies_to_module     VARCHAR(20)      NOT NULL,    -- TOS | TRUCKING | BOTH

  changes_yard_position BIT              NOT NULL CONSTRAINT df_mv_changes_yard DEFAULT 0,
  changes_status        BIT              NOT NULL CONSTRAINT df_mv_changes_status DEFAULT 0,

  is_active             BIT              NOT NULL CONSTRAINT df_mv_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_mv_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_mv_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_movements PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_mv_ef        CHECK (ef_indicator IN (N'FULL', N'EMPTY')),
  CONSTRAINT ck_mv_direction CHECK (direction IN (N'IN', N'OUT', N'TRANSFER')),
  CONSTRAINT ck_mv_module    CHECK (applies_to_module IN (N'TOS', N'TRUCKING', N'BOTH'))
);

CREATE UNIQUE INDEX uq_movements_tenant_code
  ON dbo.movements (tenant_id, movement_code);
GO

CREATE TABLE dbo.order_types (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  order_code            VARCHAR(50)      NOT NULL,
  description_en        NVARCHAR(255)    NOT NULL,
  description_local     NVARCHAR(255)    NULL,

  direction             VARCHAR(10)      NOT NULL,    -- IMPORT | EXPORT | TRANSHIP | DOMESTIC
  shipment_type         VARCHAR(20)      NOT NULL,    -- CY | CFS | CY_IN | CY_OUT
  cargo_type            VARCHAR(20)      NULL,        -- GENERAL | REEFER | DG | OOG

  is_active             BIT              NOT NULL CONSTRAINT df_ot_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ot_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_ot_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  deleted_at            DATETIMEOFFSET(3) NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_order_types PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_ot_direction CHECK
    (direction IN (N'IMPORT', N'EXPORT', N'TRANSHIP', N'DOMESTIC')),
  CONSTRAINT ck_ot_shipment_type CHECK
    (shipment_type IN (N'CY', N'CFS', N'CY_IN', N'CY_OUT', N'BREAKBULK'))
);

CREATE UNIQUE INDEX uq_order_types_tenant_code
  ON dbo.order_types (tenant_id, order_code) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.order_type_movements (
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  order_type_id         UNIQUEIDENTIFIER NOT NULL,    -- → order_types.id
  movement_id           UNIQUEIDENTIFIER NOT NULL,    -- → movements.id

  sequence_no           SMALLINT         NULL,        -- Workflow order
  is_required           BIT              NOT NULL CONSTRAINT df_otm_is_required DEFAULT 1,
  is_billable           BIT              NOT NULL CONSTRAINT df_otm_is_billable DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_otm_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_otm_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_order_type_movements PRIMARY KEY CLUSTERED (tenant_id, order_type_id, movement_id)
);

-- Reverse-direction lookup: given a movement, which order types use it?
CREATE INDEX ix_otm_movement_order
  ON dbo.order_type_movements (tenant_id, movement_id, order_type_id);
GO

CREATE TABLE dbo.order_type_charges (
  -- Composite PK with NULL-safe movement_id (using a sentinel UUID for the NULL case)
  -- The sentinel '00000000-0000-0000-0000-000000000000' represents "applies to any movement"
  tenant_id             UNIQUEIDENTIFIER NOT NULL,
  order_type_id         UNIQUEIDENTIFIER NOT NULL,    -- → order_types.id
  charge_code_id        UNIQUEIDENTIFIER NOT NULL,    -- → charge_codes.id (canonical)
  movement_key          UNIQUEIDENTIFIER NOT NULL,    -- = movement_id, or sentinel UUID for null

  movement_id           UNIQUEIDENTIFIER NULL,        -- → movements.id (NULL = any movement)

  is_default            BIT              NOT NULL CONSTRAINT df_otc_is_default DEFAULT 1,
  is_optional           BIT              NOT NULL CONSTRAINT df_otc_is_optional DEFAULT 0,
  default_qty           DECIMAL(10,2)    NULL,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_otc_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_otc_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_order_type_charges PRIMARY KEY CLUSTERED
    (tenant_id, order_type_id, charge_code_id, movement_key),
  -- movement_key must equal movement_id when movement_id is non-null
  CONSTRAINT ck_otc_movement_key_consistency CHECK
    ((movement_id IS NULL AND movement_key = N'00000000-0000-0000-0000-000000000000')
     OR movement_id = movement_key)
);

CREATE INDEX ix_otc_charge
  ON dbo.order_type_charges (tenant_id, charge_code_id, order_type_id);
CREATE INDEX ix_otc_movement
  ON dbo.order_type_charges (tenant_id, movement_id, order_type_id) WHERE movement_id IS NOT NULL;
GO

PRINT N'  Section 6: Order types + junctions + movements created';
GO

-- ==========================================================================
-- SECTION 7 — Holds + container conditions
-- ==========================================================================

CREATE TABLE dbo.holds (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  hold_code             VARCHAR(20)      NOT NULL,    -- CUSTOMS | DAMAGE | OFFHIRE | SALE | SURVEY
  description_en        NVARCHAR(200)    NOT NULL,
  description_local     NVARCHAR(200)    NULL,

  hold_type             VARCHAR(30)      NOT NULL,    -- CUSTOMS | AGENT | FINANCE | OPERATIONS
  blocking_scope        VARCHAR(30)      NOT NULL,    -- GATE_OUT | LOAD | BOTH
  release_authority     VARCHAR(50)      NOT NULL,

  priority              TINYINT          NOT NULL CONSTRAINT df_holds_priority DEFAULT 5,
  display_color_hex     CHAR(7)          NULL,

  auto_apply_on_event   VARCHAR(50)      NULL,
  notify_on_apply       BIT              NOT NULL CONSTRAINT df_holds_notify DEFAULT 1,

  is_active             BIT              NOT NULL CONSTRAINT df_holds_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_holds_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_holds_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_holds PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_holds_type CHECK
    (hold_type IN (N'CUSTOMS', N'AGENT', N'FINANCE', N'OPERATIONS', N'LEGAL')),
  CONSTRAINT ck_holds_scope CHECK
    (blocking_scope IN (N'GATE_OUT', N'LOAD', N'BOTH', N'GATE_IN')),
  CONSTRAINT ck_holds_priority CHECK (priority BETWEEN 1 AND 9)
);

CREATE UNIQUE INDEX uq_holds_tenant_code
  ON dbo.holds (tenant_id, hold_code);
GO

CREATE TABLE dbo.container_conditions (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  condition_code        VARCHAR(10)      NOT NULL,    -- AV | DMG | SOUND | SW | WW
  description_en        NVARCHAR(100)    NOT NULL,
  description_local     NVARCHAR(100)    NULL,

  severity              TINYINT          NOT NULL CONSTRAINT df_cc_severity DEFAULT 5,
  is_serviceable        BIT              NOT NULL CONSTRAINT df_cc_serviceable DEFAULT 1,
  requires_repair       BIT              NOT NULL CONSTRAINT df_cc_requires_repair DEFAULT 0,

  is_active             BIT              NOT NULL CONSTRAINT df_cc_is_active DEFAULT 1,

  created_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cc_created_at_v2 DEFAULT SYSDATETIMEOFFSET(),
  created_by            UNIQUEIDENTIFIER  NOT NULL,
  updated_at            DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_cc_updated_at_v2 DEFAULT SYSDATETIMEOFFSET(),
  updated_by            UNIQUEIDENTIFIER  NOT NULL,
  row_version           ROWVERSION        NOT NULL,

  CONSTRAINT pk_container_conditions PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_cc_severity CHECK (severity BETWEEN 1 AND 9)
);

CREATE UNIQUE INDEX uq_container_conditions_tenant_code
  ON dbo.container_conditions (tenant_id, condition_code);
GO

PRINT N'  Section 7: Holds + container_conditions created';
GO

-- ==========================================================================
-- SECTION 8 — Commodities (HS Code based)
-- ==========================================================================

CREATE TABLE dbo.commodities (
  id                          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,

  hs_code                     VARCHAR(10)      NOT NULL,    -- HS6 / HS8 / HS10
  description_en              NVARCHAR(255)    NOT NULL,
  description_local           NVARCHAR(255)    NULL,

  hs_chapter                  CHAR(2)          NOT NULL,
  hs_heading                  CHAR(4)          NOT NULL,

  is_dangerous                BIT              NOT NULL CONSTRAINT df_com_dangerous DEFAULT 0,
  imdg_class                  VARCHAR(10)      NULL,
  un_number                   VARCHAR(10)      NULL,

  is_temperature_controlled   BIT              NOT NULL CONSTRAINT df_com_temp DEFAULT 0,
  default_min_temp_c          DECIMAL(5,2)     NULL,
  default_max_temp_c          DECIMAL(5,2)     NULL,

  requires_certificate_of_origin BIT NOT NULL CONSTRAINT df_com_coo DEFAULT 0,
  requires_phyto_certificate     BIT NOT NULL CONSTRAINT df_com_phyto DEFAULT 0,
  requires_health_certificate    BIT NOT NULL CONSTRAINT df_com_health DEFAULT 0,

  is_active                   BIT              NOT NULL CONSTRAINT df_com_is_active DEFAULT 1,

  created_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_com_created_at DEFAULT SYSDATETIMEOFFSET(),
  created_by                  UNIQUEIDENTIFIER  NOT NULL,
  updated_at                  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_com_updated_at DEFAULT SYSDATETIMEOFFSET(),
  updated_by                  UNIQUEIDENTIFIER  NOT NULL,
  deleted_at                  DATETIMEOFFSET(3) NULL,
  row_version                 ROWVERSION        NOT NULL,

  CONSTRAINT pk_commodities PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_com_un_with_dangerous CHECK
    (un_number IS NULL OR is_dangerous = 1),
  CONSTRAINT ck_com_imdg_with_dangerous CHECK
    (imdg_class IS NULL OR is_dangerous = 1),
  CONSTRAINT ck_com_temp_range CHECK
    ((default_min_temp_c IS NULL AND default_max_temp_c IS NULL)
     OR (default_min_temp_c IS NOT NULL AND default_max_temp_c IS NOT NULL
         AND default_min_temp_c <= default_max_temp_c))
);

CREATE UNIQUE INDEX uq_commodities_tenant_hs
  ON dbo.commodities (tenant_id, hs_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_commodities_chapter
  ON dbo.commodities (tenant_id, hs_chapter) WHERE deleted_at IS NULL;
CREATE INDEX ix_commodities_dangerous
  ON dbo.commodities (tenant_id, is_dangerous)
  INCLUDE (hs_code, description_en) WHERE is_dangerous = 1 AND deleted_at IS NULL;
GO

PRINT N'  Section 8: Commodities created';
GO

-- ==========================================================================
-- Migration log table (for ETL tracking — used by scripts in db/master/etl/)
-- ==========================================================================

CREATE TABLE dbo.legacy_migration_log (
  id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  tenant_id             UNIQUEIDENTIFIER NOT NULL,

  step_no               SMALLINT         NOT NULL,
  step_name             NVARCHAR(100)    NOT NULL,
  source_table          NVARCHAR(255)    NULL,
  target_table          NVARCHAR(255)    NULL,

  rows_in               INT              NULL,
  rows_out              INT              NULL,
  rows_rejected         INT              NULL,
  reject_reason         NVARCHAR(MAX)    NULL,

  started_at            DATETIMEOFFSET(3) NOT NULL,
  completed_at          DATETIMEOFFSET(3) NULL,
  duration_ms           INT              NULL,
  status                VARCHAR(20)      NOT NULL,    -- 'STARTED' | 'OK' | 'FAILED' | 'PARTIAL'
  error_message         NVARCHAR(MAX)    NULL,

  CONSTRAINT pk_legacy_migration_log PRIMARY KEY CLUSTERED (id),
  CONSTRAINT ck_lml_status CHECK (status IN (N'STARTED', N'OK', N'FAILED', N'PARTIAL'))
);

CREATE INDEX ix_lml_tenant_step
  ON dbo.legacy_migration_log (tenant_id, step_no, started_at);
GO

PRINT N'  Migration log table created';
GO

PRINT N'== 0001_initial_schema.sql complete';
PRINT N'   Next: db/master/migrations/0002_temporal_and_rls.sql';
GO
