"use client";
import React, { useState, useMemo } from 'react';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';

// ─── Types ────────────────────────────────────────────────────────────────────

type HoldType =
  | 'CUSTOMS'
  | 'LINE_OPERATOR'
  | 'PORT_AUTHORITY'
  | 'DAMAGE'
  | 'SURVEY_INSPECTION'
  | 'FREIGHT_CHARGES'
  | 'LEGAL'
  | 'IMMIGRATION'
  | 'QUARANTINE'
  | 'INTERNAL';

type BlockingScope =
  | 'GATE_OUT_ONLY'
  | 'LOAD_ONLY'
  | 'GATE_OUT_AND_LOAD'
  | 'ALL_MOVES'
  | 'NONE';

type ReleaseAuthority =
  | 'CUSTOMS'
  | 'LINE_OPERATOR'
  | 'PORT_OPS'
  | 'FINANCE'
  | 'MANAGEMENT'
  | 'SYSTEM';

type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

interface Hold {
  code: string;
  name: string;
  holdType: HoldType;
  blockingScope: BlockingScope;
  releaseAuthority: ReleaseAuthority;
  autoApply: boolean;
  notifyParty: boolean;
  notifyTemplate: string;
  priority: Priority;
  description: string;
  active: boolean;
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const HOLDS: Hold[] = [
  {
    code: 'CUST-HOLD',
    name: 'Customs Examination Hold',
    holdType: 'CUSTOMS',
    blockingScope: 'GATE_OUT_AND_LOAD',
    releaseAuthority: 'CUSTOMS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-CUSTOMS-EXAM',
    priority: 'CRITICAL',
    description: 'Container selected for physical customs examination. Prevents gate-out and vessel loading until customs authority issues examination order and clearance.',
    active: true,
  },
  {
    code: 'CUST-CLEAR',
    name: 'Customs Clearance Pending',
    holdType: 'CUSTOMS',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'CUSTOMS',
    autoApply: true,
    notifyParty: true,
    notifyTemplate: 'NOTIF-CUSTOMS-PENDING',
    priority: 'HIGH',
    description: 'Import clearance documents not yet endorsed by customs. Applied automatically on discharge; released when customs system confirms clearance.',
    active: true,
  },
  {
    code: 'DUTY-UNPAID',
    name: 'Duties & Taxes Unpaid',
    holdType: 'CUSTOMS',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'CUSTOMS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-DUTY-OUTSTANDING',
    priority: 'HIGH',
    description: 'Customs duty or import taxes assessed but not yet settled. Container cannot leave the terminal until full payment is confirmed by customs.',
    active: true,
  },
  {
    code: 'LINE-HOLD',
    name: 'Line Operator Hold',
    holdType: 'LINE_OPERATOR',
    blockingScope: 'GATE_OUT_AND_LOAD',
    releaseAuthority: 'LINE_OPERATOR',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-LINE-HOLD',
    priority: 'HIGH',
    description: 'General hold placed by the shipping line on a container. May cover unresolved freight, documentation disputes, or shipper instruction. Released by line EDI message.',
    active: true,
  },
  {
    code: 'LINE-DOC',
    name: 'Line Documentation Incomplete',
    holdType: 'LINE_OPERATOR',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'LINE_OPERATOR',
    autoApply: false,
    notifyParty: false,
    notifyTemplate: '',
    priority: 'NORMAL',
    description: 'Bill of lading, surrender copy, or sea waybill not yet received or endorsed by the line. Gate-out blocked until documentation is presented.',
    active: true,
  },
  {
    code: 'PORT-HOLD',
    name: 'Port Authority Hold',
    holdType: 'PORT_AUTHORITY',
    blockingScope: 'ALL_MOVES',
    releaseAuthority: 'PORT_OPS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-PORT-AUTH',
    priority: 'CRITICAL',
    description: 'Directed by the Port Authority (Harbour Master / Port Control). Overrides all other holds and blocks all container movement including vessel operations.',
    active: true,
  },
  {
    code: 'FREIGHT',
    name: 'Freight Charges Outstanding',
    holdType: 'FREIGHT_CHARGES',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'FINANCE',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-FREIGHT-OUTSTANDING',
    priority: 'HIGH',
    description: 'Terminal freight, handling, or storage charges unpaid. Gate-out withheld until Finance confirms full settlement of outstanding invoice.',
    active: true,
  },
  {
    code: 'DAMAGE',
    name: 'Damaged — Survey Required',
    holdType: 'DAMAGE',
    blockingScope: 'GATE_OUT_AND_LOAD',
    releaseAuthority: 'PORT_OPS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-DAMAGE-SURVEY',
    priority: 'HIGH',
    description: 'Container with recorded damage awaiting surveyor assessment or M&R estimate. Prevents gate-out and loading pending survey completion and LOI from line.',
    active: true,
  },
  {
    code: 'SURVEY',
    name: 'Survey / Inspection Pending',
    holdType: 'SURVEY_INSPECTION',
    blockingScope: 'LOAD_ONLY',
    releaseAuthority: 'PORT_OPS',
    autoApply: false,
    notifyParty: false,
    notifyTemplate: '',
    priority: 'NORMAL',
    description: 'Pre-shipment inspection, surveyor attendance, or third-party verification pending. Load restricted until inspection report is filed.',
    active: true,
  },
  {
    code: 'LEGAL',
    name: 'Legal / Court Order Hold',
    holdType: 'LEGAL',
    blockingScope: 'ALL_MOVES',
    releaseAuthority: 'MANAGEMENT',
    autoApply: false,
    notifyParty: false,
    notifyTemplate: '',
    priority: 'CRITICAL',
    description: 'Court injunction, arrest order, or legal detainer served on the cargo. All movement suspended pending written release order from Management or legal counsel.',
    active: true,
  },
  {
    code: 'IMMIG',
    name: 'Immigration Hold',
    holdType: 'IMMIGRATION',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'CUSTOMS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-IMMIG',
    priority: 'CRITICAL',
    description: 'Immigration authority hold on passenger baggage or personal effects. Requires written clearance from the Immigration Bureau before gate-out.',
    active: true,
  },
  {
    code: 'QUAR',
    name: 'Quarantine Hold',
    holdType: 'QUARANTINE',
    blockingScope: 'ALL_MOVES',
    releaseAuthority: 'PORT_OPS',
    autoApply: false,
    notifyParty: true,
    notifyTemplate: 'NOTIF-QUARANTINE',
    priority: 'CRITICAL',
    description: 'Phytosanitary, veterinary, or bio-security quarantine order issued. No movement permitted until competent authority issues fumigation or clearance certificate.',
    active: true,
  },
  {
    code: 'OOG-PLAN',
    name: 'OOG Stowage Plan Pending',
    holdType: 'INTERNAL',
    blockingScope: 'LOAD_ONLY',
    releaseAuthority: 'PORT_OPS',
    autoApply: true,
    notifyParty: false,
    notifyTemplate: '',
    priority: 'NORMAL',
    description: 'Out-of-gauge cargo requires an approved stowage plan before vessel load. Load blocked until planner confirms the slot and lashing arrangement.',
    active: true,
  },
  {
    code: 'DG-DOC',
    name: 'DG Documentation Incomplete',
    holdType: 'INTERNAL',
    blockingScope: 'GATE_OUT_AND_LOAD',
    releaseAuthority: 'PORT_OPS',
    autoApply: true,
    notifyParty: true,
    notifyTemplate: 'NOTIF-DG-DOC',
    priority: 'HIGH',
    description: 'Dangerous goods declaration, MSDS, or IMO packing certificate not yet received or accepted. Both gate-out and load blocked pending full DG document compliance.',
    active: true,
  },
  {
    code: 'FREE-TIME',
    name: 'Free Time Expired — Charges Due',
    holdType: 'FREIGHT_CHARGES',
    blockingScope: 'GATE_OUT_ONLY',
    releaseAuthority: 'FINANCE',
    autoApply: true,
    notifyParty: true,
    notifyTemplate: 'NOTIF-FREE-TIME-EXP',
    priority: 'NORMAL',
    description: 'Container has exceeded the free storage period. Demurrage or detention accruing. Gate-out blocked until Finance confirms settlement of all accrued charges.',
    active: true,
  },
];

// ─── Style Maps ──────────────────────────────────────────────────────────────

const HOLD_TYPE_STYLE: Record<HoldType, { bg: string; color: string; label: string }> = {
  CUSTOMS:           { bg: 'var(--gecko-danger-100)',   color: 'var(--gecko-danger-700)',   label: 'Customs'         },
  LINE_OPERATOR:     { bg: 'var(--gecko-primary-100)',  color: 'var(--gecko-primary-700)',  label: 'Line Operator'   },
  PORT_AUTHORITY:    { bg: '#e8edf7',                   color: '#1a3466',                   label: 'Port Authority'  },
  DAMAGE:            { bg: 'var(--gecko-warning-100)',  color: 'var(--gecko-warning-700)',  label: 'Damage'          },
  SURVEY_INSPECTION: { bg: '#fef9c3',                   color: '#854d0e',                   label: 'Survey / Insp.'  },
  FREIGHT_CHARGES:   { bg: 'var(--gecko-success-100)',  color: 'var(--gecko-success-700)',  label: 'Freight Charges' },
  LEGAL:             { bg: '#f3e8ff',                   color: '#6b21a8',                   label: 'Legal'           },
  IMMIGRATION:       { bg: '#ccfbf1',                   color: '#0f766e',                   label: 'Immigration'     },
  QUARANTINE:        { bg: '#fee2e2',                   color: '#9f1239',                   label: 'Quarantine'      },
  INTERNAL:          { bg: 'var(--gecko-gray-100)',     color: 'var(--gecko-gray-600)',     label: 'Internal'        },
};

const SCOPE_STYLE: Record<BlockingScope, { bg: string; color: string; label: string }> = {
  ALL_MOVES:          { bg: 'var(--gecko-danger-100)',  color: 'var(--gecko-danger-700)',  label: 'All Moves'           },
  GATE_OUT_AND_LOAD:  { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', label: 'Gate-Out & Load'     },
  GATE_OUT_ONLY:      { bg: '#fef9c3',                  color: '#854d0e',                  label: 'Gate-Out Only'       },
  LOAD_ONLY:          { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)',    label: 'Load Only'           },
  NONE:               { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-500)',    label: 'None'                },
};

const PRIORITY_STYLE: Record<Priority, { bg: string; color: string }> = {
  CRITICAL: { bg: 'var(--gecko-danger-100)',  color: 'var(--gecko-danger-700)'  },
  HIGH:     { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' },
  NORMAL:   { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)'    },
  LOW:      { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-500)'    },
};

const RELEASE_AUTH_LABEL: Record<ReleaseAuthority, string> = {
  CUSTOMS:       'Customs',
  LINE_OPERATOR: 'Line Operator',
  PORT_OPS:      'Port Ops',
  FINANCE:       'Finance',
  MANAGEMENT:    'Management',
  SYSTEM:        'System',
};

// ─── Badge Components ─────────────────────────────────────────────────────────

function HoldTypeBadge({ type }: { type: HoldType }) {
  const s = HOLD_TYPE_STYLE[type];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: BlockingScope }) {
  const s = SCOPE_STYLE[scope];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      <Icon name="lock" size={10} />
      {s.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: s.bg, color: s.color, letterSpacing: '0.03em' }}>
      {priority === 'CRITICAL' && <Icon name="zap" size={10} />}
      {priority}
    </span>
  );
}

