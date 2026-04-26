"use client";
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { BarcodeDisplay, BarcodeScanInput } from '@/components/ui/BarcodeDisplay';

// High-speed exception-based HUD for gate delivery (EIR-Out).
export default function EirOutPage() {
  const [scanHighlight, setScanHighlight] = useState<string | null>(null);
  const [containers, setContainers] = useState([
    {
      id: 1,
      unit: 'MSKU 744218-3', iso: '20GP', laden: 'F', line: 'MSK', edo: 'EDO-2026-9921',
      recordedSeal: 'SH-884221', checkedSeal: '',
      sealMatch: false, 
      damageMinor: false, damageMajor: false,
      holdCustoms: false, holdLine: false,
      location: 'Yard A / A-01 / Row 2 / Tier 1',
      ready: false
    },
    {
      id: 2,
      unit: 'MSKU 881290-0', iso: '20GP', laden: 'F', line: 'MSK', edo: 'EDO-2026-9921',
      recordedSeal: 'SH-884222', checkedSeal: 'SH-884222',
      sealMatch: true,
      damageMinor: true, damageMajor: false,
      holdCustoms: false, holdLine: false,
      location: 'Yard A / A-01 / Row 2 / Tier 2',
      ready: true
    }
  ]);

  // Handle keyboard shortcut F12 to commit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (allReady) alert('Gate Delivery (EIR-Out) Committed via F12!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [containers]);

  const toggleReady = (id: number) => {
    setContainers(prev => prev.map(c => c.id === id ? { ...c, ready: !c.ready } : c));
  };

  const updateContainer = (id: number, field: string, val: any) => {
    setContainers(prev => {
      return prev.map(c => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: val };
        
        // Auto-check seal match
        if (field === 'checkedSeal') {
          updated.sealMatch = val === c.recordedSeal;
        }
        return updated;
      });
    });
  };

  const allReady = containers.every(c => c.ready);

  return (
    <div role="main" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 120px)' }}>
      
      {/* 1. Ultra-dense Top Ribbon (HUD) */}
      <div role="banner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        padding: '12px 20px', background: 'var(--gecko-primary-900)', color: '#fff', 
        borderRadius: 10, boxShadow: 'var(--gecko-shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="logOut" size={24} style={{ color: 'var(--gecko-primary-300)', transform: 'rotate(180deg)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OCR Plate Out</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>72-8819</div>
            </div>
            <Icon name="checkCircle" size={16} style={{ color: 'var(--gecko-success-400)', alignSelf: 'flex-end', marginBottom: 2 }} />
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver & Haulier</div>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>Sompong Saelee</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-300)' }}>Thai Logistics Co.</div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Order (EDO)</div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1.2 }}>EDO-2026-9921</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-success-400)', fontWeight: 600 }}>Valid thru Apr 28</div>
          </div>
          
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />

          <div>
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-200)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Release Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
               <div style={{ background: 'var(--gecko-success-500)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>CLEARED</div>
               <span style={{ fontSize: 11, color: 'var(--gecko-primary-300)' }}>No holds</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel (ESC)</button>
        </div>
      </div>

      {/* Scan Bar */}
      <div style={{ padding: '10px 14px', background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-200)', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12" strokeWidth="2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)' }}>Scanner Ready</div>
            <div style={{ fontSize: 10.5, color: 'var(--gecko-primary-600)' }}>Scan container no or EDO to highlight</div>
          </div>
        </div>
        <BarcodeScanInput
          onScan={v => setScanHighlight(v)}
          placeholder="Scan container no or EDO number…"
          style={{ flex: 1 }}
        />
        {scanHighlight && (
          <button onClick={() => setScanHighlight(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', fontSize: 12, fontFamily: 'inherit' }}>
            Clear ×
          </button>
        )}
      </div>

      {/* 2. Vertically Stacked Container HUD */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {containers.map((c, i) => (
          <div key={c.id} style={{
            background: scanHighlight && (c.unit.replace(/\s/g,'').toLowerCase().includes(scanHighlight.toLowerCase()) || c.edo.toLowerCase().includes(scanHighlight.toLowerCase())) ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
            border: scanHighlight && (c.unit.replace(/\s/g,'').toLowerCase().includes(scanHighlight.toLowerCase()) || c.edo.toLowerCase().includes(scanHighlight.toLowerCase())) ? '2px solid var(--gecko-primary-500)' : `2px solid ${c.ready ? 'var(--gecko-success-500)' : 'var(--gecko-warning-500)'}`,
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
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>STATUS</div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.laden === 'F' ? 'Laden Import' : 'Empty'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>YARD POSITION</div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{c.location}</div></div>
                {(c.holdCustoms || c.holdLine) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--gecko-error-100)', color: 'var(--gecko-error-700)', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                    <Icon name="lock" size={14} /> ACTIVE HOLD
                  </div>
                )}
              </div>

              <button
                onClick={() => toggleReady(c.id)}
                aria-label={`Mark container ${c.unit} as ${c.ready ? 'pending' : 'ready'}`}
                aria-pressed={c.ready}
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

            {/* Unit barcode */}
            <div style={{ padding: '4px 16px 8px' }}>
              <BarcodeDisplay value={c.unit.replace(/\s/g,'')} variant="code128" showValue={false} />
            </div>

            {/* Inputs row */}
            <div style={{ padding: '16px', display: 'flex', gap: 32 }}>
              
              {/* Outbound Seal Verification */}
              <div style={{ flex: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Verify Seal</div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Recorded: {c.recordedSeal}</div>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="gecko-input"
                    value={c.checkedSeal}
                    placeholder="Scan or enter seal..."
                    onChange={(e) => updateContainer(c.id, 'checkedSeal', e.target.value)}
                    aria-label={`Seal verification for ${c.unit}`}
                    style={{
                      fontFamily: 'var(--gecko-font-mono)', fontSize: 16, fontWeight: 600, paddingLeft: 36, 
                      background: c.sealMatch ? '#fff' : 'var(--gecko-warning-50)',
                      borderColor: c.sealMatch ? 'var(--gecko-success-400)' : 'var(--gecko-warning-400)'
                    }}
                  />
                  <Icon name="lock" size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gecko-text-disabled)' }} />
                  {c.sealMatch && <Icon name="checkCircle" size={18} style={{ position: 'absolute', right: 12, top: 11, color: 'var(--gecko-success-500)' }} />}
                  {!c.sealMatch && c.checkedSeal.length > 0 && <Icon name="xCircle" size={18} style={{ position: 'absolute', right: 12, top: 11, color: 'var(--gecko-error-500)' }} />}
                </div>
              </div>

              {/* Delivery Condition */}
              <div style={{ flex: 1.5, background: 'var(--gecko-bg-subtle)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>Outbound Condition</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={c.damageMinor} onChange={(e) => updateContainer(c.id, 'damageMinor', e.target.checked)} aria-label="Minor damage noted" style={{ width: 18, height: 18 }} />
                    Minor Damage
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={c.damageMajor} onChange={(e) => updateContainer(c.id, 'damageMajor', e.target.checked)} aria-label="Major damage noted" style={{ width: 18, height: 18, accentColor: 'var(--gecko-error-500)' }} />
                    <span style={{ color: c.damageMajor ? 'var(--gecko-error-700)' : 'inherit' }}>Major Damage</span>
                  </label>
                </div>
              </div>

              {/* Delivery Receipt */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <button className="gecko-btn gecko-btn-outline" style={{ width: '100%', height: 42 }}>
                  <Icon name="printer" size={16} /> Print EIR Ticket
                </button>
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
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Gate Charges</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)' }}>฿0.00</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--gecko-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             {!allReady && <span style={{ color: 'var(--gecko-error-600)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alertTriangle" size={14} /> Missing required Seal verification</span>}
             {allReady && <span style={{ color: 'var(--gecko-success-600)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="checkCircle" size={14} /> Outbound checks passed. Ready for gate-out.</span>}
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
          COMMIT DEPARTURE <kbd className="gecko-kbd" style={{ marginLeft: 8, fontSize: 11 }}>F12</kbd>
        </button>
      </div>

    </div>
  );
}
