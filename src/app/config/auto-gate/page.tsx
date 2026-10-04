"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';

/* ──────────────────────────────────────────────────────────────────────────
   Auto-Gate Configuration
   ──────────────────────────────────────────────────────────────────────────
   Webhook endpoints that accept OCR camera events from third-party gate
   systems (Camco, Cyclone, Hikvision-based custom rigs, etc.). Each lane
   has its own URL + auth + field mapping.

   Why this matters: depots have $100k-$500k invested in OCR camera hardware.
   The selling story is "we plug into your existing cameras — no rip-and-
   replace, no driver-side change. Point your edge box at our webhook URL
   and we ingest the data live."
   ────────────────────────────────────────────────────────────────────────── */

type LaneDirection = 'IN' | 'OUT';
type AuthMode = 'none' | 'apikey' | 'hmac';
type PayloadFormat = 'json' | 'xml';
type VendorPreset = 'camco' | 'cyclone' | 'hikvision' | 'custom';

interface FieldMapping {
  vendorPath: string;     // e.g., 'plate.value'
  geckoField: string;     // e.g., 'vehicle_plate'
}

interface Lane {
  id: string;
  code: string;
  direction: LaneDirection;
  status: 'green' | 'yellow' | 'red';
  preset: VendorPreset;
  webhookKey: string;
  authMode: AuthMode;
  format: PayloadFormat;
  mappings: FieldMapping[];
  lastEvent?: string;     // ISO timestamp
  eventCount24h: number;
}

interface OCREvent {
  id: string;
  laneId: string;
  laneCode: string;
  ts: string;
  eventType: 'GATE_IN' | 'GATE_OUT' | 'LANE_OCCUPANCY';
  plate: { value: string; confidence: number };
  container?: { value: string; confidence: number; iso?: string };
  seal?: { value: string; confidence: number };
  matched: 'matched' | 'unmatched' | 'parse-error';
  matchedApt?: string;
  rawPayload: string;     // formatted JSON for the inspector drawer
}

/* ──────────────────────────────────────────────────────────────────────────
   Vendor presets — pre-baked field mappings for known OCR systems
   ────────────────────────────────────────────────────────────────────────── */

const VENDOR_PRESETS: Record<VendorPreset, { label: string; mappings: FieldMapping[]; format: PayloadFormat }> = {
  camco: {
    label: 'Camco Container OCR',
    format: 'json',
    mappings: [
      { vendorPath: 'plate.value',       geckoField: 'vehicle_plate' },
      { vendorPath: 'plate.confidence',  geckoField: 'plate_confidence' },
      { vendorPath: 'container.value',   geckoField: 'container_no' },
      { vendorPath: 'container.iso',     geckoField: 'iso_code' },
      { vendorPath: 'container.confidence', geckoField: 'container_confidence' },
      { vendorPath: 'seal.value',        geckoField: 'seal_no_1' },
      { vendorPath: 'images',            geckoField: 'attachments' },
      { vendorPath: 'event',             geckoField: 'event_type' },
      { vendorPath: 'lane',              geckoField: 'lane_code' },
    ],
  },
  cyclone: {
    label: 'Cyclone Computers (legacy XML)',
    format: 'xml',
    mappings: [
      { vendorPath: 'Gate/Plate',        geckoField: 'vehicle_plate' },
      { vendorPath: 'Gate/Container/No', geckoField: 'container_no' },
      { vendorPath: 'Gate/Container/ISO', geckoField: 'iso_code' },
      { vendorPath: 'Gate/Seal',         geckoField: 'seal_no_1' },
      { vendorPath: 'Gate/Lane',         geckoField: 'lane_code' },
      { vendorPath: 'Gate/EventType',    geckoField: 'event_type' },
    ],
  },
  hikvision: {
    label: 'Hikvision custom rig (JSON)',
    format: 'json',
    mappings: [
      { vendorPath: 'plateNumber',       geckoField: 'vehicle_plate' },
      { vendorPath: 'containerNumber',   geckoField: 'container_no' },
      { vendorPath: 'isoCode',           geckoField: 'iso_code' },
      { vendorPath: 'sealNumber',        geckoField: 'seal_no_1' },
      { vendorPath: 'laneCode',          geckoField: 'lane_code' },
      { vendorPath: 'timestamp',         geckoField: 'event_ts' },
    ],
  },
  custom: { label: 'Custom (define your own mapping)', format: 'json', mappings: [] },
};

