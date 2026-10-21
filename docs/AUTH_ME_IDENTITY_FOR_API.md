# Who is signed in: a name on /auth/me — 2026-10-21

The account menu names the signed-in person by their **role**, because the role
is the only human-readable thing the session carries. The owner asked for the
user's name (2026-10-21). **It is not available** — nothing in `MeResponse`
holds one.

```csharp
// Gecko.Identity/Endpoints/AuthEndpoints.cs — Me(HttpContext)
return new MeResponse(
    UserId, TenantId, UserType,
    Branches, Modules, Roles, Permissions, BranchPermissions);
```

Every field is read straight off the token's claims. There is no name, no
e-mail, no initials. The UI is not failing to show it; there is nothing to show.

**`UserId` is already there** and web.tos already reads it. The three missing
ones are the first name, the last name and the e-mail.

---

## 1. The prompt

> **Put the signed-in person on /auth/me (web.tos ask, 2026-10-21)**
>
> `GET /auth/me` returns `MeResponse(UserId, TenantId, UserType, Branches,
> Modules, Roles, Permissions, BranchPermissions)` — all read from token claims,
> none of them a name. The account menu therefore reads "GATE CLERK · 1 depot"
> where it should read the person, and the avatar shows the first two letters of
> the role code, so every clerk at a depot shares one avatar.
>
> Please add three fields to `MeResponse`:
>
> | Field | Type | Why |
> |---|---|---|
> | `FirstName` | `string?` | The menu, the settings page and anywhere an action is attributed |
> | `LastName` | `string?` | Initials for the avatar, and a sortable name |
> | `Email` | `string?` | Shown under the name in the menu; it is how a clerk recognises their own account |
>
> `UserId` is **already** on the response and we already read it — nothing to do
> there. Nullable is fine: web.tos falls back to the role when a name is absent,
> so an account with no name set still works.
>
> Either source works; please pick one and say which:
>
> - **From the token.** Add the three as claims in `AccessTokenIssuer` /
>   `ClaimsBuilder` and read them in `Me()` like the rest. No database hit, and
>   `/auth/me` stays a pure claims read — but a rename only shows after the next
>   refresh, and all three ride in every request header.
> - **From the database.** Look the user up in `Me()` by `UserId`. Always
>   current and keeps the token small; costs one read per `/auth/me` call, and
>   `/auth/me` is called once per page load, not per request.
>
> We would take either. The token is the smaller change; the database is the
> more correct one if names are ever edited.
>
> **Two questions about what a tenant actually holds:**
>
> 1. Is the name stored as one `FullName`, or as given/family names? If it is
>    one column, send it as `FirstName` with `LastName` null rather than
>    splitting it — a split on the space is wrong for Thai and for anyone with
>    two family names, and web.tos handles a single value correctly.
> 2. Is there a **Thai name beside the English one**? The depot's own parties
>    carry `nameEn` and `nameLocal`. If users do too, send both (e.g.
>    `FirstNameLocal` / `LastNameLocal`) and the menu will follow the language
>    the clerk picked, the same way it does for party names.
>
> Don't change the UI; web.tos will pick it up.

---

## 2. Fixed on our side already (2026-10-21)

A branch-scoped role claim is emitted as `CODE@branchId`
(`ClaimsBuilder.cs:87`), and the menu was printing it raw:

```
GATE CLERK@1c59e785-33a5-f111-9b0d-00919e4766d5
```

`roleLabel()` in `src/lib/auth/session.tsx` now takes the part before the `@`,
so it reads **GATE CLERK**. Nothing is lost — the branch is in `branches` and
the depot switcher names it. No API change needed for that part.

---

## 3. What the UI already does with it

The three fields are **already on the `Me` interface as optional**
(`src/lib/api/client.ts`) and one function decides what to call someone:

```ts
// src/lib/auth/session.tsx
displayName(user)   // first + last, else email, else the role
initialsOf(user)    // name initials, else the first two letters of the above
```

Every screen that shows a person asks those two rather than reaching into the
fields, so the day the API sends them the menu, the sidebar and the settings
page all change together with no further work:

```
  today                    with the three fields
  GATE CLERK               Somchai Prasert
  GATE CLERK · 1 depot     GATE CLERK · 1 depot
                           somchai@korakit.com
  avatar: "GA"             avatar: "SP"
```

Until then it stays as it is, which is honest about what the session knows.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
