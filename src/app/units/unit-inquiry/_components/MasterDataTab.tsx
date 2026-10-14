"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { useApiList } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { PartyPicker } from '@/app/tariff/_components/PartyPicker';
import { type EquipmentType } from '@/lib/api/equipment-types';
import {
  MATERIALS, OWNERSHIP_TYPES, REGISTRY_STATUSES,
  fromRegistry, isDirty, localErrors, requestFrom, saveRegistry,
  type MasterForm, type RegistryRow,
} from '@/lib/api/container-master';
import { RenumberDialog, renumberSummary } from './RenumberDialog';
import { formatContainerNo } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';

/**
 * CONTAINER MASTER — the registry row a clerk edits (Vector's "Container
 * Information" and "Fix Port Details", bound).
 *
 * The fixed ports are the same PUT and the same rowVersion, but they have their
 * own tab (owner 2026-10-12), so this form sends the port list back UNCHANGED
 * rather than dropping it: the PUT replaces the whole row, and a field left out
 * is a field cleared.
 *
 * The fields on the right of the desktop screen — agent, yard location, current
 * status — are NOT here. In Gecko those belong to the STAY, not the box: the
 * same container comes in for one line this month and another next. They are
 * shown read-only on the Overview tab, where they can say which stay they came
 * from.
 *
 * The box's CONDITION and EMR remarks are not here either, for the same reason:
 * they belong to the open stay and are written by their own endpoints. They are
 * the YardStatePanel, directly below this on the tab.
 */

export function MasterDataTab({ containerNo, registry, registryError, canView, canEdit, onSaved, onRenumbered }: {
  containerNo: string;
  registry: RegistryRow | null;
  registryError: number | null;
  canView: boolean;
  canEdit: boolean;
  onSaved: () => void;
  /** The number changed: the page follows it, because the old one now 404s. */
  onRenumbered: (newContainerNo: string) => void;
}) {
  if (!canView) return <div className="gecko-cell-meta">You do not have access to the container registry.</div>;
  if (registryError === 404) {
    return (
      <div className="gecko-alert gecko-alert-info">
        <Icon name="info" size={18} />
        <div>
          <strong>Not in the container registry</strong>
          <div>
            {formatContainerNo(containerNo)} has been handled at the gate without a master-data record. That is normal
            for another line&apos;s equipment. Register it from Masters → Containers to give it an owner, a type and
            fixed ports.
          </div>
        </div>
      </div>
    );
  }
  if (!registry) {
    return <div className="gecko-cell-meta">{registryError ? 'The registry could not be read.' : 'Reading the registry…'}</div>;
  }
  return <MasterForm_ registry={registry} canEdit={canEdit} onSaved={onSaved} onRenumbered={onRenumbered} />;
}

