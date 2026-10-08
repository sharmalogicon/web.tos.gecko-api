# A booked box can now be changed to another type — DONE

**Built 2026-10-08.** `UpdateContainerLineRequest` gained `equipmentTypeCode`,
verified against the running API, and the screen sends it.

This file asked for `lineNo` on the PUT or a `/move` endpoint. The answer was
better than either: the type itself is the field, and the API works out the
lines.

## What the screen does now

`PUT /api/tos/bookings/{id}/containers/{bookingContainerId}` carries
`equipmentTypeCode: "20RF"` with the rest of the box. The same type as before
changes nothing; a different one moves the box to the booking's line of that
type, adding a line where there is none and dropping the old one when its last
place goes.

After a 200 the whole booking is re-read — the requirement lines and the
booking's `rowVersion` moved with the box, so refreshing only the row would
leave the next save holding a stale version.

A **400 naming `equipmentTypeCode`** (already through the gate, already paid at
the window, unknown type) is shown at the Type — Size control rather than in the
list above Container No, because that is where the change was made.

## Removed

The client-side block that refused the edit outright — *"This box is on the
booking's 20GP line and cannot be changed to 20RF here"* — is gone. It existed
only because the PUT used to answer 200 and silently drop the change, which
looked to a clerk like a save that worked.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
