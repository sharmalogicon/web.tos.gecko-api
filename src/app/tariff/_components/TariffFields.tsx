"use client";
import React from 'react';
import type { CodeOption } from '@/lib/api/tariff-catalogs';

/**
 * A code picker reading "CODE - description".
 *
 * The code alone is not a choice anyone can make: "FC", "G01", "LF" and "LT"
 * tell a new clerk nothing, and the description was hidden in a title attribute
 * that a mouse has to hover and a keyboard can never reach. Where a list has no
 * real description (bill-to roles, whose label IS the code) the code stands
 * alone rather than repeating itself.
 */
export function CodeSelect({ value, options, onChange, placeholder, required, error }: {
  value: string;
  options: { code: string; label: string }[] | CodeOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  const opts = options as { code: string; label: string }[];
  return (
    <>
      <select className={`gecko-input ${error ? 'gecko-input-error' : ''}`} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder ?? (required ? '—' : 'any')}</option>
        {opts.map(o => (
          <option key={o.code} value={o.code} title={o.label}>
            {o.label && o.label !== o.code ? `${o.code} - ${o.label}` : o.code}
          </option>
        ))}
      </select>
      {error && <div className="gecko-field-error">{error}</div>}
    </>
  );
}

/** A short fixed list where "blank" means "applies to all of them". */
export function Pick({ value, options, onChange, anyLabel = 'any', error }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  anyLabel?: string;
  error?: string;
}) {
  return (
    <>
      <select className={`gecko-input ${error ? 'gecko-input-error' : ''}`} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <div className="gecko-field-error">{error}</div>}
    </>
  );
}

export function Labelled({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
      {hint && !error && <div className="gecko-cell-meta">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
