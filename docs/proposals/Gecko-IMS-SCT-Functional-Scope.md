---
title: "GECKO IMS — Functional Scope & Implementation Summary"
subtitle: "TOS + Trucking + EDI — for Siam Container Terminal & Transport"
author: "GECKO Innovations"
date: "2026"
classification: "Confidential"
---

# GECKO IMS

## Functional Scope & Implementation Summary
### TOS · Trucking · EDI

| | |
|---|---|
| **Prepared for** | Siam Container Terminal & Transport (SCT), Bang Bo |
| **Modules Covered** | TOS (ICD-MS) · Trucking (TMS) · EDI · Customer/Haulier Portal · Driver Mobile App |
| **Proposed By** | GECKO Innovations |
| **Cloud Platform** | Microsoft Azure |
| **Tenancy** | Multi-Tenant SaaS (Single-Tenant available) |
| **Classification** | Confidential |

---

# 1. Executive Summary

GECKO IMS is a unified, AI-powered logistics platform delivering three integrated modules — **TOS (Terminal/ICD Operations)**, **Trucking (TMS)**, and **EDI (Electronic Data Interchange)** — supported by a **Customer & Haulier Self-Service Portal** and a **production-ready Driver Mobile App**.

All three module front-ends and the driver mobile app are **already built and demo-ready**. The engagement covers production hardening, data migration from legacy SQL Server, EDI partner certifications, AI add-ons (Auto-Gate, dispatch optimization, analytics), and go-live on Azure.

| | | | |
|:---:|:---:|:---:|:---:|
| **70%** | **35%** | **100%** | **10–12** |
| Faster gate processing<br/>with AI Auto-Gate | Fewer empty truck km<br/>via AI dispatch | Real-time container<br/>& truck visibility | Months to full delivery |

---

# 2. Module 1 — TOS (Terminal / ICD Operations)

The Terminal Operating System manages the full container lifecycle inside the depot. **All listed features are demo-ready in the current Gecko platform** unless flagged 📋 (planned for the AI phase).

| Functional Area | Implemented Features |
|---|---|
| **Gate Operations** | EIR-In with damage diagrams & photo evidence · EIR-Out with release validation · Self-service Kiosk mode · Live Yard Map with drag-and-drop |
| **Yard & Container Management** | Bulk container status updates · Equipment pool by line/ISO/condition · Universal unit inquiry · Multi-party holds & releases · Yard zones with capacity rules |
| **Reefer Operations** | 12-step PTI checklist with technician sign-off · Pre-cool tasks with band tolerance · Reefer temperature logs & alarms · Plug management board |
| **CFS Operations** | Stripping / stuffing work orders · Cargo inventory · CFS billing |
| **Bookings & Tariff** | Full booking workflow with VAS · Multi-tier tariff plans · Free-time rules per liner/customer · Rate cards with versioning |
| **Billing & Invoicing** | Automated daily storage accrual · Customer statements · Invoice workflow (draft → issued → paid) · D&D automation |
| **Master Data** | Containers, Lines, Vessels & Schedules, Ports, Locations, Customers, Hauliers, Holds, Lookups, Order Types, Seal Series |
| **Reports** | Operational (moves, throughput, dwell) · Schedule (vessel, pre-advice) · Account (AR aging, customer P&L) |
| **AI Add-Ons** 📋 | AI Auto-Gate (OCR + zero-touch pre-payment) · AI Yard Optimizer · Computer-vision damage detection |

---

# 3. Module 2 — Trucking (TMS) + Driver Mobile App

Transport operations from order entry through to delivery, with a production Flutter mobile app for drivers. **Demo-ready** front-ends; AI dispatch reserved for Phase 5.

| Functional Area | Implemented Features |
|---|---|
| **Order Management** | Manual / copy-from-booking / auto-from-TOS-release order entry · Multi-leg multi-drop job orders (JO) · Long-term customer contracts |
| **Fleet & Equipment** | Truck master (own + sub-contracted) · Driver master with certifications · Trailer/chassis pool · Equipment planning |
| **Dispatch** | Manual dispatch with live truck-job map · One-click approve · Bulk reassignment · Dispatcher dashboard |
| **AI Dispatch** 📋 | VRP optimizer (Google OR-Tools) · Fair load balancing · Port cut-off awareness · GPS-aware routing |
| **Driver Mobile App** ✅ | Native Flutter app for iOS + Android. Job list & acceptance · Status updates (Departed → Arrived → Loaded → Delivered) · Photo POD & signature capture · Receipt upload · Job history · Offline-first sync · Push notifications |
| **GPS & Tracking** | Real-time truck positions on map · Live ETA · Geofence alerts · Route history playback |
| **Cost & Settlement** | Per-job cost sheet (fuel, toll, driver allowance, sub-contractor) · Driver allowance adjustment rules · Fuel consumption tracking · Sub-contractor settlement runs |
| **Trucking Billing** | Per-job invoicing with attached POD · Multi-stop pricing · GPS-based detention capture · Unified billing with TOS (optional) |

---

# 4. Module 3 — EDI (Electronic Data Interchange)

Automated electronic messaging with shipping lines, port authorities, customs, and trading partners. **Front-end demo-ready**; partner-specific certification runs in parallel with delivery.

