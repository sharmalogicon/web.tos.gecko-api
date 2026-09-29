"use client";
import React, { useState } from 'react';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import {
  CONDITIONS_PATH, DIRECTIONS, FULL_EMPTY, GRADES_PATH, MODULES, MOVEMENTS_PATH, SERVICE_FORMS, SERVICE_TYPES_PATH,
  TAX_CODES_PATH, TAX_TYPES, deleteByCode, saveByCode,
  type ContainerCondition, type ContainerGrade, type Movement, type ServiceType, type TaxCode,
} from '@/lib/api/lookups';
import { EditableTable, type Column } from './EditableTable';

/**
 * One tab per small master: its list (inactive rows on request), and the
 * shared table to edit it. `codeKey` is the column the row is addressed by.
 */
function MasterTab<T extends { rowVersion?: string; isActive: boolean }>({
  path, codeKey, columns, blank, managePermission, noun, note, deleteMessage,
}: {
  path: string;
  codeKey: keyof T & string;
  columns: Column<T>[];
  blank: () => T;
  managePermission: string;
  noun: string;
  note: React.ReactNode;
  deleteMessage?: string;
}) {
  const { can } = useSession();
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data, error, loading, reload } = useApi<T[]>(`${path}?includeInactive=${includeInactive}`);
  const code = (row: T) => String(row[codeKey]);

  return (
    <EditableTable<T>
      columns={columns}
      rows={data}
      loading={loading}
      error={error}
      rowKey={code}
      blank={blank}
      canManage={can(managePermission)}
      noun={noun}
      note={note}
      searchText={row => `${code(row)} ${(row as { descriptionEn?: string }).descriptionEn ?? ''} ${(row as { descriptionLocal?: string | null }).descriptionLocal ?? ''}`}
      onSave={async (draft, original) => { await saveByCode(path, code(draft), draft, original === null); reload(); }}
      onDelete={async row => { await deleteByCode(path, code(row), row.rowVersion!); reload(); }}
      deleteMessage={deleteMessage ? () => deleteMessage : undefined}
      toolbar={
        <label className="gecko-row gecko-cell-meta">
          <input type="checkbox" className="gecko-checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      }
    />
  );
}

const active = <T,>(): Column<T & { isActive: boolean }> => ({ key: 'isActive', label: 'Active', kind: 'bool', width: 64 });

