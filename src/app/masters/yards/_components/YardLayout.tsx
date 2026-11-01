"use client";
import React, { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { withVersion } from '@/lib/api/lookups';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { BLOCK_TYPES, generateYardSlots } from '@/lib/api/yard-map';
import { typeLabel } from '@/components/yard/block-style';
import type { Yard } from '@/lib/api/yards';
import { EditableTable } from '../../lookups/_components/EditableTable';

interface Block {
  yardBlockId?: string;
  yardId?: string;
  blockCode: string;
  blockType: string | null;
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
/** The eight values org.yard_block.block_type allows; blank is allowed too. */
const TYPES = BLOCK_TYPES.map(v => ({ value: v, label: typeLabel(v) }));

/**
 * A yard's blocks and a block's rows (Tier 3), as a table.
 *
 * THE SAME BLOCK RECORDS THE MAP DRAWS. Configuration — Yard Zones & Blocks puts
 * these rows on a canvas and colours them by type; this table is where every
 * field can be set at once, and where a depot without the yard map still works
 * — KORAKIT locates boxes at yard level and has no blocks at all. Slots are a
 * count and a button: row × bay × tier is generated, never typed.
 */
export function YardLayout({ yards, canManage }: { yards: Yard[]; canManage: boolean }) {
  const { toast } = useToast();
  const [yardPicked, setYardPicked] = useState('');
  const yardId = yardPicked || yards[0]?.yardId || '';
  const blocks = useApi<Block[]>(yardId ? `/api/master/yards/${yardId}/blocks` : null);
  const [blockPicked, setBlockPicked] = useState('');
  const block = (blocks.data ?? []).find(b => b.yardBlockId === blockPicked) ?? blocks.data?.[0];
  const rows = useApi<Row[]>(block?.yardBlockId ? `/api/master/yard-blocks/${block.yardBlockId}/rows` : null);

  /**
   * Make the block's rows (A, B, C… up to its row count) and then its
   * row × bay × tier slots. Safe to press twice: it adds only what is missing,
   * and it says what it made rather than leaving the clerk to re-read the row.
   */
  const generate = async (b: Block) => {
    if (!b.yardBlockId) return;
    try {
      const made = await generateYardSlots(b.yardBlockId);
      toast({
        variant: 'success',
        title: `Made ${made.rowsCreated} rows and ${made.slotsCreated} slots · ${made.slotCount} in all`,
        message: made.slotsOutsideLayout > 0
          ? `${made.slotsOutsideLayout} older slots are outside the new size and were kept.`
          : undefined,
      });
      blocks.reload();
      rows.reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({ variant: 'danger', title: `Block ${b.blockCode}: no slots were made`, message: err.explanation ?? err.message });
    }
  };

  if (yards.length === 0) return null;
  return (
    <div className="gecko-stack gecko-stack-xl">
      <div className="gecko-stack gecko-stack-md">
        <div className="gecko-eyebrow">Layout — blocks</div>
        <EditableTable<Block>
          columns={[
            { key: 'blockCode', label: 'Block', kind: 'code', required: true, maxLength: 20, width: 90 },
            { key: 'blockType', label: 'Type', kind: 'select', options: TYPES, width: 120, hint: 'What the block is for; blank for untyped' },
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
          blank={() => ({ blockCode: '', blockType: null, maxRows: null, maxBays: null, maxTiers: null, allocatedToPartyCode: null, allocatedSizeFt: null, isReeferBlock: false, isDgBlock: false, isOogBlock: false, displayColorHex: null, isActive: true })}
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
          rowActions={b => (
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              disabled={b.maxBays === null || b.maxTiers === null || !b.isActive}
              title={b.maxBays === null || b.maxTiers === null ? 'Set bays and tiers first' : 'Make this block’s rows and slots'}
              onClick={() => void generate(b)}
            >
              <Icon name="grid" size={13} />Slots
            </button>
          )}
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
          note="A depot that locates boxes by area needs no blocks; one with the yard map draws them in Configuration — Yard Zones & Blocks. Rows × bays × tiers is the block's size; Generate slots makes the slots themselves."
        />
      </div>

      {block?.yardBlockId && (
        <div className="gecko-stack gecko-stack-md">
          <div className="gecko-eyebrow">Layout — rows of block {block.blockCode}</div>
          <EditableTable<Row>
            columns={[
              { key: 'rowLabel', label: 'Row', kind: 'code', required: true, maxLength: 10, width: 80 },
              { key: 'descriptionEn', label: 'Description', kind: 'text', maxLength: 100 },
              { key: 'isReeferRow', label: 'Reefer', kind: 'bool', width: 60, hint: 'Slots generated for this row get a plug; a full reefer needs one (REEFER_PLUG)' },
              { key: 'reeferPlugCount', label: 'Plugs', kind: 'number', min: 0, max: 1000, width: 70 },
              { key: 'isOogRow', label: 'OOG', kind: 'bool', width: 50, hint: 'Lets an out-of-gauge box stand in this row even when the block is not an OOG block (OOG_BLOCK)' },
              { key: 'isBlocked', label: 'Blocked', kind: 'bool', width: 70, hint: 'No box may be put in this row’s slots — nobody can override that' },
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
