"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface EntityOption {
  code: string;
  name: string;
}

export type EntityType =
  | 'agent'
  | 'customer'
  | 'forwarder'
  | 'shipper'
  | 'consignee'
  | 'vessel'
  | 'haulier'
  | 'chargeCode';

// ─── Mock catalogue (replace with Redis/API call in production) ─────────────────

const CATALOGUE: Record<EntityType, EntityOption[]> = {
  agent: [
    { code: 'EVERGREEN', name: 'EVERGREEN MARINE CORPORATION' },
    { code: 'COSCO',     name: 'COSCO SHIPPING LINES CO., LTD' },
    { code: 'MSC',       name: 'MEDITERRANEAN SHIPPING COMPANY' },
    { code: 'HAPAG',     name: 'HAPAG-LLOYD AG' },
    { code: 'OOIL',      name: 'ORIENT OVERSEAS CONTAINER LINE' },
    { code: 'YML',       name: 'YANG MING MARINE TRANSPORT CORP' },
    { code: 'APL',       name: 'APL CO. PTE LTD' },
    { code: 'ONE',       name: 'OCEAN NETWORK EXPRESS PTE LTD' },
    { code: 'HMM',       name: 'HMM CO., LTD (HYUNDAI MERCHANT)' },
    { code: 'MAERSK',    name: 'A.P. MOLLER-MAERSK A/S' },
    { code: 'CMA',       name: 'CMA CGM S.A.' },
    { code: 'PIL',       name: 'PACIFIC INTERNATIONAL LINES PTE LTD' },
    { code: 'WHL',       name: 'WAN HAI LINES LTD' },
    { code: 'SITC',      name: 'SITC INTERNATIONAL HOLDINGS CO LTD' },
    { code: 'ZIM',       name: 'ZIM INTEGRATED SHIPPING SERVICES LTD' },
    { code: 'KMTC',      name: 'KOREA MARINE TRANSPORT CO., LTD' },
    { code: 'NYK',       name: 'NIPPON YUSEN KABUSHIKI KAISHA' },
    { code: 'MOL',       name: 'MITSUI O.S.K. LINES LTD' },
    { code: 'UASC',      name: 'UNITED ARAB SHIPPING CO. S.A.G' },
    { code: 'ARKAS',     name: 'ARKAS CONTAINER TRANSPORT S.A.' },
  ],
  customer: [
    { code: '20250892', name: 'TCL ELECTRONICS (THAILAND) CO., LTD' },
    { code: '20250743', name: 'THAI UNION GROUP PCL' },
    { code: '20251012', name: 'BANGCHAK CORPORATION PCL' },
    { code: '20250612', name: 'PTT GLOBAL CHEMICAL PCL' },
    { code: '20250315', name: 'SIAM CEMENT GROUP (SCG)' },
    { code: '20251103', name: 'CENTRAL RETAIL CORPORATION PCL' },
    { code: '20250922', name: 'AEON CO. (THAILAND) PCL' },
    { code: '20251201', name: 'MINOR INTERNATIONAL PCL' },
    { code: '20250488', name: 'INDORAMA VENTURES PCL' },
    { code: '20251099', name: 'CP GROUP (CHAROEN POKPHAND)' },
    { code: '20250567', name: 'THAI BEVERAGE PCL (THAIBEV)' },
    { code: '20250731', name: 'ADVANCED INFO SERVICE PCL (AIS)' },
    { code: '20251345', name: 'GULF ENERGY DEVELOPMENT PCL' },
    { code: '20250899', name: 'KASIKORN BANK PCL' },
    { code: '20251456', name: 'TRUE CORPORATION PCL' },
    { code: '20250210', name: 'BIDV SECURITIES CORPORATION' },
    { code: '20250333', name: 'CHAROEN POKPHAND FOODS PCL' },
    { code: '20250444', name: 'THAI STANLEY ELECTRIC (THAILAND)' },
  ],
  shipper: [
    { code: '20250892', name: 'TCL ELECTRONICS (THAILAND) CO., LTD' },
    { code: '20250743', name: 'THAI UNION GROUP PCL' },
    { code: '20251012', name: 'BANGCHAK CORPORATION PCL' },
    { code: '20250612', name: 'PTT GLOBAL CHEMICAL PCL' },
    { code: '20250315', name: 'SIAM CEMENT GROUP (SCG)' },
    { code: '20251103', name: 'CENTRAL RETAIL CORPORATION PCL' },
    { code: '20250922', name: 'AEON CO. (THAILAND) PCL' },
    { code: '20251201', name: 'MINOR INTERNATIONAL PCL' },
    { code: '20250488', name: 'INDORAMA VENTURES PCL' },
    { code: '20251099', name: 'CP GROUP (CHAROEN POKPHAND)' },
    { code: '20250567', name: 'THAI BEVERAGE PCL (THAIBEV)' },
    { code: '20250333', name: 'CHAROEN POKPHAND FOODS PCL' },
  ],
  consignee: [
    { code: 'CNEE001', name: 'TO ORDER — BLANK CONSIGNEE' },
    { code: 'CNEE002', name: 'ROTTERDAM PORT AUTHORITY BV' },
    { code: 'CNEE003', name: 'HAMBURG FREIGHT TERMINALS GMBH' },
    { code: 'CNEE004', name: 'TOKYO FREEPORT CORPORATION' },
    { code: 'CNEE005', name: 'ORDER BUYER — GENERAL IMPORT' },
    { code: 'CNEE006', name: 'SINGAPORE CUSTOMS AUTHORITY' },
  ],
  forwarder: [
    { code: 'DHL',    name: 'DHL GLOBAL FORWARDING (THAILAND)' },
    { code: 'KN',     name: 'KUEHNE + NAGEL (THAILAND) LTD' },
    { code: 'EXPE',   name: 'EXPEDITORS INTERNATIONAL OF WASHINGTON' },
    { code: 'NIPEX',  name: 'NIPPON EXPRESS (THAILAND) CO., LTD' },
    { code: 'CEVA',   name: 'CEVA LOGISTICS THAILAND CO., LTD' },
    { code: 'SCHO',   name: 'SCHENKER (THAI) LTD' },
    { code: 'BFAST',  name: 'BOLLORE LOGISTICS THAILAND CO., LTD' },
    { code: 'TOLL',   name: 'TOLL GROUP THAILAND CO., LTD' },
    { code: 'ARAMP',  name: 'ARAMEX THAILAND CO., LTD' },
    { code: 'PANAPL', name: 'PANALPINA WORLD TRANSPORT (THAI)' },
    { code: 'DSVA',   name: 'DSV AIR & SEA CO., LTD' },
    { code: 'GKE',    name: 'GKE LOGISTICS PTE LTD' },
  ],
  vessel: [
    { code: 'TCL13',   name: 'EVER WEB' },
    { code: 'MSCL01',  name: 'MSC LISBON' },
    { code: 'HYP02',   name: 'HYUNDAI PRIDE' },
    { code: 'OOCB01',  name: 'OOCL BERLIN' },
    { code: 'YMU01',   name: 'YM UPRIGHTNESS' },
    { code: 'CSYL01',  name: 'COSCO YANTIAN' },
    { code: 'APLST01', name: 'APL SENTOSA' },
    { code: 'CSSU01',  name: 'COSCO SHIPPING UNIVERSE' },
    { code: 'MSCSI01', name: 'MSC SILVANA' },
    { code: 'EGIV01',  name: 'EVER GIVEN' },
    { code: 'ONE001',  name: 'ONE COMMITMENT' },
    { code: 'MAEU01',  name: 'MAERSK EDINBURGH' },
    { code: 'CMA001',  name: 'CMA CGM MARCO POLO' },
    { code: 'PIL001',  name: 'KOTA PANJANG' },
    { code: 'ZIM001',  name: 'ZIM KINGSTON' },
  ],
  haulier: [
    { code: 'A1TRANS', name: 'A1 TRANSPORT CO., LTD' },
    { code: 'THAITK',  name: 'THAI TRUCK & TRANSPORT CO., LTD' },
    { code: 'SIAMHL',  name: 'SIAM HAULAGE CO., LTD' },
    { code: 'LCBLOG',  name: 'LAEM CHABANG LOGISTICS CO., LTD' },
    { code: 'EASTWS',  name: 'EASTERN WHEELS SERVICES CO., LTD' },
    { code: 'CHAMP',   name: 'CHAMPION HAULIER CO., LTD' },
    { code: 'PREMIER', name: 'PREMIER TRANSPORT GROUP' },
    { code: 'GOLDEN',  name: 'GOLDEN GATE HAULAGE CO., LTD' },
    { code: 'SUPA',    name: 'SUPA LOGISTICS CO., LTD' },
    { code: 'THAIINT', name: 'THAI INTERNATIONAL FREIGHT CARRIER' },
  ],
  chargeCode: [
    { code: 'THC',      name: 'Terminal Handling Charge' },
    { code: 'LIFT',     name: 'Container Lift-On / Lift-Off' },
    { code: 'STORAGE',  name: 'Storage / Demurrage' },
    { code: 'GATE',     name: 'Gate Processing Fee' },
    { code: 'SEAL',     name: 'Seal Fee' },
    { code: 'VGM',      name: 'Weighing / VGM Verification Service' },
    { code: 'DG-HNDL',  name: 'Dangerous Goods Handling' },
    { code: 'REEFPLUG', name: 'Reefer Plug-In / Monitoring' },
    { code: 'RDOC',     name: 'Release Documentation Fee' },
    { code: 'ADMIN',    name: 'Administration Fee' },
    { code: 'STRIPPING',name: 'Container Stripping / Unstuffing' },
    { code: 'STUFFING', name: 'Container Stuffing Service' },
    { code: 'TRANSHIP',  name: 'Transshipment Handling Fee' },
    { code: 'XRAY',     name: 'X-Ray / Scanner Inspection' },
  ],
};

