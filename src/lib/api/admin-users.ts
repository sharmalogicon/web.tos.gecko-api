"use client";
/**
 * WHO MAY SIGN IN, AND WHAT THEY MAY DO.
 *
 * The Platform API's own user and role administration — the same endpoints the
 * tenant owner uses to add a clerk, move them between depots, take a right
 * away, or give somebody a new password when they have lost theirs.
 *
 * Two things about this API are worth knowing before reading the screens:
 *
 * 1. `/api/roles` and `/api/permissions` answer a BARE ARRAY, not the paged
 *    envelope every other list uses. So they are read with `useApi<T[]>`, not
 *    `useApiList<T>`, which would unwrap an `items` that is not there and show
 *    an empty screen.
 *
 * 2. The OpenAPI document spells the paging keys `Page`, `PageSize`, `Search`
 *    and `IncludeTotal`, beside lower-case `status` and `branchId`. The casing
 *    does NOT matter — checked against the running API, which answers the same
 *    for `pageSize=1` and `PageSize=1` — so the users list goes through
 *    `useServerList`, the same helper every other register uses, rather than
 *    getting a hand-built query of its own.
 */
import { apiSend } from './client';
import { useApi } from './use-api';
import { useSession } from '../auth/session';

// ── What the reads answer ──────────────────────────────────────────────────

/** A row of `GET /api/users`. `roles` holds role CODES, not display names. */
export interface UserSummary {
  userId: string;
  email: string;
  userName: string | null;
  fullName: string;
  jobTitle: string | null;
  userType: string;
  /** ACTIVE / DISABLED / … — the API's word, shown through `statusLabel()`. */
  status: string;
  isLocked: boolean;
  lastLoginAt: string | null;
  branchCount: number;
  roles: string[];
}

/** One depot a user may work at. */
export interface UserBranch {
  branchId: string;
  branchCode: string;
  displayName: string;
}

/**
 * One grant of a role. `branchId` null means EVERY depot — which is why the
 * grant, not the role, is what gets removed: the same role can be held once
 * for the whole tenant and again for a single depot.
 */
export interface UserRoleGrant {
  userRoleId: string;
  roleId: string;
  roleCode: string;
  branchId: string | null;
  branchCode: string | null;
}

/** `GET /api/users/{id}` — the whole account. */
export interface UserDetail {
  userId: string;
  email: string;
  userName: string | null;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  userType: string;
  status: string;
  defaultBranchId: string | null;
  locale: string | null;
  timezone: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  branches: UserBranch[];
  roles: UserRoleGrant[];
  createdAt: string;
  updatedAt: string;
}

/** A row of `GET /api/roles`. */
export interface RoleSummary {
  roleId: string;
  roleCode: string;
  displayName: string;
  description: string | null;
  /** Gecko's own role: it may be renamed and nothing else. */
  isSystem: boolean;
  isTenantAdmin: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
}

