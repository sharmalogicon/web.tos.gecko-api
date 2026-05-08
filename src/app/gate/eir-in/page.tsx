"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar, Field } from '@/components/ui/OpsPrimitives';
import { useToast } from '@/components/ui/Toast';

// ── Constants ────────────────────────────────────────────────────────────────

const TRUCK_CATEGORIES = [
  { code: '6W',  label: '6-Wheel · light' },
  { code: '10W', label: '10-Wheel · standard' },
  { code: '18W', label: '18-Wheel · semi-trailer' },
  { code: '22W', label: '22-Wheel · double trailer' },
];

const ORDER_TYPES = [
  'EXP CY/CY', 'EXP CFS/CY', 'IMP CY/CY', 'IMP CY/CFS', 'EMP RTN', 'EMP REL',
];

const STATUS_CODES = [
  { code: 'NOR', label: 'Normal',        kind: 'gray'    },
  { code: 'DMG', label: 'Damaged',       kind: 'warning' },
  { code: 'OOG', label: 'Out of Gauge',  kind: 'warning' },
  { code: 'OVH', label: 'Overheight',    kind: 'warning' },
  { code: 'OVW', label: 'Overwidth',     kind: 'warning' },
  { code: 'HLD', label: 'On Hold',       kind: 'error'   },
  { code: 'DGR', label: 'DG Cargo',      kind: 'error'   },
  { code: 'REF', label: 'Reefer',        kind: 'info'    },
  { code: 'SCL', label: 'Scaled',        kind: 'info'    },
];

const LIABILITY_CODES = [
  { code: '01', label: 'Shipper'     },
  { code: '02', label: 'Carrier / Line' },
  { code: '03', label: 'Terminal'    },
  { code: '04', label: 'Unknown'     },
  { code: '05', label: 'Surveyor'    },
];

const PANELS = ['Front', 'Back', 'Left Wall', 'Right Wall', 'Roof', 'Floor', 'Doors', 'Undercarriage', 'Reefer Unit'];

const IICL_CODES = [
  { code: 'DT', label: 'Dent' },
  { code: 'BT', label: 'Bent / bowed' },
  { code: 'BR', label: 'Broken' },
  { code: 'CR', label: 'Crack' },
  { code: 'HL', label: 'Hole' },
  { code: 'CT', label: 'Cut' },
  { code: 'SC', label: 'Scratch' },
  { code: 'RU', label: 'Rust / corrosion' },
  { code: 'MS', label: 'Missing part' },
  { code: 'CO', label: 'Contamination' },
  { code: 'LB', label: 'Loose / broken weld' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface DamageLine {
  panel: string;
  code: string;
  desc: string;
  sev: 'minor' | 'major' | 'crit';
  liability: string;
}

interface DropMove {
  id: number; kind: 'drop'; status: string;
  ctr: string; iso: string; teu: number; lade: 'F' | 'E';
  condition: string; statusCode: string; movement: string;
  sealLine: string; sealShipper: string;
  booking: string; line: string; agentCode: string;
  vgm: number | null; vgmMethod: string; wbTicket: string; vgmVerifiedBy: string;
  dg: boolean; dgClass: string; dgUn: string; dgPg: string;
  yardSpot: string; notes: string;
  damages: DamageLine[];
}

interface PickMove {
  id: number; kind: 'pick'; status: string;
  edo: string; isoReq: string; teu: number;
  ctrAssigned: string; ctrPlanned: string;
  sealApplied: string; condition: string; statusCode: string;
  preTrip: boolean; booking: string; line: string; agentCode: string;
  yardSpot: string; notes: string;
}

type Move = DropMove | PickMove;

interface ValidationIssue { moveId: number; level: 'error' | 'warn'; msg: string; }

// ── Small helpers ────────────────────────────────────────────────────────────

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
        {desc && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 400 }}>{desc}</div>}
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

