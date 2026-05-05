"use client";
import React, { useState, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';

// ── Types ──────────────────────────────────────────────────────────────────────

type SectionId = 'general' | 'financial' | 'gate' | 'yard' | 'notifications' | 'integration';

interface NavSection {
  id: SectionId;
  label: string;
  icon: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  { id: 'general',       label: 'General',         icon: 'globe'   },
  { id: 'financial',     label: 'Financial',        icon: 'tag'     },
  { id: 'gate',          label: 'Gate Operations',  icon: 'tool'    },
  { id: 'yard',          label: 'Yard Management',  icon: 'layers'  },
  { id: 'notifications', label: 'Notifications',    icon: 'bell'    },
  { id: 'integration',   label: 'Integration',      icon: 'zap'     },
];

// ── Shared primitives ──────────────────────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
      color: 'var(--gecko-text-secondary)', marginBottom: 12, paddingBottom: 6,
      borderBottom: '1px solid var(--gecko-border)',
    }}>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gecko-text-primary)', lineHeight: 1.4 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );
}

function TF({ value, onChange, mono, type, placeholder, readOnly, disabled }:{
  value: string; onChange?: (v: string) => void; mono?: boolean; type?: string;
  placeholder?: string; readOnly?: boolean; disabled?: boolean;
}) {
  return (
    <input
      type={type ?? 'text'}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      className="gecko-input gecko-input-sm"
      style={{ minWidth: 220, fontFamily: mono ? 'var(--gecko-font-mono)' : undefined,
        background: (readOnly || disabled) ? 'var(--gecko-bg-subtle)' : undefined,
        color: (readOnly || disabled) ? 'var(--gecko-text-secondary)' : undefined }}
    />
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="gecko-input gecko-input-sm" style={{ minWidth: 220 }}>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!on)}
        style={{
          width: 40, height: 22, borderRadius: 11, background: on ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-300)',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>{label}</span>}
    </label>
  );
}

function Radio({ name, value, selected, onChange, label }: {
  name: string; value: string; selected: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}>
      <input
        type="radio" name={name} value={value} checked={selected === value}
        onChange={() => onChange(value)}
        style={{ accentColor: 'var(--gecko-primary-600)', width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}>
      <input
        type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--gecko-primary-600)', width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

function SectionWrap({ title, onSave, savedMsg, children }: {
  title: string; onSave: () => void; savedMsg: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {savedMsg && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-success-600)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="checkCircle" size={14} /> Saved
            </span>
          )}
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="save" size={14} /> Save Section
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
      borderRadius: 10, padding: '18px 22px',
    }}>
      {children}
    </div>
  );
}

// ── Section 1 — General ────────────────────────────────────────────────────────