function doSearch(type: EntityType, query: string): EntityOption[] {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];
  return CATALOGUE[type]
    .filter(e => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .slice(0, 8);
}

// ─── Component ──────────────────────────────────────────────────────────────────

export interface EntitySearchProps {
  entityType: EntityType;
  value: EntityOption | null;
  onChange: (value: EntityOption | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  className?: string;
}

export function EntitySearch({
  entityType,
  value,
  onChange,
  placeholder = 'Search by code or name…',
  required,
  disabled,
  size = 'md',
  style,
  className,
}: EntitySearchProps) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [results, setResults]   = useState<EntityOption[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const inputClass = size === 'sm' ? 'gecko-input gecko-input-sm' : 'gecko-input';

  // Close on outside click/tap
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    const found = doSearch(entityType, q);
    setResults(found);
    setOpen(q.length >= 3);
    setActiveIdx(-1);
  };

  const handleSelect = (opt: EntityOption) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // When value is selected, input shows "CODE · Full Name" in read-only mode
  const showingSelection = !!value;
  const displayValue = value ? `${value.code} · ${value.name}` : query;

  const showHint    = !value && query.length > 0 && query.length < 3;
  const showNoRes   = open && results.length === 0 && query.length >= 3;
  const showDropdown = open && results.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }} className={className}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className={inputClass}
          value={displayValue}
          onChange={showingSelection ? undefined : handleChange}
          onFocus={() => { if (!value && results.length > 0) setOpen(true); }}
          onKeyDown={showingSelection ? undefined : handleKeyDown}
          placeholder={showingSelection ? '' : placeholder}
          disabled={disabled}
          readOnly={showingSelection}
          required={required && !value}
          autoComplete="off"
          spellCheck={false}
          style={{
            paddingRight: 36,
            cursor: showingSelection ? 'default' : 'text',
            color: showingSelection ? 'var(--gecko-text-primary)' : undefined,
            fontFamily: showingSelection ? 'inherit' : undefined,
          }}
        />
        {/* Right action icon */}
        {(showingSelection || query) ? (
          <button
            type="button"
            onClick={handleClear}
            onPointerDown={e => e.preventDefault()}
            tabIndex={-1}
            aria-label="Clear selection"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              width: 20, height: 20,
              background: '#ef4444',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#ffffff',
              padding: 0,
              lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              zIndex: 10,
              fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif',
            }}
          >
            ×
          </button>
        ) : (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-disabled)', pointerEvents: 'none',
            display: 'flex', alignItems: 'center',
          }}>
            <Icon name="search" size={13} />
          </span>
        )}
      </div>

      {/* Dropdown: results */}
      {showDropdown && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
            listStyle: 'none',
            margin: 0, padding: '4px 0',
            maxHeight: 256,
            overflowY: 'auto',
          }}
        >
          {results.map((opt, i) => (
            <li
              key={opt.code}
              role="option"
              aria-selected={i === activeIdx}
              onPointerDown={e => { e.preventDefault(); handleSelect(opt); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: 'flex', alignItems: 'baseline', gap: 12,
                padding: '9px 14px', cursor: 'pointer',
                background: i === activeIdx ? 'var(--gecko-primary-50)' : 'transparent',
                transition: 'background 60ms',
              }}
            >
              <span style={{
                fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12,
                color: 'var(--gecko-primary-600)', flexShrink: 0, minWidth: 80,
              }}>
                {opt.code}
              </span>
              <span style={{
                fontSize: 12.5, color: 'var(--gecko-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {opt.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Min-char hint */}
      {showHint && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          padding: '8px 14px',
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--gecko-text-secondary)',
        }}>
          Type at least <strong>3 characters</strong> to search…
        </div>
      )}

      {/* No results */}
      {showNoRes && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          padding: '10px 14px',
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--gecko-text-secondary)',
        }}>
          No results for <strong>"{query}"</strong>
        </div>
      )}
    </div>
  );
}
