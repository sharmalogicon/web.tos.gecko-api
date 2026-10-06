"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DateField } from '@/components/ui/DateField';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { Fact } from '@/components/ui/Fact';
import { ExcelImportPanel } from './ExcelImportPanel';
import { FreeTimeMatrix } from './FreeTimeMatrix';
import { PartyPicker } from './PartyPicker';
import { RateDialog } from './RateDialog';
import { Labelled } from './TariffFields';
import {
  copyRate, newRate, scopeOf, toRateItem,
  type ConditionDraft, type FreeTimeDraft, type RateDraft,
} from './tariff-drafts';
import {
  FLAG_AXES, NUMERIC_AXES, SCOPE_RANK_LABEL, TYPE_TONE, formatDate, parseTiers, rowErrors,
  type ConditionItem, type FreeTimeItem, type FreeTimeSet,
  type RateItem, type RateSet, type SaveScheduleRequest, type Schedule, type ScheduleType,
} from '@/lib/api/revenue';
import { useTariffCatalogs } from '@/lib/api/tariff-catalogs';

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

const today = () => new Date().toISOString().slice(0, 10);
const blank = (v: string) => (v.trim() === '' ? null : v.trim());
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));

/** Local problems the server would also refuse, caught before a round trip. */
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

/**
 * What an existing quotation looks like when this screen opens it. Absent for a
 * new one, which is the only difference between creating and editing.
 */
export interface QuotationInitial {
  schedule: Schedule;
  rates: RateDraft[];
  freeTime: FreeTimeDraft[];
}

