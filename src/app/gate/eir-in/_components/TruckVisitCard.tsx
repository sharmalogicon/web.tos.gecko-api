"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { GateField } from '../../_components/GateField';
import { PartyPicker } from '@/app/tariff/_components/PartyPicker';
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

export function TruckVisitCard({ truck, onChange, locked, visitNo, modeLabel, fieldError }: {
  truck: TruckDetails;
  onChange: (patch: Partial<TruckDetails>) => void;
  /** True once a move has opened the visit — the server owns the truck now. */
  locked: boolean;
  visitNo: string | null;
  modeLabel: string;
  fieldError: (field: string) => string | undefined;
}) {
  const { categories } = useTruckCategories();

  // -menus: .gecko-card sets overflow:hidden for its rounded corners, which
  // clips the haulier search's dropdown.
  return (
    <div className="gecko-card gecko-card-padded gecko-card-menus gecko-stack">
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

        {/* A search, not a list: the depot has thousands of hauliers and a
            dropdown holds one page of them (it showed KORAKIT's first 200 of 5,336). */}
        <GateField label="Transporter (haulier)" error={fieldError('truck.haulierCode')}>
          <PartyPicker role="HAULIER" value={truck.haulierCode || null} disabled={locked}
            placeholder="Search haulier code or name…"
            onChange={code => onChange({ haulierCode: code ?? '' })} />
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
