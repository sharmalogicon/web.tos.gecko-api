"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePagination<T>(items: T[], defaultPageSize = 10) {
  const [page, setPage]           = useState(0);
  const [pageSize, setPageSize]   = useState(defaultPageSize);

  // Auto-reset to page 0 whenever filtered item count changes
  const prevLen = useRef(items.length);
  useEffect(() => {
    if (items.length !== prevLen.current) {
      setPage(0);
      prevLen.current = items.length;
    }
  }, [items.length]);

  const totalPages  = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage    = Math.min(page, totalPages - 1);
  const startIndex  = safePage * pageSize;
  const endIndex    = Math.min(startIndex + pageSize, items.length);

  return {
    page:        safePage,
    setPage,
    pageSize,
    setPageSize: (s: number) => { setPageSize(s); setPage(0); },
    totalPages,
    pageItems:   items.slice(startIndex, endIndex),
    totalItems:  items.length,
    startRow:    items.length === 0 ? 0 : startIndex + 1,
    endRow:      endIndex,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TablePaginationProps {
  page:            number;
  pageSize:        number;
  totalItems:      number;
  totalPages:      number;
  startRow:        number;
  endRow:          number;
  onPageChange:    (p: number) => void;
  onPageSizeChange:(s: number) => void;
  pageSizeOptions?: number[];
  noun?:           string;   // e.g. "countries", "ports" — shown in "X records" label
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  startRow,
  endRow,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  noun = 'records',
}: TablePaginationProps) {

  // Build page number list with ellipsis
  const pageNums: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(0);
    if (page > 2)          pageNums.push('…');
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pageNums.push(i);
    if (page < totalPages - 3) pageNums.push('…');
    pageNums.push(totalPages - 1);
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 28, minWidth: 28, padding: '0 6px', borderRadius: 6,
    border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--gecko-font-mono)',
    color: 'var(--gecko-text-primary)', transition: 'background 120ms, border-color 120ms',
    lineHeight: 1,
  };
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--gecko-primary-600)',
    borderColor: 'var(--gecko-primary-600)',
    color: '#fff',
    fontWeight: 700,
  };
  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    opacity: 0.35,
    cursor: 'not-allowed',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px',
      borderTop: '1px solid var(--gecko-border)',
      background: 'var(--gecko-bg-subtle)',
      flexWrap: 'wrap', gap: 8,
    }}>

      {/* Left: showing X–Y of Z */}
      <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>
        {totalItems === 0
          ? <span>No {noun} found</span>
          : <>Showing <strong style={{ color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{startRow}–{endRow}</strong> of <strong style={{ color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{totalItems.toLocaleString()}</strong> {noun}</>
        }
      </div>

      {/* Center: page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {/* First */}
        <button
          style={page === 0 ? btnDisabled : btnBase}
          disabled={page === 0}
          onClick={() => onPageChange(0)}
          title="First page"
        >
          <Icon name="chevronsLeft" size={12} />
        </button>
        {/* Prev */}
        <button
          style={page === 0 ? btnDisabled : btnBase}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          title="Previous page"
        >
          <Icon name="chevronLeft" size={12} />
        </button>

        {pageNums.map((n, i) =>
          n === '…'
            ? <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', padding: '0 2px' }}>…</span>
            : <button
                key={n}
                style={n === page ? btnActive : btnBase}
                onClick={() => onPageChange(n as number)}
              >
                {(n as number) + 1}
              </button>
        )}

        {/* Next */}
        <button
          style={page >= totalPages - 1 ? btnDisabled : btnBase}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          title="Next page"
        >
          <Icon name="chevronRight" size={12} />
        </button>
        {/* Last */}
        <button
          style={page >= totalPages - 1 ? btnDisabled : btnBase}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          title="Last page"
        >
          <Icon name="chevronsRight" size={12} />
        </button>
      </div>

      {/* Right: rows per page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          style={{
            height: 28, padding: '0 24px 0 8px', borderRadius: 6,
            border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)',
            fontSize: 12, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)',
            cursor: 'pointer', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
          }}
        >
          {pageSizeOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