export function QuotationEditor({ initial }: { initial?: QuotationInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const { can, status } = useSession();
  const { catalogs, errors: catalogErrors, loading: catalogsLoading } = useTariffCatalogs(MODULE_CODE);
  const { data: branches } = useApiList<Branch>('/api/branches?pageSize=100');

  // header
  const [type, setType] = useState<ScheduleType>(initial?.schedule.scheduleType ?? 'CONTRACT');
  const [scheduleNo, setScheduleNo] = useState(initial?.schedule.scheduleNo ?? '');
  const [scheduleNoTouched, setScheduleNoTouched] = useState(!!initial);
  const [name, setName] = useState(initial?.schedule.name ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.schedule.effectiveFrom ?? today());
  const [effectiveTo, setEffectiveTo] = useState(initial?.schedule.effectiveUntil ?? '');
  const [branchId, setBranchId] = useState(initial?.schedule.branchId ?? '');
  const [customer, setCustomer] = useState<string | null>(initial?.schedule.customerPartyCode ?? null);
  const [agent, setAgent] = useState<string | null>(initial?.schedule.agentPartyCode ?? null);
  const [forwarder, setForwarder] = useState<string | null>(initial?.schedule.forwarderPartyCode ?? null);
  const [bookingRef, setBookingRef] = useState('');
  const [currencyCode, setCurrencyCode] = useState(initial?.schedule.currencyCode ?? 'THB');
  /**
   * Hidden on 2026-10-03, not removed. The depot quotes every charge EXCLUDING
   * VAT and always charges storage on damaged empties, so both controls offered
   * a choice nobody makes — and a tariff saved with the wrong one is a billing
   * error nobody would notice until the invoice.
   *
   * They are still SENT, so the API contract is untouched and bringing the
   * checkboxes back is a change to this file alone.
   */
  const pricesIncludeTax = false;
  const waiveDamaged = false;
  const [remarks, setRemarks] = useState(initial?.schedule.remarks ?? '');

  // body
  const [rates, setRates] = useState<RateDraft[]>(initial?.rates ?? []);
  // The rate being edited. A fresh newRate() here is an ADD; an existing row
  // is an EDIT. The dialog works on its own copy either way, so Cancel is free.
  const [editing, setEditing] = useState<RateDraft | null>(null);
  const addRate = () => setEditing(newRate());
  const descriptionOf = (code: string) => catalogs.charges.find(c => c.chargeCode === code)?.descriptionEn ?? '';
  const [freeTime, setFreeTime] = useState<FreeTimeDraft[]>(initial?.freeTime ?? []);

  // save state
  // Seeded when editing: `saveHeader` then PUTs instead of POSTing, which is
  // what makes this the same screen for both jobs.
  const [created, setCreated] = useState<Schedule | null>(initial?.schedule ?? null);
  const [rowVersion, setRowVersion] = useState<string | null>(initial?.schedule.rowVersion ?? null);
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
  const pricedRows = rates.filter(r => r.chargeCode).length;

  function changeType(next: ScheduleType) {
    setType(next);
    if (next === 'PUBLIC') { setCustomer(null); setAgent(null); setForwarder(null); setBookingRef(''); }
    if (next === 'CONTRACT') setBookingRef('');
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
      // Create-then-enrich, without leaving the screen. The workbook is parsed
      // against a real scheduleId, which the import endpoint requires, but the
      // clerk stays on the quotation they were filling in.
      toast({ variant: 'success', title: 'Draft created', message: `${header.schedule.scheduleNo} — now upload the filled template below.` });
      setSaving(null);
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
          {/* Same header shape as /tariff/plans/[id]: identifier + pills on the
              first line, the name as the h1 on the second. A clerk who saves
              this draft lands on that page and should not notice a change. */}
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <span className="gecko-id-link">{effectiveNo || 'New quotation'}</span>
            <span className={`gecko-pill gecko-pill-${tone.tone}`}><Icon name={tone.icon} size={11} /> {tone.label}</span>
            <span className="gecko-pill gecko-pill-neutral">{created ? `DRAFT saved · v${created.versionNo}` : 'not saved'}</span>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>
              draft → submit → approve; an approved quotation is frozen
            </span>
          </div>
          <div className="gecko-row gecko-row-baseline gecko-row-wrap gecko-mt-1" style={{ gap: 12 }}>
            <h1 className="gecko-page-title">{name.trim() || 'New quotation'}</h1>
          </div>
        </div>
        {canImport && (
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={saving !== null || created !== null} onClick={() => save('excel')}
            title="Save the draft header so a filled workbook can be checked against it">
            <Icon name="fileText" size={14} /> {saving === 'excel' ? 'Creating…' : created ? 'Draft saved' : 'Save draft & load from Excel'}
          </button>
        )}
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={saving !== null} onClick={() => save('save')}>
          <Icon name="save" size={14} /> {saving === 'save' ? 'Saving…' : created ? 'Save draft again' : 'Save draft'}
        </button>
      </div>

      {/* Validity strip — the same four facts the view/edit page shows, read
          off the form as it is filled in rather than off a saved row. */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '16px 24px' }}>
        <div className="gecko-fact-strip" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
          <Fact icon="calendar" tone="primary" value={formatDate(effectiveFrom)} label="Effective from (branch-local)" />
          <Fact icon="clock" tone="warning" value={effectiveTo ? formatDate(effectiveTo) : 'Open-ended'} label="Effective until" />
          <Fact icon="dollarSign" tone="info" value={String(pricedRows)}
            label={`Priced rows · ${freeTime.length} free-time rule${freeTime.length === 1 ? '' : 's'}`} />
          <Fact icon="layers" tone="success"
            value={created ? String(created.scopeRank) : '—'}
            label={created ? (SCOPE_RANK_LABEL[created.scopeRank] ?? 'Precedence rank') : 'Precedence — set when the draft is saved'} />
        </div>
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
        {/* Quotation on the left, storage free days beside it — the shape of
            Vector's Customer Rate Profile, in our cards. */}
        <div className="gecko-tariff-header-split">
        <Card title="Quotation" icon="fileText" subtitle="Who it is for and when it applies. The server checks every party exists and plays the role it is named for.">
          <div className="gecko-stack">
            {/* The kind of agreement decides which fields below even exist, so
                it stays on its own line above them. */}
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

            <div className="gecko-quotation-split">
              {/* LEFT — who the quotation is for */}
              <div className="gecko-stack">
                <div className="gecko-quotation-ids">
                  <Labelled label="Quotation no." error={headerError('scheduleNo')}>
                    <input className="gecko-input gecko-text-mono" value={scheduleNoTouched ? scheduleNo : scheduleNo || suggestedNo}
                      disabled={!!created} placeholder="CTR-CUSTOMER"
                      onChange={e => { setScheduleNo(e.target.value.toUpperCase()); setScheduleNoTouched(true); }} />
                  </Labelled>
                  <Labelled label="Name" error={headerError('name')}>
                    <input className="gecko-input" value={name} maxLength={200} placeholder="e.g. ABC Logistics — 2026 rates"
                      onChange={e => setName(e.target.value)} />
                  </Labelled>
                </div>

                {type !== 'PUBLIC' && (
                  <>
                    <Labelled label="Agent / shipping line (optional)">
                      <PartyPicker role="SHIPPING_LINE" value={agent} onChange={c => setAgent(c)} error={headerError('agentPartyCode')} />
                    </Labelled>
                    <Labelled label="Customer">
                      <PartyPicker role="CUSTOMER" value={customer} onChange={c => setCustomer(c)} error={headerError('customerPartyCode')}
                        disabled={!!created && created.versionNo > 1} />
                    </Labelled>
                    <Labelled label="Forwarder (optional)">
                      <PartyPicker role="FORWARDER" value={forwarder} onChange={c => setForwarder(c)} error={headerError('forwarderPartyCode')} />
                    </Labelled>
                  </>
                )}

                {type === 'SPOT' && (
                  <Labelled label="Booking ref" error={headerError('bookingRef')}>
                    <input className="gecko-input gecko-text-mono" value={bookingRef} maxLength={30}
                      onChange={e => setBookingRef(e.target.value.toUpperCase())} />
                  </Labelled>
                )}

                <Labelled label="Remarks" error={headerError('remarks')}>
                  <textarea className="gecko-textarea gecko-input" rows={4} maxLength={1000} value={remarks}
                    onChange={e => setRemarks(e.target.value)} />
                </Labelled>
              </div>

              {/* RIGHT — when and where it applies */}
              <div className="gecko-stack">
                {/* The app's own picker, not the browser's: a native date input
                    renders differently in every browser and spells the date the
                    way the OS locale does, which is how "03 Oct 2026" and
                    "10/3/2026" both got on screen. This one reads dd-MM-yyyy
                    everywhere and carries Clear / Today. */}
                <Labelled label="Effective from" error={headerError('effectiveFrom')}>
                  <DateField value={effectiveFrom} onChange={setEffectiveFrom} placeholder="dd-mm-yyyy" />
                </Labelled>
                <Labelled label="Effective to" error={headerError('effectiveTo')} hint="Blank = open-ended.">
                  <DateField value={effectiveTo} onChange={setEffectiveTo} placeholder="open-ended" />
                </Labelled>
                <Labelled label="Branch" error={headerError('branchId')}>
                  <select className="gecko-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
                    <option value="">All branches</option>
                    {(branches ?? []).filter(b => b.isActive).map(b => (
                      <option key={b.branchId} value={b.branchId}>{b.branchCode} — {b.displayName}</option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label="Currency" error={headerError('currencyCode')}>
                  <input className="gecko-input gecko-text-mono" value={currencyCode} maxLength={3}
                    onChange={e => setCurrencyCode(e.target.value.toUpperCase())} />
                </Labelled>
              </div>
            </div>

            <div className="gecko-cell-meta">Module: {MODULE_CODE} (depot operations). Only TOS charge codes can be priced here.</div>
          </div>
        </Card>

        <Card title="Storage free days" icon="calendar"
          subtitle="Vector's grid: days free before storage starts to price.">
          <FreeTimeMatrix rules={freeTime} onChange={setFreeTime} error={freeErrs.whole} />
        </Card>
        </div>

        {/* Rates */}
        {/* Where the rates come from, directly above the rates themselves.
            The panel needs a real scheduleId because that is what the import
            endpoint parses against, so before the draft exists this is a
            prompt to create it — one click, no page change. */}
        {canImport && (created
          ? <ExcelImportPanel scheduleId={created.scheduleId} scheduleNo={created.scheduleNo} versionNo={created.versionNo}
              editable onApplied={() => router.push(`/tariff/plans/${created.scheduleId}`)} />
          : (
            <div className="gecko-table-card">
              <div className="gecko-row" style={{ padding: '14px 18px', gap: 10 }}>
                <Icon name="fileText" size={15} />
                <div className="gecko-flex-1">
                  <div className="gecko-section-header-title">Load rates from Excel</div>
                  <div className="gecko-section-header-subtitle">
                    Filled in the template already? Save this quotation&apos;s header first — the workbook is checked against
                    the draft it belongs to — then upload it here and every rate is read in for you.
                  </div>
                </div>
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={saving !== null} onClick={() => save('excel')}>
                  <Icon name="upload" size={14} /> {saving === 'excel' ? 'Creating…' : 'Save draft & upload workbook'}
                </button>
              </div>
            </div>
          ))}

        <Card title={`Rates (${pricedRows})`} icon="layers"
          subtitle="What this tariff prices. Open a row to change it; for a long list load the workbook above instead."
          right={
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={addRate}>
              <Icon name="plus" size={14} /> Add rate
            </button>
          }>
          {catalogsLoading && <div className="gecko-cell-meta">Loading charge codes and master lists…</div>}
          {rateSetError && <div className="gecko-field-error">{rateSetError}</div>}
          {/* The register READS. One rate is edited in a dialog, where the
              eleven axes have room to be grouped and labelled. */}
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                <th>Charge</th><th>Applies to</th><th>Bill to</th><th>Method</th>
                <th style={{ textAlign: 'right' }}>Rate</th><th />
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 && (
                <tr><td colSpan={6} className="gecko-cell-meta">No rates yet — add one, or load them from the workbook above.</td></tr>
              )}
              {rates.map(r => {
                const bad = rateErrs.get(r.key);
                return (
                  <tr key={r.key} className="gecko-row-clickable" style={{ background: bad ? 'var(--gecko-bg-subtle)' : undefined }}
                    onClick={() => setEditing(r)}>
                    <td>
                      {r.chargeCode
                        ? <>
                            <div className="gecko-mono-strong">{r.chargeCode}</div>
                            {/* The code is the identifier; the description is what
                                makes the row readable without opening it. */}
                            <div className="gecko-cell-meta">{descriptionOf(r.chargeCode)}</div>
                          </>
                        : <span className="gecko-cell-meta">not set</span>}
                      {bad && <div className="gecko-field-error">{Object.values(bad).flat().join(' ')}</div>}
                    </td>
                    <td>{scopeOf(r)}</td>
                    <td className="gecko-text-mono">{r.billTo}{r.paymentTermCode ? ` · ${r.paymentTermCode}` : ''}</td>
                    <td>{r.pricingMethod === 'FLAT' ? 'Flat' : r.pricingMethod.replace('TIERED_', 'Tiered ').toLowerCase()}</td>
                    <td className="gecko-text-mono" style={{ textAlign: 'right' }}>
                      {r.pricingMethod === 'FLAT' ? (r.rate || '—') : (r.tiersText || '—')}
                    </td>
                    <td className="gecko-row" style={{ gap: 2 }} onClick={e => e.stopPropagation()}>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Edit rate"
                        onClick={() => setEditing(r)}><Icon name="edit" size={13} /></button>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Copy rate"
                        onClick={() => setRates(rs => { const at = rs.findIndex(x => x.key === r.key); const c = copyRate(r); return [...rs.slice(0, at + 1), c, ...rs.slice(at + 1)]; })}>
                        <Icon name="copy" size={13} /></button>
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove rate"
                        onClick={() => setRates(rs => rs.filter(x => x.key !== r.key))}><Icon name="trash" size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <RateDialog
          key={editing?.key ?? 'none'}
          open={editing !== null}
          row={editing}
          catalogs={catalogs}
          errors={editing ? rateErrs.get(editing.key) : undefined}
          currency={currencyCode}
          onClose={() => setEditing(null)}
          onSave={saved => {
            setRates(rs => (rs.some(x => x.key === saved.key) ? rs.map(x => (x.key === saved.key ? saved : x)) : [...rs, saved]));
            setEditing(null);
          }}
        />


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

