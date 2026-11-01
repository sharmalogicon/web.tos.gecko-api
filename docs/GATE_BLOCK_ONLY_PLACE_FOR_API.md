# A block is enough: the gate does not always know the slot — 2026-11-01

**Screen:** `web.tos` → Gate In → *Where it goes*.
**Endpoints:** `POST /api/tos/gate/trips` (the big Save) and
`POST /api/tos/gate/transactions`, whose row carries `yardId`, `yardSlotId`,
`positionText`, `slotOverrideReason` — **and no block.**

## The rule, from the owner (2026-11-01)

> "Just pick the block should be enough, the Location is not mandatory at all.
> Sometimes the gate user doesn't know where the exact location of the
> container would be."

A clerk with a truck at the barrier knows the box is going to the empty block.
Which bay, which row, which tier is the yard's business and is decided when the
machine gets there. Demanding it at the gate produces one of two things: a
queue, or a slot somebody typed to get the barrier open — and a yard map that
says a box is where it is not.

## What the screen does now (shipped with this doc)

- On a mapped yard, **nothing about the place is required**: not a slot, not a
  position. A row saves with neither.
- **Picking a block fills the location with the block's code** (`A`, `EMPTY`,
  `FULL`). That alone is a complete answer, and it travels as
  `positionText: "A"`.
- Clicking a stack still sets `yardSlotId` and replaces the text with the slot
  label; keying a slot label still works. Both are refinements, not demands.

## What is asked for

**1. Accept a block as a place, and keep it as one.**

The honest record for most gate-ins is *"it went to block A, exact slot not yet
known"*. Today there is nowhere to put that: `yardSlotId` is a slot, and
`positionText` at a mapped yard is read as a slot label. Either

```jsonc
{ "yardId": "…", "yardBlockId": "…", "yardSlotId": null, "positionText": null }
```

a `yardBlockId` on the gate row (preferred — it is a real foreign key, so the
yard map can count and colour by it), **or** a `positionText` that names a block
of that yard is accepted as "somewhere in this block" rather than refused.

**2. Confirm a bare block code does not 400 today.** Since 2026-11-01 the API
reads `positionText` at a slotted yard as a slot label and answers

> `No slot "…" in this yard. Key it as block-row-bay-tier (e.g. A-B-03-2) …`

A clerk who picks block A sends `positionText: "A"`. If that is refused, the
screen's new behaviour is refused with it, and the gate is back to demanding a
bay and a tier. **This is the one answer needed before the rest matters.**

**3. The position must not be mandatory at a mapped yard.** The order type's
own tick (`requiresPosition` on the step) should not hold a gate-in at a depot
whose yard is mapped — or, if it must stay, the tick should be settable per
depot so GECKO can turn it off. Say which, and the screen will follow.

## What the yard then shows

A box with a block and no slot is in the yard and not on a stack. The map can
draw it in the block's tally without a bay; the container master's Location
reads `Block A`; the put-away job that follows gives it its slot. None of that
needs anything from this side beyond the field itself.

## Questions

1. Does `positionText: "A"` (a block code) pass validation at a slotted yard
   today — accepted, or 400 as "no slot"?
2. Is a `yardBlockId` on the gate row feasible, or is `positionText` the
   intended home for an imprecise place?
3. If a block is stored without a slot, does the yard map's occupancy count it?
   A box nobody can see on the map is worse than a box with no block.
4. Does the stacking-rule check (BLOCK_TYPE, SIZE_BLOCK, RESERVED) still run
   for a block-only placement? It should — the block is exactly what those
   rules are about, and catching "an empty box into a FULL block" at the gate
   is the whole point of them.
