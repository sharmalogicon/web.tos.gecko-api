"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useApiList } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';

/**
 * LIVE — POST /api/tos/vessel-calls (gecko_tos PLAN §4.1, batch A).
 *
 * ONE PHYSICAL CALL. A ship calling Laem Chabang is one row; the lines loading
 * on it are child rows, each with ITS OWN voyage (slot charters: MAEU 240W and
 * HLCU 2640W on the same ship). Vector stored one row per agent × booking type
 * — 12,291 calls in 15,515 rows — and bookings copied the ETD and cut-offs,
 * which then drifted. Here nothing is copied; bookings point at this call.
 *
 * Codes are typed, and the SERVER resolves them through master data (vessel,
 * port, terminal = a location of type TERMINAL, lines = parties that are
 * shipping lines). MDM has no vessel / port / location / party list endpoints
 * yet (its batches C and D are deferred), so the suggestions come from codes
 * already used on this tenant's calls — a hint, not the authority.
 *
 * What the mock had and the API does not store, so it is gone:
 *  - POL / POD and direction: a call is at ONE port; where the line's voyage
 *    goes next is the line's, not the depot's.
 *  - TEU capacity / allotment / reefer / OOG / DG slots: the depot does not
 *    sell ship space — the booking's equipment requirement is what it plans on.
 *  - berth / wharf: the TERMINAL is stored; berths are the terminal's business.
 *  - CFS / empty-return / laden-release / B/L cut-offs: not cut-off kinds.
 *    The eight kinds are PORT_* and YARD_* (dry, reefer, DG), VGM and SI.
 *  - voyage status buttons: status is DERIVED (OPEN → CLOSED_FOR_RECEIVING →
 *    ARRIVED → WORKING → DEPARTED), never set by hand. Cancel is its own action.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineRow { lineCode: string; voyageIn: string; voyageOut: string; agentCode: string; serviceCode: string }
interface CutoffRow { kind: string; lineCode: string; at: string; remarks: string }

interface Header {
  vesselCode: string; portCode: string; terminalCode: string; callRef: string;
  operatorVoyageIn: string; operatorVoyageOut: string;
  eta: string; etb: string; etd: string; ladenReleaseAt: string; remarks: string;
}

interface CallSummary { vesselCode: string; vesselName: string | null; portCode: string; terminalCode: string | null; lines: string[] }
interface Created { call: { vesselCallId: string } }

const KINDS: { value: string; label: string }[] = [
  { value: 'PORT_DRY', label: 'Port — dry' },
  { value: 'PORT_REEFER', label: 'Port — reefer' },
  { value: 'PORT_DG', label: 'Port — DG' },
  { value: 'YARD_DRY', label: 'Yard — dry' },
  { value: 'YARD_REEFER', label: 'Yard — reefer' },
  { value: 'YARD_DG', label: 'Yard — DG' },
  { value: 'VGM', label: 'VGM' },
  { value: 'SI', label: 'Shipping instructions' },
];

const BLANK_LINE: LineRow = { lineCode: '', voyageIn: '', voyageOut: '', agentCode: '', serviceCode: '' };
const BLANK_CUTOFF: CutoffRow = { kind: 'PORT_DRY', lineCode: '', at: '', remarks: '' };
const INITIAL: Header = {
  vesselCode: '', portCode: 'THLCH', terminalCode: '', callRef: '',
  operatorVoyageIn: '', operatorVoyageOut: '', eta: '', etb: '', etd: '', ladenReleaseAt: '', remarks: '',
};

const upper = (v: string) => v.toUpperCase();
const clean = (v: string) => (v.trim() === '' ? null : v.trim().toUpperCase());
const iso = (v: string) => (v ? new Date(v).toISOString() : null);

// ── Module-level components (declared here, not in render, so inputs keep focus) ──

function SectionCard({ title, sub, accent, children, action }: {
  title: string; sub?: string; accent?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
      borderRadius: 14, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden',
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div className="gecko-row gecko-row-between" style={{ padding: '14px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
          {sub && <div className="gecko-cell-meta" style={{ marginTop: 3 }}>{sub}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: '22px 24px' }}>{children}</div>
    </div>
  );
}

function Field({ label, required, hint, error, children, span }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; span?: number;
}) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {error
        ? <div style={{ marginTop: 3, fontSize: 11, color: 'var(--gecko-error-600)' }}>{error}</div>
        : hint && <div className="gecko-helper-text">{hint}</div>}
    </div>
  );
}

function RowErrors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--gecko-error-600)' }}>
      {messages.map((m, i) => <div key={i}>{m}</div>)}
    </div>
  );
}

const mono: React.CSSProperties = { fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' };

function LineEditor({ row, index, errors, canRemove, onChange, onRemove }: {
  row: LineRow; index: number; errors: string[]; canRemove: boolean;
  onChange: (patch: Partial<LineRow>) => void; onRemove: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1.1fr 0.9fr 36px', gap: 10, alignItems: 'end',
      padding: '10px 0', borderBottom: '1px dashed var(--gecko-border)' }}>
      <Field label={index === 0 ? 'Line code' : ''} required={index === 0}>
        <input className={`gecko-input${errors.length ? ' gecko-input-error' : ''}`} style={mono} list="known-lines" placeholder="MAEU"
          aria-label={`Line ${index + 1} code`} value={row.lineCode} onChange={e => onChange({ lineCode: upper(e.target.value) })} />
      </Field>
      <Field label={index === 0 ? 'Voyage in' : ''}>
        <input className="gecko-input" style={mono} maxLength={20} placeholder="240E" aria-label={`Line ${index + 1} voyage in`}
          value={row.voyageIn} onChange={e => onChange({ voyageIn: upper(e.target.value) })} />
      </Field>
      <Field label={index === 0 ? 'Voyage out' : ''}>
        <input className="gecko-input" style={mono} maxLength={20} placeholder="240W" aria-label={`Line ${index + 1} voyage out`}
          value={row.voyageOut} onChange={e => onChange({ voyageOut: upper(e.target.value) })} />
      </Field>
      <Field label={index === 0 ? 'Agent code' : ''}>
        <input className="gecko-input" style={mono} placeholder="optional" aria-label={`Line ${index + 1} agent`}
          value={row.agentCode} onChange={e => onChange({ agentCode: upper(e.target.value) })} />
      </Field>
      <Field label={index === 0 ? 'Service' : ''}>
        <input className="gecko-input" style={mono} maxLength={20} placeholder="FE3" aria-label={`Line ${index + 1} service`}
          value={row.serviceCode} onChange={e => onChange({ serviceCode: upper(e.target.value) })} />
      </Field>
      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onRemove} disabled={!canRemove}
        title={canRemove ? 'Remove line' : 'A call needs at least one line'} aria-label={`Remove line ${index + 1}`} style={{ padding: '0 8px', height: 34 }}>
        <Icon name="trash" size={14} />
      </button>
      <RowErrors messages={errors} />
    </div>
  );
}

function CutoffEditor({ row, index, lineCodes, errors, onChange, onRemove }: {
  row: CutoffRow; index: number; lineCodes: string[]; errors: string[];
  onChange: (patch: Partial<CutoffRow>) => void; onRemove: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr 1.6fr 36px', gap: 10, alignItems: 'end',
      padding: '10px 0', borderBottom: '1px dashed var(--gecko-border)' }}>
      <Field label={index === 0 ? 'Kind' : ''}>
        <select className={`gecko-input${errors.length ? ' gecko-input-error' : ''}`} aria-label={`Cut-off ${index + 1} kind`}
          value={row.kind} onChange={e => onChange({ kind: e.target.value })}>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      <Field label={index === 0 ? 'Applies to' : ''}>
        <select className="gecko-input" aria-label={`Cut-off ${index + 1} line`} value={row.lineCode} onChange={e => onChange({ lineCode: e.target.value })}>
          <option value="">Every line</option>
          {lineCodes.map(l => <option key={l} value={l}>{l} only</option>)}
        </select>
      </Field>
      <Field label={index === 0 ? 'At' : ''}>
        <input type="datetime-local" className="gecko-input" aria-label={`Cut-off ${index + 1} time`}
          value={row.at} onChange={e => onChange({ at: e.target.value })} />
      </Field>
      <Field label={index === 0 ? 'Remarks' : ''}>
        <input className="gecko-input" maxLength={300} placeholder="optional" aria-label={`Cut-off ${index + 1} remarks`}
          value={row.remarks} onChange={e => onChange({ remarks: e.target.value })} />
      </Field>
      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onRemove}
        title="Remove cut-off" aria-label={`Remove cut-off ${index + 1}`} style={{ padding: '0 8px', height: 34 }}>
        <Icon name="trash" size={14} />
      </button>
      <RowErrors messages={errors} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewVesselCallPage() {
  const router = useRouter();
  const [header, setHeader] = useState<Header>(INITIAL);
  const [lines, setLines] = useState<LineRow[]>([{ ...BLANK_LINE }]);
  const [cutoffs, setCutoffs] = useState<CutoffRow[]>([
    { ...BLANK_CUTOFF, kind: 'PORT_DRY' },
    { ...BLANK_CUTOFF, kind: 'PORT_REEFER' },
    { ...BLANK_CUTOFF, kind: 'VGM' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const set = (patch: Partial<Header>) => setHeader(prev => ({ ...prev, ...patch }));

  // Suggestions: codes already used on this tenant's calls (MDM has no list endpoints yet).
  const { data: known } = useApiList<CallSummary>('/api/tos/vessel-calls?pageSize=200');
  const suggestions = useMemo(() => {
    const vessels = new Map<string, string | null>();
    const terminals = new Set<string>();
    const ports = new Set<string>();
    const lineCodes = new Set<string>();
    for (const c of known ?? []) {
      vessels.set(c.vesselCode, c.vesselName);
      ports.add(c.portCode);
      if (c.terminalCode) terminals.add(c.terminalCode);
      for (const l of c.lines) lineCodes.add(l.split(' ')[0]);
    }
    return { vessels: [...vessels].sort(), terminals: [...terminals].sort(), ports: [...ports].sort(), lines: [...lineCodes].sort() };
  }, [known]);

  const enteredLines = useMemo(() => [...new Set(lines.map(l => l.lineCode.trim()).filter(Boolean))], [lines]);

  // Only the obvious guards; the server is the authority.
  const etdBeforeEta = header.eta !== '' && header.etd !== '' && new Date(header.etd) <= new Date(header.eta);
  const canSave = !saving && header.vesselCode.trim() !== '' && header.portCode.trim() !== ''
    && header.eta !== '' && header.etd !== '' && !etdBeforeEta && lines.some(l => l.lineCode.trim() !== '');

  const fieldError = (name: string) => error?.forField(name);
  const rowErrors = (prefix: string) => {
    if (!error) return [];
    const p = prefix.toLowerCase();
    return Object.entries(error.fieldErrors)
      .filter(([k]) => k.toLowerCase() === p || k.toLowerCase().startsWith(`${p}.`))
      .flatMap(([, v]) => v);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const body = {
      vesselCode: clean(header.vesselCode),
      portCode: clean(header.portCode),
      terminalCode: clean(header.terminalCode),
      callRef: clean(header.callRef),
      operatorVoyageIn: clean(header.operatorVoyageIn),
      operatorVoyageOut: clean(header.operatorVoyageOut),
      eta: iso(header.eta),
      etb: iso(header.etb),
      etd: iso(header.etd),
      // Before this moment a full export box may not leave the depot
      // (BEFORE_LADEN_RELEASE at the gate). Empty = no restriction.
      ladenReleaseAt: iso(header.ladenReleaseAt),
      remarks: header.remarks.trim() || null,
      lines: lines.filter(l => l.lineCode.trim() !== '').map(l => ({
        lineCode: clean(l.lineCode),
        voyageIn: clean(l.voyageIn),
        voyageOut: clean(l.voyageOut),
        agentCode: clean(l.agentCode),
        serviceCode: clean(l.serviceCode),
      })),
      cutoffs: cutoffs.filter(c => c.at !== '').map(c => ({
        kind: c.kind,
        lineCode: c.lineCode || null,
        at: iso(c.at),
        remarks: c.remarks.trim() || null,
      })),
    };
    try {
      const created = await apiSend<Created>('POST', '/api/tos/vessel-calls', body);
      router.push(`/masters/vessels/schedule/${created.call.vesselCallId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  // Row indexes in the server's error keys count only the rows actually sent.
  const sentLineIndex = (i: number) => lines.slice(0, i + 1).filter(l => l.lineCode.trim() !== '').length - 1;
  const sentCutoffIndex = (i: number) => cutoffs.slice(0, i + 1).filter(c => c.at !== '').length - 1;

  const errorCount = error ? Object.keys(error.fieldErrors).length : 0;

  return (
    <div className="gecko-stack" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 22, paddingBottom: 100 }}>

      <datalist id="known-vessels">{suggestions.vessels.map(([code, name]) => <option key={code} value={code}>{name ?? ''}</option>)}</datalist>
      <datalist id="known-terminals">{suggestions.terminals.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id="known-ports">{suggestions.ports.map(p => <option key={p} value={p} />)}</datalist>
      <datalist id="known-lines">{suggestions.lines.map(l => <option key={l} value={l} />)}</datalist>

      {/* Breadcrumb + Title */}
      <nav className="gecko-breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/vessels/schedule" className="gecko-breadcrumb-item">Vessel Call Schedule</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Vessel Call</span>
      </nav>

      <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--gecko-border)' }}>
        <h1 className="gecko-page-title">New Vessel Call</h1>
        <div className="gecko-page-subtitle gecko-mt-2">
          One ship, one call at one port. Add every line loading on it with its own voyage, then the cut-offs. Bookings point at this call — nothing is copied onto them.
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Icon name="alertCircle" size={16} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.status === 409 ? error.message : errorCount > 1 ? `${errorCount} things to fix before this call can be saved.` : error.message}</div>
          </div>
        </div>
      )}

      {/* ── 1: The call ─────────────────────────────────────────────────── */}
      <SectionCard title="1 · The call" sub="Which ship, where, and when — codes are checked against master data on save" accent="var(--gecko-primary-500)">
        <div className="gecko-stack" style={{ gap: 18 }}>
          <div className="gecko-grid-4" style={{ gap: 18 }}>
            <Field label="Vessel code" required error={fieldError('vesselCode')} hint="The vessel's code in master data">
              <input className={`gecko-input${fieldError('vesselCode') ? ' gecko-input-error' : ''}`} style={mono} list="known-vessels"
                placeholder="BLUEMERIDIAN" value={header.vesselCode} onChange={e => set({ vesselCode: upper(e.target.value) })} />
            </Field>
            <Field label="Port" required error={fieldError('portCode')}>
              <input className={`gecko-input${fieldError('portCode') ? ' gecko-input-error' : ''}`} style={mono} list="known-ports"
                value={header.portCode} onChange={e => set({ portCode: upper(e.target.value) })} />
            </Field>
            <Field label="Terminal" error={fieldError('terminalCode')} hint="A location of type TERMINAL, e.g. LCB-C1C2">
              <input className={`gecko-input${fieldError('terminalCode') ? ' gecko-input-error' : ''}`} style={mono} list="known-terminals"
                placeholder="optional" value={header.terminalCode} onChange={e => set({ terminalCode: upper(e.target.value) })} />
            </Field>
            <Field label="Call reference" error={fieldError('callRef')} hint="Leave empty: the server uses VESSEL-VOYAGE">
              <input className={`gecko-input${fieldError('callRef') ? ' gecko-input-error' : ''}`} style={mono} maxLength={30}
                placeholder="BLUEMERIDIAN-2640W" value={header.callRef} onChange={e => set({ callRef: upper(e.target.value) })} />
            </Field>
            <Field label="Operator voyage in" error={fieldError('operatorVoyageIn')} hint="The vessel operator's own voyage">
              <input className="gecko-input" style={mono} maxLength={20} value={header.operatorVoyageIn} onChange={e => set({ operatorVoyageIn: upper(e.target.value) })} />
            </Field>
            <Field label="Operator voyage out" error={fieldError('operatorVoyageOut')} hint="One call per vessel + port + this voyage">
              <input className="gecko-input" style={mono} maxLength={20} value={header.operatorVoyageOut} onChange={e => set({ operatorVoyageOut: upper(e.target.value) })} />
            </Field>
          </div>
          <div className="gecko-grid-3" style={{ gap: 18 }}>
            <Field label="ETA" required error={fieldError('eta')}>
              <input type="datetime-local" className={`gecko-input${fieldError('eta') ? ' gecko-input-error' : ''}`} value={header.eta} onChange={e => set({ eta: e.target.value })} />
            </Field>
            <Field label="ETB" error={fieldError('etb')} hint="Between ETA and ETD">
              <input type="datetime-local" className={`gecko-input${fieldError('etb') ? ' gecko-input-error' : ''}`} value={header.etb} onChange={e => set({ etb: e.target.value })} />
            </Field>
            <Field label="ETD" required error={fieldError('etd') ?? (etdBeforeEta ? 'ETD must be after ETA — a call that leaves when it arrives is not a schedule.' : undefined)}>
              <input type="datetime-local" className={`gecko-input${fieldError('etd') || etdBeforeEta ? ' gecko-input-error' : ''}`} value={header.etd} onChange={e => set({ etd: e.target.value })} />
            </Field>
          </div>
          <Field label="Laden release" error={fieldError('ladenReleaseAt')}
                 hint="A full export box cannot be gated out before this. Leave empty for no restriction.">
            <input type="datetime-local" className={`gecko-input${fieldError('ladenReleaseAt') ? ' gecko-input-error' : ''}`}
                   value={header.ladenReleaseAt} onChange={e => set({ ladenReleaseAt: e.target.value })} />
          </Field>
          <Field label="Remarks" error={fieldError('remarks')}>
            <input className="gecko-input" maxLength={500} placeholder="optional" value={header.remarks} onChange={e => set({ remarks: e.target.value })} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 2: Lines ────────────────────────────────────────────────────── */}
      <SectionCard
        title="2 · Lines on this call"
        sub="Each line with its own voyage — what bookings and EDI match on. A line voyage calls a port once."
        accent="var(--gecko-info-500)"
        action={
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setLines(ls => [...ls, { ...BLANK_LINE }])}>
            <Icon name="plus" size={14} /> Add line
          </button>
        }
      >
        {fieldError('lines') && <RowErrors messages={[fieldError('lines')!]} />}
        {lines.map((row, i) => (
          <LineEditor
            key={i}
            row={row}
            index={i}
            canRemove={lines.length > 1}
            errors={row.lineCode.trim() === '' ? [] : rowErrors(`lines[${sentLineIndex(i)}]`)}
            onChange={patch => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))}
            onRemove={() => setLines(ls => ls.filter((_, j) => j !== i))}
          />
        ))}
      </SectionCard>

      {/* ── 3: Cut-offs ─────────────────────────────────────────────────── */}
      <SectionCard
        title="3 · Cut-offs"
        sub="Yard ≤ port ≤ ETD. A line-specific cut-off overrides the whole-call one for that line."
        accent="var(--gecko-warning-500)"
        action={
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setCutoffs(cs => [...cs, { ...BLANK_CUTOFF }])}>
            <Icon name="plus" size={14} /> Add cut-off
          </button>
        }
      >
        <div className="gecko-row gecko-mb-3" style={{ gap: 8, padding: '10px 14px', background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 12, color: 'var(--gecko-info-700)' }}>
          <Icon name="info" size={14} />
          <span>If there is no whole-call <b>YARD_x</b> for a <b>PORT_x</b>, the server derives it as PORT_x − 24 h and marks it DERIVED. Branch-specific yard cut-offs are set on the call afterwards. Rows with no time are not sent.</span>
        </div>
        {cutoffs.length === 0 && <div className="gecko-cell-meta">No cut-offs — the call can still be saved and cut-offs added later.</div>}
        {cutoffs.map((row, i) => (
          <CutoffEditor
            key={i}
            row={row}
            index={i}
            lineCodes={enteredLines}
            errors={row.at === '' ? [] : rowErrors(`cutoffs[${sentCutoffIndex(i)}]`)}
            onChange={patch => setCutoffs(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))}
            onRemove={() => setCutoffs(cs => cs.filter((_, j) => j !== i))}
          />
        ))}
      </SectionCard>

      {/* ── Bottom action bar (sticky) ──────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--gecko-bg-surface)', borderTop: '1px solid var(--gecko-border)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.07)', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
          <Icon name="chevronLeft" size={15} /> Back to Schedule
        </Link>
        <div className="gecko-row">
          {!canSave && !saving && (
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginRight: 8 }}>
              Vessel, port, ETA, ETD and at least one line are required
            </span>
          )}
          <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</Link>
          <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={save} disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>
            <Icon name="save" size={15} /> {saving ? 'Saving…' : 'Create Call'}
          </button>
        </div>
      </div>
    </div>
  );
}
