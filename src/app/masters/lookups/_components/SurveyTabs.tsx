"use client";
import React, { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { deleteById, saveById } from '@/lib/api/logistics';
import { EditableTable, type Column } from './EditableTable';

/**
 * The gate survey's vocabulary (Tier 3): damage codes, repair codes, damage
 * locations, components — CEDEX, IICL or the tenant's own (LOCAL). A code is
 * unique within its standard, so rows are addressed by id. Read
 * mdm.equipment.view, change mdm.equipment.manage.
 */
interface SurveyRow {
  id?: string;
  code: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  codeStandard: string;
  isActive: boolean;
  rowVersion?: string;
}

const STANDARDS = ['LOCAL', 'CEDEX', 'IICL'].map(v => ({ value: v, label: v }));
const opts = (values: string[]) => values.map(v => ({ value: v, label: v }));

function SurveyTab<T extends SurveyRow>({ path, noun, note, extra, blankExtra }: {
  path: string; noun: string; note: string; extra: Column<T>[]; blankExtra: Omit<T, keyof SurveyRow>;
}) {
  const { can } = useSession();
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data, error, loading, reload } = useApi<T[]>(`${path}?includeInactive=${includeInactive}`);
  const columns: Column<T>[] = [
    { key: 'codeStandard', label: 'Standard', kind: 'select', required: true, options: STANDARDS, width: 100 },
    { key: 'code', label: 'Code', kind: 'code', required: true, maxLength: 20, width: 100 },
    { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
    { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 200 },
    ...extra,
    { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
  ];
  return (
    <EditableTable<T>
      columns={columns}
      rows={data}
      loading={loading}
      error={error}
      rowKey={r => r.id ?? `${r.codeStandard}:${r.code}`}
      blank={() => ({ code: '', descriptionEn: '', descriptionLocal: null, codeStandard: 'LOCAL', isActive: true, ...blankExtra } as T)}
      canManage={can('mdm.equipment.manage')}
      noun={noun}
      note={note}
      searchText={r => `${r.codeStandard} ${r.code} ${r.descriptionEn} ${r.descriptionLocal ?? ''}`}
      onSave={async draft => { await saveById(path, draft.id, draft); reload(); }}
      onDelete={async r => { await deleteById(path, r.id!, r.rowVersion!); reload(); }}
      deleteMessage={() => 'It is no longer offered on a survey. Surveys already written keep the code they used.'}
      toolbar={
        <label className="gecko-row gecko-cell-meta">
          <input type="checkbox" className="gecko-checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      }
    />
  );
}

interface DamageCode extends SurveyRow { severity: number; makesUnserviceable: boolean }
interface RepairCode extends SurveyRow { repairMode: string | null; repairGroup: string | null; defaultUomCode: string | null }
interface DamageLocation extends SurveyRow { containerFace: string | null }
interface Component extends SurveyRow { componentGroup: string | null; baseUomCode: string | null; isOwnPart: boolean }

export function DamageCodesTab() {
  return (
    <SurveyTab<DamageCode> path="/api/master/damage-codes" noun="Damage code" blankExtra={{ severity: 5, makesUnserviceable: false }}
      note="What a surveyor records as wrong with a box. Unserviceable = a box with it cannot be released until repaired."
      extra={[
        { key: 'severity', label: 'Severity', kind: 'number', required: true, min: 1, max: 9, width: 80 },
        { key: 'makesUnserviceable', label: 'Unserviceable', kind: 'bool', width: 100 },
      ]} />
  );
}

export function RepairCodesTab() {
  return (
    <SurveyTab<RepairCode> path="/api/master/repair-codes" noun="Repair code" blankExtra={{ repairMode: null, repairGroup: null, defaultUomCode: null }}
      note="What the M&R shop does about it. Mode and group come from the REPAIR_MODE and REPAIR_GROUP code lists."
      extra={[
        { key: 'repairMode', label: 'Mode', kind: 'select', options: opts(['CLEAN', 'PAINT', 'PATCH', 'REPLACE', 'RESECURE', 'STRAIGHTEN', 'WELD']), width: 120 },
        { key: 'repairGroup', label: 'Group', kind: 'select', options: opts(['CLEANING', 'COSMETIC', 'DOOR', 'FLOOR', 'MACHINERY', 'ROOF', 'STRUCTURAL', 'WALL']), width: 130 },
        { key: 'defaultUomCode', label: 'Unit', kind: 'code', maxLength: 10, width: 80, hint: 'lookup.uom code' },
      ]} />
  );
}

export function DamageLocationsTab() {
  return (
    <SurveyTab<DamageLocation> path="/api/master/damage-locations" noun="Damage location" blankExtra={{ containerFace: null }}
      note="Where on the box the damage is (CEDEX: face + section + height)."
      extra={[
        { key: 'containerFace', label: 'Face', kind: 'select', options: opts(['LEFT', 'RIGHT', 'FRONT', 'DOOR', 'ROOF', 'FLOOR', 'UNDER', 'INTERIOR', 'MACHINERY']), width: 120 },
      ]} />
  );
}

export function ComponentsTab() {
  return (
    <SurveyTab<Component> path="/api/master/components" noun="Component" blankExtra={{ componentGroup: null, baseUomCode: null, isOwnPart: false }}
      note="The part of the box that is damaged or repaired. Group comes from the COMPONENT_GROUP code list."
      extra={[
        { key: 'componentGroup', label: 'Group', kind: 'select', options: opts(['DOOR', 'FITTING', 'FLOOR', 'FRAME', 'MACHINERY', 'ROOF', 'UNDERSIDE', 'WALL']), width: 120 },
        { key: 'baseUomCode', label: 'Unit', kind: 'code', maxLength: 10, width: 80 },
        { key: 'isOwnPart', label: 'Own part', kind: 'bool', width: 80 },
      ]} />
  );
}
