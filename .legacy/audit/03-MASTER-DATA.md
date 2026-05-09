# Master Data — Deep Dive

## Customers — `Master.Customer`

**Row count:** 28,070 | **Size:** 5.7 MB | **Created:** 2015-01-26

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| CustomerCode | varchar(25) | No | — | PK, natural key |
| CustomerName | nvarchar(255) | No | — | Unicode |
| CustomerName2 | nvarchar(255) | No | '' | Secondary/local name |
| RegistrationNo | nvarchar(100) | No | '' | Tax/business reg number |
| IsBillingCustomer | bit | No | 0 | Role flag |
| IsShipper | bit | No | 0 | Role flag |
| IsConsignee | bit | No | 0 | Role flag |
| IsFwdAgent | bit | No | 0 | Role flag |
| IsShippingAgent | bit | No | 0 | Role flag — also used for "Line" |
| IsHaulier | bit | No | 0 | Role flag |
| IsTransporter | bit | No | 0 | Role flag |
| OperatorCode | varchar(10) | No | '' | Short code for operations |
| CurrencyCode | varchar(3) | No | '' | Default billing currency |
| DebtorCode | varchar(10) | No | '' | Accounting system code |
| RevenueAccount | varchar(10) | No | '' | GL account code |
| Status | bit | No | 1 | Active/inactive (soft-delete) |
| Remark | nvarchar(100) | Yes | — | |
| NumberOfLongStandingDays | smallint | Yes | — | Detention threshold |
| CreditTerm | smallint | Yes | 0 | Payment terms (days) |
| CreatedBy | varchar(10) | No | '' | Audit |
| CreatedOn | datetime | No | getdate() | Audit |
| ModifiedBy | varchar(10) | No | '' | Audit |
| ModifiedOn | datetime | No | getdate() | Audit |
| AuditID | xml | Yes | — | XML audit trail |

### Role distribution
| Role | Count | % of 28,070 |
|------|-------|-------------|
| IsBillingCustomer | 27,947 | 99.6% |
| IsShipper | 22,214 | 79.1% |
| IsConsignee | 16,751 | 59.7% |
| IsFwdAgent | 6,450 | 23.0% |
| IsHaulier | 6,217 | 22.1% |
| IsTransporter | 3,549 | 12.6% |
| IsShippingAgent | 1,899 | 6.8% |

**Active:** 26,787 (95.4%) | **Inactive:** 1,283 (4.6%)

### Sample (abbreviated)
```
CustomerCode | CustomerName                        | Roles
127          | 127 TRANSPORT CO.,LTD               | Billing, Haulier, Transporter
168          | บริษัท 168 เอ็นเนอร์ยี จำกัด        | Billing, ShipAgent, Haulier, Transporter
20120188     | GOLDEN LAND SIAM                    | Billing, Shipper
```

### Observations
- **Party table pattern**: Single table for all party types — customers, shippers, consignees, agents, hauliers. Multiple roles per entity via BIT flags.
- **No separate Lines/Shipping Lines table** — shipping lines are stored as Customers with IsShippingAgent=1 (1,899 records).
- **CustomerCode is free-form** — no consistent format. Seen: Thai chars, numeric ("127", "168"), dated ("20120187"), alphanumeric ("1SIAM").
- **CustomerName2** — secondary name field, likely for Thai/local language name. Most are empty-string, not NULL.
- **CurrencyCode/DebtorCode/RevenueAccount** — almost all empty. Accounting integration appears minimal.
- **CreatedBy is varchar(10)** on Customer but varchar(25) on other tables — inconsistency.
- **No address columns** — addresses are in the separate Contact table (polymorphic).

### Open questions
- Is there no dedicated "Line" or "Shipping Line" entity? IsShippingAgent seems overloaded.
- CustomerName2 — is it always the Thai translation, or sometimes a DBA/trade name?

---

## Contact — `Master.Contact`

