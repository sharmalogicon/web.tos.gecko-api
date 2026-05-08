"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { ExportButton } from '@/components/ui/ExportButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingType = 'EXPORT' | 'IMPORT';
type OrderType = 'EXP CY/CY' | 'EXP CY/CFS' | 'IMP CY/CY' | 'IMP CFS/CY' | 'TRANSHIP';
type PaymentTerm = 'CREDIT' | 'CASH' | 'FREE' | 'PREPAID';
type StatementStatus = 'Draft' | 'Ready' | 'Invoiced' | 'Partial';
type ChargeStatus = 'Pending' | 'Invoiced' | 'Waived' | 'Cancelled';
type DiscountType = 'NONE' | 'AMT' | 'PCT';
type ChargeType = 'GENERAL' | 'STORAGE' | 'DEMURRAGE' | 'VAS' | 'SURCHARGE';
type BillingUnit = 'UNIT' | 'DAY' | 'TON' | 'BAG' | 'TRIP';

interface ChargeRow {
  id: string;
  chargeCode: string;
  chargeDesc: string;
  containerNo: string;
  containerKey: string;
  size: string;
  ctrType: string;
  movementCode: string;
  paymentTerm: PaymentTerm;
  paymentTo: 'CUSTOMER' | 'AGENT' | 'LINE';
  qty: number;
  originalRate: number;
  discountType: DiscountType;
  discountRate: number;
  sellingRate: number;
  quotation: string;
  chargeType: ChargeType;
  billingUnit: BillingUnit;
  truckCategory: string;
  cargoCategory: string;
  billedTo: 'CUSTOMER' | 'AGENT';
  isWaived: boolean;
  waivedBy: string;
  waivedOn: string;
  waiverReason: string;
  isLocked: boolean;
  paidAmount: number;
  status: ChargeStatus;
  createdBy: string;
  createdOn: string;
}

