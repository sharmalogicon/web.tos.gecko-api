"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { PartyPicker } from '../../_components/PartyPicker';
import {
  FLAG_AXES, LIST_AXES, MODIFIER_OPS, NUMERIC_AXES,
  PRICING_METHODS, TIER_BASES, TYPE_TONE, parseTiers, rowErrors,
  type ConditionItem, type FreeTimeItem, type FreeTimeKind, type FreeTimeSet, type PricingMethod,
  type RateItem, type RateSet, type SaveScheduleRequest, type Schedule, type ScheduleType, type TierBasis,
} from '@/lib/api/revenue';
import {
  chargeVariants, useTariffCatalogs, type ChargeVariant, type CodeOption, type TariffCatalogs,
} from '@/lib/api/tariff-catalogs';

/**
 * NEW QUOTATION — LIVE against Gecko.Revenue.
 *
 * A quotation is a tariff schedule: PUBLIC (the depot's price list) or
 * CONTRACT (for a named customer / agent / forwarder). Saving does, in order:
 *
 *   POST /api/revenue/tariffs              the header → a DRAFT, version 1
 *   PUT  /api/revenue/tariffs/{id}/rates   the whole rate table, as a set
 *   PUT  /api/revenue/tariffs/{id}/free-time
 *
 * each guarded by the schedule's rowVersion. If the rates are refused, the
 * draft already exists: the errors are shown per row and "Save" retries the
 * PUTs against the same draft rather than creating a second one. Then the
 * detail page takes over for submit → approve (maker-checker).
 *
 * Rates for a big customer come from Excel instead: "Create draft & load from
 * Excel" creates the header and opens the draft on its Excel tab
 * (download template → upload → preview → apply).
 */

const MODULE_CODE = 'TOS';

interface ConditionDraft {
  key: string;
  axis: string;
  op: string;
  values: string;
  number: string;
  flag: boolean;
  modifierOp: string;
  modifierValue: string;
  label: string;
}

interface RateDraft {
  key: string;
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  creditTermDays: string;
  orderTypeCode: string;
  movementCode: string;
  equipmentTypeCode: string;
  equipmentSize: string;
  cargoCategoryCode: string;
  truckCategoryCode: string;
  billingUnitCode: string;
  pricingMethod: PricingMethod;
  tierBasis: TierBasis | '';
  rate: string;
  tiersText: string;
  conditions: ConditionDraft[];
  open: boolean;
}

interface FreeTimeDraft {
  key: string;
  freeTimeKind: FreeTimeKind;
  fullEmpty: string;
  direction: string;
  cargoGroup: string;
  equipmentSize: string;
  freeUnits: string;
}

let seed = 0;
const newKey = () => `k${++seed}`;
const today = () => new Date().toISOString().slice(0, 10);
const blank = (v: string) => (v.trim() === '' ? null : v.trim());
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));

const newRate = (): RateDraft => ({
  key: newKey(), chargeCode: '', billTo: 'CUSTOMER', paymentTermCode: 'CASH', creditTermDays: '',
  orderTypeCode: '', movementCode: '', equipmentTypeCode: '', equipmentSize: '', cargoCategoryCode: '', truckCategoryCode: '',
  billingUnitCode: '', pricingMethod: 'FLAT', tierBasis: '', rate: '', tiersText: '', conditions: [], open: false,
});

const newCondition = (): ConditionDraft => ({
  key: newKey(), axis: 'EQUIPMENT_SIZE', op: 'IN', values: '', number: '', flag: true, modifierOp: 'ADD', modifierValue: '', label: '',
});

const newFreeTime = (): FreeTimeDraft => ({
  key: newKey(), freeTimeKind: 'STORAGE', fullEmpty: '', direction: '', cargoGroup: '', equipmentSize: '', freeUnits: '',
});

function toConditionItem(c: ConditionDraft): ConditionItem {
  const isFlag = FLAG_AXES.includes(c.axis);
  const isNumeric = NUMERIC_AXES.includes(c.axis);
  return {
    axis: c.axis,
    op: isFlag ? 'IS' : c.op,
    values: isFlag || isNumeric ? [] : c.values.split(/[,\s]+/).map(v => v.trim().toUpperCase()).filter(Boolean),
    number: isNumeric ? num(c.number) : null,
    flag: isFlag ? c.flag : null,
    modifierOp: c.modifierOp,
    modifierValue: num(c.modifierValue) ?? 0,
    label: blank(c.label),
  };
}

