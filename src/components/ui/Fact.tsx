"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';

/**
 * One cell of a detail page's header fact strip.
 *
 * Not a KPI. A KPI is a number you are meant to react to and .gecko-kpi-tile
 * sets it large; a fact is what you glance at to confirm you opened the right
 * record. It reads at the same size as the register you arrived from, so the
 * eye does not have to re-focus between the list and the detail.
 */
export function Fact({ icon, tone = 'neutral', value, label }: {
  icon: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  value: string;
  label: string;
}) {
  return (
    <div className="gecko-fact">
      <div className={`gecko-fact-icon gecko-fact-icon-${tone}`}><Icon name={icon} size={14} /></div>
      <div className="gecko-fact-body">
        {/* title: the value ellipses when the grid cell is narrow */}
        <div className="gecko-fact-value" title={value}>{value}</div>
        <div className="gecko-fact-label">{label}</div>
      </div>
    </div>
  );
}
