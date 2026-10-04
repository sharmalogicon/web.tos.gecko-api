# Ask: a booked box with no container number yet

Owner's rule (2026-10-04): **the container number is optional on a booking.** A
booking is a promise of N boxes of a type; which actual boxes fill it is often not
known until the trucks arrive. Vector's Booking Entry allows a row with no number,
and the June design's drawer says "leave blank if not yet nominated".

## What happens today

`POST /api/tos/bookings/{id}/containers/batch` refuses it:

```
{"clientLineId":"…","containerNo":null,"lineNo":1}   -> REJECTED
{"clientLineId":"…","containerNo":"",  "lineNo":1}   -> REJECTED
   errors: { "containerNo": ["'' is not a container number (4 letters ending U/J/Z, 7 digits)."] }
```
Both null and empty string are rejected the same way. Tested on the local API,
2026-10-04.

## Asked for

Accept `containerNo: null` (and treat `""` as null) on **both**
`POST …/containers/batch` and `PUT …/containers/{id}`, creating the line against its
requirement line with no box named yet. A number supplied later through the PUT
nominates it.

The format check should still apply to a number that IS given — we are asking for
"absent", not "unchecked".

## Questions we cannot answer from here

1. **Does it count against the line?** A booking asking for 5 x 40HC with 2
   unnominated rows — is that `assigned 2/5` or `0/5`? Our reading is that it should
   count, because the row IS the promise, but the tallies drive "line is full" so you
   should decide.
2. **What does the gate do with it?** A box arrives and matches a booking that has an
   unnominated row for its type — does the gate fill that row, or raise a new one? If
   the former, this is also how a blind gate-in resolves itself.
3. **Is it still unique?** Two unnominated rows on the same line are not duplicates of
   each other; the duplicate check presumably has to skip null numbers.
4. **Can it be unassigned / edited** like any other row, or is a nameless row special?

## UI state

The drawer no longer marks Container No as required, so the screen already matches
the owner's rule. Until the API accepts it, saving a blank one returns the error
above and the clerk sees it in the drawer — wrong, but honest. Nothing else is
blocked on this.
