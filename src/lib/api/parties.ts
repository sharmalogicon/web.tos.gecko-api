/**
 * Parties (customers, shipping lines, forwarders, hauliers) — Gecko.MasterData
 * /api/master/parties.
 *
 * Who may do what (gecko_identity 14 + 19):
 *   search / read   mdm.party.view    — every role, incl. branch-scoped gate clerks
 *   register (POST) mdm.party.create  — GATE_CLERK, ACCOUNTS, OPS_MANAGER, TENANT_OWNER
 *   edit (PUT)      mdm.party.manage  — tenant-wide ACCOUNTS, OPS_MANAGER, TENANT_OWNER
 *
 * Party codes are generated (PARTY_CODE number series) and may contain '/', so
 * always build URLs with partyPath().
 */
import { apiGet, apiSend } from './client';
import type { Paged } from './use-api';

export type PartyRole = 'CUSTOMER' | 'SHIPPING_LINE' | 'FORWARDER' | 'HAULIER';

export const PARTY_ROLES: { value: PartyRole; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SHIPPING_LINE', label: 'Shipping line' },
  { value: 'FORWARDER', label: 'Forwarder' },
  { value: 'HAULIER', label: 'Haulier' },
];

export interface PartySummary {
  partyId: string;
  partyCode: string;
  nameEn: string;
  nameLocal: string | null;
  taxId: string | null;
  /** Thai tax branch: '00000' = head office. */
  branchNo: string | null;
  isActive: boolean;
  roles: PartyRole[];
}

export interface PartyAlias {
  code: string;
  type: string;
  label: string | null;
}

export interface PartyContact {
  contactId: string;
  name: string | null;
  /** BILLING | OPERATIONS | SHIPPING | GATE | CUSTOMS | EMERGENCY | TECHNICAL | OTHER */
  role: string;
  jobTitle: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  isDefault: boolean;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  /** Base64 ROWVERSION; send it back on PUT / DELETE. */
  rowVersion: string;
}

export const CONTACT_ROLES = ['BILLING', 'OPERATIONS', 'SHIPPING', 'GATE', 'CUSTOMS', 'EMERGENCY', 'TECHNICAL', 'OTHER'] as const;

/** Body of POST / PUT /parties/{code}/contacts. Needs mdm.party.manage. */
export interface SaveContactRequest {
  contactType: string;
  contactPerson: string | null;
  jobTitle: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  isDefault: boolean;
  rowVersion?: string;
}

/** Another live party with the same tax id + branch — shown as a hint, never merged. */
export interface PartyDuplicate { partyCode: string; nameEn: string; isActive: boolean }

export interface PartyDetail extends PartySummary {
  shortName: string | null;
  countryCode: string;
  defaultCurrency: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  remarks: string | null;
  /** Company registration number (DBD), when it differs from the tax id. */
  registrationNo?: string | null;
  /**
   * How long this customer's boxes may stand before the depot calls them
   * long-standing. Recorded only — nothing at the gate enforces it yet.
   * Null = none set.
   */
  longStandingDays?: number | null;
  aliases: PartyAlias[];
  contacts: PartyContact[];
  createdAt: string;
  updatedAt: string;
  /** Base64 ROWVERSION; send it back on PUT. A stale one answers 409. */
  rowVersion: string;
  duplicates?: PartyDuplicate[] | null;
}

/**
 * Body of POST and PUT. On PUT the contract fields (nameEn … roles) replace the
 * stored values; the optional extras (address2, city, state, postcode, shortName,
 * website, remarks, registrationNo, defaultCurrency) are left unchanged when
 * omitted/null — send '' to clear one. defaultCurrency (ISO 4217, lookup.currency)
 * defaults on POST to the tenant company's currency, else THB. Roles on PUT:
 * omitted or [] = unchanged. POST with no roles registers a CUSTOMER.
 */
export interface SavePartyRequest {
  nameEn: string;
  nameLocal?: string | null;
  /** Thai tax id: exactly 13 digits. Same tax id + branchNo as an existing party → 409. */
  taxId?: string | null;
  branchNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  roles?: PartyRole[];
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  shortName?: string | null;
  /** max 500 */
  website?: string | null;
  /** max 1000 */
  remarks?: string | null;
  /**
   * 0–3650, CUSTOMER only (400 `longStandingDays` on any other role).
   * Omit to leave as is; 0 clears it.
   */
  longStandingDays?: number | null;
  /** max 100 */
  registrationNo?: string | null;
  /** 3-letter ISO 4217 code; unknown → 400. */
  defaultCurrency?: string | null;
  isActive?: boolean;
  rowVersion?: string;
}

export interface PartyQuery {
  search?: string;
  role?: PartyRole | '';
  page?: number;
  pageSize?: number;
  /** The API default is true; the list sends false unless the user asks for inactive parties. */
  includeInactive?: boolean;
}

export const PARTIES_PATH = '/api/master/parties';

/** URL of one party. Encodes '/' as %2F, which the API decodes back. */
export const partyPath = (partyCode: string) => `${PARTIES_PATH}/${encodeURIComponent(partyCode)}`;

export function partiesQueryPath({ search = '', role = '', page = 1, pageSize = 20, includeInactive = false }: PartyQuery): string {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: String(includeInactive) });
  if (search.trim()) q.set('search', search.trim());
  if (role) q.set('role', role);
  return `${PARTIES_PATH}?${q.toString()}`;
}

export const searchParties = (query: PartyQuery) => apiGet<Paged<PartySummary>>(partiesQueryPath(query));
export const getParty = (partyCode: string) => apiGet<PartyDetail>(partyPath(partyCode));
export const createParty = (body: SavePartyRequest) => apiSend<PartyDetail>('POST', PARTIES_PATH, body);
export const updateParty = (partyCode: string, body: SavePartyRequest) =>
  apiSend<PartyDetail>('PUT', partyPath(partyCode), body);

/** Client-side mirror of the API rule, for instant feedback. */
export const isThaiTaxId = (value: string) => /^\d{13}$/.test(value);

const contactsPath = (partyCode: string) => `${partyPath(partyCode)}/contacts`;
export const createContact = (partyCode: string, body: SaveContactRequest) =>
  apiSend<PartyContact>('POST', contactsPath(partyCode), body);
export const updateContact = (partyCode: string, contactId: string, body: SaveContactRequest) =>
  apiSend<PartyContact>('PUT', `${contactsPath(partyCode)}/${contactId}`, body);
export const deleteContact = (partyCode: string, contactId: string, rowVersion: string) =>
  apiSend<void>('DELETE', `${contactsPath(partyCode)}/${contactId}?rowVersion=${encodeURIComponent(rowVersion)}`);
