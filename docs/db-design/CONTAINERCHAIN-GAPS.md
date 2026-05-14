# ContainerChain Gaps — What Gecko Needs to Cover

> Companion doc to `COMPETITIVE-ANALYSIS.md`. Documents the 4 specific
> capabilities ContainerChain (WiseTech subsidiary, acquired 2019) has that
> Gecko does not yet, with concrete designs for closing each gap.

**Last updated:** 2026-05-13
**Status:** Approved gaps; ready for phase-level planning
**Linked phases:** ARCHITECTURE.md §3, Phase 4.5 (Gate Appointments) + extensions to Phase 1 (Notifications), Phase 2 (TOS Release Coordination, ECP workflow)

---

## 1. Context — who ContainerChain is and why they matter

**ContainerChain** is **not a full TOS** — it's a focused platform with three flagship capabilities:

1. **Vehicle Booking System (VBS)** — trucker books gate appointment slots online; terminal/depot works to the schedule. Reduces gate congestion to near-zero at well-tuned sites.
2. **Empty Container Park (ECP) management** — specialised depot-side workflow for empty containers.
3. **Container release coordination** — multi-criteria readiness check before container release.

Plus an ecosystem around: notify-party network, trucker/driver pre-registration, partner API integration.

**Corporate context:** Acquired by **WiseTech Global** (parent of CargoWise) in 2019 for ~AUD 162M. Now bundled with CargoWise for combined offers. Originally Australia/NZ, expanding to SEA and Middle East.

**Why they matter to Gecko:**
- Depot operators in SEA (Linfox, Westports Depot, NYK ICD, ESCO at LKB) run pure ECP — no vessel, no booking lifecycle. ContainerChain serves this market specifically.
- Gate congestion is a daily pain at LCB, PSA, Westports, Tanjung Priok — VBS is the cure.
- They've educated the SEA market that **online appointment booking is a baseline expectation**.
- Now that they're under WiseTech, **vendor-independence concerns** open opportunities for replacement.

**Why this isn't trivial:**
- They've spent ~15 years specialising. Their UX for the trucker-side flow is mature. We need to match that quality, not just the data model.
- The market educated by them now expects SMS notifications, mobile booking, real-time slot availability. Half-baked won't sell.

---

## 2. The 4 gaps

### Gap 1 — Vehicle Booking System (VBS) — **the flagship gap**

#### What's missing in Gecko

Truckers cannot pre-book gate arrival appointment slots. We have:
- `/gate/appointments` stub page (from the Phase 5A broken-link sweep)
- Gate operations (EIR-In, EIR-Out) that record arrivals
- No appointment / slot / capacity model

We're missing:
- Slot capacity planning per yard / per time window
- Trucker self-service booking workflow
- Real-time slot availability queries
- No-show / late-arrival tracking
- Mobile-friendly trucker portal
- SMS / push notifications to truckers when slot confirmed

#### Why it matters

| Stakeholder | Pain point VBS solves |
|-------------|----------------------|
| **Terminal operator** | Gate congestion → fewer truck queues, smoother yard ops, predictable workload, fewer demurrage disputes |
| **Trucker** | No more queue waiting at gate; books slot online; SMS reminder; arrives, in/out within slot window |
| **Trucking company** | Predictable trip planning; better truck utilisation; less fuel waste idling |
| **Line agent / consignee** | Reliable pickup window for time-sensitive cargo (reefer, DG, JIT) |
| **Regulator** | Reduced port-side congestion, lower emissions |

