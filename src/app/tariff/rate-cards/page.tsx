"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const RATE_ITEMS = [
  { id: 'LIFT-ON', desc: 'Container lift-on', base: 850, conditions: [
      { id: 'c1', type: 'Multiplier', rule: 'ISO Size = 40 / 45', val: 'x 1.5' },
      { id: 'c2', type: 'Surcharge', rule: 'DG = True', val: '+ ฿200' },
  ]},
  { id: 'LIFT-OFF', desc: 'Container lift-off', base: 850, conditions: [
      { id: 'c1', type: 'Multiplier', rule: 'ISO Size = 40 / 45', val: 'x 1.5' },
      { id: 'c2', type: 'Surcharge', rule: 'DG = True', val: '+ ฿200' },
  ]},
  { id: 'STORAGE-L', desc: 'Storage, laden', base: 80, conditions: [
      { id: 'c1', type: 'Multiplier', rule: 'ISO Size = 40 / 45', val: 'x 2.0' },
      { id: 'c2', type: 'Surcharge', rule: 'Reefer = True', val: '+ ฿150 / day' },
      { id: 'c3', type: 'Multiplier', rule: 'Tier 2 (Day 6-10)', val: 'x 2.0' },
      { id: 'c4', type: 'Multiplier', rule: 'Tier 3 (Day 11+)', val: 'x 3.0' },
  ]},
];

export default function RateCardsPage() {
  const [selectedPlan, setSelectedPlan] = useState('Public Tariff 2026 (Standard)');
  const [activeItem, setActiveItem] = useState(RATE_ITEMS[2]);
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Rate Cards Builder</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '2px 8px', borderRadius: 12 }}>Logic Editor</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Define pricing matrices using base rates and conditional constraint multipliers.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Plan duplicated', message: `Copy of "${selectedPlan}" created as a draft.` })}><Icon name="copy" size={16} /> Duplicate Plan</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="save" size={16} /> Save Changes</button>
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
           <span style={{ background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid var(--gecko-success-200)' }}>Status: ACTIVE</span>
           <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid var(--gecko-border)' }}>Valid: Jan 01 2026 - Dec 31 2026</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* LEFT PANE: Charge Codes List */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gecko-text-disabled)' }} />
              <input className="gecko-input gecko-input-sm" placeholder="Search charge code..." style={{ paddingLeft: 36, width: '100%' }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {RATE_ITEMS.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                style={{
                  padding: '16px', borderBottom: '1px solid var(--gecko-border)', cursor: 'pointer',
                  background: activeItem.id === item.id ? 'var(--gecko-primary-50)' : 'transparent',
                  borderLeft: activeItem.id === item.id ? '3px solid var(--gecko-primary-600)' : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: activeItem.id === item.id ? 'var(--gecko-primary-800)' : 'var(--gecko-text-primary)' }}>{item.id}</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-success-700)' }}>฿{item.base}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{item.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--gecko-primary-600)', marginTop: 8, fontWeight: 600 }}>{item.conditions.length} active constraints</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANE: Constraint Builder */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflowY: 'auto' }}>

          {/* Item Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pricing Logic For</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{activeItem.id}</h2>
                <div style={{ fontSize: 14, color: 'var(--gecko-text-secondary)' }}>{activeItem.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Rate (THB)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-disabled)' }}>฿</span>
                  <input className="gecko-input" type="number" value={activeItem.base} readOnly style={{ width: 120, fontSize: 24, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', height: 44, color: 'var(--gecko-success-700)', borderColor: 'var(--gecko-success-300)', textAlign: 'right' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Builder Canvas */}
          <div style={{ padding: '32px 24px', background: 'var(--gecko-bg-subtle)', flex: 1 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Conditional Multipliers & Surcharges</h3>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ background: '#fff' }} onClick={() => toast({ variant: 'info', title: 'Add Constraint', message: 'Constraint builder coming soon.' })}><Icon name="plus" size={14} /> Add Constraint</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeItem.conditions.map((cond, idx) => (
                <div key={cond.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1px solid var(--gecko-border)', padding: 16, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gecko-gray-200)', color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {idx + 1}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>IF</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 200, fontWeight: 600 }}>
                    <option>{cond.rule.split(' = ')[0]}</option>
                  </select>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>=</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 160, fontWeight: 600 }}>
                    <option>{cond.rule.split(' = ')[1] || 'True'}</option>
                  </select>

                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginLeft: 16 }}>THEN</div>

                  <select className="gecko-input gecko-input-sm" style={{ width: 140, fontWeight: 600 }}>
                    <option>{cond.type}</option>
                  </select>

                  <input className="gecko-input gecko-input-sm" value={cond.val} readOnly style={{ width: 120, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: cond.type === 'Multiplier' ? 'var(--gecko-primary-600)' : 'var(--gecko-warning-600)' }} />

                  <button className="gecko-btn gecko-btn-ghost gecko-btn-icon" style={{ marginLeft: 'auto', color: 'var(--gecko-error-500)' }}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Matrix Preview */}
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', marginBottom: 16 }}>Live Matrix Preview</h3>
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12, background: '#fff', border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-800)' }}>
                    <th style={{ borderBottom: '1px solid var(--gecko-primary-200)', borderRight: '1px solid var(--gecko-primary-100)' }}>Scenario</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid var(--gecko-primary-200)' }}>Calculated THB Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ borderBottom: '1px solid var(--gecko-border)', borderRight: '1px solid var(--gecko-border)' }}>Base (e.g. 20GP, Dry, Day 1-5)</td>
                    <td className="gecko-text-mono" style={{ borderBottom: '1px solid var(--gecko-border)', textAlign: 'right', fontWeight: 700 }}>฿{activeItem.base.toFixed(2)}</td>
                  </tr>
                  {activeItem.conditions.map(c => (
                    <tr key={c.id}>
                      <td style={{ borderBottom: '1px solid var(--gecko-border)', borderRight: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)' }}>If {c.rule}</td>
                      <td className="gecko-text-mono" style={{ borderBottom: '1px solid var(--gecko-border)', textAlign: 'right', fontWeight: 600, color: c.type === 'Multiplier' ? 'var(--gecko-primary-600)' : 'var(--gecko-warning-600)' }}>
                        {c.type === 'Multiplier' ? `฿${(activeItem.base * parseFloat(c.val.replace('x ', ''))).toFixed(2)}` : `฿${(activeItem.base + parseInt(c.val.replace('+ ฿', ''))).toFixed(2)}`}
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
