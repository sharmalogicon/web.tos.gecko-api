"use client";
import React, { useEffect, useState } from 'react';
import { TablePagination } from '@/components/ui/TablePagination';
import { useApi, type Paged } from './use-api';

/** Waits until typing pauses, so each keystroke is not a query. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * A paged master read from the API with server-side search: the search box
 * state, the page, and the pagination footer. `params` are extra query
 * parameters (filters); a change of search or filters starts again at page 1.
 */
export function useServerList<T>(basePath: string, params: Record<string, string | boolean | undefined>, noun: string) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);            // 0-based, as TablePagination counts
  const [pageSize, setPageSize] = useState(50);
  const debounced = useDebounced(search);

  const q = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
  if (debounced.trim()) q.set('search', debounced.trim());
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const filterKey = `${debounced}|${JSON.stringify(params)}`;

  // A new search or filter belongs to page 1: remember which one the page is for.
  const [pageFor, setPageFor] = useState(filterKey);
  if (pageFor !== filterKey) {
    setPageFor(filterKey);
    setPage(0);
  }

  const resource = useApi<Paged<T>>(`${basePath}?${q.toString()}`);
  const total = resource.data?.totalCount ?? 0;
  const footer = (
    <TablePagination
      page={page} pageSize={pageSize} totalItems={total}
      totalPages={Math.max(1, Math.ceil(total / pageSize))}
      startRow={total === 0 ? 0 : page * pageSize + 1} endRow={Math.min(total, (page + 1) * pageSize)}
      onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(0); }}
      pageSizeOptions={[20, 50, 100]} noun={noun}
    />
  );
  return { ...resource, rows: resource.data?.items ?? null, total, search, setSearch, footer };
}