const GECKO_FIELDS = [
  'vehicle_plate', 'plate_confidence',
  'container_no', 'iso_code', 'container_confidence',
  'seal_no_1', 'seal_no_2',
  'lane_code', 'event_type', 'event_ts',
  'attachments', 'driver_id', 'haulier_code',
];

/* ──────────────────────────────────────────────────────────────────────────
   Initial mock state
   ────────────────────────────────────────────────────────────────────────── */

const WEBHOOK_BASE = 'https://api.gecko-tos.com/v1/auto-gate/webhook';
const TENANT = 'lcb-icd';

function genKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'k_';
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const INITIAL_LANES: Lane[] = [
  {
    id: 'l1', code: 'IN-01', direction: 'IN', status: 'green',
    preset: 'camco', webhookKey: 'k_4N9X2RQA8T5BZJ7HFKM3PWLG',
    authMode: 'apikey', format: 'json',
    mappings: VENDOR_PRESETS.camco.mappings,
    lastEvent: new Date(Date.now() - 12_000).toISOString(),
    eventCount24h: 384,
  },
  {
    id: 'l2', code: 'IN-02', direction: 'IN', status: 'green',
    preset: 'camco', webhookKey: 'k_8FXJ3WPVN6DLBM4ZTCQK5RYG',
    authMode: 'apikey', format: 'json',
    mappings: VENDOR_PRESETS.camco.mappings,
    lastEvent: new Date(Date.now() - 45_000).toISOString(),
    eventCount24h: 412,
  },
  {
    id: 'l3', code: 'IN-03', direction: 'IN', status: 'yellow',
    preset: 'hikvision', webhookKey: 'k_QTMX9HKLBP3JF8VR2NCWG4DZ',
    authMode: 'hmac', format: 'json',
    mappings: VENDOR_PRESETS.hikvision.mappings,
    lastEvent: new Date(Date.now() - 220_000).toISOString(),
    eventCount24h: 297,
  },
  {
    id: 'l4', code: 'OUT-01', direction: 'OUT', status: 'green',
    preset: 'cyclone', webhookKey: 'k_W7HMRJBN5CPK4VTL3XFG2DZQ',
    authMode: 'apikey', format: 'xml',
    mappings: VENDOR_PRESETS.cyclone.mappings,
    lastEvent: new Date(Date.now() - 4_000).toISOString(),
    eventCount24h: 421,
  },
  {
    id: 'l5', code: 'OUT-02', direction: 'OUT', status: 'red',
    preset: 'camco', webhookKey: 'k_3RVBNHJK7PQXFG4ML5CTDWZ8',
    authMode: 'none', format: 'json',
    mappings: VENDOR_PRESETS.camco.mappings,
    lastEvent: new Date(Date.now() - 1_800_000).toISOString(),
    eventCount24h: 0,
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Mock event generator — used by the "Send test payload" button and to
   prime the initial events feed with realistic recent activity.
   ────────────────────────────────────────────────────────────────────────── */

const SAMPLE_PLATES = ['70-1234', '70-5678', '70-9012', '70-3344', '70-7788', '70-2255', '71-1129', '70-4499'];
const SAMPLE_CONTAINERS = ['MAEU7234561', 'ONEU3398472', 'CMAU8843901', 'COSU9981233', 'EGLV2238104', 'APLU3392845'];
const SAMPLE_ISOS = ['22G1', '42G1', '45G1', '45R1', '22G0'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateEvent(lane: Lane, eventType: OCREvent['eventType'] = 'GATE_IN'): OCREvent {
  const plate = rand(SAMPLE_PLATES);
  const container = rand(SAMPLE_CONTAINERS);
  const iso = rand(SAMPLE_ISOS);
  const ts = new Date().toISOString();
  const plateConf = 0.85 + Math.random() * 0.14;
  const containerConf = 0.82 + Math.random() * 0.17;
  const matchRoll = Math.random();
  const matched: OCREvent['matched'] =
    matchRoll < 0.78 ? 'matched' :
    matchRoll < 0.95 ? 'unmatched' :
                       'parse-error';

  const payload =
    lane.format === 'json'
      ? formatJSONPayload(lane.preset, { plate, plateConf, container, containerConf, iso, ts, eventType, laneCode: lane.code })
      : formatXMLPayload(lane.preset, { plate, container, iso, ts, eventType, laneCode: lane.code });

  return {
    id: `ev_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    laneId: lane.id, laneCode: lane.code, ts, eventType,
    plate: { value: plate, confidence: plateConf },
    container: { value: container, confidence: containerConf, iso },
    matched,
    matchedApt: matched === 'matched'
      ? `APT-${ts.slice(0, 10)}-${String(Math.floor(Math.random() * 9000 + 1000))}`
      : undefined,
    rawPayload: payload,
  };
}

function formatJSONPayload(
  preset: VendorPreset,
  d: { plate: string; plateConf: number; container: string; containerConf: number; iso: string; ts: string; eventType: string; laneCode: string },
): string {
  if (preset === 'camco') {
    return JSON.stringify({
      event: d.eventType, lane: d.laneCode, timestamp: d.ts,
      plate: { value: d.plate, confidence: Number(d.plateConf.toFixed(2)), country: 'TH' },
      container: { value: d.container, iso: d.iso, confidence: Number(d.containerConf.toFixed(2)) },
      seal: { value: `S-${Math.floor(Math.random() * 90000 + 10000)}`, confidence: 0.91 },
      images: [
        `https://camera-edge.depot.local/${d.laneCode}/img/${Date.now()}_front.jpg`,
        `https://camera-edge.depot.local/${d.laneCode}/img/${Date.now()}_top.jpg`,
      ],
    }, null, 2);
  }
  if (preset === 'hikvision') {
    return JSON.stringify({
      eventType: d.eventType, laneCode: d.laneCode, timestamp: d.ts,
      plateNumber: d.plate, containerNumber: d.container, isoCode: d.iso,
      sealNumber: `S-${Math.floor(Math.random() * 90000 + 10000)}`,
      cameraId: `CAM-${d.laneCode}`,
    }, null, 2);
  }
  return JSON.stringify({ event: d.eventType, plate: d.plate, container: d.container, iso: d.iso, ts: d.ts });
}

