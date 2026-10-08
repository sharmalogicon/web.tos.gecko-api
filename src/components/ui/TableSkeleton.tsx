"use client";
import React from 'react';

/**
 * A table waiting for its rows.
 *
 * "Loading…" on one line tells the reader nothing about how much is coming, and
 * on a slow list it reads as a screen that has stopped. Rows in the shape of the
 * real ones say "data, shortly", and the table does not jump when they arrive.
 *
 * The widths vary per column so it looks like content rather than a grid of
 * identical bars — the first column is wide because it is usually the
 * identifier, the last narrow because it is usually a date or a chip.
 */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  // Deterministic, not random: a skeleton that reshuffles on every render
  // flickers, and this renders on every keystroke of a search box.
  const width = (col: number) => {
    const pattern = [82, 64, 48, 70, 56, 44, 60, 52, 38, 46];
    return `${pattern[col % pattern.length]}%`;
  };

  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="gecko-skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c}>
              <div className="gecko-skeleton gecko-skeleton-cell" style={{ width: width(c + r) }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