function GeneralSection({ onDirty }: { onDirty: () => void }) {
  const [facilityName, setFacilityName]   = useState('Laem Chabang ICD');
  const [facilityCode, setFacilityCode]   = useState('THLCB');
  const [locode, setLocode]               = useState('TH LCB');
  const [country, setCountry]             = useState('Thailand');
  const [facilityType, setFacilityType]   = useState('ICD + CFS');
  const [timezone, setTimezone]           = useState('Asia/Bangkok');
  const [dateFormat, setDateFormat]       = useState('DD MMM YYYY');
  const [timeFormat, setTimeFormat]       = useState('24');
  const [currency, setCurrency]           = useState('THB');
  const [language, setLanguage]           = useState('English');
  const [decimal, setDecimal]             = useState('period');
  const [addr1, setAddr1]                 = useState('');
  const [city, setCity]                   = useState('Chonburi');
  const [phone, setPhone]                 = useState('+66 38 490 xxx');
  const [email, setEmail]                 = useState('ops@logicon-lcb.th');
  const [savedMsg, setSavedMsg]           = useState(false);

  const d = (fn: (v: string) => void) => (v: string) => { fn(v); onDirty(); };
  const dr = (fn: (v: string) => void) => (v: string) => { fn(v); onDirty(); };

  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  return (
    <SectionWrap title="General" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>Facility Identity</GroupLabel>
        <FieldRow label="Facility Name">
          <TF value={facilityName} onChange={d(setFacilityName)} />
        </FieldRow>
        <FieldRow label="Facility Code" hint="Short uppercase code used in all documents">
          <TF value={facilityCode} onChange={v => { setFacilityCode(v.toUpperCase()); onDirty(); }} mono />
        </FieldRow>
        <FieldRow label="UN/LOCODE">
          <TF value={locode} onChange={d(setLocode)} mono />
        </FieldRow>
        <FieldRow label="Country">
          <Sel value={country} onChange={dr(setCountry)} options={[
            { v: 'Thailand',     l: 'Thailand'      },
            { v: 'Singapore',    l: 'Singapore'     },
            { v: 'Malaysia',     l: 'Malaysia'      },
            { v: 'Vietnam',      l: 'Vietnam'       },
            { v: 'Indonesia',    l: 'Indonesia'     },
            { v: 'Philippines',  l: 'Philippines'   },
            { v: 'China',        l: 'China'         },
            { v: 'Japan',        l: 'Japan'         },
          ]} />
        </FieldRow>
        <FieldRow label="Facility Type">
          <Sel value={facilityType} onChange={dr(setFacilityType)} options={[
            { v: 'ICD',          l: 'ICD — Inland Container Depot'    },
            { v: 'CFS',          l: 'CFS — Container Freight Station' },
            { v: 'ICD + CFS',    l: 'ICD + CFS (Combined)'            },
            { v: 'Container Terminal', l: 'Container Terminal'        },
          ]} />
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Locale & Format</GroupLabel>
        <FieldRow label="Timezone">
          <Sel value={timezone} onChange={dr(setTimezone)} options={[
            { v: 'Asia/Bangkok',    l: 'Asia/Bangkok (UTC+7)'       },
            { v: 'Asia/Singapore',  l: 'Asia/Singapore (UTC+8)'     },
            { v: 'Asia/Tokyo',      l: 'Asia/Tokyo (UTC+9)'         },
            { v: 'Asia/Shanghai',   l: 'Asia/Shanghai (UTC+8)'      },
            { v: 'Asia/Kolkata',    l: 'Asia/Kolkata (UTC+5:30)'    },
            { v: 'Europe/London',   l: 'Europe/London (UTC+0/+1)'   },
            { v: 'America/New_York',l: 'America/New_York (UTC-5/-4)'},
            { v: 'America/Los_Angeles', l: 'America/Los_Angeles (UTC-8/-7)' },
          ]} />
        </FieldRow>
        <FieldRow label="Date Format">
          <Sel value={dateFormat} onChange={dr(setDateFormat)} options={[
            { v: 'DD/MM/YYYY',   l: 'DD/MM/YYYY'   },
            { v: 'MM/DD/YYYY',   l: 'MM/DD/YYYY'   },
            { v: 'DD MMM YYYY',  l: 'DD MMM YYYY'  },
            { v: 'YYYY-MM-DD',   l: 'YYYY-MM-DD'   },
          ]} />
        </FieldRow>
        <FieldRow label="Time Format">
          <div style={{ display: 'flex', gap: 20 }}>
            <Radio name="timeFormat" value="12" selected={timeFormat} onChange={v => { setTimeFormat(v); onDirty(); }} label="12-hour" />
            <Radio name="timeFormat" value="24" selected={timeFormat} onChange={v => { setTimeFormat(v); onDirty(); }} label="24-hour" />
          </div>
        </FieldRow>
        <FieldRow label="Currency">
          <Sel value={currency} onChange={dr(setCurrency)} options={[
            { v: 'THB', l: 'THB — Thai Baht'             },
            { v: 'USD', l: 'USD — US Dollar'              },
            { v: 'EUR', l: 'EUR — Euro'                   },
            { v: 'SGD', l: 'SGD — Singapore Dollar'       },
            { v: 'MYR', l: 'MYR — Malaysian Ringgit'      },
            { v: 'JPY', l: 'JPY — Japanese Yen'           },
            { v: 'CNY', l: 'CNY — Chinese Yuan'           },
            { v: 'GBP', l: 'GBP — British Pound'          },
          ]} />
        </FieldRow>
        <FieldRow label="Language">
          <Sel value={language} onChange={dr(setLanguage)} options={[
            { v: 'English', l: 'English' },
            { v: 'Thai',    l: 'Thai'    },
            { v: 'Chinese', l: 'Chinese' },
            { v: 'Japanese',l: 'Japanese'},
          ]} />
        </FieldRow>
        <FieldRow label="Decimal Separator">
          <div style={{ display: 'flex', gap: 20 }}>
            <Radio name="decimal" value="period" selected={decimal} onChange={v => { setDecimal(v); onDirty(); }} label=". (period)" />
            <Radio name="decimal" value="comma"  selected={decimal} onChange={v => { setDecimal(v); onDirty(); }} label=", (comma)" />
          </div>
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Contact</GroupLabel>
        <FieldRow label="Address Line 1">
          <TF value={addr1} onChange={d(setAddr1)} placeholder="Street, industrial estate, postal code" />
        </FieldRow>
        <FieldRow label="City">
          <TF value={city} onChange={d(setCity)} />
        </FieldRow>
        <FieldRow label="Phone">
          <TF value={phone} onChange={d(setPhone)} type="tel" />
        </FieldRow>
        <FieldRow label="Email">
          <TF value={email} onChange={d(setEmail)} type="email" />
        </FieldRow>
      </Card>
    </SectionWrap>
  );
}

