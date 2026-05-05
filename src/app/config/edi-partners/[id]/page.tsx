"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ── Partner stubs (mirrors the list in edi-partners/page.tsx) ─────────────────

const PARTNERS = [
  { id: 'maeu', code: 'MAEU', name: 'Maersk Line',        type: 'Shipping Line',      color: '#0073AB', initials: 'MA' },
  { id: 'cmdu', code: 'CMDU', name: 'CMA CGM',            type: 'Shipping Line',      color: '#E2001A', initials: 'CM' },
  { id: 'cosu', code: 'COSU', name: 'COSCO Shipping',     type: 'Shipping Line',      color: '#C8102E', initials: 'CO' },
  { id: 'oney', code: 'ONEY', name: 'ONE (Ocean Network)', type: 'Shipping Line',     color: '#7B2D8B', initials: 'ON' },
  { id: 'thdoc',code: 'THDOC',name: 'Thai Customs Dept.', type: 'Customs Authority',  color: '#1D6F42', initials: 'TC' },
  { id: 'lcbpa',code: 'LCBPA',name: 'Laem Chabang Port',  type: 'Port Authority',     color: '#005C99', initials: 'LC' },
  { id: 'eglv', code: 'EGLV', name: 'Evergreen Marine',   type: 'Shipping Line',      color: '#006633', initials: 'EV' },
  { id: 'bkhc', code: 'BKHC', name: 'Bangkok Haulage Co.',type: 'Haulier',            color: '#F47920', initials: 'BH' },
  { id: 'hlcu', code: 'HLCU', name: 'Hapag-Lloyd',        type: 'Shipping Line',      color: '#E2520C', initials: 'HL' },
  { id: 'int',  code: 'INT',  name: 'Internal TOS Sync',  type: 'Internal',           color: '#374151', initials: 'IN' },
];

// ── EDI message catalogue ─────────────────────────────────────────────────────

const MSG_CATALOGUE = [
  { code: 'BAPLIE',  name: 'Bay Plan / Stowage',          dir: 'IN'   as const },
  { code: 'COPRAR',  name: 'Container Pre-Advice/Discharge', dir: 'IN' as const },
  { code: 'COARRI',  name: 'Container Arrival/Departure', dir: 'OUT'  as const },
  { code: 'COPINO',  name: 'Pre-notification',            dir: 'IN'   as const },
  { code: 'IFTDGN',  name: 'DG Notification',             dir: 'IN'   as const },
  { code: 'CUSCAR',  name: 'Customs Cargo Report',        dir: 'OUT'  as const },
  { code: 'CUSDEC',  name: 'Customs Declaration',         dir: 'OUT'  as const },
  { code: 'CUSRES',  name: 'Customs Response',            dir: 'IN'   as const },
  { code: 'MOVINS',  name: 'Stowage Instructions',        dir: 'IN'   as const },
  { code: 'CODECO',  name: 'Container Gate-In/Out Event', dir: 'OUT'  as const },
  { code: 'VERMAS',  name: 'Verified Gross Mass (VGM)',   dir: 'IN'   as const },
];

