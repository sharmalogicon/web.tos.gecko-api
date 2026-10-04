# Ask: the ISO 6346 check digit should warn, not refuse

Owner's call (2026-10-04): **do not enforce the container check digit yet — warn only.**

## What happens today

`POST /api/tos/bookings/{id}/containers/batch` refuses the row:

```
"MSCU1234565"  ->  REJECTED
   { "containerNo": ["MSCU1234565 fails the ISO 6346 check digit (expected 6).
                      Check the number — a misread box is a box released to the wrong truck."] }
```
Same on `PUT …/containers/{id}`. Tested on the local API, 2026-10-04.

The message is good and the rule is right in principle. The problem is that it is a
HARD STOP during data entry: a depot taking numbers off a release note, a scanner dump
or a phone call gets numbers that are wrong often enough, and the clerk cannot put the
booking in at all until someone resolves it. The box is not at the gate yet; nothing is
being released to anybody.

## Asked for

Accept a container number whose **check digit** is wrong, and report it as a **warning**
on that row instead of rejecting it:

```
outcome: "CREATED"
issues / errors: [{ severity: "WARNING", code: "CHECK_DIGIT",
                    column: "containerNo",
                    message: "MSCU1234565 fails the ISO 6346 check digit (expected 6)." }]
```
The UI already renders per-row field messages, so a warning shape we can tell apart from
an error is all that is needed. If the batch row shape has no severity, say what to look
for and we will match it.

**Keep refusing** a number that is not a container number at all — wrong length, wrong
letters, no U/J/Z — because that is a typo, not a mis-keyed digit. Only the CHECK DIGIT
should soften.

## Please confirm

1. Does the **gate** also enforce it? If a box with a bad check digit can be booked but
   not gated in, the clerk has only moved the wall. Our reading is that the gate should
   still warn, and the number gets corrected when the box physically arrives.
2. Is this a **tenant setting** rather than a global change? "Warn only" is right for
   KORAKIT during migration; a depot taking EDI from lines may want it strict.

## UI state

Nothing is blocked. The UI does no check-digit maths of its own and shows whatever the
API says against the field, so it will show a warning the moment the API sends one.
