# Legacy DB Inventory — Vector

**Connected:** 2026-05-09
**Server:** Microsoft SQL Server 2025 Express Edition (RTM-GDR) 17.0.1110.1 (X64)
**Total tables:** 145
**Total views:** 10
**Total size on disk:** 10.13 GB

## Schemas

| Schema | Tables | Purpose |
|--------|--------|---------|
| Master | 44 | Master data — customers, vessels, ports, containers, drivers, etc. |
| Operation | 39 | TOS operations — bookings, invoicing, container movements, gate |
| Trucking | 20 | Trucking module — job orders, cost sheets, fuel management |
| EMR | 16 | Equipment M&R — surveys, work orders, repair tariffs |
| EDI | 9 | EDI processing — COPARN/CODECO messages, status updates |
| Security | 5 | Identity & auth — users, roles, securables, rights, sites |
| Config | 4 | System config — lookups, equipment types, mappers, settings |
| Utility | 3 | Utility — document numbering, search columns |
| dbo | 3 | Misc — sysdiagrams, TriggerData, ListQuotation snapshot |
| Audit | 2 | Audit trail — EDI log, container fix port history |

## Tables — sorted by row count (top 20)

| Table | Rows | Size (MB) | Classification |
|-------|------|-----------|----------------|
| Trucking.OrderContainerMovements_History | 7,246,912 | 2,327.2 | Transactional |
| Operation.BookingStatement | 7,207,961 | 2,495.2 | Transactional |
| Trucking.OrderCostSheet | 2,870,364 | 976.5 | Transactional |
| Trucking.DriverAllowance | 1,891,018 | 341.2 | Transactional |
| Trucking.TruckFuelAudit | 1,837,370 | 83.9 | Transactional |
| Trucking.TruckFuelInventory | 1,568,478 | 180.6 | Transactional |
| EDI.ContainerStatus | 1,203,255 | 158.9 | Transactional |
| Trucking.JobOrderDetails | 1,154,006 | 223.8 | Transactional |
| Trucking.OrderContainerMovements | 1,130,644 | 697.6 | Transactional |
| Operation.InvoiceDetail | 934,135 | 239.7 | Transactional |
| EDI.BookingDetail | 889,735 | 83.8 | Transactional |
| Trucking.TankFuelInventory | 831,737 | 110.2 | Transactional |
| EDI.BookingHeader | 783,167 | 533.9 | Transactional |
| Operation.BookingMovement | 653,907 | 124.1 | Transactional |
| Trucking.QuotationItemCharges | 562,622 | 67.7 | Transactional |
| Master.ContainerStatusUpdate | 547,007 | 90.0 | Transactional (event log) |
| Operation.TruckMovementDt | 502,293 | 91.1 | Transactional |
| Operation.ContainerMovement | 500,302 | 171.8 | Transactional |
| Trucking.JobOrderHeader | 488,022 | 174.5 | Transactional |
| Operation.TruckMovementHd | 481,650 | 51.7 | Transactional |

## Tables — full list by schema

