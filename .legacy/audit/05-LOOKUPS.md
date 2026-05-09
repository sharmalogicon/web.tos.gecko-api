# Lookup & Reference Data

## Centralized Lookup Table — `Config.Lookup`

**Row count:** 488 | **Structure:** LookupID (smallint PK), LookupCode, LookupDescription, LookupCategory

This is the **single centralized enum table** for the entire application. All `smallint` columns across the DB that store coded values (e.g. ChargeType, BillingUnit, BookingType, ContainerGrade, etc.) reference this table by `LookupID`.

### Categories (40+)

| Category | Count | Used by |
|----------|-------|---------|
| AirGuide | 2 | — |
| AreaPortType | 5 | Port.AreaPortType |
| BillingMode | 4 | — |
| BookingType | 5 | OrderType.BookingType, Yard.BookingType |
| CargoCategory | 19 | CargoType/IMOCode.CargoCategory |
| CargoType | 4 | OrderType.CargoType |
| ChargeTerm | 3 | ChargeCode.ChargeTerm |
| ChargeType | 4 | ChargeCode.ChargeType |
| ChargeType-Trucking | 5 | Trucking charge codes |
| ChasisSize | 3 | Chassis.Size |
| ChasisStatus | 4 | Chassis.Status |
| ChasisType | 2 | Chassis.Type |
| ComponentGroup | 6 | EMR.Component |
| ContainerCondition | 2 | — |
| ContainerGrade | 17 | Container.ContainerGrade |
| ContainerHeight | 2 | Container.Height, EquipmentTypeSize.Height |
| ContainerHireMode | 3 | Container.HireMode |
| ContainerMaterial | 2 | Container.Material |
| ContainerMode | 2 | — |
| ContainerReeferUnit | 7 | Container.ReeferUnit |
| CURRENCY | 2 | — |
| DamageCode | 4 | EMR surveys |
| DamageIndicator | 96 | EMR damage classification |
| DiscountType | 3 | — |
| DriverStatus | 2 | Driver.Status |
| DropOffMode | 4 | — |
| E/FIndicator | 2 | Container.EFIndicator (Empty/Full) |
| ElectricalCable | 2 | — |
| EMRWAREHOUSE | 4 | EMR parts |
| EORType | 2 | — |
| FuelTankID | 15 | Trucking fuel |
| FuelUOM | 2 | — |
| HMC | 2 | — |
| Humidity | 2 | Reefer containers |
| ImageType | 2 | EMR images |
| IMO | 8 | Hazardous goods |
| InvoiceType | 4 | Invoice headers |
| Module | 2 | ChargeCode.Module |
| MovementIndicator | 2 | Container.MovementIndicator |
| MovementStatus | 4 | — |
| *(+ more categories beyond row 20 cutoff)* | | |

---

## Container Status — `Master.ContainerStatus` (15 rows)

| Code | Description | IsHold |
|------|-------------|--------|
| AV | GOOD CNTR | No |
| AW | WAIT INSPECTION | No |
| AWT | AWAITING SURVEY | No (inactive) |
| CL | CLEANING REQUIRED | No |
| DMG | DAMAGE | Yes |
| EVE | UNI-ARISE | No (inactive) |
| MJ | MAJOR DAMAGE | No |
| MN | MONOR DAMAGE | No |
| OHF | OFF-HIRE | Yes |
| SALE | SALE CONTAINER | No (inactive) |
| SALE. | SALE ONLY | Yes |
| SOUND | SOUND | No |
| STUFF | STRIP/STUFF | No |
| SW | SWEEPING | No |
| WW | WATER WASH | No |

**Referenced by:** Container.ContainerStatus

**Observations:**
- IsHold flag marks statuses that block container release (DMG, OHF, SALE.)
- Typo: "MONOR DAMAGE" should be "MINOR DAMAGE"
- SALE vs SALE. — duplicate concept with trailing period
- Mix of active (12) and inactive (3) statuses

---

## Equipment Type/Size — `Config.EquipmentTypeSize` (31 rows)

| TypeSize | Description | TEU | Height |
|----------|-------------|-----|--------|
| 20GP | 20' DRY CARGO | 1 | Standard |
| 40GP | 40' DRY CARGO | 2 | Standard |
| 40HC | 40' DRY CARGO HIGH CUBE | 2 | HighCube |
| 45HC | 45' DRY CARGO HIGH CUBE | 2 | HighCube |
| 20RF | 20' REEFER | 1 | Standard |
| 40RF | 40' REEFER | 2 | Standard |
| 20OT | 20' OPENTOP | 1 | Standard |
| 40OT | 40' OPENTOP | 2 | Standard |
| 20FL | 20' FLAT RACK | 1 | Standard |
| 40FL | 40' FLAT RACK | 2 | Standard |
| *(+ 21 more including FR, HG, HO, HR, HW, OQ, FT, QW test data)* |

---

## Movement Codes — `Master.Movement` (8 rows)

| Code | Description | Module | E/F |
|------|-------------|--------|-----|
| FULL IN | LADEN IN | ICD | Full |
| FULL OUT | LADEN OUT | ICD | Full |
| MTY IN | EMPTY IN | ICD | Empty |
| MTY OUT | EMPTY OUT | ICD | Empty |
| FULL IN (TRK) | FULL IN FOR TRUCKING | Trucking | Full |
| FULL OUT(TRK) | FULL OUT FOR TRUCK | Trucking | Full |
| MTY IN(TRK) | MTY IN FOR TRUCKING | Trucking | Empty |
| MTY OUT(TRK) | MTY OUT FOR TRUCKING | Trucking | Empty |

---

## Roles — `Security.Roles` (5 rows)

| RoleCode | Description |
|----------|-------------|
| Accounts | Accounts |
| Administrator | Administrator |
| GateUser | Gate User |
| Sales | Sales & Marketing |
| SuperUser | Super User |

---

## Company — `Master.Company` (8 rows, 1 active)

Active: **SCT** — SIAM CONTAINER TRANSPORT AND TERMINAL CO.,LTD

Inactive: ECT, ECT04, ELCB, LCB, LKB, SSS, SSSS (test/legacy data)

---

## Branch — `Master.Branch` (8 rows, 6 active)

| BranchCode | BranchName | CompanyCode |
|------------|------------|-------------|
| ECT1 | SCT (MAHACHAI BRANCH) | SCT |
| ELCB | SCT (LCB BRANCH) | SCT |
| ELKB | SCT (LKB BRANCH) | SCT |
| EMTP | SCT (MABTAPHUT BRANCH) | SCT |
| ESCT | SCT (SCT BRANCH) | SCT |
| SCT1 | SIAM CONTAINER TERMINAL CO.,LTD | SCT |

---

## Country — `Master.Country` (246 rows)

Standard ISO 3166-1 alpha-2 country codes. CountryCode varchar(2) PK + CountryName.

---

## IMO Codes — `Master.IMOCode` (18 rows)

Hazardous goods classification codes with CargoCategory discriminator.

---

## Config.SystemWideConfiguration (46 rows)

System settings table — not sampled but likely key-value configuration pairs.

---

## Config.Mapper (4 rows)

EDI code mapping configuration.
