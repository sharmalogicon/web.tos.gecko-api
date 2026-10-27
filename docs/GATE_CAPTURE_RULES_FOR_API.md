# What the gate clerk must key — four ticks on the order type, 2026-10-27

The owner asked for four things to stop being the gate screen's decision and
start being the depot's: **Seal, Cargo weight, Yard, Position**.

Two of them (Seal, Cargo weight) already exist **per step** on
`commercial.order_type_movement` — `check_seal_no`, `check_gross_weight` — and
the gate reads them since 22 Oct. Those stay. What is new is a tick on the
**order type itself**, for the common case where a depot wants the thing on
every step and should not have to remember to tick each row.

The other two (Yard, Position) are hard-coded in the gate screen today and
belong to nobody.

---

## 0. ANSWERED — all four shipped, 2026-10-27 (verified live)

Read off a running API, not assumed:

- `OrderTypeRulesItem` carries `requireSeal`, `requireCargoWeight`,
  `requireYard`, `requirePosition`.
- `GateStepResponse` carries the same four, **as the sum** — §2c was taken as
  asked, so the gate never has to load the order type.

A live preflight on the fixture branch returns, for `MTY_IN`:

```
checkSealNo=false  checkGrossWeight=false
requireSeal=false  requireCargoWeight=false  requireYard=false  requirePosition=false
```

**So the behavioural change predicted in §2a has now happened for real.** The
server sends `requirePosition: false`, and because the screen reads `??` and not
`||`, that `false` correctly beats the old hard-coded "a drop-off must have a
position". **Position is no longer mandatory on a drop-off** until somebody
ticks it in Masters — Order types — Rules. That is the depot deciding, which
is the point of the exercise, but it is a visible change for a tester and the
owner should tick what KORAKIT actually wants.

**Still open:** questions 1 (is order-type-wide `require_cargo_weight` the right
grain), 2 (does anything else already write `position_text`) and 3 (audit).

---

## 1. Built on the web side (2026-10-27)

- `OrderTypeRules` carries four more booleans — `requireSeal`,
  `requireCargoWeight`, `requireYard`, `requirePosition`.
- The Rules panel of the order-type master shows them as a block,
  *"What the gate clerk must key"*, beside Walk-in.
- **Position implies Yard.** Ticking Position turns Yard on with it; unticking
  Yard takes Position away. A slot whose yard nobody can name is not a place.
- The gate reads **one combined answer per step** (see §3) and marks the
  asterisks from it. Until the API sends that answer, every reader falls back to
  exactly what the gate does today, so merging this changes nothing.

---

## 2. The prompt

