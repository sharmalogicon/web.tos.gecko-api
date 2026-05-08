"use client";
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { PageToolbar, Field } from '@/components/ui/OpsPrimitives';

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReleaseMove {
  id: number; status: 'active' | 'done' | 'pending';
  edo: string; isoReq: string; teu: number;
  ctrPlanned: string; ctrAssigned: string;
  sealApplied: string; condition: string; statusCode: string;
  preTrip: boolean; line: string; agentCode: string;
  yardSpot: string; notes: string;
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

// ── Release form (per container) ──────────────────────────────────────────────

function ReleaseForm({ move, onChange }: { move: ReleaseMove; onChange: (p: Partial<ReleaseMove>) => void }) {
  const ctrMatches = !move.ctrAssigned || !move.ctrPlanned || move.ctrAssigned.trim() === move.ctrPlanned.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <SubBlock title="Release authority" desc="EDO is the binding release instruction from the shipping line.">
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
          <Field label="Shipping Agent">
            <input className="gecko-input gecko-input-sm" value={move.agentCode} onChange={e => onChange({ agentCode: e.target.value })} placeholder="e.g. OOL-TH" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }} />
          </Field>
        </div>
      </SubBlock>

      <SubBlock title="Container release" desc="Verify the physical unit number against the yard plan before opening the gate.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Requested ISO type" required>
            <select className="gecko-input gecko-input-sm" value={move.isoReq} onChange={e => {
              const v = e.target.value;
              onChange({ isoReq: v, teu: v.startsWith('40') || v.startsWith('45') ? 2 : 1 });
            }} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
              {ISO_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Planned (yard system)" required>
            <input className="gecko-input gecko-input-sm" value={move.ctrPlanned} onChange={e => onChange({ ctrPlanned: e.target.value })} placeholder="From yard plan" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: move.ctrPlanned ? 700 : 400 }} />
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
                <button title="OCR capture" style={{ height: 24, width: 24, border: 'none', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="camera" size={14} />
                </button>
                {move.ctrAssigned && (
                  <button title={ctrMatches ? 'Matches yard plan' : 'Mismatch!'} style={{ height: 24, width: 24, border: 'none', background: ctrMatches ? 'var(--gecko-success-50)' : 'var(--gecko-error-50)', color: ctrMatches ? 'var(--gecko-success-700)' : 'var(--gecko-error-700)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ctrMatches ? 'shieldCheck' : 'warning'} size={14} />
                  </button>
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

      <SubBlock title="Pre-trip inspection & seal" desc="Inspect condition outbound, then apply terminal seal before gate opens.">
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
              onChange={v => onChange({ condition: v, statusCode: v === 'damaged' ? 'DMG' : 'NOR' })}
            />
          </Field>
          <SealField label="Terminal Seal" value={move.sealApplied} onChange={v => onChange({ sealApplied: v })} placeholder="Apply & scan before release" required span={2} />
        </div>
        {!move.preTrip && (
          <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={13} />
            Pre-trip inspection not yet completed — required before gate opens.
          </div>
        )}
      </SubBlock>

      <SubBlock title="Container status" desc="Outbound status code recorded on the EIR.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Status Code" required>
            <select className="gecko-input gecko-input-sm" value={move.statusCode} onChange={e => onChange({ statusCode: e.target.value })} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>
              {STATUS_CODES.map(s => <option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}
            </select>
          </Field>
          <Field label="Yard pickup spot">
            <input className="gecko-input gecko-input-sm" value={move.yardSpot} readOnly placeholder="From yard system" style={{ background: 'var(--gecko-bg-subtle)', fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Notes" span={2}>
            <input className="gecko-input gecko-input-sm" value={move.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </SubBlock>
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
            {move.statusCode && move.statusCode !== 'NOR' && <MoveStatusBadge code={move.statusCode} />}
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
          {errCount  > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-error-100)',   color: 'var(--gecko-error-700)'   }}><Icon name="warning" size={10} />{errCount}</span>}
          {warnCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' }}><Icon name="warning" size={10} />{warnCount}</span>}
          {errCount === 0 && warnCount === 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}><Icon name="check" size={10} />OK</span>}
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
            <button className="gecko-btn gecko-btn-sm" style={{ background: accent, color: '#fff', border: `1px solid ${accent}` }}>
              <Icon name="check" size={12} />Save release
            </button>
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
          <Icon name="arrowRight" size={12} style={{ transform: 'rotate(-90deg)' }} />Add Pickup
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
                Add each container the truck is collecting. Each requires an EDO and container verification at the gate.
              </div>
            </div>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={addMove}>
              <Icon name="arrowRight" size={13} style={{ transform: 'rotate(-90deg)' }} />Add Pickup
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)' }}>
              <Icon name="warning" size={11} />OVERDUE · {truck.waitMins} min wait
            </span>
          )}
          {truck.appt && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)' }}>
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

function VisitSummaryRail({ moves, teuUsed, teuCap, teuRemaining, errCount, warnCount }: {
  moves: ReleaseMove[]; teuUsed: number; teuCap: number; teuRemaining: number;
  errCount: number; warnCount: number;
}) {
  const count = moves.length;

  const charges = [];
  if (count) charges.push({ code: 'GATE-OUT', desc: `Gate-out fee · ${count} unit${count > 1 ? 's' : ''}`,  qty: count, rate: 150,  amount: count * 150  });
  if (count) charges.push({ code: 'LIFT-ON',  desc: `Lift-on · ${count} unit${count > 1 ? 's' : ''}`,      qty: count, rate: 850,  amount: count * 850  });
  charges.push(            { code: 'DOC-FEE',  desc: 'Gate Pass · EIR-Out issuance',                        qty: 1,     rate: 200,  amount: 200          });

  const subtotal = charges.reduce((s, c) => s + c.amount, 0);
  const vat = Math.round(subtotal * 0.07);
  const wht = Math.round(subtotal * 0.03);
  const net = subtotal + vat - wht;
  const ready = errCount === 0 && count > 0;

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

      {/* Charges */}
      <div style={{ borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Charges</div>
        <div style={{ padding: '4px 0 8px' }}>
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

      {/* Net */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.08em' }}>NET PAYABLE</div>
          <div style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>THB · this visit</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', letterSpacing: '-0.02em' }}>฿{net.toLocaleString()}</div>
      </div>

      {/* Validation */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Validation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ValidationLine ok={count > 0}       label={count === 0 ? 'No containers added' : `${count} container${count > 1 ? 's' : ''} added`} kind="error" />
          <ValidationLine ok={errCount === 0}   label={`${errCount} error${errCount === 1 ? '' : 's'} blocking commit`}                          kind="error" />
          <ValidationLine ok={warnCount === 0}  label={`${warnCount} warning${warnCount === 1 ? '' : 's'} (override allowed)`}                   kind="warning" />
          <ValidationLine ok={true}             label="Tariff resolved · all rates locked"                                                        kind="success" />
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

// Stub lookup — in production this fetches from the gate-in record
const VISIT_STUBS: Record<string, any> = {
  'GIN-4429': { plate:'70-4455', trailer:'TLR-442-9', driver:'Prem Kanchana',    haulier:'Laem Chabang Trans.',  license:'TH-D-8841-22', mobile:'+66 87 341 2200', arrivedAt:'14:05', waitMins:42, lane:'Lane 3', appt:'APT-04-4432', truckCategory:'18W', orderType:'IMP CY/CY',  ginRef:'GIN-4429' },
  'GIN-4430': { plate:'80-2211', trailer:'TLR-381-4', driver:'Somchai Phakdi',   haulier:'THA Logistics Co.',    license:'TH-D-5521-20', mobile:'+66 81 228 9900', arrivedAt:'14:28', waitMins:19, lane:'Lane 1', appt:'APT-04-4418', truckCategory:'10W', orderType:'IMP CY/CY',  ginRef:'GIN-4430' },
  'GIN-4431': { plate:'71-9033', trailer:'TLR-209-1', driver:'Wichai Boonsri',   haulier:'Siam Freight Ltd.',    license:'TH-D-7712-19', mobile:'+66 89 441 3300', arrivedAt:'13:55', waitMins:52, lane:'Lane 2', appt:'APT-04-4401', truckCategory:'18W', orderType:'IMP CY/CY',  ginRef:'GIN-4431' },
};

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
    if (!m.edo)         issues.push({ moveId: m.id, level: 'error', msg: 'EDO required' });
    if (!m.ctrAssigned) issues.push({ moveId: m.id, level: 'error', msg: 'Container number required' });
    if (!m.preTrip)     issues.push({ moveId: m.id, level: 'warn',  msg: 'Pre-trip inspection pending' });
    if (!m.sealApplied) issues.push({ moveId: m.id, level: 'warn',  msg: 'Terminal seal not applied' });
  });
  const errCount  = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;

  const addMove = () => {
    if (teuUsed >= TEU_CAP) return;
    const newId = Math.max(...moves.map(m => m.id), 0) + 1;
    const blank: ReleaseMove = {
      id: newId, status: 'active',
      edo: '', isoReq: '20GP', teu: 1,
      ctrPlanned: '', ctrAssigned: '',
      sealApplied: '', condition: 'sound', statusCode: 'NOR',
      preTrip: false, line: '', agentCode: '',
      yardSpot: '', notes: '',
    };
    setMoves(prev => [...prev, blank]);
    setActiveId(newId);
  };

  const removeMove  = (id: number) => { setMoves(prev => prev.filter(m => m.id !== id)); if (activeId === id) setActiveId(null); };
  const updateMove  = (id: number, patch: Partial<ReleaseMove>) => setMoves(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

  const goutRef = `GOUT-${visitId.replace('GIN-', '')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={errCount > 0 || moves.length === 0} onClick={() => { toast({ variant: 'success', title: 'EIR-Out committed', message: 'Gate pass printed — truck cleared to depart.' }); window.print(); }}>
              <Icon name="print" size={13} />Commit · Print Gate Pass
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
        />
      </div>
    </div>
  );
}
