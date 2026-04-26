"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';

const CONTAINER_CARGO = [
  { id: 'LCL-IM-001', type: 'Pallet', desc: 'Apparel (Nike)', weight: 800, qty: 1, seal: 'OK', marks: 'NKE-TH' },
  { id: 'LCL-IM-002', type: 'Pallet', desc: 'Apparel (Nike)', weight: 850, qty: 1, seal: 'OK', marks: 'NKE-TH' },
  { id: 'LCL-IM-003', type: 'Cartons', desc: 'Shoes (Nike)', weight: 400, qty: 120, seal: 'OK', marks: 'NKE-TH-S' },
  { id: 'LCL-IM-004', type: 'Crate', desc: 'Display Fixtures', weight: 1500, qty: 2, seal: 'OK', marks: 'NKE-FIX' },
];

export default function StrippingPage() {
  const [container, setContainer] = useState<any[]>(CONTAINER_CARGO);
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [selectedCont, setSelectedCont] = useState<Set<string>>(new Set());
  const [selectedWh, setSelectedWh] = useState<Set<string>>(new Set());
  const [destLoc, setDestLoc] = useState('WH-A1-01');

  const handleStrip = () => {
    const toMove = container.filter(item => selectedCont.has(item.id)).map(item => ({ ...item, loc: destLoc }));
    setWarehouse([...warehouse, ...toMove]);
    setContainer(container.filter(item => !selectedCont.has(item.id)));
    setSelectedCont(new Set());
  };

  const handleReturn = () => {
    const toMove = warehouse.filter(item => selectedWh.has(item.id));
    setContainer([...container, ...toMove]);
    setWarehouse(warehouse.filter(item => !selectedWh.has(item.id)));
    setSelectedWh(new Set());
  };

  const toggleCont = (id: string) => {
    const next = new Set(selectedCont);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedCont(next);
  };

  const toggleWh = (id: string) => {
    const next = new Set(selectedWh);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedWh(next);
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>CFS Stripping</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-warning-700)', background: 'var(--gecko-warning-100)', padding: '2px 8px', borderRadius: 12 }}>Active Tally</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Unload inbound LCL cargo from a container into the warehouse.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="printer" size={16} /> Print Receipt</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="check" size={16} /> Complete Stripping</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* LEFT PANE: Container (Source) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* Container Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inbound Container</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)' }}>CMAU 441922-1</h2>
                  <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>40HC</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manifest (EDO)</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', marginTop: 4 }}>EDO-2026-1142</div>
              </div>
            </div>

            {/* Container barcode */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gecko-border)' }}>
              <BarcodeDisplay value="CMAU4419221" variant="both" qrSize={64} showValue={false} label="Container" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--gecko-warning-50)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--gecko-warning-200)' }}>
              <Icon name="lock" size={16} style={{ color: 'var(--gecko-warning-700)' }} />
              <div style={{ fontSize: 13, color: 'var(--gecko-warning-800)' }}>
                <span style={{ fontWeight: 700 }}>Seal Broken:</span> SH-991283 by Somchai K. at 08:15 AM
              </div>
            </div>
          </div>

          {/* Container Cargo List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {container.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gecko-success-600)', flexDirection: 'column', gap: 12, background: 'var(--gecko-success-50)' }}>
                <Icon name="checkCircle" size={48} />
                <div style={{ fontSize: 16, fontWeight: 700 }}>Container fully stripped!</div>
              </div>
            ) : (
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0 }}>
                    <th style={{ textAlign: 'left', width: 40 }}><input type="checkbox" onChange={(e) => setSelectedCont(e.target.checked ? new Set(container.map(i => i.id)) : new Set())} /></th>
                    <th>Manifest ID</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th>Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {container.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedCont.has(item.id) ? 'var(--gecko-primary-50)' : '#fff', cursor: 'pointer' }} onClick={() => toggleCont(item.id)}>
                      <td><input type="checkbox" checked={selectedCont.has(item.id)} readOnly /></td>
                      <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{item.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.desc}</div>
                        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{item.type} · {item.weight} kg</div>
                      </td>
                      <td className="gecko-text-mono" style={{ textAlign: 'right' }}>{item.qty}</td>
                      <td className="gecko-text-mono" style={{ fontSize: 12 }}>{item.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MIDDLE: Transfer Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <button
            onClick={handleStrip}
            disabled={selectedCont.size === 0}
            style={{
              width: 48, height: 48, borderRadius: '50%', background: selectedCont.size > 0 ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: selectedCont.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedCont.size > 0 ? 'var(--gecko-shadow-md)' : 'none', transition: 'all 150ms'
            }}
            title="Strip to warehouse"
          >
            <Icon name="chevronRight" size={24} />
          </button>

          <button
            onClick={handleReturn}
            disabled={selectedWh.size === 0}
            style={{
              width: 48, height: 48, borderRadius: '50%', background: selectedWh.size > 0 ? 'var(--gecko-error-600)' : 'var(--gecko-gray-200)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: selectedWh.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedWh.size > 0 ? 'var(--gecko-shadow-md)' : 'none', transition: 'all 150ms'
            }}
            title="Return to container"
          >
            <Icon name="chevronLeft" size={24} />
          </button>
        </div>

        {/* RIGHT PANE: Warehouse Inventory (Target) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* WH Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Location</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)', marginTop: 4 }}>CFS Warehouse</h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Assign to Location:</div>
              <input
                className="gecko-input"
                value={destLoc}
                onChange={(e) => setDestLoc(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-700)', borderColor: 'var(--gecko-primary-300)', background: 'var(--gecko-primary-50)' }}
              />
            </div>
          </div>

          {/* Warehouse List */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gecko-bg-subtle)' }}>
            {warehouse.length === 0 ? (
               <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gecko-text-disabled)', flexDirection: 'column', gap: 12 }}>
                 <Icon name="grid" size={48} style={{ opacity: 0.5 }} />
                 <div style={{ fontSize: 14, fontWeight: 500 }}>Select items to strip into warehouse</div>
               </div>
            ) : (
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0 }}>
                    <th style={{ textAlign: 'left', width: 40 }}><input type="checkbox" onChange={(e) => setSelectedWh(e.target.checked ? new Set(warehouse.map(i => i.id)) : new Set())} /></th>
                    <th>Cargo ID</th>
                    <th>Description</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouse.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedWh.has(item.id) ? 'var(--gecko-primary-50)' : '#fff' }} onClick={() => toggleWh(item.id)}>
                      <td><input type="checkbox" checked={selectedWh.has(item.id)} readOnly /></td>
                      <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{item.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.desc}</div>
                        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{item.qty} {item.type}</div>
                      </td>
                      <td className="gecko-text-mono" style={{ color: 'var(--gecko-info-600)', fontWeight: 700 }}>{item.loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