interface BookingStatement {
  bookingNo: string;
  blNo: string;
  orderNo: string;
  agentCode: string;
  agentName: string;
  customerCode: string;
  customerName: string;
  bookingType: BookingType;
  orderType: OrderType;
  subBlNo: string;
  vesselVoyage: string;
  containers: string[];
  totalBillable: number;
  billedAmount: number;
  status: StatementStatus;
  createdBy: string;
  createdOn: string;
  modifiedBy: string;
  modifiedOn: string;
  charges: ChargeRow[];
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const STATEMENTS: BookingStatement[] = [
  {
    bookingNo: 'ANSLCH06112625',
    blNo: 'ANSLCH06112625',
    orderNo: 'ESCT1260400612',
    agentCode: 'ASEAEN-TH',
    agentName: 'Fujitrans (Thailand) Co. Ltd',
    customerCode: 'C-00892',
    customerName: 'TCL Electronics (Thailand) Co. Ltd',
    bookingType: 'EXPORT',
    orderType: 'EXP CY/CY',
    subBlNo: 'ANSLCH06112625',
    vesselVoyage: 'EVER GOLDEN / 042W',
    containers: ['AXEU6002050', 'AXEU6017830'],
    totalBillable: 4765.42,
    billedAmount: 1132.71,
    status: 'Draft',
    createdBy: 'EDI',
    createdOn: '2026-04-03 10:56',
    modifiedBy: 'SOMPORN',
    modifiedOn: '2026-04-05 09:12',
    charges: [
      { id: 'c1',  chargeCode: 'SA001-CA', chargeDesc: 'Terminal Access Fee',      containerNo: 'AXEU6002050', containerKey: 'CNT-001', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 200.00, discountType: 'NONE', discountRate: 0, sellingRate: 200.00, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c2',  chargeCode: 'SL003-CA', chargeDesc: 'Lift-On laden',            containerNo: 'AXEU6002050', containerKey: 'CNT-001', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 900.00, discountType: 'NONE', discountRate: 0, sellingRate: 900.00, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c3',  chargeCode: 'SW001-CA', chargeDesc: 'Wharfage',                 containerNo: 'AXEU6002050', containerKey: 'CNT-001', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate:  32.71, discountType: 'NONE', discountRate: 0, sellingRate:  32.71, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c4',  chargeCode: 'SF001-CA', chargeDesc: 'Lift-Off empty return',    containerNo: 'AXEU6002050', containerKey: 'CNT-001', size: '40', ctrType: 'HC', movementCode: 'FULL OUT', paymentTerm: 'FREE',   paymentTo: 'CUSTOMER', qty: 1, originalRate:   0.00, discountType: 'NONE', discountRate: 0, sellingRate:   0.00, quotation: '',             chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c5',  chargeCode: 'SA001-CA', chargeDesc: 'Terminal Access Fee',      containerNo: 'AXEU6017830', containerKey: 'CNT-002', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 200.00, discountType: 'NONE', discountRate: 0, sellingRate: 200.00, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 200.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c6',  chargeCode: 'SL003-CA', chargeDesc: 'Lift-On laden',            containerNo: 'AXEU6017830', containerKey: 'CNT-002', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 900.00, discountType: 'NONE', discountRate: 0, sellingRate: 900.00, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: true,  paidAmount: 900.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c7',  chargeCode: 'SW001-CA', chargeDesc: 'Wharfage',                 containerNo: 'AXEU6017830', containerKey: 'CNT-002', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate:  32.71, discountType: 'NONE', discountRate: 0, sellingRate:  32.71, quotation: 'STANDARD_240', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount:  32.71, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c8',  chargeCode: 'STORAGE-L',chargeDesc: 'Storage laden (4 days)',   containerNo: 'AXEU6002050', containerKey: 'CNT-001', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 4, originalRate:  80.00, discountType: 'NONE', discountRate: 0, sellingRate:  80.00, quotation: 'STANDARD_240', chargeType: 'STORAGE',   billingUnit: 'DAY',  truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
      { id: 'c9',  chargeCode: 'RF-PLUG',  chargeDesc: 'Reefer monitoring',        containerNo: 'AXEU6017830', containerKey: 'CNT-002', size: '40', ctrType: 'HC', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 2, originalRate: 420.00, discountType: 'NONE', discountRate: 0, sellingRate: 420.00, quotation: 'STANDARD_240', chargeType: 'VAS',       billingUnit: 'DAY',  truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: true,  paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-03 10:56' },
    ],
  },
  {
    bookingNo: '2324935800',
    blNo: '2324935800',
    orderNo: 'ESCT1260400463',
    agentCode: 'OOCL-TH',
    agentName: 'Orient Overseas Container Line (Thailand)',
    customerCode: 'C-00629',
    customerName: 'Thai Agri Foods Public Co.',
    bookingType: 'EXPORT',
    orderType: 'EXP CY/CY',
    subBlNo: '2324935800',
    vesselVoyage: 'OOCL THAILAND / 038E',
    containers: ['OOLU2021001', 'OOLU2021002'],
    totalBillable: 882.71,
    billedAmount: 0,
    status: 'Ready',
    createdBy: 'EDI',
    createdOn: '2026-04-03 13:11',
    modifiedBy: 'EDI',
    modifiedOn: '2026-04-03 13:11',
    charges: [
      { id: 'd1', chargeCode: 'SA001-CA', chargeDesc: 'Terminal Access Fee', containerNo: 'OOLU2021001', containerKey: 'CNT-010', size: '40', ctrType: 'GP', movementCode: 'FULL IN', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 200.00, discountType: 'NONE', discountRate: 0, sellingRate: 200.00, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'EDI', createdOn: '2026-04-03 13:11' },
      { id: 'd2', chargeCode: 'SL003-CA', chargeDesc: 'Lift-On laden',        containerNo: 'OOLU2021001', containerKey: 'CNT-010', size: '40', ctrType: 'GP', movementCode: 'FULL IN', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 500.00, discountType: 'NONE', discountRate: 0, sellingRate: 500.00, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'EDI', createdOn: '2026-04-03 13:11' },
      { id: 'd3', chargeCode: 'SW001-CA', chargeDesc: 'Wharfage',             containerNo: 'OOLU2021001', containerKey: 'CNT-010', size: '40', ctrType: 'GP', movementCode: 'FULL IN', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate:  32.71, discountType: 'NONE', discountRate: 0, sellingRate:  32.71, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'EDI', createdOn: '2026-04-03 13:11' },
      { id: 'd4', chargeCode: 'VAS-DOC',  chargeDesc: 'Documentation fee',   containerNo: 'OOLU2021002', containerKey: 'CNT-011', size: '40', ctrType: 'GP', movementCode: 'FULL IN', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate: 150.00, discountType: 'NONE', discountRate: 0, sellingRate: 150.00, quotation: 'STANDARD_240', chargeType: 'VAS',     billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'EDI', createdOn: '2026-04-03 13:11' },
    ],
  },
  {
    bookingNo: 'BKGTH20260412',
    blNo: 'BKGTH20260412',
    orderNo: 'ESCT1260400501',
    agentCode: 'MAEU-TH',
    agentName: 'Maersk Line (Thailand)',
    customerCode: 'C-00142',
    customerName: 'Thai Union Group PCL',
    bookingType: 'IMPORT',
    orderType: 'IMP CY/CY',
    subBlNo: 'BKGTH20260412',
    vesselVoyage: 'MAERSK SENTOSA / 041W',
    containers: ['MSKU7441823', 'MSKU7441824', 'MSKU7441825'],
    totalBillable: 2100,
    billedAmount: 0,
    status: 'Draft',
    createdBy: 'SOMPORN',
    createdOn: '2026-04-12 09:30',
    modifiedBy: 'SOMPORN',
    modifiedOn: '2026-04-12 09:30',
    charges: [
      { id: 'e1', chargeCode: 'SA002-CA',  chargeDesc: 'Terminal Handling Charge', containerNo: 'MSKU7441823', containerKey: 'CNT-020', size: '20', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 1, originalRate: 700.00, discountType: 'NONE', discountRate: 0, sellingRate: 700.00, quotation: 'IMP_RATE_001', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'SOMPORN', createdOn: '2026-04-12 09:30' },
      { id: 'e2', chargeCode: 'SL001-CA',  chargeDesc: 'Lift-Off laden',           containerNo: 'MSKU7441824', containerKey: 'CNT-021', size: '20', ctrType: 'GP', movementCode: 'FULL OUT', paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 1, originalRate: 900.00, discountType: 'NONE', discountRate: 0, sellingRate: 900.00, quotation: 'IMP_RATE_001', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'SOMPORN', createdOn: '2026-04-12 09:30' },
      { id: 'e3', chargeCode: 'STORAGE-I', chargeDesc: 'Storage import laden',     containerNo: 'MSKU7441825', containerKey: 'CNT-022', size: '20', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 3, originalRate: 166.67, discountType: 'NONE', discountRate: 0, sellingRate: 166.67, quotation: 'IMP_RATE_001', chargeType: 'STORAGE', billingUnit: 'DAY',  truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0, status: 'Pending', createdBy: 'SOMPORN', createdOn: '2026-04-12 09:30' },
    ],
  },
  {
    bookingNo: 'CMAUTH0420261',
    blNo: 'CMAUTH0420261',
    orderNo: 'ESCT1260400522',
    agentCode: 'CMA-TH',
    agentName: 'CMA CGM (Thailand)',
    customerCode: 'C-00308',
    customerName: 'PTT Global Chemical',
    bookingType: 'EXPORT',
    orderType: 'EXP CY/CFS',
    subBlNo: 'CMAUTH0420261',
    vesselVoyage: 'CMA CGM TITUS / 019W',
    containers: ['CMAU8812345'],
    totalBillable: 1650,
    billedAmount: 1650,
    status: 'Invoiced',
    createdBy: 'EDI',
    createdOn: '2026-04-15 08:45',
    modifiedBy: 'WANCHAI',
    modifiedOn: '2026-04-18 14:20',
    charges: [
      { id: 'f1', chargeCode: 'SA001-CA', chargeDesc: 'Terminal Access Fee', containerNo: 'CMAU8812345', containerKey: 'CNT-030', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CASH', paymentTo: 'CUSTOMER', qty: 1, originalRate: 200.00, discountType: 'NONE', discountRate: 0, sellingRate: 200.00, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 200.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-15 08:45' },
      { id: 'f2', chargeCode: 'SL003-CA', chargeDesc: 'Lift-On laden',        containerNo: 'CMAU8812345', containerKey: 'CNT-030', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CASH', paymentTo: 'CUSTOMER', qty: 1, originalRate: 900.00, discountType: 'NONE', discountRate: 0, sellingRate: 900.00, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: true,  paidAmount: 900.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-15 08:45' },
      { id: 'f3', chargeCode: 'SW001-CA', chargeDesc: 'Wharfage',             containerNo: 'CMAU8812345', containerKey: 'CNT-030', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CASH', paymentTo: 'CUSTOMER', qty: 1, originalRate: 550.00, discountType: 'NONE', discountRate: 0, sellingRate: 550.00, quotation: 'STANDARD_240', chargeType: 'GENERAL', billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 550.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-15 08:45' },
    ],
  },
  {
    bookingNo: 'HLCTH20260420',
    blNo: 'HLCTH20260420',
    orderNo: 'ESCT1260400588',
    agentCode: 'HLC-TH',
    agentName: 'Hapag-Lloyd (Thailand)',
    customerCode: 'C-00412',
    customerName: 'CP Foods Co.',
    bookingType: 'IMPORT',
    orderType: 'IMP CFS/CY',
    subBlNo: 'HLCTH20260420',
    vesselVoyage: 'HAPAG LLOYD EXPRESS / 022E',
    containers: ['HLXU4419208'],
    totalBillable: 2840,
    billedAmount: 840,
    status: 'Partial',
    createdBy: 'EDI',
    createdOn: '2026-04-20 11:00',
    modifiedBy: 'EDI',
    modifiedOn: '2026-04-21 08:30',
    charges: [
      { id: 'g1', chargeCode: 'SA002-CA',  chargeDesc: 'Terminal Handling Charge', containerNo: 'HLXU4419208', containerKey: 'CNT-040', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate:  500.00, discountType: 'NONE', discountRate: 0, sellingRate:  500.00, quotation: 'IMP_RATE_002', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 500.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-20 11:00' },
      { id: 'g2', chargeCode: 'SL001-CA',  chargeDesc: 'Lift-Off laden',           containerNo: 'HLXU4419208', containerKey: 'CNT-040', size: '40', ctrType: 'GP', movementCode: 'FULL OUT', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', qty: 1, originalRate:  340.00, discountType: 'NONE', discountRate: 0, sellingRate:  340.00, quotation: 'IMP_RATE_002', chargeType: 'GENERAL',   billingUnit: 'UNIT', truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: true,  paidAmount: 340.00, status: 'Invoiced', createdBy: 'EDI', createdOn: '2026-04-20 11:00' },
      { id: 'g3', chargeCode: 'STORAGE-I', chargeDesc: 'Storage import laden',     containerNo: 'HLXU4419208', containerKey: 'CNT-040', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 5, originalRate:  200.00, discountType: 'NONE', discountRate: 0, sellingRate:  200.00, quotation: 'IMP_RATE_002', chargeType: 'STORAGE',   billingUnit: 'DAY',  truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-20 11:00' },
      { id: 'g4', chargeCode: 'DEM-CONT',  chargeDesc: 'Demurrage (container)',    containerNo: 'HLXU4419208', containerKey: 'CNT-040', size: '40', ctrType: 'GP', movementCode: 'FULL IN',  paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', qty: 3, originalRate:  300.00, discountType: 'NONE', discountRate: 0, sellingRate:  300.00, quotation: 'IMP_RATE_002', chargeType: 'DEMURRAGE', billingUnit: 'DAY',  truckCategory: '', cargoCategory: '', billedTo: 'CUSTOMER', isWaived: false, waivedBy: '', waivedOn: '', waiverReason: '', isLocked: false, paidAmount: 0,      status: 'Pending',  createdBy: 'EDI', createdOn: '2026-04-20 11:00' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatementStatusBadge({ status }: { status: StatementStatus }) {
  const MAP: Record<StatementStatus, { bg: string; color: string }> = {
    Draft:    { bg: 'var(--gecko-gray-200)',    color: 'var(--gecko-text-secondary)' },
    Ready:    { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)'       },
    Invoiced: { bg: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)'   },
    Partial:  { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)'   },
  };
  const s = MAP[status];
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status}</span>;
}

function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  const MAP: Record<ChargeStatus, { bg: string; color: string }> = {
    Pending:   { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)'    },
    Invoiced:  { bg: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)'    },
    Waived:    { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)'        },
    Cancelled: { bg: 'var(--gecko-gray-200)',    color: 'var(--gecko-text-secondary)' },
  };
  const s = MAP[status];
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status}</span>;
}

function PaymentTermBadge({ term }: { term: PaymentTerm }) {
  const MAP: Record<PaymentTerm, { bg: string; color: string }> = {
    CASH:    { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-600)'        },
    CREDIT:  { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)'        },
    FREE:    { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-600)'     },
    PREPAID: { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)'     },
  };
  const s = MAP[term];
  return <span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{term}</span>;
}

function BookingTypeBadge({ type }: { type: BookingType }) {
  if (type === 'EXPORT') return <span style={{ background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em' }}>EXPORT</span>;
  return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em' }}>IMPORT</span>;
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: 'var(--gecko-primary-600)', marginBottom: 14, paddingBottom: 7, borderBottom: '2px solid rgba(37,99,235,0.12)' }}>
      {title}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, colorOn = 'var(--gecko-primary-600)' }: { value: boolean; onChange: (v: boolean) => void; colorOn?: string }) {
  return (
    <button onClick={() => onChange(!value)} type="button" role="switch" aria-checked={value} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, background: value ? colorOn : 'var(--gecko-gray-300)', position: 'relative', transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
    </button>
  );
}

// ─── Filter / Sort Config ─────────────────────────────────────────────────────

const STMT_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Booking No, BL No, Order No...' },
  { type: 'select', key: 'bookingType', label: 'Booking Type', options: [{ label: 'All', value: '' }, { label: 'EXPORT', value: 'EXPORT' }, { label: 'IMPORT', value: 'IMPORT' }] },
  { type: 'select', key: 'orderType', label: 'Order Type', options: [{ label: 'All', value: '' }, { label: 'EXP CY/CY', value: 'EXP CY/CY' }, { label: 'EXP CY/CFS', value: 'EXP CY/CFS' }, { label: 'IMP CY/CY', value: 'IMP CY/CY' }, { label: 'IMP CFS/CY', value: 'IMP CFS/CY' }, { label: 'TRANSHIP', value: 'TRANSHIP' }] },
  { type: 'select', key: 'agent', label: 'Agent', options: [{ label: 'All', value: '' }, { label: 'ASEAEN-TH', value: 'ASEAEN-TH' }, { label: 'OOCL-TH', value: 'OOCL-TH' }, { label: 'MAEU-TH', value: 'MAEU-TH' }, { label: 'CMA-TH', value: 'CMA-TH' }, { label: 'HLC-TH', value: 'HLC-TH' }] },
  { type: 'select', key: 'customer', label: 'Customer', options: [{ label: 'All', value: '' }, { label: 'C-00142', value: 'C-00142' }, { label: 'C-00308', value: 'C-00308' }, { label: 'C-00412', value: 'C-00412' }, { label: 'C-00629', value: 'C-00629' }, { label: 'C-00892', value: 'C-00892' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Draft', value: 'Draft' }, { label: 'Ready', value: 'Ready' }, { label: 'Invoiced', value: 'Invoiced' }, { label: 'Partial', value: 'Partial' }] },
  { type: 'select', key: 'date', label: 'Date', options: [{ label: 'All time', value: '' }, { label: 'Today', value: 'today' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }] },
];

const STMT_SORT_OPTIONS: SortOption[] = [
  { label: 'Date (newest)', value: 'date_desc' },
  { label: 'Booking No', value: 'bookingNo' },
  { label: 'Unbilled (high → low)', value: 'unbilled_desc' },
  { label: 'Customer', value: 'customer' },
];

// ─── EMPTY CHARGE ─────────────────────────────────────────────────────────────

const EMPTY_CHARGE: ChargeRow = {
  id: '',
  chargeCode: '',
  chargeDesc: '',
  containerNo: '',
  containerKey: '',
  size: '40',
  ctrType: 'GP',
  movementCode: 'FULL IN',
  paymentTerm: 'CASH',
  paymentTo: 'CUSTOMER',
  qty: 1,
  originalRate: 0,
  discountType: 'NONE',
  discountRate: 0,
  sellingRate: 0,
  quotation: '',
  chargeType: 'GENERAL',
  billingUnit: 'UNIT',
  truckCategory: '',
  cargoCategory: '',
  billedTo: 'CUSTOMER',
  isWaived: false,
  waivedBy: '',
  waivedOn: '',
  waiverReason: '',
  isLocked: false,
  paidAmount: 0,
  status: 'Pending',
  createdBy: '',
  createdOn: '',
};

// ─── ChargeDetailModal ────────────────────────────────────────────────────────

type ApplyTo = 'this' | 'all' | 'select';

interface ChargeDetailModalProps {
  charge: ChargeRow;
  isNew: boolean;
  containers: string[];
  onClose: () => void;
}

function ChargeDetailModal({ charge, isNew, containers, onClose }: ChargeDetailModalProps) {
  const [form, setForm] = useState<ChargeRow>({ ...charge });
  const [applyTo, setApplyTo] = useState<ApplyTo>('this');
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set(containers));
  const { toast } = useToast();
  const handleSaveCharge = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: isNew ? 'Charge added' : 'Charge updated', message: `${form.chargeCode} · ${form.chargeDesc}` });
    onClose();
  };

  const set = useCallback((partial: Partial<ChargeRow>) => {
    setForm(prev => {
      const next = { ...prev, ...partial };
      if ('originalRate' in partial || 'discountType' in partial || 'discountRate' in partial) {
        if (next.discountType === 'NONE') next.sellingRate = next.originalRate;
        else if (next.discountType === 'AMT') next.sellingRate = Math.max(0, next.originalRate - next.discountRate);
        else next.sellingRate = Math.max(0, next.originalRate * (1 - next.discountRate / 100));
      }
      return next;
    });
  }, []);

  const canSave = form.chargeCode.trim() !== '' && form.chargeDesc.trim() !== '';
  const totalAmount = form.sellingRate * form.qty;

  const toggleCtr = (c: string) => {
    setSelectedContainers(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-primary-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="fileText" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                {isNew ? 'New Manual Charge' : `Edit Charge — ${charge.chargeCode}`}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              {isNew ? 'Add a manual charge to the booking statement.' : 'Editing charge line. Changes update the cost sheet.'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: Charge Identity */}
          <div>
            <SectionHead title="Charge Identity" />
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, marginBottom: 16 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Charge Code</label>
                <input className="gecko-input gecko-text-mono" placeholder="e.g. SA001-CA" value={form.chargeCode} onChange={e => set({ chargeCode: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase', fontWeight: 700 }} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Description</label>
                <input className="gecko-input" placeholder="e.g. Terminal Access Fee" value={form.chargeDesc} onChange={e => set({ chargeDesc: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 16, marginBottom: 16 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Container No</label>
                <select className="gecko-input gecko-text-mono" value={form.containerNo} onChange={e => set({ containerNo: e.target.value })}>
                  <option value="">— select —</option>
                  {containers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Size</label>
                <select className="gecko-input" value={form.size} onChange={e => set({ size: e.target.value })}>
                  <option value="20">20</option>
                  <option value="40">40</option>
                  <option value="45">45</option>
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Type</label>
                <select className="gecko-input" value={form.ctrType} onChange={e => set({ ctrType: e.target.value })}>
                  <option value="GP">GP</option>
                  <option value="HC">HC</option>
                  <option value="RF">RF</option>
                  <option value="OT">OT</option>
                </select>
              </div>
            </div>
            {/* Apply To */}
            <div style={{ padding: '12px 14px', border: '1px solid var(--gecko-border)', borderRadius: 8, background: 'var(--gecko-bg-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Apply to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['this', 'all', 'select'] as ApplyTo[]).map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="applyTo" value={opt} checked={applyTo === opt} onChange={() => setApplyTo(opt)} />
                    <span>{opt === 'this' ? 'This container only' : opt === 'all' ? 'All containers on booking' : 'Select containers'}</span>
                  </label>
                ))}
              </div>
              {applyTo === 'select' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {containers.map(c => (
                    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--gecko-font-mono)', cursor: 'pointer', padding: '4px 10px', border: `1px solid ${selectedContainers.has(c) ? 'var(--gecko-primary-400)' : 'var(--gecko-border)'}`, borderRadius: 6, background: selectedContainers.has(c) ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)' }}>
                      <input type="checkbox" checked={selectedContainers.has(c)} onChange={() => toggleCtr(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Movement & Billing */}
          <div>
            <SectionHead title="Movement & Billing" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: 'Movement Code', key: 'movementCode', opts: ['FULL IN','FULL OUT','MTY IN','MTY OUT','TRANSHIP'] },
                { label: 'Payment Term', key: 'paymentTerm', opts: ['CASH','CREDIT','FREE','PREPAID'] },
                { label: 'Payment To', key: 'paymentTo', opts: ['CUSTOMER','AGENT','LINE'] },
                { label: 'Charge Type', key: 'chargeType', opts: ['GENERAL','STORAGE','DEMURRAGE','VAS','SURCHARGE'] },
                { label: 'Billing Unit', key: 'billingUnit', opts: ['UNIT','DAY','TON','BAG','TRIP'] },
              ].map(({ label, key, opts }) => (
                <div key={key} className="gecko-form-group">
                  <label className="gecko-label">{label}</label>
                  <select className="gecko-input" value={(form as unknown as Record<string, string>)[key]} onChange={e => set({ [key]: e.target.value } as Partial<ChargeRow>)}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Rates & Discount */}
          <div>
            <SectionHead title="Rates & Discount" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Original Rate</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>฿</span>
                  <input className="gecko-input gecko-text-mono" type="number" step="0.01" value={form.originalRate} onChange={e => set({ originalRate: parseFloat(e.target.value) || 0 })} style={{ paddingLeft: 22, textAlign: 'right' }} />
                </div>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Discount Type</label>
                <select className="gecko-input" value={form.discountType} onChange={e => set({ discountType: e.target.value as DiscountType })}>
                  <option value="NONE">NONE</option>
                  <option value="AMT">AMT — Amount</option>
                  <option value="PCT">PCT — Percentage</option>
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Discount Rate</label>
                <input className="gecko-input gecko-text-mono" type="number" step="0.01" value={form.discountRate} onChange={e => set({ discountRate: parseFloat(e.target.value) || 0 })} disabled={form.discountType === 'NONE'} style={{ textAlign: 'right', opacity: form.discountType === 'NONE' ? 0.4 : 1 }} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Selling Rate</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>฿</span>
                  <input className="gecko-input gecko-text-mono" type="number" step="0.01" value={form.sellingRate} onChange={e => set({ sellingRate: parseFloat(e.target.value) || 0 })} style={{ paddingLeft: 22, textAlign: 'right' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16, alignItems: 'end' }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Quantity</label>
                <input className="gecko-input gecko-text-mono" type="number" step="0.001" value={form.qty} onChange={e => set({ qty: parseFloat(e.target.value) || 0 })} style={{ textAlign: 'right' }} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Total Amount</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>฿</span>
                  <input className="gecko-input gecko-text-mono" value={totalAmount.toFixed(2)} readOnly style={{ paddingLeft: 22, textAlign: 'right', background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-primary-700)', fontWeight: 700 }} />
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--gecko-primary-50)', borderRadius: 8, border: '1px solid var(--gecko-primary-100)', fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-600)', fontWeight: 700 }}>
                  {fmt(form.sellingRate)} × {form.qty.toFixed(3)} {form.billingUnit} = {fmt(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Payment & Waiver */}
          <div>
            <SectionHead title="Payment & Waiver" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: `1px solid ${form.isWaived ? 'var(--gecko-warning-200)' : 'var(--gecko-border)'}`, borderRadius: 8, background: form.isWaived ? 'var(--gecko-warning-50)' : 'var(--gecko-bg-surface)', marginBottom: form.isWaived ? 12 : 0 }}>
              <Toggle value={form.isWaived} onChange={v => set({ isWaived: v })} colorOn="var(--gecko-warning-600)" />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: form.isWaived ? 'var(--gecko-warning-700)' : 'var(--gecko-text-primary)' }}>Waived</div>
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Mark this charge as waived — amount excluded from billing</div>
              </div>
            </div>
            {form.isWaived && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="gecko-form-group">
                  <label className="gecko-label">Waived By</label>
                  <input className="gecko-input" value={form.waivedBy} onChange={e => set({ waivedBy: e.target.value })} />
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">Waiver Reason</label>
                  <input className="gecko-input" value={form.waiverReason} onChange={e => set({ waiverReason: e.target.value })} placeholder="e.g. Management Approval" />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {isNew && <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>* Charge Code and Description are required</div>}
          <div style={{ marginLeft: isNew ? undefined : 'auto', display: 'flex', gap: 8 }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={handleSaveCharge} disabled={!canSave} style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>
              <Icon name="save" size={14} /> Save Charge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BulkChargeModal ──────────────────────────────────────────────────────────

interface BulkChargeModalProps {
  containers: string[];
  mode: 'add' | 'update';
  onClose: () => void;
}

function BulkChargeModal({ containers, mode, onClose }: BulkChargeModalProps) {
  const [chargeCode, setChargeCode] = useState('');
  const [desc, setDesc] = useState('');
  const [movementCode, setMovementCode] = useState('FULL IN');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('CASH');
  const [paymentTo, setPaymentTo] = useState<'CUSTOMER' | 'AGENT' | 'LINE'>('CUSTOMER');
  const [chargeType, setChargeType] = useState<ChargeType>('GENERAL');
  const [billingUnit, setBillingUnit] = useState<BillingUnit>('UNIT');
  const [originalRate, setOriginalRate] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [discountRate, setDiscountRate] = useState(0);
  const [includedCtrs, setIncludedCtrs] = useState<Set<string>>(new Set(containers));
  const { toast } = useToast();
  const handleApply = () => {
    if (includedCtrs.size === 0 || !chargeCode.trim()) return;
    toast({ variant: 'success', title: mode === 'add' ? 'Charges added' : 'Charges updated', message: `${chargeCode} applied to ${includedCtrs.size} container(s).` });
    onClose();
  };

  const sellingRate = discountType === 'NONE' ? originalRate : discountType === 'AMT' ? Math.max(0, originalRate - discountRate) : Math.max(0, originalRate * (1 - discountRate / 100));
  const toggleCtr = (c: string) => setIncludedCtrs(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const title = mode === 'add' ? 'Add Charges to All Items' : 'Update Charges to All Items';

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-warning-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="layers" size={16} style={{ color: 'var(--gecko-warning-600)' }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <SectionHead title="Charge" />
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginBottom: 14 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Charge Code</label>
                <input className="gecko-input gecko-text-mono" value={chargeCode} onChange={e => setChargeCode(e.target.value.toUpperCase())} style={{ fontWeight: 700 }} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Description</label>
                <input className="gecko-input" value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Movement Code</label>
                <select className="gecko-input" value={movementCode} onChange={e => setMovementCode(e.target.value)}>
                  {['FULL IN','FULL OUT','MTY IN','MTY OUT','TRANSHIP'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Payment Term</label>
                <select className="gecko-input" value={paymentTerm} onChange={e => setPaymentTerm(e.target.value as PaymentTerm)}>
                  {['CASH','CREDIT','FREE','PREPAID'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Charge Type</label>
                <select className="gecko-input" value={chargeType} onChange={e => setChargeType(e.target.value as ChargeType)}>
                  {['GENERAL','STORAGE','DEMURRAGE','VAS','SURCHARGE'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Billing Unit</label>
                <select className="gecko-input" value={billingUnit} onChange={e => setBillingUnit(e.target.value as BillingUnit)}>
                  {['UNIT','DAY','TON','BAG','TRIP'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <SectionHead title="Rate" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Original Rate (฿)</label>
                <input className="gecko-input gecko-text-mono" type="number" step="0.01" value={originalRate} onChange={e => setOriginalRate(parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Discount Type</label>
                <select className="gecko-input" value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}>
                  <option value="NONE">NONE</option>
                  <option value="AMT">AMT</option>
                  <option value="PCT">PCT</option>
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Selling Rate (฿)</label>
                <input className="gecko-input gecko-text-mono" value={sellingRate.toFixed(2)} readOnly style={{ textAlign: 'right', background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-primary-700)', fontWeight: 700 }} />
              </div>
            </div>
          </div>

          <div>
            <SectionHead title={`Preview — Will be applied to ${includedCtrs.size} container${includedCtrs.size !== 1 ? 's' : ''}:`} />
            <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'center', width: 32, borderBottom: '1px solid var(--gecko-border)', fontWeight: 700, fontSize: 11 }}>✓</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--gecko-border)', fontWeight: 700, fontSize: 11 }}>CONTAINER</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map(c => (
                    <tr key={c} style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                      <td style={{ textAlign: 'center', padding: '7px 10px' }}>
                        <input type="checkbox" checked={includedCtrs.has(c)} onChange={() => toggleCtr(c)} />
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={handleApply} disabled={includedCtrs.size === 0 || !chargeCode.trim()} style={includedCtrs.size === 0 || !chargeCode.trim() ? { opacity: 0.45 } : {}}>
            Apply to {includedCtrs.size} Container{includedCtrs.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RegenerateModal ──────────────────────────────────────────────────────────

interface RegenerateModalProps {
  charges: ChargeRow[];
  onClose: () => void;
}

function RegenerateModal({ charges, onClose }: RegenerateModalProps) {
  const willUpdate = charges.filter(c => !c.isLocked && c.status === 'Pending');
  const willSkip = charges.filter(c => c.isLocked || c.status === 'Invoiced');
  const invoicedCount = charges.filter(c => c.status === 'Invoiced').length;
  const { toast } = useToast();
  const handleRegenerate = () => {
    toast({ variant: 'warning', title: 'Charges regenerated', message: `${willUpdate.length} updated · ${willSkip.length} skipped (locked or invoiced).` });
    onClose();
  };

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gecko-modal" style={{ display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-info-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="refreshCcw" size={16} style={{ color: 'var(--gecko-info-600)' }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>Regenerate Charges</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ padding: '12px 14px', background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 13, color: 'var(--gecko-info-700)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Charges will be recalculated based on current tariff rates. Rate-locked charges (🔒) will not be affected.</span>
          </div>

          {invoicedCount > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--gecko-warning-50)', border: '1px solid var(--gecko-warning-200)', borderRadius: 8, fontSize: 12.5, color: 'var(--gecko-warning-700)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="warning" size={15} />
              <span>{invoicedCount} invoiced charge{invoicedCount !== 1 ? 's' : ''} cannot be regenerated.</span>
            </div>
          )}

          {willUpdate.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-success-700)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Will be updated ({willUpdate.length} charges)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {willUpdate.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gecko-success-50)', border: '1px solid var(--gecko-success-100)', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{c.chargeCode}</span>
                    <span style={{ color: 'var(--gecko-text-secondary)' }}>{c.chargeDesc}</span>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-success-700)', fontWeight: 700 }}>{fmt(c.sellingRate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {willSkip.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Will be skipped ({willSkip.length} charges)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {willSkip.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 6, fontSize: 12, opacity: 0.7 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{c.chargeCode}</span>
                    <span style={{ color: 'var(--gecko-text-secondary)' }}>{c.chargeDesc}</span>
                    <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 11 }}>{c.isLocked ? 'Rate locked' : 'Invoiced'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button onClick={handleRegenerate} className="gecko-btn gecko-btn-danger gecko-btn-sm">
            <Icon name="refreshCcw" size={13} /> Regenerate Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WaiveModal ───────────────────────────────────────────────────────────────

interface WaiveModalProps {
  selectedCharges: ChargeRow[];
  customerName: string;
  onClose: () => void;
}

function WaiveModal({ selectedCharges, customerName, onClose }: WaiveModalProps) {
  const [waivedBy, setWaivedBy] = useState('SOMPORN');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const totalWaived = selectedCharges.reduce((s, c) => s + c.sellingRate * c.qty, 0);
  const canConfirm = reasonCode.trim() !== '';
  const { toast } = useToast();
  const handleWaive = () => {
    if (!canConfirm) return;
    toast({ variant: 'warning', title: 'Charges waived', message: `${selectedCharges.length} charge(s) waived for ${customerName} · Reason: ${reasonCode}.` });
    onClose();
  };

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gecko-modal gecko-modal-sm" style={{ display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-warning-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="warning" size={16} style={{ color: 'var(--gecko-warning-600)' }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>Waive Selected Charges</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
            Waiving <strong style={{ color: 'var(--gecko-text-primary)' }}>{selectedCharges.length} charge{selectedCharges.length !== 1 ? 's' : ''}</strong> for <strong style={{ color: 'var(--gecko-text-primary)' }}>{customerName}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedCharges.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 6, fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{c.chargeCode}</span>
                <span style={{ color: 'var(--gecko-text-secondary)' }}>{c.chargeDesc}</span>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{fmt(c.sellingRate * c.qty)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 10px 0', borderTop: '2px solid var(--gecko-border)', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, color: 'var(--gecko-warning-700)', fontSize: 14 }}>Total waived: {fmt(totalWaived)}</span>
            </div>
          </div>

          <div className="gecko-form-group">
            <label className="gecko-label">Waived By</label>
            <input className="gecko-input" value={waivedBy} onChange={e => setWaivedBy(e.target.value)} />
          </div>

          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Reason Code</label>
            <select className="gecko-input" value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
              <option value="">— select reason —</option>
              <option value="GOODWILL">Goodwill</option>
              <option value="RATE_ERROR">Rate Error</option>
              <option value="MGMT_APPROVAL">Management Approval</option>
              <option value="DISPUTE">Dispute Resolution</option>
              <option value="SYS_ERROR">System Error</option>
            </select>
          </div>

          <div className="gecko-form-group">
            <label className="gecko-label">Notes (optional)</label>
            <textarea className="gecko-input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ resize: 'vertical', lineHeight: 1.55 }} placeholder="Additional context..." />
          </div>

        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button onClick={handleWaive} disabled={!canConfirm} className="gecko-btn gecko-btn-warning gecko-btn-sm" style={!canConfirm ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>
            <Icon name="check" size={13} /> Confirm Waiver
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal State Union ────────────────────────────────────────────────────────

type ModalState =
  | { type: 'chargeDetail'; charge: ChargeRow; isNew: boolean }
  | { type: 'bulkCharge'; mode: 'add' | 'update' }
  | { type: 'regenerate' }
  | { type: 'waive' }
  | null;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingStatementPage() {
  const [activeStatement, setActiveStatement] = useState<BookingStatement | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', bookingType: '', orderType: '', agent: '', customer: '', status: '', date: '' });
  const [sortBy, setSortBy] = useState('date_desc');
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close action menu on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Reset selection when active statement changes
  useEffect(() => { setSelectedRows(new Set()); }, [activeStatement]);

  // ── List View Filtering ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = STATEMENTS.filter(s => {
      if (filters.bookingType && s.bookingType !== filters.bookingType) return false;
      if (filters.orderType && s.orderType !== filters.orderType) return false;
      if (filters.agent && s.agentCode !== filters.agent) return false;
      if (filters.customer && s.customerCode !== filters.customer) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!s.bookingNo.toLowerCase().includes(q) && !s.blNo.toLowerCase().includes(q) && !s.orderNo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === 'bookingNo') result = [...result].sort((a, b) => a.bookingNo.localeCompare(b.bookingNo));
    if (sortBy === 'unbilled_desc') result = [...result].sort((a, b) => (b.totalBillable - b.billedAmount) - (a.totalBillable - a.billedAmount));
    if (sortBy === 'customer') result = [...result].sort((a, b) => a.customerName.localeCompare(b.customerName));
    return result;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems: listPageItems, totalItems, startRow, endRow } = usePagination(filtered);

  // ── Detail View Pagination ───────────────────────────────────────────────────

  const charges = activeStatement?.charges ?? [];
  const chargesPagination = usePagination(charges);

  // ── Row Selection helpers ────────────────────────────────────────────────────

  const toggleRow = (id: string) => setSelectedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedRows(new Set(charges.map(c => c.id)));
  const deselectAll = () => setSelectedRows(new Set());
  const allSelected = charges.length > 0 && selectedRows.size === charges.length;

  const selectedCharges = charges.filter(c => selectedRows.has(c.id));

  // ── Charge totals ────────────────────────────────────────────────────────────
  const chargesSubtotal = charges.filter(c => !c.isWaived).reduce((s, c) => s + c.sellingRate * c.qty, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW A — LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (!activeStatement) {
    return (
      <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

        {/* Header */}
        <div className="gecko-page-actions">
          <div className="gecko-page-actions-left">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Billing Statements</h1>
              <span className="gecko-count-badge">{STATEMENTS.length} total</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
              Per-booking charge ledger. Filter by agent, customer, vessel, or booking reference.
            </div>
          </div>
          <div className="gecko-toolbar">
            <ExportButton resource="Billing statement" iconSize={16} />
            <FilterPopover
              fields={STMT_FILTER_FIELDS}
              values={filters}
              onChange={setFilters}
              onApply={v => setFilters(v)}
              onClear={() => setFilters({ query: '', bookingType: '', orderType: '', agent: '', customer: '', status: '', date: '' })}
              sortOptions={STMT_SORT_OPTIONS}
              sortValue={sortBy}
              onSortChange={setSortBy}
            />
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setModalState({ type: 'chargeDetail', charge: { ...EMPTY_CHARGE }, isNew: true })}>
              <Icon name="plus" size={16} /> New Statement
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13, tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>BOOKING NO</th>
                <th style={{ width: 130 }}>ORDER NO</th>
                <th style={{ width: 80 }}>TYPE</th>
                <th style={{ width: 110 }}>ORDER TYPE</th>
                <th>VESSEL / VOYAGE</th>
                <th style={{ width: 120 }}>AGENT</th>
                <th style={{ width: 150 }}>CUSTOMER</th>
                <th style={{ width: 50, textAlign: 'center' }}>CTRS</th>
                <th style={{ width: 100, textAlign: 'right' }}>BILLABLE</th>
                <th style={{ width: 90, textAlign: 'right' }}>BILLED</th>
                <th style={{ width: 90, textAlign: 'right' }}>UNBILLED</th>
                <th style={{ width: 80 }}>STATUS</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gecko-text-secondary)' }}>
                    <Icon name="filter" size={28} style={{ color: 'var(--gecko-text-disabled)', display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>No statements match the current filters</div>
                  </td>
                </tr>
              )}
              {listPageItems.map(s => {
                const unbilled = s.totalBillable - s.billedAmount;
                return (
                  <tr key={s.bookingNo}>
                    <td>
                      <span
                        style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)', cursor: 'pointer', fontSize: 12.5 }}
                        onClick={() => setActiveStatement(s)}
                      >
                        {s.bookingNo}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{s.orderNo}</td>
                    <td><BookingTypeBadge type={s.bookingType} /></td>
                    <td style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{s.orderType}</td>
                    <td style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.vesselVoyage}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 600 }}>{s.agentCode}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }} title={s.customerName}>{s.customerName}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{s.containers.length}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{fmt(s.totalBillable)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-success-700)' }}>{fmt(s.billedAmount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: unbilled > 0 ? 'var(--gecko-danger-600)' : 'var(--gecko-text-secondary)' }}>{fmt(unbilled)}</td>
                    <td><StatementStatusBadge status={s.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setActiveStatement(s)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gecko-primary-600)', padding: '3px 6px', borderRadius: 4, fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                        title="Open detail"
                      >→</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <TablePagination
            page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages}
            startRow={startRow} endRow={endRow} onPageChange={setPage} onPageSizeChange={setPageSize}
            noun="statements"
          />
        </div>

        {/* List-level modal (New Statement) */}
        {modalState?.type === 'chargeDetail' && (
          <ChargeDetailModal
            charge={modalState.charge}
            isNew={modalState.isNew}
            containers={[]}
            onClose={() => setModalState(null)}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW B — DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const unbilledDetail = activeStatement.totalBillable - activeStatement.billedAmount;

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Breadcrumb + back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
        <button
          onClick={() => setActiveStatement(null)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gecko-primary-600)', fontWeight: 600, fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
        >
          <Icon name="arrowLeft" size={14} /> Billing Statements
        </button>
        <span style={{ color: 'var(--gecko-text-disabled)' }}>/</span>
        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{activeStatement.bookingNo}</span>
      </div>

      {/* Header Card */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Left */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 20, color: 'var(--gecko-text-primary)', letterSpacing: '0.02em' }}>{activeStatement.bookingNo}</span>
              <BookingTypeBadge type={activeStatement.bookingType} />
              <StatementStatusBadge status={activeStatement.status} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12.5, color: 'var(--gecko-text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Agent:</span>{' '}
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{activeStatement.agentCode}</span>
                {' — '}{activeStatement.agentName}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--gecko-text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Customer:</span>{' '}
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-600)' }}>{activeStatement.customerCode}</span>
                {' — '}{activeStatement.customerName}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--gecko-text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Order Type:</span> {activeStatement.orderType}
                {'  '}
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Vessel:</span> {activeStatement.vesselVoyage}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--gecko-text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Sub-B/L:</span>{' '}
                <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{activeStatement.subBlNo}</span>
                {'  '}
                <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Order No:</span>{' '}
                <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{activeStatement.orderNo}</span>
              </div>
            </div>
          </div>

          {/* Right — stat boxes */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 10 }}>
            {[
              { label: 'Total Billable', value: activeStatement.totalBillable, color: 'var(--gecko-primary-700)' },
              { label: 'Billed',         value: activeStatement.billedAmount,  color: 'var(--gecko-success-700)' },
              { label: 'Unbilled',       value: unbilledDetail,                color: unbilledDetail > 0 ? 'var(--gecko-danger-700)' : 'var(--gecko-success-700)' },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '10px 18px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 10, textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 16, color: stat.color }}>{fmt(stat.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Toolbar */}
      <div className="gecko-page-actions" style={{ paddingTop: 0 }}>
        <div className="gecko-page-actions-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Charges</span>
          <span className="gecko-count-badge">{charges.length} lines</span>
          {selectedRows.size > 0 && (
            <span style={{ background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={allSelected ? deselectAll : selectAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          {/* Add Charge dropdown */}
          <div style={{ position: 'relative' }} ref={actionMenuRef}>
            <button
              className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={() => setShowActionMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              Add Charge <Icon name="chevronDown" size={13} />
            </button>
            {showActionMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 200, minWidth: 260, overflow: 'hidden' }}>
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}
                  onClick={() => { selectAll(); setShowActionMenu(false); }}
                >Select All</button>
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}
                  onClick={() => { deselectAll(); setShowActionMenu(false); }}
                >Unselect All</button>
                <div style={{ height: 1, background: 'var(--gecko-border)', margin: '4px 0' }} />
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}
                  onClick={() => { setModalState({ type: 'bulkCharge', mode: 'add' }); setShowActionMenu(false); }}
                >Add Charges to All Items</button>
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--gecko-text-primary)' }}
                  onClick={() => { setModalState({ type: 'bulkCharge', mode: 'update' }); setShowActionMenu(false); }}
                >Update Charges to All Items</button>
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: selectedRows.size > 0 ? 'pointer' : 'not-allowed', fontSize: 13, color: selectedRows.size > 0 ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)', opacity: selectedRows.size > 0 ? 1 : 0.5 }}
                  onClick={() => { if (selectedRows.size > 0) { setModalState({ type: 'waive' }); setShowActionMenu(false); } }}
                  title={selectedRows.size === 0 ? 'Select rows first' : undefined}
                >Waive Charges to Selected Items</button>
                <div style={{ height: 1, background: 'var(--gecko-border)', margin: '4px 0' }} />
                <button
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--gecko-danger-600)' }}
                  onClick={() => setShowActionMenu(false)}
                >Clear Details</button>
              </div>
            )}
          </div>

          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setModalState({ type: 'regenerate' })}>
            <Icon name="refreshCcw" size={13} /> Regenerate
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setModalState({ type: 'chargeDetail', charge: { ...EMPTY_CHARGE }, isNew: true })}>
            <Icon name="plus" size={13} /> Manual Charge
          </button>
        </div>
      </div>

      {/* Charges Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        {charges.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--gecko-text-secondary)' }}>
            <Icon name="fileText" size={32} style={{ color: 'var(--gecko-text-disabled)', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No charges yet</div>
            <div style={{ fontSize: 12 }}>Use &quot;+ Manual Charge&quot; to add the first line.</div>
          </div>
        ) : (
          <>
            <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5, tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={allSelected ? deselectAll : selectAll} style={{ cursor: 'pointer' }} />
                  </th>
                  <th style={{ width: 32, textAlign: 'center' }}>#</th>
                  <th style={{ width: 95 }}>CHARGE CODE</th>
                  <th style={{ width: 24, textAlign: 'center' }}></th>
                  <th>DESCRIPTION</th>
                  <th style={{ width: 115 }}>CONTAINER</th>
                  <th style={{ width: 64, textAlign: 'center' }}>SZ/TYPE</th>
                  <th style={{ width: 90 }}>MOVEMENT</th>
                  <th style={{ width: 70, textAlign: 'center' }}>TERM</th>
                  <th style={{ width: 80 }}>PAYMENT TO</th>
                  <th style={{ width: 55, textAlign: 'right' }}>QTY</th>
                  <th style={{ width: 90, textAlign: 'right' }}>RATE</th>
                  <th style={{ width: 105, textAlign: 'right' }}>QUOTATION</th>
                  <th style={{ width: 80, textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {chargesPagination.pageItems.map((charge, idx) => {
                  const isSelected = selectedRows.has(charge.id);
                  return (
                    <tr
                      key={charge.id}
                      style={{
                        opacity: charge.isWaived ? 0.5 : 1,
                        background: isSelected ? 'var(--gecko-primary-50)' : undefined,
                        borderLeft: isSelected ? '3px solid var(--gecko-primary-500)' : '3px solid transparent',
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(charge.id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--gecko-text-disabled)', fontSize: 11 }}>{chargesPagination.startRow + idx}</td>
                      <td>
                        <span
                          style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--gecko-primary-600)', background: 'var(--gecko-primary-50)', padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => setModalState({ type: 'chargeDetail', charge, isNew: false })}
                        >
                          {charge.chargeCode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', background: charge.isLocked ? 'var(--gecko-warning-50)' : undefined }}>
                        {charge.isLocked && (
                          <span title="Rate locked — excluded from Regenerate" style={{ color: 'var(--gecko-warning-600)', display: 'inline-flex', alignItems: 'center' }}>
                            <Icon name="lock" size={12} />
                          </span>
                        )}
                      </td>
                      <td style={{ textDecoration: charge.isWaived ? 'line-through' : undefined, color: 'var(--gecko-text-primary)' }}>{charge.chargeDesc}</td>
                      <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>{charge.containerNo}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{charge.size} {charge.ctrType}</td>
                      <td style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{charge.movementCode}</td>
                      <td style={{ textAlign: 'center' }}><PaymentTermBadge term={charge.paymentTerm} /></td>
                      <td style={{ fontSize: 11.5, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>{charge.paymentTo}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>{charge.qty.toFixed(3)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, textDecoration: charge.isWaived ? 'line-through' : undefined }}>
                        {fmt(charge.sellingRate)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontSize: 11.5, color: 'var(--gecko-text-secondary)' }}>
                        {charge.quotation || <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}><ChargeStatusBadge status={charge.status} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setModalState({ type: 'chargeDetail', charge, isNew: false })}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: '3px 5px', borderRadius: 4 }}
                          title="Edit charge"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--gecko-bg-subtle)', borderTop: '2px solid var(--gecko-border)' }}>
                  <td colSpan={11} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, color: 'var(--gecko-text-secondary)', paddingRight: 12 }}>Subtotal (non-waived)</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 13, color: 'var(--gecko-primary-700)', paddingRight: 12 }}>{fmt(chargesSubtotal)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>

            <TablePagination
              page={chargesPagination.page}
              pageSize={chargesPagination.pageSize}
              totalItems={chargesPagination.totalItems}
              totalPages={chargesPagination.totalPages}
              startRow={chargesPagination.startRow}
              endRow={chargesPagination.endRow}
              onPageChange={chargesPagination.setPage}
              onPageSizeChange={chargesPagination.setPageSize}
              noun="charges"
            />
          </>
        )}
      </div>

      {/* Modals */}
      {modalState?.type === 'chargeDetail' && (
        <ChargeDetailModal
          charge={modalState.charge}
          isNew={modalState.isNew}
          containers={activeStatement.containers}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'bulkCharge' && (
        <BulkChargeModal
          containers={activeStatement.containers}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'regenerate' && (
        <RegenerateModal
          charges={charges}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'waive' && (
        <WaiveModal
          selectedCharges={selectedCharges}
          customerName={activeStatement.customerName}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
