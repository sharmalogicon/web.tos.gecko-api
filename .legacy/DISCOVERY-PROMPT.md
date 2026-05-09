# Legacy DB Discovery — Phase 1 Playbook

> **Paste this entire document into a new Claude Code session that has the
> `mcp__mssql__*` tools working.** It is a complete self-contained prompt;
> no other context required.

---

## Context for the AI assistant

You are doing a focused discovery sweep against a legacy SQL Server database
named **`Vector`** that powers a WinForms-based logistics / TOS application
in production. The output of this sweep will inform the design of a new
SaaS-native multi-tenant database for a platform called **Gecko**.

The Gecko platform is built around 5 modules (TOS, EDI, Trucking, Fleet,
Equipment M&R) with **Master Data** as a separate top-level bounded
context. Phase 1 of the rewrite focuses on:
- **Identity** — users, roles, permissions
- **Master Data** — customers, lines, vessels, ports, container types,
  charge codes, commodities, locations, holds, order types, lookups

Your job is to produce **5 markdown audit files** documenting the legacy
schema for these two domains so the architect (in another session) can
design the new schemas with full knowledge of what exists today.

**Do NOT:**
- Modify any data (read-only sweep)
- Drop into the operational / transactional tables (booking, movement,
  EDI, etc.) — those are Phase 2+
- Try to interpret business intent — just document what's there

**DO:**
- Be thorough on master-data and identity-related tables
- Capture exact column types, sizes, nullability, defaults
- Note suspicious patterns (overloaded columns, magic values, dead FKs)
- Sample 10 rows from each master-data table you identify

---

## Connection

Use this connection string for **every** MCP tool call:

```
Server=DESKTOP-6AQI384\APPIFY;User ID=sa;Password=manager;Encrypt=False;TrustServerCertificate=True;Database=Vector
```

Test it first with `mcp__mssql__test_connection`. If it works, proceed.

---

## Output location

Write all output files to:

```
d:\SHARMA\PROJECT\gecko\web.tos.gecko-api\.legacy\audit\
```

