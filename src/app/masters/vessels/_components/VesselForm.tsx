"use client";
import React from 'react';
import { FormGrid, Field } from '@/components/ui/FormGrid';
import { ApiError } from '@/lib/api/problem';
import { useApi, type Paged } from '@/lib/api/use-api';
import { shippingLinesQueryPath, type ShippingLine } from '@/lib/api/shipping-lines';
import { VESSEL_TYPES, imoCheckDigitOk, type Vessel } from '@/lib/api/logistics';

export const EMPTY_VESSEL: Vessel = {
  vesselCode: '', vesselName: '', vesselNameLocal: null, imoNumber: null, callSign: null, mmsi: null,
  vesselType: 'CONTAINER', operatorPartyCode: null, flagCountryCode: null, teuCapacity: null, grossTonnage: null,
  loaM: null, isActive: true,
};

/** Client mirror of the API's field rules. The API still has the last word (unique IMO, unknown party…). */
export function localErrors(v: Vessel, originalImo: string | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.vesselCode.trim()) e.vesselCode = 'Required.';
  if (!v.vesselName.trim()) e.vesselName = 'Required.';
  const imo = v.imoNumber?.trim();
  if (imo && !/^\d{7}$/.test(imo)) e.imoNumber = 'An IMO number is 7 digits.';
  else if (imo && imo !== originalImo && !imoCheckDigitOk(imo)) e.imoNumber = 'Fails the IMO check digit — check the certificate.';
  if (v.mmsi && !/^\d{9}$/.test(v.mmsi.trim())) e.mmsi = 'An MMSI is 9 digits.';
  return e;
}

const num = (s: string) => (s.trim() === '' ? null : Number(s));
const blank = (s: string) => (s.trim() === '' ? null : s);

export function VesselForm({ value, onChange, isNew, readOnly, errors, apiError }: {
  value: Vessel; onChange: (v: Vessel) => void; isNew: boolean; readOnly: boolean;
  errors: Record<string, string>; apiError: ApiError | null;
}) {
  const set = (patch: Partial<Vessel>) => onChange({ ...value, ...patch });
  const err = (k: string) => errors[k] ?? apiError?.forField(k);
  const { data: lines } = useApi<Paged<ShippingLine>>(shippingLinesQueryPath({ lineRole: 'LINE', pageSize: 200, includeInactive: true }));

  return (
    <fieldset disabled={readOnly} className="gecko-stack gecko-stack-xl" style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
      <FormGrid columns={3}>
        <Field label="Vessel code" required error={err('vesselCode')} helper={isNew ? 'What the gate and bookings type' : 'The code cannot change'}>
          <input className="gecko-input gecko-text-mono" maxLength={20} value={value.vesselCode} disabled={!isNew || readOnly}
            onChange={e => set({ vesselCode: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Name" required error={err('vesselName')} span2>
          <input className="gecko-input" maxLength={255} value={value.vesselName} onChange={e => set({ vesselName: e.target.value })} />
        </Field>
        <Field label="Name (Thai)" error={err('vesselNameLocal')}>
          <input className="gecko-input" maxLength={255} lang="th" value={value.vesselNameLocal ?? ''} onChange={e => set({ vesselNameLocal: blank(e.target.value) })} />
        </Field>
        <Field label="Type" error={err('vesselType')}>
          <select className="gecko-input" value={value.vesselType ?? ''} onChange={e => set({ vesselType: e.target.value || null })}>
            <option value="">—</option>
            {VESSEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Operator" error={err('operatorPartyCode')} helper="The shipping line that runs it">
          <select className="gecko-input" value={value.operatorPartyCode ?? ''} onChange={e => set({ operatorPartyCode: e.target.value || null })}>
            <option value="">— none —</option>
            {(lines?.items ?? []).map(l => <option key={l.partyCode} value={l.partyCode}>{l.partyCode} · {l.nameEn}</option>)}
          </select>
        </Field>
      </FormGrid>

      <FormGrid columns={3}>
        <Field label="IMO number" error={err('imoNumber')} helper="7 digits; the last is a check digit">
          <input className="gecko-input gecko-text-mono" maxLength={7} inputMode="numeric" value={value.imoNumber ?? ''} onChange={e => set({ imoNumber: blank(e.target.value.replace(/\D/g, '')) })} />
        </Field>
        <Field label="Call sign" error={err('callSign')}>
          <input className="gecko-input gecko-text-mono" maxLength={10} value={value.callSign ?? ''} onChange={e => set({ callSign: blank(e.target.value.toUpperCase()) })} />
        </Field>
        <Field label="MMSI" error={err('mmsi')} helper="9 digits (AIS)">
          <input className="gecko-input gecko-text-mono" maxLength={9} inputMode="numeric" value={value.mmsi ?? ''} onChange={e => set({ mmsi: blank(e.target.value.replace(/\D/g, '')) })} />
        </Field>
        <Field label="Flag" error={err('flagCountryCode')} helper="Country code, e.g. TH, SG, PA">
          <input className="gecko-input gecko-text-mono" maxLength={2} value={value.flagCountryCode ?? ''} onChange={e => set({ flagCountryCode: blank(e.target.value.toUpperCase()) })} />
        </Field>
        <Field label="Capacity (TEU)" error={err('teuCapacity')}>
          <input className="gecko-input gecko-num-tabular" type="number" min={0} value={value.teuCapacity ?? ''} onChange={e => set({ teuCapacity: num(e.target.value) })} />
        </Field>
        <Field label="Gross tonnage" error={err('grossTonnage')}>
          <input className="gecko-input gecko-num-tabular" type="number" min={0} value={value.grossTonnage ?? ''} onChange={e => set({ grossTonnage: num(e.target.value) })} />
        </Field>
        <Field label="Length overall (m)" error={err('loaM')}>
          <input className="gecko-input gecko-num-tabular" type="number" min={0} step={0.01} value={value.loaM ?? ''} onChange={e => set({ loaM: num(e.target.value) })} />
        </Field>
        <Field label="Status">
          <label className="gecko-row gecko-cell-meta">
            <input type="checkbox" className="gecko-checkbox" checked={value.isActive} onChange={e => set({ isActive: e.target.checked })} />
            Active — offered on vessel calls and bookings
          </label>
        </Field>
      </FormGrid>
    </fieldset>
  );
}
