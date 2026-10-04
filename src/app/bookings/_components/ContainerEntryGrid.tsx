"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { useCodeList } from '@/lib/api/lookups';
import { defaultHandoverMode, handoverModeLabel, handoverModesFor } from '@/lib/api/tos';
import { useContainerEntry, type GridRow } from '@/lib/api/use-container-entry';

/**
 * Entering boxes onto a booking (GATE_API_FOR_UI.md §16b).
 *
 * There is no Save button, and that is the point. A Save button is what loses
 * eighty rows when the counter's wifi drops: the work sits in the page until
 * someone presses it, and nobody presses it until they have finished typing.
 * Here a complete row is sent on a short timer, and anything not yet
 * acknowledged is also held in IndexedDB — so a closed tab offers the rows back
 * instead of asking for eighty container numbers again.
 *
 * Eighteen fields will not fit on one line legibly; the tariff register taught
 * us that. The six that are typed for every box stay on the row, and the rest —
 * reefer, DG, stowage, volume — open underneath, because a clerk only fills
 * them for the boxes that need them.
 */

interface Line { lineNo: number; equipmentTypeCode: string; qty: number; qtyAssigned: number; qtyCompleted: number }

export function ContainerEntryGrid({ bookingId, directionCode, requirements, onSaved }: {
  bookingId: string;
  directionCode: string | null;
  requirements: Line[];
  onSaved: () => void;
}) {
  const entry = useContainerEntry(bookingId, { onSaved });
  const cargo = useCodeList('CARGO_CATEGORY');
  const modes = handoverModesFor(directionCode);
  const [openRow, setOpenRow] = useState<string | null>(null);

  // Live from the last batch answer where we have one, otherwise the booking's
  // own figures: the clerk should see the line filling up as rows are accepted.
  const tallyOf = (lineNo: number) => {
    const fresh = entry.lines.find(l => l.lineNo === lineNo);
    const req = requirements.find(r => r.lineNo === lineNo);
    if (fresh) return { assigned: fresh.assigned, qty: fresh.qty };
    return { assigned: (req?.qtyAssigned ?? 0) + (req?.qtyCompleted ?? 0), qty: req?.qty ?? 0 };
  };

  const add = () => entry.addRow({
    lineNo: requirements.find(r => tallyOf(r.lineNo).assigned < tallyOf(r.lineNo).qty)?.lineNo ?? requirements[0]?.lineNo ?? 0,
    handoverMode: defaultHandoverMode(directionCode),
  });

  return (
    <div className="gecko-stack-sm" style={{ padding: '14px 18px' }}>

      {/* Rows this browser never managed to send. Offered, not applied: the
          clerk decides, because they may have been entered on purpose elsewhere. */}
      {entry.recovered && entry.recovered.length > 0 && (
        <div className="gecko-alert gecko-alert-info gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span className="gecko-flex-1">
            {entry.recovered.length} row{entry.recovered.length === 1 ? '' : 's'} from an earlier session never reached the server.
          </span>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={entry.acceptRecovered}>Restore them</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={entry.discardRecovered}>Discard</button>
        </div>
      )}

      {entry.failure && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span className="gecko-flex-1">{entry.failure.message}</span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => void entry.flush()}>Send again</button>
        </div>
      )}

      {/* How full each line is — the question the clerk is actually answering */}
      <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
        {requirements.map(r => {
          const t = tallyOf(r.lineNo);
          const full = t.qty > 0 && t.assigned >= t.qty;
          return (
            <span key={r.lineNo} className={`gecko-pill gecko-pill-${full ? 'success' : 'neutral'}`}>
              Line {r.lineNo} · {r.equipmentTypeCode} {t.assigned}/{t.qty}
            </span>
          );
        })}
        <span className="gecko-flex-1" />
        <span className="gecko-cell-meta">
          {entry.sending ? 'Saving…'
            : entry.pending > 0 ? `${entry.pending} row${entry.pending === 1 ? '' : 's'} waiting — saved automatically`
            : 'All rows saved'}
        </span>
      </div>

      <table className="gecko-table gecko-table-compact">
        <thead>
          <tr>
            <th style={{ width: 34 }} />
            <th style={{ width: 70 }}>Line</th>
            <th style={{ width: 150 }}>Container no.</th>
            <th style={{ width: 120 }}>Line seal</th>
            <th style={{ width: 120 }}>Customer seal</th>
            <th style={{ width: 110 }}>VGM kg</th>
            <th style={{ width: 130 }}>{handoverModeLabel(directionCode)}</th>
            <th style={{ width: 34 }} />
            <th style={{ width: 34 }} />
          </tr>
        </thead>
        <tbody>
          {entry.rows.length === 0 && (
            <tr><td colSpan={9} className="gecko-cell-meta">No rows yet — add one and it saves itself as you type.</td></tr>
          )}
          {entry.rows.map(r => (
            <RowPair
              key={r.clientLineId}
              row={r}
              requirements={requirements}
              modes={modes}
              cargoValues={cargo.values}
              expanded={openRow === r.clientLineId}
              onToggle={() => setOpenRow(o => (o === r.clientLineId ? null : r.clientLineId))}
              onPatch={p => entry.patchRow(r.clientLineId, p)}
              onRemove={() => entry.removeRow(r.clientLineId)}
            />
          ))}
        </tbody>
      </table>

      <div className="gecko-row" style={{ gap: 8 }}>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={add}>
          <Icon name="plus" size={14} /> Add box
        </button>
        <span className="gecko-flex-1" />
        {/* The timer already does this; the button is for a clerk who wants to
            watch it happen before walking away from the counter. */}
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={entry.pending === 0 || entry.sending}
          onClick={() => void entry.flush()}>
          <Icon name="save" size={14} /> Save now
        </button>
      </div>
    </div>
  );
}

