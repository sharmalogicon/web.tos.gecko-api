import React from 'react';
import { Icon } from './Icon';

export function PageToolbar({ title, subtitle, badges = [], actions }: any) {
  return (
    <div className="gecko-page-header gecko-mb-4">
      <div className="gecko-page-header-left">
        <div className="gecko-row gecko-mb-1">
          <h1 className="gecko-page-title">{title}</h1>
          {badges.map((b: any, i: number) => (
            <span key={i} className={`gecko-badge gecko-badge-${b.kind || 'gray'} gecko-badge-xs`}>{b.label}</span>
          ))}
        </div>
        {subtitle && <div className="gecko-page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="gecko-page-header-actions">{actions}</div>}
    </div>
  );
}

export function FilterBar({ filters = [], onSearch, searchPlaceholder = 'Search…', right }: any) {
  return (
    <div className="gecko-filter-bar gecko-mb-3">
      <div className="gecko-filter-bar-search">
        <Icon name="search" size={14} className="gecko-filter-bar-search-icon" />
        <input className="gecko-input gecko-input-sm gecko-filter-bar-search-input" placeholder={searchPlaceholder} />
      </div>
      {filters.map((f: any, i: number) => (
        <button key={i} className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-filter-bar-pill">
          {f.icon && <Icon name={f.icon} size={12} />}
          <span className="gecko-filter-bar-pill-label">{f.label}:</span>
          <span className="gecko-filter-bar-pill-value">{f.value}</span>
          <Icon name="chevronDown" size={11} className="gecko-filter-bar-pill-chevron" />
        </button>
      ))}
      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-filter-bar-add">
        <Icon name="plus" size={12} /> Add filter
      </button>
      {right && <div className="gecko-ml-auto gecko-row gecko-stack-xs">{right}</div>}
    </div>
  );
}

export function StatusDot({ kind = 'success' }: { kind?: string }) {
  return <span className={`gecko-status-dot-mini gecko-tone-${kind}-bg`} aria-hidden="true" />;
}

export function Stat({ label, value, sub, align = 'left' }: any) {
  const alignClass = align === 'right' ? 'gecko-stat-block-right'
                    : align === 'center' ? 'gecko-stat-block-center'
                    : 'gecko-stat-block-left';
  return (
    <div className={`gecko-stat-block ${alignClass}`}>
      <div className="gecko-stat-label">{label}</div>
      <div className="gecko-stat-num gecko-stat-num-sm gecko-mt-1">{value}</div>
      {sub && <div className="gecko-stat-block-sub gecko-mt-1">{sub}</div>}
    </div>
  );
}

export function FormSection({ title, desc, children, cols = 2 }: any) {
  const colsClass = cols === 1 ? 'gecko-form-section-cols-1'
                  : cols === 3 ? 'gecko-form-section-cols-3'
                  : 'gecko-form-section-cols-2';
  return (
    <div className="gecko-form-section">
      <div>
        <div className="gecko-form-section-title">{title}</div>
        {desc && <div className="gecko-form-section-desc">{desc}</div>}
      </div>
      <div className={`gecko-form-section-fields ${colsClass}`}>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, children, span, helper }: any) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label ${required ? 'gecko-label-required' : ''}`}>{label}</label>
      {children}
      {helper && <div className="gecko-helper-text">{helper}</div>}
    </div>
  );
}
