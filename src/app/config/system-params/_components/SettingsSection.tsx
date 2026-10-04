"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { saveSetting, type SettingValueType, type TenantSetting } from '@/lib/api/system-params';

/** The editor a declared type gets. '' in the draft = "no value at this scope". */
function ValueInput({ type, value, onChange, disabled, label }: {
  type: SettingValueType; value: string; onChange: (v: string) => void; disabled: boolean; label: string;
}) {
  if (type === 'BOOL')
    return (
      <select className="gecko-input gecko-input-sm" value={value} disabled={disabled} aria-label={label} onChange={e => onChange(e.target.value)}>
        <option value="">— not set —</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  if (type === 'JSON')
    return <textarea className="gecko-input gecko-text-mono" rows={2} value={value} disabled={disabled} aria-label={label} onChange={e => onChange(e.target.value)} placeholder="not set" />;
  return (
    <input className={`gecko-input gecko-input-sm${type === 'STRING' ? '' : ' gecko-num-tabular'}`} value={value} disabled={disabled} aria-label={label}
      type={type === 'DATE' ? 'date' : type === 'INT' || type === 'DECIMAL' ? 'number' : 'text'}
      step={type === 'DECIMAL' ? 'any' : undefined} placeholder="not set" onChange={e => onChange(e.target.value)} />
  );
}

const shown = (type: SettingValueType, v: string | null) =>
  v === null ? '—' : type === 'BOOL' ? (v === 'true' ? 'Yes' : 'No') : v;

/**
 * One scope of one setting: its own value (or none), saved with that scope's
 * rowVersion. Clearing it lets the next layer (tenant, then default) apply.
 */
function ScopeEditor({ setting, branchId, canManage, onSaved }: {
  setting: TenantSetting; branchId: string | null; canManage: boolean; onSaved: () => void;
}) {
  const { toast } = useToast();
  const current = branchId ? setting.branchValue : setting.tenantValue;
  const rowVersion = branchId ? setting.branchRowVersion : setting.tenantRowVersion;
  const [draft, setDraft] = useState(current ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const dirty = draft !== (current ?? '');

  const write = async (value: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await saveSetting(setting.settingKey, value, branchId, rowVersion);
      toast({ variant: 'success', title: value === null ? 'Setting cleared' : 'Setting saved', message: setting.settingKey });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="gecko-row" style={{ gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ValueInput type={setting.valueType} value={draft} onChange={setDraft} disabled={!canManage || saving}
            label={`${setting.settingKey} (${branchId ? 'this depot' : 'tenant'})`} />
        </div>
        {canManage && dirty && (
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={saving} onClick={() => write(draft === '' ? null : draft)}>
            <Icon name="save" size={13} /> Save
          </button>
        )}
        {canManage && !dirty && current !== null && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={saving} onClick={() => write(null)}
            title={branchId ? 'Use the tenant value (or the default) at this depot' : 'Use the platform default'}>
            Clear
          </button>
        )}
      </div>
      {error && <div className="gecko-field-error">{error.forField('settingValue') ?? error.explanation ?? error.message}</div>}
    </div>
  );
}

export function SettingsTable({ settings, branchId, canManage, onSaved }: {
  settings: TenantSetting[]; branchId: string | null; canManage: boolean; onSaved: () => void;
}) {
  return (
    <div className="gecko-table-card">
      <table className="gecko-table gecko-table-compact">
        <thead>
          <tr>
            <th>Setting</th>
            <th style={{ width: 90 }}>Default</th>
            <th style={{ width: 230 }}>Tenant value</th>
            <th style={{ width: 230 }}>This depot</th>
            <th style={{ width: 130 }}>In force</th>
          </tr>
        </thead>
        <tbody>
          {settings.map(s => (
            // keyed on the versions: a save re-reads the row and the editors start from what was saved
            <tr key={`${s.settingKey}:${s.tenantRowVersion}:${s.branchRowVersion}:${branchId}`}>
              <td>
                <div className="gecko-cell-two-line">
                  <div className="gecko-cell-primary">{s.descriptionEn}</div>
                  <div className="gecko-cell-sub gecko-text-mono">{s.settingKey} · {s.valueType}</div>
                </div>
              </td>
              <td className="gecko-cell-meta">{shown(s.valueType, s.defaultValue)}</td>
              <td><ScopeEditor setting={s} branchId={null} canManage={canManage} onSaved={onSaved} /></td>
              <td>
                {s.allowedScope === 'BRANCH'
                  ? branchId
                    ? <ScopeEditor setting={s} branchId={branchId} canManage={canManage} onSaved={onSaved} />
                    : <span className="gecko-cell-meta">pick a depot</span>
                  : <span className="gecko-cell-meta" title="One value for the whole tenant">tenant-wide</span>}
              </td>
              <td>
                <div className="gecko-cell-two-line">
                  <div className="gecko-cell-primary">{shown(s.valueType, s.value)}</div>
                  <div className="gecko-cell-sub">from {s.resolvedFrom.toLowerCase()}</div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
