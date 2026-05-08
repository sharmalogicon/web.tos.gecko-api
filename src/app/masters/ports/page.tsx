"use client";
import React, { useState, useMemo } from 'react';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type PortType =
  | 'SEAPORT'
  | 'AIRPORT'
  | 'RAIL_TERMINAL'
  | 'ICD'
  | 'CFS_DEPOT'
  | 'ROAD_TERMINAL'
  | 'MULTIMODAL';

type TradeMode = 'BOTH' | 'IMPORT_ONLY' | 'EXPORT_ONLY' | 'TRANSIT';

interface Port {
  locode: string;         // 5-char UN/LOCODE, e.g. THBKK
  name: string;
  country: string;        // ISO 3166-1 alpha-2
  portType: PortType;
  tradeMode: TradeMode;
  subdivision?: string;
  lat?: number;
  lon?: number;
  isoCode?: string;
  iataCode?: string;
  mappingCode?: string;
  active: boolean;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const PORTS: Port[] = [
  { locode: 'THBKK', name: 'Bangkok', country: 'TH', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'BM', lat: 13.7563, lon: 100.5018, isoCode: 'BKK', mappingCode: 'BANGKOK', active: true },
  { locode: 'THLCB', name: 'Laem Chabang', country: 'TH', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'CC', lat: 13.0869, lon: 100.8817, isoCode: 'LCB', mappingCode: 'LAEMCHABANG', active: true },
  { locode: 'SGSIN', name: 'Singapore', country: 'SG', portType: 'MULTIMODAL', tradeMode: 'BOTH', lat: 1.2897, lon: 103.8501, isoCode: 'SIN', mappingCode: 'SINGAPORE', active: true },
  { locode: 'MYPKG', name: 'Port Klang', country: 'MY', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: '10', lat: 3.0000, lon: 101.4000, isoCode: 'PKG', mappingCode: 'PORTKLANG', active: true },
  { locode: 'IDTPP', name: 'Tanjung Priok Jakarta', country: 'ID', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'JB', lat: -6.1007, lon: 106.8725, isoCode: 'TPP', mappingCode: 'TANJUNGPRIOK', active: true },
  { locode: 'VNCLI', name: 'Cat Lai Ho Chi Minh', country: 'VN', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'SG', lat: 10.7769, lon: 106.7230, isoCode: 'CLI', mappingCode: 'CATLAI', active: true },
  { locode: 'CNSHA', name: 'Shanghai', country: 'CN', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'SH', lat: 31.2304, lon: 121.4737, isoCode: 'SHA', mappingCode: 'SHANGHAI', active: true },
  { locode: 'CNNGB', name: 'Ningbo', country: 'CN', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'ZJ', lat: 29.8683, lon: 121.5440, isoCode: 'NGB', mappingCode: 'NINGBO', active: true },
  { locode: 'HKHKG', name: 'Hong Kong', country: 'HK', portType: 'SEAPORT', tradeMode: 'BOTH', lat: 22.3193, lon: 114.1694, isoCode: 'HKG', mappingCode: 'HONGKONG', active: true },
  { locode: 'KRPUS', name: 'Busan', country: 'KR', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: '26', lat: 35.1796, lon: 129.0756, isoCode: 'PUS', mappingCode: 'BUSAN', active: true },
  { locode: 'JPYOK', name: 'Yokohama', country: 'JP', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: '14', lat: 35.4437, lon: 139.6380, isoCode: 'YOK', mappingCode: 'YOKOHAMA', active: true },
  { locode: 'JPTYO', name: 'Tokyo', country: 'JP', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: '13', lat: 35.6762, lon: 139.6503, isoCode: 'TYO', mappingCode: 'TOKYO', active: true },
  { locode: 'INNSA', name: 'Nhava Sheva (JNPT)', country: 'IN', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'MH', lat: 18.9500, lon: 72.9500, isoCode: 'NSA', mappingCode: 'NHAVASHEVA', active: true },
  { locode: 'AEDXB', name: 'Dubai (Jebel Ali)', country: 'AE', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'DU', lat: 25.0657, lon: 55.1713, isoCode: 'DXB', mappingCode: 'JEBELALI', active: true },
  { locode: 'GBFXT', name: 'Felixstowe', country: 'GB', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'SFK', lat: 51.9600, lon: 1.3510, isoCode: 'FXT', mappingCode: 'FELIXSTOWE', active: true },
  { locode: 'NLRTM', name: 'Rotterdam', country: 'NL', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'ZH', lat: 51.9244, lon: 4.4777, isoCode: 'RTM', mappingCode: 'ROTTERDAM', active: true },
  { locode: 'DEHAM', name: 'Hamburg', country: 'DE', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'HH', lat: 53.5753, lon: 10.0153, isoCode: 'HAM', mappingCode: 'HAMBURG', active: true },
  { locode: 'USLAX', name: 'Los Angeles', country: 'US', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'CA', lat: 33.7490, lon: -118.1937, isoCode: 'LAX', mappingCode: 'LOS_ANGELES', active: true },
  { locode: 'USNYC', name: 'New York', country: 'US', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'NY', lat: 40.6840, lon: -74.0440, isoCode: 'NYC', mappingCode: 'NEW_YORK', active: true },
  { locode: 'AUMEL', name: 'Melbourne', country: 'AU', portType: 'SEAPORT', tradeMode: 'BOTH', subdivision: 'VIC', lat: -37.8136, lon: 144.9631, isoCode: 'MEL', mappingCode: 'MELBOURNE', active: true },
  { locode: 'THBK2', name: 'Bangkok ICD (Lad Krabang)', country: 'TH', portType: 'ICD', tradeMode: 'BOTH', subdivision: 'BM', lat: 13.7233, lon: 100.7498, mappingCode: 'BKK_ICD', active: true },
  { locode: 'SGCFS', name: 'Singapore CFS', country: 'SG', portType: 'CFS_DEPOT', tradeMode: 'BOTH', lat: 1.3521, lon: 103.8198, mappingCode: 'SIN_CFS', active: true },
  { locode: 'CNSGH', name: 'Shanghai Hongqiao Airport', country: 'CN', portType: 'AIRPORT', tradeMode: 'BOTH', subdivision: 'SH', lat: 31.1979, lon: 121.3360, isoCode: 'SHA', iataCode: 'SHA', mappingCode: 'SHA_AIRPORT', active: true },
  { locode: 'THDMK', name: 'Bangkok Don Mueang Airport', country: 'TH', portType: 'AIRPORT', tradeMode: 'BOTH', subdivision: 'BM', lat: 13.9126, lon: 100.6066, iataCode: 'DMK', mappingCode: 'DMK_AIRPORT', active: true },
  { locode: 'MYKUL', name: 'Kuala Lumpur Airport', country: 'MY', portType: 'AIRPORT', tradeMode: 'BOTH', lat: 2.7456, lon: 101.7099, iataCode: 'KUL', mappingCode: 'KUL_AIRPORT', active: true },
  { locode: 'THTBK', name: 'Bangkok Rail Terminal', country: 'TH', portType: 'RAIL_TERMINAL', tradeMode: 'IMPORT_ONLY', subdivision: 'BM', lat: 13.7500, lon: 100.5230, mappingCode: 'BKK_RAIL', active: false },
];

// ─── Filter / Sort config ─────────────────────────────────────────────────────

const PORT_SORT_OPTIONS: SortOption[] = [
  { label: 'Name A → Z', value: 'name' },
  { label: 'UN/LOCODE A → Z', value: 'locode' },
  { label: 'Country A → Z', value: 'country' },
];

const PORT_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search by LOCODE, port name, mapping code…' },
  {
    type: 'select', key: 'country', label: 'Country',
    options: [
      { label: 'All countries', value: '' },
      { label: 'Thailand (TH)', value: 'TH' },
      { label: 'Singapore (SG)', value: 'SG' },
      { label: 'Malaysia (MY)', value: 'MY' },
      { label: 'Indonesia (ID)', value: 'ID' },
      { label: 'Vietnam (VN)', value: 'VN' },
      { label: 'China (CN)', value: 'CN' },
      { label: 'Hong Kong (HK)', value: 'HK' },
      { label: 'Korea (KR)', value: 'KR' },
      { label: 'Japan (JP)', value: 'JP' },
      { label: 'India (IN)', value: 'IN' },
      { label: 'UAE (AE)', value: 'AE' },
      { label: 'UK (GB)', value: 'GB' },
      { label: 'Netherlands (NL)', value: 'NL' },
      { label: 'Germany (DE)', value: 'DE' },
      { label: 'USA (US)', value: 'US' },
      { label: 'Australia (AU)', value: 'AU' },
    ],
  },
  {
    type: 'select', key: 'portType', label: 'Port Type',
    options: [
      { label: 'All types', value: '' },
      { label: 'Seaport', value: 'SEAPORT' },
      { label: 'Airport', value: 'AIRPORT' },
      { label: 'ICD', value: 'ICD' },
      { label: 'CFS / Depot', value: 'CFS_DEPOT' },
      { label: 'Rail Terminal', value: 'RAIL_TERMINAL' },
      { label: 'Road Terminal', value: 'ROAD_TERMINAL' },
      { label: 'Multimodal', value: 'MULTIMODAL' },
    ],
  },
  {
    type: 'select', key: 'tradeMode', label: 'Trade Mode',
    options: [
      { label: 'All modes', value: '' },
      { label: 'Both', value: 'BOTH' },
      { label: 'Import only', value: 'IMPORT_ONLY' },
      { label: 'Export only', value: 'EXPORT_ONLY' },
      { label: 'Transit', value: 'TRANSIT' },
    ],
  },
  {
    type: 'select', key: 'active', label: 'Status',
    options: [
      { label: 'All', value: '' },
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  },
];

// ─── Badge helpers ────────────────────────────────────────────────────────────

const PORT_TYPE_STYLES: Record<PortType, { bg: string; color: string; label: string }> = {
  SEAPORT:       { bg: 'var(--gecko-primary-100)',  color: 'var(--gecko-primary-700)',  label: 'Seaport' },
  AIRPORT:       { bg: 'var(--gecko-info-100)',     color: 'var(--gecko-info-700)',     label: 'Airport' },
  ICD:           { bg: '#fff3e0',                   color: '#e65100',                   label: 'ICD' },
  CFS_DEPOT:     { bg: '#f3e5f5',                   color: '#6a1b9a',                   label: 'CFS Depot' },
  RAIL_TERMINAL: { bg: 'var(--gecko-gray-100)',     color: 'var(--gecko-gray-700)',     label: 'Rail Terminal' },
  ROAD_TERMINAL: { bg: 'var(--gecko-gray-100)',     color: 'var(--gecko-gray-600)',     label: 'Road Terminal' },
  MULTIMODAL:    { bg: '#e8eaf6',                   color: '#283593',                   label: 'Multimodal' },
};

function PortTypeBadge({ type }: { type: PortType }) {
  const s = PORT_TYPE_STYLES[type];
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function TradeBadge({ mode }: { mode: TradeMode }) {
  if (mode === 'BOTH') return <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>Both</span>;
  const label = mode === 'IMPORT_ONLY' ? 'Import' : mode === 'EXPORT_ONLY' ? 'Export' : 'Transit';
  const color = mode === 'IMPORT_ONLY'
    ? 'var(--gecko-info-600)'
    : mode === 'EXPORT_ONLY'
    ? 'var(--gecko-warning-600)'
    : 'var(--gecko-text-secondary)';
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>;
}

/** Split 5-char LOCODE into country (2) + location (3) with different opacities. */
function LOCODEBadge({ locode }: { locode: string }) {
  const cc = locode.slice(0, 2);
  const loc = locode.slice(2);
  return (
    <span
      style={{
        fontFamily: 'var(--gecko-font-mono)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        background: 'var(--gecko-primary-50, #eff6ff)',
        border: '1px solid var(--gecko-primary-200, #bfdbfe)',
        borderRadius: 4,
        padding: '1px 5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        color: 'var(--gecko-primary-700)',
      }}
    >
      <span style={{ opacity: 0.55 }}>{cc}</span>
      <span style={{ opacity: 1 }}>{loc}</span>
    </span>
  );
}

function CoordCell({ lat, lon }: { lat?: number; lon?: number }) {
  if (lat == null || lon == null) return <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 11 }}>—</span>;
  const fmt = (n: number, pos: string, neg: string) => `${Math.abs(n).toFixed(2)}°${n >= 0 ? pos : neg}`;
  return (
    <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)', lineHeight: 1.3 }}>
      <div>{fmt(lat, 'N', 'S')}</div>
      <div>{fmt(lon, 'E', 'W')}</div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const EMPTY_PORT: Port = {
  locode: '', name: '', country: '', portType: 'SEAPORT', tradeMode: 'BOTH',
  subdivision: '', lat: undefined, lon: undefined,
  isoCode: '', iataCode: '', mappingCode: '', active: true,
};

function PortModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Port | null;
  onClose: () => void;
  onSave: (p: Port) => void;
}) {
  const [form, setForm] = useState<Port>(initial ?? EMPTY_PORT);
  const isEdit = initial !== null;

  function set<K extends keyof Port>(k: K, v: Port[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.locode.trim() || !form.name.trim() || !form.country.trim()) return;
    onSave(form);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 34,
    padding: '0 10px',
    border: '1px solid var(--gecko-border)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--gecko-text-primary)',
    background: 'var(--gecko-bg-surface)',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--gecko-text-secondary)',
    marginBottom: 4,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--gecko-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid var(--gecko-border)',
  };
  const gridStyle = (cols: number): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '10px 14px',
    marginBottom: 18,
  });

  return (
    <div
      className="gecko-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="gecko-modal gecko-modal-lg"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--gecko-border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {isEdit ? `Edit Port — ${initial!.locode}` : 'New Port'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              {isEdit ? 'Update UN/LOCODE global place record' : 'Add a port, ICD, depot, or place to the global catalog'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: 4, borderRadius: 4 }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e)} style={{ padding: '20px 20px 0 20px', flex: 1 }}>

          {/* Section: Identity */}
          <div style={sectionHeadStyle}>Identity</div>
          <div style={gridStyle(3)}>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={labelStyle}>UN/LOCODE <span style={{ color: 'var(--gecko-error-500)' }}>*</span></label>
              <input
                style={{ ...inputStyle, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                placeholder="e.g. THBKK"
                maxLength={5}
                value={form.locode}
                onChange={e => set('locode', e.target.value.toUpperCase())}
                required
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Port Name <span style={{ color: 'var(--gecko-error-500)' }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Official port or place name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Country Code <span style={{ color: 'var(--gecko-error-500)' }}>*</span></label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase' }}
                placeholder="TH"
                maxLength={2}
                value={form.country}
                onChange={e => set('country', e.target.value.toUpperCase())}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Subdivision / State</label>
              <input
                style={inputStyle}
                placeholder="State/province code"
                value={form.subdivision ?? ''}
                onChange={e => set('subdivision', e.target.value)}
              />
            </div>
          </div>

          {/* Section: Classification */}
          <div style={sectionHeadStyle}>Classification</div>
          <div style={gridStyle(2)}>
            <div>
              <label style={labelStyle}>Port Type <span style={{ color: 'var(--gecko-error-500)' }}>*</span></label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.portType}
                onChange={e => set('portType', e.target.value as PortType)}
                required
              >
                <option value="SEAPORT">Seaport</option>
                <option value="AIRPORT">Airport</option>
                <option value="ICD">ICD — Inland Container Depot</option>
                <option value="CFS_DEPOT">CFS / Depot</option>
                <option value="RAIL_TERMINAL">Rail Terminal</option>
                <option value="ROAD_TERMINAL">Road Terminal</option>
                <option value="MULTIMODAL">Multimodal Hub</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trade Mode</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.tradeMode}
                onChange={e => set('tradeMode', e.target.value as TradeMode)}
              >
                <option value="BOTH">Both (Import + Export)</option>
                <option value="IMPORT_ONLY">Import only</option>
                <option value="EXPORT_ONLY">Export only</option>
                <option value="TRANSIT">Transit</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
              <input
                id="port-active"
                type="checkbox"
                checked={form.active}
                onChange={e => set('active', e.target.checked)}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gecko-primary-500)' }}
              />
              <label htmlFor="port-active" style={{ ...labelStyle, margin: 0, textTransform: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Active — visible in port lookups on bookings and B/L
              </label>
            </div>
          </div>

          {/* Section: Location */}
          <div style={sectionHeadStyle}>Location</div>
          <div style={gridStyle(2)}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input
                style={inputStyle}
                type="number"
                step="0.0001"
                min={-90}
                max={90}
                placeholder="e.g. 13.7563"
                value={form.lat ?? ''}
                onChange={e => set('lat', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input
                style={inputStyle}
                type="number"
                step="0.0001"
                min={-180}
                max={180}
                placeholder="e.g. 100.5018"
                value={form.lon ?? ''}
                onChange={e => set('lon', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Codes */}
          <div style={sectionHeadStyle}>Codes</div>
          <div style={{ ...gridStyle(3), marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>ISO Code</label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--gecko-font-mono)' }}
                placeholder="e.g. BKK"
                value={form.isoCode ?? ''}
                onChange={e => set('isoCode', e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label style={labelStyle}>IATA Code</label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--gecko-font-mono)' }}
                placeholder="3-char (airports)"
                maxLength={3}
                value={form.iataCode ?? ''}
                onChange={e => set('iataCode', e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label style={labelStyle}>Mapping Code</label>
              <input
                style={{ ...inputStyle, fontFamily: 'var(--gecko-font-mono)' }}
                placeholder="Legacy / EDI code"
                value={form.mappingCode ?? ''}
                onChange={e => set('mappingCode', e.target.value)}
              />
            </div>
          </div>

        </form>

        {/* Modal footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '14px 20px',
          borderTop: '1px solid var(--gecko-border)',
          flexShrink: 0,
          background: 'var(--gecko-bg-subtle, var(--gecko-bg-surface))',
          borderRadius: '0 0 12px 12px',
        }}>
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={() => handleSubmit()}
          >
            <Icon name="save" size={14} />
            {isEdit ? 'Save changes' : 'Create port'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortsListPage() {
  const [ports, setPorts] = useState<Port[]>(PORTS);
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', country: '', portType: '', tradeMode: '', active: 'active',
  });
  const [sortBy, setSortBy] = useState('name');
  const [modalPort, setModalPort] = useState<Port | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  // Derived counts
  const seaportCount = ports.filter(p => p.portType === 'SEAPORT').length;
  const icdDepotCount = ports.filter(p => p.portType === 'ICD' || p.portType === 'CFS_DEPOT').length;

  // Filtered + sorted list
  const displayed = useMemo(() => {
    let list = ports.filter(p => {
      const q = filters.query.trim().toLowerCase();
      if (q && !p.locode.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q) && !(p.mappingCode ?? '').toLowerCase().includes(q)) return false;
      if (filters.country && p.country !== filters.country) return false;
      if (filters.portType && p.portType !== filters.portType) return false;
      if (filters.tradeMode && p.tradeMode !== filters.tradeMode) return false;
      if (filters.active === 'active' && !p.active) return false;
      if (filters.active === 'inactive' && p.active) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'locode') return a.locode.localeCompare(b.locode);
      if (sortBy === 'country') return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [ports, filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(displayed);

  function openNew() {
    setModalPort(null);
    setModalOpen(true);
  }

  function openEdit(p: Port) {
    setModalPort(p);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleSave(p: Port) {
    const isUpdate = modalPort !== null;
    setPorts(prev => {
      const idx = prev.findIndex(x => x.locode === p.locode && modalPort !== null);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = p;
        return next;
      }
      return [...prev, p];
    });
    toast({ variant: 'success', title: isUpdate ? 'Port updated' : 'Port added', message: `${p.locode} · ${p.name}` });
    closeModal();
  }

  return (
    <>
      <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div className="gecko-page-actions">
          <div className="gecko-page-actions-left">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>
                Ports &amp; Locations
              </h1>
              <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              UN/LOCODE global place catalog. References POL, POD, and transshipment on every booking and B/L.
            </div>
            {/* Stat badges */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: 'var(--gecko-primary-50, #eff6ff)',
                color: 'var(--gecko-primary-700)',
                border: '1px solid var(--gecko-primary-200, #bfdbfe)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                <Icon name="anchor" size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {seaportCount} seaports
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: '#fff3e0', color: '#e65100',
                border: '1px solid #ffcc80',
                padding: '2px 8px', borderRadius: 20,
              }}>
                <Icon name="box" size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {icdDepotCount} ICD / depot
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: 'var(--gecko-bg-subtle, #f8fafc)', color: 'var(--gecko-text-secondary)',
                border: '1px solid var(--gecko-border)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                {ports.length} total records
              </span>
            </div>
          </div>
          <div className="gecko-toolbar">
            <ExportButton resource="Ports" iconSize={16} />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="upload" size={16} /> Import</button>
            <FilterPopover
              fields={PORT_FILTER_FIELDS}
              values={filters}
              onChange={setFilters}
              onApply={(v) => setFilters(v)}
              onClear={() => setFilters({ query: '', country: '', portType: '', tradeMode: '', active: '' })}
              sortOptions={PORT_SORT_OPTIONS}
              sortValue={sortBy}
              onSortChange={setSortBy}
            />
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}>
              <Icon name="plus" size={16} /> New Port
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: 'var(--gecko-shadow-sm)',
        }}>
          <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>UN/LOCODE</th>
                <th>Port Name</th>
                <th style={{ width: 62 }}>Country</th>
                <th style={{ width: 130 }}>Type</th>
                <th style={{ width: 80 }}>Trade Mode</th>
                <th style={{ width: 96 }}>Coordinates</th>
                <th style={{ width: 100 }}>Mapping Code</th>
                <th style={{ width: 68 }}>Active</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon="search"
                      title="No ports match the current filters"
                      description="Try clearing the search query or adjusting country / type / trade-mode filters."
                    />
                  </td>
                </tr>
              )}
              {pageItems.map((p) => (
                <tr key={p.locode} style={{ cursor: 'pointer' }} onClick={() => openEdit(p)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <LOCODEBadge locode={p.locode} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{p.name}</div>
                    {p.iataCode && (
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>
                        IATA: {p.iataCode}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 28,
                      textAlign: 'center',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      background: 'var(--gecko-gray-100)',
                      color: 'var(--gecko-gray-700)',
                    }}>
                      {p.country}
                    </span>
                  </td>
                  <td>
                    <PortTypeBadge type={p.portType} />
                  </td>
                  <td>
                    <TradeBadge mode={p.tradeMode} />
                  </td>
                  <td>
                    <CoordCell lat={p.lat} lon={p.lon} />
                  </td>
                  <td>
                    {p.mappingCode
                      ? <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{p.mappingCode}</span>
                      : <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 11 }}>—</span>
                    }
                  </td>
                  <td>
                    <span className={`gecko-status-dot gecko-status-dot-${p.active ? 'active' : 'warning'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer' }}
                      onClick={() => openEdit(p)}
                    >
                      <Icon name="moreHorizontal" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
            totalPages={totalPages} startRow={startRow} endRow={endRow}
            onPageChange={setPage} onPageSizeChange={setPageSize} noun="ports" />
        </div>

      </div>

      {/* Modal */}
      {modalOpen && (
        <PortModal
          initial={modalPort as Port | null}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </>
  );
}
