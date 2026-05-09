# Legacy DB Discovery — Summary

**DB:** Vector
**Server:** SQL Server 2025 Express on DESKTOP-6AQI384\APPIFY
**Sweep date:** 2026-05-09

## Discovery output files
- 00-SUMMARY.md (this file)
- 01-INVENTORY.md — Full table/view inventory with row counts and sizes
- 02-CLASSIFICATION.md — Table classification (master/identity/lookup/transactional)
- 03-MASTER-DATA.md — Deep dive on all master data tables
- 04-IDENTITY.md — Deep dive on security/auth tables
- 05-LOOKUPS.md — All lookup and reference data

## Key findings

1. **Total:** 145 tables across 10 schemas, 10 views, 10.13 GB on disk
2. **Naming convention:** Clean `Schema.PascalCase` — well-organized into domain schemas (Master, Operation, Trucking, EMR, EDI, Security, Config, Utility, Audit)
3. **Audit pattern:** Every table has `CreatedBy/CreatedOn/ModifiedBy/ModifiedOn` — CreatedBy stores UserID strings (varchar(10-25))
4. **No FK constraints:** Zero foreign key constraints in the entire database. All referential integrity is application-enforced.
5. **Soft-delete:** Most tables use `Status BIT` (1=active) or `IsActive BIT`. No hard deletes.
6. **Tenant context:** No tenant column. Single-tenant legacy. Multi-site via `BranchID` on some tables. UserSites restricts user access to specific Branch+Yard combinations.
7. **Multi-language:** `CustomerName` + `CustomerName2` pattern — secondary field for Thai names. Not a systematic i18n approach.
8. **Natural keys everywhere:** CustomerCode, VesselCode, PortAreaCode, ChargeCode — no IDENTITY surrogates on master tables (except Contact.ContactID and Branch.BranchID).
9. **Centralized enum table:** `Config.Lookup` (488 rows, 40+ categories) — all smallint lookup columns reference this by LookupID. This is the single source for all coded values.
10. **Customer is a party table:** Single table for all party types (customer, shipper, consignee, agent, haulier, transporter) using 7 BIT role flags. Shipping lines are customers with IsShippingAgent=1.
11. **Contact is polymorphic:** `AddressLinkID + EntityType` pattern links contacts to any entity. One entity can have multiple contacts.

## Critical observations

1. **PASSWORDS ARE PLAINTEXT** — `Security.Users.Password` is `varchar(15)` storing raw text like "123", "S3T", "SHIPPING1234". No hashing, no salt, no MFA. Migration to Azure AD B2C is mandatory.
2. **Permission model is primitive** — Only "Full Control" permission type across 44 screens. No CRUD granularity. Roles exist but are decorative — permissions assigned directly per-user.
3. **No FK constraints** — Entire database has zero foreign keys. High risk of orphaned data. New schema should enforce referential integrity.
4. **TareWeight/MaxGrossWeight on Container stored as varchar** — numeric data in text columns.
5. **Config.Lookup is a God Table** — 488 rows across 40+ categories. Smallint IDs scattered everywhere (3201, 7011, 1351, etc.) with no compile-time safety.
6. **Charge codes duplicated for payment terms** — Same charge appears as SA001-CA (Cash) and SA001-CR (Credit). New schema should separate charge definition from payment terms.
7. **Port.CountryCode mostly empty** — data quality gap in port reference data.
8. **Typos in schema** — `TempratureMode` (Container), `ContaineStatusUpdate` (Securables), "MONOR DAMAGE" (ContainerStatus).

## Questions for the architect

1. Should Customer be decomposed into separate entities (Party, Customer, ShippingLine, Haulier) or keep the role-flag pattern with a polymorphic approach?
2. Is there a need for a separate Line/Carrier entity distinct from Customer, given that 1,899 customers have IsShippingAgent=1?
3. How should the Config.Lookup God Table be decomposed? Individual enum tables per category, or a structured multi-tenant lookup with proper FK constraints?
4. Should Container remain a live-state table (current status + position) or be split into a registry (immutable container details) + current state (mutable location/status)?
5. The legacy has no commodity/HS code table — CargoType is dead (0 rows) and IMOCode only covers hazardous goods. Does Gecko need a commodity master?
6. CustomerName2 — in the new schema, should this become a structured `localizedName` field or a dedicated `name_th` column?
7. Do we need to model the Contact polymorphic pattern differently (e.g., embedded addresses on Customer, separate address entity)?

## Recommended next step

The architect should review these files and identify:
- Which legacy tables map cleanly to new Gecko entities
- Where business rules are unclear (need clarification with operations team)
- Where the legacy data model is broken (don't replicate — e.g., plaintext passwords, God Lookup table, varchar weights)
- Migration mapping per entity with data cleansing rules
