"use client";
import React, { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { CODE_LISTS_PATH, codePath, deleteCodeValue, saveCodeValue, type CodeListCategory, type CodeListValue } from '@/lib/api/lookups';
import { EditableTable } from './EditableTable';

/** Where a value comes from: the platform's list, the tenant's change to it, or the tenant alone. */
function Source({ v }: { v: CodeListValue }) {
  if (v.isTenantDefined) return <span className="gecko-badge gecko-badge-xs gecko-badge-info">Tenant</span>;
  if (v.rowVersion) return <span className="gecko-badge gecko-badge-xs gecko-badge-warning" title="This tenant renamed or hid a global value">Override</span>;
  return <span className="gecko-badge gecko-badge-xs gecko-badge-gray">Global</span>;
}

/**
 * Code lists (#8). Categories come from the API. A GLOBAL value can be renamed
 * or hidden (that writes this tenant's override; removing it restores the
 * global one). A CLOSED category — one the platform branches on — takes no new
 * values; an open one does.
 */
export function CodeListsTab() {
  const { can } = useSession();
  const canManage = can('mdm.config.manage');
  const { data: categories, error: categoriesError } = useApi<CodeListCategory[]>(CODE_LISTS_PATH);
  const [picked, setPicked] = useState<string>('');
  const category = picked || categories?.[0]?.categoryCode || '';
  const meta = categories?.find(c => c.categoryCode === category);
  const { data, error, loading, reload } = useApi<CodeListValue[]>(category ? `${codePath(CODE_LISTS_PATH, category)}?includeInactive=true` : null);

  return (
    <EditableTable<CodeListValue>
      columns={[
        { key: 'code', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 40, width: 160 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
        { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 200 },
        { key: 'isoCode', label: 'ISO / external', kind: 'code', maxLength: 20, width: 110 },
        { key: 'sortOrder', label: 'Order', kind: 'number', required: true, min: 0, max: 9999, width: 80 },
        { key: 'isActive', label: 'Active', kind: 'bool', width: 64 },
        { key: 'isTenantDefined', label: 'Source', kind: 'bool', width: 80, render: v => <Source v={v} />, editableWhen: () => false },
      ]}
      rows={data}
      loading={loading}
      error={categoriesError ?? error}
      rowKey={v => v.code}
      blank={meta?.allowsTenantValues ? () => ({
        categoryCode: category, code: '', descriptionEn: '', descriptionLocal: null, isoCode: null,
        sortOrder: 100, isActive: true, isTenantDefined: true, rowVersion: null,
      }) : undefined}
      canManage={canManage}
      noun="Value"
      searchText={v => `${v.code} ${v.descriptionEn} ${v.descriptionLocal ?? ''}`}
      onSave={async draft => { await saveCodeValue({ ...draft, categoryCode: category }); reload(); }}
      // Only the tenant's own row can go: a value it added, or its override of a global one.
      onDelete={async v => { await deleteCodeValue(v); reload(); }}
      cannotDelete={v => (v.rowVersion ? null : 'A global value cannot be deleted — clear Active to hide it.')}
      deleteLabel={v => (v.isTenantDefined ? 'Delete' : 'Remove override of')}
      deleteMessage={v => v.isTenantDefined
        ? 'The value disappears from this tenant\'s list. Records that already carry it keep the code.'
        : 'The global value comes back as the platform ships it (name, order and active).'}
      note={meta && (
        <>
          <strong>{meta.descriptionEn}</strong> · {meta.owningModule} ·{' '}
          {meta.allowsTenantValues
            ? 'open — you can add your own values.'
            : 'closed — the platform acts on these values, so none can be added; you can rename or hide them.'}
        </>
      )}
      toolbar={
        <select className="gecko-input" style={{ width: 260 }} value={category} aria-label="Code list"
          onChange={e => setPicked(e.target.value)}>
          {(categories ?? []).map(c => (
            <option key={c.categoryCode} value={c.categoryCode}>
              {c.categoryCode} ({c.valueCount}){c.allowsTenantValues ? '' : ' · closed'}
            </option>
          ))}
        </select>
      }
    />
  );
}
