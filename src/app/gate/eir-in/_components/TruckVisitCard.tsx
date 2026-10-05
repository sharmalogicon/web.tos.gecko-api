"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { GateField } from '../../_components/GateField';
import { useApiList } from '@/lib/api/use-api';
import { useTruckCategories } from '@/lib/api/lookups';
import type { TruckDetails } from './visit-moves';

/**
 * Step 1 — the truck and its driver.
 *
 * These facts travel on the FIRST box recorded, which is the POST that opens
 * the visit. Afterwards the server owns them: a later box joins by
 * `truckVisitId` and the truck block is read-only, because changing the plate
 * halfway through a visit would describe a truck that never came.
 *
 * WHAT THE JUNE DESIGN SHOWED HERE AND THIS DOES NOT, with the reason:
 *
 *   - Appointment ref, "APPOINTMENT VERIFIED", appt source — appointments are
 *     the VBS module (Phase 4.5). There is no appointment anywhere in the TOS
 *     schema, so every one of those fields was invented.
 *   - Lane assigned — the gate records the move, not the booth it passed.
 *     There is no lane.
 *   - Safety briefing acknowledged — nothing records it.
 *
 * They are not hidden behind a flag: a greyed box for a module years out is
 * clutter at a gate. Put them back the day VBS ships.
 */

interface PartyRow { partyCode: string; nameEn: string }

export function TruckVisitCard({ truck, onChange, locked, visitNo, modeLabel, fieldError }: {
  truck: TruckDetails;
  onChange: (patch: Partial<TruckDetails>) => void;
  /** True once a move has opened the visit — the server owns the truck now. */
  locked: boolean;
  visitNo: string | null;
  modeLabel: string;
  fieldError: (field: string) => string | undefined;
}) {
  const { data: haulierRows } = useApiList<PartyRow>('/api/master/parties?role=HAULIER&pageSize=200');
  const { categories } = useTruckCategories();

  // Null until the first page lands; an empty list renders the same.
  const hauliers = haulierRows ?? [];

  return (
    <div className="gecko-card gecko-card-padded gecko-stack">
      <div className="gecko-row gecko-row-start gecko-row-between">
        <div className="gecko-row gecko-gap-2h">
          <div className="gecko-step-badge">1</div>
          <div>
            <div className="gecko-card-title">Truck &amp; Driver</div>
          </div>
        </div>
        {visitNo && (
          <div className="gecko-visit-chip">
            <Icon name="truck" size={13} />
            <span className="gecko-text-mono">{visitNo}</span>
            <span className="gecko-visit-chip-mode">{modeLabel}</span>
          </div>
        )}
      </div>

      <div className="gecko-gate-truck-grid">
        <GateField label="Truck plate" required error={fieldError('truck.plate')}>
          <input className="gecko-input gecko-text-mono" value={truck.plate} disabled={locked} maxLength={20}
            placeholder="70-4455"
            onChange={e => onChange({ plate: e.target.value.toUpperCase() })} />
        </GateField>

        <GateField label="Trailer / chassis" error={fieldError('truck.trailerPlate')}>
          <input className="gecko-input gecko-text-mono" value={truck.trailerPlate} disabled={locked} maxLength={20}
            onChange={e => onChange({ trailerPlate: e.target.value.toUpperCase() })} />
        </GateField>

        <GateField label="Transporter (haulier)" error={fieldError('truck.haulierCode')}>
          <select className="gecko-input" value={truck.haulierCode} disabled={locked}
            onChange={e => onChange({ haulierCode: e.target.value })}>
            <option value="">Not stated</option>
            {hauliers.map(h => <option key={h.partyCode} value={h.partyCode}>{h.partyCode} - {h.nameEn}</option>)}
          </select>
        </GateField>

        <GateField label="Truck category" error={fieldError('truck.truckCategoryCode')}>
          <select className="gecko-input" value={truck.truckCategoryCode} disabled={locked}
            onChange={e => onChange({ truckCategoryCode: e.target.value })}>
            <option value="">Depot default</option>
            {categories.map(c => <option key={c.code} value={c.code}>{c.code} - {c.descriptionEn}</option>)}
          </select>
        </GateField>

        <GateField label="Driver name" error={fieldError('truck.driverName')}>
          <input className="gecko-input" value={truck.driverName} disabled={locked} maxLength={100}
            onChange={e => onChange({ driverName: e.target.value })} />
        </GateField>

        <GateField label="Licence no." error={fieldError('truck.driverLicence')}>
          <input className="gecko-input gecko-text-mono" value={truck.driverLicenceNo} disabled={locked} maxLength={40}
            onChange={e => onChange({ driverLicenceNo: e.target.value.toUpperCase() })} />
        </GateField>

        <GateField label="Mobile">
          <input className="gecko-input gecko-text-mono" value={truck.driverMobile} disabled
            onChange={e => onChange({ driverMobile: e.target.value })} />
        </GateField>

      </div>
    </div>
  );
}
