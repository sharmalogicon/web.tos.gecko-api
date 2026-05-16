"use client";
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { PageToolbar, Field } from '@/components/ui/OpsPrimitives';
import { useGatePrint, type GatePrintData, type GatePrintCharge } from '@/components/print/GatePrint';

// ── Constants ─────────────────────────────────────────────────────────────────

const ISO_TYPES = ['20GP', '20RF', '20TK', '40GP', '40HC', '40RF', '45HC'];

const STATUS_CODES = [
  { code: 'NOR', label: 'Normal',       kind: 'gray'    },
  { code: 'DMG', label: 'Damaged',      kind: 'warning' },
  { code: 'OOG', label: 'Out of Gauge', kind: 'warning' },
  { code: 'HLD', label: 'On Hold',      kind: 'error'   },
  { code: 'REF', label: 'Reefer',       kind: 'info'    },
];

const TRUCK_CATEGORIES = [
  { code: '6W',  label: '6-Wheel · light' },
  { code: '10W', label: '10-Wheel · standard' },
  { code: '18W', label: '18-Wheel · semi-trailer' },
  { code: '22W', label: '22-Wheel · double trailer' },
];

const ORDER_TYPES = ['IMP CY/CY', 'IMP CY/CFS', 'EMP REL', 'EXP CY/CY', 'EXP CFS/CY', 'EMP RTN'];

const DAMAGE_AREAS = ['Roof', 'Side wall', 'Floor', 'Door', 'End frame', 'Reefer machinery'];
const VGM_METHODS  = [{ k: '1', label: 'Weighed' }, { k: '2', label: 'Calculated' }];

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction  = 'IMPORT' | 'EXPORT' | 'EMPTY_OUT' | 'EMPTY_RETURN';
type CargoClass = 'NONE' | 'REEFER' | 'HAZ';
type Condition  = 'sound' | 'damaged';

interface ReleaseMove {
  id: number; status: 'active' | 'done' | 'pending';

  // Auto-filled context (from booking + master + gate-in EIR, normally pre-loaded; mocked for demo)
  bookingNo: string;
  customer: string;
  agent: string;
  agentCode: string;
  line: string;
  vessel: string;
  voyage: string;
  orderTypeDesc: string;
  edo: string;
  yardSpot: string;

  isLaden: boolean;
  direction: Direction;
  ctrPlanned: string;
  isoReq: string;
  teu: number;
  cargoClass: CargoClass;
  material: string;
  heightLabel: string;
  tareKg: number;
  maxGrossKg: number;
  cargoWeightKg: number | null;       // null for empty
  customsPermit: string;
  paperlessCode: string;
  vgmDeclaredKg: number | null;       // null if shipper didn't pre-declare

  // Reefer (when cargoClass === REEFER)
  reeferSetPoint: string;
  reeferVent: string;
  reeferGensetNo: string;
  reeferClipOnNo: string;
  reeferWorking: boolean;

  // HAZ (when cargoClass === HAZ)
  hazImoClass: string;
  hazUnNo: string;

  // Operator inputs
  ctrAssigned: string;
  linerSeal: string;
  shipperSeal: string;
  vgmKg: string;                       // operator key-in or confirms declared (string for input UX)
  vgmMethod: '1' | '2';
  condition: Condition;
  damageArea: string;
  damagePhotoTaken: boolean;
  hazPlacardsVerified: boolean;

  // Exception fields (collapsed by default)
  preTripPass: boolean;
  statusCode: string;
  notes: string;
}

interface ValidationIssue { moveId: number; level: 'error' | 'warn'; msg: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ kind }: { kind: string }) {
  const c = kind === 'success' ? 'var(--gecko-success-500)'
    : kind === 'warning' ? 'var(--gecko-warning-500)'
    : kind === 'error'   ? 'var(--gecko-error-500)'
    : 'var(--gecko-text-disabled)';
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block', marginRight: 3, flexShrink: 0 }} />;
}

