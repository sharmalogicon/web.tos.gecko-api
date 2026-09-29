"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import {
  DATE_PARTS, NUMBER_SERIES_PATH, RESET_PERIODS, deleteSeries, previewNumber, saveSeries, settingsPath,
  type NumberSeries, type TenantSetting,
} from '@/lib/api/system-params';
import { EditableTable } from '@/app/masters/lookups/_components/EditableTable';
import { SettingsTable } from './_components/SettingsSection';

/**
 * LIVE against gecko_master — tenant settings (config.tenant_setting over the
 * platform's declared lookup.setting_definition) and document number series.
 *
 * The mock's sections (general / financial / gate / yard / reefer /
 * notifications / integration) held fields nothing reads: they are replaced by
 * the settings the platform actually declares, grouped by the module that
 * owns them. Webhooks, notification rules and reefer thresholds are gone.
 */

interface Branch { branchId: string; branchCode: string; displayName: string }

const MODULE_LABEL: Record<string, string> = {
  TOS: 'Gate & depot', REVENUE: 'Billing', MDM: 'Master data', MNR: 'Survey & repair', NOTIFICATION: 'Notifications', EDI: 'EDI',
};

type Section = { kind: 'module'; module: string } | { kind: 'series' };

export default function SystemParamsPage() {
  const { can } = useSession();
  const canManage = can('mdm.config.manage');
  const { data: branches } = useApiList<Branch>('/api/branches?pageSize=100');
  const [branchId, setBranchId] = useState<string | null>(null);
  const branch = branchId ?? branches?.[0]?.branchId ?? null;
  const branchCode = branches?.find(b => b.branchId === branch)?.branchCode;

  const settings = useApi<TenantSetting[]>(branch ? settingsPath(branch) : settingsPath(null));
  const series = useApi<NumberSeries[]>(`${NUMBER_SERIES_PATH}?includeInactive=true`);

  const modules = useMemo(() => [...new Set((settings.data ?? []).map(s => s.owningModule))], [settings.data]);
  const [picked, setPicked] = useState<Section | null>(null);
  const section: Section = picked ?? (modules[0] ? { kind: 'module', module: modules[0] } : { kind: 'series' });

  const nav = [
    ...modules.map(m => ({ key: m, label: MODULE_LABEL[m] ?? m, icon: 'settings', count: settings.data?.filter(s => s.owningModule === m).length ?? 0, section: { kind: 'module', module: m } as Section })),
    { key: '__series', label: 'Number series', icon: 'tag', count: series.data?.length ?? 0, section: { kind: 'series' } as Section },
  ];
  const isActive = (s: Section) => s.kind === section.kind && (s.kind === 'series' || (section.kind === 'module' && s.module === section.module));
  const error = settings.error ?? series.error;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">System Parameters</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            What the platform does differently for this tenant — and for each depot — and how its documents are numbered.
          </div>
        </div>
        <div className="gecko-toolbar">
          <label className="gecko-row gecko-cell-meta" style={{ gap: 8 }}>
            Depot
            <select className="gecko-input" style={{ width: 220 }} value={branch ?? ''} onChange={e => setBranchId(e.target.value || null)} aria-label="Depot">
              {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error.message}</span>
        </div>
      )}

      <div className="gecko-row gecko-row-start" style={{ gap: 20, alignItems: 'flex-start' }}>
        <nav className="gecko-card gecko-card-tight gecko-stack" style={{ width: 220, flexShrink: 0, gap: 2 }} aria-label="Sections">
          {nav.map(n => (
            <button key={n.key} type="button" onClick={() => setPicked(n.section)} aria-current={isActive(n.section) ? 'page' : undefined}
              className={`gecko-btn gecko-btn-sm ${isActive(n.section) ? 'gecko-btn-primary' : 'gecko-btn-ghost'}`}
              style={{ justifyContent: 'space-between', width: '100%' }}>
              <span className="gecko-row" style={{ gap: 6 }}><Icon name={n.icon} size={13} /> {n.label}</span>
              <span className="gecko-count-badge">{n.count}</span>
            </button>
          ))}
        </nav>

        <div className="gecko-flex-1" style={{ minWidth: 0 }}>
          {section.kind === 'module' ? (
            <SettingsTable
              settings={(settings.data ?? []).filter(s => s.owningModule === section.module)}
              branchId={branch}
              canManage={canManage}
              onSaved={settings.reload}
            />
          ) : (
            <EditableTable<NumberSeries>
              columns={[
                { key: 'seriesKey', label: 'Series', kind: 'code', required: true, createOnly: true, maxLength: 30, width: 130 },
                { key: 'description', label: 'Description', kind: 'text', maxLength: 200 },
                { key: 'prefix', label: 'Prefix', kind: 'code', maxLength: 20, width: 80 },
                { key: 'separator', label: 'Sep.', kind: 'text', maxLength: 2, width: 50 },
                { key: 'includeBranchCode', label: 'Depot code', kind: 'bool', width: 80 },
                { key: 'datePartFormat', label: 'Date part', kind: 'select', required: true, options: DATE_PARTS, width: 100, editableWhen: s => !s.hasIssuedNumbers },
                { key: 'resetPeriod', label: 'Resets', kind: 'select', required: true, options: RESET_PERIODS, width: 100, editableWhen: s => !s.hasIssuedNumbers },
                { key: 'numberLength', label: 'Digits', kind: 'number', required: true, min: 3, max: 15, width: 70 },
                { key: 'startNumber', label: 'Start', kind: 'number', required: true, min: 1, max: 999_999_999, width: 90, editableWhen: s => !s.hasIssuedNumbers },
                { key: 'isGapFreeRequired', label: 'Gap-free', kind: 'bool', width: 70 },
                { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
                {
                  key: 'hasIssuedNumbers', label: 'Looks like', kind: 'bool', width: 170, editableWhen: () => false,
                  render: s => (
                    <div className="gecko-cell-two-line">
                      <div className="gecko-text-mono">{previewNumber(s, branchCode)}</div>
                      <div className="gecko-cell-sub">{s.branchId ? 'one depot' : 'every depot'}{s.hasIssuedNumbers ? ' · in use' : ''}</div>
                    </div>
                  ),
                },
              ]}
              rows={series.data}
              loading={series.loading}
              error={null}
              rowKey={s => s.numberSeriesId ?? s.seriesKey}
              blank={() => ({
                branchId: null, seriesKey: '', documentTypeCode: null, description: null, prefix: null, separator: '-',
                includeBranchCode: false, datePartFormat: 'YY', resetPeriod: 'YEARLY', numberLength: 6, startNumber: 1,
                isGapFreeRequired: false, isActive: true,
              })}
              canManage={canManage}
              noun="Number series"
              searchText={s => `${s.seriesKey} ${s.description ?? ''} ${s.prefix ?? ''}`}
              onSave={async draft => { await saveSeries(draft); series.reload(); }}
              onDelete={async s => { await deleteSeries(s); series.reload(); }}
              cannotDelete={s => (s.hasIssuedNumbers ? 'Numbers have been issued from it — set it inactive instead.' : null)}
              note="Once a series has issued numbers, how it counts (date part, reset, start) is fixed — changing it would issue the same numbers again — and it can only be made inactive. Booking, EIR, truck-visit and gate-pass numbers are issued by the gate and are not listed here."
            />
          )}
        </div>
      </div>
    </div>
  );
}
