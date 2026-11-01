# The printed forms: the user's name on its own line, italic — 2026-11-01

**Who renders this:** Gecko.Api. Every PDF Gecko prints comes from the API
(`/api/.../*.pdf`); `web.tos` only opens them, so this one cannot be changed
from the web side.

**The form:** ใบฝากตู้ — `** DAILY EQUIPMENT DETAIL CONTACT YARD **`, the
cash (เงินสด) deposit slip printed at the gate.

## What is asked for

In the header block, top right:

```
Created By      GECKO Admin          ← today: label and name on one line
Printed Date    31-10-2026 14:13
```

```
Created By
  GECKO Admin                        ← wanted: the NAME on the next line, ITALIC
Printed Date    31-10-2026 14:13
```

So: **the user name always drops to the line below its label, and prints in
italic.** The label keeps its position and its weight; only the value moves and
leans.

**"Always"** — everywhere a person's name is printed on a form, not only this
one. Whatever other forms carry a `Created By`, `Printed By`, `Approved By`,
`Surveyed By` or `Released By`, the name goes under the label in italic, so the
same thing looks the same on every sheet a depot files.

Other values on the form — the agent, the shipper, the booking number, the
plate — are **not** affected: they stay on their label's line as they are.

## Why it is worth doing

These sheets are signed and filed. A name that is set like the rest of the data
reads as another field of the shipment; set apart under its label it reads as
*who issued this*, which is what a dispute actually turns on. Italic is also
how the rest of Gecko writes an aside about a record rather than a fact of it —
the container master's activity log prints its "by GECKO Admin" the same way as
of today.

## Questions

1. Is the name on these forms the user's display name, the same one
   `createdByName` now carries on a gate move? If the form is reading a login
   or an e-mail, it should switch to the display name with this change.
2. Does the header block have the vertical room on every form it appears on, or
   does something below it need to shift down by a line?
3. Is there a shared header partial for the printed forms, or is this per
   template? If it is per template, a list of which ones carry a person's name
   would be useful — the ask covers all of them.
