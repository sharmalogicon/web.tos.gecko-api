"use client";
import React, { use } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/api/use-api';
import { freeTimeDraftsOf, rateDraftsOf } from '../../../_components/tariff-drafts';
import { QuotationEditor } from '../../../_components/QuotationEditor';
import type { FreeTimeSet, RateSet, Schedule } from '@/lib/api/revenue';

/**
 * EDIT A QUOTATION — the same screen that creates one.
 *
 * Until now a draft could only be changed by re-importing a spreadsheet: the
 * rate dialog and the free-time matrix lived on /tariff/plans/new, which always
 * started blank. So "New version" would faithfully copy ten priced rows into a
 * draft and then leave nobody able to change one of them.
 *
 * Nothing new is learnt here — it is the create screen with the quotation
 * already in it, and it saves through the same three calls.
 *
 * AN APPROVED VERSION IS NEVER EDITED. A price that has been approved is one
 * somebody has quoted to a customer, so a change is a new version: that is what
 * the detail page's "New version" is for, and this screen refuses anything that
 * is not editable rather than letting a clerk type into a frozen price.
 *
 * The editor is mounted only once all three reads are in. Its state is seeded
 * from props at first render, so a component that mounted empty and filled in
 * afterwards would keep the empty values — and saving would wipe the rates.
 */
export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const schedule = useApi<Schedule>(`/api/revenue/tariffs/${id}`);
  const rates = useApi<RateSet>(`/api/revenue/tariffs/${id}/rates`);
  const freeTime = useApi<FreeTimeSet>(`/api/revenue/tariffs/${id}/free-time`);

  const loading = schedule.loading || rates.loading || freeTime.loading;
  const failure = schedule.error ?? rates.error ?? freeTime.error;

  if (loading && !schedule.data) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">Loading the quotation…</div>;
  }

  if (failure || !schedule.data) {
    return (
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-alert gecko-alert-error">
          {failure?.status === 404 ? 'No such tariff version.' : failure?.message ?? 'This quotation could not be loaded.'}
        </div>
        <Link href="/tariff/plans" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-self-start">
          <Icon name="arrowLeft" size={13} /> Back to tariff schedules
        </Link>
      </div>
    );
  }

  const s = schedule.data;

  if (!s.isEditable) {
    return (
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-alert gecko-alert-warning">
          {s.scheduleNo} v{s.versionNo} is {s.status.toLowerCase()} — an approved price is never edited.
          Start a new version from the quotation and change that.
        </div>
        <Link href={`/tariff/plans/${id}`} className="gecko-btn gecko-btn-primary gecko-btn-sm gecko-self-start">
          <Icon name="arrowRight" size={13} /> Open {s.scheduleNo}
        </Link>
      </div>
    );
  }

  return (
    <QuotationEditor
      initial={{
        schedule: s,
        // EVERY saved row, not a page of them: the rates PUT replaces the whole
        // set, so a row that never reached the editor is a row that is deleted
        // the next time it is saved.
        rates: rateDraftsOf(rates.data?.rates ?? []),
        freeTime: freeTimeDraftsOf(freeTime.data?.rules ?? []),
      }} />
  );
}
