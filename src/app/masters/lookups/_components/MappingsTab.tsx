"use client";
import React, { useState } from 'react';
import { useApi, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { getParty } from '@/lib/api/parties';
import {
  CHANNELS, CODE_LISTS_PATH, CODE_MAPPINGS_PATH, MAPPING_DIRECTIONS, MAPPING_TYPES, deleteMapping, saveMapping,
  type CodeListCategory, type CodeMapping,
} from '@/lib/api/lookups';
import { EditableTable } from './EditableTable';

const PAGE = 200;

/**
 * Code mappings: how an outside spelling ("MTY IN", a partner's EDI code)
 * resolves to ours (MTY_IN). The API checks the internal code exists and that
 * an external code maps once. A partner mapping names the party by code here;
 * the API takes its id, so the code is looked up before saving.
 */
export function MappingsTab() {
  const { can } = useSession();
  const [type, setType] = useState('');
  const { data: categories } = useApi<CodeListCategory[]>(CODE_LISTS_PATH);
  const q = new URLSearchParams({ pageSize: String(PAGE) });
  if (type) q.set('mappingType', type);
  const { data, error, loading, reload } = useApi<Paged<CodeMapping>>(`${CODE_MAPPINGS_PATH}?${q}`);

  const save = async (draft: CodeMapping, original: CodeMapping | null) => {
    let partyId: string | null = null;
    const partyCode = draft.partyCode?.trim().toUpperCase() || null;
    if (partyCode) {
      if (partyCode === original?.partyCode) partyId = original.partyId;
      else {
        try { partyId = (await getParty(partyCode)).partyId; }
        catch { throw new ApiError(400, `There is no party '${partyCode}'.`, { partyCode: [`There is no party '${partyCode}'.`] }); }
      }
    }
    await saveMapping({
      ...draft,
      partyId,
      codeListCategory: draft.mappingType === 'CODE_LIST' ? draft.codeListCategory : null,
      externalCode: draft.externalCode.trim(),
      internalCode: draft.internalCode.trim(),
      description: draft.description?.trim() || null,
    });
    reload();
  };

  return (
    <EditableTable<CodeMapping>
      columns={[
        { key: 'mappingType', label: 'Maps a', kind: 'select', required: true, options: MAPPING_TYPES, width: 160 },
        {
          key: 'codeListCategory', label: 'Code list', kind: 'select', width: 160,
          options: (categories ?? []).map(c => ({ value: c.categoryCode, label: c.categoryCode })),
          editableWhen: d => d.mappingType === 'CODE_LIST',
        },
        { key: 'externalCode', label: 'Outside code', kind: 'code', required: true, maxLength: 50, width: 140 },
        { key: 'internalCode', label: 'Our code', kind: 'code', required: true, maxLength: 50, width: 140 },
        { key: 'channel', label: 'Channel', kind: 'select', required: true, options: CHANNELS, width: 140 },
        { key: 'direction', label: 'Direction', kind: 'select', required: true, options: MAPPING_DIRECTIONS, width: 110 },
        { key: 'partyCode', label: 'Partner', kind: 'code', maxLength: 60, width: 110, hint: 'Empty = every partner (tenant default)' },
        { key: 'description', label: 'Note', kind: 'text', maxLength: 200 },
        { key: 'isActive', label: 'Active', kind: 'bool', width: 64 },
      ]}
      rows={data?.items ?? null}
      loading={loading}
      error={error}
      rowKey={m => m.codeMappingId ?? `${m.mappingType}:${m.externalCode}`}
      blank={() => ({
        mappingType: type || 'CODE_LIST', codeListCategory: null, partyId: null, partyCode: null,
        channel: 'ANY', direction: 'INBOUND', externalCode: '', internalCode: '', description: null,
        validFrom: null, validTo: null, isActive: true,
      })}
      canManage={can('mdm.config.manage')}
      noun="Mapping"
      searchText={m => `${m.externalCode} ${m.internalCode} ${m.mappingType} ${m.codeListCategory ?? ''} ${m.partyCode ?? ''} ${m.description ?? ''}`}
      onSave={save}
      onDelete={async m => { await deleteMapping(m); reload(); }}
      deleteMessage={() => 'Inbound messages and uploads that spell the code this way stop resolving and are rejected, not guessed.'}
      note={data && data.totalCount > PAGE
        ? `Showing the first ${PAGE} of ${data.totalCount}. Pick a type to narrow the list.`
        : 'Resolution order for an inbound code: this partner\'s mapping, then the tenant default, then the global standard.'}
      toolbar={
        <select className="gecko-input" style={{ width: 200 }} value={type} aria-label="Mapping type" onChange={e => setType(e.target.value)}>
          <option value="">All types</option>
          {MAPPING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      }
    />
  );
}
