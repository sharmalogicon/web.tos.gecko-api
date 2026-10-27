# The gate's mandatory fields belong to the ORDER TYPE — 2026-10-22

KORAKIT does not want a seal number or a cargo weight demanded on a full
gate-in. The next tenant may. **That is not a code decision, and it is already
modelled** — so neither side should be hardcoding it.

```sql
gecko_master.commercial.order_type_movement
  tenant_id, order_type_id, movement_id, sequence_no,
  check_seal_no        bit
  check_gross_weight   bit
  seal_must_match      bit
  require_vessel_voyage, allow_damaged_release, skip_edi, ...
```

The depot already edits these on the **Rules panel of the order-type master**
("Seal — gate clerk must capture / match the seal number", "Weight — gross
weight required and checked against max gross"), and the API already delivers
them on every preflight as `GateStep.checkSealNo` / `checkGrossWeight`.

---

## 1. Done on the web side (2026-10-22)

`requiredGateFields()` in `src/lib/api/tos.ts` used to hardcode *"a full
drop-off needs a seal and a cargo weight"*. It now reads the step:

```ts
if (trip === "PICK_UP_CONT") return [];
const required: string[] = [];
if (step?.checkSealNo)      required.push("seals");
if (step?.checkGrossWeight) required.push("cargoWeightKg");
if (fullEmpty === "FULL" && isExportBooking) required.push("customsPermitNo");
return required;
```

Verified by running the real function:

```
both rules UNTICKED (KORAKIT)
  full drop-off, local booking   -> (nothing)
  full drop-off, EXPORT booking  -> customsPermitNo
  empty drop-off                 -> (nothing)
  pick-up                        -> (nothing)
both TICKED
  full drop-off, local booking   -> seals, cargoWeightKg
  full drop-off, EXPORT booking  -> seals, cargoWeightKg, customsPermitNo
one ticked
  seal only                      -> seals
  weight only                    -> cargoWeightKg
no step yet (walk-in, pre-preflight)
  full drop-off                  -> (nothing)
```

One function drives all three gate screens: the red asterisks in `MoveCard`,
the "Still to fill" list and per-row Save in `rowIssues`, the "Seals — at least
one required" heading on `eir-in-sept`, and the "— required" suffixes on
`gate/desk`.

---

## 2. The prompt

> **Make the gate's mandatory fields follow the order type, not the code
> (web.tos ask, 2026-10-22)**
>
> `GateRules.MissingForTrip` hardcodes *"a FULL `DROP_OFF_CONT` must carry
> `cargoWeightKg` and at least one seal."* That is a per-depot policy living in
> code: KORAKIT does not want it, another tenant will, and today the only way
> to change it is to edit and redeploy the API.
>
> **It is already configured.** `commercial.order_type_movement` carries
> `check_seal_no` and `check_gross_weight` per tenant, per order type, per
> movement step. The order-type master edits them and the preflight already
> returns them on `GateStep`. Please have the rule read them:
>
> ```
> step.check_seal_no       == true  ->  require at least one seal
> step.check_gross_weight  == true  ->  require the cargo weight
> either unticked                   ->  do not require it
> ```
>
> where `step` is the SAME movement step the preflight resolved for this move
> — whatever `nextStep` was answered from. Please confirm `MissingForTrip` has
> that step in hand, and say so if it does not: if it would have to resolve the
> plan a second time, we would rather know than have the two disagree.
>
> Five points:
>
> 1. **`tareWeightKg` / `maxGrossWeightKg` stay optional always.** You made
>    them optional earlier today; this ask does not bring them back. If
>    `check_gross_weight` is ticked, require the CARGO weight — gross is
>    derived (`CalculateGrossWeight` = tare + cargo) and the tare is optional,
>    so the cargo weight is the number the clerk actually keys.
> 2. **`customsPermitNo` is NOT part of this.** A full EXPORT box without one
>    is turned away at the port, so it stays required by direction, not by
>    tick. web.tos still asks for it on a full export regardless of the step.
> 3. **The rule applies to the step, not to FULL.** If a tenant ticks Seal on
>    an EMPTY step, the gate should ask for a seal on that empty move. That is
>    the tenant saying so, and web.tos already behaves this way.
> 4. **A walk-in with no step.** Before a movement step is resolved there is no
>    rule to read — please require nothing rather than falling back to the old
>    hardcoded behaviour, so the two sides cannot disagree.
> 5. **`seal_must_match` already depends on `check_seal_no`** (the API refuses
>    the first without the second). Please keep that relationship; nothing
>    changes there.
>
> **One question:** when a seal is NOT required but the box arrives unsealed,
> is that worth a WARNING finding rather than silence? Vector warned and
> carried on for an over-weight box (`ValidateWeight`). If you add one, give it
> a code we can key on (e.g. `NO_SEAL`, severity WARN) and web.tos will show it
> on the row — the EIR then records that the box came in unsealed without
> anything being blocked.
>
> Don't change the UI; web.tos already reads the step.

---

## 3. What KORAKIT has to do (no deploy)

Open **Masters → Order types**, and for each of the four walk-in / gate order
types untick **Seal** and **Weight** on the drop-off steps. That is the whole
change for this depot once the API honours it — and it is the owner's to make,
not a developer's.

Until the API side lands, the two disagree in one direction only: the screen
asks for less than the server does, so a full drop-off with no seal is refused
at Save with a 400 that lands on the field (`ApiError.forField`) rather than
being caught before the POST.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