export function GradesTab() {
  return (
    <MasterTab<ContainerGrade>
      path={GRADES_PATH} codeKey="gradeCode" managePermission="mdm.equipment.manage" noun="Grade"
      note="How good a box is. Releasable = a box of this grade may be handed out; food grade = fit for food loads."
      blank={() => ({ gradeCode: '', descriptionEn: '', descriptionLocal: null, isFoodGrade: false, isReleasable: true, rankOrder: 50, isActive: true })}
      columns={[
        { key: 'gradeCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 10, width: 100 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
        { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 200 },
        { key: 'rankOrder', label: 'Rank', kind: 'number', required: true, min: 1, max: 99, width: 80, hint: '1–99, lower = better' },
        { key: 'isReleasable', label: 'Releasable', kind: 'bool', width: 90 },
        { key: 'isFoodGrade', label: 'Food grade', kind: 'bool', width: 90 },
        active<ContainerGrade>(),
      ]}
    />
  );
}

export function ConditionsTab() {
  return (
    <MasterTab<ContainerCondition>
      path={CONDITIONS_PATH} codeKey="conditionCode" managePermission="mdm.equipment.manage" noun="Condition"
      note="The state a box is surveyed in. CODECO damage sets the DAM segment on the outbound CODECO."
      blank={() => ({ conditionCode: '', descriptionEn: '', descriptionLocal: null, severity: 1, isServiceable: true, requiresRepair: false, codecoDamageFlag: false, isActive: true })}
      columns={[
        { key: 'conditionCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 10, width: 100 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 100 },
        { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 200 },
        { key: 'severity', label: 'Severity', kind: 'number', required: true, min: 1, max: 9, width: 80, hint: '1–9, higher = worse' },
        { key: 'isServiceable', label: 'Serviceable', kind: 'bool', width: 90 },
        { key: 'requiresRepair', label: 'Needs repair', kind: 'bool', width: 90 },
        { key: 'codecoDamageFlag', label: 'CODECO damage', kind: 'bool', width: 100 },
        active<ContainerCondition>(),
      ]}
    />
  );
}

export function MovementsTab() {
  return (
    <MasterTab<Movement>
      path={MOVEMENTS_PATH} codeKey="movementCode" managePermission="mdm.commercial.manage" noun="Movement"
      note="The moves an order type is made of (MTY IN, FULL OUT…). A movement that is a step of an order type cannot be deleted — make it inactive."
      blank={() => ({ movementCode: '', descriptionEn: '', descriptionLocal: null, fullEmpty: 'EMPTY', direction: 'IN', appliesToModule: 'TOS', codecoStatusCode: null, changesYardPosition: true, changesStatus: true, requiresSurvey: false, isActive: true })}
      columns={[
        { key: 'movementCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 20, width: 120 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
        { key: 'fullEmpty', label: 'Full / empty', kind: 'select', required: true, options: FULL_EMPTY, width: 100 },
        { key: 'direction', label: 'Direction', kind: 'select', required: true, options: DIRECTIONS, width: 110 },
        { key: 'appliesToModule', label: 'Module', kind: 'select', required: true, options: MODULES, width: 100 },
        { key: 'codecoStatusCode', label: 'CODECO', kind: 'code', maxLength: 3, width: 70 },
        { key: 'changesYardPosition', label: 'Moves in yard', kind: 'bool', width: 90 },
        { key: 'changesStatus', label: 'Changes status', kind: 'bool', width: 90 },
        { key: 'requiresSurvey', label: 'Survey', kind: 'bool', width: 70 },
        active<Movement>(),
      ]}
    />
  );
}

export function ServiceTypesTab() {
  return (
    <MasterTab<ServiceType>
      path={SERVICE_TYPES_PATH} codeKey="serviceCode" managePermission="mdm.commercial.manage" noun="Service type"
      note="Origin → destination service terms (CY/CY, CFS/CY…). One used by an order type cannot be deleted."
      blank={() => ({ serviceCode: '', descriptionEn: '', descriptionLocal: null, originForm: 'CY', destinationForm: 'CY', displayOrder: 100, isActive: true })}
      columns={[
        { key: 'serviceCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 15, width: 110 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
        { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 200 },
        { key: 'originForm', label: 'Origin', kind: 'select', required: true, options: SERVICE_FORMS, width: 110 },
        { key: 'destinationForm', label: 'Destination', kind: 'select', required: true, options: SERVICE_FORMS, width: 110 },
        { key: 'displayOrder', label: 'Order', kind: 'number', required: true, min: 0, max: 9999, width: 80 },
        active<ServiceType>(),
      ]}
    />
  );
}

export function TaxCodesTab() {
  return (
    <MasterTab<TaxCode>
      path={TAX_CODES_PATH} codeKey="taxCode" managePermission="mdm.commercial.manage" noun="Tax code"
      note="VAT and withholding codes charge codes bill with. One per type and country can be the default. A code a charge code uses cannot be deleted."
      blank={() => ({ taxCode: '', descriptionEn: '', descriptionLocal: null, countryCode: 'TH', taxType: 'VAT', ratePct: 7, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: null, isDefaultForType: false, outputTaxGl: null, inputTaxGl: null, isActive: true })}
      columns={[
        { key: 'taxCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 20, width: 100 },
        { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 200 },
        { key: 'taxType', label: 'Type', kind: 'select', required: true, options: TAX_TYPES, width: 120 },
        { key: 'countryCode', label: 'Country', kind: 'code', required: true, maxLength: 2, width: 70 },
        { key: 'ratePct', label: 'Rate %', kind: 'number', required: true, min: 0, max: 100, step: 0.01, width: 80 },
        { key: 'effectiveFrom', label: 'From', kind: 'date', required: true, width: 130 },
        { key: 'effectiveTo', label: 'To', kind: 'date', width: 130 },
        { key: 'isDefaultForType', label: 'Default', kind: 'bool', width: 70 },
        { key: 'outputTaxGl', label: 'Output GL', kind: 'code', maxLength: 20, width: 90 },
        { key: 'inputTaxGl', label: 'Input GL', kind: 'code', maxLength: 20, width: 90 },
        active<TaxCode>(),
      ]}
    />
  );
}
