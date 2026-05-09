# Gecko Master DB — Schema Design (Phase 1)

> Synthesis of `.legacy/audit/` + Gecko architectural commitments
> (ARCHITECTURE.md). Defines the new `master_<tenant>` per-tenant DB schema
> for Phase 1.

**Version:** Draft v2 — All 10 architect review questions resolved
**Status:** Locked. Next step is SQL DDL generation (`db/master/migrations/0001_initial.sql`)
**Source audit:** `.legacy/audit/00-SUMMARY.md` through `05-LOOKUPS.md`
**Last updated:** 2026-05-09

---

## 1. Architect's answers to the 7 audit questions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Decompose `Customer` or keep polymorphic role-flag pattern? | **Decompose into `parties` base + role-extension tables** | Different role types have different attributes (lines have SCAC + alliance; hauliers have fleet info; customers have credit limits). 7 BIT flags hide this. Extension tables are clean, queryable, future-proof. |
| 2 | Separate `lines` entity from `customers`? | **Yes — `shipping_lines` table** | 1,899 ShippingAgents in legacy prove the use case. Lines have unique attributes (SCAC, alliance code, EDI partner code, COPARN handler, container prefix list) that don't fit Customer. |
| 3 | Decompose `Config.Lookup` God Table? | **Decompose into typed enum tables per category** | 488 rows × 40+ categories with magic-number IDs scattered as `smallint` across every other table. New design uses one table per category with named codes. Compile-time clarity, no magic numbers. |
| 4 | `Container` as live-state or registry-only? | **Split: Master holds registry, TOS holds live state** | Container registry (immutable identity: number, type, owner, lessor) → Master DB. Current location, status, last movement, seals → TOS DB `units` table (event-sourced from movements). |
| 5 | Need a `commodities` master? | **Yes — HS Code based** | Legacy `CargoType` is dead (0 rows). `IMOCode` only covers IMDG/hazardous. We need a proper commodity master with HS Code (international standard, customs-required for CUSCAR). |
| 6 | `CustomerName2` — Thai-name field? | **Two-column: `name_en` + `name_local`** | Per ARCHITECTURE.md §14.6 SEA conventions. Covers Thai/Vietnamese/Bahasa/Chinese. Avoids translation-table join overhead. |
| 7 | Polymorphic `Contact` — keep or refactor? | **Hybrid: embed primary contact + dedicated `contacts` for secondary** | Every party has ONE primary contact (embedded as `street`, `city`, `country_code`, `phone`, `email` columns directly on `parties`). Multiple/secondary contacts use `contacts` table with **explicit FK columns per type**, not polymorphic discriminator. Type-safe, indexable, queryable. |

---

## 2. Cross-cutting design rules

These apply to **every table** in `master_<tenant>` unless explicitly noted.

### 2.1 Audit columns (mandatory on every table)

```sql
tenant_id     UNIQUEIDENTIFIER       NOT NULL,    -- RLS policy column
created_at    DATETIMEOFFSET(3)      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
created_by    UNIQUEIDENTIFIER       NOT NULL,    -- user id
updated_at    DATETIMEOFFSET(3)      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
updated_by    UNIQUEIDENTIFIER       NOT NULL,
deleted_at    DATETIMEOFFSET(3)      NULL,        -- soft delete (master only)
row_version   ROWVERSION             NOT NULL,    -- optimistic concurrency
```

Plus **SQL Server temporal tables** for free history audit:

```sql
WITH (
  SYSTEM_VERSIONING = ON (HISTORY_TABLE = master_history.<table_name>)
)
```

The legacy `AuditID xml` column → discarded. Temporal tables replace it.

### 2.2 Naming conventions
- Tables: `snake_case`, plural — `parties`, `shipping_lines`, `container_types`
- Columns: `snake_case` — `customer_code`, `created_at`
- PK: `id UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()`
- Logical references: `<entity>_id` for same-DB, `<module>_<entity>_id` for cross-DB
- Indexes: `ix_<table>_<columns>` — `ix_parties_tenant_id_party_type`
- Check constraints: `ck_<table>_<rule>` — `ck_charge_codes_vat_range`

### 2.3 Tenant scoping (defense in depth)
- Every table has `tenant_id`
- EF Core global query filter auto-injects `WHERE tenant_id = @currentTenant`
- SQL Server **Row-Level Security policy** enforces same at DB layer
- See ARCHITECTURE.md §4 for full flow

### 2.4 No FK constraints (per ADR-007)
- Logical references via `*_id` columns
- Mandatory indexes on every reference column
- Naming convention makes the join graph self-documenting
- Nightly reconciliation jobs detect orphans

### 2.5 Data type rules
- **Money:** `DECIMAL(19,4)` + `currency CHAR(3)` always together
- **Time:** `DATETIMEOFFSET(3)` everywhere — never `DATETIME`
- **Codes:** `VARCHAR(N)` with explicit max — `CHAR(2)` for country codes, `CHAR(3)` for currencies, `VARCHAR(11)` for container numbers
- **Names:** `NVARCHAR(N)` — multi-script reality (Thai/Vietnamese/Chinese)
- **Lat/Long:** `DECIMAL(9,6)` — proper numeric, not varchar
- **Weights:** `DECIMAL(10,2)` — proper numeric, not varchar (legacy bug)
- **Bit flags:** `BIT` for two-state, `TINYINT` for low-cardinality enums (with `CHECK` constraint), `VARCHAR` referencing enum table for typed values

### 2.6 Soft delete pattern
- Master tables: `deleted_at` column (preserves referential integrity for historical bookings/movements pointing to a "deleted" customer)
- Lookup/enum tables: `is_active BIT` flag instead (no soft delete needed)
- Default queries via EF: filter `WHERE deleted_at IS NULL`

---

## 3. Entity inventory — Phase 1 Master DB

22 entities. Tier 1 = Phase 1 launch blockers, Tier 2 = designed but ETL deferred.

| # | Entity | Legacy source | Tier | Rows (est) |
|---|--------|--------------|------|-----------|
| 1 | `parties` | `Master.Customer` (decomposed) | 1 | ~28k |
| 2 | `party_aliases` | NEW — preserves legacy codes as searchable aliases | 1 | ~28k+ |
| 3 | `customer_extensions` | `Master.Customer` (role-specific cols) | 1 | ~28k |
| 4 | `shipping_line_extensions` | extracted from `Master.Customer` IsShippingAgent=1 | 1 | ~1.9k |
| 5 | `haulier_extensions` | extracted from IsHaulier=1 | 1 | ~6.2k |
| 6 | `forwarder_extensions` | extracted from IsFwdAgent=1 | 1 | ~6.5k |
| 7 | `contacts` | `Master.Contact` (refactored) | 1 | ~22k |
| 8 | `vessels` | `Master.Vessel` | 1 | ~6.2k |
| 9 | `ports` | `Master.Port` | 1 | ~4.2k |
| 10 | `locations` | `Master.Location` (kept inland-delivery scope) | 1 | ~2.8k |
| 11 | `container_types` | `Config.EquipmentTypeSize` | 1 | ~30 |
| 12 | `charge_codes` | `Master.ChargeCode` (canonical concept) | 1 | ~150 |
| 13 | `charge_code_variants` | `Master.ChargeCode` (bill_to × payment_term matrix) | 1 | ~300 |
| 14 | `order_types` | `Master.OrderType` | 1 | ~21 |
| 15 | `order_type_movements` | NEW — junction table | 1 | ~80 |
| 16 | `order_type_charges` | NEW — junction table | 1 | ~150 |
| 17 | `movements` | `Master.Movement` | 1 | ~4 (deduped from 8) |
| 18 | `holds` | extracted from `Master.ContainerStatus.IsHold` | 1 | ~5 |
| 19 | `container_conditions` | `Master.ContainerStatus` (non-hold rows) | 1 | ~10 |
| 20 | `companies` | `Master.Company` | 1 | ~1 (active) |
| 21 | `branches` | `Master.Branch` | 1 | ~6 |
| 22 | `yards` + `yard_blocks` | `Master.Yard` + `YardMap` | 1 | ~16 + ~3 |
| 23 | `commodities` | IMO codes (auto) + cargo-description worklist (manual map) | 1+2 | ~18 → ~120 |

