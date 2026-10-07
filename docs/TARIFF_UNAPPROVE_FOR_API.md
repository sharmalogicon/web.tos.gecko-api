# Tariff unapprove — WITHDRAWN. Do not build it.

**Owner's decision, 2026-10-06: there is no unapprove. An approved price is
changed by a new version, and only by a new version.**

If you were handed the earlier version of this file, or a prompt made from it,
**stop — the request is cancelled.** Nothing is wanted on the API side.

```
POST /api/revenue/tariffs/{scheduleId}/unapprove     NOT WANTED
```

## Why the reversal is the better answer

`revise` already does the honest thing. Unapproving a live price would have had
to answer three questions that have no good answer:

- **What is live while it is a draft again?** The superseded version would have
  to come back into force, so the depot's prices would change twice — down to v1
  and later up to v3 — for one mistake.
- **What about what it already priced?** A charge resolved against v2 was quoted
  to a customer at v2's price. Unapproving rewrites the version behind money
  that has already been taken.
- **What does the audit trail say happened?** "Approved, then not approved"
  describes nothing a depot can act on.

A new version answers all three by never destroying anything: v1 stays exactly
as it was priced, v2 starts the day it is meant to, and the trail reads
forwards.

## What the UI does now

`/tariff/plans/{id}` shows **New version** on an APPROVED schedule, for anyone
holding `revenue.tariff.manage`. It asks for the date the new prices come into
force and calls the endpoint that already exists:

```
POST /api/revenue/tariffs/{scheduleId}/revise
{ "rowVersion": "…", "effectiveFrom": "2026-11-01" }
→ 201  a new DRAFT version, every rate, tier, condition and free-time rule copied
```

The Unapprove button, its reason dialog and its call are **removed** (commit of
2026-10-06). Nothing in the web app calls an unapprove path any more.

## Still open on the API side, and unrelated to this

See `GATE_OPEN_ITEMS_FOR_API.md` — #8 (a gated credit charge never becomes
UNBILLED) and #8a (a gate VAS moved to credit, quoted and then lost) are the two
that matter for the KORAKIT cutover.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API problems
back to the owner.
