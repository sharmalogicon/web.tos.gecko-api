"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { useToast } from '@/components/ui/Toast';
import { ExportButton } from '@/components/ui/ExportButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lifecycle  = 'ACTIVE' | 'DEPRECATED' | 'RETIRED' | 'DRAFT';
type EntryType  = 'SYSTEM' | 'USER' | 'IMPORTED';
type Compliance = 'SMDG' | 'ISO' | 'IICL' | 'EDIFACT' | null;

interface LookupEntry {
  id: number;
  code: string;
  description: string;
  shortLabel: string;
  smdgCode: string;
  edifactCode: string;
  isoCode: string;
  customsCode: string;
  sortOrder: number;
  facilityScope: string;
  entryType: EntryType;
  lifecycle: Lifecycle;
  effectiveFrom: string;
  effectiveTo: string;
  usageCount: number;
  modifiedBy: string;
  modifiedOn: string;
}

interface CategoryMeta {
  key: string;
  label: string;
  description: string;
  compliance: Compliance;
  entryCount: number;
  activeCount: number;
  lastMod: string;
}

interface LookupGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  categories: CategoryMeta[];
}

// ─── Sidebar group / category metadata ───────────────────────────────────────

const LOOKUP_GROUPS: LookupGroup[] = [
  {
    id: 'container', label: 'Container & Equipment', icon: 'box',
    color: 'var(--gecko-primary-600)', bg: 'var(--gecko-primary-50)',
    categories: [
      { key: 'containerStatus',    label: 'Container Status',    description: 'Operational state of a container unit',       compliance: 'SMDG',    entryCount:  8, activeCount:  7, lastMod: '2024-12-31' },
      { key: 'containerCondition', label: 'Container Condition', description: 'Physical condition grade at acceptance',       compliance: 'IICL',    entryCount:  6, activeCount:  6, lastMod: '2024-01-01' },
      { key: 'containerGrade',     label: 'Container Grade',     description: 'Internal grading A/B/C for asset valuation',  compliance: null,      entryCount:  4, activeCount:  4, lastMod: '2023-03-15' },
      { key: 'equipmentType',      label: 'Equipment Type',      description: 'Yard handling equipment classification',      compliance: 'SMDG',    entryCount: 12, activeCount: 11, lastMod: '2025-02-08' },
    ]
  },
  {
    id: 'cargo', label: 'Cargo & Shipment', icon: 'layers',
    color: 'var(--gecko-info-600)', bg: 'var(--gecko-info-50)',
    categories: [
      { key: 'cargoType',      label: 'Cargo Type',      description: 'Cargo nature for customs and EIR',        compliance: 'EDIFACT', entryCount: 14, activeCount: 14, lastMod: '2025-01-10' },
      { key: 'cargoCategory',  label: 'Cargo Category',  description: 'Broad classification for volume reporting', compliance: null,      entryCount:  8, activeCount:  8, lastMod: '2024-11-22' },
      { key: 'transportMode',  label: 'Transport Mode',  description: 'EDIFACT transport mode codes (Annex II)', compliance: 'EDIFACT', entryCount: 10, activeCount:  9, lastMod: '2024-06-01' },
      { key: 'shipmentType',   label: 'Shipment Type',   description: 'FCL / LCL / BULK / RORO',                compliance: null,      entryCount:  6, activeCount:  6, lastMod: '2024-04-05' },
    ]
  },
  {
    id: 'billing', label: 'Charges & Billing', icon: 'invoice',
    color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)',
    categories: [
      { key: 'chargeTerm',   label: 'Charge Term',      description: 'Prepaid / Collect / Either on BL',         compliance: 'EDIFACT', entryCount:  3, activeCount: 3, lastMod: '2020-01-01' },
      { key: 'paymentTerm',  label: 'Payment Term',     description: 'Invoice settlement terms',                  compliance: null,      entryCount:  6, activeCount: 5, lastMod: '2026-03-12' },
      { key: 'uom',          label: 'Unit of Measure',  description: 'ISO billing units for all charge codes',    compliance: 'ISO',     entryCount:  8, activeCount: 8, lastMod: '2023-01-01' },
      { key: 'currency',     label: 'Currency',         description: 'ISO 4217 transaction currency codes',       compliance: 'ISO',     entryCount: 12, activeCount:12, lastMod: '2024-04-01' },
    ]
  },
  {
    id: 'operations', label: 'Port & Operations', icon: 'anchor',
    color: 'var(--gecko-accent-600)', bg: 'var(--gecko-accent-50)',
    categories: [
      { key: 'movementIndicator', label: 'Movement Indicator', description: 'SMDG EDI event codes for container moves', compliance: 'SMDG', entryCount:  7, activeCount:  7, lastMod: '2020-01-01' },
      { key: 'orderType',         label: 'Order Type',         description: 'Terminal order / job type',                compliance: null,   entryCount:  8, activeCount:  7, lastMod: '2025-08-14' },
      { key: 'serviceType',       label: 'Service Type',       description: 'Value-added service classification',      compliance: null,   entryCount: 11, activeCount: 10, lastMod: '2024-12-01' },
    ]
  },
  {
    id: 'damage', label: 'Damage & Repair', icon: 'tool',
    color: 'var(--gecko-warning-600)', bg: 'var(--gecko-warning-50)',
    categories: [
      { key: 'damageCode',  label: 'Damage Code',  description: 'IICL container damage type catalog',     compliance: 'IICL', entryCount: 8, activeCount: 8, lastMod: '2024-01-01' },
      { key: 'repairGroup', label: 'Repair Group', description: 'M&R component group classification',     compliance: 'IICL', entryCount: 6, activeCount: 6, lastMod: '2024-01-01' },
      { key: 'repairMode',  label: 'Repair Mode',  description: 'Repair method / approach codes',         compliance: null,   entryCount: 5, activeCount: 4, lastMod: '2023-09-01' },
    ]
  },
  {
    id: 'compliance', label: 'Compliance & Trade', icon: 'shieldCheck',
    color: 'var(--gecko-danger-600)', bg: 'var(--gecko-danger-50)',
    categories: [
      { key: 'tradeMode',     label: 'Trade Mode',       description: 'Import / Export / Transshipment / Cabotage', compliance: 'EDIFACT', entryCount:  5, activeCount: 5, lastMod: '2020-01-01' },
      { key: 'imoClass',      label: 'IMO Hazard Class', description: 'IMDG DG classification (class 1–9)',         compliance: 'ISO',     entryCount:  9, activeCount: 9, lastMod: '2024-01-01' },
      { key: 'customsStatus', label: 'Customs Status',   description: 'Customs clearance state codes',              compliance: null,      entryCount:  7, activeCount: 6, lastMod: '2025-04-01' },
    ]
  },
];