| Functional Area | Implemented Features |
|---|---|
| **Standard Messages** | CODECO (gate movements) · COPARN (release orders) · COARRI (vessel arrival) · IFTSAI (schedules) · MOVINS (stowage) · VERMAS (VGM) · eBilling to CMA/Maersk/ONE/OOCL/COSCO |
| **Inbound Pipeline** | Multi-channel receive (SFTP, AS2, HTTPS, Email, API) · EDIFACT/X12/XML/JSON validation · Auto-mapping to canonical schema · Error quarantine with retry · Full audit log |
| **Outbound Pipeline** | Event-driven message generation · Partner routing rules · CONTRL/997 acknowledgement matching · Exponential-backoff retry · Per-partner SLA dashboard |
| **Partner Management** | Onboarding wizard · Per-partner profiles (endpoints, credentials, schedules) · Test/staging mode for certification · Self-service partner diagnostics |
| **AI-Assisted EDI** 📋 | Email/LINE booking extraction (Claude) · Unknown-message auto-classification · Volume & schema anomaly detection |
| **Alerts** | Failure alerts (Email/LINE/SMS) · Daily partner activity digest · SLA breach pre-warning |

---

# 5. Customer & Haulier Self-Service Portal

A unified portal eliminating routine phone/email inquiries to operations staff. Customer-side portal is **demo-ready**; haulier-side completes during Phase 4.

| Customer Portal | Haulier Portal |
|---|---|
| Self-registration with KYC document upload | Self-managed truck & driver roster |
| 24/7 booking submission with AI-suggested cut-off | Job acceptance from incoming dispatch |
| Container tracking with timeline view | POD submission (photo + signature) from web or app |
| Vessel schedule lookup per booking | Detention auto-capture with dispute workflow |
| Document center — EIR / DO / invoice / receipt download | Settlement & receivable visibility |
| Online payment (QR PromptPay · K-Bank · SCB · Stripe) | EIR pre-booking to eliminate gate queuing |
| Invoice & payment history with statements | Multi-driver roster management |
| Email + LINE notification subscriptions | — |

**Shared:** Multi-user per account · Mobile-responsive · English + Thai · In-app chat to operations · API access for high-volume customers.

---

# 6. SaaS Model — Overview

GECKO IMS is delivered as a **cloud-native multi-tenant SaaS on Microsoft Azure**, with single-tenant dedicated deployments available for customers requiring physical isolation.

**Core platform services** that operate across all three modules:

| Service | What it does |
|---|---|
| **Web Front-Ends** (Next.js 16) | TOS, Trucking, EDI, Customer Portal, Haulier Portal — all delivered through Azure App Service / Vercel edge |
| **API Layer** (Go + C# microservices on AKS) | Per-module business services, secured by JWT + RBAC behind Azure API Management |
| **Driver Mobile App** (Flutter) | Native iOS + Android, already built — connects through API gateway with offline-first sync |
| **Event Bus** (Azure Service Bus) | Cross-module events: gate-in → trucking job auto-created; trip-complete → invoice auto-generated; EDI inbound → TOS event |
| **Notification Engine** | Single service serving all modules — Email · SMS · LINE · WhatsApp · In-app · Webhook · with template management and channel fallback |
| **Payment Gateway** (pluggable abstraction) | One internal API behind multiple gateways: Stripe (international cards) · K-Bank · Siam Commercial Bank · PromptPay QR · 2C2P · Omise. Adding a new gateway = adding one adapter. |
| **Scheduled Reports Engine** | Cron-style scheduling · PDF/Excel/CSV · Email/LINE delivery · operational, financial, billing, EDI, executive reports |
| **AI / Compute Functions** (Azure Functions) | OCR, VRP optimiser, Text-to-SQL (Claude), EDI parser, PDF render |
| **Data Layer** | PostgreSQL 16 (operational) · Redis 7 (cache) · Timescale (GPS/telemetry) · Azure Blob (documents/photos) |

**Authentication:** Email + password only, managed by the application's internal security module. No Azure AD or external identity provider required.

**Tenancy:** Multi-tenant by default with schema-per-tenant isolation in PostgreSQL — one tenant cannot see another's data. Single-tenant dedicated deployments available for customers with regulatory or contractual isolation requirements.

**Indicative Azure infrastructure cost (USD/month, infra only — excludes Gecko platform licence, support, and implementation):**

| Deployment Model | Monthly Infrastructure Cost | Notes |
|---|---:|---|
| **Multi-tenant SaaS** (cost shared across all tenants) | **~$150–250 per tenant** | Scales down per tenant as more onboard; 10-tenant cluster ≈ $1,500–2,500 base |
| **Single-tenant dedicated** (entire stack reserved for one customer) | **~$750–1,000 per month** | Lower-spec components; same architecture, fewer instances; production-grade HA |

These ranges assume Southeast Asia region pricing, standard HA configuration, and typical SCT-scale data volumes. Final figures confirmed at architecture-review stage.

---

# 7. Next Steps

| Step | Action |
|---|---|
| **1** | **Discovery Workshop** (1–2 days, on-site at SCT, Bang Bo) — align scope, review existing SQL Server schemas, finalise data migration plan, confirm EDI partner list |
| **2** | **Project Agreement** — sign master agreement; define SLAs, governance, and per-phase acceptance criteria |
| **3** | **Phase 1 Kickoff** — Azure subscription setup, AKS cluster provisioning, DevOps pipeline live within 2 weeks of signing |
| **4** | **Bi-Weekly Sprint Reviews** — live software demos at SCT every two weeks; no end-of-project surprises |

---

— End of Functional Scope —

*Confidential · GECKO Innovations · 2026 · Prepared for Siam Container Terminal & Transport*
