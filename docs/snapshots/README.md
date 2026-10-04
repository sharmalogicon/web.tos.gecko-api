# Snapshots

Working versions kept before a change throws them away. They are `.tsx` on purpose
but live OUTSIDE `src/`, so Next.js never routes them and they cost nothing at build
time — they are here to be read, diffed, or copied back.

| file | what it is |
|---|---|
| `bookings-new.wizard-2026-10-04.tsx` | `/bookings/new` as a 4-step wizard: identity → Voyage & Ports → Containers → Cargo & Docs, each step saving against a booking created at step 1. Replaced on 2026-10-04 by the June shape (identity only on this page; the other three became tabs on the booking). Keep until the tabbed version has run a week. |
| `bookings-new.preJune-2026-10-04.tsx` | `/bookings/new` immediately before the June rebuild. Same wizard as above plus the Vector Voyage/Other-Info panels. |
| `booking-detail.bound-2026-10-04.tsx` | `/bookings/[id]` as it stood BOUND and working against Gecko.Api: header editor, requirement editor, the §16 container entry grid, box edit dialog, cancel/close. **This is the one to mine when the June rebuild gets bound** — every API call the booking page needs is in here, already correct. |
