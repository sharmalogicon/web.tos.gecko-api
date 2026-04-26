"use client";
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

// High-speed exception-based HUD for gate clerks.
export default function EirInV2Page() {
  const [containers, setContainers] = useState([
    {
      id: 1,
      unit: 'CMAU 331876-2', iso: '40HC', laden: 'F', line: 'CMA', bkg: 'BKG-2026-04-8655',
      seal: 'SH-884221', vgm: 28450, 
      sealMatch: true, 
      damageMinor: false, damageMajor: false,
      dg: true,
      ready: true
    },
    {
      id: 2,
      unit: 'CMAU 445002-1', iso: '20GP', laden: 'F', line: 'CMA', bkg: 'BKG-2026-04-8655',
      seal: '', vgm: null,
      sealMatch: false,
      damageMinor: false, damageMajor: false,
      dg: false,
      ready: false
    }
  ]);

  // Handle keyboard shortcut F12 to commit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        alert('Commit Visit Triggered via F12!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleReady = (id: number) => {
    setContainers(prev => prev.map(c => c.id === id ? { ...c, ready: !c.ready } : c));
  };

  const updateContainer = (id: number, field: string, val: any) => {
    setContainers(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const allReady = containers.every(c => c.ready);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 120px)' }}>
      
      {/* 1. Ultra-dense Top Ribbon (HUD) */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, 
        padding: '12px 20px', background: 'var(--gecko-primary-900)', color: '#fff', 
        borderRadius: 10, boxShadow: 'var(--gecko-shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="truck" size={24} style={{ color: 'var(--gecko-primary-300)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OCR Plate</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>70-4455</div>
            </div>
            <Icon name="checkCircle" size={16} style={{ color: 'var(--gecko-success-400)', alignSelf: 'flex-end', marginBottom: 2 }} />
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver & Haulier</div>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>Prem Kanchana</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-300)' }}>Laem Chabang Trans.</div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appt ID</div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1.2 }}>APT-2026-04-4432</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-300)' }}>EIR-2026-04-4429</div>
          </div>
          
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scale Weight</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1, color: 'var(--gecko-success-400)' }}>38,450</span>
              <span style={{ fontSize: 11, color: 'var(--gecko-primary-300)' }}>KG</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel (ESC)</button>
        </div>
      </div>

      {/* 2. Vertically Stacked Container HUD */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {containers.map((c, i) => (
          <div key={c.id} style={{ 
            background: 'var(--gecko-bg-surface)', border: `2px solid ${c.ready ? 'var(--gecko-success-500)' : 'var(--gecko-warning-500)'}`, 
            borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)'
          }}>
            {/* Header row for container */}
            <div style={{ 
              display: 'flex', alignItems: 'center', padding: '12px 16px', 
              background: c.ready ? 'var(--gecko-success-50)' : 'var(--gecko-warning-50)',
              borderBottom: '1px solid var(--gecko-border)'
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: c.ready ? 'var(--gecko-success-600)' : 'var(--gecko-warning-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginRight: 12 }}>{i + 1}</div>
              
              <div style={{ position: 'relative', marginRight: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', marginBottom: 2 }}>Unit OCR</div>
                <input 
                  className="gecko-input" 
                  value={c.unit}
                  onChange={(e) => updateContainer(c.id, 'unit', e.target.value)}
                  style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 18, fontWeight: 800, padding: '4px 8px', height: 36, width: 200, background: '#fff', borderColor: 'var(--gecko-border-strong)' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: 24, flex: 1 }}>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>ISO / SIZE</div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.iso}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>LINE</div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.line}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>STATUS</div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.laden === 'F' ? 'Laden' : 'Empty'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>BOOKING</div><div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{c.bkg}</div></div>
                {c.dg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                    <Icon name="flame" size={14} /> DG DECLARED
                  </div>
                )}
              </div>

              <button 
                onClick={() => toggleReady(c.id)}
                style={{ 
                  padding: '8px 16px', background: c.ready ? 'var(--gecko-success-100)' : 'var(--gecko-warning-100)', 
                  border: `1px solid ${c.ready ? 'var(--gecko-success-300)' : 'var(--gecko-warning-300)'}`, 
                  borderRadius: 6, color: c.ready ? 'var(--gecko-success-800)' : 'var(--gecko-warning-800)', 
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 
                }}
              >
                {c.ready ? <><Icon name="check" size={14} /> READY</> : <><Icon name="alertTriangle" size={14} /> PENDING</>}
              </button>
            </div>

            {/* Inputs row */}
            <div style={{ padding: '16px', display: 'flex', gap: 32 }}>
              
              {/* Seals */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Shipper Seal</div>
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="gecko-input"
                    value={c.seal}
                    placeholder="Scan or enter seal..."
                    onChange={(e) => updateContainer(c.id, 'seal', e.target.value)}
                    style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 16, fontWeight: 600, paddingLeft: 36, background: c.seal ? '#fff' : 'var(--gecko-warning-50)' }}
                  />
                  <Icon name="lock" size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gecko-text-disabled)' }} />
                  {c.sealMatch && <Icon name="checkCircle" size={18} style={{ position: 'absolute', right: 12, top: 11, color: 'var(--gecko-success-500)' }} />}
                </div>
              </div>

              {/* VGM */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>VGM (kg)</div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Scale: 38,450</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    className="gecko-input"
                    value={c.vgm || ''}
                    placeholder="Required"
                    onChange={(e) => updateContainer(c.id, 'vgm', e.target.value)}
                    style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 16, fontWeight: 600, background: c.vgm ? '#fff' : 'var(--gecko-warning-50)', flex: 1 }}
                  />
                  <button title="Capture from scale" style={{ width: 40, height: 40, background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-200)', borderRadius: 6, color: 'var(--gecko-primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="scale" size={18} />
                  </button>
                </div>
              </div>

              {/* Quick Damage Toggles */}
              <div style={{ flex: 1.5, background: 'var(--gecko-bg-subtle)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>Quick Damage Inspection</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={c.damageMinor} onChange={(e) => updateContainer(c.id, 'damageMinor', e.target.checked)} style={{ width: 18, height: 18 }} />
                    Minor (Scratches/Dents)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={c.damageMajor} onChange={(e) => updateContainer(c.id, 'damageMajor', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--gecko-error-500)' }} />
                    <span style={{ color: c.damageMajor ? 'var(--gecko-error-700)' : 'inherit' }}>Major (Punctures/Structural)</span>
                  </label>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* 3. Sticky Action Footer */}
      <div style={{ 
        marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: 'var(--gecko-bg-surface)', borderTop: '1px solid var(--gecko-border)',
        boxShadow: '0 -4px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Auto-Tariff</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)' }}>฿2,650</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--gecko-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             {!allReady && <span style={{ color: 'var(--gecko-error-600)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alertTriangle" size={14} /> Missing required VGM or Seal</span>}
             {allReady && <span style={{ color: 'var(--gecko-success-600)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="checkCircle" size={14} /> All checks passed. Ready to commit.</span>}
          </div>
        </div>

        <button 
          disabled={!allReady}
          style={{ 
            padding: '14px 40px', background: allReady ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-300)', 
            color: '#fff', fontSize: 16, fontWeight: 700, borderRadius: 8, cursor: allReady ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 10, border: 'none', transition: 'background 150ms'
          }}
        >
          <Icon name="check" size={20} />
          COMMIT VISIT [F12]
        </button>
      </div>

    </div>
  );
}