// Per-partner active message types
const PARTNER_MSGS: Record<string, string[]> = {
  maeu:  ['BAPLIE', 'COPRAR', 'COARRI', 'COPINO'],
  cmdu:  ['BAPLIE', 'COPRAR', 'COARRI'],
  cosu:  ['BAPLIE', 'COPRAR', 'IFTDGN'],
  oney:  ['COPRAR', 'COARRI'],
  thdoc: ['CUSCAR', 'CUSDEC', 'CUSRES'],
  lcbpa: ['CODECO'],
  eglv:  ['BAPLIE', 'COPRAR'],
  bkhc:  ['CODECO', 'COPINO'],
  hlcu:  ['BAPLIE', 'COPRAR', 'COARRI', 'IFTDGN'],
  int:   MSG_CATALOGUE.map(m => m.code),
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'transmission' | 'messages' | 'activity' | 'security';
type ConnMethod = 'sftp' | 'ftp' | 'email' | 'api' | 'webhook';

interface SftpConfig {
  host: string; port: string; username: string;
  authMethod: 'password' | 'ssh-key';
  password: string; sshKey: string;
  inboundDir: string; outboundDir: string;
  pollInterval: string; filePattern: string;
  postProcess: 'move' | 'delete' | 'rename';
  moveDir: string;
}

interface FtpConfig {
  host: string; port: string; username: string; password: string;
  mode: 'passive' | 'active';
  tls: 'none' | 'explicit' | 'implicit';
  inboundDir: string; outboundDir: string; pollInterval: string;
}

interface EmailConfig {
  imapHost: string; imapPort: string; imapSsl: boolean;
  imapUser: string; imapPassword: string; imapFolder: string;
  subjectFilter: string; attachmentExts: string;
  smtpHost: string; smtpPort: string; smtpSsl: boolean;
  smtpUser: string; smtpPassword: string;
  fromAddress: string; toAddress: string;
}

interface ApiConfig {
  baseUrl: string;
  authType: 'none' | 'api-key' | 'bearer' | 'oauth2' | 'basic';
  apiKeyHeader: string; apiKeyValue: string;
  bearerToken: string;
  oauthTokenUrl: string; oauthClientId: string; oauthClientSecret: string; oauthScope: string;
  basicUser: string; basicPassword: string;
  timeout: string; retryCount: string; retryDelay: string;
  sslVerify: boolean;
  headers: Array<{ key: string; value: string }>;
}

interface WebhookConfig {
  ourUrl: string; secret: string;
  payloadFormat: 'json' | 'xml' | 'edi';
  ipWhitelist: string;
  events: string[];
}

type TxDirection = 'inbound' | 'outbound' | 'both';

interface TransmissionConfig {
  inboundMethod: ConnMethod;
  outboundMethod: ConnMethod;
  sftp: SftpConfig;
  ftpIn: FtpConfig;
  ftpOut: FtpConfig;
  email: EmailConfig;
  apiIn: ApiConfig;
  apiOut: ApiConfig;
  webhook: WebhookConfig;
}

// ── Seed configs ──────────────────────────────────────────────────────────────

function seedDirection(partnerId: string): TxDirection {
  // CODECO / purely-outbound partners
  if (partnerId === 'lcbpa') return 'outbound';
  // Customs sends and receives
  return 'both';
}

function seedTransmission(partnerId: string): TransmissionConfig {
  const isCustoms = partnerId === 'thdoc';
  const isHaulier = partnerId === 'bkhc';
  const baseFtp: FtpConfig = {
    host: `ftp.${partnerId}.com`, port: '21', username: 'lcb_user', password: 'ftpPass123',
    mode: 'passive', tls: 'explicit', inboundDir: '/in/', outboundDir: '/out/', pollInterval: '10',
  };
  const baseApi: ApiConfig = {
    baseUrl: isCustoms ? 'https://api.customs.go.th/v2/edi' : `https://api.${partnerId}.com/edi/v1`,
    authType: isCustoms ? 'oauth2' : 'api-key',
    apiKeyHeader: 'X-API-Key', apiKeyValue: 'lc_prod_••••••••3f9a',
    bearerToken: '',
    oauthTokenUrl: 'https://auth.customs.go.th/oauth/token',
    oauthClientId: 'logicon_lcb_prod', oauthClientSecret: '••••••••••••', oauthScope: 'edi.submit edi.query',
    basicUser: '', basicPassword: '',
    timeout: '30', retryCount: '3', retryDelay: '60',
    sslVerify: true,
    headers: [
      { key: 'Accept', value: 'application/json' },
      { key: 'X-Facility-Code', value: 'THLCB' },
    ],
  };
  return {
    inboundMethod:  isCustoms ? 'api' : isHaulier ? 'email' : 'sftp',
    outboundMethod: isCustoms ? 'api' : isHaulier ? 'email' : 'sftp',
    sftp: {
      host: partnerId === 'maeu' ? 'sftp.maersk.com' : `sftp.${partnerId}.com`,
      port: '22', username: `lcb_logicon_prod`,
      authMethod: 'password', password: 'P@ssw0rd$ecure!', sshKey: '',
      inboundDir: '/incoming/lcb/', outboundDir: '/outgoing/lcb/',
      pollInterval: '5', filePattern: '*.edi', postProcess: 'move', moveDir: '/processed/',
    },
    ftpIn:  baseFtp,
    ftpOut: { ...baseFtp, inboundDir: '/in/', outboundDir: '/out-send/' },
    email: {
      imapHost: 'imap.gmail.com', imapPort: '993', imapSsl: true,
      imapUser: `edi+${partnerId}@logicon-lcb.th`, imapPassword: '',
      imapFolder: 'INBOX/EDI',
      subjectFilter: `[EDI]`, attachmentExts: '.edi,.txt,.xml',
      smtpHost: 'smtp.logicon-lcb.th', smtpPort: '587', smtpSsl: true,
      smtpUser: 'edi-out@logicon-lcb.th', smtpPassword: '',
      fromAddress: 'edi-out@logicon-lcb.th',
      toAddress: `edi-in@${partnerId}.com`,
    },
    apiIn:  baseApi,
    apiOut: { ...baseApi },
    webhook: {
      ourUrl: 'https://api.logicon-lcb.th/webhooks/edi/inbound',
      secret: 'whsec_••••••••••••4a2b',
      payloadFormat: 'json',
      ipWhitelist: '185.45.12.0/24\n203.116.88.0/24',
      events: ['BAPLIE', 'COPRAR', 'COPINO'],
    },
  };
}

// ── Activity log sample ───────────────────────────────────────────────────────

const ACTIVITY_LOG = [
  { id: 1, ts: '2026-05-04 09:14', msgType: 'BAPLIE',  dir: 'IN'  as const, size: '42 KB',  status: 'ok'    as const, ref: 'MSG-20264301', error: '' },
  { id: 2, ts: '2026-05-04 09:00', msgType: 'COARRI',  dir: 'OUT' as const, size: '8 KB',   status: 'ok'    as const, ref: 'MSG-20264298', error: '' },
  { id: 3, ts: '2026-05-04 08:50', msgType: 'COPRAR',  dir: 'IN'  as const, size: '15 KB',  status: 'ok'    as const, ref: 'MSG-20264290', error: '' },
  { id: 4, ts: '2026-05-04 07:22', msgType: 'COPINO',  dir: 'IN'  as const, size: '6 KB',   status: 'error' as const, ref: 'MSG-20264271', error: 'SFTP timeout after 30s — retry 3/3 failed' },
  { id: 5, ts: '2026-05-04 06:05', msgType: 'BAPLIE',  dir: 'IN'  as const, size: '38 KB',  status: 'ok'    as const, ref: 'MSG-20264220', error: '' },
  { id: 6, ts: '2026-05-03 22:10', msgType: 'COARRI',  dir: 'OUT' as const, size: '5 KB',   status: 'ok'    as const, ref: 'MSG-20264180', error: '' },
  { id: 7, ts: '2026-05-03 18:44', msgType: 'COPRAR',  dir: 'IN'  as const, size: '12 KB',  status: 'ok'    as const, ref: 'MSG-20264140', error: '' },
  { id: 8, ts: '2026-05-03 14:30', msgType: 'IFTDGN',  dir: 'IN'  as const, size: '3 KB',   status: 'warn'  as const, ref: 'MSG-20264095', error: 'Unknown DG class code "9X" — accepted with warning' },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--gecko-text-secondary)', marginBottom: 5 }}>
      {children}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
      borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--gecko-border)',
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gecko-bg-subtle)' }}>
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--gecko-primary-500)' }} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function TF({ label, value, onChange, type = 'text', mono = false, readOnly = false, placeholder = '', suffix }:
  { label: string; value: string; onChange?: (v: string) => void; type?: string; mono?: boolean; readOnly?: boolean; placeholder?: string; suffix?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <Label>{label}</Label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={type} value={value}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly} placeholder={placeholder}
          className="gecko-input gecko-input-sm"
          style={{ width: '100%', fontFamily: mono ? 'monospace' : 'inherit',
            background: readOnly ? 'var(--gecko-bg-subtle)' : undefined,
            paddingRight: suffix ? 36 : undefined }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 10, fontSize: 12, color: 'var(--gecko-text-secondary)', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', gap, marginBottom: 12, flexWrap: 'wrap' }}>{children}</div>;
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <Label>{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)} className="gecko-input gecko-input-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
      borderBottom: '1px solid var(--gecko-bg-subtle)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: value ? 'var(--gecko-success-500)' : 'var(--gecko-gray-300)',
          position: 'relative', transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <Label>{label}</Label>
      <div style={{ position: 'relative', display: 'flex' }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          className="gecko-input gecko-input-sm" style={{ flex: 1, paddingRight: 36, fontFamily: 'monospace' }} />
        <button onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: 2 }}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={14} />
        </button>
      </div>
    </div>
  );
}

