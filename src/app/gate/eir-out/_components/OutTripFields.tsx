"use client";
import React from 'react';
import { GateField } from '../../_components/GateField';
import { BookingPicker, type BookableBox } from '../../_components/BookingPicker';
import { useConditions } from '@/lib/api/lookups';
import {
  grossOf, locationLabel, overMaxWeight, reeferEditable, type GateOutDraft,
} from './gate-out-draft';

/**
 * One box leaving, in Vector's three columns.
 *
 * Most of it is read-only on the way out, and that is the API's doing rather
 * than a style choice: a pick-up requires nothing beyond the box, because what
 * the box is and who it belongs to were settled when the booking was made.
 * What the clerk still owes is the seal the terminal applies before the truck
 * leaves, and the condition it leaves in.
 */
export function OutTripFields({ d, branchId, locked, taken, onChange, onPick, err }: {
  d: GateOutDraft;
  branchId: string;
  /** True once the box is recorded — a record, not a form. */
  locked: boolean;
  /** Boxes already on this truck, so the picker cannot offer one twice. */
  taken: string[];
  onChange: (p: Partial<GateOutDraft>) => void;
  onPick: (box: BookableBox) => void;
  err: (field: string) => string | undefined;
}) {
  const { conditions } = useConditions();
  const reefer = reeferEditable(d);

  return (
    <>
        <div className="gecko-trip-grid">
          <div className="gecko-trip-col">
            <GateField label="Trip type" frozen>
              <div className="gecko-readonly-value">Pick-up cont</div>
            </GateField>

            <GateField label="Booking - B/L no." required error={err('bookingContainerId')}>
              <BookingPicker branchId={branchId} direction="OUT" exclude={taken} disabled={locked}
                value={d.carrierRef || d.orderNo}
                onPick={onPick}
                onClear={() => onChange({
                  bookingContainerId: '', bookingId: '', orderNo: '', carrierRef: '', containerNo: '',
                  orderTypeCode: '', bookingTypeCode: '', movementCode: '', fullEmpty: null,
                  known: null, findings: [],
                })} />
            </GateField>

            <GateField label="Customer" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.customerCode || '—'}</div>
            </GateField>

            <GateField label="Container no." required error={err('containerNo')}>
              <input className="gecko-input gecko-text-mono" value={d.containerNo} maxLength={14} disabled={locked}
                onChange={e => onChange({ containerNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            </GateField>

            <GateField label="Container class" error={err('gradeCode')}>
              <input className="gecko-input gecko-text-mono" value={d.gradeCode} maxLength={10} disabled={locked}
                placeholder="NONE" onChange={e => onChange({ gradeCode: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Temperature °C" error={err('temperatureC')} frozen={!reefer}>
              <input className="gecko-input" type="number" step="0.1" min={-70} max={40}
                value={d.temperatureC} disabled={!reefer || locked}
                onChange={e => onChange({ temperatureC: e.target.value })} />
            </GateField>

            <GateField label="Vent" error={err('ventSetting')} frozen={!reefer}>
              <input className="gecko-input" maxLength={20} value={d.ventSetting} disabled={!reefer || locked}
                onChange={e => onChange({ ventSetting: e.target.value })} />
            </GateField>

            <GateField label="Humidity %" error={err('humidityPct')} frozen={!reefer}>
              <input className="gecko-input" type="number" min={0} max={100} value={d.humidityPct}
                disabled={!reefer || locked} onChange={e => onChange({ humidityPct: e.target.value })} />
            </GateField>

            <GateField label="Seal #1" error={err('seals')}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.sealNo1} disabled={locked}
                onChange={e => onChange({ sealNo1: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Seal #2">
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.sealNo2} disabled={locked}
                aria-label="Seal 2" onChange={e => onChange({ sealNo2: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Remarks" error={err('remarks')}>
              <textarea className="gecko-textarea gecko-input" rows={3} maxLength={300} value={d.remarks}
                disabled={locked} onChange={e => onChange({ remarks: e.target.value })} />
            </GateField>
          </div>

          <div className="gecko-trip-col">
            <GateField label="Empty / loaded" frozen>
              <div className="gecko-readonly-value">{d.fullEmpty ?? '—'}</div>
            </GateField>

            <GateField label="Agent" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.agentCode || '—'}</div>
            </GateField>

            <GateField label="Size - type" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.equipmentTypeCode || '—'}</div>
            </GateField>

            <GateField label="Status" error={err('conditionCode')}>
              <select className="gecko-input" value={d.conditionCode} disabled={locked}
                onChange={e => onChange({ conditionCode: e.target.value })}>
                <option value="">—</option>
                {conditions.map(c => (
                  <option key={c.conditionCode} value={c.conditionCode}>
                    {c.conditionCode} - {c.descriptionEn}
                  </option>
                ))}
              </select>
            </GateField>

            <GateField label="Material / height" error={err('materialCode')}>
              <div className="gecko-row gecko-gap-1">
                <input className="gecko-input gecko-text-mono" maxLength={20} value={d.materialCode}
                  placeholder="STL" aria-label="Material" disabled={locked}
                  onChange={e => onChange({ materialCode: e.target.value.toUpperCase() })} />
                <input className="gecko-input gecko-text-mono" value={d.heightCode} disabled
                  aria-label="Height" placeholder="8ft6" />
              </div>
            </GateField>

            <GateField label="Clip-on no." error={err('clipOnNo')} frozen={!reefer}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.clipOnNo}
                disabled={!reefer || locked} onChange={e => onChange({ clipOnNo: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Customs permit no." error={err('customsPermitNo')}>
              <input className="gecko-input gecko-text-mono" maxLength={40} value={d.customsPermitNo}
                disabled={locked} onChange={e => onChange({ customsPermitNo: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label={locationLabel(d)} error={err('nextLocationCode')}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.nextLocationCode}
                disabled={locked} onChange={e => onChange({ nextLocationCode: e.target.value.toUpperCase() })} />
            </GateField>
          </div>

          <div className="gecko-trip-col">
            <GateField label="Booking type" frozen>
              <div className="gecko-readonly-value">{d.bookingTypeCode || '—'}</div>
            </GateField>

            <GateField label="Order type" frozen>
              <div className="gecko-readonly-value">{d.orderTypeCode || '—'}</div>
            </GateField>

            <GateField label="Vessel name" frozen>
              <div className="gecko-readonly-value">{d.vesselName || '—'}</div>
            </GateField>

            <GateField label="Voyage no." frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.voyageNo || '—'}</div>
            </GateField>

            <GateField label="Tare weight kg" error={err('tareWeightKg')}>
              <input className="gecko-input" type="number" min={0} value={d.tareWeightKg} disabled={locked}
                onChange={e => onChange({ tareWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Max gross weight kg" error={err('maxGrossWeightKg')}>
              <input className="gecko-input" type="number" min={0} value={d.maxGrossWeightKg} disabled={locked}
                onChange={e => onChange({ maxGrossWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Cargo weight kg" error={err('cargoWeightKg')} frozen={d.fullEmpty !== 'FULL'}>
              <input className="gecko-input" type="number" min={0} value={d.cargoWeightKg}
                disabled={d.fullEmpty !== 'FULL' || locked}
                onChange={e => onChange({ cargoWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Gross weight kg" frozen>
              <div className={`gecko-readonly-value gecko-text-mono${overMaxWeight(d) ? ' gecko-tone-error' : ''}`}>
                {grossOf(d)?.toLocaleString() ?? '—'}
              </div>
            </GateField>

            <GateField label="VGM kg" error={err('vgmKg')}>
              <input className="gecko-input" type="number" min={0} value={d.vgmKg} disabled={locked}
                onChange={e => onChange({ vgmKg: e.target.value })} />
            </GateField>

            <GateField label="Genset no." error={err('gensetNo')}>
              <div className="gecko-row gecko-gap-1">
                <select className="gecko-input gecko-genset-mode" value={d.gensetMode} disabled={locked}
                  aria-label="Genset fitted"
                  onChange={e => onChange({
                    gensetMode: e.target.value as 'NO' | 'YES',
                    gensetNo: e.target.value === 'NO' ? '' : d.gensetNo,
                  })}>
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
                <input className="gecko-input gecko-text-mono" maxLength={20} value={d.gensetNo}
                  disabled={d.gensetMode === 'NO' || locked} aria-label="Genset number"
                  onChange={e => onChange({ gensetNo: e.target.value.toUpperCase() })} />
              </div>
            </GateField>

            <GateField label="Paperless code" error={err('paperlessCode')}>
              <input className="gecko-input gecko-text-mono" maxLength={40} value={d.paperlessCode}
                disabled={locked} onChange={e => onChange({ paperlessCode: e.target.value.toUpperCase() })} />
            </GateField>
          </div>
        </div>


      {overMaxWeight(d) && (
        <div className="gecko-move-issues">
          <span>
            Over max weight — tare + cargo is {grossOf(d)?.toLocaleString()} kg against a plate limit
            of {Number(d.maxGrossWeightKg).toLocaleString()} kg. It can still be recorded.
          </span>
        </div>
      )}
    </>
  );
}