Plus reference data (read-only, sourced from Platform DB, **not duplicated per tenant**):
- `countries` → Platform DB (ISO 3166-1 alpha-2)
- `currencies` → Platform DB (ISO 4217)
- `imo_classes` → Platform DB (IMDG hazardous classes)

Module-specific entities **excluded** from Master (legacy had them in `Master` schema, but they belong to operational modules):
- `drivers`, `trucks`, `chassis`, `routes` → Trucking module DB
- `agent_seals` → TOS module DB
- `quotations`, `quotation_items` → TOS module DB

---

## 4. Entity designs

### 4.1 `parties` (base table — replaces decomposed `Customer`)

**Purpose:** Single source of truth for all party identities — customer, shipper, consignee, line agent, haulier, forwarder, transporter. Each party has exactly **one** record here. Roles (and role-specific data) live in extension tables.

**Why decompose:** Legacy used 7 BIT flags on one row. That breaks down because (a) different roles have radically different attributes, (b) per-role audit and history matters (when did this customer become a haulier?), (c) per-role permissions (someone can manage customer records but not line records).

```sql
CREATE TABLE parties (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  -- Identity
  party_code        VARCHAR(25)      NOT NULL,    -- Legacy CustomerCode preserved
  name_en           NVARCHAR(255)    NOT NULL,    -- Primary name (any script if no Thai)
  name_local        NVARCHAR(255)    NULL,        -- Thai/Bahasa/Vietnamese/Chinese
  registration_no   NVARCHAR(100)    NULL,        -- Tax/business reg number
  tax_id            VARCHAR(30)      NULL,        -- VAT/GST/TIN

  -- Country & default currency
  country_code      CHAR(2)          NOT NULL,    -- → platform.countries.code
  default_currency  CHAR(3)          NULL,        -- → platform.currencies.code

  -- Primary contact (embedded — most parties have one main address)
  primary_address1  NVARCHAR(255)    NULL,
  primary_address2  NVARCHAR(255)    NULL,
  primary_city      NVARCHAR(100)    NULL,
  primary_state     NVARCHAR(100)    NULL,
  primary_postcode  VARCHAR(25)      NULL,
  primary_phone     VARCHAR(50)      NULL,
  primary_email     VARCHAR(255)     NULL,
  primary_website   VARCHAR(500)     NULL,

  -- Operational
  remarks           NVARCHAR(500)    NULL,
  -- (operator_code moved to shipping_line_extensions per Q2 — line-specific)

  -- Status (master-level)
  is_active         BIT              NOT NULL DEFAULT 1,

  -- Audit (mandatory)
  tenant_id, created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_parties_tenant_party_code ON parties(tenant_id, party_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_parties_tenant_country ON parties(tenant_id, country_code);
CREATE INDEX ix_parties_name_en ON parties(tenant_id, name_en);
CREATE INDEX ix_parties_tax_id ON parties(tenant_id, tax_id) WHERE tax_id IS NOT NULL;

-- Temporal table for history audit
ALTER TABLE parties ADD PERIOD FOR SYSTEM_TIME (sys_start, sys_end);
ALTER TABLE parties SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = master_history.parties));
```

**Migration mapping (Customer → parties):**

| Legacy column | New column | Transformation |
|--------------|-----------|----------------|
| `CustomerCode` | `party_code` | Direct — preserve original codes (audit notes 5 different prefix conventions; keep them) |
| `CustomerName` | `name_en` | Direct |
| `CustomerName2` | `name_local` | NULL if empty string. Legacy stored '' instead of NULL. |
| `RegistrationNo` | `registration_no` | NULL if empty |
| `CurrencyCode` | `default_currency` | NULL if empty (87% empty in legacy — fine) |
| `OperatorCode` | `shipping_line_extensions.operator_code` | Only for IsShippingAgent=1 rows; NULL if empty |
| `Status` | `is_active` | Direct (1 = active) |
| `Remark` | `remarks` | Direct |
| `IsBillingCustomer` | → `customer_extensions` | Triggers row creation |
| `IsShippingAgent` | → `shipping_line_extensions` | Triggers row creation |
| `IsHaulier` | → `haulier_extensions` | Triggers row creation |
| `IsFwdAgent` | → `forwarder_extensions` | Triggers row creation |
| `IsShipper`, `IsConsignee`, `IsTransporter` | `customer_extensions.roles` | Bitmask or array — these don't need separate extension tables (no role-specific attributes) |
| `DebtorCode`, `RevenueAccount` | → `customer_extensions` | Accounting-specific |
| `CreditTerm`, `NumberOfLongStandingDays` | → `customer_extensions` | Customer-specific |
| `AuditID xml` | DROPPED | Replaced by temporal table |
| `CreatedBy/CreatedOn/ModifiedBy/ModifiedOn` | `created_at/by`, `updated_at/by` | UserID string → UUID via Identity DB lookup |

**Resolved (Q1, Q2):**
- **Canonical code format:** `C-NNNNNN` for customers, `L-NNNNN` for lines, `H-NNNNN` for hauliers, `F-NNNNN` for forwarders. Generated by per-tenant sequence at row insert.
- **Legacy code preservation:** original `CustomerCode` migrates to `party_aliases` table with `alias_type = 'LEGACY'`. Search resolves either canonical or any alias. See §4.1a.
- **`operator_code` removed from this table** — moved to `shipping_line_extensions` (line-specific concept; CMA-line vs APL-operator pattern).

---

### 4.1a `party_aliases` (canonical + alias pattern)

**Purpose:** Preserve every legacy code, customer's own ERP code, SCAC, customs registration, tax ID, etc. as a searchable alias of the canonical party. Search-by-any-code resolves to the same party.

This is the NAVIS / CargoWise standard for handling legacy code preservation without polluting the canonical identifier. New records get a clean `C-NNNNNN`-style code; legacy migrations preserve the original code as a typed alias.