function SubBlock({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gecko-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SegToggle({ value, options, onChange }: { value: string; options: { k: string; label: string }[]; onChange?: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', height: 32, border: '1px solid var(--gecko-border)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map((o, idx) => {
        const on = value === o.k;
        return (
          <button key={o.k} type="button" onClick={() => onChange?.(o.k)} style={{
            flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            background: on ? 'var(--gecko-primary-600)' : 'transparent',
            color: on ? '#fff' : 'var(--gecko-text-secondary)',
            borderRight: idx < options.length - 1 ? '1px solid var(--gecko-border)' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function SealField({ label, value, onChange, required, placeholder, span }: {
  label: string; value: string; onChange?: (v: string) => void;
  required?: boolean; placeholder?: string; span?: number;
}) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon name="lock" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
        <input
          className="gecko-input gecko-input-sm"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: value ? 600 : 400, paddingLeft: 32 }}
        />
      </div>
    </div>
  );
}

function ValidationLine({ ok, label, kind }: { ok: boolean; label: string; kind: string }) {
  const c = ok ? 'var(--gecko-success-600)'
    : kind === 'error'   ? 'var(--gecko-error-600)'
    : kind === 'warning' ? 'var(--gecko-warning-600)'
    : 'var(--gecko-success-600)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={ok ? 'check' : 'warning'} size={12} style={{ color: c, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: ok ? 'var(--gecko-text-secondary)' : 'var(--gecko-text-primary)' }}>{label}</span>
    </div>
  );
}

function MoveStatusBadge({ code }: { code: string }) {
  const def = STATUS_CODES.find(s => s.code === code) || STATUS_CODES[0];
  const k = def.kind;
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    error:   { bg: 'var(--gecko-error-50)',   fg: 'var(--gecko-error-700)',   bd: 'var(--gecko-error-200)'   },
    warning: { bg: 'var(--gecko-warning-50)', fg: 'var(--gecko-warning-700)', bd: 'var(--gecko-warning-200)' },
    info:    { bg: 'var(--gecko-info-50)',     fg: 'var(--gecko-info-700)',    bd: 'var(--gecko-info-200)'    },
    gray:    { bg: 'var(--gecko-bg-subtle)',   fg: 'var(--gecko-text-secondary)', bd: 'var(--gecko-border)'  },
  };
  const { bg, fg, bd } = map[k] ?? map.gray;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', borderRadius: 4, background: bg, color: fg, border: `1px solid ${bd}` }}>
      {def.code} · {def.label}
    </span>
  );
}

// ── Capacity bar ──────────────────────────────────────────────────────────────

function CapacityBar({ teuUsed, cap }: { teuUsed: number; cap: number }) {
  const pct = Math.min(100, (teuUsed / cap) * 100);
  return (
    <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--gecko-border)', background: '#fff', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
      <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>Release Capacity</span>
      <div style={{ position: 'relative', height: 8, background: 'var(--gecko-bg-subtle)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--gecko-border)' }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: teuUsed >= cap ? 'var(--gecko-warning-500)' : 'var(--gecko-primary-600)', borderRadius: '3px 0 0 3px', transition: 'width 0.2s' }} />
        {Array.from({ length: cap - 1 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) / cap) * 100}%`, width: 1, background: 'var(--gecko-border-strong)' }} />
        ))}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>
          {teuUsed}<span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}> / {cap} TEU</span>
        </div>
        <div style={{ fontSize: 10, color: teuUsed >= cap ? 'var(--gecko-warning-700)' : 'var(--gecko-text-secondary)', marginTop: 2, fontWeight: teuUsed >= cap ? 700 : 500 }}>
          {teuUsed >= cap ? 'AT CAPACITY' : `${cap - teuUsed} TEU available`}
        </div>
      </div>
    </div>
  );
}

// ── Context strip — read-only auto-filled info ─────────────────────────────────

function ContextRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 11.5, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--gecko-text-secondary)', minWidth: 88, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--gecko-text-primary)', fontWeight: 600, fontFamily: mono ? 'var(--gecko-font-mono)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function AutoFillContext({ move }: { move: ReleaseMove }) {
  const directionPill = (() => {
    if (move.direction === 'IMPORT')       return { l: 'LADEN IMPORT',  bg: 'var(--gecko-info-50)',    fg: 'var(--gecko-info-700)' };
    if (move.direction === 'EXPORT')       return { l: 'LADEN EXPORT',  bg: 'var(--gecko-primary-50)', fg: 'var(--gecko-primary-700)' };
    if (move.direction === 'EMPTY_OUT')    return { l: 'EMPTY HIRE-OUT', bg: 'var(--gecko-bg-subtle)', fg: 'var(--gecko-text-secondary)' };
    return                                        { l: 'EMPTY RETURN',  bg: 'var(--gecko-bg-subtle)', fg: 'var(--gecko-text-secondary)' };
  })();

  return (
    <div style={{ background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>From booking</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', borderRadius: 4, background: directionPill.bg, color: directionPill.fg }}>{directionPill.l}</span>
        {move.cargoClass === 'REEFER' && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', fontSize: 9.5, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-info-50)', color: 'var(--gecko-info-700)' }}>REEFER</span>}
        {move.cargoClass === 'HAZ'    && <span className="gecko-pill gecko-pill-warning">HAZ · IMO {move.hazImoClass}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 18px' }}>
        <ContextRow label="Booking / BL" value={move.bookingNo} mono />
        <ContextRow label="Order type"   value={move.orderTypeDesc} />
        <ContextRow label="Customer"     value={move.customer} />
        <ContextRow label="Agent · Line" value={`${move.agent}${move.line ? ` · ${move.line}` : ''}`} />
        <ContextRow label="Vessel · V/V" value={`${move.vessel}${move.voyage ? ` / ${move.voyage}` : ''}`} />
        <ContextRow label="EDO"          value={move.edo} mono />
        <ContextRow label="Container"    value={`${move.isoReq} · ${move.material} · ${move.heightLabel}`} mono />
        <ContextRow label="Yard spot"    value={move.yardSpot} mono />
        <ContextRow label="Tare · Max"   value={`${move.tareKg.toLocaleString()} / ${move.maxGrossKg.toLocaleString()} kg`} mono />
        {move.isLaden && move.cargoWeightKg !== null && (
          <ContextRow label="Cargo wt"   value={`${move.cargoWeightKg.toLocaleString()} kg`} mono />
        )}
        {move.isLaden && move.customsPermit && (
          <ContextRow label="Customs"    value={move.customsPermit} mono />
        )}
        {move.isLaden && move.paperlessCode && (
          <ContextRow label="PaperLess"  value={move.paperlessCode} mono />
        )}
      </div>

      {/* Reefer line */}
      {move.cargoClass === 'REEFER' && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gecko-border)', display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 11.5 }}>
          <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reefer</span>
          <span><span style={{ color: 'var(--gecko-text-secondary)' }}>Set:</span> <strong>{move.reeferSetPoint}</strong></span>
          <span><span style={{ color: 'var(--gecko-text-secondary)' }}>Vent:</span> <strong>{move.reeferVent}</strong></span>
          {move.reeferGensetNo && <span><span style={{ color: 'var(--gecko-text-secondary)' }}>Genset:</span> <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{move.reeferGensetNo}</strong></span>}
          {move.reeferClipOnNo && <span><span style={{ color: 'var(--gecko-text-secondary)' }}>Clip-on:</span> <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{move.reeferClipOnNo}</strong></span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: move.reeferWorking ? 'var(--gecko-success-700)' : 'var(--gecko-error-700)' }}>
            <Icon name={move.reeferWorking ? 'check' : 'warning'} size={11} />
            {move.reeferWorking ? 'working' : 'fault'}
          </span>
        </div>
      )}

      {/* HAZ line */}
      {move.cargoClass === 'HAZ' && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gecko-border)', display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 11.5 }}>
          <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>HAZ</span>
          <span><span style={{ color: 'var(--gecko-text-secondary)' }}>IMO class:</span> <strong>{move.hazImoClass}</strong></span>
          <span><span style={{ color: 'var(--gecko-text-secondary)' }}>UN no:</span> <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{move.hazUnNo}</strong></span>
        </div>
      )}
    </div>
  );
}

// ── Release form (per container) — operator inputs ────────────────────────────

function ReleaseForm({ move, onChange }: { move: ReleaseMove; onChange: (p: Partial<ReleaseMove>) => void }) {
  const ctrMatches = !move.ctrAssigned || !move.ctrPlanned || move.ctrAssigned.trim() === move.ctrPlanned.trim();
  const isLadenExport = move.isLaden && move.direction === 'EXPORT';
  const [exceptionsOpen, setExceptionsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Auto-filled context */}
      <AutoFillContext move={move} />

      <SubBlock title="Container verification" desc="Scan or type the container number off the unit; confirm it matches the yard plan.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Planned (yard system)">
            <input className="gecko-input gecko-input-sm" value={move.ctrPlanned} readOnly style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, background: 'var(--gecko-bg-subtle)' }} />
          </Field>
          <Field label="Verified at gate" required span={3}>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input gecko-input-sm"
                value={move.ctrAssigned}
                onChange={e => onChange({ ctrAssigned: e.target.value.toUpperCase() })}
                placeholder="Scan with handheld OR type container no."
                style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: move.ctrAssigned ? 700 : 400, fontSize: 14, paddingRight: 90 }}
              />
              <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 2 }}>
                <button title="Scan with camera" type="button" style={{ height: 24, padding: '0 8px', border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                  <Icon name="camera" size={13} />Scan
                </button>
                {move.ctrAssigned && (
                  <span title={ctrMatches ? 'Matches yard plan' : 'Mismatch!'} style={{ height: 24, width: 24, background: ctrMatches ? 'var(--gecko-success-50)' : 'var(--gecko-error-50)', color: ctrMatches ? 'var(--gecko-success-700)' : 'var(--gecko-error-700)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ctrMatches ? 'shieldCheck' : 'warning'} size={14} />
                  </span>
                )}
              </div>
            </div>
          </Field>
        </div>
        {move.ctrAssigned && move.ctrPlanned && !ctrMatches && (
          <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-error-50)', color: 'var(--gecko-error-700)', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={13} />
            Container number does not match the yard plan. Confirm with yard supervisor before releasing.
          </div>
        )}
      </SubBlock>

      {/* Seals — laden only */}
      {move.isLaden && (
        <SubBlock title="Seals" desc="Verify the seals already on the container and key in the numbers exactly as shown.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <SealField label="Liner Seal"   value={move.linerSeal}   onChange={v => onChange({ linerSeal: v.toUpperCase() })}   placeholder="e.g. ML-4421988" required />
            <SealField label="Shipper Seal" value={move.shipperSeal} onChange={v => onChange({ shipperSeal: v.toUpperCase() })} placeholder="e.g. SH-99201" required />
          </div>
        </SubBlock>
      )}

      {/* VGM — laden export only */}
      {isLadenExport && (
        <SubBlock title="VGM (Verified Gross Mass)" desc="Required for laden export per IMO SOLAS Ch.VI Reg.2.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Field label="VGM weight" required>
              <div style={{ position: 'relative' }}>
                <input
                  className="gecko-input gecko-input-sm"
                  value={move.vgmKg}
                  onChange={e => onChange({ vgmKg: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder={move.vgmDeclaredKg ? String(move.vgmDeclaredKg) : '0'}
                  inputMode="numeric"
                  style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, paddingRight: 28 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--gecko-text-disabled)', fontWeight: 600 }}>kg</span>
              </div>
            </Field>
            <Field label="Method" required>
              <SegToggle value={move.vgmMethod} options={VGM_METHODS} onChange={v => onChange({ vgmMethod: v as '1' | '2' })} />
            </Field>
            <Field label="Shipper declared" span={2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', background: move.vgmDeclaredKg ? 'var(--gecko-bg-subtle)' : 'transparent', borderRadius: 6, border: '1px dashed var(--gecko-border)' }}>
                {move.vgmDeclaredKg ? (
                  <>
                    <span style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{move.vgmDeclaredKg.toLocaleString()} kg</span>
                    <button type="button" onClick={() => onChange({ vgmKg: String(move.vgmDeclaredKg) })} className="gecko-btn gecko-btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 11, marginLeft: 'auto' }}>
                      Use this
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>Not pre-declared — key in weighbridge reading</span>
                )}
              </div>
            </Field>
          </div>
        </SubBlock>
      )}

      <SubBlock title="Condition" desc="Visual inspection at the gate.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Condition Out" required>
            <SegToggle
              value={move.condition}
              options={[{ k: 'sound', label: 'Sound' }, { k: 'damaged', label: 'Damaged' }]}
              onChange={v => onChange({ condition: v as Condition, statusCode: v === 'damaged' ? 'DMG' : 'NOR' })}
            />
          </Field>
          {move.condition === 'damaged' && (
            <>
              <Field label="Damage area" required>
                <select className="gecko-input gecko-input-sm" value={move.damageArea} onChange={e => onChange({ damageArea: e.target.value })}>
                  <option value="">— select —</option>
                  {DAMAGE_AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Photo" required span={2}>
                <button
                  type="button"
                  onClick={() => onChange({ damagePhotoTaken: !move.damagePhotoTaken })}
                  className={`gecko-btn ${move.damagePhotoTaken ? 'gecko-btn-success' : 'gecko-btn-outline'} gecko-btn-sm`}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32 }}
                >
                  <Icon name={move.damagePhotoTaken ? 'check' : 'camera'} size={13} />
                  {move.damagePhotoTaken ? 'Photo attached' : 'Take damage photo'}
                </button>
              </Field>
            </>
          )}
        </div>
        {move.condition === 'damaged' && (
          <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={13} />
            Container will be released; M&amp;R work order auto-created for detailed assessment + line chargeback.
          </div>
        )}
      </SubBlock>

      {/* HAZ placard confirmation */}
      {move.cargoClass === 'HAZ' && (
        <SubBlock title="HAZ verification" desc="Confirm IMDG placards are displayed on all four sides.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--gecko-text-primary)', cursor: 'pointer', padding: '8px 10px', background: move.hazPlacardsVerified ? 'var(--gecko-success-50)' : 'var(--gecko-warning-50)', borderRadius: 6, border: `1px solid ${move.hazPlacardsVerified ? 'var(--gecko-success-200)' : 'var(--gecko-warning-200)'}` }}>
            <input type="checkbox" checked={move.hazPlacardsVerified} onChange={e => onChange({ hazPlacardsVerified: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--gecko-success-600)' }} />
            <span style={{ fontWeight: 600 }}>Placards confirmed visible on all 4 sides — IMO Class {move.hazImoClass} / UN {move.hazUnNo}</span>
          </label>
        </SubBlock>
      )}

      {/* Exception fields — collapsed by default */}
      <div>
        <button
          type="button"
          onClick={() => setExceptionsOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: 'var(--gecko-text-secondary)', fontSize: 11.5, fontWeight: 600 }}
        >
          <Icon name="chevronRight" size={12} style={{ transform: exceptionsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          Exceptions &amp; remarks
          <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontWeight: 500 }}>(only edit if non-default)</span>
        </button>

        {exceptionsOpen && (
          <div style={{ marginTop: 10, padding: 14, background: 'var(--gecko-bg-subtle)', borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Field label="Pre-trip inspection">
              <SegToggle
                value={move.preTripPass ? 'pass' : 'fail'}
                options={[{ k: 'pass', label: 'Passed' }, { k: 'fail', label: 'Failed' }]}
                onChange={v => onChange({ preTripPass: v === 'pass' })}
              />
            </Field>
            <Field label="EIR status code">
              <select className="gecko-input gecko-input-sm" value={move.statusCode} onChange={e => onChange({ statusCode: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
                {STATUS_CODES.map(s => <option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
              </select>
            </Field>
            <Field label="Remarks" span={2}>
              <input className="gecko-input gecko-input-sm" value={move.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Printed on the EIR — optional" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Move row (accordion) ──────────────────────────────────────────────────────

function MoveRow({ move, index, open, issues, onToggle, onRemove, onChange }: {
  move: ReleaseMove; index: number; open: boolean;
  issues: ValidationIssue[];
  onToggle: () => void; onRemove: () => void;
  onChange: (p: Partial<ReleaseMove>) => void;
}) {
  const accent     = 'var(--gecko-primary-600)';
  const accentSoft = 'var(--gecko-primary-50)';
  const errCount  = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  const ladenTag = (() => {
    if (move.direction === 'IMPORT')    return 'LADEN · IMPORT';
    if (move.direction === 'EXPORT')    return 'LADEN · EXPORT';
    if (move.direction === 'EMPTY_OUT') return 'EMPTY · HIRE-OUT';
    return 'EMPTY · RETURN';
  })();

  return (
    <div style={{ borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: 'auto auto 1fr auto auto auto', gap: 14, alignItems: 'center',
          padding: '14px 18px', border: 'none', background: open ? accentSoft : 'transparent', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit', borderLeft: `3px solid ${open ? accent : 'transparent'}`,
        }}
      >
        {/* Index */}
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>
          {index}
        </div>

        {/* Direction badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: accent, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          <Icon name="arrowRight" size={11} style={{ transform: 'rotate(-90deg)' }} />
          RELEASE
        </div>

        {/* Summary */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {move.ctrAssigned || move.ctrPlanned || '— verify container —'}
            </span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 600, padding: '2px 6px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 3, color: 'var(--gecko-text-secondary)' }}>
              {move.isoReq}
            </span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{move.teu} TEU</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.04em' }}>{ladenTag}</span>
            {move.cargoClass === 'REEFER' && <MoveStatusBadge code="REF" />}
            {move.statusCode === 'DMG'    && <MoveStatusBadge code="DMG" />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', gap: 8, fontFamily: 'var(--gecko-font-mono)' }}>
            <span>EDO {move.edo || '—'}</span>
            <span>·</span>
            <span>{move.line || 'line —'}{move.agentCode ? ` (${move.agentCode})` : ''}</span>
            {move.yardSpot && <><span>·</span><span>{move.yardSpot}</span></>}
          </div>
        </div>

        {/* Validation badges */}
        <div style={{ display: 'flex', gap: 5 }}>
          {errCount  > 0 && <span className="gecko-pill gecko-pill-danger"><Icon name="warning" size={10} />{errCount}</span>}
          {warnCount > 0 && <span className="gecko-pill gecko-pill-warning"><Icon name="warning" size={10} />{warnCount}</span>}
          {errCount === 0 && warnCount === 0 && <span className="gecko-pill gecko-pill-success"><Icon name="check" size={10} />OK</span>}
        </div>

        {/* Status pill */}
        <div>
          {move.status === 'done'    && <span className="gecko-badge gecko-badge-success" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="success" />Saved</span>}
          {move.status === 'active'  && <span className="gecko-badge gecko-badge-warning" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="warning" />Editing</span>}
          {move.status === 'pending' && <span className="gecko-badge gecko-badge-gray"    style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="gray" />Pending</span>}
        </div>

        <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: '18px 22px 22px', background: '#fff', borderTop: `1px solid ${accent}`, borderLeft: `3px solid ${accent}` }}>
          <ReleaseForm move={move} onChange={onChange} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, marginTop: 18, borderTop: '1px solid var(--gecko-border)' }}>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              Container <strong style={{ color: 'var(--gecko-text-primary)' }}>#{index}</strong> · Release · auto-saved
            </div>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onRemove} style={{ color: 'var(--gecko-error-600)' }}>
              <Icon name="trash" size={12} />Remove
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onToggle}>Collapse</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Container releases card ───────────────────────────────────────────────────

function ReleasesCard({ moves, activeId, setActiveId, addMove, removeMove, updateMove, teuUsed, teuCap, issues }: {
  moves: ReleaseMove[]; activeId: number | null; setActiveId: (id: number | null) => void;
  addMove: () => void; removeMove: (id: number) => void;
  updateMove: (id: number, patch: Partial<ReleaseMove>) => void;
  teuUsed: number; teuCap: number; issues: ValidationIssue[];
}) {
  const full = teuUsed >= teuCap;

  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</div>
        <Icon name="box" size={15} style={{ color: 'var(--gecko-text-secondary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Container Releases</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            {moves.length} container{moves.length !== 1 ? 's' : ''} · {teuUsed} TEU out · cap {teuCap} TEU
          </div>
        </div>
        <button
          className="gecko-btn gecko-btn-primary gecko-btn-sm"
          onClick={addMove}
          disabled={full}
          style={{ opacity: full ? 0.4 : 1 }}
          title={full ? `At capacity (${teuCap} TEU)` : 'Add another container to release'}
        >
          <Icon name="arrowRight" size={12} style={{ transform: 'rotate(-90deg)' }} />Add Release
        </button>
      </div>

      <CapacityBar teuUsed={teuUsed} cap={teuCap} />

      <div style={{ background: 'var(--gecko-bg-subtle)' }}>
        {moves.map((m, i) => (
          <MoveRow
            key={m.id}
            move={m}
            index={i + 1}
            open={m.id === activeId}
            issues={issues.filter(x => x.moveId === m.id)}
            onToggle={() => setActiveId(m.id === activeId ? null : m.id)}
            onRemove={() => removeMove(m.id)}
            onChange={patch => updateMove(m.id, patch)}
          />
        ))}

        {moves.length === 0 && (
          <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: '#fff' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="box" size={22} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 6 }}>No containers added yet</div>
              <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
                Add each container the truck is collecting. Booking + container facts pre-fill from the pre-advice; operator verifies seals + condition at the gate.
              </div>
            </div>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={addMove}>
              <Icon name="arrowRight" size={13} style={{ transform: 'rotate(-90deg)' }} />Add Release
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Truck header card ─────────────────────────────────────────────────────────

function TruckHeaderCard({ truck }: { truck: any }) {
  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</div>
        <Icon name="truck" size={15} style={{ color: 'var(--gecko-text-secondary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Truck &amp; Driver</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Arrived {truck.arrivedAt} · waiting {truck.waitMins} min · {truck.lane}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          {truck.waitMins > 30 && (
            <span className="gecko-pill gecko-pill-danger">
              <Icon name="warning" size={11} />OVERDUE · {truck.waitMins} min wait
            </span>
          )}
          {truck.appt && (
            <span className="gecko-pill gecko-pill-success">
              <Icon name="shieldCheck" size={11} />APPOINTMENT · {truck.appt}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Field label="Truck Plate" required>
          <div style={{ position: 'relative' }}>
            <input className="gecko-input gecko-input-sm" defaultValue={truck.plate} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, paddingRight: 30 }} />
            <button title="OCR plate" style={{ position: 'absolute', right: 4, top: 4, height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={14} />
            </button>
          </div>
        </Field>
        <Field label="Trailer / Chassis">
          <input className="gecko-input gecko-input-sm" defaultValue={truck.trailer} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Transporter (Haulier)" required>
          <input className="gecko-input gecko-input-sm" defaultValue={truck.haulier} />
        </Field>
        <Field label="Appointment Ref">
          <div style={{ position: 'relative' }}>
            <input className="gecko-input gecko-input-sm" defaultValue={truck.appt} style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 30 }} />
            {truck.appt && <Icon name="check" size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-success-600)' }} />}
          </div>
        </Field>

        <Field label="Driver Name" required>
          <input className="gecko-input gecko-input-sm" defaultValue={truck.driver} />
        </Field>
        <Field label="License No." required>
          <input className="gecko-input gecko-input-sm" defaultValue={truck.license} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Mobile">
          <input className="gecko-input gecko-input-sm" defaultValue={truck.mobile} style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="ID Verified">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon name="shieldCheck" size={14} />Verified {truck.arrivedAt}
          </div>
        </Field>

        <Field label="Truck Category" required>
          <select className="gecko-input gecko-input-sm" defaultValue={truck.truckCategory} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
            {TRUCK_CATEGORIES.map(t => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
          </select>
        </Field>
        <Field label="Order Type" required>
          <select className="gecko-input gecko-input-sm" defaultValue={truck.orderType} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
            {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Lane Assigned">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>
            <Icon name="mapPin" size={13} />{truck.lane}
          </div>
        </Field>
        <Field label="GIN Reference">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>
            {truck.ginRef}
          </div>
        </Field>
      </div>
    </section>
  );
}

// ── Visit summary rail ────────────────────────────────────────────────────────

function VisitSummaryRail({ moves, teuUsed, teuCap, teuRemaining, errCount, warnCount, issues, onJumpToMove }: {
  moves: ReleaseMove[]; teuUsed: number; teuCap: number; teuRemaining: number;
  errCount: number; warnCount: number;
  issues: ValidationIssue[];
  onJumpToMove: (id: number) => void;
}) {
  const count = moves.length;
  const ready = errCount === 0 && count > 0;
  const [showIssues, setShowIssues] = useState(errCount > 0);
  const hasIssues = errCount > 0 || warnCount > 0;

  return (
    <aside className="gecko-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Visit Summary</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Live · auto-saved</div>
          </div>
          <span className="gecko-pill gecko-pill-success">
            <Icon name="lock" size={10} />PAID AT GATE-IN
          </span>
        </div>
      </div>

      {/* Release counters */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ padding: 10, background: 'var(--gecko-primary-50)', borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-primary-700)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Containers out</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, lineHeight: 1.1, color: 'var(--gecko-primary-700)' }}>
            {count}<span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500, marginLeft: 4 }}>· {teuUsed} TEU</span>
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          <span>Truck capacity</span>
          <span>{teuUsed} / {teuCap} TEU</span>
        </div>
        <div style={{ height: 8, background: 'var(--gecko-bg-subtle)', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid var(--gecko-border)' }}>
          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${(teuUsed / teuCap) * 100}%`, background: teuUsed >= teuCap ? 'var(--gecko-warning-500)' : 'var(--gecko-primary-600)' }} />
          {Array.from({ length: teuCap - 1 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) / teuCap) * 100}%`, width: 1, background: 'var(--gecko-border-strong)' }} />
          ))}
        </div>
        <div style={{ marginTop: 5, fontSize: 10, color: 'var(--gecko-text-secondary)' }}>
          {teuRemaining > 0 ? `${teuRemaining} TEU slot available` : 'At capacity'}
        </div>
      </div>

      {/* Validation */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Validation</div>
          {hasIssues && (
            <button
              type="button"
              onClick={() => setShowIssues(s => !s)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', fontSize: 10, fontWeight: 600, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}
              aria-expanded={showIssues}
            >
              {showIssues ? 'Hide details' : 'Show details'}
              <Icon name="chevronDown" size={11} style={{ transform: showIssues ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ValidationLine ok={count > 0}       label={count === 0 ? 'No containers added' : `${count} container${count > 1 ? 's' : ''} added`} kind="error" />
          <ValidationLine ok={errCount === 0}   label={`${errCount} error${errCount === 1 ? '' : 's'} blocking commit`}                          kind="error" />
          <ValidationLine ok={warnCount === 0}  label={`${warnCount} warning${warnCount === 1 ? '' : 's'} (override allowed)`}                   kind="warning" />
          <ValidationLine ok={true}             label="Charges settled at gate-in"                                                                kind="success" />
        </div>

        {showIssues && hasIssues && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, border: '1px solid var(--gecko-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moves.map((m, idx) => {
              const moveIssues = issues.filter(i => i.moveId === m.id);
              if (moveIssues.length === 0) return null;
              const errs  = moveIssues.filter(i => i.level === 'error');
              const warns = moveIssues.filter(i => i.level === 'warn');
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToMove(m.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-primary)', letterSpacing: '0.04em' }}>
                      Container #{idx + 1}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.ctrAssigned || m.ctrPlanned || '— unverified —'}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--gecko-primary-700)', fontWeight: 600 }}>
                      Open →
                    </span>
                  </button>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {errs.map((iss, i) => (
                      <li key={`e-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gecko-error-600)', display: 'inline-block', marginTop: 5, flexShrink: 0 }} />
                        <span style={{ color: 'var(--gecko-text-primary)' }}>{iss.msg}</span>
                      </li>
                    ))}
                    {warns.map((iss, i) => (
                      <li key={`w-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gecko-warning-600)', display: 'inline-block', marginTop: 5, flexShrink: 0 }} />
                        <span style={{ color: 'var(--gecko-text-secondary)' }}>{iss.msg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Commit */}
      <div style={{ padding: '14px 16px' }}>
        <button
          className="gecko-btn"
          disabled={!ready}
          style={{
            width: '100%', height: 42,
            background: ready ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
            color: ready ? '#fff' : 'var(--gecko-text-disabled)',
            border: 'none', fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Icon name="check" size={14} />Commit · Open Gate
        </button>
        <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 10, color: 'var(--gecko-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Prints <strong style={{ color: 'var(--gecko-text-primary)' }}>1 Gate Pass (EIR-Out)</strong> per visit<br />
          + auto-closes the truck visit record
        </div>
      </div>
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Truck visit lookup (mocked — production fetches from the gate-in record)
const VISIT_STUBS: Record<string, any> = {
  'GIN-4429': { plate:'70-4455', trailer:'TLR-442-9', driver:'Prem Kanchana',    haulier:'Laem Chabang Trans.',  license:'TH-D-8841-22', mobile:'+66 87 341 2200', arrivedAt:'14:05', waitMins:42, lane:'Lane 3', appt:'APT-04-4432', truckCategory:'18W', orderType:'IMP CY/CY',  ginRef:'GIN-4429' },
  'GIN-4430': { plate:'80-2211', trailer:'TLR-381-4', driver:'Somchai Phakdi',   haulier:'THA Logistics Co.',    license:'TH-D-5521-20', mobile:'+66 81 228 9900', arrivedAt:'14:28', waitMins:19, lane:'Lane 1', appt:'APT-04-4418', truckCategory:'10W', orderType:'IMP CY/CY',  ginRef:'GIN-4430' },
  'GIN-4431': { plate:'71-9033', trailer:'TLR-209-1', driver:'Wichai Boonsri',   haulier:'Siam Freight Ltd.',    license:'TH-D-7712-19', mobile:'+66 89 441 3300', arrivedAt:'13:55', waitMins:52, lane:'Lane 2', appt:'APT-04-4401', truckCategory:'18W', orderType:'IMP CY/CY',  ginRef:'GIN-4431' },
};

// Release context stub — what would normally come from the booking + master + previous gate-in EIR
function makeReleaseContextStub(seq: number): Omit<ReleaseMove, 'id' | 'status'> {
  // Cycle through a few realistic profiles so the demo shows the conditional behaviours
  const profiles = [
    {
      // Laden import (most common)
      bookingNo: 'EGLV149602390729', customer: 'TCL ELECTRONICS (THAILAND)', agent: 'EVERGREEN', agentCode: 'EGLV-TH', line: 'OOL',
      vessel: 'EVER WEB', voyage: '0344-022B', orderTypeDesc: 'PICK-UP CONT', edo: 'EDO-2026-04-001',
      yardSpot: 'BLOCK A-12-3', isLaden: true, direction: 'IMPORT' as Direction,
      ctrPlanned: 'TGHU552040-3', isoReq: '20GP', teu: 1, cargoClass: 'NONE' as CargoClass,
      material: 'STL', heightLabel: "8'6\"", tareKg: 2200, maxGrossKg: 24000, cargoWeightKg: 18400,
      customsPermit: 'CP-2026-44102', paperlessCode: 'PLC-26-3340', vgmDeclaredKg: null,
      reeferSetPoint: '', reeferVent: '', reeferGensetNo: '', reeferClipOnNo: '', reeferWorking: false,
      hazImoClass: '', hazUnNo: '',
    },
    {
      // Laden export (VGM required)
      bookingNo: 'COSCO2604081142', customer: 'THAI UNION GROUP PCL', agent: 'COSCO', agentCode: 'COSU-TH', line: 'COS',
      vessel: 'COSCO YANTIAN', voyage: '026E', orderTypeDesc: 'EXP CY/CY', edo: 'EDO-2026-04-114',
      yardSpot: 'BLOCK B-04-1', isLaden: true, direction: 'EXPORT' as Direction,
      ctrPlanned: 'COSU8810244', isoReq: '40HC', teu: 2, cargoClass: 'NONE' as CargoClass,
      material: 'STL', heightLabel: "9'6\"", tareKg: 3800, maxGrossKg: 32500, cargoWeightKg: 21000,
      customsPermit: 'CP-2026-44211', paperlessCode: 'PLC-26-4012', vgmDeclaredKg: 24820,
      reeferSetPoint: '', reeferVent: '', reeferGensetNo: '', reeferClipOnNo: '', reeferWorking: false,
      hazImoClass: '', hazUnNo: '',
    },
    {
      // Reefer laden import
      bookingNo: 'CMAU5523140-2', customer: 'CHAROEN POKPHAND FOODS PCL', agent: 'CMA CGM', agentCode: 'CMA-TH', line: 'CMA',
      vessel: 'CMA CGM BENJAMIN', voyage: '0NXBME1MA', orderTypeDesc: 'IMP CY/CY · REEFER', edo: 'EDO-2026-04-228',
      yardSpot: 'REEFER BAY R-2-08', isLaden: true, direction: 'IMPORT' as Direction,
      ctrPlanned: 'CMAU5523140-9', isoReq: '40RF', teu: 2, cargoClass: 'REEFER' as CargoClass,
      material: 'STL', heightLabel: "9'6\"", tareKg: 4350, maxGrossKg: 30480, cargoWeightKg: 19800,
      customsPermit: 'CP-2026-44087', paperlessCode: 'PLC-26-3411', vgmDeclaredKg: null,
      reeferSetPoint: '-18°C', reeferVent: '25%', reeferGensetNo: 'GN-447', reeferClipOnNo: 'CO-2014', reeferWorking: true,
      hazImoClass: '', hazUnNo: '',
    },
    {
      // Empty hire-out (no booking)
      bookingNo: '—', customer: '— · empty allocation', agent: 'MAERSK', agentCode: 'MAEU-TH', line: 'MSK',
      vessel: '—', voyage: '—', orderTypeDesc: 'EMP REL', edo: 'EHO-2026-04-770',
      yardSpot: 'EMPTY POOL E-08', isLaden: false, direction: 'EMPTY_OUT' as Direction,
      ctrPlanned: 'MAEU9912034-2', isoReq: '40HC', teu: 2, cargoClass: 'NONE' as CargoClass,
      material: 'STL', heightLabel: "9'6\"", tareKg: 3800, maxGrossKg: 32500, cargoWeightKg: null,
      customsPermit: '', paperlessCode: '', vgmDeclaredKg: null,
      reeferSetPoint: '', reeferVent: '', reeferGensetNo: '', reeferClipOnNo: '', reeferWorking: false,
      hazImoClass: '', hazUnNo: '',
    },
  ];

  const p = profiles[seq % profiles.length];

  return {
    ...p,
    // Operator inputs start blank
    ctrAssigned: '',
    linerSeal: '',
    shipperSeal: '',
    vgmKg: '',
    vgmMethod: '1',
    condition: 'sound',
    damageArea: '',
    damagePhotoTaken: false,
    hazPlacardsVerified: false,
    // Exception fields default to "no exception"
    preTripPass: true,
    statusCode: 'NOR',
    notes: '',
  };
}

export default function GateOutFormPage() {
  const params = useParams();
  const visitId = typeof params.id === 'string' ? params.id : 'GIN-4429';
  const { toast } = useToast();

  const truck = VISIT_STUBS[visitId] ?? {
    plate: '—', trailer: '—', driver: '—', haulier: '—',
    license: '—', mobile: '—', arrivedAt: '—', waitMins: 0,
    lane: '—', appt: '—', truckCategory: '18W', orderType: 'IMP CY/CY', ginRef: visitId,
  };

  const [moves, setMoves]     = useState<ReleaseMove[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const TEU_CAP = 2;
  const teuUsed     = moves.reduce((s, m) => s + m.teu, 0);
  const teuRemaining = TEU_CAP - teuUsed;

  const issues: ValidationIssue[] = [];
  moves.forEach(m => {
    if (!m.ctrAssigned) issues.push({ moveId: m.id, level: 'error', msg: 'Container number must be verified at gate' });

    if (m.isLaden) {
      if (!m.linerSeal)   issues.push({ moveId: m.id, level: 'error', msg: 'Liner seal required for laden' });
      if (!m.shipperSeal) issues.push({ moveId: m.id, level: 'error', msg: 'Shipper seal required for laden' });
    }

    if (m.isLaden && m.direction === 'EXPORT') {
      const vgm = parseInt(m.vgmKg, 10);
      if (!vgm || vgm <= 0) issues.push({ moveId: m.id, level: 'error', msg: 'VGM required for laden export (SOLAS)' });
      if (vgm && m.vgmDeclaredKg && Math.abs(vgm - m.vgmDeclaredKg) / m.vgmDeclaredKg > 0.05) {
        issues.push({ moveId: m.id, level: 'warn', msg: `VGM deviates >5% from shipper-declared ${m.vgmDeclaredKg}kg` });
      }
    }

    if (m.condition === 'damaged') {
      if (!m.damageArea)       issues.push({ moveId: m.id, level: 'error', msg: 'Damage area required' });
      if (!m.damagePhotoTaken) issues.push({ moveId: m.id, level: 'error', msg: 'Damage photo required' });
    }

    if (m.cargoClass === 'HAZ' && !m.hazPlacardsVerified) {
      issues.push({ moveId: m.id, level: 'error', msg: 'HAZ placards must be verified' });
    }

    if (!m.preTripPass) {
      issues.push({ moveId: m.id, level: 'warn', msg: 'Pre-trip inspection marked as failed' });
    }
  });
  const errCount  = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  const addMove = () => {
    if (teuUsed >= TEU_CAP) return;
    const newId = Math.max(...moves.map(m => m.id), 0) + 1;
    const ctx = makeReleaseContextStub(moves.length);
    // Auto-shrink TEU if it would overflow capacity (e.g., a 40HC won't fit if a 20GP is already in)
    const teu = teuUsed + ctx.teu > TEU_CAP ? TEU_CAP - teuUsed : ctx.teu;
    const blank: ReleaseMove = {
      id: newId,
      status: 'active',
      ...ctx,
      teu,
    };
    setMoves(prev => [...prev, blank]);
    setActiveId(newId);
  };

  const removeMove  = (id: number) => { setMoves(prev => prev.filter(m => m.id !== id)); if (activeId === id) setActiveId(null); };
  const updateMove  = (id: number, patch: Partial<ReleaseMove>) => setMoves(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

  const goutRef = `GOUT-${visitId.replace('GIN-', '')}`;

  // ── Print data assembly — derives a GatePrintData from the active move ──
  const activeMove = moves.find(m => m.id === activeId) ?? moves[0];
  const printData: GatePrintData = useMemo(() => {
    const charges: GatePrintCharge[] = activeMove ? [
      { code: 'SA001', desc: 'Admission Fee',  qty: 1,             unit: 'visit', amount: 250 },
      { code: 'SC001', desc: 'Lift-On',        qty: activeMove.teu || 1, unit: 'lift',  amount: 850 },
      ...(activeMove.cargoClass === 'REEFER'
        ? [{ code: 'SR001', desc: 'Reefer plug-in (per day)', qty: 1, unit: 'day', amount: 220 }]
        : []),
      { code: 'SD001', desc: 'Documentation',  qty: 1,             unit: 'doc',   amount: 80  },
    ] : [];
    return {
      documentType: 'EIR-OUT',
      documentNo: goutRef,
      visitId,
      depotName: 'GECKO TOS · Laem Chabang ICD',
      depotBranch: `${truck.lane ?? 'Lane —'}  ·  Yard A · Export`,
      printedAt: new Date(),
      cashierName: 'PRANEE C.',
      gateClerkName: 'SOMSAK P.',
      customer:  activeMove?.customer ?? '—',
      agent:     activeMove?.agent ?? '—',
      line:      activeMove?.line ?? '—',
      haulier:   truck.haulier ?? '—',
      truckPlate: truck.plate ?? '—',
      trailerNo:  truck.trailer ?? undefined,
      driverName: truck.driver ?? '—',
      driverLicense: truck.license ?? '—',
      driverMobile:  truck.mobile ?? '—',
      containerNo:   activeMove?.ctrAssigned || activeMove?.ctrPlanned || '—',
      iso:           activeMove?.isoReq ?? '—',
      isLaden:       activeMove?.isLaden ?? false,
      direction:     (activeMove?.direction ?? 'EXPORT') as GatePrintData['direction'],
      cargoClass:    (activeMove?.cargoClass ?? 'NONE') as GatePrintData['cargoClass'],
      bookingNo:     activeMove?.bookingNo,
      edoNo:         activeMove?.edo,
      vessel:        activeMove?.vessel,
      voyage:        activeMove?.voyage,
      yardSpot:      activeMove?.yardSpot,
      linerSeal:     activeMove?.linerSeal || undefined,
      shipperSeal:   activeMove?.shipperSeal || undefined,
      tareKg:        activeMove?.tareKg ?? 0,
      maxGrossKg:    activeMove?.maxGrossKg ?? 0,
      vgmKg:         activeMove?.vgmKg ? Number(activeMove.vgmKg) : undefined,
      cargoWeightKg: activeMove?.cargoWeightKg ?? undefined,
      vgmMethod:     activeMove?.vgmMethod,
      remarks:       activeMove?.notes || undefined,
      charges,
      taxRate: 0.07,
    };
  }, [activeMove, truck, visitId, goutRef]);

  const { openOptions, PrintHost, print } = useGatePrint(printData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PrintHost />
      <PageToolbar
        title="Gate-Out · Truck Visit"
        subtitle={<>Container release · From queue visit <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', fontWeight: 600 }}>{visitId}</span> · {truck.lane}</>}
        badges={[
          { label: goutRef, kind: 'gray' },
          { label: 'In Progress', kind: 'warning' },
          ...(truck.waitMins > 30 ? [{ label: `${truck.waitMins}m wait · Overdue`, kind: 'error' as const }] : []),
        ]}
        actions={
          <>
            <Link href="/gate/eir-out" className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="chevronLeft" size={13} />Back to Queue
            </Link>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Draft saved', message: `EIR-Out ${visitId} draft preserved.` })}><Icon name="check" size={13} />Save Draft</button>
            <button
              className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={openOptions}
              disabled={moves.length === 0}
              title="Choose A4 EIR, dot-matrix gate slip, or 80mm thermal receipt"
            >
              <Icon name="print" size={13} />Print…
            </button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={errCount > 0 || moves.length === 0}
              onClick={() => {
                toast({ variant: 'success', title: 'EIR-Out committed', message: 'Gate pass printed — truck cleared to depart.' });
                // Default commit flow prints the A4 EIR; clerks can re-print other formats from the Print… menu
                print('eir');
              }}
            >
              <Icon name="check" size={13} />Commit · Print EIR
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <TruckHeaderCard truck={truck} />
          <ReleasesCard
            moves={moves}
            activeId={activeId}
            setActiveId={setActiveId}
            addMove={addMove}
            removeMove={removeMove}
            updateMove={updateMove}
            teuUsed={teuUsed}
            teuCap={TEU_CAP}
            issues={issues}
          />
        </div>

        <VisitSummaryRail
          moves={moves}
          teuUsed={teuUsed}
          teuCap={TEU_CAP}
          teuRemaining={teuRemaining}
          errCount={errCount}
          warnCount={warnCount}
          issues={issues}
          onJumpToMove={id => setActiveId(id)}
        />
      </div>
    </div>
  );
}
