"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { GateField } from '../../_components/GateField';
import { PartyPicker } from '@/components/ui/PartyPicker';
import { useTruckCategories } from '@/lib/api/lookups';
import { backDateIssue, type TruckDetails } from './visit-moves';
import { localInputValue } from '@/lib/format';

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

export function TruckVisitCard({
  truck, onChange, locked, visitNo, modeLabel, fieldError, clockRules,
}: {
  truck: TruckDetails;
  onChange: (patch: Partial<TruckDetails>) => void;
  /** True once a move has opened the visit — the server owns the truck now. */
  locked: boolean;
  visitNo: string | null;
  modeLabel: string;
  fieldError: (field: string) => string | undefined;
  /** This depot's own back-date window and future grace, from the API. */
  clockRules: { maxBackdateHours: number; futureGraceMinutes: number };
}) {
  const { categories } = useTruckCategories();

  /**
   * THE FLOOR IS THE DEPOT'S, NOT THIS SCREEN'S (owner 2026-10-27). The flat 24
   * hours is gone; what replaced it is `gate.max_backdate_hours` on the branch,
   * read from the API, so a depot that keys a week of paper sets a week and one
   * that keys none sets zero. A depot that has not answered gets no floor at
   * all rather than a guess — the server still has the last word.
   *
   * What a clerk may NOT do, whatever the window says, is date a box behind its
   * own last movement. That is a per-container question this card cannot answer
   * — it is asked on each row, and finally by the server.
   *
   * `max`/`min` are read fresh on each render rather than frozen at mount: a
   * card left open across a shift would otherwise still offer a ceiling from
   * hours ago. They only steer the native picker — a clerk can still type — so
   * `backDateIssue` is the check that decides, here and again before the POST.
   */
  const now = new Date();
  const clockIssue = backDateIssue(truck.transactionAt, now, clockRules);
  const floor = Number.isFinite(clockRules.maxBackdateHours)
    ? localInputValue(new Date(now.getTime() - clockRules.maxBackdateHours * 3_600_000))
    : undefined;
  /** Says what THIS depot allows, rather than a sentence that might be untrue here. */
  const hours = clockRules.maxBackdateHours;
  const clockHint = !Number.isFinite(hours)
    ? 'Now by default. Wind it back as far as the paper goes — but not behind a box’s own last movement.'
    : hours <= 0
      ? 'This depot records gate moves as they happen — the time stays as now.'
      : `Now by default. This depot allows up to ${hours} hours back — but never behind a box’s own last movement.`;

  // -menus: .gecko-card sets overflow:hidden for its rounded corners, which
  // CLIPS the haulier search's dropdown. Clipping is not stacking — no z-index
  // rescues it.
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

        {/* Trailer / chassis is OFF the form (owner, 2026-10-09): KORAKIT does
            not key it, and its slot is better spent on the haulier, whose Thai
            company names do not fit a quarter of the row. The field is not
            deleted — `trailerPlate` stays on the draft and is sent as null, so
            putting it back is one block of JSX. */}

        {/* A SEARCH, not a list: the depot has thousands of hauliers and a
            dropdown holds one page of them. Required — every truck at the
            barrier belongs to someone. Two columns wide so the name fits. */}
        <GateField label="Transporter (haulier)" required span={2} error={fieldError('truck.haulierCode')}>
          <PartyPicker role="HAULIER" value={truck.haulierCode || null} disabled={locked} nameFirst
            placeholder="Search haulier name or code…"
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

        {/* What the gate reaches for when a truck is sitting on a lane. */}
        <GateField label="Mobile" error={fieldError('truck.driverMobile')}>
          <input className="gecko-input gecko-text-mono" value={truck.driverMobile} disabled={locked}
            maxLength={30} inputMode="tel" placeholder="08x-xxx-xxxx"
            onChange={e => onChange({ driverMobile: e.target.value })} />
        </GateField>

        {/* WHEN THE TRUCK WAS AT THE BARRIER — now, unless the shift is keying
            yesterday's paper. One clock for the whole truck: every box it
            carries was at the gate at the same moment, so this sits here and
            not on a row. Frozen once the visit is open, because by then the
            server owns the arrival time. */}
        <GateField label="Gate date &amp; time" required
          error={fieldError('transactionAt') ?? fieldError('truck.arrivedAt') ?? clockIssue ?? undefined}
          hint={locked ? undefined : clockHint}>
          <input className="gecko-input" type="datetime-local" value={truck.transactionAt}
            disabled={locked}
            max={localInputValue(now)}
            min={floor}
            onChange={e => onChange({ transactionAt: e.target.value })} />
        </GateField>

      </div>
    </div>
  );
}