```sql
CREATE TABLE party_aliases (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  party_id        UNIQUEIDENTIFIER NOT NULL,                -- → parties.id

  alias_type      VARCHAR(30)      NOT NULL,                -- 'LEGACY' | 'CUSTOMER_ERP' |
                                                             -- 'BANK_REF' | 'SCAC' | 'SMDG' |
                                                             -- 'CUSTOMS_REG' | 'TAX_ID' |
                                                             -- 'EDI_PARTNER' | 'OTHER'
  alias_value     VARCHAR(50)      NOT NULL,
  alias_label     NVARCHAR(100)    NULL,                     -- Human description
                                                             -- ("Old SCT system code", "DHL ERP code")

  -- Time-bound aliases (a customer's ERP code changes when they migrate ERP)
  valid_from      DATE             NULL,
  valid_to        DATE             NULL,

  is_primary_for_type  BIT         NOT NULL DEFAULT 0,       -- Default alias of its type
  is_active            BIT         NOT NULL DEFAULT 1,

  created_at, created_by, updated_at, updated_by, row_version
);

-- Uniqueness: same alias_value can't be reused within (tenant, alias_type)
CREATE UNIQUE INDEX uq_party_aliases_value
  ON party_aliases(tenant_id, alias_type, alias_value)
  WHERE is_active = 1;

-- Find-by-any-code lookup (covers all alias types in one index)
CREATE INDEX ix_party_aliases_value
  ON party_aliases(tenant_id, alias_value)
  INCLUDE (party_id, alias_type);

-- "Show all aliases of this party"
CREATE INDEX ix_party_aliases_party
  ON party_aliases(tenant_id, party_id, alias_type);
```

**Search logic** (in `Master.Application` repository layer):

```sql
-- Find party by any code (canonical or alias):
SELECT party_id FROM (
  SELECT id AS party_id, party_code AS matched_code, 'CANONICAL' AS matched_type
  FROM parties
  WHERE tenant_id = @t AND party_code = @input AND deleted_at IS NULL

  UNION

  SELECT party_id, alias_value AS matched_code, alias_type AS matched_type
  FROM party_aliases
  WHERE tenant_id = @t AND alias_value = @input AND is_active = 1
) matches;
```

**Migration:** for every legacy `Customer`:
1. Generate new canonical `party_code` from per-tenant sequence (C-000001, C-000002, ...)
2. Insert into `parties` with the new canonical
3. Insert legacy `CustomerCode` into `party_aliases` with `alias_type = 'LEGACY'`, `is_primary_for_type = 1`
4. If legacy row had `RegistrationNo`, also insert as `alias_type = 'CUSTOMS_REG'`
5. If `IsShippingAgent = 1` and a recognisable SCAC pattern exists in code or name, prompt ops to confirm SCAC → insert as `alias_type = 'SCAC'`

**Display rules:**
- List views: show canonical code as primary identifier
- Detail views: show "Also known as: {legacy_code}, {erp_code}, {scac}"
- Search box: matches both canonical and aliases (single search bar, no filter needed)
- EDI: per-partner config decides which code goes out (customs wants tax_id, line EDI wants SCAC, etc.)

---

### 4.2 `customer_extensions`

```sql
CREATE TABLE customer_extensions (
  id                          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id                   UNIQUEIDENTIFIER NOT NULL,
  party_id                    UNIQUEIDENTIFIER NOT NULL,    -- → parties.id

  -- Customer-specific roles (subset of legacy 7 flags that don't need own extension)
  is_billing                  BIT NOT NULL DEFAULT 1,
  is_shipper                  BIT NOT NULL DEFAULT 0,
  is_consignee                BIT NOT NULL DEFAULT 0,
  is_transporter              BIT NOT NULL DEFAULT 0,

  -- Accounting
  debtor_code                 VARCHAR(20)        NULL,    -- ERP code
  revenue_account             VARCHAR(20)        NULL,    -- GL account
  credit_term_days            SMALLINT           NULL,    -- Payment terms
  credit_limit                DECIMAL(19,4)      NULL,
  credit_limit_currency       CHAR(3)            NULL,
  long_standing_threshold_days SMALLINT          NULL,    -- Detention trigger

  -- Defaults for booking
  default_tariff_id           UNIQUEIDENTIFIER   NULL,    -- → tariff_plans.id (TOS DB; cross-module)
  default_payment_term        VARCHAR(20)        NULL,    -- 'CASH' | 'CREDIT'

  -- Audit
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_customer_extensions_party ON customer_extensions(tenant_id, party_id);
CREATE INDEX ix_customer_extensions_debtor ON customer_extensions(tenant_id, debtor_code) WHERE debtor_code IS NOT NULL;
```