/** Local problems the server would also refuse, caught before a round trip. */
function toRateItem(r: RateDraft): { item: RateItem; problem: string | null } {
  const tiered = r.pricingMethod !== 'FLAT';
  const parsed = tiered ? parseTiers(r.tiersText) : { tiers: [], error: null };
  return {
    item: {
      chargeCode: r.chargeCode.trim().toUpperCase(),
      billTo: r.billTo,
      paymentTermCode: r.paymentTermCode,
      creditTermDays: num(r.creditTermDays),
      orderTypeCode: blank(r.orderTypeCode),
      movementCode: blank(r.movementCode),
      equipmentTypeCode: blank(r.equipmentTypeCode),
      equipmentSize: blank(r.equipmentSize),
      cargoCategoryCode: blank(r.cargoCategoryCode),
      truckCategoryCode: blank(r.truckCategoryCode),
      billingUnitCode: blank(r.billingUnitCode),
      pricingMethod: r.pricingMethod,
      tierBasis: tiered ? (r.tierBasis || null) : null,
      rate: tiered ? null : num(r.rate),
      tiers: parsed.tiers,
      conditions: r.conditions.map(toConditionItem),
    },
    problem: parsed.error,
  };
}

function toFreeTimeItem(f: FreeTimeDraft): FreeTimeItem {
  return {
    freeTimeKind: f.freeTimeKind,
    freeUnits: num(f.freeUnits) ?? 0,
    fullEmpty: (blank(f.fullEmpty) as FreeTimeItem['fullEmpty']) ?? null,
    direction: (blank(f.direction) as FreeTimeItem['direction']) ?? null,
    cargoGroup: (blank(f.cargoGroup) as FreeTimeItem['cargoGroup']) ?? null,
    equipmentSize: blank(f.equipmentSize),
  };
}

interface Branch { branchId: string; branchCode: string; displayName: string; isActive: boolean }

