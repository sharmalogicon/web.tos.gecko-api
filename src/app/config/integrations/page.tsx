"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

// ════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

type ChannelId = 'line' | 'whatsapp' | 'email' | 'telegram' | 'zalo' | 'viber' | 'sms' | 'slack' | 'teams';
type EventCategory = 'customer' | 'internal' | 'both';
type Locale = 'en' | 'th';
type Tab = 'channels' | 'triggers' | 'previews';

interface EmailConfig  { host: string; port: number; username: string; password: string; fromEmail: string; fromName: string; encryption: 'NONE' | 'TLS' | 'SSL'; recipients: string; }
interface LineConfig   { channelAccessToken: string; channelSecret: string; connectionMethod: 'qr' | 'id'; lineId: string; oaName: string; }
interface WhatsAppConfig { phoneNumberId: string; accessToken: string; businessName: string; verifiedNumber: string; }
interface SlackConfig  { webhookUrl: string; botToken: string; defaultChannel: string; workspaceName: string; }

interface ChannelState {
  enabled: boolean;
  email?:    EmailConfig;
  line?:     LineConfig;
  whatsapp?: WhatsAppConfig;
  slack?:    SlackConfig;
}

interface IntegrationsConfig {
  version: 1;
  channels: Partial<Record<ChannelId, ChannelState>>;
  triggers: Record<string, Partial<Record<ChannelId, boolean>>>; // event_id → channel → enabled
  savedAt:  string | null;
}

const STORAGE_KEY = 'gecko.integrations.lcb';

interface ChannelMeta {
  id: ChannelId;
  label: string;
  subtitle: string;
  iconFill: string;
  iconText: string;
  brandColor: string;
  group: 'customer' | 'team';
  phase: number; // 1 = ship now, 3/4 = placeholder
}

const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  line:     { id: 'line',     label: 'LINE Official Account', subtitle: 'Thailand · Japan · Taiwan — preferred customer channel in TH',     iconFill: '#06C755', iconText: '#fff', brandColor: '#06C755', group: 'customer', phase: 1 },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp Business',     subtitle: 'Malaysia · Indonesia · Singapore · Philippines',                    iconFill: '#25D366', iconText: '#fff', brandColor: '#25D366', group: 'customer', phase: 1 },
  email:    { id: 'email',    label: 'Email · SMTP',          subtitle: 'Universal fallback — works everywhere',                              iconFill: '#3B82F6', iconText: '#fff', brandColor: '#3B82F6', group: 'customer', phase: 1 },
  telegram: { id: 'telegram', label: 'Telegram',              subtitle: 'Some operators, MENA crossover',                                     iconFill: '#26A5E4', iconText: '#fff', brandColor: '#26A5E4', group: 'customer', phase: 4 },
  zalo:     { id: 'zalo',     label: 'Zalo OA',               subtitle: 'Vietnam — primary messaging app',                                    iconFill: '#0068FF', iconText: '#fff', brandColor: '#0068FF', group: 'customer', phase: 4 },
  viber:    { id: 'viber',    label: 'Viber Business',        subtitle: 'Philippines · MENA · Eastern Europe',                                iconFill: '#7360F2', iconText: '#fff', brandColor: '#7360F2', group: 'customer', phase: 4 },
  sms:      { id: 'sms',      label: 'SMS',                   subtitle: 'Twilio + regional gateway — critical fallback',                      iconFill: '#64748B', iconText: '#fff', brandColor: '#64748B', group: 'customer', phase: 3 },
  slack:    { id: 'slack',    label: 'Slack',                 subtitle: 'Internal ops team alerts',                                           iconFill: '#4A154B', iconText: '#fff', brandColor: '#4A154B', group: 'team',     phase: 1 },
  teams:    { id: 'teams',    label: 'Microsoft Teams',       subtitle: 'Enterprise tenants',                                                 iconFill: '#5059C9', iconText: '#fff', brandColor: '#5059C9', group: 'team',     phase: 4 },
};

interface EventMeta { id: string; label: string; description: string; category: EventCategory; }

const EVENTS: EventMeta[] = [
  { id: 'booking.confirmed',            label: 'Booking confirmed',                description: 'Customer booking validated and ready for action',                    category: 'customer' },
  { id: 'container.ready_for_pickup',   label: 'Container ready for pickup',       description: 'Laden container released and positioned for collection',            category: 'customer' },
  { id: 'gate_appointment.confirmed',   label: 'Gate appointment confirmed',       description: 'Trucker booked a gate slot · sends confirmation + QR code',        category: 'customer' },
  { id: 'gate_appointment.no_show',     label: 'Gate appointment no-show',         description: 'Slot expired without trucker arrival',                              category: 'both' },
  { id: 'container.gated_out',          label: 'Container gated out',              description: 'Unit physically departed the facility',                             category: 'customer' },
  { id: 'storage_warning.day_4',        label: 'Storage warning (day 4)',          description: 'Free time ending in 24h — customer reminder',                       category: 'customer' },
  { id: 'storage_warning.day_7',        label: 'Storage charges accruing',         description: 'Daily D&D rate now applies',                                        category: 'customer' },
  { id: 'customs_hold.applied',         label: 'Customs hold applied',             description: 'Container blocked by customs — pickup paused',                      category: 'both' },
  { id: 'customs_hold.released',        label: 'Customs hold released',            description: 'Customs cleared — container ready for collection',                  category: 'customer' },
  { id: 'empty_storage.monthly',        label: 'Monthly empty storage statement',  description: 'Carrier statement for empties parked over the month',               category: 'customer' },
  { id: 'edi.batch_failed',             label: 'EDI batch failed',                 description: 'COPARN / CODECO / BAPLIE batch errored — ops attention',            category: 'internal' },
  { id: 'system.dlq_threshold',         label: 'Message DLQ above threshold',      description: 'Dead-letter queue depth exceeded operational threshold',            category: 'internal' },
  { id: 'security.suspicious_login',    label: 'Suspicious login detected',        description: 'Unusual sign-in pattern flagged by auth provider',                  category: 'internal' },
];