> **Four capture ticks on the order type (web.tos ask, 2026-10-27)**
>
> The gate screen decides for itself today that a drop-off must name a yard
> position, and a depot that does not slot its boxes cannot turn that off.
> Meanwhile Seal and Weight are per-step only, so a depot that wants a seal on
> every step has to tick every row and keep ticking new ones. Please move both
> decisions to the order type.
>
> ### 2a. Database — `gecko_master`
>
> Four columns on **`commercial.order_type`**, beside the five Rules-panel
> columns added for `WALK_IN_ORDERS_PLAN` §2:
>
> ```sql
> ALTER TABLE commercial.order_type
>   ADD require_seal          BIT NOT NULL CONSTRAINT DF_order_type_require_seal          DEFAULT (0),
>       require_cargo_weight  BIT NOT NULL CONSTRAINT DF_order_type_require_cargo_weight  DEFAULT (0),
>       require_yard          BIT NOT NULL CONSTRAINT DF_order_type_require_yard          DEFAULT (0),
>       require_position      BIT NOT NULL CONSTRAINT DF_order_type_require_position      DEFAULT (0);
>
> -- A position sits inside a yard. The UI keeps the pair honest; so should the row.
> ALTER TABLE commercial.order_type
>   ADD CONSTRAINT CK_order_type_position_needs_yard
>   CHECK (require_position = 0 OR require_yard = 1);
> ```
>
> **Default 0 on every existing row is deliberate** — it is exactly what the
> order type did before the columns existed, so nothing moves for any tenant on
> the day this ships. Please do **not** back-fill KORAKIT to match today's
> hard-coded behaviour; the owner will tick what KORAKIT wants in the master.
> (Say so if you disagree — the one visible change is that a KORAKIT drop-off
> stops demanding a Position until somebody ticks it.)
>
> The columns are on the **order type**, not the tenant, because a depot wants a
> position for a laden import and does not care for a repair drop. They are
> tenant-scoped already by the order type's own `tenant_id`.
>
> ### 2b. Contract — `/api/master/order-types`
>
> `OrderTypeRules` gains the same four booleans, read and write, in the object
> that already carries `isWalkIn`, `paymentRule`, `releaseGradeCodes`,
> `ownerMatch` and `maxBoxesPerTruck`. web.tos sends the whole `rules` object or
> leaves it out entirely, as now.
>
> Please refuse `requirePosition: true` with `requireYard: false` as a 400 on
> `rules.requirePosition`, so a direct API caller cannot write the state the
> CHECK constraint forbids.
>
> ### 2c. The gate — **please send the sum, not the parts**
>
> `GateStep` (on the preflight's `nextStep`) gains four more booleans:
>
> ```
> requireSeal          = orderType.require_seal         OR step.check_seal_no
> requireCargoWeight   = orderType.require_cargo_weight OR step.check_gross_weight
> requireYard          = orderType.require_yard
> requirePosition      = orderType.require_position
> ```
>
> **The OR must happen on the server.** The gate never loads the order type —
> it knows only the step the truck is standing at — so if the two sides each
> did half the sum they would drift apart the first time one of them changed.
> Keep `checkSealNo` and `checkGrossWeight` on the step as they are; web.tos
> falls back to them where the new fields are absent, and will keep doing so
> until this ships.
>
> ### 2d. `GateRules.MissingForTrip`
>
> It reads the step's two ticks since 22 Oct. Please make it read the same four
> effective values, so the server refuses exactly what the screen asterisks:
>
> - `requireSeal` → at least one seal, finding `SEAL_REQUIRED`
> - `requireCargoWeight` → `cargoWeightKg` on a drop-off, `grossWeightKg` on a
>   pick-up, finding `WEIGHT_REQUIRED`
> - `requireYard` → `yardId` on a drop-off, finding `YARD_REQUIRED`
> - `requirePosition` → `positionText` on a drop-off, finding `POSITION_REQUIRED`
>
> **Yard and position are asked of a drop-off only.** A pick-up takes a box
> *off* a slot and has none to give; please do not demand them there even when
> the ticks are on.
>
> ### 2e. Questions
>
> 1. **Is `require_cargo_weight` on the order type the right grain?** It is the
>    one that overlaps an existing per-step column most awkwardly — a depot that
>    weighs the laden-in and not the empty-out must leave the order-type tick off
>    and use the step. Say if you would rather we dropped the order-type tick for
>    Seal and Weight and left those per-step only; the owner asked for all four
>    in one block, but the duplication is real and it is your call how the sum is
>    defended.
> 2. **Does anything else already write `position_text`?** If a yard-planning
>    module assigns the slot after the gate, demanding it at the barrier is the
>    wrong place and we should know before a depot ticks it.
> 3. **Audit.** These are gate rules; a change to them changes what the barrier
>    refuses. Is the order-type master already audited, or should this block be?
>
> Don't change the UI; web.tos is ready and falls back to today's behaviour
> until the four fields arrive on `nextStep`.

---

## 3. What the gate does before and after

Run against the real `requiredGateFields`, 2026-10-27:

```
A. BEFORE the API ships the fields (what every tenant gets today)
  drop-off full, local                     -> positionText
  drop-off full, EXPORT                    -> customsPermitNo, positionText
  drop-off empty                           -> positionText
  pick-up                                  -> (nothing)
  no step yet (walk-in, pre-preflight)     -> positionText
  step ticks Seal + Weight                 -> seals, cargoWeightKg, positionText   <- the screenshot

B. AFTER, order type ticks all four
  drop-off full                            -> seals, cargoWeightKg, yardId, positionText
  drop-off empty                           -> seals, cargoWeightKg, yardId, positionText
  drop-off full EXPORT                     -> seals, cargoWeightKg, customsPermitNo, yardId, positionText
  pick-up                                  -> seals, grossWeightKg          (no yard, no position)

C. THE DEPOT SAYS NO - false must not fall back to the old guess
  requirePosition: false on a drop-off     -> (nothing)
```

Row C is the point of the whole exercise: `??` and not `||`, because `false`
from the server is an answer — the depot said no — and must not fall through to
the hard-coded rule it replaced.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
