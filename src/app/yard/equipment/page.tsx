"use client";
import React from 'react';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { YARD_MANAGE, useYardSettings } from '@/lib/api/yard-map';
import { MACHINE_KINDS, saveMachine, useYardEquipment, type HandlingEquipment } from '@/lib/api/yard-work';
import { EditableTable } from '../../masters/lookups/_components/EditableTable';
import { YardMapOff } from '@/components/yard/YardMapOff';

/** The lengths a machine can be limited to; blank means any. */
const SIZES = [20, 40, 45].map(v => ({ value: String(v), label: `${v}'` }));

/**
 * THE DEPOT'S MACHINES — what each one can lift, and how high.
 *
 * This is not an asset register: it is the reason a job can be refused. An
 * empty handler cannot pick up a laden box; a small forklift cannot reach the
 * fourth tier; a 20-foot machine cannot take a 40-foot box. The gate's yard
 * jobs ask the API to check the machine against the box and the tier, and the
 * refusal quotes these very fields — "EH-01 lifts empty boxes only", "FL-02
 * reaches tier 3". Everything here is therefore operational, not decorative.
 *
 * NO DELETE, ON PURPOSE. A machine that has done work is named in the history
 * of every job it did; removing the row would orphan that. A machine that has
 * left the depot is `isActive: false`, which stops it being picked for new work
 * and leaves what it did alone.
 *
 * Reading needs `tos.gate.view`; changing anything needs `tos.yard.manage` at
 * this depot, and without it the table is simply read-only.
 */
export default function YardEquipmentPage() {
  const { branch } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();
  const { canAt } = useSession();
  const branchId = branch?.branchId ?? null;
  const canManage = canAt(YARD_MANAGE, branchId);
  const machines = useYardEquipment(mapEnabled ? branchId : null);

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  return (
    <div className="gecko-stack gecko-stack-xl gecko-machines">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yard machines</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            What each machine can lift and how high. The yard refuses a job to a machine that cannot do it.
          </div>
        </div>
      </div>

      <EditableTable<HandlingEquipment>
        columns={[
          { key: 'equipmentCode', label: 'Code', kind: 'code', required: true, maxLength: 20, width: 110 },
          { key: 'name', label: 'Name', kind: 'text', maxLength: 100 },
          { key: 'kind', label: 'Kind', kind: 'select', required: true, options: MACHINE_KINDS, width: 150 },
          { key: 'handlesFull', label: 'Full', kind: 'bool', width: 60, hint: 'It can lift a laden box' },
          { key: 'handlesEmpty', label: 'Empty', kind: 'bool', width: 70, hint: 'It can lift an empty box' },
          { key: 'maxSizeFt', label: 'Longest', kind: 'select', options: SIZES, width: 90, hint: 'The longest box it takes; blank = any' },
          { key: 'maxTier', label: 'Highest tier', kind: 'number', min: 1, max: 9, width: 110, hint: 'How high it reaches; blank = any' },
          { key: 'doneLast24h', label: 'Jobs 24 h', kind: 'number', width: 90, editableWhen: () => false },
          { key: 'isActive', label: 'In use', kind: 'bool', width: 80 },
        ]}
        rows={machines.data}
        loading={machines.loading}
        error={machines.error}
        rowKey={m => m.handlingEquipmentId ?? m.equipmentCode}
        blank={() => ({
          handlingEquipmentId: '', branchId: branchId ?? '', equipmentCode: '', name: null, kind: 'FORKLIFT',
          handlesFull: true, handlesEmpty: true, maxSizeFt: null, maxTier: null, isActive: true,
          doneLast24h: 0, rowVersion: '',
        })}
        canManage={canManage && !!branchId}
        noun="Machine"
        searchText={m => `${m.equipmentCode} ${m.name ?? ''} ${m.kind}`}
        onSave={async draft => {
          await saveMachine({
            branchId: branchId!,
            equipmentCode: draft.equipmentCode,
            kind: draft.kind,
            name: draft.name,
            handlesFull: draft.handlesFull,
            handlesEmpty: draft.handlesEmpty,
            // The select hands back a string; the API wants 20, 40 or 45.
            maxSizeFt: draft.maxSizeFt ? Number(draft.maxSizeFt) : null,
            maxTier: draft.maxTier ? Number(draft.maxTier) : null,
            isActive: draft.isActive,
            rowVersion: draft.rowVersion || null,
          }, draft.handlingEquipmentId || null);
          machines.reload();
        }}
        note="A machine that has left the depot is taken out of use rather than deleted: it is named in the history of every job it did. A machine that lifts neither full nor empty boxes is refused."
      />
    </div>
  );
}