// Default triggers — what's enabled out of the box
const DEFAULT_TRIGGERS: Record<string, Partial<Record<ChannelId, boolean>>> = {
  'booking.confirmed':            { line: true,  email: true },
  'container.ready_for_pickup':   { line: true,  whatsapp: true, email: true },
  'gate_appointment.confirmed':   { line: true,  whatsapp: true },
  'gate_appointment.no_show':     { line: true,  email: true, slack: true },
  'container.gated_out':          { email: true },
  'storage_warning.day_4':        { line: true,  whatsapp: true, email: true },
  'storage_warning.day_7':        { line: true,  whatsapp: true, email: true },
  'customs_hold.applied':         { line: true,  email: true, slack: true },
  'customs_hold.released':        { line: true,  email: true },
  'empty_storage.monthly':        { email: true },
  'edi.batch_failed':             { slack: true, email: true },
  'system.dlq_threshold':         { slack: true },
  'security.suspicious_login':    { slack: true, email: true },
};

const DEFAULT_CONFIG: IntegrationsConfig = {
  version: 1,
  channels: {
    email: { enabled: true, email: { host: 'smtp.gmail.com', port: 587, username: 'notifications@gecko-api.com', password: '', fromEmail: 'notifications@gecko-api.com', fromName: 'Gecko TOS · LCB Operations', encryption: 'TLS', recipients: 'alerts@lcb-icd.co.th\nops@lcb-icd.co.th' } },
    line:  { enabled: true, line:  { channelAccessToken: '', channelSecret: '', connectionMethod: 'qr', lineId: '', oaName: '@gecko-lcb-ops' } },
    whatsapp: { enabled: false, whatsapp: { phoneNumberId: '', accessToken: '', businessName: 'Gecko TOS · LCB', verifiedNumber: '+66 38 408 408' } },
    slack: { enabled: true,  slack: { webhookUrl: '', botToken: '', defaultChannel: '#gecko-lcb-ops', workspaceName: 'gecko-lcb' } },
  },
  triggers: DEFAULT_TRIGGERS,
  savedAt: null,
};

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE MESSAGE TEMPLATES (EN + TH) — used by Previews tab
// ════════════════════════════════════════════════════════════════════════════

interface TemplateContent {
  title: string;
  body: string;
  containerNo: string;
  bookingNo: string;
  yardSpot: string;
  iso: string;
  freeTimeUntil: string;
  customerName: string;
  actions: string[];  // labels for action buttons
}

const TEMPLATES: Record<string, Record<Locale, TemplateContent>> = {
  'container.ready_for_pickup': {
    en: {
      title:        'Container ready for pickup',
      body:         'Your container is now positioned and available for collection at Laem Chabang ICD.',
      containerNo:  'MAEU8842710',
      bookingNo:    'EGLV149602390729',
      yardSpot:     'A-12-3',
      iso:          '20GP',
      freeTimeUntil:'18 May 2026',
      customerName: 'TCL Electronics (Thailand)',
      actions:      ['Book gate slot', 'View booking'],
    },
    th: {
      title:        'ตู้คอนเทนเนอร์พร้อมรับ',
      body:         'ตู้ของท่านพร้อมรับแล้วที่ ICD แหลมฉบัง',
      containerNo:  'MAEU8842710',
      bookingNo:    'EGLV149602390729',
      yardSpot:     'A-12-3',
      iso:          '20GP',
      freeTimeUntil:'18 พ.ค. 2569',
      customerName: 'TCL อิเล็กทรอนิกส์ (ประเทศไทย)',
      actions:      ['จองช่องประตู', 'ดูใบจอง'],
    },
  },
  'gate_appointment.confirmed': {
    en: {
      title:        'Gate appointment confirmed',
      body:         'Your gate slot is locked. Please arrive 5 minutes before the slot start.',
      containerNo:  'COSU4129877',
      bookingNo:    'APT-2605-0148',
      yardSpot:     'Lane 3 · 09:00–09:30',
      iso:          '20GP',
      freeTimeUntil:'13 May 2026 · 09:00',
      customerName: 'Thai Logistics Co.',
      actions:      ['Add to calendar', 'Reschedule'],
    },
    th: {
      title:        'ยืนยันการจองช่องประตู',
      body:         'ช่องประตูของท่านถูกจองแล้ว กรุณามาถึงก่อนเวลา 5 นาที',
      containerNo:  'COSU4129877',
      bookingNo:    'APT-2605-0148',
      yardSpot:     'ช่อง 3 · 09:00–09:30',
      iso:          '20GP',
      freeTimeUntil:'13 พ.ค. 2569 · 09:00',
      customerName: 'ไทย โลจิสติกส์',
      actions:      ['เพิ่มในปฏิทิน', 'เปลี่ยนเวลา'],
    },
  },
  'storage_warning.day_4': {
    en: {
      title:        'Free time ending soon',
      body:         'Storage charges will start tomorrow if the container is not collected. Please plan pickup.',
      containerNo:  'TGHU5520403',
      bookingNo:    'EGLV149602390729',
      yardSpot:     'A-08-1',
      iso:          '40HC',
      freeTimeUntil:'14 May 2026',
      customerName: 'Siam Cement (SCG)',
      actions:      ['Book gate slot', 'Extend free time'],
    },
    th: {
      title:        'ฟรีไทม์ใกล้หมด',
      body:         'ค่าฝากตู้จะเริ่มคิดในวันพรุ่งนี้ ถ้ายังไม่มารับตู้ กรุณาจัดการรับตู้ด่วน',
      containerNo:  'TGHU5520403',
      bookingNo:    'EGLV149602390729',
      yardSpot:     'A-08-1',
      iso:          '40HC',
      freeTimeUntil:'14 พ.ค. 2569',
      customerName: 'ปูนซิเมนต์ไทย (SCG)',
      actions:      ['จองช่องประตู', 'ขอขยายฟรีไทม์'],
    },
  },
  'edi.batch_failed': {
    en: {
      title:        'EDI batch 2045 failed · ONE Line',
      body:         '14 messages sent · 12 accepted · 2 rejected. Two container records need attention.',
      containerNo:  'HLXU8832210 · check digit error\nTCKU5541129 · ISO type code missing',
      bookingNo:    'Batch 2045',
      yardSpot:     'EDI Hub · 14:30',
      iso:          'COPARN',
      freeTimeUntil:'—',
      customerName: 'ONE Line · ops@one-line.com',
      actions:      ['Open batch', 'Retry rejected'],
    },
    th: {
      title:        'EDI batch 2045 ล้มเหลว · ONE Line',
      body:         'ส่งทั้งหมด 14 รายการ · สำเร็จ 12 · ถูกปฏิเสธ 2 ต้องแก้ไข',
      containerNo:  'HLXU8832210 · check digit ผิด\nTCKU5541129 · ไม่มี ISO type',
      bookingNo:    'Batch 2045',
      yardSpot:     'EDI Hub · 14:30',
      iso:          'COPARN',
      freeTimeUntil:'—',
      customerName: 'ONE Line · ops@one-line.com',
      actions:      ['เปิดดู batch', 'ส่งใหม่'],
    },
  },
};