**SEA reality:** LCB ICD operating at ~85% capacity utilisation — peak hour queue times can exceed 2 hours without VBS. PSA Tuas uses VBS extensively. Westports KL adopted similar in 2022. Tanjung Priok introduced VBS in 2020 (Inaport's TPS-online).

#### Proposed Gecko module — `Gate Appointments` (Phase 4.5)

**Position:** New top-level operational module. **Subscribable independently** of TOS — depot operators or trucker-side aggregators can buy VBS without the full TOS stack.

```
gecko_gate_appts_<tenant>          (per-tenant DB)
├── appointment_slots
│     id, tenant_id, branch_id, yard_id,
│     slot_start, slot_end, capacity_remaining,
│     restricted_to_movement_type (full_in / mty_out / both / null),
│     restricted_to_carrier_id (null = open to all),
│     is_blocked (maintenance window), is_active
│
├── appointment_bookings
│     id, tenant_id, slot_id,
│     trucker_party_id, vehicle_id, driver_id,
│     booking_ref (T-NNNNN-NNNN), booking_type (PICKUP / DROPOFF / BOTH),
│     container_no (nullable until container assigned),
│     booking_no_external (link to TOS booking),
│     status (REQUESTED / CONFIRMED / ARRIVED / DEPARTED / NO_SHOW / CANCELLED),
│     created_via (WEB_TRUCKER / OPS_DESK / API),
│     amended_count, last_amended_at,
│     no_show_penalty_amount, no_show_penalty_currency,
│     arrived_at, departed_at,
│     audit cols + RLS
│
├── trucker_registrations             (trucker companies pre-registered)
│     id, tenant_id, party_id (→ master.parties),
│     registered_at, verified_at, verification_method,
│     daily_slot_quota, monthly_slot_quota,
│     is_blacklisted (after repeated no-shows),
│     blacklist_reason
│
├── vehicle_registrations
│     id, tenant_id, registered_trucker_id,
│     plate_no, vehicle_type, vehicle_size_ft,
│     chassis_id_default, driver_default_id,
│     insurance_valid_until, safety_cert_valid_until,
│     is_active
│
├── appointment_audit_events
│     id, slot_id, booking_id, event_type, event_at, event_by,
│     reason, ip_address, user_agent  -- for trucker-self-service auditing
│
└── slot_availability_cache           (denormalised, refreshed every 5s)
      yard_id, slot_start, slots_total, slots_booked, slots_remaining
```

**Cross-module integration:**

| Source event | Target | Action |
|--------------|--------|--------|
| `gate_appointments.booking.confirmed` | TOS | Pre-register expected arrival in `gate.expected_arrivals` |
| `tos.container.released_for_pickup` | Gate Appointments | Container becomes available for slot assignment |
| `tos.charges.unpaid_above_threshold` | Gate Appointments | Block bookings by that trucker's parties until paid |
| `gate_appointments.booking.no_show` | Notifications + Trucking module | Trigger penalty + driver reliability score |
| Trucker arrives at gate | Gate Appointments + TOS | Confirm slot was booked; record actual arrival vs scheduled |

**API surface (trucker-facing):**

```
GET  /api/v1/gate-appointments/slots?branch_id&date&movement_type
POST /api/v1/gate-appointments/bookings           (book slot)
GET  /api/v1/gate-appointments/bookings/{ref}     (status check)
PUT  /api/v1/gate-appointments/bookings/{ref}     (amend within rules)
POST /api/v1/gate-appointments/bookings/{ref}/cancel
```

Plus a **public trucker self-service portal** — mobile-first, no auth required for slot search; OTP-based auth for booking.

**SMS gateway:** Integrate with Twilio + regional providers (AIS in Thailand, Maxis Malaysia, Smartfren Indonesia) for slot-confirmation / reminder / no-show-penalty SMS.

#### Acceptance criteria

- Trucker can find available slots and book one within 60 seconds on mobile
- Slot capacity respects yard-level and movement-type limits
- Real-time availability queries return in < 200ms
- SMS confirmation sent within 30 seconds of booking
- No-shows tracked and reported per trucker registration
- Terminal can view all bookings for a given window as a Gantt-style schedule
- Operational override: ops desk can force-book or cancel any slot

---

### Gap 2 — Empty Container Park (ECP) workflow

> **Terminology note (locked 2026-05-13):** The depot's recurring revenue
> from empties is **EMPTY storage** — billed to the shipping line on a
> monthly statement, accrues whenever an empty is in the depot's custody.
> See `api.gecko-api/docs/modules/tos.md §3` for the LADEN vs EMPTY
> storage model. The `ecp_hires` table below is the **workflow tracker**
> for hire-out events — it tells the storage engine when the empty is
> OUT of custody (so storage stops accruing). The actual money flow for
> empty storage lives on `unit_storage_charges` (flavor=EMPTY,
> variant=STORAGE-AR), not on `ecp_hires`. Per-hire transaction fees
> (handling, condition assessment) are a secondary, separate billing
> line and stay on `ecp_hires` if used.

#### What's missing

Specialised empty-container depot workflow — distinct from full-container terminal ops. Things our current Phase 2 TOS scope doesn't address:

- **EMPTY storage billing** — recurring daily accrual to the shipping line for empties parked at the depot (monthly statement, variant `STORAGE-AR`); the dominant revenue line for ECP operators
- **Hire-out workflow tracking** — empty container leaves depot under hire terms; due back by a specific date; "free park" days before storage starts (per `carrier_hire_terms`)
- **Hire-mode** — one-way (drop at destination depot) vs round-trip (return to issuing depot)
- **Per-carrier free park** — line A allows 7 days free park; line B allows 0; line C allows 14 with seasonal variation
- **Condition at issue vs return** — capture grade at hire-out; re-grade at hire-in; bill repair if downgraded
- **Wash / repair routing** — empty returns dirty → wash; empty returns damaged → M&R; clean and good → back into pool
- **Inter-depot transfers** — pool rebalancing between depot locations

#### Why it matters

SEA has many **depot-only operators** (don't run terminals):
- Linfox (Thailand) — empty depot ops alongside trucking
- Westports Depot Services Sdn Bhd — separate from terminal ops
- NYK ICD at Lat Krabang
- ESCO ICD at Lat Krabang
- ICD Logistics (Indonesia)

ContainerChain's ECP module is their **#2 product** behind VBS. Built for exactly this market.

#### Proposed extensions

**Master DB additions (Phase 1.5 — small):**

```sql
-- In gecko_master_<tenant>
CREATE TABLE dbo.carrier_hire_terms (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  carrier_party_id  UNIQUEIDENTIFIER NOT NULL,    -- → parties.id (line as carrier)

  hire_mode         VARCHAR(20)      NOT NULL,    -- 'ONE_WAY' | 'ROUND_TRIP'
  free_time_days    SMALLINT         NOT NULL,
  daily_rate_after_free DECIMAL(19,4) NOT NULL,
  rate_currency     CHAR(3)          NOT NULL,

  -- Seasonal override (peak shipping vs slack season)
  peak_season_start DATE             NULL,
  peak_season_end   DATE             NULL,
  peak_daily_rate   DECIMAL(19,4)    NULL,

  effective_from    DATE             NOT NULL,
  effective_to      DATE             NULL,
  is_active         BIT              NOT NULL DEFAULT 1,
  -- audit cols
);

CREATE TABLE dbo.depot_locations (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,
  depot_code        VARCHAR(20)      NOT NULL,
  depot_name_en     NVARCHAR(255)    NOT NULL,
  depot_type        VARCHAR(30)      NOT NULL,    -- 'EMPTY_ONLY' | 'FULL_EMPTY' | 'CFS_DEPOT'
  branch_id         UNIQUEIDENTIFIER NULL,
  -- standard address, geo fields
);
```

**TOS DB additions (Phase 2):**

```sql
-- In gecko_tos_<tenant>
CREATE TABLE dbo.ecp_hires (
  id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id           UNIQUEIDENTIFIER NOT NULL,

  -- The container being hired out
  container_no        VARCHAR(11)      NOT NULL,
  master_container_id UNIQUEIDENTIFIER NOT NULL,    -- → master.containers.id (when we add registry)

  -- Parties
  carrier_party_id    UNIQUEIDENTIFIER NOT NULL,    -- Line offering the hire
  hire_to_party_id    UNIQUEIDENTIFIER NOT NULL,    -- Customer / trucker hiring it
  origin_depot_id     UNIQUEIDENTIFIER NOT NULL,    -- → master.depot_locations
  destination_depot_id UNIQUEIDENTIFIER NULL,       -- For one-way; null for round-trip

  -- Hire terms snapshot from carrier_hire_terms at hire-out.
  -- NOTE: these fields drive when EMPTY storage accrual STOPS (clock pauses
  -- while the empty is in the customer's custody, not the depot's). The
  -- actual money rows live in tos.dbo.unit_storage_charges, not here.
  hire_mode           VARCHAR(20)      NOT NULL,
  free_time_days      SMALLINT         NOT NULL,
  daily_rate_after_free DECIMAL(19,4)  NOT NULL,
  rate_currency       CHAR(3)          NOT NULL,

  -- Lifecycle
  hired_out_at        DATETIMEOFFSET(3) NOT NULL,
  due_back_at         DATETIMEOFFSET(3) NOT NULL,
  returned_at         DATETIMEOFFSET(3) NULL,
  return_depot_id     UNIQUEIDENTIFIER NULL,
  status              VARCHAR(20)      NOT NULL,    -- 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'LOST'

  -- Condition tracking
  condition_at_issue  VARCHAR(10)      NOT NULL,    -- → master.container_conditions.code
  condition_at_return VARCHAR(10)      NULL,
  requires_repair_on_return BIT        NOT NULL DEFAULT 0,
  repair_work_order_id UNIQUEIDENTIFIER NULL,       -- → mnr.work_orders.id (cross-DB)

  -- Charges accrued — handling / hire transaction fees ONLY (if tenant
  -- charges per hire). Recurring EMPTY storage charges live separately
  -- on tos.dbo.unit_storage_charges (variant STORAGE-AR, monthly cycle).
  handling_fee_amount DECIMAL(19,4)    NULL,
  handling_fee_currency CHAR(3)        NULL,
  invoice_id          UNIQUEIDENTIFIER NULL,        -- → tos.invoices.id when billed

  -- audit cols + RLS
);
```

**New movements** to add to `master.movements`:
- `EMPTY_HIRE_OUT` — empty container released under hire terms
- `EMPTY_HIRE_RETURN` — empty container returned to depot
- `EMPTY_INTER_DEPOT_OUT` / `EMPTY_INTER_DEPOT_IN` — pool rebalancing

**Workflow events:**
- `ecp.hire_out` → creates ecp_hires row; emits `tos.unit.empty_hired_out`; pauses EMPTY storage accrual on `unit_storage_charges` (empty leaves depot custody)
- `ecp.hire_return` → assesses condition; routes to wash/M&R if needed; closes ecp_hires; resumes EMPTY storage accrual on the returned empty
- `ecp.overdue` (scheduled job) → flags hires past due_back_at; notifies line; optionally triggers premium daily rate
- `ecp.condition_downgrade` → triggers M&R work order; bills repair to line

#### Acceptance criteria

- Empty container hire-out captures all required terms (mode, free time, rate, due date)
- EMPTY storage accrual on `unit_storage_charges` (variant STORAGE-AR) pauses for the duration the empty is hired out, resumes on return
- Per-line free-park days (on `carrier_hire_terms`) delay storage accrual on first gate-in; seasonal override applies
- Overdue detection runs nightly; notifications sent to line agent + ops
- Condition-at-return triggers M&R if grade dropped
- Inter-depot transfers update pool counts at both ends atomically
- Monthly statement to each carrier shows storage days + handling fees per container

---

### Gap 3 — Container release coordination (multi-criteria check)

#### What's missing

When a trucker arrives to collect a container, the gate clerk currently has to **manually verify several things** across multiple screens:
1. Charges paid (or credit approved)
2. Customs cleared
3. Required documents on file (DO, OBL, customs declaration)
4. No active holds
5. Container actually in yard and not loaded

Our current schema has `holds` table (binary block). We don't have a unified "release readiness" view.

#### Why it matters

ContainerChain's killer feature here is **the single traffic-light view**. Gate clerk types container number, sees green/amber/red with reasons. Decision in 2 seconds, not 2 minutes. Reduces gate dwell time per truck dramatically.

This becomes critical at high-volume gates (LCB peak hour: 8 trucks/minute through one lane).

#### Proposed design — `release_readiness` projection in TOS Phase 2

This is a **read-side projection** (denormalised view) that's kept up-to-date by event subscribers. Not a master entity.

```sql
-- In gecko_tos_<tenant>
CREATE TABLE dbo.release_readiness (
  container_no             VARCHAR(11)      NOT NULL,
  tenant_id                UNIQUEIDENTIFIER NOT NULL,

  -- Latest values from each criterion
  charges_paid             BIT              NOT NULL,
  charges_outstanding      DECIMAL(19,4)    NULL,
  charges_currency         CHAR(3)          NULL,
  charges_credit_approved  BIT              NOT NULL,    -- Customer on credit terms

  customs_cleared          BIT              NOT NULL,
  customs_last_status      VARCHAR(50)      NULL,        -- From CUSCAR/CUSREP events
  customs_message_ref      VARCHAR(50)      NULL,

  documents_complete       BIT              NOT NULL,
  documents_missing        NVARCHAR(500)    NULL,        -- Comma-separated codes

  active_holds_count       SMALLINT         NOT NULL,
  active_hold_codes        NVARCHAR(200)    NULL,        -- Comma-separated codes

  container_in_yard        BIT              NOT NULL,
  container_yard_position  VARCHAR(50)      NULL,

  -- Derived overall status
  is_ready_for_release     BIT              NOT NULL,    -- AND of all the BITs above
  not_ready_reasons        NVARCHAR(500)    NULL,        -- Human-readable concatenation
  traffic_light            VARCHAR(10)      NOT NULL,    -- 'GREEN' | 'AMBER' | 'RED'

  last_evaluated_at        DATETIMEOFFSET(3) NOT NULL,

  PRIMARY KEY (tenant_id, container_no)
);

CREATE INDEX ix_release_readiness_status ON dbo.release_readiness
  (tenant_id, traffic_light, last_evaluated_at);
```

**Event subscribers that update this projection** (in `Gecko.Worker`):

| Source event | Update |
|--------------|--------|
| `tos.charge.invoiced` / `tos.payment.received` | Recompute `charges_paid`, `charges_outstanding` |
| `edi.cuscar.acknowledged` | Update `customs_cleared`, `customs_last_status` |
| `tos.document.uploaded` | Recompute `documents_complete`, `documents_missing` |
| `tos.hold.applied` / `tos.hold.released` | Recompute `active_holds_count`, `active_hold_codes` |
| `tos.unit.gated_in` / `tos.unit.gated_out` / `tos.unit.loaded` | Update `container_in_yard`, `container_yard_position` |

After each update, recompute `is_ready_for_release`, `not_ready_reasons`, `traffic_light`.

**Gate UI integration:** When trucker arrives, gate clerk scans container number. UI queries `release_readiness` table. Result returned in < 50ms. Shows:
- 🟢 Green: "Ready for release" — proceed with EIR-Out
- 🟡 Amber: "Ready with conditions: customer on credit, $5,400 outstanding"
- 🔴 Red: "Cannot release: customs hold (CUSTOMS-001), document missing (DO)"

#### Acceptance criteria

- Release readiness available in < 100ms for any container in yard
- Updates within 5 seconds of any contributing event
- "Not ready" message lists *specific* reasons (not just "blocked")
- Gate UI shows traffic-light at moment of scan
- Audit log captures every release decision with reasons

---

### Gap 4 — Notify-Party automation

#### What's missing

ContainerChain has mature trucker/consignee/line-agent notification flows:
- Container ready for pickup → SMS trucker
- Booking confirmed → email + SMS
- Slot 1 hour away → reminder SMS
- Hold applied/released → email line agent
- Customs cleared → email + SMS consignee
- Charge invoiced → email customer accounts

We have a `Notifications` service planned in Phase 1 (Platform DB), but the **template catalog and routing rules** aren't designed yet.

#### Why it matters

Eliminates phone calls between depot and trucker. **SEA reality:** SMS is still primary channel for trucker comms in Thailand, Vietnam, Indonesia. WhatsApp / LINE for trucking-company-to-depot. Email for invoicing.

#### Proposed extension to Platform Notifications service

Already partially designed in ARCHITECTURE.md §3 (Platform.Notifications). What's missing:

**1. Notification templates table** (Platform DB, system-wide):

```sql
-- In gecko_platform
CREATE TABLE platform.notification_templates (
  id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  template_code       VARCHAR(50)      NOT NULL,    -- 'container.ready_for_pickup'
  channel             VARCHAR(20)      NOT NULL,    -- 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'WHATSAPP'
  locale              VARCHAR(10)      NOT NULL,    -- 'en' | 'th' | 'id' | 'vi' | 'ms'
  subject_template    NVARCHAR(500)    NULL,        -- For email
  body_template       NVARCHAR(MAX)    NOT NULL,    -- Mustache / Handlebars syntax
  required_variables  NVARCHAR(500)    NOT NULL,    -- Comma-separated: 'container_no,trucker_name'
  is_active           BIT              NOT NULL DEFAULT 1,
  -- audit cols
);
```

**2. Subscription routing rules** (per tenant):

```sql
-- In gecko_platform
CREATE TABLE platform.notification_subscriptions (
  id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  tenant_id         UNIQUEIDENTIFIER NOT NULL,

  event_type        VARCHAR(100)     NOT NULL,    -- 'tos.container.released_for_pickup'
  subscriber_role   VARCHAR(50)      NOT NULL,    -- 'TRUCKER' | 'CONSIGNEE' | 'LINE_AGENT' | 'CUSTOMER'
  channels          VARCHAR(100)     NOT NULL,    -- 'EMAIL,SMS' or 'SMS' or 'WHATSAPP,SMS'
  template_code     VARCHAR(50)      NOT NULL,    -- → notification_templates

  -- Throttling
  cooldown_minutes  INT              NULL,        -- Don't repeat-fire within N minutes
  max_per_day       INT              NULL,        -- Daily cap per recipient

  is_active         BIT              NOT NULL DEFAULT 1,
);
```

**3. SMS gateway integration** — abstraction layer in `Platform.Notifications`:

```csharp
public interface ISmsGateway {
    Task<SmsResult> SendAsync(string toPhone, string body, string countryCode);
}

// Implementations:
public class TwilioSmsGateway : ISmsGateway { ... }      // Global, default fallback
public class AisSmsGateway : ISmsGateway { ... }         // Thailand
public class MaxisSmsGateway : ISmsGateway { ... }       // Malaysia
public class SmartfrenSmsGateway : ISmsGateway { ... }   // Indonesia
public class ViettelSmsGateway : ISmsGateway { ... }     // Vietnam

// Routing: tenant config picks gateway by recipient country, fallback to Twilio.
```

**4. Notification audit** — every notification sent / failed / opened (for email) → logged to `gecko_audit` for compliance.

#### Acceptance criteria

- Tenant can configure which events trigger notifications and to whom
- Multi-channel send (SMS + email simultaneously for a single event)
- Per-locale templates resolve correctly
- SMS gateway routes by recipient country
- Throttling prevents spam (no duplicate SMS within cooldown)
- Audit trail per notification (sent_at, delivered_at, failed_reason)

---

## 3. Roadmap integration

| Phase | Item | What's added |
|-------|------|--------------|
| **Phase 1** (extend) | Platform.Notifications | Template catalog + subscription rules + SMS gateway abstraction (designs ready in this doc) |
| **Phase 1.5** | Master DB additions | `carrier_hire_terms`, `depot_locations` tables (small, can roll in with Identity DB or shortly after) |
| **Phase 2** (extend TOS) | TOS DB additions | `release_readiness` projection + event subscribers; new movements `EMPTY_HIRE_OUT` / `EMPTY_HIRE_RETURN` |
| **Phase 2** (extend TOS) | ECP workflow | `ecp_hires` table + lifecycle events |
| **Phase 4.5 (NEW)** | **Gate Appointments (VBS)** | Full new module: `gecko_gate_appts_<tenant>` DB with all 6 tables; trucker self-service portal; SMS integration; ops UI |

**Why Phase 4.5 (between EDI and Trucking):**
- Needs EDI Hub running (for COPARN-derived expected arrivals)
- Needs notifications service operational (Phase 1 extension)
- Pre-dates full Trucking module — VBS can sell standalone to depot operators who don't subscribe to Trucking

**Sellable bundles:**
- **Depot Lite Plus**: Master + TOS-light + Gate Appointments — for ECP operators
- **Terminal Pro**: Master + TOS + EDI + Gate Appointments — for full terminal operators
- **VBS-only**: Master + Gate Appointments — for terminals using NAVIS for TOS but Gecko for VBS
- **Full Stack**: All modules

---

## 4. Open questions for future review

These do not block schema design but should be answered before phase plans are finalised:

1. **Self-service trucker portal authentication** — OTP via SMS, or username/password? My lean: OTP for casual truckers, username/password for corporate transport companies.

2. **Slot cancellation policy** — Free cancellation up to N hours before? Penalty model? Hard-block after a threshold?

3. **No-show penalty enforcement** — Charge directly? Block future bookings? Reduce trucker reliability score? Phase 5+ ML model factoring no-show history?

4. **Inter-depot transfers — accounting treatment** — Empty going from Depot A (line A's hub) to Depot B (line A's spoke) — same line's containers, no charge. Empty going across lines for pool sharing — chargeable. How is this modelled?

5. **SMS gateway provider selection** — Twilio for global is straightforward, but Thai operators (AIS, dtac) sometimes have better delivery rates for local numbers. Per-country routing strategy?

6. **WhatsApp Business API integration** — popular in SEA for trucker comms but requires Facebook Business verification, message templates pre-approved. Phase 5+?

---

## 5. Strategic note — what we're NOT trying to copy

Worth noting upfront, to keep scope honest:

- We are **NOT** building a competing trucking marketplace (matchback / load board) — that's a different business model (Convoy, Loadsmart in the US). We stay terminal-side.
- We are **NOT** building gate biometric ID / RFID gate automation — that's hardware integration territory (PIDS, OCR, RFID readers). We design clean APIs for those systems to call into our VBS / EIR.
- We are **NOT** building demurrage / detention auto-calculation as a standalone product — that's billing-module work in Phase 3.

These are explicit non-goals to keep Phase 4.5 scope tight.

---

## 6. Update history

| Date | Author | Change |
|------|--------|--------|
| 2026-05-13 | Founding architect | Initial — 4 gaps identified post-ContainerChain analysis |
