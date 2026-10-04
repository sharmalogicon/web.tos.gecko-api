"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { newFreeTime, type FreeTimeDraft } from './tariff-drafts';

/**
 * Storage free days, as the depot has always written them.
 *
 * Vector's Customer Rate Profile puts these in one small grid beside the
 * header — FULL as direction x cargo, EMPTY as two numbers — and the clerks
 * read it that way. Our model is more general (any kind, any direction, any
 * cargo group, optionally a size), which is why this used to be a table with
 * an "Add rule" button. In KORAKIT's eleven migrated tariffs that table holds
 * ZERO rows in every single one: a general editor for something nobody enters
 * row by row.
 *
 * So the eight combinations Vector exposes get the grid, and anything outside
 * it — a different kind, a size-specific rule, LOCAL — is kept untouched and
 * listed underneath. Nothing the model can express is lost; the common shape
 * is simply the one you can fill in without thinking.
 */

const CARGO = [
  { code: 'NORMAL', label: 'Normal' },
  { code: 'REEFER', label: 'Reefer' },
  { code: 'DG', label: 'DG' },
] as const;

/** A matrix cell is a STORAGE rule with no size: that is what the grid can show. */
const isMatrixRule = (r: FreeTimeDraft): boolean =>
  r.freeTimeKind === 'STORAGE'
  && r.equipmentSize === ''
  && ((r.fullEmpty === 'FULL' && (r.direction === 'EXPORT' || r.direction === 'IMPORT')
       && CARGO.some(c => c.code === r.cargoGroup))
    || (r.fullEmpty === 'EMPTY' && r.direction === ''
       && (r.cargoGroup === 'NORMAL' || r.cargoGroup === 'REEFER')));

export function FreeTimeMatrix({ rules, onChange, readOnly = false, error }: {
  rules: FreeTimeDraft[];
  onChange?: (rules: FreeTimeDraft[]) => void;
  readOnly?: boolean;
  error?: string | null;
}) {
  const others = rules.filter(r => !isMatrixRule(r));

  const find = (fullEmpty: string, direction: string, cargoGroup: string) =>
    rules.find(r => isMatrixRule(r) && r.fullEmpty === fullEmpty && r.direction === direction && r.cargoGroup === cargoGroup);

  const valueOf = (fullEmpty: string, direction: string, cargoGroup: string) =>
    find(fullEmpty, direction, cargoGroup)?.freeUnits ?? '';

  /** Empty means "no rule", not "zero days" — so clearing a cell drops the row. */
  function setCell(fullEmpty: string, direction: string, cargoGroup: string, raw: string) {
    if (!onChange) return;
    const text = raw.trim();
    const existing = find(fullEmpty, direction, cargoGroup);
    if (text === '') {
      onChange(existing ? rules.filter(r => r.key !== existing.key) : rules);
      return;
    }
    onChange(existing
      ? rules.map(r => (r.key === existing.key ? { ...r, freeUnits: text } : r))
      : [...rules, newFreeTime({ fullEmpty, direction, cargoGroup, freeUnits: text })]);
  }

  const cell = (fullEmpty: string, direction: string, cargoGroup: string) => (
    <td key={`${fullEmpty}-${direction}-${cargoGroup}`}>
      {readOnly ? (
        <span className="gecko-freetime-read">{valueOf(fullEmpty, direction, cargoGroup) || '—'}</span>
      ) : (
        <input
          className="gecko-input gecko-freetime-input"
          type="number" min={0} max={3650} placeholder="0"
          aria-label={`${fullEmpty} ${direction || 'any direction'} ${cargoGroup} free days`}
          value={valueOf(fullEmpty, direction, cargoGroup)}
          onChange={e => setCell(fullEmpty, direction, cargoGroup, e.target.value)} />
      )}
    </td>
  );

  return (
    <div className="gecko-stack-sm">
      {error && <div className="gecko-field-error">{error}</div>}

      <table className="gecko-freetime-grid">
        <thead>
          <tr>
            <th className="gecko-freetime-corner">Full</th>
            {CARGO.map(c => <th key={c.code}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {['EXPORT', 'IMPORT'].map(dir => (
            <tr key={dir}>
              <th>{dir === 'EXPORT' ? 'Export' : 'Import'}</th>
              {CARGO.map(c => cell('FULL', dir, c.code))}
            </tr>
          ))}
          <tr>
            <th className="gecko-freetime-corner">Empty</th>
            {cell('EMPTY', '', 'NORMAL')}
            {cell('EMPTY', '', 'REEFER')}
            <td />
          </tr>
        </tbody>
      </table>

      <div className="gecko-cell-meta">
        Days free of storage. Free days come off before the tiers are counted, so 3 free days
        against a 1&ndash;7 tier prices calendar days 4&ndash;10 at tier 1. Blank follows the public tariff.
      </div>

      {others.length > 0 && (
        <div className="gecko-stack-sm">
          <div className="gecko-row" style={{ gap: 6 }}>
            <Icon name="info" size={13} />
            <span className="gecko-cell-meta gecko-flex-1">
              {others.length} rule{others.length === 1 ? '' : 's'} outside this grid &mdash; kept as {others.length === 1 ? 'it is' : 'they are'}.
            </span>
          </div>
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr><th>Kind</th><th>Full/empty</th><th>Direction</th><th>Cargo</th><th>Size</th><th>Free</th>{!readOnly && <th />}</tr>
            </thead>
            <tbody>
              {others.map(r => (
                <tr key={r.key}>
                  <td className="gecko-mono-strong">{r.freeTimeKind}</td>
                  <td>{r.fullEmpty || 'any'}</td>
                  <td>{r.direction || 'any'}</td>
                  <td>{r.cargoGroup || 'any'}</td>
                  <td>{r.equipmentSize || 'any'}</td>
                  <td>{r.freeUnits}</td>
                  {!readOnly && (
                    <td>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove rule"
                        onClick={() => onChange?.(rules.filter(x => x.key !== r.key))}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
