/**
 * Shipping lines — Gecko.MasterData /api/master/shipping-lines.
 *
 * A line is a PARTY with the SHIPPING_LINE role; this resource is that role's
 * own columns (SCAC, SMDG, EDI flags, principal). Name, address, deactivate and
 * delete stay on the party record (/masters/customers/{code}).
 *
 * An AGENT acts for a principal LINE (KORAKIT: APL-N for APL). A principal with
 * live agents cannot become an agent, lose the role or be deleted.
 *
 * Who: read mdm.party.view (branch grant is enough); create / edit mdm.party.manage.
 */
import { apiSend } from './client';

export type LineRole = 'LINE' | 'AGENT';

export interface ShippingLine {
  partyCode: string;
  nameEn: string;
  nameLocal: string | null;
  shortName: string | null;
  isActive: boolean;
  lineRole: LineRole;
  principalLineCode: string | null;
  principalLineName: string | null;
  /** 4 letters, unique per tenant. */
  scacCode: string | null;
  smdgCode: string | null;
  operatorCode: string | null;
  imoCompanyNo: string | null;
  allianceCode: string | null;
  allianceName: string | null;
  /** UNB sender / recipient id. */
  ediPartnerCode: string | null;
  ediSupportsCoparn: boolean;
  ediSupportsCodeco: boolean;
  ediSupportsCoarri: boolean;
  ediSupportsBaplie: boolean;
  /** #RRGGBB */
  brandColorHex: string | null;
  city: string | null;
  countryCode: string;
  updatedAt: string;
  /** Base64 ROWVERSION of the line's own row (not the party's); send it back on PUT. */
  rowVersion: string;
}

export interface ShippingLineAgent { partyCode: string; nameEn: string; isActive: boolean }

export interface ShippingLineDetail { line: ShippingLine; agents: ShippingLineAgent[] }

/** Body of PUT /shipping-lines/{code}. Replaces every line column: null / false clears. */
export interface SaveShippingLineRequest {
  lineRole: LineRole;
  principalLineCode: string | null;
  scacCode: string | null;
  smdgCode: string | null;
  operatorCode: string | null;
  imoCompanyNo: string | null;
  allianceCode: string | null;
  allianceName: string | null;
  ediPartnerCode: string | null;
  ediSupportsCoparn: boolean;
  ediSupportsCodeco: boolean;
  ediSupportsCoarri: boolean;
  ediSupportsBaplie: boolean;
  brandColorHex: string | null;
  rowVersion?: string;
}

/** Body of POST: the party's name plus the line columns. */
export interface CreateShippingLineRequest extends Omit<SaveShippingLineRequest, 'rowVersion'> {
  nameEn: string;
  nameLocal: string | null;
  shortName: string | null;
}

export interface ShippingLineQuery {
  search?: string;
  lineRole?: LineRole | '';
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export const SHIPPING_LINES_PATH = '/api/master/shipping-lines';

/** URL of one line. Encodes '/' as %2F, which the API decodes back. */
export const shippingLinePath = (partyCode: string) => `${SHIPPING_LINES_PATH}/${encodeURIComponent(partyCode)}`;

export function shippingLinesQueryPath({ search = '', lineRole = '', page = 1, pageSize = 50, includeInactive = false }: ShippingLineQuery): string {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: String(includeInactive) });
  if (search.trim()) q.set('search', search.trim());
  if (lineRole) q.set('lineRole', lineRole);
  return `${SHIPPING_LINES_PATH}?${q.toString()}`;
}

export const createShippingLine = (body: CreateShippingLineRequest) =>
  apiSend<ShippingLineDetail>('POST', SHIPPING_LINES_PATH, body);
export const updateShippingLine = (partyCode: string, body: SaveShippingLineRequest) =>
  apiSend<ShippingLineDetail>('PUT', shippingLinePath(partyCode), body);

export const EDI_MESSAGES = [
  { key: 'ediSupportsCoparn', label: 'COPARN' },
  { key: 'ediSupportsCodeco', label: 'CODECO' },
  { key: 'ediSupportsCoarri', label: 'COARRI' },
  { key: 'ediSupportsBaplie', label: 'BAPLIE' },
] as const;