**Row count:** 22,814 | **Size:** 7.6 MB

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| ContactID | bigint IDENTITY | No | — | PK, surrogate |
| AddressLinkID | nvarchar(100) | No | '' | FK to parent entity code |
| EntityType | varchar(50) | No | '' | Discriminator (e.g. "Customer", "Branch") |
| Address1 | nvarchar(255) | No | '' | |
| Address2 | nvarchar(255) | Yes | — | |
| State | nvarchar(100) | Yes | — | |
| CountryCode | varchar(2) | Yes | — | |
| PostCode | varchar(25) | Yes | — | |
| PhoneNumber | varchar(50) | Yes | — | |
| FaxNumber | varchar(50) | Yes | — | |
| ContactPerson | nvarchar(50) | Yes | — | |
| MobilePhoneNumber | varchar(25) | Yes | — | |
| EmailID | varchar(100) | Yes | — | |
| WebSite | varchar(MAX) | Yes | — | |
| Social1 | varchar(MAX) | Yes | — | |
| Social2 | varchar(MAX) | Yes | — | |
| IsDefault | bit | No | 0 | Default address flag |
| Status | bit | No | 1 | Active/inactive |

### Observations
- **Polymorphic contact table** — links to any entity via AddressLinkID + EntityType. One customer can have multiple contacts.
- Only table with IDENTITY surrogate key (bigint).
- Social1/Social2 — varchar(MAX), likely LINE/WeChat handles (Thailand context).

---

## Vessels — `Master.Vessel`

**Row count:** 6,164 | **Size:** 0.7 MB

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| VesselCode | varchar(10) | No | — | PK |
| VesselName | varchar(255) | No | '' | NOT Unicode |
| CallSign | varchar(10) | No | '' | |
| MappingCode | varchar(10) | No | '' | EDI mapping |
| Status | bit | No | 1 | |
| CreatedBy/On, ModifiedBy/On | — | — | — | Standard audit |

### Observations
- Very simple table — only code, name, call sign, mapping code.
- **No IMO number column** — surprising for vessel registry. May be derived from CallSign or stored elsewhere.
- VesselName is VARCHAR (not NVARCHAR) — no Unicode support for vessel names.
- VesselCode is only 10 chars — codes like "000", "00E", "01A" suggest operator-assigned short codes, not IMO/MMSI.

---

## Ports — `Master.Port`

**Row count:** 4,150 | **Size:** 0.6 MB

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| PortAreaCode | nvarchar(20) | No | — | PK |
| PortAreaName | nvarchar(255) | No | '' | |
| CountryCode | varchar(2) | No | '' | Mostly empty! |
| AreaPortType | smallint | No | 0 | Lookup: 3801=Port, etc. |
| PostCode | varchar(30) | Yes | — | |
| Latitude | varchar(50) | Yes | — | Stored as text |
| longitude | varchar(50) | Yes | — | Stored as text, lowercase col name |
| ISOCode | varchar(25) | No | '' | UN/LOCODE |
| MappingCode | varchar(25) | No | '' | EDI mapping |
| TradeMode | smallint | No | 0 | Lookup: 3850=Domestic, 3853=Overseas |
| PaperLessCode | varchar(10) | No | '' | Thai customs paperless code |
| Status | bit | No | 1 | |
| AuditID | xml | Yes | — | |

### Observations
- **CountryCode mostly empty** in sample data — data quality issue.
- **AreaPortType uses lookup IDs** (3801) — references Config.Lookup by LookupID, not by code.
- **Lat/Long stored as varchar** — not numeric. Many empty.
- Port table seems to store both ports AND areas/locations (AreaPortType discriminator).
- Column name inconsistency: `Latitude` vs `longitude` (casing).

---

## Locations — `Master.Location`

**Row count:** 2,846 | **Size:** 0.8 MB | **PK:** (AreaCode, LocationCode)

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| AreaCode | varchar(20) | No | — | Composite PK part 1 |
| LocationCode | nvarchar(20) | No | — | Composite PK part 2 |
| Description | nvarchar(255) | No | '' | Thai/English names |
| PostCode | varchar(20) | No | '' | |
| Latitude/Longitude | varchar(50) | No | '' | Text coords |
| ISOCode | varchar(25) | No | '' | |
| MappingCode | varchar(25) | No | '' | |
| Status | bit | No | 1 | |
| AuditID | xml | Yes | — | |

