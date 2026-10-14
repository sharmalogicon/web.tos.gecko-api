# Container Master — bound · 2026-10-12

**Status: closed.** Every endpoint this document asked for was built the same
day (`UI_PROMPT_CONTAINER_MASTER.md`) and is now bound. Nothing on the page is
disabled any more. Kept as the record of what was asked and what shipped.

`/units/unit-inquiry?no=…` is **Container Master**: Vector's screen of the same
name, bound. It kept the unit-inquiry route so the EIR screens, the yard stock
list and `/gate/container-status` keep working.

---

## What the page is bound to

| Screen section | Endpoint | Permission |
|---|---|---|
| Container information + **remarks** | `GET` / `PUT /api/master/containers/{no}` | `mdm.equipment.manage` |
| **Fix Port Details** | the same `PUT` — `fixedPortCodes: string[]` | " |
| **Correct number** | `POST /api/tos/containers/{no}/renumber` | " |
| **Update status** (condition · grade) | `POST /api/tos/visits/{id}/condition` | `tos.yard.manage` |
| **EMR remarks** | `PUT /api/tos/visits/{id}/emr-remarks` | " |
| Current properties | `GET /api/tos/containers/{no}` → `latest` | `tos.gate.view` |
| Holds | `GET /api/tos/containers/{no}/holds` | `tos.hold.view` |
| Activity log | `…/story` + gate transactions + holds + **`/api/master/containers/{no}/history`** | mixed |

---

## Three things worth knowing if you touch this screen

**1. The registry PUT is a full replace, and `remarks` is in it.**
Leaving `remarks` out of the body does not mean "unchanged" — it means
"cleared". `requestFrom()` in `src/lib/api/container-master.ts` therefore sends
every field on every save, including fields the clerk never opened. The same is
true of `fixedPortCodes`, which is why the ports and the identity fields share
one form and one Save: splitting them would let one land and the other fail on
a stale `rowVersion`.

**2. The condition write is NOT a full replace.** `POST …/condition` leaves out
what it does not change, so the panel sends only the field that actually moved,
plus the reason. It is the one write on the page that works that way.

**3. The renumber is a TOS endpoint, not a master-data one** — `POST
/api/tos/containers/{no}/renumber`, even though it needs `mdm.equipment.manage`.
Master data cannot call TOS; the dependency runs the other way. TOS moves its
own rows, calls the registry last, and rolls everything back if the registry
refuses. After a 200 the old number 404s, so the screen navigates to the new
one.

## Rules the screen enforces before the API has to

- A **damaged** condition puts the depot's damage hold on automatically. The
  panel warns *before* the save, not after: `putsOnDamageHold()` reads the
  condition master (unserviceable **and** the CODECO damage flag) rather than
  hard-coding DM/UC/SC, so a tenant that adds a code gets the warning free. The
  server still decides; this only means nobody is surprised.
- Both visit writes answer **409 once the box has gated out**. The panel is
  read-only on a closed stay and says why, rather than letting a clerk type into
  a dead form.
- A renumber needs a well-formed number that differs from the current one, and a
  reason. The dialog lists what will move before the clerk commits, and what did
  move after.

## Where it lives

- `src/app/units/unit-inquiry/page.tsx` — the page; tabs Overview, Master data,
  Activity log, then Stays / EIRs / Holds / Bookings / Reefer.
- `_components/MasterDataTab.tsx` — the registry row and its fixed ports, one
  form, one Save, plus the created/modified footer.
- `_components/YardStatePanel.tsx` — condition, grade and EMR remarks: the open
  **stay**, not the box.
- `_components/RenumberDialog.tsx` — the renumber, with its warning.
- `_components/ActivityLogTab.tsx` — stay events, EIRs, holds and the registry
  history, merged newest-first.
- `src/lib/api/container-master.ts` — every call above.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
