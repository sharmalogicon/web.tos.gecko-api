"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const FREE_TIME_GROUPS = [
  { id: 'FT-IMP-STD', name: 'Standard Import Free Time', baseDays: 3, rules: [
      { id: 'r1', type: 'Extension', rule: 'Line = MSK', val: '+ 2 Days' },
      { id: 'r2', type: 'Reduction', rule: 'DG = True', val: '- 1 Day' },
  ]},
  { id: 'FT-EXP-STD', name: 'Standard Export Free Time', baseDays: 5, rules: [
      { id: 'r1', type: 'Extension', rule: 'Volume > 100 TEU', val: '+ 2 Days' },
  ]},
  { id: 'FT-EMP-STD', name: 'Empty Storage Free Time', baseDays: 14, rules: []},
  { id: 'FT-CFS-STD', name: 'CFS Warehouse Free Time', baseDays: 7, rules: [
      { id: 'r1', type: 'Reduction', rule: 'Reefer Cargo', val: '- 4 Days' },
  ]},
];

export default function FreeTimePage() {
  const [selectedPlan, setSelectedPlan] = useState('Public Tariff 2026 (Standard)');
  const [activeGroup, setActiveGroup] = useState(FREE_TIME_GROUPS[0]);
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Free Time & D&D Rules</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '2px 8px', borderRadius: 12 }}>Storage Logic</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Define the base free days before storage charges apply, and conditional extensions.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Copy Rules', message: 'Rule-copy workflow coming soon.' })}><Icon name="copy" size={16} /> Copy Rules</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Free-time rules saved', message: `${selectedPlan} updated.` })}><Icon name="save" size={16} /> Save Changes</button>
        </div>
      </div>

      {/* Plan Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--gecko-bg-surface)', padding: '16px 24px', borderRadius: 12, border: '1px solid var(--gecko-border)', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Editing Plan:</div>
        <select
          className="gecko-input"
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          style={{ width: 320, fontWeight: 600, color: 'var(--gecko-primary-700)', borderColor: 'var(--gecko-primary-300)', background: 'var(--gecko-primary-50)' }}
        >
          <option>Public Tariff 2026 (Standard)</option>
          <option>Thai Union Group Contract 2026</option>
          <option>PTT Global VIP Volume Agreement</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* LEFT PANE: Free Time Groups */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Rule Groups</span>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"><Icon name="plus" size={16} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {FREE_TIME_GROUPS.map((group) => (
              <div
                key={group.id}
                onClick={() => setActiveGroup(group)}
                style={{
                  padding: '16px', borderBottom: '1px solid var(--gecko-border)', cursor: 'pointer',
                  background: activeGroup.id === group.id ? 'var(--gecko-primary-50)' : 'transparent',
                  borderLeft: activeGroup.id === group.id ? '3px solid var(--gecko-primary-600)' : '3px solid transparent'
                }}
              >
                <div style={{ fontWeight: 600, color: activeGroup.id === group.id ? 'var(--gecko-primary-800)' : 'var(--gecko-text-primary)', marginBottom: 4 }}>{group.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>Base: <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{group.baseDays} Days</span></div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-info-600)', fontWeight: 600 }}>{group.rules.length} rules</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANE: Rule Builder */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflowY: 'auto' }}>

          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free Time Group</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0', color: 'var(--gecko-text-primary)' }}>{activeGroup.name}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Free Days</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input className="gecko-input" type="number" value={activeGroup.baseDays} readOnly style={{ width: 80, fontSize: 24, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', height: 44, color: 'var(--gecko-primary-700)', borderColor: 'var(--gecko-primary-300)', textAlign: 'right' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Builder Canvas */}
          <div style={{ padding: '32px 24px', background: 'var(--gecko-bg-subtle)', flex: 1 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Conditional Adjustments</h3>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ background: '#fff' }} onClick={() => toast({ variant: 'info', title: 'Add Rule', message: 'Rule builder coming soon.' })}><Icon name="plus" size={14} /> Add Rule</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeGroup.rules.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gecko-text-disabled)', background: '#fff', border: '1px dashed var(--gecko-border)', borderRadius: 8 }}>
                  No conditional rules. Base days apply to all.
                </div>
              )}
              {activeGroup.rules.map((cond, idx) => (
                <div key={cond.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid var(--gecko-border)', padding: 16, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gecko-gray-200)', color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {idx + 1}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>IF</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 200, fontWeight: 600 }}>
                    <option>{cond.rule.split(' = ')[0] || cond.rule}</option>
                  </select>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>=</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 160, fontWeight: 600 }}>
                    <option>{cond.rule.split(' = ')[1] || 'True'}</option>
                  </select>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginLeft: 16 }}>THEN</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 140, fontWeight: 600 }}>
                    <option>{cond.type}</option>
                  </select>

                  <input className="gecko-input gecko-input-sm" value={cond.val} readOnly style={{ width: 120, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: cond.type === 'Extension' ? 'var(--gecko-success-600)' : 'var(--gecko-error-600)' }} />

                  <button className="gecko-btn gecko-btn-ghost gecko-btn-icon" style={{ marginLeft: 'auto', color: 'var(--gecko-error-500)' }}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Matrix Preview */}
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', marginBottom: 16 }}>Preview Calculation</h3>
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13, background: '#fff', border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-800)' }}>
                    <th style={{ borderBottom: '1px solid var(--gecko-primary-200)', borderRight: '1px solid var(--gecko-primary-100)' }}>Scenario</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid var(--gecko-primary-200)' }}>Calculated Free Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ borderBottom: '1px solid var(--gecko-border)', borderRight: '1px solid var(--gecko-border)' }}>Base Scenario (No conditions met)</td>
                    <td className="gecko-text-mono" style={{ borderBottom: '1px solid var(--gecko-border)', textAlign: 'right', fontWeight: 700 }}>{activeGroup.baseDays} Days</td>
                  </tr>
                  {activeGroup.rules.map(c => (
                    <tr key={c.id}>
                      <td style={{ borderBottom: '1px solid var(--gecko-border)', borderRight: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)' }}>If {c.rule}</td>
                      <td className="gecko-text-mono" style={{ borderBottom: '1px solid var(--gecko-border)', textAlign: 'right', fontWeight: 600, color: c.type === 'Extension' ? 'var(--gecko-success-600)' : 'var(--gecko-error-600)' }}>
                        {c.type === 'Extension' ? `${activeGroup.baseDays + parseInt(c.val.replace('+ ', ''))} Days` : `${activeGroup.baseDays - parseInt(c.val.replace('- ', ''))} Days`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
