"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ExportButton } from '@/components/ui/ExportButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type LocationType = 'Facility' | 'Yard Area' | 'Block' | 'Row' | 'Bay' | 'Slot';

interface NewLocationForm {
  locationType: LocationType;
  parentLocation: string;
  locationCode: string;
  locationName: string;
  rows: string;
  bays: string;
  tiers: string;
  description: string;
  active: boolean;
}

// ─── Parent Location Options ──────────────────────────────────────────────────

const PARENT_OPTIONS: Record<LocationType, { value: string; label: string }[]> = {
  Facility: [
    { value: '', label: '— None (top-level) —' },
  ],
  'Yard Area': [
    { value: '', label: '— Select Facility —' },
    { value: 'LCB', label: 'Laem Chabang Terminal' },
    { value: 'BKK', label: 'Bangkok ICD' },
    { value: 'LST', label: 'Laem Sadet Terminal' },
  ],
  Block: [
    { value: '', label: '— Select Yard Area —' },
    { value: 'LCB-YARD-A', label: 'Laem Chabang Terminal › Yard A — Import' },
    { value: 'LCB-YARD-B', label: 'Laem Chabang Terminal › Yard B — Export' },
    { value: 'LCB-YARD-C', label: 'Laem Chabang Terminal › Yard C — Empty' },
    { value: 'BKK-YARD-1', label: 'Bangkok ICD › Yard 1 — Import/Export' },
  ],
  Row: [
    { value: '', label: '— Select Block —' },
    { value: 'LCB-A01', label: 'Laem Chabang Terminal › Yard A — Import › Block A-01' },
    { value: 'LCB-A02', label: 'Laem Chabang Terminal › Yard A — Import › Block A-02' },
    { value: 'LCB-A03', label: 'Laem Chabang Terminal › Yard A — Import › Block A-03' },
    { value: 'LCB-B01', label: 'Laem Chabang Terminal › Yard B — Export › Block B-01' },
  ],
  Bay: [
    { value: '', label: '— Select Block —' },
    { value: 'LCB-A01', label: 'Laem Chabang Terminal › Yard A — Import › Block A-01' },
    { value: 'LCB-A02', label: 'Laem Chabang Terminal › Yard A — Import › Block A-02' },
    { value: 'LCB-B01', label: 'Laem Chabang Terminal › Yard B — Export › Block B-01' },
  ],
  Slot: [
    { value: '', label: '— Select Row / Bay —' },
    { value: 'LCB-A01-A', label: 'Laem Chabang Terminal › Yard A — Import › Block A-01 › Row A' },
    { value: 'LCB-A01-B', label: 'Laem Chabang Terminal › Yard A — Import › Block A-01 › Row B' },
    { value: 'LCB-A01-01', label: 'Laem Chabang Terminal › Yard A — Import › Block A-01 › Bay 01' },
  ],
};

const EMPTY_FORM: NewLocationForm = {
  locationType: 'Block',
  parentLocation: '',
  locationCode: '',
  locationName: '',
  rows: '',
  bays: '',
  tiers: '',
  description: '',
  active: true,
};

// ─── New Location Modal ───────────────────────────────────────────────────────

function NewLocationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<NewLocationForm>({ ...EMPTY_FORM });
  const set = (partial: Partial<NewLocationForm>) =>
    setForm(prev => ({ ...prev, ...partial }));
  const { toast } = useToast();

  const canSave =
    form.locationCode.trim() !== '' && form.locationName.trim() !== '';

  const handleSave = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: 'Location saved', message: `${form.locationCode} · ${form.locationName} added.` });
    onClose();
  };

  const showRows  = form.locationType === 'Block';
  const showBays  = form.locationType === 'Block';
  const showTiers = form.locationType === 'Block' || form.locationType === 'Slot';

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
  }: {
    label: string; required?: boolean; hint?: string;
    children: React.ReactNode; span?: number;
  }) => (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
          {hint}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)',
          background: 'var(--gecko-info-50)', borderRadius: '12px 12px 0 0',
          flexShrink: 0, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="mapPin" size={16} style={{ color: 'var(--gecko-info-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                New Location
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              Add a node to the spatial hierarchy — from facility level down to individual slots.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, border: '1px solid var(--gecko-border)',
              borderRadius: 7, background: 'var(--gecko-bg-surface)',
              color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <div style={{
          padding: '22px 24px', flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>

          {/* Section 1: Classification */}
          <div>
            {sectionHead('Classification')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Location Type" required>
                <select
                  className="gecko-input"
                  value={form.locationType}
                  onChange={e => set({ locationType: e.target.value as LocationType, parentLocation: '' })}
                >
                  <option value="Facility">Facility</option>
                  <option value="Yard Area">Yard Area</option>
                  <option value="Block">Block</option>
                  <option value="Row">Row</option>
                  <option value="Bay">Bay</option>
                  <option value="Slot">Slot</option>
                </select>
              </Field>
              <Field
                label="Parent Location"
                hint={form.locationType === 'Facility' ? 'Facilities have no parent' : undefined}
              >
                <select
                  className="gecko-input"
                  value={form.parentLocation}
                  onChange={e => set({ parentLocation: e.target.value })}
                  disabled={form.locationType === 'Facility'}
                >
                  {PARENT_OPTIONS[form.locationType].map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Section 2: Identity */}
          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Location Code" required hint='Uppercase, e.g. "BLOCK-A-05"'>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. BLOCK-A-05"
                  value={form.locationCode}
                  onChange={e => set({ locationCode: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
              <Field label="Location Name" required>
                <input
                  className="gecko-input"
                  placeholder='e.g. "Block A-05"'
                  value={form.locationName}
                  onChange={e => set({ locationName: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* Section 3: Spatial Dimensions (conditional) */}
          {(showRows || showBays || showTiers) && (
            <div>
              {sectionHead('Spatial Dimensions')}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${[showRows, showBays, showTiers].filter(Boolean).length}, 1fr)`,
                gap: 16,
              }}>
                {showRows && (
                  <Field label="Rows" hint="Number of rows in this block">
                    <input
                      className="gecko-input"
                      type="number"
                      min={1}
                      placeholder="e.g. 6"
                      value={form.rows}
                      onChange={e => set({ rows: e.target.value })}
                    />
                  </Field>
                )}
                {showBays && (
                  <Field label="Bays" hint="Number of bays per row">
                    <input
                      className="gecko-input"
                      type="number"
                      min={1}
                      placeholder="e.g. 16"
                      value={form.bays}
                      onChange={e => set({ bays: e.target.value })}
                    />
                  </Field>
                )}
                {showTiers && (
                  <Field label="Tiers (max stack)" hint="Maximum stacking height">
                    <input
                      className="gecko-input"
                      type="number"
                      min={1}
                      placeholder="e.g. 4"
                      value={form.tiers}
                      onChange={e => set({ tiers: e.target.value })}
                    />
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Notes & Status */}
          <div>
            {sectionHead('Notes & Status')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="gecko-label">Description / Notes</label>
                <textarea
                  className="gecko-input"
                  placeholder="Optional notes about this location, restrictions, or special handling…"
                  value={form.description}
                  onChange={e => set({ description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px',
                border: `1px solid ${form.active ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
                borderRadius: 8,
                background: form.active ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)',
                maxWidth: 340,
              }}>
                <button
                  onClick={() => set({ active: !form.active })}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none',
                    cursor: 'pointer', flexShrink: 0, marginTop: 2,
                    background: form.active ? 'var(--gecko-success-600)' : 'var(--gecko-gray-300)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                  role="switch"
                  aria-checked={form.active}
                  type="button"
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: form.active ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
                <div>
                  <div style={{
                    fontSize: 12.5, fontWeight: 700,
                    color: form.active ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)',
                  }}>
                    {form.active ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                    {form.active
                      ? 'Location is operational and available for container placement'
                      : 'Location is disabled and will not appear in placement lists'}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--gecko-border)',
          background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px',
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
            * Location Code and Location Name are required
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={handleSave}
              disabled={!canSave}
              style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
              type="button"
            >
              <Icon name="save" size={14} /> Save Location
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const [activeNode, setActiveNode] = useState('Block A-01');
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  // Simple grid simulation data for the yard view
  const bays = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'));
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Random tier values: 0=empty, 1=1-2high, 2=3high, 3=4high
  const getCellTier = (r: string, b: string) => {
    // Hardcode some patterns from the screenshot
    if (r === 'C' && (b === '01' || b === '02' || b === '09' || b === '10')) return 2;
    if (r === 'F' && b === '02') return 3;
    if (r === 'F' && b === '01') return 2;
    if (r === 'A' && b === '16') return 3;
    if (r === 'B' && b === '13') return 3;
    if (r === 'D' && b === '15') return 3;
    if (b === '06' || b === '07' || b === '12') return 2;

    // Some random empties
    if (parseInt(b) % 5 === 0 && r !== 'C') return 0;

    // Default to 1-2 high
    return 1;
  };

  const getCellColor = (tier: number) => {
    switch(tier) {
      case 0: return '#ffffff';
      case 1: return 'var(--gecko-primary-200)';
      case 2: return 'var(--gecko-primary-600)';
      case 3: return 'var(--gecko-warning-500)';
      default: return '#fff';
    }
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Locations</h1>
            <span className="gecko-count-badge">6 levels</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>3 facilities</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Hierarchical spatial tree — facilities down to individual container slots. 1,842 nodes across 3 facilities.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton label="Export tree" resource="Locations tree" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Yard map view', message: 'Interactive yard map coming soon.' })}><Icon name="map" size={16} /> Yard map view</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setShowModal(true)}><Icon name="plus" size={16} /> New Location</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* Left Sidebar (Tree) */}
        <div style={{ width: 280, flexShrink: 0, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gecko-text-disabled)' }} />
              <input className="gecko-input" placeholder="Search location..." style={{ paddingLeft: 36, width: '100%' }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>

            {/* Tree Nodes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-text-secondary)' }} />
                Laem Chabang Terminal
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>79%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-text-secondary)' }} />
                Yard A — Import
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>82%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 48, background: 'var(--gecko-primary-50)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--gecko-primary-700)' }}>
                <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-primary-500)' }} />
                <Icon name="grid" size={14} style={{ color: 'var(--gecko-primary-500)' }} />
                Block A-01
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-primary-600)', fontWeight: 600 }}>86%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 48, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>
                <Icon name="chevronRight" size={14} style={{ opacity: 0 }} />
                <Icon name="grid" size={14} />
                Block A-02
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>83%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 48, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>
                <Icon name="chevronRight" size={14} style={{ opacity: 0 }} />
                <Icon name="grid" size={14} />
                Block A-03
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>84%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 48, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>
                <Icon name="chevronRight" size={14} style={{ opacity: 0 }} />
                <Icon name="grid" size={14} />
                Block A-04
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>77%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--gecko-text-secondary)' }} />
                Yard B — Export
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>80%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--gecko-text-secondary)' }} />
                Yard C — Empty
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>76%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                CFS Warehouse
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>69%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>
                <Icon name="truck" size={14} />
                Gate 1 — Inbound
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>75%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: 32, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-secondary)' }}>
                <Icon name="truck" size={14} />
                Gate 2 — Outbound
              </div>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>67%</span>
            </div>

          </div>
        </div>

        {/* Right Detail Pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            LCB <Icon name="chevronRight" size={12} /> Yard A <Icon name="chevronRight" size={12} /> <span style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Block A-01</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-600)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="grid" size={32} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0' }}>Block A-01</h2>
                <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Code: A-01 · Path: LCB / A / A-01</div>
              </div>
            </div>
            <div style={{ background: 'var(--gecko-info-50)', color: 'var(--gecko-info-700)', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700, border: '1px solid var(--gecko-info-200)' }}>
              DRY
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Capacity</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>480</div>
              <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>TEU slots</div>
            </div>
            <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Occupied</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>412</div>
            </div>
            <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Available</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>68</div>
            </div>
            <div style={{ background: 'var(--gecko-bg-surface)', padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Utilization</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>86%</div>
            </div>
          </div>

          {/* Grid View */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: 24, boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Spatial layout</h3>
                <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>6 rows × 16 bays × 4 tiers = 384 TEU slot capacity</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, border: '1px solid var(--gecko-border)' }} /> Empty</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, background: 'var(--gecko-primary-200)' }} /> 1–2 high</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, background: 'var(--gecko-primary-600)' }} /> 3 high</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, background: 'var(--gecko-warning-500)' }} /> 4 high</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* X Axis labels */}
              <div style={{ display: 'flex', paddingLeft: 24, gap: 4 }}>
                {bays.map(b => (
                  <div key={b} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{b}</div>
                ))}
              </div>

              {/* Grid Rows */}
              {rows.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 20, textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', paddingRight: 4 }}>{r}</div>
                  {bays.map(b => {
                    const tier = getCellTier(r, b);
                    const color = getCellColor(tier);
                    return (
                      <div
                        key={`${r}-${b}`}
                        style={{
                          flex: 1, aspectRatio: '1', background: color, border: tier === 0 ? '1px solid var(--gecko-border)' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: tier >= 2 ? '#fff' : 'var(--gecko-primary-700)',
                          fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'transform 100ms',
                          borderRadius: 2
                        }}
                      >
                        {tier > 0 ? tier : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* New Location Modal */}
      {showModal && (
        <NewLocationModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
