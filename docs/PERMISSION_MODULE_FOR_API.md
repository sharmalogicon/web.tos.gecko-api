# The eight `admin.*` rights are filed under NOTIFICATION — 7 Nov 2026

**Endpoint:** `GET /api/permissions`.
**Screen:** `web.tos` → Configuration → Roles & Rights, and the New role dialog.

## What the catalogue says

Checked against the running API (`localhost:5100`, 7 Nov 2026): 99 permissions,
and the permission code's own prefix agrees with `moduleCode` for **91 of
them**. The eight exceptions are all of the `admin.*` family:

| permissionCode | displayName | moduleCode |
|---|---|---|
| `admin.apitoken.manage` | Create and revoke API tokens | NOTIFICATION |
| `admin.audit.view` | Read the audit log | NOTIFICATION |
| `admin.billing.manage` | Change plans | NOTIFICATION |
| `admin.billing.view` | View plans, usage and invoices | NOTIFICATION |
| `admin.branch.manage` | Create and edit branches | NOTIFICATION |
| `admin.role.manage` | Create and assign roles | NOTIFICATION |
| `admin.tenant.manage` | Manage tenant settings | NOTIFICATION |
| `admin.user.manage` | Invite, edit and remove users | NOTIFICATION |

The four rights that are genuinely about notifications
(`notification.channel.manage`, `notification.delivery.view`,
`notification.template.edit`, `notification.trigger.manage`) sit in the same
module, correctly.

## Why it matters on screen

The rights matrix groups by module, because 99 checkboxes in one list is not
something anyone can read. Grouping by `moduleCode` as published puts

> **Notifications**
> · Invite, edit and remove users
> · Create and assign roles
> · Manage tenant settings

in front of an administrator who came to find exactly those three. It reads as
a bug in Gecko, and the one person most likely to notice is the tenant owner.

## What the web client does meanwhile (shipped with this doc)

`moduleOf()` in `src/lib/api/admin-users.ts` takes the **code's prefix** as the
module when it is `admin`, and `moduleCode` otherwise. That produces an
"Administration" group and leaves the other 91 rights exactly where the API
puts them.

It is a deliberately narrow correction — one prefix, verified as the only
disagreement in the catalogue — and it lives in one function so it can be
deleted in a single edit.

## The ask

Set `moduleCode` to `ADMIN` for the eight `admin.*` permissions (or introduce
whatever module code tenant administration should have, and say which).

When that lands, `moduleOf()` collapses to `p.moduleCode` and **nothing on
screen moves** — the grouping is already what the fix would produce.

## Questions

1. Is `moduleCode` used anywhere else — licensing, a module-enabled check, a
   seeded role's permission set — such that changing it has an effect beyond
   grouping a list? If it gates whether a tenant sees these rights at all,
   moving them to `ADMIN` needs that module enabled for every tenant that has
   an administrator, which is all of them.
2. Is `ADMIN` an acceptable new module code, or should these rights be filed
   under an existing one?
3. `GET /api/permissions` returns the whole catalogue regardless of the
   tenant's enabled modules — 40 of the 99 are `trucking.*`, which a container
   depot never uses. Should the catalogue be filtered to the tenant's modules?
   The matrix would then show a depot only the rights it can actually grant,
   rather than a long list of trucking rights that do nothing. Say which, and
   the screen will follow — it does not filter today.