const PREVIEW_EVENTS = Object.keys(TEMPLATES);

// ════════════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [loaded, setLoaded]   = useState(false);
  const [tab, setTab]         = useState<Tab>('channels');
  const [config, setConfig]   = useState<IntegrationsConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<IntegrationsConfig>(DEFAULT_CONFIG);
  const [expandedChannel, setExpandedChannel] = useState<ChannelId | null>('email');

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as IntegrationsConfig;
        // Merge with defaults so any new channels added later inherit
        const merged: IntegrationsConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          channels: { ...DEFAULT_CONFIG.channels, ...parsed.channels },
          triggers: { ...DEFAULT_CONFIG.triggers, ...parsed.triggers },
        };
        setConfig(merged);
        setSavedConfig(merged);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);

  const stats = useMemo(() => {
    const activeChannels = (Object.keys(config.channels) as ChannelId[]).filter(c => config.channels[c]?.enabled && CHANNEL_META[c].phase === 1).length;
    const activeTriggers = Object.values(config.triggers).reduce((n, row) => n + Object.values(row).filter(Boolean).length, 0);
    return { activeChannels, activeTriggers };
  }, [config]);

  const updateChannel = (id: ChannelId, patch: Partial<ChannelState>) => {
    setConfig(c => ({
      ...c,
      channels: { ...c.channels, [id]: { ...c.channels[id], ...patch } as ChannelState },
    }));
  };

  const updateChannelField = <K extends 'email' | 'line' | 'whatsapp' | 'slack'>(id: ChannelId, key: K, patch: Partial<NonNullable<ChannelState[K]>>) => {
    setConfig(c => {
      const existing = c.channels[id] || { enabled: false };
      const existingField = (existing[key] || {}) as NonNullable<ChannelState[K]>;
      return {
        ...c,
        channels: {
          ...c.channels,
          [id]: {
            ...existing,
            [key]: { ...existingField, ...patch },
          } as ChannelState,
        },
      };
    });
  };

  const toggleTrigger = (eventId: string, channelId: ChannelId) => {
    setConfig(c => {
      const row = c.triggers[eventId] || {};
      return {
        ...c,
        triggers: { ...c.triggers, [eventId]: { ...row, [channelId]: !row[channelId] } },
      };
    });
  };

  const onSave = () => {
    const now = new Date().toISOString();
    const next = { ...config, savedAt: now };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedConfig(next);
      setConfig(next);
      toast({ variant: 'success', title: 'Saved', message: 'Integrations configuration updated.' });
    } catch {
      toast({ variant: 'danger', title: 'Save failed', message: 'Browser storage unavailable.' });
    }
  };

  const onDiscard = () => {
    setConfig(savedConfig);
    toast({ variant: 'info', title: 'Changes discarded', message: 'Reverted to last saved state.' });
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `gecko-integrations-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ variant: 'success', title: 'Exported', message: 'Downloaded JSON of current configuration.' });
  };

  if (!loaded) return null;

  return (
    <div className="gecko-stack" style={{ gap: 14, paddingBottom: isDirty ? 80 : 0 }}>

      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <h1 className="gecko-page-title">Notifications</h1>
            {isDirty && (
              <span className="gecko-pill gecko-pill-warning">Unsaved changes</span>
            )}
            {!isDirty && config.savedAt && (
              <span className="gecko-pill gecko-pill-success">Saved {new Date(config.savedAt).toLocaleTimeString()}</span>
            )}
          </div>
          <div className="gecko-page-subtitle">
            Configure how Gecko reaches your customers, truckers, and ops team — Laem Chabang ICD
          </div>
        </div>

        <div className="gecko-page-header-actions">
          <button onClick={onExport} className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="download" size={13} />Export JSON
          </button>
          {isDirty && (
            <button onClick={onDiscard} className="gecko-btn gecko-btn-ghost gecko-btn-sm">
              Discard
            </button>
          )}
          <button onClick={onSave} disabled={!isDirty} className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="check" size={13} />Save Changes
          </button>
        </div>
      </div>

      {/* ── Quick stats strip ───────────────────────────────────────────── */}
      <div className="gecko-grid-4" style={{ gap: 10 }}>
        <StatTile icon="bell"  label="Active channels"  value={stats.activeChannels} tone="primary" />
        <StatTile icon="zap"   label="Active triggers"  value={stats.activeTriggers} tone="success" />
        <StatTile icon="clock" label="Delivery mode"    value="Realtime"             tone="info" />
        <StatTile icon="globe" label="Locales"          value="EN · TH"              tone="neutral" />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="gecko-segctrl" style={{ width: 'fit-content' }}>
        <TabButton active={tab === 'channels'} onClick={() => setTab('channels')} icon="bell"   label="Channels" />
        <TabButton active={tab === 'triggers'} onClick={() => setTab('triggers')} icon="zap"    label="Triggers" />
        <TabButton active={tab === 'previews'} onClick={() => setTab('previews')} icon="eye"    label="Message previews" />
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {tab === 'channels' && (
        <ChannelsTab
          config={config}
          updateChannel={updateChannel}
          updateChannelField={updateChannelField}
          expandedChannel={expandedChannel}
          setExpandedChannel={setExpandedChannel}
          onTestSend={(label) => toast({ variant: 'success', title: 'Test queued', message: `${label} — would deliver in real environment.` })}
        />
      )}
      {tab === 'triggers' && (
        <TriggersTab config={config} toggleTrigger={toggleTrigger} />
      )}
      {tab === 'previews' && (
        <PreviewsTab config={config} />
      )}

      {/* ── Sticky unsaved footer ────────────────────────────────────────── */}
      {isDirty && (
        <div className="gecko-sticky-action-bar">
          <div className="gecko-sticky-action-bar-msg">
            <Icon name="warning" size={16} />
            <span>You have unsaved changes</span>
          </div>
          <div className="gecko-sticky-action-bar-actions">
            <button onClick={onDiscard} className="gecko-btn gecko-btn-ghost gecko-btn-sm">Discard</button>
            <button onClick={onSave} className="gecko-btn gecko-btn-primary gecko-btn-sm">
              <Icon name="check" size={13} />Save all changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function StatTile({ icon, label, value, tone = 'primary' }: { icon: string; label: string; value: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}>
        <Icon name={icon} size={17} />
      </div>
      <div>
        <div className="gecko-kpi-tile-value">{value}</div>
        <div className="gecko-kpi-tile-label">{label}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} className={`gecko-segctrl-btn${active ? ' gecko-segctrl-btn-active' : ''} gecko-inline-row`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!on); }}
      className={`gecko-toggle${on ? ' gecko-toggle-on' : ''}`}
    >
      <span className="gecko-toggle-thumb" />
    </button>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="gecko-field">
      <label className={`gecko-field-label${required ? ' gecko-field-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div className="gecko-field-hint">{hint}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHANNELS TAB
// ════════════════════════════════════════════════════════════════════════════

function ChannelsTab({ config, updateChannel, updateChannelField, expandedChannel, setExpandedChannel, onTestSend }: {
  config: IntegrationsConfig;
  updateChannel: (id: ChannelId, patch: Partial<ChannelState>) => void;
  updateChannelField: <K extends 'email' | 'line' | 'whatsapp' | 'slack'>(id: ChannelId, key: K, patch: Partial<NonNullable<ChannelState[K]>>) => void;
  expandedChannel: ChannelId | null;
  setExpandedChannel: (id: ChannelId | null) => void;
  onTestSend: (label: string) => void;
}) {
  const customerChannels = (Object.keys(CHANNEL_META) as ChannelId[]).filter(id => CHANNEL_META[id].group === 'customer');
  const teamChannels     = (Object.keys(CHANNEL_META) as ChannelId[]).filter(id => CHANNEL_META[id].group === 'team');

  return (
    <div className="gecko-stack" style={{ gap: 16 }}>

      <SectionHeader title="Customer Notification Channels" subtitle="How customers, shippers, and truckers hear from Gecko" />
      <div className="gecko-grid-2" style={{ gap: 10, alignItems: 'start' }}>
        {customerChannels.map(id => (
          <div key={id} style={{ minWidth: 0 }}>
            <ChannelCard
              meta={CHANNEL_META[id]}
              state={config.channels[id]}
              expanded={expandedChannel === id}
              onToggleExpand={() => setExpandedChannel(expandedChannel === id ? null : id)}
              onToggle={(v) => updateChannel(id, { enabled: v })}
              updateChannelField={updateChannelField}
              onTestSend={onTestSend}
            />
          </div>
        ))}
      </div>

      <SectionHeader title="Team collaboration" subtitle="Internal alerts to your operations team" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, alignItems: 'start' }}>
        {teamChannels.map(id => (
          <div key={id} style={{ minWidth: 0 }}>
            <ChannelCard
              meta={CHANNEL_META[id]}
              state={config.channels[id]}
              expanded={expandedChannel === id}
              onToggleExpand={() => setExpandedChannel(expandedChannel === id ? null : id)}
              onToggle={(v) => updateChannel(id, { enabled: v })}
              updateChannelField={updateChannelField}
              onTestSend={onTestSend}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="gecko-section-header-title">{title}</div>
      <div className="gecko-section-header-subtitle">{subtitle}</div>
    </div>
  );
}

function ChannelCard({ meta, state, expanded, onToggleExpand, onToggle, updateChannelField, onTestSend }: {
  meta: ChannelMeta;
  state: ChannelState | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: (v: boolean) => void;
  updateChannelField: <K extends 'email' | 'line' | 'whatsapp' | 'slack'>(id: ChannelId, key: K, patch: Partial<NonNullable<ChannelState[K]>>) => void;
  onTestSend: (label: string) => void;
}) {
  const enabled    = state?.enabled ?? false;
  const isPlaceholder = meta.phase > 1;

  // The header is a click-to-expand region. It contains the ToggleSwitch (a <button>),
  // so the header itself cannot be a <button> — nested buttons are invalid HTML and
  // trigger a React hydration error. Use a div with role="button" + keyboard support.
  const handleHeaderClick = isPlaceholder ? undefined : onToggleExpand;
  const handleHeaderKey = (e: React.KeyboardEvent) => {
    if (isPlaceholder) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); }
  };

  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden', borderColor: enabled && !isPlaceholder ? meta.brandColor + '40' : undefined }}>
      <div
        role={isPlaceholder ? undefined : 'button'}
        tabIndex={isPlaceholder ? -1 : 0}
        aria-expanded={isPlaceholder ? undefined : expanded}
        aria-disabled={isPlaceholder || undefined}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKey}
        title={isPlaceholder ? 'Available for Enterprise tenants — contact your account manager to enable.' : undefined}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 10, alignItems: 'center',
          padding: '14px 16px', background: expanded ? meta.brandColor + '0d' : 'var(--gecko-bg-surface)',
          cursor: isPlaceholder ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
          opacity: isPlaceholder ? 0.72 : 1,
          outline: 'none',
        }}
      >
        {/* Brand icon */}
        <div style={{ width: 38, height: 38, borderRadius: 9, background: meta.iconFill, color: meta.iconText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, letterSpacing: '0.03em' }}>
          <ChannelBrandIcon channel={meta.id} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</div>
          <div className="gecko-cell-meta gecko-truncate">{meta.subtitle}</div>
        </div>

        {/* Status pill */}
        {isPlaceholder ? (
          <span className="gecko-pill gecko-pill-violet">
            <Icon name="lock" size={9} />ENTERPRISE
          </span>
        ) : enabled ? (
          <span className="gecko-pill gecko-pill-success">● ACTIVE</span>
        ) : (
          <span className="gecko-pill gecko-pill-neutral">○ NOT SET</span>
        )}

        <ToggleSwitch on={enabled} disabled={isPlaceholder} onChange={onToggle} />

        {!isPlaceholder && (
          <Icon name="chevronDown" size={14} style={{ color: 'var(--gecko-text-secondary)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
        )}
        {isPlaceholder && <span style={{ width: 14 }} />}
      </div>

      {expanded && !isPlaceholder && (
        <div style={{ padding: '18px 22px 22px', background: 'var(--gecko-bg-subtle)', borderTop: '1px solid var(--gecko-border)' }}>
          {meta.id === 'email'    && <EmailForm    state={state} update={(patch) => updateChannelField('email',    'email',    patch)} onTest={() => onTestSend('Email test')} />}
          {meta.id === 'line'     && <LineForm     state={state} update={(patch) => updateChannelField('line',     'line',     patch)} onTest={() => onTestSend('LINE test message')} brand={meta} />}
          {meta.id === 'whatsapp' && <WhatsAppForm state={state} update={(patch) => updateChannelField('whatsapp', 'whatsapp', patch)} onTest={() => onTestSend('WhatsApp test message')} />}
          {meta.id === 'slack'    && <SlackForm    state={state} update={(patch) => updateChannelField('slack',    'slack',    patch)} onTest={() => onTestSend('Slack test message')} />}
        </div>
      )}
    </section>
  );
}

