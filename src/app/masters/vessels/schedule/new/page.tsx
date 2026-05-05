"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';

// ── Types ─────────────────────────────────────────────────────────────────────
type Direction   = 'Outbound' | 'Inbound' | 'Both';
type BookingType = 'IMPORT' | 'EXPORT' | 'TRANSSHIPMENT';
type VoyageStatus = 'Open' | 'Accepting' | 'Closed' | 'On Hold' | 'Cancelled';

interface CutoffRow {
  cy:   string;
  port: string;
  cfs:  string;
}

interface FormState {
  // Identity
  vesselCode:      string;
  vesselName:      string;
  voyageNo:        string;
  voyageNoInt:     string;
  shippingLine:    string;
  bookingType:     BookingType;
  tradeService:    string;
  agentCode:       string;
  wharf:           string;
  direction:       Direction;
  // Timing
  pol:             string;
  pod:             string;
  eta:             string;
  etb:             string;
  commenceLoad:    string;
  etd:             string;
  // Capacity
  teuCapacity:     string;
  teuAllotment:    string;
  reeferSlots:     string;
  oogSlots:        string;
  hazmatSlots:     string;
  // Cut-offs (cargo matrix)
  cutoffDry:       CutoffRow;
  cutoffReefer:    CutoffRow;
  cutoffHazmat:    CutoffRow;
  cutoffOog:       CutoffRow;
  emptyReturn:     string;
  ladenRelease:    string;
  // Documentation
  vgmCutoff:       string;
  siCutoff:        string;
  blCutoff:        string;
  paperlessCode:   string;
  remarks:         string;
  // Status
  status:          VoyageStatus;
}

const BLANK_CUTOFF: CutoffRow = { cy: '', port: '', cfs: '' };