export default function NewQuotationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { can, status } = useSession();
  const { catalogs, errors: catalogErrors, loading: catalogsLoading } = useTariffCatalogs(MODULE_CODE);
  const { data: branches } = useApiList<Branch>('/api/branches?pageSize=100');

  // header
  const [type, setType] = useState<ScheduleType>('CONTRACT');
  const [scheduleNo, setScheduleNo] = useState('');
  const [scheduleNoTouched, setScheduleNoTouched] = useState(false);
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [customer, setCustomer] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [forwarder, setForwarder] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState('');
  const [currencyCode, setCurrencyCode] = useState('THB');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [waiveDamaged, setWaiveDamaged] = useState(false);
  const [remarks, setRemarks] = useState('');

  // body
  const [rates, setRates] = useState<RateDraft[]>(() => [newRate()]);
  const [freeTime, setFreeTime] = useState<FreeTimeDraft[]>([]);
  const [variants, setVariants] = useState<Record<string, ChargeVariant[]>>({});

  // save state
  const [created, setCreated] = useState<Schedule | null>(null);
  const [rowVersion, setRowVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'excel' | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [headerErrors, setHeaderErrors] = useState<ApiError | null>(null);
  const [rateErrs, setRateErrs] = useState<Map<string, Record<string, string[]>>>(new Map());
  const [rateSetError, setRateSetError] = useState<string | null>(null);
  const [freeErrs, setFreeErrs] = useState<{ rows: Map<string, Record<string, string[]>>; whole: string | null }>({ rows: new Map(), whole: null });

  const canManage = can('revenue.tariff.manage');
  const canImport = can('revenue.import.manage');

  const suggestedNo = useMemo(() => {
    const party = customer ?? agent ?? forwarder;
    if (type === 'PUBLIC') return `PUB-${effectiveFrom.slice(0, 4)}`;
    if (type === 'SPOT') return bookingRef ? `SPOT-${bookingRef.toUpperCase()}` : '';
    return party ? `CTR-${party}` : '';
  }, [type, customer, agent, forwarder, bookingRef, effectiveFrom]);
  const effectiveNo = (scheduleNoTouched ? scheduleNo : scheduleNo || suggestedNo).trim().toUpperCase();

  const headerError = (field: string) => headerErrors?.forField(field);

  function changeType(next: ScheduleType) {
    setType(next);
    if (next === 'PUBLIC') { setCustomer(null); setAgent(null); setForwarder(null); setBookingRef(''); }
    if (next === 'CONTRACT') setBookingRef('');
  }

  const patchRate = (key: string, patch: Partial<RateDraft>) => setRates(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  async function pickCharge(key: string, code: string) {
    patchRate(key, { chargeCode: code });
    if (!code) return;
    const found = variants[code] ?? await chargeVariants(code);
    setVariants(v => ({ ...v, [code]: found }));
    if (found.length === 0) return;
    setRates(rs => rs.map(r => {
      if (r.key !== key) return r;
      const fits = found.some(v => v.billTo === r.billTo && v.paymentTermCode === r.paymentTermCode);
      const pick = fits ? null : found.find(v => v.paymentTermCode === r.paymentTermCode) ?? found[0];
      return pick
        ? { ...r, billTo: pick.billTo, paymentTermCode: pick.paymentTermCode, creditTermDays: pick.creditTermDays?.toString() ?? '' }
        : r;
    }));
  }

  function headerBody(): SaveScheduleRequest {
    return {
      scheduleNo: effectiveNo,
      name: name.trim(),
      moduleCode: MODULE_CODE,
      scheduleType: type,
      effectiveFrom,
      effectiveTo: blank(effectiveTo),
      branchId: blank(branchId),
      customerPartyCode: type === 'PUBLIC' ? null : customer,
      agentPartyCode: type === 'PUBLIC' ? null : agent,
      forwarderPartyCode: type === 'PUBLIC' ? null : forwarder,
      bookingRef: type === 'SPOT' ? blank(bookingRef) : null,
      currencyCode: currencyCode.trim().toUpperCase(),
      pricesIncludeTax,
      waiveDamagedEmptyStorage: waiveDamaged,
      remarks: blank(remarks),
    };
  }

  /** Header: create once, then PUT on retries. Returns the current rowVersion or null on failure. */
  async function saveHeader(): Promise<{ schedule: Schedule } | null> {
    try {
      const schedule = created
        ? await apiSend<Schedule>('PUT', `/api/revenue/tariffs/${created.scheduleId}`, { ...headerBody(), scheduleNo: created.scheduleNo, rowVersion })
        : await apiSend<Schedule>('POST', '/api/revenue/tariffs', headerBody());
      setCreated(schedule);
      setRowVersion(schedule.rowVersion);
      setHeaderErrors(null);
      return { schedule };
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setHeaderErrors(error);
      setBanner(error.message);
      return null;
    }
  }

  async function save(mode: 'save' | 'excel') {
    setSaving(mode);
    setBanner(null);
    setRateErrs(new Map());
    setRateSetError(null);
    setFreeErrs({ rows: new Map(), whole: null });

    // Local tier-text problems first — no point creating a draft the rates cannot follow.
    const drafted = mode === 'save' ? rates.filter(r => r.chargeCode.trim() !== '') : [];
    const converted = drafted.map(toRateItem);
    const local = new Map<number, Record<string, string[]>>();
    converted.forEach((c, i) => { if (c.problem) local.set(i, { tiers: [c.problem] }); });
    if (local.size > 0) {
      setRateErrs(remapToDrafts(local, drafted));
      setBanner('Some tier lists are not readable — fix the rows marked below.');
      setSaving(null);
      return;
    }

    const header = await saveHeader();
    if (!header) { setSaving(null); return; }
    let version = header.schedule.rowVersion;
    const id = header.schedule.scheduleId;

    if (mode === 'excel') {
      toast({ variant: 'success', title: 'Draft created', message: `${header.schedule.scheduleNo} — now load its rates from Excel.` });
      router.push(`/tariff/plans/${id}?tab=excel`);
      return;
    }

    if (converted.length > 0 || created) {
      try {
        const set = await apiSend<RateSet>('PUT', `/api/revenue/tariffs/${id}/rates`, { rowVersion: version, rates: converted.map(c => c.item) });
        version = set.rowVersion;
        setRowVersion(version);
      } catch (e) {
        const error = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
        const byRow = rowErrors(error.fieldErrors, 'rates');
        setRateErrs(remapToDrafts(byRow, drafted));
        const whole = Object.entries(error.fieldErrors).filter(([k]) => !/^rates\[/i.test(k)).flatMap(([, v]) => v);
        setRateSetError(byRow.size === 0 ? (whole[0] ?? error.message) : null);
        setBanner(`Draft ${header.schedule.scheduleNo} is saved, but its rates were refused (${byRow.size} row(s)). Fix them and save again — the same draft is updated.`);
        setSaving(null);
        return;
      }
    }

    const rules = freeTime.filter(f => f.freeUnits.trim() !== '');
    if (rules.length > 0 || created) {
      try {
        const set = await apiSend<FreeTimeSet>('PUT', `/api/revenue/tariffs/${id}/free-time`, { rowVersion: version, rules: rules.map(toFreeTimeItem) });
        setRowVersion(set.rowVersion);
      } catch (e) {
        const error = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
        const byRow = rowErrors(error.fieldErrors, 'rules');
        setFreeErrs({ rows: remapToDrafts(byRow, rules), whole: error.forField('rules') ?? (byRow.size === 0 ? error.message : null) });
        setBanner(`Draft ${header.schedule.scheduleNo} and its rates are saved, but the free-time rules were refused.`);
        setSaving(null);
        return;
      }
    }

    toast({ variant: 'success', title: 'Quotation drafted', message: `${header.schedule.scheduleNo} v1 — review and submit it for approval.` });
    router.push(`/tariff/plans/${id}`);
  }

  if (status === 'authenticated' && !canManage) {
    return (
      <div className="gecko-stack" style={{ padding: 24 }}>
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>You need revenue.tariff.manage to draft a quotation.</span>
        </div>
        <Link href="/tariff/plans" className="gecko-btn gecko-btn-outline gecko-btn-sm">Back to schedules</Link>
      </div>
    );
  }

  const tone = TYPE_TONE[type];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', background: 'var(--gecko-bg-canvas)' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/tariff/plans" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Back to schedules">
          <Icon name="arrowLeft" size={16} />
        </Link>
        <div className="gecko-flex-1">
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <span className="gecko-id-link">{effectiveNo || 'New quotation'}</span>
            <span className={`gecko-pill gecko-pill-${tone.tone}`}><Icon name={tone.icon} size={11} /> {tone.label}</span>
            <span className="gecko-pill gecko-pill-neutral">{created ? `DRAFT saved · v${created.versionNo}` : 'not saved'}</span>
          </div>
          <div className="gecko-cell-meta gecko-mt-1">
            Draft → submit → approve. An approved quotation is frozen; a change is a new version.
          </div>
        </div>
        {canImport && (
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={saving !== null} onClick={() => save('excel')}
            title="Create the draft header, then download / upload its Excel template">
            <Icon name="fileText" size={14} /> {saving === 'excel' ? 'Creating…' : created ? 'Open Excel import' : 'Create draft & load from Excel'}
          </button>
        )}
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={saving !== null} onClick={() => save('save')}>
          <Icon name="save" size={14} /> {saving === 'save' ? 'Saving…' : created ? 'Save draft again' : 'Save draft'}
        </button>
      </div>

      <div className="gecko-stack gecko-stack-lg" style={{ flex: 1, padding: 24, maxWidth: 'var(--gecko-container-max)', width: '100%', margin: '0 auto' }}>
        {banner && (
          <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
            <Icon name="alertCircle" size={16} /><span className="gecko-flex-1">{banner}</span>
            {created && <Link href={`/tariff/plans/${created.scheduleId}`} className="gecko-btn gecko-btn-outline gecko-btn-sm">Open draft</Link>}
          </div>
        )}
        {status === 'offline' && (
          <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
            <Icon name="alertCircle" size={16} /><span>The Gecko API is not reachable — nothing can be saved.</span>
          </div>
        )}
        {catalogErrors.length > 0 && (
          <div className="gecko-alert gecko-alert-info gecko-row" style={{ gap: 10 }}>
            <Icon name="info" size={16} />
            <span>Some master lists did not load, so those columns take typed codes (still checked on save): {catalogErrors.join(' · ')}</span>
          </div>
        )}

        {/* Header */}
        <Card title="Quotation" icon="fileText" subtitle="Who it is for and when it applies. The server checks every party exists and plays the role it is named for.">
          <div className="gecko-stack">
            <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
              {(['PUBLIC', 'CONTRACT', 'SPOT'] as ScheduleType[]).map(t => (
                <button key={t} type="button" disabled={!!created && created.scheduleType !== t}
                  className={`gecko-btn gecko-btn-sm ${type === t ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                  onClick={() => changeType(t)}>
                  <Icon name={TYPE_TONE[t].icon} size={13} /> {TYPE_TONE[t].label}
                </button>
              ))}
              <span className="gecko-cell-meta">
                {type === 'PUBLIC' && 'The depot price list — applies to anyone without a contract.'}
                {type === 'CONTRACT' && 'Prices for a named customer, agent or forwarder — wins over the public list.'}
                {type === 'SPOT' && 'A one-off price for one booking (or party).'}
              </span>
            </div>
            {headerError('scheduleType') && <div className="gecko-field-error">{headerError('scheduleType')}</div>}

            {type !== 'PUBLIC' && (
              <div className="gecko-grid-3" style={{ gap: 14 }}>
                <Labelled label="Customer">
                  <PartyPicker role="CUSTOMER" value={customer} onChange={c => setCustomer(c)} error={headerError('customerPartyCode')} disabled={!!created && created.versionNo > 1} />
                </Labelled>
                <Labelled label="Agent / shipping line (optional)">
                  <PartyPicker role="SHIPPING_LINE" value={agent} onChange={c => setAgent(c)} error={headerError('agentPartyCode')} />
                </Labelled>
                <Labelled label="Forwarder (optional)">
                  <PartyPicker role="FORWARDER" value={forwarder} onChange={c => setForwarder(c)} error={headerError('forwarderPartyCode')} />
                </Labelled>
              </div>
            )}

            <div className="gecko-grid-4" style={{ gap: 14 }}>
              <Labelled label="Quotation no." error={headerError('scheduleNo')}>
                <input className="gecko-input gecko-text-mono" value={scheduleNoTouched ? scheduleNo : scheduleNo || suggestedNo}
                  disabled={!!created} placeholder="CTR-CUSTOMER"
                  onChange={e => { setScheduleNo(e.target.value.toUpperCase()); setScheduleNoTouched(true); }} />
              </Labelled>
              <Labelled label="Name" error={headerError('name')}>
                <input className="gecko-input" value={name} maxLength={200} placeholder="e.g. ABC Logistics — 2026 rates" onChange={e => setName(e.target.value)} />
              </Labelled>
              <Labelled label="Effective from" error={headerError('effectiveFrom')}>
                <input className="gecko-input" type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
              </Labelled>
              <Labelled label="Effective to (blank = open-ended)" error={headerError('effectiveTo')}>
                <input className="gecko-input" type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} />
              </Labelled>
            </div>

            <div className="gecko-grid-4" style={{ gap: 14 }}>
              <Labelled label="Branch" error={headerError('branchId')}>
                <select className="gecko-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
                  <option value="">All branches</option>
                  {(branches ?? []).filter(b => b.isActive).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} — {b.displayName}</option>)}
                </select>
              </Labelled>
              <Labelled label="Currency" error={headerError('currencyCode')}>
                <input className="gecko-input gecko-text-mono" value={currencyCode} maxLength={3} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} />
              </Labelled>
              {type === 'SPOT' ? (
                <Labelled label="Booking ref" error={headerError('bookingRef')}>
                  <input className="gecko-input gecko-text-mono" value={bookingRef} maxLength={30} onChange={e => setBookingRef(e.target.value.toUpperCase())} />
                </Labelled>
              ) : <div />}
              <div className="gecko-stack-sm">
                <label className="gecko-row" style={{ gap: 6 }}>
                  <input type="checkbox" className="gecko-checkbox" checked={pricesIncludeTax} onChange={e => setPricesIncludeTax(e.target.checked)} />
                  <span>Prices include VAT</span>
                </label>
                <label className="gecko-row" style={{ gap: 6 }}>
                  <input type="checkbox" className="gecko-checkbox" checked={waiveDamaged} onChange={e => setWaiveDamaged(e.target.checked)} />
                  <span>Waive storage on damaged empties</span>
                </label>
              </div>
            </div>

            <Labelled label="Remarks" error={headerError('remarks')}>
              <textarea className="gecko-textarea gecko-input" rows={2} maxLength={1000} value={remarks} onChange={e => setRemarks(e.target.value)} />
            </Labelled>
            <div className="gecko-cell-meta">Module: {MODULE_CODE} (depot operations). Only TOS charge codes can be priced here.</div>
          </div>
        </Card>

        {/* Rates */}
        <Card title={`Rates (${rates.filter(r => r.chargeCode).length})`} icon="layers"
          subtitle="One row per price. Leave an axis blank for “any”; the most specific matching row wins. For a long list use Excel instead."
          right={
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setRates(rs => [...rs, newRate()])}>
              <Icon name="plus" size={14} /> Add rate
            </button>
          }>
          {catalogsLoading && <div className="gecko-cell-meta">Loading charge codes and master lists…</div>}
          {rateSetError && <div className="gecko-field-error">{rateSetError}</div>}
          <div style={{ overflowX: 'auto' }}>
            <table className="gecko-table gecko-table-compact" style={{ fontSize: 12, minWidth: 1100 }}>
              <thead>
                <tr>
                  <th />
                  <th>Charge</th><th>Bill to</th><th>Terms</th><th>Order type</th><th>Movement</th>
                  <th>Equip. type</th><th>Size</th><th>Cargo</th><th>Method</th><th>Rate / tiers</th><th />
                </tr>
              </thead>
              <tbody>
                {rates.map(r => (
                  <RateRow key={r.key} row={r} catalogs={catalogs} variants={variants[r.chargeCode]}
                    errors={rateErrs.get(r.key)}
                    onPatch={p => patchRate(r.key, p)}
                    onCharge={code => void pickCharge(r.key, code)}
                    onCopy={() => setRates(rs => { const copy = { ...r, key: newKey(), conditions: r.conditions.map(c => ({ ...c, key: newKey() })) }; const at = rs.findIndex(x => x.key === r.key); return [...rs.slice(0, at + 1), copy, ...rs.slice(at + 1)]; })}
                    onRemove={() => setRates(rs => rs.filter(x => x.key !== r.key))} />
                ))}
                {rates.length === 0 && <tr><td colSpan={12} className="gecko-cell-meta">No rates — add one, or create the draft and load them from Excel.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Free time */}
        <Card title={`Free time (${freeTime.length})`} icon="calendar"
          subtitle="Free units come off before tiers are counted. Leave a dimension blank for “any”. Storage and chassis count days, truck waiting hours."
          right={
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setFreeTime(f => [...f, newFreeTime()])}>
              <Icon name="plus" size={14} /> Add rule
            </button>
          }>
          {freeErrs.whole && <div className="gecko-field-error">{freeErrs.whole}</div>}
          {freeTime.length === 0 ? (
            <div className="gecko-cell-meta">No free-time rules — the public tariff decides.</div>
          ) : (
            <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
              <thead><tr><th>Kind</th><th>Full / empty</th><th>Direction</th><th>Cargo group</th><th>Size</th><th>Free units</th><th /></tr></thead>
              <tbody>
                {freeTime.map(f => {
                  const err = freeErrs.rows.get(f.key);
                  const patch = (p: Partial<FreeTimeDraft>) => setFreeTime(all => all.map(x => (x.key === f.key ? { ...x, ...p } : x)));
                  return (
                    <tr key={f.key}>
                      <td><select className="gecko-input" value={f.freeTimeKind} onChange={e => patch({ freeTimeKind: e.target.value as FreeTimeKind })}>
                        <option value="STORAGE">STORAGE (days)</option><option value="CHASSIS">CHASSIS (days)</option><option value="TRUCK_WAITING">TRUCK_WAITING (hours)</option>
                      </select></td>
                      <td><Pick value={f.fullEmpty} options={['FULL', 'EMPTY']} onChange={v => patch({ fullEmpty: v })} /></td>
                      <td><Pick value={f.direction} options={['IMPORT', 'EXPORT', 'LOCAL']} onChange={v => patch({ direction: v })} /></td>
                      <td><Pick value={f.cargoGroup} options={['NORMAL', 'REEFER', 'DG']} onChange={v => patch({ cargoGroup: v })} /></td>
                      <td><Pick value={f.equipmentSize} options={['20', '40', '45']} onChange={v => patch({ equipmentSize: v })} /></td>
                      <td>
                        <input className={`gecko-input ${err ? 'gecko-input-error' : ''}`} type="number" min={0} max={3650} value={f.freeUnits} onChange={e => patch({ freeUnits: e.target.value })} />
                        {err && <div className="gecko-field-error">{Object.values(err).flat().join(' ')}</div>}
                      </td>
                      <td><button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove rule" onClick={() => setFreeTime(all => all.filter(x => x.key !== f.key))}><Icon name="trash" size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Server row indexes count the rows actually SENT (blank rows are skipped); re-key them by draft row. */
function remapToDrafts<T extends { key: string }>(byIndex: Map<number, Record<string, string[]>>, sent: T[]): Map<string, Record<string, string[]>> {
  const out = new Map<string, Record<string, string[]>>();
  byIndex.forEach((errs, i) => { if (sent[i]) out.set(sent[i].key, errs); });
  return out;
}

// ── rate row ───────────────────────────────────────────────────────────────

function RateRow({ row: r, catalogs, variants, errors, onPatch, onCharge, onCopy, onRemove }: {
  row: RateDraft;
  catalogs: TariffCatalogs;
  variants: ChargeVariant[] | undefined;
  errors: Record<string, string[]> | undefined;
  onPatch: (patch: Partial<RateDraft>) => void;
  onCharge: (code: string) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const err = (f: string) => errors?.[f.toLowerCase()]?.join(' ');
  const charge = catalogs.charges.find(c => c.chargeCode === r.chargeCode);
  const tiered = r.pricingMethod !== 'FLAT';
  const billToOptions = variants && variants.length > 0 ? [...new Set(variants.map(v => v.billTo))] : catalogs.billToRoles.map(b => b.code);
  const termOptions = variants && variants.length > 0
    ? [...new Set(variants.filter(v => v.billTo === r.billTo).map(v => v.paymentTermCode))]
    : catalogs.paymentTerms.map(p => p.code);
  const rowProblem = errors?.[''];
  const hasDetailErrors = ['truckcategorycode', 'billingunitcode', 'tierbasis', 'credittermdays', 'conditions'].some(f => errors?.[f]);
  const expanded = r.open || hasDetailErrors;

  return (
    <>
      <tr style={{ background: errors ? 'var(--gecko-bg-subtle)' : undefined }}>
        <td>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="More" onClick={() => onPatch({ open: !r.open })}>
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13} />
          </button>
        </td>
        <td style={{ minWidth: 150 }}>
          <CodeSelect value={r.chargeCode} options={catalogs.charges.map(c => ({ code: c.chargeCode, label: c.descriptionEn }))}
            placeholder="charge…" required onChange={onCharge} error={err('chargeCode')} />
        </td>
        <td><CodeSelect value={r.billTo} options={billToOptions.map(c => ({ code: c, label: c }))} required onChange={v => onPatch({ billTo: v })} error={err('billTo')} /></td>
        <td><CodeSelect value={r.paymentTermCode} options={(termOptions.length ? termOptions : catalogs.paymentTerms.map(p => p.code)).map(c => ({ code: c, label: catalogs.paymentTerms.find(p => p.code === c)?.name ?? c }))} required onChange={v => onPatch({ paymentTermCode: v })} error={err('paymentTermCode')} /></td>
        <td style={{ minWidth: 130 }}><CodeSelect value={r.orderTypeCode} options={catalogs.orderTypes} onChange={v => onPatch({ orderTypeCode: v })} error={err('orderTypeCode')} /></td>
        <td style={{ minWidth: 110 }}><CodeSelect value={r.movementCode} options={catalogs.movements} onChange={v => onPatch({ movementCode: v })} error={err('movementCode')} /></td>
        <td style={{ minWidth: 100 }}>
          <CodeSelect value={r.equipmentTypeCode} options={catalogs.equipmentTypes}
            onChange={v => onPatch({ equipmentTypeCode: v, equipmentSize: v ? (catalogs.equipmentTypes.find(t => t.code === v)?.size ?? r.equipmentSize) : r.equipmentSize })}
            error={err('equipmentTypeCode')} />
        </td>
        <td style={{ minWidth: 70 }}><Pick value={r.equipmentSize} options={['20', '40', '45']} onChange={v => onPatch({ equipmentSize: v })} error={err('equipmentSize')} /></td>
        <td style={{ minWidth: 110 }}><CodeSelect value={r.cargoCategoryCode} options={catalogs.cargoCategories} onChange={v => onPatch({ cargoCategoryCode: v })} error={err('cargoCategoryCode')} /></td>
        <td>
          <select className="gecko-input" value={r.pricingMethod}
            onChange={e => {
              const m = e.target.value as PricingMethod;
              onPatch(m === 'FLAT' ? { pricingMethod: m, tierBasis: '' } : { pricingMethod: m, tierBasis: r.tierBasis || 'DAY', open: true });
            }}>
            {PRICING_METHODS.map(m => <option key={m} value={m}>{m === 'FLAT' ? 'Flat' : m.replace('TIERED_', 'Tiered ').toLowerCase()}</option>)}
          </select>
        </td>
        <td style={{ minWidth: 150 }}>
          {tiered ? (
            <>
              <input className={`gecko-input gecko-text-mono ${err('tiers') ? 'gecko-input-error' : ''}`} value={r.tiersText}
                placeholder="1-7:160; 8-14:275; 15+:390" onChange={e => onPatch({ tiersText: e.target.value })} />
              {err('tiers') && <div className="gecko-field-error">{err('tiers')}</div>}
            </>
          ) : (
            <>
              <input className={`gecko-input ${err('rate') ? 'gecko-input-error' : ''}`} type="number" min={0} step="0.01" value={r.rate}
                placeholder={charge ? charge.billingUnitCode.toLowerCase().replace('_', ' ') : '0.00'} onChange={e => onPatch({ rate: e.target.value })} />
              {err('rate') && <div className="gecko-field-error">{err('rate')}</div>}
            </>
          )}
        </td>
        <td className="gecko-row" style={{ gap: 2 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Copy row" onClick={onCopy}><Icon name="copy" size={13} /></button>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove row" onClick={onRemove}><Icon name="trash" size={13} /></button>
        </td>
      </tr>
      {rowProblem && (
        <tr><td /><td colSpan={11} className="gecko-field-error">{rowProblem.join(' ')}</td></tr>
      )}
      {expanded && (
        <tr>
          <td />
          <td colSpan={11}>
            <div className="gecko-grid-4" style={{ gap: 12 }}>
              <Labelled label="Truck category" error={err('truckCategoryCode')}>
                <CodeSelect value={r.truckCategoryCode} options={catalogs.truckCategories} onChange={v => onPatch({ truckCategoryCode: v })} />
              </Labelled>
              <Labelled label={`Billing unit${charge ? ` (charge default ${charge.billingUnitCode})` : ''}`} error={err('billingUnitCode')}>
                <Pick value={r.billingUnitCode} options={catalogs.billingUnits.map(u => u.code)} anyLabel="charge default" onChange={v => onPatch({ billingUnitCode: v })} />
              </Labelled>
              <Labelled label="Credit days" error={err('creditTermDays')}>
                <input className="gecko-input" type="number" min={0} max={365} value={r.creditTermDays} onChange={e => onPatch({ creditTermDays: e.target.value })} />
              </Labelled>
              {tiered ? (
                <Labelled label="Tier basis" error={err('tierBasis')}>
                  <select className="gecko-input" value={r.tierBasis} onChange={e => onPatch({ tierBasis: e.target.value as TierBasis })}>
                    {TIER_BASES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Labelled>
              ) : <div />}
            </div>
            <ConditionsEditor conditions={r.conditions} errors={errors} onChange={conditions => onPatch({ conditions })} />
          </td>
        </tr>
      )}
    </>
  );
}

function ConditionsEditor({ conditions, errors, onChange }: {
  conditions: ConditionDraft[];
  errors: Record<string, string[]> | undefined;
  onChange: (c: ConditionDraft[]) => void;
}) {
  const patch = (key: string, p: Partial<ConditionDraft>) => onChange(conditions.map(c => (c.key === key ? { ...c, ...p } : c)));
  return (
    <div className="gecko-stack-sm gecko-mt-1">
      <div className="gecko-row" style={{ gap: 8 }}>
        <span className="gecko-field-label gecko-flex-1">Surcharge conditions — applied in order (e.g. +300 if WEIGHT_KG &gt; 30000)</span>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => onChange([...conditions, newCondition()])}><Icon name="plus" size={12} /> Condition</button>
      </div>
      {errors?.conditions && <div className="gecko-field-error">{errors.conditions.join(' ')}</div>}
      {conditions.map(c => {
        const isFlag = FLAG_AXES.includes(c.axis);
        const isNumeric = NUMERIC_AXES.includes(c.axis);
        return (
          <div key={c.key} className="gecko-row gecko-row-wrap" style={{ gap: 6 }}>
            <select className="gecko-input" style={{ width: 160 }} value={c.axis}
              onChange={e => {
                const axis = e.target.value;
                patch(c.key, { axis, op: FLAG_AXES.includes(axis) ? 'IS' : NUMERIC_AXES.includes(axis) ? 'GT' : 'IN' });
              }}>
              {[...LIST_AXES, ...FLAG_AXES, ...NUMERIC_AXES].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {isFlag ? (
              <select className="gecko-input" style={{ width: 90 }} value={c.flag ? 'true' : 'false'} onChange={e => patch(c.key, { flag: e.target.value === 'true' })}>
                <option value="true">is yes</option><option value="false">is no</option>
              </select>
            ) : isNumeric ? (
              <>
                <select className="gecko-input" style={{ width: 80 }} value={c.op} onChange={e => patch(c.key, { op: e.target.value })}>
                  {['GT', 'GTE', 'LT', 'LTE'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className="gecko-input" style={{ width: 110 }} type="number" value={c.number} placeholder="30000" onChange={e => patch(c.key, { number: e.target.value })} />
              </>
            ) : (
              <>
                <select className="gecko-input" style={{ width: 70 }} value={c.op} onChange={e => patch(c.key, { op: e.target.value })}>
                  <option value="IN">IN</option><option value="EQ">EQ</option>
                </select>
                <input className="gecko-input gecko-text-mono" style={{ width: 160 }} value={c.values} placeholder="codes, comma separated" onChange={e => patch(c.key, { values: e.target.value })} />
              </>
            )}
            <span className="gecko-cell-meta">→</span>
            <select className="gecko-input" style={{ width: 110 }} value={c.modifierOp} onChange={e => patch(c.key, { modifierOp: e.target.value })}>
              {MODIFIER_OPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="gecko-input" style={{ width: 100 }} type="number" step="0.01" value={c.modifierValue} onChange={e => patch(c.key, { modifierValue: e.target.value })} />
            <input className="gecko-input" style={{ width: 160 }} value={c.label} maxLength={100} placeholder="label (optional)" onChange={e => patch(c.key, { label: e.target.value })} />
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove condition" onClick={() => onChange(conditions.filter(x => x.key !== c.key))}><Icon name="x" size={12} /></button>
          </div>
        );
      })}
    </div>
  );
}

// ── small inputs ───────────────────────────────────────────────────────────

/** A real list when master data loaded; a typed code (validated on save) when it did not. */
function CodeSelect({ value, options, onChange, placeholder, required, error }: {
  value: string;
  options: CodeOption[];
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  const cls = `gecko-input ${error ? 'gecko-input-error' : ''}`;
  const known = options.some(o => o.code === value);
  return (
    <>
      {options.length === 0 ? (
        <input className={`${cls} gecko-text-mono`} value={value} placeholder={placeholder ?? (required ? '' : 'any')}
          onChange={e => onChange(e.target.value.toUpperCase())} />
      ) : (
        <select className={cls} value={value} onChange={e => onChange(e.target.value)} title={options.find(o => o.code === value)?.label}>
          <option value="">{required ? (placeholder ?? 'choose…') : 'any'}</option>
          {value && !known && <option value={value}>{value} (not in list)</option>}
          {options.map(o => <option key={o.code} value={o.code}>{o.code === o.label ? o.code : `${o.code} — ${o.label}`}</option>)}
        </select>
      )}
      {error && <div className="gecko-field-error">{error}</div>}
    </>
  );
}

function Pick({ value, options, onChange, anyLabel = 'any', error }: {
  value: string; options: string[]; onChange: (v: string) => void; anyLabel?: string; error?: string;
}) {
  return (
    <>
      <select className={`gecko-input ${error ? 'gecko-input-error' : ''}`} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <div className="gecko-field-error">{error}</div>}
    </>
  );
}

function Card({ title, subtitle, icon, right, children }: {
  title: string; subtitle?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="gecko-table-card">
      <div className="gecko-row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
        {icon && <Icon name={icon} size={15} />}
        <div className="gecko-flex-1">
          <div className="gecko-section-header-title">{title}</div>
          {subtitle && <div className="gecko-section-header-subtitle">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function Labelled({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