function MasterForm_({ registry, canEdit, onSaved, onRenumbered }: {
  registry: RegistryRow; canEdit: boolean;
  onSaved: () => void;
  onRenumbered: (newContainerNo: string) => void;
}) {
  const { toast } = useToast();
  /**
   * The row the form started from. It follows the prop, so a save (which
   * re-reads) leaves the form clean, and a 409 re-read leaves the clerk's edits
   * on screen to apply again rather than silently discarding them.
   */
  const original = useMemo(() => fromRegistry(registry), [registry]);
  const [form, setForm] = useState<MasterForm>(original);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [renumbering, setRenumbering] = useState(false);

  const types = useApiList<EquipmentType>('/api/master/equipment-types?pageSize=200&isActive=true');

  const set = <K extends keyof MasterForm>(key: K, value: MasterForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const errors = localErrors(form);
  const dirty = isDirty(form, original);
  const shown = (key: keyof MasterForm) => (submitted ? errors[key] : undefined)
    ?? (failure?.forField(key) ?? undefined);

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      await saveRegistry(registry.containerNo, requestFrom(form, registry.rowVersion));
      toast({ variant: 'success', title: 'Container saved', message: formatContainerNo(registry.containerNo) });
      setSubmitted(false);
      onSaved();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setFailure(err);
      // A 409 means somebody else saved first; re-reading is the only way forward.
      if (err.status === 409) onSaved();
    } finally {
      setSaving(false);
    }
  };

  const reeferType = types.data?.find(t => t.equipmentTypeId === form.equipmentTypeId)?.isReefer ?? false;

  return (
    <div className="gecko-stack gecko-cm-stack">

      {failure && failure.status !== 400 && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{failure.title}</strong>
            {failure.explanation && <div>{failure.explanation}</div>}
            {failure.status === 409 && <div>The record was re-read; apply your change again.</div>}
          </div>
        </div>
      )}

      {/* ── identity ─────────────────────────────────────────────────────── */}
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow">Container information</div>
          {!canEdit && <span className="gecko-cm-readonly">Read-only — you do not have <code className="gecko-code">mdm.equipment.manage</code>.</span>}
        </div>

        <FormGrid columns={3}>
          <Field label="Container no"
            helper="Not an ordinary field: correcting it moves the box\u2019s whole history with it.">
            <div className="gecko-cm-locked">
              <input className="gecko-input gecko-mono" value={formatContainerNo(registry.containerNo)} readOnly disabled />
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={!canEdit || saving}
                title={canEdit ? 'Correct a mis-keyed number' : 'Needs mdm.equipment.manage'}
                onClick={() => setRenumbering(true)}>
                <Icon name="edit" size={13} /> Correct
              </button>
            </div>
          </Field>

          <Field label="Size · type" error={shown('equipmentTypeId')}
            helper={types.error ? 'The equipment types could not be read.' : undefined}>
            <select className="gecko-select" value={form.equipmentTypeId} disabled={!canEdit}
              onChange={e => set('equipmentTypeId', e.target.value)}>
              <option value="">— not recorded —</option>
              {(types.data ?? []).map(t => (
                <option key={t.equipmentTypeId} value={t.equipmentTypeId}>
                  {t.typeCode} · {t.descriptionEn}
                </option>
              ))}
            </select>
          </Field>

          <Field label="ISO code" error={shown('isoCode')}
            helper="ISO 6346 size-type, e.g. 45G1. Must be one the chosen type answers to.">
            <input className="gecko-input gecko-mono" value={form.isoCode} disabled={!canEdit} maxLength={4}
              placeholder="45G1" onChange={e => set('isoCode', e.target.value.toUpperCase())} />
          </Field>

          <Field label="Hire mode" required error={shown('ownershipType')}>
            <select className="gecko-select" value={form.ownershipType} disabled={!canEdit}
              onChange={e => set('ownershipType', e.target.value)}>
              {OWNERSHIP_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Owner" error={shown('ownerCode')}>
            <PartyPicker role="SHIPPING_LINE" value={form.ownerCode || null} disabled={!canEdit} nameFirst
              placeholder="Search the owner…"
              onChange={(code, party) => setForm(f => ({
                ...f, ownerCode: code ?? '', ownerPartyId: party?.partyId ?? '',
              }))} />
          </Field>

          <Field label="Lessor" required={form.ownershipType === 'LEASED'} error={shown('lessorCode')}
            helper={form.ownershipType !== 'LEASED' ? 'Only a leased box has a lessor.' : undefined}>
            <PartyPicker role="SHIPPING_LINE" value={form.lessorCode || null} nameFirst
              disabled={!canEdit || form.ownershipType !== 'LEASED'}
              placeholder="Search the lessor…"
              onChange={(code, party) => setForm(f => ({
                ...f, lessorCode: code ?? '', lessorPartyId: party?.partyId ?? '',
              }))} />
          </Field>

          <Field label="Material" error={shown('material')}>
            <select className="gecko-select" value={form.material} disabled={!canEdit}
              onChange={e => set('material', e.target.value)}>
              {MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>

          <Field label="Tare weight (kg)" error={shown('tareWeightKg')}>
            <input className="gecko-input gecko-input-money" value={form.tareWeightKg} disabled={!canEdit}
              inputMode="decimal" onChange={e => set('tareWeightKg', e.target.value)} />
          </Field>

          <Field label="Max gross (kg)" error={shown('maxGrossKg')}>
            <input className="gecko-input gecko-input-money" value={form.maxGrossKg} disabled={!canEdit}
              inputMode="decimal" onChange={e => set('maxGrossKg', e.target.value)} />
          </Field>

          <Field label="Registry status" required error={shown('status')}
            helper="The box's life — not where it is standing and not its condition.">
            <select className="gecko-select" value={form.status} disabled={!canEdit}
              onChange={e => set('status', e.target.value)}>
              {REGISTRY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Manufacturer" error={shown('manufacturer')}>
            <input className="gecko-input" value={form.manufacturer} disabled={!canEdit} maxLength={100}
              onChange={e => set('manufacturer', e.target.value)} />
          </Field>

          <Field label="Manufactured" error={shown('manufactureDate')}>
            <input type="date" className="gecko-input" value={form.manufactureDate} disabled={!canEdit}
              onChange={e => set('manufactureDate', e.target.value)} />
          </Field>

          <Field label="CSC plate ref" error={shown('cscPlateRef')}>
            <input className="gecko-input gecko-mono" value={form.cscPlateRef} disabled={!canEdit} maxLength={50}
              onChange={e => set('cscPlateRef', e.target.value)} />
          </Field>

          <Field label="ACEP ref" error={shown('acepRef')}>
            <input className="gecko-input gecko-mono" value={form.acepRef} disabled={!canEdit} maxLength={50}
              onChange={e => set('acepRef', e.target.value)} />
          </Field>

          <Field label="Next examination" error={shown('nextExaminationDate')}>
            <input type="date" className="gecko-input" value={form.nextExaminationDate} disabled={!canEdit}
              onChange={e => set('nextExaminationDate', e.target.value)} />
          </Field>

          {reeferType && (
            <>
              <Field label="Reefer unit make" error={shown('reeferUnitMake')}>
                <input className="gecko-input" value={form.reeferUnitMake} disabled={!canEdit} maxLength={40}
                  onChange={e => set('reeferUnitMake', e.target.value)} />
              </Field>
              <Field label="Reefer unit model" error={shown('reeferUnitModel')}>
                <input className="gecko-input" value={form.reeferUnitModel} disabled={!canEdit} maxLength={40}
                  onChange={e => set('reeferUnitModel', e.target.value)} />
              </Field>
            </>
          )}

          {/* About the BOX, not about this visit \u2014 what is wrong with it today
              is the EMR note below. */}
          <Field label="Remarks" full error={shown('remarks')}
            helper="About the container itself. For what is wrong with it on this visit, use the EMR remarks below.">
            <textarea className="gecko-textarea" rows={2} value={form.remarks} disabled={!canEdit} maxLength={1000}
              onChange={e => set('remarks', e.target.value)} />
          </Field>
        </FormGrid>

        {/* Vector's footer. The names are the API's resolved ones, so this
            reads "Created by Natthaphon" and not a GUID. */}
        <div className="gecko-cm-stamps">
          <span>
            Created {registry.createdAt ? formatDateTime(registry.createdAt) : '\u2014'}
            {registry.createdByName && <> by <strong>{registry.createdByName}</strong></>}
          </span>
          <span>
            Modified {registry.updatedAt ? formatDateTime(registry.updatedAt) : '\u2014'}
            {registry.updatedByName && <> by <strong>{registry.updatedByName}</strong></>}
          </span>
        </div>
      </section>

      {/* ── save ─────────────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="gecko-cm-save">
          <div className="gecko-cell-meta">
            {dirty ? 'Unsaved changes.' : 'Nothing changed.'}
            {registry.updatedAt && <> Last modified {formatDateTime(registry.updatedAt)}.</>}
          </div>
          <div className="gecko-cm-save-actions">
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              disabled={!dirty || saving}
              onClick={() => { setForm(original); setSubmitted(false); setFailure(null); }}>
              Discard
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? <><span className="gecko-spinner gecko-spinner-sm" /> Saving…</> : <><Icon name="save" size={14} /> Save</>}
            </button>
          </div>
        </div>
      )}

      {renumbering && (
        <RenumberDialog
          containerNo={registry.containerNo}
          rowVersion={registry.rowVersion}
          onClose={() => setRenumbering(false)}
          onDone={result => {
            setRenumbering(false);
            toast({
              variant: 'success',
              title: `${formatContainerNo(result.oldContainerNo)} is now ${formatContainerNo(result.newContainerNo)}`,
              message: renumberSummary(result),
            });
            onRenumbered(result.newContainerNo);
          }} />
      )}

    </div>
  );
}