function ReleaseAuthBadge({ auth }: { auth: ReleaseAuthority }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)', whiteSpace: 'nowrap' }}>
      <Icon name="user" size={10} />
      {RELEASE_AUTH_LABEL[auth]}
    </span>
  );
}

// ─── Modal Form State ─────────────────────────────────────────────────────────

const EMPTY_HOLD: Hold = {
  code: '',
  name: '',
  holdType: 'CUSTOMS',
  blockingScope: 'GATE_OUT_ONLY',
  releaseAuthority: 'CUSTOMS',
  autoApply: false,
  notifyParty: false,
  notifyTemplate: '',
  priority: 'NORMAL',
  description: '',
  active: true,
};

// ─── Hold Modal ───────────────────────────────────────────────────────────────

interface HoldModalProps {
  hold: Hold;
  isNew: boolean;
  onClose: () => void;
}

function HoldModal({ hold, isNew, onClose }: HoldModalProps) {
  const [form, setForm] = useState<Hold>({ ...hold });
  const set = (partial: Partial<Hold>) => setForm(prev => ({ ...prev, ...partial }));

  const canSave = form.code.trim() !== '' && form.name.trim() !== '';

  const sectionHead = (title: string) => (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const,
      letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
      marginBottom: 14, paddingBottom: 7,
      borderBottom: '2px solid rgba(var(--gecko-primary-rgb, 37,99,235), 0.12)',
    }}>
      {title}
    </div>
  );

  const Field = ({
    label, required, hint, children, span,
  }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; span?: number }) => (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{hint}</div>}
    </div>
  );

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-danger-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="lock" size={16} style={{ color: 'var(--gecko-danger-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                {isNew ? 'New Hold' : `Edit Hold — ${hold.code}`}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              {isNew
                ? 'Define a named hold to block container operations pending resolution.'
                : `Modifying hold definition. Changes apply immediately to newly applied instances.`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: Identity */}
          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
              <Field label="Hold Code" required hint="Uppercase, hyphenated. e.g. CUST-HOLD">
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. CUST-HOLD"
                  value={form.code}
                  onChange={e => set({ code: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
              <Field label="Hold Name" required>
                <input
                  className="gecko-input"
                  placeholder="e.g. Customs Examination Hold"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Classification */}
          <div>
            {sectionHead('Classification')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Hold Type" required>
                <select className="gecko-input" value={form.holdType} onChange={e => set({ holdType: e.target.value as HoldType })}>
                  <option value="CUSTOMS">Customs</option>
                  <option value="LINE_OPERATOR">Line Operator</option>
                  <option value="PORT_AUTHORITY">Port Authority</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="SURVEY_INSPECTION">Survey / Inspection</option>
                  <option value="FREIGHT_CHARGES">Freight Charges</option>
                  <option value="LEGAL">Legal</option>
                  <option value="IMMIGRATION">Immigration</option>
                  <option value="QUARANTINE">Quarantine</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </Field>
              <Field label="Priority">
                <select className="gecko-input" value={form.priority} onChange={e => set({ priority: e.target.value as Priority })}>
                  <option value="CRITICAL">Critical — highest urgency</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Section 3: Blocking & Release */}
          <div>
            {sectionHead('Blocking & Release')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Blocking Scope" required hint="Which operations this hold prevents">
                <select className="gecko-input" value={form.blockingScope} onChange={e => set({ blockingScope: e.target.value as BlockingScope })}>
                  <option value="ALL_MOVES">All Moves — no movement at all</option>
                  <option value="GATE_OUT_AND_LOAD">Gate-Out & Load — both blocked</option>
                  <option value="GATE_OUT_ONLY">Gate-Out Only</option>
                  <option value="LOAD_ONLY">Load Only — vessel load blocked</option>
                  <option value="NONE">None — advisory only</option>
                </select>
              </Field>
              <Field label="Release Authority" required hint="Who can lift this hold">
                <select className="gecko-input" value={form.releaseAuthority} onChange={e => set({ releaseAuthority: e.target.value as ReleaseAuthority })}>
                  <option value="CUSTOMS">Customs</option>
                  <option value="LINE_OPERATOR">Line Operator</option>
                  <option value="PORT_OPS">Port Operations</option>
                  <option value="FINANCE">Finance</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="SYSTEM">System (automated)</option>
                </select>
              </Field>
            </div>

            {/* Preview badges */}
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--gecko-bg-subtle)', borderRadius: 8, border: '1px solid var(--gecko-border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Preview:</span>
              <ScopeBadge scope={form.blockingScope} />
              <ReleaseAuthBadge auth={form.releaseAuthority} />
              <PriorityBadge priority={form.priority} />
            </div>
          </div>

          {/* Section 4: Notifications */}
          <div>
            {sectionHead('Notifications & Automation')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Auto Apply toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: '1px solid var(--gecko-border)', borderRadius: 8, background: form.autoApply ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)' }}>
                <button
                  onClick={() => set({ autoApply: !form.autoApply })}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                    background: form.autoApply ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-300)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  role="switch"
                  aria-checked={form.autoApply}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: form.autoApply ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Auto Apply</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>System applies this hold automatically based on configured rules</div>
                </div>
              </div>

              {/* Notify Party toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: '1px solid var(--gecko-border)', borderRadius: 8, background: form.notifyParty ? 'var(--gecko-success-50)' : 'var(--gecko-bg-surface)' }}>
                <button
                  onClick={() => set({ notifyParty: !form.notifyParty })}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                    background: form.notifyParty ? 'var(--gecko-success-600)' : 'var(--gecko-gray-300)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  role="switch"
                  aria-checked={form.notifyParty}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: form.notifyParty ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Notify Party</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Generate notification to the responsible party when hold is applied or released</div>
                </div>
              </div>
            </div>

            {form.notifyParty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="gecko-label">Notify Template</label>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. NOTIF-CUSTOMS-EXAM"
                  value={form.notifyTemplate}
                  onChange={e => set({ notifyTemplate: e.target.value.toUpperCase() })}
                  style={{ maxWidth: 320, textTransform: 'uppercase' }}
                />
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Notification template code used when hold is applied / released</div>
              </div>
            )}
          </div>

          {/* Section 5: Description & Active */}
          <div>
            {sectionHead('Description & Status')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="gecko-label">Description / SOP Note</label>
                <textarea
                  className="gecko-input"
                  placeholder="Full description, standard operating procedure, or resolution steps…"
                  value={form.description}
                  onChange={e => set({ description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: `1px solid ${form.active ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`, borderRadius: 8, background: form.active ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)', maxWidth: 340 }}>
                <button
                  onClick={() => set({ active: !form.active })}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                    background: form.active ? 'var(--gecko-success-600)' : 'var(--gecko-gray-300)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  role="switch"
                  aria-checked={form.active}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: form.active ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: form.active ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)' }}>
                    {form.active ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                    {form.active ? 'Hold is live and can be applied to containers' : 'Hold is disabled and will not appear in apply lists'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {isNew && (
            <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
              * Hold Code and Hold Name are required
            </div>
          )}
          <div style={{ marginLeft: isNew ? undefined : 'auto', display: 'flex', gap: 8 }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={onClose}
              disabled={!canSave}
              style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
            >
              <Icon name="save" size={14} /> {isNew ? 'Save Hold' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter / Sort Config ─────────────────────────────────────────────────────

const HOLDS_SORT_OPTIONS: SortOption[] = [
  { label: 'Priority (critical first)', value: 'priority'  },
  { label: 'Code A → Z',                value: 'code'      },
  { label: 'Hold Type',                 value: 'type'      },
];

const HOLDS_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search code or name…' },
  {
    type: 'select', key: 'holdType', label: 'Hold Type',
    options: [
      { label: 'All',               value: ''                  },
      { label: 'Customs',           value: 'CUSTOMS'           },
      { label: 'Line Operator',     value: 'LINE_OPERATOR'     },
      { label: 'Port Authority',    value: 'PORT_AUTHORITY'    },
      { label: 'Damage',            value: 'DAMAGE'            },
      { label: 'Survey/Inspection', value: 'SURVEY_INSPECTION' },
      { label: 'Freight Charges',   value: 'FREIGHT_CHARGES'   },
      { label: 'Legal',             value: 'LEGAL'             },
      { label: 'Immigration',       value: 'IMMIGRATION'       },
      { label: 'Quarantine',        value: 'QUARANTINE'        },
      { label: 'Internal',          value: 'INTERNAL'          },
    ],
  },
  {
    type: 'select', key: 'blockingScope', label: 'Blocking Scope',
    options: [
      { label: 'All',               value: ''                 },
      { label: 'All Moves',         value: 'ALL_MOVES'        },
      { label: 'Gate-Out & Load',   value: 'GATE_OUT_AND_LOAD'},
      { label: 'Gate-Out Only',     value: 'GATE_OUT_ONLY'    },
      { label: 'Load Only',         value: 'LOAD_ONLY'        },
      { label: 'None',              value: 'NONE'             },
    ],
  },
  {
    type: 'select', key: 'releaseAuthority', label: 'Release Authority',
    options: [
      { label: 'All',          value: ''             },
      { label: 'Customs',      value: 'CUSTOMS'      },
      { label: 'Line Operator',value: 'LINE_OPERATOR'},
      { label: 'Port Ops',     value: 'PORT_OPS'     },
      { label: 'Finance',      value: 'FINANCE'      },
      { label: 'Management',   value: 'MANAGEMENT'   },
      { label: 'System',       value: 'SYSTEM'       },
    ],
  },
  {
    type: 'select', key: 'priority', label: 'Priority',
    options: [
      { label: 'All',      value: ''         },
      { label: 'Critical', value: 'CRITICAL' },
      { label: 'High',     value: 'HIGH'     },
      { label: 'Normal',   value: 'NORMAL'   },
      { label: 'Low',      value: 'LOW'      },
    ],
  },
  {
    type: 'select', key: 'active', label: 'Status',
    options: [
      { label: 'All',      value: ''      },
      { label: 'Active',   value: 'true'  },
      { label: 'Inactive', value: 'false' },
    ],
  },
];

// ─── Priority sort weight ──────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HoldsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', holdType: '', blockingScope: '', releaseAuthority: '', priority: '', active: 'true',
  });
  const [sortBy, setSortBy]       = useState('priority');
  const [modalHold, setModalHold] = useState<Hold | null>(null);
  const [isNew,     setIsNew]     = useState(false);

  const filtered = useMemo(() => {
    let result = HOLDS.filter(h => {
      if (filters.holdType        && h.holdType        !== filters.holdType)        return false;
      if (filters.blockingScope   && h.blockingScope   !== filters.blockingScope)   return false;
      if (filters.releaseAuthority && h.releaseAuthority !== filters.releaseAuthority) return false;
      if (filters.priority        && h.priority        !== filters.priority)        return false;
      if (filters.active          && String(h.active)  !== filters.active)          return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!h.code.toLowerCase().includes(q) && !h.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'priority') result = [...result].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);
    if (sortBy === 'code')     result = [...result].sort((a, b) => a.code.localeCompare(b.code));
    if (sortBy === 'type')     result = [...result].sort((a, b) => a.holdType.localeCompare(b.holdType));

    return result;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  // Stats
  const totalActive  = HOLDS.filter(h => h.active).length;
  const customsCount = HOLDS.filter(h => h.holdType === 'CUSTOMS').length;
  const lineCount    = HOLDS.filter(h => h.holdType === 'LINE_OPERATOR').length;
  const portCount    = HOLDS.filter(h => h.holdType === 'PORT_AUTHORITY').length;
  const criticalCount = HOLDS.filter(h => h.priority === 'CRITICAL').length;

  const openNew = () => {
    setIsNew(true);
    setModalHold({ ...EMPTY_HOLD });
  };

  const openEdit = (h: Hold) => {
    setIsNew(false);
    setModalHold({ ...h });
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Holds &amp; Remarks</h1>
            <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Named hold catalog. Applied to containers to block gate-out, load, or all movement pending resolution.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <FilterPopover
            fields={HOLDS_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={v => setFilters(v)}
            onClear={() => setFilters({ query: '', holdType: '', blockingScope: '', releaseAuthority: '', priority: '', active: '' })}
            sortOptions={HOLDS_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}>
            <Icon name="plus" size={16} /> New Hold
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Holds',    value: HOLDS.length,   color: 'var(--gecko-text-primary)'  },
          { label: 'Active',         value: totalActive,    color: 'var(--gecko-success-700)'    },
          { label: 'Critical',       value: criticalCount,  color: 'var(--gecko-danger-700)'     },
          { label: 'Customs',        value: customsCount,   color: 'var(--gecko-danger-600)'     },
          { label: 'Line Operator',  value: lineCount,      color: 'var(--gecko-primary-600)'    },
          { label: 'Port Authority', value: portCount,      color: '#1a3466'                     },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, boxShadow: 'var(--gecko-shadow-sm)', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5, tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Hold Code</th>
              <th>Hold Name</th>
              <th style={{ width: 120 }}>Type</th>
              <th style={{ width: 145 }}>Blocking Scope</th>
              <th style={{ width: 120 }}>Release Auth.</th>
              <th style={{ width: 90 }}>Priority</th>
              <th style={{ width: 56, textAlign: 'center' }}>Auto</th>
              <th style={{ width: 56, textAlign: 'center' }}>Notify</th>
              <th style={{ width: 76 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gecko-text-secondary)' }}>
                  <Icon name="filter" size={28} style={{ color: 'var(--gecko-text-disabled)', display: 'block', margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No holds match the current filters</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Adjust the filters above to see results</div>
                </td>
              </tr>
            )}
            {pageItems.map(h => (
              <tr key={h.code} style={{ opacity: h.active ? 1 : 0.55 }}>

                {/* Hold Code — mono pill */}
                <td>
                  <span
                    style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--gecko-primary-600)', background: 'var(--gecko-primary-50)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}
                    onClick={() => openEdit(h)}
                  >
                    {h.code}
                  </span>
                </td>

                {/* Hold Name */}
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)', fontSize: 13 }}>{h.name}</div>
                  {h.description && (
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={h.description}>
                      {h.description}
                    </div>
                  )}
                </td>

                {/* Type badge */}
                <td><HoldTypeBadge type={h.holdType} /></td>

                {/* Blocking Scope badge */}
                <td><ScopeBadge scope={h.blockingScope} /></td>

                {/* Release Authority */}
                <td><ReleaseAuthBadge auth={h.releaseAuthority} /></td>

                {/* Priority */}
                <td><PriorityBadge priority={h.priority} /></td>

                {/* Auto Apply icon */}
                <td style={{ textAlign: 'center' }}>
                  {h.autoApply ? (
                    <span title="Auto-applied by system" style={{ color: 'var(--gecko-primary-600)', display: 'inline-flex', alignItems: 'center' }}>
                      <Icon name="zap" size={14} />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 16, lineHeight: 1 }}>—</span>
                  )}
                </td>

                {/* Notify icon */}
                <td style={{ textAlign: 'center' }}>
                  {h.notifyParty ? (
                    <span title={`Notify: ${h.notifyTemplate || 'default template'}`} style={{ color: 'var(--gecko-success-600)', display: 'inline-flex', alignItems: 'center' }}>
                      <Icon name="bell" size={14} />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 16, lineHeight: 1 }}>—</span>
                  )}
                </td>

                {/* Status */}
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${h.active ? 'active' : 'warning'}`}>
                    {h.active ? 'Active' : 'Inactive'}
                  </span>
                </td>

                {/* Row actions */}
                <td style={{ textAlign: 'right' }}>
                  <button
                    style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer', padding: '3px 5px', borderRadius: 4 }}
                    onClick={() => openEdit(h)}
                    title="Edit hold"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize} noun="holds" />
      </div>

      {/* Modal */}
      {modalHold && (
        <HoldModal
          hold={modalHold}
          isNew={isNew}
          onClose={() => { setModalHold(null); setIsNew(false); }}
        />
      )}
    </div>
  );
}
