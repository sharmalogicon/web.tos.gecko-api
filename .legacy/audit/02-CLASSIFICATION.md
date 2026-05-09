# Legacy Tables — Classification

## Master Data candidates

| Legacy table | Row count | Maps to Gecko entity | Confidence |
|--------------|-----------|----------------------|-----------|
| Master.Customer | 28,070 | master.customers (party table) | High |
| Master.Contact | 22,814 | master.contacts (polymorphic) | High |
| Master.Container | 168,192 | master.containers | High |
| Master.Vessel | 6,164 | master.vessels | High |
| Master.Port | 4,150 | master.ports | High |
| Master.Location | 2,846 | master.locations | High |
| Master.ChargeCode | 300 | master.charge_codes | High |
| Master.Driver | 1,080 | master.drivers | High |
| Master.Truck | 404 | master.trucks | High |
| Master.Chassis | 447 | master.chassis | High |
| Master.Route | 15,400 | master.routes | High |
| Master.OrderType | 21 | master.order_types | High |
| Master.Movement | 8 | master.movements | High |
| Master.ContainerStatus | 15 | master.container_statuses | High |
| Master.Company | 8 | master.companies | High |
| Master.Branch | 8 | master.branches | High |
| Master.Yard | 16 | master.yards | High |
| Master.YardMap | 3 | master.yard_blocks | High |
| Master.Country | 246 | master.countries | High |
| Master.IMOCode | 18 | master.imo_codes | High |
| Master.Quotation | 731 | master.quotations | Medium |
| Master.QuotationItem | 29,911 | master.quotation_items | Medium |
| Master.EDIProfile | — | master.edi_profiles | Medium |
| Master.AgentSeal | 1,776 | master.agent_seals | Medium |
| Master.AgentChargeCodeMapping | — | master.agent_charge_mappings | Medium |
| Config.EquipmentTypeSize | 31 | master.equipment_types | High |
| Config.Lookup | 488 | master.lookups (centralized enum) | High |

## User / Identity candidates

| Legacy table | Row count | Maps to Gecko entity | Confidence |
|--------------|-----------|----------------------|-----------|
| Security.Users | 357 | identity.users | High |
| Security.Roles | 5 | identity.roles | High |
| Security.UserRights | 3,583 | identity.user_permissions | High |
| Security.Securables | 44 | identity.securables | High |
| Security.UserSites | 1,289 | identity.user_sites | High |

## Lookups (small reference tables)

| Table | Rows | Notes |
|-------|------|-------|
| Master.ContainerStatus | 15 | Container condition codes (AV, DMG, SOUND, etc.) |
| Master.Movement | 8 | Gate movements (FULL IN, MTY OUT, etc.) |
| Master.OrderType | 21 | Booking types (EXP CY/CY, IMP CFS, etc.) |
| Master.IMOCode | 18 | Hazardous goods codes |
| Master.Company | 8 | Operating companies |
| Master.Branch | 8 | Company branches/sites |
| Master.Yard | 16 | Container yards |
| Master.YardMap | 3 | Yard block layout |
| Config.Lookup | 488 | Centralized enum table (40+ categories) |
| Config.EquipmentTypeSize | 31 | Container size/type matrix (20GP, 40HC, etc.) |
| Config.SystemWideConfiguration | 46 | System settings |
| Config.Mapper | 4 | EDI code mappers |
| Master.CargoType | 0 | Dead — 0 rows |

## Transactional (out of scope for Phase 1)

Operation: BookingHeader, BookingContainer, BookingMovement, BookingStatement, BookingText, ContainerMovement, ContainerMovementDamageStatus, ContainerMovementForCFS, InvoiceHeader, InvoiceDetail, CreditNoteHeader, CreditNoteDetail, CombinedInvoiceHeader, CombinedInvoiceDetail, PaymentConfirmationHeader, PaymentConfirmationDetail, TruckMovementHd, TruckMovementDt, TallyInHeader, TallyInDetail, TallyOutHeader, TallyOutDetail, VesselSchedule, RailMovement, RailSchedule, SlotBookingHeader, SlotBookingDetail, PreGateInHeader, PreGateInDetail, CYDirectHeader, CYDirectDetail, TransportAllocation, StockLedger, WorkOrderHeader, WorkOrderDetail, EDIOrderHeader, EDIOrderDetail, EquipmentJobCard, CODECOAPI_EDI_Staging

Trucking: OrderHeader, OrderContainer, OrderContainerMovements, OrderContainerMovements_History, OrderCostSheet, JobOrderHeader, JobOrderDetails, DriverAllowance, TruckMovements, TruckFuelAudit, TruckFuelInventory, TankFuelInventory, TruckBreakDown, ChassisStorage, Quotation, QuotationItem, QuotationItemCharges, InvoiceHeader, InvoiceDetail, ConfigParameters

EDI: BookingHeader, BookingDetail, ContainerStatus, ContainerFixPort, ContainerStatusUpdate, ContainerStatusUpdateMaster, CODECOContainer, CODECOCFS, SealValidation

EMR: SurveyHeader, SurveyDetail, WorkOrderHeader, WorkOrderDetail, WorkOrderImage, TariffHeader, TariffDetail, TariffManHours, TariffMaterial, MaterialIssueHeader, MaterialIssueDetail, InvoiceHeader, InvoiceDetail, Component, RepairCode, RepairLocation

## System / Audit

| Table | Rows |
|-------|------|
| Audit.EDILog | 190,182 |
| Audit.ContainerFixedPort | 0 |
| Utility.DocumentNumberHeader | — |
| Utility.DocumentNumberDetail | — |
| Utility.SearchColumn | — |

## Dead candidates (0 rows)

| Table | Notes |
|-------|-------|
| Master.CargoType | 0 rows, schema identical to IMOCode — likely superseded |
| Audit.ContainerFixedPort | 0 rows |
| dbo.TriggerData | 0 rows |
| dbo.sysdiagrams | 0 rows |

## Tables we couldn't classify confidently

| Table | Notes |
|-------|-------|
| Master.ContainerStatusUpdate | 547K rows — event log of container status changes, straddles master/transactional |
| Master.ContainerFixPort | 50K rows — container-to-port fixed assignments, unclear if master or operational |
| Master.PUDOMaster | Unknown row count — Pick Up / Drop Off config? |
| Master.TruckMileage | Unknown row count — odometer readings? |
| Master.FuelPrice | Unknown row count — fuel rate card |
| Master.PublicHoliday | Unknown row count — holiday calendar |
| dbo.ListQuotation20260412 | 1,539 rows — snapshot table with date suffix, likely ad-hoc export |