const INITIAL: FormState = {
  vesselCode: '', vesselName: '', voyageNo: '', voyageNoInt: '',
  shippingLine: '', bookingType: 'IMPORT', tradeService: '', agentCode: '',
  wharf: '', direction: 'Inbound',
  pol: '', pod: '', eta: '', etb: '', commenceLoad: '', etd: '',
  teuCapacity: '', teuAllotment: '', reeferSlots: '', oogSlots: '', hazmatSlots: '',
  cutoffDry:    { ...BLANK_CUTOFF },
  cutoffReefer: { ...BLANK_CUTOFF },
  cutoffHazmat: { ...BLANK_CUTOFF },
  cutoffOog:    { ...BLANK_CUTOFF },
  emptyReturn: '', ladenRelease: '',
  vgmCutoff: '', siCutoff: '', blCutoff: '', paperlessCode: '', remarks: '',
  status: 'Open',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function RadioPill<T extends string>({
  options, value, onChange,
}: {
  options: { label: string; value: T; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        const activeColor = opt.color ?? 'var(--gecko-primary-600)';
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={{
            padding: '7px 16px', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
            border: 'none', borderLeft: i > 0 ? '1px solid var(--gecko-border)' : 'none',
            background: active ? activeColor : 'var(--gecko-bg-surface)',
            color: active ? '#fff' : 'var(--gecko-text-secondary)',
            transition: 'background 120ms, color 120ms',
          }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({ title, sub, accent, children }: {
  title: string; sub?: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
      borderRadius: 14, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden',
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ padding: '22px 24px' }}>{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children, span }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; span?: number;
}) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ── Cutoff matrix ─────────────────────────────────────────────────────────────
interface CutoffRowDef {
  key:    keyof Pick<FormState, 'cutoffDry' | 'cutoffReefer' | 'cutoffHazmat' | 'cutoffOog'>;
  label:  string;
  color:  string;
  bg:     string;
  hasCfs: boolean;
}

const CUTOFF_ROWS: CutoffRowDef[] = [
  { key: 'cutoffDry',    label: 'Dry / General',    color: 'var(--gecko-primary-700)', bg: 'var(--gecko-primary-50)',  hasCfs: true  },
  { key: 'cutoffReefer', label: 'Reefer',            color: 'var(--gecko-info-700)',    bg: 'var(--gecko-info-50)',     hasCfs: true  },
  { key: 'cutoffHazmat', label: 'Hazmat / DG',       color: 'var(--gecko-error-700)',   bg: 'var(--gecko-error-50)',    hasCfs: false },
  { key: 'cutoffOog',    label: 'OOG / Break Bulk',  color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)', hasCfs: false },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NewVoyagePage() {
  const [form, setFormRaw] = useState<FormState>(INITIAL);
  const [saved, setSaved]   = useState(false);

  const set = (partial: Partial<FormState>) => setFormRaw(prev => ({ ...prev, ...partial }));

  function setCutoff(
    key: 'cutoffDry' | 'cutoffReefer' | 'cutoffHazmat' | 'cutoffOog',
    col: keyof CutoffRow,
    val: string,
  ) {
    setFormRaw(prev => ({ ...prev, [key]: { ...prev[key], [col]: val } }));
  }

  const canSave = form.vesselCode.trim() !== '' && form.voyageNo.trim() !== '' && form.shippingLine !== '';

  function handleCreate() {
    setSaved(true);
    setTimeout(() => setSaved(false), 6000);
  }

  const statusOptions: { label: string; value: VoyageStatus; color: string }[] = [
    { label: 'Open',        value: 'Open',        color: 'var(--gecko-success-600)'  },
    { label: 'Accepting',   value: 'Accepting',   color: 'var(--gecko-primary-600)'  },
    { label: 'Closed',      value: 'Closed',      color: 'var(--gecko-gray-600)'     },
    { label: 'On Hold',     value: 'On Hold',     color: 'var(--gecko-warning-600)'  },
    { label: 'Cancelled',   value: 'Cancelled',   color: 'var(--gecko-error-600)'    },
  ];

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 100 }}>

      {/* Success toast */}
      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'var(--gecko-success-50)', border: '1px solid var(--gecko-success-200)', borderRadius: 10 }}>
          <Icon name="check" size={16} style={{ color: 'var(--gecko-success-600)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-success-700)' }}>Voyage created successfully.</span>
          <button type="button" onClick={() => setSaved(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-success-600)', padding: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Breadcrumb + Title */}
      <nav className="gecko-breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Masters</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/vessels/schedule" className="gecko-breadcrumb-item">Vessel Call Schedule</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New Voyage Call</span>
      </nav>

      <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--gecko-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New Voyage Call</h1>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 6 }}>
              Schedule a vessel port call, set cut-off dates, and open the voyage for container bookings.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', padding: '4px 10px', borderRadius: 20 }}>
              Navis N4 Standard
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-success-700)', background: 'var(--gecko-success-50)', border: '1px solid var(--gecko-success-200)', padding: '4px 10px', borderRadius: 20 }}>
              VGM / SOLAS
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Vessel Identity ─────────────────────────────────────── */}
      <SectionCard title="1 · Vessel Identity" sub="Carrier identity, internal references, agent, and booking type" accent="var(--gecko-primary-500)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 18 }}>
            <Field label="Vessel Code" required>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase', flex: 1 }}
                  placeholder="e.g. 9776418" value={form.vesselCode}
                  onChange={e => set({ vesselCode: e.target.value.toUpperCase() })} />
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ padding: '0 10px' }} title="Lookup IMO">
                  <Icon name="search" size={14} />
                </button>
              </div>
            </Field>

            <Field label="Voyage No (Carrier)" required hint="As shown on B/L and EDI">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' }}
                placeholder="e.g. 512E" value={form.voyageNo}
                onChange={e => set({ voyageNo: e.target.value.toUpperCase() })} />
            </Field>

            <Field label="Voyage No (Internal)" hint="Our own reference number">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' }}
                placeholder="e.g. LCB-2026-0142" value={form.voyageNoInt}
                onChange={e => set({ voyageNoInt: e.target.value.toUpperCase() })} />
            </Field>

            <Field label="Shipping Line" required>
              <select className="gecko-input" value={form.shippingLine} onChange={e => set({ shippingLine: e.target.value })}>
                <option value="">— select —</option>
                {['MSC (MSCU)','OOCL (OOLU)','Maersk (MAEU)','CMA CGM (CMDU)','Evergreen (EGLV)',
                  'Hapag-Lloyd (HLCU)','ONE (ONEY)','Yang Ming (YNLU)','ZIM (ZIMU)','PIL (PCIU)'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 18 }}>
            <Field label="Booking Type">
              <select className="gecko-input" value={form.bookingType} onChange={e => set({ bookingType: e.target.value as BookingType })}>
                <option value="IMPORT">IMPORT</option>
                <option value="EXPORT">EXPORT</option>
                <option value="TRANSSHIPMENT">TRANSSHIPMENT</option>
              </select>
            </Field>

            <Field label="Trade Service / String" hint="e.g. AEX, FAL, TPNW">
              <input className="gecko-input" style={{ textTransform: 'uppercase' }}
                placeholder="e.g. AEX" value={form.tradeService}
                onChange={e => set({ tradeService: e.target.value.toUpperCase() })} />
            </Field>

            <Field label="Agent Code">
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', flex: 1 }}
                  placeholder="e.g. SEALC-TH" value={form.agentCode}
                  onChange={e => set({ agentCode: e.target.value })} />
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ padding: '0 10px' }} title="Lookup agent">
                  <Icon name="search" size={14} />
                </button>
              </div>
            </Field>

            <Field label="Wharf">
              <select className="gecko-input" value={form.wharf} onChange={e => set({ wharf: e.target.value })}>
                <option value="NONE">NONE</option>
                <option value="Wharf 1">Wharf 1</option>
                <option value="Wharf 2">Wharf 2</option>
                <option value="Wharf 3">Wharf 3</option>
                <option value="Wharf 4">Wharf 4</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'end' }}>
            <Field label="Vessel Name" required hint="Auto-filled from IMO registry when Vessel Code is looked up">
              <input className="gecko-input" style={{ textTransform: 'uppercase' }}
                placeholder="e.g. OOCL SEOUL" value={form.vesselName}
                onChange={e => set({ vesselName: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Direction">
              <RadioPill<Direction>
                options={[
                  { label: '↓ Inbound',  value: 'Inbound'  },
                  { label: '↑ Outbound', value: 'Outbound' },
                  { label: '↕ Both',     value: 'Both'     },
                ]}
                value={form.direction}
                onChange={v => set({ direction: v })}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── SECTION 2: Port Call Timing ────────────────────────────────────── */}
      <SectionCard title="2 · Port Call Timing" sub="ETA → ETB → Commence Load → ETD  (Navis N4 four-timestamp standard)" accent="var(--gecko-info-500)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
            <Field label="Port of Loading (POL)" hint="UN/LOCODE">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' }}
                placeholder="e.g. THLCB" value={form.pol}
                onChange={e => set({ pol: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Port of Discharge (POD)" hint="UN/LOCODE">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' }}
                placeholder="e.g. CNSHA" value={form.pod}
                onChange={e => set({ pod: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Berth">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)' }}
                placeholder="e.g. B-3" value={''} onChange={() => {}} />
            </Field>
          </div>

          {/* 4-timestamp row with color-coded labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {[
              { label: 'ETA', hint: 'Arrival at anchorage / port limits', color: 'var(--gecko-info-600)', key: 'eta' as const },
              { label: 'ETB', hint: 'Estimated Time of Berthing', color: 'var(--gecko-primary-600)', key: 'etb' as const },
              { label: 'Commence Load', hint: 'First crane / operations start', color: 'var(--gecko-success-600)', key: 'commenceLoad' as const },
              { label: 'ETD', hint: 'Vessel departs berth', color: 'var(--gecko-accent-600)', key: 'etd' as const },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.label}</span>
                </div>
                <DateField value={form[f.key]} onChange={v => set({ [f.key]: v } as Partial<FormState>)} withTime />
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{f.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── SECTION 3: Capacity ────────────────────────────────────────────── */}
      <SectionCard title="3 · Berth Capacity" sub="TEU, reefer, OOG, and hazmat slot allocations for this voyage" accent="var(--gecko-success-500)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
          <Field label="TEU Capacity" hint="Vessel total">
            <input className="gecko-input" type="number" min="0" placeholder="0"
              value={form.teuCapacity} onChange={e => set({ teuCapacity: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="TEU Allotment" hint="Our booking window">
            <input className="gecko-input" type="number" min="0" placeholder="0"
              value={form.teuAllotment} onChange={e => set({ teuAllotment: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Reefer Slots">
            <input className="gecko-input" type="number" min="0" placeholder="0"
              value={form.reeferSlots} onChange={e => set({ reeferSlots: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="OOG Slots">
            <input className="gecko-input" type="number" min="0" placeholder="0"
              value={form.oogSlots} onChange={e => set({ oogSlots: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
          <Field label="Hazmat / DG Slots">
            <input className="gecko-input" type="number" min="0" placeholder="0"
              value={form.hazmatSlots} onChange={e => set({ hazmatSlots: e.target.value })}
              style={{ fontFamily: 'var(--gecko-font-mono)' }} />
          </Field>
        </div>
      </SectionCard>

      {/* ── SECTION 4: Cargo Cut-offs ──────────────────────────────────────── */}
      <SectionCard title="4 · Cargo Cut-off Dates" sub="ICD CY closing → Port closing → CFS closing, split by cargo type" accent="var(--gecko-warning-500)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div />
            {[
              { label: 'CY Cut-off', hint: 'ICD / depot gate closing', color: 'var(--gecko-primary-600)' },
              { label: 'Port Closing', hint: 'Terminal gate at the main port', color: 'var(--gecko-accent-600)' },
              { label: 'CFS Cut-off', hint: 'LCL warehouse receiving cut-off', color: 'var(--gecko-success-600)' },
            ].map(col => (
              <div key={col.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</div>
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{col.hint}</div>
              </div>
            ))}
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--gecko-border)', marginBottom: 14 }} />

          {/* Cargo type rows */}
          {CUTOFF_ROWS.map((row, idx) => (
            <div key={row.key} style={{
              display: 'grid', gridTemplateColumns: '170px 1fr 1fr 1fr', gap: 12,
              padding: '12px 14px', borderRadius: 8,
              background: idx % 2 === 0 ? 'var(--gecko-bg-subtle)' : 'transparent',
              alignItems: 'center', marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: row.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.label}</span>
              </div>
              <DateField value={form[row.key].cy}   onChange={v => setCutoff(row.key, 'cy',   v)} withTime size="sm" />
              <DateField value={form[row.key].port} onChange={v => setCutoff(row.key, 'port', v)} withTime size="sm" />
              {row.hasCfs
                ? <DateField value={form[row.key].cfs} onChange={v => setCutoff(row.key, 'cfs', v)} withTime size="sm" />
                : <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>N/A</div>
              }
            </div>
          ))}

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--gecko-border)', margin: '14px 0' }} />

          {/* Additional standalone cut-offs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Empty Return Cut-off" hint="Deadline to return empty containers for this voyage">
              <DateField value={form.emptyReturn} onChange={v => set({ emptyReturn: v })} withTime />
            </Field>
            <Field label="Laden Release" hint="Earliest time laden containers may be released from depot">
              <DateField value={form.ladenRelease} onChange={v => set({ ladenRelease: v })} withTime />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── SECTION 5: Documentation Cut-offs ─────────────────────────────── */}
      <SectionCard title="5 · Documentation Cut-offs" sub="SOLAS VGM, shipping instructions, B/L, and paperless release" accent="var(--gecko-error-500)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            <Field label="VGM Cut-off" required hint="SOLAS regulation — mandatory for all laden export containers">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DateField value={form.vgmCutoff} onChange={v => set({ vgmCutoff: v })} withTime style={{ flex: 1 }} />
                <span style={{
                  fontSize: 9, fontWeight: 800, color: 'var(--gecko-error-600)',
                  background: 'var(--gecko-error-50)', border: '1px solid var(--gecko-error-200)',
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                }}>
                  SOLAS
                </span>
              </div>
            </Field>
            <Field label="SI Cut-off" hint="Shipping instructions / manifest deadline">
              <DateField value={form.siCutoff} onChange={v => set({ siCutoff: v })} withTime />
            </Field>
            <Field label="B/L Cut-off" hint="Bill of Lading issuance / surrender deadline">
              <DateField value={form.blCutoff} onChange={v => set({ blCutoff: v })} withTime />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18 }}>
            <Field label="Paperless / e-DO Code" hint="Electronic delivery order release code">
              <input className="gecko-input" style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase' }}
                placeholder="e.g. PL-2026-0189" value={form.paperlessCode}
                onChange={e => set({ paperlessCode: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Remarks">
              <input className="gecko-input" placeholder="Any special instructions, routing notes, or remarks for this voyage call..."
                value={form.remarks} onChange={e => set({ remarks: e.target.value })} />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── SECTION 6: Status ─────────────────────────────────────────────── */}
      <SectionCard title="6 · Voyage Status">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {statusOptions.map(s => {
            const active = form.status === s.value;
            return (
              <button key={s.value} type="button" onClick={() => set({ status: s.value })} style={{
                padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer', border: `1.5px solid ${active ? s.color : 'var(--gecko-border)'}`,
                background: active ? s.color : 'var(--gecko-bg-surface)',
                color: active ? '#fff' : 'var(--gecko-text-secondary)',
                transition: 'all 120ms',
              }}>
                {s.label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%',
              background: form.status === 'Open' || form.status === 'Accepting' ? 'var(--gecko-success-500)' : 'var(--gecko-gray-400)',
            }} />
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
              {form.status === 'Open' && 'Bookings will be accepted from all customers.'}
              {form.status === 'Accepting' && 'Voyage accepting containers. Gate operations active.'}
              {form.status === 'Closed' && 'Cut-offs passed. No further bookings accepted.'}
              {form.status === 'On Hold' && 'Voyage on hold — bookings suspended pending review.'}
              {form.status === 'Cancelled' && 'Voyage cancelled. All bookings will be notified.'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Bottom action bar (sticky) ────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--gecko-bg-surface)', borderTop: '1px solid var(--gecko-border)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.07)', padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
          <Icon name="chevronLeft" size={15} /> Back to Schedule
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!canSave && (
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginRight: 8 }}>
              Vessel Code, Voyage No, and Line are required
            </span>
          )}
          <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</Link>
          <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={handleCreate} disabled={!canSave}>
            <Icon name="plus" size={15} /> Create Voyage
          </button>
        </div>
      </div>

    </div>
  );
}
