import React from 'react';
import { Icon } from './Icon';

export function PageToolbar({ title, subtitle, badges = [], actions }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
          {badges.map((b: any, i: number) => (
            <span key={i} className={`gecko-badge gecko-badge-${b.kind || 'gray'}`} style={{ fontSize: 10 }}>{b.label}</span>
          ))}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function FilterBar({ filters = [], onSearch, searchPlaceholder = 'Search…', right }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
        <input className="gecko-input gecko-input-sm" placeholder={searchPlaceholder} style={{ paddingLeft: 32, height: 32 }} />
      </div>
      {filters.map((f: any, i: number) => (
        <button key={i} className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ height: 32, fontSize: 12, fontWeight: 500 }}>
          {f.icon && <Icon name={f.icon} size={12} />}
          <span style={{ color: 'var(--gecko-text-secondary)' }}>{f.label}:</span>
          <span style={{ fontWeight: 600 }}>{f.value}</span>
          <Icon name="chevronDown" size={11} style={{ opacity: 0.6 }} />
        </button>
      ))}
      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ height: 32, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
        <Icon name="plus" size={12} /> Add filter
      </button>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{right}</div>}
    </div>
  );
}

export function StatusDot({ kind = 'success' }: { kind?: string }) {
  const c: any = { success: 'var(--gecko-success-500)', warning: 'var(--gecko-warning-500)', error: 'var(--gecko-error-500)', info: 'var(--gecko-info-500)', gray: 'var(--gecko-gray-400)' }[kind];
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 6, flexShrink: 0 }} />;
}

export function Stat({ label, value, sub, align = 'left' }: any) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function FormSection({ title, desc, children, cols = 2 }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, paddingBottom: 24, borderBottom: '1px solid var(--gecko-border)', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
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