function MethodPill({ id, label, active, onClick }: { id: ConnMethod; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${active ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
        background: active ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-surface)',
        color: active ? '#fff' : 'var(--gecko-text-secondary)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}

// ── Connection method forms ────────────────────────────────────────────────────

function SftpForm({ cfg, onChange, direction }: { cfg: SftpConfig; onChange: (p: Partial<SftpConfig>) => void; direction: 'inbound' | 'outbound' }) {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const doTest = () => {
    setTestState('testing');
    setTimeout(() => setTestState(Math.random() > 0.2 ? 'ok' : 'fail'), 1600);
  };
  return (
    <>
      <Row>
        <TF label="Host / IP Address" value={cfg.host} onChange={v => onChange({ host: v })} mono placeholder="sftp.partner.com" />
        <TF label="Port" value={cfg.port} onChange={v => onChange({ port: v })} mono placeholder="22" />
      </Row>
      <Row>
        <TF label="Username" value={cfg.username} onChange={v => onChange({ username: v })} mono />
        <Sel label="Authentication" value={cfg.authMethod} onChange={v => onChange({ authMethod: v as SftpConfig['authMethod'] })}
          options={[{ value: 'password', label: 'Password' }, { value: 'ssh-key', label: 'SSH Private Key' }]} />
      </Row>
      {cfg.authMethod === 'password'
        ? <Row><PwField label="Password" value={cfg.password} onChange={v => onChange({ password: v })} /></Row>
        : <Row>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>SSH Private Key (PEM)</Label>
              <textarea className="gecko-input" value={cfg.sshKey} onChange={e => onChange({ sshKey: e.target.value })}
                rows={4} style={{ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
            </div>
          </Row>
      }
      {direction === 'inbound' && (
        <Row>
          <TF label="Inbound Directory" value={cfg.inboundDir} onChange={v => onChange({ inboundDir: v })} mono />
          <TF label="File Pattern" value={cfg.filePattern} onChange={v => onChange({ filePattern: v })} mono placeholder="*.edi" />
        </Row>
      )}
      {direction === 'outbound' && (
        <Row>
          <TF label="Outbound Directory" value={cfg.outboundDir} onChange={v => onChange({ outboundDir: v })} mono />
        </Row>
      )}
      {direction === 'inbound' && (
        <>
          <Row>
            <TF label="Poll Interval (minutes)" value={cfg.pollInterval} onChange={v => onChange({ pollInterval: v })} suffix="min" />
            <Sel label="After Processing" value={cfg.postProcess} onChange={v => onChange({ postProcess: v as SftpConfig['postProcess'] })}
              options={[{ value: 'move', label: 'Move to folder' }, { value: 'delete', label: 'Delete file' }, { value: 'rename', label: 'Rename with .done' }]} />
          </Row>
          {cfg.postProcess === 'move' && (
            <Row><TF label="Move to Directory" value={cfg.moveDir} onChange={v => onChange({ moveDir: v })} mono /></Row>
          )}
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={doTest}
          disabled={testState === 'testing'}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {testState === 'testing'
            ? <><Icon name="refresh" size={13} /> Testing…</>
            : <><Icon name="zap" size={13} /> Test Connection</>}
        </button>
        {testState === 'ok'   && <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, display: 'flex', gap: 5 }}><Icon name="checkCircle" size={14} /> Connected successfully</span>}
        {testState === 'fail' && <span style={{ fontSize: 12, color: 'var(--gecko-error-600)', fontWeight: 600, display: 'flex', gap: 5 }}><Icon name="alertCircle" size={14} /> Connection failed</span>}
        {testState === 'idle' && <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>Last tested: 2026-05-04 09:00 ✓</span>}
      </div>
    </>
  );
}

function FtpForm({ cfg, onChange, direction }: { cfg: FtpConfig; onChange: (p: Partial<FtpConfig>) => void; direction: 'inbound' | 'outbound' }) {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  return (
    <>
      <Row>
        <TF label="Host / IP Address" value={cfg.host} onChange={v => onChange({ host: v })} mono />
        <TF label="Port" value={cfg.port} onChange={v => onChange({ port: v })} mono placeholder="21" />
      </Row>
      <Row>
        <TF label="Username" value={cfg.username} onChange={v => onChange({ username: v })} mono />
        <PwField label="Password" value={cfg.password} onChange={v => onChange({ password: v })} />
      </Row>
      <Row>
        <Sel label="Transfer Mode" value={cfg.mode} onChange={v => onChange({ mode: v as FtpConfig['mode'] })}
          options={[{ value: 'passive', label: 'Passive (PASV) — recommended' }, { value: 'active', label: 'Active (PORT)' }]} />
        <Sel label="TLS / Security" value={cfg.tls} onChange={v => onChange({ tls: v as FtpConfig['tls'] })}
          options={[{ value: 'none', label: 'None (plain FTP)' }, { value: 'explicit', label: 'FTPS Explicit (STARTTLS)' }, { value: 'implicit', label: 'FTPS Implicit (port 990)' }]} />
      </Row>
      <Row>
        {direction === 'inbound'
          ? <TF label="Inbound Directory" value={cfg.inboundDir} onChange={v => onChange({ inboundDir: v })} mono />
          : <TF label="Outbound Directory" value={cfg.outboundDir} onChange={v => onChange({ outboundDir: v })} mono />}
        {direction === 'inbound' && (
          <TF label="Poll Interval (min)" value={cfg.pollInterval} onChange={v => onChange({ pollInterval: v })} suffix="min" />
        )}
      </Row>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { setTestState('testing'); setTimeout(() => setTestState('ok'), 1400); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="zap" size={13} /> {testState === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>
        {testState === 'ok' && <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600 }}>✓ Connected</span>}
      </div>
    </>
  );
}

function EmailForm({ cfg, onChange, direction }: { cfg: EmailConfig; onChange: (p: Partial<EmailConfig>) => void; direction: 'inbound' | 'outbound' }) {
  return (
    <>
      {direction === 'inbound' ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)', marginBottom: 10,
            padding: '6px 10px', background: 'var(--gecko-primary-50)', borderRadius: 6 }}>
            IMAP — Incoming Mail Server
          </div>
          <Row>
            <TF label="IMAP Host" value={cfg.imapHost} onChange={v => onChange({ imapHost: v })} mono />
            <TF label="Port" value={cfg.imapPort} onChange={v => onChange({ imapPort: v })} mono />
          </Row>
          <Row>
            <TF label="Username / Email" value={cfg.imapUser} onChange={v => onChange({ imapUser: v })} />
            <PwField label="Password" value={cfg.imapPassword} onChange={v => onChange({ imapPassword: v })} />
          </Row>
          <Row>
            <TF label="Mailbox Folder" value={cfg.imapFolder} onChange={v => onChange({ imapFolder: v })} mono placeholder="INBOX" />
            <TF label="Subject Filter (contains)" value={cfg.subjectFilter} onChange={v => onChange({ subjectFilter: v })} placeholder="[EDI]" />
          </Row>
          <Row>
            <TF label="Accepted Attachment Extensions" value={cfg.attachmentExts} onChange={v => onChange({ attachmentExts: v })} mono placeholder=".edi,.txt,.xml" />
          </Row>
          <Toggle label="SSL / TLS" value={cfg.imapSsl} onChange={v => onChange({ imapSsl: v })} description="Use encrypted connection (recommended)" />
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-success-700)', marginBottom: 10,
            padding: '6px 10px', background: 'var(--gecko-success-50)', borderRadius: 6 }}>
            SMTP — Outgoing Mail Server
          </div>
          <Row>
            <TF label="SMTP Host" value={cfg.smtpHost} onChange={v => onChange({ smtpHost: v })} mono />
            <TF label="Port" value={cfg.smtpPort} onChange={v => onChange({ smtpPort: v })} mono />
          </Row>
          <Row>
            <TF label="SMTP Username" value={cfg.smtpUser} onChange={v => onChange({ smtpUser: v })} />
            <PwField label="SMTP Password" value={cfg.smtpPassword} onChange={v => onChange({ smtpPassword: v })} />
          </Row>
          <Row>
            <TF label="From Address" value={cfg.fromAddress} onChange={v => onChange({ fromAddress: v })} />
            <TF label="To Address (partner)" value={cfg.toAddress} onChange={v => onChange({ toAddress: v })} />
          </Row>
          <Toggle label="STARTTLS / SSL" value={cfg.smtpSsl} onChange={v => onChange({ smtpSsl: v })} description="Encrypt SMTP connection" />
        </>
      )}
    </>
  );
}

