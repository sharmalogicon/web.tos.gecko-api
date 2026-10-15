"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PartyPicker } from '@/components/ui/PartyPicker';
import type { PartyRole } from '@/lib/api/parties';

export type FilterField =
  | { type: 'search'; key: string; placeholder: string }
  | { type: 'select'; key: string; label: string; options: { label: string; value: string }[] }
  /**
   * A plain date, for a range made of two of them. Added for the Container
   * Inquiry's gate-in range (2026-10-08): a register that reaches back years
   * needs a date before it needs another dropdown.
   */
  | { type: 'date'; key: string; label: string }
  /**
   * A party, SEARCHED rather than listed.
   *
   * A customer list is thousands long at a real depot, so a dropdown of the
   * first 200 is a dropdown that stops inside the A's (owner 2026-10-15).
   * Empty still means "all".
   */
  | { type: 'party'; key: string; label: string; role: PartyRole }

export type SortOption = { label: string; value: string }

export interface FilterPopoverProps {
  fields: FilterField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  onApply: (values: Record<string, string>) => void
  onClear: () => void
  sortOptions?: SortOption[]
  sortValue?: string
  onSortChange?: (value: string) => void
  /**
   * 'orange' when filtering is the screen's main view control rather than a
   * refinement of it — the booking statement opens filtered (amount > 0), so
   * the button has to announce that something is already being hidden.
   */
  tone?: 'default' | 'orange'
  /** Filters that are on by default and so should not be counted as "active". */
  defaultValues?: Record<string, string>
  /**
   * How many columns the fields sit in.
   *
   * Left alone it decides for itself: one column up to WIDE_AT fields, two
   * beyond. Most screens here filter on three or four things and read best as a
   * short list; the Container Inquiry has fourteen and the Booking Statement
   * eighteen, and as one column those run off the bottom of the screen.
   *
   * Pass it explicitly only to overrule that.
   */
  columns?: 1 | 2
}

/** Above this many selects and dates, the panel goes two-column and wide. */
const WIDE_AT = 8;

export function FilterPopover({
  fields, values, onChange, onApply, onClear,
  sortOptions, sortValue, onSortChange, tone = 'default', defaultValues, columns,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // A filter sitting at its default is not a filter the clerk set.
  const activeCount = fields.filter(f => {
    const v = values[f.key] ?? '';
    return v !== '' && v !== (defaultValues?.[f.key] ?? '');
  }).length;
  const searchField = fields.find(f => f.type === 'search');
  const selectFields = fields.filter(f => f.type === 'select') as Extract<FilterField, { type: 'select' }>[];
  const dateFields = fields.filter(f => f.type === 'date') as Extract<FilterField, { type: 'date' }>[];
  const partyFields = fields.filter(f => f.type === 'party') as Extract<FilterField, { type: 'party' }>[];
  const wide = (columns ?? (selectFields.length + dateFields.length + partyFields.length > WIDE_AT ? 2 : 1)) === 2;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  /**
   * A party field opens a search menu BELOW its input. The panel clips
   * (overflow:hidden, for its radius) and the wide body scrolls, so without
   * gecko-filter-panel-pickers that menu is cut off at the panel edge rather
   * than overlapping it — clipping, not stacking.
   */
  const panelClass = ['gecko-filter-panel',
    wide && 'gecko-filter-panel-wide',
    partyFields.length > 0 && 'gecko-filter-panel-pickers'].filter(Boolean).join(' ');

  return (
    <div ref={wrapperRef} className="gecko-filter-trigger">
      {/* Trigger */}
      <button
        className={`gecko-btn gecko-btn-sm ${tone === 'orange'
          ? 'gecko-btn-filter-orange'
          : activeCount > 0 ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="filter" size={13} />
        {activeCount > 0 ? `Filter · ${activeCount}` : 'Filter'}
      </button>

      {open && (
        <div className={panelClass}>

          {/* Search */}
          {searchField && (
            <div className="gecko-filter-search-wrap">
              <div>
                <Icon name="search" size={13} className="gecko-filter-search-icon" />
                <input
                  className="gecko-filter-input-sm"
                  placeholder={searchField.placeholder}
                  value={values[searchField.key] ?? ''}
                  onChange={e => onChange({ ...values, [searchField.key]: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Filter By */}
          {(selectFields.length > 0 || dateFields.length > 0 || partyFields.length > 0) && (
            <>
              <div className="gecko-filter-section-label">Filter by</div>
              {/* One column puts the label beside its control, which reads as a
                  list. Two columns put it ABOVE: the labels here run from
                  "Size" to "Gated in from", and side by side that leaves every
                  control starting at a different place and none of them the
                  same width. */}
              <div className={`gecko-filter-body${wide ? ' gecko-filter-body-wide' : ''}`}>
                {selectFields.map(field => (
                  <div key={field.key} className="gecko-filter-row">
                    <span className="gecko-filter-row-label">{field.label}</span>
                    <select
                      className={`gecko-filter-select${values[field.key] ? ' gecko-filter-select-active' : ''}`}
                      value={values[field.key] ?? ''}
                      onChange={e => onChange({ ...values, [field.key]: e.target.value })}
                    >
                      {field.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {/* The parties sit between the selects and the dates: each is one
                    field like any other, it just answers from the server as the
                    clerk types instead of from a list fetched up front. */}
                {partyFields.map(field => (
                  <div key={field.key} className="gecko-filter-row">
                    <span className="gecko-filter-row-label">{field.label}</span>
                    <PartyPicker role={field.role} value={values[field.key] || null} nameFirst
                      placeholder="All — type to search…"
                      onChange={code => onChange({ ...values, [field.key]: code ?? '' })} />
                  </div>
                ))}

                {/* Dates sit with the selects: they narrow the same list, and a
                    clerk reads them as one block of "what am I looking at".
                    A range is two fields, so in two columns it is given a whole
                    row to itself \u2014 "from" and "to" side by side. */}
                {dateFields.map(field => (
                  <div key={field.key} className="gecko-filter-row">
                    <span className="gecko-filter-row-label">{field.label}</span>
                    <input
                      type="date"
                      className={`gecko-filter-select${values[field.key] ? ' gecko-filter-select-active' : ''}`}
                      value={values[field.key] ?? ''}
                      onChange={e => onChange({ ...values, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Sort By */}
          {sortOptions && sortOptions.length > 0 && (
            <>
              <div className="gecko-filter-divider" />
              <div className="gecko-filter-section-label">Sort by</div>
              <div className="gecko-filter-sort-list">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onSortChange?.(opt.value)}
                    className={`gecko-filter-sort-row${sortValue === opt.value ? ' gecko-filter-sort-row-active' : ''}`}
                  >
                    <span>{opt.label}</span>
                    {sortValue === opt.value && <Icon name="check" size={13} className="gecko-filter-sort-tick" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="gecko-filter-footer">
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              onClick={onClear}
            >
              Clear all
            </button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={() => { onApply(values); setOpen(false); }}
            >
              Apply
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