### Master (44 tables)
| Table | Rows | Size (MB) | Classification |
|-------|------|-----------|----------------|
| ContainerStatusUpdate | 547,007 | 90.0 | Event log |
| Container | 168,192 | 100.6 | Master |
| ContainerFixPort | 50,778 | 5.8 | Master/Junction |
| QuotationItem | 29,911 | 9.6 | Master (quotation detail) |
| Customer | 28,070 | 5.7 | Master |
| Contact | 22,814 | 7.6 | Master |
| Route | 15,400 | 3.3 | Master |
| Vessel | 6,164 | 0.7 | Master |
| Port | 4,150 | 0.6 | Master |
| Location | 2,846 | 0.8 | Master |
| AgentSeal | 1,776 | 0.4 | Master |
| Driver | 1,080 | 0.3 | Master |
| CustomerFuelPrice | 835 | 0.2 | Master |
| Quotation | 731 | 0.4 | Master |
| QuotationStorage | — | — | Master |
| MovementCharges | — | — | Master/Junction |
| OrderTypeCharges | — | — | Master/Junction |
| OrderTypeChargesVAS | — | — | Master/Junction |
| OrderTypeMovement | — | — | Master/Junction |
| BookingTypeMovements | — | — | Master/Junction |
| TripTypeMovements | — | — | Master/Junction |
| AgentChargeCodeMapping | — | — | Master/Junction |
| HaulierChargeTerm | — | — | Master/Junction |
| Truck | 404 | 0.2 | Master |
| Chassis | 447 | 0.1 | Master |
| ChargeCode | 300 | 0.1 | Master |
| Country | 246 | 0.2 | Reference |
| OrderType | 21 | 0.1 | Lookup |
| TripType | — | — | Lookup |
| IMOCode | 18 | 0.1 | Lookup |
| ContainerStatus | 15 | 0.1 | Lookup |
| Yard | 16 | 0.1 | Lookup/Master |
| YardMap | 3 | 0.1 | Lookup/Master |
| Company | 8 | 0.1 | Lookup/Master |
| Branch | 8 | 0.1 | Lookup/Master |
| Movement | 8 | 0.1 | Lookup |
| UOM | — | — | Lookup |
| EDIFormats | — | — | Lookup |
| EDIProfile | — | — | Master |
| FuelPrice | — | — | Master |
| PublicHoliday | — | — | Reference |
| PUDOMaster | — | — | Master |
| TruckMileage | — | — | Master |
| CargoType | 0 | 0 | Dead |

### Security (5 tables)
| Table | Rows |
|-------|------|
| UserRights | 3,583 |
| UserSites | 1,289 |
| Users | 357 |
| Securables | 44 |
| Roles | 5 |

### Config (4 tables)
| Table | Rows |
|-------|------|
| Lookup | 488 |
| SystemWideConfiguration | 46 |
| EquipmentTypeSize | 31 |
| Mapper | 4 |

### Utility (3 tables)
| Table | Rows |
|-------|------|
| DocumentNumberHeader | — |
| DocumentNumberDetail | — |
| SearchColumn | — |

### Audit (2 tables)
| Table | Rows |
|-------|------|
| EDILog | 190,182 |
| ContainerFixedPort | 0 |

### dbo (3 tables)
| Table | Rows |
|-------|------|
| ListQuotation20260412 | 1,539 |
| TriggerData | 0 |
| sysdiagrams | 0 |

## Views — full list

| View |
|------|
| dbo.vw_EDIBooking |
| dbo.vw_TruckMovement |
| EDI.vw_EDIInquiry |
| Master.QuotationView |
| Master.StandardQuotationView |
| Operation.vw_TrucksInYard |
| Operation.vw_UnbilledOrders |
| Trucking.QuotationItemView |
| Trucking.vw_OrderContainerMovements |
| Trucking.vw_QuotationItemCharges |

## Observations

- **Naming convention:** Clean `Schema.PascalCase` — no legacy `tbl` prefixes. Well-organized into domain schemas.
- **Audit pattern:** Every table has `CreatedBy varchar(25)`, `CreatedOn datetime`, `ModifiedBy varchar(25)`, `ModifiedOn datetime`. CreatedBy stores UserID strings, not numeric IDs.
- **AuditID XML column:** Many Master tables have an `AuditID xml` column — unclear purpose, likely XML-based change tracking.
- **No FK constraints:** Zero foreign key constraints defined in the entire database. All referential integrity is enforced at the application layer.
- **BranchID pattern:** Present on Container, Truck, Chassis, Yard, UserSites — acts as a site/facility discriminator (multi-site, single-tenant).
- **MappingCode/ISOCode columns:** Found on Port, Location, Country, CargoType, IMOCode, EquipmentTypeSize, Config.Lookup — used for EDI integration code mapping.
- **Dead tables:** CargoType (0 rows), Audit.ContainerFixedPort (0 rows), dbo.TriggerData (0 rows), dbo.sysdiagrams (0 rows).
- **Snapshot table:** `dbo.ListQuotation20260412` looks like a manually created snapshot (date in name, no PK).
- **Duplicate table names across schemas:** InvoiceHeader/InvoiceDetail appear in Operation, Trucking, and EMR schemas — each module has its own billing.
