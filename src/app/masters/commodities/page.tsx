"use client";
import React, { useState, useMemo } from 'react';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ExportButton } from '@/components/ui/ExportButton';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type HsLevel = 'CHAPTER' | 'HEADING' | 'SUBHEADING' | 'TARIFF_LINE';
type DgClass =
  | 'NONE'
  | 'CLASS_1'
  | 'CLASS_2'
  | 'CLASS_3'
  | 'CLASS_4'
  | 'CLASS_5'
  | 'CLASS_6'
  | 'CLASS_7'
  | 'CLASS_8'
  | 'CLASS_9';

interface Commodity {
  id: number;
  hsCode: string;
  description: string;
  level: HsLevel;
  parentCode: string;
  dgClass: DgClass;
  reeferRequired: boolean;
  oogFlag: boolean;
  importCtrl: boolean;
  exportCtrl: boolean;
  notes: string;
  active: boolean;
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const COMMODITIES: Commodity[] = [
  // Chapters
  { id:  1, hsCode: '01', description: 'Live Animals',                              level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: true,  exportCtrl: false, notes: 'CITES-listed species require import permits', active: true  },
  { id:  2, hsCode: '02', description: 'Meat and Edible Meat Offal',                level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: true,  exportCtrl: false, notes: 'Veterinary inspection required at port', active: true  },
  { id:  3, hsCode: '03', description: 'Fish, Crustaceans and Aquatic Invertebrates', level: 'CHAPTER', parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id:  4, hsCode: '07', description: 'Edible Vegetables and Certain Roots',       level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: false, exportCtrl: false, notes: 'Phytosanitary certificate required', active: true  },
  { id:  5, hsCode: '08', description: 'Edible Fruit and Nuts; Peel of Citrus',     level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id:  6, hsCode: '09', description: 'Coffee, Tea, Maté and Spices',              level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id:  7, hsCode: '10', description: 'Cereals',                                   level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id:  8, hsCode: '15', description: 'Animal or Vegetable Fats and Oils',         level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id:  9, hsCode: '16', description: 'Preparations of Meat, Fish or Crustaceans', level: 'CHAPTER',   parentCode: '',   dgClass: 'NONE',    reeferRequired: true,  oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 10, hsCode: '22', description: 'Beverages, Spirits and Vinegar',            level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: false, notes: 'Alcohol import licensing in some jurisdictions', active: true  },
  { id: 11, hsCode: '25', description: 'Salt; Sulfur; Earths and Stone; Plaster',   level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 12, hsCode: '27', description: 'Mineral Fuels, Mineral Oils and Products',  level: 'CHAPTER',    parentCode: '',   dgClass: 'CLASS_3', reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: true,  notes: 'Dangerous goods — Class 3 flammable liquid', active: true  },
  { id: 13, hsCode: '28', description: 'Inorganic Chemicals; Compounds of Precious Metals', level: 'CHAPTER', parentCode: '', dgClass: 'CLASS_8', reeferRequired: false, oogFlag: false, importCtrl: true, exportCtrl: true, notes: 'Class 8 corrosives require DG documentation', active: true  },
  { id: 14, hsCode: '29', description: 'Organic Chemicals',                         level: 'CHAPTER',    parentCode: '',   dgClass: 'CLASS_3', reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: true,  notes: 'Many sub-headings are flammable or toxic', active: true  },
  { id: 15, hsCode: '39', description: 'Plastics and Articles Thereof',             level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 16, hsCode: '40', description: 'Rubber and Articles Thereof',               level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 17, hsCode: '44', description: 'Wood and Articles of Wood; Wood Charcoal',  level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: true,  notes: 'CITES Annex II — some timber species export-controlled', active: true  },
  { id: 18, hsCode: '48', description: 'Paper and Paperboard; Articles of Pulp',    level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 19, hsCode: '61', description: 'Articles of Apparel and Clothing — Knitted', level: 'CHAPTER',   parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 20, hsCode: '62', description: 'Articles of Apparel and Clothing — Not Knitted', level: 'CHAPTER', parentCode: '', dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 21, hsCode: '72', description: 'Iron and Steel',                             level: 'CHAPTER',   parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: true,  importCtrl: false, exportCtrl: false, notes: 'Heavy coils and slabs typically OOG', active: true  },
  { id: 22, hsCode: '73', description: 'Articles of Iron or Steel',                 level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 23, hsCode: '84', description: 'Nuclear Reactors, Boilers, Machinery',      level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: true,  importCtrl: false, exportCtrl: true,  notes: 'Industrial machinery often OOG; dual-use export controls apply', active: true  },
  { id: 24, hsCode: '85', description: 'Electrical Machinery and Equipment',        level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: true,  notes: 'Dual-use electronics may require export license', active: true  },
  { id: 25, hsCode: '87', description: 'Vehicles (Other Than Railway or Tramway)',  level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: false, notes: 'Import duty and emissions standard compliance', active: true  },
  { id: 26, hsCode: '88', description: 'Aircraft, Spacecraft and Parts Thereof',    level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: true,  importCtrl: true,  exportCtrl: true,  notes: 'Dual-use; ITAR/EAR export controls apply', active: true  },
  { id: 27, hsCode: '89', description: 'Ships, Boats and Floating Structures',      level: 'CHAPTER',    parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: true,  importCtrl: false, exportCtrl: false, notes: 'Vessels on own keel or break-bulk OOG', active: true  },
  { id: 28, hsCode: '90', description: 'Optical, Photographic, Medical Instruments', level: 'CHAPTER',   parentCode: '',   dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: true,  notes: 'Medical devices require import health authority clearance', active: true  },
  // Headings
  { id: 29, hsCode: '0901', description: 'Coffee, Whether or Not Roasted or Decaffeinated', level: 'HEADING', parentCode: '09', dgClass: 'NONE', reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: 'Key Thai re-export commodity', active: true  },
  { id: 30, hsCode: '0902', description: 'Tea, Whether or Not Flavoured',            level: 'HEADING',    parentCode: '09', dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: false, notes: '', active: true  },
  { id: 31, hsCode: '2709', description: 'Petroleum Oils and Oils from Bituminous Minerals — Crude', level: 'HEADING', parentCode: '27', dgClass: 'CLASS_3', reeferRequired: false, oogFlag: false, importCtrl: true, exportCtrl: true, notes: 'Crude oil — high-volume terminal commodity', active: true  },
  { id: 32, hsCode: '2710', description: 'Petroleum Oils — Not Crude; Preparations', level: 'HEADING',   parentCode: '27', dgClass: 'CLASS_3', reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: true,  notes: 'Includes fuel oil, diesel, gasoline, naphtha', active: true  },
  { id: 33, hsCode: '8471', description: 'Automatic Data Processing Machines; Computers', level: 'HEADING', parentCode: '84', dgClass: 'NONE', reeferRequired: false, oogFlag: false, importCtrl: false, exportCtrl: true, notes: 'High-performance computing subject to export license', active: true  },
  { id: 34, hsCode: '8703', description: 'Passenger Vehicles; Motor Cars',           level: 'HEADING',    parentCode: '87', dgClass: 'NONE',    reeferRequired: false, oogFlag: false, importCtrl: true,  exportCtrl: false, notes: 'RO-RO or container; import excise duty applies', active: true  },
  { id: 35, hsCode: '8901', description: 'Cruise Ships, Cargo Vessels, Ferries and Similar', level: 'HEADING', parentCode: '89', dgClass: 'NONE', reeferRequired: false, oogFlag: true, importCtrl: false, exportCtrl: false, notes: 'Vessels on own keel; TOS handles as OOG cargo', active: true  },
];

// ─── Badge & display helpers ──────────────────────────────────────────────────

const LEVEL_STYLE: Record<HsLevel, { bg: string; color: string; label: string; indent: number }> = {
  CHAPTER:    { bg: 'var(--gecko-gray-800)',    color: '#fff',                        label: 'Chapter',     indent: 0  },
  HEADING:    { bg: 'var(--gecko-primary-600)', color: '#fff',                        label: 'Heading',     indent: 16 },
  SUBHEADING: { bg: 'var(--gecko-info-600)',    color: '#fff',                        label: 'Sub-heading', indent: 28 },
  TARIFF_LINE:{ bg: '#6d28d9',                  color: '#fff',                        label: 'Tariff Line', indent: 40 },
};

const DG_STYLE: Record<DgClass, { bg: string; color: string } | null> = {
  NONE:    null,
  CLASS_1: { bg: '#fee2e2', color: '#b91c1c' },
  CLASS_2: { bg: '#fef3c7', color: '#b45309' },
  CLASS_3: { bg: '#ffedd5', color: '#c2410c' },
  CLASS_4: { bg: '#fef9c3', color: '#a16207' },
  CLASS_5: { bg: '#fef3c7', color: '#b45309' },
  CLASS_6: { bg: '#f3e8ff', color: '#7c3aed' },
  CLASS_7: { bg: '#dcfce7', color: '#166534' },
  CLASS_8: { bg: '#ffe4e6', color: '#be123c' },
  CLASS_9: { bg: '#e0f2fe', color: '#0369a1' },
};

const DG_LABEL: Record<DgClass, string> = {
  NONE:    '',
  CLASS_1: 'DG 1',
  CLASS_2: 'DG 2',
  CLASS_3: 'DG 3',
  CLASS_4: 'DG 4',
  CLASS_5: 'DG 5',
  CLASS_6: 'DG 6',
  CLASS_7: 'DG 7',
  CLASS_8: 'DG 8',
  CLASS_9: 'DG 9',
};

function LevelBadge({ level }: { level: HsLevel }) {
  const s = LEVEL_STYLE[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function DgBadge({ dgClass }: { dgClass: DgClass }) {
  if (dgClass === 'NONE') return null;
  const s = DG_STYLE[dgClass]!;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px',
      borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      <Icon name="flame" size={10} style={{ color: s.color }} />
      {DG_LABEL[dgClass]}
    </span>
  );
}

function ReeferIcon() {
  return (
    <span title="Reefer required" style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px',
      borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)',
    }}>
      <Icon name="thermometer" size={10} />
      RF
    </span>
  );
}