### Observations
- **Composite PK** — AreaCode + LocationCode. Many rows have empty AreaCode.
- Used for truck pickup/delivery locations — descriptions in Thai (warehouse names, industrial estates).
- Separate from Port table — Port = seaport/terminal, Location = inland delivery point.

---

## Charge Codes — `Master.ChargeCode`

**Row count:** 300 | **Size:** 0.1 MB

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| ChargeCode | varchar(15) | No | — | PK, e.g. "SA001-CA", "SC001-CR" |
| Description | nvarchar(100) | No | '' | |
| Module | smallint | No | 0 | Lookup: 3601=ICD, etc. |
| ChargeType | smallint | No | — | Lookup: 3201, 3203 |
| BillingUnit | smallint | No | '' | Lookup: 7011 |
| Status | bit | No | 0 | |
| VAT | numeric(5,2) | No | 0 | Tax rate (7.00 = 7%) |
| CreditTerm | numeric(3,0) | No | 0 | Days |
| PaymentTerm | smallint | No | 0 | Lookup: 3001=Cash, 3002=Credit |
| ChargeTerm | smallint | No | 0 | Lookup |
| IsByService | bit | No | 0 | |
| AuditID | xml | Yes | — | |

### Observations
- **Charge code naming convention:** `S[letter][NNN]-[CA|CR]` — suffix CA=Cash, CR=Credit. Same charge duplicated for payment terms.
- Module/ChargeType/BillingUnit/PaymentTerm all reference Config.Lookup by numeric ID.
- VAT hardcoded at 7% for all sampled records (Thailand VAT rate).

---

## Container Types — `Config.EquipmentTypeSize`

**Row count:** 31 | **Size:** 0.1 MB | **PK:** (EquipmentType, EquipmentSize)

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| EquipmentSize | varchar(2) | No | — | "20", "40", "45" |
| EquipmentType | varchar(2) | No | — | "GP", "HC", "RF", "OT", "FL" |
| EquipmentTypeSize | varchar(4) | No | — | Computed: Size+Type ("20GP") |
| ISOCode | varchar(250) | No | '' | Semicolon-delimited ISO codes |
| Description | varchar(255) | No | '' | |
| TareWeight/GrossWeight/MaxGrossWeight | numeric(9,2) | No | 0 | Mostly 0 |
| IsContainer | bit | No | 0 | |
| IsReefer | bit | No | 0 | |
| IsTruck | bit | No | 0 | |
| TEU | smallint | No | 0 | 1 or 2 |
| Height | smallint | No | 0 | Lookup: 1301=Standard, 1302=HighCube |
| Status | bit | No | 1 | |

### Observations
- **ISOCode stores multiple codes** semicolon-delimited in a single varchar(250) — e.g. "22G0;22G1;2200".
- Weight columns mostly unpopulated (all zeros).
- Includes non-container types (IsTruck flag).

---

## Containers — `Master.Container`

**Row count:** 168,192 | **Size:** 100.6 MB

### Schema (41 columns — key ones)
| Column | Type | Notes |
|--------|------|-------|
| ContainerNo | varchar(15) | PK |
| Size | varchar(2) | "20", "40" |
| Type | varchar(2) | "GP", "HC" |
| AgentCode | varchar(25) | Shipping line code (→ Customer) |
| OwnerCode | varchar(25) | Owner code |
| ContainerGrade | smallint | Lookup |
| ContainerStatus | varchar(10) | → ContainerStatus.Code |
| IsHold | bit | Hold flag |
| BranchID | smallint | Site |
| YardLocation | varchar(20) | Current yard position |
| SealNo1/SealNo2 | varchar(20) | Seal numbers |
| Temperature | numeric(5,2) | Reefer temp |
| TareWeight/MaxGrossWeight | varchar(10) | Stored as TEXT not numeric |
| VGM | numeric(18,4) | Verified Gross Mass |
| MovementCode | varchar(20) | Last movement |
| MovementDate | datetime | Last movement date |
| EFIndicator | smallint | Empty/Full |
| HireMode | smallint | Lookup |
| Material/Height | smallint | Lookup |