(Create the directory if it doesn't exist.)

---

## Step 1 — Full table inventory

Run `mcp__mssql__list_tables` to get every table in the `dbo` schema (and
any other user schemas — check with a query if there are non-`dbo` schemas).

Then for ALL tables, get row counts and sizes:

```sql
SELECT
  s.name + '.' + t.name AS table_name,
  p.rows                AS row_count,
  CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(10,1)) AS size_mb
FROM sys.tables t
JOIN sys.schemas s   ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id
JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE p.index_id IN (0, 1)
GROUP BY s.name, t.name, p.rows
ORDER BY p.rows DESC;
```

(Run via `mcp__mssql__execute_query`.)

Also list views:

```sql
SELECT s.name + '.' + v.name AS view_name
FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
ORDER BY view_name;
```

### Output file: `.legacy/audit/01-INVENTORY.md`

Structure:
```markdown
# Legacy DB Inventory — Vector

**Connected:** {timestamp}
**Server:** SQL Server version
**Total tables:** N
**Total views:** N
**Total size on disk:** N GB

## Schemas
- dbo (N tables)
- ... (any others)

## Tables — sorted by row count (top 50)
| Table | Rows | Size (MB) | Likely classification |
|-------|------|-----------|----------------------|
| dbo.tblOrd_Hdr | 8,234,891 | 4,200 | Transactional |
| dbo.tblCust | 142,889 | 18 | Master |
| dbo.tblLkp_HoldCode | 14 | 0.1 | Lookup |
| ... |

## Tables — full list (collapsed by table-name prefix)
Group tables by their first 3-4 characters when there's a clear naming
convention (e.g. all `tblOrd_*` tables grouped, all `tblLkp_*` grouped).
This reveals the legacy app's module structure.

## Views — full list

## Observations
- Any tables with name patterns suggesting deprecated features
- Any tables with row count of 0 (possibly dead)
- Any tables with size disproportionate to row count (wide rows? blob columns?)
```

---

## Step 2 — Classify tables (master vs transactional vs lookup vs system)

Use `mcp__mssql__find_lookup_tables` if available. Then apply these heuristics:

| Heuristic | Classification |
|-----------|---------------|
| Row count < 100 AND no FK references TO it | Lookup |
| Row count < 100 AND name starts `tblLkp_` / `tblRef_` / `tblConst_` | Lookup |
| Row count 100–100k AND has business attributes AND many FKs reference it | Master |
| Row count > 100k AND grows over time AND has datetime columns | Transactional |
| Name starts `sys` / `aud` / `log` AND has datetime columns | System / Audit |
| Empty (0 rows) | Dead candidate |

Focus on identifying the **master-data candidates**. Likely names (you'll
need to map them):
- Customer / party / shipper / consignee / agent
- Line / carrier / shipping line
- Vessel / ship
- Port / location / facility
- Container type / equipment type / ISO code
- Charge / tariff / fee code
- Commodity / cargo / HS code
- Hold / block / restraint
- Order type / movement type / booking type
- Lookup / reference / system code

### Output file: `.legacy/audit/02-CLASSIFICATION.md`

Structure:
```markdown
# Legacy Tables — Classification

## Master Data candidates
| Legacy table | Row count | Maps to Gecko entity | Confidence |
|--------------|-----------|----------------------|-----------|
| dbo.tblCust  | 14,288    | master.customers     | High      |
| dbo.tblShip  | 4,210     | master.vessels       | High      |
| dbo.tblPort  | 380       | master.ports         | High      |
| dbo.tblLine  | 124       | master.lines         | High      |
| dbo.tblCntrType | 58     | master.container_types | High    |
| dbo.tblChrg  | 220       | master.charge_codes  | High      |
| dbo.tblComm  | 8,800     | master.commodities   | Medium    |
| dbo.tblHold  | 28        | master.holds         | High      |
| dbo.tblOrdType | 16      | master.order_types   | High      |
| ... |

## User / Identity candidates
| Legacy table | Row count | Maps to Gecko entity | Confidence |
|--------------|-----------|----------------------|-----------|
| dbo.tblUser  | 280       | identity.users       | High      |
| dbo.tblRole  | 24        | identity.roles       | High      |
| dbo.tblUserRole | 480    | identity.user_roles  | High      |
| dbo.tblPerm  | 184       | identity.permissions | High      |
| ... |

## Lookups (small, simple reference tables)
List with row count.

## Transactional (out of scope for Phase 1)
Just list — we won't deep-dive.

## System / Audit (out of scope)
Just list.

## Dead candidates (0 rows, no recent FK references)
List with notes.

## Tables we couldn't classify confidently
List with notes — architect decides in review.
```

---

## Step 3 — Deep dive on Master Data candidates

For **each** master-data candidate from Step 2, do the following:

1. **Schema** — `mcp__mssql__describe_table`. Capture every column with
   exact type, nullability, default, identity, computed-ness.

2. **Sample data** — `mcp__mssql__sample_data` with `top: 10`. Save raw
   rows (anonymise / abbreviate any obvious PII like phone numbers, emails).

3. **Null patterns** — `mcp__mssql__analyze_null_patterns` to find columns
   that are mostly NULL or mostly empty-string (suggests dead fields).

4. **Distinct value distribution** for low-cardinality string columns
   (suggests overloaded usage):
   ```sql
   SELECT TOP 20 [col_name], COUNT(*) AS cnt
   FROM dbo.tblXxx
   GROUP BY [col_name]
   ORDER BY cnt DESC;
   ```

5. **FK relationships** — what references this table, what does it
   reference. Use `mcp__mssql__get_relationships`.

### Output file: `.legacy/audit/03-MASTER-DATA.md`

Structure (one section per master entity):

````markdown
# Master Data — Deep Dive

## Customers — `dbo.tblCust`

**Row count:** 14,288
**Size:** 18 MB

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| CustID | INT IDENTITY(1,1) | No | — | PK |
| CustCode | VARCHAR(20) | No | — | Unique |
| CustName | NVARCHAR(200) | No | — | |
| Address1 | NVARCHAR(200) | Yes | — | 18% NULL |
| ... |

### Sample (10 rows, abbreviated)
```
CustID | CustCode  | CustName              | Country | Active
1      | C-00001   | TCL Electronics Thai. | TH      | 1
2      | C-00002   | Thai Union Group PCL  | TH      | 1
...
```

### FKs IN
- `dbo.tblOrd_Hdr.CustID` → `tblCust.CustID` (mandatory)
- `dbo.tblInv.BillToID` → `tblCust.CustID` (mandatory)

### FKs OUT
- `tblCust.CountryCode` → `dbo.tblCountry.CountryCode` (mandatory)
- `tblCust.DefTariffID` → `dbo.tblTariff.TariffID` (nullable)

### Observations
- `Active` column: BIT, 12,402 active (87%), 1,886 inactive
- `CustCode` is user-defined (verified by existence of leading 'C-', 'X-',
  'OLD-' prefixes — looks like multiple legacy conventions)
- 4 rows with `CustCode = '-' or 'TBA'` — magic placeholder values
- Address fields all `NVARCHAR(200)` — Unicode (good)
- Phone column allows multiple formats (raw text, no normalization)

### Open questions for architect
- Are there really 5 different CustCode prefix schemes? Should new schema
  enforce one?
- `CreditLimitTHB` column exists but `CreditLimitUSD` also exists — is
  this how multi-currency credit was modeled? Both populated for 12 rows.

---

## Lines — `dbo.tblLine`
... (same structure)

## Vessels — `dbo.tblShip`
...

## Ports — `dbo.tblPort`
...

## Container Types — `dbo.tblCntrType`
...

## Charge Codes — `dbo.tblChrg`
...

## Commodities — `dbo.tblComm`
...

## Holds — `dbo.tblHold`
...

## Order Types — `dbo.tblOrdType`
...

## Locations — (yard / facility / block / row / bay / slot)
Likely one or more tables. Document the hierarchy.
````

---

## Step 4 — Deep dive on Identity / User candidates

Same structure as Step 3, but for user/role/permission tables.

Pay special attention to:
- **Password storage** — is it plaintext? Hashed? What algorithm? (We're
  not migrating passwords; we'll use Azure AD B2C. But document what's
  there for the migration plan.)
- **Permission model** — coarse (per-module) or fine (per-action)? How
  many distinct permissions exist?
- **Session/token tables** — anything that suggests existing token-based
  auth?
- **Audit tables** — login attempts, role-change history?
- **Customer-portal users** — separate table or same `tblUser`?
- **Service accounts** — distinguishable from human users?

### Output file: `.legacy/audit/04-IDENTITY.md`

Structure:
````markdown
# Identity & Auth — Deep Dive

## Users — `dbo.tblUser`
(Schema, sample, FKs, observations as above)

### Password storage
- Column: `dbo.tblUser.PasswordHash NVARCHAR(255)`
- Format examination: looks like {bcrypt | SHA-256 | MD5 | plaintext}
  Sample (anonymised): `$2a$10$...` (bcrypt)
- Salt column? `PasswordSalt`? Or salt-included-in-hash format?

## Roles — `dbo.tblRole`
...

## User-Role assignment — `dbo.tblUserRole`
...

## Permissions — `dbo.tblPerm`
...

## Role-Permission assignment — ...
...

## Session / token tables (if any)
...

## Audit / login-history (if any)
...

## Observations
- How many users total / active / inactive?
- How are passwords stored?
- Is there a soft-delete pattern, or hard delete?
- Customer-portal users: separate table, same table with discriminator,
  or no portal users at all?
- MFA? Any column suggesting two-factor was implemented?
- Tenant context? (Likely no — single-tenant legacy. But check.)
````

---

## Step 5 — Lookup tables and reference data

Get all lookup-classed tables from Step 2. For each:
- Schema
- ALL rows (since they're tiny)
- What references this lookup

Group similar lookups together (e.g. all status / state / type lookups).

### Output file: `.legacy/audit/05-LOOKUPS.md`

````markdown
# Lookup & Reference Data

## Container Status — `dbo.tblLkp_CntrStatus` (8 rows)
| Code | Description |
|------|-------------|
| EXP  | Expected    |
| FIN  | Full In     |
| LDD  | Loaded      |
| ... |

References: `dbo.tblCntrMov.StatusCode`, `dbo.tblOrd_Cntr.Status`

## Hold Types — `dbo.tblLkp_HoldType` (5 rows)
...

## ... (all lookup tables)
````

---

## Final output

After completing Steps 1–5, write a summary file at the top of the
audit folder:

### `.legacy/audit/00-SUMMARY.md`

```markdown
# Legacy DB Discovery — Summary

**DB:** Vector
**Server:** SQL Server 2025 Express on DESKTOP-6AQI384\APPIFY
**Sweep date:** 2026-05-09

## Discovery output files
- 00-SUMMARY.md (this file)
- 01-INVENTORY.md
- 02-CLASSIFICATION.md
- 03-MASTER-DATA.md
- 04-IDENTITY.md
- 05-LOOKUPS.md

## Key findings
1. Total tables: N (M classified as master-data candidates, K as identity-related)
2. Naming convention: legacy uses `tbl<3-letter>_<noun>` consistently / inconsistently
3. Audit pattern: every table has CreatedBy/CreatedOn columns? OR not present?
4. Tenant column: legacy has FacilityID column on most tables (single tenant
   running multiple facilities) OR no tenant concept (truly single-tenant)
5. Soft-delete pattern: BIT IsDeleted / IsActive column on most tables?
6. Multi-language: any table has `name_en`, `name_th` etc.? OR single name column?
7. Password storage: format identified

## Critical observations (anything that surprised you)
- ...

## Questions for the architect
- ...

## Recommended next step
The architect should review these files and identify:
- Which legacy tables map cleanly to new Gecko entities
- Where business rules are unclear (need clarification)
- Where the legacy data model is broken (don't replicate)
- Migration mapping per entity
```

---

## Working tips for the AI assistant doing the sweep

1. **Use the MCP tools, not raw queries, where available** — they handle
   pagination and large outputs better.
2. **For heavy queries**, add `WITH (NOLOCK)` hint or use `READ
   UNCOMMITTED` since this is a live DB.
3. **If a single tool call returns too much data**, batch it (e.g.,
   describe tables in groups of 10).
4. **When sampling**, abbreviate or anonymise PII (phone numbers, emails,
   addresses) — write `+66-...-1234` instead of full numbers.
5. **If the connection drops mid-sweep**, resume from the last
   completed step.
6. **Time budget**: aim for 30-60 minutes of tool calls. If something is
   taking longer, note it in summary as "deferred".

---

## When done

Tell the user:
> "Discovery complete. Audit files written to `.legacy/audit/`. Bring
> these back to the architect session for schema design."

The user will then return to the architect's session, where the
`LEGACY_MASTERS_AUDIT.md` and `LEGACY_IDENTITY_AUDIT.md` will be drafted
as the basis for new schema design.
