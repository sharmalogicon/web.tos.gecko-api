"use client";
import React from 'react';

/**
 * A labelled field that can show the server's own words.
 *
 * The shared `Field` in OpsPrimitives takes `helper` and has no error slot, so
 * a 400 keyed on a field had nowhere to land. Everything the gate POST refuses
 * comes back as `{ errors: { "<field>": ["message"] } }` with the field named
 * exactly — that message belongs under its own box, not in a banner at the top
 * of a form with thirty of them.
 */
export function GateField({ label, required, error, hint, frozen, span, children }: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Shown as fixed rather than offered and then refused. */
  frozen?: boolean;
  span?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="gecko-form-group" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>
        {label}
        {frozen && <span className="gecko-cell-meta gecko-gate-frozen">· fixed</span>}
      </label>
      {children}
      {hint && !error && <div className="gecko-helper-text">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