### Observations
- **Container is a live-state table**, not just a registry — tracks current status, location, last movement, seals.
- TareWeight/MaxGrossWeight stored as varchar(10), not numeric — data quality issue.
- Column `TempratureMode` — typo in column name ("Temprature" instead of "Temperature").

---

## Order Types — `Master.OrderType`

**Row count:** 21

### All rows (sample)
```
Code                          | Description                        | BookingType | ShipmentType
BLIND GATE IN                 | GATE IN WITHOUT INFORMATION        | 101         | 201
EXP CFS                       | EXPORT CFS SCT/ECT                | 102         | 202
EXP CY/CY                     | EXPORT CY AT SCT/ECT              | 102         | 201
IMP CFS                       | IMPORT CFS AT SCT/ECT             | 101         | 202
IMP CY/CY                     | IMPORT AT SCT/ECT                 | 101         | 201
EXP CY-IN (NOMINATING)        | EXPORT CY-IN AT SCT               | 102         | 203
```

### Observations
- BookingType 101=Import, 102=Export (from Config.Lookup).
- ShipmentType 201=CY, 202=CFS, 203=CY-IN.
- Code is free-form text, not a short code.

---

## Movements — `Master.Movement`

**Row count:** 8

### All rows
```
MovementCode     | Description          | IsICD | IsTrucking | EFIndicator
FULL IN          | LADEN IN             | true  | false      | 1352 (Full)
FULL OUT         | LADEN OUT            | true  | false      | 1352
MTY IN           | EMPTY IN             | true  | false      | 1351 (Empty)
MTY OUT          | EMPTY OUT            | true  | false      | 1351
FULL IN (TRK)    | FULL IN FOR TRUCKING | false | true       | 1352
FULL OUT(TRK)    | FULL OUT FOR TRUCK   | false | true       | 1352
MTY IN(TRK)      | MTY IN FOR TRUCKING  | false | true       | 1351
MTY OUT(TRK)     | MTY OUT FOR TRUCKING | false | true       | 1351
```

- 4 ICD movements + 4 Trucking duplicates = 8 total.

---

## Country — `Master.Country`

**Row count:** 246

Simple reference: CountryCode varchar(2) PK, CountryName varchar(100), MappingCode, ISOCode. Standard ISO 3166-1 alpha-2 codes.

---

## Company / Branch / Yard hierarchy

```
Company (8 rows) → Branch (8 rows) → Yard (16 rows) → YardMap (3 blocks)
```

- **Company:** "SCT" = SIAM CONTAINER TRANSPORT AND TERMINAL CO.,LTD (only active company)
- **Branch:** 6 active branches (ECT1/Mahachai, ELCB/LCB, ELKB/LKB, EMTP/Mabtaphut, ESCT/SCT, SCT1)
- **Yard:** Import/Export yards per branch, with TotalTEU capacity
- **YardMap:** Block layout with MaxRows, MaxColumns, Stack height, Size, AgentCode, positioning

---

## Driver — `Master.Driver`

**Row count:** 1,080

Key cols: DriverID varchar(10) PK, DriverName nvarchar(50), LicenseNo, LicenseExpiryDate, Status smallint (not BIT — uses lookup), Location smallint (lookup), ContactID bigint (→ Contact).

---

## Truck — `Master.Truck`

**Row count:** 404

Key cols: TruckID varchar(20) PK, RegistrationNo nvarchar(10), Manufacturer/TruckCategory/OwnershipType/FuelType (all smallint lookups), Driver1/Driver2 varchar(10), ChassisID, CurrentLocation, CurrentJONo, BranchID, fuel balances. Only table with a column description: FuelType "0=UNASSIGNED, 1=DIESEL, 2=GAS".

---

## Chassis — `Master.Chassis`

**Row count:** 447

Similar structure to Truck: ChassisNo PK, RegistrationNo, Size/Type/Height (smallint lookups), OwnershipType, BranchID, expiry dates.
