"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { useToast } from '@/components/ui/Toast';

const WAREHOUSE_CARGO = [
  { id: 'LCL-8842-1', type: 'Pallet', desc: 'Auto Parts (Toyota)', weight: 1200, vol: 1.5, qty: 1, loc: 'WH-A1-01', bkg: 'BKG-2026-991' },
  { id: 'LCL-8842-2', type: 'Pallet', desc: 'Auto Parts (Toyota)', weight: 1200, vol: 1.5, qty: 1, loc: 'WH-A1-02', bkg: 'BKG-2026-991' },
  { id: 'LCL-9100-1', type: 'Cartons', desc: 'Electronics (Sony)', weight: 450, vol: 0.8, qty: 50, loc: 'WH-B3-12', bkg: 'BKG-2026-991' },
  { id: 'LCL-9100-2', type: 'Cartons', desc: 'Electronics (Sony)', weight: 450, vol: 0.8, qty: 50, loc: 'WH-B3-13', bkg: 'BKG-2026-991' },
  { id: 'LCL-7731-1', type: 'Crate', desc: 'Machinery Engine', weight: 3500, vol: 4.2, qty: 1, loc: 'WH-C2-05', bkg: 'BKG-2026-992' },
];

export default function StuffingPage() {
  const [stuffed, setStuffed] = useState<any[]>([]);
  const [warehouse, setWarehouse] = useState<any[]>(WAREHOUSE_CARGO);
  const { toast } = useToast();
  const [selectedWh, setSelectedWh] = useState<Set<string>>(new Set());
  const [selectedStuffed, setSelectedStuffed] = useState<Set<string>>(new Set());

  // Container Limits (40HC)
  const MAX_WEIGHT = 26500; // kg
  const MAX_VOL = 76.3; // cbm

  const currentWeight = stuffed.reduce((acc, item) => acc + item.weight, 0);
  const currentVol = stuffed.reduce((acc, item) => acc + item.vol, 0);

  const weightPct = (currentWeight / MAX_WEIGHT) * 100;
  const volPct = (currentVol / MAX_VOL) * 100;

  const handleStuff = () => {
    const toMove = warehouse.filter(item => selectedWh.has(item.id));
    setStuffed([...stuffed, ...toMove]);
    setWarehouse(warehouse.filter(item => !selectedWh.has(item.id)));
    setSelectedWh(new Set());
  };

  const handleUnstuff = () => {
    const toMove = stuffed.filter(item => selectedStuffed.has(item.id));
    setWarehouse([...warehouse, ...toMove]);
    setStuffed(stuffed.filter(item => !selectedStuffed.has(item.id)));
    setSelectedStuffed(new Set());
  };

  const toggleWh = (id: string) => {
    const next = new Set(selectedWh);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedWh(next);
  };

  const toggleStuffed = (id: string) => {
    const next = new Set(selectedStuffed);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedStuffed(next);
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>CFS Stuffing</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '2px 8px', borderRadius: 12 }}>Active Tally</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Load LCL cargo from the warehouse into outbound containers.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => window.print()}><Icon name="printer" size={16} /> Print Tally Sheet</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Stuffing completed', message: 'Container stuffing recorded.' })}><Icon name="check" size={16} /> Complete Stuffing</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* LEFT PANE: Container (Target) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* Container Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outbound Container</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)' }}>MSKU 881290-0</h2>
                  <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>40HC</span>
                  <span style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>MSK</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Booking</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', marginTop: 4 }}>BKG-2026-991</div>
              </div>
            </div>

            {/* Container barcode */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--gecko-border)' }}>
              <BarcodeDisplay value="MSKU8812900" variant="both" qrSize={64} showValue={false} label="Container" />
            </div>
            <div style={{ marginTop: 8 }}>
              <BarcodeDisplay value="TL-26-00892" variant="qr" qrSize={52} showValue={false} label="Tally Job" />
            </div>

            {/* Capacity Meters */}
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>Weight Capacity</span>
                  <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{currentWeight.toLocaleString()} / {MAX_WEIGHT.toLocaleString()} kg</span>
                </div>
                <div style={{ height: 8, background: 'var(--gecko-gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(weightPct, 100)}%`, background: weightPct > 90 ? 'var(--gecko-error-500)' : 'var(--gecko-primary-500)', transition: 'width 300ms ease' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>Volume Capacity</span>
                  <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{currentVol.toFixed(1)} / {MAX_VOL} cbm</span>
                </div>
                <div style={{ height: 8, background: 'var(--gecko-gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(volPct, 100)}%`, background: volPct > 90 ? 'var(--gecko-error-500)' : 'var(--gecko-info-500)', transition: 'width 300ms ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stuffed Cargo List */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gecko-bg-subtle)' }}>
            {stuffed.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gecko-text-disabled)', flexDirection: 'column', gap: 12 }}>
                <Icon name="box" size={48} style={{ opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>Container is empty</div>
              </div>
            ) : (
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0 }}>
                    <th style={{ textAlign: 'left', width: 40 }}><input type="checkbox" onChange={(e) => setSelectedStuffed(e.target.checked ? new Set(stuffed.map(i => i.id)) : new Set())} /></th>
                    <th>Cargo ID</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {stuffed.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedStuffed.has(item.id) ? 'var(--gecko-primary-50)' : '#fff' }} onClick={() => toggleStuffed(item.id)}>
                      <td><input type="checkbox" checked={selectedStuffed.has(item.id)} readOnly /></td>
                      <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{item.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.desc}</div>
                        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{item.type}</div>
                      </td>
                      <td className="gecko-text-mono" style={{ textAlign: 'right' }}>{item.qty}</td>
                      <td className="gecko-text-mono" style={{ textAlign: 'right' }}>{item.weight} kg</td>
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
            onClick={handleStuff}
            disabled={selectedWh.size === 0}
            style={{
              width: 48, height: 48, borderRadius: '50%', background: selectedWh.size > 0 ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: selectedWh.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedWh.size > 0 ? 'var(--gecko-shadow-md)' : 'none', transition: 'all 150ms'
            }}
            title="Stuff into container"
          >
            <Icon name="chevronLeft" size={24} />
          </button>

          <button
            onClick={handleUnstuff}
            disabled={selectedStuffed.size === 0}
            style={{
              width: 48, height: 48, borderRadius: '50%', background: selectedStuffed.size > 0 ? 'var(--gecko-error-600)' : 'var(--gecko-gray-200)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: selectedStuffed.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedStuffed.size > 0 ? 'var(--gecko-shadow-md)' : 'none', transition: 'all 150ms'
            }}
            title="Unstuff back to warehouse"
          >
            <Icon name="chevronRight" size={24} />
          </button>
        </div>

        {/* RIGHT PANE: Warehouse Inventory (Source) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* WH Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Location</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)', marginTop: 4 }}>CFS Warehouse</h2>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: 'var(--gecko-info-50)', color: 'var(--gecko-info-700)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid var(--gecko-info-200)' }}>BKG-2026-991 Filter Applied</span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gecko-text-disabled)' }} />
              <input className="gecko-input" placeholder="Scan barcode or search cargo..." style={{ paddingLeft: 36, width: '100%' }} />
            </div>
          </div>

          {/* Warehouse List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
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
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedWh.has(item.id) ? 'var(--gecko-primary-50)' : '#fff', cursor: 'pointer' }} onClick={() => toggleWh(item.id)}>
                    <td><input type="checkbox" checked={selectedWh.has(item.id)} readOnly /></td>
                    <td className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{item.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.desc}</div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{item.qty} {item.type} · {item.weight} kg</div>
                    </td>
                    <td className="gecko-text-mono" style={{ color: 'var(--gecko-info-600)', fontWeight: 600 }}>{item.loc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
