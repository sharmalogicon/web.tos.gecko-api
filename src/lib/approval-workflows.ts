/**
 * Approval Workflows — shared types and mock catalog
 *
 * Configurable approval chains used by the Tariff Schedule editor and other
 * future flows (rate-rebate approvals, credit-note approvals, etc.).
 *
 * AI-future room: the `threshold` rule is a structured DSL — same shape as the
 * conditional surcharge DSL on rate rows — so future "auto-approve if AI-confidence
 * > 0.9 AND delta < ±5%" rules slot in without schema change.
 */

export type ApproverKind = 'user' | 'role' | 'auto';

export interface ApprovalThreshold {
  /** When this rule evaluates to true, the step is auto-approved without human action. */
  condition: 'never' | 'always' | 'delta-pct-lt' | 'amount-lt' | 'ai-confidence-gte';
  value?: number;
}

export interface ApprovalStep {
  id: string;
  name: string;
  approverKind: ApproverKind;
  approverRef: string;          // user code, role name, or 'auto' label
  threshold?: ApprovalThreshold; // optional auto-skip rule
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  appliesTo: ('TARIFF_SCHEDULE' | 'REBATE' | 'CREDIT_NOTE')[];
  steps: ApprovalStep[];
}

// ── Mock catalog (replace with API/Redis-backed store in production) ──────────
//
// NOTE: these mirror what a typical SEA depot ops org would set up. The "VIP Fast
// Path" workflow demonstrates the threshold pattern: if the price delta vs the
// standard tariff is small, the finance step auto-approves.

export const WORKFLOWS: ApprovalWorkflow[] = [
  {
    id: 'wf-std-3step',
    name: 'Standard 3-Step',
    description: 'Sales drafts → Sales Manager → Finance signs off',
    isDefault: true,
    appliesTo: ['TARIFF_SCHEDULE'],
    steps: [
      { id: 's1', name: 'Sales draft',     approverKind: 'role', approverRef: 'SALES' },
      { id: 's2', name: 'Sales Manager',   approverKind: 'role', approverRef: 'SALES_MGR' },
      { id: 's3', name: 'Finance sign-off', approverKind: 'role', approverRef: 'FINANCE',
        threshold: { condition: 'delta-pct-lt', value: 5 } },
    ],
  },
  {
    id: 'wf-vip-fastpath',
    name: 'VIP Fast Path',
    description: 'For long-standing customers; finance auto-skips when delta < 10%',
    isDefault: false,
    appliesTo: ['TARIFF_SCHEDULE'],
    steps: [
      { id: 's1', name: 'Sales draft',     approverKind: 'role', approverRef: 'SALES' },
      { id: 's2', name: 'Sales Manager',   approverKind: 'role', approverRef: 'SALES_MGR' },
      { id: 's3', name: 'Finance auto-check', approverKind: 'auto', approverRef: 'auto',
        threshold: { condition: 'delta-pct-lt', value: 10 } },
    ],
  },
  {
    id: 'wf-onestep-spot',
    name: 'Spot One-Step',
    description: 'For short-term spot deals; Sales Manager signs off directly',
    isDefault: false,
    appliesTo: ['TARIFF_SCHEDULE'],
    steps: [
      { id: 's1', name: 'Sales Manager (direct)', approverKind: 'role', approverRef: 'SALES_MGR' },
    ],
  },
  {
    id: 'wf-4step-strategic',
    name: 'Strategic Account 4-Step',
    description: 'For large strategic contracts; Country Head signs off last',
    isDefault: false,
    appliesTo: ['TARIFF_SCHEDULE'],
    steps: [
      { id: 's1', name: 'Sales draft',         approverKind: 'role', approverRef: 'SALES' },
      { id: 's2', name: 'Sales Manager',       approverKind: 'role', approverRef: 'SALES_MGR' },
      { id: 's3', name: 'Finance sign-off',    approverKind: 'role', approverRef: 'FINANCE' },
      { id: 's4', name: 'Country Head',        approverKind: 'role', approverRef: 'COUNTRY_HEAD' },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  SALES:        'Sales Rep',
  SALES_MGR:    'Sales Manager',
  FINANCE:      'Finance Officer',
  COUNTRY_HEAD: 'Country Head',
  AUTO:         'Auto (system)',
};

export function describeThreshold(t?: ApprovalThreshold): string {
  if (!t || t.condition === 'never') return '';
  if (t.condition === 'always') return 'Auto-approves always';
  if (t.condition === 'delta-pct-lt') return `Auto-approves if Δ vs standard < ${t.value}%`;
  if (t.condition === 'amount-lt') return `Auto-approves if total < ฿${t.value?.toLocaleString()}`;
  if (t.condition === 'ai-confidence-gte') return `Auto-approves if AI confidence ≥ ${t.value}`;
  return '';
}