/** `GET /api/roles/{id}` — the summary plus the rights themselves. */
export interface RoleDetail extends Omit<RoleSummary, 'permissionCount' | 'userCount'> {
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/** One right, as the platform defines it. */
export interface PermissionDef {
  permissionCode: string;
  moduleCode: string;
  displayName: string;
  description: string | null;
}

/** A pending invitation — how Gecko adds a user who has an e-mail. */
export interface Invitation {
  invitationId: string;
  email: string;
  fullName: string | null;
  roleId: string;
  roleCode: string;
  branchId: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  resentCount: number;
  createdAt: string;
}

/**
 * What `POST /api/users/{id}/password` answers when it was asked to INVENT a
 * password. The running API publishes no 200 schema for this call, so every
 * field is optional and the screens show the password only if one actually
 * arrives — never a blank box captioned "give this to them".
 */
export interface GeneratedPassword {
  userId?: string;
  email?: string;
  userName?: string | null;
  fullName?: string;
  password?: string;
}

// ── The rights that gate these screens ─────────────────────────────────────

/**
 * Real codes the API enforces, not labels invented for a menu —
 * `GET /api/permissions` publishes both.
 */
export const MANAGE_USERS = 'admin.user.manage';
export const MANAGE_ROLES = 'admin.role.manage';

/** May the signed-in person administer users / roles at all? */
export function useAdminRights(): { users: boolean; roles: boolean } {
  const { can } = useSession();
  return { users: can(MANAGE_USERS), roles: can(MANAGE_ROLES) };
}

// ── Paths ──────────────────────────────────────────────────────────────────

export const USERS_PATH = '/api/users';
export const userPath = (userId: string) => `/api/users/${encodeURIComponent(userId)}`;
export const ROLES_PATH = '/api/roles';
export const PERMISSIONS_PATH = '/api/permissions';
export const INVITATIONS_PATH = '/api/invitations';
export const rolePath = (roleId: string) => `/api/roles/${encodeURIComponent(roleId)}`;

// ── Reads ──────────────────────────────────────────────────────────────────

const NO_ROLES: RoleSummary[] = [];
const NO_PERMISSIONS: PermissionDef[] = [];

/**
 * Every role this tenant has. Read by the users screen as well as the roles
 * one — a user's row carries role CODES, and only this list knows what to
 * call them. Both reads hit the api-cache, so the second one is free.
 */
export function useRoles(enabled = true): { roles: RoleSummary[]; loading: boolean; reload: () => void } {
  const { data, loading, reload } = useApi<RoleSummary[]>(enabled ? ROLES_PATH : null);
  return { roles: data ?? NO_ROLES, loading, reload };
}

/** The whole catalogue of rights, for the matrix. */
export function usePermissions(enabled = true): { permissions: PermissionDef[]; loading: boolean } {
  const { data, loading } = useApi<PermissionDef[]>(enabled ? PERMISSIONS_PATH : null);
  return { permissions: data ?? NO_PERMISSIONS, loading };
}

// ── Writes ─────────────────────────────────────────────────────────────────

export interface ProfileEdit {
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  defaultBranchId?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export const saveProfile = (userId: string, body: ProfileEdit) =>
  apiSend<UserDetail>('PUT', userPath(userId), body);

/** A blank name CLEARS the sign-in id; 409 means somebody else has it. */
export const saveUserName = (userId: string, userName: string) =>
  apiSend<UserDetail>('PUT', `${userPath(userId)}/user-name`, { userName: userName.trim() || null });

export const saveBranches = (userId: string, branchIds: string[]) =>
  apiSend<UserDetail>('PUT', `${userPath(userId)}/branches`, { branchIds });

/** No branch = the role applies at every depot. */
export const addRole = (userId: string, roleId: string, branchId?: string | null) =>
  apiSend<UserDetail>('POST', `${userPath(userId)}/roles`, { roleId, branchId: branchId || null });

export const removeRole = (userId: string, userRoleId: string) =>
  apiSend<UserDetail>('DELETE', `${userPath(userId)}/roles/${encodeURIComponent(userRoleId)}`);

export const setUserActive = (userId: string, active: boolean) =>
  apiSend<UserDetail>('POST', `${userPath(userId)}/${active ? 'enable' : 'disable'}`);

export const unlockUser = (userId: string) =>
  apiSend<UserDetail>('POST', `${userPath(userId)}/unlock`);

export const deleteUser = (userId: string) =>
  apiSend<void>('DELETE', userPath(userId));

/**
 * SET A PASSWORD, or ask the API to invent one.
 *
 * Sending nothing is the "make one for me" case, and the answer carries the
 * password ONCE — it is never readable again, here or anywhere else. Either
 * way the API signs the person out everywhere and clears any lockout, and
 * they sign in with the new password without being asked to change it.
 */
export const resetPassword = (userId: string, pw?: { newPassword: string; confirmPassword: string }) =>
  apiSend<GeneratedPassword>('POST', `${userPath(userId)}/password`, pw ?? {});

export const inviteUser = (body: { email: string; roleId: string; fullName?: string | null; branchId?: string | null }) =>
  apiSend<Invitation>('POST', INVITATIONS_PATH, body);

export const resendInvitation = (invitationId: string) =>
  apiSend<Invitation>('POST', `${INVITATIONS_PATH}/${encodeURIComponent(invitationId)}/resend`);

export const revokeInvitation = (invitationId: string) =>
  apiSend<void>('DELETE', `${INVITATIONS_PATH}/${encodeURIComponent(invitationId)}`);

export const createRole = (body: { roleCode: string; displayName: string; permissions: string[]; description?: string | null }) =>
  apiSend<RoleDetail>('POST', ROLES_PATH, body);

export const saveRole = (roleId: string, body: { displayName: string; isActive: boolean; description?: string | null }) =>
  apiSend<RoleDetail>('PUT', rolePath(roleId), body);

export const saveRolePermissions = (roleId: string, permissions: string[]) =>
  apiSend<RoleDetail>('PUT', `${rolePath(roleId)}/permissions`, { permissions });

export const deleteRole = (roleId: string) =>
  apiSend<void>('DELETE', rolePath(roleId));

// ── Saying it in words ─────────────────────────────────────────────────────

/** ACTIVE → Active. The API shouts; a table should not. */
export function statusLabel(status: string): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export type StatusTone = 'success' | 'neutral' | 'danger';

export function statusTone(status: string): StatusTone {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'DISABLED' || s === 'SUSPENDED' || s === 'DELETED') return 'danger';
  return 'neutral';
}

/**
 * What to call a role on a user's row. The user read gives codes only, so an
 * unknown code is shown AS the code rather than dropped — a right nobody can
 * see is worse than an ugly one.
 */
export function roleLabel(code: string, roles: RoleSummary[]): string {
  return roles.find(r => r.roleCode === code)?.displayName ?? code;
}

/**
 * THE MODULE A RIGHT BELONGS TO.
 *
 * `moduleCode` is the API's grouping and is right for 91 of the 99 rights. The
 * eight `admin.*` ones — including the two that gate these very screens — are
 * filed under NOTIFICATION, so grouping by `moduleCode` alone files "Invite,
 * edit and remove users" under Notification, where no admin would look for it.
 *
 * The permission CODE's own prefix is the honest answer and agrees with
 * `moduleCode` everywhere else, so it wins. Raised with the API team in
 * docs/PERMISSION_MODULE_FOR_API.md; when that lands this falls back to
 * `moduleCode` on its own and nothing on screen moves.
 */
export function moduleOf(p: PermissionDef): string {
  const prefix = p.permissionCode.split('.')[0]?.toUpperCase();
  return prefix === 'ADMIN' ? 'ADMIN' : (p.moduleCode || prefix || 'OTHER');
}

const MODULE_NAMES: Record<string, string> = {
  ADMIN: 'Administration',
  TOS: 'Terminal operations',
  MDM: 'Master data',
  REVENUE: 'Revenue & billing',
  EDI: 'EDI',
  NOTIFICATION: 'Notifications',
  TRUCKING: 'Trucking',
  MNR: 'Maintenance & repair',
};

export function moduleName(code: string): string {
  return MODULE_NAMES[code] ?? (code.charAt(0) + code.slice(1).toLowerCase());
}

/** The rights of one module, in the order a person reads them. */
export interface PermissionGroup {
  moduleCode: string;
  name: string;
  permissions: PermissionDef[];
}

/** Group the catalogue for the matrix, modules in a fixed, sensible order. */
export function groupPermissions(permissions: PermissionDef[]): PermissionGroup[] {
  const order = Object.keys(MODULE_NAMES);
  const by = new Map<string, PermissionDef[]>();
  for (const p of permissions) {
    const m = moduleOf(p);
    const list = by.get(m);
    if (list) list.push(p); else by.set(m, [p]);
  }
  return [...by.entries()]
    .sort((a, b) => {
      const ai = order.indexOf(a[0]), bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a[0].localeCompare(b[0]);
    })
    .map(([moduleCode, perms]) => ({
      moduleCode,
      name: moduleName(moduleCode),
      permissions: [...perms].sort((a, b) => a.permissionCode.localeCompare(b.permissionCode)),
    }));
}

/**
 * A ROLE CODE IS NOT FREE TEXT: A–Z, 0–9 and underscore, as the API demands.
 * Checked here so a typed code is refused on the form rather than by a 400
 * after the rest of the role has been filled in.
 */
export const ROLE_CODE_PATTERN = /^[A-Z0-9_]+$/;

export function roleCodeIssue(code: string): string | null {
  const c = code.trim();
  if (!c) return 'A code is required.';
  if (!ROLE_CODE_PATTERN.test(c)) return 'Capitals, digits and underscore only — e.g. GATE_SUPERVISOR.';
  return null;
}