// ── Section 2 — Financial ──────────────────────────────────────────────────────

function FinancialSection({ onDirty }: { onDirty: () => void }) {
  const [invPrefix,    setInvPrefix]    = useState('INV-LCB-');
  const [nextInv,      setNextInv]      = useState('10481');
  const [resetAnn,     setResetAnn]     = useState(true);
  const [qtPrefix,     setQtPrefix]     = useState('QTE-LCB-');
  const [vatRate,      setVatRate]      = useState('7');
  const [taxReg,       setTaxReg]       = useState('0105556123456');
  const [taxStorage,   setTaxStorage]   = useState(true);
  const [taxHandling,  setTaxHandling]  = useState(true);
  const [taxDocs,      setTaxDocs]      = useState(true);
  const [taxReefer,    setTaxReefer]    = useState(false);
  const [payTerms,     setPayTerms]     = useState('30');
  const [penalty,      setPenalty]      = useState('1.5');
  const [penUnit,      setPenUnit]      = useState('month');
  const [creditLim,    setCreditLim]    = useState('500000');
  const [autoSuspend,  setAutoSuspend]  = useState(true);
  const [rateSrc,      setRateSrc]      = useState('Manual');
  const [usdRate,      setUsdRate]      = useState('35.42');
  const [eurRate,      setEurRate]      = useState('38.10');
  const [savedMsg,     setSavedMsg]     = useState(false);

  const d = (fn: (v: string) => void) => (v: string) => { fn(v); onDirty(); };
  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  return (
    <SectionWrap title="Financial" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>Invoice Numbering</GroupLabel>
        <FieldRow label="Invoice Prefix" hint="Prepended to every invoice number">
          <TF value={invPrefix} onChange={d(setInvPrefix)} mono />
        </FieldRow>
        <FieldRow label="Next Invoice Number">
          <TF value={nextInv} onChange={d(setNextInv)} type="number" mono />
        </FieldRow>
        <FieldRow label="Reset Annually" hint="Auto-reset counter on 1 Jan each year">
          <Toggle on={resetAnn} onChange={v => { setResetAnn(v); onDirty(); }} />
        </FieldRow>
        <FieldRow label="Quote Prefix">
          <TF value={qtPrefix} onChange={d(setQtPrefix)} mono />
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Tax & Rates</GroupLabel>
        <FieldRow label="VAT / GST Rate">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={vatRate} onChange={d(setVatRate)} type="number" />
            <span style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>%</span>
          </div>
        </FieldRow>
        <FieldRow label="Tax Registration Number">
          <TF value={taxReg} onChange={d(setTaxReg)} mono />
        </FieldRow>
        <FieldRow label="Apply Tax To" hint="Charge VAT/GST on these service categories">
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Checkbox checked={taxStorage}  onChange={v => { setTaxStorage(v);  onDirty(); }} label="Storage"           />
            <Checkbox checked={taxHandling} onChange={v => { setTaxHandling(v); onDirty(); }} label="Handling"          />
            <Checkbox checked={taxDocs}     onChange={v => { setTaxDocs(v);     onDirty(); }} label="Documentation"     />
            <Checkbox checked={taxReefer}   onChange={v => { setTaxReefer(v);   onDirty(); }} label="Reefer Monitoring" />
          </div>
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Payment Terms</GroupLabel>
        <FieldRow label="Default Payment Terms">
          <Sel value={payTerms} onChange={v => { setPayTerms(v); onDirty(); }} options={[
            { v: '7',  l: '7 days'  }, { v: '14', l: '14 days' }, { v: '30', l: '30 days' },
            { v: '45', l: '45 days' }, { v: '60', l: '60 days' }, { v: '90', l: '90 days' },
          ]} />
        </FieldRow>
        <FieldRow label="Late Payment Penalty">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={penalty} onChange={d(setPenalty)} type="number" />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>% per</span>
            <Sel value={penUnit} onChange={v => { setPenUnit(v); onDirty(); }} options={[
              { v: 'month', l: 'month' }, { v: 'week', l: 'week' }, { v: 'year', l: 'year' },
            ]} />
          </div>
        </FieldRow>
        <FieldRow label="Credit Limit Default" hint="Default credit limit for new customers (THB)">
          <TF value={creditLim} onChange={d(setCreditLim)} type="number" />
        </FieldRow>
        <FieldRow label="Auto-suspend on Overdue" hint="Block bookings when account is overdue">
          <Toggle on={autoSuspend} onChange={v => { setAutoSuspend(v); onDirty(); }} />
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Currency Exchange</GroupLabel>
        <FieldRow label="Base Currency">
          <TF value="THB" readOnly />
        </FieldRow>
        <FieldRow label="Rate Source">
          <Sel value={rateSrc} onChange={v => { setRateSrc(v); onDirty(); }} options={[
            { v: 'Manual', l: 'Manual' }, { v: 'ECB', l: 'ECB (European Central Bank)' }, { v: 'XE', l: 'XE.com' },
          ]} />
        </FieldRow>
        <FieldRow label="USD Rate (per THB)">
          <TF value={usdRate} onChange={d(setUsdRate)} type="number" mono />
        </FieldRow>
        <FieldRow label="EUR Rate (per THB)">
          <TF value={eurRate} onChange={d(setEurRate)} type="number" mono />
        </FieldRow>
      </Card>
    </SectionWrap>
  );
}

