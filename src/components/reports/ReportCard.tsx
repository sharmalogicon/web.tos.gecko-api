"use client";
import React from 'react';
import { Icon } from '../ui/Icon';
import type { ReportDef } from '@/lib/reports-catalog';

/**
 * Single report card — icon · title · description · "Run Report →" affordance.
 * Visual pattern lives in .gecko-report-card classes (design system §5.37).
 */
export function ReportCard({ report, onRun }: { report: ReportDef; onRun: () => void }) {
  return (
    <button onClick={onRun} className="gecko-report-card" type="button">
      <div className="gecko-report-card-icon">
        <Icon name={report.icon} size={16} />
      </div>
      <div className="gecko-report-card-title">{report.title}</div>
      <div className="gecko-report-card-desc">{report.description}</div>
      <div className="gecko-report-card-run">
        Run Report <Icon name="arrowRight" size={11} />
      </div>
    </button>
  );
}
