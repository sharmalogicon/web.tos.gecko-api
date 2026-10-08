# A booked box cannot be changed to another type — please make it possible

Found 2026-10-08 while testing on production. KORAKIT is live.

## What a clerk does, and what happens

Open a booking, click a container, change **Size — Type** from `20RF` to `20GP`,
press **Save Container**.

The API answers **200**. Nothing changes. The grid still shows `20RF`, and the
screen said it saved.

## Why

`PUT /api/tos/bookings/{id}/containers/{bookingContainerId}` takes
`UpdateContainerLineRequest`:

```
containerNo, declaredSealNo, customerSealNo, declaredVgmKg, declaredVolumeCbm,
requiredDate, cargoCategoryCode, imdgClass, unNumber, reeferSetTempC,
reeferVentPct, reeferHumidityPct, stowageCode, stowageNo, isPreCool,
handoverMode, remarks, rowVersion
```

There is **no equipment type, no size, and no `lineNo`**. A box's type is the
requirement LINE it sits on, and nothing in this request can move it to a
different line. So the field is editable on screen, the call succeeds, and the
one thing the clerk changed is silently dropped.

## What the screen does today

It refuses, in the clerk's words, rather than reporting a save that did not
happen:

> This box is on the booking's 20RF line and cannot be changed to 20GP here.
> Remove it and add a 20GP box instead.

That is a workaround, not a fix: removing and re-adding loses the box's number,
seals, weights, reefer settings and dates, and on a box that has been through
the gate it is not possible at all.

## Please add one of these

**(a) `lineNo` on `UpdateContainerLineRequest`** — the box moves to that line,
409 if the line does not exist or is full. Smallest change; the UI already knows
the line, and already calls `PUT /requirements` to create or grow one.

**(b) A move endpoint** —
`POST /api/tos/bookings/{id}/containers/{bookingContainerId}/move`
`{ lineNo, rowVersion }`, answering the booking detail like the other container
calls.

Either way the UI is ready: `ensureLineFor()` already creates or widens the
requirement line for whatever type is picked — that is how bulk add works — and
the drawer already computes the target line before saving. It then throws it
away, because there is nowhere to send it.

## Please also confirm the refusals

So the screen can say which it is rather than a generic message:

- a box that has already made a gate move — presumably it cannot move lines at
  all;
- a target line that is already full;
- a type the booking's order type does not allow.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API problems
back to the owner.