// ── Section 3 — Gate Operations ───────────────────────────────────────────────

function GateSection({ onDirty }: { onDirty: () => void }) {
  const [slotDur,     setSlotDur]    = useState('2');
  const [maxCtr,      setMaxCtr]     = useState('4');
  const [leadTime,    setLeadTime]   = useState('4');
  const [walkIn,      setWalkIn]     = useState(true);
  const [walkInFee,   setWalkInFee]  = useState('200');
  const [eirPrefix,   setEirPrefix]  = useState('EIR-LCB-');
  const [autoYard,    setAutoYard]   = useState(true);
  const [ctrCond,     setCtrCond]    = useState('Sound');
  const [requireVgm,  setRequireVgm] = useState(true);
  const [vgmTol,      setVgmTol]     = useState('500');
  const [overdue,     setOverdue]    = useState('30');
  const [alertPct,    setAlertPct]   = useState('80');
  const [escalate,    setEscalate]   = useState('60');
  const [escEmail,    setEscEmail]   = useState('ops-manager@logicon-lcb.th');
  const [savedMsg,    setSavedMsg]   = useState(false);

  const d = (fn: (v: string) => void) => (v: string) => { fn(v); onDirty(); };
  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  return (
    <SectionWrap title="Gate Operations" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>Processing Defaults</GroupLabel>
        <FieldRow label="Default Slot Duration">
          <Sel value={slotDur} onChange={v => { setSlotDur(v); onDirty(); }} options={[
            { v: '1', l: '1 hour'  }, { v: '2', l: '2 hours' }, { v: '4', l: '4 hours' },
          ]} />
        </FieldRow>
        <FieldRow label="Max Containers per Visit">
          <TF value={maxCtr} onChange={d(setMaxCtr)} type="number" />
        </FieldRow>
        <FieldRow label="Appointment Lead Time" hint="Minimum notice required for booking">
          <Sel value={leadTime} onChange={v => { setLeadTime(v); onDirty(); }} options={[
            { v: '1', l: '1 hour minimum'  }, { v: '2', l: '2 hours minimum' },
            { v: '4', l: '4 hours minimum' }, { v: '8', l: '8 hours minimum' },
            { v: '24', l: '24 hours minimum' },
          ]} />
        </FieldRow>
        <FieldRow label="Walk-in Allowed" hint="Allow trucks without prior appointments">
          <Toggle on={walkIn} onChange={v => { setWalkIn(v); onDirty(); }} />
        </FieldRow>
        {walkIn && (
          <FieldRow label="Walk-in Surcharge (THB)" hint="Extra fee for unscheduled arrivals">
            <TF value={walkInFee} onChange={d(setWalkInFee)} type="number" mono />
          </FieldRow>
        )}
      </Card>

      <Card>
        <GroupLabel>EIR Settings</GroupLabel>
        <FieldRow label="EIR Number Prefix">
          <TF value={eirPrefix} onChange={d(setEirPrefix)} mono />
        </FieldRow>
        <FieldRow label="Auto-assign Yard Spot" hint="System auto-assigns a yard bay on gate-in">
          <Toggle on={autoYard} onChange={v => { setAutoYard(v); onDirty(); }} />
        </FieldRow>
        <FieldRow label="Default Container Condition">
          <Sel value={ctrCond} onChange={v => { setCtrCond(v); onDirty(); }} options={[
            { v: 'Sound',  l: 'Sound'  }, { v: 'Damaged', l: 'Damaged' }, { v: 'Suspect', l: 'Suspect' },
          ]} />
        </FieldRow>
        <FieldRow label="Require VGM for Export Laden" hint="Block EIR-Out without verified gross mass">
          <Toggle on={requireVgm} onChange={v => { setRequireVgm(v); onDirty(); }} />
        </FieldRow>
        <FieldRow label="VGM Tolerance" hint="Allowed variance in kg from declared weight">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>±</span>
            <TF value={vgmTol} onChange={d(setVgmTol)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>kg</span>
          </div>
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Overdue & SLA</GroupLabel>
        <FieldRow label="Overdue Threshold" hint="Minutes a truck may wait before flagged overdue">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={overdue} onChange={d(setOverdue)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>minutes</span>
          </div>
        </FieldRow>
        <FieldRow label="Alert At (% of threshold)" hint="Early-warning trigger percentage">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={alertPct} onChange={d(setAlertPct)} type="number" mono />
            <span style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>%</span>
          </div>
        </FieldRow>
        <FieldRow label="Auto-escalate After" hint="Escalate alert after this many minutes">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={escalate} onChange={d(setEscalate)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>minutes</span>
          </div>
        </FieldRow>
        <FieldRow label="Escalation Recipient">
          <TF value={escEmail} onChange={d(setEscEmail)} type="email" />
        </FieldRow>
      </Card>
    </SectionWrap>
  );
}

// ── Section 4 — Yard Management ───────────────────────────────────────────────

function YardSection({ onDirty }: { onDirty: () => void }) {
  const [t40std,  setT40std]  = useState('2.00');
  const [t45hc,   setT45hc]   = useState('2.25');
  const [t20rf,   setT20rf]   = useState('1.00');
  const [t40rf,   setT40rf]   = useState('2.00');
  const [maxTier, setMaxTier] = useState('5');
  const [rfTier,  setRfTier]  = useState('3');
  const [hzTier,  setHzTier]  = useState('2');
  const [hzSeg,   setHzSeg]   = useState('10');
  const [autoRepo,setAutoRepo]= useState(true);
  const [impDwell,setImpDwell]= useState('7');
  const [expDwell,setExpDwell]= useState('5');
  const [empDwell,setEmpDwell]= useState('14');
  const [freeImp, setFreeImp] = useState('5');
  const [freeExp, setFreeExp] = useState('3');
  const [savedMsg,setSavedMsg]= useState(false);

  const d = (fn: (v: string) => void) => (v: string) => { fn(v); onDirty(); };
  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  return (
    <SectionWrap title="Yard Management" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>TEU Factors</GroupLabel>
        <FieldRow label="20ft Standard">
          <TF value="1.00" readOnly mono />
          <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>TEU (fixed baseline)</span>
        </FieldRow>
        <FieldRow label="40ft Standard">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={t40std} onChange={d(setT40std)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>TEU</span>
          </div>
        </FieldRow>
        <FieldRow label="45ft HC">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={t45hc} onChange={d(setT45hc)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>TEU</span>
          </div>
        </FieldRow>
        <FieldRow label="20ft Reefer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={t20rf} onChange={d(setT20rf)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>TEU</span>
          </div>
        </FieldRow>
        <FieldRow label="40ft Reefer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={t40rf} onChange={d(setT40rf)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>TEU</span>
          </div>
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Stacking Rules</GroupLabel>
        <FieldRow label="Default Max Tier Height" hint="Maximum stack height for standard containers">
          <TF value={maxTier} onChange={d(setMaxTier)} type="number" mono />
        </FieldRow>
        <FieldRow label="Reefer Max Tier" hint="Lower limit for reefer containers (monitoring access)">
          <TF value={rfTier} onChange={d(setRfTier)} type="number" mono />
        </FieldRow>
        <FieldRow label="Hazmat Max Tier" hint="Maximum permitted stack height for DG/HAZM">
          <TF value={hzTier} onChange={d(setHzTier)} type="number" mono />
        </FieldRow>
        <FieldRow label="Segregation Distance (Hazmat)" hint="Minimum clearance between DG containers (metres)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={hzSeg} onChange={d(setHzSeg)} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>metres</span>
          </div>
        </FieldRow>
        <FieldRow label="Auto-reposition on Overflow" hint="Automatically move containers when zone is full">
          <Toggle on={autoRepo} onChange={v => { setAutoRepo(v); onDirty(); }} />
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Dwell Alerts</GroupLabel>
        <FieldRow label="Import Dwell Alert (days)" hint="Alert when import container exceeds this dwell">
          <TF value={impDwell} onChange={d(setImpDwell)} type="number" mono />
        </FieldRow>
        <FieldRow label="Export Dwell Alert (days)" hint="Alert when export container exceeds this dwell">
          <TF value={expDwell} onChange={d(setExpDwell)} type="number" mono />
        </FieldRow>
        <FieldRow label="Empty Dwell Alert (days)" hint="Alert when empty container exceeds this dwell">
          <TF value={empDwell} onChange={d(setEmpDwell)} type="number" mono />
        </FieldRow>
        <FieldRow label="Free Time — Import (days)" hint="Days before storage charges begin on imports">
          <TF value={freeImp} onChange={d(setFreeImp)} type="number" mono />
        </FieldRow>
        <FieldRow label="Free Time — Export (days)" hint="Days before storage charges begin on exports">
          <TF value={freeExp} onChange={d(setFreeExp)} type="number" mono />
        </FieldRow>
      </Card>
    </SectionWrap>
  );
}

// ── Section 5 — Notifications ─────────────────────────────────────────────────

interface NotifRule {
  id: string;
  event: string;
  trigger: string;
  recipients: string;
  channel: 'Email' | 'SMS' | 'Email+SMS';
  active: boolean;
}

const INITIAL_RULES: NotifRule[] = [
  { id: 'r1', event: 'Truck Overdue',         trigger: '>30 min wait',    recipients: 'Gate Supervisors',       channel: 'Email',     active: true  },
  { id: 'r2', event: 'Vessel ETA Change',     trigger: 'Any change',      recipients: 'Planner, Ops Mgr',       channel: 'Email',     active: true  },
  { id: 'r3', event: 'Yard >90% Capacity',    trigger: 'Any zone',        recipients: 'Yard Planner, Ops Mgr',  channel: 'Email+SMS', active: true  },
  { id: 'r4', event: 'EDI Failure',           trigger: 'Any error',       recipients: 'EDI Admin, IT',          channel: 'Email',     active: true  },
  { id: 'r5', event: 'Invoice Overdue',       trigger: '>30 days',        recipients: 'Billing Clerk, Finance', channel: 'Email',     active: true  },
  { id: 'r6', event: 'DG Container Arrival',  trigger: 'Any HAZM',        recipients: 'Safety Officer',         channel: 'Email+SMS', active: true  },
  { id: 'r7', event: 'Reefer Alarm',          trigger: 'Temp deviation',  recipients: 'Reefer Supervisor',      channel: 'SMS',       active: true  },
  { id: 'r8', event: 'System Maintenance',    trigger: 'Scheduled',       recipients: 'All Users',              channel: 'Email',     active: false },
];

function NotificationsSection({ onDirty }: { onDirty: () => void }) {
  const [rules,      setRules]      = useState<NotifRule[]>(INITIAL_RULES);
  const [gateSups,   setGateSups]   = useState('supervisor1@logicon-lcb.th\nsupervisor2@logicon-lcb.th');
  const [yardPlan,   setYardPlan]   = useState('yardplanner@logicon-lcb.th');
  const [opsMgr,     setOpsMgr]     = useState('ops-manager@logicon-lcb.th');
  const [savedMsg,   setSavedMsg]   = useState(false);

  const toggleRule = (id: string) => {
    setRules(r => r.map(x => x.id === id ? { ...x, active: !x.active } : x));
    onDirty();
  };

  const channelBadge = (c: NotifRule['channel']) => {
    const cfg = {
      'Email':     { bg: 'var(--gecko-primary-50)',  color: 'var(--gecko-primary-700)' },
      'SMS':       { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)' },
      'Email+SMS': { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)' },
    };
    const s = cfg[c];
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
        background: s.bg, color: s.color, letterSpacing: '0.04em' }}>{c}</span>
    );
  };

  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  return (
    <SectionWrap title="Notifications" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>Email Alerts — Trigger Events</GroupLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                {['Event', 'Trigger', 'Recipients', 'Channel', 'Active'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--gecko-border)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--gecko-bg-subtle)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{r.event}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gecko-text-secondary)' }}>{r.trigger}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{r.recipients}</td>
                  <td style={{ padding: '10px 12px' }}>{channelBadge(r.channel)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Toggle on={r.active} onChange={() => toggleRule(r.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={14} /> Add Rule
          </button>
        </div>
      </Card>

      <Card>
        <GroupLabel>Recipient Groups</GroupLabel>
        <FieldRow label="Gate Supervisors" hint="One email per line">
          <textarea
            value={gateSups} onChange={e => { setGateSups(e.target.value); onDirty(); }}
            rows={3} className="gecko-input"
            style={{ minWidth: 340, resize: 'vertical', fontSize: 12, padding: '8px 10px' }}
          />
        </FieldRow>
        <FieldRow label="Yard Planner" hint="One email per line">
          <textarea
            value={yardPlan} onChange={e => { setYardPlan(e.target.value); onDirty(); }}
            rows={2} className="gecko-input"
            style={{ minWidth: 340, resize: 'vertical', fontSize: 12, padding: '8px 10px' }}
          />
        </FieldRow>
        <FieldRow label="Ops Manager" hint="One email per line">
          <textarea
            value={opsMgr} onChange={e => { setOpsMgr(e.target.value); onDirty(); }}
            rows={2} className="gecko-input"
            style={{ minWidth: 340, resize: 'vertical', fontSize: 12, padding: '8px 10px' }}
          />
        </FieldRow>
      </Card>
    </SectionWrap>
  );
}

// ── Section 6 — Integration ───────────────────────────────────────────────────

interface Webhook {
  id: string;
  event: string;
  url: string;
  secret: string;
  lastTriggered: string;
  status: 'active' | 'failing' | 'inactive';
}

const INITIAL_WEBHOOKS: Webhook[] = [
  { id: 'wh1', event: 'booking.created', url: 'https://erp.logicon-lcb.th/hooks/booking', secret: '••••••', lastTriggered: '2 min ago',  status: 'active'   },
  { id: 'wh2', event: 'gate.eir_in',     url: 'https://pcs.port.go.th/webhook/gate',      secret: '••••••', lastTriggered: '14 min ago', status: 'active'   },
  { id: 'wh3', event: 'vessel.arrived',  url: 'https://customs.rd.go.th/api/vessel',       secret: '••••••', lastTriggered: '3 hrs ago',  status: 'failing'  },
];

function IntegrationSection({ onDirty }: { onDirty: () => void }) {
  const [prodRevealed, setProdRevealed] = useState(false);
  const [stgRevealed,  setStgRevealed]  = useState(false);
  const [rateLimit,    setRateLimit]    = useState('1000');
  const [webhooks,     setWebhooks]     = useState<Webhook[]>(INITIAL_WEBHOOKS);
  const [cwInt,        setCwInt]        = useState(false);
  const [pcsInt,       setPcsInt]       = useState(true);
  const [customsInt,   setCustomsInt]   = useState(true);
  const [lloydInt,     setLloydInt]     = useState(false);
  const [savedMsg,     setSavedMsg]     = useState(false);

  const save = () => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); };

  const statusBadge = (s: Webhook['status']) => {
    const cfg = {
      active:   { bg: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', label: 'Active'   },
      failing:  { bg: 'var(--gecko-error-50)',   color: 'var(--gecko-error-700)',   label: 'Failing'  },
      inactive: { bg: 'var(--gecko-bg-subtle)',  color: 'var(--gecko-text-disabled)',label: 'Inactive' },
    };
    const c = cfg[s];
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
        background: c.bg, color: c.color, letterSpacing: '0.04em' }}>{c.label}</span>
    );
  };

  const removeWebhook = (id: string) => { setWebhooks(w => w.filter(x => x.id !== id)); onDirty(); };

  return (
    <SectionWrap title="Integration" onSave={save} savedMsg={savedMsg}>
      <Card>
        <GroupLabel>REST API</GroupLabel>
        <FieldRow label="API Base URL">
          <TF value="https://api.logicon-lcb.th/v2" readOnly mono />
        </FieldRow>
        <FieldRow label="API Key (Production)" hint="Use in Authorization: Bearer header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TF value={prodRevealed ? 'lc_prod_sk_4a8f923b1de04c2e3f9a' : 'lc_prod_••••••••••••3f9a'} readOnly mono />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setProdRevealed(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <Icon name="eye" size={13} /> {prodRevealed ? 'Hide' : 'Reveal'}
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
              onClick={() => { onDirty(); }}>
              <Icon name="refresh" size={13} /> Regenerate
            </button>
          </div>
        </FieldRow>
        <FieldRow label="API Key (Staging)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TF value={stgRevealed ? 'lc_stg_sk_9c12e456af874d017b2c' : 'lc_stg_••••••••••••7b2c'} readOnly mono />
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setStgRevealed(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <Icon name="eye" size={13} /> {stgRevealed ? 'Hide' : 'Reveal'}
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
              onClick={() => { onDirty(); }}>
              <Icon name="refresh" size={13} /> Regenerate
            </button>
          </div>
        </FieldRow>
        <FieldRow label="Rate Limit" hint="Maximum API requests allowed per minute">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TF value={rateLimit} onChange={v => { setRateLimit(v); onDirty(); }} type="number" mono />
            <span style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>req / min</span>
          </div>
        </FieldRow>
      </Card>

      <Card>
        <GroupLabel>Webhooks</GroupLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                {['Event', 'URL', 'Secret', 'Last Triggered', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh, i) => (
                <tr key={wh.id} style={{ borderBottom: '1px solid var(--gecko-border)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--gecko-bg-subtle)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--gecko-text-primary)',
                    fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>{wh.event}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gecko-text-secondary)', fontSize: 11,
                    fontFamily: 'var(--gecko-font-mono)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wh.url}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>
                    {wh.secret}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--gecko-text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {wh.lastTriggered}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(wh.status)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Edit webhook">
                        <Icon name="edit" size={14} />
                      </button>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" title="Delete webhook"
                        onClick={() => removeWebhook(wh.id)}
                        style={{ color: 'var(--gecko-error-600)' }}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={14} /> Add Webhook
          </button>
        </div>
      </Card>

      <Card>
        <GroupLabel>External Systems</GroupLabel>

        {/* CargoWise */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--gecko-border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>CargoWise Integration</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Sync shipments, customs events, and billing with CargoWise One
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: cwInt ? 'var(--gecko-success-600)' : 'var(--gecko-text-disabled)', fontWeight: 600 }}>
              {cwInt ? 'Enabled' : 'Disabled'}
            </span>
            <Toggle on={cwInt} onChange={v => { setCwInt(v); onDirty(); }} />
          </div>
        </div>

        {/* PCS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--gecko-border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Port Community System (PCS)</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Real-time data exchange with the national port community platform
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {pcsInt && (
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ fontSize: 12 }}>
                Configure
              </button>
            )}
            <Toggle on={pcsInt} onChange={v => { setPcsInt(v); onDirty(); }} />
          </div>
        </div>

        {/* Thai Customs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--gecko-border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Customs API (Thai Customs)</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Electronic customs declaration and release notifications
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {customsInt && (
              <span style={{ fontSize: 11, color: 'var(--gecko-success-600)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="checkCircle" size={13} /> Connected
              </span>
            )}
            <Toggle on={customsInt} onChange={v => { setCustomsInt(v); onDirty(); }} />
          </div>
        </div>

        {/* Lloyd's */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{"Lloyd's Register API"}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Vessel register, IMO data, and classification society lookups
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: lloydInt ? 'var(--gecko-success-600)' : 'var(--gecko-text-disabled)', fontWeight: 600 }}>
              {lloydInt ? 'Enabled' : 'Disabled'}
            </span>
            <Toggle on={lloydInt} onChange={v => { setLloydInt(v); onDirty(); }} />
          </div>
        </div>
      </Card>
    </SectionWrap>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SystemParamsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [dirtyMap, setDirtyMap] = useState<Record<SectionId, boolean>>({
    general: false, financial: false, gate: false, yard: false, notifications: false, integration: false,
  });

  const markDirty = useCallback((id: SectionId) => {
    setDirtyMap(m => ({ ...m, [id]: true }));
  }, []);

  // Each section's onDirty is bound to its own id
  const makeDirtyHandler = (id: SectionId) => () => markDirty(id);

  const clearDirty = useCallback((id: SectionId) => {
    setDirtyMap(m => ({ ...m, [id]: false }));
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case 'general':       return <GeneralSection       onDirty={makeDirtyHandler('general')}       />;
      case 'financial':     return <FinancialSection     onDirty={makeDirtyHandler('financial')}     />;
      case 'gate':          return <GateSection          onDirty={makeDirtyHandler('gate')}          />;
      case 'yard':          return <YardSection          onDirty={makeDirtyHandler('yard')}          />;
      case 'notifications': return <NotificationsSection onDirty={makeDirtyHandler('notifications')} />;
      case 'integration':   return <IntegrationSection   onDirty={makeDirtyHandler('integration')}   />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gecko-primary-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="settings" size={18} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--gecko-text-primary)' }}>
            System Parameters
          </h1>
          <span className="gecko-badge gecko-badge-info" style={{ fontSize: 10 }}>Super User</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--gecko-text-secondary)', paddingLeft: 42 }}>
          Global facility settings, operational defaults, and integration parameters
        </p>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left Navigation ── */}
        <div style={{
          width: 220, flexShrink: 0,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 10, overflow: 'hidden',
          position: 'sticky', top: 80,
        }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--gecko-text-secondary)' }}>
              Configuration
            </div>
          </div>
          <div style={{ padding: '6px 0' }}>
            {NAV_SECTIONS.map(sec => {
              const isActive = activeSection === sec.id;
              const isDirty  = dirtyMap[sec.id];
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 14px 9px 12px',
                    background: isActive ? 'var(--gecko-primary-50)' : 'transparent',
                    color: isActive ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                    fontWeight: isActive ? 700 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: 'none',
                    borderLeft: isActive ? '3px solid var(--gecko-primary-600)' : '3px solid transparent',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <Icon name={sec.icon} size={15}
                    style={{ color: isActive ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{sec.label}</span>
                  {isDirty && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)',
                      letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>
                      Unsaved
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Info footer */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gecko-border)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'var(--gecko-bg-subtle)' }}>
            <Icon name="shieldCheck" size={13} style={{ color: 'var(--gecko-success-600)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', lineHeight: 1.5 }}>
              Changes saved per section. All edits are audit-logged.
            </div>
          </div>
        </div>

        {/* ── Content Panel ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
