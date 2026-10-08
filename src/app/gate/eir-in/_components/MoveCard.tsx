"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useApiList } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useConditions } from '@/lib/api/lookups';
import type { GateFinding } from '@/lib/api/tos';
import { GateField } from '../../_components/GateField';
import { VasPanel } from './VasPanel';
import { DamagePanel } from './DamagePanel';
import { BookingPicker, type BookableBox } from '../../_components/BookingPicker';
import {
  boxLooksRight, needsDigitReason, needsLateReason,
  editable, grossOf, isDamaged, locationLabel, normaliseBox, onBooking, overMaxWeight,
  pickupHasNoOrder, requiredFor, rowIssues,
  type MoveDraft, type SealRow,
} from './visit-moves';

/**
 * ONE box on the truck — keyed, looked up, and recorded on its own.
 *
 * The row is deliberately not a form that is submitted with the others. Each
 * box is a POST, so each box succeeds or is refused by itself: a hold on the
 * second container must not throw away the first one the clerk already keyed.
 * The row carries its own error, its own findings and its own EIR number.
 *
 * A drop-off and a pick-up ask for different things, and the difference is the
 * API's, not a style choice — a pick-up requires nothing beyond the box, while
 * a drop-off must weigh it, and a FULL drop-off must seal it.
 */

interface PartyRow { partyCode: string; nameEn: string }
interface EquipmentTypeRow { equipmentTypeId: string; typeCode: string; descriptionEn: string; isActive: boolean }

