---
title: "GECKO IMS — High-Level Design (Simplified)"
subtitle: "TOS + Trucking + EDI on Microsoft Azure"
author: "GECKO Innovations"
date: "2026"
classification: "Confidential"
---

# GECKO IMS

## High-Level Design — Simplified
### Cloud-Native SaaS on Microsoft Azure

| | |
|---|---|
| **Prepared for** | Siam Container Terminal & Transport (SCT) |
| **Cloud Provider** | Microsoft Azure (Southeast Asia region) |
| **Tenancy** | Multi-Tenant SaaS (Single-Tenant available) |
| **Document Type** | Simplified HLD — accompanies the Functional Scope |
| **Classification** | Confidential |

---

# 1. Solution Topology

GECKO IMS is a layered, cloud-native architecture. Web, mobile, and partner traffic enters through a hardened edge, flows through an API gateway, and is served by stateless microservices on Azure Kubernetes Service. Cross-module workflows are coordinated through an event bus. Shared platform services (payment, notification, scheduled reports, AI functions) serve all three modules from a single implementation.

```
                          ┌───────────────────────────────────────────────┐
                          │           EXTERNAL ACTORS & CHANNELS          │
                          │   Depot Staff · Customer · Haulier · Driver   │
                          │       (Web Browser)        (Flutter App)      │
                          └────────────────────┬──────────────────────────┘
                                               │
                          ┌────────────────────▼──────────────────────────┐
                          │     EDGE  ·  Cloudflare / Azure Front Door    │
                          │       DDoS  ·  WAF  ·  TLS  ·  Static CDN     │
                          └────────────────────┬──────────────────────────┘
                                               │
                          ┌────────────────────▼──────────────────────────┐
                          │     API GATEWAY  ·  Azure API Management      │
                          │     Auth (JWT)  ·  Rate Limit  ·  Routing     │
                          └────────────────────┬──────────────────────────┘
                                               │
              ┌────────────────────────────────┼──────────────────────────┐
              ▼                                ▼                          ▼
       ┌──────────────┐               ┌───────────────────┐      ┌─────────────────┐
       │ WEB FRONTENDS│               │  MICROSERVICES    │      │   AI / COMPUTE  │
       │  Azure App   │               │       (AKS)       │      │  Azure Functions│
       │  Service /   │               │  TOS · Trucking · │      │  OCR · VRP ·    │
       │   Vercel     │               │  EDI · Billing ·  │      │  Text-to-SQL ·  │
       │  (Next.js)   │               │  Auth · Notif ·   │      │  EDI Parser ·   │
       │              │               │   Scheduler       │      │   PDF Render    │
       └──────────────┘               └─────────┬─────────┘      └────────┬────────┘
                                                │                         │
                                                ▼                         │
                               ┌────────────────────────────────┐         │
                               │  EVENT BUS · Azure Service Bus │◀────────┘
                               │ gate.* booking.* trip.* edi.*  │
                               │  billing.*  notification.*     │
                               └────────────────┬───────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              ▼                                 ▼                                 ▼
     ┌──────────────────┐         ┌──────────────────────────┐         ┌────────────────────┐
     │ NOTIFICATION     │         │  PAYMENT GATEWAY         │         │  SCHEDULED REPORTS │
     │ ENGINE           │         │  ABSTRACTION             │         │  ENGINE            │
     │                  │         │                          │         │                    │
     │ Email · SMS ·    │         │ Stripe · K-Bank · SCB ·  │         │ Cron · PDF/Excel · │
     │ LINE · WhatsApp· │         │ PromptPay QR · 2C2P ·    │         │ Email/LINE deliver │
     │ In-App · Webhook │         │ Omise · pluggable adapter│         │ Distribution lists │
     └──────────────────┘         └──────────────────────────┘         └────────────────────┘
                                                │
   ┌────────────────────────────────────────────▼────────────────────────────────────────────┐
   │                                  DATA LAYER                                              │
   │                                                                                          │
   │   PostgreSQL 16        Redis 7             Timescale DB           Azure Blob Storage     │
   │   (Operational)        (Cache + Queue)     (GPS + Telemetry)      (Documents + Photos)   │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
   ┌────────────────────────────────────────────▼────────────────────────────────────────────┐
   │                          INTEGRATION LAYER  ·  Outbound                                  │
   │                                                                                          │
   │   EDI Partners      Carriers              Banks/Payment      Customs API    Accounting   │
   │   (AS2 / SFTP)      (CMA·Maersk·ONE)      (K-Bank·SCB)       (Thai Customs) (SAP/QB/Xero)│
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

A higher-fidelity editable diagram source (Mermaid + drawio) accompanies this document.

---

# 2. Layered Architecture

| Layer | Components | Technology |
|---|---|---|
| **Presentation** | TOS Web, Trucking Web, EDI Web, Customer Portal, Haulier Portal, Admin/BI Dashboard | Next.js 16 · React 19 |
| **Mobile** | Driver app (job list, POD, receipts, GPS, offline sync) | Flutter — iOS + Android |
| **API Gateway** | TLS, JWT validation, rate limiting, routing | Azure API Management |
| **Application Services** | TOS · Trucking · EDI · Billing · Auth · Notification · Scheduler | Go 1.22 · C# .NET 9 microservices on AKS |
| **AI / Functions** | Auto-Gate OCR · VRP optimizer · Text-to-SQL · EDI parser · PDF render | Azure Functions · Python 3.12 · Claude API · OR-Tools |
| **Event Bus** | Asynchronous cross-module messaging | Azure Service Bus (topics + subscriptions) |
| **Data** | Operational, cache, time-series, object storage | PostgreSQL 16 · Redis 7 · Timescale DB · Azure Blob |
| **Integration** | Outbound EDI / payment / accounting / customs / carrier | AS2 · SFTP · REST · gRPC · webhook |

---

# 3. Azure Deployment Topology

| Azure Service | Used For | Tier |
|---|---|---|
| **Azure Kubernetes Service (AKS)** | All microservices (TOS, Trucking, EDI, Billing, Auth, Notification, Scheduler) | Multi-AZ, autoscaling, dedicated node pools |
| **Azure App Service** | Web front-ends (Next.js apps, customer/haulier portals) | Premium tier with deployment slots |
| **Azure Functions** | AI services, OCR, PDF render, scheduled jobs, lightweight integrations | Consumption + Premium plans |
| **Azure Service Bus** | Cross-module event bus | Standard tier (topics + subscriptions) |
| **Azure Database for PostgreSQL** | Operational data store | Flexible Server, HA-enabled |
| **Azure Cache for Redis** | Session, rate-limit, hot lookup, pub-sub | Standard tier |
| **Azure Blob Storage** | EIRs, PODs, photos, invoice PDFs, EDI archives | Hot → Cool → Archive lifecycle |
| **Azure Container Registry (ACR)** | Container image registry with vulnerability scanning | Premium tier (geo-replication) |
| **Azure Key Vault** | Secrets, certificates, encryption keys | Standard tier |
| **Azure API Management** | API gateway with OpenAPI specs | Developer (dev) / Standard (prod) |
| **Azure Front Door / Cloudflare** | CDN, DDoS protection, WAF | Front Door Standard or Cloudflare Pro |
| **Azure Communication Services** | Email & SMS delivery (Thailand region) | Per-message pricing |
| **Azure Monitor + Log Analytics + App Insights** | Observability — logs, metrics, traces, alerts | Pay-as-you-go |

**Containers & Kubernetes.** All microservices ship as **Docker images** signed in ACR. Deployed to AKS via Helm charts managed by ArgoCD (GitOps). Horizontal Pod Autoscaler (HPA) on CPU/memory; KEDA for queue-driven scale (EDI inbound bursts, notification spikes). Secrets injected via Azure Key Vault CSI driver — never in images or env files.

---

# 4. Cross-Cutting Platform Services

These services serve all three modules from a single implementation — added once, available everywhere.

## 4.1 Event Bus (Azure Service Bus)

Topic-based asynchronous messaging. Examples:

| Topic | Example Events | Consumers |
|---|---|---|
| `gate.*` | `gate.in.completed`, `gate.out.completed` | Trucking, EDI, Billing |
| `booking.*` | `booking.created`, `booking.confirmed` | Trucking, EDI, Notification |
| `trip.*` | `trip.dispatched`, `trip.arrived`, `trip.delivered` | TOS, Customer Portal, Notification |
| `edi.*` | `edi.inbound.received`, `edi.outbound.sent` | TOS, Trucking, Notification |
| `billing.*` | `invoice.issued`, `payment.received` | Notification, Accounting |

Delivery: at-least-once with idempotent consumers, dead-letter queue per topic, 7-day replay.

## 4.2 Notification Engine

| Channel | Provider | Use Case |
|---|---|---|
| Email | SendGrid / Azure Communication Services | Transactional, statements, scheduled reports |
| SMS | Twilio / Azure Communication Services | OTP, urgent alerts |
| LINE | LINE Messaging API | Customer & internal staff alerts (Thailand) |
| WhatsApp | Meta Cloud API | International customer alerts |
| In-App | WebSocket | Real-time dashboard updates |
| Webhook | HTTP POST | Customer/partner integration |

Features: versioned templates, locale per recipient (EN/TH), channel fallback (LINE → SMS → Email), delivery receipt tracking, opt-out management, per-recipient rate limiting.

## 4.3 Payment Gateway (Pluggable Abstraction)

A single internal API stands in front of multiple gateways. Adding a new gateway requires only a new adapter implementation.

| Gateway | Methods |
|---|---|
| **Stripe** | International card payment |
| **K-Bank (Kasikornbank)** | Direct bank rail, QR payment |
| **Siam Commercial Bank (SCB)** | Direct bank rail, QR payment |
| **PromptPay** | Static + dynamic QR codes |
| **2C2P** | Card payment, alternative SEA methods |
| **Omise** | Card, Internet banking, TrueMoney |

Capabilities: pre-payment lock on booking, partial payments, credit-term workflow, instant settlement confirmation via webhook, refund, automatic tax-invoice + receipt generation, PCI-DSS scope reduced via gateway tokenization (we never see raw card data).

## 4.4 Scheduled Reports Engine

Cron-style scheduling with on-demand override. Outputs PDF / Excel / CSV. Distributes via Email, LINE, in-app, or SFTP push to client BI. Includes operational, financial, billing, EDI, and executive reports — extensible per client.

## 4.5 AI / Compute Functions

| Function | Purpose | Tech |
|---|---|---|
| Auto-Gate OCR | Container number + truck plate recognition | Azure Cognitive Services + custom model |
| VRP Optimizer | Truck routing & job allocation | Google OR-Tools (Python) |
| Text-to-SQL | Natural-language query → SQL → chart | Anthropic Claude API |
| EDI Parser | EDIFACT / X12 → canonical schema | Custom Go service |
| PDF / Excel Render | Branded document generation | Python + WeasyPrint / openpyxl |

All run as Azure Functions — auto-scaled, pay-per-execution.

---

# 5. Data Layer

| Store | Purpose | Notes |
|---|---|---|
| **PostgreSQL 16** | Operational data — bookings, containers, trips, EDI messages, invoices | Multi-AZ, point-in-time recovery, daily backups, 30-day retention |
| **Redis 7** | Session, rate-limit, hot lookup, pub-sub, distributed locks | Standard tier with persistence |
| **Timescale DB** | High-volume time-series — GPS positions, reefer temp, throughput | Continuous aggregates for fast dashboards |
| **Azure Blob** | EIR PDFs, POD photos, signed documents, invoice PDFs, EDI archive | Lifecycle: hot (30 days) → cool (180 days) → archive |

**Tenancy isolation:** schema-per-tenant in PostgreSQL plus row-level `tenant_id` enforcement at the API layer. Cross-tenant queries are physically impossible — verified by automated test.

---

# 6. Authentication & Security

| Concern | Approach |
|---|---|
| **Authentication** | Email + password managed by the application's **internal security module**. No external IdP required. |
| **Authorization** | Role-Based Access Control (RBAC) with fine-grained permissions per module and per tenant |
| **Transport encryption** | TLS 1.3 for all external traffic; mTLS between internal services on AKS |
| **At-rest encryption** | AES-256; customer-managed keys available via Azure Key Vault |
| **Secrets** | Azure Key Vault with CSI driver; zero secrets in code, env files, or container images |
| **Audit log** | Immutable append-only log for security events and material data changes |
| **Vulnerability management** | Container scan in ACR · dependency scan via Dependabot · SAST in CI |
| **Data residency** | Pinned to Azure Southeast Asia region (Singapore); cross-region disabled unless approved |
| **Compliance posture** | Aligned with ISO 27001 / SOC 2 Type II practices · PCI-DSS scope minimized via tokenized gateways |
| **Backup & DR** | RPO 15 minutes (transactional) · RTO 4 hours · cross-region async replication for critical DBs · quarterly DR drill |

---

# 7. Tenancy & Cost Model

## 7.1 Multi-Tenant SaaS (Recommended)

Shared infrastructure, isolated data. New tenants onboard in under one business day through automated provisioning. Best cost efficiency, fastest scaling.

- All tenants share one AKS cluster, one PostgreSQL flexible server, one Service Bus namespace
- Per-tenant schema in PostgreSQL prevents data leakage
- Per-tenant branding, configuration, integrations, and tariffs

## 7.2 Single-Tenant Dedicated

Entire stack reserved for one customer. Higher per-tenant cost; suits customers with regulatory or contractual isolation requirements.

- Dedicated AKS cluster, dedicated PostgreSQL server
- Same architecture, smaller node sizes
- Customer-controlled scheduling for upgrades and maintenance

## 7.3 Indicative Monthly Infrastructure Cost (Azure Southeast Asia)

USD per month, infrastructure only — excludes Gecko platform licence, support, and one-time implementation.

| Deployment Model | Monthly Cost | Notes |
|---|---:|---|
| **Multi-tenant SaaS** (per tenant, assuming 10-tenant cluster) | **~$150–250** | Base cluster ~$1,500–2,500/month, amortised across tenants |
| **Single-tenant dedicated** (one customer's entire stack) | **~$750–1,000** | Production-grade HA, smaller node sizes |
| **Add-ons** (any model) | | |
| Heavy GPS telemetry (>500 trucks active) | +$100–200 | Timescale DB scale-up |
| Heavy AI usage (>10K NL queries/month) | +$50–150 | Claude API token cost |
| High notification volume (>100K SMS/month) | +$200–500 | Twilio / ACS per-message pricing |

Final pricing confirmed at architecture-review stage based on SCT actual volumes.

---

# 8. DevOps & Delivery

| Pipeline Stage | Tooling |
|---|---|
| **Source** | GitHub (private repos per service); branch protection on `main` |
| **CI** | GitHub Actions — lint, unit tests, container build, image scan, push to ACR |
| **CD (non-prod)** | Auto-deploy to dev/staging on merge; Helm via ArgoCD |
| **CD (prod)** | Manual approval gate; blue/green rollout; auto-rollback on health failure |
| **Database migrations** | Forward-only via Flyway; backward-compatible deploys for zero downtime |
| **Feature flags** | Per-tenant rollout for risky features |
| **Observability** | OpenTelemetry → Azure Monitor + App Insights + Log Analytics |
| **Alerting** | PagerDuty / Opsgenie, routed by severity and on-call rotation |
| **Synthetic monitoring** | Uptime checks on critical journeys: login, gate-in, booking submit, payment |
| **SLA target** | 99.9% uptime for production tier |

---

# 9. What This HLD Does Not Cover

This is a **simplified HLD** to accompany the functional scope document. The following are intentionally out of scope here and would be elaborated in subsequent design documents:

- Detailed sequence diagrams per business scenario (gate-in flow, EDI inbound, dispatch optimization, payment settlement)
- Per-service ER diagrams and API specifications
- Network architecture (VNet, subnets, NSGs, peering)
- Capacity-planning calculations against SCT actual transaction volumes
- BCP/DR runbook with step-by-step failover procedures
- Penetration testing & security audit plan

These are produced during the Discovery Workshop and Phase 1 architecture review.

---

— End of Simplified HLD —

*Confidential · GECKO Innovations · 2026 · Prepared for Siam Container Terminal & Transport*