function ChannelBrandIcon({ channel }: { channel: ChannelId }) {
  // Simple letter marks — production replaces with real SVG brand glyphs (LINE, WhatsApp, etc.)
  const letter: Record<ChannelId, string> = {
    line: 'L', whatsapp: 'W', email: '@', telegram: '✈', zalo: 'Z', viber: 'V', sms: '#', slack: 'S', teams: 'T',
  };
  return <span>{letter[channel]}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-channel forms

function EmailForm({ state, update, onTest }: { state: ChannelState | undefined; update: (p: Partial<EmailConfig>) => void; onTest: () => void }) {
  const cfg = state?.email!;
  return (
    <div className="gecko-stack" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="SMTP host" required>
          <input className="gecko-input gecko-input-sm" value={cfg.host} onChange={e => update({ host: e.target.value })} placeholder="smtp.gmail.com" />
        </Field>
        <Field label="Port" required>
          <input className="gecko-input gecko-input-sm" type="number" value={cfg.port} onChange={e => update({ port: parseInt(e.target.value, 10) || 0 })} />
        </Field>
      </div>
      <div className="gecko-grid-2" style={{ gap: 12 }}>
        <Field label="Username" required>
          <input className="gecko-input gecko-input-sm" value={cfg.username} onChange={e => update({ username: e.target.value })} placeholder="your-email@example.com" />
        </Field>
        <Field label="Password" required>
          <input className="gecko-input gecko-input-sm" type="password" value={cfg.password} onChange={e => update({ password: e.target.value })} placeholder="•••••••••" />
        </Field>
      </div>
      <Field label="From email" required>
        <input className="gecko-input gecko-input-sm" value={cfg.fromEmail} onChange={e => update({ fromEmail: e.target.value })} placeholder="noreply@example.com" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="From name">
          <input className="gecko-input gecko-input-sm" value={cfg.fromName} onChange={e => update({ fromName: e.target.value })} placeholder="Your Company Name" />
        </Field>
        <Field label="Encryption">
          <select className="gecko-input gecko-input-sm" value={cfg.encryption} onChange={e => update({ encryption: e.target.value as EmailConfig['encryption'] })}>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="NONE">None</option>
          </select>
        </Field>
      </div>
      <Field label="Recipients (one per line)" hint="Internal team members that should receive copies of customer notifications. Use commas for cc-style multi-address.">
        <textarea
          className="gecko-input"
          value={cfg.recipients}
          onChange={e => update({ recipients: e.target.value })}
          rows={3}
          style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, resize: 'vertical' }}
        />
      </Field>
      <div className="gecko-action-toolbar">
        <button onClick={onTest} className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="mail" size={13} />Send test email
        </button>
      </div>
    </div>
  );
}