export function MoveCard({ move, index, open, branchId, takenBoxes, onToggle, onChange, onRemove, onLook, onRecord, onPickBooking, onToggleVas, canRecord }: {
  move: MoveDraft;
  index: number;
  open: boolean;
  branchId: string;
  /** Boxes already on this truck, so the picker cannot offer one twice. */
  takenBoxes: string[];
  onPickBooking: (box: BookableBox) => void;
  onToggleVas: (chargeCode: string) => void;
  onToggle: () => void;
  onChange: (patch: Partial<MoveDraft>) => void;
  onRemove: () => void;
  onLook: () => void;
  onRecord: () => void;
  canRecord: boolean;
}) {
  const { data: lineRows } = useApiList<PartyRow>('/api/master/parties?role=SHIPPING_LINE&pageSize=200');
  const { data: customerRows } = useApiList<PartyRow>('/api/master/parties?role=CUSTOMER&pageSize=200');
  const { data: equipmentRows } = useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const { yards } = useFacility();
  const { conditions } = useConditions();

  // useApiList answers null until the first page lands; an empty list renders
  // the same and keeps every map below free of a guard.
  const lines = lineRows ?? [];
  const customers = customerRows ?? [];
  const equipmentTypes = equipmentRows ?? [];

  const drop = move.trip === 'DROP_OFF_CONT';
  // Held and priced — not committed. The Save is what writes it.
  const held = move.reserved;
  const done = !!move.result;
  const required = requiredFor(move);
  const needs = (f: string) => required.includes(f);
  const err = (f: string) => move.error?.forField(f);
  const issues = rowIssues(move);
  const booking = move.known?.booking ?? null;
  const step = move.known?.nextStep ?? null;
  // Preflight is the authority once it answers; before that, what the clerk
  // picked already said all of this.
  const carries = onBooking(move);
  const orderNo = booking?.orderNo ?? move.orderNo;
  const orderTypeCode = booking?.orderTypeCode ?? move.orderTypeCode;
  const movement = step?.movementCode ?? move.movementCode;
  const load = step?.fullEmpty ?? move.fullEmpty;
  const blocked = move.known?.holds?.filter(h => h.blocksThisMove) ?? [];

  const patchSeal = (i: number, p: Partial<SealRow>) =>
    onChange({ seals: move.seals.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <div className={`gecko-move-card${done ? ' gecko-move-card-done' : ''}${open ? ' gecko-move-card-open' : ''}`}>
      {/* ── the row, always visible ─────────────────────────────────────── */}
      <div className="gecko-move-head">
        <button type="button" className="gecko-move-toggle" onClick={onToggle}
          aria-expanded={open} aria-label={open ? 'Collapse this box' : 'Expand this box'}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
        </button>

        <span className={`gecko-move-kind gecko-move-kind-${drop ? 'in' : 'out'}`}>
          <Icon name={drop ? 'arrowDown' : 'arrowUp'} size={12} />
          {drop ? 'Drop-off' : 'Pick-up'}
        </span>

        {/* The B/L is what the clerk reads off the driver's paperwork, so it
            comes first — the box follows from the booking line they pick. */}
        <div className="gecko-move-bl">
          <BookingPicker
            branchId={branchId}
            direction={drop ? 'IN' : 'OUT'}
            value={move.carrierRef || move.orderNo}
            exclude={takenBoxes}
            disabled={done}
            error={err('bookingContainerId')}
            onPick={onPickBooking}
            onClear={() => onChange({
              bookingContainerId: '', orderNo: '', carrierRef: '', orderTypeCode: '',
              bookingTypeCode: '', movementCode: '', fullEmpty: null,
            })} />
        </div>

        <div className="gecko-move-box">
          <input
            className={`gecko-input gecko-input-sm gecko-text-mono${err('containerNo') ? ' gecko-input-error' : ''}`}
            value={move.containerNo}
            disabled={done}
            maxLength={14}
            placeholder="MSKU1234565"
            aria-label={`Container number for box ${index + 1}`}
            onChange={e => onChange({ containerNo: normaliseBox(e.target.value) })}
            onBlur={() => { if (boxLooksRight(move.containerNo)) onLook(); }} />
          {move.looking && <span className="gecko-cell-meta">looking…</span>}
        </div>

        <div className="gecko-move-spacer" />

        {done ? (
          <span className="gecko-move-eir">
            <Icon name={move.result!.status === 'GATED' ? 'shieldCheck' : 'clock'} size={13} />
            {move.result!.eirNo
              ? <Link href={`/gate/eir-in/${move.result!.gateTransactionId}`} className="gecko-link gecko-text-mono">
                  {move.result!.eirNo}
                </Link>
              : <span className="gecko-text-mono">{move.result!.couponRef ?? 'waiting for gate out'}</span>}
          </span>
        ) : (
          <div className="gecko-row gecko-gap-1">
            <span className={`gecko-move-ready${issues.length ? ' gecko-move-ready-no' : held ? '' : ' gecko-move-ready-no'}`}>
              {issues.length ? `${issues.length} to fill` : held ? 'Held' : 'Ready'}
            </span>
            {/* It adds the trip to the truck — it does not record anything at
                the barrier. The Save is what commits. */}
            <button type="button" className="gecko-btn gecko-btn-success gecko-btn-sm"
              disabled={!canRecord || move.saving || issues.length > 0 || pickupHasNoOrder(move)}
              onClick={onRecord}>
              <Icon name="plus" size={13} />
              {move.saving ? 'Adding…' : held ? 'Re-check' : 'Add trip'}
            </button>
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon gecko-btn-icon-danger"
              aria-label={`Remove box ${index + 1}`} onClick={onRemove} disabled={move.saving}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
      </div>

      {(orderNo || movement || (!carries && move.known)) && (
        <div className="gecko-move-facts">
          {orderNo && (
            <span className="gecko-move-fact">
              <Link href={`/bookings/${booking?.bookingId ?? move.bookingId}`} className="gecko-link gecko-text-mono">
                {orderNo}
              </Link>
              {orderTypeCode ? ` · ${orderTypeCode}` : ''}
            </span>
          )}
          {movement && <span className="gecko-move-fact">{movement}{load ? ` · ${load}` : ''}</span>}
          {!carries && move.known && (
            <span className="gecko-move-fact gecko-tone-warning">
              {drop ? 'On no order' : 'On no order — nothing to release'}
            </span>
          )}
        </div>
      )}

      {/* ── what the barrier said ───────────────────────────────────────── */}
      {(move.findings.length > 0 || blocked.length > 0 || move.error || move.placeMessage) && (
        <div className="gecko-move-notes">
          {/* The place picked was taken, so the server moved to the next free
              one like it. News, not a fault — hence blue. */}
          {move.placeMessage && (
            <div className="gecko-eirin-finding gecko-eirin-finding-info">
              <Icon name="info" size={13} /> <span>{move.placeMessage}</span>
            </div>
          )}
          {move.error && !move.error.fieldErrors && (
            <div className="gecko-eirin-finding gecko-eirin-finding-block">
              <Icon name="alertCircle" size={13} /> {move.error.message}
            </div>
          )}
          {blocked.map(h => (
            <div key={h.containerHoldId} className="gecko-eirin-finding gecko-eirin-finding-block">
              <Icon name="lock" size={13} /> Hold {h.holdCode}{h.description ? ` — ${h.description}` : ''}
              {h.releaseAuthority ? ` · released by ${h.releaseAuthority}` : ''}
            </div>
          ))}
          {move.findings.map((f, i) => <FindingLine key={`${f.code}-${i}`} finding={f} />)}
        </div>
      )}

      {/* ── the detail ──────────────────────────────────────────────────── */}
      {open && !done && (
        <div className="gecko-move-body">
          {/* The order, raised with the box when it is on none. */}
          {!carries && drop && (
            <Section title="Blind gate-in">
              <div className="gecko-gate-grid-4">
                <GateField label="Shipping line" required error={err('lineCode')}>
                  <select className="gecko-input" value={move.lineCode}
                    onChange={e => onChange({ lineCode: e.target.value })}>
                    <option value="">Choose…</option>
                    {lines.map(l => <option key={l.partyCode} value={l.partyCode}>{l.partyCode} - {l.nameEn}</option>)}
                  </select>
                </GateField>
                <GateField label="Customer" required error={err('customerCode')}>
                  <select className="gecko-input" value={move.customerCode}
                    onChange={e => onChange({ customerCode: e.target.value })}>
                    <option value="">Choose…</option>
                    {customers.map(c => <option key={c.partyCode} value={c.partyCode}>{c.partyCode} - {c.nameEn}</option>)}
                  </select>
                </GateField>
                <GateField label="Equipment type" error={err('equipmentTypeCode')}
                  required={move.known?.isInRegistry === false}>
                  <select className="gecko-input" value={move.equipmentTypeCode}
                    onChange={e => onChange({ equipmentTypeCode: e.target.value })}>
                    <option value="">From the registry</option>
                    {equipmentTypes.filter(t => t.isActive).map(t => (
                      <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} - {t.descriptionEn}</option>
                    ))}
                  </select>
                </GateField>
                <GateField label="Agent" error={err('agentCode')}>
                  <select className="gecko-input" value={move.agentCode}
                    onChange={e => onChange({ agentCode: e.target.value })}>
                    <option value="">Not stated</option>
                    {lines.map(l => <option key={l.partyCode} value={l.partyCode}>{l.partyCode} - {l.nameEn}</option>)}
                  </select>
                </GateField>
              </div>
            </Section>
          )}

          {pickupHasNoOrder(move) && (
            <div className="gecko-eirin-finding gecko-eirin-finding-block">
              <Icon name="alertCircle" size={13} />
              A pick-up releases a box that is already on an order. This one is on none, so there is nothing
              to release — raise the booking first, or record it as a drop-off.
            </div>
          )}

          {/* ── Trip information, in Vector's three columns ──────────────
              Column one is the box and what is on it, column two how it is
              built and papered, column three what the booking and the
              weighbridge say. Greyed fields are not disabled for neatness:
              each one is owned by something other than this clerk. */}
          <div className="gecko-trip-grid">

            {/* ── 1 ─────────────────────────────────────────────────────── */}
            <div className="gecko-trip-col">
              <GateField label="Trip type" frozen>
                <div className="gecko-readonly-value">{drop ? 'Drop-off cont' : 'Pick-up cont'}</div>
              </GateField>

              <GateField label="Customer" required={!carries} error={err('customerCode')}
                frozen={carries}>
                {carries ? (
                  <div className="gecko-readonly-value gecko-text-mono">{move.customerCode || '—'}</div>
                ) : (
                  <select className="gecko-input" value={move.customerCode}
                    onChange={e => onChange({ customerCode: e.target.value })}>
                    <option value="">Choose…</option>
                    {customers.map(c => <option key={c.partyCode} value={c.partyCode}>{c.partyCode} - {c.nameEn}</option>)}
                  </select>
                )}
              </GateField>

              <GateField label="Container class" error={err('gradeCode')}>
                <input className="gecko-input gecko-text-mono" value={move.gradeCode} maxLength={10}
                  placeholder="NONE" onChange={e => onChange({ gradeCode: e.target.value.toUpperCase() })} />
              </GateField>

              <GateField label="Temperature °C" error={err('temperatureC')}
                frozen={!editable(move, 'reefer')}>
                <input className="gecko-input" type="number" step="0.1" min={-70} max={40}
                  value={move.temperatureC} disabled={!editable(move, 'reefer')}
                  onChange={e => onChange({ temperatureC: e.target.value })} />
              </GateField>

              <GateField label="Vent" error={err('ventSetting')} frozen={!editable(move, 'reefer')}>
                <input className="gecko-input" maxLength={20} value={move.ventSetting}
                  disabled={!editable(move, 'reefer')}
                  onChange={e => onChange({ ventSetting: e.target.value })} />
              </GateField>

              <GateField label="Humidity %" error={err('humidityPct')} frozen={!editable(move, 'reefer')}>
                <input className="gecko-input" type="number" min={0} max={100} value={move.humidityPct}
                  disabled={!editable(move, 'reefer')}
                  onChange={e => onChange({ humidityPct: e.target.value })} />
              </GateField>

              <GateField label="Agent seal" required={needs('seals')} error={err('seals')}>
                <input className="gecko-input gecko-text-mono" maxLength={20} value={move.seals[0]?.sealNo ?? ''}
                  onChange={e => patchSeal(0, { sealNo: e.target.value.toUpperCase() })} />
              </GateField>

              <GateField label="Cust. seal">
                <input className="gecko-input gecko-text-mono" maxLength={20} value={move.seals[1]?.sealNo ?? ''}
                  aria-label="Customer seal"
                  onChange={e => patchSeal(1, { sealNo: e.target.value.toUpperCase() })} />
              </GateField>

              <GateField label="Remarks" error={err('remarks')}>
                <textarea className="gecko-textarea gecko-input" rows={3} maxLength={300} value={move.remarks}
                  onChange={e => onChange({ remarks: e.target.value })} />
              </GateField>
            </div>

            {/* ── 2 ─────────────────────────────────────────────────────── */}
            <div className="gecko-trip-col">
              <GateField label="Empty / loaded" frozen>
                <div className="gecko-readonly-value">{load ?? 'from the booking'}</div>
              </GateField>

              <GateField label="Agent" error={err('agentCode')} frozen={carries}>
                {carries ? (
                  <div className="gecko-readonly-value gecko-text-mono">{move.agentCode || '—'}</div>
                ) : (
                  <select className="gecko-input" value={move.agentCode}
                    onChange={e => onChange({ agentCode: e.target.value })}>
                    <option value="">Not stated</option>
                    {lines.map(l => <option key={l.partyCode} value={l.partyCode}>{l.partyCode} - {l.nameEn}</option>)}
                  </select>
                )}
              </GateField>

              <GateField label="Size - type" error={err('equipmentTypeCode')} frozen={carries}>
                {carries ? (
                  <div className="gecko-readonly-value gecko-text-mono">{move.equipmentTypeCode || '—'}</div>
                ) : (
                  <select className="gecko-input" value={move.equipmentTypeCode}
                    onChange={e => onChange({ equipmentTypeCode: e.target.value })}>
                    <option value="">From the registry</option>
                    {equipmentTypes.filter(t => t.isActive).map(t => (
                      <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} - {t.descriptionEn}</option>
                    ))}
                  </select>
                )}
              </GateField>

              <GateField label="Status" error={err('conditionCode')}>
                <select className="gecko-input" value={move.conditionCode}
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
                  <select className="gecko-input" value={move.materialCode} aria-label="Material"
                    onChange={e => onChange({ materialCode: e.target.value })}>
                    <option value="">—</option>
                    {['STL', 'ALU', 'GRP'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {/* Left blank, the equipment type's own height class is kept. */}
                  <select className="gecko-input" value={move.heightCode} aria-label="Height"
                    onChange={e => onChange({ heightCode: e.target.value })}>
                    <option value="">From the type</option>
                    <option value="STANDARD">Standard</option>
                    <option value="HIGH_CUBE">High cube</option>
                    <option value="HALF">Half</option>
                  </select>
                </div>
              </GateField>

              <GateField label="Clip-on no." error={err('clipOnNo')} frozen={!editable(move, 'clipOn')}>
                <input className="gecko-input gecko-text-mono" maxLength={20} value={move.clipOnNo}
                  disabled={!editable(move, 'clipOn')}
                  onChange={e => onChange({ clipOnNo: e.target.value.toUpperCase() })} />
              </GateField>

              <GateField label="Customs permit no." required={needs('customsPermitNo')}
                error={err('customsPermitNo')} frozen={!editable(move, 'permit')}>
                <input className="gecko-input gecko-text-mono" maxLength={40} value={move.customsPermitNo}
                  disabled={!editable(move, 'permit')}
                  onChange={e => onChange({ customsPermitNo: e.target.value.toUpperCase() })} />
              </GateField>

              <GateField label={locationLabel(move)} error={err('nextLocationCode')}>
                <input className="gecko-input gecko-text-mono" maxLength={20} value={move.nextLocationCode}
                  onChange={e => onChange({ nextLocationCode: e.target.value.toUpperCase() })} />
              </GateField>
            </div>

            {/* ── 3 ─────────────────────────────────────────────────────── */}
            <div className="gecko-trip-col">
              <GateField label="Booking type" frozen>
                <div className="gecko-readonly-value">
                  {move.bookingTypeCode || (carries ? '—' : 'IMPORT · blind')}
                </div>
              </GateField>

              <GateField label="Order type" frozen>
                <div className="gecko-readonly-value">{orderTypeCode || 'BLIND GATE IN'}</div>
              </GateField>

              <GateField label="Vessel name" frozen>
                <div className="gecko-readonly-value">{move.vesselName || '—'}</div>
              </GateField>

              <GateField label="Voyage no." frozen>
                <div className="gecko-readonly-value gecko-text-mono">{move.voyageNo || '—'}</div>
              </GateField>

              <GateField label="Tare weight kg" required={needs('tareWeightKg')} error={err('tareWeightKg')}>
                <input className="gecko-input" type="number" min={0} value={move.tareWeightKg}
                  onChange={e => onChange({ tareWeightKg: e.target.value })} />
              </GateField>

              <GateField label="Max gross weight kg" required={needs('maxGrossWeightKg')}
                error={err('maxGrossWeightKg')}>
                <input className="gecko-input" type="number" min={0} value={move.maxGrossWeightKg}
                  onChange={e => onChange({ maxGrossWeightKg: e.target.value })} />
              </GateField>

              <GateField label="Cargo weight kg" required={needs('cargoWeightKg')} error={err('cargoWeightKg')}
                frozen={!editable(move, 'cargo')}>
                <input className="gecko-input" type="number" min={0} value={move.cargoWeightKg}
                  disabled={!editable(move, 'cargo')}
                  onChange={e => onChange({ cargoWeightKg: e.target.value })} />
              </GateField>

              {/* Computed, as Vector computes it — never typed. */}
              <GateField label="Gross weight kg" frozen>
                <div className={`gecko-readonly-value gecko-text-mono${overMaxWeight(move) ? ' gecko-tone-error' : ''}`}>
                  {grossOf(move)?.toLocaleString() ?? '—'}
                </div>
              </GateField>

              <GateField label="VGM kg" error={err('vgmKg')}>
                <input className="gecko-input" type="number" min={0} value={move.vgmKg}
                  onChange={e => onChange({ vgmKg: e.target.value })} />
              </GateField>

              <GateField label="Genset no." error={err('gensetNo')}>
                <div className="gecko-row gecko-gap-1">
                  <select className="gecko-input gecko-genset-mode" value={move.gensetMode}
                    aria-label="Genset fitted"
                    onChange={e => onChange({
                      gensetMode: e.target.value as 'NO' | 'YES',
                      gensetNo: e.target.value === 'NO' ? '' : move.gensetNo,
                    })}>
                    <option value="NO">NO</option>
                    <option value="YES">YES</option>
                  </select>
                  <input className="gecko-input gecko-text-mono" maxLength={20} value={move.gensetNo}
                    disabled={move.gensetMode === 'NO'} aria-label="Genset number"
                    onChange={e => onChange({ gensetNo: e.target.value.toUpperCase() })} />
                </div>
              </GateField>

              <GateField label="Paperless code" error={err('paperlessCode')}>
                <input className="gecko-input gecko-text-mono" maxLength={40} value={move.paperlessCode}
                  onChange={e => onChange({ paperlessCode: e.target.value.toUpperCase() })} />
              </GateField>
            </div>
          </div>

          {overMaxWeight(move) && (
            <div className="gecko-move-issues">
              <Icon name="alertCircle" size={13} />
              <span>
                Over max weight — tare + cargo is {grossOf(move)?.toLocaleString()} kg against a plate
                limit of {Number(move.maxGrossWeightKg).toLocaleString()} kg. It can still be recorded.
              </span>
            </div>
          )}

          {drop && (
            <Section title="Where it goes">
              <div className="gecko-gate-grid-4">
                <GateField label="Yard" error={err('yardId')}>
                  <select className="gecko-input" value={move.yardId}
                    onChange={e => onChange({ yardId: e.target.value })}>
                    <option value="">Not stated</option>
                    {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} - {y.nameEn}</option>)}
                  </select>
                </GateField>
                <GateField label="Position" error={err('positionText')}>
                  <input className="gecko-input gecko-text-mono" maxLength={40} value={move.positionText}
                    placeholder="A-03-2-1"
                    onChange={e => onChange({ positionText: e.target.value.toUpperCase() })} />
                </GateField>
              </div>
            </Section>
          )}

          {move.vasMenu.length > 0 && (
            <Section title="VAS">
              <VasPanel
                menu={move.vasMenu}
                ticked={move.vasTicked}
                disabled={done}
                currency={move.due[0]?.currencyCode ?? 'THB'}
                onToggle={onToggleVas} />
            </Section>
          )}

          {/* A damaged drop-off carries its survey into the same Save. */}
          {isDamaged(move) && (
            <Section title="Damage">
              <DamagePanel
                damages={move.damages}
                disabled={done}
                onChange={damages => onChange({ damages })} />
            </Section>
          )}

          {/* Only when the server has actually asked for a reason. */}
          {(needsDigitReason(move) || needsLateReason(move)) && (
            <Section title="Override">
              <div className="gecko-gate-grid-2">
                {needsDigitReason(move) && (
                  <GateField label="Check-digit override reason" required error={err('checkDigitOverrideReason')}>
                    <input className="gecko-input" maxLength={200} value={move.checkDigitOverrideReason}
                      onChange={e => onChange({ checkDigitOverrideReason: e.target.value })} />
                  </GateField>
                )}
                {needsLateReason(move) && (
                  <GateField label="Late gate-in reason" required error={err('lateOverrideReason')}>
                    <input className="gecko-input" maxLength={200} value={move.lateOverrideReason}
                      onChange={e => onChange({ lateOverrideReason: e.target.value })} />
                  </GateField>
                )}
              </div>
            </Section>
          )}

          {issues.length > 0 && (
            <div className="gecko-move-issues">
              <Icon name="alertCircle" size={13} />
              <span>Still to fill: {issues.join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {/* A saved row is a record, not a form. A pick-up has no EIR yet: it is
          paid for and held, and Gate Out releases it against this same visit. */}
      {open && done && move.result && (
        <div className="gecko-move-body">
          <div className="gecko-eirin-readback">
            <Readback label="Outcome" value={move.result.status === 'GATED' ? 'Gated in'
              : move.result.status === 'PLANNED' ? 'Waiting for gate out' : move.result.status} />
            <Readback label="EIR" value={move.result.eirNo ?? '—'} />
            <Readback label="Coupon" value={move.result.couponRef ?? '—'} />
            <Readback label="Order" value={move.result.orderNo} />
            {move.result.surveyId && <Readback label="Survey" value={move.result.surveyId.slice(0, 8)} />}
            {(move.result.holdsApplied ?? []).length > 0 && (
              <Readback label="Holds put on" value={(move.result.holdsApplied ?? []).join(', ')} />
            )}
          </div>
          {move.result.reason && (
            <div className="gecko-eirin-finding gecko-eirin-finding-block">
              <Icon name="alertCircle" size={13} /> <span>{move.result.reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FindingLine({ finding }: { finding: GateFinding }) {
  const tone = finding.severity === 'BLOCK' ? 'block'
    : finding.severity === 'OVERRIDE' ? 'override'
    : finding.severity === 'WARN' ? 'override' : 'info';
  return (
    <div className={`gecko-eirin-finding gecko-eirin-finding-${tone}`}>
      <Icon name={finding.severity === 'INFO' ? 'info' : 'alertCircle'} size={13} />
      <span>{finding.message}</span>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="gecko-move-section">
      <div className="gecko-move-section-head">
        <div className="gecko-field-label">{title}</div>
        {desc && <div className="gecko-cell-meta">{desc}</div>}
      </div>
      <div className="gecko-flex-1 gecko-min-w-0">{children}</div>
    </section>
  );
}

function Readback({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="gecko-field-label">{label}</div>
      <div className="gecko-readonly-value gecko-text-mono">{value}</div>
    </div>
  );
}
