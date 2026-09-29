"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ConditionsTab, GradesTab, MovementsTab, ServiceTypesTab, TaxCodesTab } from './_components/MasterTabs';

/**
 * LIVE against gecko_master — the small masters, one tab each (decision B), all
 * on the same editable table:
 *   grades, conditions             equipment.container_grade / _condition
 *   movements, service types, tax  commercial.movement / service_type / tax_code
 *   code lists                     lookup.code_list_value + the tenant's overrides
 *   mappings                       config.code_mapping
 *
 * The mock's lifecycle (DRAFT / DEPRECATED), usage counts, "modified by",
 * facility scope and SMDG / EDIFACT / customs columns are gone: nothing in the
 * API backs them. Active is the lifecycle; history is in SQL system versioning.
 */

type TabId = 'grades' | 'conditions' | 'movements' | 'services' | 'tax';

const TABS: { id: TabId; label: string; icon: string; render: () => React.ReactNode }[] = [
  { id: 'grades', label: 'Grades', icon: 'box', render: () => <GradesTab /> },
  { id: 'conditions', label: 'Conditions', icon: 'tool', render: () => <ConditionsTab /> },
  { id: 'movements', label: 'Movements', icon: 'transferH', render: () => <MovementsTab /> },
  { id: 'services', label: 'Service types', icon: 'layers', render: () => <ServiceTypesTab /> },
  { id: 'tax', label: 'Tax codes', icon: 'percent', render: () => <TaxCodesTab /> },
];

export default function LookupsPage() {
  const [tab, setTab] = useState<TabId>('grades');
  const current = TABS.find(t => t.id === tab)!;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Lookups</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            The small masters the yard, the gate and billing branch on — and the code lists and mappings that translate outside codes into ours.
          </div>
        </div>
      </div>

      <div className="gecko-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`gecko-tab ${tab === t.id ? 'gecko-tab-active' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* keyed: each tab mounts fresh, so an edit in progress never leaks into another master */}
      <div key={current.id} role="tabpanel">{current.render()}</div>
    </div>
  );
}
