# Reset password — one endpoint, UI already built — 2026-10-10

The login screen's **Forgot password?** now flips the card to a reset form.
It is waiting on one endpoint that does not exist.

## What exists today

The whole auth surface in `Gecko.Identity`:

```
POST /auth/login                  email or user name + password → token
POST /auth/refresh
POST /auth/logout
GET  /auth/me
POST /auth/invitations/preview
POST /auth/invitations/accept     the ONLY thing that sets a password — needs an invitation token
```

Nothing changes a password for an account that is already active.

## The change

> **Prompt for the API:** add **`POST /auth/reset-password`**, anonymous (same
> as `/auth/login`).
>
> ```json
> { "emailOrUserName": "sharma@korakit.co.th", "newPassword": "…" }
> ```
>
> - Applies the tenant's password policy to `newPassword`.
> - Revokes the account's refresh sessions, so other devices are signed out.
> - Clears `password_change_required` (see below).
> - **204** on success.
> - **400** keyed on `newPassword` when the policy refuses it — the screen shows
>   the server's sentence under the field, so word it for a clerk.
> - **401** for an unknown account, worded exactly as a failed login
>   (*"Invalid email, user name or password."*) so nothing leaks about which
>   addresses exist.

## What this endpoint is, stated plainly

It changes an account's password **given only its email or user name**. There is
no current password, no reset token and no email round trip. Anyone who can
reach the login page can set the password of any account whose address they
know.

That is the shape the owner asked for (2026-10-10), recorded here so it is not
implemented by accident and not mistaken later for an oversight. If the API side
wants to narrow it without changing the screen, the options that cost the UI
nothing are: rate-limiting per address, an audit row per reset, or restricting
it to accounts that have never signed in. Anything that needs a second input
from the clerk — a current password, a one-time code — is a UI change, and
worth asking for before it is built.

## While you are in there

`LoginService` can already answer `LoginStatus.PasswordChangeRequired`, and
`AuthEndpoints.cs:103` returns a 403 with `code: "password_change_required"`.
**No screen in Gecko can satisfy that today**, so any user who gets the flag set
is locked out with nowhere to go. `/auth/reset-password` is the natural place to
clear it.

## What the UI already does

`src/app/login/page.tsx` — the card flips in place rather than routing, so the
address the clerk already keyed is carried over. Email, new password, confirm,
one button. The two passwords are matched on the screen because the server never
sees the confirmation; everything else the server refuses is shown in its own
words. On 204 the card reads *"The password for … has been changed. Any other
device signed in as that account has been signed out."*

`resetPassword()` in `src/lib/api/client.ts` is the only caller.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
