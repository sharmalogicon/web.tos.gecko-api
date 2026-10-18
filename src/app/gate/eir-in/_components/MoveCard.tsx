"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useApiList } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useConditions } from '@/lib/api/lookups';
import { formatContainerNo, type GateFinding } from '@/lib/api/tos';
import { GateField } from '../../_components/GateField';
import { VasPanel } from './VasPanel';
import { DamagePanel } from './DamagePanel';
import { BookingPicker, type BookableBox } from '../../_components/BookingPicker';
import { WalkInBoxPicker } from './WalkInBoxPicker';
import { PartyPicker } from '@/components/ui/PartyPicker';
import {
  NO_WALK_IN_ORDER_TYPE, WALK_IN_REFUSALS, walkInOrderTypeFor, type WalkInBox, type WalkInOrderType,
} from '@/lib/api/walk-in';
import {
  boxLooksRight, mayMintNumber, needsDigitReason, needsLateReason,
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

export function MoveCard({
  move, index, open, branchId, takenBoxes, onToggle, onChange, onRemove, onLook, onRecord,
  onPickBooking, onToggleVas, canRecord, walkInTypes, draftId, onPickWalkInBox, onMakeWalkIn,
  walkInOnTruck,
}: {
  move: MoveDraft;
  index: number;
  open: boolean;
  branchId: string;
  /** Boxes already on this truck, so the picker cannot offer one twice. */
  takenBoxes: string[];
  /** The tenant's walk-in order types, read once by the page. */
  walkInTypes: WalkInOrderType[] | null;
  /** This screen's draft, so the yard picker does not offer a box we hold. */
  draftId: string | null;
  onPickWalkInBox: (box: WalkInBox) => void;
  /** Walk-in rows already on this truck, by order type code (R5). */
  walkInOnTruck: Record<string, number>;
  /** Turn a row that found no booking into a walk-in. */
  onMakeWalkIn: () => void;
  onPickBooking: (box: BookableBox) => void;
  onToggleVas: (chargeCode: string) => void;
  onToggle: () => void;
  onChange: (patch: Partial<MoveDraft>) => void;
  onRemove: () => void;
  onLook: () => void;
  onRecord: () => void;
  canRecord: boolean;
}) {
  /**
   * The parties are SEARCHED, not listed.
   *
   * These were two `pageSize=200` reads behind plain dropdowns. KORAKIT has far
   * more customers than that, so the list stopped inside the A's and a clerk
   * could not reach — or type — anything after it (owner 2026-10-15). PartyPicker
   * asks the server per keystroke and takes a typed code when the search cannot
   * reach the API at all.
   */
  const { data: equipmentRows, error: equipmentError } =
    useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const { yards } = useFacility();
  const { conditions } = useConditions();

  // useApiList answers null until the first page lands; an empty list renders
  // the same and keeps every map below free of a guard.
  const equipmentTypes = equipmentRows ?? [];
  /**
   * A gate clerk cannot read the equipment types: that list is
   * RequirePermission(mdm.equipment.view), tenant-wide, and the gate role does
   * not hold it. The select was simply empty, with no hint why.
   */
  const equipmentDenied = equipmentError?.status === 403;

  const drop = move.trip === 'DROP_OFF_CONT';
  // Held and priced — not committed. The Save is what writes it.
  const held = move.reserved;
  const done = !!move.result;
  const required = requiredFor(move);
  const needs = (f: string) => required.includes(f);
  /**
   * This row's message for a field.
   *
   * A 400 from the big Save keys its errors by position \u2014
   * `rows[2].walkIn.customerCode`, `rows[2].move.containerNo` \u2014 while the
   * single-box calls key them bare. Both are tried, so the same `err('customerCode')`
   * works whichever call refused, and nothing has to be re-keyed at the call site.
   */
  const err = (f: string) => move.error?.forField(f)
    ?? move.error?.forField(`rows[${index}].${f}`)
    ?? move.error?.forField(`rows[${index}].walkIn.${f}`)
    ?? move.error?.forField(`rows[${index}].move.${f}`);
  /** The truck-wide `rows` message, shown by the walk-in block that caused it. */
  const rowsErr = move.error?.forField('rows');
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
  // The booking's own step says whether the gate-in needs a damage survey (R6).
  const needsSurvey = step?.requiresSurvey === true;
  /**
   * A box that turned up with no readable number. The gate issues NOID+7 for a
   * walk-in DROP-OFF only (API 2026-10-18) — a pick-up names a box already in
   * the yard, and a booked box takes its number from the booking.
   */
  const canMint = mayMintNumber(move);
  const willMint = canMint && !move.containerNo.trim();

  // ── walk-in ────────────────────────────────────────────────────────────
  // The clerk's two answers name the order type; the clerk never picks one.
  const walkInType = move.isWalkIn ? walkInOrderTypeFor(walkInTypes, move.trip, move.fullEmpty) : null;
  // A combination the tenant has not set up. Said on the toggle rather than
  // left for the Save to refuse after the truck is at the barrier.
  const walkInMissing = move.isWalkIn && !!move.fullEmpty && !!walkInTypes && !walkInType;
  const hasWalkInLoad = (load: 'FULL' | 'EMPTY') =>
    !walkInTypes || !!walkInOrderTypeFor(walkInTypes, move.trip, load);
  // R5. Counted across the truck, so the row that tips it over is the one that says so.
  const overCap = !!walkInType?.maxBoxesPerTruck
    && (walkInOnTruck[walkInType.orderTypeCode] ?? 0) > walkInType.maxBoxesPerTruck;

  /**
   * Who pays, per box.
   *
   * The payment panel totals the truck, which is right for the drawer and wrong
   * for the clerk looking at one card: a credit customer's box and a box that
   * simply costs nothing both showed 0.00 and no explanation. The over-limit
   * case is the one that bites \u2014 a customer normally on account that has to
   * pay cash today.
   */
  const overLimitNote = move.moneyNotes.find(t => t.outcome === 'CREDIT_LIMIT_REACHED');
  const onAccount = !overLimitNote && move.quoteTotal === 0
    ? move.moneyNotes.find(t => t.outcome === 'CUSTOMER_ON_CREDIT')
    : undefined;

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
            comes first — the box follows from the booking line they pick.
            A walk-in truck has no paperwork at all, so in its place the row
            shows the order type its two answers named. */}
        <div className="gecko-move-bl">
          {move.isWalkIn ? (
            <span className="gecko-walkin-chip" title="Raised by the Save: one booking per truck, customer and line.">
              <Icon name="zap" size={12} />
              {walkInType ? walkInType.orderTypeCode : move.fullEmpty ? 'no order type' : 'walk-in'}
            </span>
          ) : (
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
          )}
        </div>

        <div className="gecko-move-box">
          {/* A walk-in PICK-UP cannot have its number typed: the box has to be
              one standing in this yard, free to go. The picker applies that;
              typing would only invite a 400 the clerk cannot act on. */}
          {move.isWalkIn && !drop ? (
            <WalkInBoxPicker
              branchId={branchId}
              fullEmpty={move.fullEmpty}
              draftId={draftId}
              exclude={takenBoxes}
              value={move.containerNo}
              disabled={done}
              onPick={onPickWalkInBox} />
          ) : (
            <input
              className={`gecko-input gecko-input-sm gecko-text-mono${err('containerNo') ? ' gecko-input-error' : ''}`}
              value={move.containerNo}
              disabled={done}
              maxLength={14}
              placeholder={canMint ? 'Leave blank if unreadable' : 'MSKU1234565'}
              aria-label={`Container number for box ${index + 1}`}
              onChange={e => onChange({ containerNo: normaliseBox(e.target.value) })}
              // Nothing to look up when the field is empty, and on a mintable
              // row empty is a legitimate answer rather than a half-typed one.
              onBlur={() => { if (move.containerNo.trim() && boxLooksRight(move.containerNo)) onLook(); }} />
          )}
          {move.looking && <span className="gecko-cell-meta">looking…</span>}
          {willMint && !done && (
            <span className="gecko-cell-meta gecko-move-mint-hint">
              The gate will issue one (NOID…) to write on the box.
            </span>
          )}
        </div>

        <div className="gecko-move-spacer" />

        {done ? (
          <span className="gecko-move-eir">
            {move.result!.containerNoWasMinted && (
              <span className="gecko-badge gecko-badge-warning gecko-mono" title="Write this number on the box">
                {formatContainerNo(move.result!.containerNo)}
              </span>
            )}
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
              disabled={!canRecord || move.saving || issues.length > 0 || pickupHasNoOrder(move)
                || overCap || walkInMissing}
              onClick={onRecord}>
              {/* Holding a place and pricing the box is a round trip too, so it
                  spins rather than just greying out. */}
              {move.saving ? <span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> : <Icon name="plus" size={13} />}
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
          {overLimitNote && (
            <div className="gecko-eirin-finding gecko-eirin-finding-override">
              <Icon name="alertCircle" size={13} />
              <span>
                Over credit limit \u2014 cash this time.
                {overLimitNote.note && <span className="gecko-walkin-advice">{overLimitNote.note}</span>}
              </span>
            </div>
          )}
          {onAccount && (
            <div className="gecko-eirin-finding">
              <Icon name="info" size={13} />
              <span>
                Billed to the customer&rsquo;s account \u2014 nothing to collect for this box.
                {onAccount.note && <span className="gecko-walkin-advice">{onAccount.note}</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── the detail ──────────────────────────────────────────────────── */}
      {open && !done && (
        <div className="gecko-move-body">
          {/* WHAT IS STILL MISSING, AT THE TOP. It used to sit under the last
              field of a card three screens long, so a clerk who could not see
              why Add trip was dead had to scroll to the bottom to be told —
              past the very fields it was naming (owner 2026-10-18). */}
          {issues.length > 0 && (
            <div className="gecko-move-issues">
              <Icon name="alertCircle" size={13} />
              <span>Still to fill: {issues.join(' · ')}</span>
            </div>
          )}

          {/* Not a blocker — the box can still be recorded — but it belongs
              with the other card-level messages rather than beside the weight
              fields three screens down. */}
          {overMaxWeight(move) && (
            <div className="gecko-move-issues gecko-move-issues-warn">
              <Icon name="alertCircle" size={13} />
              <span>
                Over max weight — tare + cargo is {grossOf(move)?.toLocaleString()} kg against a plate
                limit of {Number(move.maxGrossWeightKg).toLocaleString()} kg. It can still be recorded.
              </span>
            </div>
          )}

          {/* ── Walk-in: the truck arrived with no paperwork ──────────
              Two toggles, a customer, and on a drop-off the box's own facts.
              The order type is NOT a field: it follows from the answers, and
              is shown read-only so the clerk can see what they have chosen. */}
          {move.isWalkIn && (
            <Section title="Walk-in (no booking)" wide>
              <div className="gecko-walkin-answers">
                <div className="gecko-walkin-toggle">
                  <span className="gecko-eyebrow">The truck is here to</span>
                  <div className="gecko-segmented gecko-segmented-sm">
                    {([['DROP_OFF_CONT', 'Drop off'], ['PICK_UP_CONT', 'Pick up']] as const).map(([trip, label]) => (
                      <button key={trip} type="button"
                        className={`gecko-segmented-item${move.trip === trip ? ' gecko-segmented-item-active' : ''}`}
                        disabled={done}
                        onClick={() => onChange({
                          trip,
                          // The box, its line and its type all belonged to the
                          // other answer; keeping them would send a yard box's
                          // facts on a drop-off, or the reverse.
                          containerNo: '', known: null, lineCode: '', equipmentTypeCode: '',
                        })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gecko-walkin-toggle">
                  <span className="gecko-eyebrow">The box is</span>
                  <div className="gecko-segmented gecko-segmented-sm">
                    {([['EMPTY', 'Empty'], ['FULL', 'Full']] as const).map(([loadAnswer, label]) => {
                      const offered = hasWalkInLoad(loadAnswer);
                      return (
                        <button key={loadAnswer} type="button"
                          className={`gecko-segmented-item${move.fullEmpty === loadAnswer ? ' gecko-segmented-item-active' : ''}`}
                          disabled={done || !offered}
                          title={offered ? undefined : NO_WALK_IN_ORDER_TYPE}
                          onClick={() => onChange({
                            fullEmpty: loadAnswer,
                            // A pick-up's box was chosen for the old load, so it
                            // goes; a drop-off's was keyed and stands.
                            containerNo: drop ? move.containerNo : '',
                            known: drop ? move.known : null,
                          })}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="gecko-walkin-toggle">
                  <span className="gecko-eyebrow">Order type</span>
                  <div className="gecko-readonly-value gecko-text-mono">
                    {walkInType ? walkInType.orderTypeCode : move.fullEmpty ? '—' : 'Answer both'}
                  </div>
                  {walkInType?.description && <span className="gecko-cell-meta">{walkInType.description}</span>}
                </div>
              </div>

              {walkInMissing && (
                <div className="gecko-eirin-finding gecko-eirin-finding-block">
                  <Icon name="alertCircle" size={13} /> {NO_WALK_IN_ORDER_TYPE}
                </div>
              )}
              {rowsErr && (
                <div className="gecko-eirin-finding gecko-eirin-finding-block">
                  <Icon name="alertCircle" size={13} /> {rowsErr}
                </div>
              )}
              {walkInType?.maxBoxesPerTruck != null && (
                overCap ? (
                  <div className="gecko-eirin-finding gecko-eirin-finding-block">
                    <Icon name="alertCircle" size={13} />
                    This truck already carries {walkInOnTruck[walkInType.orderTypeCode] ?? 0} boxes on{' '}
                    {walkInType.orderTypeCode}, and it takes at most {walkInType.maxBoxesPerTruck}. Remove a row,
                    or send the rest on a second truck.
                  </div>
                ) : (
                  <div className="gecko-cell-meta">
                    {walkInOnTruck[walkInType.orderTypeCode] ?? 0} of at most {walkInType.maxBoxesPerTruck}{' '}
                    box{walkInType.maxBoxesPerTruck === 1 ? '' : 'es'} of this order type on one truck.
                  </div>
                )
              )}

              <div className="gecko-gate-grid-4">
                <GateField label="Customer" required error={err('walkIn.customerCode') ?? err('customerCode')}>
                  <PartyPicker role="CUSTOMER" value={move.customerCode || null} disabled={done} nameFirst
                    placeholder="Search the customer…"
                    onChange={code => onChange({ customerCode: code ?? '' })} />
                </GateField>

                {/* A pick-up's line and type are the YARD's, not the clerk's:
                    they arrive with the box and are shown, not asked. */}
                {drop ? (
                  <>
                    <GateField label="Shipping line" required error={err('walkIn.lineCode') ?? err('lineCode')}
                      hint={willMint ? 'Required: there is no registry entry to take it from.'
                        : move.known?.isInRegistry ? 'Leave it empty to take the registry\u2019s owner.' : undefined}>
                      <PartyPicker role="SHIPPING_LINE" value={move.lineCode || null} disabled={done} nameFirst
                        placeholder="Search the line\u2026"
                        onChange={code => onChange({ lineCode: code ?? '' })} />
                    </GateField>
                    {/* With no number there is no registry entry to fall back
                        on, so the API requires the type outright. */}
                    <GateField label="Box type" error={err('walkIn.equipmentTypeCode') ?? err('equipmentTypeCode')}
                      required={willMint || move.known?.isInRegistry === false}
                      hint={equipmentDenied
                        ? 'The type list needs mdm.equipment.view, which this account does not hold \u2014 type the code.'
                        : undefined}>
                      {equipmentDenied ? (
                        <input className="gecko-input gecko-text-mono" value={move.equipmentTypeCode} disabled={done}
                          maxLength={20} placeholder="20GP"
                          onChange={e => onChange({ equipmentTypeCode: e.target.value.toUpperCase() })} />
                      ) : (
                        <select className="gecko-input" value={move.equipmentTypeCode} disabled={done}
                          onChange={e => onChange({ equipmentTypeCode: e.target.value })}>
                          <option value="">{willMint ? 'Choose…' : 'From the registry'}</option>
                          {equipmentTypes.filter(t => t.isActive).map(t => (
                            <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} - {t.descriptionEn}</option>
                          ))}
                        </select>
                      )}
                    </GateField>
                  </>
                ) : (
                  <>
                    <GateField label="Shipping line" frozen>
                      <div className="gecko-readonly-value">{move.lineCode || '—'}</div>
                    </GateField>
                    <GateField label="Equipment type" frozen>
                      <div className="gecko-readonly-value">{move.equipmentTypeCode || '—'}</div>
                    </GateField>
                  </>
                )}

              </div>
            </Section>
          )}

          {/* A row with no booking that is not a walk-in can no longer be sent:
              BLIND GATE IN is gone from this screen. One button turns the row
              into the thing it actually is. */}
          {!move.isWalkIn && !carries && !done && (
            <div className="gecko-eirin-finding gecko-walkin-offer">
              <Icon name="info" size={13} />
              <span>
                No booking on this row. If the truck came with no paperwork, record it as a walk-in — the Save
                raises the booking.
              </span>
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onMakeWalkIn}>
                <Icon name="zap" size={13} /> Make it a walk-in
              </button>
            </div>
          )}

          {/* R6 \u2014 THE SURVEY TICK, ON EVERY DROP-OFF, not only a walk-in.
              A booked drop-off whose order-type step sets requireSurvey is
              refused with SURVEY_REQUIRED, and the only other way to satisfy it
              was to list a damage \u2014 which the clerk cannot do on a sound box.
              A CLEAN survey counts, which is why this is a tick and not merely
              "were any damages listed". */}
          {drop && !done && (
            <Section title="Survey" wide>
              <label className="gecko-walkin-surveyed">
                <input type="checkbox" className="gecko-checkbox"
                  checked={move.surveyed || move.damages.length > 0}
                  disabled={move.damages.length > 0}
                  title={move.damages.length > 0 ? 'Damages are listed, so the box is surveyed.' : undefined}
                  onChange={e => onChange({ surveyed: e.target.checked })} />
                <span>
                  <span className="gecko-ot-rule-name">
                    Surveyed{needsSurvey && <span className="gecko-required-mark"> *</span>}
                  </span>
                  <span className="gecko-cell-meta">
                    {move.damages.length > 0
                      ? `${move.damages.length} damage${move.damages.length === 1 ? '' : 's'} listed, so the box is surveyed.`
                      : needsSurvey
                        ? 'This step will not gate the box in without a survey. Tick it for "none found", or list the damages above.'
                        : 'Tick it to record a clean survey with the gate-in.'}
                  </span>
                </span>
              </label>
              {err('surveyed') && <div className="gecko-field-error">{err('surveyed')}</div>}
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
                  <PartyPicker role="CUSTOMER" value={move.customerCode || null} nameFirst
                    placeholder="Search the customer…"
                    onChange={code => onChange({ customerCode: code ?? '' })} />
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
                  <PartyPicker role="SHIPPING_LINE" value={move.agentCode || null} nameFirst
                    placeholder="Search the agent…"
                    onChange={code => onChange({ agentCode: code ?? '' })} />
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
                  {move.bookingTypeCode || (carries ? '—' : move.isWalkIn ? 'raised by the Save' : '—')}
                </div>
              </GateField>

              <GateField label="Order type" frozen>
                {/* A walk-in has no order type until both answers are in; it is
                    never BLIND GATE IN any more. */}
                <div className="gecko-readonly-value">
                  {orderTypeCode || walkInType?.orderTypeCode || '—'}
                </div>
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
        </div>
      )}

      {/* A saved row is a record, not a form. A pick-up has no EIR yet: it is
          paid for and held, and Gate Out releases it against this same visit. */}
      {open && done && move.result && (
        <div className="gecko-move-body">
          {/* THE BOX HAS NO NUMBER OF ITS OWN. Nothing else identifies it, so
              this is an instruction, not a fact: it goes above the readback and
              says what to do with it. */}
          {move.result.containerNoWasMinted && (
            <div className="gecko-move-issues gecko-move-issues-warn">
              <Icon name="edit" size={13} />
              <span>
                Number issued by the gate: <strong className="gecko-mono">{formatContainerNo(move.result.containerNo)}</strong>.
                Write it on the box — nothing else identifies it.
              </span>
            </div>
          )}
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
  /**
   * The server's sentence says what is wrong; for the walk-in refusals we add
   * what to DO about it. Not a replacement — the server's wording carries the
   * detail (which grade, which order) and is always shown first.
   */
  const advice = WALK_IN_REFUSALS[finding.code];
  return (
    <div className={`gecko-eirin-finding gecko-eirin-finding-${tone}`}>
      <Icon name={finding.severity === 'INFO' ? 'info' : 'alertCircle'} size={13} />
      <span>
        {finding.message}
        {advice && <span className="gecko-walkin-advice">{advice}</span>}
      </span>
    </div>
  );
}

/**
 * A block of the move card.
 *
 * By default the title sits in a 190px gutter on the left, which reads well for
 * a short block. `wide` stacks it instead and gives the fields the whole width:
 * the walk-in block carries two toggles and four selects and, indented, it did
 * not line up with the Trip information grid beneath it (owner, 2026-10-09).
 */
function Section({ title, desc, wide, children }: {
  title: string; desc?: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={wide ? 'gecko-move-section-wide' : 'gecko-move-section'}>
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
