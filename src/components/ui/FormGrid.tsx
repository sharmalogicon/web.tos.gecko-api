"use client";
import React from 'react';

// ─── FormGrid ─────────────────────────────────────────────────────────────────

interface FormGridProps {
  /** Number of equal-width columns (1–4). Collapses to 1 column on tablets. */
  columns?: 1 | 2 | 3 | 4;
  /** Extra class on the grid container. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Responsive form grid. Columns collapse to 1 on screens ≤ 900px.
 * Use <Field> children inside, or any element with .gecko-form-group.
 *
 *   <FormGrid columns={2}>
 *     <Field label="Code" required>...</Field>
 *     <Field label="Name" required>...</Field>
 *     <Field label="Description" full>...</Field>
 *   </FormGrid>
 */
export function FormGrid({ columns = 2, className = '', children }: FormGridProps) {
  const cls = columns > 1 ? `gecko-form-grid gecko-form-grid-${columns}` : 'gecko-form-grid';
  return <div className={`${cls} ${className}`.trim()}>{children}</div>;
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  /** Visible label above the input. Omit for unlabelled fields. */
  label?: React.ReactNode;
  /** Show the red asterisk after the label. */
  required?: boolean;
  /** Faint helper text below the input (max-line one-liners work best). */
  helper?: React.ReactNode;
  /** Validation error text. When present, helper is hidden. */
  error?: React.ReactNode;
  /** Span the entire row regardless of FormGrid column count. */
  full?: boolean;
  /** Span exactly two columns in a 3 / 4 column grid. */
  span2?: boolean;
  /** id attribute to associate label with the input. */
  htmlFor?: string;
  className?: string;
  /** The actual input/select/textarea element(s). */
  children: React.ReactNode;
}

/**
 * Wraps a single labelled form control. Use inside <FormGrid>.
 * Standardises the label / required marker / helper / error UX.
 */
export function Field({
  label,
  required,
  helper,
  error,
  full,
  span2,
  htmlFor,
  className = '',
  children,
}: FieldProps) {
  const groupCls = [
    'gecko-form-group',
    full && 'gecko-form-group-full',
    span2 && 'gecko-form-group-span-2',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={groupCls}>
      {label && (
        <label className={`gecko-label ${required ? 'gecko-label-required' : ''}`.trim()} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <div className="gecko-field-error">{error}</div>
      ) : helper ? (
        <div className="gecko-field-helper">{helper}</div>
      ) : null}
    </div>
  );
}