**Note:** A party with `is_billing = 0` AND `is_shipper = 0` AND `is_consignee = 0` AND `is_transporter = 0` should not have a `customer_extensions` row at all (they're a line / haulier / forwarder only).

---

### 4.3 `shipping_line_extensions`

Lines have specific attributes that customers don't.

```sql
CREATE TABLE shipping_line_extensions (
  id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id           UNIQUEIDENTIFIER NOT NULL,
  party_id            UNIQUEIDENTIFIER NOT NULL,

  -- Line-specific identifiers
  scac_code           VARCHAR(4)       NULL,    -- Standard Carrier Alpha Code (4 chars)
  smdg_code           VARCHAR(10)      NULL,    -- SMDG line code
  imo_company_no      VARCHAR(15)      NULL,    -- IMO line number
  iata_code           VARCHAR(3)       NULL,    -- For air-related operations

  -- Operator identity (Q2 — slot charter / alliance / vessel-sharing)
  -- Used when this line operates a service/vessel different from its parent line.
  -- Example: CMA owns vessel; APL operates the service. APL's operator_code = 'APL'.
  operator_code       VARCHAR(10)      NULL,

  -- Container fleet identification
  container_prefix_primary    VARCHAR(4) NULL,  -- e.g. "EGHU"
  container_prefix_secondary  VARCHAR(4) NULL,

  -- Alliance & partnerships
  alliance_code       VARCHAR(20)      NULL,    -- '2M', 'OCEAN', 'THE'
  alliance_name       NVARCHAR(100)    NULL,

  -- EDI integration
  edi_partner_code    VARCHAR(20)      NULL,    -- Used in COPARN/CODECO routing
  edi_handler_url     VARCHAR(500)     NULL,    -- SFTP / API endpoint
  edi_supports_coparn BIT NOT NULL DEFAULT 0,
  edi_supports_codeco BIT NOT NULL DEFAULT 0,
  edi_supports_coarri BIT NOT NULL DEFAULT 0,
  edi_supports_baplie BIT NOT NULL DEFAULT 0,

  -- Branding (line-specific, e.g. Maersk blue) — distinct from tenant white-label
  -- branding which lives in gecko_platform.tenant_branding (Q7).
  brand_color_hex     CHAR(7)          NULL,    -- '#1A73E8' for UI line badge

  -- Audit
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_shipping_line_extensions_party ON shipping_line_extensions(tenant_id, party_id);
CREATE UNIQUE INDEX uq_shipping_line_extensions_scac ON shipping_line_extensions(tenant_id, scac_code) WHERE scac_code IS NOT NULL;
CREATE INDEX ix_shipping_line_extensions_alliance ON shipping_line_extensions(tenant_id, alliance_code) WHERE alliance_code IS NOT NULL;
```

**Migration:**
- For each `Customer.IsShippingAgent = 1`, create row in `shipping_line_extensions`
- SCAC, alliance, EDI fields all NULL initially — populated by user (legacy didn't track these)
- The 1,899 ShippingAgents seed the table; line-specific data is enriched over time

---

### 4.4 `haulier_extensions` and `forwarder_extensions`

Similar pattern. Skipping full SQL — same structure, different attributes:

**Haulier-specific:** fleet count, primary chassis size, owns-trucks flag, preferred routes, rate-card-based pricing flag
**Forwarder-specific:** AEO certification, IATA code, preferred customs broker, default freight terms

I'll write these out in the SQL DDL file when we get there.

---

### 4.5 `contacts` (refactored polymorphic → typed)

**Why refactor:** Legacy `AddressLinkID + EntityType` discriminator works but loses type safety, can't enforce consistency, and doesn't index well.

**New design:** Each contact has explicit foreign-id columns for each possible parent entity. Only one is non-NULL. Indexable, queryable, type-safe.

```sql
CREATE TABLE contacts (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  -- Exactly one of these is non-null (CHECK constraint enforces)
  party_id          UNIQUEIDENTIFIER NULL,    -- → parties.id
  vessel_id         UNIQUEIDENTIFIER NULL,    -- → vessels.id
  port_id           UNIQUEIDENTIFIER NULL,    -- → ports.id
  branch_id         UNIQUEIDENTIFIER NULL,    -- → branches.id

  -- Contact details
  contact_type      VARCHAR(30)      NOT NULL,    -- 'BILLING' | 'SHIPPING' | 'OPERATIONS' | 'EMERGENCY'
  contact_person    NVARCHAR(100)    NULL,
  job_title         NVARCHAR(100)    NULL,
  address1          NVARCHAR(255)    NULL,
  address2          NVARCHAR(255)    NULL,
  city              NVARCHAR(100)    NULL,
  state             NVARCHAR(100)    NULL,
  postcode          VARCHAR(25)      NULL,
  country_code      CHAR(2)          NULL,
  phone             VARCHAR(50)      NULL,
  mobile            VARCHAR(50)      NULL,
  fax               VARCHAR(50)      NULL,
  email             VARCHAR(255)     NULL,
  website           VARCHAR(500)     NULL,

  -- LINE/WhatsApp/WeChat (SEA reality)
  social_handle_1   VARCHAR(255)     NULL,
  social_handle_2   VARCHAR(255)     NULL,

  is_default        BIT              NOT NULL DEFAULT 0,
  is_active         BIT              NOT NULL DEFAULT 1,

  -- Audit
  created_at, created_by, updated_at, updated_by, deleted_at, row_version,

  CONSTRAINT ck_contacts_one_parent CHECK (
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN vessel_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN port_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE INDEX ix_contacts_party ON contacts(tenant_id, party_id) WHERE party_id IS NOT NULL;
CREATE INDEX ix_contacts_vessel ON contacts(tenant_id, vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX ix_contacts_port ON contacts(tenant_id, port_id) WHERE port_id IS NOT NULL;
```

**Note:** `parties` already has primary contact embedded for the common case. `contacts` is for SECONDARY contacts (multiple billing addresses, ops contact + finance contact + emergency contact, etc.).

---

### 4.6 `vessels`

```sql
CREATE TABLE vessels (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  vessel_code     VARCHAR(20)      NOT NULL,    -- Operator-assigned short code (legacy 10-char)
  vessel_name     NVARCHAR(255)    NOT NULL,    -- UPGRADED to NVARCHAR (was VARCHAR — Unicode bug fix)
  vessel_name_local NVARCHAR(255)  NULL,        -- Local-script name (rare for vessels but possible)

  -- International identifiers
  imo_number      VARCHAR(7)       NULL,        -- IMO number (7 digits) — NEW, legacy didn't have
  call_sign       VARCHAR(10)      NULL,        -- Radio call sign
  mmsi            VARCHAR(9)       NULL,        -- Maritime Mobile Service Identity — NEW

  -- Operator & ownership
  operator_party_id UNIQUEIDENTIFIER NULL,      -- → parties.id (the line operating the vessel)
  flag_country_code CHAR(2)        NULL,

  -- Capacity (NEW, legacy didn't track)
  teu_capacity     INT             NULL,
  gross_tonnage    INT             NULL,

  -- EDI mapping (preserved from legacy)
  edi_mapping_code VARCHAR(20)     NULL,

  -- Status
  is_active        BIT             NOT NULL DEFAULT 1,

  -- Audit
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_vessels_tenant_code ON vessels(tenant_id, vessel_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_vessels_tenant_imo ON vessels(tenant_id, imo_number) WHERE imo_number IS NOT NULL;
CREATE INDEX ix_vessels_operator ON vessels(tenant_id, operator_party_id) WHERE operator_party_id IS NOT NULL;
```

**Migration:** Legacy has VesselCode + VesselName + CallSign + MappingCode only. IMO/MMSI/capacity columns NULL initially; data enriched over time via vessel registries (or manual input).

---

### 4.7 `ports`

Fixes data quality issues from legacy (mostly empty country, lat/long as varchar).

```sql
CREATE TABLE ports (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  -- Identification
  port_code         VARCHAR(20)      NOT NULL,    -- Internal code (legacy PortAreaCode)
  un_locode         VARCHAR(5)       NULL,        -- UN/LOCODE (e.g. THLCH, SGSIN)
  port_name_en      NVARCHAR(255)    NOT NULL,
  port_name_local   NVARCHAR(255)    NULL,

  -- Classification
  port_type         VARCHAR(20)      NOT NULL,    -- 'SEAPORT' | 'INLAND_DEPOT' | 'CFS' | 'AIRPORT' | 'RAIL'
  country_code      CHAR(2)          NOT NULL,    -- Made mandatory (was mostly empty in legacy)
  trade_mode        VARCHAR(20)      NOT NULL DEFAULT 'INTERNATIONAL',  -- 'DOMESTIC' | 'INTERNATIONAL'

  -- Geographic (NEW: proper numeric, was varchar in legacy)
  latitude          DECIMAL(9,6)     NULL,
  longitude         DECIMAL(9,6)     NULL,
  timezone          VARCHAR(50)      NULL,        -- 'Asia/Bangkok'

  -- Postal
  postcode          VARCHAR(25)      NULL,

  -- EDI integration (preserved)
  edi_mapping_code  VARCHAR(25)      NULL,

  -- Thai customs paperless code (preserved)
  paperless_code    VARCHAR(10)      NULL,

  is_active         BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_ports_tenant_code ON ports(tenant_id, port_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_ports_tenant_locode ON ports(tenant_id, un_locode) WHERE un_locode IS NOT NULL;
CREATE INDEX ix_ports_country_type ON ports(tenant_id, country_code, port_type);
```

**Migration:**
- Legacy lat/long varchar → DECIMAL(9,6); rows where parse fails get NULL + flagged for cleanup
- `AreaPortType smallint (3801=Port)` → typed `port_type VARCHAR(20)` via Lookup table decomposition
- `TradeMode smallint (3850=Domestic)` → typed `trade_mode VARCHAR(20)`
- Empty CountryCode rows: ETL flags for review; cannot migrate without country (made mandatory)

---

### 4.8 `container_types`

```sql
CREATE TABLE container_types (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  iso_code          VARCHAR(4)       NOT NULL,    -- Single ISO code (e.g. '22G1')
  type_size_code    VARCHAR(4)       NOT NULL,    -- '20GP', '40HC', etc. (legacy EquipmentTypeSize)

  -- Dimensions
  size_ft           TINYINT          NOT NULL,    -- 20, 40, 45
  type_code         VARCHAR(2)       NOT NULL,    -- 'GP', 'HC', 'RF', 'OT', 'FR', 'TK'
  height_class      VARCHAR(20)      NOT NULL,    -- 'STANDARD' | 'HIGH_CUBE'

  description_en    NVARCHAR(255)    NOT NULL,
  description_local NVARCHAR(255)    NULL,

  -- Capacity
  teu              DECIMAL(3,1)      NOT NULL,    -- 1.0 or 2.0 (or 2.25 for 45')
  is_reefer        BIT               NOT NULL DEFAULT 0,
  is_oog           BIT               NOT NULL DEFAULT 0,    -- Out-Of-Gauge (open-top, flat-rack)

  -- Weights (NEW: proper numeric, was varchar in legacy bug)
  tare_weight_kg   DECIMAL(8,2)      NULL,
  max_payload_kg   DECIMAL(8,2)      NULL,
  max_gross_kg     DECIMAL(8,2)      NULL,

  -- Visual (for UI graphic)
  display_color_hex CHAR(7)          NULL,

  is_active        BIT               NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version,

  CONSTRAINT ck_container_types_size CHECK (size_ft IN (20, 40, 45)),
  CONSTRAINT ck_container_types_height CHECK (height_class IN ('STANDARD', 'HIGH_CUBE'))
);

CREATE UNIQUE INDEX uq_container_types_tenant_iso ON container_types(tenant_id, iso_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_container_types_tenant_typesize ON container_types(tenant_id, type_size_code) WHERE deleted_at IS NULL;
```

**Migration:**
- Legacy `Config.EquipmentTypeSize` had ISO codes semicolon-delimited in single varchar(250) — `"22G0;22G1;2200"`. **Decomposition needed.** ETL splits into multiple rows (one per ISO code) with the same type_size_code. Each row has a unique ISO code as primary identifier.
- Weights: legacy stored mostly zeros — ETL leaves NULL, tenant populates from BIC database or manually.
- Excludes legacy rows where `IsTruck = 1` (those go to Trucking module, not Master).

---

### 4.9 `charge_codes` + `charge_code_variants` (two-level structure)

**Issue clarified by architect:** Legacy `-CA/-CR` suffixes encode TWO dimensions, not just payment term:
1. **Bill-to party** — `-CA` = bill customer (cash); `-CR` = bill agent (credit)
2. **Payment term** — cash vs credit

Same charge concept, different (bill-to × payment-term) scenarios. The variants may have different rates, GL accounts, and VAT treatment.

**Solution:** Two-level structure. `charge_codes` is the canonical concept (one row per "what is this charge?"). `charge_code_variants` is the matrix (one row per scenario combination, holding the actual billing rules).

```sql
-- Canonical charge concept (one row per charge "what")
CREATE TABLE charge_codes (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  charge_code       VARCHAR(15)      NOT NULL,    -- Canonical: "SA001" (no suffix)
  description_en    NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)    NULL,

  -- Classification (shared across all variants)
  module            VARCHAR(20)      NOT NULL,    -- 'TOS' | 'CFS' | 'TRUCKING' | 'EMR'
  charge_type       VARCHAR(30)      NOT NULL,    -- 'STORAGE' | 'LIFT' | 'GATE' | 'DOC' | 'VAS'
  charge_category   VARCHAR(30)      NOT NULL,    -- 'GENERAL' | 'REEFER' | 'DG' | 'OOG'
  billing_unit      VARCHAR(30)      NOT NULL,    -- 'PER_CONTAINER' | 'PER_TEU' | 'PER_DAY' | 'PER_TON' | 'PER_BL'
  is_by_service     BIT              NOT NULL DEFAULT 0,

  is_active         BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_charge_codes_tenant_code
  ON charge_codes(tenant_id, charge_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_charge_codes_module_type ON charge_codes(tenant_id, module, charge_type);

-- Bill-to × payment-term variants (one row per actual billing rule)
CREATE TABLE charge_code_variants (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  charge_code_id    UNIQUEIDENTIFIER NOT NULL,    -- → charge_codes.id

  -- The matrix
  bill_to           VARCHAR(20)      NOT NULL,    -- 'CUSTOMER' | 'AGENT' | 'LINE' |
                                                   -- 'SHIPPER' | 'CONSIGNEE' | 'FORWARDER'
  payment_term      VARCHAR(20)      NOT NULL,    -- 'CASH' | 'CREDIT' | 'PREPAID' | 'COD'

  -- Per-variant billing rules (these may differ between -CA and -CR in legacy)
  default_rate      DECIMAL(19,4)    NULL,
  currency          CHAR(3)          NOT NULL,
  vat_rate          DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  credit_term_days  SMALLINT         NULL,        -- Relevant for credit terms
  revenue_gl        VARCHAR(20)      NULL,        -- May differ (cash GL vs credit GL)
  cost_gl           VARCHAR(20)      NULL,

  -- Migration audit trail
  legacy_charge_code VARCHAR(15)     NULL,        -- e.g. "SA001-CA" — original

  is_active         BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_charge_code_variants_matrix
  ON charge_code_variants(tenant_id, charge_code_id, bill_to, payment_term)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_charge_code_variants_legacy
  ON charge_code_variants(tenant_id, legacy_charge_code)
  WHERE legacy_charge_code IS NOT NULL;
```

**Migration:**

For each legacy `XXX-CA` row:
1. Find or create canonical `XXX` in `charge_codes` (using description, module, charge_type, billing_unit from the legacy row)
2. Create variant `(charge_code_id=XXX, bill_to='CUSTOMER', payment_term='CASH')` with the legacy row's rate / GL / VAT
3. Set `legacy_charge_code = 'XXX-CA'` for traceability

For each legacy `XXX-CR` row:
1. Lookup canonical `XXX`
2. Create variant `(charge_code_id=XXX, bill_to='AGENT', payment_term='CREDIT')` with that row's properties
3. Set `legacy_charge_code = 'XXX-CR'`

Result: ~150 canonical charges + ~300 variants. Same data, structurally clean.

**Application logic** (in TOS module's billing):

```csharp
// When applying a charge to a booking, look up the right variant:
var variant = await _db.ChargeCodeVariants
    .FirstOrDefaultAsync(v =>
        v.TenantId == _tenant.Id &&
        v.ChargeCodeId == chargeCodeId &&
        v.BillTo == billing.BillToType &&        // 'CUSTOMER' or 'AGENT'
        v.PaymentTerm == billing.PaymentTerm);   // 'CASH' or 'CREDIT'

// variant.DefaultRate, variant.VatRate, variant.RevenueGl drive the booking charge line
```

**Bonus:** new combinations are first-class. Want a third variant (`bill_to=LINE, payment_term=PREPAID`)? Insert one row. Legacy required adding a new charge code suffix that didn't fit the scheme.

---

### 4.10 `order_types`

```sql
CREATE TABLE order_types (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,

  order_code      VARCHAR(50)      NOT NULL,    -- 'EXP CY/CY', 'IMP CFS', etc.
  description_en  NVARCHAR(255)    NOT NULL,
  description_local NVARCHAR(255)  NULL,

  -- Classification
  direction       VARCHAR(10)      NOT NULL,    -- 'IMPORT' | 'EXPORT' | 'TRANSHIP' | 'DOMESTIC'
  shipment_type   VARCHAR(20)      NOT NULL,    -- 'CY' | 'CFS' | 'CY-IN' | 'CY-OUT'
  cargo_type      VARCHAR(20)      NULL,        -- 'GENERAL' | 'REEFER' | 'DG' | 'OOG'

  is_active        BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version,

  CONSTRAINT ck_order_types_direction CHECK (direction IN ('IMPORT', 'EXPORT', 'TRANSHIP', 'DOMESTIC'))
);

CREATE UNIQUE INDEX uq_order_types_tenant_code ON order_types(tenant_id, order_code) WHERE deleted_at IS NULL;
```

**Workflow relationships** are in junction tables — see §4.10a and §4.10b below.

**Migration:**
- Legacy `BookingType smallint (101=Import, 102=Export)` → typed `direction`
- Legacy `ShipmentType smallint (201=CY, 202=CFS, 203=CY-IN)` → typed `shipment_type`
- Legacy `Master.OrderTypeMovement` → new `order_type_movements` (preserved as junction)
- Legacy `Master.OrderTypeCharges` → new `order_type_charges` (preserved as junction)

---

### 4.10a `order_type_movements` (junction)

Defines which movements are valid for each order type. Every booking, container, and movement record references this. Junction over JSON because of query patterns:
- "Show me all bookings whose order_type allows FULL_IN" → indexed JOIN
- "What movements are valid for EXP CY/CY?" → indexed JOIN
- "Validate booking — does this order_type allow this movement?" → indexed lookup

```sql
CREATE TABLE order_type_movements (
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  order_type_id     UNIQUEIDENTIFIER NOT NULL,    -- → order_types.id
  movement_id       UNIQUEIDENTIFIER NOT NULL,    -- → movements.id

  sequence_no       SMALLINT         NULL,        -- Workflow order (1, 2, 3...)
  is_required       BIT              NOT NULL DEFAULT 1,    -- Mandatory step in workflow
  is_billable       BIT              NOT NULL DEFAULT 1,    -- Triggers charge generation

  created_at, created_by, updated_at, updated_by, row_version,

  PRIMARY KEY (tenant_id, order_type_id, movement_id)
);

CREATE INDEX ix_order_type_movements_movement
  ON order_type_movements(tenant_id, movement_id, order_type_id);
-- Reverse-direction lookup: given a movement, which order types allow it?
```

**Migration:** direct from `Master.OrderTypeMovement` legacy table.

---

### 4.10b `order_type_charges` (junction)

Defines which charges are auto-applied for each order type, optionally scoped to a specific movement (e.g., "lift-in charge applies only on FULL_IN movement").

```sql
CREATE TABLE order_type_charges (
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  order_type_id     UNIQUEIDENTIFIER NOT NULL,    -- → order_types.id
  charge_code_id    UNIQUEIDENTIFIER NOT NULL,    -- → charge_codes.id (canonical)
  movement_id       UNIQUEIDENTIFIER NULL,        -- → movements.id (optional scope)

  is_default        BIT              NOT NULL DEFAULT 1,    -- Auto-apply on booking
  is_optional       BIT              NOT NULL DEFAULT 0,    -- User can opt-in/out
  default_qty       DECIMAL(10,2)    NULL,                  -- Override billing-unit default

  created_at, created_by, updated_at, updated_by, row_version,

  -- Composite PK with NULL-safe movement_id (using a sentinel UUID for the NULL case)
  PRIMARY KEY (tenant_id, order_type_id, charge_code_id,
               COALESCE(movement_id, '00000000-0000-0000-0000-000000000000'))
);

CREATE INDEX ix_order_type_charges_charge
  ON order_type_charges(tenant_id, charge_code_id, order_type_id);
```

**Migration:** direct from `Master.OrderTypeCharges` and `Master.OrderTypeChargesVAS` legacy tables.

---

### 4.11 `movements` (gate movement codes)

```sql
CREATE TABLE movements (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,

  movement_code   VARCHAR(20)      NOT NULL,    -- 'FULL_IN', 'FULL_OUT', 'MTY_IN', 'MTY_OUT' (no spaces, no parens)
  description_en  NVARCHAR(100)    NOT NULL,
  description_local NVARCHAR(100)  NULL,

  -- Classification
  ef_indicator    VARCHAR(10)      NOT NULL,    -- 'FULL' | 'EMPTY'
  direction       VARCHAR(10)      NOT NULL,    -- 'IN' | 'OUT' | 'TRANSFER'
  applies_to_module VARCHAR(20)    NOT NULL,    -- 'TOS' | 'TRUCKING' | 'BOTH'

  -- Effects
  changes_yard_position BIT NOT NULL DEFAULT 0,    -- Movement updates current_location
  changes_status        BIT NOT NULL DEFAULT 0,    -- Movement transitions container status

  is_active        BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version,

  CONSTRAINT ck_movements_ef CHECK (ef_indicator IN ('FULL', 'EMPTY')),
  CONSTRAINT ck_movements_dir CHECK (direction IN ('IN', 'OUT', 'TRANSFER'))
);

CREATE UNIQUE INDEX uq_movements_tenant_code ON movements(tenant_id, movement_code) WHERE deleted_at IS NULL;
```

**Migration:**
- Legacy 8 rows (4 ICD + 4 TRK duplicates) → 4 unique movements with `applies_to_module = 'BOTH'` for the duplicates that exist in both contexts
- Codes like `'FULL IN (TRK)'` → cleaned to `'FULL_IN'` with module flag

---

### 4.12 `holds` (extracted from ContainerStatus.IsHold pattern)

**Why extract:** Legacy mixes "container condition" (DMG, AV, SOUND) with "hold reasons" (DMG-as-hold, OFF-HIRE, SALE.) in a single `ContainerStatus` table. New design separates them.

```sql
CREATE TABLE holds (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,

  hold_code       VARCHAR(20)      NOT NULL,    -- 'CUSTOMS', 'DAMAGE', 'OFFHIRE', 'SALE', 'SURVEY'
  description_en  NVARCHAR(200)    NOT NULL,
  description_local NVARCHAR(200)  NULL,

  -- Classification
  hold_type       VARCHAR(30)      NOT NULL,    -- 'CUSTOMS' | 'AGENT' | 'FINANCE' | 'OPERATIONS'
  blocking_scope  VARCHAR(30)      NOT NULL,    -- 'GATE_OUT' | 'LOAD' | 'BOTH'
  release_authority VARCHAR(50)    NOT NULL,    -- 'CUSTOMS' | 'LINE' | 'FINANCE_TEAM' | 'OPS_MANAGER'

  -- UI
  priority        TINYINT          NOT NULL DEFAULT 5,    -- 1 = highest, 9 = lowest
  display_color_hex CHAR(7)        NULL,

  -- Behaviour
  auto_apply_on_event VARCHAR(50)  NULL,    -- e.g. 'movement.damage_recorded' triggers auto-DAMAGE hold
  notify_on_apply  BIT             NOT NULL DEFAULT 1,

  is_active        BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_holds_tenant_code ON holds(tenant_id, hold_code) WHERE deleted_at IS NULL;
```

**Container condition** (separate from holds) goes to its own `container_conditions` table:

```sql
CREATE TABLE container_conditions (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,

  condition_code  VARCHAR(10)      NOT NULL,    -- 'AV', 'DMG', 'SOUND', 'SW', 'WW'
  description_en  NVARCHAR(100)    NOT NULL,
  description_local NVARCHAR(100)  NULL,

  -- Severity for ops sorting
  severity        TINYINT          NOT NULL DEFAULT 5,
  is_serviceable  BIT              NOT NULL DEFAULT 1,    -- Can be loaded onto vessel?
  requires_repair BIT              NOT NULL DEFAULT 0,

  is_active        BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);
```

**Migration:**
- Legacy `Master.ContainerStatus` rows with `IsHold = 1` (DMG, OHF, SALE.) → migrated to `holds`
- Rows with `IsHold = 0` → migrated to `container_conditions`
- Typo `MONOR DAMAGE` → `MINOR DAMAGE` (data cleanup)
- Inactive legacy statuses (AWT, EVE, SALE) → migrated with `is_active = 0`

---

### 4.13 `commodities` (NEW — HS Code based)

Legacy doesn't have one (CargoType dead). Required for CUSCAR / customs.

```sql
CREATE TABLE commodities (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,

  hs_code         VARCHAR(10)      NOT NULL,    -- HS6 (6-digit international), HS8/HS10 (national extension)
  description_en  NVARCHAR(255)    NOT NULL,
  description_local NVARCHAR(255)  NULL,

  -- HS hierarchy
  hs_chapter      CHAR(2)          NOT NULL,    -- First 2 digits
  hs_heading      CHAR(4)          NOT NULL,    -- First 4 digits

  -- Classifications
  is_dangerous    BIT              NOT NULL DEFAULT 0,
  imdg_class      VARCHAR(10)      NULL,        -- '3', '4.1', '8' if dangerous
  un_number       VARCHAR(10)      NULL,        -- UN1230, UN3082, etc.

  is_temperature_controlled BIT    NOT NULL DEFAULT 0,
  default_min_temp_c DECIMAL(5,2)  NULL,
  default_max_temp_c DECIMAL(5,2)  NULL,

  -- Customs
  requires_certificate_of_origin BIT NOT NULL DEFAULT 0,
  requires_phyto_certificate     BIT NOT NULL DEFAULT 0,    -- Plant products
  requires_health_certificate    BIT NOT NULL DEFAULT 0,    -- Animal products

  is_active        BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE UNIQUE INDEX uq_commodities_tenant_hs ON commodities(tenant_id, hs_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_commodities_chapter ON commodities(tenant_id, hs_chapter);
CREATE INDEX ix_commodities_dangerous ON commodities(tenant_id, is_dangerous) WHERE is_dangerous = 1;
```

**Migration:** No legacy data to migrate. Seed with **WCO HS 2022 standard codes** (~5K rows for HS6 level). Tenants extend as needed for HS8/HS10. Can be sourced from WCO public data or commercial HS databases.

---

### 4.14 `companies`, `branches`, `yards`, `yard_blocks`

The legacy hierarchy preserved. **Tenant-level branding (logo, white-label
colors, domain, fonts) lives in `gecko_platform.tenant_branding` per Q7 —
not on these operational tables.** A company in Master DB holds operational
identity only.

```sql
CREATE TABLE companies (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  company_code    VARCHAR(10)      NOT NULL,
  company_name_en NVARCHAR(255)    NOT NULL,
  company_name_local NVARCHAR(255) NULL,
  registration_no NVARCHAR(100)    NULL,
  tax_id          VARCHAR(30)      NULL,    -- For invoicing
  default_currency CHAR(3)         NULL,    -- Currency for invoices issued by this company
  is_active       BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE TABLE branches (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  company_id      UNIQUEIDENTIFIER NOT NULL,
  branch_code     VARCHAR(10)      NOT NULL,
  branch_name_en  NVARCHAR(255)    NOT NULL,
  branch_name_local NVARCHAR(255)  NULL,
  -- Branch-level address embedded
  address1, address2, city, state, postcode, country_code, phone, email,
  -- Geographic
  latitude DECIMAL(9,6) NULL, longitude DECIMAL(9,6) NULL, timezone VARCHAR(50) NULL,
  is_active       BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE TABLE yards (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  branch_id       UNIQUEIDENTIFIER NOT NULL,
  yard_code       VARCHAR(20)      NOT NULL,
  yard_name_en    NVARCHAR(255)    NOT NULL,
  yard_name_local NVARCHAR(255)    NULL,
  yard_type       VARCHAR(20)      NOT NULL,    -- 'IMPORT' | 'EXPORT' | 'EMPTY' | 'CFS'
  capacity_teu    INT              NULL,
  is_active       BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);

CREATE TABLE yard_blocks (
  id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id       UNIQUEIDENTIFIER NOT NULL,
  yard_id         UNIQUEIDENTIFIER NOT NULL,
  block_code      VARCHAR(20)      NOT NULL,
  -- Layout
  max_rows        TINYINT          NULL,
  max_columns     TINYINT          NULL,
  max_tiers       TINYINT          NULL,
  -- Allocation
  allocated_to_party_id UNIQUEIDENTIFIER NULL,    -- → parties.id (a line / customer block reservation)
  allocated_size_ft TINYINT NULL,                  -- 20 / 40 / 45 only block
  is_reefer_block BIT              NOT NULL DEFAULT 0,
  is_oog_block    BIT              NOT NULL DEFAULT 0,
  is_active       BIT              NOT NULL DEFAULT 1,
  created_at, created_by, updated_at, updated_by, deleted_at, row_version
);
```

**Migration:** Direct mapping from legacy 4-level hierarchy. SCT (1 active company) → 6 branches → 16 yards → 3 blocks (legacy `YardMap`).

---

## 5. Tier 2 entities (designed but not detailed here)

These will appear in `MASTER-SCHEMA-v2.md` after Tier 1 ships:

- `locations` — for inland delivery / pickup points (Trucking module dependency)
- `agent_seal_ranges` — pre-allocated seal numbers per agent

The remaining legacy tables (`drivers`, `trucks`, `chassis`, `routes`, `quotations`, etc.) move to **Trucking module** DB, not Master.

---

## 6. Lookup decomposition (replaces `Config.Lookup` God Table)

The 488-row `Config.Lookup` with 40+ categories becomes **typed enum tables** per category. Each becomes a small dedicated table OR a check constraint on the consumer column, depending on cardinality.

### Strategy

| Legacy category | Cardinality | New approach |
|----------------|-------------|--------------|
| BookingType (5) | Tiny | Inlined as `CHECK constraint` on `order_types.direction` |
| ChargeType (4) | Tiny | Inlined on `charge_codes.charge_type` |
| BillingUnit (10+) | Small | Own table `billing_units` (small, but referenced widely) |
| ContainerGrade (17) | Small | Own table `container_grades` |
| DamageIndicator (96) | Medium | Own table `damage_codes` (M&R module) |
| ContainerHireMode (3) | Tiny | Inlined |
| ContainerHeight (2) | Tiny | Inlined as `container_types.height_class` enum |
| FuelTankID (15) | Small | → Trucking module DB |
| ChasisSize/Type/Status | Small | → Trucking module DB |
| MovementIndicator (2) | Tiny | Inlined |
| ... | | |

**Rule:** If cardinality < 5 AND used in only 1 table → CHECK constraint. Otherwise own table.

### Lookup tables that survive in Master

| New table | Purpose | Row count |
|-----------|---------|-----------|
| `billing_units` | per-container, per-TEU, per-day, per-ton, per-BL | ~10 |
| `container_grades` | ContainerGrade categories | ~17 |
| `payment_terms` | CASH / CREDIT / PREPAID / etc. | ~5 |
| `discount_types` | None / amount / percent / VIP | ~4 |
| `currencies` (cached from Platform) | THB / SGD / MYR / IDR / VND / PHP / USD | ~25 |

---

## 7. Migration ETL plan (Phase 1)

Order of execution (respecting logical dependencies):

```
 1. companies              ← Master.Company (8 rows; tax_id + default_currency populated by ops)
 2. branches               ← Master.Branch (8 rows)
 3. yards                  ← Master.Yard (16 rows)
 4. yard_blocks            ← Master.YardMap (3 rows)
 5. parties                ← Master.Customer (28,070 rows) — assign new C-NNNNNN canonical
 6. party_aliases          ← legacy CustomerCode → alias (1 row per customer, type='LEGACY')
                            + RegistrationNo → alias (type='CUSTOMS_REG' if non-empty)
 7. customer_extensions    ← from parties + IsBillingCustomer/IsShipper/IsConsignee/IsTransporter (~28k)
 8. shipping_line_extensions ← from parties + IsShippingAgent (~1.9k)
                              + carry over OperatorCode from legacy Customer.OperatorCode
 9. haulier_extensions     ← from parties + IsHaulier (~6.2k)
10. forwarder_extensions   ← from parties + IsFwdAgent (~6.5k)
11. contacts               ← Master.Contact (22,814 rows) refactored to typed FKs
12. vessels                ← Master.Vessel (6,164 rows; IMO NULL initially per Q6)
13. ports                  ← Master.Port (4,150 rows) — needs CountryCode cleanup;
                            lat/long varchar → DECIMAL(9,6) with parse-failure flagging
14. container_types        ← Config.EquipmentTypeSize (31 → ~50 after ISO semicolon split)
15. charge_codes           ← Master.ChargeCode CANONICAL (~150 distinct concepts)
16. charge_code_variants   ← Master.ChargeCode VARIANTS (~300 rows: -CA → CUSTOMER+CASH,
                                                        -CR → AGENT+CREDIT)
17. order_types            ← Master.OrderType (21 rows)
18. order_type_movements   ← Master.OrderTypeMovement (junction preserved)
19. order_type_charges     ← Master.OrderTypeCharges + OrderTypeChargesVAS (junction preserved)
20. movements              ← Master.Movement (8 → 4 deduped, applies_to_module='BOTH' for shared)
21. holds                  ← Master.ContainerStatus rows where IsHold=1 (DMG, OHF, SALE.)
22. container_conditions   ← Master.ContainerStatus rows where IsHold=0 (AV, SOUND, SW, etc.)
23. commodities — Pass A   ← Auto-migrate Master.IMOCode (18 hazardous goods rows)
24. commodities — Pass B   ← Tool: scan booking cargo descriptions, dedupe top 100 unique,
                              present as worklist for ops to manually map to HS codes over 1-2 weeks
                              (no commercial dataset purchased per Q5)
```

**ETL safety:**
- Each step is idempotent (re-runnable without duplicates) using `legacy_charge_code` /
  `party_aliases.alias_value` / similar legacy-reference columns
- Each step writes a row to `legacy_migration_log` with counts in/out, rejection reasons,
  duration, and timestamp
- Steps 5-10 form one logical transaction conceptually (parties + extensions); ETL
  uses a staging table to assemble all extension rows before flushing

### Validation per entity (post-migration reconciliation)

For each entity, run:
1. Row count check: legacy count vs new count match (within tolerance for merges)
2. Active-flag preservation: legacy `Status = 1` count = new `is_active = 1` count
3. Sample row spot-check: pick 5 random legacy rows, verify migrated values
4. Logical FK integrity: every `_id` reference resolves to an existing row

Each validation result logged to `legacy_migration_log` table per tenant.

---

## 8. Resolved decisions (architect review locked 2026-05-09)

| # | Question | Resolution | Design impact |
|---|----------|-----------|---------------|
| 1 | Customer code prefix conventions — migrate as-is or normalise? | **Canonical + aliases pattern** (NAVIS / CargoWise / Envision standard). Every party gets a normalised canonical code (`C-NNNNNN`, `L-NNNNN`, `H-NNNNN`, `F-NNNNN` per role); legacy code preserved as a row in new `party_aliases` table with `alias_type = 'LEGACY'`. Search resolves by either. | Adds `party_aliases` table (§4.4) |
| 2 | `OperatorCode` — keep or drop? | **Keep, with operator semantics.** Used when a line operates a vessel/service different from its parent line (slot charter, alliance vessel sharing — e.g., CMA owns vessel, APL operates it). Moves from `parties` to `shipping_line_extensions` since it's line-specific. | `shipping_line_extensions.operator_code` (was on legacy `Customer.OperatorCode`) |
| 3 | `order_types.applicable_movements` JSON or junction tables? | **Junction tables** — `order_type_movements`, `order_type_charges`. JSON would force scans on every booking-movement query; junction tables index cleanly. Reversed my JSON recommendation based on architect's note that all booking-container-movement records reference order-type movements. | Adds 2 junction tables (§4.10–4.11) |
| 4 | Charge code merge `-CA/-CR` (300 → ~150)? | **Two-level structure.** `charge_codes` is the canonical concept (~150). `charge_code_variants` is the (bill_to × payment_term) matrix (~300) holding the actual rate / GL / VAT per scenario. Legacy `-CA` rows become variants with (bill_to=CUSTOMER, payment_term=CASH); `-CR` rows become (bill_to=AGENT, payment_term=CREDIT). | Replaces single `charge_codes` design with `charge_codes` + `charge_code_variants` (§4.9) |
| 5 | `commodities` seed source? | **B + C combined.** (B) Auto-migrate the 18 IMO hazardous codes immediately. (C) One-time tool scans legacy booking cargo-description fields, dedupes top 100 unique descriptions, presents as worklist for ops to map to HS codes over a week or two. No commercial HS dataset purchased. | ETL adds two-pass commodity seed (§7) |
| 6 | `vessels.imo_number` mandatory? | **NULL initially.** Vessel registry sync from IHS Sea-web (or similar) deferred to Phase 2. | Already locked in §4.6 |
| 7 | Tenant branding location? | **Platform DB tenant config.** `gecko_platform.tenant_branding` (logo, colors, fonts, white-label assets) — not on Master `companies` table. Companies in Master DB hold operational identity only. | Removed brand fields from §4.14 `companies` |
| 8 | Multi-language `_en` + `_local` columns from day 1? | **Yes.** Schema changes in Phase 4 across all tenant DBs are expensive. | Already applied throughout |
| 9 | Drop `AuditID xml`, replace with temporal tables? | **Yes.** | Already applied |
| 10 | Soft-delete via `deleted_at` (master) vs `is_active` (lookups)? | **Yes.** | Already applied |
---

## 9. Decision points to lock before SQL DDL

Once you answer the 10 questions above, I generate:
1. `db/master/migrations/0001_initial.sql` — DDL with all 18 entities
2. `db/master/migrations/0002_seed_lookups.sql` — seed data for typed enums
3. `db/master/etl/01-customers-to-parties.sql` — migration script template
4. (More ETL scripts per entity)

Plus the EF Core entities + DbContext for `Gecko.Master.Infrastructure`.

Ready when you are.