// ─── Lookup entry data ────────────────────────────────────────────────────────

const LOOKUP_DATA: Record<string, LookupEntry[]> = {
  containerStatus: [
    { id:  1, code: 'AVAIL', description: 'Available for use',              shortLabel: 'Available',   smdgCode: 'AVAI',  edifactCode: 'AS', isoCode: '',   customsCode: '',     sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount: 2840, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  2, code: 'INUSE', description: 'In use / on hire',               shortLabel: 'In Use',      smdgCode: 'INUSE', edifactCode: 'OU', isoCode: '',   customsCode: '',     sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount: 1220, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  3, code: 'DETER', description: 'Damaged — awaiting repair',      shortLabel: 'Damaged',     smdgCode: 'DAMA',  edifactCode: 'DG', isoCode: '',   customsCode: '',     sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount:   84, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  4, code: 'INSP',  description: 'Under inspection / survey',      shortLabel: 'Inspection',  smdgCode: 'INSP',  edifactCode: 'IN', isoCode: '',   customsCode: '',     sortOrder: 40, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount:   18, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  5, code: 'WTDRW', description: 'Withdrawn from service',         shortLabel: 'Withdrawn',   smdgCode: 'WDRL',  edifactCode: 'WD', isoCode: '',   customsCode: '',     sortOrder: 50, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount:   12, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  6, code: 'SCRAP', description: 'Scrapped / condemned',           shortLabel: 'Scrapped',    smdgCode: 'SCRA',  edifactCode: 'SC', isoCode: '',   customsCode: '',     sortOrder: 60, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount:    3, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id:  7, code: 'SHOLD', description: 'On hold — awaiting customs',     shortLabel: 'On Hold',     smdgCode: '',      edifactCode: '',   isoCode: '',   customsCode: 'HOLD', sortOrder: 35, facilityScope: 'GLOBAL', entryType: 'USER',   lifecycle: 'ACTIVE',     effectiveFrom: '2023-06-01', effectiveTo: '',           usageCount:   44, modifiedBy: 'Apirak P.', modifiedOn: '2023-06-01' },
    { id:  8, code: 'LOST',  description: 'Lost or missing',                shortLabel: 'Lost',        smdgCode: 'LOST',  edifactCode: 'LO', isoCode: '',   customsCode: '',     sortOrder: 70, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'DEPRECATED', effectiveFrom: '2020-01-01', effectiveTo: '2024-12-31', usageCount:    0, modifiedBy: 'System',     modifiedOn: '2024-12-31' },
  ],
  chargeTerm: [
    { id: 20, code: 'PP', description: 'Prepaid — charges paid by shipper',         shortLabel: 'Prepaid', smdgCode: '', edifactCode: '2', isoCode: '', customsCode: '', sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 4820, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 21, code: 'CC', description: 'Collect — charges paid by consignee',       shortLabel: 'Collect', smdgCode: '', edifactCode: '4', isoCode: '', customsCode: '', sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 1240, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 22, code: 'EI', description: 'Either — elected per shipment at booking',  shortLabel: 'Either',  smdgCode: '', edifactCode: '7', isoCode: '', customsCode: '', sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  380, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
  ],
  paymentTerm: [
    { id: 30, code: 'CASH',  description: 'Cash on invoice — immediate settlement', shortLabel: 'Cash',     smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount: 3200, modifiedBy: 'Somchai K.', modifiedOn: '2020-01-01' },
    { id: 31, code: 'CRED',  description: 'Credit — open account, per agreed terms',shortLabel: 'Credit',   smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount: 2140, modifiedBy: 'Somchai K.', modifiedOn: '2020-01-01' },
    { id: 32, code: 'NET30', description: 'Net 30 days from invoice date',          shortLabel: 'Net 30',   smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'ACTIVE',     effectiveFrom: '2022-01-01', effectiveTo: '',           usageCount:  180, modifiedBy: 'Somchai K.', modifiedOn: '2022-01-01' },
    { id: 33, code: 'NET60', description: 'Net 60 days from invoice date',          shortLabel: 'Net 60',   smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 40, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'ACTIVE',     effectiveFrom: '2022-01-01', effectiveTo: '',           usageCount:   44, modifiedBy: 'Somchai K.', modifiedOn: '2022-01-01' },
    { id: 34, code: 'ADVN',  description: 'Advance payment before service delivery',shortLabel: 'Advance',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 50, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'ACTIVE',     effectiveFrom: '2020-01-01', effectiveTo: '',           usageCount:   82, modifiedBy: 'Somchai K.', modifiedOn: '2020-01-01' },
    { id: 35, code: 'DD',    description: 'Direct debit — automatic bank pull',     shortLabel: 'D. Debit', smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: 60, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'DRAFT',      effectiveFrom: '',           effectiveTo: '',           usageCount:    0, modifiedBy: 'Apirak P.', modifiedOn:  '2026-03-12' },
  ],
  uom: [
    { id: 70, code: 'TEU',  description: 'Twenty-foot Equivalent Unit',        shortLabel: 'TEU',    smdgCode: 'TEU', edifactCode: 'NI',  isoCode: 'TEU', customsCode: '',    sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 8240, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 71, code: 'FEU',  description: 'Forty-foot Equivalent Unit',         shortLabel: 'FEU',    smdgCode: 'FEU', edifactCode: 'NJ',  isoCode: 'FEU', customsCode: '',    sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 4120, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 72, code: 'CBM',  description: 'Cubic Metre',                        shortLabel: 'CBM',    smdgCode: '',    edifactCode: 'MTQ', isoCode: 'MTQ', customsCode: 'CBM', sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  880, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 73, code: 'KGS',  description: 'Kilograms',                          shortLabel: 'KG',     smdgCode: '',    edifactCode: 'KGM', isoCode: 'KGM', customsCode: 'KGS', sortOrder: 40, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  340, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 74, code: 'MTS',  description: 'Metric Tons (1,000 kg)',             shortLabel: 'MT',     smdgCode: '',    edifactCode: 'TNE', isoCode: 'TNE', customsCode: 'TNE', sortOrder: 50, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  120, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 75, code: 'DAY',  description: 'Calendar day',                       shortLabel: 'Day',    smdgCode: '',    edifactCode: 'DAY', isoCode: 'DAY', customsCode: '',    sortOrder: 60, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 2840, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 76, code: 'EVT',  description: 'Event / occurrence',                 shortLabel: 'Event',  smdgCode: '',    edifactCode: 'C62', isoCode: 'C62', customsCode: '',    sortOrder: 70, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 1480, modifiedBy: 'System',     modifiedOn: '2020-01-01' },
    { id: 77, code: 'M2D',  description: 'Square metre per day (warehouse)',   shortLabel: 'm²/day', smdgCode: '',    edifactCode: '',    isoCode: '',    customsCode: '',    sortOrder: 80, facilityScope: 'GLOBAL', entryType: 'USER',   lifecycle: 'ACTIVE', effectiveFrom: '2023-01-01', effectiveTo: '', usageCount:  440, modifiedBy: 'Somchai K.', modifiedOn: '2023-01-01' },
  ],
  movementIndicator: [
    { id: 60, code: 'GATE-IN',   description: 'Gate in — container received at facility',    shortLabel: 'Gate In',    smdgCode: 'GTIN',  edifactCode: 'IF', isoCode: '', customsCode: '', sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 8420, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 61, code: 'GATE-OUT',  description: 'Gate out — container released from facility', shortLabel: 'Gate Out',   smdgCode: 'GTOUT', edifactCode: 'OF', isoCode: '', customsCode: '', sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 7840, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 62, code: 'LOAD',      description: 'Vessel load — stuffed to vessel',             shortLabel: 'Load',       smdgCode: 'LOAD',  edifactCode: 'LA', isoCode: '', customsCode: '', sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 5240, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 63, code: 'DISCH',     description: 'Vessel discharge — off-loaded from vessel',  shortLabel: 'Discharge',  smdgCode: 'DISC',  edifactCode: 'DC', isoCode: '', customsCode: '', sortOrder: 40, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 5080, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 64, code: 'REPOS',     description: 'In-yard repositioning',                       shortLabel: 'Reposition', smdgCode: 'REPO',  edifactCode: 'RP', isoCode: '', customsCode: '', sortOrder: 50, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  480, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 65, code: 'STRP',      description: 'CFS stripping (FCL → LCL)',                  shortLabel: 'Stripping',  smdgCode: 'STRP',  edifactCode: 'SR', isoCode: '', customsCode: '', sortOrder: 60, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  340, modifiedBy: 'System', modifiedOn: '2020-01-01' },
    { id: 66, code: 'STUF',      description: 'CFS stuffing (LCL → FCL)',                   shortLabel: 'Stuffing',   smdgCode: 'STUF',  edifactCode: 'ST', isoCode: '', customsCode: '', sortOrder: 70, facilityScope: 'GLOBAL', entryType: 'SYSTEM', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  280, modifiedBy: 'System', modifiedOn: '2020-01-01' },
  ],
  damageCode: [
    { id: 40, code: 'BENT', description: 'Bent — structural deformation',             shortLabel: 'Bent',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'BNT', sortOrder: 10, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 124, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 41, code: 'CRK',  description: 'Cracked — fracture in panel or frame',      shortLabel: 'Crack', smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'CRK', sortOrder: 20, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  88, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 42, code: 'CUT',  description: 'Cut — clean incision in panel',             shortLabel: 'Cut',   smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'CUT', sortOrder: 30, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  38, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 43, code: 'DENT', description: 'Dented — concave deformation',              shortLabel: 'Dent',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'DNT', sortOrder: 40, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 286, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 44, code: 'HOLE', description: 'Hole — penetration through structure',      shortLabel: 'Hole',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'HOL', sortOrder: 50, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  64, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 45, code: 'RUST', description: 'Rust — surface or through corrosion',       shortLabel: 'Rust',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'RST', sortOrder: 60, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount: 348, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 46, code: 'TEAR', description: 'Torn / ripped — membrane separation',       shortLabel: 'Tear',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'TER', sortOrder: 70, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  44, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
    { id: 47, code: 'WARP', description: 'Warped — out-of-plane permanent distortion',shortLabel: 'Warp',  smdgCode: '', edifactCode: '', isoCode: '', customsCode: 'WRP', sortOrder: 80, facilityScope: 'GLOBAL', entryType: 'IMPORTED', lifecycle: 'ACTIVE', effectiveFrom: '2020-01-01', effectiveTo: '', usageCount:  22, modifiedBy: 'IICL Import', modifiedOn: '2024-01-01' },
  ],
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

const LC_STYLE: Record<Lifecycle, { bg: string; color: string; dot: string }> = {
  ACTIVE:     { bg: 'var(--gecko-success-100)',  color: 'var(--gecko-success-700)',  dot: 'var(--gecko-success-500)'  },
  DEPRECATED: { bg: 'var(--gecko-warning-100)',  color: 'var(--gecko-warning-700)',  dot: 'var(--gecko-warning-500)'  },
  RETIRED:    { bg: 'var(--gecko-gray-100)',      color: 'var(--gecko-gray-600)',     dot: 'var(--gecko-gray-400)'     },
  DRAFT:      { bg: 'var(--gecko-info-100)',      color: 'var(--gecko-info-700)',     dot: 'var(--gecko-info-400)'     },
};

const COMPLIANCE_STYLE: Record<NonNullable<Compliance>, { bg: string; color: string }> = {
  SMDG:    { bg: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)' },
  ISO:     { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)'    },
  IICL:    { bg: 'var(--gecko-accent-100)',  color: 'var(--gecko-accent-700)'  },
  EDIFACT: { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' },
};

function LifecycleBadge({ state }: { state: Lifecycle }) {
  const s = LC_STYLE[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {state}
    </span>
  );
}

function EntryTypeBadge({ type }: { type: EntryType }) {
  if (type === 'SYSTEM')   return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', padding: '1px 6px', borderRadius: 4 }}><Icon name="lock" size={10} />SYSTEM</span>;
  if (type === 'IMPORTED') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--gecko-info-700)',          background: 'var(--gecko-info-50)',    border: '1px solid var(--gecko-info-200)',  padding: '1px 6px', borderRadius: 4 }}><Icon name="upload" size={10} />IMPORT</span>;
  return                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--gecko-success-700)',       background: 'var(--gecko-success-50)', border: '1px solid var(--gecko-success-200)', padding: '1px 6px', borderRadius: 4 }}><Icon name="user" size={10} />USER</span>;
}

function CompliancePill({ compliance }: { compliance: Compliance }) {
  if (!compliance) return null;
  const s = COMPLIANCE_STYLE[compliance];
  return <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 5px', borderRadius: 3, background: s.bg, color: s.color }}>{compliance}</span>;
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────

interface EntryModalProps {
  entry: LookupEntry;
  isNew: boolean;
  catMeta: CategoryMeta;
  groupColor: string;
  groupBg: string;
  onClose: () => void;
}

function EntryModal({ entry, isNew, catMeta, groupColor, groupBg, onClose }: EntryModalProps) {
  const [form, setForm] = useState<Record<string, string>>({
    code:          entry.code,
    description:   entry.description,
    shortLabel:    entry.shortLabel,
    smdgCode:      entry.smdgCode,
    edifactCode:   entry.edifactCode,
    isoCode:       entry.isoCode,
    customsCode:   entry.customsCode,
    sortOrder:     String(entry.sortOrder),
    facilityScope: entry.facilityScope,
    lifecycle:     entry.lifecycle,
    effectiveFrom: entry.effectiveFrom,
    effectiveTo:   entry.effectiveTo,
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const locked  = entry.entryType === 'SYSTEM';
  const canSave = !isNew || (form.code.trim() !== '' && form.description.trim() !== '');
  const { toast } = useToast();
  const handleSave = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: isNew ? 'Lookup added' : 'Lookup updated', message: `${form.code} · ${form.description}` });
    onClose();
  };

  const sectionHead = (title: string) => (
    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: groupColor, marginBottom: 12, paddingBottom: 7, borderBottom: `2px solid ${groupColor}28` }}>
      {title}
    </div>
  );

  const roStyle = locked ? { background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-disabled)' } : {};

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Modal Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: groupBg, borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{catMeta.label}</span>
              <CompliancePill compliance={catMeta.compliance} />
              {!isNew && <EntryTypeBadge type={entry.entryType} />}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              {isNew
                ? 'New Entry — complete the required fields below'
                : `Edit · ${entry.code} · Last saved by ${entry.modifiedBy || '—'} on ${entry.modifiedOn || '—'}`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
        </div>

        {/* ── System lock notice ── */}
        {locked && (
          <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: 'var(--gecko-warning-50)', border: '1px solid var(--gecko-warning-200)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', flexShrink: 0 }}>
            <Icon name="lock" size={13} style={{ color: 'var(--gecko-warning-600)', marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11.5, color: 'var(--gecko-warning-800)', lineHeight: 1.55 }}>
              <strong>SYSTEM</strong> entry — sourced from {entry.smdgCode ? 'SMDG' : entry.edifactCode ? 'EDIFACT' : 'ISO'}. Code and external mappings are read-only. You may update description and lifecycle state only.
            </div>
          </div>
        )}

        {/* ── Form body (scrollable) ── */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1 — Identity */}
          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label gecko-label-required">Code</label>
                <input className="gecko-input gecko-text-mono" value={form.code} onChange={set('code')} readOnly={locked} placeholder="e.g. AVAIL" style={roStyle} />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Unique within category</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label gecko-label-required">Description</label>
                <input className="gecko-input" value={form.description} onChange={set('description')} placeholder="Full descriptive text for this code" />
              </div>
            </div>
            <div style={{ maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label className="gecko-label">Short Label</label>
              <input className="gecko-input" value={form.shortLabel} onChange={set('shortLabel')} readOnly={locked} placeholder="e.g. Available" style={roStyle} />
              <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Abbreviated label for dropdowns & reports</div>
            </div>
          </div>

          {/* Section 2 — External Code Mappings */}
          <div>
            {sectionHead('External Code Mappings')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { field: 'smdgCode',    label: 'SMDG Code',    badge: 'SMDG',    badgeBg: 'var(--gecko-primary-100)', badgeClr: 'var(--gecko-primary-700)', ph: 'e.g. GTIN', hint: 'SMDG Edifact Message Standard' },
                { field: 'edifactCode', label: 'EDIFACT Code', badge: 'EDIFACT', badgeBg: 'var(--gecko-warning-100)', badgeClr: 'var(--gecko-warning-700)', ph: 'e.g. IF',   hint: 'UN/EDIFACT Annex qualifier'    },
                { field: 'isoCode',     label: 'ISO Code',     badge: 'ISO',     badgeBg: 'var(--gecko-info-100)',    badgeClr: 'var(--gecko-info-700)',    ph: 'e.g. TEU',  hint: 'ISO reference identifier'      },
                { field: 'customsCode', label: 'Customs Code', badge: null,      badgeBg: '',                        badgeClr: '',                        ph: 'e.g. CBM',  hint: 'Local customs / BoC code'      },
              ].map(f => (
                <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label className="gecko-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {f.label}
                    {f.badge && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 3, background: f.badgeBg, color: f.badgeClr }}>{f.badge}</span>}
                  </label>
                  <input className="gecko-input gecko-text-mono" value={form[f.field]} onChange={set(f.field)} readOnly={locked} placeholder={f.ph} style={roStyle} />
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{f.hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — Classification & Lifecycle */}
          <div>
            {sectionHead('Classification & Lifecycle')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Lifecycle State</label>
                <select className="gecko-input" value={form.lifecycle} onChange={set('lifecycle')}>
                  <option value="DRAFT">Draft — not live yet</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DEPRECATED">Deprecated — avoid new usage</option>
                  <option value="RETIRED">Retired — historical only</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Facility Scope</label>
                <select className="gecko-input" value={form.facilityScope} onChange={set('facilityScope')}>
                  <option value="GLOBAL">GLOBAL — all facilities</option>
                  <option value="LCB-ICD">LCB-ICD only</option>
                  <option value="LCB-CFS">LCB-CFS only</option>
                  <option value="DEPOT-MR">Depot M&R only</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Sort Order</label>
                <input className="gecko-input gecko-text-mono" type="number" value={form.sortOrder} onChange={set('sortOrder')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Effective From</label>
                <DateField value={form.effectiveFrom} onChange={v => setForm(p => ({ ...p, effectiveFrom: v }))} placeholder="dd mmm yyyy" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Effective To</label>
                <DateField value={form.effectiveTo} onChange={v => setForm(p => ({ ...p, effectiveTo: v }))} placeholder="No expiry" />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Leave blank for no expiry</div>
              </div>
            </div>
          </div>

          {/* Section 4 — Live Usage (edit mode only) */}
          {!isNew && (
            <div>
              {sectionHead('Live Usage')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 16px', background: 'var(--gecko-bg-subtle)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: entry.usageCount > 0 ? groupColor : 'var(--gecko-text-disabled)', lineHeight: 1 }}>{entry.usageCount.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>records referencing this code</div>
                  {entry.usageCount > 0 && (
                    <button style={{ marginTop: 6, background: 'none', border: 'none', color: groupColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>View usages →</button>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 2 }}>Last Modified</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{entry.modifiedOn || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>by {entry.modifiedBy || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {isNew && (
            <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>* Code and Description required to save</div>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={handleSave}
            disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            <Icon name="save" size={14} /> {isNew ? 'Save Entry' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ALL_CATEGORY_METAS = LOOKUP_GROUPS.flatMap(g => g.categories);
const TOTAL_ENTRIES = ALL_CATEGORY_METAS.reduce((s, c) => s + c.entryCount, 0);
const TOTAL_CATEGORIES = ALL_CATEGORY_METAS.length;

export default function LookupMasterPage() {
  const [activeGroupId,    setActiveGroupId]    = useState('container');
  const [activeCategoryKey, setActiveCategoryKey] = useState('containerStatus');
  const [editEntry,   setEditEntry]   = useState<LookupEntry | null>(null);
  const [isNewEntry,  setIsNewEntry]  = useState(false);
  const { toast } = useToast();
  const [searchQ,     setSearchQ]     = useState('');
  const [lcFilter,    setLcFilter]    = useState<Lifecycle | 'ALL'>('ALL');
  const activeGroup    = LOOKUP_GROUPS.find(g => g.id === activeGroupId)!;
  const activeCatMeta  = ALL_CATEGORY_METAS.find(c => c.key === activeCategoryKey)!;
  const rawEntries     = LOOKUP_DATA[activeCategoryKey] ?? [];

  const entries = useMemo(() => rawEntries.filter(e => {
    if (lcFilter !== 'ALL' && e.lifecycle !== lcFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!e.code.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rawEntries, lcFilter, searchQ]);

  const systemCount = rawEntries.filter(e => e.entryType === 'SYSTEM').length;
  const userCount   = rawEntries.filter(e => e.entryType === 'USER' || e.entryType === 'IMPORTED').length;
  const activeCount = rawEntries.filter(e => e.lifecycle === 'ACTIVE').length;
  const deprCount   = rawEntries.filter(e => e.lifecycle === 'DEPRECATED' || e.lifecycle === 'RETIRED').length;

  const openNew = () => {
    setIsNewEntry(true);
    setEditEntry({ id: 0, code: '', description: '', shortLabel: '', smdgCode: '', edifactCode: '', isoCode: '', customsCode: '', sortOrder: rawEntries.length * 10 + 10, facilityScope: 'GLOBAL', entryType: 'USER', lifecycle: 'DRAFT', effectiveFrom: '', effectiveTo: '', usageCount: 0, modifiedBy: '', modifiedOn: '' });
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Page Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Reference Codes</h1>
            <span className="gecko-count-badge">{TOTAL_ENTRIES} entries</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>{TOTAL_CATEGORIES} categories</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Global reference codelist — SMDG · ISO · IICL · EDIFACT compliant. Single source of truth for all dropdowns.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton label="Export CSV" resource="Lookups" iconSize={15} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Import CSV', message: 'Lookup CSV import workflow coming soon.' })}><Icon name="upload" size={15} /> Import CSV</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Sync SMDG', message: 'SMDG lookup sync queued.' })}><Icon name="refreshCcw" size={15} /> Sync SMDG</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}><Icon name="plus" size={15} /> New Entry</button>
        </div>
      </div>

      {/* Body: sidebar + table + optional drawer */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--gecko-bg-surface)', boxShadow: 'var(--gecko-shadow-sm)' }}>

        {/* ── Left Sidebar ── */}
        <div style={{ width: 256, flexShrink: 0, borderRight: '1px solid var(--gecko-border)', overflowY: 'auto', background: 'var(--gecko-bg-subtle)' }}>
          <div style={{ padding: '14px 16px 8px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)' }}>Categories</div>

          {LOOKUP_GROUPS.map(group => (
            <div key={group.id} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <button
                onClick={() => { setActiveGroupId(group.id); setActiveCategoryKey(group.categories[0].key); setEditEntry(null); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: activeGroupId === group.id ? group.color : 'var(--gecko-bg-surface)', color: activeGroupId === group.id ? '#fff' : 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={group.icon} size={14} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: activeGroupId === group.id ? group.color : 'var(--gecko-text-primary)', flex: 1 }}>{group.label}</span>
                <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{group.categories.reduce((s, c) => s + c.entryCount, 0)}</span>
              </button>

              {/* Category items */}
              {activeGroupId === group.id && group.categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCategoryKey(cat.key); setEditEntry(null); setSearchQ(''); setLcFilter('ALL'); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px 7px 28px',
                    background: activeCategoryKey === cat.key ? group.bg : 'none',
                    border: 'none', borderLeft: activeCategoryKey === cat.key ? `2px solid ${group.color}` : '2px solid transparent',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: activeCategoryKey === cat.key ? 700 : 500, color: activeCategoryKey === cat.key ? group.color : 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</div>
                    {cat.compliance && (
                      <CompliancePill compliance={cat.compliance} />
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{cat.entryCount}</div>
                    {cat.activeCount < cat.entryCount && (
                      <div style={{ fontSize: 9, color: 'var(--gecko-warning-600)', fontWeight: 600 }}>{cat.entryCount - cat.activeCount} depr.</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── Main Panel ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Category header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gecko-border)', background: activeGroup.bg, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{activeCatMeta?.label}</span>
                  {activeCatMeta?.compliance && <CompliancePill compliance={activeCatMeta.compliance} />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{activeCatMeta?.description}</div>
              </div>

              {/* Mini stats */}
              <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                {[
                  { label: 'Total',    val: rawEntries.length, color: 'var(--gecko-text-primary)' },
                  { label: 'Active',   val: activeCount,       color: 'var(--gecko-success-700)'  },
                  { label: 'Depr/Ret', val: deprCount,         color: 'var(--gecko-warning-700)'  },
                  { label: 'System',   val: systemCount,       color: 'var(--gecko-text-secondary)'},
                  { label: 'User',     val: userCount,         color: 'var(--gecko-primary-600)'  },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--gecko-bg-surface)' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input
                className="gecko-input gecko-input-sm"
                placeholder="Search code or description…"
                style={{ paddingLeft: 28 }}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>

            {/* Lifecycle filter pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ALL', 'ACTIVE', 'DEPRECATED', 'RETIRED', 'DRAFT'] as const).map(f => (
                <button key={f} onClick={() => setLcFilter(f)} style={{
                  padding: '3px 10px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  borderColor: lcFilter === f ? activeGroup.color : 'var(--gecko-border)',
                  background:  lcFilter === f ? activeGroup.bg   : 'var(--gecko-bg-surface)',
                  color:       lcFilter === f ? activeGroup.color : 'var(--gecko-text-secondary)',
                }}>
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}><Icon name="plus" size={13} /> New Entry</button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
            {rawEntries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--gecko-text-secondary)' }}>
                <Icon name="database" size={36} style={{ color: 'var(--gecko-text-disabled)', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No entries yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>This category has no lookup values. Add the first one.</div>
                <button className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ marginTop: 16 }} onClick={openNew}><Icon name="plus" size={13} /> Add First Entry</button>
              </div>
            ) : (
              <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5, minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Code</th>
                    <th>Description</th>
                    <th style={{ width: 90 }}>Short Label</th>
                    <th style={{ width: 180 }}>External Codes</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Order</th>
                    <th style={{ width: 80 }}>Scope</th>
                    <th style={{ width: 80 }}>Type</th>
                    <th style={{ width: 120 }}>State</th>
                    <th style={{ width: 64 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const locked = e.entryType === 'SYSTEM';
                    return (
                      <tr key={e.id} style={{ opacity: e.lifecycle === 'RETIRED' ? 0.5 : 1 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {locked && <Icon name="lock" size={11} style={{ color: 'var(--gecko-text-disabled)', flexShrink: 0 }} />}
                            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: activeGroup.color, fontSize: 12, whiteSpace: 'nowrap' }}>{e.code}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--gecko-text-primary)', fontWeight: 500, maxWidth: 300 }}>{e.description}</td>
                        <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{e.shortLabel}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {e.smdgCode    && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)' }}>S:{e.smdgCode}</span>}
                            {e.edifactCode && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)' }}>E:{e.edifactCode}</span>}
                            {e.isoCode     && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>I:{e.isoCode}</span>}
                            {e.customsCode && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-accent-100)', color: 'var(--gecko-accent-700)' }}>C:{e.customsCode}</span>}
                            {!e.smdgCode && !e.edifactCode && !e.isoCode && !e.customsCode && <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 11 }}>—</span>}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{e.sortOrder}</td>
                        <td style={{ fontSize: 11, color: e.facilityScope === 'GLOBAL' ? 'var(--gecko-text-disabled)' : 'var(--gecko-accent-700)', fontWeight: 600 }}>{e.facilityScope}</td>
                        <td><EntryTypeBadge type={e.entryType} /></td>
                        <td><LifecycleBadge state={e.lifecycle} /></td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setEditEntry(e); setIsNewEntry(false); }}
                              style={{ background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: 'var(--gecko-text-disabled)', padding: '3px 5px', borderRadius: 4, opacity: locked ? 0.4 : 1 }}
                              title={locked ? 'System entry — limited edit' : 'Edit'}
                            >
                              <Icon name="edit" size={13} />
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: '3px 5px', borderRadius: 4 }}
                              onClick={() => { setEditEntry(e); setIsNewEntry(false); }}
                            >
                              <Icon name="moreHorizontal" size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table footer */}
          {rawEntries.length > 0 && (
            <div style={{ padding: '8px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                Showing <strong>{entries.length}</strong> of <strong>{rawEntries.length}</strong> entries
                {activeCatMeta?.compliance && <> · Standard: <CompliancePill compliance={activeCatMeta.compliance} /></>}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }} onClick={() => toast({ variant: 'info', title: 'Reorder', message: 'Drag-to-reorder coming soon.' })}><Icon name="arrowUp" size={12} /> Reorder</button>
                <ExportButton label="Export this category" resource="Lookup category" iconSize={12} className="" style={{ fontSize: 11 }} />
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Entry Modal ── */}
      {editEntry && (
        <EntryModal
          entry={editEntry}
          isNew={isNewEntry}
          catMeta={activeCatMeta}
          groupColor={activeGroup.color}
          groupBg={activeGroup.bg}
          onClose={() => { setEditEntry(null); setIsNewEntry(false); }}
        />
      )}
    </div>
  );
}