function LineForm({ state, update, onTest, brand }: { state: ChannelState | undefined; update: (p: Partial<LineConfig>) => void; onTest: () => void; brand: ChannelMeta }) {
  const cfg = state?.line!;
  return (
    <div className="gecko-stack" style={{ gap: 14 }}>
      <div className="gecko-grid-2" style={{ gap: 12 }}>
        <Field label="Channel access token" required hint="From LINE Developers Console → Messaging API channel">
          <input className="gecko-input gecko-input-sm" type="password" value={cfg.channelAccessToken} onChange={e => update({ channelAccessToken: e.target.value })} placeholder="••••••••••••••••" />
        </Field>
        <Field label="Channel secret" required>
          <input className="gecko-input gecko-input-sm" type="password" value={cfg.channelSecret} onChange={e => update({ channelSecret: e.target.value })} placeholder="••••••••" />
        </Field>
      </div>
      <Field label="Official Account name">
        <input className="gecko-input gecko-input-sm" value={cfg.oaName} onChange={e => update({ oaName: e.target.value })} placeholder="@your-oa-id" />
      </Field>
      <Field label="Connection method">
        <div style={{ display: 'flex', gap: 14 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" checked={cfg.connectionMethod === 'qr'} onChange={() => update({ connectionMethod: 'qr' })} />
            Scan QR code (Recommended)
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" checked={cfg.connectionMethod === 'id'} onChange={() => update({ connectionMethod: 'id' })} />
            Enter LINE ID
          </label>
        </div>
      </Field>
      {cfg.connectionMethod === 'id' ? (
        <Field label="LINE ID">
          <input className="gecko-input gecko-input-sm" value={cfg.lineId} onChange={e => update({ lineId: e.target.value })} placeholder="abc123xyz" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--gecko-bg-surface)', border: '1px dashed var(--gecko-border)', borderRadius: 8 }}>
          <div style={{ width: 100, height: 100, background: '#0f172a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontFamily: 'monospace' }}>QR CODE</div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', lineHeight: 1.55 }}>
            Scan with the LINE app to add <strong style={{ color: brand.brandColor }}>{cfg.oaName || 'your OA'}</strong> as a friend.
            Customers can also search this ID inside LINE to subscribe.
          </div>
        </div>
      )}
      <div className="gecko-action-toolbar">
        <button onClick={onTest} className="gecko-btn gecko-btn-sm" style={{ background: brand.brandColor, color: '#fff', border: 'none' }}>
          <Icon name="check" size={13} />Connect &amp; send test
        </button>
      </div>
    </div>
  );
}

function WhatsAppForm({ state, update, onTest }: { state: ChannelState | undefined; update: (p: Partial<WhatsAppConfig>) => void; onTest: () => void }) {
  const cfg = state?.whatsapp!;
  return (
    <div className="gecko-stack" style={{ gap: 14 }}>
      <div className="gecko-grid-2" style={{ gap: 12 }}>
        <Field label="Phone number ID" required hint="WhatsApp Business API · from Meta Business Suite">
          <input className="gecko-input gecko-input-sm" value={cfg.phoneNumberId} onChange={e => update({ phoneNumberId: e.target.value })} placeholder="123456789012345" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
        <Field label="Access token" required>
          <input className="gecko-input gecko-input-sm" type="password" value={cfg.accessToken} onChange={e => update({ accessToken: e.target.value })} placeholder="••••••••••••" />
        </Field>
      </div>
      <div className="gecko-grid-2" style={{ gap: 12 }}>
        <Field label="Business display name">
          <input className="gecko-input gecko-input-sm" value={cfg.businessName} onChange={e => update({ businessName: e.target.value })} placeholder="Your business name" />
        </Field>
        <Field label="Verified number">
          <input className="gecko-input gecko-input-sm" value={cfg.verifiedNumber} onChange={e => update({ verifiedNumber: e.target.value })} placeholder="+66 38 408 408" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
      </div>
      <div className="gecko-action-toolbar">
        <button onClick={onTest} className="gecko-btn gecko-btn-sm" style={{ background: '#25D366', color: '#fff', border: 'none' }}>
          <Icon name="check" size={13} />Verify &amp; send test
        </button>
      </div>
    </div>
  );
}

function SlackForm({ state, update, onTest }: { state: ChannelState | undefined; update: (p: Partial<SlackConfig>) => void; onTest: () => void }) {
  const cfg = state?.slack!;
  return (
    <div className="gecko-stack" style={{ gap: 14 }}>
      <Field label="Workspace name">
        <input className="gecko-input gecko-input-sm" value={cfg.workspaceName} onChange={e => update({ workspaceName: e.target.value })} placeholder="your-workspace" />
      </Field>
      <Field label="Incoming webhook URL" required hint="Slack Apps → Incoming Webhooks → Add to workspace">
        <input className="gecko-input gecko-input-sm" value={cfg.webhookUrl} onChange={e => update({ webhookUrl: e.target.value })} placeholder="https://hooks.slack.com/services/T.../B.../..." style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11.5 }} />
      </Field>
      <div className="gecko-grid-2" style={{ gap: 12 }}>
        <Field label="Bot user OAuth token (optional)" hint="Only if you want rich Block Kit replies">
          <input className="gecko-input gecko-input-sm" type="password" value={cfg.botToken} onChange={e => update({ botToken: e.target.value })} placeholder="xoxb-..." />
        </Field>
        <Field label="Default channel" required>
          <input className="gecko-input gecko-input-sm" value={cfg.defaultChannel} onChange={e => update({ defaultChannel: e.target.value })} placeholder="#gecko-alerts" style={{ fontFamily: 'var(--gecko-font-mono)' }} />
        </Field>
      </div>
      <div className="gecko-action-toolbar">
        <button onClick={onTest} className="gecko-btn gecko-btn-sm" style={{ background: '#4A154B', color: '#fff', border: 'none' }}>
          <Icon name="check" size={13} />Send test to {cfg.defaultChannel || 'channel'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TRIGGERS TAB
// ════════════════════════════════════════════════════════════════════════════

function TriggersTab({ config, toggleTrigger }: { config: IntegrationsConfig; toggleTrigger: (eventId: string, channelId: ChannelId) => void }) {
  const channelCols: ChannelId[] = ['line', 'whatsapp', 'email', 'slack'];
  const [filter, setFilter] = useState<'all' | 'customer' | 'internal'>('all');
  const visibleEvents = EVENTS.filter(e => filter === 'all' || e.category === filter || e.category === 'both');

  return (
    <section className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="gecko-row gecko-row-start gecko-row-between gecko-row-wrap" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Event triggers</div>
          <div className="gecko-cell-meta">
            For each Gecko event, choose which channels fire. Disabled channels don&apos;t send even if checked here.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
          {([
            { v: 'all',      l: 'All events' },
            { v: 'customer', l: 'Customer' },
            { v: 'internal', l: 'Internal' },
          ] as const).map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: filter === f.v ? 'var(--gecko-primary-50)' : 'transparent',
              color:      filter === f.v ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
              <th style={thStyle} align="left">Event</th>
              <th style={thStyle}>Audience</th>
              {channelCols.map(cid => {
                const m = CHANNEL_META[cid];
                return (
                  <th key={cid} style={{ ...thStyle, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 5, background: m.iconFill, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                        <ChannelBrandIcon channel={cid} />
                      </span>
                      <span className="gecko-eyebrow">{m.label.split(' ')[0]}</span>
                      {!config.channels[cid]?.enabled && (
                        <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>off</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((e, idx) => (
              <tr key={e.id} style={{ borderBottom: idx === visibleEvents.length - 1 ? 'none' : '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{e.label}</div>
                  <div className="gecko-cell-meta">{e.description}</div>
                  <div className="gecko-cell-sub">{e.id}</div>
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', textAlign: 'center' }}>
                  <AudiencePill cat={e.category} />
                </td>
                {channelCols.map(cid => {
                  const enabled = config.triggers[e.id]?.[cid] ?? false;
                  const channelOff = !config.channels[cid]?.enabled;
                  // Hide cell on internal events for customer-facing channels (and vice versa)
                  const incompatible =
                    (e.category === 'internal' && (cid === 'line' || cid === 'whatsapp')) ||
                    (e.category === 'customer' && cid === 'slack');
                  return (
                    <td key={cid} style={{ padding: '12px 4px', textAlign: 'center', verticalAlign: 'top', opacity: channelOff ? 0.45 : 1 }}>
                      {incompatible ? (
                        <span style={{ fontSize: 14, color: 'var(--gecko-text-disabled)' }}>—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleTrigger(e.id, cid)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: 'var(--gecko-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  background: 'var(--gecko-bg-subtle)',
};

function AudiencePill({ cat }: { cat: EventCategory }) {
  const m: Record<EventCategory, { l: string; bg: string; fg: string }> = {
    customer: { l: 'Customer', bg: 'var(--gecko-primary-50)', fg: 'var(--gecko-primary-700)' },
    internal: { l: 'Internal', bg: 'var(--gecko-bg-subtle)',  fg: 'var(--gecko-text-secondary)' },
    both:     { l: 'Both',     bg: 'var(--gecko-warning-50)', fg: 'var(--gecko-warning-700)' },
  };
  const { l, bg, fg } = m[cat];
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: bg, color: fg }}>{l}</span>;
}

// ════════════════════════════════════════════════════════════════════════════
// PREVIEWS TAB
// ════════════════════════════════════════════════════════════════════════════

type PreviewChannel = 'line' | 'whatsapp' | 'slack' | 'email';

function PreviewsTab({ config }: { config: IntegrationsConfig }) {
  const [channel, setChannel] = useState<PreviewChannel>('line');
  const [eventId, setEventId] = useState<string>(PREVIEW_EVENTS[0]);
  const [locale, setLocale]   = useState<Locale>('en');

  const template = TEMPLATES[eventId]?.[locale];

  return (
    <div className="gecko-stack" style={{ gap: 14 }}>

      <section className="gecko-card" style={{ padding: 14 }}>
        <div className="gecko-grid-3" style={{ gap: 12 }}>
          <Field label="Channel">
            <select className="gecko-input gecko-input-sm" value={channel} onChange={e => setChannel(e.target.value as PreviewChannel)}>
              <option value="line">LINE Official Account</option>
              <option value="whatsapp">WhatsApp Business</option>
              <option value="slack">Slack</option>
              <option value="email">Email</option>
            </select>
          </Field>
          <Field label="Event">
            <select className="gecko-input gecko-input-sm" value={eventId} onChange={e => setEventId(e.target.value)}>
              {PREVIEW_EVENTS.map(id => (
                <option key={id} value={id}>{EVENTS.find(e => e.id === id)?.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Locale">
            <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--gecko-bg-subtle)', borderRadius: 6, border: '1px solid var(--gecko-border)' }}>
              {(['en', 'th'] as const).map(l => (
                <button key={l} onClick={() => setLocale(l)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: locale === l ? 'var(--gecko-bg-surface)' : 'transparent',
                  color:      locale === l ? 'var(--gecko-text-primary)' : 'var(--gecko-text-secondary)',
                }}>{l === 'en' ? 'English' : 'ไทย Thai'}</button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
        {!template ? (
          <div style={{ padding: 40, color: 'var(--gecko-text-secondary)' }}>No template available for this event yet.</div>
        ) : channel === 'line' ? (
          <PhoneFrame deviceLabel="iPhone · 09:41">
            <LineChatPreview template={template} config={config} />
          </PhoneFrame>
        ) : channel === 'whatsapp' ? (
          <PhoneFrame deviceLabel="iPhone · 09:41">
            <WhatsAppChatPreview template={template} config={config} />
          </PhoneFrame>
        ) : channel === 'slack' ? (
          <DesktopFrame deviceLabel="Slack · #gecko-lcb-ops">
            <SlackMessagePreview template={template} config={config} />
          </DesktopFrame>
        ) : (
          <DesktopFrame deviceLabel="Gmail · Inbox" widthPx={620}>
            <EmailMessagePreview template={template} config={config} />
          </DesktopFrame>
        )}
      </div>

      <div className="gecko-cell-meta" style={{ textAlign: 'center' }}>
        Previews use the same content templates that fire in production. Variables like container number and yard spot interpolate from the event payload.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DEVICE FRAMES — phone bezel + desktop chrome
// ════════════════════════════════════════════════════════════════════════════

function PhoneFrame({ deviceLabel, children }: { deviceLabel: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="gecko-phone-frame">
        <div className="gecko-phone-frame-notch" />
        <div className="gecko-phone-frame-speaker" />

        <div className="gecko-phone-frame-screen">
          <div className="gecko-phone-frame-statusbar">
            <span>9:41</span>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
              <span>5G</span>
              <span style={{ width: 24, height: 11, border: '1px solid #000', borderRadius: 2, padding: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 1, background: '#000', borderRadius: 1, width: 'calc(100% - 2px)' }} />
                <span style={{ position: 'absolute', right: -4, top: 3, width: 2, height: 5, background: '#000', borderRadius: 1 }} />
              </span>
            </span>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>

          <div className="gecko-phone-frame-home" />
        </div>
      </div>
      <div className="gecko-phone-frame-caption">{deviceLabel}</div>
    </div>
  );
}

function DesktopFrame({ deviceLabel, children, widthPx = 520 }: { deviceLabel: string; children: React.ReactNode; widthPx?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="gecko-window-frame" style={{ width: widthPx }}>
        <div className="gecko-window-frame-chrome">
          <span className="gecko-window-frame-dot gecko-window-frame-dot-r" />
          <span className="gecko-window-frame-dot gecko-window-frame-dot-y" />
          <span className="gecko-window-frame-dot gecko-window-frame-dot-g" />
          <span className="gecko-window-frame-title">{deviceLabel}</span>
        </div>
        {children}
      </div>
      <div className="gecko-window-frame-caption">Desktop preview</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHANNEL-NATIVE PREVIEW CARDS
// ════════════════════════════════════════════════════════════════════════════

function LineChatPreview({ template, config }: { template: TemplateContent; config: IntegrationsConfig }) {
  const oaName = config.channels.line?.line?.oaName || '@gecko-lcb-ops';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#8DC9F6' }}>
      {/* Chat header */}
      <div style={{ background: '#06C755', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>‹</span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', color: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>G</div>
        <div className="gecko-flex-1">
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Gecko LCB Operations</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>{oaName} · Official Account</div>
        </div>
        <span style={{ fontSize: 16 }}>⋯</span>
      </div>

      {/* Chat body */}
      <div style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', background: 'linear-gradient(180deg, #8DC9F6 0%, #97D1F8 100%)' }}>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>Today · 14:30</div>

        {/* Flex Message Card */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', color: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>G</div>
          <div style={{ background: '#fff', borderRadius: 14, padding: 0, maxWidth: 260, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <div style={{ background: '#06C755', color: '#fff', padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              {template.title.toUpperCase()}
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12.5, color: '#1f2937', lineHeight: 1.5 }}>{template.body}</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <KV label="Container" value={template.containerNo} />
                <KV label="Booking" value={template.bookingNo} />
                <KV label="Yard spot" value={template.yardSpot} />
                <KV label="Free time" value={template.freeTimeUntil} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {template.actions.map(a => (
                  <button key={a} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #06C755', background: '#fff', color: '#06C755', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{a}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', alignSelf: 'flex-start', marginLeft: 38, fontWeight: 600 }}>14:30 ✓✓</div>
      </div>

      {/* Input bar */}
      <div style={{ background: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
        <span style={{ fontSize: 18, color: '#06C755' }}>＋</span>
        <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 18, padding: '6px 12px', fontSize: 11, color: '#9ca3af' }}>Type a message…</div>
        <span style={{ fontSize: 18, color: '#06C755' }}>🎤</span>
      </div>
    </div>
  );
}

function WhatsAppChatPreview({ template, config: _config }: { template: TemplateContent; config: IntegrationsConfig }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ECE5DD' }}>
      {/* Header */}
      <div style={{ background: '#075E54', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>‹</span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>G</div>
        <div className="gecko-flex-1">
          <div style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Gecko LCB
            <span style={{ fontSize: 10, color: '#25D366' }}>✓</span>
          </div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Business · online</div>
        </div>
        <span style={{ fontSize: 14 }}>📞</span>
        <span style={{ fontSize: 14, marginLeft: 6 }}>⋮</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
        <div style={{ alignSelf: 'center', background: '#FCF4CB', padding: '4px 10px', borderRadius: 6, fontSize: 10, color: '#6b7280' }}>Today</div>

        <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#fff', borderRadius: 8, borderTopLeftRadius: 0, padding: 10, boxShadow: '0 1px 1px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#075E54' }}>{template.title}</div>
          <div style={{ fontSize: 12, color: '#1f2937', lineHeight: 1.5 }}>{template.body}</div>
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #f3f4f6', fontSize: 11.5, color: '#374151', lineHeight: 1.6 }}>
            📦 <strong>{template.containerNo}</strong> · {template.iso}<br />
            📋 Booking: <code style={{ fontFamily: 'var(--gecko-font-mono)' }}>{template.bookingNo}</code><br />
            📍 Yard: {template.yardSpot}<br />
            ⏰ Free time: {template.freeTimeUntil}
          </div>
          <div style={{ marginTop: 4, fontSize: 10.5, color: '#075E54', lineHeight: 1.6 }}>
            {template.actions.map((a, i) => (
              <div key={a}>Reply <strong>{i + 1}</strong> to {a.toLowerCase()}</div>
            ))}
            <div>Reply <strong>HELP</strong> for support</div>
          </div>
          <div style={{ alignSelf: 'flex-end', fontSize: 9.5, color: '#6b7280' }}>14:32 ✓✓</div>
        </div>
      </div>

      {/* Input */}
      <div style={{ background: '#f0f0f0', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>😊</span>
        <div style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '6px 12px', fontSize: 11, color: '#9ca3af' }}>Message</div>
        <span style={{ fontSize: 14 }}>📎</span>
        <span style={{ fontSize: 14 }}>📷</span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🎤</div>
      </div>
    </div>
  );
}

function SlackMessagePreview({ template, config }: { template: TemplateContent; config: IntegrationsConfig }) {
  const channelName = config.channels.slack?.slack?.defaultChannel || '#gecko-lcb-ops';
  return (
    <div style={{ background: '#fff', padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#616061', fontWeight: 700, marginBottom: 12 }}># {channelName.replace(/^#/, '')}</div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#4A154B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>G</div>
        <div className="gecko-flex-1">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1d1c1d' }}>Gecko TOS</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', background: '#e8e8e8', color: '#616061', borderRadius: 2 }}>BOT</span>
            <span style={{ fontSize: 11, color: '#616061' }}>14:32</span>
          </div>

          {/* Block Kit message */}
          <div style={{ borderLeft: '4px solid #36C5F0', paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1d1c1d', marginBottom: 6 }}>{template.title}</div>
            <div style={{ fontSize: 13, color: '#1d1c1d', lineHeight: 1.5, marginBottom: 10 }}>{template.body}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, marginBottom: 10 }}>
              <div><div style={{ fontWeight: 700, color: '#1d1c1d', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Container</div><div style={{ fontFamily: 'var(--gecko-font-mono)', color: '#1d1c1d' }}>{template.containerNo.split('\n')[0]}</div></div>
              <div><div style={{ fontWeight: 700, color: '#1d1c1d', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Yard / Where</div><div style={{ fontFamily: 'var(--gecko-font-mono)', color: '#1d1c1d' }}>{template.yardSpot}</div></div>
              <div><div style={{ fontWeight: 700, color: '#1d1c1d', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer / Line</div><div style={{ color: '#1d1c1d' }}>{template.customerName}</div></div>
              <div><div style={{ fontWeight: 700, color: '#1d1c1d', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Free time / Due</div><div style={{ color: '#1d1c1d' }}>{template.freeTimeUntil}</div></div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {template.actions.map(a => (
                <button key={a} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #cccccc', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#1d1c1d', fontFamily: 'inherit' }}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailMessagePreview({ template, config }: { template: TemplateContent; config: IntegrationsConfig }) {
  const fromName  = config.channels.email?.email?.fromName  || 'Gecko TOS';
  const fromEmail = config.channels.email?.email?.fromEmail || 'notifications@gecko-api.com';

  return (
    <div style={{ background: '#fff' }}>
      {/* Email headers */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 12 }}>{template.title}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>G</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#202124' }}><strong>{fromName}</strong> &lt;{fromEmail}&gt;</div>
            <div style={{ color: '#5f6368', fontSize: 12, marginTop: 2 }}>to <strong>ops@tcl-electronics.co.th</strong> · 14:32</div>
          </div>
        </div>
      </div>

      {/* Email body */}
      <div style={{ padding: '24px', fontSize: 14, lineHeight: 1.65, color: '#202124' }}>
        <div style={{ marginBottom: 16 }}>Hello {template.customerName.split(' ')[0]},</div>
        <p style={{ margin: '0 0 16px' }}>{template.body}</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, background: '#f8fafc', borderRadius: 6, overflow: 'hidden' }}>
          <tbody>
            <EmailRow label="Container" value={template.containerNo.split('\n')[0]} mono />
            <EmailRow label="ISO type"  value={template.iso} mono />
            <EmailRow label="Booking"   value={template.bookingNo} mono />
            <EmailRow label="Yard spot" value={template.yardSpot} mono />
            <EmailRow label="Free time ends" value={template.freeTimeUntil} />
          </tbody>
        </table>

        <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
          {template.actions.map((a, i) => (
            <a key={a} href="#" style={{
              padding: '10px 18px', borderRadius: 6,
              background: i === 0 ? '#3B82F6' : 'transparent',
              color:      i === 0 ? '#fff'    : '#3B82F6',
              fontWeight: 600, fontSize: 13, textDecoration: 'none',
              border: i === 0 ? 'none' : '1px solid #3B82F6',
            }}>{a}</a>
          ))}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />
        <div style={{ fontSize: 12, color: '#5f6368', lineHeight: 1.6 }}>
          <strong>Gecko TOS · Laem Chabang ICD</strong><br />
          This is a transactional notification. <a href="#" style={{ color: '#3B82F6' }}>Manage preferences</a> · <a href="#" style={{ color: '#3B82F6' }}>Contact support</a>
        </div>
      </div>
    </div>
  );
}

function EmailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#5f6368', width: 140, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</td>
      <td style={{ padding: '8px 14px', fontSize: 13, color: '#202124', fontFamily: mono ? 'var(--gecko-font-mono)' : undefined, fontWeight: mono ? 700 : 400 }}>{value}</td>
    </tr>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, gap: 8 }}>
      <span style={{ color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span className="gecko-money" style={{ color: '#1f2937' }}>{value}</span>
    </div>
  );
}