function TotalRowLite({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
      <span style={{ color: 'var(--gecko-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: negative ? 'var(--gecko-error-600)' : 'var(--gecko-text-primary)' }}>{value}</span>
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
  const styles: Record<string, { bg: string; fg: string; bd: string }> = {
    error:   { bg: 'var(--gecko-error-50)',   fg: 'var(--gecko-error-700)',   bd: 'var(--gecko-error-200)'   },
    warning: { bg: 'var(--gecko-warning-50)', fg: 'var(--gecko-warning-700)', bd: 'var(--gecko-warning-200)' },
    info:    { bg: 'var(--gecko-info-50)',     fg: 'var(--gecko-info-700)',    bd: 'var(--gecko-info-200)'    },
    success: { bg: 'var(--gecko-success-50)', fg: 'var(--gecko-success-700)', bd: 'var(--gecko-success-200)' },
    gray:    { bg: 'var(--gecko-bg-subtle)',  fg: 'var(--gecko-text-secondary)', bd: 'var(--gecko-border)'   },
  };
  const { bg, fg, bd } = styles[k] ?? styles.gray;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', borderRadius: 4, background: bg, color: fg, border: `1px solid ${bd}` }}>
      {def.code} · {def.label}
    </span>
  );
}

// ── Capacity bar ─────────────────────────────────────────────────────────────

function CapacityBarLine({ label, teu, cap, color }: { label: string; teu: number; cap: number; color: string }) {
  const pct = Math.min(100, (teu / cap) * 100);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{label}</span>
      <div style={{ height: 8, background: 'var(--gecko-bg-subtle)', borderRadius: 4, position: 'relative', overflow: 'hidden', border: '1px solid var(--gecko-border)' }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: color, borderRadius: '3px 0 0 3px', transition: 'width 0.2s' }} />
        {Array.from({ length: cap - 1 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) / cap) * 100}%`, width: 1, background: 'var(--gecko-border-strong)' }} />
        ))}
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, textAlign: 'right' }}>{teu} <span style={{ color: 'var(--gecko-text-disabled)', fontWeight: 500 }}>TEU</span></span>
    </div>
  );
}

function CapacityBar({ dropTeu, pickTeu, cap }: { dropTeu: number; pickTeu: number; cap: number }) {
  const max = Math.max(dropTeu, pickTeu);
  return (
    <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--gecko-border)', background: '#fff', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
      <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>Truck Capacity</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <CapacityBarLine label="DROP-OFFS (in)" teu={dropTeu} cap={cap} color="var(--gecko-info-500)" />
        <CapacityBarLine label="PICKUPS (out)"  teu={pickTeu} cap={cap} color="var(--gecko-primary-600)" />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>
          {max}<span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}> / {cap} TEU</span>
        </div>
        <div style={{ fontSize: 10, color: max >= cap ? 'var(--gecko-warning-700)' : 'var(--gecko-text-secondary)', marginTop: 2, fontWeight: max >= cap ? 700 : 500 }}>
          {max >= cap ? 'AT CAPACITY' : `${cap - max} TEU available`}
        </div>
      </div>
    </div>
  );
}

// ── Damage panel ─────────────────────────────────────────────────────────────

function DamagePanel({ move, onChange }: { move: DropMove; onChange: (p: Partial<DropMove>) => void }) {
  const damages = move.damages || [];
  const addRow = () => onChange({ damages: [...damages, { panel: 'Back', code: 'DT', desc: '', sev: 'minor', liability: '04' }] });
  const updRow = (i: number, patch: Partial<DamageLine>) => onChange({ damages: damages.map((d, idx) => idx === i ? { ...d, ...patch } : d) });
  const delRow = (i: number) => onChange({ damages: damages.filter((_, idx) => idx !== i) });

  return (
    <SubBlock title="Damage details (IICL)" desc="Per-panel inspection. Each line emits a DAM segment on the CODECO message to the line.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 2fr 1fr 2fr 28px', gap: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--gecko-text-secondary)' }}>
          <span>Panel</span><span>IICL Code</span><span>Description</span><span>Severity</span><span>Liability (CODECO)</span><span />
        </div>
        {damages.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)', borderRadius: 6, border: '1px dashed var(--gecko-border)', textAlign: 'center' }}>
            No damages logged yet — add a line item below.
          </div>
        )}
        {damages.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 2fr 1fr 2fr 28px', gap: 8, alignItems: 'center', padding: 8, background: 'var(--gecko-error-50)', border: '1px solid var(--gecko-error-200)', borderRadius: 6 }}>
            <select className="gecko-input gecko-input-sm" value={d.panel} onChange={e => updRow(i, { panel: e.target.value })} style={{ fontSize: 12 }}>
              {PANELS.map(p => <option key={p}>{p}</option>)}
            </select>
            <select className="gecko-input gecko-input-sm" value={d.code} onChange={e => updRow(i, { code: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 600 }}>
              {IICL_CODES.map(c => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
            </select>
            <input className="gecko-input gecko-input-sm" value={d.desc} onChange={e => updRow(i, { desc: e.target.value })} placeholder="e.g. Dent (≤ 25mm) lower-left corner" style={{ fontSize: 12 }} />
            <select className="gecko-input gecko-input-sm" value={d.sev} onChange={e => updRow(i, { sev: e.target.value as DamageLine['sev'] })} style={{ fontSize: 12, fontWeight: 600 }}>
              <option value="minor">Minor</option><option value="major">Major</option><option value="crit">Critical</option>
            </select>
            <select className="gecko-input gecko-input-sm" value={d.liability} onChange={e => updRow(i, { liability: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>
              {LIABILITY_CODES.map(l => <option key={l.code} value={l.code}>{l.code} · {l.label}</option>)}
            </select>
            <button onClick={() => delRow(i)} title="Remove" style={{ height: 28, width: 28, border: 'none', background: 'transparent', color: 'var(--gecko-error-600)', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={addRow}>
            <Icon name="plus" size={13} />Add damage line
          </button>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="camera" size={12} />Photos auto-attached from gate camera (4 captures)
          </div>
        </div>
      </div>
    </SubBlock>
  );
}

// ── Drop-off form ────────────────────────────────────────────────────────────

function DropOffForm({ move, onChange }: { move: DropMove; onChange: (p: Partial<DropMove>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SubBlock title="Cargo direction" desc="Drop-offs are receivals — the truck leaves an inbound container at the terminal.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Movement" required>
            <select className="gecko-input gecko-input-sm" value={move.movement ?? 'EXPORT'} onChange={e => onChange({ movement: e.target.value })}>
              <option value="EXPORT">Export — laden in</option>
              <option value="EMPTY-RTN">Empty return</option>
              <option value="ICD-RECV">ICD receival</option>
            </select>
          </Field>
          <Field label="Laden / Empty" required>
            <SegToggle value={move.lade} options={[{ k: 'F', label: 'Laden' }, { k: 'E', label: 'Empty' }]} onChange={v => onChange({ lade: v as 'F' | 'E', vgm: v === 'E' ? null : move.vgm })} />
          </Field>
          <Field label={move.lade === 'F' ? 'Booking Ref' : 'B/L Ref'} required>
            <input className="gecko-input gecko-input-sm" value={move.booking} onChange={e => onChange({ booking: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} placeholder="e.g. BKG-2026-04-…" />
          </Field>
          <Field label="Shipping Line" required>
            <input className="gecko-input gecko-input-sm" value={move.line} onChange={e => onChange({ line: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} placeholder="e.g. CMA" />
          </Field>
          <Field label="Shipping Agent" required>
            <input className="gecko-input gecko-input-sm" value={move.agentCode} onChange={e => onChange({ agentCode: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} placeholder="e.g. CMA-TH" />
          </Field>
        </div>
      </SubBlock>

      <SubBlock title="Container" desc="Verify BIC code (system checks digit). Type/size from ISO 6346 catalog.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Container No." required span={2}>
            <div style={{ position: 'relative' }}>
              <input className="gecko-input gecko-input-sm" value={move.ctr} onChange={e => onChange({ ctr: e.target.value })} placeholder="e.g. CMAU 331876-2" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: move.ctr ? 700 : 400, fontSize: 14, paddingRight: 60 }} />
              <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 2 }}>
                <button title="OCR capture" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={14} /></button>
                <button title="Check digit valid" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={14} /></button>
              </div>
            </div>
          </Field>
          <Field label="ISO Type" required>
            <select className="gecko-input gecko-input-sm" value={move.iso} onChange={e => {
              const v = e.target.value;
              onChange({ iso: v, teu: v.startsWith('40') || v.startsWith('45') ? 2 : 1 });
            }} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
              <option>20GP</option><option>20RF</option><option>20TK</option>
              <option>40GP</option><option>40HC</option><option>40RF</option><option>45HC</option>
            </select>
          </Field>
          <Field label="Condition" required>
            <SegToggle value={move.condition} options={[{ k: 'sound', label: 'Sound' }, { k: 'damaged', label: 'Damaged' }]} onChange={v => onChange({ condition: v, statusCode: v === 'damaged' ? 'DMG' : 'NOR' })} />
          </Field>
          <Field label="Status Code" required>
            <select className="gecko-input gecko-input-sm" value={move.statusCode} onChange={e => onChange({ statusCode: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
              {STATUS_CODES.map(s => <option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
            </select>
          </Field>
        </div>
      </SubBlock>

      {move.condition === 'damaged' && <DamagePanel move={move} onChange={onChange} />}

      <SubBlock title="Seals" desc="Capture all seals present at gate. Customs/terminal seals optional.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <SealField label="Shipper Seal" value={move.sealShipper} onChange={v => onChange({ sealShipper: v })} required />
          <SealField label="Line Seal"    value={move.sealLine}    onChange={v => onChange({ sealLine: v })}    required />
          <SealField label="Customs Seal" value=""                 placeholder="Optional" />
        </div>
      </SubBlock>

      {move.lade === 'F' && (
        <SubBlock title="VGM (SOLAS)" desc="Required for export laden. SOLAS VI Reg. 2.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Field label="VGM (kg)" required>
              <input className="gecko-input gecko-input-sm" value={move.vgm ?? ''} onChange={e => onChange({ vgm: parseInt(e.target.value) || null })} style={{ fontFamily: 'var(--gecko-font-mono)', textAlign: 'right', fontWeight: 700 }} placeholder="Required" />
            </Field>
            <Field label="VGM Method" required>
              <select className="gecko-input gecko-input-sm" value={move.vgmMethod ?? 'M1'} onChange={e => onChange({ vgmMethod: e.target.value })}>
                <option value="M1">Method 1 · Weighbridge</option>
                <option value="M2">Method 2 · Calculated</option>
              </select>
            </Field>
            <Field label="Weighbridge Ticket">
              <input className="gecko-input gecko-input-sm" value={move.wbTicket ?? ''} onChange={e => onChange({ wbTicket: e.target.value })} placeholder="e.g. WB-…" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
            </Field>
            <Field label="Verified by">
              <input className="gecko-input gecko-input-sm" value={move.vgmVerifiedBy ?? ''} onChange={e => onChange({ vgmVerifiedBy: e.target.value })} placeholder="Clerk name" />
            </Field>
          </div>
        </SubBlock>
      )}

      <SubBlock title="Dangerous Goods" desc="Tick if shipment contains DG. UN# and IMO class required if so.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: move.dg ? 'var(--gecko-error-50)' : 'var(--gecko-bg-subtle)', borderRadius: 6, border: `1px solid ${move.dg ? 'var(--gecko-error-200)' : 'var(--gecko-border)'}` }}>
          <Icon name="flame" size={16} style={{ color: move.dg ? 'var(--gecko-error-600)' : 'var(--gecko-text-secondary)', flexShrink: 0 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={move.dg} onChange={e => onChange({ dg: e.target.checked })} />
            <span style={{ color: move.dg ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)' }}>{move.dg ? 'Dangerous goods declared' : 'No DG on this unit'}</span>
          </label>
          {move.dg && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 130px)', gap: 10 }}>
              <Field label="IMDG Class">
                <input className="gecko-input gecko-input-sm" value={move.dgClass} onChange={e => onChange({ dgClass: e.target.value })} placeholder="e.g. 3" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
              </Field>
              <Field label="UN No." required>
                <input className="gecko-input gecko-input-sm" value={move.dgUn} onChange={e => onChange({ dgUn: e.target.value })} placeholder="UN____" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
              </Field>
              <Field label="Packing Group">
                <select className="gecko-input gecko-input-sm" value={move.dgPg ?? 'III'} onChange={e => onChange({ dgPg: e.target.value })}><option>I</option><option>II</option><option>III</option></select>
              </Field>
            </div>
          )}
        </div>
      </SubBlock>

      <SubBlock title="Yard placement" desc="Pre-assigned by yard planner. Clerk verifies.">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Yard spot">
            <input className="gecko-input gecko-input-sm" value={move.yardSpot} onChange={e => onChange({ yardSpot: e.target.value })} placeholder="e.g. CY · Block B · Row 04 · Slot 12" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Notes">
            <input className="gecko-input gecko-input-sm" value={move.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </SubBlock>
    </div>
  );
}

// ── Pickup form ───────────────────────────────────────────────────────────────

function PickupForm({ move, onChange }: { move: PickMove; onChange: (p: Partial<PickMove>) => void }) {
  const ctrMatches = move.ctrAssigned === move.ctrPlanned;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SubBlock title="Release authority" desc="EDO is the binding release order. Container is pre-assigned by yard planner.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="EDO No." required span={2}>
            <div style={{ position: 'relative' }}>
              <input className="gecko-input gecko-input-sm" value={move.edo} onChange={e => onChange({ edo: e.target.value })} placeholder="e.g. EDO-2026-04-…" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: move.edo ? 700 : 400, paddingRight: 30 }} />
              {move.edo && <Icon name="check" size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-success-600)' }} />}
            </div>
          </Field>
          <Field label="Shipping Line" required>
            <input className="gecko-input gecko-input-sm" value={move.line} onChange={e => onChange({ line: e.target.value })} placeholder="e.g. OOL" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
          </Field>
          <Field label="Requested Type" required>
            <select className="gecko-input gecko-input-sm" value={move.isoReq} onChange={e => {
              const v = e.target.value;
              onChange({ isoReq: v, teu: v.startsWith('40') || v.startsWith('45') ? 2 : 1 });
            }} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
              <option>20GP</option><option>20RF</option>
              <option>40GP</option><option>40HC</option><option>40RF</option><option>45HC</option>
            </select>
          </Field>
        </div>
      </SubBlock>

      <SubBlock title="Container assigned" desc="Pre-assigned in yard plan. Verify the unit number matches before release.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Planned (yard)" span={2}>
            <input className="gecko-input gecko-input-sm" value={move.ctrPlanned} readOnly style={{ background: 'var(--gecko-bg-subtle)', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }} />
          </Field>
          <Field label="Verified at gate" required span={2}>
            <div style={{ position: 'relative' }}>
              <input
                className="gecko-input gecko-input-sm"
                value={move.ctrAssigned}
                onChange={e => onChange({ ctrAssigned: e.target.value })}
                placeholder="Scan or type container no."
                style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: move.ctrAssigned ? 700 : 400, fontSize: 14, paddingRight: 60 }}
              />
              <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 2 }}>
                <button title="OCR capture" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={14} /></button>
                <button title={ctrMatches ? 'Matches plan' : 'Mismatch with plan'} style={{ height: 24, width: 24, border: 'none', background: ctrMatches ? 'var(--gecko-success-50)' : 'var(--gecko-error-50)', color: ctrMatches ? 'var(--gecko-success-700)' : 'var(--gecko-error-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={ctrMatches ? 'shieldCheck' : 'warning'} size={14} />
                </button>
              </div>
            </div>
          </Field>
        </div>
        {!ctrMatches && (
          <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={13} />
            Container number does not match the planned unit. Confirm with yard supervisor before releasing.
          </div>
        )}
      </SubBlock>

      <SubBlock title="Pre-trip & seal" desc="Inspect condition, then apply terminal seal before truck leaves.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Pre-trip Inspection" required>
            <SegToggle
              value={move.preTrip ? 'pass' : ''}
              options={[{ k: 'pass', label: 'Passed' }, { k: 'fail', label: 'Failed' }]}
              onChange={v => onChange({ preTrip: v === 'pass' })}
            />
          </Field>
          <Field label="Condition Out" required>
            <SegToggle
              value={move.condition}
              options={[{ k: 'sound', label: 'Sound' }, { k: 'damaged', label: 'Damaged' }]}
              onChange={v => onChange({ condition: v })}
            />
          </Field>
          <SealField label="Terminal Seal" value={move.sealApplied} onChange={v => onChange({ sealApplied: v })} placeholder="Apply at gate" required span={2} />
        </div>
      </SubBlock>

      <SubBlock title="Yard pickup point" desc="Where the unit currently sits.">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Yard spot">
            <input className="gecko-input gecko-input-sm" value={move.yardSpot} readOnly placeholder="Assigned by yard planner" style={{ background: 'var(--gecko-bg-subtle)', fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Notes">
            <input className="gecko-input gecko-input-sm" value={move.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </SubBlock>
    </div>
  );
}

// ── Move row ──────────────────────────────────────────────────────────────────

function MoveRow({ move, index, open, issues, onToggle, onRemove, onChange }: {
  move: Move; index: number; open: boolean;
  issues: ValidationIssue[];
  onToggle: () => void; onRemove: () => void;
  onChange: (p: any) => void;
}) {
  const isDrop = move.kind === 'drop';
  const accent     = isDrop ? 'var(--gecko-info-500)'   : 'var(--gecko-primary-600)';
  const accentSoft = isDrop ? 'var(--gecko-info-50)'    : 'var(--gecko-primary-50)';
  const errCount  = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  const ctr = isDrop ? (move as DropMove).ctr : (move as PickMove).ctrAssigned;
  const isoLabel = isDrop ? (move as DropMove).iso : (move as PickMove).isoReq;
  const ref = isDrop ? `Booking ${(move as DropMove).booking || '—'}` : `EDO ${(move as PickMove).edo || '—'}`;

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
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>
          {index}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: accent, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          <Icon name="arrowRight" size={11} style={{ transform: isDrop ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
          {isDrop ? 'DROP-OFF' : 'PICKUP'}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {ctr || (isDrop ? '— assign container —' : '— from yard —')}
            </span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 600, padding: '2px 6px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 3, color: 'var(--gecko-text-secondary)' }}>
              {isoLabel}
            </span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{move.teu} TEU</span>
            {isDrop && (move as DropMove).lade === 'F' && <span className="gecko-badge gecko-badge-warning" style={{ fontSize: 9 }}>LADEN</span>}
            {isDrop && (move as DropMove).lade === 'E' && <span className="gecko-badge gecko-badge-gray"    style={{ fontSize: 9 }}>EMPTY</span>}
            {isDrop && (move as DropMove).dg && <span style={{ padding: '2px 5px', fontSize: 9, fontWeight: 700, borderRadius: 3, background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)' }}>DG</span>}
            {move.statusCode && move.statusCode !== 'NOR' && <MoveStatusBadge code={move.statusCode} />}
            {isDrop && (move as DropMove).damages?.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', fontSize: 9, fontWeight: 700, borderRadius: 3, background: 'var(--gecko-error-50)', color: 'var(--gecko-error-700)', border: '1px solid var(--gecko-error-200)', fontFamily: 'var(--gecko-font-mono)' }}>
                <Icon name="warning" size={9} />{(move as DropMove).damages.length} DMG
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', gap: 8, fontFamily: 'var(--gecko-font-mono)' }}>
            <span>{ref}</span>
            <span>·</span>
            <span>{move.line || 'line —'}{move.agentCode ? ` (${move.agentCode})` : ''}</span>
            <span>·</span>
            <span>{move.yardSpot || 'spot —'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {errCount  > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-error-100)',   color: 'var(--gecko-error-700)'   }}><Icon name="warning" size={10} />{errCount}</span>}
          {warnCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' }}><Icon name="warning" size={10} />{warnCount}</span>}
          {errCount === 0 && warnCount === 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}><Icon name="check" size={10} />OK</span>}
        </div>

        <div>
          {move.status === 'done'    && <span className="gecko-badge gecko-badge-success" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="success" />Saved</span>}
          {move.status === 'active'  && <span className="gecko-badge gecko-badge-warning" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="warning" />Editing</span>}
          {move.status === 'pending' && <span className="gecko-badge gecko-badge-gray"    style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center' }}><StatusDot kind="gray" />Pending</span>}
        </div>

        <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: '18px 22px 22px', background: '#fff', borderTop: `1px solid ${accent}`, borderLeft: `3px solid ${accent}` }}>
          {isDrop
            ? <DropOffForm move={move as DropMove} onChange={onChange} />
            : <PickupForm  move={move as PickMove} onChange={onChange} />
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, marginTop: 18, borderTop: '1px solid var(--gecko-border)' }}>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              Move <strong style={{ color: 'var(--gecko-text-primary)' }}>#{index}</strong> · {isDrop ? 'Receival' : 'Delivery'} · auto-saved 14:41
            </div>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onRemove} style={{ color: 'var(--gecko-error-600)' }}>
              <Icon name="trash" size={12} />Remove move
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onToggle}>Collapse</button>
            <button className="gecko-btn gecko-btn-sm" style={{ background: accent, color: '#fff', border: `1px solid ${accent}` }}>
              <Icon name="check" size={12} />Save move
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Container moves card ──────────────────────────────────────────────────────

function ContainerMovesCard({ moves, activeId, setActiveId, addMove, removeMove, updateMove, teuUsed, teuCap, dropTeu, pickTeu, issues }: {
  moves: Move[]; activeId: number | null; setActiveId: (id: number | null) => void;
  addMove: (kind: 'drop' | 'pick') => void;
  removeMove: (id: number) => void;
  updateMove: (id: number, patch: any) => void;
  teuUsed: number; teuCap: number; dropTeu: number; pickTeu: number;
  issues: ValidationIssue[];
}) {
  const dropFull = dropTeu >= teuCap;
  const pickFull = pickTeu >= teuCap;

  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</div>
        <Icon name="box" size={15} style={{ color: 'var(--gecko-text-secondary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Container Moves</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            {moves.length} move{moves.length === 1 ? '' : 's'} · {dropTeu} TEU in / {pickTeu} TEU out · cap {teuCap} TEU per leg
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => addMove('drop')} disabled={dropFull} style={{ opacity: dropFull ? 0.4 : 1 }} title={dropFull ? `Drop-off leg full (${teuCap} TEU)` : 'Add a drop-off (receival)'}>
            <Icon name="arrowRight" size={12} style={{ transform: 'rotate(90deg)' }} />Add Drop-off
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => addMove('pick')} disabled={pickFull} style={{ opacity: pickFull ? 0.4 : 1 }} title={pickFull ? `Pickup leg full (${teuCap} TEU)` : 'Add a pickup (delivery)'}>
            <Icon name="arrowRight" size={12} style={{ transform: 'rotate(-90deg)' }} />Add Pickup
          </button>
        </div>
      </div>

      <CapacityBar dropTeu={dropTeu} pickTeu={pickTeu} cap={teuCap} />

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
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 6 }}>No container moves yet</div>
              <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
                A truck visit can carry up to <strong>2 TEU</strong> per leg. Add a drop-off (receival) for containers coming in, or a pickup (delivery) for containers going out.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => addMove('drop')}>
                <Icon name="arrowRight" size={13} style={{ transform: 'rotate(90deg)' }} />Add Drop-off (receival)
              </button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => addMove('pick')}>
                <Icon name="arrowRight" size={13} style={{ transform: 'rotate(-90deg)' }} />Add Pickup (delivery)
              </button>
            </div>
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
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>One driver / one truck for the whole visit · arrived {truck.arrivedAt} · {truck.lane}</div>
        </div>
        {truck.apptVerified && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}>
              <Icon name="shieldCheck" size={11} />APPOINTMENT VERIFIED · {truck.apptSlot}
            </span>
            <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>booked {truck.apptBookedAt} by {truck.apptBookedBy}</span>
          </div>
        )}
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
          <input className="gecko-input gecko-input-sm" defaultValue={truck.transporter} />
        </Field>
        <Field label="Appointment Ref">
          <div style={{ position: 'relative' }}>
            <input className="gecko-input gecko-input-sm" defaultValue={truck.appt} style={{ fontFamily: 'var(--gecko-font-mono)', paddingRight: 30 }} />
            <Icon name="check" size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-success-600)' }} />
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
        <Field label="Safety Briefing">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon name="check" size={14} /> Acknowledged {truck.arrivedAt}
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
        <Field label="Appt Source">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
            <Icon name={truck.apptSource === 'slot-booking' ? 'calendar' : 'user'} size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
            {truck.apptSource === 'slot-booking' ? 'Slot booking (TAS)' : 'Walk-in'}
          </div>
        </Field>
        <Field label="Lane Assigned">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>
            <Icon name="mapPin" size={13} /> {truck.lane}
          </div>
        </Field>
      </div>
    </section>
  );
}

// ── Visit summary rail ────────────────────────────────────────────────────────

function VisitSummaryRail({ moves, dropTeu, pickTeu, teuCap, teuUsed, teuRemaining, errCount, warnCount }: {
  moves: Move[]; dropTeu: number; pickTeu: number;
  teuCap: number; teuUsed: number; teuRemaining: number;
  errCount: number; warnCount: number;
}) {
  const dropCount   = moves.filter(m => m.kind === 'drop').length;
  const pickCount   = moves.filter(m => m.kind === 'pick').length;
  const dgCount     = moves.filter(m => m.kind === 'drop' && (m as DropMove).dg).length;

  const charges = [];
  if (dropCount) charges.push({ code: 'GATE-IN',  desc: `Gate-in fee · ${dropCount} unit${dropCount > 1 ? 's' : ''}`,  qty: dropCount, rate: 150,  amount: dropCount * 150  });
  if (pickCount) charges.push({ code: 'GATE-OUT', desc: `Gate-out fee · ${pickCount} unit${pickCount > 1 ? 's' : ''}`, qty: pickCount, rate: 150,  amount: pickCount * 150  });
  if (dropCount) charges.push({ code: 'LIFT-OFF', desc: `Lift-off · ${dropCount} unit${dropCount > 1 ? 's' : ''}`,    qty: dropCount, rate: 850,  amount: dropCount * 850  });
  if (pickCount) charges.push({ code: 'LIFT-ON',  desc: `Lift-on · ${pickCount} unit${pickCount > 1 ? 's' : ''}`,    qty: pickCount, rate: 850,  amount: pickCount * 850  });
  if (dgCount)   charges.push({ code: 'DG-HNDL',  desc: 'DG handling surcharge',                                      qty: dgCount,   rate: 1200, amount: dgCount * 1200   });
  charges.push(                { code: 'DOC-FEE',  desc: 'Gate Pass · documentation',                                  qty: 1,         rate: 200,  amount: 200              });

  const subtotal = charges.reduce((s, c) => s + c.amount, 0);
  const vat = Math.round(subtotal * 0.07);
  const wht = Math.round(subtotal * 0.03);
  const net = subtotal + vat - wht;
  const ready = errCount === 0;

  return (
    <aside className="gecko-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Visit Summary</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Live · auto-saved</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}>
            <Icon name="lock" size={10} />TARIFF LOCKED
          </span>
        </div>
      </div>

      {/* Move counters */}
      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ padding: 10, background: 'var(--gecko-info-50)', borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-info-700)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Drop-offs</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, lineHeight: 1.1, color: 'var(--gecko-info-700)' }}>
            {dropCount}<span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500, marginLeft: 4 }}>· {dropTeu} TEU</span>
          </div>
        </div>
        <div style={{ padding: 10, background: 'var(--gecko-primary-50)', borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-primary-700)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pickups</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, lineHeight: 1.1, color: 'var(--gecko-primary-700)' }}>
            {pickCount}<span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500, marginLeft: 4 }}>· {pickTeu} TEU</span>
          </div>
        </div>
      </div>

      {/* Capacity meter */}
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
          {teuRemaining > 0 ? `${teuRemaining} TEU available on this leg` : 'At capacity — no more moves can be added'}
        </div>
      </div>

      {/* Charges */}
      <div style={{ borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Charges</div>
        <div style={{ padding: '4px 0 8px', maxHeight: 170, overflow: 'auto' }}>
          {charges.map(c => (
            <div key={c.code} style={{ padding: '5px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--gecko-text-primary)', fontWeight: 500 }}>{c.desc}</div>
                <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{c.code} · {c.qty} × ฿{c.rate}</div>
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, textAlign: 'right' }}>฿{c.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid var(--gecko-border)' }}>
          <TotalRowLite label="Subtotal" value={`฿${subtotal.toLocaleString()}`} />
          <TotalRowLite label="VAT 7%"   value={`฿${vat.toLocaleString()}`} />
          <TotalRowLite label="WHT 3%"   value={`-฿${wht.toLocaleString()}`} negative />
        </div>
      </div>

      {/* Net payable */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em' }}>NET PAYABLE</div>
          <div style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>THB · this visit</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em' }}>฿{net.toLocaleString()}</div>
      </div>

      {/* Validation state */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Validation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ValidationLine ok={errCount === 0}  label={`${errCount} error${errCount === 1 ? '' : 's'} blocking commit`}      kind="error"   />
          <ValidationLine ok={warnCount === 0} label={`${warnCount} warning${warnCount === 1 ? '' : 's'} (override allowed)`} kind="warning" />
          <ValidationLine ok={true}            label="Tariff resolved · all rates locked"                                      kind="success" />
        </div>
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
            border: 'none', fontWeight: 700,
            cursor: ready ? 'pointer' : 'not-allowed',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Icon name="check" size={14} />Commit Visit · Open Gate
        </button>
        <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-bg-subtle)', borderRadius: 6, fontSize: 10, color: 'var(--gecko-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          On commit, system prints <strong style={{ color: 'var(--gecko-text-primary)' }}>1 consolidated Gate Pass</strong> listing all {moves.length} move{moves.length === 1 ? '' : 's'}<br />
          + audit log entry per override
        </div>
      </div>
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GateInPage() {
  const { toast } = useToast();
  const [truck] = useState({
    plate: '70-4455', trailer: 'TLR-442-9', transporter: 'Laem Chabang Trans.',
    driver: 'Prem Kanchana', license: 'TH-D-8841-22', mobile: '+66 87 341 2200',
    appt: 'APT-2026-04-4432', apptVerified: true, apptSource: 'slot-booking',
    apptSlot: '14:30 – 15:00', apptBookedAt: '2026-04-23 09:14', apptBookedBy: 'Thai Union Group PCL',
    truckCategory: '18W', orderType: 'EXP CY/CY', arrivedAt: '14:34', lane: 'Lane 3',
  });

  const [moves, setMoves] = useState<Move[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const TEU_CAP = 2;
  const dropTeu = moves.filter(m => m.kind === 'drop').reduce((s, m) => s + m.teu, 0);
  const pickTeu = moves.filter(m => m.kind === 'pick').reduce((s, m) => s + m.teu, 0);
  const teuUsed = Math.max(dropTeu, pickTeu);
  const teuRemaining = TEU_CAP - teuUsed;

  const issues: ValidationIssue[] = [];
  moves.forEach(m => {
    if (m.kind === 'drop') {
      const d = m as DropMove;
      if (!d.ctr) issues.push({ moveId: m.id, level: 'error', msg: 'Container number required' });
      if (d.lade === 'F' && !d.vgm) issues.push({ moveId: m.id, level: 'error', msg: 'VGM required for export laden' });
      if (d.dg && !d.dgUn) issues.push({ moveId: m.id, level: 'error', msg: 'UN# required when DG declared' });
    } else {
      const p = m as PickMove;
      if (!p.edo) issues.push({ moveId: m.id, level: 'error', msg: 'EDO required' });
      if (!p.sealApplied) issues.push({ moveId: m.id, level: 'warn', msg: 'Seal not yet applied' });
      if (!p.preTrip) issues.push({ moveId: m.id, level: 'warn', msg: 'Pre-trip inspection pending' });
    }
  });
  const errCount  = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  const addMove = (kind: 'drop' | 'pick') => {
    if (kind === 'drop' && dropTeu >= TEU_CAP) return;
    if (kind === 'pick' && pickTeu >= TEU_CAP) return;
    const newId = Math.max(...moves.map(m => m.id), 0) + 1;
    const blank: Move = kind === 'drop'
      ? { id: newId, kind, status: 'active', ctr: '', iso: '20GP', teu: 1, lade: 'E', condition: 'sound', statusCode: 'NOR', movement: 'EXPORT', sealLine: '', sealShipper: '', booking: '', line: '', agentCode: '', vgm: null, vgmMethod: 'M1', wbTicket: '', vgmVerifiedBy: '', dg: false, dgClass: '', dgUn: '', dgPg: 'III', yardSpot: '', notes: '', damages: [] }
      : { id: newId, kind, status: 'active', edo: '', isoReq: '20GP', teu: 1, ctrAssigned: '', ctrPlanned: '', sealApplied: '', condition: 'sound', statusCode: 'NOR', preTrip: false, booking: '', line: '', agentCode: '', yardSpot: '', notes: '' };
    setMoves([...moves, blank]);
    setActiveId(newId);
  };

  const removeMove = (id: number) => {
    setMoves(prev => prev.filter(m => m.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const updateMove = (id: number, patch: any) => {
    setMoves(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageToolbar
        title="Gate-In · Truck Visit"
        subtitle={<>Receive + Release combined visit · From appointment <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', fontWeight: 600 }}>{truck.appt}</span> · Gate 1 · {truck.lane}</>}
        badges={[
          { label: 'GIN-2026-04-4429', kind: 'gray' },
          { label: 'In Progress',      kind: 'warning' },
        ]}
        actions={
          <>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => toast({ variant: 'warning', title: 'Visit cancelled', message: 'Truck visit cancelled — no movements recorded.' })}><Icon name="x" size={13} />Cancel Visit</button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Draft saved', message: 'EIR-In draft preserved — finish later.' })}><Icon name="check" size={13} />Save Draft</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={errCount > 0} onClick={() => { toast({ variant: 'success', title: 'EIR-In committed', message: 'Gate pass printed — truck cleared to enter.' }); window.print(); }}>
              <Icon name="print" size={13} />Commit · Print Gate Pass
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <TruckHeaderCard truck={truck} />
          <ContainerMovesCard
            moves={moves}
            activeId={activeId}
            setActiveId={setActiveId}
            addMove={addMove}
            removeMove={removeMove}
            updateMove={updateMove}
            teuUsed={teuUsed}
            teuCap={TEU_CAP}
            dropTeu={dropTeu}
            pickTeu={pickTeu}
            issues={issues}
          />
        </div>

        <VisitSummaryRail
          moves={moves}
          dropTeu={dropTeu}
          pickTeu={pickTeu}
          teuCap={TEU_CAP}
          teuUsed={teuUsed}
          teuRemaining={teuRemaining}
          errCount={errCount}
          warnCount={warnCount}
        />
      </div>
    </div>
  );
}
