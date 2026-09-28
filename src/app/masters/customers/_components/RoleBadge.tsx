import React from 'react';
import { PARTY_ROLES, type PartyRole } from '@/lib/api/parties';

const ROLE_BADGE: Record<PartyRole, string> = {
  CUSTOMER: 'gecko-badge-primary',
  SHIPPING_LINE: 'gecko-badge-info',
  FORWARDER: 'gecko-badge-warning',
  HAULIER: 'gecko-badge-success',
};

export function RoleBadge({ role }: { role: PartyRole }) {
  const label = PARTY_ROLES.find(r => r.value === role)?.label ?? role;
  return <span className={`gecko-badge gecko-badge-xs ${ROLE_BADGE[role] ?? ''}`}>{label}</span>;
}

