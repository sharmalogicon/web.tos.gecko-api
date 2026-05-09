# Identity & Auth — Deep Dive

## Users — `Security.Users`

**Row count:** 357 | **Active:** 108 | **Inactive:** 249

### Schema
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| UserID | varchar(25) | No | — | PK, username-based (e.g. "ADMIN", "ANUJIT") |
| UserName | varchar(100) | No | '' | Display name |
| Password | varchar(15) | No | '' | **PLAINTEXT** |
| IsActive | bit | No | 1 | Soft-delete |
| Email | varchar(100) | No | '' | Mostly empty |
| MobileNumber | varchar(10) | No | '' | Mostly empty |
| LogInStatus | bit | No | 0 | Currently logged in flag |
| LastLogInOn | datetime | No | getdate() | Last login timestamp |
| IsICD | bit | No | 0 | Has ICD/TOS module access |
| IsTRUCKING | bit | No | 0 | Has Trucking module access |
| IsEDI | bit | No | 0 | Has EDI module access |
| RoleCode | varchar(20) | No | '' | Single role per user (→ Roles.RoleCode) |
| CreatedBy/On, ModifiedBy/On | — | — | — | Standard audit |

### Password storage

**PLAINTEXT.** Column is `varchar(15)`. Sample values:
- "123", "S3T", "SHIPPING1234", "SALE1234", "SCT888", "2547", "EARTHAP", "WID1988"
- No hashing, no salt, no encryption whatsoever.
- Max length 15 chars — some passwords are as short as 3 chars.

### Role distribution
| RoleCode | Users | Description |
|----------|-------|-------------|
| GateUser | 232 | Gate operations (65%) |
| Sales | 69 | Sales & Marketing (19%) |
| Accounts | 38 | Accounting (11%) |
| SuperUser | 8 | Power user (2%) |
| (empty) | 7 | Unassigned (2%) |
| Administrator | 3 | Full admin (1%) |

### Module access flags
- IsICD + IsTRUCKING + IsEDI = module-level access bits on the user record.
- This is coarse-grained access — only 3 modules toggled.

### Sample (anonymised)
```
UserID    | UserName             | IsActive | RoleCode      | IsICD | IsTRUCKING | IsEDI
ADMIN     | ADMINISTRATOR        | true     | Administrator | true  | true       | false
ANUJIT    | ANUJIT PUENGTO       | true     | Sales         | true  | true       | false
ANAN      | ANAN LEELAPHAN       | true     | GateUser      | true  | false      | false
```

---

## Roles — `Security.Roles`

**Row count:** 5

### All rows
| RoleCode | RoleDescription | IsActive |
|----------|----------------|----------|
| Accounts | Accounts | true |
| Administrator | Administrator | true |
| GateUser | Gate User | true |
| Sales | Sales & Marketing | true |
| SuperUser | Super User | true |

### Observations
- Only 5 roles — very coarse-grained.
- RoleCode is PK (varchar(20)), not numeric.
- Single role per user (Users.RoleCode) — no many-to-many UserRole junction table.

---

## Securables — `Security.Securables`

**Row count:** 44 | **PK:** (SecurableItem, LinkId)

### Schema
| Column | Type | Notes |
|--------|------|-------|
| SecurableItem | varchar(100) | Always "Full Control" |
| LinkId | varchar(50) | Screen/feature identifier |
| Description | varchar(200) | Human-readable name |

### All 44 securables = screen-level permissions
Every row has SecurableItem = "Full Control". The LinkId values represent screens/features:
AgentChargeCode, BookingEntry, BookingInquiry, Branch, CashBill, CFSInquiry, ChargeCode, Company, ContainerMovementInquiry, ContainerStatus, ContainerStatusUpdateCFS, ContaineStatusUpdate, CostSheet, Country, CreditInvoice, CreditNote, Customer, CustomerRate, CYDirect, DebitNote... (44 total)

### Observations
- **Only one permission level** — "Full Control". No read-only, create, edit, delete granularity.
- This is essentially a screen visibility list — can a user see this screen or not.
- Typo in data: "ContaineStatusUpdate" (missing 'r').

---

## User Rights — `Security.UserRights`

**Row count:** 3,583 | **PK:** (UserID, SecurableItem, LinkId)

### Schema
| Column | Type | Notes |
|--------|------|-------|
| UserID | varchar(25) | → Users.UserID |
| SecurableItem | varchar(100) | Always "Full Control" |
| LinkId | varchar(50) | → Securables.LinkId |

### Observations
- **Direct user-to-screen mapping** — no role-based indirection. Each user gets individual screen assignments.
- Despite having Roles, permissions are NOT assigned to roles. They're per-user.
- 3,583 rights / 357 users ≈ 10 screens per user average.
- RoleCode on Users is likely just for display/grouping, not for permission inheritance.

---

## User Sites — `Security.UserSites`

**Row count:** 1,289 | **PK:** (UserID, BranchId, YardCode)

### Schema
| Column | Type | Notes |
|--------|------|-------|
| UserID | varchar(25) | → Users.UserID |
| BranchId | smallint | → Branch.BranchID |
| YardCode | varchar(10) | → Yard.YardCode |

### Observations
- Controls which branch+yard combinations a user can operate in.
- 1,289 assignments / 357 users ≈ 3.6 sites per user average.
- This is the closest thing to "tenant scoping" in the legacy system.

---

## Session / token tables
**None.** No session table, no token table, no refresh token storage. Authentication is stateless WinForms — password checked on login, LogInStatus flag toggled, no session persistence.

## Audit / login-history
**None.** No login attempt log, no role-change history, no password-change history. Only `LastLogInOn` timestamp on the Users table.

---

## Summary Observations

1. **Passwords are PLAINTEXT** in varchar(15). Critical security finding. Migration to Azure AD B2C is essential.
2. **No password hashing, no salt, no MFA** — zero modern auth practices.
3. **Permission model is screen-level only** — "Full Control" on 44 screens. No CRUD granularity.
4. **Roles exist but are decorative** — permissions are assigned directly to users, not through roles.
5. **Module access via bit flags** (IsICD, IsTRUCKING, IsEDI) — coarse-grained, no EMR flag exists.
6. **UserSites provides site scoping** — multi-site but single-tenant.
7. **No customer-portal users** — same Users table for all, no external user concept.
8. **No service accounts** — no distinguishing column for human vs system users.
9. **Soft-delete via IsActive** — 249 of 357 users are inactive (70%).
10. **LogInStatus flag** — suggests single-session enforcement in WinForms client.
