"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

export type FilterField =
  | { type: 'search'; key: string; placeholder: string }
  | { type: 'select'; key: string; label: string; options: { label: string; value: string }[] }

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
}

export function FilterPopover({
  fields, values, onChange, onApply, onClear,
  sortOptions, sortValue, onSortChange,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeCount = fields.filter(f => (values[f.key] ?? '') !== '').length;
  const searchField = fields.find(f => f.type === 'search');
  const selectFields = fields.filter(f => f.type === 'select') as Extract<FilterField, { type: 'select' }>[];

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

  return (
    <div ref={wrapperRef} className="gecko-filter-trigger">
      {/* Trigger */}
      <button
        className={`gecko-btn gecko-btn-sm ${activeCount > 0 ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="filter" size={13} />
        {activeCount > 0 ? `Filter · ${activeCount}` : 'Filter'}
      </button>

      {open && (
        <div className="gecko-filter-panel">

          {/* Search */}
          {searchField && (
            <div className="gecko-filter-search-wrap">
              <div style={{ position: 'relative' }}>
                <Icon
                  name="search"
                  size={13}
                  style={{ position: 'absolute', left: 9, top: 8, color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }}
                />
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
          {selectFields.length > 0 && (
            <>
              <div className="gecko-filter-section-label">Filter by</div>
              <div className="gecko-filter-body">
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
              </div>
            </>
          )}

          {/* Sort By */}
          {sortOptions && sortOptions.length > 0 && (
            <>
              <div className="gecko-filter-divider" />
              <div className="gecko-filter-section-label">Sort by</div>
              <div style={{ paddingBottom: 4 }}>
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onSortChange?.(opt.value)}
                    className={`gecko-filter-sort-row${sortValue === opt.value ? ' gecko-filter-sort-row-active' : ''}`}
                  >
                    <span>{opt.label}</span>
                    {sortValue === opt.value && <Icon name="check" size={13} style={{ color: 'var(--gecko-primary-600)' }} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="gecko-filter-footer">
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}
              onClick={onClear}
            >
              Clear all
            </button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              style={{ fontSize: 11 }}
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