function ApiForm({ cfg, onChange }: { cfg: ApiConfig; onChange: (p: Partial<ApiConfig>) => void }) {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const addHeader = () => onChange({ headers: [...cfg.headers, { key: '', value: '' }] });
  const removeHeader = (i: number) => onChange({ headers: cfg.headers.filter((_, idx) => idx !== i) });
  const updateHeader = (i: number, field: 'key' | 'value', v: string) => {
    const h = [...cfg.headers];
    h[i] = { ...h[i], [field]: v };
    onChange({ headers: h });
  };
  return (
    <>
      <Row><TF label="Base URL" value={cfg.baseUrl} onChange={v => onChange({ baseUrl: v })} mono placeholder="https://api.partner.com/v1" /></Row>
      <Row>
        <Sel label="Authentication Type" value={cfg.authType} onChange={v => onChange({ authType: v as ApiConfig['authType'] })}
          options={[
            { value: 'none',    label: 'None' },
            { value: 'api-key', label: 'API Key (header)' },
            { value: 'bearer',  label: 'Bearer Token' },
            { value: 'oauth2',  label: 'OAuth 2.0 (Client Credentials)' },
            { value: 'basic',   label: 'Basic Auth (username / password)' },
          ]} />
      </Row>
      {cfg.authType === 'api-key' && (
        <Row>
          <TF label="Header Name" value={cfg.apiKeyHeader} onChange={v => onChange({ apiKeyHeader: v })} mono placeholder="X-API-Key" />
          <PwField label="API Key Value" value={cfg.apiKeyValue} onChange={v => onChange({ apiKeyValue: v })} />
        </Row>
      )}
      {cfg.authType === 'bearer' && (
        <Row><PwField label="Bearer Token" value={cfg.bearerToken} onChange={v => onChange({ bearerToken: v })} /></Row>
      )}
      {cfg.authType === 'oauth2' && (
        <>
          <Row>
            <TF label="Token URL" value={cfg.oauthTokenUrl} onChange={v => onChange({ oauthTokenUrl: v })} mono />
          </Row>
          <Row>
            <TF label="Client ID" value={cfg.oauthClientId} onChange={v => onChange({ oauthClientId: v })} mono />
            <PwField label="Client Secret" value={cfg.oauthClientSecret} onChange={v => onChange({ oauthClientSecret: v })} />
          </Row>
          <Row><TF label="Scope" value={cfg.oauthScope} onChange={v => onChange({ oauthScope: v })} mono placeholder="edi.submit edi.query" /></Row>
        </>
      )}
      {cfg.authType === 'basic' && (
        <Row>
          <TF label="Username" value={cfg.basicUser} onChange={v => onChange({ basicUser: v })} mono />
          <PwField label="Password" value={cfg.basicPassword} onChange={v => onChange({ basicPassword: v })} />
        </Row>
      )}
      <Row>
        <TF label="Timeout (seconds)" value={cfg.timeout} onChange={v => onChange({ timeout: v })} suffix="s" />
        <TF label="Retry Count" value={cfg.retryCount} onChange={v => onChange({ retryCount: v })} />
        <TF label="Retry Delay (sec)" value={cfg.retryDelay} onChange={v => onChange({ retryDelay: v })} suffix="s" />
      </Row>
      <Toggle label="SSL Certificate Verification" value={cfg.sslVerify} onChange={v => onChange({ sslVerify: v })} description="Disable only for self-signed certs in staging" />

      {/* Custom Headers */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Label>Custom Request Headers</Label>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={addHeader}
            style={{ fontSize: 11, display: 'flex', gap: 4, color: 'var(--gecko-primary-600)' }}>
            <Icon name="plus" size={12} /> Add Header
          </button>
        </div>
        {cfg.headers.map((h, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)}
              className="gecko-input gecko-input-sm" placeholder="Header-Name"
              style={{ flex: 1, fontFamily: 'monospace' }} />
            <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)}
              className="gecko-input gecko-input-sm" placeholder="value"
              style={{ flex: 2, fontFamily: 'monospace' }} />
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
              onClick={() => removeHeader(i)} style={{ color: 'var(--gecko-error-500)' }}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        {cfg.headers.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', padding: '6px 0' }}>No custom headers defined</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
          onClick={() => { setTestState('testing'); setTimeout(() => setTestState('ok'), 1800); }}
          style={{ display: 'flex', gap: 6 }}>
          <Icon name="zap" size={13} /> {testState === 'testing' ? 'Testing…' : 'Test API Connection'}
        </button>
        {testState === 'ok' && <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600 }}>✓ 200 OK — API reachable</span>}
        {testState === 'fail' && <span style={{ fontSize: 12, color: 'var(--gecko-error-600)', fontWeight: 600 }}>✗ Connection refused</span>}
      </div>
    </>
  );
}

