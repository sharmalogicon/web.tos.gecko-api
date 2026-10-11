"use client";
import React from 'react';
import { Icon } from '../ui/Icon';
import type { ReportDef } from '@/lib/reports-catalog';

/**
 * Single report card — icon · title · description · the affordance.
 *
 * A card says on its face whether the report can actually be run. KORAKIT is
 * leaving the desktop, so every report they had is listed; the ones with no
 * query behind them yet are marked rather than hidden, because a clerk looking
 * for "Daily Unstuffing" needs to know it is coming, not wonder where it went.
 */
export function ReportCard({ report, onRun }: { report: ReportDef; onRun: () => void }) {
  // A report the API RENDERS is runnable too — `document` arrived after this
  // card was written, so Empty in Yard and the whole accounting set were still
  // saying "Not available yet" while their endpoints worked.
  const live = !!report.live || !!report.document;
  return (
    <button onClick={onRun} type="button"
      className={`gecko-report-card${live ? '' : ' gecko-report-card-soon'}`}>
      <div className="gecko-report-card-icon">
        <Icon name={report.icon} size={16} />
      </div>
      <div className="gecko-report-card-title">{report.title}</div>
      <div className="gecko-report-card-desc">{report.description}</div>
      <div className="gecko-report-card-run">
        {live
          ? <>Run report <Icon name="arrowRight" size={11} /></>
          : <span className="gecko-report-card-soon-tag">Not available yet</span>}
      </div>
    </button>
  );
}
