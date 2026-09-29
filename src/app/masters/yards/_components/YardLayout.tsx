"use client";
import React, { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { withVersion } from '@/lib/api/lookups';
import type { Yard } from '@/lib/api/yards';
import { EditableTable } from '../../lookups/_components/EditableTable';

interface Block {
  yardBlockId?: string;
  yardId?: string;
  blockCode: string;
  maxRows: number | null;
  maxBays: number | null;
  maxTiers: number | null;
  allocatedToPartyCode: string | null;
  allocatedSizeFt: number | null;
  isReeferBlock: boolean;
  isDgBlock: boolean;
  isOogBlock: boolean;
  displayColorHex: string | null;
  isActive: boolean;
  rowCount?: number;
  slotCount?: number;
  rowVersion?: string;
}

interface Row {
  yardRowId?: string;
  rowLabel: string;
  descriptionEn: string | null;
  isReeferRow: boolean;
  isOogRow: boolean;
  reeferPlugCount: number | null;
  isBlocked: boolean;
  isActive: boolean;
  slotCount?: number;
  rowVersion?: string;
}

const SIZES = [20, 40, 45].map(v => ({ value: String(v), label: `${v}'` }));

/**
 * A yard's blocks and a block's rows (Tier 3). Slots are shown as a count only.
 * KORAKIT locates boxes at yard level, so its yards have no blocks — this is
 * for a depot that stacks by block and row.
 */
export function YardLayout({ yards, canManage }: { yards: Yard[]; canManage: boolean }) {
  const [yardPicked, setYardPicked] = useState('');
  const yardId = yardPicked || yards[0]?.yardId || '';
  const blocks = useApi<Block[]>(yardId ? `/api/master/yards/${yardId}/blocks` : null);
  const [blockPicked, setBlockPicked] = useState('');
  const block = (blocks.data ?? []).find(b => b.yardBlockId === blockPicked) ?? blocks.data?.[0];
  const rows = useApi<Row[]>(block?.yardBlockId ? `/api/master/yard-blocks/${block.yardBlockId}/rows` : null);

  if (yards.length === 0) return null;
  return (
    <div className="gecko-stack gecko-stack-xl">
      <div className="gecko-stack gecko-stack-md">
        <div className="gecko-eyebrow">Layout — blocks</div>
        <EditableTable<Block>
          columns={[
            { key: 'blockCode', label: 'Block', kind: 'code', required: true, maxLength: 20, width: 90 },
            { key: 'maxRows', label: 'Rows', kind: 'number', min: 1, max: 255, width: 70 },
            { key: 'maxBays', label: 'Bays', kind: 'number', min: 1, max: 255, width: 70 },
            { key: 'maxTiers', label: 'Tiers', kind: 'number', min: 1, max: 255, width: 70 },
            { key: 'allocatedToPartyCode', label: 'For party', kind: 'code', maxLength: 60, width: 110, hint: 'A line’s dedicated block' },
            { key: 'allocatedSizeFt', label: 'Size', kind: 'select', options: SIZES, width: 80 },
            { key: 'isReeferBlock', label: 'Reefer', kind: 'bool', width: 60 },
            { key: 'isDgBlock', label: 'DG', kind: 'bool', width: 50 },
            { key: 'isOogBlock', label: 'OOG', kind: 'bool', width: 50 },
            { key: 'displayColorHex', label: 'Colour', kind: 'code', maxLength: 7, width: 90, hint: '#RRGGBB' },
            { key: 'rowCount', label: 'Rows made', kind: 'number', width: 80, editableWhen: () => false },
            { key: 'slotCount', label: 'Slots', kind: 'number', width: 70, editableWhen: () => false },
            { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
          ]}
          rows={blocks.data}
          loading={blocks.loading}
          error={blocks.error}
          rowKey={b => b.yardBlockId ?? b.blockCode}
          blank={() => ({ blockCode: '', maxRows: null, maxBays: null, maxTiers: null, allocatedToPartyCode: null, allocatedSizeFt: null, isReeferBlock: false, isDgBlock: false, isOogBlock: false, displayColorHex: null, isActive: true })}
          canManage={canManage}
          noun="Block"
          searchText={b => b.blockCode}
          onSave={async draft => {
            const body = { ...draft, allocatedSizeFt: draft.allocatedSizeFt ? Number(draft.allocatedSizeFt) : null };
            await (draft.yardBlockId
              ? apiSend('PUT', `/api/master/yard-blocks/${draft.yardBlockId}`, body)
              : apiSend('POST', `/api/master/yards/${yardId}/blocks`, body));
            blocks.reload();
          }}
          onDelete={async b => { await apiSend('DELETE', withVersion(`/api/master/yard-blocks/${b.yardBlockId}`, b.rowVersion!)); blocks.reload(); }}
          cannotDelete={b => ((b.rowCount ?? 0) > 0 || (b.slotCount ?? 0) > 0 ? 'Delete its rows first' : null)}
          toolbar={
            <>
              <select className="gecko-input" style={{ width: 200 }} value={yardId} aria-label="Yard" onChange={e => { setYardPicked(e.target.value); setBlockPicked(''); }}>
                {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
              </select>
              {(blocks.data ?? []).length > 0 && (
                <select className="gecko-input" style={{ width: 160 }} value={block?.yardBlockId ?? ''} aria-label="Block for rows" onChange={e => setBlockPicked(e.target.value)}>
                  {(blocks.data ?? []).map(b => <option key={b.yardBlockId} value={b.yardBlockId}>Rows of {b.blockCode}</option>)}
                </select>
              )}
            </>
          }
          note="Blocks inside the yard, and how many rows × bays × tiers each takes. A depot that locates boxes at yard level (KORAKIT) needs none."
        />
      </div>

      {block?.yardBlockId && (
        <div className="gecko-stack gecko-stack-md">
          <div className="gecko-eyebrow">Layout — rows of block {block.blockCode}</div>
          <EditableTable<Row>
            columns={[
              { key: 'rowLabel', label: 'Row', kind: 'code', required: true, maxLength: 10, width: 80 },
              { key: 'descriptionEn', label: 'Description', kind: 'text', maxLength: 100 },
              { key: 'isReeferRow', label: 'Reefer', kind: 'bool', width: 60 },
              { key: 'reeferPlugCount', label: 'Plugs', kind: 'number', min: 0, max: 1000, width: 70 },
              { key: 'isOogRow', label: 'OOG', kind: 'bool', width: 50 },
              { key: 'isBlocked', label: 'Blocked', kind: 'bool', width: 70 },
              { key: 'slotCount', label: 'Slots', kind: 'number', width: 70, editableWhen: () => false },
              { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
            ]}
            rows={rows.data}
            loading={rows.loading}
            error={rows.error}
            rowKey={r => r.yardRowId ?? r.rowLabel}
            blank={() => ({ rowLabel: '', descriptionEn: null, isReeferRow: false, isOogRow: false, reeferPlugCount: null, isBlocked: false, isActive: true })}
            canManage={canManage}
            noun="Row"
            searchText={r => `${r.rowLabel} ${r.descriptionEn ?? ''}`}
            onSave={async draft => {
              await (draft.yardRowId
                ? apiSend('PUT', `/api/master/yard-rows/${draft.yardRowId}`, draft)
                : apiSend('POST', `/api/master/yard-blocks/${block.yardBlockId}/rows`, draft));
              rows.reload(); blocks.reload();
            }}
            onDelete={async r => { await apiSend('DELETE', withVersion(`/api/master/yard-rows/${r.yardRowId}`, r.rowVersion!)); rows.reload(); blocks.reload(); }}
            cannotDelete={r => ((r.slotCount ?? 0) > 0 ? 'It has slots' : null)}
          />
        </div>
      )}
    </div>
  );
}