function OogIcon() {
  return (
    <span title="Out of gauge" style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px',
      borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)',
    }}>
      <Icon name="packageOpen" size={10} />
      OOG
    </span>
  );
}

function ControlBadge({ type }: { type: 'IMP' | 'EXP' }) {
  const isImp = type === 'IMP';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 5px',
      borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
      background: isImp ? 'var(--gecko-danger-100)' : 'var(--gecko-accent-100)',
      color: isImp ? 'var(--gecko-danger-700)' : 'var(--gecko-accent-700)',
    }}>
      {type}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalForm {
  hsCode: string;
  description: string;
  level: HsLevel;
  parentCode: string;
  dgClass: DgClass;
  reeferRequired: boolean;
  oogFlag: boolean;
  importCtrl: boolean;
  exportCtrl: boolean;
  notes: string;
  active: boolean;
}

const EMPTY_FORM: ModalForm = {
  hsCode: '', description: '', level: 'CHAPTER', parentCode: '',
  dgClass: 'NONE', reeferRequired: false, oogFlag: false,
  importCtrl: false, exportCtrl: false, notes: '', active: true,
};

interface CommodityModalProps {
  commodity: Commodity | null; // null = new
  onClose: () => void;
}

function CommodityModal({ commodity, onClose }: CommodityModalProps) {
  const isNew = commodity === null;
  const [form, setFormRaw] = useState<ModalForm>(
    isNew
      ? EMPTY_FORM
      : {
          hsCode:        commodity.hsCode,
          description:   commodity.description,
          level:         commodity.level,
          parentCode:    commodity.parentCode,
          dgClass:       commodity.dgClass,
          reeferRequired: commodity.reeferRequired,
          oogFlag:       commodity.oogFlag,
          importCtrl:    commodity.importCtrl,
          exportCtrl:    commodity.exportCtrl,
          notes:         commodity.notes,
          active:        commodity.active,
        }
  );
  const set = (patch: Partial<ModalForm>) => setFormRaw(prev => ({ ...prev, ...patch }));
  const canSave = form.hsCode.trim() !== '' && form.description.trim() !== '';
  const { toast } = useToast();
  const handleSave = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: isNew ? 'Commodity added' : 'Commodity updated', message: `${form.hsCode} · ${form.description}` });
    onClose();
  };

  const sectionHead = (title: string) => (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const,
      letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
      marginBottom: 12, paddingBottom: 7,
      borderBottom: '2px solid color-mix(in srgb, var(--gecko-primary-600) 16%, transparent)',
    }}>
      {title}
    </div>
  );

  const FG = ({ label, required, hint, children, half }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; half?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: half ? undefined : 'span 2' }}>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--gecko-danger-600)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{hint}</div>}
    </div>
  );

  const BoolToggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        background: value ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)',
        border: `1.5px solid ${value ? 'var(--gecko-primary-400)' : 'var(--gecko-border)'}`,
        color: value ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: value ? 700 : 500,
        flex: 1,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        background: value ? 'var(--gecko-primary-600)' : 'var(--gecko-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Icon name="check" size={10} style={{ color: '#fff' }} />}
      </div>
      {label}
    </button>
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
          background: 'var(--gecko-primary-50)', borderRadius: '12px 12px 0 0',
          flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
              {isNew ? 'New Commodity Code' : `Edit — ${commodity.hsCode}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              {isNew
                ? 'Add a new HS code to the commodity catalog.'
                : commodity.description}
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
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1 — Classification */}
          <div>
            {sectionHead('Classification')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FG label="HS Code" required half hint="2 = chapter · 4 = heading · 6 = sub-heading · 8 = tariff line">
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. 2710"
                  value={form.hsCode}
                  onChange={e => set({ hsCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  maxLength={8}
                />
              </FG>
              <FG label="Level" required half>
                <select className="gecko-input" value={form.level} onChange={e => set({ level: e.target.value as HsLevel })}>
                  <option value="CHAPTER">Chapter (2-digit)</option>
                  <option value="HEADING">Heading (4-digit)</option>
                  <option value="SUBHEADING">Sub-heading (6-digit)</option>
                  <option value="TARIFF_LINE">Tariff Line (8-digit)</option>
                </select>
              </FG>
              <FG label="Parent Code" hint="Leave blank for top-level chapters. e.g. heading 0901 → parent 09" >
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. 09"
                  value={form.parentCode}
                  onChange={e => set({ parentCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  maxLength={6}
                />
              </FG>
            </div>
          </div>

          {/* Section 2 — Description */}
          <div>
            {sectionHead('Description')}
            <FG label="Official HS Description" required>
              <input
                className="gecko-input"
                placeholder="Official WCO Harmonized System description for this code"
                value={form.description}
                onChange={e => set({ description: e.target.value })}
              />
            </FG>
          </div>

          {/* Section 3 — Cargo Flags */}
          <div>
            {sectionHead('Cargo Flags')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FG label="DG (Hazardous Goods) Class" half hint="IMO IMDG class. Select NONE if not dangerous goods.">
                <select className="gecko-input" value={form.dgClass} onChange={e => set({ dgClass: e.target.value as DgClass })}>
                  <option value="NONE">NONE — Not dangerous goods</option>
                  <option value="CLASS_1">Class 1 — Explosives</option>
                  <option value="CLASS_2">Class 2 — Gases</option>
                  <option value="CLASS_3">Class 3 — Flammable Liquids</option>
                  <option value="CLASS_4">Class 4 — Flammable Solids</option>
                  <option value="CLASS_5">Class 5 — Oxidizing Substances</option>
                  <option value="CLASS_6">Class 6 — Toxic / Infectious</option>
                  <option value="CLASS_7">Class 7 — Radioactive</option>
                  <option value="CLASS_8">Class 8 — Corrosives</option>
                  <option value="CLASS_9">Class 9 — Misc. Dangerous</option>
                </select>
              </FG>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>Cargo Handling Flags</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <BoolToggle label="Reefer Required" value={form.reeferRequired} onChange={v => set({ reeferRequired: v })} />
                  <BoolToggle label="Out of Gauge (OOG)" value={form.oogFlag} onChange={v => set({ oogFlag: v })} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4 — Trade Controls */}
          <div>
            {sectionHead('Trade Controls')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>Licensing / Permit Requirements</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <BoolToggle label="Import Controlled" value={form.importCtrl} onChange={v => set({ importCtrl: v })} />
                <BoolToggle label="Export Controlled" value={form.exportCtrl} onChange={v => set({ exportCtrl: v })} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
                Flagging import/export control triggers a mandatory license field on BL and customs declaration forms.
              </div>
            </div>
          </div>

          {/* Section 5 — Notes & Status */}
          <div>
            {sectionHead('Notes & Status')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FG label="Notes">
                <textarea
                  className="gecko-input"
                  placeholder="Free-text compliance notes, handling instructions, etc."
                  value={form.notes}
                  onChange={e => set({ notes: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </FG>
              <FG label="Active" half hint="Inactive codes are hidden from BL and declaration dropdowns.">
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  {([true, false] as const).map(v => (
                    <button
                      key={String(v)}
                      onClick={() => set({ active: v })}
                      style={{
                        flex: 1, padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${form.active === v ? (v ? 'var(--gecko-success-500)' : 'var(--gecko-danger-400)') : 'var(--gecko-border)'}`,
                        background: form.active === v ? (v ? 'var(--gecko-success-50)' : 'var(--gecko-danger-50)') : 'var(--gecko-bg-surface)',
                        color: form.active === v ? (v ? 'var(--gecko-success-700)' : 'var(--gecko-danger-700)') : 'var(--gecko-text-secondary)',
                        fontFamily: 'inherit', fontSize: 12.5, fontWeight: form.active === v ? 700 : 500,
                      }}
                    >
                      {v ? 'Active' : 'Inactive'}
                    </button>
                  ))}
                </div>
              </FG>
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
            {isNew ? '* HS Code and Description are required' : `ID: ${commodity.id}`}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={handleSave}
            disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            <Icon name="save" size={14} /> {isNew ? 'Save Code' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
      borderRadius: 10, padding: '14px 18px', minWidth: 0,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--gecko-text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommoditiesPage() {
  const [search,       setSearch]       = useState('');
  const [levelFilter,  setLevelFilter]  = useState<HsLevel | ''>('');
  const [dgFilter,     setDgFilter]     = useState<'all' | 'dg'>('all');
  const [reeferFilter, setReeferFilter] = useState<'all' | 'reefer'>('all');
  const [oogFilter,    setOogFilter]    = useState<'all' | 'oog'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editItem,     setEditItem]     = useState<Commodity | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => COMMODITIES.filter(c => {
    if (activeFilter === 'active'   && !c.active) return false;
    if (activeFilter === 'inactive' && c.active)  return false;
    if (levelFilter && c.level !== levelFilter)   return false;
    if (dgFilter    === 'dg'     && c.dgClass === 'NONE') return false;
    if (reeferFilter=== 'reefer' && !c.reeferRequired)    return false;
    if (oogFilter   === 'oog'    && !c.oogFlag)            return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.hsCode.includes(q) && !c.description.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [search, levelFilter, dgFilter, reeferFilter, oogFilter, activeFilter]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const totalCodes   = COMMODITIES.length;
  const chapters     = COMMODITIES.filter(c => c.level === 'CHAPTER').length;
  const dgFlagged    = COMMODITIES.filter(c => c.dgClass !== 'NONE').length;
  const reeferFlagged= COMMODITIES.filter(c => c.reeferRequired).length;

  const openNew  = () => { setEditItem(null); setModalOpen(true); };
  const openEdit = (c: Commodity) => { setEditItem(c); setModalOpen(true); };

  const FilterPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
        cursor: 'pointer', border: '1px solid',
        borderColor: active ? 'var(--gecko-primary-400)' : 'var(--gecko-border)',
        background:  active ? 'var(--gecko-primary-50)'  : 'var(--gecko-bg-surface)',
        color:       active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Commodity Codes</h1>
            <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
            WCO Harmonized System (HS) catalog. Used on BL, customs declaration, DG verification, and reefer planning.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Commodities" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Import HS codes', message: 'CSV import workflow coming soon.' })}><Icon name="upload" size={16} /> Import</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}><Icon name="plus" size={16} /> New Code</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total HS Codes"    value={totalCodes}    />
        <StatCard label="Chapters"          value={chapters}      color="var(--gecko-gray-700)" />
        <StatCard label="DG Flagged"        value={dgFlagged}     color="var(--gecko-danger-600)" />
        <StatCard label="Reefer Flagged"    value={reeferFlagged} color="var(--gecko-info-600)" />
      </div>

      {/* Filter bar */}
      <div style={{
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
          <input
            className="gecko-input gecko-input-sm"
            placeholder="Search HS code or description…"
            style={{ paddingLeft: 30 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--gecko-border)', flexShrink: 0 }} />

        {/* Level filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterPill label="All Levels"   active={levelFilter === ''}           onClick={() => setLevelFilter('')} />
          <FilterPill label="Chapter"      active={levelFilter === 'CHAPTER'}    onClick={() => setLevelFilter('CHAPTER')} />
          <FilterPill label="Heading"      active={levelFilter === 'HEADING'}    onClick={() => setLevelFilter('HEADING')} />
          <FilterPill label="Sub-heading"  active={levelFilter === 'SUBHEADING'} onClick={() => setLevelFilter('SUBHEADING')} />
          <FilterPill label="Tariff Line"  active={levelFilter === 'TARIFF_LINE'} onClick={() => setLevelFilter('TARIFF_LINE')} />
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--gecko-border)', flexShrink: 0 }} />

        {/* Cargo flag filters */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterPill label="DG only"    active={dgFilter    === 'dg'}     onClick={() => setDgFilter(dgFilter === 'dg' ? 'all' : 'dg')} />
          <FilterPill label="Reefer"     active={reeferFilter=== 'reefer'} onClick={() => setReeferFilter(reeferFilter === 'reefer' ? 'all' : 'reefer')} />
          <FilterPill label="OOG"        active={oogFilter   === 'oog'}    onClick={() => setOogFilter(oogFilter === 'oog' ? 'all' : 'oog')} />
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--gecko-border)', flexShrink: 0 }} />

        {/* Active filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          <FilterPill label="Active"   active={activeFilter === 'active'}   onClick={() => setActiveFilter('active')} />
          <FilterPill label="All"      active={activeFilter === 'all'}      onClick={() => setActiveFilter('all')} />
          <FilterPill label="Inactive" active={activeFilter === 'inactive'} onClick={() => setActiveFilter('inactive')} />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
        borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)',
      }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>HS Code</th>
              <th>Description</th>
              <th style={{ width: 110 }}>Level</th>
              <th style={{ width: 80 }}>DG Class</th>
              <th style={{ width: 110 }}>Flags</th>
              <th style={{ width: 90 }}>Controls</th>
              <th style={{ width: 70 }}>Status</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="search"
                    title="No codes match the current filters"
                    description="Try adjusting your search or category filters."
                  />
                </td>
              </tr>
            ) : (
              pageItems.map(c => {
                const indent = LEVEL_STYLE[c.level].indent;
                const isChapter = c.level === 'CHAPTER';
                return (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                    {/* HS Code cell — indent by level */}
                    <td>
                      <div style={{ paddingLeft: indent, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {!isChapter && (
                          <span style={{ color: 'var(--gecko-border)', fontSize: 12, userSelect: 'none' }}>└</span>
                        )}
                        <span style={{
                          fontFamily: 'var(--gecko-font-mono)', fontWeight: isChapter ? 800 : 600,
                          fontSize: isChapter ? 14 : 13,
                          color: LEVEL_STYLE[c.level].bg === 'var(--gecko-gray-800)' ? 'var(--gecko-text-primary)' : LEVEL_STYLE[c.level].bg,
                          letterSpacing: '0.06em',
                        }}>
                          {c.hsCode}
                        </span>
                      </div>
                    </td>
                    {/* Description */}
                    <td>
                      <div style={{ fontWeight: isChapter ? 600 : 400, color: 'var(--gecko-text-primary)', lineHeight: 1.4 }}>
                        {c.description}
                      </div>
                      {c.parentCode && (
                        <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginTop: 2 }}>
                          Parent: <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{c.parentCode}</span>
                        </div>
                      )}
                    </td>
                    {/* Level badge */}
                    <td><LevelBadge level={c.level} /></td>
                    {/* DG */}
                    <td>
                      {c.dgClass !== 'NONE' ? <DgBadge dgClass={c.dgClass} /> : <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 12 }}>—</span>}
                    </td>
                    {/* Flags */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.reeferRequired && <ReeferIcon />}
                        {c.oogFlag        && <OogIcon />}
                        {!c.reeferRequired && !c.oogFlag && <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    {/* Controls */}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {c.importCtrl && <ControlBadge type="IMP" />}
                        {c.exportCtrl && <ControlBadge type="EXP" />}
                        {!c.importCtrl && !c.exportCtrl && <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    {/* Status */}
                    <td>
                      <span className={`gecko-status-dot gecko-status-dot-${c.active ? 'active' : 'inactive'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openEdit(c)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                        title="Edit"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize} noun="commodity codes" />
      </div>

      {/* Modal */}
      {modalOpen && (
        <CommodityModal
          commodity={editItem}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
