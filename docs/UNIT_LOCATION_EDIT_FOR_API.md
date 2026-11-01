# Editing a box's location from the container master — 2026-11-01

**Screen:** `web.tos` → Units → Container master (`/units/unit-inquiry`).
**Endpoints:** `GET /api/tos/yard/locate`, `POST /api/tos/yard/moves`.

**No new endpoint is asked for.** This is a note of what the screen now does,
what it leans on, and four things only the API can answer.

## What changed on the screen

The fact strip under the container header read:

```
DEPOT · YARD    POSITION   FULL / EMPTY   IN YARD
KTC · YARD 1    ก          EMPTY          3 days (since 29-10-2026 14:54)
```

**POSITION is now LOCATION, and it carries an Edit.** The only way to correct a
box keyed into the wrong spot used to be the **Move** button in the page
header — a clerk reading the strip had no reason to look up there. Edit opens
the same Move dialog, one click from the value it changes.

- Box **in a yard at the depot in the header** → the location, and Edit is live.
- Box **gone out** → **N/A**, Edit disabled ("the box is not in a yard").
- Box **in another depot's yard** → the location is shown, Edit disabled
  ("switch the depot above to move it").
- Box in a yard but **no row from `/yard/locate`** → Edit disabled ("where this
  box stands is not on the yard map yet"). See question 1 — this case should
  not exist for an AREA depot, and if it does the feature is dead at KORAKIT.

The dialog now **opens on the depot's own `yardLocationMode`** (AREA for
KORAKIT) instead of always on the slot picker, and **pre-fills the area box
with the box's current position text**, so correcting `ก` to `ข` is an edit of
one character.

## What it sends

Unchanged from the Move button — the same `POST /api/tos/yard/moves`:

```jsonc
// an AREA depot (KORAKIT): the position text is the location
{ "branchId": "…", "containerNo": "MRKU2345678",
  "toYardId": "…", "toPositionText": "ข",
  "reason": "keyed in wrong at gate-in", "movedAt": "2026-11-01T16:20:00+07:00" }

// a mapped yard: the slot is the location
{ "branchId": "…", "containerNo": "MRKU2345678",
  "toYardSlotId": "…", "reason": "restow for line pick-up", "movedAt": "…" }
```

The stay keeps its one row; the move is journalled as `SHIFT`, from → to, with
the reason in its remarks, and the container master's Activity log shows it.

---

## 1. Does `/yard/locate` answer for an AREA-located box? — the one that matters

KORAKIT has **no yard map and no slots**: a box's location is the area code the
gate clerk typed (`ก`), held as `positionText` with **no `yardSlotId`**.

The screen reads `GET /api/tos/yard/locate?containerNo=…` to get the
`YardLocation` the Move dialog needs. **Does that read return a row for a box
located by area only?** If it answers only for boxes standing in a slot, then
at KORAKIT every box falls into the "not on the yard map yet" branch, Edit is
dead on every row, and this whole change does nothing at the one depot that
asked for it.

If it does not answer today, what is wanted is a row with `yardSlotId`,
`yardBlockId`, `rowLabel`, `bayNumber`, `tierNumber` all null, `positionText`
set, and `boxesOnTop` empty — everything else as it is now.

## 2. Who may change a location

The owner's call (2026-11-01): **anyone may edit it for now.** So the web app
shows the Edit to every user — it no longer asks for `tos.yard.manage` before
rendering it, only whether there is a location to change at all.

`POST /yard/moves` still holds `tos.yard.manage` at the depot, so a clerk
without it will meet a **403 inside the dialog**, after filling it in.

Which way should this close?

- **(a)** The API relaxes it for an area-to-area correction at the user's own
  depot, and keeps `tos.yard.manage` for a slot move. Say what the new rule is
  and the web app will match it.
- **(b)** The API keeps `tos.yard.manage` as it is, and the owner's "anyone"
  means "everyone at KORAKIT already holds it". Confirm that, and the web app
  can go back to hiding the button — a 403 after typing is worse than no button.

The web app will not guess: tell us which, and the strip follows.

## 3. Moving a box to where it already is

A clerk opens Edit, reads the area, changes nothing and presses **Move box**.
What answers — a 400 on `toPositionText` ("the box is already there"), or a
200 with a `SHIFT` journal entry that records a move that never happened?

A 400 is the right answer and the dialog will print the message verbatim; it
just needs to exist, and to name the field.

## 4. A correction is not a move — a flag, not a request

Everything here journals as `SHIFT`, which reads as *the box was carried from
one place to another*. Half of these edits are the other thing: **the box never
moved, the clerk keyed the wrong spot at the gate.**

Not asking for an endpoint now — the owner chose the existing move on purpose.
Noting it so it is a decision rather than an accident: if the depot later wants
its yard history to tell real moves from typos, the cheapest route is a
convention on `reason` or a `kind` on the move, and that is easier to add
before KORAKIT's history fills up with corrections that read as movements.

## 5. Small ones

- `movedAt`: a correction is always keyed **now**, and the dialog defaults to
  now. Confirm the only refusals are "in the future" and "before the box's own
  last move" (both already handled on the screen).
- `locate` for a box in **another depot's** yard: does it answer with that
  depot's row, or 404? The screen shows the location when it gets a row and
  disables Edit when `branchId` differs from the header's depot. Either answer
  works; we only need to know which to expect.