function formatXMLPayload(
  _preset: VendorPreset,
  d: { plate: string; container: string; iso: string; ts: string; eventType: string; laneCode: string },
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Gate>
  <EventType>${d.eventType}</EventType>
  <Lane>${d.laneCode}</Lane>
  <Timestamp>${d.ts}</Timestamp>
  <Plate>${d.plate}</Plate>
  <Container>
    <No>${d.container}</No>
    <ISO>${d.iso}</ISO>
  </Container>
  <Seal>S-${Math.floor(Math.random() * 90000 + 10000)}</Seal>
</Gate>`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function AutoGatePage() {
  const { toast } = useToast();
  const [lanes, setLanes] = useState<Lane[]>(INITIAL_LANES);
  const [selectedLaneId, setSelectedLaneId] = useState<string>(INITIAL_LANES[0].id);
  const [events, setEvents] = useState<OCREvent[]>([]);
  const [inspectorEvent, setInspectorEvent] = useState<OCREvent | null>(null);
  const [streamPaused, setStreamPaused] = useState(false);

  const selected = lanes.find(l => l.id === selectedLaneId)!;

  // Prime the events feed with 8 recent mock events
  useEffect(() => {
    const initial: OCREvent[] = [];
    for (let i = 0; i < 8; i++) {
      const lane = lanes[i % lanes.length];
      const ev = generateEvent(lane);
      ev.ts = new Date(Date.now() - (i + 1) * (30_000 + Math.random() * 90_000)).toISOString();
      initial.push(ev);
    }
    setEvents(initial.sort((a, b) => b.ts.localeCompare(a.ts)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live stream tick — every 7s a random green/yellow lane produces a new event
  useEffect(() => {
    if (streamPaused) return;
    const t = setInterval(() => {
      const active = lanes.filter(l => l.status !== 'red');
      if (active.length === 0) return;
      const lane = active[Math.floor(Math.random() * active.length)];
      const ev = generateEvent(lane);
      setEvents(prev => [ev, ...prev].slice(0, 50));
      // Update lane stats
      setLanes(prev => prev.map(l => l.id === lane.id
        ? { ...l, lastEvent: ev.ts, eventCount24h: l.eventCount24h + 1 }
        : l));
    }, 7000);
    return () => clearInterval(t);
  }, [lanes, streamPaused]);

  const sendTestPayload = () => {
    const ev = generateEvent(selected);
    setEvents(prev => [ev, ...prev].slice(0, 50));
    setLanes(prev => prev.map(l => l.id === selected.id
      ? { ...l, lastEvent: ev.ts, eventCount24h: l.eventCount24h + 1, status: l.status === 'red' ? 'yellow' : l.status }
      : l));
    setInspectorEvent(ev);
    toast({ variant: 'success', title: 'Test payload sent', message: `${selected.code} · ${ev.plate.value} · ${ev.container?.value ?? '—'}` });
  };

  const rotateKey = () => {
    const newKey = genKey();
    setLanes(prev => prev.map(l => l.id === selected.id ? { ...l, webhookKey: newKey } : l));
    toast({ variant: 'warning', title: 'Webhook key rotated', message: `Update ${selected.code} on your camera edge box with the new key.` });
  };

  const updateSelected = (patch: Partial<Lane>) => {
    setLanes(prev => prev.map(l => l.id === selected.id ? { ...l, ...patch } : l));
  };

  const applyPreset = (preset: VendorPreset) => {
    const p = VENDOR_PRESETS[preset];
    updateSelected({ preset, mappings: p.mappings.slice(), format: p.format });
  };

  const totalEvents24h = lanes.reduce((s, l) => s + l.eventCount24h, 0);
  const matchedPct = useMemo(() => {
    if (events.length === 0) return 0;
    return (events.filter(e => e.matched === 'matched').length / events.length) * 100;
  }, [events]);

  const webhookUrl = `${WEBHOOK_BASE}?lane=${selected.code}&tenant=${TENANT}&key=${selected.webhookKey}`;

  return (
    <div className="gecko-stack gecko-stack-lg" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline" style={{ gap: 12 }}>
            <h1 className="gecko-page-title">Auto-Gate</h1>
            <span className="gecko-count-badge">{lanes.length} lanes</span>
            <span className="gecko-pill gecko-pill-success gecko-inline-row" style={{ gap: 4 }}>
              <span className="gecko-pulse-dot gecko-tone-success-bg" style={{ width: 6, height: 6, borderRadius: '50%' }} />
              {streamPaused ? 'Paused' : 'Listening'}
            </span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            OCR camera webhooks · plate + container number captured by your existing edge hardware (Camco / Cyclone / Hikvision) push directly into Gecko.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setStreamPaused(p => !p)}>
            <Icon name={streamPaused ? 'play' : 'pause'} size={14} />
            {streamPaused ? 'Resume stream' : 'Pause stream'}
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={sendTestPayload}>
            <Icon name="send" size={14} /> Send test payload
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="gecko-grid-4">
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="activity" size={16} /></div>
          <div className="gecko-kpi-tile-value">{totalEvents24h.toLocaleString()}</div>
          <div className="gecko-kpi-tile-label">Events last 24h</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="check" size={16} /></div>
          <div className="gecko-kpi-tile-value">{matchedPct.toFixed(0)}%</div>
          <div className="gecko-kpi-tile-label">Match rate (recent 50)</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="map" size={16} /></div>
          <div className="gecko-kpi-tile-value">{lanes.filter(l => l.status === 'green').length}/{lanes.length}</div>
          <div className="gecko-kpi-tile-label">Healthy lanes</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-warning"><Icon name="alertTriangle" size={16} /></div>
          <div className="gecko-kpi-tile-value">{lanes.filter(l => l.status !== 'green').length}</div>
          <div className="gecko-kpi-tile-label">Need attention</div>
        </div>
      </div>

      {/* Two columns: lane list + lane detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'flex-start' }}>

        {/* Lane list */}
        <div className="gecko-table-card">
          <div className="gecko-eyebrow" style={{ padding: '10px 14px', borderBottom: '1px solid var(--gecko-border)' }}>
            Gate Lanes
          </div>
          {lanes.map(l => {
            const active = l.id === selectedLaneId;
            const statusTone =
              l.status === 'green' ? 'var(--gecko-success-500)' :
              l.status === 'yellow' ? 'var(--gecko-warning-500)' :
                                      'var(--gecko-error-500)';
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLaneId(l.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 14px',
                  background: active ? 'var(--gecko-primary-50)' : 'transparent',
                  border: 'none',
                  borderLeft: `3px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                  borderBottom: '1px solid var(--gecko-border)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusTone, flexShrink: 0, boxShadow: l.status === 'green' ? `0 0 6px ${statusTone}` : undefined }} />
                <div className="gecko-flex-1">
                  <div className="gecko-row" style={{ gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 700, color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>{l.code}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>{l.direction === 'IN' ? '↓ IN' : '↑ OUT'}</span>
                  </div>
                  <div className="gecko-cell-meta">
                    {VENDOR_PRESETS[l.preset].label.split(' ')[0]} · {l.eventCount24h.toLocaleString()} events / 24h
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Lane detail */}
        <div className="gecko-stack" style={{ gap: 14 }}>

          {/* Lane header */}
          <div className="gecko-card gecko-card-padded">
            <div className="gecko-row" style={{ gap: 12, marginBottom: 14 }}>
              <Icon name="map" size={20} style={{ color: 'var(--gecko-primary-600)' }} />
              <div className="gecko-flex-1">
                <div className="gecko-row" style={{ gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{selected.code}</h2>
                  <span className={`gecko-pill gecko-pill-${selected.status === 'green' ? 'success' : selected.status === 'yellow' ? 'warning' : 'danger'}`}>
                    {selected.status === 'green' ? '● HEALTHY' : selected.status === 'yellow' ? '⚠ DEGRADED' : '✕ OFFLINE'}
                  </span>
                  <span className="gecko-pill gecko-pill-info" style={{ fontSize: 10 }}>{selected.direction === 'IN' ? 'Inbound ↓' : 'Outbound ↑'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
                  Last event: {selected.lastEvent ? formatDateTime(selected.lastEvent) : 'never'}
                  {' · '}{selected.eventCount24h.toLocaleString()} events in last 24h
                </div>
              </div>
            </div>

            {/* Vendor preset */}
            <div className="gecko-grid-3" style={{ gap: 14 }}>
              <div className="gecko-field">
                <div className="gecko-field-label">Vendor preset</div>
                <select className="gecko-select" value={selected.preset} onChange={e => applyPreset(e.target.value as VendorPreset)}>
                  {(Object.keys(VENDOR_PRESETS) as VendorPreset[]).map(k => (
                    <option key={k} value={k}>{VENDOR_PRESETS[k].label}</option>
                  ))}
                </select>
              </div>
              <div className="gecko-field">
                <div className="gecko-field-label">Payload format</div>
                <div className="gecko-segctrl">
                  <button className={`gecko-segctrl-btn ${selected.format === 'json' ? 'gecko-segctrl-btn-active' : ''}`} onClick={() => updateSelected({ format: 'json' })}>JSON</button>
                  <button className={`gecko-segctrl-btn ${selected.format === 'xml' ? 'gecko-segctrl-btn-active' : ''}`} onClick={() => updateSelected({ format: 'xml' })}>XML</button>
                </div>
              </div>
              <div className="gecko-field">
                <div className="gecko-field-label">Authentication</div>
                <select className="gecko-select" value={selected.authMode} onChange={e => updateSelected({ authMode: e.target.value as AuthMode })}>
                  <option value="none">None (not recommended)</option>
                  <option value="apikey">API key (in header)</option>
                  <option value="hmac">HMAC-SHA256 signature</option>
                </select>
              </div>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="gecko-table-card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)' }}>
              <div className="gecko-section-header-title">Webhook endpoint</div>
              <div className="gecko-section-header-subtitle">
                Configure this URL in your camera/edge box. Inbound POST → Gecko ingests, matches against open appointments, opens barrier (via outbound webhook).
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div className="gecko-row" style={{ alignItems: 'stretch' }}>
                <input
                  className="gecko-input gecko-flex-1"
                  readOnly
                  value={webhookUrl}
                  style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, color: 'var(--gecko-text-primary)', background: 'var(--gecko-bg-subtle)' }}
                />
                <button
                  className="gecko-btn gecko-btn-outline"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({ variant: 'info', title: 'Copied', message: 'Webhook URL copied to clipboard.' });
                  }}
                >
                  <Icon name="copy" size={14} /> Copy
                </button>
                <button className="gecko-btn gecko-btn-ghost" onClick={rotateKey} title="Rotate webhook key">
                  <Icon name="refresh" size={14} /> Rotate key
                </button>
              </div>

              {selected.authMode === 'apikey' && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)' }}>
                  <strong>API key auth:</strong> include header <code style={{ fontFamily: 'var(--gecko-font-mono)' }}>X-Gecko-Key: {selected.webhookKey}</code> on each POST.
                </div>
              )}
              {selected.authMode === 'hmac' && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)' }}>
                  <strong>HMAC-SHA256:</strong> sign the payload body with the shared key. Include header <code style={{ fontFamily: 'var(--gecko-font-mono)' }}>X-Gecko-Signature: sha256=&lt;hex&gt;</code>.
                </div>
              )}
            </div>
          </div>

          {/* Field mapping */}
          <div className="gecko-table-card">
            <div className="gecko-row gecko-row-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)' }}>
              <div>
                <div className="gecko-section-header-title">Field mapping</div>
                <div className="gecko-section-header-subtitle">Vendor field paths → Gecko canonical fields. Preset loads sensible defaults — customize as needed.</div>
              </div>
              <button
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                onClick={() => updateSelected({ mappings: [...selected.mappings, { vendorPath: '', geckoField: GECKO_FIELDS[0] }] })}
              >
                <Icon name="plus" size={14} /> Add row
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 32px', gap: 8, alignItems: 'center', marginBottom: 6, padding: '0 4px' }}>
                <div className="gecko-eyebrow">Vendor field path</div>
                <div />
                <div className="gecko-eyebrow">Gecko field</div>
                <div />
              </div>
              {selected.mappings.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 32px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    className="gecko-input gecko-input-sm"
                    value={m.vendorPath}
                    onChange={e => {
                      const next = selected.mappings.slice();
                      next[i] = { ...m, vendorPath: e.target.value };
                      updateSelected({ mappings: next });
                    }}
                    placeholder={selected.format === 'xml' ? 'e.g. Gate/Plate' : 'e.g. plate.value'}
                    style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}
                  />
                  <Icon name="arrowRight" size={13} style={{ color: 'var(--gecko-text-disabled)', justifySelf: 'center' }} />
                  <select
                    className="gecko-select gecko-input-sm"
                    value={m.geckoField}
                    onChange={e => {
                      const next = selected.mappings.slice();
                      next[i] = { ...m, geckoField: e.target.value };
                      updateSelected({ mappings: next });
                    }}
                  >
                    {GECKO_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <button
                    onClick={() => updateSelected({ mappings: selected.mappings.filter((_, idx) => idx !== i) })}
                    className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                    aria-label="Remove mapping row"
                    title="Remove"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              {selected.mappings.length === 0 && (
                <div style={{ padding: '14px 4px', fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic', textAlign: 'center' }}>
                  No mappings configured. Pick a vendor preset above to load defaults, or click <strong>Add row</strong> to define your own.
                </div>
              )}
            </div>
          </div>

          {/* Outbound webhook hint */}
          <div style={{ padding: 14, background: 'var(--gecko-bg-subtle)', border: '1px dashed var(--gecko-border)', borderRadius: 10, fontSize: 12, color: 'var(--gecko-text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--gecko-text-primary)' }}>Outbound webhook (barrier control):</strong> when Gecko matches an inbound OCR event to an open appointment, we POST back to your gate controller to open the barrier. Configure the target URL in <strong>System Parameters → Gate Operations</strong>.
          </div>
        </div>
      </div>

      {/* Live events feed */}
      <div className="gecko-table-card">
        <div className="gecko-row gecko-row-between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)' }}>
          <div>
            <div className="gecko-section-header-title gecko-row">
              <Icon name="activity" size={14} style={{ color: 'var(--gecko-primary-600)' }} />
              Live events feed
            </div>
            <div className="gecko-section-header-subtitle">Most recent {events.length} OCR events across all lanes · click any row to inspect the raw payload</div>
          </div>
          <span className="gecko-cell-meta">
            Auto-refresh every 7s {streamPaused && '(paused)'}
          </span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                <th>Time</th>
                <th>Lane</th>
                <th>Event</th>
                <th>Plate</th>
                <th>Container</th>
                <th>ISO</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="gecko-row-clickable" onClick={() => setInspectorEvent(ev)}>
                  <td className="gecko-text-mono gecko-cell-meta">
                    {new Date(ev.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="gecko-text-mono" style={{ fontWeight: 700 }}>{ev.laneCode}</td>
                  <td><span className="gecko-pill gecko-pill-info" style={{ fontSize: 9 }}>{ev.eventType}</span></td>
                  <td className="gecko-text-mono" style={{ fontWeight: 700 }}>
                    {ev.plate.value}
                    <span style={{ marginLeft: 6, fontSize: 9, color: ev.plate.confidence >= 0.9 ? 'var(--gecko-success-600)' : 'var(--gecko-warning-600)', fontWeight: 600 }}>
                      {(ev.plate.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="gecko-text-mono" style={{ fontWeight: 700 }}>
                    {ev.container?.value ?? '—'}
                    {ev.container && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: ev.container.confidence >= 0.9 ? 'var(--gecko-success-600)' : 'var(--gecko-warning-600)', fontWeight: 600 }}>
                        {(ev.container.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="gecko-text-mono">{ev.container?.iso ?? '—'}</td>
                  <td>
                    {ev.matched === 'matched' && <span className="gecko-pill gecko-pill-success" style={{ fontSize: 9 }}>✓ {ev.matchedApt}</span>}
                    {ev.matched === 'unmatched' && <span className="gecko-pill gecko-pill-warning" style={{ fontSize: 9 }}>No appointment</span>}
                    {ev.matched === 'parse-error' && <span className="gecko-pill gecko-pill-danger" style={{ fontSize: 9 }}>Parse error</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector drawer */}
      {inspectorEvent && (
        <>
          <div
            onClick={() => setInspectorEvent(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 50 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '94vw',
            background: 'var(--gecko-bg-surface)', borderLeft: '1px solid var(--gecko-border)',
            zIndex: 51, display: 'flex', flexDirection: 'column',
            boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.18)',
            animation: 'gecko-slide-in-right 220ms ease',
          }}>
            <div className="gecko-row gecko-row-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)' }}>
              <div>
                <div className="gecko-cell-meta" style={{ fontFamily: 'var(--gecko-font-mono)' }}>{inspectorEvent.id}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{inspectorEvent.eventType} · {inspectorEvent.laneCode}</div>
              </div>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => setInspectorEvent(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="gecko-flex-1" style={{ overflowY: 'auto', padding: 20 }}>
              {/* Decoded fields */}
              <div style={{ marginBottom: 18 }}>
                <div className="gecko-eyebrow gecko-mb-2">Decoded fields</div>
                <div className="gecko-grid-2" style={{ gap: 10 }}>
                  <Field label="Timestamp" value={formatDateTime(inspectorEvent.ts)} />
                  <Field label="Lane" value={inspectorEvent.laneCode} mono />
                  <Field label="Plate" value={`${inspectorEvent.plate.value} (${(inspectorEvent.plate.confidence * 100).toFixed(0)}%)`} mono />
                  {inspectorEvent.container && <Field label="Container" value={`${inspectorEvent.container.value} (${(inspectorEvent.container.confidence * 100).toFixed(0)}%)`} mono />}
                  {inspectorEvent.container?.iso && <Field label="ISO" value={inspectorEvent.container.iso} mono />}
                  <Field label="Match" value={
                    inspectorEvent.matched === 'matched' ? `✓ ${inspectorEvent.matchedApt}` :
                    inspectorEvent.matched === 'unmatched' ? 'No matching appointment' :
                                                            'Parse error'
                  } />
                </div>
              </div>

              {/* Raw payload */}
              <div>
                <div className="gecko-eyebrow gecko-mb-2">Raw payload</div>
                <pre style={{
                  margin: 0, padding: 14,
                  background: '#0f172a', color: '#e2e8f0',
                  fontFamily: 'var(--gecko-font-mono)', fontSize: 11,
                  borderRadius: 8, overflow: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  lineHeight: 1.6,
                }}>{inspectorEvent.rawPayload}</pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="gecko-eyebrow" style={{ color: 'var(--gecko-text-disabled)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