const STATUS: Record<GridRow['status'], { tone: string; icon: string; label: string }> = {
  draft: { tone: 'neutral', icon: 'edit', label: 'incomplete' },
  queued: { tone: 'info', icon: 'clock', label: 'waiting' },
  sending: { tone: 'info', icon: 'refreshCcw', label: 'saving' },
  saved: { tone: 'success', icon: 'check', label: 'saved' },
  error: { tone: 'warning', icon: 'alertCircle', label: 'rejected' },
};

function RowPair({ row: r, requirements, modes, cargoValues, expanded, onToggle, onPatch, onRemove }: {
  row: GridRow;
  requirements: Line[];
  modes: { value: string; label: string }[];
  cargoValues: { code: string; descriptionEn: string }[];
  expanded: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<GridRow>) => void;
  onRemove: () => void;
}) {
  const err = (f: string) => r.errors?.[f]?.join(' ');
  const s = STATUS[r.status];
  // A rejected row shows its errors without being asked; they may be on a field
  // that lives in the second half of the row.
  const open = expanded || (r.status === 'error' && Object.keys(r.errors ?? {}).length > 0);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  return (
    <>
      <tr style={{ background: r.status === 'error' ? 'var(--gecko-bg-subtle)' : undefined }}>
        <td>
          <span className={`gecko-pill gecko-pill-${s.tone}`} title={s.label}>
            <Icon name={s.icon} size={11} />
          </span>
        </td>
        <td>
          <select className={`gecko-input gecko-input-sm ${err('lineNo') ? 'gecko-input-error' : ''}`}
            value={r.lineNo || ''} aria-label="Requirement line"
            onChange={e => onPatch({ lineNo: Number(e.target.value) })}>
            <option value="">—</option>
            {requirements.map(q => <option key={q.lineNo} value={q.lineNo}>{q.lineNo} · {q.equipmentTypeCode}</option>)}
          </select>
        </td>
        <td>
          <input className={`gecko-input gecko-input-sm gecko-text-mono ${err('containerNo') ? 'gecko-input-error' : ''}`}
            value={r.containerNo} maxLength={11} placeholder="ABCU1234567" aria-label="Container number"
            disabled={r.status === 'saved'}
            onChange={e => onPatch({ containerNo: e.target.value.toUpperCase() })} />
        </td>
        <td>
          <input className={`gecko-input gecko-input-sm ${err('declaredSealNo') ? 'gecko-input-error' : ''}`}
            value={r.declaredSealNo ?? ''} maxLength={20} aria-label="Line seal"
            onChange={e => onPatch({ declaredSealNo: e.target.value || null })} />
        </td>
        <td>
          <input className={`gecko-input gecko-input-sm ${err('customerSealNo') ? 'gecko-input-error' : ''}`}
            value={r.customerSealNo ?? ''} maxLength={20} aria-label="Customer seal"
            onChange={e => onPatch({ customerSealNo: e.target.value || null })} />
        </td>
        <td>
          <input className={`gecko-input gecko-input-sm ${err('declaredVgmKg') ? 'gecko-input-error' : ''}`}
            type="number" min={0} value={r.declaredVgmKg ?? ''} aria-label="VGM kg"
            onChange={e => onPatch({ declaredVgmKg: num(e.target.value) })} />
        </td>
        <td>
          <select className={`gecko-input gecko-input-sm ${err('handoverMode') ? 'gecko-input-error' : ''}`}
            value={r.handoverMode ?? ''} aria-label="Handover mode"
            onChange={e => onPatch({ handoverMode: e.target.value || null })}>
            <option value="">—</option>
            {modes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </td>
        <td>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="More fields" onClick={onToggle}>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
          </button>
        </td>
        <td>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove row" onClick={onRemove}>
            <Icon name="trash" size={13} />
          </button>
        </td>
      </tr>

      {r.errors && Object.keys(r.errors).length > 0 && (
        <tr>
          <td />
          <td colSpan={8}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {Object.entries(r.errors).map(([field, msgs]) => (
                <li key={field} style={{ color: 'var(--gecko-error-600)' }}>
                  <strong className="gecko-text-mono">{field}: </strong>{msgs.join(' ')}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}

      {open && (
        <tr>
          <td />
          <td colSpan={8}>
            <div className="gecko-grid-4" style={{ gap: 10 }}>
              <Labelled label="Required date" error={err('requiredDate')}>
                <DateField size="sm" value={r.requiredDate ?? ''} aria-label="Required date"
                  onChange={v => onPatch({ requiredDate: v || null })} />
              </Labelled>
              <Labelled label="Volume m³" error={err('declaredVolumeCbm')}>
                <input className="gecko-input gecko-input-sm" type="number" min={0} step="0.01"
                  value={r.declaredVolumeCbm ?? ''} onChange={e => onPatch({ declaredVolumeCbm: num(e.target.value) })} />
              </Labelled>
              <Labelled label="Cargo category" error={err('cargoCategoryCode')}>
                <select className="gecko-input gecko-input-sm" value={r.cargoCategoryCode ?? ''}
                  onChange={e => onPatch({ cargoCategoryCode: e.target.value || null })}>
                  <option value="">from the line</option>
                  {cargoValues.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </Labelled>
              <Labelled label="Stowage" error={err('stowageCode')}>
                <div className="gecko-row" style={{ gap: 6 }}>
                  <input className="gecko-input gecko-input-sm" value={r.stowageCode ?? ''} placeholder="DECK" aria-label="Stowage code"
                    onChange={e => onPatch({ stowageCode: e.target.value.toUpperCase() || null })} />
                  <input className="gecko-input gecko-input-sm" value={r.stowageNo ?? ''} placeholder="12" aria-label="Stowage number"
                    onChange={e => onPatch({ stowageNo: e.target.value || null })} />
                </div>
              </Labelled>

              <Labelled label="IMDG class" error={err('imdgClass')}>
                <input className="gecko-input gecko-input-sm" value={r.imdgClass ?? ''} maxLength={10}
                  onChange={e => onPatch({ imdgClass: e.target.value.toUpperCase() || null })} />
              </Labelled>
              {/* The API refuses a UN number without a class, so the pairing is said here */}
              <Labelled label="UN number" error={err('unNumber')} hint="Four digits; needs an IMDG class.">
                <input className="gecko-input gecko-input-sm gecko-text-mono" value={r.unNumber ?? ''} maxLength={4}
                  onChange={e => onPatch({ unNumber: e.target.value || null })} />
              </Labelled>
              <Labelled label="Reefer °C" error={err('reeferSetTempC')} hint="−70 to 40, reefer lines only.">
                <input className="gecko-input gecko-input-sm" type="number" min={-70} max={40} step="0.1"
                  value={r.reeferSetTempC ?? ''} onChange={e => onPatch({ reeferSetTempC: num(e.target.value) })} />
              </Labelled>
              <Labelled label="Vent % / Humidity %" error={err('reeferVentPct') ?? err('reeferHumidityPct')}>
                <div className="gecko-row" style={{ gap: 6 }}>
                  <input className="gecko-input gecko-input-sm" type="number" min={0} max={100} aria-label="Vent percent"
                    value={r.reeferVentPct ?? ''} onChange={e => onPatch({ reeferVentPct: num(e.target.value) })} />
                  <input className="gecko-input gecko-input-sm" type="number" min={0} max={100} aria-label="Humidity percent"
                    value={r.reeferHumidityPct ?? ''} onChange={e => onPatch({ reeferHumidityPct: num(e.target.value) })} />
                </div>
              </Labelled>
            </div>

            <div className="gecko-row gecko-mt-2" style={{ gap: 12 }}>
              <label className="gecko-row" style={{ gap: 6 }}>
                <input type="checkbox" className="gecko-checkbox" checked={r.isPreCool ?? false}
                  onChange={e => onPatch({ isPreCool: e.target.checked })} />
                <span>Pre-cooled</span>
              </label>
              <input className="gecko-input gecko-input-sm gecko-flex-1" value={r.remarks ?? ''} maxLength={300}
                placeholder="Remarks" aria-label="Remarks"
                onChange={e => onPatch({ remarks: e.target.value || null })} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Labelled({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
      {hint && !error && <div className="gecko-cell-meta">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