function WebhookForm({ cfg, onChange }: { cfg: WebhookConfig; onChange: (p: Partial<WebhookConfig>) => void }) {
  const [revealSecret, setRevealSecret] = useState(false);
  const [regenState, setRegenState] = useState(false);
  return (
    <>
      <div style={{ padding: '10px 14px', background: 'var(--gecko-primary-50)', borderRadius: 8, marginBottom: 14,
        border: '1px solid var(--gecko-primary-100)', display: 'flex', gap: 10 }}>
        <Icon name="info" size={15} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)' }}>
          Webhook mode means the partner <strong>pushes messages to us</strong>. Share the URL below with your partner.
          All requests are validated against the signing secret.
        </div>
      </div>
      <Row>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Our Webhook Endpoint URL</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input readOnly value={cfg.ourUrl} className="gecko-input gecko-input-sm"
              style={{ flex: 1, fontFamily: 'monospace', background: 'var(--gecko-bg-subtle)' }} />
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => navigator.clipboard?.writeText(cfg.ourUrl)}
              title="Copy URL" style={{ flexShrink: 0 }}>
              <Icon name="copy" size={13} />
            </button>
          </div>
        </div>
      </Row>
      <Row>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Signing Secret</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type={revealSecret ? 'text' : 'password'} readOnly value={cfg.secret}
              className="gecko-input gecko-input-sm"
              style={{ flex: 1, fontFamily: 'monospace', background: 'var(--gecko-bg-subtle)' }} />
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setRevealSecret(s => !s)}>
              <Icon name={revealSecret ? 'eyeOff' : 'eye'} size={13} />
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={() => { setRegenState(true); setTimeout(() => { onChange({ secret: 'whsec_NEW_••••••••••••9c1f' }); setRegenState(false); }, 800); }}>
              {regenState ? '…' : 'Regenerate'}
            </button>
          </div>
        </div>
      </Row>
      <Row>
        <Sel label="Payload Format" value={cfg.payloadFormat} onChange={v => onChange({ payloadFormat: v as WebhookConfig['payloadFormat'] })}
          options={[{ value: 'json', label: 'JSON' }, { value: 'xml', label: 'XML' }, { value: 'edi', label: 'Raw EDI (EDIFACT/X12)' }]} />
      </Row>
      <div style={{ marginBottom: 12 }}>
        <Label>IP Whitelist (one CIDR per line)</Label>
        <textarea value={cfg.ipWhitelist} onChange={e => onChange({ ipWhitelist: e.target.value })}
          className="gecko-input" rows={3}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', padding: '8px 10px' }}
          placeholder="185.45.12.0/24&#10;203.116.88.0/24" />
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
          Leave blank to accept from any IP (not recommended for production)
        </div>
      </div>
      <div>
        <Label>Subscribed Message Types</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {MSG_CATALOGUE.map(m => {
            const active = cfg.events.includes(m.code);
            return (
              <button key={m.code}
                onClick={() => onChange({ events: active ? cfg.events.filter(e => e !== m.code) : [...cfg.events, m.code] })}
                className="gecko-btn gecko-btn-sm"
                style={{ border: `1.5px solid ${active ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                  background: active ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                  color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                  fontWeight: active ? 700 : 400, fontSize: 11, padding: '3px 10px' }}>
                {m.code}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Direction block (Inbound or Outbound) ─────────────────────────────────────

function DirectionBlock({
  direction, method, onMethodChange, cfg, onCfgChange, onCopyFromInbound,
}: {
  direction: 'inbound' | 'outbound';
  method: ConnMethod;
  onMethodChange: (m: ConnMethod) => void;
  cfg: TransmissionConfig;
  onCfgChange: (p: Partial<TransmissionConfig>) => void;
  onCopyFromInbound?: () => void;
}) {
  const isIn = direction === 'inbound';
  const METHODS: { id: ConnMethod; label: string }[] = isIn
    ? [{ id: 'sftp', label: 'SFTP' }, { id: 'ftp', label: 'FTP' }, { id: 'email', label: 'Email / IMAP' }, { id: 'api', label: 'REST API' }, { id: 'webhook', label: 'Webhook' }]
    : [{ id: 'sftp', label: 'SFTP' }, { id: 'ftp', label: 'FTP' }, { id: 'email', label: 'Email / SMTP' }, { id: 'api', label: 'REST API' }];

  return (
    <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Direction header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        background: isIn ? 'var(--gecko-primary-50)' : 'var(--gecko-success-50)',
        borderBottom: '1px solid var(--gecko-border)' }}>
        <span style={{ width: 32, height: 32, borderRadius: 8,
          background: isIn ? 'var(--gecko-primary-600)' : 'var(--gecko-success-600)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={isIn ? 'arrowDown' : 'arrowUp'} size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
            {isIn ? 'Inbound Channel' : 'Outbound Channel'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            {isIn
              ? 'Partner → Our System · We receive EDI messages from the partner'
              : 'Our System → Partner · We send EDI messages to the partner'}
          </div>
        </div>
        {/* One-shot copy button — only on Outbound when Both direction is active */}
        {!isIn && onCopyFromInbound && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={onCopyFromInbound}
            style={{ fontSize: 11, color: 'var(--gecko-primary-600)', display: 'flex', gap: 5, flexShrink: 0 }}
            title="Copy host, port, credentials from Inbound into this section — you can then adjust the outbound directory">
            <Icon name="copy" size={12} /> Copy from Inbound
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {/* Method selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {METHODS.map(m => (
            <MethodPill key={m.id} id={m.id} label={m.label} active={method === m.id} onClick={() => onMethodChange(m.id)} />
          ))}
        </div>

        {/* Method forms — inbound and outbound use independent configs */}
        {method === 'sftp' && (
          <SftpForm direction={direction}
            cfg={cfg.sftp}
            onChange={p => onCfgChange({ sftp: { ...cfg.sftp, ...p } })} />
        )}
        {method === 'ftp' && isIn && (
          <FtpForm direction={direction}
            cfg={cfg.ftpIn}
            onChange={p => onCfgChange({ ftpIn: { ...cfg.ftpIn, ...p } })} />
        )}
        {method === 'ftp' && !isIn && (
          <FtpForm direction={direction}
            cfg={cfg.ftpOut}
            onChange={p => onCfgChange({ ftpOut: { ...cfg.ftpOut, ...p } })} />
        )}
        {method === 'email' && (
          <EmailForm direction={direction}
            cfg={cfg.email}
            onChange={p => onCfgChange({ email: { ...cfg.email, ...p } })} />
        )}
        {method === 'api' && isIn && (
          <ApiForm cfg={cfg.apiIn} onChange={p => onCfgChange({ apiIn: { ...cfg.apiIn, ...p } })} />
        )}
        {method === 'api' && !isIn && (
          <ApiForm cfg={cfg.apiOut} onChange={p => onCfgChange({ apiOut: { ...cfg.apiOut, ...p } })} />
        )}
        {method === 'webhook' && isIn && (
          <WebhookForm cfg={cfg.webhook} onChange={p => onCfgChange({ webhook: { ...cfg.webhook, ...p } })} />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EdiPartnerProfilePage() {
  const params = useParams();
  const partnerId = (params?.id as string) ?? 'maeu';

  const partner = useMemo(() => PARTNERS.find(p => p.id === partnerId) ?? PARTNERS[0], [partnerId]);
  const activeMsgs = useMemo(() => PARTNER_MSGS[partner.id] ?? [], [partner.id]);

  const [tab, setTab]           = useState<Tab>('transmission');
  const [tx, setTx]             = useState<TransmissionConfig>(() => seedTransmission(partnerId));
  const [txDir, setTxDir]       = useState<TxDirection>(() => seedDirection(partnerId));
  const [msgActive, setMsgActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MSG_CATALOGUE.map(m => [m.code, activeMsgs.includes(m.code)]))
  );
  const [savedMsg, setSavedMsg] = useState('');
  const [status, setStatus]     = useState<'active' | 'inactive'>('active');

  const patchTx = (p: Partial<TransmissionConfig>) => setTx(prev => ({ ...prev, ...p }));

  // One-shot: copy inbound connection settings into outbound (host/port/creds only, not directories/schedules)
  const copyInboundToOutbound = () => {
    setTx(prev => {
      const m = prev.inboundMethod;
      if (m === 'sftp') return { ...prev, outboundMethod: 'sftp' };
      if (m === 'ftp')  return { ...prev, outboundMethod: 'ftp', ftpOut: { ...prev.ftpIn } };
      if (m === 'api')  return { ...prev, outboundMethod: 'api', apiOut: { ...prev.apiIn } };
      return prev;
    });
  };

  const handleSave = () => {
    setSavedMsg('Profile saved successfully');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile',      label: 'Profile',        icon: 'users'      },
    { id: 'transmission', label: 'Transmission',   icon: 'zap'        },
    { id: 'messages',     label: 'Message Types',  icon: 'fileText'   },
    { id: 'activity',     label: 'Activity Log',   icon: 'activity'   },
    { id: 'security',     label: 'Security',       icon: 'shieldCheck'},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 1100 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/config/edi-partners" style={{ textDecoration: 'none' }}>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm">
              <Icon name="arrowLeft" size={16} />
            </button>
          </Link>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: partner.color,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
            {partner.initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{partner.name}</h1>
              <span className="gecko-badge gecko-badge-gray" style={{ fontSize: 10, fontFamily: 'monospace' }}>{partner.code}</span>
              <span className={`gecko-badge gecko-badge-${status === 'active' ? 'success' : 'gray'}`} style={{ fontSize: 10 }}>
                {status === 'active' ? '● Active' : '○ Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              {partner.type} · EDI Partner Profile
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, display: 'flex', gap: 5 }}>
              <Icon name="checkCircle" size={14} /> {savedMsg}
            </span>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
            onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{ color: status === 'active' ? 'var(--gecko-error-600)' : 'var(--gecko-success-600)',
              borderColor: status === 'active' ? 'var(--gecko-error-300)' : 'var(--gecko-success-300)' }}>
            <Icon name={status === 'active' ? 'x' : 'check'} size={13} />
            {status === 'active' ? 'Disable Partner' : 'Enable Partner'}
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={handleSave}
            style={{ display: 'flex', gap: 6 }}>
            <Icon name="save" size={13} /> Save Profile
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gecko-border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
              marginBottom: -2, transition: 'color 0.15s' }}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}

      {/* PROFILE */}
      {tab === 'profile' && (
        <div>
          <SectionCard title="Partner Identity" icon="users">
            <Row>
              <TF label="Partner Name" value={partner.name} onChange={() => {}} />
              <TF label="Partner Code (SCAC / ID)" value={partner.code} onChange={() => {}} mono />
            </Row>
            <Row>
              <Sel label="Partner Type" value={partner.type} onChange={() => {}}
                options={['Shipping Line','Customs Authority','Port Authority','Haulier','Internal'].map(v => ({ value: v, label: v }))} />
              <TF label="UN/LOCODE" value={partner.type === 'Shipping Line' ? `XX ${partner.code.slice(0,3)}` : ''} onChange={() => {}} mono placeholder="XX LCB" />
            </Row>
          </SectionCard>
          <SectionCard title="Contact Information" icon="mail">
            <Row>
              <TF label="Primary Contact Name" value="John Smith" onChange={() => {}} />
              <TF label="Email" value={`edi.support@${partner.id}.com`} onChange={() => {}} />
            </Row>
            <Row>
              <TF label="Phone" value="+65 6123 4567" onChange={() => {}} />
              <TF label="Country" value="Singapore" onChange={() => {}} />
            </Row>
            <Row><TF label="Notes" value="" onChange={() => {}} placeholder="Free-text notes about this partner or trading agreement…" /></Row>
          </SectionCard>
          <SectionCard title="Agreement" icon="fileText">
            <Row>
              <TF label="EDI Agreement Ref" value={`EDIA-${partner.code}-2024`} onChange={() => {}} mono />
              <TF label="Go-Live Date" value="2024-01-15" onChange={() => {}} type="date" />
            </Row>
            <Row>
              <TF label="Review Date" value="2026-12-31" onChange={() => {}} type="date" />
              <TF label="Account Manager" value="Somchai K." onChange={() => {}} />
            </Row>
          </SectionCard>
        </div>
      )}

      {/* TRANSMISSION */}
      {tab === 'transmission' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Direction selector ── */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
            borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>
              Exchange Direction
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {([
                { id: 'inbound'  as TxDirection, icon: 'arrowDown',  label: 'Inbound Only',      desc: 'We receive from partner' },
                { id: 'outbound' as TxDirection, icon: 'arrowUp',    label: 'Outbound Only',     desc: 'We send to partner' },
                { id: 'both'     as TxDirection, icon: 'transferH',  label: 'Both Directions',   desc: 'Bidirectional exchange' },
              ] as const).map(opt => {
                const active = txDir === opt.id;
                return (
                  <button key={opt.id} onClick={() => setTxDir(opt.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                      borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: `2px solid ${active ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                      background: active ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                      transition: 'all 0.15s', flex: '1 1 160px', minWidth: 160, textAlign: 'left' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: active ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-subtle)',
                      color: active ? '#fff' : 'var(--gecko-text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={opt.icon} size={16} />
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700,
                        color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>
                        {opt.desc}
                      </div>
                    </div>
                    {active && (
                      <Icon name="checkCircle" size={16}
                        style={{ marginLeft: 'auto', color: 'var(--gecko-primary-600)', flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gecko-text-secondary)',
              display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Icon name="info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Direction defines which channel blocks appear below. Each channel is fully independent —
              inbound and outbound can use different protocols, servers, and credentials.
            </div>
          </div>

          {/* ── Channel blocks ── */}
          {(txDir === 'inbound' || txDir === 'both') && (
            <DirectionBlock
              direction="inbound"
              method={tx.inboundMethod}
              onMethodChange={m => patchTx({ inboundMethod: m })}
              cfg={tx}
              onCfgChange={patchTx}
            />
          )}
          {(txDir === 'outbound' || txDir === 'both') && (
            <DirectionBlock
              direction="outbound"
              method={tx.outboundMethod}
              onMethodChange={m => patchTx({ outboundMethod: m })}
              cfg={tx}
              onCfgChange={patchTx}
              onCopyFromInbound={txDir === 'both' ? copyInboundToOutbound : undefined}
            />
          )}
        </div>
      )}

      {/* MESSAGE TYPES */}
      {tab === 'messages' && (
        <div>
          <SectionCard title="EDI Message Type Configuration" icon="fileText">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--gecko-border)' }}>
                  {['Code','Description','Direction','Last Received / Sent','Active'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10,
                      fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--gecko-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MSG_CATALOGUE.map((m, i) => {
                  const active = msgActive[m.code];
                  return (
                    <tr key={m.code} style={{ borderBottom: '1px solid var(--gecko-bg-subtle)',
                      background: i % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)',
                          background: 'var(--gecko-primary-50)', padding: '2px 6px', borderRadius: 4 }}>
                          {m.code}
                        </code>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--gecko-text-primary)' }}>{m.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 8px',
                          borderRadius: 3, textTransform: 'uppercase',
                          background: m.dir === 'IN' ? 'var(--gecko-primary-50)' : 'var(--gecko-success-50)',
                          color: m.dir === 'IN' ? 'var(--gecko-primary-700)' : 'var(--gecko-success-700)' }}>
                          {m.dir === 'IN' ? '↓ IN' : '↑ OUT'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                        {active ? '2026-05-04 09:14' : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => setMsgActive(ma => ({ ...ma, [m.code]: !ma[m.code] }))}
                          style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                            background: active ? 'var(--gecko-success-500)' : 'var(--gecko-gray-300)',
                            position: 'relative', transition: 'background 0.2s' }}>
                          <span style={{ position: 'absolute', top: 3, left: active ? 18 : 3, width: 16, height: 16,
                            borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {/* ACTIVITY LOG */}
      {tab === 'activity' && (
        <div>
          <SectionCard title="Transmission Activity Log" icon="activity">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
                <input className="gecko-input gecko-input-sm" placeholder="Search message type, ref…" style={{ paddingLeft: 32 }} />
              </div>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', gap: 6 }}>
                <Icon name="download" size={13} /> Export
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--gecko-border)' }}>
                  {['Timestamp','Message Type','Direction','Size','Reference','Status','Error'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10,
                      fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--gecko-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIVITY_LOG.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--gecko-bg-subtle)',
                    background: row.status === 'error' ? 'var(--gecko-error-50)' : i % 2 === 0 ? '#fff' : 'var(--gecko-bg-subtle)' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gecko-text-secondary)', fontFamily: 'monospace' }}>{row.ts}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)',
                        background: 'var(--gecko-primary-50)', padding: '2px 6px', borderRadius: 4 }}>{row.msgType}</code>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                        color: row.dir === 'IN' ? 'var(--gecko-primary-700)' : 'var(--gecko-success-700)' }}>
                        <Icon name={row.dir === 'IN' ? 'arrowDown' : 'arrowUp'} size={12} /> {row.dir}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{row.size}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--gecko-text-secondary)' }}>{row.ref}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span className={`gecko-badge gecko-badge-${row.status === 'ok' ? 'success' : row.status === 'warn' ? 'warning' : 'error'}`} style={{ fontSize: 10 }}>
                        {row.status === 'ok' ? '✓ OK' : row.status === 'warn' ? '⚠ Warn' : '✗ Error'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: row.status === 'error' ? 'var(--gecko-error-700)' : 'var(--gecko-text-disabled)',
                      maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div>
          <SectionCard title="IP Access Control" icon="shieldCheck">
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>
              Restrict inbound connections to specific IP addresses or CIDR ranges. Leave blank to allow all.
            </div>
            <Label>Allowed IP Ranges (CIDR, one per line)</Label>
            <textarea className="gecko-input" rows={5}
              defaultValue={'185.45.12.0/24\n203.116.88.0/24\n62.210.0.0/16'}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', padding: '8px 10px', marginBottom: 8 }} />
            <Toggle label="Enforce IP whitelist" value={true} onChange={() => {}} description="Reject connections from unlisted IPs" />
          </SectionCard>
          <SectionCard title="SSL / TLS Certificates" icon="lock">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Our Client Certificate', exp: '2027-01-15', status: 'valid' },
                { label: "Partner's Server Certificate (pinned)", exp: '2026-09-30', status: 'expiring' },
              ].map(cert => (
                <div key={cert.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8, border: '1px solid var(--gecko-border)',
                  background: cert.status === 'expiring' ? 'var(--gecko-warning-50)' : 'var(--gecko-bg-subtle)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{cert.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Expires {cert.exp}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`gecko-badge gecko-badge-${cert.status === 'valid' ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                      {cert.status === 'valid' ? '✓ Valid' : '⚠ Expiring Soon'}
                    </span>
                    <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ fontSize: 11 }}>Renew</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Audit Log — Security Events" icon="alertCircle">
            {[
              { ts: '2026-05-04 09:01', event: 'Successful SFTP authentication', ip: '185.45.12.44' },
              { ts: '2026-05-03 22:11', event: 'Successful SFTP authentication', ip: '185.45.12.44' },
              { ts: '2026-04-28 03:15', event: 'Failed authentication — wrong password (IP blocked after 5 attempts)', ip: '91.108.56.7' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gecko-bg-subtle)' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>{e.ts}</span>
                <span style={{ fontSize: 12, color: e.event.includes('Failed') ? 'var(--gecko-error-700)' : 'var(--gecko-text-primary)', flex: 1 }}>{e.event}</span>
                <code style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{e.ip}</code>
              </div>
            ))}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
